-- ADR-002 step 2: the model leaderboard and the Codex reset monitor are removed (their code went with
-- this migration). Not reversible: the tables' definitions are in 0003, 0007, 0008 and 0011, and the
-- definitions as they stood before this migration are recorded in
-- docs/development/evidence/m0-4b-dropped-ddl.sql.
-- notify_targets, deliveries and delivery_leases (also created in 0003) stay: content pushes and alerts use them.
DROP TABLE lb_rankings, lb_scores, lb_snapshots, lb_aliases, lb_prices, lb_runs, lb_models;
DROP TABLE monitor_event_posts, monitor_events, monitor_posts, monitor_state;
DROP TABLE fx_rates;

-- What the two modules kept in settings: the leaderboard's fetch state and last check, and the model
-- chosen for the monitor capability.
DELETE FROM settings WHERE key IN ('leaderboard.fetch', 'leaderboard.last_check', 'models.monitor');

-- An alert of theirs still open would otherwise close with a "recovered" message for a module that no longer exists.
UPDATE settings SET value = value - 'monitor.stuck' - 'monitor.review' - 'leaderboard.fetch' WHERE key = 'alerts.state';
