# M0 本机 PostgreSQL 补跑：迁移、seed、backend tests 清单

2026-09-30；Refs #4、#10、#13。基线 main `f08fe132e997544b8edb9ee75ff886bf0d2c74ab`（M0.2 + M0.3a 合并后）。#6/#7/#9 均把 PG 相关项记为 NOT RUN，理由是"无 PG"；本机实际有 Homebrew PostgreSQL 18.1，本文档补跑并记录结果。实施者为 Claude 会话；不改业务代码，只出证据与清单。

## 环境

- 隔离 worktree detach 在上述 main SHA；`npm ci --ignore-scripts`；Node v25.5.0（满足 `engines >=24.11`；CI 用 Node 24）。
- 临时库 `insurhot_test`（满足 `tests/setup.ts` 的 `*_test` 约束），每轮 `drop/create` 重建；未连接任何非临时库。
- 环境：`DATABASE_URL=postgres://<local-user>@127.0.0.1:5432/insurhot_test`、`SITE_URL`/`API_BASE_URL` 指向 127.0.0.1、测试用 `SESSION_SECRET`/`IMG_PROXY_SIGN_SECRET`、`COLLECT_ENABLED=false`、`MODEL_CALLS_ENABLED=false`。变量集合沿用 `docs/upstream/workflows/check.yml`，但两处不同：check.yml 只在 smoke 步骤显式设 `COLLECT/MODEL=false`，backend tests 步骤为未设置（M0.3a 下效果相同）；CI 用 PG 17 + Node 24，本机是 PG 18.1 + Node 25.5。
- 日志脱敏规则：`"hostname":"…"` → `redacted`；worktree 与仓库绝对路径 → `<repo>`；`postgres://<user>@` → `<local-user>`。除此之外未改动日志内容；迁移/seed/web 日志末尾的 `exit=N` 由运行命令时 `echo "exit=$?"` 追加；`m0-pg-backend-tests.log` 沿用第一轮的运行结果未重生成，末尾为 `backend tests exit=1`。
- 未启动 API/worker 监听、未做 Docker smoke（本机无 Docker）。

## 结果

| 命令 | 结果 | 日志 |
|---|---|---|
| `node scripts/migrate.ts` | 35 个迁移全部应用（0001–0038，含 0036/0037/0038），exit0 | [migrate](evidence/m0-pg-migrate.log) |
| `node scripts/seed.ts --topics-only` | topics: 38，exit0 | [seed](evidence/m0-pg-seed.log) |
| `node --test apps/web/tests/*.test.ts`（build 前） | 2/11 PASS，exit1：缺 `apps/web/build/server/index.js` | [web tests without build](evidence/m0-pg-web-tests-without-build.log) |
| `npm run build -w @aihot/web` | 客户端+SSR PASS，exit0 | [web build](evidence/m0-pg-web-build.log) |
| `node --test apps/web/tests/*.test.ts`（build 后） | 11/11 PASS，exit0；CI 顺序须先 build | [web tests](evidence/m0-pg-web-tests.log) |
| `npm test`（30 个文件，132 用例，串行） | **73 PASS / 56 FAIL / 3 cancelled，exit1**，耗时 373s；下文"失败"统一指 56 fail + 3 cancelled = 59 条 | [backend tests](evidence/m0-pg-backend-tests.log) |

首次尝试在主检出目录运行时，本会话中途切换了分支，结果作废；上表为隔离 worktree 内重跑的结果。

## 失败归因

59 条（56 fail + 3 cancelled）中，**29 条可从日志直接确认**为 M0.3a 门控（模型门 20、采集门 9）；**其余 30 条为推断**（付费闭锁 5，其中 3 条为超时取消；二阶后果 25）——日志只有断言结果（`'failed' !== 'ok'`、`0 !== 30`、`undefined.status` 等），`LOG_LEVEL=error` 压掉了采集失败的底层原因，未做反事实重跑。在日志中全文搜索 relation/column/syntax error/ECONNREFUSED/deadlock/constraint/violates/duplicate key 均无命中，因此"无数据库相关失败"只在日志层面成立。

| 类别 | 直接错误 | 涉及文件（失败/取消数） |
|---|---|---|
| 模型门（直接确认） | `Model calls are disabled (MODEL_CALLS_ENABLED=false)` | events(10)、analyze(6)、signals(2)、receipts(1)、default-model(1) |
| 采集门（直接确认） | `Outbound collect disabled: COLLECT_ENABLED=true required` | sources(4)、media-performance(5) |
| 付费闭锁（推断；两文件自行设 `MODEL_CALLS_ENABLED=true`，仍被 `paidRequest` 无条件拦截） | AssertionError "ended before a request" / 120s 超时（cancelled） | translate-shutdown(2)、analyze-shutdown(3，cancelled) |
| 门控的二阶后果（推断：断言"没有请求发出"/读到 undefined） | AssertionError / TypeError | listings(4)、source-rules(4)、x-shards(3)、translate(3)、x-article(2)、rss-conditional(2)、collection(2)、media-performance(2)、receipts(2)、signals(1) |

全部通过的文件（14）：alerts、embeddings、feedback、feedback-upload、hot-avatar-payload、icons、leaderboard-worker、materials、mcp-shutdown、monitor、outbound-policy、publication、report-lead、url。

## 对 #10（应用 CI）的输入

- 上游测试把 provider 指向本地 stub（`tests/setup.ts` 的 `stub()`），门控开关在 `tests/setup.ts` 里没有设置，所以默认拒绝会拦住它们。M0.3a 证据已预告这一点。
- 采集门是"字面值 true 即放行"的免费路径；模型/embeddings/SocialData/Jina/Dajiala 全部经 `paidRequest`，闭锁无环境旁路，在 M0.3b 前无法通过。
- **只开 `COLLECT_ENABLED=true` 并不安全**（独立评审 P1）：被门控的测试文件普遍设置 `allowPrivateNetworkFetch=true`，此时 `assertPublicUrl` 直接放行、`dispatcherFor` 不再挂 `guardedLookup`，测试进程可访问任意公网地址。因此 #10 需先增加一个请求层的仅-loopback 拦截（按主机名在 DNS 前拒绝、连接时再核对实际地址，覆盖代理与 `ALLOW_PRIVATE_NETWORK_FETCH`），并以测试证明公网名称与重定向到公网均被拒；在此之后才在测试进程内开采集门。该拦截在 PR #19 以 `OUTBOUND_LOOPBACK_ONLY` 实现；#19 尚未合并、未经独立评审，不构成本文档的前置条件已满足。
- 仍依赖 `paidRequest` 的用例按文件/用例列清单排除并记原因（#19 的 `tests/paid-lock-blocked*.txt`），待 M0.3b 解除；每个被门控的用例都是上游行为的回归证据，不删除。

## 未声称的性质

- 本轮只证明 main 树的迁移可应用、topics 可 seed、门控之外的 backend 测试在 PG 上通过；不证明 Docker、生产配置或 D1（#9，迁移 0039 不在 main）的 PG 行为。#9/#16 的 PG 验证需在其分支上另跑。
- M0.3a 的 `/tmp/m03a-*.log` 证据文件在本机已不存在（`ls /tmp/m03a-*` 无匹配），无法入库；其结论以 PR #7 正文与 `m0-3a-evidence.md` 为准，本轮不复现。
- 本轮不含独立评审；文档与日志的一致性由独立只读评审绑定 PR HEAD 另行核对。
