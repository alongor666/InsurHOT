// Admin entries for the monetary limits (ADR-015, docs/adr/015-monetary-budget-hard-limits.md):
// approving a price row or a monthly limit, which only an admin with the owner role may do and which
// is written to the audit log in the same transaction; withdrawing an approval, which any admin may do
// (it can only stop spending); and giving back the money of a call that failed but kept its
// reservation, after the provider's console showed it was not billed.
//
// Nothing here opens the paid lock. Lock order as in providers/money.ts: the receipt row, the global
// money lock, the attempt row, the ledger rows.
import { sql } from "../db.ts";
import {
  budgetDay, budgetMonth, knownCapabilities, lockMoney, MONEY_ALERT_RATIO, settleMoney, SUBJECT_KINDS,
} from "../providers/money.ts";
import { actorOf, audit, type AdminPrincipal } from "./auth.ts";
import { Conflict } from "./sources.ts";

const bad = (message: string) => Object.assign(new Error(message), { statusCode: 400 });

/** The actor of an approval: a signed-in admin with the owner role. The development stand-in is nobody's owner. */
function ownerActor(admin: AdminPrincipal): string {
  if (admin.dev || admin.userId === null || admin.role !== "owner") {
    throw Object.assign(new Error("只有 owner 可以批准价格和限额"), { statusCode: 403 });
  }
  return actorOf(admin);
}

const reasonOf = (value: unknown): string => {
  const reason = typeof value === "string" ? value.trim() : "";
  if (!reason) throw bad("reason is required");
  return reason.slice(0, 500);
};
/**
 * A price or a limit: a finite, non-negative number the column holds exactly, or null where it may be
 * absent. A value with more decimals than the column would be stored rounded, a small price as zero,
 * and the bound computed from it would be too low: it is refused instead.
 */
function amount(value: unknown, name: string, max: number, decimals = 6): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) throw bad(`${name} must be a number between 0 and ${max}`);
  if (Number(value.toFixed(decimals)) !== value) throw bad(`${name} has more than ${decimals} decimals, which the price table would round`);
  return value;
}
function integer(value: unknown, name: string, min: number): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > 2_000_000_000) throw bad(`${name} must be an integer of at least ${min}`);
  return value;
}
const currencyOf = (value: unknown): "CNY" | "USD" => {
  if (value !== "CNY" && value !== "USD") throw bad("currency must be CNY or USD");
  return value;
};

export interface PriceApproval {
  service: string;
  /** The model, or the endpoint name of a service without models. */
  model: string;
  currency: string;
  /** The provider host this price was checked against; requests to any other host are refused. */
  baseHost: string;
  inputPerMtok?: number | null;
  outputPerMtok?: number | null;
  perRequest?: number | null;
  perUnit?: number | null;
  unit?: string | null;
  maxUnitsPerRequest?: number | null;
  overheadTokens?: number | null;
  outputCapIncludesReasoning?: boolean | null;
  reasoningOff?: string | null;
  /** Where the price was read. */
  sourceUrl: string;
  reason: string;
}

const PRICE_COLUMNS = sql`service, model, currency, base_host, input_per_mtok, output_per_mtok, per_request, per_unit, unit, max_units_per_request,
  overhead_tokens, output_cap_includes_reasoning, reasoning_off, source_url, to_char(verified_on, 'YYYY-MM-DD') AS verified_on, note,
  approved_by, to_char(approved_on, 'YYYY-MM-DD') AS approved_on, suspended_at, suspended_reason`;

/**
 * The owner approves a price row as entered: the whole row is written, approved by the acting owner
 * today, and a suspension (an earlier cost above its reservation) ends with the new approval.
 */
export async function approvePrice(input: PriceApproval, admin: AdminPrincipal) {
  const actor = ownerActor(admin);
  const reason = reasonOf(input.reason);
  const service = String(input.service ?? "").trim();
  const model = String(input.model ?? "").trim();
  if (!/^[a-z0-9_-]{1,40}$/.test(service)) throw bad("service is required");
  // No service-level row: a price is for one model or one endpoint.
  if (!model || model.length > 120) throw bad("model (or endpoint name) is required");
  const baseHost = String(input.baseHost ?? "").trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/.test(baseHost)) throw bad("baseHost must be a host name, without scheme, port or path");
  let sourceUrl: string;
  try {
    const url = new URL(String(input.sourceUrl ?? ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    sourceUrl = url.toString();
  } catch {
    throw bad("sourceUrl must be the http(s) address the price was read from");
  }
  if (input.reasoningOff != null && input.reasoningOff !== "thinking.type=disabled" && input.reasoningOff !== "enable_thinking=false") throw bad("reasoningOff is not a known switch");
  if (input.outputCapIncludesReasoning != null && typeof input.outputCapIncludesReasoning !== "boolean") throw bad("outputCapIncludesReasoning must be true, false or null");
  const row = {
    service, model, currency: currencyOf(input.currency), base_host: baseHost,
    input_per_mtok: amount(input.inputPerMtok, "inputPerMtok", 99_999_999), output_per_mtok: amount(input.outputPerMtok, "outputPerMtok", 99_999_999),
    per_request: amount(input.perRequest, "perRequest", 99_999_999), per_unit: amount(input.perUnit, "perUnit", 99_999_999, 10),
    unit: input.unit == null ? null : String(input.unit).trim().slice(0, 40) || null,
    max_units_per_request: integer(input.maxUnitsPerRequest, "maxUnitsPerRequest", 1),
    overhead_tokens: integer(input.overheadTokens, "overheadTokens", 0) ?? 0,
    output_cap_includes_reasoning: input.outputCapIncludesReasoning ?? null, reasoning_off: input.reasoningOff ?? null,
    source_url: sourceUrl, note: reason,
  };
  if (row.input_per_mtok === null && row.per_request === null && row.per_unit === null) throw bad("a price needs token prices, a per-request price or a per-unit price");
  if ((row.per_unit === null) !== (row.unit === null)) throw bad("perUnit and unit go together");
  const today = budgetDay(new Date());
  return sql.begin(async (tx) => {
    // In line with reservations and settlements: none of them sees a half-approved row.
    await lockMoney(tx);
    const [before] = await tx`SELECT ${PRICE_COLUMNS} FROM service_prices WHERE service = ${service} AND model = ${model} FOR UPDATE`;
    const written = { ...row, verified_on: today, approved_by: actor, approved_on: today, suspended_at: null, suspended_reason: null, updated_at: new Date() };
    await tx`INSERT INTO service_prices ${tx(written as never)} ON CONFLICT (service, model) DO UPDATE SET ${tx(written as never)}`;
    const [after] = await tx`SELECT ${PRICE_COLUMNS} FROM service_prices WHERE service = ${service} AND model = ${model}`;
    await audit(actor, "money.price.approve", `price:${service}/${model}`, reason, before ?? null, after, undefined, tx);
    return after;
  });
}

/** Any admin may withdraw a price's approval: every request on that row is refused from then on. */
export async function withdrawPrice(input: { service: string; model: string; reason: string }, admin: AdminPrincipal) {
  const reason = reasonOf(input.reason);
  return sql.begin(async (tx) => {
    await lockMoney(tx);
    const [before] = await tx`SELECT ${PRICE_COLUMNS} FROM service_prices WHERE service = ${String(input.service)} AND model = ${String(input.model)} FOR UPDATE`;
    if (!before) return null;
    await tx`UPDATE service_prices SET approved_by = NULL, approved_on = NULL, updated_at = now() WHERE service = ${String(input.service)} AND model = ${String(input.model)}`;
    const [after] = await tx`SELECT ${PRICE_COLUMNS} FROM service_prices WHERE service = ${String(input.service)} AND model = ${String(input.model)}`;
    await audit(actorOf(admin), "money.price.withdraw", `price:${input.service}/${input.model}`, reason, before, after, undefined, tx);
    return after;
  });
}

export interface LimitApproval {
  scope: string;
  /** '' for global, the capability, or the subject kind (article, story, report). */
  key: string;
  currency: string;
  /** Zero stops everything that counts against this row. */
  monthlyLimit: number;
  reason: string;
}

const LIMIT_COLUMNS = sql`scope, key, currency, monthly_limit, approved_by, to_char(approved_on, 'YYYY-MM-DD') AS approved_on, note`;

/** The owner approves a monthly limit. The row is the limit from the next reservation on; what is already reserved stays counted. */
export async function approveLimit(input: LimitApproval, admin: AdminPrincipal) {
  const actor = ownerActor(admin);
  const reason = reasonOf(input.reason);
  const scope = String(input.scope ?? "");
  const key = String(input.key ?? "");
  if (scope === "global") {
    if (key !== "") throw bad("the global limit has no key");
  } else if (scope === "capability") {
    if (!(await knownCapabilities()).includes(key)) throw bad(`"${key}" is not a capability`);
  } else if (scope === "subject") {
    if (!(SUBJECT_KINDS as readonly string[]).includes(key)) throw bad(`"${key}" is not a subject kind (${SUBJECT_KINDS.join(", ")})`);
  } else {
    throw bad("scope must be global, capability or subject");
  }
  const currency = currencyOf(input.currency);
  const monthlyLimit = amount(input.monthlyLimit, "monthlyLimit", 99_999_999);
  if (monthlyLimit === null) throw bad("monthlyLimit is required");
  const today = budgetDay(new Date());
  return sql.begin(async (tx) => {
    await lockMoney(tx);
    const [before] = await tx`SELECT ${LIMIT_COLUMNS} FROM money_budgets WHERE scope = ${scope} AND key = ${key} AND currency = ${currency} FOR UPDATE`;
    await tx`
      INSERT INTO money_budgets (scope, key, currency, monthly_limit, approved_by, approved_on, note)
      VALUES (${scope}, ${key}, ${currency}, ${monthlyLimit}, ${actor}, ${today}, ${reason})
      ON CONFLICT (scope, key, currency) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit, approved_by = EXCLUDED.approved_by,
        approved_on = EXCLUDED.approved_on, note = EXCLUDED.note, updated_at = now()`;
    const [after] = await tx`SELECT ${LIMIT_COLUMNS} FROM money_budgets WHERE scope = ${scope} AND key = ${key} AND currency = ${currency}`;
    await audit(actor, "money.limit.approve", `limit:${scope}${key ? `:${key}` : ""}:${currency}`, reason, before ?? null, after, undefined, tx);
    return after;
  });
}

/**
 * A call that failed or was released and still holds its reservation (a 400, 422 or 5xx, a timeout, an
 * unknown outcome released without checking): after the admin checked the provider's console and found
 * it not billed, its money goes back. A received answer was billed and is not released here; an
 * unknown receipt is settled where it is released (admin/runs.ts). A figure the provider itself
 * reported is only overruled on explicit acknowledgement.
 */
export async function releaseHeldAttempt(attemptId: number, input: { note: string; acknowledgeFigure?: boolean }, actor: string) {
  const note = reasonOf(input.note);
  if (!Number.isInteger(attemptId)) throw bad("attempt id is required");
  return sql.begin(async (tx) => {
    const [found] = await tx<{ receipt_id: number }[]>`SELECT receipt_id FROM receipt_attempts WHERE id = ${attemptId}`;
    if (!found) return null;
    const [receipt] = await tx<{ status: string; attempts: number }[]>`SELECT status, attempts FROM receipts WHERE id = ${found.receipt_id} FOR UPDATE`;
    await lockMoney(tx);
    const [a] = await tx<{ attempt: number; status: string; holds_reservation: boolean; reserved_amount: number | null; settled_amount: number | null; reserved_currency: string | null }[]>`
      SELECT attempt, status, holds_reservation, reserved_amount, settled_amount, reserved_currency FROM receipt_attempts WHERE id = ${attemptId} FOR UPDATE`;
    if (!a || !receipt) return null;
    if (!a.holds_reservation) throw new Conflict("这次调用没有占用金额");
    if (a.status === "pending") throw new Conflict("这次调用还在进行中");
    if (a.status === "received") throw new Conflict("供应商已经返回了答案并计费，不能按未计费释放");
    if (receipt.status === "unknown" && receipt.attempts === a.attempt) throw new Conflict("这个回执的结果还未知：在“运行”页核对后放行，金额随放行一起处理");
    if (a.settled_amount !== null && !input.acknowledgeFigure) {
      const over = a.reserved_amount !== null && a.settled_amount > a.reserved_amount;
      throw new Conflict(`供应商为这次调用报告过金额 ${a.settled_amount} ${a.reserved_currency}${over ? `，高于预留的 ${a.reserved_amount}（价格行因此被停用）` : ""}；确认它确实没有计费后，带上 acknowledgeFigure 再释放`);
    }
    const before = { holds_reservation: true, reserved_amount: a.reserved_amount, settled_amount: a.settled_amount, currency: a.reserved_currency };
    await settleMoney(tx, attemptId, { kind: "release" });
    await audit(actor, "money.attempt.release", `attempt:${attemptId}`, note, before, { holds_reservation: false, settled_amount: 0 }, undefined, tx);
    return { id: attemptId, released: a.settled_amount ?? a.reserved_amount, currency: a.reserved_currency };
  });
}

/** Prices, limits with this month's usage, the calls that still hold money without an answer, and the last reconciliation. */
export async function moneyOverview() {
  const month = budgetMonth(new Date());
  const [prices, limits, subjects, held, reconciliation] = await Promise.all([
    sql`SELECT ${PRICE_COLUMNS} FROM service_prices ORDER BY service, model`,
    sql`
      SELECT b.scope, b.key, b.currency, b.monthly_limit, b.approved_by, to_char(b.approved_on, 'YYYY-MM-DD') AS approved_on, b.note,
             CASE WHEN b.scope = 'subject' THEN NULL ELSE coalesce(u.amount, 0) END AS used
      FROM money_budgets b
      LEFT JOIN money_usage u ON u.scope = b.scope AND u.key = b.key AND u.currency = b.currency AND u.month = ${month} AND b.scope <> 'subject'
      ORDER BY b.scope, b.key, b.currency`,
    // Per-subject limits are looked up by kind; usage is kept per subject.
    sql`
      SELECT split_part(key, ':', 1) AS kind, currency, count(*)::int AS subjects, max(amount) AS highest
      FROM money_usage WHERE scope = 'subject' AND month = ${month} GROUP BY 1, 2 ORDER BY 1, 2`,
    sql`
      SELECT a.id, a.receipt_id, a.attempt, a.service, a.model, a.status, r.purpose, r.subject, r.status AS receipt_status,
             a.reserved_amount, a.settled_amount, a.reserved_currency AS currency, to_char(a.budget_month, 'YYYY-MM-DD') AS month, left(a.error, 240) AS error, a.started_at
      FROM receipt_attempts a JOIN receipts r ON r.id = a.receipt_id
      WHERE a.holds_reservation AND a.status IN ('failed', 'unknown') AND a.origin = 'live'
      ORDER BY a.budget_month DESC, a.started_at DESC LIMIT 100`,
    sql<{ value: unknown }[]>`SELECT value FROM settings WHERE key = 'money.reconciliation'`,
  ]);
  return {
    month, alertRatio: MONEY_ALERT_RATIO, prices, limits, subjects, held, reconciliation: reconciliation[0]?.value ?? null,
    capabilities: await knownCapabilities(), subjectKinds: SUBJECT_KINDS,
  };
}
