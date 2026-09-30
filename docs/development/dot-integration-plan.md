# Dot 信息接入规划

2026-09-30；任务 [#8](https://github.com/alongor666/InsurHOT/issues/8)，工程底座依赖 [#4](https://github.com/alongor666/InsurHOT/issues/4)。Owner已授权直接接入，不增加Dot内容质量对照试运行作为前置。此决定选择信息处理服务，不构成“所有输出必然正确”或已经完成账户连接的事实证明。

## 1. 定位与分工

沿用 InsurHOT 的使命：发现保险行业什么重要、什么正在变化、什么正在诞生。范围是行业公开信息、产品比较与评价、特别是AI带来的新商业模式；不改成单公司经营系统或渠道情报系统。

Dot负责信息发现、来源整理、去重、归纳和解读。InsurHOT负责接收、来源归属、持久化、事件关联、更正撤回及三支柱展示。Dot原创摘要直接入库，不再经过旧付费分析队列。原始监管文件、公司文件及报道仍是来源；Dot是处理者，不能把处理者名称当成原始证据等级。

技术验收只检查交付合同、鉴权、幂等、时间、存储及副作用。不为Dot另设内容质量比较、等待一周或人工逐篇评分的接入闸门。公开事实与分析的标记、来源访问/留存权限和既有G2上线合同继续适用。

## 2. 官方能力及未确认项

- [OpenAI Docs：Get started with your dot](https://learn.chatgpt.com/docs/dots/getting-started)说明Dot可以承担持续责任，使用通过插件连接的应用，使用其云电脑/浏览器，并按明确指令安排后续任务。任务与连接状态需在实际Dot账户中确认。
- 同一文档说明可连接本机，但本机工作依赖电脑在线、ChatGPT应用运行。云端Dot并不自动拥有用户本机文件或本项目凭据。
- 已读官方文档未确立一个可供InsurHOT主动调用的专用Dot REST API、结果订阅webhook或导出格式。本项目新增的HTTP入口是InsurHOT自有接口，不能命名为“官方Dot API”。
- 本会话可用工具没有Dot创建/配置能力。目前未创建真实Dot责任、连接、运行计划或提交记录。普通ChatGPT自动任务不能冒充Dot。

## 3. 数据通路

选定公开来源 → Dot发现与解读 → JSON v1交付 → 专用鉴权/格式检查 → 私有Dot存储 → T2证据与事件关联 → Matters/Changes/Emerges投影。

D1不会调用旧`/api/ingest/items`：旧`ingestItems`接收后会自动`queueProcessing`，可能重复模型加工；也不会自动建立或启用上游示范信源。无抓取、模型、embedding、队列、推送或公开发布副作用。

## 4. 三次独立交付

| 阶段 | 产出 | 实际通过条件 | 当前状态/依赖 |
|---|---|---|---|
| D1 接收端 | v1合同；POST `/api/ingest/dot`；独立token；`dot_deliveries`/`dot_items`；幂等回执 | 本地HTTP/service检查；typecheck/web build；独立工程评审；真实PG迁移/回滚/并发在可运行环境验收 | 已实现；HTTP/service 检查与真实 PostgreSQL（迁移 0039、幂等、409、并发、整批回滚）均已通过，见 [D1证据](dot-d1-evidence.md)；取代 PR #9 的新 PR 待独立评审与合并 |
| D2 Dot交付通道 | Dot责任说明、`submit_dot_batch`工具或受控文件交付桥、连接台账 | 实际账户可用连接；专用凭据仅服务端保管；收到一批真实Dot数据并记录deliveryId/服务器回执；重复提交不新增数据 | 未配置；先使用官方支持的实际应用/插件能力选择通道，不虚构API；本机通道需在线电脑 |
| D3 产品呈现 | 私有分析读取与三支柱卡片；来源、事实/分析标记、更正撤回 | T2/T4同一证据和公开出口合同；固定HEAD工程验收；实际部署条件满足 | 未实现；依赖证据链、M0剩余项和G2 |

D2真实交付回执用于证明连接可用，不用于重新评测Dot内容质量。D1尚不去重跨批次事件或提供全文证据；D3需按原文身份/事件身份合并，不把多个Dot批次当多份独立证据。

## 5. D1 接口合同

请求：`Content-Type: application/json`，`Authorization: Bearer <专用凭据>`。`DOT_INGEST_ENABLED`只有字面值`true`启用，缺省/false/非法值均在存储前拒绝；`DOT_INGEST_TOKEN`独立于旧`INGEST_TOKEN`，拒绝短值和占位值。实际值只通过私有凭据渠道配置，不入Git、请求正文或任务提示词。

| 字段 | 含义/限制 |
|---|---|
| `schemaVersion` | 固定`insurhot.dot.v1` |
| `deliveryId` | 1–80字符安全批次ID；同ID同内容幂等，同ID不同内容409 |
| `items` | 1–50条；整个请求最多256KiB；任一条不合法则整批拒绝 |
| `itemId` | 1–80字符安全ID，批内唯一；D1不承诺跨delivery去重 |
| `title` / `summary` | 非空，最长500/4000字符；summary声明为Dot原创摘要，不接收原文全文或快照 |
| `pillars` | `matters`/`changes`/`emerges`，1–3个且无重复 |
| `assertionKind` | `reported`或`inference`；不能提交`fact_primary`作为模型自我认证 |
| `sources` | 1–10个原始来源；HTTPS且无URL凭据；publisher最长200；publishedAt可为null |
| `dotObservedAt` | Dot报告的观测时间，独立于服务器和来源时间 |

所有层级拒绝未知字段；字符串拒绝NUL和孤立UTF-16 surrogate，以免合法JSON在PG存储时变成可重试错误。对象键序不影响payload哈希；数组顺序和具体文本有意义。文字及HTML均当数据保存，不执行指令；后续显示必须采用安全文本渲染。入口不跟随来源链接，不验证发布者自报身份，也不认证Dot作者身份。

服务器生成`receivedAt`/`firstSeenAt`，不取文章发布时间或Dot报告时间。重复批次返回首次时间。当前firstSeen只代表本系统首次接收该批次/条目，不代表事件最早公开、源文首次观测或已证明全球首发。存储默认`publication_status=private`、`rights_status=unknown`、`evidence_status=unverified`；这些表示公开证据/权限尚未建立，不是新增Dot质量试运行。

成功回执包含schemaVersion、deliveryId、producer、status(received/duplicate)、receivedAt、firstSeenAt、itemCount，不返回摘要或凭据。HTTP状态：缺省关闭503；鉴权失败401；格式错误400；超限413；批次冲突409；存储不可用503。回执统一`Cache-Control: no-store`。

## 6. Dot责任配置准备

连接完成后给Dot的长期责任：持续关注保险行业重要变化、产品及评价标准、AI新商业模式；优先保留原始文件链接与发布者；合并同一事件的重复报道；区分报道与自身推断；按v1合同交付原创摘要。行业客观性沿用C0，不偏向某一家保险公司。

配置建议：每日北京时间09:00提交常规批次；重大事件另行提交，稳定批次ID用于重试。此为待配置运行方案，不是已建立的定时任务。Dot不购买订阅、不调用项目付费模型、不向公共出口发布；无法访问的来源明确记录，不能声称已读取。API服务凭据由提交工具绑定，不能要求Dot把token写到公开文件或聊天记录。

D2先核实实际可用的应用连接；若采用本机文件通道，落盘v1 JSON后由桥提交，并保留成功回执再归档，失败重试保持同一deliveryId。若采用插件/MCP，工具名称`submit_dot_batch`只是本项目拟提供工具；需要另行实现、安装、授权并核实Dot可调用，当前没有该工具。

## 7. 与M0及公开发布的边界

- M0.1 导入工具、M0.2 固定快照整合（#6）、M0.3a 默认拒绝与付费闭锁（#7）、应用 CI 与仅-loopback 测试守卫（#19）已合入 main；状态以台账 #3、#4 与 action-plan 为准。
- M0.3b金额价格/币种、全局与任务上限、原子预留、未知回执及换档约束仍未完成；付费出口闭锁不解除。
- M0.4品牌/可选模块和M0.5本仓完整应用CI仍未完成；D1不替代任何一项。
- 此阶段仅工程实现和本地假服务验证。未启用真实采集、Dot生产连接、收费模型、API listener/worker或生产推送。尚无可公开上线的InsurHOT。

## 8. 失败处理与回退

最薄弱假设是用户账户中的Dot能使用一个可持续、可鉴权的实际交付通道。如果其工具权限或可用性不支持自动提交，保留同一v1合同，使用受控文件交付桥；不改用未获批准的收费模型或浏览器绕过来伪装接通。

失败的批次不触发任何分析/发布。相同ID变更正文返回409，由交付者为新版本生成新ID。存储错误不回传数据库信息或材料全文。跨批次更正与撤回在D3完成前不承诺公共传播。

回退：关闭`DOT_INGEST_ENABLED`，撤销专用token，再通过独立回退PR移除路由/代码。迁移没有自动down；已接收数据不能在未确定保留/删除要求时自动丢弃，数据库回退在临时PG中验证并记录后执行。现阶段无真实数据。
