import type { DotDelivery } from '@aihot/contracts/dot-ingest';
import { sql } from '../db.ts';
import { DotIntakeError, type DotRepository, type DotStoredReceipt } from './dot.ts';

/** No materials, fetches, model jobs or publication side effects. */
export class PostgresDotRepository implements DotRepository {
  async receive(payload: DotDelivery, hash: string, receivedAt: Date): Promise<DotStoredReceipt> {
    return sql.begin(async (tx) => {
      // Concurrent retries wait on the unique key; the following SELECT sees the committed winner.
      const inserted = await tx`
        INSERT INTO dot_deliveries (producer, delivery_id, schema_version, payload_hash, received_at, first_seen_at, item_count)
        VALUES ('dot', ${payload.deliveryId}, ${payload.schemaVersion}, ${hash}, ${receivedAt}, ${receivedAt}, ${payload.items.length})
        ON CONFLICT (producer, delivery_id) DO NOTHING RETURNING delivery_id`;
      const [row] = await tx<{ payload_hash: string; received_at: Date; first_seen_at: Date; item_count: number }[]>`
        SELECT payload_hash, received_at, first_seen_at, item_count FROM dot_deliveries
        WHERE producer = 'dot' AND delivery_id = ${payload.deliveryId}`;
      if (!row || row.payload_hash !== hash) throw new DotIntakeError(409, 'delivery_conflict');
      if (inserted.length) {
        for (const entry of payload.items) {
          await tx`
            INSERT INTO dot_items (producer, delivery_id, item_id, title, summary, pillars, assertion_kind, original_sources, dot_observed_at, received_at, first_seen_at)
            VALUES ('dot', ${payload.deliveryId}, ${entry.itemId}, ${entry.title}, ${entry.summary}, ${entry.pillars}, ${entry.assertionKind},
              ${tx.json(entry.sources.map((source) => ({ url: source.url, publisher: source.publisher, publishedAt: source.publishedAt })))}, ${entry.dotObservedAt}, ${receivedAt}, ${receivedAt})`;
        }
      }
      return { receivedAt: row.received_at.toISOString(), firstSeenAt: row.first_seen_at.toISOString(), itemCount: row.item_count, duplicate: !inserted.length };
    }) as Promise<DotStoredReceipt>;
  }
}
