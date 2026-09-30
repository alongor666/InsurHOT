-- ADR-015 section 8: work the monetary limits refused stops in a state an admin can see, and does not
-- come back by itself (no delay, no retry, no count against the article). An admin resumes it after
-- the owner raised a limit or approved a price.

-- An article whose analysis was refused.
ALTER TABLE articles DROP CONSTRAINT articles_processing_state_check;
ALTER TABLE articles ADD CONSTRAINT articles_processing_state_check
  CHECK (processing_state IN ('new', 'analyzed', 'skipped', 'failed', 'blocked', 'budget_blocked'));
CREATE INDEX articles_budget_blocked_idx ON articles (discovered_at) WHERE processing_state = 'budget_blocked';

-- Other refused work: grouping an article (ref = article id), a story digest (ref = story id),
-- a report (ref = kind:key). `job` is what the queue needs to run it again.
CREATE TABLE budget_blocked (
  kind        text NOT NULL CHECK (kind IN ('group', 'digest', 'report')),
  ref         text NOT NULL,
  job         jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason      text NOT NULL,
  blocked_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, ref)
);
