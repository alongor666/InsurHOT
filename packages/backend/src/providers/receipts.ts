// Paid requests (models, SocialData, Jina, Dajiala) go through here.
//
// 1. A logical request has a stable key bound to task, input revision, provider, model, prompt and config.
// 2. Before calling, a placeholder row and an attempt row are persisted; budgets count attempts, and
//    the attempt's worst-case cost is reserved against the monthly limits (money.ts, ADR-015).
// 3. The raw response is saved before any business write; recovery reuses a received response.
// 4. A request whose outcome is unknown (timeout after sending, crash mid-flight) is not re-sent by the
//    caller. ops.recover releases it once after 30 minutes (admin/runs.ts), so a lost answer costs at
//    most one repeat; after that it waits for the admin. Its money stays reserved either way.
//
// Lock order (money.ts): the per-service lock, the receipt row, the money calls, and only then writes
// to an existing attempt row. Every transaction below that touches a receipt starts at its row.
import { assertPaidOutboundDisabled } from "../outbound-policy.ts";
import { sql, type Db } from "../db.ts";
import { sha256, stableJson } from "../lib/ids.ts";
import { approvedPrice, capabilityFor, modelCapabilities, reserveMoney, settleMoney, type ApprovedPrice, type Settlement } from "./money.ts";

export class BudgetExceededError extends Error {
  readonly service: string;
  readonly retryAfterSeconds: number;
  constructor(service: string, window: string, retryAfterSeconds: number) {
    super(`Budget for ${service} exhausted (${window})`);
    this.service = service;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ReceiptBusyError extends Error {}

export class ReceiptUnknownError extends Error {
  readonly receiptId: number;
  constructor(receiptId: number, message: string) {
    super(message);
    this.receiptId = receiptId;
  }
}

/** What a rejection says about money, beyond its HTTP status. */
export interface RejectionBilling {
  /** The provider's own result code, when the refusal came in a 200 body rather than as an HTTP status. */
  providerCode?: number;
  /** The request demonstrably was not processed (never sent, or a code the provider does not bill). */
  notBilled?: boolean;
  /** What the provider itself says it charged for the refused request. */
  cost?: { amount: number; currency: string };
}

/** Raised by a call when the provider did not accept the request. Whether it may still have billed is a separate matter (settlementForError). */
export class ProviderRejectedError extends Error {
  /** The HTTP status or, for a refusal inside a 200 body, the provider's code (kept for the callers that read it). */
  readonly status: number | null;
  readonly retryable: boolean;
  readonly httpStatus: number | null;
  readonly providerCode: number | null;
  readonly notBilled: boolean;
  readonly cost: { amount: number; currency: string } | null;
  constructor(message: string, status: number | null, retryable: boolean, billing: RejectionBilling = {}) {
    super(message);
    this.status = status;
    this.retryable = retryable;
    this.providerCode = billing.providerCode ?? null;
    this.httpStatus = billing.providerCode === undefined ? status : null;
    this.notBilled = billing.notBilled ?? false;
    this.cost = billing.cost ?? null;
  }
}

export interface CallOutcome {
  response: unknown;
  requestId?: string | null;
  usage?: Record<string, unknown> | null;
  /** A figure the provider itself reported for this request. Computed costs come from MoneySpec.actualCost instead. */
  cost?: { amount: number; currency: string; basis: "actual" | "estimated" } | null;
}

/** What a paid request needs to be priced: which approved row, where it goes, and its bounds. */
export interface MoneySpec {
  /** service_prices.model of the row: the model, or the endpoint name of a service without models. */
  priceKey: string;
  /** Where the request is sent; its host must be the price row's. */
  baseUrl: string;
  /** The most this request can cost at the approved row (one of money.ts's bounds). Throws to refuse. */
  worstCase: (price: ApprovedPrice) => number;
  /** What it did cost, from the provider's usage; null when that cannot be told (the reservation then stays). */
  actualCost?: (price: ApprovedPrice, outcome: CallOutcome) => number | null;
}

export interface ReceiptRequest {
  service: string;
  model?: string | null;
  purpose: string;
  subject?: string | null;
  /** Everything that determines the output. Hashed into the logical key; only a redacted summary is stored. */
  identity: unknown;
  /** Stored for diagnosis; must not contain secrets. */
  requestSummary?: Record<string, unknown>;
  /** Distinguishes an explicit re-run (e.g. admin "re-evaluate") from recovery of the same request. */
  attemptTag?: string;
  money: MoneySpec;
}

export interface ReceiptResult {
  receiptId: number;
  response: unknown;
  reused: boolean;
}

const PENDING_STALE_MS = 10 * 60 * 1000;

export function logicalKeyFor(req: ReceiptRequest): string {
  const identity = sha256(stableJson(req.identity));
  return [req.service, req.purpose, req.model ?? "-", identity, req.attemptTag ?? "0"].join(":");
}

interface ReceiptRow {
  id: number;
  status: string;
  response: unknown;
  created_at: Date;
  updated_at: Date;
}

export async function checkBudget(tx: Db, service: string): Promise<void> {
  const [budget] = await tx<{ per_minute: number; per_hour: number; per_day: number }[]>`
    SELECT per_minute, per_hour, per_day FROM budgets WHERE service = ${service}`;
  if (!budget) throw new BudgetExceededError(service, "missing budget", 3600);
  // Every request sent counts, retries of the same logical request included.
  const [counts] = await tx<{ minute: number; hour: number; day: number }[]>`
    SELECT
      count(*) FILTER (WHERE started_at > now() - interval '1 minute') AS minute,
      count(*) FILTER (WHERE started_at > now() - interval '1 hour') AS hour,
      count(*) AS day
    FROM receipt_attempts
    WHERE service = ${service} AND origin = 'live' AND started_at > now() - interval '1 day'`;
  const c = counts!;
  if (budget.per_minute <= 0 || budget.per_hour <= 0 || budget.per_day <= 0) {
    throw new BudgetExceededError(service, "stopped", 3600);
  }
  if (c.minute >= budget.per_minute) throw new BudgetExceededError(service, "minute", 60);
  if (c.hour >= budget.per_hour) throw new BudgetExceededError(service, "hour", 600);
  if (c.day >= budget.per_day) throw new BudgetExceededError(service, "day", 3600);
}

export type PaidClaim =
  | { kind: "reuse" | "busy" | "unknown"; row: ReceiptRow }
  /** The request may be sent: its attempt exists and its worst case is reserved on `price`. */
  | { kind: "call"; id: number; attemptId: number; attempt: number; price: ApprovedPrice };

/**
 * Step 1, bookkeeping only: decides whether the logical request is to be sent and, if so, records the
 * attempt and reserves its worst case. A refusal (count budget, missing price or limit, used-up month)
 * rolls the whole step back, so a refused request leaves no receipt or attempt behind.
 */
export async function claimPaidRequest(req: ReceiptRequest): Promise<PaidClaim> {
  const logicalKey = logicalKeyFor(req);
  const purposes = await modelCapabilities();
  return sql.begin(async (tx): Promise<PaidClaim> => {
    // Serialise budget checks per service so concurrent workers cannot overshoot.
    await tx`SELECT pg_advisory_xact_lock(hashtext(${"budget:" + req.service}))`;
    const [existing] = await tx<ReceiptRow[]>`
      SELECT id, status, response, created_at, updated_at FROM receipts WHERE logical_key = ${logicalKey} FOR UPDATE`;
    if (existing) {
      if (existing.status === "received" || existing.status === "completed") return { kind: "reuse", row: existing };
      if (existing.status === "pending") {
        if (Date.now() - existing.updated_at.getTime() < PENDING_STALE_MS) return { kind: "busy", row: existing };
        await markUnknown(tx, existing.id, "placeholder went stale without a recorded result");
        return { kind: "unknown", row: existing };
      }
      if (existing.status === "unknown") return { kind: "unknown", row: existing };
    }
    // A new request, or one that failed (the provider did not take it, or its answer was unusable): a new attempt is allowed.
    // The count budget speaks first, as it always did: a full window is a reason to wait, a missing price is not.
    await checkBudget(tx, req.service);
    const price = await approvedPrice(tx, req.service, req.money.priceKey, req.money.baseUrl);
    const amount = req.money.worstCase(price);
    const capability = capabilityFor(req.service, req.purpose, purposes);
    let id: number;
    let attempt: number;
    if (existing) {
      const [r] = await tx<{ attempts: number }[]>`
        UPDATE receipts SET status = 'pending', attempts = attempts + 1, error = NULL, updated_at = now() WHERE id = ${existing.id} RETURNING attempts`;
      id = existing.id;
      attempt = r!.attempts;
    } else {
      const [row] = await tx<{ id: number }[]>`
        INSERT INTO receipts (logical_key, service, model, purpose, subject, status, request, attempts)
        VALUES (${logicalKey}, ${req.service}, ${req.model ?? null}, ${req.purpose}, ${req.subject ?? null}, 'pending',
                ${tx.json((req.requestSummary ?? {}) as never)}, 1)
        RETURNING id`;
      id = row!.id;
      attempt = 1;
    }
    const attemptId = await startAttempt(tx, id, attempt, req);
    await reserveMoney(tx, attemptId, { price, capability, subject: req.subject, amount });
    return { kind: "call", id, attemptId, attempt, price };
  }) as Promise<PaidClaim>;
}

/** HTTP statuses that say the request was refused before any work was done (ADR-015, owner input 7 confirms the list). */
const NOT_BILLED_HTTP = new Set([401, 402, 403, 429]);

/**
 * What a failed call means for the attempt's money. Only a refusal that shows the request was not
 * processed gives it back; a 400, 422 or 5xx, a timeout or a dropped connection may have been billed.
 * A figure the provider reported with the refusal counts first.
 */
export function settlementForError(error: unknown): Settlement {
  if (!(error instanceof ProviderRejectedError)) return { kind: "hold" };
  if (error.cost) return { kind: "actual", amount: error.cost.amount, currency: error.cost.currency };
  if (error.notBilled || (error.httpStatus !== null && NOT_BILLED_HTTP.has(error.httpStatus))) return { kind: "release" };
  return { kind: "hold" };
}

/** What a received answer means for the attempt's money: the provider's own figure, else the cost computed from its usage, else the reservation. */
export function settlementForOutcome(money: MoneySpec, price: ApprovedPrice, outcome: CallOutcome): { settlement: Settlement; basis: "actual" | "estimated" | null } {
  if (outcome.cost && outcome.cost.basis === "actual") return { settlement: { kind: "actual", amount: outcome.cost.amount, currency: outcome.cost.currency }, basis: "actual" };
  const computed = money.actualCost?.(price, outcome) ?? null;
  if (computed !== null) return { settlement: { kind: "actual", amount: computed, currency: price.currency }, basis: "estimated" };
  return { settlement: { kind: "hold" }, basis: null };
}

type CallClaim = Extract<PaidClaim, { kind: "call" }>;

/** The receipt row, locked: every transaction on a receipt starts here (lock order, money.ts). */
const lockReceipt = (tx: Db, id: number) => tx<{ status: string; attempts: number }[]>`SELECT status, attempts FROM receipts WHERE id = ${id} FOR UPDATE`;

/**
 * Step 3 after a failed call, bookkeeping only: settles the money, then records the failure. The
 * attempt always gets its outcome; the receipt only while it still waits on this very attempt, so a
 * failure that arrives late (the receipt went unknown, or a newer attempt is under way) cannot reopen it.
 */
export async function failPaidAttempt(claim: CallClaim, error: unknown, latencyMs: number): Promise<void> {
  const status = error instanceof ProviderRejectedError ? "failed" : "unknown";
  // "unknown": the request may have reached the provider (timeout, reset): do not re-send automatically.
  const message = (error instanceof ProviderRejectedError ? error.message : String(error)).slice(0, 2000);
  await sql.begin(async (tx) => {
    const [receipt] = await lockReceipt(tx, claim.id);
    const settled = await settleMoney(tx, claim.attemptId, settlementForError(error));
    if (receipt && receipt.status === "pending" && receipt.attempts === claim.attempt) {
      await tx`UPDATE receipts SET status = ${status}, error = ${message}, updated_at = now() WHERE id = ${claim.id}`;
    }
    await tx`
      UPDATE receipt_attempts SET status = ${status}, error = ${message}, latency_ms = ${latencyMs}, finished_at = now(),
        cost = ${settled.figure}, currency = ${settled.figure === null ? null : claim.price.currency}, cost_basis = ${settled.figure === null ? null : "actual"}
      WHERE id = ${claim.attemptId}`;
  });
}

/**
 * Step 3 after an answer, bookkeeping only: settles the money, then stores the raw response. The cost
 * written is the figure the ledger took, not one it refused. The receipt takes the answer while it
 * still waits on this attempt, also when it had gone unknown meanwhile; once a newer attempt is under
 * way only the attempt row records it.
 */
export async function settlePaidAttempt(req: ReceiptRequest, claim: CallClaim, outcome: CallOutcome, latencyMs: number): Promise<{ overrun: boolean; priceSuspended: boolean }> {
  const { settlement, basis } = settlementForOutcome(req.money, claim.price, outcome);
  return sql.begin(async (tx) => {
    const [receipt] = await lockReceipt(tx, claim.id);
    const settled = await settleMoney(tx, claim.attemptId, settlement);
    const cost = settled.figure === null ? null : { amount: settled.figure, currency: claim.price.currency, basis };
    if (receipt && (receipt.status === "pending" || receipt.status === "unknown") && receipt.attempts === claim.attempt) await tx`
      UPDATE receipts SET
        status = 'received',
        response = ${tx.json((outcome.response ?? null) as never)},
        request_id = ${outcome.requestId ?? null},
        usage = ${outcome.usage ? tx.json(outcome.usage as never) : null},
        cost = ${cost?.amount ?? null},
        currency = ${cost?.currency ?? null},
        cost_basis = ${cost?.basis ?? null},
        error = NULL,
        received_at = now(),
        updated_at = now()
      WHERE id = ${claim.id}`;
    await tx`
      UPDATE receipt_attempts SET
        status = 'received', request_id = ${outcome.requestId ?? null}, usage = ${outcome.usage ? tx.json(outcome.usage as never) : null},
        cost = ${cost?.amount ?? null}, currency = ${cost?.currency ?? null}, cost_basis = ${cost?.basis ?? null},
        latency_ms = ${latencyMs}, finished_at = now()
      WHERE id = ${claim.attemptId}`;
    return { overrun: settled.overrun, priceSuspended: settled.priceSuspended };
  }) as Promise<{ overrun: boolean; priceSuspended: boolean }>;
}

/**
 * Runs a paid request at most once per logical key and returns its raw response.
 * The caller parses the response and commits business results, then calls completeReceipt.
 */
export async function paidRequest(req: ReceiptRequest, call: () => Promise<CallOutcome>): Promise<ReceiptResult> {
  assertPaidOutboundDisabled();
  const claimed = await claimPaidRequest(req);

  if (claimed.kind !== "call") {
    if (claimed.kind === "reuse") return { receiptId: claimed.row.id, response: claimed.row.response, reused: true };
    if (claimed.kind === "busy") throw new ReceiptBusyError(`Receipt ${claimed.row.id} is in flight`);
    throw new ReceiptUnknownError(claimed.row.id, `Receipt ${claimed.row.id} has an unknown outcome; it is released once automatically, then from the admin`);
  }

  const started = Date.now();
  let outcome: CallOutcome;
  try {
    outcome = await call();
  } catch (error) {
    await failPaidAttempt(claimed, error, Date.now() - started);
    throw error;
  }
  const money = await settlePaidAttempt(req, claimed, outcome, Date.now() - started);
  if (money.overrun) {
    // The bound was too low for this price row: it is suspended now (or gone), and the operators must hear of it.
    console.error(JSON.stringify({ level: "error", msg: "paid request cost more than its reservation", receipt: claimed.id, attempt: claimed.attemptId,
      service: claimed.price.service, price: claimed.price.key, priceSuspended: money.priceSuspended }));
  }
  return { receiptId: claimed.id, response: outcome.response, reused: false };
}

async function startAttempt(tx: Db, receiptId: number, attempt: number, req: ReceiptRequest): Promise<number> {
  const [row] = await tx<{ id: number }[]>`
    INSERT INTO receipt_attempts (receipt_id, attempt, service, model, status) VALUES (${receiptId}, ${attempt}, ${req.service}, ${req.model ?? null}, 'pending')
    RETURNING id`;
  return row!.id;
}

// Marking an outcome unknown changes no money: the attempt keeps holding its reservation.
async function markUnknown(tx: Db, receiptId: number, reason: string) {
  await tx`UPDATE receipts SET status = 'unknown', error = ${reason}, updated_at = now() WHERE id = ${receiptId}`;
  await tx`UPDATE receipt_attempts SET status = 'unknown', error = ${reason}, finished_at = now() WHERE receipt_id = ${receiptId} AND status = 'pending'`;
}

/**
 * Placeholders left behind by a process that stopped mid-request (crash, kill) become "unknown", so
 * they are released like any other unknown outcome even when nothing retries them.
 */
export async function markStalePendingReceipts(): Promise<number> {
  const stale = await sql<{ id: number }[]>`SELECT id FROM receipts WHERE status = 'pending' AND updated_at < ${new Date(Date.now() - PENDING_STALE_MS)}`;
  for (const r of stale) await sql.begin((tx) => markUnknown(tx, r.id, "placeholder went stale without a recorded result"));
  return stale.length;
}

export async function completeReceipt(db: Db, receiptId: number): Promise<void> {
  await db`UPDATE receipts SET status = 'completed', completed_at = coalesce(completed_at, now()), updated_at = now() WHERE id = ${receiptId}`;
}

/** Marks a received response that could not be used (e.g. unparsable) so a fresh attempt can be made. Its money stays counted: the provider answered and billed. */
export async function rejectReceivedResponse(receiptId: number, reason: string): Promise<void> {
  await sql`UPDATE receipts SET status = 'failed', error = ${reason.slice(0, 2000)}, updated_at = now() WHERE id = ${receiptId}`;
}
