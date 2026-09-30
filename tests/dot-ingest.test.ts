import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import Fastify from 'fastify';
import { DOT_BODY_LIMIT, type DotDelivery } from '../packages/contracts/src/dot-ingest.ts';
import { DotIntakeError, DotIntakeService, dotPayloadHash, type DotRepository, type DotStoredReceipt } from '../packages/backend/src/ingest/dot.ts';
import { DOT_RATE_LIMIT, registerDotIngest } from '../apps/api/src/routes/dot-ingest.ts';
// Generated per run so no token-shaped literal is committed; only its shape matters to the route.
const token = randomBytes(20).toString('hex');
const time = '2026-09-30T09:00:00.000Z';
function payload(): DotDelivery {
  return { schemaVersion: 'insurhot.dot.v1', deliveryId: 'delivery-1', items: [{ itemId: 'item-1', title: 'Insurance change',
    summary: '<script>instructions are data</script>', pillars: ['changes'], assertionKind: 'reported',
    sources: [{ url: 'https://example.org/report', publisher: 'Example source', publishedAt: '2020-01-01T00:00:00Z' }], dotObservedAt: '2026-09-29T08:00:00Z' }] };
}
/** Fake verifies service/HTTP behavior only, never PostgreSQL transactions or concurrency. */
class FakeRepository implements DotRepository {
  calls = 0;
  rows = new Map<string, { payload: DotDelivery; hash: string; receipt: DotStoredReceipt }>();
  async receive(body: DotDelivery, hash: string, receivedAt: Date): Promise<DotStoredReceipt> {
    this.calls++;
    const existing = this.rows.get(body.deliveryId);
    if (existing) {
      if (existing.hash !== hash) throw new DotIntakeError(409, 'delivery_conflict');
      return { ...existing.receipt, duplicate: true };
    }
    const receipt = { receivedAt: receivedAt.toISOString(), firstSeenAt: receivedAt.toISOString(), itemCount: body.items.length, duplicate: false };
    this.rows.set(body.deliveryId, { payload: structuredClone(body), hash, receipt });
    return receipt;
  }
}
function setup(env: NodeJS.ProcessEnv = { DOT_INGEST_ENABLED: 'true', DOT_INGEST_TOKEN: token }) {
  const repo = new FakeRepository();
  const app = Fastify({ logger: false });
  registerDotIngest(app, { env: () => env, service: new DotIntakeService(repo, () => new Date(time)) });
  const post = (body: unknown = payload(), auth: string | undefined = `Bearer ${token}`) => app.inject({ method: 'POST', url: '/api/ingest/dot', payload: body as object, headers: auth === undefined ? {} : { authorization: auth } });
  return { repo, app, post };
}
test('literal opt-in denies default, false and invalid values before storage', async () => {
  for (const flag of [undefined, '', 'false', 'TRUE', '1', 'invalid']) {
    const { repo, app, post } = setup({ DOT_INGEST_ENABLED: flag, DOT_INGEST_TOKEN: token });
    try { const res = await post(); assert.equal(res.statusCode, 503); assert.equal(res.headers['cache-control'], 'no-store'); assert.equal(repo.calls, 0); }
    finally { await app.close(); }
  }
});
test('dedicated valid token required before storage; old ingest token cannot authorize', async () => {
  for (const expected of [undefined, 'short', 'your-token-placeholder-of-thirty-two-characters', 'x'.repeat(32)]) {
    const { repo, app, post } = setup({ DOT_INGEST_ENABLED: 'true', DOT_INGEST_TOKEN: expected, INGEST_TOKEN: token });
    try { assert.equal((await post()).statusCode, 401); assert.equal(repo.calls, 0); } finally { await app.close(); }
  }
  const { repo, app, post } = setup();
  try { for (const auth of ['', 'Bearer wrong', 'Basic abc']) assert.equal((await post(payload(), auth)).statusCode, 401); assert.equal(repo.calls, 0); } finally { await app.close(); }
});
test('per-address rate limit counts before authentication and does not affect other addresses', async () => {
  const { repo, app } = setup();
  const post = (remoteAddress: string, auth = 'Bearer wrong') => app.inject({ method: 'POST', url: '/api/ingest/dot', payload: payload(), headers: { authorization: auth }, remoteAddress });
  try {
    for (let n = 0; n < DOT_RATE_LIMIT.perWindow; n++) assert.equal((await post('10.0.0.1')).statusCode, 401);
    const limited = await post('10.0.0.1', `Bearer ${token}`);
    assert.equal(limited.statusCode, 429); assert.deepEqual(limited.json(), { ok: false, error: 'rate_limited' });
    assert.equal(limited.headers['retry-after'], '60'); assert.equal(limited.headers['cache-control'], 'no-store');
    assert.equal((await post('10.0.0.2', `Bearer ${token}`)).statusCode, 200);
    assert.equal(repo.calls, 1);
  } finally { await app.close(); }
});
test('receipt and isolated payload preserve server observation, source and Dot times; HTML remains data', async () => {
  const { repo, app, post } = setup();
  try {
    const res = await post(); assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true, schemaVersion: 'insurhot.dot.v1', deliveryId: 'delivery-1', producer: 'dot', status: 'received', receivedAt: time, firstSeenAt: time, itemCount: 1 });
    assert.deepEqual(repo.rows.get('delivery-1')!.payload, payload());
    assert.equal(repo.calls, 1);
  } finally { await app.close(); }
});
test('same content with changed key order duplicates; changed content conflicts, first seen preserved', async () => {
  const { repo, app, post } = setup();
  try {
    assert.equal((await post()).statusCode, 200);
    const original = payload(); const reordered = { items: original.items, deliveryId: original.deliveryId, schemaVersion: original.schemaVersion };
    assert.equal(dotPayloadHash(reordered), dotPayloadHash(original));
    const duplicate = await post(reordered); assert.equal(duplicate.json().status, 'duplicate'); assert.equal(duplicate.json().firstSeenAt, time);
    original.items[0].summary = 'Changed'; assert.equal((await post(original)).statusCode, 409); assert.equal(repo.rows.size, 1);
    assert.equal(repo.rows.get('delivery-1')!.payload.items[0].summary, payload().items[0].summary);
  } finally { await app.close(); }
});
test('strict full-batch validation rejects unsafe or unrecognized data before storage', async () => {
  const { repo, app, post } = setup();
  const bad: unknown[] = [ { ...payload(), fulltext: 'not permitted' }, { ...payload(), schemaVersion: 'v2' }, { ...payload(), deliveryId: '../bad' } ];
  for (const patch of [ { fulltext: 'body' }, { snapshot: { body: 'source text' } }, { assertionKind: 'fact_primary' }, { summary: '' }, { dotObservedAt: 'yesterday' }, { pillars: ['changes', 'changes'] },
    { sources: [{ url: 'http://example.org', publisher: 'x', publishedAt: null }] },
    { sources: [{ url: 'https://user:secret@example.org', publisher: 'x', publishedAt: null }] },
    { sources: [{ url: 'https://example.org', publisher: 'x', publishedAt: null, body: 'fulltext' }] } ]) {
    const p = payload(); p.items.push({ ...p.items[0], itemId: 'item-2', ...patch } as never); bad.push(p);
  }
  const repeated = payload(); repeated.items.push(repeated.items[0]); bad.push(repeated);
  const over = payload(); over.items = Array.from({ length: 51 }, (_, n) => ({ ...over.items[0], itemId: `item-${n}` })); bad.push(over);
  try { for (const body of bad) { const res = await post(body); assert.equal(res.statusCode, 400); assert.deepEqual(res.json(), { ok: false, error: 'invalid_delivery' }); } assert.equal(repo.calls, 0); }
  finally { await app.close(); }
});
test('HTTP body limit and malformed JSON return stable no-store errors without storage', async () => {
  const { repo, app } = setup();
  try {
    for (const [body, code] of [[JSON.stringify({ data: 'x'.repeat(DOT_BODY_LIMIT) }), 413], ['{"broken":', 400]] as const) {
      const res = await app.inject({ method: 'POST', url: '/api/ingest/dot', payload: body, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
      assert.equal(res.statusCode, code); assert.equal(res.headers['cache-control'], 'no-store'); assert.equal(res.body.includes('broken'), false);
    } assert.equal(repo.calls, 0);
  } finally { await app.close(); }
});
test('storage failures do not disclose data, tokens or database errors', async () => {
  const app = Fastify({ logger: false });
  registerDotIngest(app, { env: () => ({ DOT_INGEST_ENABLED: 'true', DOT_INGEST_TOKEN: token }), service: new DotIntakeService({ receive: async () => { throw new Error(`secret ${token} content`); } }) });
  try { const res = await app.inject({ method: 'POST', url: '/api/ingest/dot', payload: payload(), headers: { authorization: `Bearer ${token}` } }); assert.equal(res.statusCode, 503); assert.deepEqual(res.json(), { ok: false, error: 'dot_storage_unavailable' }); }
  finally { await app.close(); }
});

 test('maximum batch accepts nullable source date without promoting it into server timestamps', async () => {
  const { repo, app, post } = setup();
  try {
    const p = payload();
    p.items = Array.from({ length: 50 }, (_, n) => ({ ...p.items[0], itemId: `item-${n}`, sources: [{ ...p.items[0].sources[0], publishedAt: null }] }));
    const res = await post(p); assert.equal(res.statusCode, 200); assert.equal(res.json().itemCount, 50);
    assert.equal(repo.rows.get(p.deliveryId)!.payload.items[0].sources[0].publishedAt, null);
    assert.equal(res.json().firstSeenAt, time);
  } finally { await app.close(); }
});

test('application registers Dot endpoint and disabled intake performs no SQL transaction', async () => {
  const { buildApp } = await import('../apps/api/src/app.ts');
  const { sql, closeDb } = await import('../packages/backend/src/db.ts');
  const original = sql.begin; const saved = process.env.DOT_INGEST_ENABLED;
  let transactions = 0;
  sql.begin = (() => { transactions++; throw new Error('unexpected DB transaction'); }) as typeof sql.begin;
  delete process.env.DOT_INGEST_ENABLED;
  const app = await buildApp();
  try {
    const res = await app.inject({ method: 'POST', url: '/api/ingest/dot', payload: payload(), headers: { authorization: `Bearer ${token}` } });
    assert.equal(res.statusCode, 503); assert.deepEqual(res.json(), { ok: false, error: 'dot_ingest_disabled' }); assert.equal(transactions, 0);
  } finally { await app.close(); sql.begin = original; if (saved === undefined) delete process.env.DOT_INGEST_ENABLED; else process.env.DOT_INGEST_ENABLED = saved; await closeDb(); }
});


test('every persisted string rejects NUL and lone high/low surrogates before repository access', async () => {
  const { repo, app, post } = setup();
  // Literal/enum strings also appear in storage; their fixed values reject these probes.
  const fields: { name: string; mutate: (p: DotDelivery, bad: string) => void }[] = [
    { name: 'schemaVersion', mutate: (p, bad) => { p.schemaVersion = `${p.schemaVersion}${bad}` as never; } },
    { name: 'deliveryId', mutate: (p, bad) => { p.deliveryId += bad; } },
    { name: 'itemId', mutate: (p, bad) => { p.items[1].itemId += bad; } },
    { name: 'title', mutate: (p, bad) => { p.items[1].title += bad; } },
    { name: 'summary', mutate: (p, bad) => { p.items[1].summary += bad; } },
    { name: 'pillar', mutate: (p, bad) => { p.items[1].pillars[0] = `changes${bad}` as never; } },
    { name: 'assertionKind', mutate: (p, bad) => { p.items[1].assertionKind = `reported${bad}` as never; } },
    { name: 'url', mutate: (p, bad) => { p.items[1].sources[0].url += bad; } },
    { name: 'publisher', mutate: (p, bad) => { p.items[1].sources[0].publisher += bad; } },
    { name: 'publishedAt', mutate: (p, bad) => { p.items[1].sources[0].publishedAt += bad; } },
    { name: 'dotObservedAt', mutate: (p, bad) => { p.items[1].dotObservedAt += bad; } },
  ];
  try {
    for (const bad of ['\u0000', '\ud800', '\udc00']) {
      for (const field of fields) {
        const p = payload();
        p.items.push(structuredClone({ ...p.items[0], itemId: 'item-2' }));
        field.mutate(p, bad);
        const res = await post(p);
        assert.equal(res.statusCode, 400, `${field.name}: ${JSON.stringify(bad)}`);
        assert.deepEqual(res.json(), { ok: false, error: 'invalid_delivery' });
        assert.equal(repo.calls, 0, field.name);
      }
    }
    assert.equal(repo.rows.size, 0);
  } finally { await app.close(); }
});

test('well-formed emoji survive validation and persistence as exact original text', async () => {
  const { repo, app, post } = setup();
  try {
    const p = payload();
    p.items[0].title = 'Insurance 🌍';
    p.items[0].summary = 'Dot-original summary 🛡️';
    p.items[0].sources[0].publisher = 'Example publisher 😀';
    p.items[0].sources[0].url = 'https://example.org/report/😀';
    const res = await post(p);
    assert.equal(res.statusCode, 200);
    assert.equal(repo.calls, 1);
    assert.deepEqual(repo.rows.get(p.deliveryId)!.payload, p);
  } finally { await app.close(); }
});
