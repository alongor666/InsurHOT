# Dot D1 工程验证与交付边界

2026-09-30；Refs #8。实现者GPT-6.1 Sol/medium；主协调器接手文档及复跑检查。独立工程评审另行派工，结果绑定固定HEAD记录于PR；以下自检不冒称独立评审。

基线：远程PR #7 HEAD `4ff2cdc994a86617fcd416c49a88d6cb97df03b2`；本地同树HEAD `720599800d5a1a95315e702e7055014d5eb85115`，tree `22c698c902d6bdbc61435c52c777a2583d0595b0`。独立分支`codex/dot-intake-contract`，不写旧PR分支。

## 已实现

- [v1合同](../../packages/contracts/src/dot-ingest.ts)、[严格解析/service](../../packages/backend/src/ingest/dot.ts)、[PG持久化适配器](../../packages/backend/src/ingest/dot-repository.ts)。
- [POST入口](../../apps/api/src/routes/dot-ingest.ts)已在app.ts注册；专用token、字面值true开关，存储前拒绝缺省/非法配置和未授权请求。
- [独立迁移0039](../../database/migrations/0039_dot_intake.sql)：私有Dot批次/条目，与文章、信源、队列及公开投影隔离。
- [本地HTTP/service检查](../../tests/dot-ingest.test.ts)：通过Fake repository与Fastify.inject验证，未监听网络端口。
- [接入规划](dot-integration-plan.md)及action-plan/README/AGENTS一致记录D1–D3与M0剩余边界。

## 本仓实测

主协调器在上述实现树重跑以下命令；仅本仓结果，不引用上游CI。

| 命令/检查 | 结果 | 日志 |
|---|---|---|
| `node tests/dot-ingest.test.ts` | 11/11 PASS，exit0 | [定向检查](evidence/dot-d1-tests.log) |
| `npm run typecheck` | 全仓PASS，exit0 | [类型检查](evidence/dot-d1-typecheck.log) |
| `npm run build -w @aihot/web` | 客户端+SSR PASS，exit0 | [构建](evidence/dot-d1-build.log) |
| `git diff --check` | PASS，exit0 | 提交前执行 |
| PG迁移、事务回滚、实际并发幂等 | **已补跑（2026-09-30，本机 PostgreSQL 18.1）**：迁移 0039 应用 exit0；`tests/dot-repository.test.ts` 6/6（一次入库与重复回执、键序不同仍判重、同 ID 改正文 409 且原批不变、8 路并发首投只存一批、6 路并发异文一存五冲突、坏条目整批回滚、级联删除与无外部外键）；全套 unlocked 117/117 | [迁移](evidence/dot-d1-pg-migrate.log)、[repository 测试](evidence/dot-d1-pg-repository-tests.log)、[unlocked](evidence/dot-d1-pg-unlocked.log)、[typecheck](evidence/dot-d1-pg-typecheck.log) |
| Docker smoke | **NOT RUN**；M0.5（#13）另行交付。应用 CI（#19，已在 main）在本 PR 上运行 typecheck/build/迁移/unlocked backend tests，结果以 Actions 为准 | 不由定向检查替代 |
| 实际Dot连接/责任/定时任务/真实批次 | **NOT CONFIGURED / NOT RUN** | D2另行交付 |

11项覆盖：缺省/false/非法开关零storage；专用token与placeholder拒绝；来源/服务器/Dot时间分离及HTML数据；对象键序幂等与不同正文409；整批严格格式拒绝；bodyLimit/坏JSON；存储错误不泄露数据；50条边界与空来源日期；全应用注册的缺省拒绝且零SQL transaction；33项跨字段NUL/孤立高低surrogate探测全部400零storage；合法emoji原文保留。

独立初审在PR #9初版HEAD `218d37c936cb7116a475d2cebd4effd41a14d7aa`发现P2 DOT-D1-R01：格式检查允许PG text/jsonb不接受的NUL和孤立surrogate，坏批次可能被误报为可重试存储故障。修复在入库前统一拒绝这类字符串，新增两项测试；最终11项结果及日志在修复树上重跑。PG失败来自官方类型合同推导，数据库实际复现仍NOT RUN；修复关闭结论以PR中最终固定HEAD的独立复审为准。

存在既有Fastify日志配置弃用和npm配置警告；不是本次引入，检查退出0。buildApp的本地测试会记录一个503请求日志，仅方法/路径/状态，无凭据与正文。

## 未声称的性质

PG repository以事务及唯一键设计批次原子性/并发幂等；该行为已在本机 PostgreSQL 18.1 上由 `tests/dot-repository.test.ts` 实测（见上表），未在 PG 17（CI 镜像）以外的版本或多副本部署下验证。跨delivery的事件/itemId去重、许可认定、原文证据提取、三支柱读取、撤回和公网发布均不属于D1已实现范围。producer=dot是声明的处理来源；token证明提交权限，不证明作者身份或所有内容正确。

未调用旧ingestItems/queueProcessing；未启动worker或API listener；没有真实采集、模型/embedding付费、飞书/IndexNow推送、远程备份或生产部署。锁文件、LICENSE/NOTICE及第三方许可不改。M0.3b/M0.4/M0.5仍未完成。

## 回退

先关闭DOT_INGEST_ENABLED并撤销专用凭据；再以独立回退PR移除路由及代码。数据库迁移没有自动down，当前无真实数据；删除表需先确认数据保留规则，在临时PG验证后执行，不以文档自检声称迁移回退已通过。


## 2026-09-30 取代 PR #9 的说明

本文件随 D1 内容从 PR #9 压成单提交迁入新 PR：#9 的历史提交 `218d37c`、`346f595` 含一个 40 位 hex 的测试假值字面量（从未对应真实凭据），GitGuardian 对 PR 内全部提交扫描因此持续失败；工作树早已改为运行时随机生成。新分支自 main 起只有不含该字面量的提交。首个提交的树与 `merge(main afe7a62, #9 eb1b902)` 解决三处状态句冲突后的结果（tree `e19f6693733e9ec1dc30b80eecba49f109108175`）只差一处有意改动：`docker-compose.yml` 的两处 `${POSTGRES_PASSWORD:?<提示文字>}`——db 服务改为 `${POSTGRES_PASSWORD:?}`，应用连接串改为 `${POSTGRES_PASSWORD}`（加两行 YAML 注释），以及 `dot-hardening-evidence.md` 对应一句。GitGuardian 的 Generic Password 检测先后把 #16 写在 `:?` 后的提示文字（本分支首推 `ffb3cb6`：两处告警）和连接串里的 `${POSTGRES_PASSWORD:?}`（第二推 `70ab637`：一处告警）当作硬编码密码，这是 #9 合入 #16 后持续失败的第二个原因。必填校验仍由 db 服务那一行承担：Compose 对整个文件先做插值，未设置或为空即整体拒绝启动。上文提到的 #9 各 HEAD 与评审链接保留为历史记录。
