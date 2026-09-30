// Dot intake on real PostgreSQL (migration 0039): what tests/dot-ingest.test.ts can only fake. One
// delivery is one atomic batch; a repeat returns the first receipt and stores nothing; changed content
// under the same id conflicts; simultaneous first deliveries produce one winner; a failing item rolls
// the whole batch back; rows default to private / unknown rights / unverified.
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import type { DotDelivery } from "@aihot/contracts/dot-ingest";
import { DotIntakeError, DotIntakeService, dotPayloadHash } from "@aihot/backend/ingest/dot";
import { PostgresDotRepository } from "@aihot/backend/ingest/dot-repository";

const RUN = tag();
after(async () => {
  await sql`DELETE FROM dot_deliveries WHERE delivery_id LIKE ${`pg-${RUN}-%`}`;
  await closeDb();
});

function delivery(name: string, items = 2): DotDelivery {
  return {
    schemaVersion: "insurhot.dot.v1", deliveryId: `pg-${RUN}-${name}`,
    items: Array.from({ length: items }, (_, n) => ({
      itemId: `item-${n}`, title: `Insurance change ${n}`, summary: `Summary ${n} 保险 😀`, pillars: ["changes"], assertionKind: "reported",
      sources: [{ url: `https://example.org/report/${n}`, publisher: "Example source", publishedAt: n % 2 ? null : "2020-01-01T00:00:00Z" }],
      dotObservedAt: "2026-09-29T08:00:00Z",
    })),
  } as DotDelivery;
}
const counts = async (id: string) => {
  const [row] = await sql<{ deliveries: number; items: number }[]>`
    SELECT (SELECT count(*) FROM dot_deliveries WHERE delivery_id = ${id})::int AS deliveries,
           (SELECT count(*) FROM dot_items WHERE delivery_id = ${id})::int AS items`;
  return row!;
};
/** The same value with every object's keys in reverse order (arrays keep their order). */
const reverseKeys = (v: unknown): unknown => Array.isArray(v) ? v.map(reverseKeys)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverseKeys(x)])) : v;
const repo = new PostgresDotRepository();
const at = (iso: string) => new DotIntakeService(repo, () => new Date(iso));

test("a delivery is stored once with its items; a repeat returns the first receipt and writes nothing", async () => {
  const body = delivery("once", 3);
  const first = await at("2026-09-30T09:00:00.000Z").receive(body);
  assert.deepEqual([first.status, first.itemCount, first.receivedAt, first.firstSeenAt], ["received", 3, "2026-09-30T09:00:00.000Z", "2026-09-30T09:00:00.000Z"]);
  assert.deepEqual(await counts(body.deliveryId), { deliveries: 1, items: 3 });

  // Same content with keys in another order, an hour later: the first observation stands.
  const reordered = reverseKeys(body);
  const again = await at("2026-09-30T10:00:00.000Z").receive(reordered);
  assert.deepEqual([again.status, again.itemCount, again.receivedAt, again.firstSeenAt], ["duplicate", 3, "2026-09-30T09:00:00.000Z", "2026-09-30T09:00:00.000Z"]);
  assert.deepEqual(await counts(body.deliveryId), { deliveries: 1, items: 3 });

  const [item] = await sql<{ rights_status: string; publication_status: string; evidence_status: string; summary: string; original_sources: { publishedAt: string | null }[]; received_at: Date; dot_observed_at: Date }[]>`
    SELECT rights_status, publication_status, evidence_status, summary, original_sources, received_at, dot_observed_at
    FROM dot_items WHERE delivery_id = ${body.deliveryId} AND item_id = 'item-1'`;
  assert.deepEqual([item!.rights_status, item!.publication_status, item!.evidence_status], ["unknown", "private", "unverified"]);
  assert.equal(item!.summary, "Summary 1 保险 😀");
  assert.equal(item!.original_sources[0]!.publishedAt, null);
  assert.equal(item!.received_at.toISOString(), "2026-09-30T09:00:00.000Z");
  assert.equal(item!.dot_observed_at.toISOString(), "2026-09-29T08:00:00.000Z", "Dot's own time is kept apart from the server's");
});

test("changed content under a stored delivery id is a conflict and leaves the stored batch untouched", async () => {
  const body = delivery("conflict");
  await at("2026-09-30T09:00:00.000Z").receive(body);
  const changed = structuredClone(body); changed.items[0]!.summary = "Different text";
  await assert.rejects(at("2026-09-30T09:05:00.000Z").receive(changed), (e) => e instanceof DotIntakeError && e.status === 409 && e.code === "delivery_conflict");
  const [row] = await sql<{ summary: string; payload_hash: string }[]>`
    SELECT i.summary, d.payload_hash FROM dot_items i JOIN dot_deliveries d USING (producer, delivery_id)
    WHERE i.delivery_id = ${body.deliveryId} AND i.item_id = 'item-0'`;
  assert.equal(row!.summary, "Summary 0 保险 😀");
  assert.equal(row!.payload_hash, dotPayloadHash(body));
});

test("simultaneous first deliveries of one id store one batch; every caller gets the same first receipt", async () => {
  const body = delivery("race", 5);
  const receipts = await Promise.all(Array.from({ length: 8 }, (_, n) => at(`2026-09-30T09:00:0${n}.000Z`).receive(structuredClone(body))));
  assert.equal(receipts.filter((r) => r.status === "received").length, 1);
  assert.equal(receipts.filter((r) => r.status === "duplicate").length, 7);
  assert.equal(new Set(receipts.map((r) => r.firstSeenAt)).size, 1, "one first observation, whoever asks");
  assert.deepEqual(await counts(body.deliveryId), { deliveries: 1, items: 5 });
});

test("simultaneous deliveries of one id with different content: one is stored, the others conflict", async () => {
  const bodies = Array.from({ length: 6 }, (_, n) => { const b = delivery("race-conflict"); b.items[0]!.title = `Variant ${n}`; return b; });
  const results = await Promise.allSettled(bodies.map((b, n) => at(`2026-09-30T09:00:0${n}.000Z`).receive(b)));
  const stored = results.filter((r) => r.status === "fulfilled");
  assert.equal(stored.length, 1);
  for (const r of results) if (r.status === "rejected") assert.ok(r.reason instanceof DotIntakeError && r.reason.status === 409, String(r.reason));
  assert.deepEqual(await counts(bodies[0]!.deliveryId), { deliveries: 1, items: 2 });
});

test("a batch whose item the database refuses is rolled back whole", async () => {
  const body = delivery("atomic", 3);
  // Past the parser on purpose: the repository itself must not leave a delivery row or earlier items behind.
  const broken = structuredClone(body); (broken.items[2] as { assertionKind: string }).assertionKind = "fact_primary";
  await assert.rejects(repo.receive(broken, dotPayloadHash(broken), new Date("2026-09-30T09:00:00.000Z")), /dot_items_assertion_kind_check|violates check constraint/);
  assert.deepEqual(await counts(body.deliveryId), { deliveries: 0, items: 0 });
  // The same id is still free for the corrected batch.
  assert.equal((await at("2026-09-30T09:01:00.000Z").receive(body)).status, "received");
});

test("deleting a delivery removes its items; the intake tables reference nothing outside themselves", async () => {
  const body = delivery("cascade");
  await at("2026-09-30T09:00:00.000Z").receive(body);
  await sql`DELETE FROM dot_deliveries WHERE delivery_id = ${body.deliveryId}`;
  assert.deepEqual(await counts(body.deliveryId), { deliveries: 0, items: 0 });
  const foreign = await sql<{ target: string }[]>`
    SELECT confrelid::regclass::text AS target FROM pg_constraint
    WHERE contype = 'f' AND conrelid IN ('dot_deliveries'::regclass, 'dot_items'::regclass)`;
  assert.deepEqual(foreign.map((f) => f.target), ["dot_deliveries"]);
});
