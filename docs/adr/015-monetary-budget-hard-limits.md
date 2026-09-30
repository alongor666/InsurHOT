# ADR-015（金额预算部分）：付费外呼的金额硬上限、预留与未知回执占用

状态：Proposed（2026-09-30，Claude 会话起草；经两轮独立对抗评审后修订）。主规格 ADR-015「模型路由 R0–R3 + H；升级条件；月度金额预算」分两部分：**本文件只裁决金额预算机制**（M0.3b，#11）；R0–R3 路由与升级条件留待 T2/T4。按 `docs/phase0/delivery-gates.md` §5：技术方案由实施者起草，**金额、币种、价格与用途由 owner 批准**；本文件不批准任何支出，未列出的数值一律视为零。Refs #4、#11、#15；上游行为见 `docs/development/m0-3a-evidence.md`。

## 背景：现状（main `8b4526a`）

### 付费出口不止一处

`assertPaidOutboundDisabled()`（`outbound-policy.ts:46`，无条件抛错，无环境旁路）有四个调用点：

| 调用点 | 拦的是什么 | 本 ADR 是否覆盖 |
|---|---|---|
| `providers/receipts.ts:111`（`paidRequest` 首行） | 经回执的五个 provider：LLM（`llm.ts:180`）、embeddings（`embeddings.ts:40`）、SocialData（`socialdata.ts:67,124,152`）、Jina（`jina.ts:37`）、Dajiala（`dajiala.ts:54,77`） | **是** |
| `outbound-policy.ts:61`（`outboundFetch` 内，purpose 为 model/embeddings） | 模型与向量 HTTP 的第二道闭锁；只在 `llm.ts` 与 `embeddings.ts` 的 `paidRequest` 回调里被调用 | 随上一行一起处理 |
| `operations/backup.ts:74` | S3/COS 对象存储 PUT（可能计费） | **否**，保持闭锁 |
| `leaderboard/fetch/sources/artificial-analysis.ts:25` | 需凭据且无批准价格的 Artificial Analysis | **否**，保持闭锁（随 ADR-002 删除） |

**本 ADR 的金额机制只覆盖经 `paidRequest` 的调用。** Dajiala、Jina、SocialData 的 HTTP 走 `guardedFetch`，没有第二道闭锁。

### 其余现状

- 现有预算只按**次数**（`budgets.per_minute/per_hour/per_day`，`receipts.ts:85-104`），在每服务 advisory lock（`receipts.ts:116`）内检查；缺行即拒绝。全仓另有一处 advisory lock：`publication/publish.ts:137` 的 `selected_ledger`，与付费路径不相交。
- 价格表 `service_prices`（迁移 0010，主键 `(service, model)`，列 `input_per_mtok`/`cached_per_mtok`/`output_per_mtok`/`per_request`，币种限 CNY/USD）只用于后台估算展示（`admin/models.ts:43`），不参与放行，没有审批字段，也没有按对象计价的列。
- 成本记录在调用**之后**：LLM 与 embeddings 写 `cost: null`（`llm.ts:220`、`embeddings.ts:52`）；Jina 与 SocialData 在代码里硬编码估算单价（`jina.ts:53`、`socialdata.ts:51`）；Dajiala 取供应商返回的 `cost_money`，但返回 `code≠0` 时在读取 `cost_money` 之前就抛错（`dajiala.ts:44-48`），且把业务码放进 `ProviderRejectedError.status`（与 HTTP 状态码共用一个字段）。
- LLM 请求体先写 `max_tokens: maxTokens`，再展开 `...(spec.extra ?? {})`（`llm.ts:175-177`）。`default` 模型的 `extra`、`model`、base URL 分别来自环境变量 `LLM_EXTRA_JSON`、`LLM_MODEL`、`LLM_BASE_URL`（`llm.ts:35-37`）。预设的 `extra` 键（`llm.ts:43-82`）：`thinking.type`、`thinking.clear_thinking`、`reasoning_effort`、`top_p`、`enable_thinking`；`deepseek-flash-think` 没有 `extra`，其注释写明该模型默认推理，`glm-5.3-flash` 注释写明"always reasons"。
- Jina 是 GET 请求，按**返回页面**的 token 计费（`x-usage-tokens`，`jina.ts:52`）；SocialData 搜索的请求参数只有 `query/type/cursor`（`socialdata.ts:70-72`）。两者的调用方都无法限制单次返回量。
- 所有 provider 把 HTTP 5xx 当作"明确未受理"抛 `ProviderRejectedError`（`llm.ts:206`、`embeddings.ts:50`、`jina.ts:48`、`socialdata.ts:83,138,166`、`dajiala.ts:64,86`）；4xx 同样抛出。
- 结果未知的回执 30 分钟后由 `ops.recover` 自动放行一次（`admin/runs.ts:112-134`），不核对是否已计费；`release()` 会把 attempt 的 status 改成 failed（`admin/runs.ts:89`）。
- `subject` 的实际取值不统一：`article:<id>@<rev>`（`analyze.ts:191`）、`article:<id>@<rev>#<片段>`（`translate.ts:77`）、`article:<id>`（`group.ts:281,298`、`extract.ts:112,140`）、`article:<id>:fact:<factId>`（`group.ts:290`）、`story:<id>@<篇数>`（`digest.ts:62`）、`story:<a>:<b>`（故事对合并判定，`group.ts:455`）、`report:<kind>:<key>`（`compose.ts:100`）、`quote:<tweetId>`（`translate.ts:258`）、`x:<id>`（`recognize.ts:120`）；采集侧是共享的：`x:<AUTHOR>`（`monitor/scan.ts:83`）、`source:<id>`（`web-list.ts:103,320`、`x.ts:190`）、裸 `sourceId`（`mp.ts:23,52`）、`x-shard:<key>`（`collect.ts:260`）；embeddings 批次用批内第一条的 id。
- 代码里没有"预算不足换便宜模型"的路径。`BudgetExceededError` 的处理方式各不相同，见第 8 节。
- purpose → capability 的映射 `editorial/models.ts:18-28` 只覆盖模型用途；`monitor.context` 只由 SocialData 发出（`monitor/scan.ts:52`）。

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

### 1. 价格：精确匹配、绑定供应商、已批准、带计费语义

`service_prices` 增加：

- `approved_by text`、`approved_on date`：两者非空才算已批准。批准只能经后台操作写入：`approved_by` 取后台会话里的操作者身份（限 owner 角色），同时写 `audit_log`；不提供迁移或 seed 预填。
- `base_host text`：该价格适用的供应商主机名。请求解析出的 base URL 主机名必须与之相等，否则拒绝——防止 `LLM_BASE_URL` 指向更贵的转售方而模型名不变。
- `per_unit numeric(14,6)`、`unit text`、`max_units_per_request integer`：按对象/按返回 token 计价的服务用。
- `overhead_tokens integer NOT NULL DEFAULT 0`：供应商在请求体之外隐式加入的固定 token（默认 system、JSON 模式提示等），由 owner 核对后填写。
- `output_cap_includes_reasoning boolean`：推理 token 是否计入请求体的输出上限。NULL 表示未核对。
- `reasoning_off text`：经核对、对该模型确实生效的推理关闭方式（`thinking.type=disabled`、`enable_thinking=false` 之一）；NULL 表示该模型无法关闭推理或未核对。
- `suspended_at timestamptz`、`suspended_reason text`：止损用（第 7 节）。

查找规则：

- **模型服务**（请求带 `model`）必须命中 `(service, model)` 精确行且 `base_host` 相符；**不回退**到服务级行。
- **非模型服务**（`model` 为 NULL）按 `(service, <端点名>)` 精确行；Dajiala 的 `post_history` 与 `article_detail` 各一行。
- 价格表填**最高阶梯价**；有阶梯、时段或缓存折扣的，只取最贵的一档。
- 查不到、未批准、主机不符或已停用 → 拒绝。

代码内的硬编码单价（`jina.ts:53`、`socialdata.ts:51`）删除。

### 2. 最坏情况成本：从最终请求体计算，算不出即拒绝

| 计费方式 | 上界 | 成立条件（不满足即拒绝） |
|---|---|---|
| LLM | （请求体字节数 + `overhead_tokens`）× `input_per_mtok` + 输出上限 × `output_per_mtok` | 见下 |
| embeddings | （请求体字节数 + `overhead_tokens`）× `input_per_mtok` | — |
| 按请求（Dajiala 两个端点） | `per_request` | — |
| 按返回量（SocialData 每对象、Jina 每 token） | `per_unit` × `max_units_per_request` | 价格行有经核对的 `max_units_per_request`，且该上限是**供应商侧可强制或文档保证**的 |

LLM 的规则，全部对 **`extra` 展开之后**最终序列化的请求体执行：

- 输入上界 = 请求体 UTF-8 字节数（字节级分词下每字节至多 1 token，JSON 转义只会更保守）。带图片的请求（base64 data URL，`editorial/input.ts:112`）：图片计费是否可能超过其 base64 字节数尚未核对，核对前拒绝。
- 输出上限 = 最终请求体的 `max_tokens`；没有 → 拒绝。
- **`extra` 允许键的全集**（含嵌套路径与取值）；出现其他任何键 → 拒绝：

  | 键 | 允许取值 | 影响计费 |
  |---|---|---|
  | `thinking.type` | `enabled` / `disabled` | 是（推理开关） |
  | `thinking.clear_thinking` | 布尔 | 否 |
  | `reasoning_effort` | `low` / `medium` / `high` | 是（推理开启） |
  | `enable_thinking` | 布尔 | 是（推理开关） |
  | `top_p` | 数值 | 否 |

  现有全部预设都在这个集合内。`max_tokens`、`max_completion_tokens`、`n`、`thinking_budget`、`tools` 等不在集合内，出现即拒绝；`default` 模型的 `LLM_EXTRA_JSON` 同样受此约束。
- **推理一律视为开启**，除非最终请求体带有的显式关闭项与该价格行的 `reasoning_off` 完全相符。关闭键因供应商而异：对一个只认 `thinking.type` 或始终推理的模型发 `enable_thinking=false`，供应商会忽略它并照常推理，所以请求体里出现关闭键本身不算数。推理开启时，价格行的 `output_cap_includes_reasoning` 必须为 true；为 false 或 NULL → 拒绝。因此默认推理而不带任何键的模型（`deepseek-flash-think`、任意 `LLM_MODEL`）同样要有经核对的价格行。

Jina 与 SocialData：当前代码没有任何可声明的上限。**在 owner 核对供应商文档并给出可强制的上限之前，这两个服务不可启用**；不以客户端 `maxBytes` 推算上限。后果见"偏离"表。

实际成本在回执到达后按 usage 与同一价格行结算；供应商返回实际金额的（Dajiala `cost_money`）用实际值。

### 3. 金额预算表与作用域

新表 `money_budgets(scope, key, currency, monthly_limit, approved_by, approved_on, note)`，主键 `(scope, key, currency)`；批准方式同价格行。`monthly_limit = 0` 表示停用。适用的行任一缺失或未批准 → 拒绝。

- `scope = 'global'`，`key = ''`：全部经 `paidRequest` 的外呼的月度总上限。**所有请求适用。**
- `scope = 'capability'`：**所有请求适用。** 两段式映射——
  1. 非模型服务按 **service**：`jina → collect.jina`、`dajiala → collect.dajiala`、`socialdata → collect.socialdata`；
  2. purpose 为 `embedding` → `embedding`；
  3. 其余模型服务按 **purpose** 经 `CAPABILITIES[*].purposes` 映射到 `prefilter`、`score`、`understand`、`summarize`、`structure`、`group`、`groupReview`、`digest`、`report`、`translate`、`monitor`。

  按 service 在先，所以 SocialData 以 `monitor.context` 发出的请求计入 `collect.socialdata`。模型服务的 purpose 映射不到 → 拒绝。实施时用测试固定"全仓每个 `paidRequest` 调用的 `(service, purpose)` 都有映射"。
- `scope = 'subject'`，`key` = 主体类别：**只适用于第 3 步的模型 capability**（采集服务与 embeddings 的 subject 是共享或批次标识，只受前两层约束）。这是对 #4 与 `delivery-gates.md:41`"任务预算"的一种解释——**同一主体当月在所有模型步骤上的累计上限**——需 owner 确认（待批准项 4）。
  - 主体键由 `subject` 规范化得到：取第一个 `@` 或 `#` 之前的部分，再去掉 `:fact:<id>` 后缀。例：`article:123@4#2`、`article:123:fact:9` → `article:123`；`story:77@12` → `story:77`；`report:daily:2026-09-30` 不变。故事对 `story:<a>:<b>` 同时计入 `story:<a>` 与 `story:<b>` 两个主体键（两者都须在限内）。
  - 主体类别 = 主体键第一个 `:` 之前的部分（`article`、`story`、`report`、`quote`、`x`）；每个类别一行默认上限，适用于该类别下的每个主体。限额按**类别**查 `money_budgets`，占用按**主体键**记在台账，两者是不同的 key。`x` 类别只有 `monitor.recognize` 使用，不批准该行即拒绝（monitor 随 ADR-002 删除）。
  - 规范化后为空 → 拒绝。

### 4. 币种：不换汇

预算按币种分别设限。以币种 X 计价的请求只消耗 X 的行；缺适用行 → 拒绝。不做汇率换算。建议 owner 统一用一种币种。

### 5. 预留、结算与原子性

`receipt_attempts` 增加：`capability text`、`subject_key text`、`reserved_amount numeric(14,6)`、`reserved_currency text`、`settled_amount numeric(14,6)`（与 `reserved_currency` 同币种）、`holds_reservation boolean NOT NULL DEFAULT false`。

占用用**台账行**维护，不对 attempt 逐月求和：新表 `money_usage(scope, key, currency, month, amount)`，在预留、结算、释放的同一事务内增减。增减一律用相对增量（`SET amount = amount + Δ`），不先读后写绝对值；一笔 attempt 涉及的各行（全局、capability、各主体键）按固定顺序更新。结算把 `coalesce(settled_amount, reserved_amount) − reserved_amount` 加到该 attempt 的每一行；释放从每一行减去 `reserved_amount`。行由 attempt 的 `capability`、`subject_key`、`reserved_currency` 与 `started_at` 所在月份确定，跨月结算写回**发起月**的行。另有对账查询（对 attempt 求 `Σ coalesce(settled_amount, reserved_amount) WHERE holds_reservation AND origin = 'live'`，按 `reserved_currency` 与月份分组）在测试与每日运维任务中比对台账，发现漂移即告警。月份按预算时区的自然月，以 attempt 的 `started_at` 归月；跨月的 pending/unknown 归发起月。

放行在现有事务内进行。判断走哪个分支需要先在每服务锁内读取回执（`receipts.ts:116-126`），所以锁序是：**每服务锁 → 判断分支 → 仅在确实要发请求的分支再取单一全局 advisory lock（`budget:money`）**；复用已有回执、busy、unknown 分支不取全局锁。所有路径顺序一致，不会死锁；`publish.ts` 的锁与此路径不相交。取得全局锁后：

1. 查价格、算上界 `w`。
2. 读适用各行的台账；任一行 `amount + w > monthly_limit` → 抛 `MonthlyBudgetExhaustedError`（第 8 节）。
3. 次数预算 `checkBudget` **保留**，照旧检查。
4. 通过则写 attempt（`reserved_amount = w`、`holds_reservation = true`）并给各行台账加 `w`；提交后才发请求（与现有两段事务结构相容）。

结算在一个事务内更新 attempt 与台账，只看 `holds_reservation`，**不看 status**（`release()` 会把 status 改为 failed）：

| 结局 | `holds_reservation` | `settled_amount` |
|---|---|---|
| 收到回执，成本可算且币种等于 `reserved_currency` | true | 实际成本 |
| 收到回执但无 usage/成本，或币种不符 | true | NULL（按预留额计） |
| 收到回执后因输出不可用被 `rejectReceivedResponse` 改为 failed | true | 同上两行（供应商已计费） |
| 供应商响应带实际金额（Dajiala `cost_money`），无论业务码是否为 0 | true | 该金额（**优先于下面各行**） |
| 明确未受理（默认清单，由 owner 在待批准项 7 确认）：发送前连接失败（`llm.ts:150-153` 的连接类错误）；HTTP 401/402/403/429；Dajiala 限流码 `-1` | false | 0 |
| **HTTP 400/422、5xx**、Dajiala 其余业务码且不带 `cost_money`、超时、连接中断、进程中断（pending 过期） | **true** | NULL（按预留额计，金额口径上视同 unknown） |
| unknown 被人工放行且确认"未计费" | false | 0 |
| unknown 被人工放行且确认"已计费"，或被自动放行（未核对） | **true** | NULL |

400/422 与 5xx 都不证明未计费（模型供应商可能在生成之后才做内容审查并返回 400；网关可能在上游已计费之后返回 502/504）。哪些错误码可以改判为"未受理"由 owner 核对供应商文档后批准（待批准项 7），实施时 `ProviderRejectedError` 把 HTTP 状态码与供应商业务码拆成两个字段。

进程在"提交预留后、发请求前"崩溃：pending 过期后转 unknown，预留保持到月底，除非人工核对后按"未计费"放行。这是有意的保守。

后台的人工核对入口现在只接受 unknown 回执（`admin/runs.ts:103-106`）；实施时扩展为也能处理"status 已是 failed 但 `holds_reservation` 仍为真"的 attempt（400/422/5xx），否则供应商的一次 5xx 风暴会把当月额度占住，只能靠提高上限恢复。

### 6. 未知回执

保留"30 分钟后自动放行一次"，但**自动放行不释放金额**：原 attempt 的预留继续计入，重发的请求另行预留。只有人工核对并选择"供应商未计费"才释放。

### 7. 实际超过预留时止损，及其检测不到的情况

第一次出现 `settled_amount > reserved_amount`：按实际值计入，把该价格行置为 suspended（之后该 `(service, model)` 一律拒绝），并发"now"级告警。恢复需要 owner 重新批准价格行。

这只能发现两类错误：**上界算法错误**（实际 token 多于上界）与**供应商自报金额高于预留**（Dajiala）。它**发现不了价格行本身填低**——实际成本用同一价格行计算，单价填低时"实际"也同样偏低。因此 owner 需要按供应商账单做月度对账（待批准项 8）。结算不持全局锁，停用之前已放行的请求照常入账，最坏超额约为"在途并发数 × 单笔误差"。

### 8. 耗尽后的行为：单独的错误类型，不延后、不空转

月度耗尽不是"窗口满了稍后再试"。新增 `MonthlyBudgetExhaustedError`，**不继承** `BudgetExceededError`，消息含 "budget" 一词（`translate.ts` 靠消息匹配）。要求按入口穷举；实施时以 grep 与测试固定清单，下表是 main `8b4526a` 上已知的全部路径：

| 路径 | 对 `BudgetExceededError` 的现状 | 对月度耗尽的要求 |
|---|---|---|
| `events/group.ts:169-178`（`warmRecallWindow`；`scripts/regroup-events.ts:87` 调用） | 进程内 `setTimeout(retryAfterSeconds)` 后重试 | 不进入 sleep：终止该批并返回已完成数；脚本以非零码退出并说明原因。（新错误不继承，所以现有代码会直接 rethrow，不会出现把超长延迟截成 1 ms 的热循环；仍需测试固定） |
| `jobs/content.ts:138-143`（analyze） | 把文章排到 `now + retryAfterSeconds` | 文章进入 `budget_blocked` 状态，不计 `processing_attempts`；`sweepUnprocessed`（`content.ts:208-216`）不重排该状态 |
| `jobs/events.ts:12-24`（group worker） | 重抛 → pg-boss `retryLimit: 4` 后作废 | 捕获后以 `budget_blocked` 结果正常结束作业，不消耗重试 |
| `jobs/events.ts:28-31`（digest worker，无 catch） | pg-boss `retryLimit: 3` 后作废 | 同上 |
| `events/group.ts:138`（召回时的嵌入） | 向上抛到 group worker | 由 group worker 的处理覆盖 |
| `editorial/translate.ts:266,318,337` | 消息匹配 `/budget/i` 则停止本轮、不计尝试 | 保持；新错误消息必须匹配 |
| `reports/compose.ts:100,203`（定时 `reports.daily/weekly/monthly`，`schedules.ts:47-55`；`reports.catch-up` 每小时，`schedules.ts:58`） | 定时触发；catch-up 每小时重试 | 记为 `budget_blocked`，当月不再自动重试 |
| `scripts/eval-selection.ts:88-93` | 逐用例记录错误后继续，最后导入 SelectBench | 月度耗尽时中止整轮，不导入结果，非零码退出 |
| `scripts/regroup-events.ts:199`（consolidate） | 向上抛 | 非零码退出并说明原因 |
| `monitor/scan.ts:163-172` | 计入该帖的失败次数 | 不计失败次数，本轮停止（模块随 ADR-002 删除） |
| `content/extract.ts:84-91`（Jina 兜底） | 返回 null，放弃兜底 | 同样放弃，并记录原因 |
| `content/extract.ts:140`（x_article，无 catch） | 向上抛 | 作业以 `budget_blocked` 结束（随 ADR-002 删除） |
| `sources/mp.ts:21-29`（`fetchBody`） | 重抛 | 重抛；**不得**落入"暂时原因"分支消耗 `BODY_RETRIES` |
| `sources/mp.ts:115`、`sources/collect.ts:196,263` | 记软失败 | 同样记软失败，原因标明月度耗尽 |

`budget_blocked` 的条目不会自动恢复。恢复由人工在后台触发（提高上限或进入新月份后重新排队），限速值由 owner 给定（待批准项 9），以免集中爆发。规格所说"转规则/缓存/人工队列"在 M0.3b 范围内落实为"停在人工可见的状态"；规则与缓存降级路径属于 T2/T4。

任何路径都不得把预算不足当作"换模型重试"的触发条件；实施时逐处加测试固定。

### 9. 模型换档

每次调用按实际模型的已批准价格预留；capability 行对该 capability 下所有模型共用，所以换便宜模型不能绕过已耗尽的行，换贵模型需要该模型自己的已批准价格行且上界仍在各行之内。

### 10. 告警

任一行台账达到阈值（待批准，建议 80%）时发"today"级告警；止损触发或台账与对账查询不一致时发"now"级告警（`operations/alerts.ts` 现有机制）。

### 11. 付费闭锁：不在本 ADR 解除，也不提供测试通道

- 实现上述机制后，四个 `assertPaidOutboundDisabled()` 调用点全部保持原样。
- 将来解除时**只改 `paidRequest` 与 `outboundFetch` 这一对调用点**，不修改共享函数本身；`backup.ts` 与 `artificial-analysis.ts` 直接调用共享函数，继续无条件闭锁。`outboundFetch` 拿不到预留上下文，"已预留"须由 `paidRequest` 经 `AsyncLocalStorage` 下发一次性令牌来证明，不能是调用方可传的布尔参数。解除的前提：owner 批准的价格与预算已入库、本机制经独立评审并在 CI 通过。
- **不设"仅本机假 provider"的环境测试通道。** `OUTBOUND_LOOPBACK_ONLY` 是普通环境变量，生产环境同样可以设置；loopback 另一端是否真是假服务无法由代码保证，带标记的 fetch 替身也不受 loopback 检查。用它给闭锁加条件，正是 AGENTS.md 与 M0.3a 证据所禁止的"通过环境开关恢复付费"。M0.3b 的测试直接调用价格查找、上界、映射、预留、结算函数（真实 PG，不经闭锁）；`tests/paid-lock-blocked*.txt` 中的 7 个文件与 15 个用例在闭锁解除前保持排除。

## 与规格/闸门的偏离及功能后果（需 owner 裁决或知情）

| 出处 | 原文要求 / 现状 | 本 ADR | 理由或后果 |
|---|---|---|---|
| 规格 §24.3 | `budgets.monthly_amount` | 新表 `money_budgets` + 台账 `money_usage` | `budgets` 以 service 为主键、语义是次数熔断；金额上限的作用域不是 service |
| 规格 §24.3 | 模型切换"重新校验其**独立**已批准预算" | 同 capability 的模型共用一行；每个模型需要独立的已批准**价格** | 共用上限更严格地防止"换模型继续花"；若 owner 要每模型独立预算，可加 `scope = 'model'` 一层 |
| 规格 §24.3 | 耗尽后"转规则/缓存/人工队列" | M0.3b 只做到停在人工可见状态 | 降级路径尚不存在（T2/T4） |
| #4、`delivery-gates.md:41` | "任务预算" | 解释为"同一主体当月在模型步骤上的累计上限"，采集与 embeddings 不设主体层 | 采集侧的 subject 是共享标识，设主体层会成为事实上的全局瓶颈 |
| #11 | unknown"恢复流程不得自动释放为零" | 保留自动放行但不释放金额 | 兼顾流程不卡死与金额保守 |
| 现状 | 4xx/5xx 视为未受理、可立即重试 | 400/422/5xx 保持金额占用 | 它们不证明未计费 |
| 现状 | Jina、SocialData 可用 | **不可启用**，直到给出供应商侧可强制的上限 | Jina 列表类信源、正文兜底与 X 采集随之停用；SocialData 另随 ADR-002 删除 |
| 现状 | `default` 模型可由环境变量任意指向 | 需要与 `LLM_MODEL`、`LLM_BASE_URL` 主机、`LLM_EXTRA_JSON` 都相符的已批准价格行 | 否则换模型或换转售方可按旧单价预留 |

## 备选方案

- **A. 继续只用次数预算，压低每次调用的 `max_tokens`**：次数 × 上界只是间接金额上限，价格或模型变化会悄悄改变它，且 `extra` 可覆盖 `max_tokens`。不满足约束 2。不采纳。
- **B. 事后核算 + 超限后停机**：并发与长任务下可越限，未知回执期间金额不可见。不满足约束 3、4。不采纳。
- **C. 预留用期望值而非上界**：占用更贴近实际，但少数大回答可越限，且需要历史数据。先用上界；有回执数据后可由 owner 批准改为分位值。推迟。
- **D. 每服务锁而非全局锁**：并发度更高，但全局行需要跨服务原子。付费调用频率远低于锁的承载能力。不采纳。
- **E. 用 `OUTBOUND_LOOPBACK_ONLY` 给闭锁开测试通道**：能让被排除的上游测试回到 CI，但属于环境旁路（第 11 节）。不采纳。
- **F. 占用按月对 attempt 求和而不设台账**：少一张表、没有漂移问题，但每次放行是 O(当月 attempt 数) 且在全局锁内，现有索引覆盖不到 capability 与主体维度。不采纳；求和保留为对账手段。

## 后果

- 迁移：`service_prices` 加 11 列；新表 `money_budgets`、`money_usage`；`receipt_attempts` 加 6 列；文章处理状态增加 `budget_blocked`；不改写历史迁移。
- 五个 provider 的调用点要传计费参数；LLM 的上界改为从最终请求体计算；硬编码单价删除；`ProviderRejectedError` 拆分状态码字段。
- 第 8 节表中的每条路径都要处理月度耗尽。
- 表为空时一切经 `paidRequest` 的调用被拒（即使将来闭锁解除）：**数值由 owner 给出之前，系统可完整测试"拒绝"路径与预留/结算逻辑，不能验证真实金额。**
- 月度占用按上界计，比实际花费保守；400/422/5xx 与未知回执会进一步占用额度。

## 需要 owner 批准的输入（未给出前全部为零/缺失 → 拒绝）

1. 币种（建议单一 CNY）。
2. 全局月度上限。
3. 每个要启用的 capability 的月度上限。
4. "任务预算"的口径是否按第 3 节的解释；若是，各主体类别（`article`、`story`、`report`、`quote`，以及只在保留 monitor 时才需要的 `x`）的单主体当月上限。
5. 预算月份的时区（建议 `Asia/Shanghai`）与告警阈值（建议 80%）。
6. 每个要启用的 `(service, model 或端点)` 的价格行：最高阶梯价、供应商主机名、来源链接、核对日期、隐式固定 token；推理 token 是否计入输出上限、对该模型确实生效的推理关闭方式；图片输入如何计费；按返回量计费的服务的供应商侧可强制上限。
7. 各供应商哪些错误码确属"处理前拒绝、不计费"：确认默认释放清单（连接失败、401/402/403/429、Dajiala `-1`），并指出还有哪些可从"保持占用"改判为释放。
8. 按供应商账单做月度对账的责任人与做法。
9. 未知回执是否保留 30 分钟自动放行（建议保留但不释放金额）；`budget_blocked` 条目人工恢复时的限速值。
10. "偏离及功能后果"表各项，尤其是：同 capability 共用上限还是每模型独立预算；Jina/SocialData 停用是否可接受。
11. `backup.ts` 的对象存储 PUT 是否、何时纳入预算（本 ADR 不覆盖）。

## 实施与验收（M0.3b，独立 PR，闭锁保持）

- 迁移 + `providers/money.ts`（价格查找、上界、映射、主体规范化、预留、结算、台账、止损）+ `receipts.ts` 在闭锁之后接入 + 五个 provider 传参 + 第 8 节各路径 + 告警与对账。
- 测试（真实 PG，直接调用机制函数，零真实付费）：
  - 价格：缺行、未批准、已停用、主机不符、模型服务不回退服务级行、Dajiala 按端点分行。
  - 上界：`extra` 允许键全集内外各一例、`max_tokens`/`n`/`thinking_budget` 出现在 `extra`、缺 `max_tokens`、推理默认开启而价格行未核对、显式关闭推理放行、带图片请求、Jina/SocialData 无上限 → 拒绝；每个现有预设的上界数值。
  - 预算：缺全局/capability/主体类别行、未批准行、币种无预算、恰好到限与超限一分、N 路并发合计不越限、主体规范化各形态、采集与 embeddings 不受主体层约束。
  - 映射：全仓每个 `(service, purpose)` 都有 capability；`monitor.context` 计入 `collect.socialdata`。
  - 结算：上表每一行及其优先级，含 400/5xx 保持占用、`rejectReceivedResponse` 后保持占用、Dajiala 带 `cost_money` 的失败、自动放行后仍占用、人工"未计费"才释放、`origin` 非 live 不计入、跨月归属；台账与对账查询在每个用例后一致。
  - 止损：实际超过预留 → 价格行停用 + 告警，随后请求被拒。
  - 耗尽：第 8 节每条路径各自不 sleep、不重排、不消耗重试或失败计数；不触发换模型。
  - 四个闭锁调用点在实现后仍全部抛错。
- 独立评审绑定固定 HEAD；应用 CI 绿。

## 回退

机制位于闭锁之后，未解除闭锁前对运行行为的影响限于：第 8 节各路径多了一个不会被触发的分支。回退为 revert 实现 PR。新增列与表可保留（空表即全拒）。
