// How paid requests use the monetary limits (ADR-015 step 2), on real PostgreSQL. paidRequest itself
// stays behind the paid lock, so its three bookkeeping steps are exercised directly: the claim that
// reserves, and the two settlements. None of them sends anything; the providers' own pricing
// (chatMoney, embeddingsMoney, jinaMoney, dajialaMoney) is checked through them.
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { dajialaMoney, dajialaOutcome } from "@aihot/backend/providers/dajiala";
import { embeddingsMoney } from "@aihot/backend/providers/embeddings";
import { jinaMoney } from "@aihot/backend/providers/jina";
import { chatMoney, MODELS } from "@aihot/backend/providers/llm";
import { budgetMonth, chatWorstCase, MoneyRefusedError, MonthlyBudgetExhaustedError, reconcileMoneyLedger, tokenCost, type ApprovedPrice } from "@aihot/backend/providers/money";
import {
  BudgetExceededError, claimPaidRequest, failPaidAttempt, markStalePendingReceipts, ProviderRejectedError, rejectReceivedResponse, settlementForError, settlePaidAttempt,
  type CallOutcome, type MoneySpec, type PaidClaim, type ReceiptRequest,
} from "@aihot/backend/providers/receipts";

const RUN = tag();
const LLM = `w-${RUN}-llm`;
const HOST = `api-${RUN}.wiring.test`;
const URL_ = `https://${HOST}/v1`;
const MONTH = budgetMonth(new Date());
const COLLECTORS = ["dajiala", "jina"];
interface SavedBudget { service: string; per_minute: number; per_hour: number; per_day: number }
let savedBudgets: SavedBudget[] = [];

const priceRow = (service: string, model: string, cols: Record<string, unknown>) => sql`
  INSERT INTO service_prices ${sql({ service, model, currency: "CNY", base_host: HOST, approved_by: "owner", approved_on: "2031-01-01", ...cols } as never)}
  ON CONFLICT (service, model) DO UPDATE SET ${sql({ currency: "CNY", base_host: HOST, approved_by: "owner", approved_on: "2031-01-01", suspended_at: null, suspended_reason: null,
    input_per_mtok: null, output_per_mtok: null, per_request: null, per_unit: null, max_units_per_request: null, output_cap_includes_reasoning: null, reasoning_off: null, ...cols } as never)}`;
const limit = (scope: string, key: string, amount: number) => sql`
  INSERT INTO money_budgets (scope, key, currency, monthly_limit, approved_by, approved_on) VALUES (${scope}, ${key}, 'CNY', ${amount}, 'owner', '2031-01-01')
  ON CONFLICT (scope, key, currency) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit, approved_by = 'owner', approved_on = '2031-01-01'`;

before(async () => {
  // This file owns the limit rows and this month's ledger while it runs (test files run one at a time).
  await sql`DELETE FROM money_budgets`;
  await sql`UPDATE receipt_attempts SET holds_reservation = false WHERE holds_reservation AND budget_month = ${MONTH}`;
  await sql`DELETE FROM money_usage WHERE month = ${MONTH}`;
  await limit("global", "", 100000);
  for (const capability of ["score", "translate", "embedding", "collect.dajiala", "collect.jina"]) await limit("capability", capability, 100000);
  await limit("subject", "article", 100000);
  await sql`INSERT INTO budgets (service, per_minute, per_hour, per_day, note) VALUES (${LLM}, 100000, 100000, 100000, 'wiring test') ON CONFLICT (service) DO NOTHING`;
  // The collectors' own count budgets (migration 0022) are raised for the run and restored after.
  savedBudgets = [...(await sql<SavedBudget[]>`SELECT service, per_minute, per_hour, per_day FROM budgets WHERE service = ANY(${COLLECTORS})`)];
  assert.equal(savedBudgets.length, COLLECTORS.length);
  await sql`UPDATE budgets SET per_minute = 100000, per_hour = 100000, per_day = 100000 WHERE service = ANY(${COLLECTORS})`;
});
after(async () => {
  await sql`DELETE FROM receipts WHERE subject LIKE ${`%${RUN}%`}`;
  await sql`DELETE FROM money_usage WHERE month = ${MONTH}`;
  await sql`DELETE FROM money_budgets`;
  await sql`DELETE FROM service_prices WHERE base_host = ${HOST}`;
  await sql`DELETE FROM budgets WHERE service = ${LLM}`;
  for (const b of savedBudgets) await sql`UPDATE budgets SET per_minute = ${b.per_minute}, per_hour = ${b.per_hour}, per_day = ${b.per_day} WHERE service = ${b.service}`;
  await closeDb();
});

const refused = (reason: string) => (e: unknown) => e instanceof MoneyRefusedError && e.reason === reason;
let n = 0;
/** A chat request the way providers/llm.ts builds it, for a model of this run. */
function chat(over: { model?: string; extra?: Record<string, unknown>; purpose?: string; subject?: string; user?: unknown; baseUrl?: string; maxTokens?: number } = {}) {
  const model = over.model ?? `m-${RUN}`;
  const extra = over.extra ?? {};
  const body = { model, messages: [{ role: "system", content: "s" }, { role: "user", content: over.user ?? "保险 text" }], temperature: 0.2, max_tokens: over.maxTokens ?? 1000,
    response_format: { type: "json_object" }, ...extra };
  const req: ReceiptRequest = {
    service: LLM, model, purpose: over.purpose ?? "score_article", subject: over.subject ?? `article:${RUN}a${n}@1`, identity: { n: n++, run: RUN },
    money: chatMoney({ model, extra }, over.baseUrl ?? URL_, body),
  };
  return { req, body, extra };
}
const called = (claim: PaidClaim) => { assert.equal(claim.kind, "call"); return claim as Extract<PaidClaim, { kind: "call" }>; };
async function attemptRow(id: number) {
  const [row] = await sql<Record<string, unknown>[]>`
    SELECT status, capability, price_service, price_key, subject_keys, reserved_amount, reserved_currency, settled_amount, holds_reservation, cost, cost_basis
    FROM receipt_attempts WHERE id = ${id}`;
  return { ...row };
}
async function used(scope: string, key: string): Promise<number> {
  const [row] = await sql<{ amount: number }[]>`SELECT amount FROM money_usage WHERE scope = ${scope} AND key = ${key} AND currency = 'CNY' AND month = ${MONTH}`;
  return row?.amount ?? 0;
}
const consistent = async () => assert.deepEqual(await reconcileMoneyLedger(), []);
const left = async (req: ReceiptRequest) => (await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM receipts WHERE subject = ${req.subject ?? ""}`)[0]!.n;
const verifiedModel = () => priceRow(LLM, `m-${RUN}`, { input_per_mtok: 2, output_per_mtok: 8, output_cap_includes_reasoning: true });

// ---------------------------------------------------------------------------------------------------

test("a refused request leaves no receipt or attempt behind: no price, no limit, no count budget", async () => {
  const { req } = chat();
  await assert.rejects(claimPaidRequest(req), refused("missing_price"));
  await verifiedModel();
  await assert.rejects(claimPaidRequest({ ...req, money: { ...req.money, baseUrl: "https://reseller.wiring.test/v1" } }), refused("price_host"));
  await sql`UPDATE money_budgets SET approved_by = NULL, approved_on = NULL WHERE scope = 'capability' AND key = 'score'`;
  await assert.rejects(claimPaidRequest(req), refused("unapproved_limit"));
  await limit("capability", "score", 0);
  await assert.rejects(claimPaidRequest(req), (e) => e instanceof MonthlyBudgetExhaustedError && e.scope === "capability");
  await limit("capability", "score", 100000);
  await assert.rejects(claimPaidRequest({ ...req, purpose: "not_a_purpose" }), refused("unmapped_purpose"));
  await assert.rejects(claimPaidRequest({ ...req, subject: `source:${RUN}` }), refused("missing_subject"));
  const noCountBudget = { ...req, service: `${LLM}-none` };
  await priceRow(noCountBudget.service, `m-${RUN}`, { input_per_mtok: 2, output_per_mtok: 8, output_cap_includes_reasoning: true });
  await assert.rejects(claimPaidRequest(noCountBudget), (e) => e instanceof BudgetExceededError && /missing budget/.test(e.message));
  assert.equal(await left(req), 0);
  assert.equal(await used("subject", `article:${RUN}a0`), 0);
  await consistent();
});

test("a claimed request holds its worst case on its own price row; while it is in flight the same request reserves nothing more", async () => {
  await verifiedModel();
  const { req, body, extra } = chat();
  const claim = called(await claimPaidRequest(req));
  const bound = chatWorstCase(claim.price, body, extra);
  assert.ok(bound > 0.008 && bound < 0.01, String(bound));
  const subject = req.subject!.split("@")[0]!;
  assert.deepEqual(await attemptRow(claim.attemptId), { status: "pending", capability: "score", price_service: LLM, price_key: `m-${RUN}`, subject_keys: [subject],
    reserved_amount: bound, reserved_currency: "CNY", settled_amount: null, holds_reservation: true, cost: null, cost_basis: null });
  assert.equal(await used("subject", subject), bound);
  assert.equal((await claimPaidRequest(req)).kind, "busy");
  assert.equal(await used("subject", subject), bound);
  await consistent();
});

test("an answer settles at what its usage shows; without usage the reservation stays; a stored answer is reused for free", async () => {
  await verifiedModel();
  const a = chat();
  const claim = called(await claimPaidRequest(a.req));
  const subject = a.req.subject!.split("@")[0]!;
  // 300 prompt tokens at 2, 50 completion tokens at 8 per million; total_tokens reports 30 more (reasoning), paid as output.
  const outcome: CallOutcome = { response: { ok: true }, requestId: "r1", usage: { prompt_tokens: 300, completion_tokens: 50, total_tokens: 380 } };
  assert.deepEqual(await settlePaidAttempt(a.req, claim, outcome, 12), { overrun: false, priceSuspended: false });
  const cost = (300 * 2 + 80 * 8) / 1e6;
  const row = await attemptRow(claim.attemptId);
  assert.deepEqual([row.status, row.settled_amount, row.holds_reservation, row.cost, row.cost_basis], ["received", cost, true, cost, "estimated"]);
  assert.equal(await used("subject", subject), cost);
  const again = await claimPaidRequest(a.req);
  assert.equal(again.kind, "reuse");
  assert.equal(await used("subject", subject), cost);
  // The answer turns out to be unusable: it was billed all the same.
  await rejectReceivedResponse(claim.id, "unusable output");
  assert.equal(await used("subject", subject), cost);

  const b = chat();
  const held = called(await claimPaidRequest(b.req));
  await settlePaidAttempt(b.req, held, { response: {}, usage: null }, 5);
  const heldRow = await attemptRow(held.attemptId);
  assert.deepEqual([heldRow.status, heldRow.settled_amount, heldRow.holds_reservation, heldRow.cost], ["received", null, true, null]);
  assert.equal(await used("subject", b.req.subject!.split("@")[0]!), heldRow.reserved_amount);
  await consistent();
});

test("a failed call gives its money back only when the provider clearly did not take it", async () => {
  await verifiedModel();
  const outcomes: Array<[string, unknown, string, boolean]> = [
    ["never sent", new ProviderRejectedError("connect failed", null, true, { notBilled: true }), "failed", false],
    ["401", new ProviderRejectedError("HTTP 401", 401, false), "failed", false],
    ["402", new ProviderRejectedError("HTTP 402", 402, false), "failed", false],
    ["403", new ProviderRejectedError("HTTP 403", 403, false), "failed", false],
    ["429", new ProviderRejectedError("HTTP 429", 429, true), "failed", false],
    ["400 may follow an answer the provider then filtered", new ProviderRejectedError("HTTP 400", 400, false), "failed", true],
    ["422", new ProviderRejectedError("HTTP 422", 422, false), "failed", true],
    ["500", new ProviderRejectedError("HTTP 500", 500, true), "failed", true],
    ["502 from a gateway after the upstream answered", new ProviderRejectedError("HTTP 502", 502, true), "failed", true],
    ["a timeout", new Error("The operation was aborted due to timeout"), "unknown", true],
  ];
  for (const [label, error, status, holds] of outcomes) {
    const { req } = chat();
    const claim = called(await claimPaidRequest(req));
    await failPaidAttempt(claim, error, 7);
    const row = await attemptRow(claim.attemptId);
    assert.deepEqual([row.status, row.holds_reservation], [status, holds], label);
    assert.equal(await used("subject", req.subject!.split("@")[0]!), holds ? row.reserved_amount : 0, label);
  }
  // A provider's own code is not an HTTP status: 401 as a code does not release.
  assert.deepEqual(settlementForError(new ProviderRejectedError("code 401", 401, false, { providerCode: 401 })), { kind: "hold" });
  assert.deepEqual(settlementForError(new ProviderRejectedError("charged refusal", 500, true, { cost: { amount: 0.02, currency: "CNY" } })), { kind: "actual", amount: 0.02, currency: "CNY" });
  await consistent();
});

test("a retry after a failure is a new attempt with its own reservation; an unknown outcome is not retried", async () => {
  await verifiedModel();
  const { req } = chat();
  const subject = req.subject!.split("@")[0]!;
  const first = called(await claimPaidRequest(req));
  await failPaidAttempt(first, new ProviderRejectedError("HTTP 500", 500, true), 3);
  const second = called(await claimPaidRequest(req));
  assert.equal(second.id, first.id);
  assert.notEqual(second.attemptId, first.attemptId);
  const bound = (await attemptRow(second.attemptId)).reserved_amount as number;
  assert.equal(await used("subject", subject), bound * 2, "the 500 may have been billed, and the retry is reserved as well");
  await failPaidAttempt(second, new Error("socket hang up"), 3);
  assert.equal((await claimPaidRequest(req)).kind, "unknown");
  assert.equal(await used("subject", subject), bound * 2);
  const [receipt] = await sql<{ attempts: number; status: string }[]>`SELECT attempts, status FROM receipts WHERE id = ${first.id}`;
  assert.deepEqual({ ...receipt }, { attempts: 2, status: "unknown" });
  await consistent();
});

test("chat pricing: decided by the model's own row; reasoning, images and an unverified row refuse before anything is recorded", async () => {
  const preset = MODELS["deepseek-flash"]!;
  const extra = preset.extra as Record<string, unknown>;
  const off = `moff-${RUN}`, unverified = `mraw-${RUN}`;
  await priceRow(LLM, off, { input_per_mtok: 2, output_per_mtok: 8, reasoning_off: "thinking.type=disabled" });
  await priceRow(LLM, unverified, { input_per_mtok: 2, output_per_mtok: 8 });
  // The preset switches reasoning off the way the row was verified.
  assert.equal((await claimPaidRequest(chat({ model: off, extra }).req)).kind, "call");
  // A row verified for another switch, no switch at all, or a contradicting one.
  await assert.rejects(claimPaidRequest(chat({ model: off, extra: { enable_thinking: false } }).req), refused("reasoning"));
  await assert.rejects(claimPaidRequest(chat({ model: off }).req), refused("reasoning"));
  await assert.rejects(claimPaidRequest(chat({ model: off, extra: { ...extra, reasoning_effort: "high" } }).req), refused("reasoning"));
  await assert.rejects(claimPaidRequest(chat({ model: unverified, extra }).req), refused("reasoning"));
  // An extra that would lift the output cap, and an image.
  await assert.rejects(claimPaidRequest(chat({ model: off, extra: { ...extra, max_tokens: 32000 } }).req), refused("extra_key"));
  const image = chat({ model: off, extra, user: [{ type: "text", text: "look" }, { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }] });
  await assert.rejects(claimPaidRequest(image.req), refused("image_input"));
  assert.equal(await left(image.req), 0);
  await consistent();
});

test("embeddings are priced by their text body on the model's row and have no subject limit", async () => {
  const model = `e-${RUN}`;
  await priceRow(LLM, model, { input_per_mtok: 0.5 });
  const body = { model, input: ["保险", "text"], dimensions: 1024, encoding_format: "float" };
  const req: ReceiptRequest = { service: LLM, model, purpose: "embedding", subject: `article:${RUN}batch`, identity: { e: RUN }, money: embeddingsMoney(URL_, body) };
  const claim = called(await claimPaidRequest(req));
  const row = await attemptRow(claim.attemptId);
  assert.deepEqual([row.capability, row.subject_keys, row.reserved_amount], ["embedding", [], Math.ceil(Buffer.byteLength(JSON.stringify(body)) * 0.5) / 1e6]);
  await settlePaidAttempt(req, claim, { response: {}, usage: { prompt_tokens: 6, total_tokens: 6 } }, 4);
  assert.equal((await attemptRow(claim.attemptId)).settled_amount, 0.000003);
  await consistent();
});

test("Dajiala: a per-request row for each endpoint; the provider's own figure counts, also with a refusal; only the rate limit is not billed", async () => {
  await priceRow("dajiala", "post_history", { per_request: 0.14 });
  await priceRow("dajiala", "article_detail", { per_request: 0.03 });
  const request = (endpoint: "post_history" | "article_detail", purpose: string): ReceiptRequest =>
    ({ service: "dajiala", purpose, subject: `src-${RUN}`, identity: { d: n++, run: RUN }, money: dajialaMoney(endpoint, URL_) });
  const history = request("post_history", "mp_history");
  const claim = called(await claimPaidRequest(history));
  assert.deepEqual([(await attemptRow(claim.attemptId)).reserved_amount, (await attemptRow(claim.attemptId)).capability, (await attemptRow(claim.attemptId)).subject_keys], [0.14, "collect.dajiala", []]);
  await settlePaidAttempt(history, claim, { response: {}, cost: dajialaOutcome({ code: 0, cost_money: 0.14 }, "post_history") }, 9);
  const settled = await attemptRow(claim.attemptId);
  assert.deepEqual([settled.settled_amount, settled.cost_basis], [0.14, "actual"]);
  assert.equal((await attemptRow(called(await claimPaidRequest(request("article_detail", "mp_article"))).attemptId)).reserved_amount, 0.03);

  const rejection = (json: { code: number; cost_money?: number }) => { try { dajialaOutcome(json, "x"); } catch (e) { return e as ProviderRejectedError; } throw new Error("not rejected"); };
  const limited = rejection({ code: -1 });
  assert.deepEqual([limited.httpStatus, limited.providerCode, limited.retryable], [null, -1, true]);
  assert.deepEqual(settlementForError(limited), { kind: "release" });
  assert.deepEqual(settlementForError(rejection({ code: -1, cost_money: 0.14 })), { kind: "actual", amount: 0.14, currency: "CNY" });
  assert.deepEqual(settlementForError(rejection({ code: 20001 })), { kind: "hold" }, "an unexplained code may have been billed");
  assert.deepEqual(settlementForError(rejection({ code: 101, cost_money: 0.03 })), { kind: "actual", amount: 0.03, currency: "CNY" });
  assert.equal(dajialaOutcome({ code: 0 }, "x"), null);
  await consistent();
});

test("Jina: refused without a cap the provider enforces; with one, reserved at the cap and settled by what came back", async () => {
  const jina = (): ReceiptRequest => ({ service: "jina", model: null, purpose: "body_fallback", subject: `article:${RUN}j`, identity: { j: n++, run: RUN }, money: jinaMoney(URL_) });
  await priceRow("jina", "reader", { per_unit: 0.00000036 });
  await assert.rejects(claimPaidRequest(jina()), refused("unbounded_units"));

  await priceRow("jina", "reader", { per_unit: 0.00000036, max_units_per_request: 200000 });
  const page = jina();
  const read = called(await claimPaidRequest(page));
  assert.equal((await attemptRow(read.attemptId)).reserved_amount, 0.072);
  await settlePaidAttempt(page, read, { response: {}, usage: { bytes: 5000, tokens: 1500 } }, 3);
  assert.equal((await attemptRow(read.attemptId)).settled_amount, 0.00054);
  // No usage header: nothing is guessed.
  const silent = jina();
  const quiet = called(await claimPaidRequest(silent));
  await settlePaidAttempt(silent, quiet, { response: {}, usage: { bytes: 5000, tokens: null } }, 3);
  assert.deepEqual([(await attemptRow(quiet.attemptId)).settled_amount, (await attemptRow(quiet.attemptId)).holds_reservation], [null, true]);

  // More tokens than the cap said one request could return: counted in full, and the row is suspended.
  const long = jina();
  const found = called(await claimPaidRequest(long));
  assert.equal((await attemptRow(found.attemptId)).reserved_amount, 0.072);
  assert.deepEqual(await settlePaidAttempt(long, found, { response: {}, usage: { bytes: 2_000_000, tokens: 500000 } }, 3), { overrun: true, priceSuspended: true });
  assert.equal((await attemptRow(found.attemptId)).settled_amount, 0.18);
  await assert.rejects(claimPaidRequest(jina()), refused("suspended_price"));
  await consistent();
});

const receiptOf = async (id: number) => ({ ...(await sql<Record<string, unknown>[]>`SELECT status, attempts, cost, cost_basis FROM receipts WHERE id = ${id}`)[0] });
const makeStale = (id: number) => sql`UPDATE receipts SET updated_at = now() - interval '11 minutes' WHERE id = ${id}`;

test("the cost written is the figure the ledger took; a usage that contradicts itself is no figure", async () => {
  await verifiedModel();
  await priceRow("dajiala", "post_history", { per_request: 0.14 });
  // A provider figure in another currency is not counted, and is not written as the cost either.
  const mp: ReceiptRequest = { service: "dajiala", purpose: "mp_history", subject: `src-${RUN}`, identity: { f: n++, run: RUN }, money: dajialaMoney("post_history", URL_) };
  const claim = called(await claimPaidRequest(mp));
  await settlePaidAttempt(mp, claim, { response: {}, cost: { amount: 0.02, currency: "USD", basis: "actual" } }, 2);
  const row = await attemptRow(claim.attemptId);
  assert.deepEqual([row.settled_amount, row.cost, row.cost_basis, row.holds_reservation], [null, null, null, true]);
  assert.deepEqual([(await receiptOf(claim.id)).cost, (await receiptOf(claim.id)).status], [null, "received"]);
  // A refusal that reports what it charged is counted and written on the attempt.
  const charged = { ...mp, identity: { f: n++, run: RUN } };
  const refusedClaim = called(await claimPaidRequest(charged));
  await failPaidAttempt(refusedClaim, new ProviderRejectedError("code 101", 101, false, { providerCode: 101, cost: { amount: 0.03, currency: "CNY" } }), 2);
  const failed = await attemptRow(refusedClaim.attemptId);
  assert.deepEqual([failed.status, failed.settled_amount, failed.cost, failed.cost_basis, failed.holds_reservation], ["failed", 0.03, 0.03, "actual", true]);
  // Usage that says less came back in total than went in, or nothing about the output: the reservation stays.
  const price = { inputPerMtok: 2, outputPerMtok: 8 } as ApprovedPrice;
  assert.equal(tokenCost(price, { prompt_tokens: 100, total_tokens: 50 }), null);
  assert.equal(tokenCost(price, { prompt_tokens: 100 }), null);
  assert.equal(tokenCost(price, { completion_tokens: 10 }), null);
  assert.equal(tokenCost(price, { prompt_tokens: 100, completion_tokens: 0, total_tokens: 140 }), (100 * 2 + 40 * 8) / 1e6);
  assert.equal(tokenCost(price, { prompt_tokens: 100, completion_tokens: 10 }), (100 * 2 + 10 * 8) / 1e6);
  await consistent();
});

test("an outcome that arrives late cannot reopen a receipt: only the attempt records it once the receipt has moved on", async () => {
  await verifiedModel();
  // The placeholder goes stale and unknown; its failure arrives afterwards.
  const a = chat();
  const first = called(await claimPaidRequest(a.req));
  await makeStale(first.id);
  assert.equal(await markStalePendingReceipts() >= 1, true);
  assert.equal((await receiptOf(first.id)).status, "unknown");
  assert.equal((await attemptRow(first.attemptId)).holds_reservation, true, "unknown keeps its money");
  await failPaidAttempt(first, new ProviderRejectedError("HTTP 500", 500, true), 1);
  assert.equal((await receiptOf(first.id)).status, "unknown", "a late 500 does not turn unknown into a free retry");
  assert.equal((await claimPaidRequest(a.req)).kind, "unknown");
  // The answer itself arriving late is taken: it was paid for.
  await settlePaidAttempt(a.req, first, { response: { late: true }, usage: { prompt_tokens: 10, completion_tokens: 5 } }, 1);
  assert.deepEqual([(await receiptOf(first.id)).status, (await attemptRow(first.attemptId)).status], ["received", "received"]);
  assert.equal((await claimPaidRequest(a.req)).kind, "reuse");

  // Released by hand while the old call was still out; a newer attempt is under way when the old one fails.
  const b = chat();
  const old = called(await claimPaidRequest(b.req));
  await sql`UPDATE receipts SET status = 'failed', updated_at = now() WHERE id = ${old.id}`;
  const newer = called(await claimPaidRequest(b.req));
  assert.deepEqual([newer.id, newer.attempt], [old.id, 2]);
  await failPaidAttempt(old, new ProviderRejectedError("HTTP 500", 500, true), 1);
  assert.deepEqual([(await receiptOf(old.id)).status, (await attemptRow(old.attemptId)).status], ["pending", "failed"]);
  assert.equal((await claimPaidRequest(b.req)).kind, "busy", "one request is never in flight twice");
  await settlePaidAttempt(b.req, old, { response: { old: true }, usage: { prompt_tokens: 10, completion_tokens: 5 } }, 1);
  assert.equal((await receiptOf(old.id)).status, "pending", "the newer attempt still owns the receipt");
  await settlePaidAttempt(b.req, newer, { response: { newer: true }, usage: { prompt_tokens: 10, completion_tokens: 5 } }, 1);
  assert.equal((await receiptOf(old.id)).status, "received");
  await consistent();
});

test("late settlements do not deadlock with the stale sweep or with a retry of the same receipt", async () => {
  await verifiedModel();
  const errors: string[] = [];
  const note = (results: PromiseSettledResult<unknown>[]) => { for (const r of results) if (r.status === "rejected") errors.push(String(r.reason)); };
  for (let round = 0; round < 12; round++) {
    // A stale placeholder: its answer and the sweep that marks it unknown at the same moment.
    const stale = chat();
    const claim = called(await claimPaidRequest(stale.req));
    await makeStale(claim.id);
    note(await Promise.allSettled([
      settlePaidAttempt(stale.req, claim, { response: {}, usage: { prompt_tokens: 10, completion_tokens: 5 } }, 1),
      markStalePendingReceipts(),
    ]));
    // A receipt released while its call was out: the late outcome and the retry's claim at the same moment.
    const released = chat();
    const out = called(await claimPaidRequest(released.req));
    await sql`UPDATE receipts SET status = 'failed', updated_at = now() WHERE id = ${out.id}`;
    note(await Promise.allSettled([
      round % 2 ? settlePaidAttempt(released.req, out, { response: {}, usage: { prompt_tokens: 10, completion_tokens: 5 } }, 1)
        : failPaidAttempt(out, new ProviderRejectedError("HTTP 502", 502, true), 1),
      claimPaidRequest(released.req),
    ]));
  }
  assert.deepEqual(errors, []);
  await consistent();
});

test("simultaneous requests under one capability limit pass exactly as many as fit; claims, answers and failures at once do not deadlock", async () => {
  const model = `mt-${RUN}`;
  await priceRow(LLM, model, { input_per_mtok: 2, output_per_mtok: 8, output_cap_includes_reasoning: true });
  await priceRow("dajiala", "post_history", { per_request: 0.14 });
  const probe = chat({ model, purpose: "translate_body" });
  const bound = chatWorstCase({ service: LLM, key: model, currency: "CNY", inputPerMtok: 2, outputPerMtok: 8, overheadTokens: 0, outputCapIncludesReasoning: true } as ApprovedPrice, probe.body, probe.extra);
  await limit("capability", "translate", bound * 5);
  const translations = Array.from({ length: 16 }, (_, k) => chat({ model, purpose: "translate_body", subject: `article:${RUN}t${k}@1#0` }).req);
  const results = await Promise.allSettled(translations.map((req) => claimPaidRequest(req)));
  const claims = results.flatMap((r) => (r.status === "fulfilled" ? [called(r.value)] : []));
  assert.equal(claims.length, 5);
  for (const r of results) if (r.status === "rejected") assert.ok(r.reason instanceof MonthlyBudgetExhaustedError && r.reason.scope === "capability", String(r.reason));
  assert.equal(await used("capability", "translate"), Math.round(bound * 5 * 1e6) / 1e6);

  // Now everything at once: answers and failures of the in-flight ones, new claims on two services.
  await limit("capability", "translate", 100000);
  const more = Array.from({ length: 10 }, (_, k) => chat({ model, purpose: "translate_body", subject: `article:${RUN}u${k}@1#0` }).req);
  const mp = (k: number): ReceiptRequest => ({ service: "dajiala", purpose: "mp_history", subject: `src-${RUN}`, identity: { c: k, run: RUN }, money: dajialaMoney("post_history", URL_) });
  const work: Promise<unknown>[] = [
    ...claims.map((claim, k) => (k % 2
      ? settlePaidAttempt(translations[0]!, claim, { response: {}, usage: { prompt_tokens: 100, completion_tokens: 10 } }, 1)
      : failPaidAttempt(claim, new ProviderRejectedError("HTTP 401", 401, false), 1))),
    ...more.map((req) => claimPaidRequest(req)),
    ...Array.from({ length: 10 }, (_, k) => claimPaidRequest(mp(k))),
  ];
  const mixed = await Promise.allSettled(work);
  assert.deepEqual(mixed.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason)), []);
  await consistent();
});

test("simultaneous requests of two services share the global limit and never exceed it together", async () => {
  const model = `mg-${RUN}`;
  await priceRow(LLM, model, { input_per_mtok: 2, output_per_mtok: 8, output_cap_includes_reasoning: true });
  await priceRow("dajiala", "post_history", { per_request: 0.14 });
  const before = await used("global", "");
  const room = 0.5;
  await limit("global", "", Math.round((before + room) * 1e6) / 1e6);
  try {
    const chats = Array.from({ length: 12 }, (_, k) => chat({ model, subject: `article:${RUN}g${k}@1` }).req);
    const mps = Array.from({ length: 8 }, (_, k): ReceiptRequest =>
      ({ service: "dajiala", purpose: "mp_history", subject: `src-${RUN}`, identity: { g: k, run: RUN }, money: dajialaMoney("post_history", URL_) }));
    const results = await Promise.allSettled([...chats, ...mps].map((req) => claimPaidRequest(req)));
    const taken = (await used("global", "")) - before;
    // Eight Dajiala requests alone would take 1.12: some were refused, all of them on the global row, and what passed fits.
    assert.ok(taken <= room + 1e-9, `took ${taken}`);
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    assert.ok(rejected.length >= 5, `rejected ${rejected.length}`);
    for (const r of rejected) assert.ok(r.reason instanceof MonthlyBudgetExhaustedError && r.reason.scope === "global", String(r.reason));
    // Nothing that was refused could still have fitted when it was refused: the smallest request no longer fits now.
    assert.ok(results.some((r) => r.status === "fulfilled"));
  } finally {
    await limit("global", "", 100000);
  }
  await consistent();
});
