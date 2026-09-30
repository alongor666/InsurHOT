// Explicit opt-in at the I/O boundary. Flags are read for each attempt, including queued/manual work.
export const OUTBOUND_FLAGS = {
  collect: "COLLECT_ENABLED",
  model: "MODEL_CALLS_ENABLED",
  embeddings: "EMBEDDINGS_ENABLED",
  feishuInternal: "FEISHU_INTERNAL_ENABLED",
  feishuContent: "FEISHU_CONTENT_PUSH_ENABLED",
  feishuAuth: "FEISHU_AUTH_ENABLED",
  indexNow: "INDEXNOW_SUBMIT_ENABLED",
  media: "MEDIA_FETCH_ENABLED",
} as const;
export type OutboundPurpose = keyof typeof OUTBOUND_FLAGS;

/** Only the literal true is authorization; unset, empty, 1, case variants and invalid values deny. */
export function explicitlyEnabled(name: string): boolean {
  return process.env[name] === "true";
}

export class OutboundDisabledError extends Error {}
export class PaidOutboundDisabledError extends OutboundDisabledError {}

export function assertOutboundEnabled(purpose: OutboundPurpose): void {
  const name = OUTBOUND_FLAGS[purpose];
  if (!explicitlyEnabled(name)) throw new OutboundDisabledError(`Outbound ${purpose} disabled: ${name}=true required`);
}

/** No environment bypass: count budgets cannot authorize spending before M0.3b monetary controls. */
export function assertPaidOutboundDisabled(): void {
  throw new PaidOutboundDisabledError("Paid outbound disabled until M0.3b monetary hard limits, approved prices and atomic reservations are implemented");
}

/** Used by direct HTTP integrations, immediately before their actual network call. */
export async function outboundFetch(purpose: OutboundPurpose, input: string | URL, init?: RequestInit): Promise<Response> {
  assertOutboundEnabled(purpose);
  if (purpose === "model" || purpose === "embeddings") assertPaidOutboundDisabled();
  // Fixed integration endpoints do not need redirects; forbid automatic follow and caller overrides.
  return fetch(input, { ...init, redirect: "error" });
}
