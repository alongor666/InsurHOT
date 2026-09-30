// Monetary hard limits (ADR-015, providers/money.ts) on real PostgreSQL: prices, worst-case bounds,
// the three limit scopes, atomic reservation, settlement and the ledger. The functions are called
// directly; nothing here goes through paidRequest, whose paid lock stays closed, and nothing is sent.
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { after, beforeEach, test } from "node:test";
import { REPO_ROOT } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { MODELS } from "@aihot/backend/providers/llm";
import {
  approvedPrice, budgetMonth, capabilityFor, chatWorstCase, embeddingsWorstCase, modelCapabilities, MoneyRefusedError, MonthlyBudgetExhaustedError,
  perRequestWorstCase, perUnitWorstCase, reconcileMoneyLedger, reserveMoney, settleMoney, subjectKeysFor, type ApprovedPrice, type Reservation,
} from "@aihot/backend/providers/money";

const RUN = tag();
const SERVICE = `svc-${RUN}`;
let sequence = 0;

// Each case works in its own budget month, so the shared global ledger row never mixes cases.
const monthOf = (n: number) => new Date(Date.UTC(2031 + Math.floor(n / 12), n % 12, 15, 4));
let caseNo = 0;
let at = monthOf(0);
beforeEach(async () => {
  at = monthOf(caseNo++);
  await sql`DELETE FROM money_budgets`;
});
after(async () => {
  await sql`DELETE FROM receipts WHERE logical_key LIKE ${`money-${RUN}-%`}`;
  await sql`DELETE FROM money_usage WHERE month >= '2031-01-01'`;
  await sql`DELETE FROM money_budgets`;
  await sql`DELETE FROM service_prices WHERE service LIKE ${`${SERVICE}%`}`;
  await closeDb();
});

const refused = (reason: string) => (e: unknown) => e instanceof MoneyRefusedError && e.reason === reason;
const exhausted = (scope: string, key?: string) => (e: unknown) => e instanceof MonthlyBudgetExhaustedError && e.scope === scope && (key === undefined || e.key === key);
async function limit(scope: string, key: string, amount: number, opts: { currency?: string; approved?: boolean } = {}) {
  const approved = opts.approved ?? true;
  await sql`INSERT INTO money_budgets (scope, key, currency, monthly_limit, approved_by, approved_on)
            VALUES (${scope}, ${key}, ${opts.currency ?? "CNY"}, ${amount}, ${approved ? "owner" : null}, ${approved ? "2031-01-01" : null})`;
}
/** A pending attempt that started in the case's month. */
async function attempt(): Promise<number> {
  const [r] = await sql<{ id: number }[]>`
    INSERT INTO receipts (logical_key, service, purpose, status, attempts) VALUES (${`money-${RUN}-${sequence++}`}, ${SERVICE}, 'test', 'pending', 1) RETURNING id`;
  const [a] = await sql<{ id: number }[]>`
    INSERT INTO receipt_attempts (receipt_id, attempt, service, status, started_at) VALUES (${r!.id}, 1, ${SERVICE}, 'pending', ${at}) RETURNING id`;
  return a!.id;
}
interface Over { capability?: string; subject?: string | null; key?: string; currency?: "CNY" | "USD"; service?: string }
const res = (amount: number, over: Over = {}): Reservation => ({
  price: { service: over.service ?? SERVICE, key: over.key ?? "m1", currency: over.currency ?? "CNY" },
  capability: over.capability ?? "score", subject: over.subject === undefined ? "article:a1" : over.subject, amount,
});
const reserve = async (amount: number, over: Over = {}) => {
  const id = await attempt();
  await sql.begin((tx) => reserveMoney(tx, id, res(amount, over)));
  return id;
};
/** Settles and returns the result without its `figure`, which has a case of its own. */
const settle = async (id: number, s: Parameters<typeof settleMoney>[2]) => {
  const { figure: _figure, ...rest } = await sql.begin((tx) => settleMoney(tx, id, s));
  return rest;
};
async function used(scope: string, key: string, currency = "CNY"): Promise<number> {
  const [row] = await sql<{ amount: number }[]>`
    SELECT amount FROM money_usage WHERE scope = ${scope} AND key = ${key} AND currency = ${currency} AND month = ${budgetMonth(at)}`;
  return row?.amount ?? 0;
}
const standardLimits = async (global = 10, capability = 10, subject = 10) => {
  await limit("global", "", global); await limit("capability", "score", capability); await limit("subject", "article", subject);
};
const consistent = async () => assert.deepEqual(await reconcileMoneyLedger(), []);

// ---------------------------------------------------------------------------------------------------

test("the budget month is the calendar month in Asia/Shanghai", () => {
  assert.equal(budgetMonth(new Date("2031-01-31T15:59:59Z")), "2031-01-01");
  assert.equal(budgetMonth(new Date("2031-01-31T16:00:00Z")), "2031-02-01");
});

test("capabilities: collectors by service, embeddings by purpose, models by purpose; every purpose in the code maps", async () => {
  const purposes = await modelCapabilities();
  assert.equal(capabilityFor("zhipu", "score_article", purposes), "score");
  assert.equal(capabilityFor("deepseek", "group_story_review", purposes), "groupReview");
  assert.equal(capabilityFor("dashscope", "embedding", purposes), "embedding");
  assert.equal(capabilityFor("jina", "body_fallback", purposes), "collect.jina");
  assert.equal(capabilityFor("dajiala", "mp_history", purposes), "collect.dajiala");
  // SocialData sends "monitor.context" too: it is collection money, not the monitor model's.
  assert.equal(capabilityFor("socialdata", "monitor.context", purposes), "collect.socialdata");
  assert.equal(capabilityFor("zhipu", "monitor.context", purposes), "monitor");
  assert.throws(() => capabilityFor("zhipu", "something_new", purposes), refused("unmapped_purpose"));

  // Every purpose under packages/backend/src is a model purpose with a capability, or one only collectors use.
  const collectorOnly = new Set(["mp_history", "mp_article", "source_fetch", "source_listing", "source_detail", "body_fallback", "x_article", "monitor.scan", "monitor.lookback"]);
  const literals = new Set<string>();
  const templates = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!entry.name.endsWith(".ts")) continue;
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/purpose: (?:[^,\n]*?\? )?"([a-z_.]+)"(?: : "([a-z_.]+)")?/g)) { literals.add(m[1]!); if (m[2]) literals.add(m[2]); }
      for (const m of text.matchAll(/purpose: `([^`]+)`/g)) templates.add(m[1]!);
    }
  };
  walk(path.join(REPO_ROOT, "packages/backend/src"));
  assert.ok(literals.size >= 20, `found ${literals.size} purposes`);
  for (const purpose of literals) {
    if (collectorOnly.has(purpose)) assert.equal(purposes.has(purpose), false, `${purpose} is collector-only and must not be a model purpose`);
    else assert.ok(purpose === "embedding" || purposes.has(purpose), `purpose "${purpose}" has no capability`);
  }
  // Purposes built from a template are listed here with everything they can expand to.
  assert.deepEqual([...templates], ["report_${kind}"], "a new templated purpose needs its expansions checked here");
  for (const kind of ["daily", "weekly", "monthly"]) assert.equal(purposes.get(`report_${kind}`), "report");
});

test("subjects: revisions, fragments and the fact suffix fold into the subject; a story pair counts against both; other shapes refuse", () => {
  const cases: Array<[string, string, string[]]> = [
    ["score", "article:k3x9a0b1c2d3e4f5g6h7i8j9k@4", ["article:k3x9a0b1c2d3e4f5g6h7i8j9k"]],
    ["translate", "article:a1@4#2", ["article:a1"]],
    ["groupReview", "article:a1:fact:9", ["article:a1"]],
    ["group", "article:a1", ["article:a1"]],
    ["digest", "story:77@12", ["story:77"]],
    ["group", "story:8:3", ["story:3", "story:8"]],
    ["group", "story:5:5", ["story:5"]],
    ["report", "report:daily:2031-01-05", ["report:daily:2031-01-05"]],
    ["report", "report:weekly:2031-W05", ["report:weekly:2031-W05"]],
    ["translate", "quote:1900000000000000001", ["quote:1900000000000000001"]],
    ["monitor", "x:1900000000000000002", ["x:1900000000000000002"]],
    ["collect.jina", "source:abc", []],
    ["collect.dajiala", "bare-source-id", []],
    ["embedding", "article:first-of-batch", []],
  ];
  for (const [capability, subject, keys] of cases) assert.deepEqual(subjectKeysFor(capability, subject), keys, `${capability} ${subject}`);
  const bad = ["", null, undefined, "no-kind", "@4", ":x", "Article:a1", "article: a1", "article:a1:fact:2:fact:3", "article:a1:extra", "story:1:2:3", "story:x",
    "story:1:fact:2", "report:yearly:2031", "source:abc", "x:abc", "quote:"];
  for (const subject of bad) assert.throws(() => subjectKeysFor("score", subject), refused("missing_subject"), String(subject));
});

test("prices: only the exact, approved, unsuspended row for this host; no service-level fallback; endpoints have their own rows", async () => {
  const service = `${SERVICE}-p`;
  const row = (model: string, extra: Record<string, unknown> = {}) => sql`
    INSERT INTO service_prices ${sql({ service, model, currency: "CNY", input_per_mtok: 1, output_per_mtok: 2, base_host: "api.example.test", approved_by: "owner", approved_on: "2031-01-01", ...extra } as never)}`;
  await row("m-ok");
  await row("m-unapproved", { approved_by: null, approved_on: null });
  await row("m-suspended", { suspended_at: new Date(), suspended_reason: "test" });
  await row("m-nohost", { base_host: null });
  await row("", { per_request: 9 });
  await row("post_history", { input_per_mtok: null, output_per_mtok: null, per_request: 0.14 });
  await row("article_detail", { input_per_mtok: null, output_per_mtok: null, per_request: 0.03 });
  const url = "https://API.example.test/v1";

  const ok = await approvedPrice(sql, service, "m-ok", url);
  assert.deepEqual([ok.currency, ok.inputPerMtok, ok.outputPerMtok, ok.overheadTokens, ok.outputCapIncludesReasoning, ok.reasoningOff], ["CNY", 1, 2, 0, null, null]);
  await assert.rejects(approvedPrice(sql, service, "m-other", url), refused("missing_price"), "a model without its own row does not fall back to the service row");
  await assert.rejects(approvedPrice(sql, service, "", url), refused("missing_price"));
  await assert.rejects(approvedPrice(sql, service, "m-unapproved", url), refused("unapproved_price"));
  await assert.rejects(approvedPrice(sql, service, "m-suspended", url), refused("suspended_price"));
  await assert.rejects(approvedPrice(sql, service, "m-nohost", url), refused("price_host"));
  await assert.rejects(approvedPrice(sql, service, "m-ok", "https://reseller.example.test/v1"), refused("price_host"), "the same model at another host is another price");
  await assert.rejects(approvedPrice(sql, service, "m-ok", "not a url"), refused("missing_price"));
  assert.equal(perRequestWorstCase(await approvedPrice(sql, service, "post_history", url)), 0.14);
  assert.equal(perRequestWorstCase(await approvedPrice(sql, service, "article_detail", url)), 0.03);
  // The approval pair is all or nothing.
  await assert.rejects(sql`UPDATE service_prices SET approved_on = NULL WHERE service = ${service} AND model = 'm-ok'`, /service_prices_approval_pair/);
});

const price = (over: Partial<ApprovedPrice> = {}): ApprovedPrice => ({
  service: "s", key: "m", currency: "CNY", inputPerMtok: 1, outputPerMtok: 8, perRequest: null, perUnit: null, maxUnitsPerRequest: null,
  overheadTokens: 0, outputCapIncludesReasoning: null, reasoningOff: null, ...over,
});
/** The body providers/llm.ts builds: fixed keys, then the model's extra spread in last. */
const chatBody = (extra: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => ({
  model: "m", messages: [{ role: "system", content: "s" }, { role: "user", content: "保险 text" }], temperature: 0.2, max_tokens: 1500,
  response_format: { type: "json_object" }, ...extra, ...over,
});

test("chat bound: every byte of the final body as input plus overhead, max_tokens as output, rounded up to the micro", () => {
  const verified = price({ outputCapIncludesReasoning: true });
  const body = chatBody();
  const bytes = Buffer.byteLength(JSON.stringify(body), "utf8");
  assert.equal(chatWorstCase(verified, body), Math.ceil(bytes * 1 + 1500 * 8) / 1e6);
  assert.equal(chatWorstCase(price({ outputCapIncludesReasoning: true, overheadTokens: 1000 }), body), Math.ceil((bytes + 1000) * 1 + 1500 * 8) / 1e6);
  assert.ok(bytes > JSON.stringify(body).length, "multi-byte text counts by bytes, not characters");
  assert.throws(() => chatWorstCase(price({ outputCapIncludesReasoning: true, inputPerMtok: null }), body), refused("price_shape"));
  assert.throws(() => chatWorstCase(price({ outputCapIncludesReasoning: true, outputPerMtok: null }), body), refused("price_shape"));
  // The body is priced by the row of its own model.
  assert.throws(() => chatWorstCase(price({ outputCapIncludesReasoning: true, key: "cheap" }), chatBody({}, { model: "expensive" })), refused("price_model"));
});

test("chat bound: anything that could raise the cost unseen is refused", () => {
  const verified = price({ outputCapIncludesReasoning: true });
  const bad: Array<[string, Record<string, unknown>, string]> = [
    ["max_tokens in extra overrides the cap", { max_tokens: 32000 }, "extra_key"],
    ["max_completion_tokens", { max_completion_tokens: 32000 }, "extra_key"],
    ["n", { n: 4 }, "extra_key"],
    ["thinking_budget", { thinking_budget: 8000 }, "extra_key"],
    ["tools", { tools: [] }, "extra_key"],
    ["unknown nested thinking key", { thinking: { type: "enabled", budget_tokens: 9000 } }, "extra_key"],
    ["thinking not an object", { thinking: "enabled" }, "extra_key"],
    ["thinking as an array", { thinking: [{ type: "disabled" }] }, "extra_key"],
    ["reasoning_effort value", { reasoning_effort: "max" }, "extra_key"],
    ["enable_thinking value", { enable_thinking: "no" }, "extra_key"],
    ["top_p value", { top_p: "0.9" }, "extra_key"],
  ];
  for (const [label, extra, reason] of bad) assert.throws(() => chatWorstCase(verified, chatBody(extra), extra), refused(reason), label);
  // A key the body carries without the extra declaring it, and an extra the body does not carry as given.
  for (const key of ["n", "stream", "constructor", "toString", "hasOwnProperty"]) assert.throws(() => chatWorstCase(verified, chatBody({}, { [key]: 2 })), refused("extra_key"), key);
  assert.throws(() => chatWorstCase(verified, JSON.parse(`{"__proto__":{"n":4},${JSON.stringify(chatBody()).slice(1)}`)), refused("extra_key"), "an own __proto__ key");
  assert.throws(() => chatWorstCase(verified, chatBody(), { top_p: 0.9 }), refused("extra_key"));
  assert.throws(() => chatWorstCase(verified, chatBody({ top_p: 0.5 }), { top_p: 0.9 }), refused("extra_key"));
  // No output cap.
  for (const maxTokens of [undefined, 0, -1, 1.5, "1500"]) assert.throws(() => chatWorstCase(verified, chatBody({}, { max_tokens: maxTokens })), refused("output_cap"), String(maxTokens));
  // Anything but plain text messages.
  const withContent = (content: unknown, more: Record<string, unknown> = {}) => chatBody({}, { messages: [{ role: "user", content, ...more }] });
  const nonText: Array<[string, Record<string, unknown>]> = [
    ["an image part", withContent([{ type: "text", text: "look" }, { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }])],
    ["an image inside a text part", withContent([{ type: "text", text: "look", image_url: { url: "https://example.org/a.png" } }])],
    ["a part without a type", withContent([{ text: "plain" }])],
    ["audio", withContent([{ type: "input_audio", input_audio: { data: "AAAA", format: "wav" } }])],
    ["content as an object", withContent({ type: "image_url", image_url: { url: "https://example.org/a.png" } })],
    ["a message with another key", withContent("text", { tool_calls: [] })],
    ["messages not an array", chatBody({}, { messages: "hello" })],
  ];
  for (const [label, body] of nonText) assert.throws(() => chatWorstCase(verified, body), refused("image_input"), label);
  assert.equal(typeof chatWorstCase(verified, withContent([{ type: "text", text: "plain parts" }])), "number");
});

test("chat bound: reasoning counts as on unless the body switches it off the way this price row was verified", () => {
  const off = (how: string | null) => price({ reasoningOff: how });
  // No key at all: a model that reasons by default needs a row verified to count reasoning within max_tokens.
  assert.throws(() => chatWorstCase(price(), chatBody()), refused("reasoning"));
  assert.throws(() => chatWorstCase(price({ outputCapIncludesReasoning: false }), chatBody()), refused("reasoning"));
  assert.equal(typeof chatWorstCase(price({ outputCapIncludesReasoning: true }), chatBody()), "number");
  // A disable key counts only when it is this model's verified one.
  const thinkingOff = { thinking: { type: "disabled" } }, qwenOff = { enable_thinking: false };
  assert.equal(typeof chatWorstCase(off("thinking.type=disabled"), chatBody(thinkingOff), thinkingOff), "number");
  assert.equal(typeof chatWorstCase(off("enable_thinking=false"), chatBody(qwenOff), qwenOff), "number");
  assert.throws(() => chatWorstCase(off("thinking.type=disabled"), chatBody(qwenOff), qwenOff), refused("reasoning"), "a key this provider ignores");
  assert.throws(() => chatWorstCase(off("enable_thinking=false"), chatBody(thinkingOff), thinkingOff), refused("reasoning"));
  assert.throws(() => chatWorstCase(off(null), chatBody(thinkingOff), thinkingOff), refused("reasoning"), "an always-reasoning model cannot be switched off");
  // Switched on explicitly.
  for (const on of [{ thinking: { type: "enabled" } }, { enable_thinking: true }, { reasoning_effort: "low" }]) {
    assert.throws(() => chatWorstCase(off("thinking.type=disabled"), chatBody(on), on), refused("reasoning"), JSON.stringify(on));
  }
  // Contradicting switches: a provider may honour whichever it knows, so none of these is "off".
  const contradictions: Array<[string, Record<string, unknown>]> = [
    ["thinking.type=disabled", { thinking: { type: "disabled" }, reasoning_effort: "high" }],
    ["thinking.type=disabled", { thinking: { type: "disabled" }, enable_thinking: true }],
    ["enable_thinking=false", { thinking: { type: "enabled" }, enable_thinking: false }],
    ["enable_thinking=false", { enable_thinking: false, reasoning_effort: "low" }],
    ["thinking.type=disabled", { thinking: { type: "disabled" }, enable_thinking: false }],
    ["enable_thinking=false", { thinking: { type: "disabled" }, enable_thinking: false }],
  ];
  for (const [how, extra] of contradictions) assert.throws(() => chatWorstCase(off(how), chatBody(extra), extra), refused("reasoning"), JSON.stringify(extra));
  // The same bodies are bounded once the row is verified to count reasoning within max_tokens.
  for (const [, extra] of contradictions) assert.equal(typeof chatWorstCase(price({ outputCapIncludesReasoning: true }), chatBody(extra), extra), "number");
});

test("chat bound: every model preset in providers/llm.ts passes the extra check and is decided by its price row", () => {
  const expectOff: Record<string, string | null> = {
    "glm-5.3-flash": null, "glm-5.3-flash-selection": null, "deepseek-flash": "thinking.type=disabled", "deepseek-flash-think": null,
    "qwen3.7-flash": "enable_thinking=false", "qwen3.8-flash": "enable_thinking=false", "mimo-v2.6-flash": "thinking.type=disabled", "qwen3-vl-flash": "enable_thinking=false",
  };
  const presets = Object.keys(MODELS).filter((k) => k !== "default");
  assert.deepEqual(presets.sort(), Object.keys(expectOff).sort(), "a new preset needs its row here");
  for (const key of presets) {
    const extra = (MODELS[key]!.extra ?? {}) as Record<string, unknown>;
    const body = chatBody(extra);
    // With reasoning verified to count within max_tokens every preset is bounded.
    assert.equal(typeof chatWorstCase(price({ outputCapIncludesReasoning: true }), body, extra), "number", key);
    // Without that, only a preset whose own off switch matches the row's verified one.
    const how = expectOff[key]!;
    if (how) assert.equal(typeof chatWorstCase(price({ reasoningOff: how }), body, extra), "number", key);
    else assert.throws(() => chatWorstCase(price({ reasoningOff: "thinking.type=disabled" }), body, extra), refused("reasoning"), key);
  }
});

test("embeddings, per-request and per-unit bounds", () => {
  const body = { model: "m", input: ["保险", "text"], encoding_format: "float" };
  assert.equal(embeddingsWorstCase(price({ inputPerMtok: 0.5, overheadTokens: 10 }), body), Math.ceil((Buffer.byteLength(JSON.stringify(body)) + 10) * 0.5) / 1e6);
  assert.equal(typeof embeddingsWorstCase(price(), { model: "m", input: "one text", dimensions: 1024 }), "number");
  assert.throws(() => embeddingsWorstCase(price({ inputPerMtok: null }), body), refused("price_shape"));
  assert.throws(() => embeddingsWorstCase(price({ key: "cheap" }), body), refused("price_model"));
  assert.throws(() => embeddingsWorstCase(price(), { ...body, input: [{ image: "data:image/png;base64,AAAA" }] }), refused("image_input"));
  assert.throws(() => embeddingsWorstCase(price(), { ...body, input: { text: "x" } }), refused("image_input"));
  assert.throws(() => embeddingsWorstCase(price(), { ...body, user: "u" }), refused("extra_key"));
  assert.equal(perRequestWorstCase(price({ perRequest: 0.14 })), 0.14);
  assert.throws(() => perRequestWorstCase(price()), refused("price_shape"));
  assert.equal(perUnitWorstCase(price({ perUnit: 0.0002, maxUnitsPerRequest: 20 })), 0.004);
  // Jina and SocialData today: a unit price without a cap the provider enforces.
  assert.throws(() => perUnitWorstCase(price({ perUnit: 0.0002 })), refused("unbounded_units"));
  assert.throws(() => perUnitWorstCase(price({ maxUnitsPerRequest: 20 })), refused("unbounded_units"));
});

test("with no limit rows everything is refused; each missing or unapproved row refuses by name", async () => {
  await assert.rejects(reserve(0.01), refused("missing_limit"));
  await limit("global", "", 10);
  await assert.rejects(reserve(0.01), /capability:score/);
  await limit("capability", "score", 10);
  await assert.rejects(reserve(0.01), /subject:article/);
  await limit("subject", "article", 10, { approved: false });
  await assert.rejects(reserve(0.01), refused("unapproved_limit"));
  await sql`UPDATE money_budgets SET approved_by = 'owner', approved_on = '2031-01-01' WHERE scope = 'subject'`;
  await reserve(0.01);
  // Another currency has its own rows; none here.
  await assert.rejects(reserve(0.01, { currency: "USD" }), refused("missing_limit"));
  // A model step without a subject, or with one of another shape, is refused before any row is read.
  for (const subject of [null, "", "source:abc"]) await assert.rejects(reserve(0.01, { subject }), refused("missing_subject"), String(subject));
  // Amounts that are not a worst case.
  for (const amount of [-0.5, -1e-7, Number.NaN, Infinity]) await assert.rejects(reserve(amount), refused("price_shape"), String(amount));
  // A zero limit stops; the refused attempts hold nothing.
  await sql`UPDATE money_budgets SET monthly_limit = 0 WHERE scope = 'capability'`;
  await assert.rejects(reserve(0.000001), exhausted("capability"));
  assert.equal(await used("global", ""), 0.01);
  await consistent();
});

test("a reservation counts against the global, capability and each subject row; exactly the limit passes, a micro more does not", async () => {
  await standardLimits(1, 0.5, 0.3);
  await limit("subject", "story", 0.3);
  const id = await reserve(0.3, { subject: "article:a1@7#2" });
  assert.deepEqual([await used("global", ""), await used("capability", "score"), await used("subject", "article:a1")], [0.3, 0.3, 0.3]);
  const [row] = await sql<Record<string, unknown>[]>`
    SELECT capability, price_service, price_key, subject_keys, to_char(budget_month, 'YYYY-MM-DD') AS month, reserved_amount, reserved_currency, settled_amount, holds_reservation
    FROM receipt_attempts WHERE id = ${id}`;
  assert.deepEqual({ ...row }, { capability: "score", price_service: SERVICE, price_key: "m1", subject_keys: ["article:a1"], month: budgetMonth(at), reserved_amount: 0.3,
    reserved_currency: "CNY", settled_amount: null, holds_reservation: true });
  // The subject is full; another subject of the same kind has its own room, up to the capability row.
  await assert.rejects(reserve(0.000001), (e) => exhausted("subject", "article:a1")(e) && /budget/i.test((e as Error).message));
  await reserve(0.2, { subject: "article:a2" });
  await assert.rejects(reserve(0.000001, { subject: "article:a3" }), exhausted("capability"));
  // A story pair needs room in both stories, and counts once against each.
  await limit("capability", "group", 10);
  await reserve(0.3, { capability: "group", subject: "story:3" });
  await assert.rejects(reserve(0.1, { capability: "group", subject: "story:3:8" }), exhausted("subject", "story:3"));
  await reserve(0.2, { capability: "group", subject: "story:9:8" });
  assert.deepEqual([await used("subject", "story:8"), await used("subject", "story:9"), await used("global", "")], [0.2, 0.2, 1]);
  await assert.rejects(reserve(0.000001, { capability: "group", subject: "story:9" }), exhausted("global"));
  // An attempt is reserved once.
  await assert.rejects(sql.begin((tx) => reserveMoney(tx, id, res(0))), /already has a reservation/);
  await consistent();
});

test("collectors and embeddings have no subject row to satisfy", async () => {
  await limit("global", "", 1); await limit("capability", "collect.dajiala", 1); await limit("capability", "embedding", 1);
  const a = await reserve(0.14, { capability: "collect.dajiala", subject: "bare-source-id", key: "post_history" });
  await reserve(0.01, { capability: "embedding", subject: "article:first-of-batch", key: "e" });
  assert.equal(await used("global", ""), 0.15);
  const [row] = await sql<{ subject_keys: string[] }[]>`SELECT subject_keys FROM receipt_attempts WHERE id = ${a}`;
  assert.deepEqual(row!.subject_keys, []);
  await consistent();
});

test("simultaneous reservations never exceed a limit together", async () => {
  await standardLimits(1, 100, 100);
  const results = await Promise.allSettled(Array.from({ length: 24 }, (_, n) => reserve(0.1, { subject: `article:c${n}` })));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 10);
  for (const r of results) if (r.status === "rejected") assert.ok(exhausted("global")(r.reason), String(r.reason));
  assert.equal(await used("global", ""), 1);
  await consistent();
});

test("settling and reserving in one transaction, in either order, does not deadlock with other transactions", async () => {
  await standardLimits(1000, 1000, 1000);
  const held = await Promise.all(Array.from({ length: 12 }, () => reserve(0.5)));
  const fresh = await Promise.all(Array.from({ length: 12 }, () => attempt()));
  const work = held.flatMap((id, n) => [
    // A retry path: settle the old attempt, then reserve the new one. The settlement must change the
    // ledger (a figure below the reservation), or it takes no ledger row and proves nothing about lock order.
    sql.begin(async (tx) => { await settleMoney(tx, id, { kind: "actual", amount: 0.3, currency: "CNY" }); await reserveMoney(tx, fresh[n]!, res(0.5)); }),
    reserve(0.5),
    (async () => {
      const other = await reserve(0.5);
      const next = await attempt();
      await sql.begin(async (tx) => { await reserveMoney(tx, next, res(0.1)); await settleMoney(tx, other, { kind: "actual", amount: 0.2, currency: "CNY" }); });
    })(),
  ]);
  const results = await Promise.allSettled(work);
  assert.deepEqual(results.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason)), []);
  await consistent();
});

const none = { overrun: false, priceSuspended: false };
test("settlement: the actual cost replaces the reservation; without a usable figure the reservation stays", async () => {
  await standardLimits();
  const a = await reserve(0.5);
  assert.deepEqual(await settle(a, { kind: "actual", amount: 0.1234561, currency: "CNY" }), { counted: 0.123457, ...none });
  assert.equal(await used("global", ""), 0.123457);
  const b = await reserve(0.5);
  assert.deepEqual(await settle(b, { kind: "hold" }), { counted: 0.5, ...none });
  // A figure in another currency cannot be counted here.
  const c = await reserve(0.5);
  assert.deepEqual(await settle(c, { kind: "actual", amount: 0.01, currency: "USD" }), { counted: 0.5, ...none });
  for (const bad of [Number.NaN, -1, Infinity]) assert.deepEqual(await settle(await reserve(0.5), { kind: "actual", amount: bad, currency: "CNY" }), { counted: 0.5, ...none });
  // A figure, then a finding that it cannot be trusted: back to the reservation.
  assert.deepEqual(await settle(a, { kind: "hold" }), { counted: 0.5, ...none });
  assert.equal(await used("global", ""), 0.5 * 6);
  assert.equal(await used("subject", "article:a1"), 0.5 * 6);
  await consistent();
});

test("the settlement result names the figure the ledger took, and none when it took none", async () => {
  await standardLimits();
  const figureOf = async (s: Parameters<typeof settleMoney>[2]) => {
    const id = await reserve(0.5);
    return (await sql.begin((tx) => settleMoney(tx, id, s))).figure;
  };
  assert.equal(await figureOf({ kind: "actual", amount: 0.2000001, currency: "CNY" }), 0.200001);
  assert.equal(await figureOf({ kind: "actual", amount: 0.2, currency: "USD" }), null);
  assert.equal(await figureOf({ kind: "actual", amount: -1, currency: "CNY" }), null);
  assert.equal(await figureOf({ kind: "hold" }), null);
  assert.equal(await figureOf({ kind: "release" }), null);
  await consistent();
});

test("settlement: only a request the provider clearly did not take gives its money back; status is never consulted", async () => {
  await standardLimits();
  const rejected = await reserve(0.4);
  assert.deepEqual(await settle(rejected, { kind: "release" }), { counted: 0, ...none });
  assert.equal(await used("global", ""), 0);
  // An unknown outcome released automatically: the attempt is marked failed, as admin/runs.ts does, and keeps its money.
  const unknown = await reserve(0.4);
  await sql`UPDATE receipt_attempts SET status = 'failed', error = '自动放行' WHERE id = ${unknown}`;
  await settle(unknown, { kind: "hold" });
  assert.equal(await used("global", ""), 0.4);
  // The repeat is a new attempt with its own reservation.
  await reserve(0.4);
  assert.equal(await used("global", ""), 0.8);
  // Checked by hand later: not billed, so it is given back; a second finding the other way counts again.
  await settle(unknown, { kind: "release" });
  assert.equal(await used("global", ""), 0.4);
  await settle(unknown, { kind: "release" });
  assert.equal(await used("global", ""), 0.4, "releasing twice gives back once");
  await settle(unknown, { kind: "actual", amount: 0.25, currency: "CNY" });
  assert.equal(await used("global", ""), 0.65);
  const [row] = await sql<{ holds_reservation: boolean; settled_amount: number; status: string }[]>`SELECT holds_reservation, settled_amount, status FROM receipt_attempts WHERE id = ${unknown}`;
  assert.deepEqual({ ...row }, { holds_reservation: true, settled_amount: 0.25, status: "failed" });
  // An attempt that never reserved has nothing to settle.
  assert.deepEqual(await settle(await attempt(), { kind: "hold" }), { counted: 0, ...none });
  await consistent();
});

test("an actual cost above the reservation is counted in full and suspends the price row it was reserved on", async () => {
  await standardLimits();
  // The price row belongs to another service name than the attempt's: the reservation remembers which row it used.
  const priced = `${SERVICE}-priced`;
  await sql`INSERT INTO service_prices ${sql({ service: priced, model: "m1", currency: "CNY", input_per_mtok: 1, output_per_mtok: 2, base_host: "api.example.test", approved_by: "owner", approved_on: "2031-01-01" } as never)}`;
  const row = await approvedPrice(sql, priced, "m1", "https://api.example.test");
  const onRow = async (amount: number) => {
    const id = await attempt();
    await sql.begin((tx) => reserveMoney(tx, id, { price: row, capability: "score", subject: "article:a1", amount }));
    return id;
  };
  assert.deepEqual(await settle(await onRow(0.1), { kind: "actual", amount: 0.35, currency: "CNY" }), { counted: 0.35, overrun: true, priceSuspended: true });
  assert.equal(await used("global", ""), 0.35);
  await assert.rejects(approvedPrice(sql, priced, "m1", "https://api.example.test"), refused("suspended_price"));
  const reason = async () => (await sql<{ suspended_reason: string }[]>`SELECT suspended_reason FROM service_prices WHERE service = ${priced} AND model = 'm1'`)[0]!.suspended_reason;
  assert.match(await reason(), /cost 0\.35 CNY, reserved 0\.1/);
  // Once a figure has proved the reservation too small, a later "no figure" finding does not fall back below it.
  const proved = await onRow(0.1);
  await settle(proved, { kind: "actual", amount: 0.3, currency: "CNY" });
  assert.deepEqual(await settle(proved, { kind: "hold" }), { counted: 0.3, overrun: false, priceSuspended: false });
  assert.equal(await used("global", ""), 0.65);
  await settle(proved, { kind: "release" });
  // A second overrun on the suspended row keeps the first reason.
  assert.deepEqual(await settle(await onRow(0.1), { kind: "actual", amount: 0.2, currency: "CNY" }), { counted: 0.2, overrun: true, priceSuspended: true });
  assert.match(await reason(), /cost 0\.35/);
  // A row that no longer exists is reported, not hidden.
  assert.deepEqual(await settle(await reserve(0.1, { key: "gone" }), { kind: "actual", amount: 0.2, currency: "CNY" }), { counted: 0.2, overrun: true, priceSuspended: false });
  await consistent();
});

test("the budget month is the one the attempt started in, also when it is settled later", async () => {
  await standardLimits();
  const made = at;
  const id = await reserve(0.5);
  at = new Date(made.getTime() + 40 * 86400_000);
  await settle(id, { kind: "actual", amount: 0.2, currency: "CNY" });
  assert.equal(await used("global", ""), 0, "nothing lands in the later month");
  at = made;
  assert.equal(await used("global", ""), 0.2);
  await consistent();
});

test("the ledger cannot go below zero, and the reconciliation reports a ledger that no longer matches the attempts", async () => {
  await standardLimits();
  await reserve(0.5);
  await consistent();
  await assert.rejects(sql`UPDATE money_usage SET amount = amount - 1 WHERE scope = 'global' AND month = ${budgetMonth(at)}`, /money_usage_amount_check/);
  await sql`UPDATE money_usage SET amount = amount + 0.1 WHERE scope = 'capability' AND key = 'score' AND month = ${budgetMonth(at)}`;
  assert.deepEqual(await reconcileMoneyLedger(), [{ scope: "capability", key: "score", currency: "CNY", month: budgetMonth(at), ledger: 0.6, attempts: 0.5 }]);
  await sql`UPDATE money_usage SET amount = amount - 0.1 WHERE scope = 'capability' AND key = 'score' AND month = ${budgetMonth(at)}`;
  await consistent();
});
