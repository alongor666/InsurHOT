import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import type { Db } from "../packages/backend/src/db.ts";
import { OUTBOUND_FLAGS, explicitlyEnabled, outboundFetch, PaidOutboundDisabledError } from "../packages/backend/src/outbound-policy.ts";

// Only local fake HTTP; guardedFetch's SSRF exception is scoped to this test process.
process.env.ALLOW_PRIVATE_NETWORK_FETCH = "true";
const { guardedFetch } = await import("../packages/backend/src/lib/http-fetch.ts");
const { paidRequest, checkBudget, BudgetExceededError } = await import("../packages/backend/src/providers/receipts.ts");
const { sql, closeDb } = await import("../packages/backend/src/db.ts");
const { postWebhook } = await import("../packages/backend/src/notify/feishu.ts");

test("runtime opt-in and actual HTTP boundaries deny defaults, invalid values and revoked flags", async () => {
  let calls = 0;
  const server = createServer((_req, res) => { calls++; res.setHeader("content-type", "application/json"); res.end('{"code":0}'); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const saved = Object.fromEntries(Object.values(OUTBOUND_FLAGS).map((name) => [name, process.env[name]]));
  try {
    for (const value of [undefined, "", "false", "1", "TRUE", "invalid"]) {
      for (const name of Object.values(OUTBOUND_FLAGS)) {
        if (value === undefined) delete process.env[name]; else process.env[name] = value;
        assert.equal(explicitlyEnabled(name), false);
      }
      await assert.rejects(guardedFetch(url), /COLLECT_ENABLED=true required/);
      await assert.rejects(postWebhook(url, {}), /FEISHU_CONTENT_PUSH_ENABLED=true required/);
      for (const purpose of ["feishuInternal", "feishuAuth", "indexNow", "media"] as const) {
        await assert.rejects(outboundFetch(purpose, url), /disabled/);
      }
    }
    assert.equal(calls, 0);
    for (const name of Object.values(OUTBOUND_FLAGS)) process.env[name] = "true";
    assert.equal((await guardedFetch(url)).status, 200);
    assert.equal((await postWebhook(url, {})).ok, true);
    for (const purpose of ["feishuInternal", "feishuAuth", "indexNow", "media"] as const) assert.equal((await outboundFetch(purpose, url)).status, 200);
    assert.equal(calls, 6);
    // An existing process/queued caller observes revocation before its next request.
    process.env.COLLECT_ENABLED = "false";
    process.env.FEISHU_CONTENT_PUSH_ENABLED = "false";
    await assert.rejects(guardedFetch(url), /disabled/);
    await assert.rejects(postWebhook(url, {}), /disabled/);
    assert.equal(calls, 6);
  } finally {
    for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("all paid requests reject before DB or callback even with opt-in flags", async () => {
  const original = sql.begin;
  let dbCalls = 0, providerCalls = 0;
  sql.begin = (() => { dbCalls++; throw new Error("unexpected DB access"); }) as typeof sql.begin;
  try {
    for (const value of [undefined, "false", "invalid", "true"]) {
      if (value === undefined) delete process.env.MODEL_CALLS_ENABLED; else process.env.MODEL_CALLS_ENABLED = value;
      await assert.rejects(paidRequest({ service: "any-provider", purpose: "manual", identity: {} }, async () => { providerCalls++; return { response: {} }; }), PaidOutboundDisabledError);
    }
    process.env.MODEL_CALLS_ENABLED = "true";
    process.env.EMBEDDINGS_ENABLED = "true";
    await assert.rejects(outboundFetch("model", "http://127.0.0.1:1"), PaidOutboundDisabledError);
    await assert.rejects(outboundFetch("embeddings", "http://127.0.0.1:1"), PaidOutboundDisabledError);
    assert.equal(dbCalls, 0);
    assert.equal(providerCalls, 0);
  } finally { sql.begin = original; delete process.env.MODEL_CALLS_ENABLED; delete process.env.EMBEDDINGS_ENABLED; await closeDb(); }
});

test("receipt count-budget check rejects missing row before querying counts", async () => {
  let queries = 0;
  const tx = (async () => { queries++; return []; }) as unknown as Db;
  await assert.rejects(checkBudget(tx, "unconfigured"), (error: unknown) => error instanceof BudgetExceededError && /missing budget/.test(error.message));
  assert.equal(queries, 1);
});


test("direct integrations reject redirects even when caller requests follow and opt-in is revoked", async () => {
  let before = 0, after = 0;
  const saved = process.env.FEISHU_CONTENT_PUSH_ENABLED;
  const server = createServer((req, res) => {
    if (req.url === "/before") {
      before++;
      process.env.FEISHU_CONTENT_PUSH_ENABLED = "false";
      res.writeHead(302, { location: "/after" });
      res.end();
    } else { after++; res.end("unexpected redirected request"); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    process.env.FEISHU_CONTENT_PUSH_ENABLED = "true";
    await assert.rejects(outboundFetch("feishuContent", `http://127.0.0.1:${address.port}/before`, { redirect: "follow" }));
    assert.equal(before, 1);
    assert.equal(after, 0);
    assert.equal(process.env.FEISHU_CONTENT_PUSH_ENABLED, "false");
  } finally {
    if (saved === undefined) delete process.env.FEISHU_CONTENT_PUSH_ENABLED; else process.env.FEISHU_CONTENT_PUSH_ENABLED = saved;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
