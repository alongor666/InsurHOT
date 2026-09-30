// ADR-002 step 2: the model leaderboard and the Codex reset monitor are removed. Nothing public names
// them any more, no job belongs to them, their tables are gone, and the push tables that shared their
// migration are still there.
import "./setup.ts";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { llmsTxt } from "@aihot/backend/publication/llms";
import { sitemapXml } from "@aihot/backend/publication/sitemap";

let app: FastifyInstance;
before(async () => {
  const { buildApp } = await import("../apps/api/src/app.ts");
  app = await buildApp();
});
after(async () => {
  await app.close();
  await stopBoss();
  await closeDb();
});
const get = (url: string) => app.inject({ method: "GET", url });

test("their public and site APIs, share images and asset folders answer 404; the rest of the site still answers", async () => {
  const gone = [
    "/api/site/leaderboard/rules", "/api/site/leaderboard/sources", "/api/site/leaderboard/boards/overall", "/api/site/leaderboard/models/any",
    "/api/site/codex-reset", "/api/site/codex-reset/version", "/api/site/codex-reset/days/2026-09-30", "/api/v1/codex-resets", "/api/v1/codex-resets/recent",
    "/og/pages/leaderboard.png", "/og/pages/codex-reset.png", "/model-providers/openai.svg", "/leaderboard-sources/arena.svg",
  ];
  for (const url of gone) assert.equal((await get(url)).statusCode, 404, url);
  for (const url of ["/api/health", "/api/v1/items", "/og/site.png", "/og/pages/hot.png", "/llms.txt", "/sitemap.xml", "/openapi-v1.json"]) assert.equal((await get(url)).statusCode, 200, url);
  // The admin routes of the monitor are gone too: an unknown admin path, not a login prompt.
  assert.equal((await get("/api/admin/monitor/events")).statusCode, 404);
});

test("the machine-readable exits do not name them", async () => {
  assert.doesNotMatch((await get("/openapi-v1.json")).body, /codex|leaderboard/i);
  assert.doesNotMatch((await get("/llms.txt")).body, /leaderboard|codex/i);
  assert.doesNotMatch(llmsTxt({ hasDailies: true, hasWeekly: true, hasMonthly: true }), /leaderboard|codex/i);
  const sitemap = await sitemapXml();
  assert.doesNotMatch(sitemap, /\/leaderboard|\/codex-reset/);
  assert.match(sitemap, /<loc>[^<]+\/all<\/loc>/);
});

test("no scheduled job belongs to them, whatever the collection switch says", async () => {
  const saved = process.env.COLLECT_ENABLED;
  process.env.COLLECT_ENABLED = "true";
  try {
    // The list is built when the module loads: load a fresh copy with collection on.
    const { SCHEDULES } = await import(`../apps/worker/src/schedules.ts?removed-modules=${Date.now()}`) as typeof import("../apps/worker/src/schedules.ts");
    const names = SCHEDULES.map((s) => s.name);
    assert.ok(names.includes("sources.schedule"), "collection jobs are listed, so the switch was seen");
    assert.deepEqual(names.filter((n) => /^(leaderboard|monitor)\./.test(n)), []);
  } finally {
    if (saved === undefined) delete process.env.COLLECT_ENABLED; else process.env.COLLECT_ENABLED = saved;
  }
});

test("their tables are dropped; the push tables created beside them stay", async () => {
  const tables = (await sql<{ name: string }[]>`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema()`).map((t) => t.name);
  assert.deepEqual(tables.filter((t) => /^(lb_|monitor_)/.test(t) || t === "fx_rates"), []);
  for (const kept of ["notify_targets", "deliveries", "delivery_leases"]) assert.ok(tables.includes(kept), kept);
});
