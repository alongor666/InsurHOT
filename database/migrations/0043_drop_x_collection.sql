-- ADR-002 step 2, second part: X collection (SocialData) and the translation of quoted posts are
-- removed; their code went with this migration. Not reversible: the columns and the table dropped
-- here held the posts themselves. Their definitions before this migration are recorded in
-- docs/development/evidence/m0-4c-dropped-ddl.sql.

-- An X account can no longer be collected. Its row stays, because its articles reference it, as a
-- paused external source: nothing fetches an external source. icon_checked_at is set so that the icon
-- job, which no longer skips these rows by kind, does not go to x.com for one.
UPDATE sources SET kind = 'external', enabled = false, health = 'paused', config = '{}'::jsonb, cursor = NULL,
  next_fetch_at = NULL, icon_checked_at = now(), updated_at = now()
WHERE kind = 'x_search';
ALTER TABLE sources DROP CONSTRAINT sources_kind_check;
ALTER TABLE sources ADD CONSTRAINT sources_kind_check CHECK (kind IN ('rss', 'web_list', 'json_list', 'mp_account', 'external'));

-- What was published from X stays published, as news: its title and summary are in the publication.
UPDATE publications SET channel = 'news' WHERE channel = 'x';
ALTER TABLE publications DROP CONSTRAINT publications_channel_check;
ALTER TABLE publications ADD CONSTRAINT publications_channel_check CHECK (channel IN ('news'));

ALTER TABLE articles DROP COLUMN x_post, DROP COLUMN x_article;
DROP TABLE quote_translations;

-- SocialData's request budget (0022).
DELETE FROM budgets WHERE service = 'socialdata';

-- Its two alerts, if open: with the budget row gone nothing finds them again, and the next alert check
-- would close them as "recovered" (same as 0042 for the modules removed there).
UPDATE settings SET value = value - 'provider.refused.socialdata' - 'budget.day.socialdata'
WHERE key = 'alerts.state' AND jsonb_typeof(value) = 'object';
