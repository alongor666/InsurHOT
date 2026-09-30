// Event jobs: serial grouping, debounced digests.
import type { PgBoss } from "pg-boss";
import { groupArticle } from "../events/group.ts";
import { composeStoryDigest } from "../events/digest.ts";
import { blockForBudget, refusedByMoney } from "./budget-blocked.ts";
import { settleNonEditorial } from "./content.ts";
import { ensureQueue, enqueue, QUEUES } from "./queue.ts";

export async function registerEventJobs(boss: PgBoss) {
  await ensureQueue(QUEUES.group);
  // Serial on purpose: two reports of the same new fact must not both create it.
  await boss.work<{ articleId: string; signalOnly?: boolean; force?: boolean }>(QUEUES.group, { localConcurrency: 1, pollingIntervalSeconds: 0.5 }, async ([job]) => {
    if (!job) return;
    try {
      // A discussion post comes here straight from collection: record it first (settleNonEditorial).
      if (job.data.signalOnly && !job.data.force && !(await settleNonEditorial(job.data.articleId)).group) return { verdict: "skipped" };
      const result = await groupArticle(job.data.articleId, { signalOnly: job.data.signalOnly, force: job.data.force });
      if (result.storyId && !result.verdict.startsWith("signal")) {
        await enqueue(QUEUES.digest, { storyId: result.storyId }, { singletonKey: `story:${result.storyId}`, startAfter: 60 });
      }
      return result;
    } catch (error) {
      return groupJobFailed(job.data, error);
    }
  });
  await ensureQueue(QUEUES.digest);
  await boss.work<{ storyId: number; afterCorrection?: boolean }>(QUEUES.digest, { localConcurrency: 3, pollingIntervalSeconds: 5 }, async ([job]) => {
    if (!job) return;
    try {
      return await composeStoryDigest(job.data.storyId, { afterCorrection: job.data.afterCorrection });
    } catch (error) {
      return digestJobFailed(job.data, error);
    }
  });
}

/**
 * A grouping job that failed. A full count window or a request in flight is retried by the queue, as
 * is any other error; a refusal by the monetary limits ends the job normally, recorded as
 * budget-blocked, so that it does not use up the queue's retries on something waiting cannot fix.
 */
export async function groupJobFailed(data: { articleId: string; signalOnly?: boolean; force?: boolean }, error: unknown): Promise<{ verdict: "budget_blocked" }> {
  if (!refusedByMoney(error)) throw error;
  await blockForBudget("group", data.articleId, error, data);
  return { verdict: "budget_blocked" };
}

/** A digest job that failed: as for grouping. */
export async function digestJobFailed(data: { storyId: number; afterCorrection?: boolean }, error: unknown): Promise<{ updated: false; budgetBlocked: true }> {
  if (!refusedByMoney(error)) throw error;
  await blockForBudget("digest", String(data.storyId), error, data);
  return { updated: false, budgetBlocked: true };
}
