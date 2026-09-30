// OUTBOUND_LOOPBACK_ONLY: with collection opted in and the SSRF guard switched off the way the invariant
// tests do (ALLOW_PRIVATE_NETWORK_FETCH), a collector may still reach only this host. No database.
process.env.OUTBOUND_LOOPBACK_ONLY = "true";
process.env.COLLECT_ENABLED = "true";
process.env.ALLOW_PRIVATE_NETWORK_FETCH = "true";
process.env.MODEL_CALLS_ENABLED = "false";
import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
// Static imports are hoisted above the env assignments; config reads the env when it loads.
const { FETCH_TEST_DOUBLE, assertLoopbackUrl, isLoopbackHost, outboundFetch } = await import("@aihot/backend/outbound-policy");
const { guardedFetch } = await import("@aihot/backend/lib/http-fetch");
const { loopbackLookup } = await import("@aihot/backend/lib/url");

async function serve(handler: http.RequestListener) {
  let hits = 0;
  const server = http.createServer((req, res) => { hits += 1; handler(req, res); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const { port } = server.address() as { port: number };
  return { url: `http://127.0.0.1:${port}`, hits: () => hits, close: () => new Promise<void>((r) => server.close(() => r())) };
}

test("loopback hosts are decided by name; public and private non-loopback names are refused without DNS", () => {
  for (const ok of ["127.0.0.1", "127.1.2.3", "localhost", "::1", "[::1]", "LOCALHOST"]) assert.equal(isLoopbackHost(ok), true, ok);
  for (const bad of ["example.com", "198.51.100.1", "10.0.0.1", "169.254.169.254", "127.0.0.1.nip.io", "localhost.evil.test", "::ffff:198.51.100.1", "0.0.0.0"]) {
    assert.equal(isLoopbackHost(bad), false, bad);
    assert.throws(() => assertLoopbackUrl(`http://${bad.includes(":") ? `[${bad}]` : bad}/`), /OUTBOUND_LOOPBACK_ONLY/);
  }
});

test("guarded collection reaches a local stub but refuses a public name and a redirect off the host", async () => {
  const away = await serve((_req, res) => { res.writeHead(302, { location: "http://198.51.100.1/" }); res.end(); });
  const local = await serve((_req, res) => { res.writeHead(200, { "content-type": "text/plain" }); res.end("ok"); });
  try {
    const res = await guardedFetch(`${local.url}/page`);
    assert.equal(res.status, 200); assert.equal(res.text(), "ok"); assert.equal(local.hits(), 1);
    await assert.rejects(guardedFetch("http://example.com/"), /OUTBOUND_LOOPBACK_ONLY/);
    await assert.rejects(guardedFetch(`${away.url}/go`), /OUTBOUND_LOOPBACK_ONLY/);
    assert.equal(away.hits(), 1, "the first hop is local and is fetched; the redirect target is refused before any request");
  } finally { await Promise.all([away.close(), local.close()]); }
});

test("direct integrations refuse non-loopback targets before calling fetch, unless fetch is a marked test double", async () => {
  await assert.rejects(outboundFetch("collect", "http://example.com/v1"), /OUTBOUND_LOOPBACK_ONLY/);
  await assert.rejects(outboundFetch("collect", new URL("http://198.51.100.1/")), /OUTBOUND_LOOPBACK_ONLY/);
  const real = globalThis.fetch;
  let seen = "";
  const double = (async (input: string | URL | Request) => { seen = String(input); return new Response("{}", { status: 200 }); }) as typeof fetch;
  // An unmarked replacement is still checked (fail-closed) ...
  globalThis.fetch = double;
  try { await assert.rejects(outboundFetch("collect", "https://open.feishu.cn/open-apis/x"), /OUTBOUND_LOOPBACK_ONLY/); assert.equal(seen, ""); }
  finally { globalThis.fetch = real; }
  // ... a marked one is the test's own answer, not the network (tests/feedback.test.ts).
  Object.assign(double, { [FETCH_TEST_DOUBLE]: true });
  globalThis.fetch = double;
  try {
    const res = await outboundFetch("collect", "https://open.feishu.cn/open-apis/x");
    assert.equal(res.status, 200); assert.equal(seen, "https://open.feishu.cn/open-apis/x");
  } finally { globalThis.fetch = real; }
  await assert.rejects(outboundFetch("collect", "https://open.feishu.cn/open-apis/x"), /OUTBOUND_LOOPBACK_ONLY/);
});

test("the connect-time lookup refuses non-loopback names and non-loopback answers", async () => {
  const resolve = (host: string) => new Promise<{ err: Error | null; addr: unknown }>((r) => loopbackLookup(host, { all: true }, (err, addr) => r({ err, addr })));
  const refused = await resolve("example.com");
  assert.match(String(refused.err?.message), /OUTBOUND_LOOPBACK_ONLY/);
  const ok = await resolve("localhost");
  assert.equal(ok.err, null);
  for (const a of ok.addr as { address: string }[]) assert.equal(isLoopbackHost(a.address), true, a.address);
});
