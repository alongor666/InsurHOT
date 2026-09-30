# M0.3b 第 3 步（上）：后台批准与人工释放入口、告警与对账、回执的三处修正

所属任务：#11（父台账 #3、#4）。对应 #11 上「第 3 步清单」的第 3–7 项。第 1、2 项（月度耗尽在各路径的处理、`budget_blocked`、不带图降级）在下一个 PR。

**付费闭锁没有动。** `assertPaidOutboundDisabled()` 的三个调用点原样；本 PR 不批准任何价格或限额，不提供环境开关，表为空时一切经 `paidRequest` 的调用仍被拒绝。

## 做了什么

| 清单项 | 内容 | 位置 |
|---|---|---|
| 4 | **批准价格行与限额，限 owner**：`approvePrice`、`approveLimit` 只接受角色为 `owner` 的已登录管理员（开发替身不算），整行写入、`approved_by` 取会话身份、`approved_on` 取预算时区的当天，与 `audit_log` 在同一事务。重新批准会解除止损停用。`withdrawPrice` 任何管理员可用（只能让请求被拒） | `admin/money.ts`、迁移 `0044` |
| 4 | **人工释放**：未知回执放行时，只有 `billed === false` 才把丢失那次调用的金额还回去；自动放行与「已计费」保持占用。新增 `releaseHeldAttempt`：已是 failed 但仍占用的调用（400/422/5xx、超时、未核对放行）经核对后释放 | `admin/runs.ts`、`admin/money.ts` |
| 4 | **提示**：供应商自己报告过金额的调用（含超过预留的）要带 `acknowledgeFigure` 才能释放，拒绝信息里写明金额与是否超支 | 同上 |
| 3 | **告警**：全局与 capability 限额行到 80%（today）；同一类别的主体行合并成一条（today）；价格行因超支被停用、超支但价格行已不存在、台账与调用记录对不上（now） | `operations/money.ts`、`operations/alerts.ts` |
| 3 | **每日对账**：`ops.money-reconcile`（03:50）比对并把结果记到 `settings`，告警读这条记录；后台可随时重跑 | `operations/money.ts`、`apps/worker/src/schedules.ts` |
| 5 | 过期清扫在行锁下重新确认「仍是 pending 且仍过期」才标 unknown，不再覆盖刚写入的答案、失败，或被重试接管的占位 | `providers/receipts.ts` |
| 6 | 回执被放行为 failed、还没重试时，迟到的答案被采纳（它已付费），下一次请求复用它而不是再付一次 | `providers/receipts.ts` |
| 7 | 「两个服务共用全局限额」的接入用例改名为冒烟检查并写明原因；全局锁由 `money.test.ts` 证明 | `tests/paid-wiring.test.ts` |

后台 API（都在 `adminHandler` 之后，写操作需要 CSRF）：`GET /api/admin/money`、`PUT /api/admin/money/prices`、`POST /api/admin/money/prices/withdraw`、`PUT /api/admin/money/limits`、`POST /api/admin/money/attempts/:id/release`、`POST /api/admin/money/reconcile`；`/api/admin/me` 多一个 `owner` 字段；模块抛出的 403 现在以 403 返回（原先会变成 500）。

## 需要 owner 知情或裁决的实现选择

1. **谁是 owner**：`admin_users.role` 的取值加了 `owner`（迁移 `0044`）。迁移之后没有任何人是 owner，后台也没有授予入口；由能操作数据库的人执行 `UPDATE admin_users SET role = 'owner' WHERE ...`。理由：能写数据库的人本来就能直接写 `approved_by`，这没有扩大任何人的权限；而在后台里提供「把自己设为 owner」的入口会让角色失去意义。
2. **撤销批准不限 owner**：任何管理员都可以撤销一条价格的批准。它只能停止花钱。
3. **告警阈值 80%** 是 ADR 的建议值（owner 输入 5），以常量 `MONEY_ALERT_RATIO` 存在，未经批准。
4. **主体行告警按类别合并**：每篇文章、每个故事各有一行台账，逐行告警会刷屏，所以同一类别合成一条「N 个对象接近或达到上限」。ADR 第 10 节写的是「任一行」，这是对它的收窄，级别不变。
5. **人工判定「未计费」之后又来了迟到的失败**（如 500）：金额会重新占用（保守），这条调用会出现在「仍占用」列表里，可以再次释放。迟到的是答案时按实际成本计入。
6. **限额为 0 的行不告警**：那是停用决定。
7. **单价为 0 的价格行可以被批准**（例如免费模型）。这样的行预留额为 0，金额限额对它不起作用，只剩次数预算。是否允许由 owner 决定；要禁止的话在 `approvePrice` 里加一条校验即可。

## 评审第 1 轮后的修改

独立评审（Opus 5.5 只读，绑定 `157088d`）结论 REQUEST_CHANGES，报告原文在 PR 评论里。

| 发现 | 处理 |
|---|---|
| **P1**：`billed=false` 放行会把同一回执上更早、被自动放行（未核对）的那次调用的金额一起释放。成因是迟到的超时把已放行的 attempt 改回 `unknown`，放行又按「该回执所有 unknown 的 attempt」释放 | 两处都改：放行只释放回执的**最新一次** attempt；`failPaidAttempt` 不再改写已是 failed/received 的 attempt 的状态与错误信息（金额照常结算）。后者同时修好了评审指出的附带问题：自动放行的标记被覆盖后会再自动放行一次 |
| **P2**：价格的小数位超过列精度时被静默舍入，`4e-7` 会存成 0，上界随之为 0 | 超过列精度的值直接拒绝（单价与限额 6 位，`perUnit` 10 位） |
| **P2**：限额行从 80% 到用完用的是同一个告警键，当天不会再发 | 「用完」用独立的键（`….exhausted`）；80% 那条同时保持打开，不会因此发出假的「已恢复」 |
| **P3**：告警 SQL 的月份条件、主体行限额为 0 两处没有能发现变异的用例 | 各补一条断言；评审做的两项变异现在都被发现 |
| **P3**：「未覆盖」漏项 | 见下 |

## 验证（本机 PostgreSQL 18.1，一次性库，41 个迁移）

- `npm run typecheck`：通过（[日志](evidence/m0-3b-3a-typecheck.log)）。
- `bash scripts/test-unlocked.sh`：27 个文件，160/160，跳过清单 11 条不变（[日志](evidence/m0-3b-3a-unlocked.log)）。比 main 多的 11 个用例都在新文件 `tests/money-admin.test.ts`（第 1 轮评审时是 10 个、159/159）。
- 新用例直接调用 `claimPaidRequest`、`settlePaidAttempt`、`failPaidAttempt` 与后台函数，不经过 `paidRequest`，不发任何请求。其中一条经 `buildApp().inject` 走真实路由与会话（owner 与普通管理员各一个会话）。

**变异验证**（[日志](evidence/m0-3b-3a-mutations.log)）：逐项把修复改回去，对应用例失败。

| 变异 | 结果 |
|---|---|
| 过期清扫不在行锁下重新确认 | 清扫用例失败 |
| 过期清扫恢复成 main 的写法 | 清扫用例失败 |
| 迟到的答案不被已放行的回执采纳 | 迟到答案用例失败 |
| `billed=false` 放行不结算金额 | 两个用例失败 |
| 任何登录者都能批准 | 四个用例失败 |
| 供应商报告过金额仍可直接释放 | 释放用例失败 |
| 已收到答案的调用可被释放 | 释放用例失败（第一次变异存活，补了断言后失败） |
| 未知回执的调用可单独释放 | 释放用例失败 |
| 告警只在用满时触发 | 告警用例失败 |
| 重新批准不解除停用 | 六个用例失败 |
| **`release` 在金额调用之前先写 attempt 行** | **用例仍通过（3 次）** |
| （第 1 轮后）放行释放该回执所有 unknown 的 attempt | 新用例失败 |
| （第 1 轮后）迟到的失败改写已放行的 attempt | 新用例失败 |
| （第 1 轮后）接受超过列精度的价格 | 校验用例失败 |
| （第 1 轮后）「用完」没有独立的告警 | 告警用例失败 |
| （评审的 B1）限额告警不看月份 | 告警用例失败 |
| （评审的 B2）主体行限额为 0 也告警 | 告警用例失败 |

「`release` 先写 attempt 行」那一行说明：并发用例（放行、迟到结果、重试、清扫、批准同时发生，12 轮）**只是冒烟检查**。涉及同一回执的事务都先锁回执行，所以把 attempt 行的写入提前并不会成环；这条变异没有被发现，并不证明那个顺序是安全的。代码仍按 `providers/money.ts` 文件头的顺序写。

## 未运行 / 未覆盖

- **后台页面没有做**：只有 API。owner 要批准价格或限额，目前得用 API 调用；页面留给后续。现有「运行」页的放行按钮照旧可用（它发的是布尔值）。
- **告警的发送**没有测：只测了 `moneyFindings()` 返回什么。`checkAlerts` 既有用例仍通过，它现在会顺带调用 `moneyFindings()`（空表，无发现）。限额行从 80% 到用完时 `checkAlerts` 的开合与发送（两个键各发一次、不发假恢复）是按 `checkAlerts` 的既有逻辑推断的，没有实跑。
- 同一回执有多次 attempt 时的人工放行：第 1 轮时没有覆盖，评审实测出问题；现在有专门的用例（含一个直接用 SQL 构造的「旧 attempt 仍是 unknown」的状态）。真实并发下迟到失败与放行交错的全部时序没有穷举。
- **`ops.money-reconcile` 在真实 worker 里的调度**没有观察，只直接调用了 `runMoneyReconciliation()`。
- 放行后把文章重新排队的那段（既有逻辑）不在新用例里。
- 经 `paidRequest` 的端到端路径仍被付费闭锁挡住；闭锁清单里的文件和用例没有变化。
- Docker smoke 与 web 构建由本 PR 的 CI 运行，本机没有跑。

## 回退

`git revert` 合并提交。迁移 `0044` 只放宽了一个 CHECK，可保留；若要收回，先把 `owner` 改回 `admin` 再恢复原约束。
