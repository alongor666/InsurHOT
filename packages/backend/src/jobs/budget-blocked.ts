// Work the monetary limits refused (ADR-015 section 8). A refusal is not a full window that passes:
// waiting does not help, so the work is recorded here and left until an admin resumes it
// (admin/budget-blocked.ts). Articles keep their own state (processing_state = 'budget_blocked');
// this table holds the rest: grouping, story digests, reports.
import { sql } from "../db.ts";
import { MoneyRefusedError } from "../providers/money.ts";

export type BlockedKind = "group" | "digest" | "report";

/** Whether an error is a refusal by the monetary limits: a used-up month, or a missing or unapproved price or limit. */
export const refusedByMoney = (error: unknown): error is MoneyRefusedError => error instanceof MoneyRefusedError;

export async function blockForBudget(kind: BlockedKind, ref: string, error: MoneyRefusedError, job: Record<string, unknown> = {}): Promise<void> {
  await sql`
    INSERT INTO budget_blocked (kind, ref, job, reason) VALUES (${kind}, ${ref}, ${sql.json(job as never)}, ${error.message.slice(0, 500)})
    ON CONFLICT (kind, ref) DO UPDATE SET job = EXCLUDED.job, reason = EXCLUDED.reason, resumed_at = NULL`;
}

/** Stopped and not resumed. A report an admin resumed is no longer blocked: the catch-up may compose it. */
export async function isBudgetBlocked(kind: BlockedKind, ref: string): Promise<boolean> {
  return (await sql`SELECT 1 FROM budget_blocked WHERE kind = ${kind} AND ref = ${ref} AND resumed_at IS NULL`).length > 0;
}

/** The work was done after all (resumed, or reached another way): its record goes, so that the alert and the next resume do not count it. */
export async function clearBudgetBlock(kind: BlockedKind, ref: string): Promise<void> {
  await sql`DELETE FROM budget_blocked WHERE kind = ${kind} AND ref = ${ref}`;
}
