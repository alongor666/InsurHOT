# M0.4 第 1 步：关闭两个 AI 行业专用模块（ADR-002「先关后删」）

2026-09-30；Refs #12、#4；依据 [ADR-002](../adr/002-optional-module-removal.md)（owner 2026-09-30 批准）。基线 main `15fe7e23`，分支 `feat/m0-4a-features-off`。实施者为 Claude 会话单一写入；独立评审另派，结果绑定固定 HEAD 记录于 PR，以下自检不冒称独立评审。

## 范围

- [`industry/features.ts`](../../industry/features.ts)：`leaderboard`、`codexResetMonitor` 由 `true` 改为 `false`。没有删除任何代码、表或素材——删除是第 2 步。
- [`tests/features-off.test.ts`](../../tests/features-off.test.ts)：4 项，固定关闭态的对外行为。
- ADR-002 状态记为 Accepted；[行动计划](action-plan.md) M0.4 行写入 owner 的两项决定（批准 ADR-002；模块删除排在 M0.3b 第 3 步之前）。ADR-003、ADR-015 状态未动。

## 关闭态下的行为

开关的读取点共 24 处（`grep -rn "FEATURES\." apps packages scripts industry --include='*.ts' --include='*.tsx'`，排除构建产物），关闭后：

| 出口 | 关闭态 | 证据 |
|---|---|---|
| 站点接口 `/api/site/leaderboard/*`、`/api/site/codex-reset*` | 路由不注册，404 | 测试第 2 项 |
| 公开接口 `/api/v1/codex-resets`、`/recent` | 404；OpenAPI 文档不含该路径 | 测试第 2、3 项 |
| 分享图 `/og/pages/leaderboard.png`、`/og/pages/codex-reset.png` | 404 | 测试第 2 项 |
| 素材目录 `/model-providers/*`、`/leaderboard-sources/*` | 404 | 测试第 2 项 |
| `llms.txt`、`sitemap.xml` | 不出现两模块的任何地址；即使告知"榜单已有一轮"也不列出 | 测试第 3 项 |
| 定时任务 | 采集开关为 `true` 且存在 SocialData 凭据时，调度表里仍没有 `leaderboard.*` 与 `monitor.*` | 测试第 4 项 |
| 页面 `/leaderboard`、`/leaderboard/rules`、`/leaderboard/sources`、`/codex-reset` | 404（页面的数据接口已 404） | 本机起 API 与 web 后逐个请求 |
| 导航（首页、`/more`、后台侧栏） | 无两模块入口 | 首页与 `/more` 的 HTML 中搜不到 `/leaderboard`、`/codex-reset` 链接 |
| seed | 全量 seed 不写榜单模型：`lb_models` 0 行 | [`m0-4a-seed.log`](evidence/m0-4a-seed.log) |
| smoke | 已构建站点的冒烟脚本不再访问两模块页面，全部通过 | [`m0-4a-smoke.log`](evidence/m0-4a-smoke.log) |

其余站点不受影响：`/api/health`、`/api/v1/items`、`/og/site.png`、`/llms.txt`、`/sitemap.xml`、`/openapi-v1.json` 仍为 200（测试第 2 项）；`/`、`/all`、`/more` 页面 200。

## 验证

| 命令 | 结果 | 日志 |
|---|---|---|
| `npm run typecheck` | exit 0 | [`m0-4a-typecheck.log`](evidence/m0-4a-typecheck.log) |
| `npm run build -w @aihot/web` | exit 0 | 未入库（与此前构建日志同形） |
| `node --test tests/features-off.test.ts` | 4/4 | [`m0-4a-features-off-tests.log`](evidence/m0-4a-features-off-tests.log) |
| `bash scripts/test-unlocked.sh` | 155/155（29 个文件，跳过付费闭锁挡住的 15 个用例） | [`m0-4a-unlocked.log`](evidence/m0-4a-unlocked.log) |
| `node scripts/seed.ts`（全量，另建的一次性库 `insurhot_seed_test`，用后即删） | 38 个 topic、18 个信源，`lb_models` 0 行 | [`m0-4a-seed.log`](evidence/m0-4a-seed.log) |
| `node scripts/smoke.ts --base http://127.0.0.1:3000`（本机 API + 已构建的 web） | all checks passed | [`m0-4a-smoke.log`](evidence/m0-4a-smoke.log) |

变异检查：把两个开关改回 `true` 后，`tests/features-off.test.ts` 4 项全部失败（0 通过），还原后 4 项通过。测试因此确实依赖开关值，而非恒真。

环境：Node 25、本机 PostgreSQL 18 的一次性库 `insurhot_test`（38 个迁移文件，编号至 0041）；采集与模型开关关闭；未发出任何外部请求。日志中的主机名、本机路径与数据库用户已替换。

## 关闭后仍留在仓内的部分（第 2 步删除）

这些不受开关控制，本步不处理：

- 后台监控接口 `/api/admin/monitor/*`（[`apps/api/src/routes/admin.ts`](../../apps/api/src/routes/admin.ts) 7 条）始终注册，需管理员登录；web 的 `/admin/monitor` 路由也在，未登录时 302 到登录页。侧栏入口已随开关消失。
- web 的页面路由（`apps/web/app/routes.ts` 里 leaderboard 6 条、codex-reset 2 条）仍登记，靠数据接口 404 才返回 404；`http-policy.ts` 里 `/leaderboard/methodology` 的 308 跳转仍在，跳转目标 404。
- worker 的监控与榜单队列处理器、X 采集（`x_search`、SocialData）、引文翻译、`assets/model-providers`、相关表与 seeds、`tests/paid-lock-blocked*.txt` 中对应条目。X 采集与引文翻译没有开关，本步对它们没有任何影响；它们由采集开关与付费闭锁挡住。

## 未运行

- Docker 镜像内的冒烟（本机无 Docker；M0.5 #13）。
- 登录后台后的侧栏检查：未创建管理员账号，只从代码确认侧栏项由 `FEATURES.codexResetMonitor` 控制（`apps/web/app/routes/admin/layout.tsx:32`）。

## 回退

把两个布尔值改回 `true`，并删除或改写 `tests/features-off.test.ts`。
