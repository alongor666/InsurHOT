# ADR-002：删除上游可选模块与 AI 行业专用采集

状态：Accepted（owner 于 2026-09-30 在实施会话中批准，含把范围扩大到 X 采集、引文翻译与 `assets/model-providers`，以及第 2 步不可自动回退的 drop 表迁移；正文由 Claude 会话于同日起草，批准时未改动决定内容）。第 1 步证据见 [`m0-4a-features-off-evidence.md`](../development/m0-4a-features-off-evidence.md)。Refs #4、#12。

## 背景

上游 AIHOT 以 `industry/features.ts` 的两个开关声明可选模块：`leaderboard`（模型榜）与 `codexResetMonitor`（Codex 重置监控）。上游注释明说它们"只对 AI 行业有意义"。此外，X（Twitter）搜索采集（`x_search` 信源类型、SocialData provider）、引文翻译（`quote_translations`，按 `tweet_id` 关联，只服务 X）与 `assets/model-providers` 也只服务 AI 资讯场景。InsurHOT 面向保险行业公开信息，且付费闭锁（M0.3a）使依赖 SocialData 的 X 采集与 monitor 在 M0.3b 前无法运行。

## 盘点（main `f08fe132`；一律排除 `apps/web/build`、`.react-router`、`node_modules`）

计数命令写在每行后，便于复核；数字与命令不符时以命令为准。

- leaderboard
  - web 路由 6 个：`ls apps/web/app/routes | grep -c leaderboard`
  - `apps/web/app/features/leaderboard/`
  - `packages/backend/src/leaderboard/`，其中 `fetch/sources/` 10 个来源文件：`ls packages/backend/src/leaderboard/fetch/sources | wc -l`
  - `packages/contracts/src` 3 处、`apps/api/src/routes` 3 处（加 `app.ts` 注册共 4）、worker 调度 2 处（`grep -rli leaderboard <dir>`）
  - 脚本 4 个：`lb-fetch-check.ts`、`lb-round.ts`、`import-leaderboard-prices.ts`、`eval-selection.ts`（后者部分）
  - seeds 2 个：`database/seeds/lb-models-*.json`、`lb-official-prices-*.json`
  - `assets/leaderboard-sources/`、`tests/leaderboard-worker.test.ts`
- monitor
  - `packages/backend/src/monitor/`、`apps/web/app/features/monitor/`、`codex-reset.tsx` 路由及 nav/more/agent/admin 布局引用、API 路由 3 处、worker 2 处、`tests/monitor.test.ts`、SocialData provider
- X 采集：32 个文件引用采集/provider 标识（`grep -rlE "x_search|x-article|socialdata" apps packages industry database scripts tests | grep -vE "/build/|\.react-router" | wc -l`）；连同 `x_post`/`x_article` 列的消费方共 43 个（把 `x_post|x_article` 加进同一正则）；`tests/x-article.test.ts`、`tests/x-shards.test.ts`
- 引文翻译：5 个文件（`grep -rlE "quote_translation|translateQuote" apps packages database tests | wc -l`）
- `FEATURES` 消费方 15 处（`grep -rl "FEATURES\." apps packages industry scripts | grep -v "/build/\|\.react-router"`）：nav、agent、more、admin 布局、og/site/v1/static 路由、worker 调度与入口、sitemap、llms.txt、smoke、seed

### 数据库对象（逐个列出，不按迁移文件整体删除）

| 迁移 | 建的对象 | 处置 |
|---|---|---|
| 0003 | `lb_aliases`、`lb_models`、`lb_rankings`、`lb_runs`、`lb_scores`、`lb_snapshots` 及索引 | 删 |
| 0003 | `monitor_events`、`monitor_event_posts`、`monitor_posts`、`monitor_state` 及索引 | 删 |
| 0003 | `fx_rates` | 删——消费方只有 `leaderboard/method/run.ts`、`leaderboard/fetch/refresh.ts`（`grep -rl fx_rates packages apps scripts`） |
| 0003 | **`notify_targets`、`deliveries`、`delivery_leases`** | **保留**——通用推送/运维基础设施，被 `notify/deliver.ts`、`notify/selected.ts`、`operations/alerts.ts`、`operations/retention.ts`、`admin/runs.ts`、`admin/settings.ts` 使用，不属于 leaderboard |
| 0007 | `lb_prices` | 删 |
| 0008 | 索引 `monitor_event_posts_post_idx` | 随表删 |
| 0011 | 唯一索引 `lb_aliases_source_alias_key` | 随表删 |
| 0037 | 列 `articles.x_article` | 删列 |
| 0038 | `quote_translations` | 删 |
| 0001 | `sources.kind` CHECK 含 `'x_search'`；列 `articles.x_post`（`publication/feeds.ts`、`publication/items.ts`、`editorial/input.ts`、`translate.ts`、`publication/publish.ts`、`detail.ts` 等 `channel='x'` 发布路径引用）；`publications.channel CHECK (channel IN ('news','x'))`（`0001_core.sql:227`） | 新迁移收窄 `sources.kind` CHECK、收窄 `publications.channel` 为 `('news')`；`x_post` 列与 `channel='x'` 路径一并移除，消费方逐处清理 |
| 0022 | 预置 `socialdata` 预算行 | 新迁移删除该行 |

## 决定

分两步，每步独立 PR：

1. **先关后删**（可逆）：把 `FEATURES.leaderboard` 与 `FEATURES.codexResetMonitor` 置 `false`，验证 15 个消费方在关闭态下导航无入口、路由与接口 404、调度不注册、sitemap/llms.txt 不列出、smoke 与 seed 不依赖。回退只改两个布尔值。
2. **再删**（drop 表不可自动回退；owner 已确认）：按盘点删除 leaderboard、monitor、X 采集（`x_search` 信源类型、SocialData provider、`x_article`/`x_post` 列及 `channel='x'` 发布路径）、引文翻译与 `assets/model-providers`；同步删除对应 contracts、路由、调度、脚本、测试与 seeds；新增一个迁移按上表 drop 表/列、收窄 `sources.kind` CHECK、删除 `socialdata` 预算行，不改写历史迁移文件。完成条件：`npm run typecheck`、`grep` 无残留引用、应用 CI 绿、上表"保留"对象仍存在且推送测试（`tests/alerts.test.ts`、`tests/feedback*.test.ts`）通过。

保留：`industry/features.ts` 文件（改为空对象或删除由实施时定），SocialData 以外的采集通道（RSS/web_list/json_list/mp_account/external），`notify_*`/`deliveries*` 表。

## 备选方案

- **A. 只关不删（保持上游 `false` 开关）**：改动最小，但 32+ 文件的死代码、付费 provider 代码路径与十余张空表长期留在仓内，M0.3b 预算边界还要为不会使用的 provider 建价格表；上游注释也建议"做别的行业时整块删掉"。不采纳。
- **B. 一次性删除全部（不先关）**：少一个 PR，但失去"关闭态行为已验证"这个回退点，且删除范围大、评审难。不采纳。
- **C. 保留 X 采集作为保险行业社媒信源**：需要 SocialData 付费与 M0.3b 边界，且 ADR-018 采集合规对社媒来源权限尚未裁决。推迟：先删，将来按 ADR-018 决定是否以新形态接回。

## 后果

- 删除后 `npm test` 中 leaderboard-worker、monitor、x-article、x-shards 四个文件随代码移除；`tests/paid-lock-blocked.txt`（#19）对应条目同步删除。
- 迁移新增 drop 表/列；当前无已部署实例；回退见下。
- 品牌清理（ADR-003）依赖本 ADR 完成后再做，减少改名面。

## 回退

步骤 1：还原两个布尔值。步骤 2：revert 删除提交可恢复代码；drop 迁移不可自动回退——删除前在临时 PG 导出被删对象的 DDL 与行数记录，回退需按记录重建（当前无生产数据，代价为零）。这也是第 2 步单独取得 owner 确认的原因。
