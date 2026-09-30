// ADR-002 step 1: with the two AI-only modules switched off (industry/features.ts) the model
// leaderboard and the Codex reset monitor are gone from every public exit and from the scheduler,
// while the rest of the site answers as before. The code itself is removed in step 2.
import "./setup.ts";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { FEATURES } from "@aihot/industry/features";
import { closeDb } from "@aihot/backend/db";
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

test("both optional modules are off", () => {
  assert.deepEqual({ ...FEATURES }, { leaderboard: false, codexResetMonitor: false });
});

test("their public and site APIs, share images and asset folders answer 404; the rest of the site still answers", async () => {
  const gone = [
    "/api/site/leaderboard/rules", "/api/site/leaderboard/sources", "/api/site/leaderboard/boards/overall", "/api/site/leaderboard/models/any",
    "/api/site/codex-reset", "/api/site/codex-reset/version", "/api/site/codex-reset/days/2026-09-30", "/api/v1/codex-resets", "/api/v1/codex-resets/recent",
    "/og/pages/leaderboard.png", "/og/pages/codex-reset.png", "/model-providers/openai.svg", "/leaderboard-sources/arena.svg",
  ];
  for (const url of gone) assert.equal((await get(url)).statusCode, 404, url);
  for (const url of ["/api/health", "/api/v1/items", "/og/site.png", "/llms.txt", "/sitemap.xml", "/openapi-v1.json"]) assert.equal((await get(url)).statusCode, 200, url);
});

test("the machine-readable exits no longer name them", async () => {
  const openapi = (await get("/openapi-v1.json")).json() as { paths: Record<string, unknown> };
  assert.deepEqual(Object.keys(openapi.paths).filter((p) => /codex|leaderboard/i.test(p)), []);
  const llms = (await get("/llms.txt")).body;
  assert.doesNotMatch(llms, /leaderboard|codex-reset|codex_reset/i);
  // Even told that a leaderboard run exists, the text leaves it out while the module is off.
  assert.doesNotMatch(llmsTxt({ hasDailies: true, hasWeekly: true, hasMonthly: true, hasLeaderboard: true }), /leaderboard|codex-reset/i);
  const sitemap = await sitemapXml();
  assert.doesNotMatch(sitemap, /\/leaderboard|\/codex-reset/);
  assert.match(sitemap, /<loc>[^<]+\/all<\/loc>/);
});

test("no scheduled job belongs to them, whatever the collection switch says", async () => {
  const saved = { collect: process.env.COLLECT_ENABLED, key: process.env.SOCIALDATA_API_KEY };
  process.env.COLLECT_ENABLED = "true";
  process.env.SOCIALDATA_API_KEY = "test-key-for-the-schedule-list";
  try {
    // The list is built when the module loads: load a fresh copy with collection on and a SocialData key present.
    const { SCHEDULES } = await import(`../apps/worker/src/schedules.ts?features-off=${Date.now()}`) as typeof import("../apps/worker/src/schedules.ts");
    const names = SCHEDULES.map((s) => s.name);
    assert.ok(names.includes("sources.schedule"), "collection jobs are listed, so the switch was seen");
    assert.deepEqual(names.filter((n) => /^(leaderboard|monitor)\./.test(n)), []);
  } finally {
    if (saved.collect === undefined) delete process.env.COLLECT_ENABLED; else process.env.COLLECT_ENABLED = saved.collect;
    if (saved.key === undefined) delete process.env.SOCIALDATA_API_KEY; else process.env.SOCIALDATA_API_KEY = saved.key;
  }
});
