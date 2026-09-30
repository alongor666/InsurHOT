// Operations side of the monetary limits (ADR-015 sections 5, 7 and 10): the daily comparison of the
// ledger with what the attempts hold, and what the alerts say about money. Reads only; nothing here
// changes a limit, a price or a reservation.
import { sql } from "../db.ts";
import type { Finding } from "../notify/feishu.ts";
import { budgetMonth, MONEY_ALERT_RATIO, reconcileMoneyLedger, type LedgerMismatch } from "../providers/money.ts";

const RECONCILIATION_KEY = "money.reconciliation";
interface Reconciliation { at: string; mismatches: number; rows: LedgerMismatch[] }

/** Daily (ops.money-reconcile), and on demand from the admin: compares and records; the alerts read the record. */
export async function runMoneyReconciliation(now = Date.now()): Promise<Reconciliation> {
  const rows = await reconcileMoneyLedger();
  const value: Reconciliation = { at: new Date(now).toISOString(), mismatches: rows.length, rows: rows.slice(0, 20) };
  await sql`INSERT INTO settings (key, value, updated_by) VALUES (${RECONCILIATION_KEY}, ${sql.json(value as never)}, 'ops.money-reconcile')
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`;
  return value;
}

const label = (scope: string, key: string) => (scope === "global" ? "全部付费调用" : scope === "capability" ? `「${key}」这一类调用` : `单个${key}`);
const pct = (ratio: number) => `${Math.round(ratio * 100)}%`;

/**
 * Money findings. "today": a monthly limit row is nearly or fully used (global and capability rows one
 * by one; subjects of one kind together, since each article or story has its own row). "now": a price
 * row stopped because a call cost more than its reservation, an overrun whose price row no longer
 * exists, and a ledger that disagrees with the attempts.
 */
export async function moneyFindings(now = Date.now()): Promise<Finding[]> {
  const out: Finding[] = [];
  const month = budgetMonth(new Date(now));
  const near = await sql<{ scope: string; key: string; currency: string; used: number; monthly_limit: number }[]>`
    SELECT b.scope, b.key, b.currency, u.amount AS used, b.monthly_limit
    FROM money_budgets b JOIN money_usage u ON u.scope = b.scope AND u.key = b.key AND u.currency = b.currency AND u.month = ${month}
    WHERE b.scope IN ('global', 'capability') AND b.monthly_limit > 0 AND u.amount >= b.monthly_limit * ${MONEY_ALERT_RATIO}::numeric
    ORDER BY b.scope, b.key, b.currency`;
  for (const r of near) {
    const full = Number(r.used) >= Number(r.monthly_limit);
    out.push({
      key: `money.limit.${r.scope}.${r.key || "all"}.${r.currency}`,
      level: "today",
      title: full ? `本月${label(r.scope, r.key)}的金额上限用完了` : `本月${label(r.scope, r.key)}的金额上限已用 ${pct(Number(r.used) / Number(r.monthly_limit))}`,
      impact: full ? "计入这条上限的付费调用全部停止，相关内容停在后台等待处理" : "用完后，计入这条上限的付费调用会全部停止",
      heals: "不会，下个月重新计算",
      action: "需要你决定是否提高上限（后台批准新的限额）；不提高就保持现状",
      detail: `money_budgets ${r.scope}:${r.key} ${r.currency}：已占用 ${r.used}，上限 ${r.monthly_limit}（按预留上界计，含未知结果与失败但可能已计费的调用）`,
    });
  }
  const subjects = await sql<{ kind: string; currency: string; n: number; monthly_limit: number }[]>`
    SELECT b.key AS kind, b.currency, count(*)::int AS n, b.monthly_limit
    FROM money_usage u JOIN money_budgets b ON b.scope = 'subject' AND b.key = split_part(u.key, ':', 1) AND b.currency = u.currency
    WHERE u.scope = 'subject' AND u.month = ${month} AND b.monthly_limit > 0 AND u.amount >= b.monthly_limit * ${MONEY_ALERT_RATIO}::numeric
    GROUP BY 1, 2, 4 ORDER BY 1, 2`;
  for (const s of subjects) {
    out.push({
      key: `money.limit.subject.${s.kind}.${s.currency}`,
      level: "today",
      title: `${s.n} 个${s.kind}接近或达到了单个对象的月度金额上限`,
      impact: "这些对象后续的模型步骤会被拒绝，停在后台等待处理",
      heals: "不会，下个月重新计算",
      action: "需要你决定是否提高单个对象的上限；不提高就保持现状",
      detail: `money_budgets subject:${s.kind} ${s.currency} 上限 ${s.monthly_limit}；money_usage 中 ${s.n} 行达到 ${pct(MONEY_ALERT_RATIO)}`,
    });
  }

  const suspended = await sql<{ service: string; model: string; suspended_at: Date; suspended_reason: string | null }[]>`
    SELECT service, model, suspended_at, suspended_reason FROM service_prices WHERE suspended_at IS NOT NULL ORDER BY service, model`;
  for (const p of suspended) {
    out.push({
      key: `money.price.suspended.${p.service}.${p.model}`,
      level: "now",
      title: `${p.service}/${p.model} 的一次调用花费超过了预留，这个价格已被停用`,
      impact: "用这个价格的付费调用全部停止；超出的金额已计入本月占用",
      heals: "不会",
      action: "对照供应商账单核对单价和计费方式，确认后在后台重新批准这条价格",
      detail: p.suspended_reason ?? "",
      since: p.suspended_at,
    });
  }
  // An overrun whose price row is gone could not be suspended: nothing stops the next call on a row re-created at the same price.
  const [orphans] = await sql<{ n: number; example: string | null }[]>`
    SELECT count(*)::int AS n, min(a.price_service || '/' || a.price_key) AS example FROM receipt_attempts a
    WHERE a.holds_reservation AND a.origin = 'live' AND a.budget_month = ${month} AND a.settled_amount > a.reserved_amount
      AND NOT EXISTS (SELECT 1 FROM service_prices p WHERE p.service = a.price_service AND p.model = a.price_key)`;
  if (orphans && orphans.n > 0) {
    out.push({
      key: "money.overrun.unpriced",
      level: "now",
      title: "有付费调用花费超过了预留，而它的价格记录已经不在了",
      impact: "超出的金额已计入本月占用；同一价格如果被重新录入，不会自动停用",
      heals: "不会",
      action: "转给 AI 处理：核对这些调用的计费，再决定是否重新录入并批准价格",
      detail: `本月 ${orphans.n} 次，例如 ${orphans.example}（receipt_attempts.settled_amount > reserved_amount，service_prices 无对应行）`,
    });
  }

  const [rec] = await sql<{ value: Reconciliation }[]>`SELECT value FROM settings WHERE key = ${RECONCILIATION_KEY}`;
  if (rec && rec.value.mismatches > 0) {
    const first = rec.value.rows[0];
    out.push({
      key: "money.ledger.mismatch",
      level: "now",
      title: "金额台账和调用记录对不上",
      impact: "月度上限可能被多算或少算；少算时实际花费可能超过你批准的上限",
      heals: "不会",
      action: "转给 AI 立即处理；查清之前建议把相关上限调为 0",
      detail: `${rec.value.mismatches} 行不一致（${rec.value.at} 的对账）${first ? `，例如 ${first.scope}:${first.key} ${first.currency} ${first.month}：台账 ${first.ledger}，调用合计 ${first.attempts}` : ""}；后台可重新对账`,
      since: new Date(rec.value.at),
    });
  }
  return out;
}
