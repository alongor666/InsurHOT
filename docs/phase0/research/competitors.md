# InsurHOT Phase-0 研究：竞品与相邻产品版图（Competitor & Adjacent Landscape）

- 研究日期：2026-09-29
- 研究方法：WebSearch / WebFetch / GitHub 仓库检索。每条事实性陈述后以 `[S#]` 标注来源，完整 URL 见文末 **Sources**。
- 标注约定：
  - **UNKNOWN / NEEDS VALIDATION**：本次未能通过一手或可靠二手来源确认的信息。
  - 「相对 InsurHOT 的缺口」一栏是**分析判断**（非事实陈述），依据是本表中已引证的事实。
- 覆盖：7 大类，共约 85 个条目；其中 15 个与 InsurHOT 最相关的条目在第 2 节做深度剖析。

---

## 0. 结论摘要（TL;DR）

1. **新闻层已是红海，但全是"文章流"，不是"证据流"。** 国际上有免费高频的 Insurance Journal（带分类 RSS）[S66]、Reinsurance News（每天 15 篇以上、2.7 万邮件订户）[S71]、Artemis（免费 ILS 交易库）[S48]；也有付费的专业媒体 The Insurer（已并入 Reuters）[S69]、Insurance Insider（企业订阅、至少签一年）[S70]。中国则以中国银行保险报（官方背景、无 RSS）[S43]和慧保天下、13个精算师等公众号媒体为主 [S41][S42]。这些媒体都不做"论断 → 一手证据"这种结构化链接，也基本不提供 API。
2. **创投与宏观数据已经解决得不错，但都按"技术/价值链/融资"分类，没有按"商业模式结构"分类。** 属于这一类的有 CB Insights、Gallagher Re 季度报告、Tracxn、Sønr、Venture Scanner 等 [S73][S5][S74][S75][S108]。宏观统计方面有 Swiss Re sigma explorer（免费）[S76]、OECD GIS [S90]、IAIS GIMAR [S91]、NFRA 月度数据 [S86]。
3. **产品评级很成熟，但只在单一法域内成立，方法论开放程度参差，常与佣金或销量挂钩。**
   - 各国都有本地评级：Defaqto（英国，库内 10,000+ 产品，方法论细节不公开）[S18]；Canstar（澳洲，公开方法论 PDF）[S93]；Franke und Bornberg（德国，公开 Bewertungsrichtlinie，只依据条款等一手文件评分）[S51]；10Life（香港，精算评分，方法论公开，但明说不同品类的分数不可比）[S50]；深蓝保（中国，192 项测评细则、150 余人的测评团队，靠佣金变现）[S40]。
   - 价格.com 保険的"排行"按经由该站的签约数计算，本质是销量榜 [S97]。
   - **没有一家同时公开：逐产品的特征级数据、版本化的评分代码、可复现的结果。**
4. **监管情报是高价值付费市场，美国之外的"结构化文件情报"几乎是空白。**
   - 美国：SERFF Filing Access 免费但只能浏览 [S21]；S&P 把 SERFF 文件做成 API 数据集 [S23]；ZestyAI ZORRO Discover 用 AI 分析 200 万份以上 P&C 费率/条款文件，并强调"可追溯引用"[S100]。
   - 跨法域：CUBE（已收购 Thomson Reuters Regulatory Intelligence）[S80]、Wolters Kluwer NILS [S102]、Axco（220+ 市场的监管与税务）[S89]，全部是付费 B2B。
   - 中国：北大法宝、威科先行是通用法规库 [S83][S84]。**中保协信息披露平台明确写着"禁止下载、数据提取"**[S27]，这是 InsurHOT 在中国做产品数据时的硬约束。
5. **数据标准有了，但不开放，或者进展缓慢。**
   - ACORD NGDS（JSON/YAML、面向 API）核心资源仅对会员开放 [S13][S15]。
   - FIBO 没有成熟的保险扩展（NEEDS VALIDATION）[S36]。
   - OPIN 是社区白皮书性质 [S17]。
   - 巴西 Open Insurance 的 Phase 1 公开数据（机构、渠道、产品）已通过 API 开放，但 2026 年的核心问题是没人用 [S8][S11][S12]。
   - 欧盟 FiDA 截至 2026 年仍处于"pending / 谈判"状态，而且寿险、健康险数据被排除在外（NEEDS VALIDATION：最终文本）[S34][S35]。
6. **AI-in-insurance 追踪几乎只有 Evident 一家做成了"指数"。** 它只覆盖北美和欧洲的 30 家保险公司，数据是外部视角的公开数据，共 60/70+ 项指标（两个页面数字不一致）[S1][S2][S3]。**中国及亚洲保险公司没有同类的公开、可复现的 AI 成熟度追踪**，这是明确的空白。
7. **开源侧几乎是空白。**
   - GitHub 上与保险新闻聚合、产品数据、知识图谱相关的仓库大多是个人 demo，星数都在两位数以内；中文的 MedicalInsuranceKG 有 137 星，是 2018 年的老项目 [S55]。
   - 值得注意：已经有人基于 AIHOT 改出了金融/保险方向的 `finhot`（MIT，7 星）[S54]。另有一个把 EIOPA 注册库与 GLEIF 做成 OWL/SHACL 知识图谱的项目（276,683 条三元组，CC BY 4.0）[S58]，可以直接复用或借鉴。
8. **InsurHOT 可以建立的独特资产（按可行性排序）：**
   - ① 证据链图谱：事件 → 论断 → 一手文件，带快照、哈希和抓取时间；
   - ② 开放的保险产品 Schema 和"可复现基准卡"，含方法、代码、数据版本；
   - ③ 商业模式原语分类法 + "新物种"登记簿，思路类似 Artemis Deal Directory，但对象是商业模式；
   - ④ 中国/亚洲保险公司 AI 成熟度的外部视角追踪，补 Evident 的地域空白；
   - ⑤ 结构化监管事件流 / 处罚数据集；
   - ⑥ 带出处的 MCP/API 与 `llms.txt`，AIHOT 原生就支持 [S53]。

---

## 1. 分类清单

说明：「开放性」指 API / RSS / 许可条款；「缺口」是相对于 InsurHOT 五大目标的判断：①行业情报、②产品基准、③商业模式雷达、④变化检测、⑤Agent 接口。

### 1.1 保险 / Insurtech 新闻与情报（国际）

| # | 名称 / URL | 国家 | 解决的问题 & 数据 | 商业模式 | 开放性 | 优势 | 相对 InsurHOT 的缺口 |
|---|---|---|---|---|---|---|---|
| 1 | **Insurance Journal** insurancejournal.com | 美国 | 美国 P&C 行业新闻，按美国各区域和国际/再保分栏，另有 AI、气候、并购等主题分类 [S66] | 广告 + 媒体集团（Wells Media，员工持股 ESOP）[S67] | **有分区域、分主题的 RSS，每小时更新，只含摘要** [S66] | 覆盖面广，RSS 结构清晰，适合作为 AIHOT 信源 | 只有文章，没有结构化实体和事件；RSS 的条款没有明示（NEEDS VALIDATION）[S66] |
| 2 | **Carrier Management** carriermanagement.com | 美国 | 面向 P/C 保险公司 C-suite 的战略内容，出版日刊和季刊 [S67] | 同属 Wells Media [S67] | UNKNOWN（RSS 待验证） | 高管视角 | 同上 |
| 3 | **Artemis.bm** + Deal Directory | 百慕大/英国 | Cat bond / ILS 新闻；**交易库收录 1,000+ 笔交易，每笔有发行人、分出人、风险、规模、日期、触发类型等字段，可筛选，免费** [S48]；累计追踪接近 2,200 亿美元 [S49] | 广告/赞助（NEEDS VALIDATION） | 网页可筛选；**没有看到导出或 API** [S48] | **"结构化交易库 + 新闻"是 InsurHOT 最值得借鉴的范式** | 只覆盖 ILS 这一细分；不开放机器接口 |
| 4 | **Reinsurance News** reinsurancene.ws | 英国 | 再保新闻，每天 15 篇以上，另有晨间邮件；2.7 万以上活跃订户，月访问 22 万以上 [S71] | 免费 + 广告 [S71] | 免费网站（RSS: NEEDS VALIDATION） | 免费、频率高 | 文章流，不做结构化 |
| 5 | **The Insurer** theinsurer.com | 英国 | 专业（再）保险新闻、数据和公司页面 [S69] | **付费订阅**；2024 年 1 月被 Thomson Reuters 收购，并入 Reuters News [S69] | 付费墙 | 专业深度，有公司数据 | 封闭；不能作为全文信源 |
| 6 | **Insurance Insider / Insider US / ILS** | 英国/美国 | 伦敦市场、美国 P&C、ILS 情报 [S70] | **企业订阅，至少签一年** [S70]；2024 年 11 月由 Delinian 出售给 ECI Partners [S70] | 付费墙 | 独家消息 | 封闭 |
| 7 | **Digital Insurance** dig-in.com | 美国 | 保险数字化与 AI；覆盖 12.7 万以上高级从业者；2026 年 6 月起**把 AI 定为核心定位** [S103] | Arizent 旗下：媒体 + 活动 + 研究 [S103] | UNKNOWN | AI 专题 | 同上 |
| 8 | **Coverager** coverager.com | 美国 | 保险创新新闻，日报约 1.2 万读者；每周观察约 500 家公司；已扩展到研究、数据平台和活动 [S68] | 赞助/广告 + 研究 [S68] | 邮件 | 老牌 insurtech 媒体 | 数据平台细节 UNKNOWN |
| 9 | **Insurance Business (IB)** insurancebusinessmag.com | 澳洲/全球 | 6 个区域版本（AU/NZ/APAC/CA/UK/US）[S104] | Key Media：媒体 + 活动 + 奖项 [S104] | UNKNOWN | 多区域 | 以经纪/渠道视角为主，不做结构化 |
| 10 | **Intelligent Insurer** | 英国 | 再保与批发保险新闻、日报 [S105] | Newton Media（订阅/广告）[S105] | UNKNOWN | 专业 | 同上 |
| 11 | **Insurtech Insights** | 英国 | 活动与内容平台；2025 年 3 月被 Emerald Holding 收购；2026 年全年活动参会 17,000 人以上 [S72] | 活动 | — | 生态连接 | 不是数据产品 |
| 12 | **BinderBrief**（Buttondown） | 美国 | 商业险/核保自动化**每日**简报，每条附"Read source"链接 [S106] | 免费 [S106] | 邮件 | **每条附原文链接**，接近"证据可追溯"的最低要求 | 人工/半自动策展（生产方式 UNKNOWN）；没有结构化 |
| 13 | **Rooted in AI**（Roots）/ **AI Insurer Brief** | 美国 | 保险 AI 周报 [S107] | 免费，属于厂商内容营销 [S107] | 邮件 | AI 专题 | 厂商立场；不结构化 |

### 1.2 保险新闻与情报（中国）

| # | 名称 | 解决的问题 & 数据 | 商业模式 | 开放性 | 相对 InsurHOT 的缺口 |
|---|---|---|---|---|---|
| 14 | **中国银行保险报 / 中国银行保险报网** cbimc.cn | 银行保险新闻。网站由《中国银行保险报》社有限责任公司运营，页脚链接国家金融监督管理总局 [S43] | 报纸订阅 + 广告 [S43] | **页面未见 RSS**；主要推 App 和微信/微博 [S43] | 权威但没有机器接口；需要网页抓取 |
| 15 | **慧保天下** | 2015 年成立的保险新媒体（北京燕梳新青年信息科技），创始人胡琼；2016 年天使轮 [S41] | 内容 + 活动/榜单（NEEDS VALIDATION）| 公众号为主（UNKNOWN）| 深度稿，但不结构化 |
| 16 | **13个精算师** | 发布"13精"综合竞争力排名榜，2016 年起已发布五十余期；指标包括保费增速、ROE、总资产、实际资本、投诉率、偿付能力充足率等 [S42] | 公众号 | 图片/文章形式 | **少见的"指标化公司排名"**，但方法与数据不开放、不可复现 |
| 17 | **今日保** | 与《今日保险》杂志合办"中国保险白象榜"等行业评选 [S45] | 媒体 + 评选 | UNKNOWN | 评选榜单，不是数据 |
| 18 | **保观 / InsurStar** | 保险科技年度评选，2025 年 12 月 22 日揭晓，参评项目 200 多个；小雨伞入选"InsurStar 30"[S46] | 媒体 + 评选 | UNKNOWN | 获奖名单 ≠ 结构化商业模式数据库 |
| 19 | **蓝鲸保险**（蓝鲸财经保险频道）| 保险新闻报道 [S44] | 媒体 | UNKNOWN | 文章流 |
| 20 | **北京商报保险频道、保险一哥、保险文化** 等 | NEEDS VALIDATION（本次未取得可靠来源）| — | — | — |

### 1.3 Insurtech 初创数据库与市场情报

| # | 名称 | 国家 | 数据 / 问题 | 商业模式 | 开放性 | 相对 InsurHOT 的缺口 |
|---|---|---|---|---|---|---|
| 21 | **CB Insights**（Insurtech 50、State of Insurtech 季报）| 美国 | 融资、交易、"预测信号"；Q1'26 中位数交易额 1,000 万美元 [S73] | 企业订阅；报告部分免费（NEEDS VALIDATION）| 付费 API（UNKNOWN）| 按赛道/融资分类，**没有商业模式原语** |
| 22 | **Gallagher Re Global InsurTech Report** | 英国/美国 | 季度融资数据：Q2 2026 为 24.4 亿美元，AI 类占 99.1%，共 107 笔交易 [S5]；Q1 2026 为 16.3 亿美元，AI 类占 95.2% [S6][S114] | 经纪商品牌研究，免费发布（NEEDS VALIDATION：数据供应方）| PDF | 宏观"量"的数据，没有逐公司的结构化字段 |
| 23 | **Tracxn** | 印度 | 追踪 790 万以上私营公司、300 多个行业 [S74] | 订阅 | 付费 | 同上 |
| 24 | **Dealroom** | 荷兰 | 创投数据；有 embedded insurance 等专题 [S109] | 订阅 | 付费 | 同上 |
| 25 | **Venture Scanner** | 美国 | 保险科技地图，曾统计 1,010 家公司、53 个国家（数据较旧）[S108] | 订阅 | 付费 | 分类体系较旧 |
| 26 | **Sønr** | 英国 | 面向保险公司的创新情报 SaaS，50 多家一线保险/再保/经纪客户（Allianz、Generali、Munich Re、Tokio Marine 等）[S75]；Sønr 2.0 加入保险专用 AI agents [S75] | SaaS + 咨询 + 培训 [S75] | 封闭 | **最接近"保险版情报平台"的 B2B 竞品**，但封闭且付费 |
| 27 | **Celent**（2024 年底被 GlobalData 收购）| 美国 | 寿险/P&C 技术研究订阅 [S78] | 订阅 [S78] | 封闭 | — |
| 28 | **Datos Insights**（原 Aite-Novarica + RBR，2023 年更名）| 美国 | 保险 IT 研究与咨询 [S77] | 订阅 + 咨询 [S77] | 封闭 | — |
| 29 | **Swiss Re Institute sigma explorer** | 瑞士 | 1970 年起的全球保费、巨灾、韧性指标，可交互、可导出，**免费** [S76] | 品牌研究 | 免费交互工具 | 宏观层；没有事件和产品 |
| 30 | **McKinsey Global Insurance Report** | 美国 | 行业宏观：2025 年全球 GWP 约 8.3 万亿美元，AI 可释放 500–700 亿美元收入 [S92] | 咨询品牌内容 | 免费报告 | 一次性报告 |
| 31 | **IAIS Global Insurance Market Report（GIMAR）** | 国际 | 2026 年中期更新版 [S91] | 监管机构 | 免费 PDF | 宏观/系统性风险 |
| 32 | **OECD Global Insurance Statistics** | 国际 | OECD 及部分非 OECD 国家的保费、赔付、投资、密度、深度等指标 [S90] | 公共 | 公开数据 | 年度，滞后 |

### 1.4 产品比较 / 产品数据库 / 评级

| # | 名称 | 国家 | 数据 / 方法 | 商业模式 | 开放性 | 相对 InsurHOT 的缺口 |
|---|---|---|---|---|---|---|
| 33 | **Defaqto Star Ratings / Engage** | 英国 | 10,000+ 金融产品，含 6,000 份家/车/旅行险，75 种以上产品类型打 1–5 星 [S19]；比价网站展示其星级 [S19][S20] | B2B 数据授权 + 厂商 logo 授权（NEEDS VALIDATION）| **官网未披露具体特征数、更新频率、方法细节** [S18] | 不透明，不可复现；只覆盖英国 |
| 34 | **Moneyfacts Star Ratings** | 英国 | 车险每个产品 80+ 字段，旅行险 100+ 字段；提供 Star Ratings Modeller 供厂商模拟评级 [S95] | 数据订阅 + 评级授权 [S95] | 付费 | 同上；厂商可"对着模型调产品" |
| 35 | **Which?** | 英国 | "Recommended Provider"要求客户评分高、且标准保单保障至少达到平均水平 [S94] | 会员订阅（消费者组织）| 部分付费 | 单一法域 |
| 36 | **Canstar** | 澳洲/新西兰 | 按险种发布**公开的方法论 PDF**，同时考虑价格和特征 [S93] | 评级授权 + 导流 | 方法公开；数据不开放 | 可以作为"方法论公开"的样板，但不可复现 |
| 37 | **Franke und Bornberg** | 德国 | 公开 Bewertungsrichtlinie；**只依据条款、消费者信息、投保单等可核验文件**，不采用保险公司自报数据；FFF+ 到 F- 共 7 档 [S51] | 评级授权/软件 | 方法公开 | **"只用一手文件"的原则与 InsurHOT 的证据理念高度一致**；但数据不开放 |
| 38 | **Stiftung Warentest / Finanztest** | 德国 | 例如 2026 年第 6 期评测了 55 款 BU（失能险）产品，用 4 类模型客户测保费 [S52] | 杂志/付费 | 付费墙 | 公益性强，但不开放数据 |
| 39 | **10Life** | 香港 | 精算团队设计 5 星评分；**方法论公开**；明确说明不同品类的分数不可直接比较，也不含服务、理赔体验 [S50] | 平台/导流（NEEDS VALIDATION）| 方法公开 | 已承认"跨品类不可比"；只覆盖香港 |
| 40 | **compareFIRST** | 新加坡 | MAS、LIA、CASE、MoneySense 联合推出（2015-04-07），可比较 DPI、定期、终身、储蓄险的保费、身故保额、各年退保价值 [S28][S29] | 公共/行业协会 | 公共网页（API: UNKNOWN）| **官方的统一产品比较口径**，可作为跨法域 schema 的参照 |
| 41 | **보험다모아（Korea）** e-insmarket.or.kr | 韩国 | 2015-11-30 上线的"线上保险超市"，可比较实损、车险、旅行、年金、保障/储蓄型的保费与保额 [S30][S31] | 公共（金融委 + 生损保协会）[S30] | 公共网页 | 同上 |
| 42 | **価格.com 保険** | 日本 | 多品类"人气排行"，**按经由该站的签约/申请数统计**；由保险代理子公司运营 [S97] | 代理佣金 [S97] | 网页 | 本质是销量榜，不是质量评测 |
| 43 | **Policybazaar**（PB Fintech）| 印度 | 40 多家保险公司的比价与投保；FY26 平台保费 29,934 亿卢比 [S96] | **保险公司支付佣金**；上市公司 [S96] | 封闭 | 规模大，但没有中立基准 |
| 44 | **NerdWallet** | 美国 | 公开加权方法论（家财险：消费者体验 40%、财务实力 30%、保障 25%），数据来自公开文件、监管数据等 [S98] | 导流/广告 [S98] | 方法公开 | 以公司为粒度，不到产品条款粒度 |
| 45 | **Policygenius / Insure.com** | 美国 | 在线比价市场，按佣金变现 [S98] | 佣金 | 封闭 | 同上 |
| 46 | **CMS Exchange PUFs**（Healthcare.gov）| 美国 | **2014–2026 计划年度**的 12 类公开文件：福利与自付、费率、计划属性、服务区、网络、质量评级等；ZIP 格式免费下载 [S99] | 公共 | **免费开放数据** | **世界上少有的"产品条款级开放数据"**，可作为 schema 设计的参照和演示数据集 |
| 47 | **中国人身保险产品信息库 / 中保协信息披露平台** iachina.cn / icidp.iachina.cn | 中国 | 可查询 2009 年新《保险法》实施后报备或审批的全部人身险产品条款，可扫码验真 [S25]；中保协网站设有"条款费率"栏目 [S26] | 行业协会（公共）| **"本站信息仅供浏览，未经允许禁止下载、数据提取或用于其他商业目的"**[S27] | **中国最权威的产品源，但法律上禁止自动提取** → 需要授权或合作 |
| 48 | **中国银保信** | 中国 | 官网公布个人养老金保险产品等信息 [S110] | 金融基础设施 | UNKNOWN | 覆盖面有限 |
| 49 | **深蓝保** shenlanbao.com | 中国 | "深蓝Model"重疾险评分（保障分 + 性价比分），192 项测评细则、150 余人测评团队、200 多个责任模板的"保险字典"[S40]；全平台约 1,000 万用户 [S40] | **内容导流 + 经纪佣金** [S40] | 封闭 | **中国最接近"产品基准引擎"的玩家**，但有利益冲突，方法与数据不开放 |
| 50 | **慧择 / 小雨伞 / 蚂蚁保 / 微保 / 水滴** 等 | 中国 | 互联网保险中介，提供咨询、方案推荐、理赔协助 [S47][S111] | 佣金 | 封闭 | 销售导向 |
| 51 | **蜗牛保险、多保鱼、沃保** | 中国 | NEEDS VALIDATION | — | — | — |

### 1.5 监管情报 / 合规 / 评级

| # | 名称 | 国家 | 数据 / 问题 | 商业模式 | 开放性 | 相对 InsurHOT 的缺口 |
|---|---|---|---|---|---|---|
| 52 | **SERFF Filing Access（NAIC）** | 美国 | 参与州标记为公开的费率/条款文件，**浏览免费** [S21][S22]；宾夕法尼亚等州在用 [S24] | 公共 | 网页（批量访问条款：NEEDS VALIDATION）| 分州、PDF、没有结构化 |
| 53 | **S&P Global MI — SNL Insurance Product Filings / RateFilings.com** | 美国 | 从 SERFF 抽取的费率变动、处置结果等数据，可通过 API 批量下载 PDF [S23] | 企业订阅 | **付费 API** | 只覆盖美国，封闭 |
| 54 | **ZestyAI ZORRO Discover** | 美国 | AI 分析 200 万份以上 P&C 费率/条款文件 [S100]；强调"结构化解析 + 确定性计算 + 可追溯引用"[S100] | 企业销售（要预约演示）[S100] | 封闭 | **"AI + 一手文件 + 可追溯引用"的商业验证**；只做美国 P&C |
| 55 | **Insuraviews** | 美国 | AI 费率文件分析，整合 50 州公开文件（2024 年成立）[S101] | UNKNOWN | UNKNOWN | NEEDS VALIDATION（Dealroom 页面返回 403，只看到搜索摘要）|
| 56 | **Wolters Kluwer NILS INsource** | 美国 | 50 州加 DC/PR/VI 的保险法规、监管材料，每日提醒，约 7,000 名用户 [S102] | 订阅 | 封闭 | 只覆盖美国 |
| 57 | **CUBE**（含原 Thomson Reuters Regulatory Intelligence 与 Oden）| 英国 | 2024-05 收购；追踪 20 国约 2,000 家监管机构的变化；约 1,000 家客户 [S80] | 订阅 | 封闭 | 跨法域，但付费、不开源 |
| 58 | **Axco Insight / Insight Compliance** | 英国 | **220 多个保险市场**的监管、税务、强制险、非认可业务等信息，按险种组织 [S89] | 订阅 | 封闭 | **跨法域可比性最强的付费源**；只覆盖非寿险商业险 |
| 59 | **AM Best**（Best's Credit Ratings / Financial Suite / BestLink）| 美国 | 专注保险业的评级机构，约 4,000 个评级；评估或报告全球 16,000 多家保险公司 [S79] | 评级费 + 数据订阅 | 封闭 | 公司层面，不涉及产品 |
| 60 | **NAIC Consumer Insurance Search / 投诉数据** | 美国 | 可按州、公司、险种查近 3 年被确认的投诉 [S81] | 公共 | 网页 | 可作为"消费者体验"维度的公开证据 |
| 61 | **NAIC AI Model Bulletin 采纳地图** | 美国 | 各州采纳 2023-12 AI 模型公告的情况（地图截至 2026-05-01）[S82] | 公共 | PDF | 监管层面的 AI 追踪样板 |
| 62 | **EIOPA 统计 / 注册库** | 欧盟 | Solvency II 季度/年度统计；保险公司注册库可批量导出 [S88][S58] | 公共 | 开放数据 | 可做欧盟公司主数据 |
| 63 | **国家金融监督管理总局（NFRA）** | 中国 | 行政处罚信息公开表（2023 年对保险公司开出 1,139 张罚单）[S85]；月度保险业经营数据 [S86] | 公共 | 网页/表格 | 没有 API；需要结构化 |
| 64 | **偿付能力季度披露** | 中国 | 非上市公司在季度结束后 30 日内披露偿付能力摘要 [S87]；中保协网站是重要披露渠道 [S87] | 公共 | 网页/PDF（受 #47 条款约束）| 需要结构化抽取 |
| 65 | **北大法宝** | 中国 | 1985 年起步；收录 1949 年以来的法律法规，另有"行政处罚"等库 [S83] | 机构订阅 | 封闭（API: UNKNOWN）| 通用法规库，不是保险专用 |
| 66 | **威科先行（Wolters Kluwer China）** | 中国 | 法律、财税、HR 参考库 [S84] | 订阅 | 封闭 | 金融/保险模块 UNKNOWN |
| 67 | **PwC 中国保险处罚分析** | 中国 | 定期发布保险监管处罚分析 [S85] | 咨询品牌内容 | 免费 PDF | 年度/季度分析，不是数据集 |

### 1.6 知识图谱 / 本体 / 数据标准 / Open Insurance

| # | 名称 | 地区 | 内容 | 开放性 | 相对 InsurHOT 的意义 |
|---|---|---|---|---|---|
| 68 | **ACORD NGDS** | 全球 | 面向 API/微服务的 JSON/YAML 标准，覆盖保单、理赔、当事方、保障、核保提交等 [S13][S14]；2025 年推出 NGDS Object Model [S16] | **培训手册等资源仅对会员免费，非会员需联系购买**；白皮书对非会员免费 [S15] | 可以作为概念对齐的参照，但**不能直接开源再分发**（许可条款 NEEDS VALIDATION）|
| 69 | **FIBO（EDM Council）** | 全球 | 金融业务本体，400 多个文件、30 个领域 [S36] | 开源（MIT，NEEDS VALIDATION）| **保险扩展不成熟**（本次未找到正式的保险模块，NEEDS VALIDATION）|
| 70 | **Open Insurance Initiative（OPIN）** | 欧洲 | 社区白皮书，推动开放保险 API 标准 [S17] | 开放 | 活跃度 UNKNOWN |
| 71 | **Open Insurance Brasil（SUSEP）** | 巴西 | Phase 1（2021-12-15 起）：机构、渠道、**产品**等公开数据通过标准化 API 开放，**不涉及个人数据** [S8]；有 API 手册 [S9]；B3 提供 Phase 2 基础设施 [S10]；2026 年已有 2 家 SPOC，但需求低 [S12][S11] | **公开数据 API** | **全球少有的监管强制"产品公开数据 API"**，可作为 InsurHOT 产品 schema 的直接参照和数据源 |
| 72 | **EIOPA Open Insurance / EU FiDA** | 欧盟 | EIOPA 2021 年就开放保险征求意见 [S32]；FiDA 2023 年提案，寿险、健康险数据被排除 [S35]；2026 年仍在谈判/待定 [S34][S35] | 规则层 | 时间线 NEEDS VALIDATION |
| 73 | 学术：**Multi-Agent LLM 本体生成（用保险合同做实验）** arXiv 2604.23090（2026-04）| 美国 | 四角色多智能体生成本体，用 SPARQL/能力问题评估 [S37] | 论文 | 可借鉴"条款 → 本体"的自动化 |
| 74 | 学术：**GrOIL**（寿险领域本体归纳）arXiv 2608.22135 | — | 用图约束 LLM 做寿险本体归纳 [S38] | 论文 | 同上 |
| 75 | 学术：**网络安全保险条款知识图谱** | 美国 | 从网络安全保险保单抽取规则，用道义逻辑建 KG [S39] | 论文 | 条款结构化的方法参考 |

### 1.7 GitHub 开源项目（2026-09 检索）

| # | 仓库 | 星数 | 内容 | 许可 | 意义 |
|---|---|---|---|---|---|
| 76 | **KKKKhazix/AIHOT** | 705 | InsurHOT 的基座：6 类信源、LLM 双评分、同事件聚类、按独立信源计算热度（48h 窗口 / 24h 衰减）、日/周/月报、RSS/API/MCP/`llms.txt` [S53] | MIT（不含品牌）[S53] | 基座 |
| 77 | **zycyyyya/finhot** | 7 | 基于 AIHOT 思路做金融/保险/私募/监管资讯，有 S0–S3 可信度分层，保留原始 URL [S54] | MIT [S54] | **直接的同类先行者**（体量很小）|
| 78 | **AdiaLoveTrance/MedicalInsuranceKG** | 137 | 医疗保险领域知识图谱（2018 年）[S55] | UNKNOWN | 老 demo |
| 79 | **lingerun/KGQA_insurance_product** | 41 | 基于 OpenKG 开源保险产品数据的 KG + 问答，实体包括产品、公司、类别、在售状态、投保年龄、保障期等 [S56] | MIT [S56] | 可参考 schema 的最小集合 |
| 80 | **chriswangweb/KGData** | 127 | 多行业 KG 数据，包含保险 [S57] | UNKNOWN | 数据质量 UNKNOWN |
| 81 | **fabio-rovai/insurance-register-ontology** | 0 | EIOPA 注册库（33,924 行）+ GLEIF LEI，共 276,683 条三元组，OWL/SKOS/SHACL [S58] | 代码 MIT，本体 CC BY 4.0 [S58] | **可直接复用的欧盟保险主体本体** |
| 82 | **SecureLend/mcp-financial-services** | 4 | 贷款、银行、信用卡、保险比较的 MCP 与标准化 schema [S59] | UNKNOWN | 保险 MCP 的早期样例 |
| 83 | **toddshaner/insurancexdate-mcp** | 2 | 工伤险潜客库 + SERFF 费率文件 API 的 MCP 客户端 [S60] | UNKNOWN | "SERFF 数据 → MCP"已有人在做 |
| 84 | **the-up/tsb-kasko-mcp** | 2 | 土耳其 TSB 车险车辆价值表的 MCP，带月度归档 [S61] | MIT [S61] | 监管/协会公开表 → MCP 的样例 |
| 85 | **seaworthy-io/seaworthy-mcp** | 3 | 失能险报价 + 公司/保障研究工具的 MCP（代理机构出品）[S62] | UNKNOWN | 销售导向的 MCP |
| 86 | **MAX-JASON/insurance-news-aggregator**、**marine-insurance-news-tracker** | 0 | 保险新闻聚合小项目 [S63][S64] | UNKNOWN | 几乎没有竞争 |
| 87 | **SamthaCiao/financial-administrative-penalty** | 0 | 银行保险行政处罚案例 KG demo [S65] | UNKNOWN | 与 InsurHOT"监管事件"方向相关 |

---

## 2. 重点深描（15 个最相关条目）

### 2.1 Evident AI Index for Insurance（AI 追踪的标杆）
- **事实**
  - 2026 年是第二版，2026-06-16 发布 [S2]。
  - 评估北美和欧洲 30 家最大的保险公司 [S1]。
  - 四大支柱及权重：Talent 45%、Innovation 30%、Leadership 15%、Transparency 10% [S1]。
  - 采用 **"outside-in"方法，只用公开数据** [S1]。指标数量在索引页写"70+"[S1]，在介绍页写"60+"[S3]，两处不一致。
  - 2026 年排名：Allianz、AXA、Manulife、Zurich、Liberty Mutual [S2][S4]。30 家中有 20 家至少披露了一个"带成果的 AI 用例"；49% 的已披露用例偏窄，集中在提速、降本和流程效率 [S2]。
  - 商业模式：免费发布报告，会员可获得 benchmarking 服务和研究数据 [S1][S2]。
- **对 InsurHOT 的启示**
  - 证明"公开数据 + 固定指标 + 年度排名"能形成行业影响力。
  - **缺口**：不覆盖中国和亚洲；指标明细与逐项证据不对外公开（NEEDS VALIDATION）；年更，不做持续变化检测。
  - InsurHOT 可以做"中国/亚洲版、证据逐条可点击、按季度更新"的 AI 成熟度追踪。

### 2.2 Artemis Deal Directory（结构化目录 + 新闻的范式）
- **事实**：见 1.1 第 3 条；每笔交易有标准字段，可按触发类型、风险、赞助方筛选，另有市场仪表盘；页面显示 2026 年发行 189 亿美元，存量 656 亿美元 [S48]。
- **启示**：InsurHOT 的"商业模式雷达"可以照搬这种形态——**每个"新物种"一条结构化记录**，字段包括首次出现日期、风险承担方、分销、定价/触发机制、资本来源、证据链接，旁边配相关新闻流。Artemis 不开放 API，InsurHOT 可以在开放上做出差异。

### 2.3 Gallagher Re Global InsurTech Report / CB Insights（融资"量"的权威）
- **事实**
  - Q2 2026：24.4 亿美元，AI 类占 99.1%，107 笔交易，(再)保险公司只参与了 27 笔技术投资 [S5]。
  - Q1 2026：16.3 亿美元，AI 类占 95.2%；Q1 2026 报告是其"AI 对(再)保险影响"三年系列的最后一期 [S6][S114]。
  - CB Insights 发布 Insurtech 50 和季度 State of Insurtech [S73]。
- **启示**：这类报告回答"钱投向哪里"，**不回答"哪种商业结构是新的"**。InsurHOT 应把它们当作输入信号，不要在"融资数据库"上正面竞争。

### 2.4 Sønr（B2B 保险创新情报 SaaS）
- **事实**：50 多家一线保险/再保/经纪客户 [S75]；Sønr 2.0 提供保险专用 AI agents、文档库、市场扫描 [S75]；商业模式是平台订阅 + 研究咨询 + 培训 [S75]。
- **启示**：这是 InsurHOT 在"情报平台"上最直接的商业对标。差异化只能来自**公开性、可复现性、中国覆盖和 Agent 接口**；比数据规模，InsurHOT 赢不了。

### 2.5 Defaqto（封闭评级的代表）
- **事实**：10,000+ 产品、75 种以上产品类型 [S19]；星级进入主流比价网站 [S19][S20]；**官网没有披露具体特征数和方法细节** [S18]；Moneyfacts 甚至向厂商提供星级模拟器 [S95]。
- **启示**：英国市场说明"特征级评级"有商业价值。同时也暴露出**方法不透明、厂商可以针对评级优化产品**的问题。InsurHOT 的"公开、版本化、可复现"正好是反面定位。

### 2.6 Franke und Bornberg + Canstar + 10Life（方法论公开的三种程度）
- **事实**
  - F&B 公开各险种的 Bewertungsrichtlinie，只用条款等可核验文件，分 7 档 [S51]。
  - Canstar 按险种发布方法论 PDF，价格和特征都计入 [S93]。
  - 10Life 公开方法论，并声明跨品类不可比、不计服务与理赔体验 [S50]。
- **启示**：业界最透明的做法也只到"公开方法文档"这一步，**没有做到"公开特征数据 + 评分代码 + 版本 diff"**。这正是 InsurHOT Benchmark Engine 的切入点。F&B"只用一手文件"的原则可以直接写进 InsurHOT 的证据规范。

### 2.7 深蓝保（中国最接近"产品基准引擎"的玩家）
- **事实**：深蓝Model（保障分 + 性价比分）；192 项测评细则；150 余人测评团队；200 多个责任模板的"保险字典"[S40]；靠内容吸引用户，再以经纪佣金变现 [S40]。
- **启示**
  - ① 中国市场的产品结构化成本很高（要 150 人规模），InsurHOT 必须用 LLM 抽取加人工校验，并且**从窄品类起步**。
  - ② 深蓝保的"卖方利益冲突"给了 InsurHOT 一个中立定位的空间，前提是不卖保险。
  - ③ 深蓝保的"保险字典 / 责任模板"证明责任级 schema 可行，但它是封闭的。

### 2.8 中保协产品信息库 / 信息披露平台（中国权威源 + 法律约束）
- **事实**：可查询 2009 年以来报备或审批的人身险条款，可验真 [S25]；中保协网站设有"条款费率"等栏目 [S26]；**披露平台声明禁止下载、数据提取和商业使用** [S27]。
- **启示**：这是 InsurHOT 在中国做 Benchmark 和变化检测的**头号合规风险**。建议采取三条路径：
  - ① 争取授权或合作；
  - ② 改用保险公司官网依规公开披露的条款页面作为证据源（合法性 NEEDS VALIDATION，需法律意见）；
  - ③ 只做"链接 + 元数据 + 人工摘录"的最小引用。

### 2.9 SERFF → S&P → ZestyAI（美国"文件情报"价值链）
- **事实**
  - SERFF Filing Access 免费浏览 [S21]。
  - S&P 抽取费率变动和处置数据，通过 API 批量提供 PDF [S23]。
  - ZestyAI 用 AI 分析 200 万份以上文件，强调可追溯引用 [S100]。
  - 社区里已有 SERFF 相关的 MCP 客户端 [S60]。
- **启示**：一手监管文件经过 AI 结构化后带引用输出，**美国市场已经证明这种模式有人付费**。InsurHOT 可以把这种范式搬到"中国及多法域的公开监管事件和产品变更"上，定位为公开层，不与美国付费产品正面竞争。

### 2.10 Axco / CUBE / Wolters Kluwer NILS（跨法域监管情报）
- **事实**
  - Axco 覆盖 220 多个市场，按险种组织监管和税务信息 [S89]。
  - CUBE 追踪 20 国约 2,000 家监管机构，约 1,000 家客户 [S80]。
  - NILS 覆盖美国 50 州，约 7,000 名用户 [S102]。
- **启示**：跨法域监管可比性确实有付费需求，但这些是深度合规产品，InsurHOT 不应复制。可做的是**公开的"监管事件流"**，字段包括监管机构、文种、生效日、影响险种、原文链接，并提供 Agent 接口。

### 2.11 Open Insurance Brasil（监管强制的产品公开数据 API）
- **事实**：Phase 1 的机构、渠道、产品公开数据走标准化 API，不涉及个人数据 [S8][S9]；B3 提供基础设施 [S10]；2026 年的瓶颈是消费者需求低 [S11][S12]。
- **启示**：这是**现成的"产品 schema + 真实 API 数据"**，可作为 InsurHOT 跨法域产品 schema 的第一批映射目标，与 CMS PUF、compareFIRST 字段并列参照。同时也说明**"有 API 不等于有人用"**，InsurHOT 的价值在于聚合、比较和解释。

### 2.12 CMS Exchange PUFs（产品条款级开放数据）
- **事实**：2014–2026 计划年度，共 12 类文件，含福利与自付、费率、计划属性、质量评级等，免费 [S99]。
- **启示**：这是做"可复现基准"演示最理想的数据集，因为开放、多年、结构化。可以先用它把 Benchmark Engine 的方法、代码和数据流水线跑通，再迁移到中国品类。

### 2.13 ACORD NGDS（行业标准，但不开放）
- **事实**：JSON/YAML、面向 API [S13][S14]；资源对会员开放 [S15]；2025 年推出 Object Model [S16]。
- **启示**：InsurHOT 的开放 schema 应该在**概念层**与 ACORD 对齐（policy、coverage、party、claim），而**不复制其规范文本**，以免触碰许可问题（NEEDS VALIDATION）。这样既显得专业，也能在开放上形成差异。

### 2.14 AIHOT 与 finhot（基座与同类）
- **事实**：AIHOT 提供 LLM 双评分、同事件聚类、按独立信源的热度、RSS/API/MCP/`llms.txt`，MIT 许可 [S53]；finhot 已经把这套思路用于金融/保险资讯，有 S0–S3 信源分层，保留原始 URL [S54]。
- **启示**：新闻聚合层没有技术壁垒，任何人都能 fork。**InsurHOT 的壁垒必须建在"结构化数据资产 + 方法论 + 证据链"上，而不是聚合本身。**

### 2.15 EIOPA 注册库本体（fabio-rovai）
- **事实**：33,924 行注册数据 + GLEIF，276,683 条三元组，本体 CC BY 4.0 [S58]。
- **启示**：欧盟保险主体主数据可以直接复用，加快"公司实体消歧"的落地。中国侧需要自建"保险机构主数据"，包括法人、统一社会信用代码、牌照类型、母子关系。

---

## 3. 分析

### 3.1 已经解决得较好的问题
1. **新闻时效与覆盖（英文圈）**：有免费高频源和分类 RSS [S66][S71]，也有付费深度源 [S69][S70]。
2. **融资与创投统计**：季度融资、AI 占比、交易数都有权威发布 [S5][S6][S73]；公司数据库规模很大 [S74]。
3. **宏观市场统计**：sigma explorer [S76]、OECD [S90]、IAIS [S91]、NFRA 月度数据 [S86]。
4. **单一法域的产品评级**：英 [S18][S95]、澳 [S93]、德 [S51][S52]、港 [S50]、中（商业化）[S40]。
5. **美国监管文件的检索与 AI 分析（付费）**：[S23][S100][S102]。
6. **保险公司信用评级**：[S79]。
7. **企业间数据交换标准**：[S13]。

### 3.2 解决得不好的问题（InsurHOT 的机会）

| 问题 | 现状证据 | 判断 |
|---|---|---|
| **证据可追溯** | 媒体输出的是文章，最多附原文链接 [S106]；Defaqto 方法不透明 [S18]；中国公众号榜单不开放数据 [S42]；只有 ZestyAI 等付费产品强调"可追溯引用"[S100] | **公开的"论断级证据链"几乎不存在**：论断 → 一手文件、段落定位、快照、抓取时间 |
| **跨法域可比** | 各国评级只在本国成立 [S18][S50][S51][S93]；10Life 连本平台跨品类都不可比 [S50]；跨法域比较只有 Axco 这类付费合规产品 [S89] | 缺一套**开放的跨法域产品 schema**。可参照 compareFIRST [S28]、보험다모아 [S30]、巴西 Phase 1 [S8]、CMS PUF [S99] 做映射 |
| **公开、可复现的产品基准** | 最透明的也只公开方法文档 [S51][S93][S50]；存在佣金/销量导向 [S96][S97][S40]；厂商能对着评级优化产品 [S95] | **"数据 + 代码 + 版本 + 变更日志"四件套全部公开的基准 = 空白** |
| **结构化商业模式追踪** | 创投库按赛道和融资分类 [S73][S74][S108]；评选只给名单 [S46]；Artemis 在 ILS 细分中实现了结构化 [S48] | **没有"商业模式原语"分类法，也没有"新物种首次出现"的登记簿** |
| **变化检测** | 美国文件变化靠付费产品 [S23][S100]；Evident 年更 [S2]；中国产品库禁止提取 [S27] | 公开的**结构性变化**检测（条款版本、监管口径、商业模式迁移）是空白 |
| **Agent 可用的结构化保险数据** | 开放数据分散在各处 [S99][S58][S8]；GitHub 上的保险 MCP 都很小，且是厂商或单一数据源 [S59][S60][S61][S62] | **"带出处的保险领域 MCP"尚无成熟公共产品** |
| **中国/亚洲 AI 成熟度追踪** | Evident 只覆盖北美和欧洲 [S1] | 明确空白 |

### 3.3 InsurHOT 能现实地建立的独特资产（按"可行性 × 差异性"排序）

1. **Evidence Graph（证据链图谱）**——短期可落地
   - 在 AIHOT 的"事件聚类"[S53]之上增加一层"论断"：每个事件拆成若干论断，每条论断绑定一手来源（监管公告、公司公告、条款或文件），附快照、哈希、抓取时间、信源分级（可参考 finhot 的 S0–S3 分层 [S54]）。
   - 对外通过 API/MCP 返回带引用的结构化结果。
2. **中国/亚洲保险公司 AI 成熟度追踪（outside-in）**——短中期
   - 借鉴 Evident 的支柱与权重结构 [S1]，但做到三点：**指标逐项公开、证据逐条可点击、按季度更新**。
   - 数据源：年报、招聘信息、专利、官方用例披露。
3. **InsurHOT Open Product Schema + Benchmark Cards**——中期
   - 概念层对齐 ACORD [S13]，字段层映射巴西 Phase 1 [S8]、CMS PUF [S99]、compareFIRST [S28]。
   - 先用 CMS PUF 跑通"可复现基准"流水线：方法文档、评分代码、数据版本、变更日志。然后迁移到中国的 1–2 个窄品类，例如百万医疗或定期寿险。
   - 方法论披露以 F&B [S51] / Canstar [S93] 为下限。
   - **坚持不卖保险**，与深蓝保、Policybazaar、价格.com 形成中立差异 [S40][S96][S97]。
4. **商业模式原语分类法 + "新物种"登记簿**——中期
   - 形态参照 Artemis Deal Directory [S48]。
   - 每条记录包含：风险承担方、分销控制点、定价/触发机制、资本来源、数据来源、监管牌照形态、首次证据日期、证据链接。
   - 输入信号来自 Gallagher Re、CB Insights [S5][S73] 和新闻流。
5. **结构化监管事件流（中国 + 多法域）**——短中期
   - NFRA 处罚 [S85]、偿付能力披露 [S87]、美国 NAIC AI 公告采纳进度 [S82] 等，做成字段化的开放数据集。
   - 与 PwC 这类年度分析报告 [S85] 形成互补。
6. **保险主体主数据**——基础设施
   - 欧盟直接复用 [S58]；中国自建。所有其他资产都依赖这一层做实体消歧。
7. **Agent 接口**
   - 在 AIHOT 已有的 MCP/`llms.txt` 上 [S53]，提供以下工具：`get_event_with_evidence`、`compare_products(schema_version)`、`list_new_species`、`regulatory_changes(since)`。

### 3.4 关键风险与约束
- **数据许可**
  - 中保协平台禁止数据提取 [S27]；
  - 付费媒体（The Insurer、Insurance Insider）只能引用标题加链接 [S69][S70]；
  - ACORD 规范为会员资源 [S15]；
  - SERFF 批量访问条款不明（NEEDS VALIDATION）。
  - → 必须建立"来源许可登记表"，逐源标注允许的用途。
- **中立性与合规**：在中国发布产品"测评/排名"是否触及互联网保险营销的监管要求，需要法律意见（NEEDS VALIDATION）。
- **成本**：深蓝保用 150 余人做结构化 [S40]，说明"全品类覆盖"不可行。**窄品类、深结构、全公开**是更现实的路径。
- **护城河**：聚合层可以被轻易 fork（finhot 已有先例 [S54]）。壁垒在于长期积累的**版本化数据、方法公信力和证据链**。

---

## 4. UNKNOWN / NEEDS VALIDATION 汇总
- Insurance Journal RSS 的使用条款；Reinsurance News、Carrier Management、Coverager 的 RSS 可用性。
- Crunchbase 的保险数据细节（本次未检索）。
- Gallagher Re 报告的数据供应方，以及报告是否全文免费。
- Defaqto 与 Moneyfacts 的授权/收费结构细节。
- 10Life、compareFIRST、보험다모아是否提供 API 或数据下载。
- SERFF Filing Access 对自动化/批量访问的条款。
- Insuraviews 的详细信息（Dealroom 页面返回 403）。
- FIBO 是否有正式的保险模块；ACORD NGDS 的许可能否用于开源映射。
- FiDA 在 2026-09 时点的最终状态与保险范围。
- 中国：北京商报保险、保险一哥、保险文化、蜗牛保险、多保鱼、沃保的定位与数据；北大法宝和威科先行是否提供 API；中国银保信产品查询的覆盖范围；保险公司官网公开条款能否被机器抓取和再发布（法律）。
- 中国关于第三方保险产品"测评/排名"的监管边界。

---

## Sources

- [S1] https://evidentinsights.com/insurance-ai-index
- [S2] https://evidentinsights.com/insights/insurance-ai-index-2026-report/
- [S3] https://dr.evidentinsights.com/insurance-ai-index/
- [S4] https://allianz.com/en/mediacenter/news/articles/260616-allianz-ranked-first-in-2026-evident-ai-Index-for-insurance.html
- [S5] https://www.reinsurancene.ws/insurtech-funding-hits-four-year-high-as-ai-firms-capture-99-of-investment-gallagher-re/
- [S6] https://www.reinsurancene.ws/global-insurtech-funding-holds-firm-as-ai-dominates-q126-investment-gallagher-re/
- [S7] https://www.theinsurer.com/ti/news/insurtech-funding-hits-highest-quarterly-total-since-q3-2022-gallagher-re-2026-02-12/
- [S8] https://legismap.com.br/conteudos/artigos-e-noticias/susep-inaugura-o-open-insurance-implementacao-da-fase-1-inicia-se-hoje-15-de-dezembro-de-2021 ; https://prensali.substack.com/p/fase-1-do-open-insurance-esta-em-andamento
- [S9] https://www.gov.br/susep/pt-br/assuntos/open-insurance/arquivos/ManualdeAPIs1_5.pdf
- [S10] https://www.b3.com.br/pt_br/solucoes/plataformas/produtos-e-servicos-para-seguros/open-insurance/
- [S11] https://cqcs.com.br/noticia/open-insurance-avanca-em-2026-e-pode-transformar-atuacao-dos-corretores/
- [S12] https://www.letsmoney.com.br/noticias/open-insurance-spocs-demanda-escala/
- [S13] https://acord.org/standards-architecture/acord-data-standards/next-generation-digital-standards ; https://apis.apievangelist.com/store/acord-ngds-api/
- [S14] https://www.acord.org/news-detail/2020/02/10/introducing-acord-next-generation-digital-standards
- [S15] https://acord.org/marketplace-pages/product-detail/acord-ngds-introduction-training-manual
- [S16] https://norfolkdailynews.com/online_features/press_releases/acord-2025-member-report-shows-increased-member-engagement-and-commitment-to-digital-first-future-for/article_3769de0a-51d9-5127-b231-8eaa570e16a8.html
- [S17] https://openbankingexpo.com/reports/report-open-insurance-white-paper
- [S18] https://www.defaqto.com/solutions/star-rating
- [S19] https://blog.howdeninsurance.co.uk/defaqto-rating-explained ; https://theaa.com/insurance/defaqto-ratings-faq
- [S20] https://insurance-edge.net/2023/11/01/defaqto-extends-partnership-with-moneysupermarket/
- [S21] https://aldoi.gov/RatesForms/SERFFsPublicAccess.aspx ; https://serff.com/serff_filing_access.htm
- [S22] https://content.naic.org/industry/serff
- [S23] https://www.marketplace.spglobal.com/en/datasets/snl-insurance-product-filings-(1733129635)
- [S24] https://www.insurance.state.pa.us/dsf/rf_filings.html
- [S25] https://life.pingan.com/upload/file/changjianwenti.pdf ; https://cs.com.cn/bx/202202/t20220211_6241536.html
- [S26] https://www.iachina.cn/
- [S27] https://icidp.iachina.cn/
- [S28] https://www.lia.org.sg/tools-and-resources/comparefirst/
- [S29] https://blog.moneysmart.sg/life-insurance/comparefirst-platform-insurance
- [S30] https://www.fsc.go.kr/po010101/72454
- [S31] https://newstomato.com/ReadNews.aspx?no=604133
- [S32] https://www.regulationtomorrow.com/2021/02/eiopa-launches-a-public-consultation-on-open-insurance/
- [S33] https://www.milliman.com/en/insight/open-insurance-fida-regulation-insurer-data-strategy
- [S34] https://www.finapi.io/en/fida-regulation-status-pending/ ; https://paytechlaw.com/en/whats-next-for-fida/
- [S35] https://www.fiskil.com/open-finance-tracker/standard/fida ; https://blogs.pwc.de/en/insurance-news/article/251970/fida-im-fokus-politische-unsicherheit-und-strategische-weichenstellungen-fuer-versicherungen/
- [S36] https://dil-edmcouncil.atlassian.net/wiki/spaces/FIBO/pages/7995531/Welcome+to+spec.edmcouncil.org+fibo ; https://topquadrant.com/blog/best-approaches-for-using-and-extending-fibo-vocabulary
- [S37] https://arxiv.org/abs/2604.23090
- [S38] https://arxiv.org/pdf/2608.22135
- [S39] https://par.nsf.gov/servlets/purl/10143552
- [S40] https://news.pedaily.cn/20230113/49879.shtml ; https://www.bjnews.com.cn/detail/1770258653168304.html ; https://www.163.com/dy/article/L3IGDIPV0536ATJH.html ; https://www.jiemian.com/article/14789655.html
- [S41] https://pitchhub.36kr.com/project/1678445990163463
- [S42] https://cj.sina.com.cn/articles/view/6363707782/17b4e79860190162p2 ; https://econ.pku.edu.cn/xkzy/fxglybxxx/xkdt3/329932.htm
- [S43] http://www.cbimc.cn/
- [S44] https://www.lanjinger.com/d/197607
- [S45] https://news.bjd.com.cn/2023/01/13/10300120.shtml
- [S46] https://news.pedaily.cn/20251224/120871.shtml
- [S47] https://www.woshipm.com/it/2955483.html ; https://www.jiemian.com/article/13798409.html
- [S48] https://www.artemis.bm/deal-directory/
- [S49] https://www.artemis.bm/news/27-years-of-artemis-nearly-220bn-of-cat-bonds-and-ils-tracked-in-our-deal-directory/
- [S50] https://www.10life.com/en/scoring-methodology ; https://www.10life.com/en/faq/methodology
- [S51] https://franke-bornberg.de/sites/franke-bornberg/files/rating-bewertungsrichtlinien/2024-11-07-fub-bewertungsrichtlinie-kfz.pdf ; https://www.dasinvestment.com/rating-franke-und-bornberg-kfz-versicherung-tarife/
- [S52] https://www.test.de/Berufsunfaehigkeitsversicherung-im-Test-4881349-6118464/
- [S53] https://github.com/KKKKhazix/AIHOT
- [S54] https://github.com/zycyyyya/finhot
- [S55] https://github.com/AdiaLoveTrance/MedicalInsuranceKG
- [S56] https://github.com/lingerun/KGQA_insurance_product
- [S57] https://github.com/chriswangweb/KGData
- [S58] https://github.com/fabio-rovai/insurance-register-ontology
- [S59] https://github.com/SecureLend/mcp-financial-services
- [S60] https://github.com/toddshaner/insurancexdate-mcp
- [S61] https://github.com/the-up/tsb-kasko-mcp
- [S62] https://github.com/seaworthy-io/seaworthy-mcp
- [S63] https://github.com/MAX-JASON/insurance-news-aggregator
- [S64] https://github.com/dellmastercode2025/marine-insurance-news-tracker
- [S65] https://github.com/SamthaCiao/financial-administrative-penalty
- [S66] https://www.insurancejournal.com/rss/
- [S67] https://amp.insurancejournal.com/news/national/2013/02/22/282482.htm ; https://www.carriermanagement.com/tag/wells-media-group/
- [S68] https://coverager.com/advertise ; https://insurtechdigital.com/top10/top-10-insurtech-newsletters
- [S69] https://www.theinsurer.com/?p=20665 ; https://www.theinsurer.com/?p=36777 ; https://media.info/newspapers/news/thomson-reuters-acquires-b2b-insurance-focused-world-business-media
- [S70] https://www.ecipartners.com/our-companies/insurance-insider ; https://www.delinian.com/?p=1205 ; https://www.insuranceinsiderus.com/subscribe
- [S71] https://www.reinsurancene.ws/about
- [S72] https://www.cbinsights.com/investor/insurtech-insights ; https://financemalta.org/events/insurtech-insights-europe-2026
- [S73] https://www.cbinsights.com/research/insurtech ; https://www.insurtechny.com/insurtech-weekly-news-roundup-may-3-2026/
- [S74] https://www.trustradius.com/products/tracxn/details
- [S75] https://sonr.global/?p=27796 ; https://beinsure.com/news/sonr-pzu-collaboration/ ; https://insurtech.podbean.com/e/what-50-carriers-know-that-you-don-t-inside-s%c3%b8nr/
- [S76] https://cgd.swissre.com/institute/research/sigma-research/data-explorer.html ; https://ndcpartnership.org/knowledge-portal/climate-toolbox/sigma-explorer
- [S77] https://insurance-canada.ca/2023/06/22/aite-novarica-group-rbr-rebrand-datos-insights/
- [S78] https://www.celent.com/subscriptions ; https://sharecast.com/amp/news/aim-bulletin/globaldata-inks-deal-to-acquire-celent--18333746.html
- [S79] https://www.icmif.org/supporting_members/am-best/ ; https://www.businesswire.com/news/home/20220505006123/en/AM-Best-Adds-Solvency-II-Non-Life-Underwriting-by-Line-of-Business-Analysis-Feature-to-Bests-Financial-Suite-Solvency-II
- [S80] https://hgcapital.com/insights/cube-acquires-global-regulatory-intelligence-businesses-from-thomson-reuters ; https://www.fintechfutures.com/regulatory-actions/ai-powered-regtech-cube-acquires-global-regulatory-intelligence-enterprises-from-thomson-reuters
- [S81] https://content.naic.org/article/how-file-complaint-and-research-complaints-against-insurance-carriers
- [S82] https://content.naic.org/sites/default/files/legal-adoption-map-ai-model-bulletin.pdf ; https://quarles.com/newsroom/publications/nearly-half-of-states-have-now-adopted-naic-model-bulletin-on-insurers-use-of-ai
- [S83] https://www.lib.u-tokyo.ac.jp/en/node/47621 ; https://www.cityu.edu.hk/lib/eres/database/info/pkulaw_chi.htm
- [S84] https://wkinfo.com.cn/
- [S85] https://www.cs.com.cn/bx/202310/t20231024_6372082.html ; https://www.ctdsb.net/c1666_202306/1778158.html ; https://www.pwccn.com/zh/industries/financial-services/insurance/publications/analysis-regulatory-penalties-insurance-jan2024.html
- [S86] https://www.chinabaogao.com/data/202607/807837.html
- [S87] https://www.gov.cn/gongbao/2024/issue_11546/202408/content_6970963.html ; https://www.nbd.com.cn/articles/2018-11-02/1268908.html
- [S88] https://www.eiopa.europa.eu/eiopa-publishes-new-set-solvency-ii-statistics-european-insurance-sector-2017-11-13_de ; https://www.financialinstitutionsnews.com/2017/06/30/eiopa-publishes-first-solvency-ii-statistics/
- [S89] https://www.axcoinfo.com/products/insight/ ; https://axcoinfo.com/products/insight-compliance/
- [S90] https://www.oecd.org/en/publications/serials/oecd-insurance-statistics_g1g31355.html
- [S91] https://www.iais.org/uploads/2026/07/Global-Insurance-Market-Report-2026-mid-year-update.pdf
- [S92] https://reinsurancene.ws/ai-creates-new-competitive-dynamics-across-the-insurance-sector-mckinsey-company
- [S93] https://cdn.canstar.com.au/wp-content/uploads/2021/09/Health-Insurance-Star-Ratings-and-Awards-Methodology-Document.pdf ; https://cdn.canstar.com.au/wp-content/uploads/2018/05/2018-Car-Insurance-Methodology-130418.pdf
- [S94] https://www.which.co.uk/policy-and-insight/article/cover-that-wont-take-you-for-a-ride-which-reveals-the-best-car-insurance-policies-aconV3n1PP5v ; https://www.finder.com/uk/methodology-for-insurance-ratings
- [S95] https://www.moneyfactsgroup.co.uk/media/umtkjaxn/star-ratings-leaflet_2026.pdf ; https://moneyfactsgroup.co.uk/media-centre/star-ratings/car-insurance-star-ratings-2026/
- [S96] https://en.wikipedia.org/wiki/Policybazaar ; https://www.hdfcsec.com/hsl.docs/PB%20Fintech%20-%20Update%20-%20Jun26%20-%20HSIE-202606010635031047409.pdf
- [S97] https://hoken.kakaku.com/award/ ; https://www.oricon.co.jp/pressrelease/2968444/ ; https://hoken.kakaku.com/contents_policy/
- [S98] https://www.nerdwallet.com/l/ratings-methodology-for-home-insurance ; https://insurify.com/car-insurance/policygenius-review/
- [S99] https://www.cms.gov/marketplace/resources/data/public-use-files
- [S100] https://zesty.ai/resource/insurance-filings-overlooked-dataset-competitive-advantage ; https://fintech.global/2026/05/12/standard-casualty-taps-zestyai-for-competitor-analytics/
- [S101] https://app.dealroom.co/companies/insuraviews （仅搜索摘要，页面 403）
- [S102] https://www.wolterskluwer.com/en/solutions/onesumx-for-compliance-program-management/nils-insource
- [S103] https://www.arizent.com/news/arizent-appoints-daniel-wolfe-as-editor-in-chief-of-digital-insurance ; https://www.dig-in.com/about-us
- [S104] https://insurancebusinessmag.com/asia/about-us
- [S105] https://intelligentinsurer.com/about
- [S106] https://buttondown.com/kevingkday/archive/binderbrief-daily-june-11-2026-9-stories/
- [S107] https://www.roots.ai/subscribe/newsletter/rooted-in-ai ; https://inboxreads.co/n/ai-insurer-brier
- [S108] https://www.economyup.it/fintech/insurtech/ecco-chi-sono-i-disruptor-e-i-pionieri-dell-insurtech/
- [S109] https://dealroom.co/blog/embedded-insurance-ready-to-take-off
- [S110] https://cs.com.cn/bx/202307/t20230725_6357638.html
- [S111] https://www.163.com/dy/article/L3IV1HTU0512C3L0.html
- [S114] https://www.globalreinsurance.com/home/gallagher-re-ai-projects-capture-95-of-q1-insurtechs-funding-as-sector-rebound-continues/1458477.article
