# M0.3b 第 2 步：金额机制接入 `paidRequest` 与五个 provider

2026-09-30；Refs #11；方案 [ADR-015 金额预算部分](../adr/015-monetary-budget-hard-limits.md)（Proposed）；第 1 步见 [核心证据](m0-3b-money-core-evidence.md)。基线 main `32a3fad42bba397239a155ffd0112698588a2c1f`，分支 `feat/m0-3b-money-wiring`。实施者为 Claude 会话单一写入；独立评审另派，结果绑定固定 HEAD 记录于 PR，以下自检不冒称独立评审。

## 范围

- [`providers/receipts.ts`](../../packages/backend/src/providers/receipts.ts)：`paidRequest` 拆为三步——`claimPaidRequest`（判定是否发送；要发送时建 attempt 并预留最坏成本）、`settlePaidAttempt`（收到回执）、`failPaidAttempt`（调用失败）。三步都只做数据库记账，不发任何请求。`paidRequest` 首行的 `assertPaidOutboundDisabled()` **未动**：闭锁之后才是这三步。
- `ReceiptRequest` 新增必填的 `money`（`MoneySpec`：价格行键、请求地址、最坏成本函数、可选的实际成本函数）。TypeScript 因此强制每个付费调用点声明如何计价。
- `ProviderRejectedError` 增加 `httpStatus`、`providerCode`、`notBilled`、`cost`；原 `status`/`retryable` 保留，现有读取它们的调用方不受影响。
- 五个 provider 各自声明计价方式，并导出以便测试：

  | provider | 价格行键 | 最坏成本 | 实际成本 |
  |---|---|---|---|
  | LLM（`chatMoney`） | 模型名 | 最终请求体字节 + `max_tokens`（`chatWorstCase`） | usage 的 prompt/completion/total token × 价格行 |
  | embeddings（`embeddingsMoney`） | 模型名 | 请求体字节 | usage × 输入价 |
  | Dajiala（`dajialaMoney`） | `post_history` / `article_detail` | 每请求价 | 供应商返回的 `cost_money` |
  | Jina（`jinaMoney`） | `reader` | 每 token 价 × 供应商侧上限；无上限即拒绝 | `x-usage-tokens` × 单价 |
  | SocialData（`socialdataMoney`） | `search` / `article` / `tweet` | 每对象价 × 供应商侧上限；无上限即拒绝 | 返回对象数 × 单价 |

- 代码里的硬编码单价（Jina ¥0.36/百万 token、SocialData $0.0002/对象）已删除。
- 迁移 [`0041_price_unit_precision.sql`](../../database/migrations/0041_price_unit_precision.sql)：`service_prices.per_unit` 由 `numeric(14,6)` 改为 `numeric(18,10)`——按 token 的单价是百万分之一元的量级，六位小数会存成 0。
- [`tests/paid-wiring.test.ts`](../../tests/paid-wiring.test.ts)：10 项，真实 PostgreSQL。

**没有做**（第 3 步）：月度耗尽与拒绝在各调用路径上的处理与 `budget_blocked` 状态、带图片的 understand 调用的降级、告警与每日对账、后台批准价格/限额与人工释放入口（含"未计费"时调用结算释放）。

## 行为

- **拒绝不留痕**：缺价格、主机不符、缺或未批准的限额、月度耗尽、purpose 无 capability、subject 不成主体、缺次数预算——任何一种都让 claim 整个事务回滚，不留下 receipt 或 attempt。
- **预留**：attempt 记录 capability、价格行（服务与键）、主体键、预留额与币种；同一请求在途时再次 claim 返回 busy，不重复预留。
- **回执**：有供应商自报金额（Dajiala）用自报值（`cost_basis = actual`）；否则按 usage × 价格行计算（`estimated`）；算不出则保持预留。已存回执被复用时不产生新预留；回执事后被判不可用（`rejectReceivedResponse`）不释放金额。
- **失败**（`settlementForError`）：供应商带回金额的按该金额计；明确未受理的释放——发送前连接失败、HTTP 401/402/403/429、Dajiala 限流码 `-1`；其余（HTTP 400/422/5xx、Dajiala 其他业务码、超时、连接中断）保持占用。供应商业务码不当作 HTTP 状态码（业务码 401 不释放）。
- **重试**：失败后的重试是新 attempt、单独预留；结果未知的请求不重试，也不新增预留。
- **超支**：实际高于预留时按实际计入并停用价格行（第 1 步机制），`paidRequest` 记一条 error 日志；告警接入在第 3 步。
- **锁序**：claim 为"每服务锁 → 全局锁"，结算与失败为"全局锁 → attempt 行 → 台账行 → 再写状态"，符合 `money.ts` 头注释的两条约束。

## 本仓实测

本机 PostgreSQL 18.1，临时库 `insurhot_test`，Node v25.5.0。仅本仓结果。

| 命令 | 结果 | 日志 |
|---|---|---|
| `node scripts/migrate.ts` | 38 个迁移（含 0041）应用，exit0 | [migrate](evidence/m0-3b-wiring-migrate.log) |
| `node --test tests/paid-wiring.test.ts` | 10/10，exit0（重复 4 次均通过；测试结束后采集服务的次数预算恢复原值） | [wiring tests](evidence/m0-3b-wiring-tests.log) |
| `npm run typecheck` | exit0 | [typecheck](evidence/m0-3b-wiring-typecheck.log) |
| `bash scripts/test-unlocked.sh` | 28 文件 146/146，exit0（上一基线 136 + 本步 10） | [unlocked](evidence/m0-3b-wiring-unlocked.log) |
| Docker、真实供应商、任何付费调用 | **NOT RUN** / 未发生 | — |

10 项覆盖：七种拒绝各自不留痕；预留内容与在途 busy；usage 结算（含 total_tokens 多出的部分按输出价计）、无 usage 保持预留、复用不再预留、不可用回执不释放；十种失败各自释放或保持；重试另行预留、未知不重试；LLM 计价在推理核对、矛盾开关、`extra` 抬高输出上限、图片输入下拒绝；embeddings 计价且无主体层；Dajiala 两端点、自报金额与各业务码；Jina/SocialData 无上限拒绝、有上限按上限预留、按返回量结算、超过上限即停用价格行；16 路并发 claim 在 capability 限额下恰好放行 5 路，随后 25 个并发的 claim/回执/失败无死锁，台账与 attempt 对账一致。

`tests/outbound-policy.test.ts` 的既有用例继续证明：`paidRequest` 在任何开关下都先抛 `PaidOutboundDisabledError`，不触达数据库，也不调用计价函数。

## 未声称的性质

- `paidRequest` 的端到端路径（claim → 真实调用 → 结算）仍被闭锁挡住，没有也不能在本仓测试；三步分别测试，衔接处只有十余行。
- 实际成本按 usage × 价格行计算，是估算而非账单；某供应商若不在 usage 里报告全部计费 token，会低估——这是 ADR 待批准项 6、8（价格行语义核对、按账单对账）要覆盖的。
- `tests/paid-lock-blocked*.txt` 的清单未变；闭锁解除前这些上游测试保持排除，解除时它们还需要测试用的已批准价格行与限额。

## 回退

revert 本 PR。迁移 0041 只放宽一列的精度，可保留。
