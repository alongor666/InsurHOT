# M0.3b 第 1 步：金额机制核心（不接入 `paidRequest`）

2026-09-30；Refs #11；方案 [ADR-015 金额预算部分](../adr/015-monetary-budget-hard-limits.md)（Proposed）。基线 main `33c6b3ac8089ed2ffbfd788d57fa5672ce4212f9`，分支 `feat/m0-3b-money-core`。实施者为 Claude 会话单一写入；独立只读评审另派，结果绑定固定 HEAD 记录于 PR，以下自检不冒称独立评审。

## 范围

本步只交付机制本身及其测试，**不改任何现有调用路径**：

- 迁移 [`0040_money_budgets.sql`](../../database/migrations/0040_money_budgets.sql)：`service_prices` 加 11 列（供应商主机、按量计价、隐式固定 token、推理计费语义、批准、停用）；新表 `money_budgets`（限额）与 `money_usage`（台账）；`receipt_attempts` 加 8 列与一个部分索引。全部空表起步，不含任何预填的批准。
- [`packages/backend/src/providers/money.ts`](../../packages/backend/src/providers/money.ts)：预算月份、capability 映射、主体规范化、已批准价格查找、四种上界、预留、结算、止损、对账。
- [`tests/money.test.ts`](../../tests/money.test.ts)：18 项，真实 PostgreSQL，直接调用上述函数。

**没有做**（留给第 2、3 步，见 #11）：`paidRequest` 与五个 provider 的接入、`ProviderRejectedError` 拆分、删除硬编码单价、月度耗尽在各处理路径上的行为与 `budget_blocked` 状态、告警、后台批准与人工释放入口。四个 `assertPaidOutboundDisabled()` 调用点未动，付费闭锁保持；本步新增代码在生产路径上没有调用方。

## 与 ADR 文本的出入

| ADR | 实现 | 原因 |
|---|---|---|
| `receipt_attempts` 加 6 列，含 `subject_key text` | 加 8 列：`subject_keys text[]`，另有 `price_key`、`budget_month` | 故事对要同时计入两个主体；止损需要知道预留用的是哪一行价格；跨月结算要写回发起月，月份在预留时定死而不是事后按时区重算 |
| 缺价格等拒绝未指定错误类型 | `MoneyRefusedError`（带 `reason`），`MonthlyBudgetExhaustedError` 继承它；两者都不继承 `BudgetExceededError`，消息都含 "budget" | 缺价格、缺限额与月度耗尽同属"等待没有用、要 owner 处理"，第 3 步的处理路径可以一并对待 |
| 请求体允许键未单列 | 除 `extra` 允许键外，请求体只允许 `model`、`messages`、`temperature`、`max_tokens`、`response_format` | 这是 `providers/llm.ts` 实际构造的全部键；其他键（`n`、`stream`、`max_completion_tokens`…）出现即拒绝 |
| 预算时区为待批准项 | 常量 `BUDGET_TIME_ZONE = "Asia/Shanghai"` | ADR 的建议值；owner 批准其他时区时改这一处 |

## 本仓实测

本机 PostgreSQL 18.1，临时库 `insurhot_test`，Node v25.5.0。仅本仓结果。

| 命令 | 结果 | 日志 |
|---|---|---|
| `node scripts/migrate.ts` | 37 个迁移（含 0040）应用，exit0；三张金额相关表为空、无已批准价格 | [migrate](evidence/m0-3b-core-migrate.log) |
| `node --test tests/money.test.ts` | 18/18，exit0 | [money tests](evidence/m0-3b-core-money-tests.log) |
| `npm run typecheck` | exit0 | [typecheck](evidence/m0-3b-core-typecheck.log) |
| `bash scripts/test-unlocked.sh` | 27 文件 135/135，exit0（上一基线 117 + 本步 18） | [unlocked](evidence/m0-3b-core-unlocked.log) |
| Docker、真实供应商、任何付费调用 | **NOT RUN** / 未发生 | — |

18 项覆盖：

- 预算月份按 Asia/Shanghai 自然月切换。
- capability：采集按服务、embeddings 按用途、模型按用途；`monitor.context` 经 SocialData 计入采集；扫描 `packages/backend/src` 下全部 `purpose` 字面量，逐个确认有 capability 或属于仅采集用途。
- 主体规范化 12 种形态（版本号、片段号、`:fact:` 后缀、故事对、采集与 embeddings 无主体层）与 5 种拒绝。
- 价格：缺行、未批准、已停用、无主机、主机不符、模型不回退服务级行、Dajiala 两端点各一行、批准字段成对约束。
- 上界：数值（按字节、含固定开销、向上取整到微单位）；`extra` 内 10 种不允许的键或取值、请求体多出的键、声明的 `extra` 与请求体不符、缺 `max_tokens`、图片输入 → 拒绝；推理默认开启，关闭项必须与价格行核对过的方式相符；`providers/llm.ts` 全部 8 个预设逐一判定（新增预设时该用例会失败，提示补行）。
- embeddings、按请求、按返回量（无供应商侧上限 → 拒绝）。
- 限额：空表全拒；缺全局/capability/主体类别行、未批准行、币种无行各自按名拒绝；零限额停用；恰好到限通过、多一个微单位拒绝；故事对两边都要有余量；同一 attempt 只能预留一次；采集与 embeddings 不受主体层约束。
- 并发：24 路同时预留 0.1、全局限额 1 → 恰好 10 路成功，其余为月度耗尽，台账为 1。
- 结算：实际值替换预留；无可用数字、币种不符、非法数值保持预留；释放只还一次；自动放行后 status 为 failed 仍占用；人工改判可来回；从未预留的 attempt 无事可做。
- 止损：实际高于预留 → 按实际计入并停用价格行，随后查价被拒。
- 跨月结算写回发起月。
- 对账：每个涉及台账的用例结束时台账与 attempt 一致；人为改动台账会被报告。

## 未声称的性质

- 机制尚未被任何生产路径调用；"闭锁之后接入"在第 2 步。
- 并发用例证明合计不越限；没有单独证明全局锁的等待路径（24 路经同一连接池，大概率真并发）。
- 上界算法的前提（每字节至多 1 token、`max_tokens` 涵盖推理输出、供应商隐式 token 数）依赖 owner 对供应商文档的核对，代码只负责在未核对时拒绝。
- 台账用相对增量维护；对账查询是检测漂移的手段，本步未接入定时任务与告警。

## 回退

revert 本 PR。迁移无自动 down；新增列与表可保留（空表即全拒，且无调用方）。
