// What happens when the monetary limits refuse a paid request (ADR-015 section 8), on real PostgreSQL:
// the work stops in a state an admin can see, is not delayed, retried or counted as a failure, and
// comes back only when an admin resumes it. The paid lock keeps a real refusal from being reached
// (paidRequest throws before it claims), so each path's handler is given the refusal directly; that
// the refusal reaches the handler is read from the code, not proved here.
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";
import { budgetBlockedOverview, resumeBudgetBlocked } from "@aihot/backend/admin/budget-blocked";
import { REPO_ROOT } from "@aihot/backend/config";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { closeDb, sql } from "@aihot/backend/db";
import { writesWithoutImage } from "@aihot/backend/editorial/analyze";
import { embedBatchWaiting } from "@aihot/backend/events/group";
import { blockForBudget, isBudgetBlocked } from "@aihot/backend/jobs/budget-blocked";
import { afterFailure, sweepUnprocessed } from "@aihot/backend/jobs/content";
import { digestJobFailed, groupJobFailed } from "@aihot/backend/jobs/events";
import { getBoss, QUEUES, stopBoss } from "@aihot/backend/jobs/queue";
import { sha256 } from "@aihot/backend/lib/ids";
import { collectFindings } from "@aihot/backend/operations/alerts";
import { MoneyRefusedError, MonthlyBudgetExhaustedError } from "@aihot/backend/providers/money";
import { BudgetExceededError, ProviderRejectedError, ReceiptBusyError } from "@aihot/backend/providers/receipts";
import { composeResumedReports, unlessBudgetBlocked } from "@aihot/backend/reports/compose";
import { scheduleMpReconcile } from "@aihot/backend/sources/mp";

const T = tag();
const SOURCE = `test-blocked-${T}`;
const usedUp = () => new MonthlyBudgetExhaustedError("capability", "score", "CNY", "2031-01-01");
const noPrice = () => new MoneyRefusedError("missing_price", "no price row for llm/x");
const REFUSALS: Array<[string, () => MoneyRefusedError]> = [["a used-up month", usedUp], ["a missing price", noPrice]];
/** Story ids this run blocks digests for (their refs do not carry the run's tag). */
const stories: string[] = [];
const storyId = (base: number) => { const id = base + Math.floor(Math.random() * 1e6); stories.push(String(id)); return id; };

async function article(name: string): Promise<string> {
  const { articleId } = await upsertMaterial({ sourceId: SOURCE, url: `https://example.com/${T}-${name}`, title: `blocked ${name}`, bodyStatus: "none", via: "fetch" } as never);
  // Old enough for the safety net to look at it.
  await sql`UPDATE articles SET created_at = now() - interval '10 minutes', processing_queued_at = NULL WHERE id = ${articleId}`;
  return articleId;
}
const stateOf = async (id: string) => (await sql<{ processing_state: string; processing_attempts: number; processing_retry_at: Date | null; processing_queued_at: Date | null; processing_error: string | null }[]>`
  SELECT processing_state, processing_attempts, processing_retry_at, processing_queued_at, processing_error FROM articles WHERE id = ${id}`)[0]!;
const blockRow = async (kind: string, ref: string) => (await sql<{ job: Record<string, unknown>; reason: string }[]>`SELECT job, reason FROM budget_blocked WHERE kind = ${kind} AND ref = ${ref}`)[0];
const jobs = async (queue: string, key: string) => (await sql<{ data: Record<string, unknown> }[]>`
  SELECT data FROM pgboss.job WHERE name = ${queue} AND singleton_key = ${key} AND state IN ('created', 'retry')`).map((j) => j.data);

before(async () => {
  await getBoss();
  await sql`INSERT INTO sources (id, name, kind, next_fetch_at) VALUES (${SOURCE}, 'Test budget-blocked', 'rss', '2100-01-01')`;
});
after(async () => {
  await sql`DELETE FROM pgboss.job WHERE singleton_key LIKE ${`%${T}%`} OR data::text LIKE ${`%${T}%`}`;
  await sql`DELETE FROM budget_blocked WHERE ref LIKE ${`%${T}%`} OR (kind = 'digest' AND ref = ANY(${stories}))`;
  await sql`DELETE FROM articles WHERE source_id = ${SOURCE}`;
  await sql`DELETE FROM sources WHERE id = ${SOURCE}`;
  await sql`DELETE FROM admin_users WHERE email = ${`blocked-${T}@test.invalid`}`;
  await stopBoss();
  await closeDb();
});

test("an article the limits refused stops as budget_blocked: no retry time, no attempt counted, and the safety net leaves it alone", async () => {
  for (const [name, refusal] of REFUSALS) {
    const id = await article(`refused-${name.replace(/\W/g, "")}`);
    await sql`UPDATE articles SET processing_attempts = 2 WHERE id = ${id}`;
    assert.deepEqual(await afterFailure(id, refusal()), { state: "budget_blocked" }, name);
    const s = await stateOf(id);
    assert.deepEqual([s.processing_state, s.processing_attempts, s.processing_retry_at, s.processing_queued_at], ["budget_blocked", 2, null, null], name);
    assert.match(s.processing_error!, /budget/i);
  }
  // In contrast, a full count window is waited for and the article stays "new".
  const waiting = await article("window");
  const result = await afterFailure(waiting, new BudgetExceededError("llm", "minute", 60));
  assert.equal(result.state, "waiting");
  assert.deepEqual([(await stateOf(waiting)).processing_state, (await stateOf(waiting)).processing_retry_at !== null], ["new", true]);

  const blocked = await article("swept");
  const fresh = await article("swept-new");
  await afterFailure(blocked, usedUp());
  await sweepUnprocessed();
  assert.equal((await stateOf(blocked)).processing_queued_at, null, "the safety net does not queue it again");
  assert.deepEqual([(await stateOf(blocked)).processing_state, (await jobs(QUEUES.analyze, blocked)).length], ["budget_blocked", 0]);
  assert.notEqual((await stateOf(fresh)).processing_queued_at, null, "while an article that is simply new is queued");
});

test("a grouping or digest job the limits refused ends normally and is recorded; every other failure is left to the queue", async () => {
  for (const [name, refusal] of REFUSALS) {
    const articleId = `g-${T}-${name.length}`;
    assert.deepEqual(await groupJobFailed({ articleId, signalOnly: true }, refusal()), { verdict: "budget_blocked" }, name);
    assert.deepEqual((await blockRow("group", articleId))!.job, { articleId, signalOnly: true });
    assert.match((await blockRow("group", articleId))!.reason, /budget/i);
  }
  const digest = storyId(900_000_000);
  assert.deepEqual(await digestJobFailed({ storyId: digest, afterCorrection: true }, usedUp()), { updated: false, budgetBlocked: true });
  assert.deepEqual((await blockRow("digest", String(digest)))!.job, { storyId: digest, afterCorrection: true });
  await sql`DELETE FROM budget_blocked WHERE kind = 'digest' AND ref = ${String(digest)}`;

  // Refused twice: still one row, with the latest reason.
  await groupJobFailed({ articleId: `g-${T}-twice` }, noPrice());
  await groupJobFailed({ articleId: `g-${T}-twice`, force: true }, usedUp());
  const twice = await sql`SELECT job, reason FROM budget_blocked WHERE kind = 'group' AND ref = ${`g-${T}-twice`}`;
  assert.deepEqual([twice.length, twice[0]!.job, /monthly_limit/.test(twice[0]!.reason)], [1, { articleId: `g-${T}-twice`, force: true }, true]);

  for (const other of [new BudgetExceededError("llm", "minute", 60), new ReceiptBusyError("in flight"), new ProviderRejectedError("HTTP 500", 500, true), new Error("boom")]) {
    await assert.rejects(groupJobFailed({ articleId: `g-${T}-other` }, other), (e) => e === other);
    await assert.rejects(digestJobFailed({ storyId: 1 }, other), (e) => e === other);
  }
  assert.equal(await blockRow("group", `g-${T}-other`), undefined);
});

test("a report the limits refused is recorded and not composed again until it is resumed; other failures still throw", async () => {
  const key = `2031-01-${T}`;
  let calls = 0;
  const refuse = () => { calls += 1; return Promise.reject(usedUp()); };
  assert.deepEqual(await unlessBudgetBlocked("daily", key, refuse), { key, entries: 0, budgetBlocked: true });
  assert.deepEqual(await unlessBudgetBlocked("daily", key, refuse), { key, entries: 0, budgetBlocked: true });
  assert.equal(calls, 1, "the hourly catch-up does not ask again");
  assert.equal(await isBudgetBlocked("report", `daily:${key}`), true);
  // Another report, another kind of the same key: not affected.
  assert.deepEqual(await unlessBudgetBlocked("weekly", key, async () => ({ key, entries: 3 })), { key, entries: 3 });
  const boom = new Error("boom");
  await assert.rejects(unlessBudgetBlocked("monthly", key, () => Promise.reject(boom)), (e) => e === boom);
  assert.equal(await isBudgetBlocked("report", `monthly:${key}`), false);
});

test("the embedding warm-up waits through a full count window and stops at once on a refusal by the limits", async () => {
  const batch = [{ id: "a", text: "t" }];
  const slept: number[] = [];
  const sleep = async (ms: number) => { slept.push(ms); };
  for (const [name, refusal] of REFUSALS) {
    let sent = 0;
    const out = await embedBatchWaiting(batch, () => { sent += 1; return Promise.reject(refusal()); }, sleep);
    assert.match(out.refused ?? "", /budget/i, name);
    assert.deepEqual([sent, slept], [1, []], `${name}: sent once, never slept`);
  }
  let hits = 0;
  assert.deepEqual(await embedBatchWaiting(batch, () => (++hits < 3 ? Promise.reject(new BudgetExceededError("embedding", "minute", 60)) : Promise.resolve()), sleep), {});
  assert.deepEqual([hits, slept], [3, [61_000, 61_000]]);
  assert.deepEqual(await embedBatchWaiting(batch, () => Promise.reject(new ReceiptBusyError("in flight")), sleep), {});
  const boom = new Error("boom");
  await assert.rejects(embedBatchWaiting(batch, () => Promise.reject(boom), sleep), (e) => e === boom);
});

test("only an image without a verified price, or an image the model refused, is answered by asking again without it; a used-up month is not", () => {
  assert.equal(writesWithoutImage(new MoneyRefusedError("image_input", "only text messages have a verified bound")), true);
  assert.equal(writesWithoutImage(new ProviderRejectedError("HTTP 400 bad image", 400, false)), true);
  for (const e of [usedUp(), noPrice(), new MoneyRefusedError("reasoning", "x"), new ProviderRejectedError("HTTP 500", 500, true), new BudgetExceededError("llm", "minute", 60), new Error("boom")]) {
    assert.equal(writesWithoutImage(e), false, String(e));
  }
  // The translation run stops on these by their message as well as by their type.
  for (const [, refusal] of REFUSALS) assert.match(refusal().message, /budget/i);
});

test("an admin resumes what was stopped, a bounded number per call, newest articles first; nothing resumes by itself", async () => {
  await sql`DELETE FROM budget_blocked WHERE ref LIKE ${`%${T}%`} OR (kind = 'digest' AND ref = ANY(${stories}))`;
  await sql`UPDATE articles SET processing_state = 'analyzed' WHERE source_id = ${SOURCE}`;
  const older = await article("resume-older");
  const newer = await article("resume-newer");
  await sql`UPDATE articles SET discovered_at = now() - interval '2 hours' WHERE id = ${older}`;
  for (const id of [older, newer]) await afterFailure(id, usedUp());
  const group = `g-${T}-resume`;
  const story = storyId(800_000_000);
  const report = `daily:2031-02-${T}`;
  await groupJobFailed({ articleId: group, signalOnly: true }, usedUp());
  await sql`UPDATE budget_blocked SET blocked_at = now() - interval '3 minutes' WHERE ref = ${group}`;
  await digestJobFailed({ storyId: story }, usedUp());
  await sql`UPDATE budget_blocked SET blocked_at = now() - interval '2 minutes' WHERE ref = ${String(story)}`;
  await blockForBudget("report", report, usedUp());
  await sql`UPDATE budget_blocked SET blocked_at = now() - interval '1 minute' WHERE ref = ${report}`;
  // Rows of other runs would shift the counts: this test needs the tables to itself (files run one at a time).
  const foreign = await sql`SELECT 1 FROM budget_blocked WHERE ref NOT IN (${group}, ${String(story)}, ${report})`;
  const foreignArticles = await sql`SELECT 1 FROM articles WHERE processing_state = 'budget_blocked' AND source_id <> ${SOURCE}`;
  assert.deepEqual([foreign.length, foreignArticles.length], [0, 0]);

  const overview = await budgetBlockedOverview();
  assert.deepEqual([overview.articles.count, overview.other.map((o) => [o.kind, o.n])], [2, [["digest", 1], ["group", 1], ["report", 1]]]);
  assert.match(overview.reasons[0]!.reason, /monthly_limit/);

  for (const input of [{ reason: " " }, { reason: "r", limit: 0 }, { reason: "r", limit: 501 }, { reason: "r", limit: 1.5 }]) {
    await assert.rejects(resumeBudgetBlocked(input as never, "admin:t"), (e) => (e as { statusCode?: number }).statusCode === 400, JSON.stringify(input));
  }
  assert.equal((await stateOf(newer)).processing_state, "budget_blocked");

  assert.deepEqual(await resumeBudgetBlocked({ limit: 1, reason: "上限已提高" }, "admin:t"), { resumed: { articles: 1, group: 0, digest: 0, report: 0 }, left: 4 });
  assert.deepEqual([(await stateOf(newer)).processing_state, (await stateOf(older)).processing_state], ["new", "budget_blocked"], "the newest article first");
  assert.deepEqual([(await stateOf(newer)).processing_error, (await stateOf(newer)).processing_queued_at !== null, (await jobs(QUEUES.analyze, newer)).length], [null, true, 1]);

  // The older article and the two oldest other items; the report stays for the next call.
  assert.deepEqual(await resumeBudgetBlocked({ limit: 3, reason: "上限已提高" }, "admin:t"), { resumed: { articles: 1, group: 1, digest: 1, report: 0 }, left: 1 });
  assert.deepEqual(await jobs(QUEUES.group, group), [{ articleId: group, signalOnly: true }]);
  assert.deepEqual(await jobs(QUEUES.digest, `story:${story}`), [{ storyId: story }]);
  assert.deepEqual([await blockRow("group", group), await isBudgetBlocked("report", report)], [undefined, true]);

  assert.deepEqual(await resumeBudgetBlocked({ reason: "上限已提高" }, "admin:t"), { resumed: { articles: 0, group: 0, digest: 0, report: 1 }, left: 0 });
  // A resumed report keeps its row, marked, until the hourly catch-up has composed it; it no longer counts as stopped.
  assert.equal(await isBudgetBlocked("report", report), false);
  assert.deepEqual((await budgetBlockedOverview()).other.map((o) => [o.kind, o.n, o.resuming]), [["report", 0, 1]]);
  assert.deepEqual(await resumeBudgetBlocked({ reason: "上限已提高" }, "admin:t"), { resumed: { articles: 0, group: 0, digest: 0, report: 0 }, left: 0 }, "not resumed twice");
  const audits = await sql<{ reason: string; after: { left: number } }[]>`SELECT reason, after FROM audit_log WHERE action = 'budget-blocked.resume' AND actor = 'admin:t' ORDER BY id DESC LIMIT 3`;
  assert.deepEqual(audits.map((a) => [a.reason, a.after.left]), [["上限已提高", 0], ["上限已提高", 0], ["上限已提高", 1]]);
  await sql`DELETE FROM audit_log WHERE action = 'budget-blocked.resume' AND actor = 'admin:t'`;
});

test("a resumed report is composed by the catch-up whatever its age; refused again it is stopped again; one that exists already just loses its mark", async () => {
  await sql`DELETE FROM budget_blocked WHERE ref LIKE ${`%${T}%`}`;
  const old = `daily:2030-01-${T}`, again = `weekly:2030-W01-${T}`, broken = `monthly:2030-01-${T}`, exists = `daily:2030-02-${T}`;
  for (const ref of [old, again, broken, exists]) await blockForBudget("report", ref, usedUp());
  await sql`INSERT INTO reports (kind, key, window_start, window_end, content, generated_at) VALUES ('daily', ${exists.slice(6)}, now(), now(), '{}'::jsonb, now())`;
  try {
    const asked: string[] = [];
    const compose = (kind: "daily" | "weekly" | "monthly", key: string) => unlessBudgetBlocked(kind, key, async () => {
      asked.push(`${kind}:${key}`);
      if (`${kind}:${key}` === again) throw usedUp();
      if (`${kind}:${key}` === broken) throw new Error("boom");
      return { key, entries: 1 };
    });
    // Not resumed: nothing is composed.
    assert.deepEqual(await composeResumedReports(compose), { composed: [], failed: [] });
    assert.deepEqual(asked, []);
    assert.equal((await resumeBudgetBlocked({ reason: "上限已提高" }, "admin:t")).resumed.report, 4);
    const result = await composeResumedReports(compose);
    assert.deepEqual([result.composed, result.failed.map((f) => f.split(": ")[0]), asked.sort()], [[old], [broken], [old, broken, again].sort()]);
    const left = await sql<{ ref: string; resumed: boolean }[]>`SELECT ref, resumed_at IS NOT NULL AS resumed FROM budget_blocked WHERE ref LIKE ${`%${T}%`} ORDER BY ref`;
    // Composed and already-there are gone; refused again is stopped again; the other failure waits, still resumed, for the next run.
    assert.deepEqual(left.map((r) => [r.ref, r.resumed]), [[broken, true], [again, false]].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
    assert.equal(await isBudgetBlocked("report", again), true);

    // A run composes a bounded number, the longest-waiting first; the one that failed went to the back of the line.
    const more = [1, 2, 3].map((i) => `daily:2030-03-0${i}-${T}`);
    for (const ref of more) await blockForBudget("report", ref, usedUp());
    await sql`UPDATE budget_blocked SET resumed_at = now() - make_interval(mins => 10 - right(split_part(ref, '-', 3), 1)::int) WHERE ref = ANY(${more})`;
    asked.length = 0;
    assert.deepEqual((await composeResumedReports(compose, 2)).composed, more.slice(0, 2));
    assert.deepEqual(asked, more.slice(0, 2));
    const waitingSince = async () => (await sql<{ at: Date }[]>`SELECT resumed_at AS at FROM budget_blocked WHERE ref = ${broken}`)[0]!.at.getTime();
    const before = await waitingSince();
    const next = await composeResumedReports(compose, 2);
    assert.deepEqual([next.composed, next.failed.length, asked.slice(2)], [[more[2]], 1, [more[2], broken]]);
    assert.ok((await waitingSince()) > before, "the one that failed again is moved behind whatever is resumed meanwhile");
  } finally {
    await sql`DELETE FROM reports WHERE kind = 'daily' AND key = ${exists.slice(6)}`;
    await sql`DELETE FROM budget_blocked WHERE ref LIKE ${`%${T}%`}`;
    await sql`DELETE FROM audit_log WHERE action = 'budget-blocked.resume' AND actor = 'admin:t'`;
  }
});

test("two resume calls at once never take the same item", async () => {
  for (let round = 0; round < 6; round++) {
    await sql`DELETE FROM budget_blocked WHERE ref LIKE ${`%${T}%`}`;
    await sql`UPDATE articles SET processing_state = 'analyzed' WHERE source_id = ${SOURCE}`;
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) ids.push(await article(`race-${round}-${i}`));
    for (const id of ids) await afterFailure(id, usedUp());
    for (let i = 0; i < 6; i++) await groupJobFailed({ articleId: `g-${T}-race-${round}-${i}` }, usedUp());
    const [a, b] = await Promise.all([resumeBudgetBlocked({ limit: 10, reason: "r" }, "admin:t"), resumeBudgetBlocked({ limit: 10, reason: "r" }, "admin:t")]);
    const count = (r: typeof a) => r.resumed.articles + r.resumed.group + r.resumed.digest + r.resumed.report;
    assert.ok(count(a) <= 10 && count(b) <= 10, `round ${round}`);
    assert.equal(a.resumed.articles + b.resumed.articles, 10, `round ${round}: each article once`);
    assert.equal(count(a) + count(b), 16, `round ${round}: every item once`);
    const [still] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM articles WHERE source_id = ${SOURCE} AND processing_state = 'budget_blocked'`;
    assert.deepEqual([still!.n, (await sql`SELECT 1 FROM budget_blocked WHERE ref LIKE ${`%${T}%`}`).length], [0, 0]);
  }
  await sql`DELETE FROM audit_log WHERE action = 'budget-blocked.resume' AND actor = 'admin:t'`;
});

test("a WeChat account whose check the limits refused is asked again after its interval, not at the next quarter hour", async () => {
  const mp = `${SOURCE}-mp`;
  const cursor = (refusedMinutesAgo: number) => sql`
    UPDATE sources SET cursor = ${sql.json({ lastCheckedAt: new Date(Date.now() - 86400_000).toISOString(), lastRefusedAt: new Date(Date.now() - refusedMinutesAgo * 60_000).toISOString() })} WHERE id = ${mp}`;
  await sql`INSERT INTO sources (id, name, kind, config, interval_minutes, next_fetch_at) VALUES (${mp}, 'Test mp', 'mp_account', '{"ghid":"gh_test"}'::jsonb, 60, '2100-01-01')`;
  try {
    await cursor(20);
    await scheduleMpReconcile();
    assert.equal((await jobs(QUEUES.mpCheck, `mp:${mp}`)).length, 0, "refused 20 minutes ago, interval 60");
    await cursor(61);
    await scheduleMpReconcile();
    assert.equal((await jobs(QUEUES.mpCheck, `mp:${mp}`)).length, 1);
  } finally {
    await sql`DELETE FROM pgboss.job WHERE singleton_key = ${`mp:${mp}`}`;
    await sql`DELETE FROM sources WHERE id = ${mp}`;
  }
});

test("the owner is told once a day that work is stopped by the limits; over the admin API it is listed and resumed", async () => {
  const mine = async () => (await collectFindings()).filter((f) => f.key === "money.blocked");
  assert.deepEqual(await mine(), []);
  const id = await article("alert");
  await afterFailure(id, noPrice());
  await groupJobFailed({ articleId: `g-${T}-alert` }, usedUp());
  const [finding] = await mine();
  assert.deepEqual([finding!.level, /1 篇新文章/.test(finding!.impact!), /1 项归组/.test(finding!.impact!), /monthly_limit/.test(finding!.detail!)], ["today", true, true, true]);

  const { buildApp } = await import("../apps/api/src/app.ts");
  const app = await buildApp();
  try {
    const [user] = await sql<{ id: number }[]>`INSERT INTO admin_users (email, display_name) VALUES (${`blocked-${T}@test.invalid`}, 'admin') RETURNING id`;
    await sql`INSERT INTO admin_sessions (id_hash, user_id, csrf_token, expires_at) VALUES (${sha256(`s-${T}`)}, ${user!.id}, ${`csrf-${T}`}, now() + interval '1 hour')`;
    const headers = { cookie: `aihot_admin=s-${T}`, "x-csrf-token": `csrf-${T}` };
    assert.equal((await app.inject({ method: "GET", url: "/api/admin/budget-blocked" })).statusCode, 401);
    const listed = await app.inject({ method: "GET", url: "/api/admin/budget-blocked", headers });
    assert.deepEqual([listed.statusCode, listed.json().articles.count, listed.json().other], [200, 1, [{ kind: "group", n: 1, resuming: 0, oldest: listed.json().other[0].oldest }]]);
    assert.equal((await app.inject({ method: "POST", url: "/api/admin/budget-blocked/resume", headers, payload: { limit: 5 } })).statusCode, 400, "a reason is required");
    const resumed = await app.inject({ method: "POST", url: "/api/admin/budget-blocked/resume", headers, payload: { limit: 5, reason: "价格已批准" } });
    assert.deepEqual([resumed.statusCode, resumed.json()], [200, { resumed: { articles: 1, group: 1, digest: 0, report: 0 }, left: 0 }]);
    await sql`DELETE FROM audit_log WHERE action = 'budget-blocked.resume' AND actor = ${`admin:${user!.id}`}`;
  } finally {
    await app.close();
  }
  assert.deepEqual(await mine(), []);
});

test("the places that handle a refusal by the limits are the known ones, and none of them picks another model", () => {
  // A new handler must be looked at against ADR-015 section 8 (no delay, no retry, no cheaper model): it has to be added here.
  const root = path.join(REPO_ROOT, "packages/backend/src");
  const files = (readdirSync(root, { recursive: true }) as string[]).filter((f) => f.endsWith(".ts")).map((f) => f.split(path.sep).join("/"));
  const handling = files.filter((f) => /MoneyRefusedError|MonthlyBudgetExhaustedError|refusedByMoney/.test(readFileSync(path.join(root, f), "utf8"))).sort();
  assert.deepEqual(handling, [
    "content/extract.ts", "editorial/analyze.ts", "editorial/translate.ts", "events/group.ts", "jobs/budget-blocked.ts", "jobs/content.ts", "jobs/events.ts",
    "providers/money.ts", "reports/compose.ts", "sources/collect.ts", "sources/mp.ts",
  ]);
  for (const f of handling.filter((f) => f !== "providers/money.ts" && f !== "editorial/analyze.ts")) {
    assert.doesNotMatch(readFileSync(path.join(root, f), "utf8"), /modelFor\([^)]*\)[^\n]*(MoneyRefused|refusedByMoney)|(MoneyRefused|refusedByMoney)[^\n]*modelFor\(/, f);
  }
  // analyze.ts asks again only without the image, on the same model.
  const analyze = readFileSync(path.join(root, "editorial/analyze.ts"), "utf8");
  assert.match(analyze, /if \(!image \|\| !writesWithoutImage\(error\)\) throw error;\n\s+try \{\n\s+res = await call\(null\);/);
});
