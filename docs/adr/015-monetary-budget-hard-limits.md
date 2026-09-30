# ADR-015（金额预算部分）：付费外呼的金额硬上限、预留与未知回执占用

状态：Proposed（2026-09-30，Claude 会话起草；经一轮独立对抗评审后重写）。主规格 ADR-015「模型路由 R0–R3 + H；升级条件；月度金额预算」分两部分：**本文件只裁决金额预算机制**（M0.3b，#11）；R0–R3 路由与升级条件留待 T2/T4。按 `docs/phase0/delivery-gates.md` §5：技术方案由实施者起草，**金额、币种、价格与用途由 owner 批准**；本文件不批准任何支出，未列出的数值一律视为零。Refs #4、#11、#15；上游行为见 `docs/development/m0-3a-evidence.md`。

## 背景：现状（main `8b4526a`）

### 付费出口不止一处

`assertPaidOutboundDisabled()`（`outbound-policy.ts:46`，无条件抛错，无环境旁路）有四个调用点：

| 调用点 | 拦的是什么 | 本 ADR 是否覆盖 |
|---|---|---|
| `providers/receipts.ts:111`（`paidRequest` 首行） | 经回执的五个 provider：LLM（`llm.ts:180`）、embeddings（`embeddings.ts:40`）、SocialData（`socialdata.ts:67,124,152`）、Jina（`jina.ts:37`）、Dajiala（`dajiala.ts:54,77`） | **是** |
| `outbound-policy.ts:61`（`outboundFetch` 内，purpose 为 model/embeddings） | 模型与向量 HTTP 的第二道闭锁 | 随上一行一起处理 |
| `operations/backup.ts:74` | S3/COS 对象存储 PUT（可能计费） | **否**，保持闭锁 |
| `leaderboard/fetch/sources/artificial-analysis.ts:25` | 需凭据且无批准价格的 Artificial Analysis | **否**，保持闭锁（随 ADR-002 删除） |

**本 ADR 的金额机制只覆盖经 `paidRequest` 的调用。** 另外两处不经回执、没有预留点，机制管不到它们。

### 其余现状

- 现有预算只按**次数**（`budgets.per_minute/per_hour/per_day`，`receipts.ts:85-104`），在每服务 advisory lock（`receipts.ts:116`，全仓唯一的 advisory lock）内检查；缺行即拒绝。
- 价格表 `service_prices`（迁移 0010，主键 `(service, model)`，列 `input_per_mtok`/`cached_per_mtok`/`output_per_mtok`/`per_request`，币种限 CNY/USD）只用于后台估算展示（`admin/models.ts:43`），不参与放行，没有审批字段，也没有按对象计价的列。
- 成本记录在调用**之后**：LLM 与 embeddings 写 `cost: null`（`llm.ts:220`、`embeddings.ts:52`）；Jina 与 SocialData 在代码里硬编码估算单价（`jina.ts:53` ¥0.36/百万 token，`socialdata.ts:51` $0.0002/对象）；Dajiala 取供应商返回的 `cost_money`，但返回 `code≠0` 时在读取 `cost_money` 之前就抛错（`dajiala.ts:44-48`）。
- LLM 请求体先写 `max_tokens: maxTokens`，再展开 `...(spec.extra ?? {})`（`llm.ts:175-177`）。`default` 模型的 `extra` 来自环境变量 `LLM_EXTRA_JSON`、`model` 来自 `LLM_MODEL`（`llm.ts:36-37`）；`glm-5.3-flash` 等预设的 `extra` 固定开启思考（`llm.ts:46,52`）。因此最终发出的输出上限与是否产生推理 token，不由 `maxTokens` 变量单独决定。
- Jina 是 GET 请求，按**返回页面**的 token 计费（`x-usage-tokens`，`jina.ts:52`），与请求大小无关；客户端 `maxBytes` 只截断接收。SocialData 搜索的请求参数只有 `query/type/cursor`（`socialdata.ts:70-72`），调用方无法限制每页返回的对象数。
- 所有 provider 把 HTTP 5xx 当作"明确未受理"抛 `ProviderRejectedError`（`llm.ts:206`、`embeddings.ts:50`、`jina.ts:48`、`socialdata.ts:83,138,166`、`dajiala.ts:64,86`）。
- 结果未知的回执 30 分钟后由 `ops.recover` 自动放行一次（`admin/runs.ts:112-134`），不核对是否已计费；`release()` 会把 attempt 的 status 改成 failed（`admin/runs.ts:89`）。
- 代码里没有"预算不足换便宜模型"的路径。`BudgetExceededError` 的处理点：`events/group.ts:169-178` 在进程内 `setTimeout((retryAfterSeconds + 1) * 1000)` 后重试；`jobs/content.ts:138-143` 把文章的 `processing_retry_at` 设为 `now + retryAfterSeconds`；`jobs/events.ts:23` 重抛，由 pg-boss 按 `retryLimit: 4, retryDelay: 20`（`jobs/queue.ts:33`）重试；`content/extract.ts:90` 放弃兜底；`sources/mp.ts`、`sources/collect.ts` 记为软失败。
- purpose → capability 的映射 `editorial/models.ts:18-28` 只覆盖模型用途；`embedding`、`mp_history`、`mp_article`、`source_fetch`、`source_listing`、`source_detail`、`body_fallback`、`x_article`、`monitor.scan`、`monitor.lookback` 不在其中，`monitor.context` 同时被 SocialData（`monitor/scan.ts:52`）与模型 capability `monitor` 使用。

## 要满足的约束

来自 #4、#11、主规格 §24.3、`delivery-gates.md:41` 与 AGENTS.md：

1. 缺预算、缺价格、金额耗尽 → 拒绝；不得靠估算或换便宜模型继续突破同一上限。
2. 月度金额硬上限：全局、按 capability、按任务，带币种。
3. 并发下原子：同时到达的请求合计不得越限。
4. 结果未知的请求继续占用金额，恢复流程不得自动把它释放为零。
5. 模型升级/降级服从预算。
6. 耗尽后转规则/缓存/人工队列，不空转。
7. 预算值未获批准时保持零；测试不产生真实付费；不得通过环境开关恢复真实付费。

## 决定（建议）

### 1. 价格：精确匹配、已批准、带计费语义

`service_prices` 增加：

- `approved_by text`、`approved_on date`：两者非空才算已批准。批准只能经后台操作写入并同时写 `audit_log`（不提供迁移或 seed 预填，避免自填署名）。
- `per_unit numeric(14,6)`、`unit text`、`max_units_per_request integer`：按对象/按返回 token 计价的服务用。
- `output_cap_includes_reasoning boolean`：该模型在开启思考时，推理 token 是否计入请求体的输出上限。NULL 表示未核对。
- `suspended_at timestamptz`、`suspended_reason text`：止损用（第 7 节）。

查找规则：

- **模型服务**（请求带 `model`）必须命中 `(service, model)` 精确行；**不回退**到服务级行。否则把 `LLM_MODEL` 换成更贵的模型仍会按旧单价预留。
- **非模型服务**（`model` 为 NULL）按 `(service, <端点名>)` 精确行；Dajiala 的 `post_history` 与 `article_detail` 单价不同，各一行。
- 价格表填**最高阶梯价**；有阶梯、时段或缓存折扣的，只取最贵的一档。
- 查不到、未批准或已停用 → 拒绝（`missing approved price`）。

代码内的硬编码单价（`jina.ts:53`、`socialdata.ts:51`）删除。

### 2. 最坏情况成本：从最终请求体计算，算不出即拒绝

| 计费方式 | 上界 | 成立条件（不满足即拒绝） |
|---|---|---|
| LLM | 输入字节数 × `input_per_mtok` + 输出上限 × `output_per_mtok` | 见下 |
| embeddings | 输入字节数 × `input_per_mtok` | — |
| 按请求（Dajiala 两个端点） | `per_request` | — |
| 按返回量（SocialData 每对象、Jina 每 token） | `per_unit` × `max_units_per_request` | 价格行有经核对的 `max_units_per_request`，且该上限是**供应商侧可强制或文档保证**的 |

LLM 的规则：

- **在 `extra` 展开之后**，对最终序列化的请求体取值。输入上界 = 请求体 UTF-8 字节数（每字节至多 1 token；图片以 base64 data URL 内联，`editorial/input.ts:112`，字节数同样覆盖——高分辨率图片的计费是否可能超过其 base64 字节数，列为待核对项，未核对前带图片的请求拒绝）。
- 输出上限 = 最终请求体的 `max_tokens`（或 `max_completion_tokens`）；两者都没有 → 拒绝。
- 最终请求体含 `n` 且不为 1 → 拒绝。
- 最终请求体开启了思考/推理（出现 `thinking`、`enable_thinking`、`reasoning_effort`、`thinking_budget` 等且未显式关闭）时，价格行的 `output_cap_includes_reasoning` 必须为 true；为 false 或 NULL → 拒绝。影响计费的 `extra` 键采用白名单，未知键 → 拒绝。

Jina 与 SocialData：当前代码没有任何可声明的上限。**在 owner 核对供应商文档并给出可强制的上限之前，这两个服务不可启用**（SocialData 另随 ADR-002 删除）。不以客户端 `maxBytes` 推算上限。

实际成本在回执到达后按 usage 与同一价格行结算；供应商返回实际金额的（Dajiala `cost_money`）用实际值。

### 3. 金额预算表与三层作用域

新表 `money_budgets(scope, key, currency, monthly_limit, approved_by, approved_on, note)`，主键 `(scope, key, currency)`；批准同样只经后台操作并写审计。一笔请求必须同时满足下列三行，任一行缺失或未批准 → 拒绝；`monthly_limit = 0` 表示停用。

- `scope = 'global'`，`key = ''`：全部经 `paidRequest` 的外呼的月度总上限。
- `scope = 'capability'`：两段式映射——
  1. 非模型服务按 **service** 映射：`jina → collect.jina`、`dajiala → collect.dajiala`、`socialdata → collect.socialdata`；
  2. embeddings（purpose `embedding`）→ `embedding`；
  3. 其余模型服务按 **purpose** 经 `CAPABILITIES[*].purposes` 映射到 `prefilter`、`score`、`understand`、`summarize`、`structure`、`group`、`groupReview`、`digest`、`report`、`translate`、`monitor`。

  按 service 在先，所以 SocialData 以 `monitor.context` 发出的请求计入 `collect.socialdata` 而不是模型 capability `monitor`。模型服务的 purpose 映射不到 → 拒绝。实施时用测试固定"全仓每个 `paidRequest` 调用的 `(service, purpose)` 都有映射"。
- `scope = 'subject'`，`key = ''`：**单一主体（一篇资料、一个事件、一次报告）当月累计上限**的默认值，适用于每个 `subject`。这是 #4 与 `delivery-gates.md:41` 所说的"任务预算"。`subject` 为空的请求（如 embeddings 批次）按各自的 `subject` 字符串计；没有 subject → 拒绝。

### 4. 币种：不换汇

预算按币种分别设限。以币种 X 计价的请求只消耗 X 的三行；缺任一行 → 拒绝。不做汇率换算。建议 owner 统一用一种币种。

### 5. 预留、结算与原子性

`receipt_attempts` 增加 `capability text`、`reserved_amount numeric(14,6)`、`reserved_currency text`、`holds_reservation boolean NOT NULL DEFAULT false`。

放行在一个事务内完成，先取**单一全局** advisory lock（`budget:money`），再取现有每服务锁（锁序固定；现有代码只有每服务锁一处，不会死锁）：

1. 查价格、算上界 `w`。
2. 对三行分别计算当月占用：`Σ coalesce(cost, reserved_amount)`，条件 `holds_reservation AND origin = 'live' AND reserved_currency = X`，月份按预算时区的自然月，以 attempt 的 `started_at` 归月（跨月的 pending/unknown 归发起月）。
3. 任一行 `占用 + w > monthly_limit` → 抛 `MonthlyBudgetExhaustedError`（第 8 节）。
4. 次数预算 `checkBudget` **保留**，照旧检查。
5. 通过则写 attempt：`reserved_amount = w`、`holds_reservation = true`；提交后才发请求（与现有两段事务结构相容）。

结算只看 `holds_reservation`，**不看 status**（`release()` 会把 status 改为 failed）：

| 结局 | `holds_reservation` | 计入 |
|---|---|---|
| 收到回执，且 `cost` 币种等于 `reserved_currency` | true | 实际成本 |
| 收到回执但无 usage/成本，或币种不符 | true | 预留额 |
| 收到回执后因输出不可用被 `rejectReceivedResponse` 改为 failed | true | 同上（供应商已计费） |
| 明确未受理：发送前连接失败；HTTP 400/401/402/403/422/429；Dajiala 限流码 | false | 0 |
| Dajiala `code≠0` 但带 `cost_money` | true | `cost_money` |
| **HTTP 5xx**、超时、连接中断、进程中断（pending 过期） | **true** | 预留额（按 unknown 处理） |
| unknown 被人工放行且确认"未计费" | false | 0 |
| unknown 被人工放行且确认"已计费"，或被自动放行（未核对） | **true** | 预留额 |

5xx 在金额口径上按 unknown 处理：网关可能在上游已处理并计费之后才返回 502/504。这比现状保守，代价是 5xx 多的月份可用额度减少。

进程在"提交预留后、发请求前"崩溃：pending 过期后转 unknown，预留保持到月底，除非人工核对后按"未计费"放行。这是有意的保守：系统无法区分"没发出去"和"发出去了"。

当月占用用部分索引 `(reserved_currency, started_at) WHERE holds_reservation` 求和。全局锁使放行串行化；事务内只有索引查询，不含网络调用。

### 6. 未知回执

保留"30 分钟后自动放行一次"，但**自动放行不释放金额**：原 attempt 的预留继续计入，重发的请求另行预留。只有人工核对并选择"供应商未计费"才释放。

### 7. 实际超过预留时止损

"硬上限"只对预留成立；若价格行或上界算法有误，实际成本可能超过预留而在放行之后才入账。第一次出现 `实际 > 预留`（同币种）：按实际值计入，把该价格行置为 suspended（之后该 `(service, model)` 一律拒绝），并发"now"级告警。恢复需要 owner 重新批准价格行。

### 8. 耗尽后的行为：单独的错误类型，不延后、不空转

月度耗尽不是"窗口满了稍后再试"。新增 `MonthlyBudgetExhaustedError`，**不继承** `BudgetExceededError`（否则现有处理点会按秒延后）。各处理点的要求：

| 处理点 | 现状 | 要求 |
|---|---|---|
| `events/group.ts:169-178` | 进程内 `setTimeout(retryAfterSeconds)` 重试；若把 retry-after 设为"到下月初"，超过 2^31−1 ms 时 Node 把延迟改为 1 ms，变成抢全局锁的热循环 | 遇月度耗尽立即终止该批并返回已完成数，不 sleep |
| `jobs/content.ts:138-143` | 把文章排到 `now + retryAfterSeconds` | 文章进入明确的 `budget_blocked` 状态，不自动重排；后台可见 |
| `jobs/events.ts:23`（group、digest） | 重抛 → pg-boss 几分钟内耗尽重试、任务作废 | 捕获后以 `budget_blocked` 结果正常结束作业，不消耗重试 |
| `content/extract.ts:90`、`sources/mp.ts`、`sources/collect.ts` | 放弃该步或记软失败 | 同样处理，并记录原因为月度耗尽 |

`budget_blocked` 的条目不会自动恢复。恢复由人工触发（owner 提高上限或进入新月份后在后台重新排队，限速），以免月初集中爆发。规格所说"转规则/缓存/人工队列"在 M0.3b 的范围内落实为"停在人工可见的状态"；规则与缓存降级路径属于 T2/T4。

任何处理点都不得把预算不足当作"换模型重试"的触发条件；实施时逐处加测试固定。

### 9. 模型换档

每次调用按实际模型的已批准价格预留；capability 行对该 capability 下所有模型共用，所以换便宜模型不能绕过已耗尽的行，换贵模型需要该模型自己的已批准价格行且上界仍在三行之内。

### 10. 告警

任一行当月占用达到阈值（待批准，建议 80%）时发"today"级告警；止损触发时发"now"级告警（`operations/alerts.ts` 现有机制）。

### 11. 付费闭锁：不在本 ADR 解除，也不提供测试通道

- 实现上述机制后，四个 `assertPaidOutboundDisabled()` 调用点全部保持原样。
- 将来解除时**只改 `paidRequest` 与 `outboundFetch` 这一对调用点**（换成"金额机制已通过"的检查），不修改共享函数本身；`backup.ts` 与 `artificial-analysis.ts` 两处继续无条件闭锁，直到各自另有裁决。解除的前提：owner 批准的价格与预算已入库、本机制经独立评审并在 CI 通过。
- **不设"仅本机假 provider"的环境测试通道。** `OUTBOUND_LOOPBACK_ONLY` 是普通环境变量，生产环境同样可以设置；loopback 另一端是否真是假服务无法由代码保证（本机代理、隧道都能转发），带标记的 fetch 替身也不受 loopback 检查。用它给闭锁加条件，正是 AGENTS.md 与 `m0-3a-evidence.md:57` 禁止的"通过环境开关恢复付费"。M0.3b 的测试直接调用价格查找、上界、预留、结算函数（真实 PG，不经 `paidRequest` 的闭锁）；`tests/paid-lock-blocked*.txt` 中的 7 个文件与 15 个用例在闭锁解除前保持排除。

## 与规格/闸门的偏离（需 owner 裁决）

| 出处 | 原文要求 | 本 ADR | 理由 |
|---|---|---|---|
| 规格 §24.3 | `budgets.monthly_amount` | 新表 `money_budgets` | `budgets` 以 service 为主键、语义是次数熔断；金额上限的作用域是全局/capability/主体，不是 service |
| 规格 §24.3 | 模型切换"重新校验其**独立**已批准预算" | 同 capability 的模型共用一行；每个模型需要独立的已批准**价格** | 共用上限更严格地防止"换模型继续花"；若 owner 要每模型独立预算，可加 `scope = 'model'` 一层 |
| 规格 §24.3 | 耗尽后"转规则/缓存/人工队列" | M0.3b 只做到停在人工可见状态 | 规则与缓存降级路径尚不存在（T2/T4） |
| #11 | unknown"恢复流程不得自动释放为零" | 保留自动放行但不释放金额 | 兼顾流程不卡死与金额保守 |
| 现状 | 5xx 视为未受理、可立即重试 | 5xx 保持金额占用 | 5xx 不证明未计费 |

## 备选方案

- **A. 继续只用次数预算，压低每次调用的 `max_tokens`**：次数 × 上界只是间接金额上限，价格或模型变化会悄悄改变它，且 `extra` 可覆盖 `max_tokens`。不满足约束 2。不采纳。
- **B. 事后核算 + 超限后停机**：并发与长任务下可越限，未知回执期间金额不可见。不满足约束 3、4。不采纳。
- **C. 预留用期望值而非上界**：占用更贴近实际，但少数大回答可越限，且需要历史数据。先用上界；有回执数据后可由 owner 批准改为分位值。推迟。
- **D. 每服务锁而非全局锁**：并发度更高，但全局行需要跨服务原子。付费调用频率远低于锁的承载能力。不采纳。
- **E. 用 `OUTBOUND_LOOPBACK_ONLY` 给闭锁开测试通道**：能让被排除的上游测试回到 CI，但属于环境旁路（第 11 节）。不采纳。

## 后果

- 迁移：`service_prices` 加 8 列、新表 `money_budgets`、`receipt_attempts` 加 4 列与一个部分索引、文章处理状态增加 `budget_blocked`；不改写历史迁移。
- 五个 provider 的调用点要传计费参数；LLM 的上界改为从最终请求体计算；Jina 与 SocialData 的硬编码单价删除，且二者在给出可强制上限前不可启用。
- 六处 `BudgetExceededError` 处理点要增加对月度耗尽的处理。
- 表为空时一切经 `paidRequest` 的调用被拒（即使将来闭锁解除）：**数值由 owner 给出之前，系统可完整测试"拒绝"路径与预留/结算逻辑，不能验证真实金额。**
- 月度占用对上界求和，比实际花费保守；5xx 与未知回执会进一步占用额度。

## 需要 owner 批准的输入（未给出前全部为零/缺失 → 拒绝）

1. 币种（建议单一 CNY）。
2. 全局月度上限。
3. 每个要启用的 capability 的月度上限。
4. 单一主体当月累计上限（"任务预算"）。
5. 预算月份的时区（建议 `Asia/Shanghai`）与告警阈值（建议 80%）。
6. 每个要启用的 `(service, model 或端点)` 的价格行：最高阶梯价、来源链接、核对日期；模型开启思考时推理 token 是否计入输出上限；按返回量计费的服务的供应商侧可强制上限。
7. 未知回执是否保留 30 分钟自动放行（本 ADR 建议保留但不释放金额）。
8. "与规格/闸门的偏离"一节的五项，尤其是同 capability 共用上限还是每模型独立预算。
9. `backup.ts` 的对象存储 PUT 是否、何时纳入预算（本 ADR 不覆盖）。

## 实施与验收（M0.3b，独立 PR，闭锁保持）

- 迁移 + `providers/money.ts`（价格查找、上界、映射、预留、结算、止损）+ `receipts.ts` 在闭锁之后接入 + 五个 provider 传参 + 六处处理点 + 告警。
- 测试（真实 PG，直接调用机制函数，零真实付费）：
  - 价格：缺行、未批准、已停用、模型服务不回退服务级行、Dajiala 按端点分行。
  - 上界：`extra` 覆盖 `max_tokens`、`n>1`、开启思考而价格行未核对、缺输出上限、未知 `extra` 键、带图片请求、Jina/SocialData 无上限 → 全部拒绝；正常请求的上界数值。
  - 预算：缺全局/capability/主体行、未批准行、币种无预算、恰好到限与超限一分、N 路并发合计不越限。
  - 映射：全仓每个 `(service, purpose)` 都有 capability；`monitor.context` 经 SocialData 计入 `collect.socialdata`。
  - 结算：上表每一行，含 5xx 保持占用、`rejectReceivedResponse` 后保持占用、Dajiala 带 `cost_money` 的失败、自动放行后仍占用、人工"未计费"才释放、`origin` 非 live 不计入、跨月归属。
  - 止损：实际超过预留 → 价格行停用 + 告警，随后请求被拒。
  - 耗尽：六处处理点各自不 sleep、不重排、不消耗重试；`group.ts` 在超长 retry-after 下不进入热循环；不触发换模型。
  - 四个闭锁调用点在实现后仍全部抛错。
- 独立评审绑定固定 HEAD；应用 CI 绿。

## 回退

机制位于闭锁之后，未解除闭锁前对运行行为的影响限于：六处处理点多了一个不会被触发的分支。回退为 revert 实现 PR。新增列与表可保留（空表即全拒）。
