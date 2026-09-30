# M0.4 第 2 步 a：删除 leaderboard 与 Codex 重置监控

2026-09-30；Refs #12、#4；依据 [ADR-002](../adr/002-optional-module-removal.md)（owner 2026-09-30 批准，含不可自动回退的 drop 迁移）；第 1 步见 [关闭态证据](m0-4a-features-off-evidence.md)。基线 main `d6ee4126`，分支 `feat/m0-4b-remove-leaderboard-monitor`。实施者为 Claude 会话单一写入；独立评审另派，结果绑定固定 HEAD 记录于 PR，以下自检不冒称独立评审。

ADR-002 第 2 步拆成两个 PR：本 PR 删 leaderboard、monitor 与只有模型榜使用的 `assets/model-providers`；X 采集（`x_search`、SocialData、`x_article`/`x_post`、`channel='x'`）与引文翻译留给下一个 PR，本 PR 不碰。

## 删除了什么

- 后端：`packages/backend/src/leaderboard/`、`monitor/`、`admin/monitor.ts`、`publication/monitor.ts`。
- contracts：`leaderboard.ts`、`monitor.ts`；`taxonomy.ts` 的榜单常量、`time.ts` 的 `toBeijingIso`（只有监控接口用）、`http-policy.ts` 的三条 leaderboard 规则、`/codex-reset/` 去尾斜杠、`codexResets` 缓存项与两个素材目录前缀。
- API：`routes/leaderboard.ts`；`site.ts`、`v1.ts` 的 codex-reset 接口；`admin.ts` 的 7 条 `/api/admin/monitor/*` 与侧栏计数里的 monitor 项；`og.ts` 的两张分享图；`static.ts` 的两个素材目录与 OpenAPI 路径过滤。
- web：`features/leaderboard/`、`features/monitor/`、6 个 leaderboard 路由文件、`codex-reset.tsx`、`admin/monitor.tsx` 及 `routes.ts` 里的 9 条登记；导航、`/more`、后台侧栏、`/agent` 页与后台运行页里的入口和面板；只有监控页用的 CSS。
- worker：`leaderboard.round`、`monitor.tick`、`monitor.lookback` 三个定时任务与启动时的首轮榜单入队。
- 共享代码里的残留：`operations/alerts.ts` 的三个告警（`monitor.stuck`、`monitor.review`、`leaderboard.fetch`）、`admin/runs.ts` 的榜单面板查询、`editorial/models.ts` 的 `monitor` capability（`MONITOR_MODEL`）、`notify/deliver.ts` 的 `codex_reset` 推送类别、`providers/money.ts` 的 `x:<id>` 主体形态（只有监控的模型步骤用过）。
- `industry/features.ts` 整个文件及全部 24 处读取。
- 脚本 `lb-round.ts`、`lb-fetch-check.ts`、`import-leaderboard-prices.ts`；seeds `database/seeds/lb-*.json`；素材 `assets/leaderboard-sources/`、`assets/model-providers/`；测试 `leaderboard-worker.test.ts`、`monitor.test.ts`；文档 `docs/leaderboard.md`。
- 公开 OpenAPI 参考文档（`reference/public-v1.openapi.json`）里的两条 codex-resets 路径与 5 个 `CodexReset*` schema（第 1 步评审登记的残留）。删除前后用同一序列化方式，未删部分逐字节不变。
- `.env.example` 的 `MONITOR_MODEL`、`ARTIFICIAL_ANALYSIS_API_KEY`。

## 数据库

迁移 [`0042_drop_leaderboard_monitor.sql`](../../database/migrations/0042_drop_leaderboard_monitor.sql)：

- drop `lb_models`、`lb_aliases`、`lb_snapshots`、`lb_scores`、`lb_runs`、`lb_rankings`、`lb_prices`、`monitor_posts`、`monitor_events`、`monitor_event_posts`、`monitor_state`、`fx_rates`（12 张表，索引随表删除）。
- 删除 `settings` 里两模块的 3 个键：`leaderboard.fetch`、`leaderboard.last_check`、`models.monitor`。
- 从 `alerts.state` 里去掉两模块的告警键：真正会误发「已恢复」的是 `monitor.stuck`、`monitor.review`（today 级，第一轮评审实测）；`leaderboard.fetch` 是 digest 级，本来进不了 `alerts.state`，一并清掉只为保险。其他告警键不动；该值不是对象时（只有手工改库才会出现）这一句不执行，迁移照常通过。
- **保留** `notify_targets`、`deliveries`、`delivery_leases`（与前述表同在迁移 0003，属通用推送）。
- 没有改写任何历史迁移文件。

不可自动回退。按 ADR-002 的回退条款，删除前的定义与行数记录在 [`m0-4b-dropped-ddl.sql`](evidence/m0-4b-dropped-ddl.sql)（main `d6ee412` 的全新库，12 张表均 0 行；当前没有已部署实例）。回退代码用 `git revert`，表需按该记录重建。

## 没有动的

- 付费闭锁：`outbound-policy.ts`、`receipts.ts` 未改；`tests/paid-lock-blocked*.txt` 未改（被删的两个测试文件本来就不在清单里）。`assertPaidOutboundDisabled()` 的调用点由 4 个变为 3 个——第 4 个在被删除的 `leaderboard/fetch/sources/artificial-analysis.ts` 里；其余 3 个原样。
- 根目录 `LICENSE` 与 `NOTICE` 未改。`NOTICE` 仍列着已删除的两个素材目录，那句「This repository also contains」对这两项已不成立；许可文件的处理留给 ADR-003，已在 #12 登记为待办。
- `vendor-manifests/` 的上游清单与映射未改：它们记录 M0.2 导入时的 489 个文件，原样校验本来就只适用于 M0.2 树（见 `UPSTREAM.md`）。
- X 采集与引文翻译的全部代码、表与测试。`providers/socialdata.ts` 的 `getTweet` 删除监控后已无调用方，随下一个 PR 整个文件删除。
- `deliveries` 里历史的 `subject_kind = 'codex_reset'` 行（如有）不处理；该列没有 CHECK 约束。
- pg-boss 里已存在的 `cron.leaderboard.*`、`cron.monitor.*` 调度由 worker 启动时的既有逻辑取消（`registerSchedules` 会取消不在当前列表里的 `cron.*`）。

## 验证

环境：Node 25、本机 PostgreSQL 18.1 的一次性库；采集与模型开关关闭；未发出任何外部请求。日志中的主机名、本机路径与数据库用户已替换。

| 命令 | 结果 | 日志 |
|---|---|---|
| `npm run typecheck` | exit 0 | [`m0-4b-typecheck.log`](evidence/m0-4b-typecheck.log) |
| `npm run build -w @aihot/web` | exit 0 | 未入库 |
| `node --test apps/web/tests/*.test.ts` | 11/11 | 未入库 |
| `node scripts/migrate.ts`（全新库） | 39 个迁移，含 0042 | [`m0-4b-migrate.log`](evidence/m0-4b-migrate.log) |
| `node scripts/seed.ts`（全量） | 38 个 topic、18 个信源 | [`m0-4b-seed.log`](evidence/m0-4b-seed.log) |
| `node --test tests/removed-modules.test.ts` | 4/4 | [`m0-4b-removed-modules-tests.log`](evidence/m0-4b-removed-modules-tests.log) |
| `bash scripts/test-unlocked.sh` | 151/151（27 个文件，跳过付费闭锁挡住的 15 个用例） | [`m0-4b-unlocked.log`](evidence/m0-4b-unlocked.log) |
| 0042 作用在已有数据的旧库上 | 见下 | [`m0-4b-migrate-incremental.log`](evidence/m0-4b-migrate-incremental.log) |
| `node scripts/smoke.ts --base http://127.0.0.1:3000`（本机 API + 已构建的 web）与逐页请求 | all checks passed；见下 | [`m0-4b-smoke.log`](evidence/m0-4b-smoke.log) |

用例数的变化：第 1 步是 155 个、29 个文件；删掉 `leaderboard-worker.test.ts`（2 个）与 `monitor.test.ts`（2 个），`features-off.test.ts`（4 个）改写为 `removed-modules.test.ts`（4 个），所以是 151 个、27 个文件。

**迁移作用在旧库上**：先建一个停在 0041 的库，向 `lb_models`、`lb_aliases`（带外键）、`monitor_state`、`settings`（3 个待删键 + 1 个 `models.score`，以及一条含 `monitor.stuck`、`leaderboard.fetch`、`backup.stale` 三个开着的告警的 `alerts.state`）、`notify_targets` 各写一行，再跑迁移。结果：12 张表全部消失；三张推送表仍在，`notify_targets` 的行还在；`settings` 只剩 `models.score`；`alerts.state` 只剩 `backup.stale`（对照用的键；它也是 digest 级，真实运行中不会出现在这里）；再跑一次迁移报告 up to date。

**站点**：`/leaderboard`、`/leaderboard/rules`、`/leaderboard/sources`、`/leaderboard/category/coding`、`/leaderboard/methodology`、`/codex-reset`、`/codex-reset/`、`/admin/monitor`、`/api/v1/codex-resets`、`/api/admin/monitor/events`、`/model-providers/openai.svg`、`/og/pages/leaderboard.png` 全部 404；`/`、`/all`、`/more`、`/agent`、`/admin/login` 为 200；首页、`/more`、`/agent` 的 HTML 里没有指向两模块的链接。

**worker**：本机启动后正常报告 started 并可正常停止；pg-boss 的调度表里没有 `cron.leaderboard.*` 与 `cron.monitor.*`。

**测试的区分力**：`removed-modules.test.ts` 第 4 项在停在 0041 的库上失败（其余 3 项通过），迁到 0042 后通过。前 3 项在第 1 步已做过变异检查（开关打开时失败）；代码删除后这些路由不可能存在，它们现在的作用是防止以后被接回来。

残留搜索：`grep -rn -i "leaderboard\|codex\|lb_\|model-providers\|模型榜\|重置" apps packages scripts industry tests reference .env.example`（排除构建产物）只剩：新测试自身、`/agent` 页里 `codex mcp add` 的接入示例、`industry/taxonomy.ts` 与 `industry/prompts/rules-domain.md` 里把 Codex 当作 OpenAI 产品名的分类词（属行业内容，随内容替换处理，不在 ADR-002 内）。

第一轮独立评审（绑定 `877cbce`，APPROVE，4 项 P3）已在本版处理：告警文案里残留的「重置通知」改掉（原残留搜索只搜了「重置监控」，漏了它）；迁移清理 `alerts.state`；`removed-modules.test.ts` 第 3 项补上 SocialData 凭据，使被接回的监控调度会被查出；`NOTICE` 一项登记到 #12。另删了已无调用方的 `IconChart`。第二轮（绑定 `d349540`，APPROVE，2 项 P3）：迁移里清理 `alerts.state` 的语句加上「值是对象」的条件；上文对 `leaderboard.fetch` 与 `backup.stale` 级别的表述已更正。

## 未运行

- Docker 镜像内的构建与冒烟（本机无 Docker；M0.5 #13）。
- 登录后台后的页面（运行页、侧栏）：未创建管理员账号，只做了 typecheck 与构建。
- 从一个真的跑过榜单/监控的库升级：没有这样的库；用上面"旧库带行"的实验代替。

## 回退

`git revert` 本 PR 的合并提交恢复代码、素材与 seeds；数据库需按 [`m0-4b-dropped-ddl.sql`](evidence/m0-4b-dropped-ddl.sql) 重建表，并从 `schema_migrations` 里移除 0042 的记录（或新增一个重建迁移）。
