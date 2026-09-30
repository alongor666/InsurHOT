# ADR-002：删除上游可选模块与 AI 行业专用采集

状态：Proposed（2026-09-30，Claude 会话起草，供 owner 裁决；按 `docs/phase0/delivery-gates.md` §5，模块删除属 Codex 可逆技术裁决，但本 ADR 把范围从"leaderboard/monitor"扩大到 AI 行业专用采集，扩大部分需 owner 确认）。Refs #4、#12。

## 背景

上游 AIHOT 以 `industry/features.ts` 的两个开关声明可选模块：`leaderboard`（模型榜）与 `codexResetMonitor`（Codex 重置监控）。上游注释明说它们"只对 AI 行业有意义"。此外，X（Twitter）搜索采集（`x_search` 信源、迁移 0037 `x_article`）、引文翻译（迁移 0038 `quote_translations`）与 `assets/model-providers` 也只服务 AI 资讯场景。InsurHOT 面向保险行业公开信息，且付费闭锁（M0.3a）使依赖 SocialData 的 X 采集与 monitor 在 M0.3b 前无法运行。

盘点（main `f08fe132`，不含构建产物与 typegen）：
- leaderboard：web 路由 6 个（`leaderboard*.tsx`）、`apps/web/app/features/leaderboard`、`packages/backend/src/leaderboard`（含 `fetch/sources` 6 个来源、`method`）、`packages/contracts/src` 3 处、API 路由 3 处、worker 调度 2 处、`scripts` 5 个（`lb-*`、`import-leaderboard-prices`、`eval-selection` 部分）、迁移 0003/0007/0011、`database/seeds` 1、`assets/leaderboard-sources`、`tests/leaderboard-worker.test.ts`。
- monitor：`packages/backend/src/monitor`、`apps/web/app/features/monitor`、`codex-reset.tsx` 路由与 nav/more/agent/admin 布局引用、API 路由 3 处、worker 2 处、迁移 0003/0008、`tests/monitor.test.ts`、`packages/backend/src/providers` 1 处（SocialData）。
- X 采集：36 个文件引用 `x_search`/`x-article`/`socialdata`；迁移 0037；`tests/x-article.test.ts`、`tests/x-shards.test.ts`。
- 引文翻译：5 个文件；迁移 0038。
- `FEATURES` 消费方 15 处（nav、agent、more、admin 布局、og/site/v1/static 路由、worker 调度与入口、sitemap、llms.txt、smoke、seed）。

## 决定（建议）

分两步，每步独立 PR、可回退：

1. **先关后删**：M0.4 第一提交把 `FEATURES.leaderboard` 与 `FEATURES.codexResetMonitor` 置 `false`，验证 15 个消费方在关闭态下导航无入口、路由与接口 404、调度不注册、sitemap/llms.txt 不列出、smoke 与 seed 不依赖。这一步不删代码，回退只改两个布尔值。
2. **再删**：按上表逐目录删除 leaderboard、monitor、X 采集（`x_search` 信源类型、SocialData provider、0037 表及其 ingest 路径）、引文翻译（0038）与 `assets/model-providers`；同步删除对应 contracts、路由、调度、脚本、测试与 seed；新增一个迁移 drop 对应表（0003/0007/0008/0011/0037/0038 建的表），不改写历史迁移文件。删除后以 `npm run typecheck`、`grep` 无残留引用、应用 CI 绿为完成条件。

保留：`industry/features.ts` 文件本身（改为空对象或删除由实施时定，避免 15 处消费方大改），SocialData 以外的采集通道（RSS/web_list/json_list/mp_account/external）。

## 备选方案

- **A. 只关不删（保持上游 `false` 开关）**：改动最小，但 36+ 文件的死代码、付费 provider 代码路径与 6 张空表长期留在仓内，M0.3b 预算边界还要为不会使用的 provider 建价格表；且上游注释建议"做别的行业时整块删掉"。不采纳。
- **B. 一次性删除全部（不先关）**：少一个 PR，但失去"关闭态行为已验证"这个回退点，且删除范围大、评审难。不采纳。
- **C. 保留 X 采集作为保险行业社媒信源**：需要 SocialData 付费与 M0.3b 边界，且 ADR-018 采集合规对社媒来源权限尚未裁决。推迟：先删，将来按 ADR-018 决定是否以新形态接回。

## 后果

- 删除后 `npm test` 中 leaderboard-worker、monitor、x-article、x-shards 四个文件随代码移除；`tests/paid-lock-blocked.txt`（#10）对应条目同步删除。
- 迁移新增 drop 表；已部署实例（当前无）需按回退说明处理数据。
- 品牌清理（ADR-003）依赖本 ADR 完成后再做，减少改名面。

## 回退

步骤 1：还原两个布尔值。步骤 2：revert 删除提交；drop 表迁移不可自动回退，当前无生产数据，删除前在临时 PG 记录表结构。
