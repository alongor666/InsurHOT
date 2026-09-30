import { createHash } from 'node:crypto';
import { z } from 'zod';
import { DOT_MAX_ITEMS, DOT_SCHEMA_VERSION, type DotDelivery, type DotReceipt } from '@aihot/contracts/dot-ingest';

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/);
const text = (max: number) => z.string().min(1).max(max).refine((v) => v.trim().length > 0);
const timestamp = z.iso.datetime({ offset: true });
const source = z.strictObject({
  url: z.string().max(2048).refine((value) => {
    try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password; }
    catch { return false; }
  }),
  publisher: text(200), publishedAt: timestamp.nullable(),
});
const item = z.strictObject({
  itemId: id, title: text(500), summary: text(4000),
  pillars: z.array(z.enum(['matters', 'changes', 'emerges'])).min(1).max(3).refine((v) => new Set(v).size === v.length),
  assertionKind: z.enum(['reported', 'inference']), sources: z.array(source).min(1).max(10), dotObservedAt: timestamp,
});
const delivery = z.strictObject({ schemaVersion: z.literal(DOT_SCHEMA_VERSION), deliveryId: id, items: z.array(item).min(1).max(DOT_MAX_ITEMS) })
  .refine((v) => new Set(v.items.map((i) => i.itemId)).size === v.items.length);

export class DotIntakeError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}
export function parseDotDelivery(body: unknown): DotDelivery {
  const result = delivery.safeParse(body);
  if (!result.success) throw new DotIntakeError(400, 'invalid_delivery');
  return result.data;
}
/** Sort object keys recursively; array order and exact text remain significant. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value) as string;
}
export function dotPayloadHash(payload: DotDelivery): string { return createHash('sha256').update(canonical(payload)).digest('hex'); }
export interface DotStoredReceipt { receivedAt: string; firstSeenAt: string; itemCount: number; duplicate: boolean }
export interface DotRepository {
  /** Must atomically persist the entire batch, or throw; conflicting hash throws 409. */
  receive(payload: DotDelivery, hash: string, receivedAt: Date): Promise<DotStoredReceipt>;
}
export class DotIntakeService {
  private readonly repository: DotRepository;
  private readonly clock: () => Date;
  constructor(repository: DotRepository, clock: () => Date = () => new Date()) { this.repository = repository; this.clock = clock; }
  async receive(body: unknown): Promise<DotReceipt> {
    const payload = parseDotDelivery(body);
    const stored = await this.repository.receive(payload, dotPayloadHash(payload), this.clock());
    return { ok: true, schemaVersion: DOT_SCHEMA_VERSION, deliveryId: payload.deliveryId, producer: 'dot',
      status: stored.duplicate ? 'duplicate' : 'received', receivedAt: stored.receivedAt, firstSeenAt: stored.firstSeenAt, itemCount: stored.itemCount };
  }
}
