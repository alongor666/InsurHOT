// Admin: what the monetary limits stopped, and resuming it after the owner raised a limit or approved
// a price (ADR-015 section 8). Nothing resumes by itself, a new month included. Each call resumes a
// bounded number of items, so a long backlog does not hit the providers at once; the rate the owner
// wants (ADR owner input 9) is a matter of how often and how large the admin makes these calls.
import { sql } from "../db.ts";
import { queueProcessing } from "../jobs/content.ts";
import { enqueue, QUEUES } from "../jobs/queue.ts";
import { audit } from "./auth.ts";

const DEFAULT_RESUME = 50;
const MAX_RESUME = 500;

export async function budgetBlockedOverview() {
  const [articles, other, reasons] = await Promise.all([
    sql<{ n: number; oldest: Date | null }[]>`SELECT count(*)::int AS n, min(discovered_at) AS oldest FROM articles WHERE processing_state = 'budget_blocked'`,
    sql<{ kind: string; n: number; oldest: Date }[]>`SELECT kind, count(*)::int AS n, min(blocked_at) AS oldest FROM budget_blocked GROUP BY 1 ORDER BY 1`,
    sql<{ reason: string; n: number }[]>`
      SELECT reason, sum(n)::int AS n FROM (
        SELECT left(coalesce(processing_error, ''), 160) AS reason, count(*) AS n FROM articles WHERE processing_state = 'budget_blocked' GROUP BY 1
        UNION ALL SELECT left(reason, 160), count(*) FROM budget_blocked GROUP BY 1) r
      GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
  ]);
  return { articles: { count: articles[0]?.n ?? 0, oldest: articles[0]?.oldest ?? null }, other, reasons, resumeDefault: DEFAULT_RESUME, resumeMax: MAX_RESUME };
}

/**
 * Puts stopped work back: the newest articles first, then grouping, digests and reports in the order
 * they stopped, `limit` items in all. What is refused again stops again; nothing is lost either way.
 */
export async function resumeBudgetBlocked(input: { limit?: number; reason: string }, actor: string) {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) throw Object.assign(new Error("reason is required"), { statusCode: 400 });
  const limit = input.limit ?? DEFAULT_RESUME;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESUME) throw Object.assign(new Error(`limit must be an integer from 1 to ${MAX_RESUME}`), { statusCode: 400 });
  const articles = await sql<{ id: string }[]>`
    UPDATE articles SET processing_state = 'new', processing_error = NULL, processing_retry_at = NULL, processing_queued_at = NULL
    WHERE id IN (SELECT id FROM articles WHERE processing_state = 'budget_blocked' ORDER BY discovered_at DESC LIMIT ${limit})
    RETURNING id`;
  for (const a of articles) await queueProcessing(a.id);
  const rest = limit - articles.length;
  const other = rest > 0
    ? await sql<{ kind: string; ref: string; job: Record<string, unknown> }[]>`
        DELETE FROM budget_blocked WHERE (kind, ref) IN (SELECT kind, ref FROM budget_blocked ORDER BY blocked_at, kind, ref LIMIT ${rest})
        RETURNING kind, ref, job`
    : [];
  const resumed = { articles: articles.length, group: 0, digest: 0, report: 0 };
  for (const b of other) {
    // A job still waiting under the same key is that work already: the queue keeps one.
    if (b.kind === "group") await enqueue(QUEUES.group, { ...b.job, articleId: b.ref }, { singletonKey: b.ref });
    else if (b.kind === "digest") await enqueue(QUEUES.digest, { ...b.job, storyId: Number(b.ref) }, { singletonKey: `story:${b.ref}` });
    // A report has no job: with its mark gone, the hourly catch-up composes it.
    resumed[b.kind as "group" | "digest" | "report"] += 1;
  }
  const [left] = await sql<{ n: number }[]>`
    SELECT (SELECT count(*) FROM articles WHERE processing_state = 'budget_blocked')::int + (SELECT count(*) FROM budget_blocked)::int AS n`;
  await audit(actor, "budget-blocked.resume", null, reason, null, { ...resumed, left: left!.n });
  return { resumed, left: left!.n };
}
