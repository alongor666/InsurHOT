// Monetary hard limits for paid requests (ADR-015, docs/adr/015-monetary-budget-hard-limits.md).
//
// 1. Only an approved, unsuspended price bound to the provider host lets a request through.
// 2. Before the call its worst-case cost is reserved against every applicable monthly limit: global,
//    capability and, for model steps, each subject. A missing or unapproved row refuses.
// 3. After the call the reservation is settled: the actual cost, or the reservation kept whenever the
//    provider may have billed. Only a request that clearly was not taken gives its money back.
// 4. Usage lives in ledger rows changed by relative increments in the same transaction as the attempt.
//
// Lock order, the same for reserving and settling: the global money lock, then the attempt row, then
// the ledger rows in one fixed order. Two rules follow for every transaction that calls in here:
//   - a per-service budget lock (receipts.ts) is taken before the first call, never after one;
//   - an existing receipt_attempts row is written only after the money calls, or after lockMoney(tx)
//     has been taken first. A transaction that updates an attempt and then settles it waits for the
//     global lock while holding the row, and deadlocks with one that holds the lock and wants the row.
//
// Nothing here opens the paid lock (outbound-policy.ts): with empty tables everything is refused.
import { sql, type Db } from "../db.ts";

export type Currency = "CNY" | "USD";

/** A paid request that may not be sent until the owner changes prices or limits. Waiting does not help. */
export class MoneyRefusedError extends Error {
  readonly reason: string;
  constructor(reason: string, detail: string) {
    // translate.ts stops a run on messages that mention the budget.
    super(`Paid budget refusal (${reason}): ${detail}`);
    this.reason = reason;
  }
}

/** A monthly limit is used up. Not a BudgetExceededError: callers must not sleep or reschedule until it passes. */
export class MonthlyBudgetExhaustedError extends MoneyRefusedError {
  readonly scope: string;
  readonly key: string;
  constructor(scope: string, key: string, currency: Currency, month: string) {
    super("monthly_limit", `${scope}${key ? `:${key}` : ""} ${currency} limit for ${month.slice(0, 7)} is used up`);
    this.scope = scope;
    this.key = key;
  }
}

// ---------------------------------------------------------------------------------------------------
// Budget month

/** Owner input 5 of the ADR; until it is approved the proposed zone is used. */
export const BUDGET_TIME_ZONE = "Asia/Shanghai";

/** First day (YYYY-MM-01) of the budget month the instant falls in. */
export function budgetMonth(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: BUDGET_TIME_ZONE, year: "numeric", month: "2-digit" }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-01`;
}

// ---------------------------------------------------------------------------------------------------
// Capability and subject

const COLLECT_SERVICES: Record<string, string> = { jina: "collect.jina", dajiala: "collect.dajiala", socialdata: "collect.socialdata" };

/** Purpose to model capability, from editorial/models.ts (loaded lazily: that module imports the providers). */
export async function modelCapabilities(): Promise<Map<string, string>> {
  const { CAPABILITIES } = await import("../editorial/models.ts");
  const map = new Map<string, string>();
  for (const [capability, def] of Object.entries(CAPABILITIES)) for (const purpose of def.purposes) map.set(purpose, capability);
  return map;
}

/**
 * The capability whose limit a request counts against: by service for the collectors (so SocialData's
 * "monitor.context" is collection, not the monitor model), "embedding" for embeddings, by purpose for models.
 */
export function capabilityFor(service: string, purpose: string, purposes: Map<string, string>): string {
  const collect = COLLECT_SERVICES[service];
  if (collect) return collect;
  if (purpose === "embedding") return "embedding";
  const capability = purposes.get(purpose);
  if (!capability) throw new MoneyRefusedError("unmapped_purpose", `no capability for ${service} purpose "${purpose}"`);
  return capability;
}

export const isModelCapability = (capability: string) => capability !== "embedding" && !capability.startsWith("collect.");

// The subject forms the model steps use, after the revision (@…) and fragment (#…) are cut off.
const ARTICLE = /^article:[A-Za-z0-9_-]{1,80}$/;
const ARTICLE_FACT = /^(article:[A-Za-z0-9_-]{1,80}):fact:\d+$/;
const STORY = /^story:\d+$/;
const STORY_PAIR = /^story:(\d+):(\d+)$/;
const OTHER = /^(?:quote:\d+|x:\d+|report:(?:daily|weekly|monthly):[0-9A-Za-z-]{1,20})$/;

/**
 * The subjects a model step counts against. `article:a1@4#2` and `article:a1:fact:9` are `article:a1`; a
 * story pair `story:3:8` counts against both stories. Any other shape refuses rather than becoming a
 * subject of its own. Collectors and embeddings have shared or batch subjects and no subject limit.
 */
export function subjectKeysFor(capability: string, subject: string | null | undefined): string[] {
  if (!isModelCapability(capability)) return [];
  const root = (subject ?? "").split(/[@#]/)[0]!;
  const fact = ARTICLE_FACT.exec(root);
  const pair = STORY_PAIR.exec(root);
  if (fact) return [fact[1]!];
  if (pair) return [...new Set([`story:${pair[1]}`, `story:${pair[2]}`])].sort();
  if (ARTICLE.test(root) || STORY.test(root) || OTHER.test(root)) return [root];
  throw new MoneyRefusedError("missing_subject", `subject "${subject ?? ""}" names no budget subject`);
}

const subjectKind = (key: string) => key.slice(0, key.indexOf(":"));

// ---------------------------------------------------------------------------------------------------
// Prices

export interface ApprovedPrice {
  service: string;
  /** The model, or the endpoint name of a service without models. */
  key: string;
  currency: Currency;
  inputPerMtok: number | null;
  outputPerMtok: number | null;
  perRequest: number | null;
  perUnit: number | null;
  maxUnitsPerRequest: number | null;
  overheadTokens: number;
  outputCapIncludesReasoning: boolean | null;
  reasoningOff: string | null;
}

/** The exact approved price row for this service, model or endpoint, and provider host; anything less refuses. */
export async function approvedPrice(db: Db, service: string, key: string, baseUrl: string): Promise<ApprovedPrice> {
  let host: string;
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    throw new MoneyRefusedError("missing_price", `${service}/${key}: base URL is not a URL`);
  }
  const [row] = await db<{
    currency: Currency; input_per_mtok: number | null; output_per_mtok: number | null; per_request: number | null; per_unit: number | null;
    max_units_per_request: number | null; overhead_tokens: number; output_cap_includes_reasoning: boolean | null; reasoning_off: string | null;
    base_host: string | null; approved_by: string | null; suspended_at: Date | null;
  }[]>`
    SELECT currency, input_per_mtok, output_per_mtok, per_request, per_unit, max_units_per_request, overhead_tokens,
           output_cap_includes_reasoning, reasoning_off, base_host, approved_by, suspended_at
    FROM service_prices WHERE service = ${service} AND model = ${key}`;
  if (!key || !row) throw new MoneyRefusedError("missing_price", `no price row for ${service}/${key || "(none)"}`);
  if (!row.approved_by) throw new MoneyRefusedError("unapproved_price", `price row ${service}/${key} is not approved`);
  if (row.suspended_at) throw new MoneyRefusedError("suspended_price", `price row ${service}/${key} is suspended`);
  if (!row.base_host || row.base_host.toLowerCase() !== host) throw new MoneyRefusedError("price_host", `price row ${service}/${key} is not for host ${host}`);
  return {
    service, key, currency: row.currency, inputPerMtok: row.input_per_mtok, outputPerMtok: row.output_per_mtok, perRequest: row.per_request,
    perUnit: row.per_unit, maxUnitsPerRequest: row.max_units_per_request, overheadTokens: row.overhead_tokens,
    outputCapIncludesReasoning: row.output_cap_includes_reasoning, reasoningOff: row.reasoning_off,
  };
}

// ---------------------------------------------------------------------------------------------------
// Worst-case cost

/** Amounts are kept to six decimals, always rounded up. */
const ceilMicro = (amount: number) => Math.ceil(amount * 1e6 - 1e-9) / 1e6;
const bytesOf = (body: unknown) => Buffer.byteLength(JSON.stringify(body), "utf8");
const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const onlyKeys = (o: Record<string, unknown>, allowed: readonly string[]) => Object.keys(o).every((k) => allowed.includes(k));

/**
 * The only keys a model's `extra` may carry (ADR section 2), with their values. Anything else, such as
 * max_tokens, n or thinking_budget, would change what the request can cost without the bound seeing it.
 * Returns how the extra switches reasoning off: only when exactly one switch is present and it says
 * off. A switch saying on, reasoning_effort, or two switches at once all count as reasoning on, since a
 * provider may honour whichever it knows.
 */
function reasoningOffBy(extra: Record<string, unknown>): string | null {
  const offs: string[] = [];
  let on = false;
  let switches = 0;
  for (const key of Object.keys(extra)) {
    const value = extra[key];
    if (key === "thinking") {
      if (!isPlainObject(value)) throw new MoneyRefusedError("extra_key", "thinking must be an object");
      for (const k of Object.keys(value)) {
        const v = value[k];
        if (k === "type" && (v === "enabled" || v === "disabled")) {
          switches += 1;
          if (v === "disabled") offs.push("thinking.type=disabled");
          else on = true;
        } else if (k === "clear_thinking" && typeof v === "boolean") continue;
        else throw new MoneyRefusedError("extra_key", `thinking.${k} is not an allowed extra key or value`);
      }
    } else if (key === "reasoning_effort") {
      if (value !== "low" && value !== "medium" && value !== "high") throw new MoneyRefusedError("extra_key", "reasoning_effort must be low, medium or high");
      on = true;
    } else if (key === "enable_thinking") {
      if (typeof value !== "boolean") throw new MoneyRefusedError("extra_key", "enable_thinking must be a boolean");
      switches += 1;
      if (value === false) offs.push("enable_thinking=false");
      else on = true;
    } else if (key === "top_p") {
      if (typeof value !== "number" || !Number.isFinite(value)) throw new MoneyRefusedError("extra_key", "top_p must be a number");
    } else {
      throw new MoneyRefusedError("extra_key", `${key} is not an allowed extra key`);
    }
  }
  return !on && switches === 1 && offs.length === 1 ? offs[0]! : null;
}

const CHAT_BODY_KEYS = ["model", "messages", "temperature", "max_tokens", "response_format"] as const;

/** Messages may carry text only: a string, or parts that are exactly {type: "text", text}. */
function textOnly(body: Record<string, unknown>): boolean {
  if (!Array.isArray(body.messages)) return false;
  return body.messages.every((m) => {
    if (!isPlainObject(m) || !onlyKeys(m, ["role", "content"]) || typeof m.role !== "string") return false;
    if (typeof m.content === "string") return true;
    return Array.isArray(m.content) && m.content.every((part) => isPlainObject(part) && onlyKeys(part, ["type", "text"]) && part.type === "text" && typeof part.text === "string");
  });
}

/**
 * Upper bound of one chat completion, from the body exactly as it will be sent (after `extra` is spread
 * in): every byte of it as an input token plus the row's implicit overhead, and max_tokens as output.
 * Reasoning counts as on unless the body switches it off the way this price row was verified to honour.
 */
export function chatWorstCase(price: ApprovedPrice, body: Record<string, unknown>, extra: Record<string, unknown> = {}): number {
  const off = reasoningOffBy(extra);
  for (const key of Object.keys(extra)) {
    if (JSON.stringify(body[key]) !== JSON.stringify(extra[key])) throw new MoneyRefusedError("extra_key", `extra.${key} is not what the request body carries`);
  }
  // The body itself may carry only what providers/llm.ts builds, plus the checked extra keys.
  for (const key of Object.keys(body)) {
    if (!(CHAT_BODY_KEYS as readonly string[]).includes(key) && !Object.hasOwn(extra, key)) throw new MoneyRefusedError("extra_key", `${key} is not an allowed request key`);
  }
  if (body.model !== price.key) throw new MoneyRefusedError("price_model", `the request is for model ${String(body.model)}, the price row for ${price.key}`);
  const maxTokens = body.max_tokens;
  if (typeof maxTokens !== "number" || !Number.isInteger(maxTokens) || maxTokens <= 0) throw new MoneyRefusedError("output_cap", "the request has no max_tokens");
  if (!textOnly(body)) throw new MoneyRefusedError("image_input", "only text messages have a verified bound; image and other input billing is not verified");
  if (price.inputPerMtok === null || price.outputPerMtok === null) throw new MoneyRefusedError("price_shape", `${price.service}/${price.key} has no token prices`);
  const reasoningOff = off !== null && off === price.reasoningOff;
  if (!reasoningOff && price.outputCapIncludesReasoning !== true) {
    throw new MoneyRefusedError("reasoning", `${price.service}/${price.key}: reasoning may run and is not verified to count within max_tokens`);
  }
  return ceilMicro(((bytesOf(body) + price.overheadTokens) * price.inputPerMtok + maxTokens * price.outputPerMtok) / 1e6);
}

const EMBEDDINGS_BODY_KEYS = ["model", "input", "dimensions", "encoding_format"] as const;

/** Upper bound of one embeddings request for text input: every byte of the body as an input token. */
export function embeddingsWorstCase(price: ApprovedPrice, body: Record<string, unknown>): number {
  if (!onlyKeys(body, EMBEDDINGS_BODY_KEYS)) throw new MoneyRefusedError("extra_key", "the embeddings request carries a key without a verified bound");
  if (body.model !== price.key) throw new MoneyRefusedError("price_model", `the request is for model ${String(body.model)}, the price row for ${price.key}`);
  const input = body.input;
  if (!(typeof input === "string" || (Array.isArray(input) && input.every((t) => typeof t === "string")))) {
    throw new MoneyRefusedError("image_input", "only text input has a verified bound");
  }
  if (price.inputPerMtok === null) throw new MoneyRefusedError("price_shape", `${price.service}/${price.key} has no input token price`);
  return ceilMicro(((bytesOf(body) + price.overheadTokens) * price.inputPerMtok) / 1e6);
}

/** A service billed per request. */
export function perRequestWorstCase(price: ApprovedPrice): number {
  if (price.perRequest === null) throw new MoneyRefusedError("price_shape", `${price.service}/${price.key} has no per-request price`);
  return ceilMicro(price.perRequest);
}

/** A service billed by what it returns: only with a cap the provider itself enforces or documents. */
export function perUnitWorstCase(price: ApprovedPrice): number {
  if (price.perUnit === null || price.maxUnitsPerRequest === null) {
    throw new MoneyRefusedError("unbounded_units", `${price.service}/${price.key} has no verified cap on what one request returns`);
  }
  return ceilMicro(price.perUnit * price.maxUnitsPerRequest);
}

// ---------------------------------------------------------------------------------------------------
// Reservation, settlement, ledger

export interface Reservation {
  /** The approved price row the bound was computed from; its currency is the reservation's. */
  price: Pick<ApprovedPrice, "service" | "key" | "currency">;
  capability: string;
  /** The request's subject as the caller has it; the budget subjects are derived here. */
  subject: string | null | undefined;
  /** The worst case of the request, from one of the bounds above. */
  amount: number;
}

interface LedgerRow { scope: "global" | "capability" | "subject"; key: string }

/** The rows one attempt counts against, in the one order every transaction updates them. */
function ledgerRows(capability: string, subjectKeys: string[]): LedgerRow[] {
  return [{ scope: "global", key: "" }, { scope: "capability", key: capability }, ...[...new Set(subjectKeys)].sort().map((key) => ({ scope: "subject" as const, key }))];
}

async function addToLedger(tx: Db, rows: LedgerRow[], currency: Currency, month: string, delta: number): Promise<void> {
  if (delta === 0) return;
  for (const row of rows) {
    if (delta > 0) {
      await tx`
        INSERT INTO money_usage (scope, key, currency, month, amount) VALUES (${row.scope}, ${row.key}, ${currency}, ${month}, ${delta})
        ON CONFLICT (scope, key, currency, month) DO UPDATE SET amount = money_usage.amount + EXCLUDED.amount`;
    } else {
      // Giving back: the row must exist, and the table refuses to go below zero.
      const [updated] = await tx<{ amount: number }[]>`
        UPDATE money_usage SET amount = amount + ${delta}::numeric
        WHERE scope = ${row.scope} AND key = ${row.key} AND currency = ${currency} AND month = ${month} RETURNING amount`;
      if (!updated) throw new Error(`Money ledger has no row ${row.scope}:${row.key} ${currency} ${month} to give ${-delta} back to`);
    }
  }
}

/** The global money lock. reserveMoney and settleMoney take it themselves; take it first in a transaction that must write an attempt row before calling them. */
export const lockMoney = (tx: Db) => tx`SELECT pg_advisory_xact_lock(hashtext('budget:money'))`;

/**
 * Reserves the worst case of an attempt about to be sent, or refuses. Runs inside the caller's
 * transaction and takes the one global money lock, so that simultaneous requests of any service
 * cannot exceed a limit together. The budget month is the one the attempt started in.
 */
export async function reserveMoney(tx: Db, attemptId: number, reservation: Reservation): Promise<void> {
  const { capability, price } = reservation;
  if (!(reservation.amount >= 0) || !Number.isFinite(reservation.amount)) throw new MoneyRefusedError("price_shape", "the worst case is not a finite, non-negative amount");
  const amount = ceilMicro(reservation.amount);
  const subjectKeys = subjectKeysFor(capability, reservation.subject);
  const currency = price.currency;
  await lockMoney(tx);
  const [attempt] = await tx<{ started_at: Date; holds_reservation: boolean; reserved_amount: number | null }[]>`
    SELECT started_at, holds_reservation, reserved_amount FROM receipt_attempts WHERE id = ${attemptId} FOR UPDATE`;
  if (!attempt) throw new Error(`Attempt ${attemptId} does not exist`);
  if (attempt.holds_reservation || attempt.reserved_amount !== null) throw new Error(`Attempt ${attemptId} already has a reservation`);
  const month = budgetMonth(attempt.started_at);
  const rows = ledgerRows(capability, subjectKeys);
  for (const row of rows) {
    const limitKey = row.scope === "subject" ? subjectKind(row.key) : row.key;
    const [limit] = await tx<{ approved_by: string | null; over: boolean }[]>`
      SELECT b.approved_by,
             coalesce((SELECT u.amount FROM money_usage u WHERE u.scope = ${row.scope} AND u.key = ${row.key} AND u.currency = ${currency} AND u.month = ${month}), 0)
               + ${amount}::numeric > b.monthly_limit AS over
      FROM money_budgets b WHERE b.scope = ${row.scope} AND b.key = ${limitKey} AND b.currency = ${currency}`;
    const label = `${row.scope}${limitKey ? `:${limitKey}` : ""} ${currency}`;
    if (!limit) throw new MoneyRefusedError("missing_limit", `no monthly limit row for ${label}`);
    if (!limit.approved_by) throw new MoneyRefusedError("unapproved_limit", `monthly limit row ${label} is not approved`);
    if (limit.over) throw new MonthlyBudgetExhaustedError(row.scope, row.key, currency, month);
  }
  await tx`
    UPDATE receipt_attempts SET capability = ${capability}, price_service = ${price.service}, price_key = ${price.key}, subject_keys = ${subjectKeys},
      budget_month = ${month}, reserved_amount = ${amount}, reserved_currency = ${currency}, settled_amount = NULL, holds_reservation = true
    WHERE id = ${attemptId}`;
  await addToLedger(tx, rows, currency, month, amount);
}

export type Settlement =
  /** A usable figure of what the provider billed. Counted when its currency is the reservation's. */
  | { kind: "actual"; amount: number; currency: string }
  /** The provider may have billed and no figure is known: the reservation stays. */
  | { kind: "hold" }
  /** The provider clearly did not take the request. */
  | { kind: "release" };

export interface SettlementResult {
  /** The amount this attempt now counts for. */
  counted: number;
  /** The actual cost was above the reservation. */
  overrun: boolean;
  /** After an overrun: whether the price row is now suspended. False means the row is gone, which the caller must alert on. */
  priceSuspended: boolean;
}

/**
 * Settles an attempt's reservation once the outcome is known, in one transaction with the ledger.
 * Looks only at holds_reservation, never at the attempt's status. May be called again when a later
 * finding changes the outcome (an unknown receipt checked by hand).
 */
export async function settleMoney(tx: Db, attemptId: number, settlement: Settlement): Promise<SettlementResult> {
  await lockMoney(tx);
  const [a] = await tx<{
    capability: string | null; price_service: string | null; price_key: string | null; subject_keys: string[]; budget_month: string | null;
    reserved_amount: number | null; reserved_currency: Currency | null; settled_amount: number | null; holds_reservation: boolean;
  }[]>`
    SELECT capability, price_service, price_key, subject_keys, to_char(budget_month, 'YYYY-MM-DD') AS budget_month,
           reserved_amount, reserved_currency, settled_amount, holds_reservation
    FROM receipt_attempts WHERE id = ${attemptId} FOR UPDATE`;
  if (!a) throw new Error(`Attempt ${attemptId} does not exist`);
  if (a.reserved_amount === null || !a.capability || !a.reserved_currency || !a.budget_month) return { counted: 0, overrun: false, priceSuspended: false };
  const before = a.holds_reservation ? a.settled_amount ?? a.reserved_amount : 0;
  const rows = ledgerRows(a.capability, a.subject_keys);

  if (settlement.kind === "release") {
    await tx`UPDATE receipt_attempts SET holds_reservation = false, settled_amount = 0 WHERE id = ${attemptId}`;
    await addToLedger(tx, rows, a.reserved_currency, a.budget_month, -before);
    return { counted: 0, overrun: false, priceSuspended: false };
  }
  // A figure in another currency cannot be counted against this currency's limits: the reservation stays.
  const figure = settlement.kind === "actual" && settlement.currency === a.reserved_currency && Number.isFinite(settlement.amount) && settlement.amount >= 0
    ? ceilMicro(settlement.amount) : null;
  // Without a figure the reservation counts, but never less than an earlier figure that already proved it too small.
  const proven = a.holds_reservation && a.settled_amount !== null && a.settled_amount > a.reserved_amount ? a.settled_amount : null;
  const actual = figure ?? proven;
  const counted = actual ?? a.reserved_amount;
  await tx`UPDATE receipt_attempts SET holds_reservation = true, settled_amount = ${actual} WHERE id = ${attemptId}`;
  await addToLedger(tx, rows, a.reserved_currency, a.budget_month, counted - before);
  const overrun = figure !== null && figure > a.reserved_amount;
  let priceSuspended = false;
  if (overrun) {
    // The bound was wrong for this price row: nothing more goes out on it until the owner approves it again.
    const [row] = await tx<{ suspended: boolean }[]>`
      UPDATE service_prices
      SET suspended_at = coalesce(suspended_at, now()),
          suspended_reason = coalesce(suspended_reason, ${`attempt ${attemptId} cost ${actual} ${a.reserved_currency}, reserved ${a.reserved_amount}`})
      WHERE service = ${a.price_service} AND model = ${a.price_key} RETURNING true AS suspended`;
    priceSuspended = Boolean(row?.suspended);
  }
  return { counted, overrun, priceSuspended };
}

export interface LedgerMismatch { scope: string; key: string; currency: string; month: string; ledger: number; attempts: number }

/**
 * Compares the ledger with what the attempts themselves hold (live attempts only). Empty when they
 * agree; anything else is a bug or a manual change and must raise an alert.
 */
export async function reconcileMoneyLedger(db: Db = sql): Promise<LedgerMismatch[]> {
  const rows = await db<LedgerMismatch[]>`
    WITH held AS (
      SELECT capability, subject_keys, reserved_currency AS currency, budget_month AS month, coalesce(settled_amount, reserved_amount) AS amount
      FROM receipt_attempts WHERE holds_reservation AND origin = 'live'
    ), expected AS (
      SELECT 'global' AS scope, '' AS key, currency, month, sum(amount) AS amount FROM held GROUP BY currency, month
      UNION ALL SELECT 'capability', capability, currency, month, sum(amount) FROM held GROUP BY capability, currency, month
      UNION ALL SELECT 'subject', k, currency, month, sum(amount) FROM held, unnest(subject_keys) AS k GROUP BY k, currency, month
    )
    SELECT coalesce(u.scope, e.scope) AS scope, coalesce(u.key, e.key) AS key, coalesce(u.currency, e.currency) AS currency,
           to_char(coalesce(u.month, e.month), 'YYYY-MM-DD') AS month, coalesce(u.amount, 0) AS ledger, coalesce(e.amount, 0) AS attempts
    FROM money_usage u FULL JOIN expected e USING (scope, key, currency, month)
    WHERE coalesce(u.amount, 0) <> coalesce(e.amount, 0)
    ORDER BY 1, 2, 3, 4`;
  return [...rows];
}
