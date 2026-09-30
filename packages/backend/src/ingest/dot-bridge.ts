// The controlled file delivery bridge for Dot batches (D2, docs/development/dot-d2-file-bridge.md).
// A producer drops insurhot.dot.v1 JSON files into <inbox>/pending; one run of the bridge posts each
// file, exactly as written, to InsurHOT's own POST /api/ingest/dot, keeps the server's receipt and
// archives what it sent. It is a client of that endpoint, run by an operator: it calls no model,
// follows no source link, starts nothing else, and is not an "official Dot API".
//
//   delivered / duplicate  → <inbox>/delivered/<deliveryId>.json, <inbox>/receipts/<deliveryId>.json
//   refused for good (400, 409, 413, 415, or unusable before sending) → <inbox>/rejected/ + .error.json
//   anything else (network, timeout, 3xx, 401, 403, 429, 5xx) → stays in pending, same bytes, same
//   deliveryId, for the next run. The endpoint is idempotent per deliveryId, so a repeat stores nothing.
//
// A request takes time, and the producer may put a new file under the same name meanwhile. So:
//   - a file is opened without following links and read through that one descriptor: what is judged
//     (a plain file, its size, its age) is what is sent;
//   - the archive is written from the bytes that were sent, never by moving whatever is at the path;
//   - a pending file is taken away only after it is shown to be the very file that was sent (it is
//     moved aside first and compared there); any other file found under that name goes back.
// Nothing here depends on the lock: two bridges on one inbox send the same bytes, the server stores
// one batch, and each file step tolerates the other having done it already.
// The token comes from the caller (the script reads DOT_INGEST_TOKEN) and is written nowhere.
import {
  appendFileSync, closeSync, constants, existsSync, fstatSync, linkSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync,
} from "node:fs";
import path from "node:path";
import { DOT_BODY_LIMIT } from "@aihot/contracts/dot-ingest";

/** The delivery id rule of the v1 contract (ingest/dot.ts, migration 0039): safe as a file name. */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const REFUSED_FOR_GOOD = new Set([400, 409, 413, 415]);
/** A lock file without a readable pid is being written right now, unless it has been like that for this long. */
const LOCK_WRITE_MS = 10_000;

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
  /** For tests of what two bridges do to one inbox: run without taking the lock. */
  skipLock?: boolean;
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

/** What identifies the file that was read, to tell it from another one later found under its name. */
interface Identity { dev: number; ino: number; size: number; mtimeMs: number }

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

const codeOf = (error: unknown): string => String((error as NodeJS.ErrnoException)?.code ?? "unknown");

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return codeOf(error) === "EPERM";
  }
};

/**
 * One bridge per inbox, as a courtesy: an exclusive lock file with the holder's pid. A lock whose
 * process is gone is taken over. The takeover is not atomic (two late-comers can both succeed) and a
 * pid can be reused by an unrelated process (the lock then looks held until it is deleted by hand);
 * neither loses a batch, because no step relies on being alone.
 */
function lock(file: string, now: Date): (() => void) | null {
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
      if (codeOf(error) !== "EEXIST") throw error;
      try {
        const holder = Number(readFileSync(file, "utf8"));
        if (Number.isInteger(holder) && holder > 0) {
          if (alive(holder)) return null;
        } else if (now.getTime() - statSync(file).mtimeMs < LOCK_WRITE_MS) {
          return null;
        }
        unlinkSync(file);
      } catch { /* vanished meanwhile: try once more */ }
    }
  }
  return null;
}

/** Replaces the file as a whole (written beside it, then renamed), for a receipt that may be renewed. */
function writeWhole(file: string, data: string | Buffer) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, data, { mode: 0o600 });
  renameSync(tmp, file);
}

/** Creates the file; never writes over one that is there. False when it exists already. */
function writeNew(file: string, data: string | Buffer): boolean {
  try {
    writeFileSync(file, data, { mode: 0o600, flag: "wx" });
    return true;
  } catch (error) {
    if (codeOf(error) === "EEXIST") return false;
    throw error;
  }
}

/** A name in `dir` under which neither the file nor its "<name><suffix>" companion exists yet. */
function freeName(dir: string, name: string, at: Date, companion = ""): string {
  const taken = (n: string) => existsSync(path.join(dir, n)) || (companion !== "" && existsSync(path.join(dir, `${n}${companion}`)));
  if (!taken(name)) return name;
  const stamp = at.toISOString().replace(/[:.]/g, "");
  for (let n = 0; ; n++) {
    const candidate = `${name}.${stamp}${n ? `-${n}` : ""}`;
    if (!taken(candidate)) return candidate;
  }
}

/** One run over <inbox>/pending. A single file's trouble is recorded and the run goes on; a configuration error throws. */
export async function runDotBridge(options: BridgeOptions): Promise<BridgeSummary> {
  const endpoint = bridgeEndpoint(options.endpoint);
  if (!options.token) throw new BridgeConfigError("DOT_INGEST_TOKEN is not set");
  if (!options.inbox) throw new BridgeConfigError("--inbox <directory> is required");
  const now = options.now ?? (() => new Date());
  const settleMs = options.settleMs ?? 5000;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const send = options.fetchImpl ?? fetch;
  const inbox = path.resolve(options.inbox);
  const pending = path.join(inbox, "pending"), delivered = path.join(inbox, "delivered"), receipts = path.join(inbox, "receipts"),
    rejected = path.join(inbox, "rejected"), aside = path.join(inbox, ".aside");
  for (const dir of [inbox, pending, delivered, receipts, rejected, aside]) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const summary: BridgeSummary = { delivered: 0, duplicate: 0, rejected: 0, retry: 0, skipped: 0 };
  const unlock = options.skipLock ? () => {} : lock(path.join(inbox, ".lock"), now());
  if (!unlock) return { ...summary, stopped: "locked" };

  const record = (line: Partial<LedgerLine> & { file: string; outcome: Outcome }) => {
    summary[line.outcome] += 1;
    const full: LedgerLine = { at: now().toISOString(), deliveryId: null, httpStatus: null, receivedAt: null, firstSeenAt: null, itemCount: null, error: null, ...line };
    appendFileSync(path.join(inbox, "ledger.jsonl"), `${JSON.stringify(full)}\n`, { mode: 0o600 });
  };

  /** Back into pending without writing over anything there: under its name, or a variant of it that still ends in .json. */
  const putBack = (from: string, name: string) => {
    const base = name.endsWith(".json") ? name.slice(0, -".json".length) : name;
    for (let n = 0; ; n++) {
      const target = n === 0 ? name : `${base}.returned-${now().toISOString().replace(/[:.]/g, "")}-${n}.json`;
      try {
        linkSync(from, path.join(pending, target));
        unlinkSync(from);
        return;
      } catch (error) {
        if (codeOf(error) !== "EEXIST") throw error;
      }
    }
  };
  let asideSeq = 0;
  /**
   * Takes the pending file away if, and only if, it is the file that was read: it is moved aside in one
   * step and compared there. Returns where it now is; null when there is no such file any more, or when
   * another file was found under the name (that one goes back, untouched, for the next run).
   */
  const takeAway = (name: string, sent: Identity): string | null => {
    const parked = path.join(aside, `${process.pid}-${asideSeq++}`);
    try {
      renameSync(path.join(pending, name), parked);
    } catch (error) {
      if (codeOf(error) === "ENOENT") return null;
      throw error;
    }
    const found = lstatSync(parked);
    if (found.isFile() && found.dev === sent.dev && found.ino === sent.ino && found.size === sent.size && found.mtimeMs === sent.mtimeMs) return parked;
    putBack(parked, name);
    return null;
  };
  /** Sets a refused batch aside with the reason: the file itself when it is still the one that was read, else the bytes that were read. */
  const reject = (name: string, sent: Identity, body: Buffer | null, deliveryId: string | null, httpStatus: number | null, error: string) => {
    const target = freeName(rejected, name, now(), ".error.json");
    const parked = takeAway(name, sent);
    if (parked) renameSync(parked, path.join(rejected, target));
    else if (body) writeNew(path.join(rejected, target), body);
    writeNew(path.join(rejected, `${target}.error.json`), `${JSON.stringify({ at: now().toISOString(), file: name, deliveryId, httpStatus, error }, null, 2)}\n`);
    record({ file: name, deliveryId, outcome: "rejected", httpStatus, error });
  };

  try {
    // Files an earlier run had moved aside and did not finish with (it was killed): back into pending.
    for (const left of readdirSync(aside)) putBack(path.join(aside, left), `recovered-${left}.json`);
    // Only plain .json files directly in pending, by name. A producer writes "<name>.json.part" and renames it when complete.
    const names = readdirSync(pending).filter((n) => n.endsWith(".json") && !n.startsWith(".")).sort();
    for (let i = 0; i < names.length; i++) {
      const name = names[i]!;
      let deliveryId: string | null = null;
      try {
        // Opened without following a link, and judged and read through this one descriptor.
        let fd: number;
        try {
          fd = openSync(path.join(pending, name), constants.O_RDONLY | constants.O_NOFOLLOW);
        } catch (error) {
          const code = codeOf(error);
          if (code === "ENOENT") continue; // gone since the listing: taken by another run, or withdrawn
          record({ file: name, outcome: "skipped", error: code === "ELOOP" || code === "EMLINK" ? "symbolic_link" : `local_${code}` });
          continue;
        }
        let sent: Identity;
        let body: Buffer | null = null;
        try {
          const stat = fstatSync(fd);
          if (!stat.isFile()) {
            record({ file: name, outcome: "skipped", error: "not_a_file" });
            continue;
          }
          if (now().getTime() - stat.mtimeMs < settleMs) {
            record({ file: name, outcome: "skipped", error: "recently_modified" });
            continue;
          }
          sent = { dev: stat.dev, ino: stat.ino, size: stat.size, mtimeMs: stat.mtimeMs };
          if (stat.size <= DOT_BODY_LIMIT) body = readFileSync(fd);
        } finally {
          closeSync(fd);
        }
        if (body === null || body.length > DOT_BODY_LIMIT) {
          reject(name, sent, null, null, null, "payload_too_large");
          continue;
        }
        try {
          const parsed = JSON.parse(body.toString("utf8")) as { deliveryId?: unknown } | null;
          if (parsed && typeof parsed === "object" && typeof parsed.deliveryId === "string") deliveryId = parsed.deliveryId;
        } catch {
          reject(name, sent, body, null, null, "invalid_json");
          continue;
        }
        if (deliveryId === null || !SAFE_ID.test(deliveryId)) {
          // Never used in a path: the file keeps its own name.
          const unsafe = deliveryId !== null;
          deliveryId = null;
          reject(name, sent, body, null, null, unsafe ? "unsafe_delivery_id" : "missing_delivery_id");
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
          // (The error object is dropped on purpose: nothing of the request, its headers included, is reported.)
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
          writeWhole(path.join(receipts, `${deliveryId}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
          // The archive is the bytes that were sent. An earlier archive of this delivery stays: when the server
          // says "duplicate" it holds the same content; should it say "received" for other bytes (its store was
          // reset), both are kept.
          const archive = path.join(delivered, `${deliveryId}.json`);
          if (!writeNew(archive, body) && answer.status === "received" && !readFileSync(archive).equals(body)) {
            writeNew(path.join(delivered, freeName(delivered, `${deliveryId}.json`, now())), body);
          }
          // Only now, and only if it is still that file, does the pending file go.
          const parked = takeAway(name, sent);
          if (parked) unlinkSync(parked);
          record({ file: name, deliveryId, outcome: answer.status === "received" ? "delivered" : "duplicate", httpStatus: status, receivedAt: receipt.receivedAt, firstSeenAt: receipt.firstSeenAt, itemCount: receipt.itemCount });
          continue;
        }
        if (REFUSED_FOR_GOOD.has(status)) {
          reject(name, sent, body, deliveryId, status, errorCode ?? `http_${status}`);
          continue;
        }
        // Everything else may pass: a wrong or missing token, a full rate window, a server that is off or failing, a redirect.
        record({ file: name, deliveryId, outcome: "retry", httpStatus: status, error: errorCode ?? (status >= 300 && status < 400 ? "redirect_not_followed" : `http_${status}`) });
        if (status === 401 || status === 403 || status === 429) {
          summary.retry += names.length - i - 1;
          summary.stopped = status === 429 ? "rate_limited" : "unauthorized";
          break;
        }
      } catch (error) {
        // A local file step failed (the file vanished mid-way, a permission, a full disk): this file waits, the run goes on.
        record({ file: name, deliveryId, outcome: "retry", error: `local_${codeOf(error)}` });
      }
    }
  } finally {
    unlock();
  }
  return summary;
}
