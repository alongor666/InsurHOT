# 附录 A：AIHOT 架构审计（Phase 0）

- 审计对象：<https://github.com/KKKKhazix/AIHOT>，commit `589f79e`（2026-09-29 08:06 +0800）
- 仓库状态：2 个提交（`877d6d5` 开源快照 + `589f79e` 安全修复），489 个文件，约 5.8 万行；Stars ≈705、Forks ≈220、Open Issues 0、PR 0，且 Issue 创建受限（2026-09-29 抓取 GitHub 页面）
- 许可：代码 MIT；**"AIHOT" 名称与 Logo 不在许可范围内**；字体 OFL 1.1；模型厂商与评测来源标志各归其主（`NOTICE`）
- 方法：逐文件阅读 `database/migrations/`、`packages/backend/src/{editorial,events,providers,publication,sources,content,jobs}`、`industry/`、`apps/{api,worker,web}` 关键文件、`docs/`、CI 与部署文件。未运行代码（Phase 0 只读）。

> 结论先行：AIHOT 不是"一个 AI 新闻网站的代码"，而是一套**工程质量明显高于其自述**的"单行业情报流水线框架"。它的强项恰好是 InsurHOT 最不想重写的部分（采集、判重、付费调用回执、预算熔断、事件归组、热度、公开读取层、Agent 出口）；它的缺口恰好是 InsurHOT 的原创部分（实体注册表、PDF/条款解析、产品结构化、证据分级、变化检测、多语言多法域）。

---

## A1. 仓库结构

```
apps/
  api/      Fastify：/api/site（站内）、/api/v1（公开）、RSS、MCP、后台、图片代理、OG 图
  worker/   pg-boss 队列 + cron（Asia/Shanghai）：采集、模型、归组、热度、成刊、告警、清理
  web/      React Router SSR；只经 HTTP 读 api，不碰数据库
packages/
  backend/  全部业务逻辑（admin/ content/ editorial/ events/ ingest/ jobs/ leaderboard/ monitor/
            notify/ operations/ providers/ publication/ reports/ site/ sources/）
  contracts/ 前后端共享类型与常量
industry/   "行业包"：site.ts taxonomy.ts topics.json sources.json prompts/ selection.ts features.ts brand/ pages/
database/migrations/  0001–0038 顺序 SQL（缺 0012/0025/0035 号，属快照裁剪）
scripts/    migrate seed eval-selection regroup-events smoke mcp-check ...
tests/      30 个后端测试文件（约 139 个用例），使用本地假服务，不访问外部
```

技术栈：Node.js 24（直接运行 TS，无后端构建）· TypeScript 7 · Fastify · React Router SSR · PostgreSQL 17（pg_trgm，无 pgvector）· pg-boss · Tailwind · Docker Compose（db/setup/api/worker/web + 可选 Caddy）。

**关键设计：行业相关的一切集中在 `industry/`**。这是 InsurHOT 能"最大化复用"的根本前提。

## A2. 七条架构不变量（`docs/architecture.md`、`AGENTS.md`）

| # | 不变量 | InsurHOT 评估 |
|---|---|---|
| 1 | 单一公开读取层 `publication/`：网页、RSS、API、MCP、sitemap、OG 同源 | **KEEP**，并扩展到 entity/product/benchmark 查询 |
| 2 | 页面不调模型，模型只在 worker 任务中调用 | **KEEP**（成本可控 + 可复现的前提） |
| 3 | 付费请求有回执（`receipts` + `receipt_attempts`），先存后用，重试复用 | **KEEP**，是 Evidence/Provenance 的天然底座 |
| 4 | 预算熔断：每服务每分钟/小时/天上限 | **KEEP**，增加"按任务类型的月度美元预算" |
| 5 | 安全阀环境变量（采集、模型、推送）开发测试默认关 | **KEEP** |
| 6 | 公开内容匿名、后台仅管理员 | **KEEP**（V1 不做账户体系） |
| 7 | 来源可追溯；全文展示默认关（`site_fulltext=false`） | **KEEP**，并升级为 Source License 模型 |

## A3. 数据模型（核心表）

| 层 | 表 | 要点 | 对 InsurHOT |
|---|---|---|---|
| 信源 | `sources` | kind ∈ rss/web_list/json_list/x_search/mp_account/external；`tier` ∈ T1/T1_5/T2/EXCLUDE_MP；`participation_mode` ∈ editorial/hot_signal/isolated；`first_party`；`owner_entity_id`；`signal_group_id`；`site_fulltext`/`syndicate_fulltext`；健康度与游标 | MODIFY：tier 需重做（见 §9），增加 jurisdiction、language、license、source_type、authority 维度 |
| 采集 | `fetch_runs` | 每次抓取记录 | KEEP |
| 资料 | `articles` + `article_revisions` + `article_discoveries` | `identity_key`（规范化 URL）唯一；revision + content_hash；`published_at` 与 `published_at_claim` 分离（防未来时间）；`timeline_at`；backfill 规则 | KEEP；新增 `documents`（PDF/条款/财报等原始文件层） |
| 判断 | `analyses`（append-only）+ `editorial_overrides` | 每次判断存 model、prompt_version、receipt_ids；人工改动带版本号，旧任务不能覆盖 | KEEP（是 Evidence First 的关键先例） |
| 公开投影 | `publications` + `pool_search` + `selected_ledger/state` | 唯一公开出口；ledger 支持 snapshot + changes 增量同步 | KEEP |
| 事件 | `stories`、`facts`、`fact_articles(role: primary/report/mention, evidence)`、`story_links(storyline/related)`、`story_aliases`、`story_digests`、`grouping_decisions`、`grouping_overrides`、`regroup_pending` | fact = 一次真实发生（subject/action/object/conditions/occurred_at），story = 发生 + 直接进展；归组决策可追溯 | MODIFY：fact 的 subject/object 目前是**自由文本**，需挂到实体 ID；增加 fact 类型与断言级证据 |
| 热度 | `story_signals`、`hot_rankings(rule_version, evidence)`、`story_heat_hourly` | 参与者去重、源时间、观测完整性 | KEEP（作为 Hot Score 的一个分量） |
| 成刊 | `reports` + `report_revisions` | 日/周/月报，带修订 | KEEP |
| 主题 | `topics`（company/field/genre） | slug 永不变 | MODIFY：由实体注册表生成 |
| 向量 | `embeddings(kind, ref_id, model, text_hash, vector real[])` | 不用 pgvector，窗口内扫描 | KEEP V1；规模上来后换 pgvector |
| 运营 | `receipts`、`receipt_attempts`、`budgets`、`service_prices`、`job_runs`、`audit_log`、`settings`、`feedback`、`selectbench_*` | 成本、审计、评测 | KEEP |
| AI 专属 | `lb_*`（模型榜）、`monitor_*`（Codex 重置） | 与保险无关 | REMOVE 数据与页面；**保留 lb 方法论的"范式"** |

## A4. AI 流水线（`editorial/analyze.ts`）

```
upsertMaterial（唯一入口：身份/修订/时间线规则）
 → 缺正文则先抓原文页（Jina 兜底，按次计费）
 → prefilter（PASS/BLOCK/UNKNOWN，宽召回；缺材料的 BLOCK 视作 UNKNOWN）
 → [并行] structure（category/tags/subjects/fact，不写读者文本）
 → score ×2（同一 prompt 独立两次，sum ≥ 2×tier 阈值入选；T1=60, T1_5=65, T2=76）
 → writing：入选或均分>50 → understand（标题/答案先行摘要/推荐理由/标签，可看首图）；否则 summarize（便宜）
 → identity guard（标题摘要里出现原文没有的公司 → 回退原标题）
 → analyses（append-only）→ publish → groupArticle（serial）
 → hot.rank（每 5 分钟）、hot.snapshot（每小时）、digest、reports（08:00 日报；周一周报；每月 1 日月报）
```

值得继承的具体工程决策：

1. **评分 prompt 不给信源信息**（"输入故意不提供 T1/T2、来源名称、一手性"），由阈值按 tier 区别对待——把"内容价值"与"来源可信度"解耦。InsurHOT 应把这一思想推广为"事实层 / 评价层 / 来源层分离"。
2. **五轴加权 + 内容类型权重表**（sig/nov/cred/reson/act），模型只输出一个整数；权重写在 prompt 中公开。
3. **prompt 版本 = 内容哈希**；改 prompt 只影响新资料，历史不重算。
4. **SelectBench**：人工金标 JSONL（development/holdout 分割、stratum 分层）→ 精确率/召回率/阈值扫描 → 后台逐条看错例。这是 InsurHOT 评测体系的现成骨架。
5. **归组的三分类关系**（SAME_OCCURRENCE / SAME_STORY / UNRELATED / ROUNDUP）+ 低相似度合并时**换一家模型复核**；注释写明"是/否问法在 370 对标注样本上拒绝了一半真合并"（2026-09-28 实测）——说明作者有数据驱动迭代的习惯。
6. **防幻觉规则**（`rules-anti-hallucination.md`）：不补全年份、不强化语气、排他性表述需原文出现。可直接用于保险（"首款""唯一""最低价"在保险营销中极常见）。
7. **注入防护**：所有素材是不可信数据（`safety.md`）。

## A5. Hot Score（`events/hot.ts`）

- 规则 `heat-v1-48h-halflife24h`：48 小时窗口；每个**独立参与者**（source 或 signal_group）只计一次；按源时间做 24 小时半衰；≥2 参与者且 ≥1 editorial 才入榜；Top 10。
- 趋势：与 6 小时前比较，只比较"观测完整"的参与者（`behindSources` 处理采集延迟）；徽章 surge/new/rising。
- 每次排名存 `rule_version` 与 `evidence`（窗口、半衰期、候选数）。

评价：**这是一个"独立来源计数"的热度，而非点击或转发热度，抗刷能力天然较好**。对保险有两个问题：(1) 保险行业日资讯量远低于 AI，48h 窗口 + ≥2 源会让大部分事件无法入榜，窗口和半衰期需按品类（监管 vs 市场新闻）重新校准；(2) 监管文件的重要性与"被多少人讨论"弱相关——Hot 不能代替 Importance/Change。

## A6. 模型路由与成本（`editorial/models.ts`、`providers/llm.ts`、`receipts.ts`）

- 11 个 capability（prefilter/score/understand/summarize/structure/group/groupReview/digest/report/translate/monitor），每个可经 env 或后台切换模型，切换写审计，只影响新任务。
- 任何 OpenAI 兼容端点作为 `default`；预置 GLM/DeepSeek/Qwen/MiMo 的 flash 级模型——**整套系统默认跑在最便宜档模型上**。
- 回执：logical_key = service + purpose + model + hash(identity) + attemptTag；pending 超时后只自动放行一次；预算按 attempt 计数，重试不能绕过。
- 缺口：没有"置信度驱动的升级路由"（cheap→strong escalation）；没有按任务的美元月预算（只有请求数）；`service_prices` 有单价但成本为估算。

## A7. 采集（`sources/`）

- 六种信源；`web_list` 用 CSS 选择器，可经 Jina Reader 渲染；未知配置键直接拒绝（不静默降级）。
- 频率每日按近 7 天产出自适应（15–180 分钟）；失败不推进游标；每周信源健康周报。
- **旧文不刷屏**：发现时已超过 48 小时的资料按原文时间归档，不进"今天"。
- 外部推送 `POST /api/ingest/items`（Bearer token、限流、默认 isolated）——**InsurHOT 的专用爬虫（监管站、协会产品库）可以通过它接入而无需改采集框架**。
- 缺口：**无 PDF 解析**（全仓库无 pdf 处理代码）；无附件下载与存档；无结构化表格抽取；无网页快照（WARC/HTML 存档）——而保险一手资料（监管文件、条款、偿付能力报告、年报）大量是 PDF。

## A8. 对外出口

| 出口 | 内容 |
|---|---|
| RSS | `/feed.xml`（精选）、`/feed/all.xml`、`/feed/full.xml`（仅允许再分发的来源带正文）、`/feed/daily.xml`、`/feed/category/<key>.xml` |
| REST v1 | `/api/v1/items`（mode/window/by/category/q/limit/cursor）、`hot-topics`、`stories/{publicId}`、`dailies[/latest|/{date}]`、`selected/snapshot` + `selected/changes`（增量同步）；OpenAPI 在 `/openapi-v1.json` |
| MCP | Streamable HTTP `/api/mcp`，5 个只读工具：`<prefix>_get_latest / _search / _get_hot / _get_story / _get_daily`；每个工具返回人读文本 + `structuredContent`（schemaVersion 1）；描述中明确"不要编造 public_id" |
| llms.txt | 由配置生成，只列真实存在的资源 |

评价：Agent 出口设计成熟（匿名只读、增量同步、防 ID 编造）。InsurHOT 只需扩展资源类型（entity/product/benchmark/business-model/evidence/regulation）。

## A9. 模型榜模块（`leaderboard/`）——对 Product Benchmark 的方法论启示

虽然要 REMOVE，但它是仓库里**最接近 InsurHOT Benchmark Engine 的先例**：

- 多来源证据 → 统一身份（alias 表把同一模型的不同叫法对齐）→ 方法版本化（`METHOD_VERSION = "2026.09-public-consensus-v15"`）→ "改任何常数都要升方法版本并同步公开规则页"。
- 证据预算（broad 30%、preference 10%、专项 60%）显式公开；来源登记表记录每个来源测什么、状态、份额。
- 快照（`lb_snapshots` 带 license、attribution_url、content_hash、fetched_at）。

InsurHOT 应继承这一**治理范式**（方法版本化、规则页即代码、快照带许可与哈希、身份对齐表），而不是继承其 Kemeny 排序算法本身（保险产品不应输出单一全序排名，见 §13）。

## A10. 测试、CI、部署

- CI（GitHub Actions，action 固定到 commit SHA）：typecheck → web build → web tests → migrate+seed → smoke（采集与模型关闭）→ 后端测试（真实 PG 17）→ Docker compose 冒烟（断言 18 个示范信源导入）。
- 测试不访问外部服务；模型与付费接口由本地假服务回答。
- 部署：单机 Docker Compose；Caddy HTTPS；中国大陆可用 npm 镜像；pg_dump 备份可选。

## A11. Findings / Risks（只登记，不修）

| ID | 类型 | 发现 | 影响 | 建议 |
|---|---|---|---|---|
| F-01 | Gap | 无 PDF/附件解析与存档 | 保险一手资料大量为 PDF，无法进入流水线 | 新增 `documents` 层 + 解析服务（Phase 1 必做） |
| F-02 | Gap | 实体是 `industry/taxonomy.ts` 里的硬编码字典（15 个 ENTITIES + 身份正则） | 保险机构在单一法域即数以百计、全球以千计（加上中介、MGA、InsurTech 更多；精确数量 NEEDS VALIDATION），无法用代码字典维护 | 实体注册表入库（`entities` + `entity_aliases` + 外部 ID） |
| F-03 | Gap | `facts.subject/object` 为自由文本 | 无法做实体级查询、跨事件聚合、变化检测 | fact 增加 `subject_entity_id` 等外键与 fact_type |
| F-04 | Constraint | 单语言输出（`title_zh/summary_zh`、prompt 全中文）、时区硬编码 Asia/Shanghai（8 处） | 全球化需要多语言与时区 | V1 保持中文输出 + 保留原文；Phase 2 引入 `locale` 维度 |
| F-05 | Constraint | 每条资料只有一个 `category`（单选） | 保险资讯常跨"监管 × 产品 × 公司" | 改为主分类 + 多维 facet（domain/line/jurisdiction/entity） |
| F-06 | Constraint | `publications.channel` 仅 news/x；`sources.kind` CHECK 固定六种 | 新增监管库、产品库信源需迁移 | 增量迁移放宽 CHECK |
| F-07 | Calibration | Hot 规则 48h 窗口、≥2 参与者针对 AI 高频资讯校准 | 保险资讯稀疏，榜单可能长期为空 | 按信源密度重新校准，并让窗口成为 rule_version 的一部分 |
| F-08 | Calibration | 精选阈值 T1 60 / T1_5 65 / T2 76 为 AI 领域校准 | 直接沿用会误选/漏选 | 必须用保险金标集重新校准（SelectBench 已支持） |
| F-09 | Risk | 快照式开源，作者声明"不保证同步"；Issue 创建受限 | 上游修复难以获取 | 视为一次性基线，不追上游（见决策 2） |
| F-10 | Risk | `apps/api` 中 Fastify `trustProxy: true`，依赖"api 不对外暴露"的部署拓扑 | 若误将 3001 端口暴露，限流可被伪造 IP 绕过 | 部署文档中明确 api 端口不可暴露，或改为可配置 |
| F-11 | Gap | 没有"置信度驱动的模型升级"与按美元计的月度预算 | 低成本模型出错无兜底 | 在 receipts 之上加 escalation 与 cost ceiling |
| F-12 | Gap | 没有网页/文件快照归档（只存正文文本与 revision） | 监管页面撤稿/改版后证据丢失 | 原始文件对象存储 + 哈希（Evidence 需要） |
| F-13 | Naming | 包名 `@aihot/*`、DB 名 `aihot`、`raw._aihot` 字段、`X-...` 等残留品牌 | 许可要求不使用 AIHOT 名称/Logo（代码中的内部标识不属于对外品牌，但对外可见处需清理） | 一次性重命名 `@insurhot/*`；对外页面、UA、MCP 前缀全部替换 |
| F-14 | Scale | 事件归组串行（队列并发 1），召回扫描 14 天窗口内存向量 | 若接入大量全球信源，归组成为瓶颈 | 按法域分区或换 pgvector；V1 规模下不是问题 |

## A12. 审计结论

1. AIHOT 的"行业包"抽象在**资讯层**是真的可用：换信源、换 prompt、换 taxonomy、关模块，即可得到一个可运行的"保险资讯站"。这意味着 InsurHOT 的资讯层可以在数周内上线，而不是数月。
2. AIHOT 的数据模型是**以 article 为中心**的；InsurHOT 需要**以 entity/document/assertion 为中心**的数据层。这不是重写，而是在现有 schema 旁增量新增（articles 仍是资讯层的中心）。
3. 最值得保留的是它的"工程伦理"：回执、审计、版本化 prompt、append-only 判断、人工覆盖不被自动流程冲掉、方法版本化、默认不展示全文。这些与 InsurHOT 的 Evidence First 宪法一致。
