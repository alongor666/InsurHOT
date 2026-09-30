# M0.3b 第 1 步：金额机制核心（不接入 `paidRequest`）

2026-09-30；Refs #11；方案 [ADR-015 金额预算部分](../adr/015-monetary-budget-hard-limits.md)（Proposed）。基线 main `33c6b3ac8089ed2ffbfd788d57fa5672ce4212f9`，分支 `feat/m0-3b-money-core`。实施者为 Claude 会话单一写入；独立评审另派，结果绑定固定 HEAD 记录于 PR，以下自检不冒称独立评审。第一轮独立评审（绑定 `20605c8`，配一次性 PostgreSQL 库实测）提出 12 项，均已在本版处理，见文末。

## 范围

本步只交付机制本身及其测试，**不改任何现有调用路径**：

- 迁移 [`0040_money_budgets.sql`](../../database/migrations/0040_money_budgets.sql)：`service_prices` 加 11 列（供应商主机、按量计价、隐式固定 token、推理计费语义、批准、停用）；新表 `money_budgets`（限额）与 `money_usage`（台账）；`receipt_attempts` 加 9 列与一个部分索引。全部空表起步，不含任何预填的批准。
- [`packages/backend/src/providers/money.ts`](../../packages/backend/src/providers/money.ts)：预算月份、capability 映射、主体规范化、已批准价格查找、四种上界、预留、结算、止损、对账。
- [`tests/money.test.ts`](../../tests/money.test.ts)：19 项，真实 PostgreSQL，直接调用上述函数。

**没有做**（留给第 2、3 步，见 #11）：`paidRequest` 与五个 provider 的接入、`ProviderRejectedError` 拆分、删除硬编码单价、月度耗尽在各处理路径上的行为与 `budget_blocked` 状态、告警、后台批准与人工释放入口。四个 `assertPaidOutboundDisabled()` 调用点未动，付费闭锁保持；本步新增代码在生产路径上没有调用方。

## 与 ADR 文本的出入

| ADR | 实现 | 原因 |
|---|---|---|
| `receipt_attempts` 加 6 列，含 `subject_key text` | 加 9 列：`subject_keys text[]`，另有 `price_service`、`price_key`、`budget_month` | 故事对要同时计入两个主体；止损要停用预留时用的那一行价格（attempt 的服务名不一定等于价格行的服务名）；月份在预留时由 attempt 的 `started_at` 定死，跨月结算写回该月而不是事后重算 |
| 结算"不持全局锁" | 预留与结算都先取全局锁，锁序统一为"全局锁 → attempt 行 → 台账行" | 评审实测：同一事务先结算后预留，会与并发预留互相等待而死锁 |
| 台账行无约束 | `money_usage.amount CHECK (amount >= 0)`；归还用 `UPDATE`，不存在的行或会变负的归还直接报错 | 台账为负会放宽限额，方向与"失败即拒绝"相反 |
| 推理"除非显式关闭" | 只有请求体里**恰好一个**开关且它是关闭、同时没有任何开启信号（`reasoning_effort`、另一个开关为开）时才算关闭 | 互相矛盾的开关下供应商可能按它认识的那个执行 |
| 主体规范化只给了规则 | 按类别用严格模式校验（`article:<id>`、`article:<id>:fact:<n>`、`story:<n>`、`story:<a>:<b>`、`quote:<n>`、`x:<n>`、`report:<daily\|weekly\|monthly>:<key>`），其余形态拒绝 | 非规范形态不应自成一个新的主体而绕开上限 |
| 缺价格等拒绝未指定错误类型 | `MoneyRefusedError`（带 `reason`），`MonthlyBudgetExhaustedError` 继承它；两者都不继承 `BudgetExceededError`，消息都含 "budget" | 缺价格、缺限额与月度耗尽同属"等待没有用、要 owner 处理"，第 3 步的处理路径可以一并对待 |
| 请求体允许键未单列 | 除 `extra` 允许键外，请求体只允许 `model`、`messages`、`temperature`、`max_tokens`、`response_format`；`body.model` 必须等于价格行的模型；消息只允许纯文本（字符串，或恰为 `{type:"text", text}` 的 part）；embeddings 只允许 `model`/`input`/`dimensions`/`encoding_format` 且 `input` 为字符串（数组） | 这是 `providers/llm.ts` 与 `embeddings.ts` 实际构造的全部形态；其他键或非文本输入出现即拒绝 |
| 预算时区为待批准项 | 常量 `BUDGET_TIME_ZONE = "Asia/Shanghai"` | ADR 的建议值；owner 批准其他时区时改这一处 |

## 本仓实测

本机 PostgreSQL 18.1，临时库 `insurhot_test`，Node v25.5.0。仅本仓结果。

| 命令 | 结果 | 日志 |
|---|---|---|
| `node scripts/migrate.ts` | 37 个迁移（含 0040）应用，exit0；三张金额相关表为空、无已批准价格 | [migrate](evidence/m0-3b-core-migrate.log) |
| `node --test tests/money.test.ts` | 19/19，exit0（连续 5 次重复运行均 19/19） | [money tests](evidence/m0-3b-core-money-tests.log) |
| `npm run typecheck` | exit0 | [typecheck](evidence/m0-3b-core-typecheck.log) |
| `bash scripts/test-unlocked.sh` | 27 文件 136/136，exit0（上一基线 117 + 本步 19） | [unlocked](evidence/m0-3b-core-unlocked.log) |
| Docker、真实供应商、任何付费调用 | **NOT RUN** / 未发生 | — |

19 项覆盖：

- 预算月份按 Asia/Shanghai 自然月切换。
- capability：采集按服务、embeddings 按用途、模型按用途；`monitor.context` 经 SocialData 计入采集；扫描 `packages/backend/src` 下全部 `purpose` 字面量，逐个确认有 capability 或属于仅采集用途。
- 主体规范化 14 种形态（版本号、片段号、`:fact:` 后缀、故事对及自配对、采集与 embeddings 无主体层）与 17 种拒绝（大小写、空格、多层后缀、三段故事、未知类别等）。
- 价格：缺行、未批准、已停用、无主机、主机不符、模型不回退服务级行、Dajiala 两端点各一行、批准字段成对约束。
- 上界：数值（按字节、含固定开销、向上取整到微单位）；请求体模型与价格行不符；`extra` 内 11 种不允许的键或取值、请求体多出的键（含 `constructor`、`__proto__` 等原型键）、声明的 `extra` 与请求体不符、缺 `max_tokens`、7 种非纯文本消息形态 → 拒绝；推理默认开启，关闭项必须与价格行核对过的方式相符，6 种互相矛盾的开关组合都按开启处理；`providers/llm.ts` 全部 8 个预设逐一判定（新增预设时该用例会失败，提示补行）。
- embeddings、按请求、按返回量（无供应商侧上限 → 拒绝）。
- 限额：空表全拒；缺全局/capability/主体类别行、未批准行、币种无行各自按名拒绝；零限额停用；恰好到限通过、多一个微单位拒绝；故事对两边都要有余量；同一 attempt 只能预留一次；采集与 embeddings 不受主体层约束。
- 并发：24 路同时预留 0.1、全局限额 1 → 恰好 10 路成功，其余为月度耗尽，台账为 1。
- 锁序：36 个并发事务混合"先结算后预留""只预留""先预留后结算"，无死锁、无错误，台账一致。
- 结算：实际值替换预留；无可用数字、币种不符、非法数值保持预留；释放只还一次；自动放行后 status 为 failed 仍占用；人工改判可来回；从未预留的 attempt 无事可做。
- 止损：实际高于预留 → 按实际计入并停用预留时用的那一行价格（价格行的服务名与 attempt 的不同也能停到），随后查价被拒；再次超支保留首次原因；价格行已不存在时如实返回"未停用"。
- 跨月结算写回发起月。
- 对账：每个涉及台账的用例结束时台账与 attempt 一致；人为改动台账会被报告；台账不能被减到零以下。
- 非法金额（负数、极小负数、NaN、Infinity）与不成主体的 subject 在读取任何限额行之前被拒。

## 未声称的性质

- 机制尚未被任何生产路径调用；"闭锁之后接入"在第 2 步。
- 并发用例证明合计不越限、混合事务不死锁；没有单独证明全局锁的等待路径（经同一连接池，池上限 10，大概率真并发）。
- 上界算法的前提（每字节至多 1 token、`max_tokens` 涵盖推理输出、供应商隐式 token 数）依赖 owner 对供应商文档的核对，代码只负责在未核对时拒绝。
- 台账用相对增量维护；对账查询是检测漂移的手段，本步未接入定时任务与告警。

## 第一轮独立评审的处理

| 项 | 问题 | 处理 |
|---|---|---|
| F1 P1 | 互相矛盾的推理开关仍判为已关闭 | 只认"恰好一个开关且为关闭、无任何开启信号"；加 6 种矛盾组合用例 |
| F2 P2 | 同一事务先结算后预留与并发预留死锁（实测 74 次） | 结算也先取全局锁，统一锁序；加混合事务用例 |
| F3 P2 | 预留不校验主体与 capability 是否匹配，可跳过主体层或重复计入 | 预留接收原始 subject，内部推导并去重 |
| F4 P2 | 止损可能停不到价格行而不报告 | attempt 记录 `price_service`；结果带 `priceSuspended` |
| F5 P2 | 不校验请求体模型与价格行一致 | 两个上界函数都先比较 |
| F6–F8 P3 | 原型键、非文本输入形态、非规范主体 | 自有键判断；消息与 embeddings 输入只允许纯文本形态；主体按类别严格匹配 |
| F9–F10 P3 | 台账可为负；极小负数被放行为 0 | 加非负约束，归还改用 UPDATE；先校验原始金额 |
| F11 P3 | purpose 扫描漏模板字面量 | 单独断言模板 purpose 及其展开 |
| F12 P3 | 出入表漏项 | 月份改为取 attempt 的 `started_at`（与 ADR 一致，不再是出入）；其余补入上表 |

## 回退

revert 本 PR。迁移无自动 down；新增列与表可保留（空表即全拒，且无调用方）。
