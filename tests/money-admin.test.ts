// The operator side of the monetary limits (ADR-015, M0.3b step 3), on real PostgreSQL: only an owner
// approves a price or a limit, and an approval is what lets a request be claimed; a lost or failed
// call gives its money back only when an admin found it not billed; the stale sweep and a late answer
// respect what was recorded meanwhile; the alerts see a limit nearly used, a suspended price and a
// ledger that does not add up. Nothing is sent: the claim and settlement steps are called directly.
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { approveLimit, approvePrice, moneyOverview, releaseHeldAttempt, withdrawPrice, type PriceApproval } from "@aihot/backend/admin/money";
import { autoReleaseUnknownReceipts, releaseReceipt } from "@aihot/backend/admin/runs";
import { SESSION_COOKIE, type AdminPrincipal } from "@aihot/backend/admin/auth";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { sha256 } from "@aihot/backend/lib/ids";
import { moneyFindings, runMoneyReconciliation } from "@aihot/backend/operations/money";
import { dajialaMoney } from "@aihot/backend/providers/dajiala";
import { chatMoney } from "@aihot/backend/providers/llm";
import { budgetDay, budgetMonth, MoneyRefusedError, MonthlyBudgetExhaustedError, reconcileMoneyLedger } from "@aihot/backend/providers/money";
import {
  claimPaidRequest, failPaidAttempt, markStalePendingReceipts, ProviderRejectedError, settlePaidAttempt, type PaidClaim, type ReceiptRequest,
} from "@aihot/backend/providers/receipts";

const RUN = tag();
const LLM = `a-${RUN}-llm`;
const MODEL = `m-${RUN}`;
const HOST = `api-${RUN}.admin.test`;
const URL_ = `https://${HOST}/v1`;
const MONTH = budgetMonth(new Date());
let owner: AdminPrincipal, admin: AdminPrincipal;
const dev: AdminPrincipal = { userId: null, name: "dev", csrf: "dev", dev: true, role: "admin" };
let savedReconciliation: { value: unknown } | undefined;
let savedDajiala: { per_minute: number; per_hour: number; per_day: number } | undefined;

const price = (over: Partial<PriceApproval> = {}): PriceApproval => ({
  service: LLM, model: MODEL, currency: "CNY", baseHost: HOST, inputPerMtok: 2, outputPerMtok: 8, outputCapIncludesReasoning: true,
  sourceUrl: "https://provider.example/pricing", reason: "核对过价格页", ...over,
});
const limitOf = (scope: string, key: string, monthlyLimit: number) => approveLimit({ scope, key, currency: "CNY", monthlyLimit, reason: "测试限额" }, owner);

before(async () => {
  // This file owns the limit rows and this month's ledger while it runs (test files run one at a time).
  await sql`DELETE FROM money_budgets`;
  await sql`UPDATE receipt_attempts SET holds_reservation = false WHERE holds_reservation AND budget_month = ${MONTH}`;
  await sql`DELETE FROM money_usage WHERE month = ${MONTH}`;
  [savedReconciliation] = await sql<{ value: unknown }[]>`SELECT value FROM settings WHERE key = 'money.reconciliation'`;
  await sql`DELETE FROM settings WHERE key = 'money.reconciliation'`;
  const user = async (role: string) => (await sql<{ id: number }[]>`INSERT INTO admin_users (email, display_name, role) VALUES (${`${role}-${RUN}@test.invalid`}, ${role}, ${role}) RETURNING id`)[0]!.id;
  owner = { userId: await user("owner"), name: "owner", csrf: "t", dev: false, role: "owner" };
  admin = { userId: await user("admin"), name: "admin", csrf: "t", dev: false, role: "admin" };
  await sql`INSERT INTO budgets (service, per_minute, per_hour, per_day, note) VALUES (${LLM}, 100000, 100000, 100000, 'money admin test') ON CONFLICT (service) DO NOTHING`;
  [savedDajiala] = await sql<{ per_minute: number; per_hour: number; per_day: number }[]>`SELECT per_minute, per_hour, per_day FROM budgets WHERE service = 'dajiala'`;
  await sql`UPDATE budgets SET per_minute = 100000, per_hour = 100000, per_day = 100000 WHERE service = 'dajiala'`;
});
after(async () => {
  await sql`DELETE FROM receipts WHERE subject LIKE ${`%${RUN}%`}`;
  await sql`DELETE FROM money_usage WHERE month = ${MONTH}`;
  await sql`DELETE FROM money_budgets`;
  await sql`DELETE FROM service_prices WHERE base_host = ${HOST}`;
  await sql`DELETE FROM budgets WHERE service = ${LLM}`;
  if (savedDajiala) await sql`UPDATE budgets SET per_minute = ${savedDajiala.per_minute}, per_hour = ${savedDajiala.per_hour}, per_day = ${savedDajiala.per_day} WHERE service = 'dajiala'`;
  await sql`DELETE FROM audit_log WHERE actor IN (${`admin:${owner.userId}`}, ${`admin:${admin.userId}`})`;
  await sql`DELETE FROM admin_users WHERE email LIKE ${`%-${RUN}@test.invalid`}`; // their sessions go with them
  await sql`DELETE FROM settings WHERE key = 'money.reconciliation'`;
  if (savedReconciliation) await sql`INSERT INTO settings (key, value, updated_by) VALUES ('money.reconciliation', ${sql.json(savedReconciliation.value as never)}, 'test')`;
  await stopBoss();
  await closeDb();
});

let n = 0;
/** A chat request the way providers/llm.ts builds it, on this run's model. */
function chat(subject = `article:${RUN}a${n}@1`): ReceiptRequest {
  const body = { model: MODEL, messages: [{ role: "system", content: "s" }, { role: "user", content: "保险 text" }], temperature: 0.2, max_tokens: 1000, response_format: { type: "json_object" } };
  return { service: LLM, model: MODEL, purpose: "score_article", subject, identity: { n: n++, run: RUN }, money: chatMoney({ model: MODEL, extra: {} }, URL_, body) };
}
const called = (claim: PaidClaim) => { assert.equal(claim.kind, "call"); return claim as Extract<PaidClaim, { kind: "call" }>; };
const refused = (reason: string) => (e: unknown) => e instanceof MoneyRefusedError && e.reason === reason;
const status = (code: number) => (e: unknown) => (e as { statusCode?: number }).statusCode === code;
const conflict = (e: unknown) => (e as { code?: string }).code === "conflict";
const attemptOf = async (id: number) => (await sql<{ status: string; holds_reservation: boolean; reserved_amount: number; settled_amount: number | null }[]>`
  SELECT status, holds_reservation, reserved_amount, settled_amount FROM receipt_attempts WHERE id = ${id}`)[0]!;
const receiptStatus = async (id: number) => (await sql<{ status: string }[]>`SELECT status FROM receipts WHERE id = ${id}`)[0]!.status;
const used = async (scope: string, key: string) => (await sql<{ amount: number }[]>`SELECT amount FROM money_usage WHERE scope = ${scope} AND key = ${key} AND currency = 'CNY' AND month = ${MONTH}`)[0]?.amount ?? 0;
const makeStale = (id: number) => sql`UPDATE receipts SET updated_at = now() - interval '11 minutes' WHERE id = ${id}`;
const consistent = async () => assert.deepEqual(await reconcileMoneyLedger(), []);
const audits = (action: string, subject: string) => sql<{ actor: string; reason: string; before: Record<string, unknown> | null; after: Record<string, unknown> }[]>`
  SELECT actor, reason, before, after FROM audit_log WHERE action = ${action} AND subject = ${subject} ORDER BY id`;
/** A request whose placeholder went stale: its receipt is unknown and its attempt still holds the money. */
async function lost() {
  const req = chat();
  const claim = called(await claimPaidRequest(req));
  await makeStale(claim.id);
  await markStalePendingReceipts();
  assert.equal(await receiptStatus(claim.id), "unknown");
  return { req, claim };
}

// ---------------------------------------------------------------------------------------------------

test("only an admin with the owner role approves a price or a limit; anyone else changes nothing", async () => {
  for (const who of [admin, dev, { ...owner, dev: true }, { ...owner, userId: null }]) {
    await assert.rejects(approvePrice(price(), who), status(403));
    await assert.rejects(approveLimit({ scope: "global", key: "", currency: "CNY", monthlyLimit: 10, reason: "r" }, who), status(403));
  }
  assert.equal((await sql`SELECT 1 FROM service_prices WHERE base_host = ${HOST}`).length, 0);
  assert.equal((await sql`SELECT 1 FROM money_budgets`).length, 0);
  assert.equal((await audits("money.price.approve", `price:${LLM}/${MODEL}`)).length, 0);

  const approved = await approvePrice(price(), owner) as Record<string, unknown>;
  const today = budgetDay(new Date());
  assert.deepEqual([approved.approved_by, approved.approved_on, approved.verified_on, approved.base_host, approved.suspended_at], [`admin:${owner.userId}`, today, today, HOST, null]);
  const [entry] = await audits("money.price.approve", `price:${LLM}/${MODEL}`);
  assert.deepEqual([entry!.actor, entry!.reason, entry!.before, entry!.after.approved_by], [`admin:${owner.userId}`, "核对过价格页", null, `admin:${owner.userId}`]);
});

test("a price or limit that is not what the mechanism can use is refused as entered", async () => {
  const badPrices: Array<Partial<PriceApproval>> = [
    { reason: " " }, { model: "" }, { currency: "EUR" }, { baseHost: "https://api.example/v1" }, { baseHost: "" }, { sourceUrl: "price page" },
    { inputPerMtok: -1 }, { inputPerMtok: Number.NaN }, { inputPerMtok: null, outputPerMtok: null }, { perUnit: 0.1 }, { maxUnitsPerRequest: 0 },
    { overheadTokens: 1.5 }, { reasoningOff: "reasoning=off" }, { outputCapIncludesReasoning: "yes" as never },
    // More decimals than the column keeps: stored as written they would round, a tiny price to zero.
    { inputPerMtok: 4e-7, outputPerMtok: 4e-7 }, { outputPerMtok: 0.1234564 }, { perRequest: 0.0000001 }, { perUnit: 1e-11, unit: "token" },
  ];
  for (const over of badPrices) await assert.rejects(approvePrice(price({ model: `bad-${RUN}`, ...over }), owner), status(400), JSON.stringify(over));
  assert.equal((await sql`SELECT 1 FROM service_prices WHERE model = ${`bad-${RUN}`}`).length, 0);
  const badLimits = [
    { scope: "global", key: "x" }, { scope: "capability", key: "no-such-capability" }, { scope: "subject", key: "quote" }, { scope: "model", key: MODEL },
    { scope: "capability", key: "score", monthlyLimit: -1 }, { scope: "capability", key: "score", currency: "EUR" }, { scope: "capability", key: "score", reason: "" },
  ];
  // What the columns do hold is taken as entered: six decimals, ten for a per-unit price.
  const fine = await approvePrice(price({ model: `fine-${RUN}`, inputPerMtok: 0.000001, outputPerMtok: 0.123456, perUnit: 0.0000000036, unit: "token", maxUnitsPerRequest: 100 }), owner) as Record<string, unknown>;
  assert.deepEqual([fine.input_per_mtok, fine.output_per_mtok, fine.per_unit], [0.000001, 0.123456, 0.0000000036]);
  await assert.rejects(approveLimit({ scope: "capability", key: "score", currency: "CNY", monthlyLimit: 0.0000001, reason: "r" }, owner), status(400));
  for (const over of badLimits) await assert.rejects(approveLimit({ currency: "CNY", monthlyLimit: 5, reason: "r", ...over } as never, owner), status(400), JSON.stringify(over));
  assert.equal((await sql`SELECT 1 FROM money_budgets`).length, 0);
});

test("the owner's approvals, and nothing else, let a request be claimed; any admin can withdraw a price; a new approval ends a suspension", async () => {
  // The price from the first test is approved; no limit is.
  await assert.rejects(claimPaidRequest(chat()), refused("missing_limit"));
  await limitOf("global", "", 100);
  await limitOf("capability", "score", 100);
  await limitOf("subject", "article", 100);
  const [limitAudit] = await audits("money.limit.approve", "limit:capability:score:CNY");
  assert.deepEqual([limitAudit!.actor, limitAudit!.after.monthly_limit, limitAudit!.after.approved_by], [`admin:${owner.userId}`, 100, `admin:${owner.userId}`]);
  const first = called(await claimPaidRequest(chat()));
  await failPaidAttempt(first, new ProviderRejectedError("HTTP 401", 401, false), 1);

  // A limit of zero stops the capability; the owner raises it again.
  await limitOf("capability", "score", 0);
  await assert.rejects(claimPaidRequest(chat()), (e) => e instanceof MonthlyBudgetExhaustedError && e.scope === "capability");
  await limitOf("capability", "score", 100);

  // Withdrawn by an ordinary admin: refused until the owner approves again.
  assert.equal(await withdrawPrice({ service: LLM, model: `nope-${RUN}`, reason: "r" }, admin), null);
  const withdrawn = await withdrawPrice({ service: LLM, model: MODEL, reason: "供应商调价，先停" }, admin) as Record<string, unknown>;
  assert.deepEqual([withdrawn.approved_by, withdrawn.approved_on], [null, null]);
  assert.equal((await audits("money.price.withdraw", `price:${LLM}/${MODEL}`))[0]!.actor, `admin:${admin.userId}`);
  await assert.rejects(claimPaidRequest(chat()), refused("unapproved_price"));
  await approvePrice(price(), owner);

  // A call that cost more than its reservation suspends the row; only a new approval by the owner lifts it.
  const req = chat();
  const claim = called(await claimPaidRequest(req));
  assert.deepEqual(await settlePaidAttempt(req, claim, { response: {}, usage: { prompt_tokens: 10, completion_tokens: 900000 } }, 1), { overrun: true, priceSuspended: true });
  await assert.rejects(claimPaidRequest(chat()), refused("suspended_price"));
  await assert.rejects(approvePrice(price(), admin), status(403));
  await assert.rejects(claimPaidRequest(chat()), refused("suspended_price"));
  const again = await approvePrice(price({ outputPerMtok: 9 }), owner) as Record<string, unknown>;
  assert.deepEqual([again.suspended_at, again.suspended_reason, again.output_per_mtok], [null, null, 9]);
  called(await claimPaidRequest(chat()));
  await consistent();
});

test("an unknown receipt released by hand gives its money back only when it was found not billed", async () => {
  const before = await used("capability", "score");
  const billed = await lost();
  const unchecked = await lost();
  const free = await lost();
  const reserved = (await attemptOf(free.claim.attemptId)).reserved_amount;
  assert.equal(await used("capability", "score"), Math.round((before + 3 * reserved) * 1e6) / 1e6);

  // The answer must be a clear yes or no: anything else changes nothing.
  await assert.rejects(releaseReceipt(free.claim.id, { billed: "false" as never, note: "n" }, "admin:t"), status(400));
  await assert.rejects(releaseReceipt(free.claim.id, { note: "n" } as never, "admin:t"), status(400));
  assert.equal(await receiptStatus(free.claim.id), "unknown");

  const a = await releaseReceipt(billed.claim.id, { billed: true, note: "控制台有这笔" }, "admin:t");
  assert.deepEqual([a!.status, a!.moneyReleased], ["failed", 0]);
  assert.deepEqual(await attemptOf(billed.claim.attemptId), { status: "failed", holds_reservation: true, reserved_amount: reserved, settled_amount: null });

  await sql`UPDATE receipts SET updated_at = now() - interval '31 minutes' WHERE id = ${unchecked.claim.id}`;
  assert.ok((await autoReleaseUnknownReceipts()).released >= 1);
  assert.deepEqual(await attemptOf(unchecked.claim.attemptId), { status: "failed", holds_reservation: true, reserved_amount: reserved, settled_amount: null }, "released unchecked: still counted");

  const c = await releaseReceipt(free.claim.id, { billed: false, note: "控制台没有这笔" }, "admin:t");
  assert.deepEqual([c!.status, c!.moneyReleased], ["failed", 1]);
  assert.deepEqual(await attemptOf(free.claim.attemptId), { status: "failed", holds_reservation: false, reserved_amount: reserved, settled_amount: 0 });
  assert.equal(await used("capability", "score"), Math.round((before + 2 * reserved) * 1e6) / 1e6);
  assert.equal((await audits("receipt.release", `receipt:${free.claim.id}`))[0]!.after.moneyReleased, 1);
  // The retry of a released receipt is a new attempt with its own reservation.
  assert.equal(called(await claimPaidRequest(free.req)).attempt, 2);
  await consistent();
});

test("found not billed gives back only the call that was checked: an earlier attempt of the receipt, released unchecked, keeps its money and its record", async () => {
  // Attempt 1 is lost and released automatically, unchecked; the retry is attempt 2.
  const { req, claim: first } = await lost();
  await sql`UPDATE receipts SET updated_at = now() - interval '31 minutes' WHERE id = ${first.id}`;
  assert.ok((await autoReleaseUnknownReceipts()).released >= 1);
  const second = called(await claimPaidRequest(req));
  assert.deepEqual([second.id, second.attempt], [first.id, 2]);
  // The first call's own timeout arrives late: its attempt stays what the release made it.
  await failPaidAttempt(first, new Error("socket hang up"), 1);
  const [a1] = await sql<{ status: string; error: string; holds_reservation: boolean }[]>`SELECT status, error, holds_reservation FROM receipt_attempts WHERE id = ${first.attemptId}`;
  assert.deepEqual([a1!.status, a1!.holds_reservation, /^自动放行/.test(a1!.error)], ["failed", true, true]);
  // Attempt 2 is lost as well; the admin checks that call and finds it not billed.
  await makeStale(second.id);
  await markStalePendingReceipts();
  assert.equal(await receiptStatus(second.id), "unknown");
  const done = await releaseReceipt(second.id, { billed: false, note: "控制台没有第二次调用" }, "admin:t");
  assert.equal(done!.moneyReleased, 1);
  assert.deepEqual([(await attemptOf(second.attemptId)).holds_reservation, (await attemptOf(first.attemptId)).holds_reservation], [false, true], "only the checked call is given back");
  // The automatic release was used: a third loss waits for the admin.
  const third = called(await claimPaidRequest(req));
  await makeStale(third.id);
  await markStalePendingReceipts();
  await sql`UPDATE receipts SET updated_at = now() - interval '31 minutes' WHERE id = ${third.id}`;
  await autoReleaseUnknownReceipts();
  assert.equal(await receiptStatus(third.id), "unknown");
  await releaseReceipt(third.id, { billed: true, note: "n" }, "admin:t");

  // Even with an earlier attempt recorded as unknown (a row from before this rule, or changed by hand),
  // the release looks at the receipt's latest attempt only.
  const other = await lost();
  await sql`UPDATE receipts SET updated_at = now() - interval '31 minutes' WHERE id = ${other.claim.id}`;
  await autoReleaseUnknownReceipts();
  const retry = called(await claimPaidRequest(other.req));
  await makeStale(retry.id);
  await markStalePendingReceipts();
  await sql`UPDATE receipt_attempts SET status = 'unknown' WHERE id = ${other.claim.attemptId}`;
  assert.equal((await releaseReceipt(retry.id, { billed: false, note: "控制台没有第二次调用" }, "admin:t"))!.moneyReleased, 1);
  assert.deepEqual([(await attemptOf(retry.attemptId)).holds_reservation, (await attemptOf(other.claim.attemptId)).holds_reservation], [false, true]);
  await consistent();
});

test("a failed call that kept its reservation is released after checking; an answer, a call in flight, an unknown receipt and a provider's own figure are not", async () => {
  const before = await used("global", "");
  const req = chat();
  const claim = called(await claimPaidRequest(req));
  await assert.rejects(releaseHeldAttempt(claim.attemptId, { note: "n" }, "admin:t"), conflict, "in flight");
  await failPaidAttempt(claim, new ProviderRejectedError("HTTP 500", 500, true), 1);
  const held = await attemptOf(claim.attemptId);
  assert.deepEqual([held.status, held.holds_reservation], ["failed", true]);
  assert.ok((await moneyOverview()).held.some((h) => h.id === claim.attemptId), "listed for the admin");
  await assert.rejects(releaseHeldAttempt(claim.attemptId, { note: " " }, "admin:t"), status(400));
  const done = await releaseHeldAttempt(claim.attemptId, { note: "控制台没有这笔" }, "admin:t");
  assert.deepEqual(done, { id: claim.attemptId, released: held.reserved_amount, currency: "CNY" });
  assert.deepEqual([(await attemptOf(claim.attemptId)).holds_reservation, await used("global", "")], [false, before]);
  assert.deepEqual((await audits("money.attempt.release", `attempt:${claim.attemptId}`)).map((e) => [e.actor, e.after.holds_reservation]), [["admin:t", false]]);
  await assert.rejects(releaseHeldAttempt(claim.attemptId, { note: "n" }, "admin:t"), conflict, "nothing left to release");
  assert.ok(!(await moneyOverview()).held.some((h) => h.id === claim.attemptId));
  assert.equal(await releaseHeldAttempt(2_000_000_000, { note: "n" }, "admin:t"), null);

  // An answer was billed, also when it was unusable.
  const answered = chat();
  const got = called(await claimPaidRequest(answered));
  await settlePaidAttempt(answered, got, { response: {}, usage: { prompt_tokens: 10, completion_tokens: 5 } }, 1);
  await assert.rejects(releaseHeldAttempt(got.attemptId, { note: "n" }, "admin:t"), conflict);
  await assert.rejects(releaseHeldAttempt(got.attemptId, { note: "n", acknowledgeFigure: true }, "admin:t"), (e) => conflict(e) && /已经返回了答案/.test(String((e as Error).message)));
  assert.equal((await attemptOf(got.attemptId)).holds_reservation, true);
  // An unknown receipt is settled where it is released.
  const unknown = await lost();
  await assert.rejects(releaseHeldAttempt(unknown.claim.attemptId, { note: "n" }, "admin:t"), conflict);
  assert.equal((await attemptOf(unknown.claim.attemptId)).holds_reservation, true);

  // Dajiala refused the request and reported a charge: overruled only on explicit acknowledgement.
  await approvePrice({ service: "dajiala", model: "post_history", currency: "CNY", baseHost: HOST, perRequest: 0.14, sourceUrl: "https://provider.example/pricing", reason: "r" }, owner);
  await limitOf("capability", "collect.dajiala", 100);
  const mp: ReceiptRequest = { service: "dajiala", purpose: "mp_history", subject: `src-${RUN}`, identity: { mp: RUN }, money: dajialaMoney("post_history", URL_) };
  const charged = called(await claimPaidRequest(mp));
  await failPaidAttempt(charged, new ProviderRejectedError("dajiala code 101", 101, false, { providerCode: 101, cost: { amount: 0.14, currency: "CNY" } }), 1);
  assert.equal((await attemptOf(charged.attemptId)).settled_amount, 0.14);
  await assert.rejects(releaseHeldAttempt(charged.attemptId, { note: "n" }, "admin:t"), (e) => conflict(e) && /acknowledgeFigure/.test(String((e as Error).message)));
  assert.equal((await attemptOf(charged.attemptId)).holds_reservation, true);
  assert.deepEqual(await releaseHeldAttempt(charged.attemptId, { note: "供应商确认退回", acknowledgeFigure: true }, "admin:t"), { id: charged.attemptId, released: 0.14, currency: "CNY" });
  await consistent();
});

test("the stale sweep leaves alone a receipt that changed after the sweep listed it: an answer, or a retry that made it fresh", async () => {
  /** Runs the sweep against a stale placeholder while another session, holding the receipt row, changes it and commits. */
  async function sweepWhile(change: (holder: typeof sql, id: number) => Promise<unknown>) {
    const req = chat();
    const claim = called(await claimPaidRequest(req));
    await makeStale(claim.id);
    const holder = await sql.reserve();
    let sweep: Promise<number>;
    try {
      await holder`BEGIN`;
      await holder`SELECT 1 FROM receipts WHERE id = ${claim.id} FOR UPDATE`;
      // The sweep lists the receipt and then waits for its row.
      sweep = markStalePendingReceipts();
      let waiting = false;
      for (let i = 0; i < 200 && !waiting; i++) {
        waiting = (await sql`SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%receipts%' AND pid <> pg_backend_pid()`).length > 0;
        if (!waiting) await new Promise((r) => setTimeout(r, 20));
      }
      assert.ok(waiting, "the sweep reached the row and waits for it");
      await change(holder as never, claim.id);
      await holder`COMMIT`;
    } finally {
      holder.release();
    }
    await sweep;
    return { req, claim };
  }
  const answered = await sweepWhile((holder, id) => holder`UPDATE receipts SET status = 'received', response = '{"late":true}'::jsonb, updated_at = now() WHERE id = ${id}`);
  assert.equal(await receiptStatus(answered.claim.id), "received", "the answer is not overwritten by unknown");
  assert.equal((await claimPaidRequest(answered.req)).kind, "reuse");
  await sql`UPDATE receipt_attempts SET status = 'received', finished_at = now() WHERE id = ${answered.claim.attemptId}`;

  // Still waiting, but no longer stale (a retry took the placeholder over): it is in flight, not unknown.
  const fresh = await sweepWhile((holder, id) => holder`UPDATE receipts SET updated_at = now() WHERE id = ${id}`);
  assert.equal(await receiptStatus(fresh.claim.id), "pending");
  assert.equal((await attemptOf(fresh.claim.attemptId)).status, "pending");
  assert.equal((await claimPaidRequest(fresh.req)).kind, "busy");
  await failPaidAttempt(fresh.claim, new ProviderRejectedError("HTTP 401", 401, false), 1);
});

test("an answer that arrives after its receipt was released, and before any retry, is taken instead of being paid for twice", async () => {
  const { req, claim } = await lost();
  await releaseReceipt(claim.id, { billed: false, note: "控制台没有这笔" }, "admin:t");
  assert.deepEqual([await receiptStatus(claim.id), (await attemptOf(claim.attemptId)).holds_reservation], ["failed", false]);
  // The provider had taken it after all: the answer arrives late, with its usage.
  await settlePaidAttempt(req, claim, { response: { late: true }, usage: { prompt_tokens: 300, completion_tokens: 50 } }, 1);
  assert.equal(await receiptStatus(claim.id), "received");
  const paid = await attemptOf(claim.attemptId);
  assert.deepEqual([paid.status, paid.holds_reservation, paid.settled_amount], ["received", true, 0.00105], "and its cost counts again");
  const again = await claimPaidRequest(req);
  assert.deepEqual([again.kind, again.kind === "reuse" && again.row.response], ["reuse", { late: true }]);

  // Once a retry is under way the late answer stays on its own attempt, as before.
  const second = await lost();
  await releaseReceipt(second.claim.id, { billed: true, note: "n" }, "admin:t");
  const retry = called(await claimPaidRequest(second.req));
  await settlePaidAttempt(second.req, second.claim, { response: { late: true }, usage: { prompt_tokens: 10, completion_tokens: 5 } }, 1);
  assert.equal(await receiptStatus(second.claim.id), "pending");
  await settlePaidAttempt(second.req, retry, { response: { retry: true }, usage: { prompt_tokens: 10, completion_tokens: 5 } }, 1);
  assert.equal(await receiptStatus(second.claim.id), "received");
  await consistent();
});

test("alerts: a limit row at the threshold, subjects of a kind together, a suspended price, and a ledger that does not add up", async () => {
  const mine = async () => (await moneyFindings()).filter((f) => f.key.startsWith("money.limit.") || f.key.includes(RUN) || f.key === "money.ledger.mismatch" || f.key === "money.overrun.unpriced");
  const keys = async () => (await mine()).map((f) => `${f.level} ${f.key}`).sort();
  await approvePrice(price(), owner);
  assert.deepEqual(await keys(), [], "limits of 100 are far from used");

  const score = await used("capability", "score");
  await limitOf("capability", "score", Math.floor((score / 0.8) * 1e6) / 1e6);
  assert.deepEqual(await keys(), ["today money.limit.capability.score.CNY"]);
  assert.match((await mine())[0]!.title, /已用 8\d%/);
  await limitOf("capability", "score", Math.ceil((score / 0.79) * 1e6) / 1e6);
  assert.deepEqual(await keys(), [], "just under the threshold");
  // Used up: a finding of its own, so it goes out at once; the 80% one stays open beside it.
  await limitOf("capability", "score", score);
  assert.deepEqual(await keys(), ["today money.limit.capability.score.CNY", "today money.limit.capability.score.CNY.exhausted"]);
  assert.deepEqual((await mine()).map((f) => /用完了/.test(f.title)), [false, true]);
  // Last month's usage says nothing about this month's limit.
  const lastMonth = budgetMonth(new Date(Date.parse(`${MONTH}T00:00:00+08:00`) - 86400_000));
  await limitOf("capability", "digest", 1);
  await sql`INSERT INTO money_usage (scope, key, currency, month, amount) VALUES ('capability', 'digest', 'CNY', ${lastMonth}, 1)`;
  try {
    assert.deepEqual((await keys()).filter((k) => k.includes("digest")), []);
  } finally {
    await sql`DELETE FROM money_usage WHERE scope = 'capability' AND key = 'digest' AND month = ${lastMonth}`;
  }
  // A row stopped at zero is a decision, not an alert.
  await limitOf("capability", "score", 0);
  assert.deepEqual(await keys(), []);
  await limitOf("capability", "score", 100);

  // Two articles at their per-article limit: one finding for the kind.
  const [highest] = await sql<{ amount: number }[]>`SELECT amount FROM money_usage WHERE scope = 'subject' AND month = ${MONTH} ORDER BY amount DESC LIMIT 1`;
  await limitOf("subject", "article", highest!.amount);
  const subjectFindings = (await mine()).filter((f) => f.key === "money.limit.subject.article.CNY");
  assert.equal(subjectFindings.length, 1);
  assert.match(subjectFindings[0]!.title, /^\d+ 个article/);
  await limitOf("subject", "article", 0);
  assert.deepEqual(await keys(), [], "per-subject rows stopped at zero raise nothing either");
  await limitOf("subject", "article", 100);

  // An overrun suspends the price: a "now" finding until the owner approves it again.
  const req = chat();
  const claim = called(await claimPaidRequest(req));
  await settlePaidAttempt(req, claim, { response: {}, usage: { prompt_tokens: 10, completion_tokens: 900000 } }, 1);
  assert.deepEqual(await keys(), [`now money.price.suspended.${LLM}.${MODEL}`]);
  await sql`DELETE FROM service_prices WHERE service = ${LLM} AND model = ${MODEL}`;
  assert.deepEqual(await keys(), ["now money.overrun.unpriced"], "the row is gone: nothing could be suspended");
  await approvePrice(price(), owner);
  assert.deepEqual(await keys(), []);

  // The daily comparison records what it found; the alert reads the record.
  assert.equal((await runMoneyReconciliation()).mismatches, 0);
  assert.deepEqual(await keys(), []);
  await sql`UPDATE money_usage SET amount = amount + 1 WHERE scope = 'global' AND key = '' AND currency = 'CNY' AND month = ${MONTH}`;
  assert.deepEqual(await keys(), [], "not seen before the comparison runs");
  const found = await runMoneyReconciliation();
  assert.deepEqual([found.mismatches, found.rows[0]!.scope], [1, "global"]);
  assert.deepEqual(await keys(), ["now money.ledger.mismatch"]);
  assert.equal(((await moneyOverview()).reconciliation as { mismatches: number }).mismatches, 1);
  await sql`UPDATE money_usage SET amount = amount - 1 WHERE scope = 'global' AND key = '' AND currency = 'CNY' AND month = ${MONTH}`;
  await runMoneyReconciliation();
  assert.deepEqual(await keys(), []);
  await consistent();
});

test("releases, late outcomes, retries, sweeps and approvals at the same moment do not deadlock, and the ledger still adds up", async () => {
  await approvePrice(price(), owner);
  const errors: string[] = [];
  const note = (results: PromiseSettledResult<unknown>[]) => { for (const r of results) if (r.status === "rejected" && !conflict(r.reason)) errors.push(String(r.reason)); };
  const usage = { prompt_tokens: 10, completion_tokens: 5 };
  for (let round = 0; round < 12; round++) {
    // An unknown receipt: released by hand while its outcome arrives late and a retry, a sweep and a new limit come in.
    const a = await lost();
    note(await Promise.allSettled([
      releaseReceipt(a.claim.id, { billed: round % 2 === 0, note: "n" }, "admin:t"),
      round % 3 ? settlePaidAttempt(a.req, a.claim, { response: {}, usage }, 1) : failPaidAttempt(a.claim, new ProviderRejectedError("HTTP 502", 502, true), 1),
      claimPaidRequest(a.req),
      markStalePendingReceipts(),
      limitOf("capability", "score", 100 + round),
    ]));
    // A failed call still holding its money: released while its receipt is retried and the price is approved again.
    const req = chat();
    const b = called(await claimPaidRequest(req));
    await failPaidAttempt(b, new ProviderRejectedError("HTTP 500", 500, true), 1);
    note(await Promise.allSettled([
      releaseHeldAttempt(b.attemptId, { note: "n" }, "admin:t"),
      claimPaidRequest(req),
      approvePrice(price(), owner),
      autoReleaseUnknownReceipts(),
      runMoneyReconciliation(),
    ]));
  }
  assert.deepEqual(errors, []);
  await consistent();
  assert.equal((await runMoneyReconciliation()).mismatches, 0);
});

test("over the admin API: the session's role decides, a refusal is a 403, and the overview is readable by any admin", async () => {
  const { buildApp } = await import("../apps/api/src/app.ts");
  const app = await buildApp();
  try {
    const session = async (who: AdminPrincipal) => {
      const token = `${who.role}-${RUN}`;
      await sql`INSERT INTO admin_sessions (id_hash, user_id, csrf_token, expires_at) VALUES (${sha256(token)}, ${who.userId}, ${`csrf-${token}`}, now() + interval '1 hour')`;
      return { cookie: `${SESSION_COOKIE}=${token}`, "x-csrf-token": `csrf-${token}` };
    };
    const asOwner = await session(owner), asAdmin = await session(admin);
    const call = (method: "GET" | "PUT" | "POST", url: string, headers: Record<string, string>, payload?: unknown) => app.inject({ method, url, headers, payload: payload as never });
    assert.equal((await call("GET", "/api/admin/me", asOwner)).json().owner, true);
    assert.equal((await call("GET", "/api/admin/me", asAdmin)).json().owner, false);
    assert.equal((await call("GET", "/api/admin/money", {})).statusCode, 401);

    const limit = { scope: "capability", key: "structure", currency: "CNY", monthlyLimit: 7, reason: "经 API 批准" };
    const refusedCall = await call("PUT", "/api/admin/money/limits", asAdmin, limit);
    assert.deepEqual([refusedCall.statusCode, refusedCall.json().code], [403, "forbidden"]);
    assert.equal((await call("PUT", "/api/admin/money/limits", { cookie: asOwner.cookie }, limit)).statusCode, 403, "no CSRF token");
    assert.equal((await sql`SELECT 1 FROM money_budgets WHERE scope = 'capability' AND key = 'structure'`).length, 0);
    const approved = await call("PUT", "/api/admin/money/limits", asOwner, limit);
    assert.deepEqual([approved.statusCode, approved.json().approved_by, approved.json().monthly_limit], [200, `admin:${owner.userId}`, 7]);
    assert.equal((await call("PUT", "/api/admin/money/prices", asAdmin, price())).statusCode, 403);
    assert.equal((await call("PUT", "/api/admin/money/prices", asOwner, price({ currency: "EUR" }))).statusCode, 400);
    assert.equal((await call("POST", "/api/admin/money/prices/withdraw", asAdmin, { service: LLM, model: `nope-${RUN}`, reason: "r" })).statusCode, 404);
    assert.equal((await call("POST", "/api/admin/money/attempts/abc/release", asAdmin, { note: "n" })).statusCode, 400);
    assert.equal((await call("POST", "/api/admin/money/attempts/2000000000/release", asAdmin, { note: "n" })).statusCode, 404);

    const overview = await call("GET", "/api/admin/money", asAdmin);
    assert.equal(overview.statusCode, 200);
    const body = overview.json();
    assert.deepEqual([body.month, body.alertRatio, body.subjectKinds], [MONTH, 0.8, ["article", "report", "story"]]);
    assert.ok(body.capabilities.includes("collect.dajiala") && body.capabilities.includes("embedding") && body.capabilities.includes("score"));
    assert.ok(body.limits.some((l: { key: string; approved_by: string }) => l.key === "structure" && l.approved_by === `admin:${owner.userId}`));
    assert.equal((await call("POST", "/api/admin/money/reconcile", asAdmin, {})).json().mismatches, 0);
  } finally {
    await app.close();
  }
});
