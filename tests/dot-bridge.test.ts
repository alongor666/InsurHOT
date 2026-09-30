// The file delivery bridge for Dot batches (D2), against this repository's real intake endpoint on
// 127.0.0.1 and real PostgreSQL: a file is delivered once and archived with the server's receipt; a
// repeat stores nothing and returns the first receipt; what the server refuses for good is set aside;
// everything else stays in place, byte for byte, for the next run; the token is written nowhere.
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { REPO_ROOT } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { BridgeConfigError, bridgeEndpoint, exitCodeFor, runDotBridge, type BridgeSummary } from "@aihot/backend/ingest/dot-bridge";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { DOT_BODY_LIMIT } from "@aihot/contracts/dot-ingest";

const RUN = tag();
// Generated per run so no token-shaped literal is committed.
const TOKEN = randomBytes(20).toString("hex");
let app: FastifyInstance;
let endpoint: string;
const roots: string[] = [];

before(async () => {
  process.env.DOT_INGEST_ENABLED = "true";
  process.env.DOT_INGEST_TOKEN = TOKEN;
  const { buildApp } = await import("../apps/api/src/app.ts");
  app = await buildApp();
  await app.listen({ host: "127.0.0.1", port: 0 });
  endpoint = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}/api/ingest/dot`;
});
after(async () => {
  await app.close();
  await sql`DELETE FROM dot_deliveries WHERE delivery_id LIKE ${`%${RUN}%`}`;
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
  delete process.env.DOT_INGEST_ENABLED;
  delete process.env.DOT_INGEST_TOKEN;
  await stopBoss();
  await closeDb();
});

const batch = (id: string, title = "Insurance change") => ({
  schemaVersion: "insurhot.dot.v1", deliveryId: id,
  items: [{ itemId: "item-1", title, summary: "A Dot-original summary.", pillars: ["changes"], assertionKind: "reported",
    sources: [{ url: "https://example.org/report", publisher: "Example source", publishedAt: null }], dotObservedAt: "2026-09-29T08:00:00Z" }],
});
function inbox() {
  const root = mkdtempSync(path.join(os.tmpdir(), "dot-bridge-"));
  roots.push(root);
  const dir = path.join(root, "inbox");
  mkdirSync(path.join(dir, "pending"), { recursive: true });
  return dir;
}
/** A file in pending, last modified a minute ago (so it counts as completely written). */
function drop(dir: string, name: string, content: unknown, recent = false) {
  const file = path.join(dir, "pending", name);
  writeFileSync(file, typeof content === "string" || Buffer.isBuffer(content) ? content : JSON.stringify(content));
  if (!recent) utimesSync(file, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));
  return file;
}
const run = (dir: string, over: Partial<Parameters<typeof runDotBridge>[0]> = {}) => runDotBridge({ inbox: dir, endpoint, token: TOKEN, ...over });
const list = (dir: string, sub: string) => readdirSync(path.join(dir, sub)).sort();
const ledger = (dir: string) => readFileSync(path.join(dir, "ledger.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
const stored = async (id: string) => (await sql<{ deliveries: number; items: number }[]>`
  SELECT (SELECT count(*)::int FROM dot_deliveries WHERE delivery_id = ${id}) AS deliveries, (SELECT count(*)::int FROM dot_items WHERE delivery_id = ${id}) AS items`)[0]!;
const counts = (s: BridgeSummary) => [s.delivered, s.duplicate, s.rejected, s.retry, s.skipped];
/** Every file under a directory, as one string: where a token would have to show up. */
function everything(dir: string): string {
  return (readdirSync(dir, { recursive: true }) as string[]).map((f) => path.join(dir, f)).filter((f) => lstatSync(f).isFile()).map((f) => `${f}\n${readFileSync(f, "utf8")}`).join("\n");
}
/** The script as an operator runs it. Not spawnSync: the endpoint it talks to lives in this process. */
function cli(args: string[], env: Record<string, string | undefined> = {}): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(REPO_ROOT, "scripts/dot-bridge.ts"), ...args],
      { cwd: REPO_ROOT, env: { ...process.env, DOT_INGEST_TOKEN: TOKEN, DOT_BRIDGE_ENDPOINT: undefined, ...env } as NodeJS.ProcessEnv });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

// ---------------------------------------------------------------------------------------------------

test("a batch is delivered once, archived with the server's receipt, and a repeat stores nothing and returns the first receipt", async () => {
  const dir = inbox();
  const id = `d-${RUN}-once`;
  const bytes = JSON.stringify(batch(id));
  drop(dir, "morning.json", bytes);
  const first = await run(dir);
  assert.deepEqual([counts(first), exitCodeFor(first)], [[1, 0, 0, 0, 0], 0]);
  assert.deepEqual([await stored(id), list(dir, "pending"), list(dir, "delivered")], [{ deliveries: 1, items: 1 }, [], [`${id}.json`, `${id}.receipt.json`]]);
  assert.equal(readFileSync(path.join(dir, "delivered", `${id}.json`), "utf8"), bytes, "archived exactly as written");
  const receipt = JSON.parse(readFileSync(path.join(dir, "delivered", `${id}.receipt.json`), "utf8"));
  assert.deepEqual([receipt.deliveryId, receipt.status, receipt.itemCount, typeof receipt.receivedAt, receipt.producer], [id, "received", 1, "string", "dot"]);
  const [row] = await sql<{ received_at: Date }[]>`SELECT received_at FROM dot_deliveries WHERE delivery_id = ${id}`;
  assert.equal(receipt.receivedAt, row!.received_at.toISOString(), "the receipt carries the server's time of first reception");

  // The same file again (a retry after a lost answer), and the same content with its keys in another order.
  drop(dir, "morning.json", bytes);
  const reordered = batch(id);
  drop(dir, "reordered.json", { items: reordered.items, deliveryId: id, schemaVersion: reordered.schemaVersion });
  const second = await run(dir);
  assert.deepEqual([counts(second), exitCodeFor(second)], [[0, 2, 0, 0, 0], 0]);
  assert.deepEqual([await stored(id), list(dir, "pending")], [{ deliveries: 1, items: 1 }, []]);
  const again = JSON.parse(readFileSync(path.join(dir, "delivered", `${id}.receipt.json`), "utf8"));
  assert.deepEqual([again.status, again.receivedAt, again.firstSeenAt], ["duplicate", receipt.receivedAt, receipt.firstSeenAt]);
  assert.equal(readFileSync(path.join(dir, "delivered", `${id}.json`), "utf8"), bytes, "the first archived copy stays");
  const lines = ledger(dir);
  assert.deepEqual(lines.map((l) => [l.file, l.outcome, l.httpStatus, l.deliveryId]), [["morning.json", "delivered", 200, id], ["morning.json", "duplicate", 200, id], ["reordered.json", "duplicate", 200, id]]);
  assert.deepEqual(Object.keys(lines[0]!).sort(), ["at", "deliveryId", "error", "file", "firstSeenAt", "httpStatus", "itemCount", "outcome", "receivedAt"], "no title, summary or source in the ledger");
});

test("what the server refuses for good is set aside with the reason; the stored batch stays as it was", async () => {
  const dir = inbox();
  const id = `d-${RUN}-conflict`;
  drop(dir, "a.json", batch(id));
  await run(dir);
  const [before] = await sql<{ payload_hash: string }[]>`SELECT payload_hash FROM dot_deliveries WHERE delivery_id = ${id}`;
  drop(dir, "changed.json", batch(id, "A different title"));
  drop(dir, "unknown-field.json", { ...batch(`d-${RUN}-bad`), extra: true });
  const result = await run(dir);
  assert.deepEqual([counts(result), exitCodeFor(result)], [[0, 0, 2, 0, 0], 3]);
  assert.deepEqual([list(dir, "pending"), list(dir, "rejected")], [[], ["changed.json", "changed.json.error.json", "unknown-field.json", "unknown-field.json.error.json"]]);
  const conflict = JSON.parse(readFileSync(path.join(dir, "rejected", "changed.json.error.json"), "utf8"));
  assert.deepEqual([conflict.httpStatus, conflict.error, conflict.deliveryId], [409, "delivery_conflict", id]);
  assert.equal(JSON.parse(readFileSync(path.join(dir, "rejected", "unknown-field.json.error.json"), "utf8")).httpStatus, 400);
  const [afterwards] = await sql<{ payload_hash: string }[]>`SELECT payload_hash FROM dot_deliveries WHERE delivery_id = ${id}`;
  assert.deepEqual([afterwards!.payload_hash, await stored(`d-${RUN}-bad`)], [before!.payload_hash, { deliveries: 0, items: 0 }]);
  // A second refusal under the same file name does not overwrite the first.
  drop(dir, "changed.json", batch(id, "Yet another title"));
  await run(dir);
  assert.equal(list(dir, "rejected").filter((n) => n.startsWith("changed.json")).length, 4);
});

test("a file that cannot be a batch is set aside without a request; links, unfinished and fresh files are left alone; nothing leaves the inbox", async () => {
  const dir = inbox();
  let sent = 0;
  const counting: typeof fetch = (...args) => { sent += 1; return fetch(...args); };
  const outside = path.join(path.dirname(dir), "outside.json");
  writeFileSync(outside, JSON.stringify(batch(`d-${RUN}-outside`)));
  symlinkSync(outside, path.join(dir, "pending", "link.json"));
  mkdirSync(path.join(dir, "pending", "folder.json"));
  drop(dir, "unfinished.json.part", batch(`d-${RUN}-part`));
  drop(dir, ".hidden.json", batch(`d-${RUN}-hidden`));
  drop(dir, "notes.txt", "not a batch");
  drop(dir, "fresh.json", batch(`d-${RUN}-fresh`), true);
  drop(dir, "big.json", Buffer.alloc(DOT_BODY_LIMIT + 1, 0x20));
  drop(dir, "broken.json", "{ not json");
  drop(dir, "no-id.json", { schemaVersion: "insurhot.dot.v1", items: [] });
  drop(dir, "escape.json", batch("../../escaped"));
  drop(dir, "array.json", "[1,2]");
  const result = await run(dir, { fetchImpl: counting, settleMs: 5000 });
  assert.equal(sent, 0, "nothing was sent");
  assert.deepEqual(counts(result), [0, 0, 5, 0, 3]);
  assert.deepEqual(list(dir, "pending"), [".hidden.json", "folder.json", "fresh.json", "link.json", "notes.txt", "unfinished.json.part"]);
  const reasons = Object.fromEntries(ledger(dir).map((l) => [l.file, l.error]));
  assert.deepEqual(reasons, { "array.json": "missing_delivery_id", "big.json": "payload_too_large", "broken.json": "invalid_json", "escape.json": "unsafe_delivery_id",
    "folder.json": "not_a_file", "fresh.json": "recently_modified", "link.json": "symbolic_link", "no-id.json": "missing_delivery_id" });
  assert.ok(existsSync(path.join(dir, "rejected", "escape.json")), "kept under its own name");
  assert.deepEqual(readdirSync(path.dirname(dir)).sort(), ["inbox", "outside.json"], "nothing written outside the inbox");
  assert.equal(JSON.parse(readFileSync(outside, "utf8")).deliveryId, `d-${RUN}-outside`, "the link's target is untouched");
  assert.equal((await stored(`d-${RUN}-outside`)).deliveries, 0);
  // Once it has rested, the fresh file is delivered.
  const later = await run(dir, { settleMs: 0 });
  assert.equal(later.delivered, 1);
  assert.equal((await stored(`d-${RUN}-fresh`)).deliveries, 1);
});

test("when the server is off, unreachable or refuses the token, the file stays as it is and is delivered later under the same id", async () => {
  const dir = inbox();
  const id = `d-${RUN}-later`;
  const file = drop(dir, "a.json", batch(id));
  drop(dir, "b.json", batch(`${id}-b`));
  const bytes = readFileSync(file);
  const untouched = () => assert.deepEqual([list(dir, "pending"), readFileSync(file).equals(bytes), list(dir, "delivered"), list(dir, "rejected")], [["a.json", "b.json"], true, [], []]);

  // Intake switched off: every file is asked about and waits.
  process.env.DOT_INGEST_ENABLED = "false";
  try {
    const off = await run(dir);
    assert.deepEqual([counts(off), off.stopped, exitCodeFor(off)], [[0, 0, 0, 2, 0], undefined, 2]);
    assert.deepEqual(ledger(dir).map((l) => [l.outcome, l.httpStatus, l.error]), [["retry", 503, "dot_ingest_disabled"], ["retry", 503, "dot_ingest_disabled"]]);
  } finally {
    process.env.DOT_INGEST_ENABLED = "true";
  }
  untouched();

  // Nobody listening: the run ends at the first file.
  const closed = http.createServer();
  await new Promise<void>((r) => closed.listen(0, "127.0.0.1", r));
  const deadPort = (closed.address() as AddressInfo).port;
  await new Promise((r) => closed.close(r));
  let sent = 0;
  const down = await run(dir, { endpoint: `http://127.0.0.1:${deadPort}/api/ingest/dot`, fetchImpl: (...a) => { sent += 1; return fetch(...a); } });
  assert.deepEqual([counts(down), down.stopped, exitCodeFor(down), sent], [[0, 0, 0, 2, 0], "unreachable", 2, 1]);
  untouched();

  // A wrong token: refused, the run stops, the second file is not sent.
  sent = 0;
  const wrong = await run(dir, { token: randomBytes(20).toString("hex"), fetchImpl: (...a) => { sent += 1; return fetch(...a); } });
  assert.deepEqual([counts(wrong), wrong.stopped, exitCodeFor(wrong), sent], [[0, 0, 0, 2, 0], "unauthorized", 2, 1]);
  untouched();
  assert.equal((await stored(id)).deliveries, 0);

  const ok = await run(dir);
  assert.deepEqual([counts(ok), exitCodeFor(ok)], [[2, 0, 0, 0, 0], 0]);
  assert.deepEqual([await stored(id), list(dir, "delivered").includes(`${id}.json`)], [{ deliveries: 1, items: 1 }, true]);
});

test("a redirect is not followed, a full rate window ends the run, and an answer that is not a receipt changes nothing", async () => {
  let elsewhere = 0;
  const target = http.createServer((_req, res) => { elsewhere += 1; res.end("{}"); });
  await new Promise<void>((r) => target.listen(0, "127.0.0.1", r));
  let mode: "redirect" | "limited" | "odd" = "redirect";
  let hits = 0;
  const front = http.createServer((req, res) => {
    req.resume();
    hits += 1;
    if (mode === "redirect") res.writeHead(307, { location: `http://127.0.0.1:${(target.address() as AddressInfo).port}/api/ingest/dot` }).end();
    else if (mode === "limited") res.writeHead(429, { "content-type": "application/json" }).end('{"ok":false,"error":"rate_limited"}');
    else res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true,"status":"received","deliveryId":"someone-else"}');
  });
  await new Promise<void>((r) => front.listen(0, "127.0.0.1", r));
  try {
    const dir = inbox();
    drop(dir, "a.json", batch(`d-${RUN}-redirect`));
    drop(dir, "b.json", batch(`d-${RUN}-redirect-b`));
    const at = `http://127.0.0.1:${(front.address() as AddressInfo).port}/api/ingest/dot`;
    const redirected = await run(dir, { endpoint: at });
    assert.deepEqual([counts(redirected), elsewhere, hits], [[0, 0, 0, 2, 0], 0, 2]);
    assert.equal(ledger(dir)[0]!.error, "redirect_not_followed");
    mode = "limited";
    hits = 0;
    const limited = await run(dir, { endpoint: at });
    assert.deepEqual([counts(limited), limited.stopped, hits], [[0, 0, 0, 2, 0], "rate_limited", 1]);
    mode = "odd";
    const odd = await run(dir, { endpoint: at });
    assert.deepEqual([counts(odd), list(dir, "pending"), list(dir, "delivered")], [[0, 0, 0, 2, 0], ["a.json", "b.json"], []], "a 200 that names another delivery is not a receipt");
  } finally {
    await new Promise((r) => front.close(r));
    await new Promise((r) => target.close(r));
  }
});

test("the endpoint must be this service's intake address, over TLS unless it is on this machine", () => {
  for (const ok of ["https://insurhot.example/api/ingest/dot", "http://127.0.0.1:3001/api/ingest/dot", "http://localhost:3001/api/ingest/dot", "http://[::1]:3001/api/ingest/dot"]) {
    assert.equal(bridgeEndpoint(ok).pathname, "/api/ingest/dot", ok);
  }
  for (const bad of [undefined, "", "insurhot.example", "http://insurhot.example/api/ingest/dot", "https://insurhot.example/api/ingest/items", "https://insurhot.example/api/ingest/dot?x=1",
    "https://user:secret@insurhot.example/api/ingest/dot", "ftp://127.0.0.1/api/ingest/dot", "http://127.0.0.1.example/api/ingest/dot", "https://insurhot.example/"]) {
    assert.throws(() => bridgeEndpoint(bad), BridgeConfigError, String(bad));
  }
});

test("one bridge per inbox: a second run does nothing while the first holds the lock; a lock left by a process that is gone is taken over", async () => {
  const dir = inbox();
  const id = `d-${RUN}-lock`;
  drop(dir, "a.json", batch(id));
  writeFileSync(path.join(dir, ".lock"), String(process.pid));
  const held = await run(dir);
  assert.deepEqual([counts(held), held.stopped, exitCodeFor(held), list(dir, "pending"), existsSync(path.join(dir, "ledger.jsonl"))], [[0, 0, 0, 0, 0], "locked", 2, ["a.json"], false]);
  assert.equal(readFileSync(path.join(dir, ".lock"), "utf8"), String(process.pid), "the holder's lock is left alone");
  const gone = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" }).stdout;
  writeFileSync(path.join(dir, ".lock"), gone);
  const taken = await run(dir);
  assert.deepEqual([counts(taken), existsSync(path.join(dir, ".lock"))], [[1, 0, 0, 0, 0], false]);
  // Two runs at once: one delivers, the other finds the lock or a duplicate; one batch is stored.
  drop(dir, "b.json", batch(`${id}-b`));
  const both = await Promise.all([run(dir), run(dir)]);
  assert.equal(both[0].delivered + both[1].delivered, 1);
  assert.equal((await stored(`${id}-b`)).deliveries, 1);
});

test("from the command line: the summary and the exit code; the token comes from the environment only and appears in nothing the bridge writes", async () => {
  const dir = inbox();
  const id = `d-${RUN}-cli`;
  drop(dir, "ok.json", batch(id));
  const done = await cli(["--inbox", dir, "--endpoint", endpoint]);
  assert.deepEqual([done.status, JSON.parse(done.stdout)], [0, { delivered: 1, duplicate: 0, rejected: 0, retry: 0, skipped: 0 }]);
  assert.equal((await stored(id)).deliveries, 1);
  drop(dir, "bad.json", { ...batch(`${id}-bad`), extra: 1 });
  assert.equal((await cli(["--inbox", dir], { DOT_BRIDGE_ENDPOINT: endpoint })).status, 3, "the endpoint may come from the environment");
  drop(dir, "wait.json", batch(`${id}-wait`));
  const wrongToken = randomBytes(20).toString("hex");
  const refused = await cli(["--inbox", dir, "--endpoint", endpoint], { DOT_INGEST_TOKEN: wrongToken });
  assert.deepEqual([refused.status, JSON.parse(refused.stdout).stopped], [2, "unauthorized"]);

  // Configuration errors: exit 1, nothing sent, nothing moved.
  const pendingBefore = list(dir, "pending");
  const cases: Array<[string[], Record<string, string | undefined>]> = [
    [["--inbox", dir, "--endpoint", endpoint], { DOT_INGEST_TOKEN: undefined }],
    [["--inbox", dir, "--endpoint", endpoint, "--token", TOKEN], {}],
    [["--inbox", dir, "--endpoint", "http://insurhot.example/api/ingest/dot"], {}],
    [["--inbox", dir], {}],
    [["--endpoint", endpoint], {}],
  ];
  for (const [args, env] of cases) {
    const r = await cli(args, env);
    assert.deepEqual([r.status, r.stdout, /^dot-bridge: /.test(r.stderr)], [1, "", true], args.join(" "));
    assert.ok(!r.stderr.includes(TOKEN));
  }
  assert.deepEqual(list(dir, "pending"), pendingBefore);

  // Neither token is in the ledger, the receipts, the error files or what was printed.
  const written = everything(dir) + done.stdout + done.stderr + refused.stdout + refused.stderr;
  assert.ok(written.includes(id) && !written.includes(TOKEN) && !written.includes(wrongToken));
  assert.deepEqual([lstatSync(path.join(dir, "ledger.jsonl")).mode & 0o777, lstatSync(path.join(dir, "delivered", `${id}.receipt.json`)).mode & 0o777], [0o600, 0o600]);
});
