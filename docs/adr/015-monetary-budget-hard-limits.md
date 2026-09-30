# ADR-015（金额预算部分）：付费外呼的金额硬上限、预留与未知回执占用

状态：Proposed（2026-09-30，Claude 会话起草）。主规格 ADR-015「模型路由 R0–R3 + H；升级条件；月度金额预算」分两部分：**本文件只裁决金额预算机制**（M0.3b，#11）；R0–R3 路由与升级条件留待 T2/T4，不在本文件。按 `docs/phase0/delivery-gates.md` §5：技术方案由实施者起草，**金额、币种与用途由 owner 批准**；本文件不批准任何支出，未列出的数值一律视为零。Refs #4、#11、#15；上游行为见 `docs/development/m0-3a-evidence.md`。

## 背景：现状（main `8b4526a`）

- 所有付费调用经 `packages/backend/src/providers/receipts.ts` 的 `paidRequest()`：LLM（`providers/llm.ts:180`）、embeddings（`providers/embeddings.ts:40`）、SocialData（`providers/socialdata.ts:67,124,152`）、Jina（`providers/jina.ts:37`）、Dajiala（`providers/dajiala.ts:54,77`）。M0.3a 在 `receipts.ts:111` 首行无条件抛 `PaidOutboundDisabledError`，没有环境旁路。
- 现有预算只按**次数**（`budgets.per_minute/per_hour/per_day`，`receipts.ts:85-104`），在每服务 advisory lock 内检查；缺行即拒绝。次数不是金额：一次 120k token 的调用与一次 1k token 的调用计数相同。
- 价格表 `service_prices`（迁移 0010）只用于后台估算展示（`admin/models.ts:43`），不参与放行；没有"已批准"标记。
- 成本记录在调用**之后**：LLM 与 embeddings 写 `cost: null`（`llm.ts:220`、`embeddings.ts:52`）；Jina 与 SocialData 在代码里硬编码估算单价（`jina.ts:53` ¥0.36/百万 token，`socialdata.ts:51` $0.0002/对象）；Dajiala 取供应商返回的 `cost_money`。调用前没有任何金额检查。
- 结果未知的回执（超时、进程被杀）30 分钟后由 `ops.recover` 自动放行一次（`admin/runs.ts:112-134`）：标为 failed 并允许重发，"一次丢失的回答最多多付一次"。放行时不核对是否已计费。
- 模型选择 `editorial/models.ts:49` 按 capability 从后台设置/环境变量/默认值取一个模型；代码里没有"预算不足自动换便宜模型"的路径。`BudgetExceededError` 的处理点（`jobs/content.ts:138`、`jobs/events.ts:23`、`events/group.ts:176`、`content/extract.ts:90`、`sources/mp.ts`、`sources/collect.ts`）是延后重试或放弃该步骤。

## 要满足的约束

来自 #4、#11、主规格 §24.3 与 AGENTS.md：

1. 缺预算、缺价格、金额耗尽 → 拒绝；不得靠估算或换便宜模型继续突破同一上限。
2. 月度金额硬上限，按 capability 及全局，带币种。
3. 并发下原子：同时到达的请求合计不得越限。
4. 结果未知的请求继续占用金额，恢复流程不得自动把它释放为零。
5. 模型升级/降级服从同一预算。
6. 预算值未获批准时保持零；测试不产生真实付费。

## 决定（建议）

### 1. 价格：只有已批准的价格参与放行

`service_prices` 增加 `approved_by text`、`approved_on date`；两者非空才算已批准。放行时对 `(service, model)` 查已批准行（模型级优先，其次 `model = ''` 的服务级行）。查不到 → `BudgetExceededError(service, "missing approved price")`。代码内的硬编码单价（`jina.ts:53`、`socialdata.ts:51`）删除，改由价格表提供；价格表没有就拒绝。

### 2. 最坏情况成本：调用前可计算，否则拒绝

每次调用在发出前计算**上界**而非估计值：

| 计费方式 | 上界 | 需要的输入 |
|---|---|---|
| 按 token（LLM、embeddings、Jina） | 输入 token 上界 × `input_per_mtok` + 输出 token 上界 × `output_per_mtok` | 输入上界：请求正文 UTF-8 字节数（每字节至多 1 token，保守）；输出上界：请求的 `max_tokens`（`llm.ts:164` 已确定）；embeddings 无输出 |
| 按请求（Dajiala、SocialData 单条） | `per_request` | — |
| 按返回对象（SocialData 搜索） | `per_request` × 单次请求对象上限 | 调用方声明的分页大小上限 |

调用方必须向 `paidRequest` 传入计费参数（`{ inputBytes, maxOutputTokens }` 或 `{ units }`）；缺失 → 拒绝。上界用于预留；实际成本在回执到达后按 usage 与同一价格行结算（供应商返回实际金额的，如 Dajiala，用实际值）。实际值高于预留视为价格表或上界算法错误：记录、告警，并按实际值计入。

### 3. 金额预算表与作用域

新表 `money_budgets(scope, key, currency, monthly_limit, approved_by, approved_on, note)`，主键 `(scope, key, currency)`：

- `scope = 'global'`，`key = ''`：全部付费外呼的月度总上限。**必须存在**，否则一律拒绝。
- `scope = 'capability'`，`key` ∈ `editorial/models.ts` 的 capability 键（prefilter、score、understand、summarize、structure、group、groupReview、digest、report、translate…）加上非模型用途的固定键（`embedding`、`collect.jina`、`collect.dajiala`、`collect.socialdata`）。请求的 `purpose` 经 `CAPABILITIES[*].purposes` 映射到 capability；映射不到 → 拒绝。**对应行必须存在**，否则拒绝。
- 不设"单任务"行：单次调用的上限已由 `max_tokens` × 价格给出；单篇资料的上限由 owner 决定是否需要（见待批准项 5），需要时加 `scope = 'subject'` 的每主体月内累计上限。

一笔请求必须同时满足全局与 capability 两行。未批准（`approved_by` 为空）的行等同于不存在。`monthly_limit = 0` 表示停用。

### 4. 币种：不换汇

预算按币种分别设限。以币种 X 计价的请求只消耗 X 的预算行；X 没有全局行或 capability 行 → 拒绝。不做汇率换算（`fx_rates` 属于待删的 leaderboard，ADR-002）。建议 owner 统一用一种币种（CNY）批准价格与预算；否则每种币种各自需要一套上限。

### 5. 预留、结算与原子性

`receipt_attempts` 增加 `capability text`、`reserved_amount numeric(14,6)`、`reserved_currency text`、`holds_reservation boolean NOT NULL DEFAULT false`。

放行在一个事务内、持有**单一全局** advisory lock（`pg_advisory_xact_lock(hashtext('budget:money'))`，先于现有每服务锁获取，锁序固定）：

1. 查已批准价格、算上界 `w`。
2. 对全局行与 capability 行分别计算当月已占用：`Σ(holds_reservation 为真的 attempt：coalesce(cost, reserved_amount))`，按 `reserved_currency` 过滤，月份按 `Asia/Shanghai` 自然月（待批准项 4）。
3. 任一行 `已占用 + w > monthly_limit` → `BudgetExceededError`，retry-after 为到下月初的秒数。
4. 通过则写 attempt：`reserved_amount = w`、`holds_reservation = true`，提交后才发请求。

结算：

| attempt 结局 | `holds_reservation` | 计入金额 |
|---|---|---|
| received（有回执） | true | 实际成本；没有 usage 时保持预留额 |
| failed 且供应商明确未受理（`ProviderRejectedError`：连接失败、4xx/5xx 拒绝） | false | 0 |
| unknown（超时、进程中断） | **true** | 预留额 |
| unknown 被人工放行且确认"未计费" | false | 0 |
| unknown 被人工放行且确认"已计费"，或被自动放行（未核对） | **true** | 预留额 |

全局锁使所有付费调用的放行串行化；事务内只有几次索引查询，不含网络调用。当月占用用带 `(reserved_currency, started_at) WHERE holds_reservation` 的部分索引求和；数据量达到需要时再改为计数器行（不在本次范围）。

### 6. 未知回执

保留"30 分钟后自动放行一次"以免流程永久卡住，但**自动放行不释放金额**：原 attempt 的预留继续计入当月，重发的请求另行预留。只有人工核对并选择"供应商未计费"才释放。因此一次丢失的回答最多占用两份预留，且都在上限之内。

### 7. 模型换档

不新增机制：每次调用按**实际使用的模型**的已批准价格预留，capability 行对该 capability 下的所有模型共用。换便宜模型不能绕过已耗尽的 capability 行；换贵模型需要该模型的已批准价格且新上界仍在两行之内。禁止把 `BudgetExceededError` 作为"换模型重试"的触发条件；现有处理点只做延后或放弃，实施时逐处加测试固定这一点。

### 8. 告警

任一行当月占用达到 `monthly_limit` 的 80% 时发"today"级告警（`operations/alerts.ts` 现有机制）；拒绝发生时照旧由调用方延后。

### 9. 付费闭锁的解除：不在本 ADR

实现上述机制后，`assertPaidOutboundDisabled()` 仍保持无条件。解除需要：owner 批准的价格与预算已入库、本机制经独立评审并在 CI 通过、G2 相关条件满足——另行裁决。

**可选的测试通道（需 owner 同意后再做）**：#19 的 `OUTBOUND_LOOPBACK_ONLY` 已在请求层保证测试进程只能连本机。可以让付费闭锁在 `OUTBOUND_LOOPBACK_ONLY=true` 时放行到本地假 provider，使 `tests/paid-lock-blocked*.txt` 中的 7 个文件与 15 个用例连同本机制一起在 CI 运行。它不可能产生真实付费，但改变了"闭锁无条件"这句承诺的字面含义，因此单列为待批准项 6。

## 备选方案

- **A. 继续只用次数预算，把每次调用的 `max_tokens` 压低**：不改表，但次数 × 上界只是间接金额上限，价格变化或新模型会悄悄改变它；无法表达"全局每月 X 元"。不满足约束 2。不采纳。
- **B. 事后核算 + 超限后停机**：实现最简单（只读回执成本求和），但并发与长任务下可越限，未知回执期间金额不可见。不满足约束 3、4。不采纳。
- **C. 预留用期望值而非上界**：占用更贴近实际、可用额度更大，但期望值需要历史数据，且少数大回答可越限。先用上界；有回执数据后，可由 owner 批准改为"上界的某个分位"。推迟。
- **D. 每服务锁而非全局锁**：并发度更高，但全局行需要跨服务原子，只能再加一层锁或改计数器行。付费调用频率（每分钟至多数十次）远低于锁的承载能力。不采纳。

## 后果

- 迁移新增两列价格审批字段、一张预算表、`receipt_attempts` 四列与一个部分索引；不改写历史迁移。
- 五个 provider 的调用点要传计费参数；Jina 与 SocialData 的硬编码单价删除。
- 表为空时一切付费调用被拒（即使将来闭锁解除）——这是期望行为：**数值由 owner 给出之前，系统可完整测试"拒绝"路径，不能测试"放行"路径的真实金额。**
- 月度占用对上界求和，会比实际花费保守；额度紧时表现为提前拒绝。
- ADR-002 删除 SocialData 后，`collect.socialdata` 键与相应价格行随之删除。

## 需要 owner 批准的输入（未给出前全部为零/缺失 → 拒绝）

1. 币种（建议单一 CNY）。
2. 全局月度上限。
3. 每个 capability 的月度上限（可先只批准 M0/T2 实际要用的几个）。
4. 预算月份的时区（建议 `Asia/Shanghai`）与 80% 告警阈值。
5. 是否需要"单篇资料月内累计上限"。
6. 是否同意"仅本机假 provider 的测试通道"（决定第 9 节可选项）。
7. 每个要启用的 `(service, model)` 的价格、来源链接与核对日期（owner 或其指定的人填写并署名批准）。
8. 未知回执是否保留 30 分钟自动放行（本 ADR 建议保留但不释放金额）。

## 实施与验收（M0.3b，独立 PR，闭锁保持）

- 迁移 + `providers/money.ts`（价格查找、上界、预留、结算）+ `receipts.ts` 接入 + 五个 provider 传参 + 告警。
- 测试（真实 PG，本地假 provider，零真实付费）：缺价格、价格未批准、缺全局行、缺 capability 行、purpose 映射不到、币种无预算、金额恰好到限/超限一分、N 路并发合计不越限、received 按实际结算、failed 释放、unknown 保持占用、自动放行后仍占用而人工"未计费"才释放、换模型（更便宜/更贵）均受同一 capability 行约束、`BudgetExceededError` 不触发换模型重试、80% 告警。
- 独立评审绑定固定 HEAD；应用 CI 绿。

## 回退

机制位于闭锁之后，未解除闭锁前对运行行为无影响；回退为 revert 实现 PR。新增列与表可保留（空表即全拒）。
