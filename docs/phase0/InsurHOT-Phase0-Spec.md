# InsurHOT Phase 0 Architecture & Product Specification

> **InsurHOT — Insurance High-value Observed Trends**
> 保险行业高价值变化与趋势情报平台
> *Discover what matters, what changes, and what emerges in insurance.*
> 发现保险行业什么重要、什么正在变化、什么正在诞生。

- 版本：Phase 0 / v0.3 提议稿（2026-09-29；基于 v0.2 的独立评审修订，见 [评审与验收记录](review-2026-09-29.md)）
- 状态：Draft；原 v0.2 未通过实施基线验收。本修订待独立复审，不含实现；文档合并、Phase 0 规划验收与 Phase 1 上线分别裁决，见 [交付门槛](delivery-gates.md)。
- 基线：AIHOT `589f79e`（MIT，2026-09-29 开源快照）
- 配套附录：
  - [附录 A：AIHOT 架构审计](aihot-audit.md)
  - [附录 B：竞品与相邻产品](research/competitors.md)
  - [附录 C：AI 保险商业模式案例与判定框架](research/ai-business-models.md)
  - [附录 D：产品评测方法论与合规边界](research/benchmark.md)
  - [附录 E：全球与中国公开信源](research/sources.md)
- 标注约定：`[A§x]` 指附录 A 的章节，`[B:S12]` 指附录 B 的第 12 号来源，其余附录同理。**UNKNOWN / NEEDS VALIDATION** 表示未经一手来源确认的内容；未标来源的判断均为本规格的设计主张，而非事实陈述。

---

## 目录

1. Executive Summary
2. InsurHOT 一句话定义
3. Product Constitution
4. 用户与使用场景
5. AIHOT 架构审计（摘要）
6. KEEP / MODIFY / REMOVE / NEW Matrix
7. Information Architecture
8. Insurance Taxonomy
9. Source Architecture
10. Event Model
11. Entity Model
12. Product Schema
13. Product Benchmark Framework
14. Product Hot Score
15. AI Insurance Business Model Taxonomy
16. Business Model Innovation Criteria
17. New Species Schema
18. Hot Score vs Change Score（及三支柱信号）
19. AI Pipeline
20. Evidence / Provenance Architecture
21. Data Architecture
22. API / RSS / MCP Architecture
23. Global / China Strategy
24. Model Routing & Cost Strategy
25. Evaluation Framework
26. UI Information Architecture
27. Security / Compliance / Copyright Risks
28. Non-goals
29. Competitor / Adjacent Product Analysis
30. Technical Debt / Migration Risks
31. MVP Definition
32. Phase 1 / Phase 2 / Phase 3 Roadmap
33. Open Questions
34. ADR 建议清单
35. 最终推荐目标架构
36. 十个决策问题的回答

---

## 1. Executive Summary

**定位（owner 已确认，P0 上位约束，见 §3 C0）。** InsurHOT 中的 **HOT = High-value Observed Trends**，不是"热门新闻"。产品要回答的不是 *What is hot?*，而是三个问题：

- **What matters?** 什么重要；
- **What is changing?** 什么正在变化；
- **What is emerging?** 什么正在诞生。

本规格中，这三个问题分别由 Importance、Change、Emergence 三类信号和对应视图承担；热度（Attention，技术名沿用 Hot Score）只是辅助信号（§18）。

**问题。** 保险行业的公开信息分散在监管机构、行业协会、数百家保险公司的信息披露栏目、条款 PDF、财报和各国媒体里。现有产品各自只解决了一段：

- 新闻媒体提供"文章流"，但不做"论断 → 一手证据"的链接 [B§3.2]；
- 创投数据库按赛道和融资阶段分类，不按商业模式结构分类 [B§0]；
- 产品评级只在单一法域内成立，方法不透明，而且普遍与佣金或授权费挂钩 [D§1.1]；
- 监管情报是付费 B2B 产品 [B§2.10]。

**机会假设。** 本轮检索样本中未确认有公开产品同时做到以下几点；这是待证伪的竞争假设，不是穷尽市场后的事实：

1. 论断级证据链；
2. 跨法域一致的实体与产品结构；
3. 公开、可复算的产品评价方法；
4. 以证据判定"AI 是否改变保险商业模式"；
5. 面向 AI Agent 的结构化接口。

**基础。** AIHOT 已经解决了情报流水线中工程上最难、最费时的部分：采集、判重、双次评分精选、事件归组、独立来源热度、付费调用回执与预算熔断、单一公开读取层、RSS/API/MCP。它的"行业包"抽象让资讯层几乎可以零代码迁移 [A§A1–A8]。它缺的恰好是 InsurHOT 的原创部分：

- 实体注册表；
- PDF/条款文档层；
- 断言级证据；
- 产品结构；
- 变化检测；
- 多法域 [A§A11]。

**核心判断（详见 §36）：**

1. **导入而不重写**：以 AIHOT `589f79e` 为一次性基线导入本仓库（不走 GitHub fork，不追上游），保留约 80% 的 TS 代码（按行数估算：AIHOT 约 4.07 万行 TS/TSX 中，AI 专属的模型榜与 Codex 监控约 0.75 万行，约 18%，将被删除），删除 AI 专属模块，在旁边新增领域层。
2. **InsurHOT 的中心不是 article，而是 Evidence**。新增 `documents → passages → assertions → evidence links`，事件、产品、商业模式卡、评分都只能引用断言。这是 InsurHOT 与"保险新闻网站"的根本分界。
3. **Product Benchmark 的方法与数据结构进 MVP，面向中国公众发布的评分和比较不进 MVP。** 原因是 2021 年《互联网保险业务监管办法》第二十三条禁止非保险机构"比较保险产品、保费试算、报价比价"，而 2026-09-30 施行的《金融产品网络营销管理办法》第二条、第十八条进一步收紧 [D§5.3]。公开评分需要先拿到律所书面意见。
4. **Benchmark 采用多维分数卡**。综合分只在公开命名的 Profile 下出现，门槛（红旗）先于加权，跨可比集合不排名，并做"被占优"检测 [D§7]。
5. **AI Business Model Radar 以"New Species 登记簿"的形式进 MVP**，人工策展为主。附录 C 已经完成 58 个案例的初步编码，冷启动成本低，法律风险低，差异化最强。
6. **不建图数据库**。V1 用 PostgreSQL 关系模型表达"图形状"的实体关系；只有在出现 ≥3 类必需的多跳查询、且关系模型性能不足时（最早 Phase 3），才考虑 graph 化。
7. **中国与全球用一套核心模型，信源、分类映射、险种 schema 按法域分层扩展**，而不是两套系统。
8. **三支柱信号：Matters / Changes / Emerges**。
   - Importance 由 AIHOT 的双评分机制改造而来，衡量重要性，不衡量热度；
   - Change Score 新建，从确定性规则起步：监管生效、条款版本 diff、实体状态变化；
   - Emergence 新建：首次出现、扩散阶段、New Species。

   Hot Score 保留为关注度（Attention）辅助信号，继承后重新校准，不作为首页主轴。
9. **护城河**：随时间累积的版本化结构数据（首次发现时间、变更史），加上公开方法的公信力与不收佣的独立性，再加上评测金标集。聚合层本身没有壁垒：已有人基于 AIHOT 做出了金融/保险方向的 `finhot` [B§2.14]。
10. **只能做三件事时**：
    1. 证据优先的采集内核 + 实体注册表；
    2. 中国优先的监管与公司情报流（含监管变化检测）；
    3. New Species / AI 商业模式雷达。

---

## 2. InsurHOT 一句话定义

**正式品牌定义（owner 已确认）**

- **InsurHOT = Insurance High-value Observed Trends**
- 中文：**保险行业高价值变化与趋势情报平台**
- Mission：*Discover what matters, what changes, and what emerges in insurance.*（发现保险行业什么重要、什么正在变化、什么正在诞生。）

**展开定义**（Phase 0 规划使用的工作定义，与品牌定义一致）：

> **InsurHOT 是一个独立、证据可追溯、面向人和 AI Agent 的保险行业公共情报基础设施：它持续把全球公开的保险信息转化为可验证的事件、实体、产品事实与结构性变化，并用公开的方法对它们进行解释与评价。**

英文：*InsurHOT is independent, evidence-traceable public intelligence infrastructure for the insurance industry, for humans and AI agents.*

它**不是**：

- 保险热点站或保险新闻聚合站。"HOT"指高价值的、可观察的趋势，不指热门；
- 保险比价或销售平台；
- 某家保险公司的经营系统；
- 投保建议工具。

---

## 3. Product Constitution

以下条款是项目宪法，优先级高于任何功能需求。与宪法冲突的需求默认拒绝，除非走 ADR 修宪流程（§34）。

### C0 定位与使命（owner 已确认的 P0 上位约束，ADR-023）

C0 由 owner 冻结。C1–C7 与本规格其余部分都服从 C0；本规格的任何修订都不得改变 C0，修改 C0 只能由 owner 发起。

1. **品牌**：InsurHOT = **Insurance High-value Observed Trends**，保险行业高价值变化与趋势情报平台。"HOT"正式定义为 High-value Observed Trends，**不再仅表示热门新闻**。
2. **使命**：*Discover what matters, what changes, and what emerges in insurance.* 发现保险行业什么重要、什么正在变化、什么正在诞生。
3. **三个问题 → 三类产品能力**：

   | 问题 | 含义（owner 定义） | 本规格中的承载 |
   |---|---|---|
   | **What matters?** | 识别真正重要的保险行业事件、监管变化、产品与市场信号，而不是简单追逐新闻热度 | Importance 信号（§18、§19.3）；"重要"视图；日报的重要事件节 |
   | **What is changing?** | 发现产品、风险、监管、市场结构、技术和商业模式正在发生的实质性变化 | Change 检测器与 Change Score（§18）；监管追踪；产品版本 diff |
   | **What is emerging?** | 发现尚未成为行业共识的新产品、新风险、新技术应用，尤其是 AI 驱动的新保险商业模式和"保险新物种" | Emergence 信号与扩散阶段（§18）；New Species 登记簿（§15–§17） |

   热度（*What is hot?*）不是产品目标，只作为辅助的关注度信号（Attention）。
4. **Evidence first, opinion last**（展开见 C1）。
5. **客观不等于不评价**：InsurHOT 可以建立保险产品评价体系，但必须**先**建立公开、统一、可解释、可复算、证据可追溯的评价标准（展开见 C2、§13）。**Product Benchmark 是重要能力。**
6. **AI 驱动的新保险商业模式（Business Model Radar / New Species）是最高优先级研究方向之一**（§15–§17）。
7. **边界**：
   - InsurHOT 不是任何一家保险公司的内部经营系统；
   - 不研究各保险公司的内部渠道经营、内部费用政策、内部客户或经营数据；
   - 面向整个保险行业的公开信息空间（展开见 C4、§28 N1–N3）。

### C1 Evidence First, Opinion Last

1. 任何对外发布的**事实性陈述**，必须能回溯到至少一个获准留存证据的 `DocumentVersion` 中的具体位置，包括页码、条款号、段落或字符区间，并带抓取时间与内容哈希；快照的留存范围受许可约束（§20.2）。无法合法保留足够证据的资料只作为线索，不进入已证实事实投影。
2. 每条对外陈述都带**认知状态**：

   | 状态 | 含义 |
   |---|---|
   | `fact_primary` | 一手来源直接陈述 |
   | `fact_reported` | 二手来源报道 |
   | `claim_self` | 当事方自称，如"理赔 90% 自动化" |
   | `inference_model` | 模型推断 |
   | `judgment_editorial` | 编辑或方法论判断 |
   | `disputed` | 存在相互矛盾的证据 |

3. **LLM 输出永远不是证据**。模型可以抽取、归纳和推断，但它产出的只能是"指向证据的断言"，不能自己成为来源。
4. 分开记录 **InsurHOT 首次实际观测时间**（`first_seen_at`）与**当前已核验的最早公开证据时间**（`first_public_evidence_at`）；后者不等于全球首次出现，不能反写前者（§20.3）。
5. 同一断言有多个来源时，区分"独立来源"和"转载同源"，转载不计入独立性。

### C2 客观 ≠ 不评价；先公开标准，再评价对象

1. 任何评分、分级、排序，都必须先有一份**公开、版本化的方法文档**，并且可由公开数据复算。
2. 评价与事实在数据层物理分离：评分引用断言，断言不引用评分。
3. 项目主动禁止输出"最佳/第一/最好"式结论及单一总榜。相关法律条款分别具有广告或保险营销等适用前提，不能把项目政策等同于对所有独立研究的一概法律禁止；具体公开形态见 §27 和附录 D §5.3。
4. 缺失数据显式标注，不插补为"好"，也不插补为"平均"。

### C3 独立性

1. 不接受被评对象付费、不收导流佣金、不设投保通道、不卖评级徽标授权。
2. 团队利益冲突公开，评测人员执行回避规则。
3. 若将来有收入，只能来自与评价结论无关的渠道，例如 API 配额、数据集授权、研究订阅，并在 ADR 中登记。

### C4 公开、合法、可验证

1. 只处理公开、合法取得、可回溯验证的信息。
2. 不接入任何机构的内部经营数据、客户数据；V1 不建设自然人实体或画像。公开文件夹带的自然人信息按必要性和许可处置，原件仅在合法且必要时受限留存，公开及发送外部模型前脱敏（§9.3、§27）。
3. 每个信源都有**许可记录**：能否存全文、能否展示全文、能否再分发、能否机器抽取。许可不明时，默认只存元数据、摘要和链接。

### C5 为人和 Agent 同等设计

1. 所有公开内容同时提供人读页面与结构化接口。两者读同一公开读取层，结果一致（继承 AIHOT 不变量）。
2. 接口返回证据链，而不只是结论。

### C6 可复现、可纠错

1. 模型调用有回执，prompt 有版本，判断只追加不覆盖，人工修正不会被自动流程冲掉（继承 AIHOT）。
2. 对外提供**更正通道**。被评对象和公众都可以提交附证据的更正，处理记录公开。

### C7 不为 AI 而 AI，不为图谱而图谱

1. 能用确定性代码或规则做的，不用模型；能用小模型做的，不用大模型（§19、§24）。
2. 新的数据结构只在有明确查询需求时引入（§11）。

---

## 4. 用户与使用场景

### 4.1 候选用户评估

| 用户 | 核心问题 | InsurHOT 能提供的独特价值 | 风险/约束 | V1 优先级 |
|---|---|---|---|---|
| 保险从业者（产品、精算、战略、合规、渠道） | 行业今天发生了什么？监管在变什么？竞品和新物种在做什么？ | 证据可点、按实体/险种/法域组织的事件流；监管变化日历；New Species | 需要高信噪比；中文优先 | **P0** |
| 行业研究者（券商/咨询/学术/再保研究） | 结构化、可引用、可下载的数据 | 可复现数据集、版本化方法、API | 对数据质量要求高 | **P0** |
| AI Agent / 开发者 | 能被程序调用的、带出处的保险数据 | MCP/API/`llms.txt`/增量同步 | 接口稳定性、限流 | **P0**（与人同源，边际成本低） |
| 媒体记者 | 一手来源、事件脉络、首发时间 | 事件时间线 + 首次出现 + 一手证据 | 需要更正机制 | P1 |
| 投资者 | 公司与赛道动态、商业模式判断 | 实体时间线、New Species、AI 成熟度 | 不能被理解为投资建议 | P1 |
| 监管/政策研究者 | 跨法域监管比较 | 监管事件流 + 多法域 | 权威性要求 | P2 |
| 消费者 | 该买哪个产品？ | —— | **在中国，面向消费者的"比较、咨询、方案设计"属于互联网保险业务的禁区** [D§5.3]；也极易被理解为投保建议 | **V1 不服务**，只提供方法论与条款知识类内容 |

### 4.2 V1 核心场景（Jobs to be Done）

1. **晨读**：从业者 5 分钟看完昨天**什么重要、什么在变、什么在诞生**。内容包括重要事件、监管发布与生效、新产品或条款变化、新风险与新物种，每条可点到一手原文。
2. **追踪一个实体**：看某保险公司或监管机构的时间线，包括事件、公告、处罚、产品上下架、AI 动作。
3. **监管变化追踪**：某法域在某险种上，征求意见 → 发布 → 生效 → 执法的全链路。
4. **判断一个"AI 保险新公司"是不是新物种**：查它的 Business Model Card，看它在 14 个变量上的证据与分级。
5. **Agent 调用**：研究型 Agent 通过 MCP 查询"过去 30 天中国健康险监管变化及原文出处"。
6. **研究复用**：研究者下载某类事件数据集（如 NFRA 行政处罚）或 New Species 登记簿，附版本与许可。

---

## 5. AIHOT 架构审计（摘要）

完整审计见 [附录 A](aihot-audit.md)，要点如下：

- **结构**：三进程（api / worker / web）。业务逻辑在 `packages/backend`，行业相关内容集中在 `industry/`。PostgreSQL 17 + pg-boss，Node 24 直接运行 TS。
- **流水线**：`upsertMaterial` 统一入口 → 预筛（宽召回）→ 结构化抽取与两次独立评分并行 → 按分数分流写作（高分走 understand，低分走 summarize）→ identity guard → append-only `analyses` → 发布 → 串行事件归组（embedding 召回 + 四分类关系判断 + 跨厂商复核）→ 热度 → 日报、周报、月报 [A§A4]。
- **七条不变量**：单一公开读取层；页面不调模型；付费请求有回执；预算熔断；安全阀；公开内容匿名；默认不展示全文 [A§A2]。这些与 InsurHOT 宪法高度一致，**全部继承**。
- **最强资产**：
  - 回执与预算体系；
  - append-only 判断与人工覆盖的版本保护；
  - prompt 内容哈希版本化；
  - SelectBench 评测骨架；
  - 事件归组的四分类关系；
  - 独立参与者热度；
  - 模型榜的"方法版本化"治理范式 [A§A9]。
- **关键缺口**：
  - 无 PDF 与文档层（F-01）；
  - 实体是代码字典（F-02）；
  - fact 的主体为自由文本（F-03）；
  - 单语言、单时区（F-04）；
  - 单一分类（F-05）；
  - Hot 与精选阈值按 AI 行业资讯密度校准（F-07/F-08）；
  - 无原件归档（F-12）[A§A11]。
- **上游状态**：快照式开源，作者声明不保证同步；Issue 创建受限；当前 Issue 和 PR 均为 0 [A 头部]。

---

## 6. KEEP / MODIFY / REMOVE / NEW Matrix

图例：**Inherit**＝原样继承（仅改名/配置）；**Adapt**＝保险行业化改造；**Replace**＝原设计不适合，替换；**Remove**＝InsurHOT 不需要；**New**＝InsurHOT 原创。

### 6.1 Industry Intelligence 能力逐项判断

| 能力 | AIHOT 实现 | 判定 | 理由 / 改造要点 |
|---|---|---|---|
| Source ingestion（rss/web_list/json_list/external） | `sources/`、`collect.ts`、自适应频率、失败不推进游标 | **Inherit** | 成熟可靠；保险监管站多为 web_list，选择器模式适用 |
| X 采集（SocialData） | `x.ts` | **Adapt** | 保险行业在 X 上的一手信号远弱于 AI 行业。保留代码，默认关闭；只用于全球 InsurTech 创始人和监管官员账号的 `hot_signal` |
| 公众号采集（极致了） | `mp.ts` | **Defer / 默认禁用** | 保留代码不代表取得采集权。V1 仅人工线索；取得逐源许可及费用批准后另行决策，不通过付费第三方绕过源站限制（§9.3）。 |
| 外部推送 `/api/ingest/items` | Bearer + 限流 + 默认 isolated | **Inherit** | InsurHOT 专用爬虫（监管站、协会库、交易所公告）走它接入，不改采集框架 |
| 文档/PDF/附件 | 无 | **New** | `documents` 层：下载原件、存对象存储、哈希、解析文本与版面、表格抽取 |
| 原件快照与归档 | 仅存正文文本与 revision | **New** | 证据需要不可变快照（C1） |
| Deduplication | URL 规范化 identity + content_hash revision；同事件由归组处理 | **Inherit + Adapt** | 增加文档级哈希去重（同一 PDF 多处转载）；监管文件以"文号"为强身份键 |
| Prefilter | 宽召回 PASS/BLOCK/UNKNOWN | **Adapt** | 改写为"保险相关性"；UNKNOWN 继续放行的规则保留 |
| Scoring（双次独立评分 + 按 tier 阈值） | `selection-score.md` 五轴加权 | **Adapt** | 保留"评分不看来源、阈值按 tier"的解耦与双评分；**重写五轴与内容类型**（见 §19.3）；必须用保险金标集重新校准阈值（F-08）；**评分语义从"注意力"改为"重要性"（Importance，承载 What matters?）** |
| Summarization / writing | understand / summarize 分流；防幻觉规则；identity guard | **Adapt** | 防幻觉规则直接继承；identity guard 改为基于实体注册表，不再用正则字典；增加"认知状态"标注 |
| Structure extraction | 单一 category + tags + subjects + 自由文本 fact | **Replace** | 改为多 facet（domain/line/jurisdiction/entity/event_type）+ 断言抽取，主体链接到实体 ID |
| Event clustering（stories/facts） | embedding 召回 + 四分类关系 + 跨厂商复核 + 人工覆盖 | **Inherit + Adapt** | 算法继承；fact 增加 `event_type`、实体角色、法域；召回窗口从 14 天按事件类型可调（监管事件周期长） |
| Hot Score | 48h 窗口、独立参与者、24h 半衰、≥2 参与者 | **Adapt** | 窗口与门槛按信源密度重新校准；只作为"关注度"（Attention）辅助信号，与 Importance、Change、Emergence 分离（§18）；技术名沿用 Hot Score，对外称"关注度"，避免与品牌中的 HOT（High-value Observed Trends）混淆 |
| Change Score | 无 | **New** | §18（承载 What is changing?） |
| Emergence（首次出现、扩散阶段） | 无 | **New** | §18（承载 What is emerging?） |
| 日报/周报/月报 | `reports/compose.ts` + 修订 | **Adapt** | 报告结构按三支柱组织：**重要（Matters）/ 变化（Changes）/ 新生（Emerges）**，节内再按监管、公司、产品、新物种、数据细分；每条带证据；关注度不单独成节 |
| Topics（company/field/genre） | `topics.json` 静态目录 | **Replace** | 由实体注册表和 taxonomy 自动生成实体页与主题页 |
| RSS | 精选/全部/全文/日报/分类 | **Inherit + Adapt** | 增加法域 × 领域 × 实体的订阅；全文 RSS 仍只对明确授权来源开放 |
| Public API v1 | items/hot-topics/stories/dailies/selected snapshot+changes | **Inherit + New** | 保留并扩展资源类型（§22） |
| MCP | 5 个只读工具 + structuredContent | **Inherit + New** | 前缀 `insurhot_`；扩展实体、监管、产品、新物种、证据工具 |
| llms.txt / sitemap / OG | 由配置生成 | **Inherit** | —— |
| 管理后台 | 信源、内容诊断、模型、SelectBench、运行记录、审计、设置 | **Inherit + New** | 新增：实体审核、断言复核队列、New Species 编辑、方法版本管理、更正工单 |
| 模型配置（按 capability 切换） | `models.ts` 11 个 capability | **Inherit + Adapt** | 增加新 capability（extract_assertion、entity_link、doc_parse_llm、bm_assess、change_explain）；增加置信度驱动的升级路由（§24） |
| 成本控制（回执 + 预算熔断） | `receipts.ts`、`budgets` | **Inherit + Adapt** | 增加按 capability 的月度金额上限；成本报表 |
| Failure handling | 失败重试、未知回执 30 分钟自动放行一次、告警、信源健康周报 | **Inherit** | —— |
| 飞书推送 | `notify/` | **Adapt** | 保留机制，作为运营告警；对外推送默认关闭 |
| 模型榜 leaderboard | 多源共识排名 v15 | **Remove（代码）/ Inherit（治理范式）** | 删除代码；把"方法版本化、规则页即代码、快照带许可与哈希、身份对齐表"的范式搬进 Benchmark Engine |
| Codex 重置监控 | `monitor/` | **Remove** | 与保险无关 |
| 品牌与文案 | MyHOT/AIHOT 名称残留 | **Replace** | 许可要求不使用 AIHOT 名称和 Logo（F-13） |
| 测试与 CI | 30 个后端测试，本地假服务，Docker 冒烟 | **Inherit + Adapt** | 测试中 AI 示例的分类、标签、公司改为保险对应项（`AGENTS.md` 已说明） |

### 6.2 InsurHOT 原创能力（New）

| 能力 | 作用 | 首次交付 |
|---|---|---|
| Document & Evidence Layer | 原件、快照、段落定位、断言、证据链 | Phase 1 |
| Entity Registry | 保险机构、监管机构、产品、人物、技术等实体的主数据与别名 | Phase 1 |
| Source Registry 2.0 | 权威性、独立性、法域、许可、纠错史 | Phase 1 |
| Regulatory Tracker | 监管文件生命周期：征求意见 → 发布 → 生效 → 执法 | Phase 1 |
| Change Detection Engine | 结构性变化识别与 Change Score（Changes） | Phase 1（规则）/ Phase 2（模型辅助） |
| Emergence Tracking | 首次出现、扩散阶段与行业共识判断（Emerges） | Phase 1（首次出现 + 阶段标注）/ Phase 2（扩散计数） |
| New Species Registry | AI 保险商业模式卡与分级（最高优先级研究方向之一，C0.6） | Phase 1（人工策展） |
| Product Registry & Version Diff | 产品身份、版本、条款变化 | Phase 2 |
| Product Benchmark Engine | 多维分数卡、Profile、被占优检测（重要能力，C0.5；先标准后评价） | Phase 1（标准、schema、方法 RFC）/ Phase 2（内部评分）/ 法律意见后公开 |
| AI Maturity Tracker（中国/亚洲） | 外部视角的保险公司 AI 成熟度 | Phase 2 |
| Corrections & Disputes | 公开更正通道与处理记录 | Phase 1 |

---

## 7. Information Architecture

先设计信息路径，再设计页面。InsurHOT 的信息组织有四个正交轴，任何内容都挂在这四个轴上，而不是塞进一个单一分类：

```
            ┌─────────── WHAT（领域 domain × 事件类型 event_type）
内容单元 ───┼─────────── WHO（实体 entity：公司/监管/产品/技术/新物种）
            ├─────────── WHERE（法域 jurisdiction）
            └─────────── WHICH LINE（险种 line_of_business）
            + WHEN（发生/公布/生效三种时间） + HOW SURE（认知状态 + 证据等级）
            + WHY IT MATTERS（三支柱信号：Importance / Change / Emergence；Attention 仅辅助）
```

### 7.1 内容单元的层次（从原料到结论）

| 层 | 单元 | 说明 | 用户可见 |
|---|---|---|---|
| L0 原料 | Document | 原件：网页快照、PDF、公告、条款、财报 | 可见元数据与原文链接；全文按许可 |
| L1 资料 | Item（AIHOT 的 article/publication） | 一条可阅读的资讯，含中文标题摘要 | 是 |
| L2 断言 | Assertion | 可验证的最小陈述（主体-谓词-客体/数值 + 条件 + 时间） | 在事件、实体、产品页中以"证据"形式出现 |
| L3 事件 | Event（AIHOT 的 fact/story） | 一次真实发生及其直接进展 | 是 |
| L4 实体 | Entity | 公司、监管机构、产品、人物、技术、险种、法域 | 是（实体页） |
| L5 结构化对象 | Product Version / Regulation / Business Model Card | 有 schema 的领域对象 | 是 |
| L6 评价 | Importance / Change Score / Emergence Stage / Benchmark Scorecard / BM Level；Attention（Hot）为辅助 | 引用断言的方法化评价 | 是（带方法版本） |
| L7 成刊 | Daily / Weekly / Monthly / 专题 | 编辑成品 | 是 |

### 7.2 核心信息路径

1. **"今天什么重要、什么在变、什么在诞生？"**：首页三栏（重要 / 变化 / 新生）→ 事件页 → 证据原文。关注度榜只作辅助入口。
2. **"这家公司最近怎么样？"**：搜索或实体页 → 时间线（事件/公告/处罚/产品/AI 动作）→ 事件页 → 证据。
3. **"这条监管规定到哪一步了？"**：监管页（按法域）→ 监管对象页（生命周期 + 版本 diff + 关联事件）→ 原文。
4. **"这是不是新物种？"**：New Species → 商业模式卡（14 变量 + 分级 + 证据）→ 相似公司 → 相关事件。
5. **"这个产品改了什么？"**（Phase 2）：产品页 → 版本历史 → 字段级 diff → 条款原文定位。
6. **Agent 路径**：`llms.txt` → MCP `insurhot_search` / `get_changes` → `get_event` / `get_entity` → `get_evidence`。

---

## 8. Insurance Taxonomy

### 8.1 设计原则

- **Facet 而非单一分类**。一条"某保险公司因健康险销售误导被罚"同时属于：监管执法（domain）、处罚（event_type）、某公司（entity）、中国（jurisdiction）、健康险（line）。AIHOT 的单 category（F-05）不足以表达。
- **Hot 不是分类**。热点是排序视图，不是内容类别。候选分类中的"Hot"不作为一级领域。品牌中的 HOT 是 High-value Observed Trends，不是"热门"。
- **Matters / Changes / Emerges 也不是分类**。它们是三支柱**信号与视图**（§18），可以作用于任何 domain、险种和法域的内容，所以不进入 taxonomy 的分类键。
- **"AI & New Models"拆成两件事**：技术应用（domain = Technology）是资讯；新商业模式（New Species）是一个结构化登记簿，不是资讯分类。
- **"Risk"要区分**：作为保险标的的风险（巨灾、气候、网络、AI 风险、疫情，属于 domain = Risk & Catastrophe），与保险公司自身的经营风险（偿付能力、评级下调，属于 domain = Market & Company）。
- **分类键上线后不改**（继承 AIHOT 规则）；各法域的官方险种代码通过映射表对齐，而不是改内部键。

### 8.2 Facet 1：领域 Domain（主分类，决定日报分节；单选）

| key | 名称 | 包含 | 不包含 |
|---|---|---|---|
| `regulation` | 监管与政策 | 法律法规、部门规章、规范性文件、征求意见、监管口径与答问、国际标准制定（IAIS/EIOPA/NAIC 模型法） | 执法处罚（见 `enforcement`） |
| `enforcement` | 执法与处罚 | 行政处罚、监管函、牌照吊销、禁业、诉讼判决（行业性案例） | 一般纠纷 |
| `company` | 公司与市场 | 业绩、偿付能力与评级、资本运作、并购、股权与人事、市场进入与退出、经营战略 | 产品细节（见 `product`） |
| `product` | 产品与保障 | 新产品、条款或费率变化、停售、新保障责任、行业示范条款与标准定义 | 纯营销 |
| `distribution` | 渠道与交易 | 销售与中介的公开监管规则、嵌入式、互联网平台、银保、代理人制度、监管层面的费用与佣金规则（如"报行合一"等公开监管要求）、Agent 交易 | 任何公司的内部渠道经营、内部费用政策、内部客户或经营数据（C0.7、Non-goal N2/N3） |
| `claims_service` | 理赔、服务与消费者 | 理赔实践、消费者保护、投诉数据、服务评价公开数据 | —— |
| `risk` | 风险与巨灾 | 巨灾事件与损失估计、气候、网络、AI 风险、健康与疫情、新兴风险、保障缺口 | —— |
| `capital` | 再保险与资本 | 再保险续转、ILS/巨灾债券、侧挂、资本市场 | —— |
| `technology` | 技术与 AI 应用 | AI、数据、核心系统、InsurTech 融资、技术合作 | 商业模式判定（见 New Species） |
| `data_research` | 数据与研究 | 官方统计发布、行业报告、学术研究 | —— |

说明：`regulation` 与 `enforcement` 分开，是因为两者的信息节奏、用户和变化检测规则完全不同。

### 8.3 Facet 2：事件类型 Event Type（受控词表；决定 Event schema 与 Change 规则）

见 §10.2。

### 8.4 Facet 3：险种 Line of Business（多选）

内部键采用两级结构，各法域官方代码通过 `line_mappings` 对齐（如中国监管统计口径、NAIC 年报 Line、Solvency II LoB、OPIN 险种端点 [D§3.1]）：

```
life              寿险（定期/终身/两全/万能/投连/分红）
annuity_pension   年金与养老
health            健康（medical 医疗 / critical_illness 重疾 / ltc 长护 / disability 失能 / hmb 城市商业医疗保险·惠民保）
accident          意外
motor             车险（compulsory 强制 / commercial 商业 / nev 新能源 / autonomous 自动驾驶）
property          财产（home 家财 / commercial 企财 / engineering 工程）
liability         责任（general / product / professional_eo / do / employer / ai_liability）
cyber             网络
agriculture       农业
credit_surety     信用保证
marine_aviation_energy 水险/航空/能源
travel            旅行
pet               宠物
specialty         其他特殊风险
reinsurance       再保险（作为业务类型时）
```

### 8.5 Facet 4：法域 Jurisdiction

ISO 3166-1 alpha-2 + 超国家机构（`EU`、`INTL` 表示 IAIS/OECD 等）+ 必要时的次级法域（`US-CA`、`US-NY`、`CN-HK`）。

### 8.6 Facet 5：内容形态 Content Form

`official_document`（法规、公告、条款、财报）· `data_release` · `company_announcement` · `news_report` · `analysis_opinion` · `research_paper` · `interview` · `social_post`

它与信源等级（§9）共同决定证据强度。

### 8.7 与 AIHOT 的映射

`CATEGORIES` 用 Domain 替换；`CATEGORY_TAGS / TOPIC_TAGS / ENTITY_TAGS` 用 Event Type、Line、实体注册表替换；`ITEM_TYPES`（评分权重表）改为保险版内容类型（§19.3）。

---

## 9. Source Architecture

完整研究见 [附录 E](research/sources.md)。那里有 8 个法域的信源表、实测的 RSS/API/robots 结果，以及 48 项 V1 清单。

### 9.1 对原始 Tier 设想的修正

原始设想把"来源类型"和"可信度"压在同一个维度上（Tier 0 监管 → Tier 5 社交）。实测和研究发现这个设计有五个问题 [E§1]：

1. **一手 ≠ 独立。** 保险公司的法定披露（条款、偿付能力摘要、年报）是一手材料，但由被监管主体自己报送。FCA 也提示过公司之间的报告口径可能不一致。
2. **协会不中立。** 中保协、ABI 属于行业自律或代表组织；Swiss Re Institute 隶属再保险公司；Geneva Association 是行业智库。
3. **比价和测评平台同时是中介。** 例如深蓝保、小雨伞都是持牌经纪公司 [D§1.1]。它们只能作为线索，不能作为证据。
4. **热度不是证据。** 热度信号应该单独成层，不参与事实判定。
5. **可信度相同，可复用程度可能完全不同。** 例如 FCA 的 Data 栏目适用 OGL，但 FCA 网站条款禁止爬虫 [E§14.5]。

### 9.2 InsurHOT Source Model：一个等级 + 六个正交维度

**证据等级 `evidence_tier`**（决定一条来源能证明什么）：

| Tier | 名称 | 定义 | 示例 | 能证明什么 |
|---|---|---|---|---|
| **T0** | 法定原文 | 法律、规章、规范性文件、官方正式译文 | 全国人大法律库、NFRA 规章/规范性文件、EUR-Lex、e-Gov 法令、Federal Register | 规则本身的存在、文本与生效条件 |
| **T1** | 监管数据与决定 | 监管机构发布的统计、处罚、许可、投诉通报、数据集 | NFRA 统计 / 行政处罚 / 投诉通报、FCA GI value measures、EIOPA statistics | 监管口径的事实（注意：部分数据仍由公司自报） |
| **T2** | 法定强制披露 | 被监管主体依法披露的材料 | 公开信息披露栏目、偿付能力季度摘要、年报、交易所公告、条款/费率/现价表、红利实现率、IPID、SERFF 备案 | 当事方的正式陈述，**非独立** |
| **T3** | 行业基础设施与自律组织 | 协会、精算师协会、交易所、官方比较平台 | 中保协（产品库、示范条款、统计）、KLIA/KNIA 공시실、GIROJ、compareFIRST | 行业口径的事实，标利益冲突 |
| **T4** | 国际组织与研究 | IAIS、OECD、World Bank、学术、智库 | GIMAR、OECD SDMX、Geneva Association、sigma（标商业属性） | 研究结论（带方法） |
| **T5** | 专业媒体 | 行业专业媒体 | Artemis、Reinsurance News、中国银行保险报 | **线索与报道**，不单独支撑"事实"级陈述 |
| **T6** | 大众媒体与非强制的公司营销材料 | 一般新闻、企业新闻稿（非法定披露）、博客 | —— | 线索、自称 |
| **S** | 信号层 | 社交、搜索指数、App 排名、论坛 | Google Trends、App Store RSS、X | 只证明"关注度"，不证明事实 |

**六个正交维度：**

| 维度 | 取值 | 用途 |
|---|---|---|
| `independence` | `regulator` / `mandated_self_report` / `industry_body` / `academic` / `commercial_intermediary` / `media` / `ugc` | 判断"多个独立来源"；把自报数据与监管汇总区分开 |
| `authority` | 0–5（按法域和机构人工设定） | 冲突裁决时的先验权重 |
| `timeliness` | 预期频率、数据期间、发布滞后（`expected_lag_days`） | 新鲜度告警；Change 检测窗口 |
| `verifiability` | 稳定 URL、原件 SHA-256、快照（WARC/PDF）、官方文号或 docId | 证据链 |
| `correction_handling` | 同一 docId/URL 的版本链；`provisional` 标记；撤稿与更正记录 | 更正与争议展示 |
| `reuse_class` | **R0** 可全文存储和展示 · **R1** 全文存储仅用于分析，对外只展示摘要、短引用和链接 · **R2** 只存元数据、摘要和链接 · **R3** 不自动采集，仅人工引用 | 版权、ToS、TDM opt-out 合规 |

另有 `owner_entity_id`（信息发布主体）、`origin_document_id`（原稿或原始证据族）、`signal_group_id`（关注度去重组）。`independence` 是来源属性枚举，不是主体分组键；同类机构不自动视为同一来源。

另有 `access_method`（api / rss / bulk_file / html_lowfreq / manual / licensed）、`jurisdiction`、`language`、`robots_status`、`tdm_optout`、`tos_url`、`license_note`、`reviewed_by`、`reviewed_at`。

**与 AIHOT 的映射。** AIHOT 的 `tier`（T1/T1_5/T2）只用于决定精选阈值，这个作用保留，改名为 `selection_tier`，由 `evidence_tier` 推导。`participation_mode`（editorial / hot_signal / isolated）继续使用。`site_fulltext` / `syndicate_fulltext` 由 `reuse_class` 推导，不再单独手工配置。

### 9.3 采集规则（Collection Policy）

1. robots.txt 和 TDM 保留声明视为有约束力的 opt-out。这与欧盟 DSM 指令第 4 条的机器可读保留一致 [E§14.2]；Artemis 和 Reinsurance News 已经屏蔽 GPTBot。
2. **不绕过任何技术管理措施**，包括登录、验证码、签名参数和 WAF。依据是 2025 年修订的《反不正当竞争法》第十三条，罚款最高 500 万元 [E§14.1]。因此小红书、公众号直抓、百度指数、中保协产品库都**不做自动化批量采集** [E§11][E§2.2]。
3. 自报 UA（`InsurHOTBot/<ver> (+contact)`），礼貌限速：默认 ≤1 次/秒；SEC 上限为 10 次/秒；MAS 要求 crawl-delay 2 秒。
4. 访问方式的优先级：API/RSS > 官方批量文件 > 低频 HTML > 人工 > 授权。
5. **所有以 fact_primary（已证实事实）发布的陈述，必须能回溯到合法留存、可回查的 T0–T2 原文和快照哈希**。T3–T6 可以作为补充证据和首发线索。
6. 个人信息最小化。处罚公示优先抽取机构层事实，原件中的姓名不形成自然人索引。确需留存原件时记录必要性、访问权限、保留期限与删除依据；公开及调用外部模型前处理敏感信息。脱敏不自动等于匿名化或出境合规，出境路径未核准则暂停传输（§27 R8）。
7. 部署前从目标地域复测。部分站点对境外出口做了地理封锁（12378、cbirc、Bima Sugam），也有返回 403 的（SERFF） [E§0]。

### 9.4 V1 信源组合（摘要）

完整 48 项见 [E§16]。V1 的 P0 组合如下：

| 组 | 信源 | Tier | 方式 | Reuse |
|---|---|---|---|---|
| 中国监管 | NFRA：规章与规范性文件（itemId 926/928）、公告与解读（925/916）、监管动态与投诉通报（915）、统计（954）、行政处罚（4113/4114/4115）、征求意见 | T0/T1 | NFRA 前端背后的 JSON 接口（已实测，但未公开文档），加附件解析 | R0 |
| 中国公司披露 | 头部约 30 家人身险公司和约 15 家财险公司官网"公开信息披露"：条款、费率、现金价值、**红利实现率**、退保规则、偿付能力季度摘要 | T2 | 逐家 HTML/PDF 适配器 | R1 |
| 中国行业组织 | 中保协偿付能力信息披露（col34）等 | T2/T3 | HTML（列表接口 NEEDS VALIDATION） | R1 |
| 资本市场 | 巨潮、HKEXnews（平安、国寿、太保、新华、人保、众安、友邦等） | T2 | HTML | R1 |
| 国际监管 | IAIS；EIOPA（RSS + 统计文件）；FCA（RSS + GI value measures）；SEC EDGAR（API） | T0–T2 | RSS/API/批量文件 | R0/R1 |
| 国际统计 | OECD 保险统计（SDMX API） | T4 | API | R0/R1 |

P1 覆盖 PRA、金融庁、e-Gov 法令 API、FSS FISIS、Federal Register、IRDAI（人工）、巴西 Open Insurance API、Artemis/Reinsurance News（只用标题和链接），以及中国银行保险报（只存摘要）。

**明确不纳入 V1**：Insurance Journal（ToS 禁止 robot）、小红书、抖音、雪球、Reddit、AM Best / InsData（付费）、中国裁判文书网 [E§16]。

### 9.5 需要优先跟踪的监管变化

NFRA 于 2026-09-04 发布《银行保险机构信息披露管理办法（征求意见稿）》，共 6 章 46 条，征求意见截至 2026-10-03。新办法将整合并废止《保险公司信息披露管理办法》等三部制度 [E§13]。**InsurHOT 的中国公司披露适配器，必须设计成能随披露口径和渠道的变化而调整**。这一事项也是 Regulatory Tracker 的第一个样板案例。

---

## 10. Event Model

### 10.1 继承与改造

AIHOT 的 `facts`（一次真实发生）和 `stories`（发生加直接进展）的两层结构，以及 SAME_OCCURRENCE / SAME_STORY / UNRELATED / ROUNDUP 四分类关系，直接继承 [A§A4]。改造分四点：

1. 在 `fact` 上增加 `event_type`（受控词表）、`jurisdiction`、`lines[]`、三种时间（`occurred_at`、`announced_at`、`effective_at`），以及**实体角色表**（`event_entities(event_id, entity_id, role)`）。这样替代原来自由文本的 subject 和 object。
2. 事件不再直接从文章获得"事实"，而是由**断言**支撑（`event_assertions`）。事件页显示的每个数字、日期、条件都来自断言（§20）。
3. 召回窗口按事件类型调整：监管类 180 天，公司类 30 天，一般资讯保持 14 天。原因是监管事件"征求意见 → 发布 → 生效"的间隔常常以月计。
4. 监管、产品这类有强身份键的对象，**先按身份键归组**（文号、产品备案号、docId），再走 embedding 召回。

### 10.2 Event Type 受控词表（V1）

| 前缀 | 类型 | 必填角色 | 关键时间 | Change 规则挂钩 |
|---|---|---|---|---|
| `reg.` | `consultation`（征求意见）、`issued`（发布）、`effective`（生效）、`amended`、`repealed`、`guidance`（解读/答问）、`intl_standard`（IAIS/NAIC 模型法等） | regulator、affected_lines | announced / effective / comment_deadline | 新规、口径变化、生效提醒 |
| `enf.` | `penalty`、`license_action`（许可/吊销）、`ban`、`court_ruling` | regulator、target_entity | decided_at | 处罚强度与主题聚类 |
| `co.` | `results`（业绩）、`solvency_report`、`rating_action`、`capital_raise`、`m_and_a`、`leadership_change`、`market_entry`、`market_exit`、`restructuring`、`listing` | company | announced / effective | 实体状态变化 |
| `prod.` | `launch`、`revision`（条款/费率修订）、`withdrawal`（停售）、`pricing_change`、`dividend_realization`（红利实现率披露）、`standard_definition`（行业标准定义/示范条款） | insurer、product | effective / announced | 版本 diff（Phase 2） |
| `dist.` | `channel_rule`、`platform_launch`、`agentic_transaction`（LLM/Agent 内交易入口） | —— | announced | 交易结构变化 |
| `risk.` | `cat_event`、`loss_estimate`、`emerging_risk`、`exclusion_trend`（如 GenAI 除外条款采用） | —— | occurred | 新风险 |
| `cap.` | `reinsurance_renewal`、`ils_issuance`、`capital_structure` | —— | —— | —— |
| `tech.` | `ai_deployment`、`partnership`、`funding`、`product_capability` | company | announced | 为 BM 分级提供证据 |
| `data.` | `stat_release`（统计发布）、`report_release` | publisher | period / released | 指标序列更新 |
| `bm.` | `new_species_detected`、`level_change`（BM 分级变化）、`failure` | company | detected | New Species |

未命中词表的内容归入 `other`，并进入人工补词队列。词表版本化（`event_types.version`）。

### 10.3 事件对象（逻辑 schema）

```yaml
Event:
  id, public_id
  event_type            # §10.2
  title_zh, title_orig
  jurisdiction[]        # ISO + EU/INTL
  lines[]               # §8.4
  domain                # §8.2（主分类）
  time: {occurred_at, announced_at, effective_at, comment_deadline?, precision}
  entities: [{entity_id, role}]        # regulator/company/product/person/technology ...
  assertions: [assertion_id]           # 支撑本事件的断言（§20）
  first_seen: {at, source_id, document_id}
  status: active | watching | settled  # 继承 AIHOT
  relations: [{event_id, type: storyline|related|supersedes|implements|enforces}]
  scores:                             # 三支柱信号 + 辅助关注度（§18）
    importance: {value, rule_version, reasons[]}            # What matters?
    change: {value, rule_version, reasons[]}                # What is changing?
    emergence: {stage, first_seen, adopters, rule_version}  # What is emerging?
    attention: {value, rule_version}                        # 原 hot（辅助，不作主排序）
  epistemic_summary: {primary_sources, independent_sources, disputed: bool}
  digest: {text, version, inputs_hash}   # 继承 story_digests
```

`relations` 新增了 `implements`（某规范性文件实施某法律）、`enforces`（某处罚执行某规定）、`supersedes`，把监管链条连起来。这是"图形状"的关系，在关系表中实现（§11.4）。

---

## 11. Entity Model

### 11.1 V1 必须建设的实体（关系模型）

| 实体 | 必要性 | 关键字段 | 外部标识 | 主数据来源 |
|---|---|---|---|---|
| `Organization` | **必须**。事件、证据、产品、BM 卡都依赖它来消歧 | 名称（多语言）、别名、类型、法域、状态、上级机构、牌照 | 统一社会信用代码、LEI、NAIC CoCode、FCA FRN、HKEX/SSE 代码、EIOPA 注册号 | NFRA 许可信息、中保协会员与披露、交易所、GLEIF/EIOPA 注册库（可复用 CC BY 4.0 的 EIOPA 注册库本体 [B§2.15]） |
| `Regulator`（Organization 子类型） | **必须** | 法域、层级（总局/监管局/分局）、职能 | —— | 人工维护 |
| `Jurisdiction` | **必须** | ISO、上级、监管机构 | ISO 3166 | 静态表 |
| `LineOfBusiness` | **必须** | 内部两级键 + 各法域映射 | 各法域统计口径 | 静态表 + 映射 |
| `Regulation`（监管文件） | **必须** | 标题、文号、发文机关、类型（法律/规章/规范性文件/征求意见稿）、状态、版本、生效/废止日期、关联 | 文号、docId、CELEX | NFRA/EUR-Lex/e-Gov 等 |
| `Product` | V1 只做轻量身份（名称、公司、备案号、险种），版本与条款结构在 Phase 2 | —— | 备案/注册号、SUSEP 流程号 | 公司披露 |
| `Person` | **V1 不建**。任免作为机构事件记录，不建立个人画像或自然人检索 | 后续是否需要另走 ADR | —— | 不因公开就默认允许任意再处理 |
| `Technology` | V1 用标签（受控词表）表达，不建实体 | —— | —— | —— |
| `BusinessModelCard` | **必须**（New Species） | §17 | —— | 人工策展 |

### 11.2 Organization 类型词表

`insurer_life` · `insurer_pc` · `insurer_health` · `reinsurer` · `mutual` · `reciprocal` · `captive` · `mga_mgu` · `broker` · `agency` · `platform_intermediary`（互联网平台/比价）· `insurtech_enabler`（SaaS/赋能层）· `lloyds_syndicate` · `coverholder` · `regulator` · `industry_body` · `exchange_infrastructure` · `rating_agency` · `research_org` · `group_holding` · `non_insurance_risk_sharing`（如网络互助）

类型允许多值，因为同一主体可能同时是经纪人和 MGA。**牌照与风险承担关系单独建表**，因为它们是判断商业模式的关键（§16）。

### 11.3 实体消歧与链接

- **确定性优先。** 外部标识精确匹配，其次别名表精确匹配，再次规范化名称匹配（去掉"股份有限公司"等后缀、处理简繁体）。
- **Embedding 召回 + 小模型判定**，仅用于剩余的模糊情况。低置信度的进入人工队列。
- **替代 AIHOT 的 `IDENTITY_LEXICON` 正则字典**：identity guard 改为"摘要里出现的机构，必须能链接到原文中出现过的某个实体"。

### 11.4 关系：何时 graph 化

V1 在 PostgreSQL 中用三张表表达"图形状"的数据，不引入图数据库：

```
entity_relations(subject_id, predicate, object_id, valid_from, valid_to, assertion_id, confidence)
  predicate ∈ { parent_of, subsidiary_of, shareholder_of(pct), licensed_by, fronted_by,
                capital_provider_for, reinsured_by, coverholder_for, acquired, merged_into,
                regulates, successor_of, partner_of, competitor_of(派生) }
event_entities(event_id, entity_id, role)
event_relations(event_id, other_event_id, type)
```

**每条关系都挂一个 `assertion_id`（证据）**，并带有效期（`valid_from` / `valid_to`）。这是知识图谱的本质，但不需要图数据库。

**graph 化的触发条件**（Phase 3 评估，满足其中两条才启动）：

1. 出现 ≥3 类产品化的多跳查询，例如"某再保人通过 fronting 间接承担风险的所有 MGA 及其产品"，且递归 CTE 的 P95 > 1s；
2. 需要对外发布 RDF/JSON-LD 数据集，并被外部实际使用；
3. 需要图算法（中心性、社区发现）驱动产品功能，例如"风险承担网络"。

在此之前，只提供 JSON-LD 导出，不建图库（ADR-009）。

---

## 12. Product Schema

完整研究见 [附录 D §3、§7](research/benchmark.md)。

### 12.1 为什么保险产品难以比较（摘要）

| 难点 | 例证 |
|---|---|
| 定义差异 | 中国重疾险定义从 25 种扩展到 2020 版的 28 种重度加 3 种轻度；旧定义产品 2021-01-31 停售。"重疾"在不同版本下含义不同 [D§2.1] |
| 保障与除外 | EU IPID 专门设了 "What is not insured?" 和 "restrictions" 两栏 [D§2.1] |
| 成本分担 | 免赔额、等待期、赔付比例；中国短期健康险监管要求清晰表述 [D§2.1] |
| 续保 | 短期健康险必须写明"不保证续保"；长期医疗险的费率可调 [D§2.1] |
| 价格是个体风险的函数 | compareFIRST 和 Canstar 都必须先指定年龄、性别、吸烟、地区、车型 [D§5.1] |
| 版本与时间 | 停售、重新备案；惠民保按城市和年度变化 [D§4.2] |
| 公司层差异 | 条款相同，但偿付能力和理赔实践不同 [D§2.1] |

结论是："产品"不是一个对象，而是**"产品身份 × 版本 × 法域 × 人群画像"**。Schema 必须把这四者分开。

### 12.2 Layer 1：Universal Insurance Product Schema（UIPS-Core）

字段设计以 Open Insurance Brasil 的公开 OpenAPI schema 为蓝本，这是目前最完整的开放产品 schema。同时对齐 EU IPID 的 9 个栏目、compareFIRST 的输入项，以及中国短期健康险的"关键信息"清单 [D§3.3]。概念层与 ACORD（Policy/Product/Party/Coverage）对齐，但不复制其会员规范文本 [B§2.13]。

```yaml
Product:                                   # 稳定身份
  product_id                               # InsurHOT 内部 ID
  insurer_entity_id, distributors[]
  jurisdiction, line_of_business, product_family_id
  regulatory_ids: [{scheme, value}]        # 备案/注册号、SUSEP 流程号 ...
  names: [{lang, full_name}]
ProductVersion:                            # 一切可比较的内容都挂在版本上
  version_id, product_id
  terms_doc: {document_id, sha256}, rate_table_doc?, cash_value_doc?
  effective_from, effective_to, sale_status  # on_sale / withdrawn / refiled
  supersedes_version_id
  coverages[]:                             # 保障责任
    coverage_code (受控词表), benefit_type (indemnity|fixed_benefit|service)
    sum_insured {min, max, sub_limits}, payout_ratio
    trigger_definition_ref                 # 如 "CI-2020 第 X 条"
    standard_definition_flag
  exclusions[]: {exclusion_code, scope, text_ref}
  cost_sharing: {waiting_period_days, deductible{amount, basis}, coinsurance_pct}
  term_and_renewal: {policy_term, premium_term, renewability: guaranteed|not_guaranteed|conditional, rate_adjustable}
  premium: {structure, payment_methods, frequency, reference_persona_prices[]}   # 仅公开费率表，§13.6
  eligibility: {age_range, occupation_class, health_declaration_ref, geographic_scope}
  termination: {cancellation_terms_ref, cooling_off_days, cash_value_table_ref}
  services[]: {service_code, provider?}
IssuerContext (链接，不并入产品分): solvency_refs[], rating_refs[], complaint_metric_refs[], dividend_realization_refs[]
FieldProvenance (每个字段):
  state: present | absent_in_terms | not_found | not_applicable
  assertion_id → document/page/clause, extracted_by (rule|model:<id>|human:<id>), reviewed_by, confidence, as_of
```

**要点：**

- 每个字段都有四态 `state` 和 `assertion_id`。"条款明确不含"和"没找到"是两件不同的事 [D§7.8]。
- 发行人信息（偿付能力、投诉、红利实现率）只以链接形式出现在 `IssuerContext` 中，**永不并入产品分**，以免把"公司好"误读成"产品好" [D§7.4]。
- 版本之间的差异（diff）是一等公民：`prod.revision` 事件与 Change Score 都建立在版本 diff 之上。

### 12.3 Layer 2：险种扩展（Line-specific Schemas）

Layer 2 的每个险种有独立的扩展字段、维度分类（O/S/N）和可比集合定义 [D§4]：

| 险种 | 扩展字段示例 | 首批优先级 |
|---|---|---|
| 医疗（百万医疗、中端医疗、惠民保） | `hospital_scope`、`drug_list_ref`、`preexisting_rule`、`renewal_wording`、`hmb_city_year` | **高**：监管规定的"关键信息"本身就是 O 类清单；惠民保按城市 × 年度建档 |
| 重疾 | `illness_list[]{code, severity, standard_def}`、`multi_claim_rules`、`death_benefit_shared` | 高：有行业统一定义 |
| 定期寿险 | `exclusion_list`、`convertibility`、`underwriting_mode` | 中：有示范条款 |
| 意外 | `disability_scale_ref`、`occupation_class`、`sudden_death` | 中 |
| 车险（中国） | `model_clause_version`、`ncd_table_ref`、`riders[]` | 低：示范条款下差异主要在定价和服务，产品维度比较意义有限 |
| 家财、旅行、宠物、网络、责任 | 参照 OPIN 对应 schema 的映射 | Phase 3 |

每个 Layer 2 schema 都维护一张**与 OPIN 对应 schema 的字段映射表**，为跨法域对齐留接口。

---

## 13. Product Benchmark Framework

### 13.1 设计结论

**Product Benchmark 是 InsurHOT 的重要能力（C0.5）。** 评价的前提是先有公开、统一、可解释、可复算、证据可追溯的标准：本章的方法版本化、证据链和 O/S/N 分类，都是在落实"先标准，后评价"。

**不做单一产品总分，也不做总榜。** 采用"**多维分数卡 + 公开命名 Profile 下的可选综合分 + 门槛红旗 + 同类可比集合 + 被占优检测**"。

这个结论有三方面依据 [D§0, §1.2]：

- 全球没有一个成熟机构用一个分数同时覆盖条款、价格、服务和偿付能力。Defaqto 只评条款；Canstar 按消费者画像加权；Which? 把保单分和客户分拆开，再用门槛规则。
- 监管机构也回避单一分数。FCA 说明 value measures "不是为了帮助消费者直接选择"；EIOPA 的 VfM 采用"聚类 + 四分位阈值"，并且"不是安全港"。
- Bhargava、Loewenstein 与 Sydnor（QJE 2017）发现，多数员工选择了财务上"被占优"的健康计划。因此**被占优检测**是最可验证、也最有决策价值的输出。

### 13.2 架构

```
Evidence（条款 PDF / 费率表 / 法定披露）
   → Facts（UIPS L1/L2 字段 + FieldProvenance）
   → Metrics（版本化计算规则，O/S 维度）
   → Benchmark Views（分数卡 / Profile 综合分 / 红旗 / 被占优 / 分档）
```

每个对外数字都能回溯："文件哈希 → 页码/条款 → 抽取者 → 复核者 → 方法版本 → 代码提交"。

### 13.3 维度分类（O / S / N）

| 类 | 定义 | 质量控制 | 示例 |
|---|---|---|---|
| **O 客观可测** | 可从条款或费率表机械抽取并自动校验 | 双路抽取（规则 + 模型）一致才自动通过，不一致转人工 | 等待期天数、免赔额、赔付比例、是否保证续保、病种是否全部采用行业标准定义 |
| **S 半结构化** | 需要编码手册（codebook）判断 | 双人独立编码 + 仲裁，公开 Cohen's κ | 除外条款宽严、医院与药品范围、健康告知宽严 |
| **N 不应打分** | 个体化、不可验证、有法律或伦理风险，或属于公司层指标 | 只展示，不计分 | 个人能否通过核保、个人价格、"最适合你"、偿付能力与投诉（放在发行人面板） |

### 13.4 质量是否由可观察变量组成？候选维度逐项判断

| 候选维度 | 判断 | 处理 |
|---|---|---|
| Coverage Completeness（覆盖完整度） | 可测，但需按险种定义"应有责任清单" | O（相对于 L2 责任模板的覆盖率） |
| Coverage Depth（保障深度） | 可测：保额、赔付比例、子限额 | O |
| Exclusions（除外） | 条目可测，宽严需判断 | O（条目）+ S（宽严） |
| Deductible / Cost-sharing（成本分担） | 可测 | O |
| Price Efficiency（价格效率） | 只能在参考画像 + 公开费率表下测；受法律约束 | O（受 §13.6 限制），Phase 2 以后 |
| Claims Conditions（给付条件） | 触发定义可测；实际理赔体验不可从条款得出 | O（触发）/ N（体验，另设发行人面板） |
| Transparency（透明度） | 可测部分：关键信息完整性、术语是否标准化、是否含易混淆表述（监管有禁止清单） | O + S |
| Complexity（复杂度） | 可测代理指标：条款长度、交叉引用数、例外嵌套层数 | O（仅展示，**不计入质量分**：复杂 ≠ 差） |
| Flexibility（灵活性） | 可测：可选责任、保额调整、转换权 | O |
| Innovation（创新） | 与质量正交；已由 Change Score 覆盖 | **不评分**，只进 Change |
| Service（服务） | 权益清单可测，服务质量不可测 | O（清单）/ N（质量） |
| Accessibility（可得性） | 投保年龄、职业、健康告知、地域 | O + S |

### 13.5 权重与 Profile

1. **默认视图没有综合分**。每个维度显示数值、同类分位、证据覆盖率和证据链接。
2. **综合分只在命名 Profile 下出现**，例如"家庭经济支柱·保障优先""预算约束·基础保障""既往症·可保性优先"。每个 Profile 公开权重向量、门槛规则，以及适用与不适用的人群说明。这是 Canstar"按画像加权"做法的透明化升级 [D§7.5]。
3. **门槛先于加权。** 红旗（如使用非标准定义、续保措辞易混淆）在任何 Profile 下都随分数显示，不能被其他维度抵消。这一做法借鉴 Defaqto 的 core criteria 和 Which? WRP 的门槛。
4. **敏感性分析。** 权重扰动 ±X% 时排序不稳定的产品只显示分档（tier），不显示名次。
5. **只在可比集合内比较。** 可比集合按"险种 × 期限 × 续保属性 × 给付/补偿 × 目标人群"聚类，参考 EIOPA 的聚类思路；跨集合不比较。
6. **用户自定义权重在中国默认不开放**：它可能被认定为"为投保人设计投保方案 / 比较保险产品" [D§7.5]。

### 13.6 价格

- 只发布少数固定参考画像下的价格点，数据来自公开费率表，并注明画像参数、费率表版本和抓取日期。
- 以"区间 + 分位"呈现，不做"最便宜"排序。
- **不提供保费试算。** 《互联网保险业务监管办法》第二十三条禁止非保险机构"保费试算、报价比价" [D§5.3]。

### 13.7 方法论版本化与治理

- 版本号格式为 `BM-<line>-MAJOR.MINOR.PATCH`。每个发布的分数都固化方法版本、数据快照 ID 和代码提交哈希，可以重放。
- 变更流程：RFC → 公开征求意见 → 影子运行（新旧方法并行计算，公布差异）→ 生效。每年复审一次。
- 直接继承 AIHOT 模型榜的治理范式："改任何常数都要升方法版本，并同步公开规则页" [A§A9]。
- 被评对象享有**事前核对权**与**更正权**，处理记录公开。

### 13.8 缺失数据与不确定性

- 字段四态（§12.2）。`not_found` 不插补。维度的证据覆盖率低于阈值时，该维度不出分。
- S 维度给出编码一致性区间；综合分给出权重扰动加编码不确定性后的区间。
- 字段超过 `as_of` 有效期（例如费率表更新、惠民保新年度）时，自动降级为"待复核"。

### 13.9 进入 MVP 的边界

| 内容 | MVP | 理由 |
|---|---|---|
| UIPS-Core + 医疗险 L2 schema、编码手册 v0、方法论 RFC v0 | **是** | 先做内部方法设计；公开 RFC 的样例、数据许可和呈现边界须核查，不宣称零法律风险 |
| 产品身份登记 + 产品事件（上市/停售/修订，按新闻事实报道） | **是** | 属于资讯事实，风险低 |
| 内部基准原型：选定窄品类，用公开条款跑通"证据 → 字段 → 指标"，**不对外发布分数** | **是** | 验证抽取准确率与成本 |
| 公开可复现演示：用开放数据集（CMS Exchange PUF 或 OPIN）发布方法与结果 | 可选，需发布前审查 | 开放数据许可不豁免发布地和目标受众的业务规则；逐项核查数据许可、产品比较与名称使用，不作为自动替代通道 [B§2.12] |
| 面向中国公众发布的产品分数卡、比较表、被占优标记 | **否**，取得律所书面意见后再进 Phase 2 | 《互联网保险业务监管办法》第二十三条、第十五条；《金融产品网络营销管理办法》（2026-09-30 施行）第二条、第十八条、第二十条 [D§5.3] |

---

## 14. Product Hot Score

### 14.1 原则

**术语说明**：本章的 "Hot" 是 owner 在 Phase 0 任务中指定的技术名，含义是**关注度（Attention）**，与品牌中的 HOT（High-value Observed Trends）无关。对外界面和 API 字段使用"关注度 / attention"。

**Popularity ≠ Quality ≠ Value。** Product Hot Score 只回答"市场在多大程度上关注这个产品"，**永不进入 Benchmark 分数**。它在页面上放在单独的面板里，并注明"不代表产品质量"。

### 14.2 信号评估

| 信号 | 数据来源 | 可获得性 | 偏差 | 抗操纵 | 成本 | 采用 |
|---|---|---|---|---|---|---|
| 独立来源数（媒体、公司、监管提及该产品的独立参与者数） | InsurHOT 自有采集（继承 AIHOT 的参与者去重） | 高 | 偏向大公司与营销投入大的产品 | **中高**：按参与者去重，转载不重复计 | 已有 | **主信号** |
| 报道增长率（与基线窗口比较） | 同上 | 高 | 新品天然"高增长" | 中 | 已有 | 是 |
| 官方发布（产品上市/修订公告，T2） | 公司披露 | 中（需适配器） | 小公司披露弱 | **高** | 适配成本 | 是（作为事件锚点，不加权热度） |
| 持续时间（关注度半衰期） | 自有 | 高 | —— | 中 | 已有 | 是（区分"一日热"与"持续热"） |
| 同类跟随数（发布后 N 天内同类同责任产品数） | 产品登记 + 事件 | 中（依赖产品抽取） | —— | **高**：跟随需要真实备案或发布 | Phase 2 | 是（也是 Change 信号） |
| 监管口径数据：新备案数、停售数 | 中保协/公司披露 | 中低（产品库禁止批量提取） | —— | **高** | 授权成本 | Phase 2（授权后） |
| 搜索趋势 | Google Trends API（alpha，仅少数测试者）；百度指数无合规自动获取途径 | 低 | 地域样本偏差 | 中 | 申请 | 仅海外，低权重 |
| 社交讨论 | 小红书、抖音、公众号的 robots 全禁；X 按量付费 | 很低 | KOL 投放、刷量 | **很低** | 高 | **V1 不采用** |
| App 排名 | Apple App Store RSS（已实测可用） | 中 | 只反映平台 App，不反映产品 | 中 | 免费 | 辅助（平台层，不是产品层） |
| 平台销量标签（"爆款"） | 商业平台 | 低 | 渠道偏差 + 佣金驱动 | 低（刷单） | —— | **不采用** |

### 14.3 公式（v0，待校准）

```
ProductHot(p, t) = Σ_{participant i} w_tier(i) · 0.5^{(t − last_i)/H}      # 独立参与者衰减和（继承 AIHOT heat-v1）
                 × (1 + α · follow_on(p, 30d))                              # 同类跟随加成（Phase 2）
约束：participants ≥ 2 且 ≥1 个 T0–T2 或 T5 编辑型来源；S 层信号权重 ≤ 0.2 且带异常检测
H（半衰期）：产品类默认 72h（保险产品信息的节奏慢于 AI 行业的 24h），用历史数据校准
输出：值 + rule_version + evidence（参与者清单）；公开规则页
```

w_tier 的作用是降低 T6 和 S 层的权重，**不是**为 T0 加分：热度衡量的是关注度，不是权威性。

---

## 15. AI Insurance Business Model Taxonomy

完整案例与文献见 [附录 C](research/ai-business-models.md)，包括 58 个案例表、失败案例库和学术框架综述。

### 15.1 研究结论

AI 驱动的新保险商业模式是 InsurHOT 的**最高优先级研究方向之一**（C0.6），也是 *What is emerging?* 的核心承载。

1. **大多数"AI-native"公司处在 L2（核心流程自动化）**，AI 可验证的作用集中在成本结构上。例如：
   - Lemonade 的 LAE 比率从 13% 降到 5%，约 55% 理赔自动化；
   - 众安健康险 99% 自动核保，但健康生态费用率仍为 50%；
   - 平安的 AI 坐席承担约 80% 的客服量。

   风险由谁承担、钱怎么赚，并没有改变 [C§0]。
2. **很多真正的结构创新与 AI 无关**：参数化触发、reciprocal、fronting、Lemonade 的 "Synthetic Agents"（实为获客成本融资）[C§0]。
3. **截至 2026-09，没有案例完全达到 L4**。最接近的是反向类别"为 AI 风险承保"，例如 Munich Re aiSure 的性能阈值触发、AIUC 的"认证 + 保险"（资本方未披露）[C§4.2]。
4. **Agentic insurance 仍停留在报价入口**。Tuio 的 ChatGPT 应用只给非约束性方案，Insurify 在部分州提供完整报价；没有找到买方 Agent 自主完成绑定和支付的公开案例 [C§2]。
5. 现有学术和监管框架都没有给出可操作的"AI 是否改变商业模式"判定标准：Eling & Lehmann、Braun & Schreiber、Stoeckli、Sosa & Sosa，以及 EIOPA、IAIS、NAIC 都是如此 [C§1]。**这就是 InsurHOT 方法论可以占据的空白。**

### 15.2 结构：两条主轴 + 一条反向轴 + 一组"非 AI 结构创新"类

不把候选名词（AI-native insurer、Embedded、Parametric……）直接当作物种，而是拆成正交的轴：

**轴 A：AI 作用的要素**（多选，对应 §16 的 14 个变量）

`customer` · `value_proposition` · `risk_identification` · `product_formation` · `pricing` · `underwriting` · `transaction` · `service` · `prevention` · `claims_trigger` · `risk_carrier` · `revenue` · `cost_structure` · `scalability`

**轴 B：改变程度 L0–L4**（§16.2）

**反向轴 A0–A4：AI 作为被保风险**（Insurance *for* AI，§16.3）

**形态标签**（Archetype，描述性、多选，**不作为"新物种"的判据**）：

| 形态 | 定义 | 研究结论 | 默认起评 |
|---|---|---|---|
| `full_stack_digital_carrier` | 自有牌照承担风险的数字/AI 承保人（原"AI-native insurer"） | 保留；必须标注自留比例和 AI 可验证贡献 | L2 |
| `mga_mgu` | 有承保权、无自有资本 | 保留；拆开"承保决策权"与"资本" | L1–L3 |
| `behavior_based_pricing` | 合并 UBI、动态定价、连续承保、持续风险管理中的定价部分 | 合并（Root、Tesla、Nirvana、Lemonade FSD） | L3 候选 |
| `prevention_integrated` | 合并 active insurance 与 continuous risk management；预防写入合同经济条款 | 合并（Coalition、At-Bay） | L3 候选 |
| `parametric_trigger` | 客观指数触发 | 保留，**标注 AI 非必要（N0–N1）** | L3（触发），AI 必要性低 |
| `ai_distribution` | AI 经纪/代理；单位服务成本曲线改变（Harper） | 保留，属于交易维度 | L2–L3 |
| `embedded_api_distribution` | 嵌入式分销与 Insurance-as-an-API 的分销部分 | 合并，属于交易维度 | L1 |
| `llm_interface_distribution` | LLM/Agent 界面内的报价与购买入口 | 新增（由 agentic 拆出） | L1–L2；绑定成立才升级 |
| `agent_to_agent_transaction` | 买方 Agent 与卖方 Agent 自主交易 | **观察名单**（无公开案例） | —— |
| `enabler_saas` | AI 承保、理赔、反欺诈 SaaS（Sixfold、Federato、Tractable、Shift） | **赋能层，不是保险新物种**；按客户侧效果评级 | L2（赋能） |
| `autonomous_claims` | 直通式理赔 | **降级为能力（capability）**，不作为模式 | —— |
| `machine_to_machine` / `ai_generated_products` | —— | **观察名单**（无可验证案例） | —— |
| `insurance_for_ai` | 为 AI 风险承保 | **独立成反向轴**，细分五类（§16.3） | A 级 |
| **`capital_structure_innovation`**（新增） | fronting、资本即服务、reciprocal、CAC 融资、ILS | 专门用来**排除把创新误归因给 AI** | 不参与 L 级 |
| **`non_insurance_risk_sharing`**（新增，反例） | 网络互助、事后分摊（相互宝） | 与保险新物种划清界限 | 不参与 |

### 15.3 为什么不机械采用候选 taxonomy

- 候选词表把"渠道形态"（Embedded、Insurance-as-an-API）、"技术能力"（AI Underwriting、Autonomous Claims）和"风险结构"（Parametric、Risk Carrier）混在同一层。结果是一家公司可以同时属于五类，而分类本身什么也没说明。
- 形态标签只回答"它看起来像什么"；**L 级才回答"AI 改变了什么"**。雷达的核心是 L 级和证据，形态标签只用于检索。

---

## 16. Business Model Innovation Criteria

### 16.1 反事实测试（每个变量）

> **拿掉 AI，这个要素还能以相近的经济性存在吗？** 如果能，就是"优化"；如果不能，或者要素本身的定义变了，就是"改变"。

| # | 变量 | "只是优化"的公开证据 | "AI 改变了它"需要的可观测公开证据 |
|---|---|---|---|
| 1 | Customer | 转化率、获客成本下降 | 服务了传统模式**无法经济地服务**的客群，并有量化证据（单客服务成本、此前被拒保的比例） |
| 2 | Value Proposition | "更快、更便宜" | 承诺的形式变了：从赔付损失变为防止损失，或承保 AI 性能 |
| 3 | Risk identification | 更多特征、更准的模型 | 识别出此前**不可观测或不可保**的风险，且有人为此投入资本 |
| 4 | Product formation | 可配置条款 | 出现依赖 AI 或数据、且经监管备案的**新险种或新条款结构** |
| 5 | Pricing | 变量更多的 GLM/ML | 定价**依据**从静态属性换成持续行为或机器状态，并能在费率文件中看到 |
| 6 | Underwriting | 核保人效提升 | 承保**不再需要传统证据**（如体检），或由持续监测代替一次性核保 |
| 7 | Distribution / Transaction | 线上化、API | 交易发生的地点或主体改变（LLM 内、Agent 对 Agent），**且能完成绑定** |
| 8 | Service | 客服自动化率 | 服务成为影响保费、限额的**可计价要素** |
| 9 | Prevention | 风险提示 | 预防行为**写入合同经济条款**，并有频率下降的证据 |
| 10 | Claims trigger | 理赔自动化 | 触发条件从"损失核定"变为**客观指数或模型指标** |
| 11 | Risk carrier | 仍由传统承保人承担 | 出现新的资本安排或风险承担主体 |
| 12 | Revenue | 佣金或承保利润的量变 | 收入**类型**改变：服务费、认证费、性能担保费、管理费 |
| 13 | Cost structure | LAE、费用率下降 | 成本曲线的**形状**改变（边际服务成本接近零，人员与保费脱钩），并在多年财报中持续 |
| 14 | Scalability | 增长率 | IFP/员工等效率指标持续上升，且损失率不恶化（多期序列） |

注：Distribution 只研究公开的交易结构，**不研究任何公司的内部渠道经营**（Non-goal N3）。

### 16.2 L 级（"AI 作为工具"轴）

| 级别 | 定义 | 最低公开证据要求 |
|---|---|---|
| **L0 叙事** | 只有营销中的 "AI" 字样 | —— |
| **L1 辅助/后台** | 文档、客服、内部 Copilot | 公司披露了具体用例 |
| **L2 核心流程自动化（优化）** | 定价、承保、理赔的**决策**主要由模型做出，单位成本或速度有量化改善 | 一手披露的自动化率、LAE/费用率、时效，**连续 ≥4 个季度** |
| **L3 要素重构** | 14 个变量中至少 1 个的**定义**被改变，且 AI 或数据是必要条件之一 | 产品或费率文件、合同条款、多期损失率或成本序列 |
| **L4 新风险承担/交易结构（没有 AI 就不可能）** | 新的风险标的、交易主体、资本或收入形态，只能在 AI 条件下存在 | **有名字的资本方**、限额、保费或理赔数据，以及监管备案 |

### 16.3 反向轴 A0–A4（Insurance for AI）

| 级别 | 定义 | 例 |
|---|---|---|
| A0 | 沉默或明确除外 | Verisk 自 2026-01 起的 GenAI 除外表单（CG 40 47/48、CG 35 08）；多家承保人申请 AI 除外 [C§4.2] |
| A1 | 在网络险或 E&O 中加批单做有限扩展 | —— |
| A2 | 独立的肯定性 AI 责任险 | Armilla/Chaucer、Testudo、Relm、Vouch、Corgi |
| A3 | 可量化的性能担保或类参数化触发，或认证与承保挂钩 | Munich Re aiSure、AIUC（资本方 NV）、Klaimee |
| A4 | 持续监测、动态保费的 AI 代理保险，并有公开的理赔或损失数据 | **暂无** |

子类型：AI 输出第三方责任 · 性能担保 · 部署方第一方损失 · 自主系统/实体 AI · 认证驱动承保 [C§4.3]。

### 16.4 配套标签（每张卡必填）

| 标签 | 取值 |
|---|---|
| 证据等级 E | E1 监管或审计披露 · E2 公司官方 · E3 行业媒体 · E4 聚合站 |
| 持续性 D | D0 单点 · D1 ≥4 个季度 · D2 ≥8 个季度 |
| AI 必要性 N | N0 非必要 · N1 增强 · N2 必要 |
| 风险自留比例 | % / 未知 |
| 失败标记 | 亏损、退出、出售、监管叫停 |

**判级规则（可审计）：**

- L ≥ 3 要求 E ≤ 2、D ≥ 1、N ≥ 1；
- L4 要求有名字的资本方（E1/E2）；
- 只有 E3/E4 证据时，最高 L2，并标注"待验证"；
- 判级由两名编辑独立完成，κ 公开；分歧由第三人仲裁。

### 16.5 炒作识别清单（写入编辑手册与模型提示词）

| 模式 | 识别方法 |
|---|---|
| 命名误导 | 读 10-K 或股东信的定义段（如 "Synthetic Agents" 实为 CAC 融资） |
| 分母口径游戏 | 区分 FNOL、分流、结案、赔付，要求提供"端到端自动化结案率" |
| 损失率改善归因给 AI | 拆解：费率上调、退出州、产品组合、再保、准备金、资产出售收益 |
| "AI-native" 但不承担风险 | 查牌照与保单签发方 |
| 虚荣指标 | 用 token 量、调用量说话 → 要求对应到费用率、LAE 的多期变化 |
| "最多、高达" | 只有厂商自报、没有被点名客户时，最高 E2/E3 |
| Agentic 只到报价 | 检查能否在 Agent 界面内完成绑定、支付并出具单证 |
| 没有资本方的"AI 保险" | 要求公布承保人名称、限额、保费区间 |
| 参数化被贴上 AI 标签 | AI 是否改变了指数设计或基差风险 |
| 自报的预防效果 | 是否有第三方精算或再保背书；是否存在选择偏差 |
| 估值驱动叙事 | 跟踪估值、融资与经营指标是否背离 |
| 规避监管的"互助" | 是否持牌、是否有准备金 |

---

## 17. New Species Schema

### 17.1 栏目定位

**New Species｜保险新物种**：登记"保险行业出现了以前不存在的东西"，形态上参照 Artemis Deal Directory 的"每笔一条结构化记录 + 相关新闻流" [B§2.2]。**进入登记簿的门槛是"结构上新"，不是"热门"**；登记之后，由 L/A 级和证据说明它新在哪里、新到什么程度。

### 17.2 Business Model Card（在候选字段基础上完善）

```yaml
BusinessModelCard:
  card_id, version, status: candidate | listed | watchlist | retired | failed
  # 身份
  entity_id                      # → Organization（公司名、国家、成立年份来自实体主数据，不在卡上重复）
  jurisdictions[]
  first_detected: {at, source_id, document_id}      # InsurHOT 首次发现
  first_public_evidence: {at, document_id}          # 最早公开证据（可早于首次发现）
  # 结构
  archetypes[]                   # §15.2 形态标签
  lines[]
  customer: {segment, b2b|b2c|b2b2c, previously_underserved: bool, evidence}
  problem                        # 解决什么问题（一句话，带证据）
  traditional_model              # 对照的传统做法（一句话）
  new_model                      # 新做法（一句话）
  variables:                     # 14 变量 × {changed: none|optimized|changed, ai_role, evidence[]}
    pricing: {...}, underwriting: {...}, transaction: {...}, claims_trigger: {...}, ...
  # 风险与资本（候选字段 Risk carrier / License structure 的细化）
  license_structure: {license_type[], paper_issuer_entity_id, fronting_entity_id?, coverholder_of?}
  capital_providers[]: {entity_id, role: carrier|reinsurer|ils|investor}
  retention_pct?
  revenue_types[]: underwriting_profit | commission | fee_admin | saas | service | certification | performance_guarantee
  technology_dependency: {data_sources[], models?, third_party_dependencies[]}   # 如 Tesla Fleet API
  ai_role                        # 摘要（由 variables 派生）
  # 评级
  level_L, level_A?, ai_necessity_N, evidence_grade_E, durability_D
  rating_rationale               # 编辑判断（judgment_editorial），引用断言
  hype_flags[]                   # §16.5
  failure_flags[]                # 亏损、退出、出售、叫停
  # 财务与规模（仅公开）
  funding_events[] → Event(tech.funding)
  outcome_metrics[]: {metric, value, period, assertion_id}   # 损失率、LAE、IFP/员工等多期序列
  # 关联
  similar_cards[], related_products[], related_events[]
  # 治理
  sources[] (由断言汇总), confidence, reviewers[], kappa?, updated_at, change_log[]
```

**对候选字段的修改：**

- 删去卡片上重复的 `Company / Country / Founded`，改由实体主数据提供，避免与实体数据不一致。
- `Funding` 从静态字段改为事件引用，因为融资是时间序列。
- 新增 `first_public_evidence`，与 `first_detected` 分开：前者证明"它何时存在"，后者衡量 InsurHOT 自己发现得多快。
- 新增 `license_structure`、`capital_providers`、`retention_pct`，这是判断"谁承担风险"的核心；新增 `hype_flags`、`failure_flags`、`outcome_metrics`（必须是多期）。
- `Confidence` 拆解为 E、D、N、κ，不再是一个笼统的数字。

### 17.3 冷启动

附录 C 已完成 58 个案例的初步编码，包括 L/A 级、证据和 NV 标注。MVP 按以下步骤冷启动：

1. 把 58 个案例导入为 `candidate`；
2. 用一手来源复核所有 NV 项（附录 C §7 已列出）；
3. 达到判级规则的案例升为 `listed`，其余保持 `watchlist` 或 `candidate`。

---

## 18. Hot Score vs Change Score（及三支柱信号）

### 18.0 三支柱信号总览（按 C0 校准）

InsurHOT 的排序和视图由三个主信号驱动，分别回答 C0 的三个问题；Hot Score 降为辅助信号：

| 信号 | 回答 | 衡量什么 | 主要输入 | 方法 | 主要承载 |
|---|---|---|---|---|---|
| **Importance** | What matters? | 对保险经营、合规、消费者权益与市场结构的实质份量 | 保险版五轴评分（sig、nov、cred、reson、impact，§19.3）、证据等级、影响面（受影响的险种保费占比、实体份额） | 双评分（继承 AIHOT 机制）+ 规则加成（如 T0 生效文件） | "重要"视图；日报的重要事件节；精选 |
| **Change** | What is changing? | 与此前状态相比的实质变化 | 检测器 D1–D3、D5、D6、D8（§18.2） | 规则为主，模型辅助解释 | "变化"视图；监管追踪；产品版本 diff |
| **Emergence** | What is emerging? | 尚未成为行业共识的新事物，以及它处在扩散的哪个阶段 | 检测器 D4（首次出现）、D7（扩散），New Species 候选，`risk.emerging_risk` 等事件 | 规则 + 人工判定（BM 判级只由人完成） | "新生"视图；New Species 登记簿 |
| Attention（技术名 Hot Score） | What is hot?（辅助） | 被多少独立来源关注 | 独立参与者、时间衰减（§14、AIHOT heat-v1） | 确定性 | 关注度榜（辅助入口）；Importance 的弱输入之一 |

**规则**：Attention 可以作为 Importance 的弱输入（权重上限在方法页公开），但不能单独决定"重要"；四个信号互不替代，也都不进入 Benchmark 分数。

### 18.1 区别

| | Hot Score | Change Score |
|---|---|---|
| 回答 | 什么正在被**关注**？ | 什么正在发生**结构性变化**？ |
| 对象 | 事件、产品 | 事件、实体、产品版本、监管对象、BM 卡 |
| 输入 | 独立参与者数量、时间衰减 | 与"此前状态"的差异：规则、条款、结构、类别首次出现 |
| 时间尺度 | 小时—天 | 天—年 |
| 噪声来源 | 营销、转载、争议 | 抽取错误、定义漂移 |
| 失效方式 | 被刷 | 把表面措辞变化误判为结构变化 |
| 典型例子 | 某公司高管被带走（高 Hot、低 Change） | 某规范性文件把某险种的等待期上限从 90 天改为 30 天（低 Hot、高 Change） |
| 是否需要模型 | 不需要（确定性） | 规则为主，模型辅助解释 |

**两者都值得建设，但 Hot 只是辅助。** 保险行业里最重要的信息，往往是没人讨论的规则和条款变化；最热的信息，往往是人事和八卦。只做 Hot，InsurHOT 会退化成保险新闻站，这与 C0 对 HOT 的定义（High-value Observed Trends）相悖；Hot 保留为"今天大家在关注什么"的辅助入口。

### 18.2 检测器（Change 与 Emergence）

| 检测器 | 支柱 | 对象 | 方法 | 阶段 |
|---|---|---|---|---|
| D1 监管生命周期 | Change | Regulation | 确定性：consultation → issued → effective → amended/repealed；生效与截止日历 | Phase 1 |
| D2 监管文本 diff | Change | Regulation 版本（征求意见稿 vs 正式稿；新旧规定） | 文本对齐 diff + 模型摘要"实质变化"（引用条款） | Phase 1 |
| D3 实体状态 | Change | Organization | 确定性：牌照、控股、偿付能力等级跨阈值、评级变动、市场进入/退出 | Phase 1 |
| D4 首次出现 | **Emergence** | Event type、险种 × 法域、BM 形态、保障责任代码 | 确定性：词表中"首次在某法域/险种出现"；新实体类型 | Phase 1 |
| D5 指标突变 | Change | 统计序列（NFRA 月度、投诉通报、红利实现率） | 统计：同比/环比 z-score、结构断点 | Phase 1–2 |
| D6 产品版本 diff | Change | ProductVersion | 字段级 diff（UIPS）：责任增减、等待期、免赔、续保措辞 | Phase 2 |
| D7 扩散 | **Emergence** | 新保障责任、新形态、新风险被跟随 | 首次出现之后 N 天内的跟随者计数 | Phase 2 |
| D8 BM 级别变化 | Change（新卡登记属于 Emergence） | BusinessModelCard | L/A 级变化、失败标记 | Phase 1（人工） |

### 18.3 Change Score（v0，待校准）

```
Change(x) = Σ_k  s_k · m_k · a_k · c_k
  s_k 结构性权重：检测器类型的先验（D1 生效 > D2 实质修订 > D6 条款变化 > D5 指标突变 > D3 人事）
  m_k 幅度：diff 的规模（条款变动比例、阈值跨越幅度、z-score）
  a_k 影响面：受影响的险种保费占比 / 实体市场份额 / 法域规模（公开统计）
  c_k 置信度：证据等级 × 抽取置信度（T0–T2 且规则检测 = 1.0；模型解释 ≤ 0.8）
输出：值 + reasons[]（每个 reason 引用断言与 diff）+ rule_version
```

Change 的第一目标是**可解释**（给出 reasons），不是排序精度。首页和日报按三支柱分节（重要 / 变化 / 新生），各节按对应信号排序；关注度（Hot）只作为辅助入口。

### 18.4 Emergence（v0）：从首次出现到行业共识

"尚未成为行业共识"必须可操作化。每个"新事物"对象（新保障责任代码、新产品形态、新风险类型、新技术应用、BM 形态或卡片）都维护一个**扩散阶段**：

| 阶段 | 定义（v0，阈值待校准） | 证据要求 |
|---|---|---|
| `weak_signal` | 只有单一来源或单一主体提及；或者只有 T5/T6 报道 | 至少 1 条断言 |
| `emerging` | 至少 1 个 T0–T2 一手证据（如备案条款、法定披露、监管文件）确认它真实存在，且采用者（独立主体）≤ N₁ | 一手证据 |
| `spreading` | 在首次出现后的观察窗口内，独立采用者数超过 N₁，或跨出首个法域或险种 | 采用者清单（D7） |
| `mainstream` | 采用者超过 N₂，或被纳入行业标准、示范条款、监管规定 | 标准或监管证据 |

- **"新生"视图只展示 `weak_signal`、`emerging`、`spreading`**。进入 `mainstream` 后退出"新生"，转由 Change 与 Importance 跟踪。
- 每个对象记录 `first_seen`（InsurHOT 发现）与 `first_public_evidence`（最早公开证据），与 §17、§20.3 一致。
- **质量指标：领先时间**，即 InsurHOT 标为 `emerging` 的时间，比它进入 `mainstream` 或被主流专业媒体集中报道的时间早多少（§25.2）。
- `weak_signal` 阶段的内容必须显式标注认知状态（多为 `claim_self` 或 `fact_reported`），不得表述为已发生的趋势（C1）。

---

## 19. AI Pipeline

### 19.1 目标流水线与每一步的方法选择

原则：**能确定性就不用模型，能小模型就不用大模型，能抽取就不生成。**

| # | 步骤 | 输入 → 输出 | Deterministic | Rules | Embedding | Small LLM | Large LLM | Human | 来源 |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Permission gate | Source → 许可决定（deny / metadata_only / snapshot_allowed） | ● | ● | | | | ○ 待核准 | New |
| 1 | Fetch & Snapshot | 获准 URL → Document（按许可留存原件或元数据） | ● | | | | | | New |
| 2 | Parse | PDF/HTML/DOC → 文本、版面、表格、条款编号 | ●（pdf/ofd/doc 解析、版面） | ●（条款编号正则） | | ○（扫描件 OCR 后清洗） | | | New |
| 3 | Deduplicate | 规范化 URL、内容哈希、文号、docId | ● | ● | ○（近重复） | | | | Inherit + Adapt |
| 4 | Relevance filter | 是否保险相关 | | ●（信源默认相关，如 NFRA） | | ●（prefilter，宽召回） | | | Adapt |
| 5 | Classification | domain、event_type、line、jurisdiction | | ●（信源与栏目映射，如 NFRA itemId 928 → `reg.issued`） | | ● | | ○ 抽检 | Replace |
| 6 | Entity extraction & linking | 提及 → entity_id | ●（外部 ID、别名精确匹配） | ● | ● | ●（歧义判定） | | ●（低置信队列） | New |
| 7 | Fact / Assertion extraction | 文本 → 断言（主谓宾/数值/条件/时间 + 定位） | ●（结构化源，如统计表、处罚表） | ● | | ●（一般资讯） | ○（条款级、监管文本 diff 解释） | ○ | New |
| 8 | Evidence linking | 断言 → 段落定位；跨来源对齐 | ●（原文字符串匹配校验） | | ● | ○ | | | New |
| 9 | Importance scoring（精选） | 重要性（What matters?） | | | | ●（双评分，继承） | | ○ 金标 | Adapt |
| 10 | Event clustering | 资料 → fact/story | ●（文号、docId 强身份键） | | ● | ● | ○（跨厂商复核，继承） | ○（人工拆合，继承） | Inherit + Adapt |
| 11 | Attention（Hot Score，辅助） | —— | ● | | | | | | Adapt |
| 12 | Change & Emergence detection | diff、阈值、首次出现、扩散阶段 | ● | ● | | ○（解释） | ○（监管实质变化摘要） | | New |
| 13 | Product extraction（Phase 2） | 条款 → UIPS 字段 | ●（费率表、表格） | ● | | ● 第一路 | ●（第二路 / 冲突时） | ●（S 维度双人编码） | New |
| 14 | Business model detection | 资讯 → BM 候选 | | ●（关键词与事件类型触发） | ● | ●（候选打标） | ○（卡片草稿） | **●（判级只由人完成）** | New |
| 15 | Summary / writing | 标题、摘要、事件综述、日报 | | | | ● | ○（月报、专题） | ○ | Adapt |
| 16 | Publish | 公开投影 | ● | ●（许可 → 展示方式） | | | | | Inherit |

● = 主要方式；○ = 辅助或兜底。

### 19.2 关键设计点

1. **结构化源不走 LLM。** NFRA 的统计表、处罚列表、中保协的偿付能力披露列表等，用解析器直接生成断言；模型只写摘要。这类数据占 V1 一手信源的大部分，**这是成本与准确性的最大杠杆**。
2. **断言抽取必须通过"原文回查"校验。** 模型给出的每个数值和日期，都必须能在指定段落中找到字面对应（或等价换算），否则丢弃或降级为 `inference_model`。这是 AIHOT 防幻觉规则 #4（"每一个产品名/数字/版本号必须在原文里能找到对应"）的程序化版本。
3. **评分不看来源、阈值按来源分级**：继承 AIHOT 的解耦设计 [A§A4]。
4. **BM 判级只由人完成**。模型负责找候选、起草卡片、标注疑似炒作模式，不能自己给出 L3/L4。

### 19.3 保险版评分标准（`selection-score.md` 改写要点）

保留结构：内容类型 × 五轴加权 × 噪声压制 × 安全边界；模型只输出一个整数分数。**评分语义从 AIHOT 的"事件注意力"（`attentionScore`）改为"重要性"（`importanceScore`），承载 What matters?**：衡量事件对保险行业的实质份量，不衡量它被讨论得多热。替换内容：

- **读者**：保险从业者、研究者、投资者，注意力有限。
- **内容类型（7 类）**：`regulatory_change`、`enforcement`、`company_event`、`product_change`、`market_data`、`research_analysis`、`industry_opinion`。
- **五轴**：沿用 sig（实质份量）、nov（信息增量）、cred（证据强度）、reson（共振面），把 act（可用性）改为 `impact`（对保险经营、合规或消费者权益的直接影响面）。reson 在这里指"与保险从业者和研究者的相关度"，不是传播热度；讨论量不进入评分输入（输入本来就不含来源信息，继承 AIHOT）。
- **必须正常评价**：
  - 监管正式发布、生效，征求意见截止；
  - 行业标准定义与示范条款变化；
  - 大额或典型处罚；
  - 偿付能力与评级的实质变化；
  - 新型保障或触发机制；
  - 有名字资本方的新风险承担结构；
  - 官方统计发布。
- **必须压住**：
  - 保险营销软文、产品推广、"爆款"榜单；
  - 公司活动和公益宣传；
  - 代理人招募；
  - 只有"AI 赋能"字样的新闻稿（sig ≤ 3）；
  - 无数据的"数字化转型"观点；
  - 多事件打包的早报。
- **阈值必须用 ≥300 条保险金标样本重新校准**，不继承 AI 领域的 60/65/76（F-08）。

---

## 20. Evidence / Provenance Architecture

### 20.1 数据链

```
Source ─< Document ─< DocumentVersion(sha256, snapshot, fetched_at, license) ─< Passage(locator)
                                                                                  │
Assertion ─< AssertionEvidence(passage_id, relation: supports|contradicts|mentions, strength) ─┘
   │  subject_entity_id, predicate, object_entity_id | value{num, unit, currency, period}, qualifiers{conditions, jurisdiction, line}
   │  valid_time{from,to}, modality: fact|claim|estimate|forecast|opinion
   │  epistemic_status (C1.2), extracted_by{rule|model:<id>@<prompt_version>|human}, receipt_ids[], reviewed_by?, confidence
   │  first_seen{at, document_id}
   └──> 被引用于：Event / EntityRelation / ProductVersion.field / BusinessModelCard.variable / Metric / Score
```

### 20.2 规则

1. **先许可、后抓取与留存。** R0/R1 只有在许可记录明确允许分析和归档时才保存原件；R1 不提供原件公开下载。R2 仅保存获准元数据、摘要和链接，不保存全文、全文分片或可还原全文的 Passage；R3 不自动请求。短引用需单独有允许范围，不能由 R2 自动推导。`snapshot_status` 取 `retained` / `not_permitted` / `unavailable` / `deleted`，哈希未知用 null，不伪造哈希。
   **Passage locator** 支持 PDF 页码+bbox、条款编号、HTML 字符区间和表格单元格。公开事实须有合法留存且足够支持该断言的证据；只有线索链接、没有可回查证据时留在线索队列。
2. **一手优先**：断言的"代表证据"按 T0 > T1 > T2 > T3 > T4 > T5 > T6 选取；只有 T5/T6 支撑的断言，状态最高为 `fact_reported`。
3. **独立性计算**：以 `origin_document_id` 折叠同源转载，以 `owner_entity_id` 标记共同主体，以 `signal_group_id` 去重关注度。`independence=media/regulator/...` 只描述来源属性，不能用作分组 ID。两家媒体转引同一公司公告只形成一份原始证据；两个独立监管机构各自发布的决定不能因都为 regulator 而合并。关系未知时显式 unknown，不把多个 URL 自动当成独立佐证。
4. **冲突处理**：同一 (subject, predicate, valid_time) 下出现互斥的值时，状态标为 `disputed`，页面上并列展示两方证据及其等级；高 tier 证据**不自动覆盖**低 tier 证据，只作为展示排序依据。只有编辑可以裁决，裁决记为 `judgment_editorial`。
5. **更正与撤回**：来源撤稿、文档更新时，产生新的 DocumentVersion；受影响的断言重新校验，对外显示"已更正"及差异（继承 AIHOT 的 revision 思路，扩展到文档层）。
6. **模型输出的可追溯**：每个模型产出都记录 `receipt_id` 与 `prompt_version`（继承 AIHOT）；断言记录抽取器版本，方法变更后可以重放。
7. **对外 API 的每个结论字段都附 `evidence[]`**（§22）。

### 20.3 首次出现（First Seen）

- `first_seen_at` = InsurHOT 首次成功记录该对象的观测回执时间（UTC），只取本系统观测回执的最早值，不使用来源发布时间或回填文章日期。迟到的历史导入必须保留本次实际发现时间。
- `source_published_at` 单独记录来源声明时间、原始值、精度、时区与核验状态；未来时间或解析错误不得改变 first_seen。`first_public_evidence_at` 为当前检索范围内最早已核验公开证据的日期，可随新证据修订并保留版本，不宣称全球首次。
- `emerging_marked_at` 为达到方法版本规定的 emerging 门槛并实际记账的时间；不能用历史 source_published_at 回填以抬高领先时间。
- 发现延迟只在发布时间已核验时计算，历史回填与实时样本分层；未知值不补零、负值标记异常。领先时间对尚未 mainstream 的对象记为未完成观测，不把未结束样本丢弃后只报成功者。

---

## 21. Data Architecture

### 21.1 存储选型

| 组件 | 选择 | 理由 |
|---|---|---|
| 主库 | **PostgreSQL 17**（继承） | 关系模型足以表达实体关系与证据链（§11.4）；运维简单 |
| 向量 | V1 沿用 `embeddings real[]` 表加窗口扫描（继承）；当召回窗口超过约 5 万条或出现跨年检索时，引入 **pgvector** | AIHOT 刻意不用 pgvector 以保持简单，但 InsurHOT 的监管事件窗口长达 180 天，会更早触发 |
| 全文检索 | pg_trgm（继承）；中文分词不足时评估 `zhparser` 或外部检索 | 先测再换 |
| 原件与快照 | **S3 兼容对象存储**（自部署 MinIO 或云 OSS），按 `sha256` 做内容寻址 | PDF 和快照体积大，不应放在数据库中；内容寻址天然去重 |
| 队列与调度 | pg-boss（继承） | —— |
| 文档解析 | 独立的 `parser` worker（Node 调 Python 子进程或独立服务），处理 PDF 文本与版面、表格、OCR、`.doc/.wps/.ofd` | 解析是 CPU 密集型，与 LLM 任务隔离 |
| 数据集发布 | 定期导出 Parquet/CSV/JSON-LD，带版本与许可 | 研究者场景 |

### 21.2 Schema 分组（增量迁移，不改动 AIHOT 既有表的语义）

| 组 | 表（新增为 **粗体**） | 说明 |
|---|---|---|
| ingest | sources（扩列）、fetch_runs、articles、article_revisions、article_discoveries | 扩列内容：evidence_tier、independence、authority、reuse_class、jurisdiction、language、access_method、robots_status、tdm_optout、license_note |
| document | **documents**、**document_versions**、**passages**、**document_article_links** | 原件层；article 可以挂多个 document（公告正文 + 附件） |
| entity | **entities**、**entity_aliases**、**entity_identifiers**、**entity_relations**、**jurisdictions**、**lines**、**line_mappings** | §11 |
| evidence | **assertions**、**assertion_evidence**、**assertion_reviews** | §20 |
| editorial | analyses（扩 JSON）、editorial_overrides、publications（扩 facet 列）、pool_search | 继承 |
| event | stories、facts（扩：event_type、jurisdiction、lines、times）、**event_entities**、**event_assertions**、**event_relations**、fact_articles、story_signals、story_heat_hourly、hot_rankings、grouping_* | 继承 + 扩展 |
| regulation | **regulations**、**regulation_versions**、**regulation_lifecycle** | Regulatory Tracker |
| product（Phase 2） | **products**、**product_versions**、**product_fields**（EAV + 类型化视图）、**product_diffs** | §12 |
| benchmark（Phase 2） | **methods**（版本、规则页、代码哈希）、**profiles**、**metric_values**、**scorecards**、**comparable_sets** | §13 |
| bm | **bm_cards**、**bm_card_versions**、**bm_variable_assessments**、**bm_reviews** | §17 |
| change | **change_detections**（检测器、对象、diff、reasons、score、rule_version） | §18 |
| ops | receipts、receipt_attempts、budgets（扩：月度金额）、service_prices、job_runs、audit_log、settings、selectbench_*、**evalsets**、**eval_runs** | 继承 + 评测扩展 |
| public | **corrections**（更正工单与公开处理记录）、**dataset_releases** | —— |

### 21.3 不变量（在 AIHOT 七条之上新增）

- **I8**：`publications` 与所有公开读取，只能引用状态为已复核或规则产出的断言；`inference_model` 状态的断言必须在展示时明确标注。
- **I9**：评分表（scorecards、bm 级别、change score）只引用断言与方法版本，不直接引用 article。
- **I10**：获准留存的原件内容不可原地覆盖，更新产生新版本；合法删除或许可撤回走受审计的删除/tombstone 流程，撤销所有公开投影与下载，保留可合法留存的最小审计记录。不可变不等于必须永久保存。
- **I11**：许可门同时约束请求、存储、解析、模型传输及全部公开出口；API、MCP、RSS、导出、对象下载与页面不得绕过。默认拒绝未知权限的自动化行为。

---

## 22. API / RSS / MCP Architecture

### 22.1 原则（继承 + 新增）

- 同一公开读取层（`publication/`）服务网页、RSS、REST、MCP、`llms.txt` 和数据集（继承）。
- 默认匿名只读（继承）。高配额和批量数据集可用 API Key，这只是为了限流，不设付费墙（C3）。
- **每个结论字段都附带 `evidence[]` 和 `epistemic_status`**；每个评分附带 `method_version`。
- 增量同步：沿用 AIHOT 的 `snapshot + changes`（ledger）模式，扩展到事件、实体、监管、BM 卡。
- 版本化：`/api/v1` 保持与 AIHOT 兼容的资讯接口；领域资源进入 `/api/v2`，或在 v1 中新增资源，由 ADR 决定。

### 22.2 资源与接口（V1 公开）

| 资源 | REST | 说明 |
|---|---|---|
| Items | `GET /api/v1/items`（继承；新增 `domain`、`line`、`jurisdiction`、`entity` 过滤） | 资讯 |
| Events | `GET /api/v1/events?type=&jurisdiction=&line=&entity=&since=` · `GET /api/v1/events/{id}` | 替代并兼容 `stories` |
| Importance | `GET /api/v1/matters?window=&domain=&jurisdiction=` | 重要事件（What matters?），按 Importance 排序 |
| Emerging | `GET /api/v1/emerging?stage=&kind=&jurisdiction=` | 新生事物及其扩散阶段（What is emerging?） |
| Attention | `GET /api/v1/hot-topics`（继承；字段语义为关注度，响应中注明"不代表重要性"） | 辅助 |
| Changes | `GET /api/v1/changes?since=&detector=&jurisdiction=&min_score=` | 变化流 |
| Entities | `GET /api/v1/entities?q=&type=&jurisdiction=` · `GET /api/v1/entities/{id}` · `GET /api/v1/entities/{id}/timeline` · `GET /api/v1/entities/{id}/relations` | 实体主数据 |
| Regulations | `GET /api/v1/regulations?jurisdiction=&status=&line=` · `GET /api/v1/regulations/{id}`（含 lifecycle、versions、diff） | 监管跟踪 |
| Evidence | `GET /api/v1/assertions/{id}` · `GET /api/v1/documents/{id}`（元数据、哈希、原文链接；全文按 reuse_class） | 证据查询 |
| Business models | `GET /api/v1/species?level=&archetype=&axis=` · `GET /api/v1/species/{card_id}`（含版本） | New Species |
| Reports | `GET /api/v1/dailies/...`（继承）+ weekly/monthly | —— |
| Methods | `GET /api/v1/methods/{key}/{version}` | 方法文档与参数（机器可读） |
| Datasets | `GET /api/v1/datasets` → 下载链接、版本、许可、schema | 研究者 |
| Products（Phase 2） | `GET /api/v1/products?…` · `/products/{id}/versions` · `/products/{id}/diff?from=&to=` | 事实，不含评分 |
| Benchmarks（法律意见后） | `GET /api/v1/benchmarks/{line}?profile=&method_version=` | 分数卡 |

**响应中的证据片段（示例）：**

```json
{
  "assertion_id": "as_01H…",
  "statement_zh": "《XX 办法》自 2027-01-01 起施行",
  "epistemic_status": "fact_primary",
  "evidence": [{
    "tier": "T0", "source": "国家金融监督管理总局", "document_id": "doc_…",
    "url": "https://www.nfra.gov.cn/…", "sha256": "…", "fetched_at": "2026-09-29T02:00:00Z",
    "locator": {"article": "第六十条"}, "quote": "本办法自2027年1月1日起施行。"
  }],
  "first_seen": {"at": "2026-08-21T…", "source": "nfra"}
}
```

### 22.3 MCP 工具（前缀 `insurhot_`）

| 工具 | 用途 | 来源 |
|---|---|---|
| `insurhot_get_latest` / `insurhot_search` / `insurhot_get_daily` | 资讯与日报 | 继承 |
| `insurhot_get_matters` | 重要事件（What matters?） | 新增 |
| `insurhot_get_emerging` | 新生事物与扩散阶段（What is emerging?） | 新增 |
| `insurhot_get_hot` | 关注度榜（辅助；工具说明写明"关注度 ≠ 重要性"） | 继承 |
| `insurhot_get_event` | 事件、时间线与证据（替代 get_story，保留别名） | 改造 |
| `insurhot_get_changes` | 某时间以来的结构性变化（可按法域、险种、检测器过滤） | 新增 |
| `insurhot_get_entity` / `insurhot_entity_timeline` | 实体主数据与时间线 | 新增 |
| `insurhot_list_regulations` / `insurhot_get_regulation` | 监管对象、生命周期与 diff | 新增 |
| `insurhot_get_evidence` | 断言的证据链与原文定位 | 新增 |
| `insurhot_list_species` / `insurhot_get_business_model` | New Species 与商业模式卡 | 新增 |
| `insurhot_get_method` | 方法文档（让 Agent 解释分数的由来） | 新增 |
| `insurhot_get_product_facts`（Phase 2） | 产品版本事实（无评分） | 新增 |

MCP 工具描述沿用 AIHOT 的防误用写法，例如"只使用本工具返回的 ID，不要编造"。每个工具同时返回人读文本和 `structuredContent`（`schemaVersion`）。**工具不提供"推荐购买哪个产品"一类的能力**，并在工具说明中写明限制（N4）。

### 22.4 RSS

继承精选、全部、全文、日报等订阅，新增：

- `/feed/matters.xml`、`/feed/changes.xml`、`/feed/emerging.xml`（三支柱）
- `/feed/regulation/{jurisdiction}.xml`
- `/feed/entity/{id}.xml`
- `/feed/species.xml`
- `/feed/domain/{key}.xml`

全文 RSS 仍只对 `reuse_class = R0` 的来源开放。

### 22.5 `llms.txt`

继承"由配置生成、只列真实资源"的做法；另外增加"方法论与证据等级说明"和"使用限制（非投保建议）"两节。

---

## 23. Global / China Strategy

### 23.1 决策：一个核心，分层扩展

```
┌─────────────── 全球共享核心（一套）────────────────┐
│ Entity / Document / Assertion / Evidence / Event   │
│ 事件类型词表 · Domain · Line 内部键 · UIPS-Core     │
│ 三支柱信号引擎 · API/MCP · 方法论治理             │
└───────────────────────────────────────────────────┘
      │ 法域扩展包（Jurisdiction Pack，每个法域一个）
      ├─ sources（信源与适配器，含 reuse_class）
      ├─ line_mappings（官方险种口径 → 内部键）
      ├─ regulation types（法律层级、文号格式、生命周期规则）
      ├─ entity identifiers（统一社会信用代码 / NAIC / FRN / LEI…）
      ├─ UIPS L2 本地化字段（如 CN 重疾 2020 定义、惠民保城市年度）
      ├─ prompts 片段（术语、翻译保留规则，对应 AIHOT rules-domain.md）
      └─ compliance profile（展示限制、个人信息、名称规则）
```

**理由：**

- 实体（跨国集团、再保人）、商业模式（AI 保险公司多在海外）、监管扩散（IAIS → 各国）天然跨法域。分成两套系统会切断这些联系。
- 但产品、条款、监管层级、法律约束在各法域之间差异极大，必须通过扩展包隔离，不能硬塞进同一个 schema 字段。
- **跨法域比较只发生在"概念层"**（事件类型、商业模式分级、监管主题），**不做跨法域的产品评分比较**：条款结构、保险制度和货币都不可直接比较。

### 23.2 语言与时区

- 对外输出：**V1 为中文**，保留原文标题和原文链接；英文界面在 Phase 3 评估。AIHOT 的 `title_zh / summary_zh` 结构继续使用，内部增加 `locale` 维度，为多语言留好接口（F-04）。
- 时间一律存 UTC。日报窗口按"读者时区"（Asia/Shanghai）计算；监管生效日保留法域本地日期（`date` + `tz`），避免跨时区后日期漂移一天。
- 货币：存原币值 + 币种 + 期间，不做汇率换算后的比较；如需换算，只做展示，并注明汇率日期与来源。

### 23.3 法域优先级

| 阶段 | 法域 | 理由 |
|---|---|---|
| V1 | **中国**（深度）；**全球监管与 InsurTech 头部信号**（IAIS、EIOPA、FCA/PRA、SEC、OECD、Artemis 标题等） | 用户在中国；New Species 的案例多在海外；这些源有 RSS/API，可以低成本接入 [E§16] |
| Phase 2 | 中国香港、新加坡（MAS 需许可）、日本（FSA RSS、e-Gov API）、韩国（FISIS API） | 亚洲 AI 成熟度追踪有空白 [B§2.1] |
| Phase 3 | 美国州级（SERFF 需复测 ToS）、印度（IRDAI 人工）、巴西（OPIN API，schema 标杆） | 成本高或可达性差 |

---

## 24. Model Routing & Cost Strategy

### 24.1 能力分层

| 层 | 模型档位 | 任务 | 说明 |
|---|---|---|---|
| **R0** | 无模型 | 结构化源解析、去重、文号/docId 归组、Attention（Hot）、Change D1/D3/D5、Emergence D4、许可执行 | 目标：V1 中至少 40% 的一手信源条目完全不经过 LLM |
| **R1** | Flash/小模型（AIHOT 默认档：DeepSeek、GLM、Qwen、MiMo 的 flash 型号） | prefilter、分类、短摘要、实体歧义判定、BM 候选打标、双评分 | cheap-first；同一 prompt 跑两次，一致则通过（沿用 AIHOT 的双评分思想） |
| **R2** | 中档（带推理的 flash 或中型模型） | 断言抽取、事件归组关系判定、事件综述、日报 | 归组复核继承"换一家厂商" |
| **R3** | 强模型 | 监管文本实质变化摘要、条款级 UIPS 抽取的第二路与冲突裁决、BM 卡片草稿、月报与专题 | 只在升级条件触发时，或任务本身价值高时使用 |
| **H** | 人 | S 维度编码、BM 判级、争议裁决、实体低置信链接、更正工单 | 人工队列有 SLA |

### 24.2 升级（escalation）与降级

```
cheap 结果 ─┬─ schema 校验失败 ───────────────► 重试 1 次（同档）→ 仍失败 → 升一档
            ├─ 自一致性不一致（两次结果不同） ─► 升一档
            ├─ 置信度 < θ_task ────────────────► 升一档
            ├─ 原文回查失败（数值/日期找不到） ─► 丢弃断言 或 升一档
            └─ 高价值对象（T0 文本 diff、产品条款） ► 直接 R2/R3 + 抽检
R3 仍不一致或低置信 ─► 人工队列
```

θ 按任务设定，用评测集（§25）校准；每次升级都记录回执，在后台统计"升级率"。升级率异常升高是 prompt 或模型退化的信号。

### 24.3 成本控制（继承 + 新增）

- **复用机制，修正默认行为**：回执复用、请求计数和未知回执恢复机制可复用。上游 `config.ts` 的 MODEL_CALLS_ENABLED 缺省为 true，worker 的 COLLECT_ENABLED 未显式为 false 时开启；`receipts.ts` 缺预算行时直接放行。InsurHOT M0 必须改为显式启用、缺预算拒绝，并以无外部调用的测试证明，不能把操作说明当成已实现的安全默认值 [A§A13]。
- **新增**：
  1. **按 capability 及全局的月度金额硬上限**（`budgets.monthly_amount`，币种），达到 80% 告警；额度耗尽、预算缺失或价格未知时停止相应付费调用，转规则/缓存/人工队列，不能靠换成便宜模型继续突破同一上限。任何模型切换重新校验其独立已批准预算与全局余额。并发请求先预留最大费用，结算后释放差额；未知回执占用预留，不自动释放后重花。实时报价费用上限无法确定时不发送请求。
  2. **批处理**：非实时任务（周报、月报、历史回填、产品抽取）走供应商的 batch 接口或夜间窗口。
  3. **缓存**：继承回执；另外对文档解析结果做内容哈希缓存，同一 PDF 在多处转载时只解析一次。
  4. **prompt 缓存**：系统提示词固定在前、材料在后。AIHOT 已经利用"第二次评分复用供应商缓存"。
  5. **成本看板**：每条已发布资料的成本、每个断言的成本、各 capability 的单位成本趋势。
- **量级估算**（NEEDS VALIDATION，上线后以 `service_prices` 与回执实测为准）：AIHOT 首次导入的 152 条资料用了约 930 次模型调用，约 6 次/条（AIHOT `docs/deploy.md`「花多少钱」）。InsurHOT 的结构化源大部分走 R0，预计非结构化资讯每条 4–7 次 R1/R2 调用。按日均 300–800 条非结构化资料估算，约为每日 1,500–5,000 次 flash 级调用，另加少量 R3。

### 24.4 哪些任务真正需要强模型

只有四类：

1. 监管文本新旧版本的"实质变化"解释；
2. 条款级产品字段抽取的第二路与冲突裁决（Phase 2）；
3. BM 卡片草稿（人工判级前）；
4. 月报与专题长文。

其余任务都应在 R0–R2 完成；如果做不到，先改流程，不先换模型。

---

## 25. Evaluation Framework

### 25.1 评测集（离线；继承 SelectBench 的格式与流程并扩展）

| 评测集 | 标注单位 | 指标 | 最小规模（V1） | 用途 |
|---|---|---|---|---|
| SelectBench-Insur | 资料：select / reject / either（继承格式） | 准确率、查准率、查全率、阈值扫描；按 stratum（监管/处罚/公司/产品/营销）分层 | 300 条（dev 200 / holdout 100） | 阈值校准（F-08） |
| ClassifyBench | 资料 → domain / event_type / line / jurisdiction | macro-F1 | 300 条 | 分类 |
| EntityBench | 提及 → entity_id | 链接准确率、NIL 识别率 | 500 个提及 | 实体链接 |
| GroupBench | 报道对 → 四分类关系（继承 AIHOT 370 对标注的做法） | 合并查准与查全 | 400 对 | 事件归组 |
| AssertionBench | 断言 → 是否被引文支持、数值是否正确 | 支持率（faithfulness）、字段准确率 | 300 条断言 | 证据链 |
| ChangeBench | 文档版本对 → 是否实质变化 + 变化点 | 查准率（首要）、召回率 | 100 对 | Change 检测器 |
| EmergenceBench | 对象 → 扩散阶段（weak_signal / emerging / spreading / mainstream） | 阶段准确率；`weak_signal` 误升级率 | 100 个对象 | Emergence 阶段判定 |
| ProductExtractBench（Phase 2） | 条款 → UIPS 字段 | 字段级准确率（O 类目标 ≥ 98%）、κ（S 类） | 每险种 30 份条款 | Benchmark 数据质量 |
| BM 判级一致性 | 卡片 → L/A/E/D/N | 双人 κ、仲裁率 | 58 张冷启动卡 | New Species 方法可靠性 |

**规则：**

- dev 与 holdout 分开，prompt 调优只看 dev（继承 AIHOT 的建议）；
- 每次改 prompt、换模型或改阈值，都要在对应评测集上跑一遍，结果进入后台的对比视图；
- 标注者应当是目标读者，即保险从业者。

### 25.2 线上指标

| 类别 | 指标 |
|---|---|
| 覆盖 | P0 信源健康率；**发现延迟**（最早公开证据 → InsurHOT 发现的中位数）；NFRA 各栏目覆盖率 |
| 质量 | 更正率（每千条已发布内容）、争议断言占比、人工推翻率、实体链接人工修正率 |
| 三支柱 | Matters：编辑抽检"重要"视图的查准率；Changes：变化流抽检查准率；Emerges：**领先时间**（标为 `emerging` 的时间比进入 `mainstream` 或被主流专业媒体集中报道早多少） |
| 证据 | 已证实事实（fact_primary）的合法可回查 T0–T2 支撑覆盖率 = 100%；fact_reported / claim_self / inference_model / judgment_editorial / disputed 单独统计，不混入分母 |
| 成本 | 每条已发布资料的成本、升级率、预算触顶次数 |
| 使用 | 日活读者、日报打开率、API/MCP 调用数与独立客户端数、数据集下载数 |
| 独立性 | 利益冲突披露完整度；被评对象更正请求的处理时长与结果公开率 |

---

## 26. UI Information Architecture

### 26.1 一级导航（V1）

| 入口 | 内容 | 说明 |
|---|---|---|
| **今日**（首页） | 三栏：**重要**（Matters）/ **变化**（Changes）/ **新生**（Emerges，含新物种动态）+ 最新日报入口；关注度榜为辅助入口 | 首页回答 C0 的三个问题，不是"新闻"，也不是"热点" |
| **事件** | 全部事件；按 domain、法域、险种过滤；关注度榜（辅助） | 继承 AIHOT 的 /all、/hot、/story；对外标签用"关注度" |
| **监管** | 按法域；监管日历（征求意见截止 / 发布 / 生效）；监管对象页（生命周期 + diff + 执法） | 新增 |
| **机构** | 实体目录与实体页（时间线、关系、披露、处罚、AI 动作、关联新物种） | 替代 topics |
| **新物种** | New Species 登记簿（按 L/A 级、形态、法域）；商业模式卡；方法说明 | 新增 |
| **数据** | 官方统计序列（NFRA 月度等）、处罚数据集、下载 | 新增 |
| **报告** | 日报、周报、月报 | 继承 |
| **方法** | 信源与分级、评分和判级方法（含版本史）、更正记录、Non-goals 声明 | 新增，**是可信度的门面** |
| **开发者** | API、MCP、RSS、`llms.txt`、数据集 | 继承 /agent |

**V1 不设"产品"一级入口。** 产品事件出现在"事件"中（domain = product）；产品登记与版本 diff 在 Phase 2 上线，Benchmark 在法律意见之后上线。**"Market"与"Risk"不设一级入口**，它们是 domain 过滤项。**"Explore"并入搜索。**

### 26.2 页面级要求

- 每个事实旁边有证据标记：等级徽章（T0–T6）+ 认知状态 + 悬停显示原文短引用和链接。
- 每个评分旁边显示方法版本和"如何计算"的链接。
- 实体页展示"与该实体相关的更正记录"。
- 所有评价类页面底部有固定声明："研究性信息，不构成保险销售、推荐或投保建议；以保险合同条款为准。"

---

## 27. Security / Compliance / Copyright Risks

| # | 风险 | 等级 | 说明 | 缓解 |
|---|---|---|---|---|
| R1 | **中国：非保险机构比较保险产品、保费试算、提供产品咨询** | **高** | 《互联网保险业务监管办法》第二十三条、第十五条（四）[D§5.3] | V1 不发布面向中国公众的产品比较或评分；不做试算；不做问答式产品咨询；公开 Benchmark 之前取得持牌律所书面意见（ADR-011） |
| R2 | **中国：金融产品网络营销** | **高** | 《金融产品网络营销管理办法》2026-09-30 施行。第二、三条须连读：网络营销定义具有商业性宣传推介前提，不能仅因展示产品信息就断言独立研究必然属于营销。第十八条涉及名称资质；第十九条另有商标整体含义且不易误认的例外；第二十条涉及受托营销合作。具体适用仍待法律意见 [D§5.3] | 不接受保险机构委托或付费；不设投保跳转；内容为情报与研究，避免"推介"措辞；**owner 已冻结的中文定位语"保险行业高价值变化与趋势情报平台"含"保险"二字**：它作为定位描述使用时，以及作为网站、APP、账号名称或商标使用时，是否受第十八、十九条约束，**NEEDS VALIDATION（律师）**。在意见出具前，不把含"保险"的字样注册为网站、APP、账号名称或商标，但不改变 owner 的定位（见 Q2 与定位校准记录中的冲突 X-1）；"InsurHOT"英文名同样待律师意见 |
| R3 | 数据爬取不正当竞争 | 高 | 《反不正当竞争法》（2025 修订）第十三条：不得避开或破坏技术管理措施获取数据，罚款最高 500 万元 [E§14.1] | 采集规则第 2 条（§9.3）；中保协产品库只走授权或人工 |
| R4 | 中保协披露平台声明禁止下载、数据提取 | 高 | [B§2.8] | 授权谈判；替代路径是保险公司官网的法定公开披露（其可抓取性与再发布的合法性 NEEDS VALIDATION） |
| R5 | 著作权 | 中 | 媒体作品受保护；合理使用范围有限；欧盟 TDM 的 opt-out；日本 30-4 条不涵盖对外展示 [E§14] | `reuse_class` 由代码强制执行；媒体内容只存摘要、短引用和链接（继承 AIHOT 默认不展示全文） |
| R6 | 商业诋毁与名誉 | 中 | 对公司的负面结论（BM 失败标记、红旗、炒作标记） | 只基于证据的陈述 + 公开方法 + 事前核对与更正通道；措辞中立 |
| R7 | 广告法 | 中 | 禁用"最佳"等绝对化用语；引用数据须注明出处 [D§5.3] | C2.3；证据链天然满足"表明出处" |
| R8 | 个人信息 | 中 | 《个人信息保护法》第十三条、第二十七条；处罚公示中的个人 [E§14.1] | 个人信息最小化，对外默认隐去自然人；不做个人画像；跨境与外部模型传输另设发布前核准；去标识化不自动满足出境要求 |
| R9 | AI 生成内容标识与生成式 AI 服务 | 中 | 中国关于 AI 生成合成内容标识的规定（2025-09-01 起施行，NEEDS VALIDATION 适用范围）；若对公众提供生成式问答服务，可能涉及备案（NEEDS VALIDATION） | 对模型生成的摘要标注"AI 生成，以原文为准"；V1 不对公众开放自由问答 |
| R10 | 提示词注入与数据投毒 | 中 | 采集内容可能含指令；信源可能被操纵 | 继承 `safety.md`（所有材料都是不可信数据）；多源独立性计算；S 层不作证据 |
| R11 | 上游代码安全 | 低中 | F-10：api 的 `trustProxy: true` 依赖部署拓扑 | 部署清单明确 api 端口不对外；依赖升级与 SCA 扫描 |
| R12 | 被误认为投保建议 | 中 | 消费者误用 | 固定免责声明；不提供个性化功能；MCP 工具说明中写明限制 |
| R13 | 欧盟/英国分销边界 | 低（V1 无该市场的用户功能） | IDD 第二条、PERG 5.15 [D§5.4] | 不设投保通道；未来引入比较功能前取得当地法律意见 |
| R14 | 品牌与许可 | 低 | 不得使用 AIHOT 名称和 Logo | 迁移时统一替换（F-13）；保留 MIT 版权声明 |

---

## 28. Non-goals

| # | 不做 | 原因 |
|---|---|---|
| N1 | 单一保险公司的内部经营系统或管理工具 | 定位是行业公共情报 |
| N2 | 接入任何机构的内部经营数据、客户数据、个人信息 | C4 |
| N3 | 研究各保险公司的内部渠道经营、内部费用政策、内部客户或经营数据、销售组织 | C0.7；只研究公开的交易结构与公开监管规则 |
| N4 | 保险销售、导流、比价、保费试算、投保方案设计、产品咨询 | 法律（R1、R2）与独立性（C3） |
| N5 | 保险销售 CRM、营销获客系统、代理人工具 | 同上 |
| N6 | 伪装成投保建议；个性化"最适合你"推荐 | 同上 |
| N7 | 没有依据的"最佳保险排行榜"、单一总分总榜 | C2 |
| N8 | 把 LLM 输出当事实；无证据的结论 | C1 |
| N9 | 为 AI 而 AI；为知识图谱而知识图谱 | C7 |
| N10 | 接受被评对象付费、徽标授权、广告位、付费排序 | C3 |
| N11 | 绕过任何技术措施采集数据；采集 robots 或 ToS 禁止的来源 | R3 |
| N12 | 社交舆情监控平台、KOL 分析 | 与证据优先相悖；来源不合规 |
| N13 | 公司信用评级或偿付能力评级（替代 AM Best/S&P） | 只链接评级事实，不自评 |
| N14 | 投资建议、股票推荐 | 实体与商业模式信息不构成投资建议 |
| N15 | 与付费监管合规产品（CUBE、NILS、Axco）正面竞争深度合规服务 | 只做公开的监管事件流 |
| N16 | 自由形式的公众 AI 问答（V1） | R9、R12 |
| N17 | 保险热点站或新闻聚合站；以热度为产品目标 | C0.1、C0.3：HOT = High-value Observed Trends；热度只作辅助信号 |

---

## 29. Competitor / Adjacent Product Analysis

完整清单约 87 项，见 [附录 B](research/competitors.md)；产品评级方法对比见 [附录 D §1](research/benchmark.md)。

### 29.1 已经有人解决得较好的问题

| 问题 | 代表 | InsurHOT 的态度 |
|---|---|---|
| 英文圈的新闻时效与覆盖 | Insurance Journal、Reinsurance News、Artemis、The Insurer、Insurance Insider | 作为线索源（遵守 ToS/opt-out），不竞争 |
| 融资与创投统计 | Gallagher Re（Q2 2026：24.4 亿美元，AI 类占 99.1%）、CB Insights、Tracxn、Sønr | 作为输入信号，不竞争 |
| 宏观统计 | Swiss Re sigma、OECD、IAIS GIMAR、NFRA 月度数据 | 接入与再组织 |
| 单一法域的产品评级 | Defaqto、Canstar、Franke und Bornberg、10Life、深蓝保 | 学习方法，差异化为"公开 + 可复现 + 不收佣" |
| 美国监管文件的 AI 分析（付费） | S&P（SERFF 数据集）、ZestyAI（200 万份以上文件，可追溯引用） | 验证了"一手文件 + AI 结构化 + 引用"有付费需求；InsurHOT 做中国与多法域的公开层 |
| 跨法域合规情报（付费） | CUBE、Wolters Kluwer NILS、Axco | 不竞争（N15） |
| AI 成熟度指数 | Evident AI Index（北美和欧洲 30 家，外部视角） | 补地域空白 |

### 29.2 仍没有被很好解决的问题

1. **论断级证据链**：媒体只输出文章，最多附原文链接；公开产品中几乎没有"论断 → 一手文件定位 → 快照"的链接 [B§3.2]。
2. **"数据 + 代码 + 版本 + 变更日志"四件套全部公开的产品基准**：最透明的 F&B、Canstar、10Life 也只公开方法文档 [B§2.6]。
3. **商业模式结构追踪**：创投库按赛道和融资阶段分类；Artemis 只在 ILS 细分做到了结构化 [B§2.2]。
4. **公开的结构性变化检测**：美国靠付费产品；中国产品库禁止提取 [B§3.2]。
5. **Agent 可用、带出处的保险数据**：GitHub 上的保险 MCP 都很小，且是厂商或单一数据源 [B§3.2]。
6. **中国和亚洲保险公司的 AI 成熟度追踪**：本轮检索样本中未确认同类公开、可复现产品；不能据此断言市场完全空白 [B§2.1]。

### 29.3 InsurHOT 可以形成的独特资产（按可行性 × 差异性排序）

1. **Evidence Graph**：事件 → 断言 → 一手文件，带快照和哈希（Phase 1）。
2. **中国监管与处罚的结构化数据集**：NFRA 7 万余条处罚、统计序列、监管生命周期（Phase 1）。
3. **New Species 登记簿与商业模式判定方法**（Phase 1）。
4. **中国和亚洲 AI 成熟度外部视角追踪**：借鉴 Evident 的支柱结构，但逐项公开证据、按季度更新（Phase 2）。
5. **开放产品 Schema + 可复现基准卡**（Phase 2，公开发布取决于法律意见）。
6. **保险机构主数据**：欧盟复用 EIOPA 注册库本体，中国自建（Phase 1 起持续）。
7. **带出处的 MCP/API**：基于 AIHOT 原生能力扩展（Phase 1）。

### 29.4 需要警惕的同类

`finhot` 已经基于 AIHOT 做出了金融/保险方向的资讯站（MIT，S0–S3 信源分层）[B§2.14]。**这证明聚合层没有壁垒**。InsurHOT 如果只做到资讯层，就会与它同质化。

---

## 30. Technical Debt / Migration Risks

| # | 风险 | 影响 | 缓解 |
|---|---|---|---|
| M1 | 上游是快照，不保证同步，Issue 创建受限（F-09） | 上游修复难以获取；长期分叉 | 视为一次性基线；`UPSTREAM.md` 记录基线 commit 与已移植的上游补丁；每季度人工 diff 一次上游 |
| M2 | 技术栈较新（Node 24.11+、TypeScript 7、React Router、pg-boss） | 生态兼容与招聘 | 锁定版本；CI 固定镜像；不追新 |
| M3 | 品牌与包名残留（`@aihot/*`、`aihot` 库名、`raw._aihot`）（F-13） | 许可要求与可维护性 | M0 阶段一次性重命名；增加检查脚本，禁止对外出现 AIHOT 字样 |
| M4 | 测试用例绑定 AI 示例分类（`AGENTS.md` 已提示） | 改 taxonomy 后测试失败 | 与 taxonomy 替换同一个 PR 完成 |
| M5 | 单一 category、自由文本 fact（F-03、F-05） | 领域层需要扩表 | 只做增量迁移；旧字段保留，新 facet 列并行，逐步切换读取 |
| M6 | 硬编码的 Asia/Shanghai 与中文输出（F-04） | 多法域与多语言 | V1 不改行为，只在新表中引入 `tz` 与 `locale`；Phase 3 再改读层 |
| M7 | 没有 PDF 与文档层（F-01、F-12） | 最大的新增工程量 | 独立 parser 服务；先覆盖 NFRA 的 .doc/.pdf/.wps 与公司披露 PDF |
| M8 | 归组串行与内存向量（F-14） | 规模上限 | 按法域分队列；达到阈值后迁移 pgvector |
| M9 | 精选与热度阈值不可直接沿用（F-07、F-08） | 上线初期质量差 | 上线前先建金标集；上线前 2 周"影子运行"，不公开 |
| M10 | NFRA JSON 接口没有公开文档 | 接口变更导致断流 | 适配器配合契约测试 + 健康告警；保留 HTML 兜底解析；低频礼貌抓取 |
| M11 | 公司披露栏目格式不一（约 45 家逐家适配） | 维护成本 | 适配器配置化（沿用 `web_list` 的选择器模式）；按信源健康周报排序维护 |
| M12 | 新旧模型切换导致判断漂移 | 历史不可比 | 继承"只影响新任务、不重算历史"；需要可比时显式重放并标注方法版本 |
| M13 | 人工工作量（BM 判级、S 维度编码、实体审核） | 规模瓶颈；深蓝保用了 150 余人做结构化 [B§2.7] | 窄品类、深结构；人工只做模型做不了且价值最高的部分；把标注产出沉淀为评测集 |

---

## 31. MVP Definition

### 31.1 MVP 目标

> 证明 InsurHOT 是"高价值变化与趋势情报平台"，不是保险热点站或新闻站。MVP 要对 C0 的三个问题各给出一个可用的最小答案，并且都以证据为先：
>
> - **What matters?**：重要性评分（Importance）经保险金标集校准，"重要"视图与日报的重要事件节可用；
> - **What is changing?**：中国监管变化被系统、及时地捕获并解释（Change v0）；
> - **What is emerging?**：AI 保险商业模式有一套可审计的判定方法和可用的登记簿，新事物有扩散阶段标注（Emergence v0 + New Species v0）。
>
> 每个对外"事实"都能点到一手原文；三类结果都能被 Agent 调用。Product Benchmark 在 MVP 中先完成"标准"（C0.5）。

### 31.2 范围

| 模块 | MVP 内容 | 不在 MVP |
|---|---|---|
| M0 基线 | 固定完整上游 SHA、保留 LICENSE/NOTICE；显式关闭采集/模型/推送；修复缺预算放行；离线 CI 通过。基线、安全修正、品牌及模块删除分提交验证，见 delivery-gates.md | 追上游 |
| M1 信源与文档层 | 信源模型 2.0（evidence_tier + 六维度 + reuse_class）；P0 信源约 20 项 [E§16]；documents / versions / passages；PDF/.doc/.wps 解析；原件对象存储 | 中保协产品库批量（需授权）；社交与搜索指数 |
| M2 实体注册表 | 中国持牌保险机构与主要中介、监管机构（含派出机构层级）、全球头部约 200 家保险/再保/InsurTech；别名与外部标识；实体页 | 人物实体的全面覆盖 |
| M3 保险化精选 = Importance v0（Matters） | taxonomy（§8）、prompts 改写为重要性评分（§19.3）、SelectBench-Insur 300 条金标与阈值校准；GroupBench 400 对；"重要"视图 | —— |
| M4 证据层 | 断言抽取（结构化源规则化 + 一般资讯 R1/R2）；原文回查；认知状态；事件页证据展示 | 冲突自动裁决 |
| M5 监管追踪与 Change v0（Changes）+ Emergence v0（Emerges） | Regulation 对象与生命周期；D1、D2（文本 diff + 解释）、D3、D5（NFRA 统计）；D4 首次出现与扩散阶段标注（§18.4）；变化流、新生视图与监管日历；**首个样板：2026《银行保险机构信息披露管理办法》从征求意见到正式稿** | D6、D7（产品） |
| M6 New Species v0（Emerges，最高优先级研究方向之一） | BM Card schema；编辑手册（14 变量、L/A/E/D/N、炒作清单）；58 个案例导入，一手复核后上线 ≥20 张 `listed` 卡；双人 κ | 自动判级 |
| M7 对外出口 | 继承 API/RSS/MCP；新增 matters、changes、emerging、events、entities、regulations、species、evidence 等资源与对应 MCP 工具；`llms.txt`；NFRA 处罚数据集 v1 | Benchmark API |
| M8 Benchmark 地基（内部） | UIPS-Core + 医疗险 L2 schema；编码手册 v0；方法论 RFC v0（公开征求意见）；内部原型（窄品类，不公开分数）；**委托律所出具书面意见** | 面向中国公众的分数与比较 |
| M9 合规与治理 | Non-goals 与方法页；更正通道；许可执行；个人信息最小化；免责声明 | —— |

### 31.3 MVP 验收指标（上线后 30 天）

| 指标 | 目标 |
|---|---|
| NFRA P0 栏目覆盖率 | 100%（发布 24 小时内入库） |
| 已证实事实（fact_primary）的合法可回查 T0–T2 支撑覆盖率 | 100%；无合格支撑时不得发布为 fact_primary |
| 断言原文回查通过率 | ≥ 97%（抽检 200 条） |
| SelectBench-Insur（holdout） | 查准率 ≥ 0.85，查全率 ≥ 0.75（初始目标，校准后修订） |
| 实体链接准确率（EntityBench） | ≥ 0.95 |
| "重要"视图编辑抽检查准率（Matters） | ≥ 0.85 |
| Change（D1–D3、D5）抽检查准率（Changes） | ≥ 0.9 |
| Emergence 阶段判定准确率（EmergenceBench）；`weak_signal` 误升级率 | ≥ 0.85；≤ 5% |
| New Species `listed` 卡 | ≥ 20 张，双人判级 κ ≥ 0.6 |
| 更正率 | < 5‰ |
| 模型成本 | 在预算上限内；R0 条目占比 ≥ 40% |
| Agent 接口 | MCP 与 API 有外部独立客户端调用（数量作为观察指标，不设目标） |

---

## 32. Phase 1 / Phase 2 / Phase 3 Roadmap

时间是计划假设，按小团队（2–3 名工程师 + 1–2 名保险研究编辑）估算，NEEDS VALIDATION。

### Phase 1（0–3 个月）：Evidence-first 情报内核 = MVP

| 周 | 里程碑 |
|---|---|
| W1–2 | M0 基线导入与重命名；ADR-001 到 ADR-006 定稿；律所委托（R1/R2/名称） |
| W2–5 | M1 信源与文档层；NFRA 适配器（JSON 接口 + 附件解析）；约 45 家公司披露适配器的首批 15 家 |
| W3–6 | M2 实体注册表；M3 taxonomy/prompts；**金标标注与校准（与开发并行）** |
| W5–9 | M4 证据层；M5 监管追踪与 Change v0 |
| W6–10 | M6 New Species（复核 58 个案例）；M8 UIPS 与方法论 RFC |
| W9–11 | M7 对外出口；数据集 v1 |
| W11–12 | 影子运行 2 周（不公开）→ 质量门槛达标 → 公开上线 |

### Phase 2（3–9 个月）：产品层与亚洲

- **Product Registry**：产品身份、版本、字段级 diff（D6，Changes）；同类跟随（D7，Emerges）；产品关注度（Product Hot，辅助，§14）。
- **Benchmark**：在拿到法律意见的前提下，决定公开形态：（a）全面公开分数卡；（b）只公开方法与事实，不公开分数；（c）只做 B2B 研究；并决定是否先用开放数据集（CMS PUF 或 OPIN）做可复现演示。
- **AI 成熟度追踪（中国与亚洲）**：外部视角，指标逐项带证据，按季度更新。
- **法域扩展**：中国香港、新加坡（需许可）、日本、韩国。
- **Change 模型辅助**：解释生成、跨法域监管扩散（IAIS → 各国）。
- **pgvector**：视规模迁移。

### Phase 3（9–18 个月）：数据资产化与开放

- Benchmark 覆盖多险种（视 Phase 2 的结论）。
- 美国州级（SERFF 复测后）、印度、巴西 OPIN 映射。
- 数据集定期发布（Parquet/JSON-LD）；评估是否 graph 化（§11.4 的触发条件）。
- 英文界面评估。
- 可持续性：研究订阅、API 高配额、数据集授权（须符合 C3，并登记 ADR）。

---

## 33. Open Questions

以下为既有提议排期；不是 owner 已批准的人员、预算或供应商委托。实施依赖、阻断状态和验收条件以 [交付门槛](delivery-gates.md) 与项目台账为准。

| # | 问题 | 由谁决定 | 截止 |
|---|---|---|---|
| Q1 | 在中国发布"产品事实卡、版本 diff、被占优标记、分数卡"，分别是否构成"比较保险产品 / 网络营销 / 咨询"？ | 持牌律所书面意见 | Phase 1 结束前 |
| Q2 | 品牌合规：owner 已冻结的中文定位语"保险行业高价值变化与趋势情报平台"，以及"InsurHOT"，作为定位描述使用和作为网站、APP、账号名称或商标使用时，是否受《金融产品网络营销管理办法》第十八、十九条约束？（不重新讨论定位本身，只确定合规的使用方式） | 律所 → owner | W2 |
| Q3 | 运营主体性质（公司、研究机构、非营利）与资金来源，如何满足 C3？ | 创始人 | Phase 1 |
| Q4 | 中保协产品库与信息披露平台的数据授权是否可能？条件是什么？ | 商务对接 | Phase 2 前 |
| Q5 | 保险公司官网法定公开披露的条款，能否机器抓取并用于分析和短引用展示？ | 律所 | Phase 2 前 |
| Q6 | V1 编辑团队规模与资质（BM 判级、S 维度编码需要保险专业背景） | 创始人 | W4 |
| Q7 | 部署地域：境内节点（访问 NFRA、ICP 备案）+ 境外节点（访问 FCA、EIOPA 等）的拓扑与数据出境安排 | 技术 + 律所 | W3 |
| Q8 | 是否对公众开放 AI 问答（生成式服务备案、咨询禁区） | 律所 + 产品 | Phase 2 |
| Q9 | 数据集的许可（InsurHOT 自产数据用 CC BY 4.0？如何处理源数据的许可叠加？） | 律所 | Phase 1 数据集发布前 |
| Q10 | 首个 Benchmark 险种选"百万医疗/中端医疗"（监管关键信息清单完整）还是"定期寿险"（有示范条款、结构简单）？ | 产品 + 研究 | Phase 2 开始 |
| Q11 | NFRA JSON 接口的使用边界（没有 robots、没有文档）：是否需要事先沟通？ | 技术 + 法务 | W2 |
| Q13 | 技术标识符是否统一改名：`Hot Score`、`hot-topics`、`insurhot_get_hot` 继承自 AIHOT 和 owner 的原始任务。对外标签已改为"关注度"；是否把 API、MCP 标识也改为 `attention`，以彻底避免与品牌 HOT 混淆？ | owner + 技术 | M7 前 |
| Q14 | Emergence 阶段阈值（N₁、N₂、观察窗口）与"主流专业媒体集中报道"的判定口径 | 研究编辑 | Phase 1 影子运行前 |
| Q12 | 《保险公司信息披露管理办法》（2018）文号、偿二代第 13 号规则原文等 NEEDS VALIDATION 项 [E§17] | 研究编辑 | W4 |

---

## 34. ADR 建议清单

| ADR | 标题 | 建议结论 | 状态 |
|---|---|---|---|
| ADR-000 | Product Constitution 与修宪流程 | 采纳 §3；修改须经 ADR | Proposed |
| ADR-001 | 以 AIHOT `589f79e` 为一次性基线导入，而非 GitHub fork 或重写 | 导入（保留 MIT 声明与 NOTICE），`UPSTREAM.md` 追踪 | Proposed |
| ADR-002 | 移除 leaderboard 与 Codex monitor 代码 | 删除代码；治理范式写入 ADR-013 | Proposed |
| ADR-003 | 重命名与品牌清理 | `@insurhot/*`；检查脚本禁止对外出现 AIHOT | Proposed |
| ADR-004 | Evidence 数据模型（Document / Passage / Assertion / Evidence） | §20 | Proposed |
| ADR-005 | Source Model 2.0（evidence_tier + 六维度 + reuse_class） | §9 | Proposed |
| ADR-006 | Taxonomy：多 facet 替代单一 category；分类键上线后不可改 | §8 | Proposed |
| ADR-007 | Entity Registry 入库，取代代码字典与身份正则 | §11 | Proposed |
| ADR-008 | 原件对象存储（内容寻址、不可变） | §21 | Proposed |
| ADR-009 | 不引入图数据库；graph 化的触发条件 | §11.4 | Proposed |
| ADR-010 | 中国 + 全球：一个核心 + 法域扩展包 | §23 | Proposed |
| ADR-011 | Benchmark 公开发布须以律所书面意见为前提 | §13.9 | Proposed |
| ADR-012 | Benchmark 形态：多维分数卡 + Profile 综合分 + 门槛 + 可比集合 + 被占优 | §13 | Proposed |
| ADR-013 | 方法论版本化与公开规则页（继承模型榜治理范式） | §13.7 | Proposed |
| ADR-014 | 四信号分离：Importance / Change / Emergence 为主，Attention（Hot）为辅；Change v0 以规则为主；Emergence 扩散阶段模型 | §18 | Proposed |
| ADR-015 | 模型路由 R0–R3 + H；升级条件；月度金额预算 | §24 | Proposed |
| ADR-016 | BM 判级只由人完成；L/A/E/D/N 与判级规则 | §16 | Proposed |
| ADR-017 | API 版本策略（v1 兼容 + 新资源）与 evidence[] 契约 | §22 | Proposed |
| ADR-018 | 采集合规：robots/TDM opt-out、不绕过技术措施、礼貌限速 | §9.3 | Proposed |
| ADR-019 | 个人信息最小化与数据出境 | §27 R8 | Proposed |
| ADR-020 | 独立性与收入来源白名单 | §3 C3 | Proposed |
| ADR-021 | 评测集与上线门槛（影子运行） | §25、§31.3 | Proposed |
| ADR-022 | pgvector 引入阈值 | §21.1 | Proposed |
| ADR-023 | 品牌与使命：InsurHOT = Insurance High-value Observed Trends；Matters / Changes / Emerges；C0 由 owner 冻结 | §2、§3 C0 | **Accepted（owner 确认）** |

---

## 35. 最终推荐目标架构

```
                         ┌────────────────────────── 采集层（Ingest） ──────────────────────────┐
  T0/T1 监管  ──JSON/RSS─►│ sources 2.0（tier·independence·reuse_class·jurisdiction）           │
  T2 公司披露 ──HTML/PDF─►│ collectors（继承 rss/web_list/json_list/mp/external + 专用适配器）   │
  T4 国际组织 ──API/SDMX─►│ upsertMaterial（唯一入口，继承）      fetch → snapshot → object store │
  T5 媒体     ──RSS──────►│ robots/TDM/ToS 执行 · 限速 · 安全阀                                   │
  S  信号     ──API──────►│ （participation_mode = hot_signal，不作证据）                          │
                         └───────────────┬─────────────────────────────────────────────────────┘
                                         ▼
                         ┌──────────── 文档与证据层（New）────────────┐
                         │ documents · versions(sha256) · passages    │
                         │ parser worker（PDF/DOC/WPS/表格/OCR）      │
                         │ assertions · assertion_evidence · 原文回查 │
                         └───────┬──────────────────────┬────────────┘
                                 ▼                      ▼
        ┌──────── 编辑流水线（继承 + 改造）─────┐   ┌──────── 领域层（New）────────────────────────┐
        │ prefilter → classify(facets)          │   │ Entity Registry（机构/监管/险种/法域/人物）   │
        │ → 双评分精选（保险版五轴，金标校准）  │   │ Regulatory Tracker（生命周期/版本/diff）      │
        │ → 写作（防幻觉 + 认知状态）           │   │ Product Registry & Versions（Phase 2）        │
        │ → 事件归组（身份键 + 向量 + 四分类    │   │ Benchmark Engine（方法版本/Profile/分数卡，   │
        │   + 跨厂商复核 + 人工覆盖）           │   │   法律意见后公开）                            │
        └──────────────┬────────────────────────┘   │ New Species（BM 卡/L·A·E·D·N/人工判级）      │
                       ▼                            └──────────────┬───────────────────────────────┘
        ┌──────── 评分与检测（确定性为主）──────────────────────────▼──────┐
        │ Importance（Matters）· Change（Changes）· Emergence（Emerges）      │
        │ Attention（Hot，辅助，独立参与者衰减，重新校准）                   │
        │ 所有评分：rule/method_version + evidence                          │
        └──────────────────────────────┬─────────────────────────────────────┘
                                       ▼
        ┌──────────── 单一公开读取层 publication/（继承不变量）────────────┐
        │ reuse_class 强制执行 · 只读已复核/规则断言 · 认知状态标注          │
        └───────┬──────────┬───────────┬──────────┬──────────┬───────────┘
                ▼          ▼           ▼          ▼          ▼
             Web SSR     RSS      REST API     MCP     llms.txt / 数据集
            （今日/事件/监管/机构/新物种/数据/报告/方法/开发者）

  横切：receipts + budgets（请求数 + 月度金额）· 模型路由 R0–R3 + H · 审计日志 · 更正工单
       · 评测集（Select/Classify/Entity/Group/Assertion/Change/ProductExtract/BM κ）· 影子运行
  部署：PostgreSQL 17（+pgvector 视阈值）· S3 兼容对象存储 · pg-boss · api/worker/web/parser
       · 境内节点（中国信源）+ 境外节点（国际信源），数据出境按 ADR-019
```

**与 AIHOT 的关系一句话**：资讯层与工程底座完整继承（Inherit/Adapt）；删除 AI 专属模块（Remove）；分类与结构抽取替换（Replace）；在旁边新增文档与证据层、实体层、领域层和变化检测（New）。**这不是"改成保险版的 AIHOT"，而是"以 AIHOT 为资讯引擎的证据型行业情报基础设施"。**

---

## 36. 十个决策问题的回答

> v0.2 校准说明：D3、D8、D10 按 C0 做了措辞校准。D8 的结论从"Change 主轴、Hot 次轴"调整为"三支柱为主、Hot 辅助"。其余决策的结论不变。

### D1. InsurHOT 应该继承 AIHOT 到什么程度？

- **Decision**：**继承工程底座与资讯流水线的全部机制**，按行数估算约为 AIHOT TS 代码的 80%（删除部分约 18%，即模型榜与 Codex 监控），包括采集、判重、回执与预算、精选机制、事件归组、热度机制、成刊、公开读取层、RSS/API/MCP、后台、SelectBench、CI。**替换**分类体系与结构抽取；**改造** prompt、阈值、热度参数；**删除** leaderboard 和 monitor；**新增**文档与证据层、实体层、领域层、Change。
- **Evidence**：
  - `industry/` 行业包把行业差异集中在一个文件夹 [A§A1]；
  - 七条不变量与 InsurHOT 宪法一致 [A§A2]；
  - 缺口集中在领域建模，而不是基础设施 [A§A11]；
  - AIHOT 的工程细节来自真实迭代，例如"是/否问法在 370 对样本上拒绝了一半真合并"的实测注释 [A§A4]。
- **Reasoning**：InsurHOT 的差异化在数据与方法层，不在流水线层。重写流水线，是在没有壁垒的地方投入最多的时间 [B§2.14]。
- **Strongest Counterargument**：AIHOT 以 article 为中心，InsurHOT 以 evidence 和 entity 为中心。在不匹配的中心上扩展，可能形成两套平行模型，长期技术债更重。
- **Failure Condition**：如果 M4（证据层）实施中发现 `articles/publications` 与 `documents/assertions` 之间的同步成本超过新增代码量的 50%，或者公开读取层必须大面积重写，就回到这个决策，考虑以证据层为中心重构读层。
- **Confidence**：**高（0.8）**

### D2. 是否 fork，还是重新建仓后迁移核心能力？

- **Decision**：**在本仓库（InsurHOT）一次性导入 AIHOT `589f79e` 的完整代码作为基线**（保留 LICENSE、NOTICE 与版权声明，在 `UPSTREAM.md` 记录基线 commit）。**不做 GitHub fork**，不追上游；**也不"重新建仓再挑着搬"**。
- **Evidence**：
  - 上游是快照，作者声明不保证同步，Issue 创建受限 [A 头部][A§A11 F-09]；
  - 许可要求不使用 AIHOT 名称和 Logo（F-13）；
  - 代码的内部耦合（contracts、backend、industry 三者相互引用）使"挑着搬"极易漏掉不变量，例如回执、预算、发布门等。
- **Reasoning**：GitHub fork 的主要价值是同步上游和回馈上游，这里两者都不成立，反而带来品牌混淆。"挑着搬"会丢失 AIHOT 的测试与 CI 所守护的行为。整仓导入后再做删改，每一步都有测试兜底。
- **Strongest Counterargument**：整仓导入会带进大量暂时用不到的代码（OG 海报、图片代理、飞书），增加认知负担；上游如果后来积极维护，失去 fork 关系会使同步更难。
- **Failure Condition**：如果上游在 6 个月内出现 ≥3 个 InsurHOT 需要的重要修复，且人工移植成本明显，就考虑建立 upstream remote 做定期合并。如果 M0 删减后仍有 >30% 的代码三个月内无人触达，就进一步裁剪。
- **Confidence**：**中高（0.75）**

### D3. Product Benchmark 是否应该进入 MVP？

- **Decision**：**部分进入**。方法论 RFC、UIPS-Core + 医疗险 L2 schema、编码手册、内部原型、产品事件（资讯事实）进入 MVP；**面向中国公众发布的产品评分和比较不进 MVP**，以律所书面意见为前提，放在 Phase 2 决定（ADR-011）。
  - C0.5 确认 Product Benchmark 是重要能力，且必须"先标准、后评价"。本决策正是按这个顺序安排的：标准层（方法、schema、编码手册）在 MVP 完成，评分层在其后。
  - 公开评分在中国面临的法律限制，属于**执行约束**，不是定位冲突；已作为 X-2 报告给 owner。
- **Evidence**：
  - 《互联网保险业务监管办法》第二十三条禁止非保险机构"比较保险产品、保费试算、报价比价"，第十五条禁止"片面比较……简单排名"；
  - 《金融产品网络营销管理办法》2026-09-30 施行，第二条、第十八条、第二十条 [D§5.3]；
  - 中保协产品库禁止数据提取 [B§2.8]；
  - 深蓝保动用 150 余人做结构化，说明成本高 [B§2.7]。
- **Reasoning**：Benchmark 是长期最有差异化的能力，但它的前置依赖（证据层、实体层、条款抽取准确率）和法律边界都还没准备好。先把地基和方法打牢，是"先研究、再建模、再实施"在产品层面的体现。
- **Strongest Counterargument**：没有可见的 Benchmark，InsurHOT 在用户眼里就是"又一个保险资讯站"，MVP 的差异化会被低估。而且法律意见可能长期拿不到，拖延会让 Benchmark 永远不上线。
- **Failure Condition**：如果 Phase 1 结束时律所意见认为"事实卡 + 版本 diff"不构成比较或营销，而团队仍未推进公开，这个决策就变成了拖延，应立即上线事实层。如果意见不支持拟定比较形态，B2B 研究或开放数据演示也须单独审查；不能作为自动合法的替代通道，必要时只做内部方法研究。
- **Confidence**：**高（0.8）**

### D4. Benchmark 应采用总分还是多维评分？

- **Decision**：**多维分数卡为默认**；综合分只在**公开命名的 Profile** 下出现；**门槛红旗先于加权**；**只在可比集合内比较**；输出**被占优检测**；排序不稳定时只显示分档。
- **Evidence**：
  - Defaqto 只评条款，Canstar 按画像加权，Which? 分开保单分与客户分并加门槛 [D§1.1]；
  - FCA、EIOPA 都拒绝单一分数 [D§0]；
  - Moneyfacts 约 39% 的产品为五星，说明星级严重通胀 [D§1.2]；
  - Bhargava 等人的研究显示多数人会选择"被占优"方案 [D§2.2]；
  - 中国《广告法》与《互联网保险业务监管办法》禁止"最佳"式表述和"简单排名"。
- **Reasoning**：保险产品的质量是"产品 × 人群 × 场景"的函数，单一分数必然掩盖结构差异，还会诱导产品方针对评分优化。被占优检测是唯一"不依赖权重"又对决策有用的输出。
- **Strongest Counterargument**：多维分数卡认知负担高，大众用户和媒体仍然会自己"加总"或截图断章取义；没有总分，传播力弱。
- **Failure Condition**：如果可用性测试显示目标用户（从业者、研究者）无法用分数卡完成"找出结构差异"的任务，就改进呈现方式（例如差异高亮），而不是加回总分。如果外部媒体普遍把 Profile 综合分当作总榜传播，就收紧 Profile 分的展示。
- **Confidence**：**高（0.85）**

### D5. AI Business Model Radar 是否应进入 MVP？

- **Decision**：**进入**，形式是 New Species 登记簿 v0：人工判级，至少 20 张 `listed` 卡，公开编辑手册与判级规则。模型只负责找候选和起草卡片。
- **Evidence**：
  - 附录 C 已经完成 58 个案例的初步编码和证据收集，冷启动成本低；
  - 现有学术和监管框架都没有可操作的判定标准 [C§1]；
  - 创投库不按商业模式结构分类 [B§3.2]；
  - 对非产品主体做商业模式分析，不涉及产品比较禁区，法律风险低。
- **Reasoning**：这是 InsurHOT 最容易建立"方法公信力"的地方：全球可比，证据公开，结论可争辩。它和 Change、Evidence 相互强化，也最能体现"不是新闻站"。
- **Strongest Counterargument**：判级依赖少数专家的判断，κ 可能偏低；案例更新慢，形成"静态名录"；对公司的负面标记（炒作、失败）存在商业诋毁风险。
- **Failure Condition**：如果双人判级 κ < 0.5，说明方法不可操作，需要先修订手册再公开。如果 3 个月内 `listed` 卡的更新率（有新证据并复核的卡片比例）< 30%，说明维护成本不可持续，应缩小范围。如果收到有依据的诋毁投诉，就触发措辞审查。
- **Confidence**：**中高（0.75）**

### D6. Knowledge Graph 什么时候建设？

- **Decision**：**知识图谱的"数据形态"从第一天开始建**：实体、带证据和有效期的关系、事件与实体的角色、事件之间的关系，全部放在 PostgreSQL 关系表里。**图数据库不在 V1 与 Phase 2**；Phase 3 按 §11.4 的触发条件评估，满足两条才引入。
- **Evidence**：
  - V1 的核心查询（实体时间线、监管链、公司的 fronting 与资本方）都可以用 1–2 跳 JOIN 或递归 CTE 完成；
  - 现有开源保险 KG 基本是小型 demo [B§0]；
  - EIOPA 注册库本体可以在需要时以 RDF 复用 [B§2.15]。
- **Reasoning**：知识图谱的价值来自"带证据的实体与关系数据"，而不是存储引擎。先把消歧和证据做对；过早引入图数据库只会多一套一致性问题（C7）。
- **Strongest Counterargument**：风险承担网络（再保、fronting、资本方、MGA、产品）天然是图，后期迁移的成本高于早期设计；图可视化和图算法也是有吸引力的产品能力。
- **Failure Condition**：如果某个已确定的产品功能需要 ≥3 跳查询，且 P95 > 1s，或者外部合作方明确需要 SPARQL/RDF 接口，就提前启动评估。
- **Confidence**：**高（0.8）**

### D7. 中国和全球数据应该一个体系还是分层体系？

- **Decision**：**一个核心 + 法域扩展包的分层体系**（§23）。核心模型全球统一；信源、险种映射、监管层级、实体标识、L2 字段、prompt 术语、合规配置按法域扩展。**跨法域比较只在概念层进行，不做跨法域产品评分。**
- **Evidence**：
  - 各国的产品库、监管结构和法律约束差异很大 [E§12][E§14]；
  - 商业模式和再保资本天然跨国 [C§3]；
  - OPIN 与 IPID 的字段可以在概念层对齐 [D§3.3]。
- **Reasoning**：两套系统会切断跨国实体和商业模式的联系，产生重复建设；一套"扁平"系统又会把中国的条款结构硬塞进美国字段。扩展包在两者之间取得平衡。
- **Strongest Counterargument**：中国的合规要求（数据出境、ICP、个人信息）可能迫使境内外物理隔离部署，这时"一个核心"在运维上就等于两套。
- **Failure Condition**：如果律所意见要求境内数据不得出境，而国际信源又必须在境外采集，就改为"两地部署 + 单向同步（境外 → 境内）+ 共享代码与 schema"。这是部署层面的分离，不是模型层面的分离。
- **Confidence**：**中高（0.75）**

### D8. Hot Score 与 Change Score 是否都值得建设？

- **Decision**：**都建，但 Hot 只作辅助（按 C0 校准）**。
  - 首页和日报的主轴是三支柱：Importance（Matters）、Change（Changes）、Emergence（Emerges）。
  - Change v0 以规则为主，覆盖 D1–D3、D5；Emergence v0 覆盖 D4 与扩散阶段。
  - Hot 是辅助的关注度信号：继承 AIHOT 的机制并重新校准，对外称"关注度"。
  - 这些信号互不替代，也都不进入 Benchmark。
- **Evidence**：
  - AIHOT 的 Hot 是确定性计算，继承成本几乎为零 [A§A5]；
  - 保险资讯稀疏，直接沿用 AIHOT 参数会导致榜单长期为空（F-07）；
  - 保险中最有价值的信息（监管生效、条款变化）往往"低热度、高变化"（§18.1）；
  - 公开的结构性变化检测是市场空白 [B§3.2]。
- **Reasoning**：只有 Hot，InsurHOT 会退化成新闻站；只有 Change，又会失去"今天大家在关注什么"的入口。Change 的规则化实现（生命周期、diff、首次出现、指标突变）成本可控。
- **Strongest Counterargument**：Change Score 的"结构性"权重是主观先验，容易被质疑；在规则检测器覆盖不全时，"变化流"可能不如"关注度榜"好看，影响早期留存。
- **Failure Condition**：如果影子运行期间 Change 流的编辑抽检查准率 < 0.8，或者三支柱视图的点击率持续低于关注度榜的 1/3，就改进三支柱视图的质量与呈现；**不因此把热度提升为主轴**，因为 C0 定义的 HOT 不是热度。
- **Confidence**：**高（0.8）**

### D9. 哪些能力构成 InsurHOT 真正的长期护城河？

- **Decision**：
  1. **随时间累积、不可回补的版本化数据**：首次发现时间、监管生命周期、条款版本史、商业模式分级史、处罚数据集；
  2. **证据链本身**：每个断言都有快照和哈希，数年后仍可验证，即使源站已经改版或撤稿；
  3. **方法公信力 + 结构性独立**：公开可复算，不收佣，不卖徽标；
  4. **实体主数据与消歧**，尤其是中国保险机构；
  5. **评测金标集与编辑手册**（组织知识）。

  **不是**护城河的：聚合、prompt、UI、模型选择。
- **Evidence**：
  - `finhot` 证明聚合层可以被轻易复制 [B§2.14]；
  - 商业评级普遍有利益冲突 [D§1.2]；
  - Evident 的影响力来自方法与持续性 [B§2.1]；
  - 源站会撤稿、改版（NFRA 从 cbirc.gov.cn 迁到 nfra.gov.cn 后，旧站从境外已无法访问 [E§13]），这使得历史快照具有稀缺性。
- **Reasoning**：时间序列与证据快照是后来者无法补建的，只能从今天开始积累。独立性一旦丧失就无法恢复。
- **Strongest Counterargument**：数据资产的护城河需要有人使用才成立。如果没有分发，数据再好也没有网络效应。另外，监管机构或行业协会自己开放结构化数据（例如新的信息披露办法推动统一平台）会削弱这层壁垒。
- **Failure Condition**：如果 12 个月后 API/MCP 的独立客户端和数据集下载量没有增长，或者监管方推出了功能等价的官方结构化平台，就把重心转向"解释与方法"层，例如 Change 解释、BM 判级、跨法域研究。
- **Confidence**：**中高（0.75）**

### D10. 如果资源只能做三件事，最先做哪三件？

- **Decision**：
  1. **Evidence-first 采集内核 + 实体注册表**：AIHOT 基线导入、Source 2.0、文档与断言层、P0 信源（NFRA 各栏目 + 头部公司披露 + 国际监管 RSS/API）、中国保险机构主数据。
  2. **中国优先的监管与公司情报流，以及 Change v0**：监管生命周期、文本 diff、实体状态变化、NFRA 统计突变；首个样板是 2026 年《银行保险机构信息披露管理办法》从征求意见到正式稿。
  3. **New Species / AI Business Model Radar v0**：58 个案例复核、至少 20 张卡上线、公开判级方法。

  三件事与 C0 三问的对应：第 1 件是三问共同的证据地基；第 2 件主要回答 What matters? 和 What is changing?（Importance v0 + Change v0）；第 3 件回答 What is emerging?（New Species + Emergence v0）。

  Product Benchmark 是重要能力（C0.5），与三件事并行推进"标准层"：方法论 RFC、UIPS schema、编码手册和法律意见（M8）。评分层在标准层与法律意见之后推进。
- **Evidence**：
  - 第 1 件是其余一切的前置依赖（§20）；
  - 第 2 件的信源可自动化程度最高（NFRA JSON 接口已实测，著作权法第五条允许全文存储 [E§2.1]），法律风险最低，用户价值最直接，而且有一个正在发生的样板监管事件 [E§13]；
  - 第 3 件冷启动材料已经就绪 [C§3]，并且是空白领域 [C§1]。
- **Reasoning**：三件事都满足三个条件：法律风险低，差异化来自证据与方法，产出能够积累成 D9 所说的护城河数据。
- **Strongest Counterargument**：三件都偏 B 端和专业读者，缺少大众传播点；而 Benchmark 恰恰是最有传播力的，延后它可能错过窗口期，被商业测评平台占据心智。
- **Failure Condition**：如果 3 个月后三件事都已上线，但目标用户（从业者、研究者）的留存（周活/月活）< 20%，说明"证据型情报"的需求被高估了。此时应回到用户访谈，重新评估是否提前推进 Benchmark 或调整目标用户。
- **Confidence**：**中高（0.75）**

---

*本规格为 Phase 0 研究与架构产出，不含实现。所有 NEEDS VALIDATION 项目汇总见各附录的待验证清单。*

