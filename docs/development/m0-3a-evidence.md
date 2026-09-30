# M0.3a 默认拒绝交付证据

2026-09-30；作者自检完成，待固定最终 HEAD 独立评审。Stacked base：PR #6 / `b9183a226e97e0f332d12c82ce96b8f11b2bc2c0`，PR #7 保持 Draft。M0.3a 只交默认拒绝与付费闭锁；**整个 M0.3 尚未完成**。

## 控制合同与外呼盘点

`outbound-policy.ts` 集中定义开关，只有字面值 `true` 是 opt-in；缺省、空、false、1、大小写变体及非法值都拒绝。实际 HTTP 边界每次读取环境，包括已排队、手工、预览和重试，不依赖调度器关闭。guardedFetch 手工重定向每跳复查；direct integrations 拒绝所有重定向（即使调用方传 redirect:follow），避免原生 fetch 自动跟随绕过开关复查。凭证或数据库 target.enabled 不构成开关授权。

| 路径 / 入口 | 实际边界及控制 |
|---|---|
| sources/collect、rss、web-list、json-list、admin/sources 预览/手工、jobs/sources/content、content/extract、sources/icons | `lib/http-fetch.ts` 的 DNS 前与每次 undici 请求前检查 `COLLECT_ENABLED`；关闭时不查询 DNS、不发送 HTTP |
| leaderboard GitHub/Hugging Face/各 HTML、JSON、parquet 来源及刷新/检查脚本 | 同一 `guardedFetch` 采集门；Artificial Analysis 直接 HTTP 改为采集门，并因 credentialed provider 无批准价格额外始终付费闭锁 |
| media/images 图片代理/远程图片、vision 图片、warm cache | 远程读取走 `guardedFetch`，同受 `COLLECT_ENABLED`；已有本地缓存可以读取 |
| SocialData search/article/tweet（含 X 采集、monitor/scan 和 lookback）、Dajiala list/detail、Jina Reader | `paidRequest` 在访问数据库和调用 provider callback 前始终抛 `PaidOutboundDisabledError`；其底层 guardedFetch 也有采集门 |
| LLM chat/completions（所有模型选择、fallback、翻译、报告、分析、评测）、embeddings | `MODEL_CALLS_ENABLED` 缺省 false；embeddings 另需 `EMBEDDINGS_ENABLED=true`；`paidRequest` 始终闭锁，直接 fetch wrapper 对模型/embedding 也始终闭锁 |
| notify/feishu 内部 token、图片上传、告警、反馈、聊天消息 | 每个实际请求由 `FEISHU_INTERNAL_ENABLED=true` 控制；token cache 不绕过下一次发送检查 |
| notify/feishu postWebhook（含 deliver 队列、内容及 monitor reset 卡片） | 实际 webhook 请求检查 `FEISHU_CONTENT_PUSH_ENABLED=true`，直接调用同受门控 |
| admin/auth 飞书 OAuth token、userinfo | 每个实际请求检查新开关 `FEISHU_AUTH_ENABLED=true`；配置登录凭证本身不允许 HTTP |
| operations/indexnow | 实际提交检查 `INDEXNOW_SUBMIT_ENABLED=true`；已有配置/密钥条件仍保留 |
| media/prepare OG 请求（LOCAL_ROUTER_URL 可配置） | 实际请求检查新开关 `MEDIA_FETCH_ENABLED=true`，默认连本地 warm 请求也不发送 |
| operations/backup S3/COS PUT | 对象存储可能付费，实际 PUT 前始终付费闭锁；没有环境旁路。原有本地 pg_dump/pg_restore/tar 仍可能在手工/已配置调度时执行，未执行本轮 |

付费闭锁也拒绝已有 received/completed receipt 的 paidRequest 调用，本次选择更保守地在 DB 前阻断整个入口。旧回执读取/管理功能未删除。缺预算行在实际 `checkBudget` 中抛 `BudgetExceededError`，不再无限制；现有请求次数预算不等于金额预算，不能授权付费。

**M0.3b 未实现**：金额月度/全局/任务硬上限、批准价格、币种处理、并发金额预留、未知回执保留金额占用、恢复/降档不得越限。没有批准任何金额或新增价格。上游价格估算与未知回执自动释放代码仍保留，但因全局付费闭锁不能发出请求；M0.3b 必须处理后才可移除此闭锁。

## 范围例外

这不是进程级所有 socket 防火墙。数据库 postgres/pg-boss 与 pg_dump 属基础设施，仍按 DATABASE_URL 连接；本轮未启动它们。web SSR 的 API_BASE_URL 请求与 server/Vite 的 HTTP 代理属于第一方 web→API 通信（默认 loopback），本轮不改其行为；部署者显式配置远程 API_BASE_URL 时也仍可连接该地址。浏览器同源 API 请求不属于后台业务外呼；MCP handler.fetch 为入站请求处理。开发 smoke 脚本按显式 base 访问测试站点，不是自动业务采集，本轮未运行。当前依赖安装与构建不是业务采集。新外呼入口必须显式选取控制门，不能使用原生 fetch 绕开。

## 验证

Node `v24.19.0`；使用 M0.2 已固定的 node_modules，没有安装/升级依赖，没有改 package-lock.json。

```bash
node --test tests/outbound-policy.test.ts

env -u DATABASE_URL -u OPENAI_API_KEY -u ANTHROPIC_API_KEY \
  MODEL_CALLS_ENABLED=false COLLECT_ENABLED=false FEISHU_CONTENT_PUSH_ENABLED=false \
  FEISHU_INTERNAL_ENABLED=false INDEXNOW_SUBMIT_ENABLED=false \
  API_BASE_URL=http://127.0.0.1:3001 npm run typecheck

env -u DATABASE_URL -u OPENAI_API_KEY -u ANTHROPIC_API_KEY \
  MODEL_CALLS_ENABLED=false COLLECT_ENABLED=false FEISHU_CONTENT_PUSH_ENABLED=false \
  FEISHU_INTERNAL_ENABLED=false INDEXNOW_SUBMIT_ENABLED=false \
  API_BASE_URL=http://127.0.0.1:3001 npm run build -w @aihot/web
```

| 验证 | 结果 | 退出码 |
|---|---|---|
| 4项 Node 定向测试 | 本地假 HTTP：缺省/false/非法值零请求，true 可用免费集成，再次关闭阻断；paidRequest 所有开关状态零 DB/零 callback；缺预算 fake Db 只读预算一次即拒绝；direct integration 在本地302回执中撤销开关，初始请求1次、重定向目的地0次（调用方指定follow仍拒绝） | 0 |
| typecheck | 所有 tsc 项目、web typegen 完成 | 0 |
| web build | 客户端/SSR 包完成 | 0 |

初次 typecheck 退出1：始终抛错 guard 的 `never` 签名使保留代码不可达，影响 TypeScript 控制流推断；改为 `void` 签名但仍无条件 throw 后重跑成功。npm 有继承的 `http-proxy` 配置警告。日志：`/tmp/m03a-test.log`、`/tmp/m03a-typecheck.log`、`/tmp/m03a-web-build.log`；命令输出及退出码在本会话工具记录。

NOT RUN：PG迁移/seed/backend全套、web应用测试、Docker smoke、完整应用CI、API/worker/dev/start、真实采集、模型/供应商付费、飞书、IndexNow、远程备份、生产数据库及部署。旧应用测试中需要 provider callback/采集成功的用例将被默认门/付费闭锁阻断；M0.3b/M0.5需改成明确安全的临时库/本地假 provider 验证，不能通过环境开关恢复真实付费。

## 上游差异

原始489清单和映射保持不变。M0.2原样 verifier 只证明固定 M0.2 快照；本轮修改后**未执行/未声称该原样 verifier 通过**。受控差异见 [M0.3a blob 台账](m0-3a-upstream-delta.md)，对所有489映射逐项比对得到15项有意修改，其余474项 blob/mode 保持原样；LICENSE/NOTICE/第三方许可不变。新 policy/test 与治理文档不属于原始489。

后续评审绑定最终提交；作者自检不代替独立评审。回滚使用本 PR 相对固定 base 的提交逆序 revert；不合并 PR #6/#7，不改变 M0.4/M0.5 范围。

## 独立评审修复 M03A-R01

独立评审发现 direct outboundFetch 原生自动重定向不复查 opt-in（P1）。修复为原生 fetch 强制 redirect:error，调用方参数不能覆盖；本地302/撤销开关回归已补充。guardedFetch 保持既有手工重定向及每跳复查。同时在guardedFetch每跳URL校验/DNS前复查采集门，保留HTTP前复查。修复后定向测试/typecheck重跑通过；web build未重跑（后端wrapper和Node测试变更，先前静态构建结果仅对应修复前代码，最终HEAD独立复核仍必需）。
