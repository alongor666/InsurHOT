# 定位校准记录（Positioning Delta Review）

- 日期：2026-09-29
- 对象：PR #1 全部内容：主规格书、附录 A–E、README
- 上位约束：owner 确认的 P0 定位（已写入规格书 §3 **C0**，登记为 ADR-023 Accepted）
  - **InsurHOT = Insurance High-value Observed Trends**｜保险行业高价值变化与趋势情报平台
  - Mission：*Discover what matters, what changes, and what emerges in insurance.*
- 方法：逐节对照 C0，只做必要的增量修订；不改变已经正确的规划；不改变 owner 冻结的定位。

---

## 1. Aligned（原本已经一致，未改动结论）

| 定位要求 | 原规划中的对应 |
|---|---|
| Evidence first, opinion last | 宪法 C1；§20 证据链；§19 原文回查；I8–I11 不变量 |
| 客观 ≠ 不评价；先建公开、统一、可解释、可复算、证据可追溯的标准 | C2；§13（方法版本化、O/S/N、Profile、门槛、被占优检测）；§13.9 标准层先进 MVP |
| 不是任何保险公司的内部经营系统 | C4；N1 |
| 不研究内部渠道、费用政策、客户与经营数据 | N2、N3；§16.1 Distribution 注释 |
| 面向整个行业的公开信息空间 | C4；§9 信源体系（只用公开、合法、可验证的信息） |
| Product Benchmark 是重要能力 | §6.2、§12、§13、D3、D4 |
| New Species / Business Model Radar 是最高优先级研究方向之一 | §15–§17；D5；D10 的三件事之一；附录 C |
| 不做新闻聚合站 | §1、§3 的风险判断；D8 的理由；§29.4 对 `finhot` 的判断 |
| What is changing? | §18 Change 检测器与 Change Score；监管追踪；产品版本 diff |

## 2. Changed（增量修订）

| # | 位置 | 偏差或遗漏 | 修订 |
|---|---|---|---|
| 1 | README；规格书标题 | 没有正式品牌与 Mission | 加入品牌全称、中文定位语、Mission |
| 2 | §1 Executive Summary | 第 8 条把 "Hot + Change" 作为信号主线 | 改为 Matters / Changes / Emerges 三支柱；Hot 降为辅助的关注度信号 |
| 3 | §2 一句话定义 | 缺正式品牌定义；"不是"的列表没有覆盖"热点站" | 加入正式定义；原定义保留为展开定义；明确"HOT ≠ 热门" |
| 4 | §3 宪法 | 没有定位与使命的上位条款 | 新增 **C0**（owner 冻结）：品牌、使命、三问与本规格承载的映射、Benchmark 与 New Species 的地位、三条边界 |
| 5 | §6 矩阵 | 精选评分语义是 AIHOT 的"注意力"；缺 Emergence 能力；首页和日报"变化优先" | 评分语义改为"重要性"；新增 Emergence Tracking；报告按三支柱分节；Benchmark 标注"先标准后评价" |
| 6 | §7 IA；§4.2 晨读场景 | 核心路径是"变化流 + 热点" | 改为"重要 / 变化 / 新生"三栏；关注度榜只作辅助入口 |
| 7 | §8 Taxonomy | `distribution` 中"费用与佣金规则"可能被误读为研究内部费用政策 | 改为"监管层面的费用与佣金规则（公开监管要求）"，并在"不包含"一栏写明内部数据排除；补充说明三支柱是信号和视图，不是分类 |
| 8 | §10.3 Event scores | `importance` 是可选字段；没有 emergence | 四个信号字段并列；`hot` 改名为 `attention` |
| 9 | §14 Product Hot | "Hot" 一词与品牌 HOT 混淆 | 增加术语说明：技术名保留，对外称"关注度" |
| 10 | §18 | 只有 Hot 与 Change，缺 **What matters?** 与 **What is emerging?** 的建模 | 新增 §18.0（四信号总览）和 §18.4（Emergence 扩散阶段：weak_signal → emerging → spreading → mainstream，以"领先时间"为质量指标）；D4、D7 归入 Emergence |
| 11 | §19 Pipeline 与 §19.3 | 评分输出 `attentionScore` | 改为 `importanceScore`；reson 明确为"相关度"而非传播热度 |
| 12 | §22 API/MCP/RSS | 没有 matters 与 emerging 出口；`get_hot` 语义不清 | 新增 `/matters`、`/emerging`，以及对应的 MCP 工具和三支柱 RSS；`hot-topics` 注明"关注度 ≠ 重要性" |
| 13 | §25 评测 | 缺 Matters 与 Emerges 的指标 | 新增 EmergenceBench 与三支柱线上指标（含领先时间） |
| 14 | §26 UI | 首页 = 变化流 + 热点 | 首页 = 重要 / 变化 / 新生三栏 |
| 15 | §27 R2 | 缓解措施写的是"中文名不使用'保险'二字"，与 owner 冻结的中文定位语直接矛盾 | 改为：定位不变；是否可用作网站、APP、账号名称或商标，待律师意见（见 X-1） |
| 16 | §28 Non-goals | N3 的措辞与 owner 表述不完全一致；没有"不做热点站" | N3 按 owner 表述重写；新增 N17 |
| 17 | §31 MVP；§32 Roadmap | MVP 目标没有按三问组织 | MVP 目标与模块按三支柱标注；验收指标补充 Matters 与 Emerges |
| 18 | §33 Open Questions | Q2 的前提是"中文名是否可以不含保险" | Q2 改为只确定合规的使用方式，不重新讨论定位；新增 Q13（技术标识符是否改名）、Q14（Emergence 阈值） |
| 19 | §34 ADR | —— | 新增 ADR-023（Accepted）；ADR-014 改为四信号分离 |
| 20 | §35 目标架构图 | 评分层只有 Hot 与 Change | 改为三支柱 + 辅助 Attention |
| 21 | §36 D3 / D8 / D10 | D8 的结论是"Change 主轴、Hot 次轴"；D10 对 Benchmark 的表述偏弱 | D8 改为"三支柱为主、Hot 辅助"；D3 注明与 C0.5 一致；D10 标注与三问的对应关系，Benchmark 标准层并行推进 |
| 22 | 附录 A §A5 | —— | 加一条注释：Hot 在 InsurHOT 中降为关注度 |

附录 B–E 是研究记录，其中的事实与来源不受定位影响，**未改动**。

## 3. 与冻结定位的冲突或张力（已报告，未自行改变定位）

| # | 冲突 | 影响 | 建议 |
|---|---|---|---|
| **X-1** | 中文定位语"保险行业高价值变化与趋势情报平台"含"保险"二字。附录 D 的研究发现，《金融产品网络营销管理办法》（2026-09-30 施行）第十八、十九条规定，未取得相应资质者不得在网站、APP、账号名称和商标中使用"保险"等字样 [D§5.3] | 如果把含"保险"的字样用作网站、APP、公众号或账号名称，或注册为商标，可能违规。作为定位描述或宣传语使用时，是否受约束尚不确定 | 定位不变。尽快取得律所意见（Q2），区分"定位描述"与"名称或商标"两种使用方式；意见出具前，不把含"保险"的字样注册为网站、APP、账号名称或商标 |
| **X-2** | C0.5 确认 Product Benchmark 是重要能力；但在中国，非保险机构"比较保险产品"受《互联网保险业务监管办法》第二十三条限制 [D§5.3] | 不影响"先标准后评价"的顺序；可能限制在中国**公开**发布评分和比较的形态与时间 | 保持 D3：标准层进 MVP，公开评分以律所书面意见为前提。如果意见不利，由 owner 在"B2B 研究 / 开放数据集演示 / 只公开方法与事实"之间选择 |
| **X-3**（术语） | "Hot Score""hot-topics""insurhot_get_hot"继承自 AIHOT 和原始任务，与品牌 HOT 同词不同义 | 读者和 Agent 可能把关注度误读为"高价值趋势" | 已把对外标签改为"关注度"；是否把 API、MCP 标识也统一改为 `attention`，由 owner 决定（Q13） |

没有发现与冻结定位相冲突的**架构**设计：三支柱都可以在既有架构上以增量方式承载（Importance 复用 AIHOT 的双评分机制；Change 与 Emergence 复用 §18 的检测器框架；New Species 复用 §15–§17）。

## 4. Remaining Open Questions

- **Q2**：中文定位语与 "InsurHOT" 的合规使用方式（律所 → owner）。
- **Q13**：是否把技术标识符 `hot` 统一改为 `attention`。
- **Q14**：Emergence 阶段阈值（N₁、N₂、观察窗口）与"主流专业媒体集中报道"的判定口径。
- **Q1**：产品事实卡、版本 diff、被占优标记、分数卡在中国的法律定性（决定 Benchmark 的公开形态）。
- 其余 Open Questions 不受本次校准影响，见规格书 §33。
