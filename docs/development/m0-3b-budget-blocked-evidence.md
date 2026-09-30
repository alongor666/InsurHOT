# M0.3b 第 3 步（下）：金额限制拒绝之后，各路径怎么停

所属任务：#11（父台账 #3、#4）。对应 #11「第 3 步清单」第 1、2 项，依据 ADR-015 第 8 节。第 3–7 项在另一个 PR（`m0-3b-operator-entries-evidence.md`）。

**付费闭锁没有动。** 三个 `assertPaidOutboundDisabled()` 调用点原样，闭锁清单不变，没有环境开关。

## 原则

金额限制的拒绝（`MoneyRefusedError`，含月度用完的 `MonthlyBudgetExhaustedError`，也含缺价格、未批准、价格停用等）不是「窗口满了等一会」：等待不会让它通过。所以各路径一律**不延后、不重试、不计失败次数、不换模型**，把工作停在管理员看得见的状态，由管理员恢复。次数预算（`BudgetExceededError`）的原有处理没有改。

## 各路径

| 路径 | 改动前对这类拒绝的行为 | 现在 |
|---|---|---|
| 文章分析（`jobs/content.ts` `afterFailure`） | 当作普通失败：计 `processing_attempts`，按退避重试，最后 failed | 文章进入 `processing_state = 'budget_blocked'`，不设重试时间，不计次数；`sweepUnprocessed` 只看 `new`，不会把它捞回来 |
| 归组作业（`jobs/events.ts`） | 重抛，pg-boss 重试 4 次后作废 | 记入 `budget_blocked` 表（`group`，带作业参数），作业正常结束 |
| 综述作业（`jobs/events.ts`） | 重抛，重试 3 次后作废 | 同上（`digest`） |
| 日报/周报/月报（`reports/compose.ts`） | 抛错；catch-up 每小时再试一次 | 记入 `budget_blocked`（`report`，键为 `kind:key`）；定时任务和 catch-up 看到标记就跳过，直到管理员恢复。恢复后由每小时的 catch-up 生成，**不受它「最近 7 天」范围的限制** |
| 召回窗口预热（`events/group.ts` `warmRecallWindow`） | 抛错 | 立即停止，返回已完成数与 `refused`；不进入等待 |
| `scripts/regroup-events.ts` | 抛错退出 | 预热被拒时说明原因并以非零码退出，不排任何作业；consolidate 被拒时错误直接抛出，非零码退出 |
| `scripts/eval-selection.ts` | 逐用例记错后继续，最后导入结果 | 遇到这类拒绝立即抛出，整轮中止，不导入 |
| 全文翻译轮次（`editorial/translate.ts`） | 靠消息里的 “budget” 停止本轮 | 另加类型判断；行为不变（停止本轮，不计尝试） |
| Jina 正文兜底（`content/extract.ts`） | 抛错，抽取作业计失败 | 放弃兜底并记一条日志，文章按已有内容判断 |
| 公众号（`sources/mp.ts`） | 正文：落入「暂时原因」分支消耗重试；整次检查：计失败 | 正文：重抛，不消耗正文重试；整次检查：记软失败（不计 `fail_count`），**不**交给队列重试 |
| 其他信源（`sources/collect.ts`） | 计失败、退避 | 记软失败，下次按信源自己的间隔再问（不是 15 分钟） |
| 网页列表的付费详情页（`sources/web-list.ts` `fetchDetail`，经 `collect.ts` 的详情循环） | 错误被「详情尽力而为」的 catch 吞掉，条目按列表里的标题和日期入库，之后不再补详情 | 整轮以软失败结束，本轮不入库；限额允许后这些条目连同详情一起重新出现 |
| 归组内部的合并判定与信号重配（`events/group.ts` `consolidate`、`rematchSignals`） | 错误写进结果的 `consolidationError` / `rematchError`，作业算成功 | **没有改**：这两步本来就是尽力而为，被拒后放弃、不补，与次数预算满时相同 |
| 带图的内容理解（`editorial/analyze.ts`） | 整步失败 | 只有 `image_input`（图片没有经核对的上界）才去掉图片、用同一模型再问一次；其他拒绝（含月度用完）不重问 |

恢复：`GET /api/admin/budget-blocked` 列出数量与原因，`POST /api/admin/budget-blocked/resume`（`{ limit, reason }`）每次恢复有限个——先新文章，再按停住的先后恢复归组、综述、报告；默认 50，上限 500，写 `audit_log`。没有任何自动恢复，进入新月份也不会。归组与综述是重新排队；报告没有队列，恢复是把记录标成「已恢复」，由每小时的 catch-up 逐个生成（生成成功后记录删除，再次被拒则重新停住）。同时发起的两次恢复不会拿到同一项。归组、综述、报告之后以任何途径做成了，对应的停住记录会被清掉。

告警：有工作被停住时发一条 today 级告警（`money.blocked`）；「今天的日报还没生成」在日报被金额限制停住时改写「是否自愈」与「要做什么」。

迁移 `0045`：`articles.processing_state` 的取值加 `budget_blocked`，新表 `budget_blocked(kind, ref, job, reason, blocked_at, resumed_at)`。

## 需要 owner 知情或裁决的实现选择

1. **恢复的限速**（ADR owner 输入 9）没有做成自动节流：由管理员每次调用的条数决定，单次上限 500。
2. **缺价格、未批准等拒绝与月度用完同样处理**。ADR 第 8 节的表只写了月度耗尽；#11 的清单把 `MoneyRefusedError` 整类都列入。理由相同：等待不会通过。
3. **采集侧每个间隔仍会问一次**（公众号检查、网页列表信源）：被拒发生在预留阶段，不发请求、不留回执，只在信源上记一条软失败。没有把信源本身标成停住。公众号用游标里的 `lastRefusedAt` 记被拒时间，调度按它与 `lastCheckedAt` 中较晚的一个算间隔。
4. **全文翻译每 5 分钟仍会问一次**：同上，被拒即停止本轮。
5. **管理员手动「重新评估」的文章被停住后，恢复时按普通重排**：那次「要一个新答案」的标记没有保存，恢复后会复用已有回执。需要新答案的话恢复后再点一次重新评估。
6. **告警的起始时间**：文章不记录自己何时被停住，所以有文章被停住时告警从第一次发现算起；只有归组、综述、报告被停住时用记录里的时间。

## 评审第 1 轮后的修改

独立评审（Opus 5.5 只读，绑定 `1063104`）结论 REQUEST_CHANGES，报告原文在 PR 评论里。

| 发现 | 处理 |
|---|---|
| **P2**：并发恢复会把同一篇文章恢复两次（外层 UPDATE 不再核对状态） | 外层加状态条件，子查询与其余项的选取都用 `FOR UPDATE SKIP LOCKED`；补了并发用例（6 轮） |
| **P2**：恢复较早的报告只是删掉标记，而 catch-up 只补最近 7 天，报告实际不会生成 | 恢复改为标记 `resumed_at`；catch-up 先生成所有已恢复的报告，不限日期 |
| **P2**：网页列表的付费详情页被拒后错误被吞掉、条目不再补详情，且文档没列这条路径 | 被拒时整轮按软失败结束、不入库；路径已列入上表 |
| P3：公众号被拒后每 15 分钟就再查一次 | 记 `lastRefusedAt`，按间隔再查；补了用例 |
| P3：停住记录不会被后来的成功清掉 | 归组、综述作业成功后与报告生成成功后清掉 |
| P3：归组内部两处 catch 吞掉拒绝，没列进路径表 | 没有改代码，已列入上表并写明「放弃，不补」 |
| P3：手动重新评估的标记在恢复时丢失 | 没有改，记在上面第 5 条 |
| P3：`regroup-events.ts` 的错误信息不完整 | 改了措辞 |
| P3：告警的 `since` 用的是文章发现时间 | 改了，见上面第 6 条 |

## 验证（本机 PostgreSQL 18.1，一次性库，41 个迁移）

- `npm run typecheck`：通过（[日志](evidence/m0-3b-3b-typecheck.log)）。
- `bash scripts/test-unlocked.sh`（合入 main 的 #29 之后，42 个迁移）：28 个文件，171/171，跳过清单 11 条不变（[日志](evidence/m0-3b-3b-unlocked.log)）。本 PR 新增 11 个用例，都在 `tests/budget-blocked.test.ts`（第 1 轮评审时是 8 个，当时全套 157/157）。
- 变异验证（[日志](evidence/m0-3b-3b-mutations.log)）：第 1 轮前 9 项，每项都让对应用例失败——文章按普通失败处理、安全网捞回 `budget_blocked`、归组作业重抛、被停住的报告每次重做、预热不识别这类拒绝、任何拒绝都去图重问、恢复不限条数、恢复先旧后新、不发告警。第 1 轮后 6 项，也都被发现——恢复不核对状态也不跳过已锁的行、恢复报告时直接删记录、已恢复的报告仍算被停住、生成成功不清记录、再次被拒仍标着已恢复、公众号调度不看被拒时间。

## 这些用例证明了什么，没证明什么

付费闭锁在 `paidRequest` 的第一行就抛错，真实的拒绝走不到预留那一步。所以用例是**把一个构造出来的 `MoneyRefusedError` 直接交给各路径的处理函数**（`afterFailure`、`groupJobFailed`、`digestJobFailed`、`unlessBudgetBlocked`、`embedBatchWaiting`、`writesWithoutImage`）。它们证明「处理函数拿到这类错误后做什么」，**没有证明这类错误从供应商调用处一路传到处理函数**——那一段靠读代码，要等闭锁解除后才能实测。

下面几条路径没有可以单独调用的处理函数，**只过了类型检查，没有运行时证据**：

- `content/extract.ts` 的 Jina 兜底；
- `sources/mp.ts` 的正文与整次检查（调度按被拒时间算间隔这一点有用例）；
- `sources/collect.ts` 的软失败与下次抓取时间，以及详情循环里的重抛；
- 归组、综述作业成功后清掉停住记录的那一行（在 worker 的回调里）；
- `catchUpReports` 调用 `composeResumedReports` 的那一步（后者用注入的生成函数测过）；
- `editorial/translate.ts` 的轮次停止（只断言了错误消息匹配）；
- `editorial/analyze.ts` 里去图重问的那次调用本身（只测了判断函数，并用源码匹配固定了「同一模型、只去图」）；
- 两个脚本（不在 typecheck 范围内，也没有运行）；
- `catchUpReports` 整体（只测了它调用的 `unlessBudgetBlocked` 与 `composeResumedReports`）；
- 「今天的日报还没生成」告警的改写（需要打开采集与模型开关并在 10 点之后）。

另外没有运行：worker 里的真实作业调度；Docker smoke 与 web 构建看本 PR 的 CI。后台页面没有做，只有 API。

## 回退

`git revert` 合并提交。迁移 `0045` 放宽了一个 CHECK 并新建一张表；回退代码前先把 `budget_blocked` 的文章改回 `new`（或 `failed`），再恢复原约束、删表。
