// The controlled file delivery bridge for Dot batches (D2, docs/development/dot-d2-file-bridge.md).
// A producer drops insurhot.dot.v1 JSON files into <inbox>/pending; one run of the bridge posts each
// file, exactly as written, to InsurHOT's own POST /api/ingest/dot, keeps the server's receipt and
// archives the file. It is a client of that endpoint, run by an operator: it calls no model, follows
// no source link, starts nothing else, and is not an "official Dot API".
//
// A file is never changed and never deleted before the server has answered for it:
//   delivered / duplicate  → <inbox>/delivered/<deliveryId>.json + .receipt.json
//   refused for good (400, 409, 413, 415, or unusable before sending) → <inbox>/rejected/ + .error.json
//   anything else (network, timeout, 3xx, 401, 403, 429, 5xx) → stays in pending, same bytes, same
//   deliveryId, for the next run. The endpoint is idempotent per deliveryId, so a repeat stores nothing.
// The token comes from the caller (the script reads DOT_INGEST_TOKEN) and is written nowhere.
import { appendFileSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DOT_BODY_LIMIT } from "@aihot/contracts/dot-ingest";

/** The delivery id rule of the v1 contract (ingest/dot.ts, migration 0039): safe as a file name. */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const REFUSED_FOR_GOOD = new Set([400, 409, 413, 415]);

export class BridgeConfigError extends Error {}

export type Outcome = "delivered" | "duplicate" | "rejected" | "retry" | "skipped";

export interface BridgeOptions {
  inbox: string;
  endpoint: string;
  token: string;
  /** A file modified more recently than this may still be being written and is left for the next run. */
  settleMs?: number;
  timeoutMs?: number;
  now?: () => Date;
  fetchImpl?: typeof fetch;
}

export interface BridgeSummary {
  delivered: number;
  duplicate: number;
  rejected: number;
  retry: number;
  skipped: number;
  /** Why the run ended before the last file, when it did. */
  stopped?: "unauthorized" | "rate_limited" | "unreachable" | "locked";
}

interface LedgerLine {
  at: string;
  file: string;
  deliveryId: string | null;
  outcome: Outcome;
  httpStatus: number | null;
  receivedAt: string | null;
  firstSeenAt: string | null;
  itemCount: number | null;
  error: string | null;
}

/** The endpoint must be this service's Dot intake, over TLS unless it is on this machine. */
export function bridgeEndpoint(raw: string | undefined): URL {
  let url: URL;
  try {
    url = new URL(raw ?? "");
  } catch {
    throw new BridgeConfigError("the endpoint must be a full URL ending in /api/ingest/dot");
  }
  if (url.username || url.password) throw new BridgeConfigError("the endpoint must not carry credentials");
  if (url.pathname !== "/api/ingest/dot" || url.search || url.hash) throw new BridgeConfigError("the endpoint must be the /api/ingest/dot address, without a query");
  const loopback = LOOPBACK.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) throw new BridgeConfigError("the endpoint must use https unless it is on this machine");
  return url;
}

export const exitCodeFor = (s: BridgeSummary): number => (s.rejected > 0 ? 3 : s.retry > 0 || s.stopped ? 2 : 0);

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/** One bridge per inbox: an exclusive lock file with the holder's pid; one left by a process that is gone is taken over. */
function lock(file: string): (() => void) | null {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(file, "wx", 0o600);
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
      return () => {
        try {
          if (readFileSync(file, "utf8") === String(process.pid)) unlinkSync(file);
        } catch { /* already gone */ }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      let holder = NaN;
      try {
        holder = Number(readFileSync(file, "utf8"));
      } catch { /* vanished meanwhile: try again */ }
      if (Number.isInteger(holder) && holder > 0 && alive(holder)) return null;
      try {
        unlinkSync(file);
      } catch { /* someone else took it over */ }
    }
  }
  return null;
}

/** Writes beside the target and renames, so a reader never sees half a file. */
function writeWhole(file: string, text: string) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text, { mode: 0o600 });
  renameSync(tmp, file);
}

/** A name in `dir` that is not taken: the name itself, or the name with the time and a counter. */
function freeName(dir: string, name: string, at: Date): string {
  if (!existsSync(path.join(dir, name))) return name;
  const stamp = at.toISOString().replace(/[:.]/g, "");
  for (let n = 0; ; n++) {
    const candidate = `${name}.${stamp}${n ? `-${n}` : ""}`;
    if (!existsSync(path.join(dir, candidate))) return candidate;
  }
}

/** One run over <inbox>/pending. Never throws for a single file's trouble; a configuration error does. */
export async function runDotBridge(options: BridgeOptions): Promise<BridgeSummary> {
  const endpoint = bridgeEndpoint(options.endpoint);
  if (!options.token) throw new BridgeConfigError("DOT_INGEST_TOKEN is not set");
  if (!options.inbox) throw new BridgeConfigError("--inbox <directory> is required");
  const now = options.now ?? (() => new Date());
  const settleMs = options.settleMs ?? 5000;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const send = options.fetchImpl ?? fetch;
  const inbox = path.resolve(options.inbox);
  const pending = path.join(inbox, "pending"), delivered = path.join(inbox, "delivered"), rejected = path.join(inbox, "rejected");
  for (const dir of [inbox, pending, delivered, rejected]) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const summary: BridgeSummary = { delivered: 0, duplicate: 0, rejected: 0, retry: 0, skipped: 0 };
  const unlock = lock(path.join(inbox, ".lock"));
  if (!unlock) return { ...summary, stopped: "locked" };

  const record = (line: Partial<LedgerLine> & { file: string; outcome: Outcome }) => {
    summary[line.outcome] += 1;
    const full: LedgerLine = { at: now().toISOString(), deliveryId: null, httpStatus: null, receivedAt: null, firstSeenAt: null, itemCount: null, error: null, ...line };
    appendFileSync(path.join(inbox, "ledger.jsonl"), `${JSON.stringify(full)}\n`, { mode: 0o600 });
  };
  const reject = (name: string, source: string, deliveryId: string | null, httpStatus: number | null, error: string) => {
    const target = freeName(rejected, name, now());
    renameSync(source, path.join(rejected, target));
    writeWhole(path.join(rejected, `${target}.error.json`), `${JSON.stringify({ at: now().toISOString(), file: name, deliveryId, httpStatus, error }, null, 2)}\n`);
    record({ file: name, deliveryId, outcome: "rejected", httpStatus, error });
  };

  try {
    // Only plain .json files directly in pending, by name. A producer writes "<name>.json.part" and renames it when complete.
    const names = readdirSync(pending).filter((n) => n.endsWith(".json") && !n.startsWith(".")).sort();
    for (let i = 0; i < names.length; i++) {
      const name = names[i]!;
      const source = path.join(pending, name);
      const stat = lstatSync(source, { throwIfNoEntry: false });
      if (!stat) continue;
      if (!stat.isFile()) {
        // A link or a directory is not followed: what it points at is not ours to send or move.
        record({ file: name, outcome: "skipped", error: stat.isSymbolicLink() ? "symbolic_link" : "not_a_file" });
        continue;
      }
      if (now().getTime() - stat.mtimeMs < settleMs) {
        record({ file: name, outcome: "skipped", error: "recently_modified" });
        continue;
      }
      if (stat.size > DOT_BODY_LIMIT) {
        reject(name, source, null, null, "payload_too_large");
        continue;
      }
      const body = readFileSync(source);
      let deliveryId: string | null = null;
      try {
        const parsed = JSON.parse(body.toString("utf8")) as { deliveryId?: unknown } | null;
        if (parsed && typeof parsed === "object" && typeof parsed.deliveryId === "string") deliveryId = parsed.deliveryId;
      } catch {
        reject(name, source, null, null, "invalid_json");
        continue;
      }
      if (deliveryId === null || !SAFE_ID.test(deliveryId)) {
        // Never used in a path: the file keeps its own name.
        reject(name, source, null, null, deliveryId === null ? "missing_delivery_id" : "unsafe_delivery_id");
        continue;
      }

      let status: number;
      let answer: Record<string, unknown> = {};
      try {
        const res = await send(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${options.token}` },
          body,
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
        });
        status = res.status;
        const text = await res.text();
        try {
          const json = JSON.parse(text) as unknown;
          if (json && typeof json === "object" && !Array.isArray(json)) answer = json as Record<string, unknown>;
        } catch { /* not JSON: judged by its status alone */ }
      } catch {
        // Not reached, or no answer in time: nothing is known, the file waits. The rest would meet the same.
        record({ file: name, deliveryId, outcome: "retry", error: "unreachable" });
        summary.retry += names.length - i - 1;
        summary.stopped = "unreachable";
        break;
      }
      const errorCode = typeof answer.error === "string" ? answer.error.slice(0, 80) : null;

      if (status >= 200 && status < 300 && answer.ok === true && answer.deliveryId === deliveryId && (answer.status === "received" || answer.status === "duplicate")) {
        const receipt = {
          schemaVersion: answer.schemaVersion ?? null, deliveryId, producer: answer.producer ?? null, status: answer.status,
          receivedAt: typeof answer.receivedAt === "string" ? answer.receivedAt : null, firstSeenAt: typeof answer.firstSeenAt === "string" ? answer.firstSeenAt : null,
          itemCount: typeof answer.itemCount === "number" ? answer.itemCount : null, recordedAt: now().toISOString(),
        };
        // Receipt first: should the run die before the move, the next one gets "duplicate" and finishes it.
        writeWhole(path.join(delivered, `${deliveryId}.receipt.json`), `${JSON.stringify(receipt, null, 2)}\n`);
        const archived = path.join(delivered, `${deliveryId}.json`);
        // An earlier copy stays as it is: the server has just said this one is the same delivery.
        if (existsSync(archived)) unlinkSync(source);
        else renameSync(source, archived);
        record({ file: name, deliveryId, outcome: answer.status === "received" ? "delivered" : "duplicate", httpStatus: status, receivedAt: receipt.receivedAt, firstSeenAt: receipt.firstSeenAt, itemCount: receipt.itemCount });
        continue;
      }
      if (REFUSED_FOR_GOOD.has(status)) {
        reject(name, source, deliveryId, status, errorCode ?? `http_${status}`);
        continue;
      }
      // Everything else may pass: a wrong or missing token, a full rate window, a server that is off or failing, a redirect.
      record({ file: name, deliveryId, outcome: "retry", httpStatus: status, error: errorCode ?? (status >= 300 && status < 400 ? "redirect_not_followed" : `http_${status}`) });
      if (status === 401 || status === 403 || status === 429) {
        summary.retry += names.length - i - 1;
        summary.stopped = status === 429 ? "rate_limited" : "unauthorized";
        break;
      }
    }
  } finally {
    unlock();
  }
  return summary;
}
