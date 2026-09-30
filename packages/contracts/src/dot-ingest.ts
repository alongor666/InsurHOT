/** Private intake only. Dot is a declared processing producer, never primary evidence. */
export const DOT_SCHEMA_VERSION = 'insurhot.dot.v1' as const;
export const DOT_MAX_ITEMS = 50;
export const DOT_BODY_LIMIT = 256 * 1024;
export interface DotSource { url: string; publisher: string; publishedAt: string | null }
export interface DotItem {
  itemId: string;
  title: string;
  /** Dot-original summary; not an article body or snapshot. */
  summary: string;
  pillars: ('matters' | 'changes' | 'emerges')[];
  assertionKind: 'reported' | 'inference';
  sources: DotSource[];
  dotObservedAt: string;
}
export interface DotDelivery { schemaVersion: typeof DOT_SCHEMA_VERSION; deliveryId: string; items: DotItem[] }
export interface DotReceipt {
  ok: true;
  schemaVersion: typeof DOT_SCHEMA_VERSION;
  deliveryId: string;
  producer: 'dot';
  status: 'received' | 'duplicate';
  receivedAt: string;
  firstSeenAt: string;
  itemCount: number;
}
