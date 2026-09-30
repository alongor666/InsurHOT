# M0 本机 PostgreSQL 补跑：迁移、seed、backend tests 清单

2026-09-30；Refs #4、#10、#13。基线 main `f08fe132e997544b8edb9ee75ff886bf0d2c74ab`（M0.2 + M0.3a 合并后）。#6/#7/#9 均把 PG 相关项记为 NOT RUN，理由是"无 PG"；本机实际有 Homebrew PostgreSQL 18.1，本文档补跑并记录结果。实施者为 Claude 会话；不改业务代码，只出证据与清单。

## 环境

- 隔离 worktree detach 在上述 main SHA；`npm ci --ignore-scripts`；Node v25.5.0（满足 `engines >=24.11`；CI 用 Node 24）。
- 临时库 `insurhot_test`（满足 `tests/setup.ts` 的 `*_test` 约束），每轮 `drop/create` 重建；未连接任何非临时库。
- 环境：`DATABASE_URL=postgres://<local-user>@127.0.0.1:5432/insurhot_test`、`SITE_URL`/`API_BASE_URL` 指向 127.0.0.1、测试用 `SESSION_SECRET`/`IMG_PROXY_SIGN_SECRET`、`COLLECT_ENABLED=false`、`MODEL_CALLS_ENABLED=false`。与 `docs/upstream/workflows/check.yml` 的 CI 环境一致。
- 未启动 API/worker 监听、未做 Docker smoke（本机无 Docker）。

## 结果

| 命令 | 结果 | 日志 |
|---|---|---|
| `node scripts/migrate.ts` | 35 个迁移全部应用（0001–0038，含 0036/0037/0038），exit0 | [migrate](evidence/m0-pg-migrate.log) |
| `node scripts/seed.ts --topics-only` | topics: 38，exit0 | [seed](evidence/m0-pg-seed.log) |
| `npm run build -w @aihot/web` | 客户端+SSR PASS，exit0 | [web build](evidence/m0-pg-web-build.log) |
| `node --test apps/web/tests/*.test.ts` | 11/11 PASS，exit0（需先完成 web build：缺 `apps/web/build/server/index.js` 时 9/11 失败，CI 顺序须先 build） | [web tests](evidence/m0-pg-web-tests.log) |
| `npm test`（30 个文件，132 用例，串行） | **73 PASS / 56 FAIL / 3 cancelled，exit1**，耗时 373s | [backend tests](evidence/m0-pg-backend-tests.log) |

首次尝试在主检出目录运行时，本会话中途切换了分支，结果作废；上表为隔离 worktree 内重跑的结果。

## 失败归因

56 项失败全部可归因于 M0.3a 的默认拒绝与付费闭锁（上游测试假定采集与模型调用默认开启）；未发现与 PG 迁移、schema 或数据库行为相关的失败。

| 类别 | 直接错误 | 涉及文件（失败数） |
|---|---|---|
| 模型门 | `Model calls are disabled (MODEL_CALLS_ENABLED=false)` | events(10)、analyze(6)、signals(2)、receipts(1)、default-model(1) |
| 采集门 | `Outbound collect disabled: COLLECT_ENABLED=true required` | sources(4)、media-performance(5) |
| 门控的二阶后果（断言"没有请求发出"/读到 undefined） | AssertionError / TypeError | listings(4)、source-rules(4)、x-shards(3)、translate(3)、translate-shutdown(2)、x-article(2)、rss-conditional(2)、collection(2)、media-performance(2)、receipts(2)、signals(1) |
| 等待永不到来的 provider 回调 | `test timed out after 120000ms` | analyze-shutdown(3) |

全部通过的文件（14）：alerts、embeddings、feedback、feedback-upload、hot-avatar-payload、icons、leaderboard-worker、materials、mcp-shutdown、monitor、outbound-policy、publication、report-lead、url。

## 对 #10（应用 CI）的输入

- 上游测试把 provider 指向本地 stub（`tests/setup.ts` 的 `stub()`），门控开关在 `tests/setup.ts` 里没有设置，所以默认拒绝会拦住它们。M0.3a 证据已预告这一点。
- 采集门与模型门是"字面值 true 即放行、只访问 stub"的免费路径；付费闭锁（`paidRequest`）无环境旁路，在 M0.3b 前无法通过。
- 建议 #10 的处理顺序：先在 `tests/setup.ts` 对**仅指向 loopback stub** 的测试进程设置 `COLLECT_ENABLED=true`/`MODEL_CALLS_ENABLED=true`（这不是恢复真实付费，stub 之外的地址仍被 `guardedFetch` 的 DNS/HTTP 前检查拦住，需在 setup 里断言 base URL 为 loopback），重跑后把仍依赖 `paidRequest` 的用例按文件列 skip 并记原因，待 M0.3b 解除。
- 每个被门控的用例都是上游行为的回归证据，不删除；skip 清单随 M0.3b/M0.4 逐步清空。

## 未声称的性质

- 本轮只证明 main 树的迁移可应用、topics 可 seed、门控之外的 backend 测试在 PG 上通过；不证明 Docker、生产配置或 D1（#9，迁移 0039 不在 main）的 PG 行为。#9/#16 的 PG 验证需在其分支上另跑。
- M0.3a 的 `/tmp/m03a-*.log` 证据文件在本机已不存在（`ls /tmp/m03a-*` 无匹配），无法入库；其结论以 PR #7 正文与 `m0-3a-evidence.md` 为准，本轮不复现。
- 本轮不含独立评审；文档与日志的一致性由独立只读评审绑定 PR HEAD 另行核对。
