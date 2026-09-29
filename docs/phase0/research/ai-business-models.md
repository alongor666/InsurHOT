# InsurHOT Phase-0 研究：AI 保险商业模式雷达 / 「保险新物种」分类与判定框架

- 研究日期：2026-09-29
- 研究范围：2015–2026 年案例，重点 2023–2026
- 证据规则：每条事实性陈述后用 `[S#]` 标注来源，完整 URL 见文末「Sources」。一手来源（SEC/HKEX 披露、监管机构文件、公司官方公告）优先；行业媒体为二手；聚合站点（sacra、clay、dealroom 等）为三手，只作线索。
- 标注约定：**UNKNOWN**＝没有找到公开证据；**NEEDS VALIDATION**＝只有二手或三手来源，或来源之间互相矛盾，需要回到一手来源核实。
- 局限：本轮 WebSearch 配额中途用完（200/200）。Boost、Openly 2025 融资、Tokio Marine 细节、Metromile 历史亏损、各公司成立年份等几项因此没能补查，都已在文中标注。

---

## 0. 核心结论

1. **「使用 AI」和「AI 改变商业模式」在公开证据里可以分开。** 大多数被称为「AI-native」的公司，其 AI 的可验证作用集中在 **成本结构**（理赔、客服、承保人效）和 **定价精度** 上。风险由谁承担、钱怎么赚，并没有因为 AI 而改变。例如：Lemonade 的 LAE 比率从 2022 年第三季度的 13% 降到 5%，55% 的理赔自动化 [S1][S3]；众安健康险 99% 自动核保、45% 以上理赔自动审核 [S47]；平安 AI 坐席承担约 80% 的客服量 [S52]。这些都是 **L2（核心流程自动化）**，属于强力优化，不是新物种。
2. **真正改变了商业模式要素的，多数来自「数据/触发/交易结构」，AI 不一定是必要条件。** 参数化保险改变的是理赔触发（Descartes、FloodFlash、Blink）[S38][S39][S41]，核心在指数和传感器，AI 只是辅助。Kin 的互惠交换所（reciprocal）、Hippo 的混合 fronting、Lemonade 的「Synthetic Agents」改变的都是资本和收入结构 [S16][S13][S7][S8]，和 AI 无关。**Lemonade 的「Synthetic Agents」是获客成本（CAC）融资安排，不是 AI 代理**，是典型的命名误导 [S7][S8]。
3. **最接近「没有 AI 就不可能」（L4）的，是反向类别：为 AI 风险承保（Insurance FOR AI），而且其中带可度量触发的形态最有说服力。** Munich Re aiSure 用「类参数化」结构承保模型性能偏差 [S74]；AIUC 把「认证标准 + 审计 + 保险」打包 [S73]；Armilla/Chaucer、Testudo、Relm、Vouch、Corgi 提供肯定性 AI 责任险 [S72][S75][S76][S64][S65]。与此同时，Verisk 从 2026 年 1 月起推出通用责任险的 GenAI 除外条款（CG 40 47 / CG 40 48 / CG 35 08）[S79]，AIG、W.R. Berkley、Great American 也向美国监管申请 AI 除外 [S80]。结果是 **传统保单撤出、专业 MGA 接手** 的结构性空缺。
4. **「Agentic insurance」（AI 代理买卖保险、代理对代理）到 2026 年 9 月仍处于分销入口层，主要是报价，没有看到公开证据表明 LLM 内已能完成闭环出单。** Tuio 的 ChatGPT 应用只给「非约束性」方案，出单要跳回官网 [S68]；Insurify 的 ChatGPT 应用在部分州提供完整报价 [S68]；ACORD 和 Socotra 推出 MCP 接口 [S69]；蚂蚁保「蚁小保」自称无佣金导向的顾问 [S51]。**UNKNOWN：没有找到 AI 代理代表买方自主完成绑定（bind）并支付的公开保险案例。**
5. **失败和退却案例说明，「AI 叙事」不能替代承保纪律和资本结构。** wefox 估值 45 亿美元后出售多国实体 [S45]；Hippo 2023 年净损失率 169%、亏损 2.73 亿美元 [S14]；Lemonade 2022 年毛损失率 90% [S5]；Root 2021、2022 年分别亏损 5.21 亿、2.98 亿美元 [S12]；相互宝在监管收紧、分摊额三年涨约 200 倍后关停 [S50]；Bestow 出售承保和 C 端业务、转型 SaaS [S61]。这些公司改善时，往往靠 **提价、退出州、调整产品组合、再保和 fronting**，AI 贡献难以单独识别 [S13][S11]。
6. **建议把候选分类重组为「两条主轴 + 一条反向轴」**：A 轴看 AI 作用于哪个要素（成本/定价/承保/触发/交易/风险承担）；B 轴看改变程度（L0–L4）；另设「AI 作为风险标的」反向轴（A0–A4）。「Insurance-as-an-API」「嵌入式」「AI 经纪」这类渠道形态放进 **交易结构维度**，不作为「新物种」的独立判据。

---

## 1. 现有分类学与监管框架综述

| 文献/报告 | 核心框架 | 对 InsurHOT 的用处 | 局限 |
|---|---|---|---|
| Eling & Lehmann (2018), *Geneva Papers* 43(3):359–396 [S82] | 用 Porter 价值链 + Berliner 可保性准则分析 84 篇文献。结论为四项任务（客户体验、流程、新产品、跨行业竞争）和三类可保性变化：信息增加对信息不对称和风险池的影响、新技术对频率和严重度的影响、互联带来的系统依赖 [S82] | 给出「价值链位置 × 可保性」双维度，可直接用来判断 AI 是否 **改变可保性**（L3/L4 判据） | 早于 GenAI 和 agentic AI |
| Braun & Schreiber (2017), I.VW-HSG Schriftenreihe Vol. 62（与 Swiss Re Institute 合作）[S83] | 三维分类筛查 insurtech 初创；发现多数活动集中在分销端，全栈 insurtech 风险载体增多；P2P 和资本市场直连可能去中介 [S83] | 「是否为风险载体」是关键维度，与本框架的 Risk carrier 变量一致 | 2017 年样本，已过时 |
| Stoeckli, Dremel & Uebernickel (2018), *Electronic Markets* 28(3):287–305 [S84] | 扎根理论，208 个 InsurTech 创新 → 52 个特征、14 种转型能力；颠覆潜力来自三类相互依赖活动的对齐，并解释数字中介进入个人险市场 [S84] | 可复用「特征 → 能力 → 价值创造」的编码方式 | 以个人险为主 |
| Cosma & Rimo (2024), *Research in International Business and Finance* 70:102301 [S85] | 对 156 篇 2016–2022 年文献做文献计量和系统综述；发现研究高度集中在 AI 和区块链；认为动态承保和 PAYD/PHYD 会用连续自适应定价取代年度保费 [S85] | 支持「动态/UBI/连续承保」合并为一类 | 综述性质，没有给出商业模式判定标准 |
| Sosa & Sosa (2025), *Risks* 13(6):108 [S86] | 364 家 InsurTech（2020–2023）网络分析 → 七种原型：Enablers、Innovators、Connectors、Integrators、Protectors、Transformers、Disruptors；另有五阶段演化（数字化 → 客户中心 → 数据分析 → 平台 → 生态合作）[S86] | 原型名称可作为 InsurHOT 实体标签的参考 | 原型按网络角色划分，不区分「AI 是否必要」 |
| OECD (2020) *The Impact of Big Data and AI in the Insurance Sector* [S88] | 讨论大数据/AI 的收益与风险；指出数据颗粒度可能改变整个保险生产流程，并引用 OECD AI 原则和欧盟可信 AI 准则 [S88] | 提供「个体化定价 vs 风险池」的公共政策视角 | 不是商业模式分类 |
| EIOPA (2019) 大数据分析专题审查 [S89] | 调查 222 家机构：31% 已在车险/健康险中使用 AI/ML 等 BDA 工具，24% 处于 PoC；远程信息数据等新数据源推动定制化 [S89] | 提供欧洲的基线采用率 | 2019 年数据 |
| EIOPA (2024) 数字化市场监测；(2025) GenAI 调查 [S90] | 各家数字化成熟度差异大；2025 年专门调查 GenAI 的采用与治理 [S90] | 可作为监管侧数据源 | 汇总层面，不点名个案 |
| EIOPA (2025-08-06) AI 治理与风险管理意见（EIOPA-BoS-25-360）[S91] | 按风险为本、比例原则解释 IDD/Solvency II 在 AI 上的适用；指出欧盟 AI Act 把寿险和健康险的风险评估与定价 AI 列为高风险 [S91] | 定义「AI 改变承保/定价」在欧盟的合规成本和边界 | 治理框架，不是商业模式框架 |
| IAIS (2025-07-02) AI 监管应用文件 [S92] | 五个主题：风险为本与比例原则、治理与问责、稳健安全、透明可解释、公平伦理与救济；明确提到 agentic AI；**不提出新标准** [S92] | 适合作为 InsurHOT 的监管合规维度标签 | 同上 |
| NAIC AI 模型公告（2023-12 通过）[S93] | 要求书面 AI 计划，覆盖治理、消费者告知、风控内控、第三方管理；截至 2025 年 3 月约 24 个州基本原样采纳 [S93] | 美国各州 AI 治理的采用追踪指标 | 同上 |
| Geneva Association「Insurance in the Age of AI」系列：(1) 2025-10-02《Gen AI Risks for Businesses》；(2) 2025-11-20《Gen AI in the Insurance Customer Journey》[S81] | 调查六国 600 名企业保险决策者：71% 已在至少一个职能部署 GenAI；超过 90% 对 GenAI 风险保障感兴趣，三分之二愿付至少高 10% 的保费；可保性难点在风险难以验证、潜在巨损，与网络险相似；保险公司同时在做保单扩展和独立 AI 产品，建议模块化和跨界合作 [S81] | 是「为 AI 风险承保」反向类别最权威的行业需求证据 | 需求调查，不等于成交数据 |

**综述结论：** 现有学术和监管框架要么按 **价值链位置** 分（Eling & Lehmann、Braun & Schreiber），要么按 **生态角色** 分（Sosa & Sosa），要么是 **治理框架**（EIOPA、IAIS、NAIC）。**我们没有找到任何一个框架给出可操作、基于公开证据的「AI 是否改变商业模式」判定标准**。InsurHOT 可以在这里建立差异化方法论。补充一点：arXiv 上有 2026 年 7 月的《Underwriting the Agent Economy: The Blueprint for an AI Insurance Stack》（arXiv:2607.11999），本轮没有读全文，**NEEDS VALIDATION** [S94]。

---

## 2. 候选分类逐项检验与修订建议

| 候选类别 | 证据检验结论 | 建议 |
|---|---|---|
| AI-native insurer（持牌承保人） | 有真实案例：Lemonade（自有承保公司，另有欧洲实体）[S3]、Corgi（加州 admitted P&C 承保人 NAIC #17989 + 风险自留集团）[S65]、众安（互联网财险公司）[S47]、Getsafe（2021 年获 BaFin 牌照）[S46]、Tesla Property & Casualty [S42]。但这些公司的「AI-native」在公开证据里主要体现为费用和理赔效率 | **保留，但改名为「全栈数字/AI 承保人」**，并强制标注：风险自留比例（再保分出率）、AI 可验证贡献 |
| AI-native MGA/MGU | 大量案例：Coalition（MGA，2026 年接手 Allianz 商业网络险）[S23][S25]、Ominimo（TechCrunch 称其为 Zurich 的 MGA）[S67]、Descartes（A+ 承保人支持的 MGA）[S38]、Armilla/Testudo（Lloyd's coverholder）[S72][S75]、Nirvana（「carrier and MGA」，二手来源）[S31] | **保留**。关键区别是 **风险最终由谁承担**，必须拆开「承保决策权」和「资本」 |
| Agentic insurance（AI 代理买卖/服务、代理对代理） | 2025–2026 年有入口层案例：Tuio 和 Insurify 在 ChatGPT 内报价 [S68]，ACORD MCP 支持经纪人代理与保险公司代理交换报价、确认订单和可绑定数据（官方表述为「潜在用途」）[S69]，Allianz Nemo 用 7 个代理处理低复杂度理赔 [S70]。**没有找到买方 AI 代理自主完成出单的公开案例（UNKNOWN）** | **拆成两类**：(a) 「LLM 界面分销」，属于交易结构维度，当前多为 L1–L2；(b) 「代理对代理交易」，列入观察名单（watchlist），要有绑定和支付证据才能升级 |
| AI broker / AI agent distribution | Harper：持牌商业险代理，佣金收入，对接 160 多家承保人，每月超过 1,000 个客户（传统经纪约 20–30 个）[S66]；元保、水滴：中国互联网保险中介，用 AI 做核保、客服、理赔辅助 [S48][S49] | **保留**。收入来源仍是佣金，改变的是 **单位服务成本和可服务长尾市场**，一般评 L2–L3 |
| Embedded insurance | bolttech（39 个市场、约 700 个分销伙伴、230 多家保险公司）[S55]、Cover Genius/XCover [S58]、Qover（Revolut）[S57]、Igloo（累计超过 6 亿张保单）[S56]、Root（合作与独立代理渠道占新单 51%）[S11] | **保留为「交易结构」类型**。AI 不是嵌入式保险的必要条件，默认按 L1 起评 |
| Dynamic / UBI / continuous underwriting | Root（370 亿英里驾驶数据）[S11]、Tesla Safety Score 每月评分 [S42]、Nirvana（300 亿英里以上卡车数据 + 实时远程信息）[S31]、Lemonade 按 FSD 与人工驾驶里程分别计价 [S9] | **与「Continuous risk management」合并为「行为/连续定价」**；数据源改变了定价依据，可到 L3 |
| Parametric insurance | Descartes（2025 年 GWP 超过 2.5 亿美元，600 多家客户）[S38]、FloodFlash（传感器触发，赔付约 10 小时）[S39]、Arbol（2023 年承保名义风险超过 10 亿美元）[S40]、Blink（航班延误按分钟即时赔付）[S41] | **保留，但注明「AI 非必要」**：改变的是理赔触发，AI 或卫星数据只增强指数设计 |
| AI underwriting as a service | Sixfold（Zurich、AXIS 等客户）[S34]、Federato [S35]、Pibit.ai [S60]、Bestow（SaaS）[S61] | **归入「赋能层（Enabler）」**，不列为保险新物种。它们改变的是 **保险公司的成本结构**，按客户侧效果评级 |
| Autonomous / straight-through claims | Lemonade（AI Jim 在 96% 的情况下接收 FNOL，55% 理赔自动化）[S3]、众安（健康险理赔最快 15 秒结案）[S47]、平安（93% 自动审核理赔案件 60 秒内定责，二手来源）[S52]、Shift Claims [S37]、Tractable [S36] | **降级为「能力（capability）」而不是商业模式**。只有触发机制本身改变时，才进入「触发」维度 |
| AI risk prevention / active insurance | Coalition（持续扫描、预警、事故响应；自称索赔频率低于行业 65%–73%）[S22]、At-Bay Stance MXDR（采用可获保费抵扣、更高勒索和欺诈限额）[S26][S27] | **保留，并与「continuous risk management」合并为「预防融合型」**。收入可能从单一保费变成保费加安全服务，可达 L3 |
| Machine-to-machine insurance | 没有找到真实交易案例。Koop 为自动驾驶和机器人提供保险，但买方是企业 [S33] | **列入观察名单（UNKNOWN）** |
| AI-generated / hyper-customized products | 没有找到可验证的「由 AI 自动生成条款并获监管备案」的公开案例 | **列入观察名单（UNKNOWN）**。注意欧盟 AI Act 把寿险和健康险定价 AI 列为高风险 [S91] |
| Insurance-as-an-API | 与嵌入式高度重叠（XCover 的「单次 API 调用」[S58]；bolttech 的 API 交易所 [S55]）；Hippo 的 fronting 平台是「资本即服务」[S13] | **拆开**：API 分销并入嵌入式；fronting 和「牌照/资本即服务」另列为 **资本结构类**（与 AI 无关） |
| Insurance FOR AI risk（反向类） | 案例丰富且增长快：Munich Re aiSure [S74]、Armilla/Chaucer（最高 2,500 万美元限额）[S72]、AIUC（AIUC-1 标准 + 保险）[S73]、Testudo（每个被保人最高 925 万美元）[S75]、Relm（NOVAAI/PONTAAI/RESCAAI）[S76]、Vouch [S64]、Klaimee [S78]、Google Cloud RPP 的肯定性 AI 保障 [S77]、Koop 机器人 E&O [S33]、Lemonade 自动驾驶车险 [S9] | **独立成轴**，内部再细分（见 §4.3） |
| **新增：资本/融资结构创新（常被误标为 AI）** | Lemonade Synthetic Agents（General Catalyst 最多融资 80% 的 CAC，换取最多 16% 的保费分成）[S7][S8]；Kin reciprocal [S16]；Hippo fronting [S13] | **新增类别**，专门用于 **排除误归因** |
| **新增：保险互助 / 事后分摊（反例）** | 相互宝：由信美人寿「相互保」被监管叫停后转为网络互助（不再是保险产品），峰值成员超过 1 亿，2022 年关停 [S50] | **新增「非保险风险分摊」类**，用于和保险新物种划清界限 |

---

## 3. 案例总表

说明：「L 级」按 §4.2 的方案评估。「承担风险」指最终资本方。未经一手来源证实的项标 NV（NEEDS VALIDATION）或 UNKNOWN。

| # | 公司 | 国家 | 成立 | 牌照/结构 | 最终风险承担方 | 客户 | AI 做什么 | 相对传统模式改变了什么 | 结果证据 | L 级 | 来源 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Lemonade（含 Car、Autonomous Car） | 美国/以色列/欧洲 | UNKNOWN（本轮未核） | 自有承保公司（Lemonade Insurance Co.、Metromile Insurance Co.、Lemonade Insurance N.V.）；寿险与 Legal & General 合作 | 自留加再保：配额分出约 55%（至 2025-06-30）→ 约 20%（至 2026-06-30）→ 2026-07-01 起约 18% | 个人（租客/房主/宠物/车/寿） | AI Maya 负责投保引导；AI Jim 在 96% 的情况下接 FNOL；约 55% 理赔自动化；AI 分群定价；通过 Tesla Fleet API 区分 FSD 里程 | 理赔和客服成本结构（LAE 从 13% 降到 5%）；车险按「自动驾驶/人工驾驶」分别计价（FSD 里程约五折）；**Synthetic Agents 是融资结构，不是 AI** | 毛损失率：2022 年 90% → 2024 年第三季度 73% → 2025 年 TTM 64% → 2026 年第二季度 60%；2026 年第二季度 IFP 14.34 亿美元（+32%）；2025 年净亏损 1.655 亿美元；员工 1,282 人 | 理赔/客服 L2；FSD 定价 L3 | [S1][S2][S3][S5][S6][S7][S9] |
| 2 | Root | 美国 | UNKNOWN | 自有承保公司（Root Insurance Co.、Root P&C）；德州通过 MGA 与 Redpoint County Mutual 合作 | 基本自留（2026 年第二季度分出保费仅 230 万美元） | 个人车险 | 远程信息 + ML 定价；称基础模型可从非结构化信息提取预测信号 | 定价依据改为驾驶行为；分销从直销转向合作和嵌入式（合作与独立代理渠道占新单 51%） | 2021/2022 年亏损 5.21 亿 / 2.977 亿美元（NV）；2026 年第二季度净综合成本率 92.1%，净利润 2,500 万美元，GWP 3.4 亿美元（-2%） | L3（定价） | [S11][S12] |
| 3 | Hippo | 美国 | UNKNOWN | Spinnaker 等承保公司；混合 fronting 平台 | 大量通过 fronting 转给第三方 MGA 和再保 | 房主，另有商业/责任险项目 | 公开财报中 **没有明确的 AI 描述** [S13] | 转向 fronting（资本即服务）和组合多元化：房主险占 GWP 从 47% 降到 34%；出售 Home Builder 分销网络，净收益 9,100 万美元 | 2023 年净损失率 169%、亏损 2.73 亿美元；2025 年净利润 5,800 万美元（含出售收益），合并成本率 113%；2026 年第二季度合并成本率 95.8%（NV） | L0–L1（AI）；资本结构创新 | [S13][S14][S15] |
| 4 | Kin | 美国 | UNKNOWN | Kin 作为 attorney-in-fact 管理 reciprocal 交换所 | 交换所（保单持有人所有）+ 巨灾再保 / 巨灾债券 | 巨灾暴露州房主 | UNKNOWN（官方季报没有具体 AI 指标） | 收入来源：Kin 赚管理费，承保损益归交换所 | 2025 年第二季度收入 5,850 万美元（+26%），调整后损失率 22.9%；IPO 计划 2026（NV）；2022 年 SPAC 终止 | L1；资本结构创新 | [S16][S17][S18][S19] |
| 5 | Openly | 美国 | UNKNOWN | MGA，由 Clear Blue 集团承保；2022 年设立 Openly Insurance Company（标题所示，NV） | 第三方 A 级承保人 / fronting | 独立代理渠道的高端房主险 | UNKNOWN | 以代理人为中心的数字承保 | 2025 年 2 月 1.93 亿美元融资（Eden Global + Allianz X）为 **NV** | L1（NV） | [S20] |
| 6 | NEXT Insurance（ERGO NEXT） | 美国 | UNKNOWN | P&C 承保人；2025-07-01 被 ERGO（Munich Re）全资收购，估值 26 亿美元 | ERGO/Munich Re | 小微企业 | 用 AI/ML 简化购买，全数字自动承保定价 | 小微商业险数字直销 | 2024 年营收 5.48 亿美元，客户 60 万以上，员工约 700 人 | L2 | [S21] |
| 7 | Coalition | 美国（全球） | UNKNOWN | MGA（CIS 在 50 州持牌）；2026-05-06 成为 Allianz 商业网络险全球独家伙伴 | 以 Allianz 等承保人提供的资本为主（2026 年协议中 Allianz 继续提供承保能力） | 中小及中型企业网络险 | 持续外部攻击面扫描、ML 预测、漏洞预警、事故响应 | **预防融入产品**，收入包括安全服务；从一次性风险转移变成持续风险管理 | 2022 年自称索赔频率比行业低 65%，后续材料称低 73%（自报）；Allianz 转让业务并增持股权 | L3 | [S22][S23][S24][S25] |
| 8 | At-Bay | 美国 | UNKNOWN | At-Bay Insurance Services（非 admitted 承保人承保） | 非 admitted 承保人 | 近 4 万家企业 | Stance MXDR（7×24 SOC） | 安全服务与保险捆绑，保费抵扣和更高限额与 MDR 使用挂钩 | 自称 90% 的理赔可被缓解（自报） | L3 | [S26][S27] |
| 9 | Corvus | 美国 | UNKNOWN | 网络险 MGU，2024 年被 Travelers 以约 4.35 亿美元收购 | Travelers | 中型市场 | 漏洞扫描与承保算法 | 与 Coalition 类似；被 incumbent 吸收 | 收购本身即结果 | L2–L3 | [S28] |
| 10 | Cowbell | 美国 | UNKNOWN | MGA；澳洲业务使用 Zurich 保单；Zurich 2024 年投资 6,000 万美元 C 轮 | Zurich 等 | 中小企业网络险 | 「Cowbell Factors」AI 选择风险和定价，从提交到出单少于 5 分钟 | 承保速度和成本 | UNKNOWN（没有找到损失率） | L2 | [S29][S30] |
| 11 | Nirvana Insurance | 美国 | 2021 | 「承保人和 MGA」（二手来源，NV） | NV | 卡车运输 | 实时远程信息 + 300 亿英里以上历史数据，用于承保、定价和保单管理 | 定价依据改为行为数据；称为「AI 操作系统」 | 2025 年 D 轮 1 亿美元，估值 15 亿美元；UNKNOWN 损失率 | L3（NV） | [S31] |
| 12 | Kettle | 美国 | 2020 年启动 | 保险/再保 MGA，替百慕大和伦敦资本承保；2026 年 2 月与 RLI 合作推出商业财产产品 | 百慕大和伦敦（再）保险人、RLI | 加州野火暴露 | 深度学习野火模型（约 130TB、约 40 个数据集） | **扩展可保边界**：用模型让「不可保」的野火风险变得可再保；多为参数化 | UNKNOWN 损失率 | L3 | [S32] |
| 13 | Koop Technologies | 美国 | 2020 | 与 CJ Coleman 和 Lloyd's 辛迪加合作推出机器人 GL/E&O（NV：MGA 身份未证实） | Lloyd's 辛迪加 | 自动驾驶和机器人公司 | 采集机器数据用于承保和理赔 | 承保新的「机器风险」标的 | 融资约 700 万美元 | A2（反向轴） | [S33] |
| 14 | Sixfold | 美国 | UNKNOWN | SaaS（赋能层） | 不承担 | Zurich NA、AXIS、Guardian、New York Life 等 | GenAI「AI Underwriter」 | 保险公司承保人效：案件评估时间 -55%，人均保费 +30%（自报） | B 轮 3,000 万美元（Guidewire 参投） | 赋能 L2 | [S34] |
| 15 | Federato | 美国 | 2020 | SaaS | 不承担 | P&C 承保人、MGA、互助社 | RiskOps 平台 | 报价时间 -90%，盈利业务绑定量 3 倍（自报） | 2025 年 11 月 1 亿美元 D 轮（NV，三手来源） | 赋能 L2 | [S35] |
| 16 | Pibit.ai | 美国/印度 | UNKNOWN | SaaS | 不承担 | HDVI、Shepherd、Method 等 | CURE：分流、文档智能、风险评估 | 周期最多快 85%，人均 GWP +32%，损失率「最多」改善 700bp（自报） | A 轮 700 万美元（2025 年 11 月） | 赋能 L2 | [S60] |
| 17 | Tractable | 英国 | UNKNOWN | SaaS | 不承担 | Aviva、Geico、Admiral 等 | 计算机视觉定损 | 理赔评估成本和速度 | 2023 年 E 轮 6,500 万美元；UNKNOWN 2025 状况 | 赋能 L2 | [S36] |
| 18 | Shift Technology | 法国 | 2014 | SaaS | 不承担 | AXA Switzerland 等 | 反欺诈；2025 年推出 agentic Shift Claims | 早期用户称自动化 60%、理赔损失 -3%（二手来源，NV）；官方强调保留人工监督 | 2021 年 D 轮 2.2 亿美元 | 赋能 L2 | [S37] |
| 19 | Descartes Underwriting | 法国 | 2019 | MGA（A+ 承保人支持）；2026 年通过 OAK Global 辛迪加 2843 成为 Lloyd's coverholder | 承保人面板 / Lloyd's | 600 多家企业和公共机构 | AI、卫星、IoT 用于指数和模型 | **理赔触发**：预设客观指数，自动赔付 | 2025 年 GWP 超过 2.5 亿美元；单合同容量最高 2 亿美元 | L3（触发）；AI 依赖度中 | [S38] |
| 20 | FloodFlash | 英国 | 2017 年推出 | MGA / Lloyd's coverholder；2025 年被 NormanMax 收购 | Lloyd's 资本 | 企业/物业 | 现场水深传感器 | 触发：水深超阈值即赔（约 10 小时赔付） | 被并购（FCA 已批） | L3（触发）；AI 依赖度低 | [S39] |
| 21 | Arbol | 美国 | UNKNOWN | 平台 + 百慕大 MGU（Arbol Underwriters）与 SIG Re | SIG Re 等 | 农业/能源/企业 | 气候数据 | 触发，并把气候风险做成资本市场可投资的资产 | 2023 年名义风险超过 10 亿美元，GWP 约 2.5 亿美元 | L3（触发） | [S40] |
| 22 | Blink Parametric | 爱尔兰 | UNKNOWN | B2B2C 平台（与 Cover-More 等合作） | 合作保险公司（NV） | 旅客 | 航班数据监测 | 按延误分钟即时赔付，或提供休息室、改签等服务 | 与 Cover-More Europe 合作（2025） | L3（触发）；AI 依赖度低 | [S41] |
| 23 | Tesla Insurance | 美国 | UNKNOWN | Tesla Property & Casualty；加州 2024 年起自行承保（此前由 State National fronting） | Tesla 自有承保公司 | Tesla 车主 | 实时 Safety Score；FSD 使用比例折扣 | 车企（OEM）自保，定价依据改为车辆原生数据 | 2025 年前九个月保费 7.47 亿美元；田纳西为第 14 个州（计划 2026-03-01） | L3 | [S42] |
| 24 | Marshmallow | 英国 | UNKNOWN | 直布罗陀持牌承保人（NV：牌照细节） | 自有加再保 | 英国车险（移民等细分人群） | 数据定价 | 为信用记录薄的人群定价 | 2024 年营收 2.894 亿英镑，净利润 2,030 万英镑（三手来源，NV） | L2（NV） | [S43] |
| 25 | Zego | 英国 | UNKNOWN | UNKNOWN（本轮未核） | UNKNOWN | 外卖骑手、网约车、新手司机 | App 远程信息 | 按工作时段定价 | 2024 年亏损从 3,400 万英镑降到 400 万英镑；裁员并退出 B2B | L2 | [S44] |
| 26 | wefox | 德国/瑞士 | UNKNOWN | 曾有自有承保公司（wefox Insurance AG）+ MGA | 已出售 | 欧洲个人险 | 数字分销平台 | — | **失败/收缩**：2022 年估值 45 亿美元；2024 年退出德国、出售列支敦士登承保公司；2025 年出售意大利业务 | L1 | [S45] |
| 27 | Getsafe | 德国 | 2021 年获牌照 | 自有承保公司（BaFin）+ 经纪/MGA 业务 | 自有加合作承保人 | 德国、奥地利、法国年轻客户 | 客服和理赔自动化 | 成本结构 | 2024 年上半年自有承保公司首次盈利，毛损失率 63%，合并成本率 98% | L2 | [S46] |
| 28 | 众安在线 ZhongAn | 中国 | UNKNOWN | 互联网财险公司（港股 6060） | 众安 | 生态场景个人用户 | 2025 年大模型调用超 20 亿次，token 超 3 万亿；健康险 99% 自动核保，理赔自动审核超 45%；单个人工坐席服务 10 万用户 | 场景嵌入式承保 + 全流程 AI | 2025 年合并成本率 95.8%；健康生态合并成本率 92.1%，**费用率仍达 50.0%**（下降 6.7pp） | L2 | [S47] |
| 29 | 水滴 Waterdrop | 中国 | UNKNOWN | 保险经纪（纽交所） | 合作保险公司 | 个人健康险 | 「水滴水守大模型」；AI 核保「KEYI.AI」称处理时间 -80% | 经纪成本结构 | 2025 年第二季度营收 8.38 亿元（+23.9%），连续 14 个季度盈利 | L2 | [S48] |
| 30 | 元保 Yuanbao | 中国 | UNKNOWN | 互联网保险经纪（纳斯达克 YB） | 合作保险公司 | 个人 | 超过 4,900 个模型，用于核保、客服、理赔辅助；医疗险最快 3.4 分钟审理 | 流量 + 算法分发 | 2025 年营收 43.73 亿元，净利润 13.08 亿元，新单超过 3,000 万张（媒体转引招股书，NV） | L2 | [S49] |
| 31 | 蚂蚁保 / 相互宝 | 中国 | 相互保 2018 | 相互保原由信美人寿团体重疾险支持；2018-11 被监管叫停后改为支付宝运营的网络互助 | **成员事后分摊（非保险）** | 超过 1 亿成员（峰值） | 风控/审核（UNKNOWN 具体 AI） | 以事后分摊取代预收保费，没有准备金 | **关停**：2022-01-28 停运；分摊额从约 0.03 元涨到约 7 元（约 200 倍）；2021 年互联网人身险新规收紧 | 反例 | [S50] |
| 32 | 蚂蚁保「蚁小保」 | 中国 | 2025-09 发布 | 平台（保险代理，NV） | 合作保险公司 | 个人 | LLM 保险顾问：解读、配置、理赔陪伴 | 自称「无销售和佣金导向」的中立顾问 | UNKNOWN 效果数据 | L1–L2 | [S51] |
| 33 | 中国平安 | 中国 | — | 综合金融集团 | 平安 | 全客群 | 2025 年 AI 坐席服务约 17 亿次，占客服量 80%；AI 代理辅助销售 1,332 亿元；反欺诈减损 105.1 亿元（二手来源） | incumbent 大规模自动化 | 同左 | L2 | [S52] |
| 34 | Tokio Marine | 日本 | — | incumbent | — | — | 2025 年「One-AI」内部平台，与 Salesforce Agentforce 合作（**NV，只有二手摘要**） | — | UNKNOWN | L1（NV） | [S53] |
| 35 | SOMPO | 日本 | — | incumbent | — | — | Palantir Foundry 贯穿理赔；AI 代理评估承保风险，预期年改善 1,000 万美元（二手来源，官方稿未能抓取） | — | 同左 | L2（NV） | [S54] |
| 36 | bolttech | 新加坡 | 2020 | 嵌入式保险交易所（经纪/代理 + 部分承保，NV） | 230 多家合作保险公司 | 约 700 个分销伙伴 | API 交易所 | 交易结构（嵌入式） | 2025 年 6 月 C 轮 1.47 亿美元，估值 21 亿美元 | L1 | [S55] |
| 37 | Igloo | 新加坡 | UNKNOWN | 全栈 insurtech（分销 + 技术） | 合作保险公司 | 东南亚 8 个市场 | 嵌入式、参数化天气指数 | 小额嵌入式 | 累计超过 6 亿张保单；2023 年 Pre-C 轮 3,600 万美元 | L1 | [S56] |
| 38 | Qover | 比利时 | UNKNOWN | 嵌入式编排平台 | 合作保险公司 | Revolut 等，覆盖 32 国 | API | 交易结构 | 2023 年 C 轮 3,000 万美元 | L1 | [S57] |
| 39 | Cover Genius / XCover | 澳大利亚 | UNKNOWN | 嵌入式分销（多国持牌，NV） | 合作承保人 | Ryanair、Hopper 等 | 单一 API 个性化 | 交易结构 | D 轮 7,000 万美元；日 GWP 110 万美元（时点 NV） | L1 | [S58] |
| 40 | Boost Insurance | 美国 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 本轮没有取得有效来源 | UNKNOWN | — | — |
| 41 | Bestow | 美国 | UNKNOWN | **2024 年把承保公司和 C 端业务出售给 Sammons**，转型为寿险 SaaS | 不再承担 | Nationwide、Transamerica、USAA 等 | 数字承保平台 | 从承保人转为软件商（**退却**） | ARR 2024 年增长 3 倍；2025 年 D 轮 1.2 亿美元 | 赋能 L2 | [S61] |
| 42 | Ethos | 美国 | 2016 | 持牌代理 + MGA（不是保险公司） | Legal & General America、John Hancock 等 | 个人寿险 + 1 万多名独立代理人 | 专有承保引擎：免体检，约 10 分钟出单 | 以数据替代体检，承保时间结构性缩短；佣金收入 | 2026-01-29 纳斯达克上市，估值 12 亿美元；2025 年前九个月营收约 2.78 亿美元，净利润约 4,660 万美元 | L3（承保） | [S62] |
| 43 | Ladder | 美国 | UNKNOWN | 代理；保单由 Amica Life、Fidelity Security、S.USA Life 签发；Hannover Re 提供承保支持 | 上述承保公司/再保人 | 个人 | 算法承保，自称多数客户 15 秒内给出报价 | 同 Ethos | UNKNOWN 财务数据 | L3（NV） | [S63] |
| 44 | Vouch | 美国 | UNKNOWN | UNKNOWN（本轮未核） | UNKNOWN | 初创公司 | — | 2024-02 推出 AI 保险（AI E&O、偏见歧视、知识产权、监管调查） | UNKNOWN | A2 | [S64] |
| 45 | Corgi | 美国（YC） | 2025 年获牌 | 加州 admitted 承保人 Corgi Insurance Co.（NAIC #17989）+ Technology RRG + 经纪 | Corgi 自有（再保 UNKNOWN） | 科技初创；2026 年起扩展到卡车 | AI 用于承保、理赔、保单运营 | 全栈，并销售 AI 责任险（含训练数据知识产权抗辩） | 2026-05-07 B 轮 1.6 亿美元，估值 13 亿美元；保费和客户数 UNKNOWN | L2（AI）+ A2 | [S65] |
| 46 | Harper | 美国（YC W25） | 2024 | 持牌商业险代理，佣金收入 | 160 多家合作承保人 | 小微商业 | AI 自动化提交路由、跟进、收集资料 | 服务一个客户的单位成本大幅下降，可承接长尾小单（每月超过 1,000 个客户，传统约 20–30 个） | 2026-02 融资 4,680 万美元 | L3（分销成本结构） | [S66] |
| 47 | Ominimo | 匈牙利/塞尔维亚 | 2024 | **冲突**：TechCrunch 称其为 Zurich 的 MGA（NV） | Zurich（NV） | 欧洲车险 | 每车 100 多个变量的 ML 定价 | 定价颗粒度 | 2025 年 Zurich 以 2 亿欧元估值投资；2026 年 7 月 B 轮估值 16 亿美元、年化 GWP 超过 3.5 亿美元（二手来源，NV） | L2 | [S67] |
| 48 | Tuio × WaniWani（ChatGPT） | 西班牙/美国 | — | Tuio 为数字保险品牌（与 Allianz Direct 相关，NV） | Tuio 的承保方（NV） | 西班牙房主 | ChatGPT 内对话式报价 | 分销入口移到 LLM；**只给非约束性方案，出单需跳转** | 2026-02-10 OpenAI 批准；WaniWani 2026-06 种子轮 800 万美元 | L1–L2 | [S68] |
| 49 | Insurify（ChatGPT App） | 美国 | — | 持牌比价平台 | 各承保人 | 车险 | ChatGPT 内比价、报价 | 在部分州可完整报价，购买在 Insurify 平台完成 | 2026-02 上线 | L1–L2 | [S68] |
| 50 | ACORD / Socotra（MCP） | 全球 | — | 行业标准组织 / 核心系统商 | — | 保险公司、经纪人 | MCP 让 AI 代理接入交易数据 | 代理对代理交换报价、确认订单和可绑定数据（官方称「潜在用途」） | UNKNOWN 实际交易量 | 基础设施 | [S69] |
| 51 | Allianz Project Nemo | 澳大利亚 | 2025-07 | incumbent | Allianz | 巨灾后低复杂度理赔 | 7 个专门 AI 代理 + 人工审核 | 处理时间 -80%（据二手摘要） | 同左 | L2 | [S70] |
| 52 | Armilla | 加拿大/美国 | UNKNOWN | Lloyd's coverholder / MGA | Chaucer 等 Lloyd's 承保人 | AI 厂商及部署方 | 独立 AI 系统评估与认证（500 多次评估） | **新风险标的**：肯定性 AI 责任险（幻觉、模型漂移），限额最高 2,500 万美元 | 2025-04-30 与 Chaucer 推出 | A2–A3 | [S72] |
| 53 | AIUC | 美国 | 2025-07 发布 | 标准制定 + 审计 + 保险（承保人未披露） | UNKNOWN | AI 代理厂商（如 ElevenLabs） | AIUC-1：5,000 多次对抗测试 | 认证与保险捆绑，形成「标准驱动承保」 | 种子轮 1,500 万美元 + A 轮 4,000 万美元；ElevenLabs 保单的承保人、限额、保费 **均未披露** | A3（NV：资本方） | [S73] |
| 54 | Munich Re aiSure | 德国 | 自 2018 年起承保 AI | 再保/直保（Munich Re） | Munich Re | AI 厂商（性能担保）、部署方 | 对模型性能做量化承保 | 类参数化触发：模型误差、漂移超出约定阈值即赔；高频低损 | 案例客户：Mosaic、Instnt 等；南非 itoo 合作 | A3 | [S74] |
| 55 | Testudo | 英国/美国 | UNKNOWN | Lloyd's coverholder / MGA | Apollo、Atrium、QBE | 使用 GenAI 的企业 | 实时追踪 AI 诉讼和事件数据 | 第三方 GenAI 输出责任险 | 每个被保人限额最高 925 万美元（2026-03） | A2 | [S75] |
| 56 | Relm Insurance | 百慕大 | UNKNOWN | 承保人（NV） | Relm | AI 公司和使用方 | — | NOVAAI / PONTAAI / RESCAAI（2025-01-14） | UNKNOWN | A2 | [S76] |
| 57 | Google Cloud RPP（Beazley、Chubb、Munich Re） | 美国 | — | 平台 + 承保人合作 | 上述承保人 | Google Cloud 客户 | 共享云安全态势数据 | 平台数据直通承保 + 肯定性 AI 保障 | 扩展到 EMEA 30 国 | A2 | [S77] |
| 58 | Klaimee | 美国（YC） | UNKNOWN | UNKNOWN（MGA 身份未披露） | UNKNOWN | AI 代理部署方 | 对每个代理做 100 多项行为探测 + 治理问卷 | 保险支持的 AI 代理性能担保 | 种子轮 550 万美元（2026-07） | A3（NV） | [S78] |

---

## 4. 任务 B：商业模式创新判定框架

### 4.1 十四个变量：「优化」与「改变」的公开证据对照

判定原则是 **反事实测试**：拿掉 AI 以后，这个要素还能以相近的经济性存在吗？如果能，就是优化；如果不能，或者要素本身的定义变了，就是改变。

| 变量 | 「只是优化」的典型公开证据 | 「AI 改变了它」需要的可观测公开证据 | 本研究中的正例/反例 |
|---|---|---|---|
| 1 客户 Customer | 转化率、获客成本下降 | 服务了传统模式 **无法经济地服务** 的客群，且有量化证据（单客服务成本、客群规模、此前被拒保的比例） | Harper 每月超过 1,000 个小微客户，传统约 20–30 个 [S66]（改变）；Marshmallow 服务信用记录薄的人群 [S43]（NV） |
| 2 价值主张 Value proposition | 「更快」「更便宜」 | 保障对象或承诺的形式变了，例如从赔付损失变为 **防止损失**，或保证 AI 性能 | Coalition 主动预警与响应 [S22]；aiSure 性能担保 [S74] |
| 3 风险识别 Risk identification | 更多特征、更准的模型 | 识别出此前 **不可观测或不可保** 的风险，而且有人为此承担资本 | Kettle 野火模型支撑再保 [S32]；AIUC-1 对代理的对抗测试 [S73] |
| 4 产品形成 Product formation | 可配置条款 | 出现监管备案的 **新险种或新条款结构**，且依赖 AI 或数据 | Lemonade 自动驾驶车险（按驾驶模式分别计价）[S9]；AI 肯定性责任险 [S72] |
| 5 定价 Pricing | 更多变量的 GLM/ML | 定价 **依据** 从静态属性换成持续行为或机器状态，并能在费率文件或产品说明中看到 | Tesla Safety Score [S42]；FSD 里程五折 [S9]；Root 远程信息 [S11] |
| 6 承保 Underwriting | 核保人效提升（Sixfold 自称 +30%）[S34] | 承保决策 **不再需要传统证据**（例如体检），或由持续监测代替一次性核保 | Ethos 免体检约 10 分钟 [S62]；众安 99% 自动核保 [S47]（属于优化还是改变有争议，默认判为优化） |
| 7 分销/交易结构 | 线上化、API | 交易发生的地点或主体变了（LLM 内、代理对代理），**并且可以完成绑定** | Tuio 目前只能报价，不能绑定 [S68]（尚未改变）；ACORD MCP 为潜在用途 [S69] |
| 8 服务 Service | 客服自动化率（平安 80% [S52]） | 服务变成可计价的独立价值（例如安全服务影响保费或限额） | At-Bay MDR 影响保费抵扣和限额 [S27] |
| 9 预防 Prevention | 风险提示邮件 | 预防行为 **写入合同经济条款**（保费、限额、免赔额），并能证明损失频率下降 | Coalition 自报频率低 65%–73% [S22]（自报，需第三方验证） |
| 10 理赔触发 Claims trigger | 自动化理赔（Lemonade 55% [S3]） | 触发条件从「损失核定」变成 **客观指数或模型指标** | Descartes、FloodFlash、Blink [S38][S39][S41]；aiSure 的性能阈值 [S74] |
| 11 风险载体 Risk carrier | 仍为传统承保人 | 出现新的资本安排，或风险由新主体承担 | Kin reciprocal [S16]、相互宝事后分摊 [S50]、Arbol 资本市场化 [S40]（多与 AI 无关） |
| 12 收入 Revenue | 佣金或承保利润的量变 | 收入来源 **类型** 变了（服务费、认证费、性能担保费、管理费） | AIUC 认证 + 保险 [S73]；Kin 管理费 [S16]；Bestow SaaS [S61] |
| 13 成本结构 Cost structure | LAE、费用率下降 | 成本曲线的形状变了（边际服务成本接近零，人员与保费脱钩），**并在多年财报中持续** | Lemonade LAE 5% [S1]；众安健康生态费用率仍为 50% [S47]（渠道成本没有被 AI 消除） |
| 14 可扩展性 Scalability | 增长率 | IFP/员工、保单/员工等指标持续上升，且损失率不恶化 | Lemonade：IFP 约 12.4 亿美元 / 1,282 名员工，人均约 96 万美元（本研究根据 [S2][S3] 计算）；需要多年序列 |

### 4.2 推荐分级：L0–L4（「AI 作为工具」轴）

| 级别 | 定义 | 最低公开证据要求 | 代表 |
|---|---|---|---|
| **L0 叙事** | 只有营销中的「AI」字样 | — | 很多融资新闻稿 |
| **L1 辅助/后台** | AI 用于文档、客服、内部 Copilot | 公司披露具体用例 | Tokio Marine One-AI（NV）[S53]、bolttech [S55] |
| **L2 核心流程自动化（优化）** | 定价、承保、理赔的 **决策** 主要由模型做出，单位成本或速度有量化改善 | 一手披露的自动化率、LAE/费用率、时效，至少连续 4 个季度 | Lemonade 理赔 [S3]、众安 [S47]、平安 [S52]、NEXT [S21]、赋能层客户 [S34][S60] |
| **L3 要素重构** | 14 个变量中至少 1 个的 **定义** 被改变（定价依据、触发、预防入合同、分销成本曲线），且 AI 或数据是必要条件之一 | 产品或费率文件、合同条款、多期损失率或成本序列 | Root、Tesla、Lemonade FSD、Coalition、At-Bay、Ethos、Harper、Kettle |
| **L4 新风险承担/交易结构，没有 AI 就不可能** | 新的风险标的、新的交易主体（例如 AI 代理），或新的资本或收入形态，且只能在 AI 条件下存在 | 有名字的资本方、限额、保费或理赔数据；监管备案 | **截至 2026-09 没有完全达标的案例**。最接近的是 aiSure（有资本方，也有触发机制）[S74]、AIUC（资本方未披露）[S73] |

**反向轴（AI 作为风险标的，Insurance FOR AI）A0–A4：**

- A0：沉默或除外。Verisk CG 40 47/48 [S79]；AIG、WRB 申请除外 [S80]。
- A1：在网络险或 E&O 中加批单做有限扩展。Google RPP 的肯定性 AI 保障属于 A1–A2 之间 [S77]。
- A2：独立的肯定性 AI 责任险。Armilla、Testudo、Relm、Vouch、Corgi [S72][S75][S76][S64][S65]。
- A3：可量化的性能担保或类参数化触发，或认证与承保挂钩。aiSure、AIUC、Klaimee [S74][S73][S78]。
- A4：持续监测、动态保费的 AI 代理保险，且有公开的理赔或损失数据。**UNKNOWN，暂无案例。**

**配套字段（每个案例都要记录）：**

- 证据等级：E1 监管或审计披露，E2 公司官方，E3 行业媒体，E4 聚合站。
- 持续性：D0 单点数据，D1 至少 4 个季度，D2 至少 8 个季度。
- AI 必要性：N0 非必要，N1 增强，N2 必要。
- 风险自留比例：%，或未知。

### 4.3 「为 AI 承保」子分类建议

1. **AI 输出第三方责任**：幻觉、诽谤、知识产权、歧视。例：Testudo、Armilla、Relm PONTAAI [S75][S72][S76]
2. **AI 性能担保 / 合同责任**：厂商向客户承诺的准确率由保险兜底。例：aiSure [S74]、Klaimee [S78]
3. **AI 部署方的第一方损失**：营业中断、召回、声誉。例：Relm RESCAAI [S76]、aiSure 的部署方场景 [S74]
4. **自主系统 / 实体 AI**：自动驾驶、机器人。例：Koop [S33]、Lemonade 自动驾驶车险 [S9]、Tesla FSD 折扣 [S42]
5. **认证驱动的承保**：例：AIUC-1 [S73]、Armilla 评估 [S72]

### 4.4 常见炒作模式及其公开证据识别法

| 炒作模式 | 实例 | 识别方法 |
|---|---|---|
| **命名误导** | 「Synthetic Agents」实为 CAC 融资：GC 最多出资 80%，换取最多 16% 的保费分成 [S7][S8] | 读 10-K/股东信的定义段，看是否涉及模型或自动化 |
| **分母口径游戏** | 「96% 由 AI Jim 接 FNOL」与「55% 理赔自动化」是两个不同指标 [S3] | 区分 FNOL、分流、结案、赔付；要求给出「端到端自动化结案率」 |
| **损失率改善归因给 AI** | Hippo 改善伴随房主险占比从 47% 降到 34%、出售资产获益 9,100 万美元 [S13]；Lemonade 同期调整再保分出率 [S3] | 拆解：费率上调、退出州、产品组合、再保、准备金变动（Lemonade 车险 2025 年第四季度 40% 的损失率受准备金影响 [S2]） |
| **「AI-native」但不承担风险** | Ethos 是代理 + MGA，不是保险公司 [S62]；Ominimo 被报道为 Zurich 的 MGA [S67] | 查牌照（NAIC 号、BaFin、FCA、Lloyd's coverholder）和保单签发方 |
| **Token/调用量等虚荣指标** | 众安 3 万亿 token [S47]，但健康生态费用率仍为 50% [S47] | 要求把 AI 投入对应到费用率、LAE、损失率的多期变化 |
| **「最多」「高达」式客户指标** | Pibit「最多 700bp」损失率改善 [S60]；Sixfold +30% [S34] | 只有厂商自报、没有被点名客户的审计口径 → 最高给 E2 或 E3 |
| **Agentic 只到报价** | Tuio 的 ChatGPT 应用出单要跳转 [S68] | 查能否在代理界面内完成绑定、支付和出单文件 |
| **没有资本方的「AI 保险」** | ElevenLabs/AIUC 保单的承保人、限额、保费都没有披露 [S73] | 要求公布承保人名称、限额、保费区间 |
| **参数化被贴上 AI 标签** | 参数化的核心是指数和传感器 [S39][S41] | 判断 AI 是否改变了指数设计或基差风险；否则 N0/N1 |
| **自报的预防效果** | Coalition 频率低 65%–73%（自报）[S22] | 看是否有第三方精算或再保人背书；是否因选择偏差（风险选择）而非预防造成 |
| **估值驱动叙事** | wefox 估值 45 亿美元后收缩 [S45]；Kin SPAC 取消 [S19] | 跟踪估值、融资与经营指标是否背离 |
| **规避监管的「互助」** | 相互宝在监管叫停后转为非保险，最终关停 [S50] | 查是否持牌、是否有准备金和偿付能力监管 |

---

## 5. 失败与退却汇总（反炒作证据库）

| 案例 | 发生了什么 | 教训 | 来源 |
|---|---|---|---|
| Lemonade 2022 | 毛损失率 90%；收购 Metromile（对价公允价值 1.377 亿美元，全股票） | AI 理赔不能替代定价充足性；按里程计费车险的独立经营难度大（Metromile 历史亏损：NV） | [S4][S5] |
| Root 2021–2022 | 亏损 5.211 亿 / 2.977 亿美元；BlackRock 3 亿美元定期贷款；Carvana 入股 | 远程信息定价需要时间和资本；转向合作渠道后才盈利 | [S12][S11] |
| Hippo 2022–2023 | 净损失率 239% → 169%；2023 年亏损 2.73 亿美元 | 房主巨灾暴露压倒技术优势；后转向 fronting | [S14][S13] |
| wefox 2023–2025 | 估值 45 亿美元后注资、换 CEO，出售德国、列支敦士登、意大利业务 | 分销驱动增长且承保纪律弱 | [S45] |
| Bestow 2024 | 出售承保公司和 C 端业务，转型 SaaS | 数字寿险直销单位经济性不足（推断） | [S61] |
| Kin 2022 | SPAC 因赎回终止 | 资本市场窗口依赖 | [S19] |
| 相互宝 2018–2022 | 从保险转为互助，最终停运 | 事后分摊 + 监管套利不可持续 | [S50] |
| Zego 2024 | 裁员、退出 B2B | 细分 UBI 需要聚焦 | [S44] |
| 传统保险公司对 AI 风险 | Verisk 除外条款；AIG、WRB 申请除外；Aon 指出担心的是系统性、相关性、聚合性损失 | 为 AI 承保的最大障碍是 **累积风险**，而不是单个事件 | [S79][S80] |
| 其他 life insurtech | Policygenius 被 Zinnia 收购，Health IQ 2023 年破产（据 TechCrunch 转述 Ethos 创始人及报道） | 行业幸存者偏差 | [S62] |

---

## 6. 对 InsurHOT 数据模型的建议（Phase-0）

1. 每个「新物种」实体至少记录这些字段：`license_type`、`paper_issuer`（签单主体）、`capital_provider[]`、`retention_pct`、`revenue_type[]`（承保利润/佣金/管理费/SaaS/服务费/认证费）、`ai_role_by_variable{14}`、`level_L`、`level_A`、`ai_necessity_N`、`evidence_grade_E`、`durability_D`、`failure_flags`。
2. **「AI 贡献」只接受有多期序列的指标**（LAE、费用率、损失率、IFP/员工），单点「自动化率」只作为辅助。
3. **把「交易结构」事件单独建表**：LLM 应用上线、MCP/API 开放、代理对代理绑定，逐项标注是否能完成 bind 和支付。
4. **反向轴要持续监测除外条款的采用情况**（ISO 表单、各州备案），因为保护缺口的大小决定了 AI 保险 MGA 的市场空间 [S79][S80][S81]。

---

## 7. 待核实清单（NEEDS VALIDATION / UNKNOWN）

- 多数公司的成立年份，本轮 WebSearch 配额用完没有核实（Lemonade、Root、Hippo、Kin、Coalition、At-Bay、Cowbell、Corvus、Openly、NEXT、Marshmallow、Zego 等）。
- Root 2021/2022 年亏损数字需回到 10-K 核对 [S12]。
- Hippo 2026 年第二季度合并成本率 95.8% 与净利润 1,000 万美元，只有二手来源 [S15]。
- Openly 2025 年 2 月 1.93 亿美元融资 [S20]；Federato 1 亿美元 D 轮 [S35]；Marshmallow 2024 年财务 [S43]；Ominimo 牌照结构和 B 轮 [S67]。
- Nirvana 是否持有承保牌照 [S31]；Relm、Vouch、Klaimee、Testudo 的法律主体与资本方 [S76][S64][S78][S75]。
- AIUC 保单的承保人、限额、保费 [S73]。
- Tokio Marine One-AI/Agentforce [S53]；SOMPO 的 1,000 万美元预期 [S54]；平安数据需对照 2025 年年报原文 [S52]；元保 2025 年财务需对照 SEC F-1/20-F [S49]。
- Tesla Insurance 进入佛罗里达的时间：来源称 2025 年 [S42 搜索摘要] 与 2026 年 1 月 [S42] 不一致。
- Boost Insurance、Metromile 历史损失、Blink 的承保方：UNKNOWN。
- 「买方 AI 代理自主绑定保单」的公开案例：UNKNOWN。
- arXiv:2607.11999 内容未读 [S94]。

---

## Sources

- [S1] Lemonade Q2 2026 Shareholder Letter (8-K): https://www.sec.gov/Archives/edgar/data/0001691421/000169142126000047/lmndshareholderletterq22.htm
- [S2] Lemonade Q4 2025 Shareholder Letter (8-K): https://www.sec.gov/Archives/edgar/data/1691421/000169142126000006/lmndshareholderletterq42.htm
- [S3] Lemonade Form 10-K FY2025: https://www.sec.gov/Archives/edgar/data/1691421/000169142126000016/lmnd-20251231.htm
- [S4] Lemonade Form 10-K FY2022 (Metromile acquisition): https://www.sec.gov/Archives/edgar/data/1691421/000169142123000032/lmnd-20221231.htm
- [S5] Lemonade Q4 2022 Shareholder Letter: https://www.sec.gov/Archives/edgar/data/1691421/000169142123000012/shareholderletterq420222.htm
- [S6] Lemonade Q3 2024 Shareholder Letter: https://www.sec.gov/Archives/edgar/data/1691421/000169142124000128/lmndq32024shlfinal103024.htm
- [S7] Lemonade Q2 2023 Shareholder Letter (Synthetic Agents): https://www.sec.gov/Archives/edgar/data/1691421/000169142123000092/lmndshareholderletterq22.htm ; Reinsurance News: https://www.reinsurancene.ws/lemonade-partners-with-general-catalyst-to-create-synthetic-agents-for-financial-growth/
- [S8] Insurance Journal, "'Synthetic' Agents? Lemonade Says Finance Deal Limits Cash Burn" (2023-07-05): https://www.insurancejournal.com/news/national/2023/07/05/728503.htm
- [S9] Lemonade Autonomous Car launch (Business Wire, 2026-01-21): https://www.businesswire.com/news/home/20260121169700/en ; explainer: https://lemonade.com/car/explained/self-driving-car-insurance ; Carscoops: https://www.carscoops.com/2026/01/tesla-fsd-lemonade-insurance-discount/
- [S10] (merged into S9)
- [S11] Root Q2 2026 Shareholder Letter (8-K): https://www.sec.gov/Archives/edgar/data/0001788882/000178888226000060/q22026shareholderletter.htm
- [S12] S&P Global Market Intelligence on Root 2022 (2023-03): https://www.spglobal.com/market-intelligence/en/news-insights/articles/2023/3/root-stock-woes-continue-as-carvana-policy-count-improves-74662920 ; Root 8-K: https://www.sec.gov/Archives/edgar/data/1788882/000162828022003501/q4shareholderletter.htm
- [S13] Hippo Q4 & FY2025 results: https://investors.hippo.com/news/investor-news/news-details/2026/Hippo-Reports-Fourth-Quarter-2025-Financial-Results/default.aspx
- [S14] Coverager, "Hippo ends 2023 with $273 million loss": https://coverager.com/hippo-ends-2023-with-273-million-loss/
- [S15] Hippo Q1 2026 earnings release: https://app.edgar.tools/filing/1828105/0001828105-26-000023/q126earningsreleasefinal.htm ; Q2 2026 (secondary): https://beinsure.com/news/insurtech-hippo-reports-10mn-net-income/
- [S16] Kin Q2 2025 results: https://www.kin.com/news/q2-2025-revenue-growth/
- [S17] Kin Q3 2025 results: https://www.kin.com/news/kin-q3-2025-revenue-growth/
- [S18] Mergermarket on Kin IPO plan: https://ionanalytics.com/insights/mergermarket/kin-insurance-angles-for-2025-ipo-filing-listing-in-2026/
- [S19] Kin/Omnichannel SPAC termination (Business Wire, 2022-01-26): https://www.businesswire.com/news/home/20220126005979/en/Kin-Insurance-Inc.-and-Omnichannel-Acquisition-Corp.-Mutually-Agree-to-Terminate-Business-Combination-Agreement
- [S20] Openly: Insurance Journal (2019): https://www.insurancejournal.com/news/national/2019/11/26/549635.htm ; Agency Checklists (2022): https://agencychecklists.com/2022/07/25/openly-opens-openly-insurance-company-60538 ; FinTech Global (2022): https://fintech.global/2022/06/22/openly-secures-75m-to-empower-independent-insurance-agents/
- [S21] ERGO media information, 2025-07-01: https://www.ergo.com/en/newsroom/media-information/2025/20250701-ergo-acquisition-next-insurance ; NEXT blog: https://www.nextinsurance.com/blog/ergo-successfully-finalizes-the-full-acquisition-of-next-insurance/
- [S22] Coalition, Active Insurance year review: https://www.coalitioninc.com/blog/active-insurance-year-review ; Coalition 2025 Cyber Claims Report: https://www.actuarialpost.co.uk/downloads/cat_1/Coalition_2025-Cyber-Claims-Report.pdf
- [S23] Allianz Commercial, Coalition partnership 2026: https://commercial.allianz.com/news-and-insights/news/coalition-partnership-2026.html
- [S24] Allianz press 2022-06-30: https://www.allianz.com/en/press/news/business/insurance/220630_Allianz-enters-multi-year-partnership-with-cyber-MGA-Coalition.html
- [S25] Coalition licenses: https://coalitioninc.com/legal/licenses
- [S26] At-Bay MXDR launch (Business Wire, 2025-07-15): https://www.businesswire.com/news/home/20250715087764/en/At-Bay-Launches-New-MXDR-Platform-to-Combat-Cyber-Risk-for-Mid-Market-and-Small-Businesses
- [S27] At-Bay Stance MDR page: https://www.at-bay.com/mdr/
- [S28] Insurance Business, Travelers to acquire Corvus: https://www.insurancebusinessmag.com/us/news/cyber/travelers-to-acquire-corvus-465643.aspx
- [S29] Dark Reading, Cowbell $60M Series C from Zurich: https://www.darkreading.com/cybersecurity-operations/cowbell-secures-60-million-series-c-funding-from-zurich-insurance-group
- [S30] Crowdfund Insider on Cowbell (2026-01): https://www.crowdfundinsider.com/2026/01/257246-insurtech-cowbell-to-focus-on-business-growth-global-expansion-with-key-appointment/
- [S31] FinTech Global, Nirvana $100M (2026-01-02): https://fintech.global/2026/01/02/ai-insurer-nirvana-raises-100m-to-see-value-surge-to-1-5bn/ ; Crunchbase News: https://news.crunchbase.com/ai/insurance-platform-nirvana-valuation-nearly-doubles/
- [S32] Carrier Management, Kettle interview (2025-01-30): https://carriermanagement.com/features/2025/01/30/271065.htm ; Artemis: https://www.artemis.bm/news/kettle-re-using-deep-learning-to-make-climate-linked-risks-reinsurable/ ; Beinsure (RLI): https://beinsure.com/news/insurtech-kettle-rli-launch-wildfire-focused-commercial-property-cover/
- [S33] Koop robotics E&O (Newswire): https://www.newswire.com/news/autonomous-vehicle-insurtech-koop-technologies-launches-industry-first-21821703 ; seed: https://www.newswire.com/news/autonomous-vehicle-insurtech-koop-technologies-raises-2-5-million-seed-21462443
- [S34] Sixfold Series B: https://finder.techleap.nl/news/feed/sixfold-raises-30m-series-b-to-build-ai-underwriter ; Beinsure: https://beinsure.com/news/sixfold-launches-ai-underwriter-life-health-insurance/
- [S35] Federato: https://pulse2.com/federato-25-million-funding/ ; https://www.clay.com/dossier/federato-funding
- [S36] TechCrunch, Tractable $65M (2023-07-18): https://techcrunch.com/2023/07/18/tractable-snaps-up-65m-led-by-softbank-for-car-and-property-damage-appraisals-using-ai
- [S37] Shift Technology press: https://www.shift-technology.com/en-gb/resources/press/shift-technology-launches-shift-claims-to-power-claims-transformation-with-agentic-ai ; FinTech Global (2025-09-17): https://fintech.global/2025/09/17/shift-technology-unveils-agentic-ai-powered-shift-claims/
- [S38] Descartes Underwriting About: https://www.descartesunderwriting.com/about ; Artemis (OAK Global/Lloyd's): https://www.artemis.bm/news/descartes-underwriting-teams-with-oak-global-to-deliver-parametric-solutions-via-lloyds/
- [S39] Reinsurance News, NormanMax to acquire FloodFlash: https://www.reinsurancene.ws/normanmax-to-acquire-floodflash/ ; Intelligent Insurer: https://intelligentinsurer.com/normanmax-to-acquire-parametric-flood-insurtech-floodflash
- [S40] Reinsurance News, Arbol $60M Series B: https://www.reinsurancene.ws/arbol-closes-60m-series-b-funding-round-to-scale-parametric-insurance/ ; Artemis, Arbol Bermuda MGU: https://www.artemis.bm/news/arbol-launches-bermuda-mgu-parametric-reinsurance/
- [S41] ITIJ, Cover-More Europe/Blink: https://www.itij.com/latest/news/cover-more-europe-launches-first-parametric-flight-delay-benefit ; FinTech Global: https://fintech.global/?p=176472
- [S42] Drive Tesla Canada (Tennessee filing): https://driveteslacanada.ca/news/tesla-insurance-files-to-expand-into-tennessee-targeting-march-2026-launch/ ; Electrek (2022): https://electrek.co/2022/03/15/tesla-insurance-expand-two-more-states-underwrite-itself/
- [S43] Sacra, Marshmallow: https://sacra.com/c/marshmallow ; HM Government of Gibraltar: https://www.gibraltar.gov.gi/press-releases/gibraltar-welcomes-marshmallow-as-its-newest-insurance-company-8882020-6483
- [S44] Insurance Edge, Zego 2024 results: https://insurance-edge.net/2025/09/24/zego-posts-results-for-2024-net-loss-reduced/ ; UKTN: https://www.uktech.news/insurtech/delivery-rider-insurer-zego-cuts-over-100-jobs-exits-b2b-market-as-it-aims-for-2025-profitability-20241001
- [S45] Reinsurance News wefox tag: https://www.reinsurancene.ws/tag/wefox/ ; wefox media: https://media.wefox.com/249880-wefox-to-sell-italian-entities-wefox-mga-s-r-l-and-wefox-services-italy-s-r-l-to-j-c-flowers-
- [S46] Getsafe press release (2024-08): https://www.hellogetsafe.com/en-de/press-releases/europes-leading-neo-insurer-getsafe-reports-profitability-and-strong-growth
- [S47] ZhongAn Online Annual Report 2025 (HKEX): https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0319/2026031900592.pdf
- [S48] Waterdrop FY2025 results: https://www.placera.se/pressmeddelanden/waterdrop-waterdrop-inc-announces-fourth-quarter-and-fiscal-year-2025-unaudited-financial-results-and-declares-a-cash-dividend-20260325 ; Q2 2025 (Tiger): https://www.itiger.com/news/1118579801
- [S49] 澎湃新闻 on 元保 IPO: https://m.thepaper.cn/detail/30757283 ; 每日经济新闻: https://www.nbd.com.cn/articles/2026-03-20/4300925.html ; 界面: https://m.jiemian.com/article/13135250.html
- [S50] 相互宝: 爱范儿 https://www.ifanr.com/1463626 ; 36Kr https://www.36kr.com/p/1551193896816513 ; 人人都是产品经理 https://www.woshipm.com/it/5283217.html ; https://www.woshipm.com/news/5268875.html ; 中证网（相互保叫停）https://www.cs.com.cn/bx/201811/t20181128_5898016.html ; 澎湃 https://www.thepaper.cn/newsDetail_forward_3291475
- [S51] 新华网, 蚂蚁保发布「蚁小保」(2025-09-12): https://www.news.cn/tech/20250912/9049db3678314adab1612b5af40f507b/c.html
- [S52] Ping An press release (PR Newswire, 2026-07-29): https://tools.prnewswire.com/en-us/live/20813/release/20260729EN14654 ; 同花顺 (2026-09-08): https://news.10jqka.com.cn/20260908/c679674146.shtml ; 每经 (2026-04-01): https://www.nbd.com.cn/articles/2026-04-01/4320853.html
- [S53] Tokio Marine (secondary): Instech podcast https://instechlondon.podbean.com/e/bob-pick-group-deputy-cito-cio-tokio-marine-group-how-well-do-you-know-generative-ai-339 ; Cytora podcast https://cytora.com/podcasts/speed-scale-genai-how-specialty-insurers-are-rewiring-underwriting-in-2025-l-instech-nyc
- [S54] Palantir & SOMPO (Business Wire, 2025-08-12): https://www.businesswire.com/news/home/20250812905441/en/Palantir-and-SOMPO-Expand-Partnership-in-Multi-Year-Agreement ; Coverager: https://coverager.com/palantir-expands-sompo-partnership/
- [S55] TechCrunch, bolttech Series C (2025-06-04): https://techcrunch.com/2025/06/04/singapore-based-insurtech-bolttech-closes-147m-series-c-at-a-2-1b-valuation ; FinTech Global: https://fintech.global/2025/06/05/bolttech-secures-147m-series-c-and-hits-2-1bn-valuation/
- [S56] The Asian Banker, Igloo Pre-Series C: https://theasianbanker.com/press-releases/igloo-closes-$36m-pre-series-c-fundraise-with-50-valuation-increase ; Insurance Business Asia: https://www.insurancebusinessmag.com/asia/news/breaking-news/impact-fund-doubles-down-on-southeast-asian-embedded-insurtech-582339.aspx
- [S57] Qover press (Revolut): https://www.qover.com/press/qover-redesigns-revolut-insurance-across-europe ; Tech.eu: https://tech.eu/2023/07/06/insurtech-scaleup-qover-raises-30-million-to-drive-growth-and-profitability
- [S58] Cover Genius Series D (FinTech Futures): https://fintechfutures.com/?p=15261136 ; Cover Genius Series C: https://covergenius.com/company/news/series-c-cap-raise/
- [S60] Pulse 2.0, Pibit.AI $7M Series A: https://pulse2.com/pibit-ai-7-million-series-a/
- [S61] TechCrunch, Bestow $120M Series D (2025-05-13): https://techcrunch.com/2025/05/13/insurtech-bestow-lands-120m-series-d-from-goldman-sachs-smith-point-capital
- [S62] Ethos Form S-1: https://www.sec.gov/Archives/edgar/data/1788451/000119312525219975/d901135ds1.htm ; TechCrunch (2026-01-29): https://techcrunch.com/2026/01/29/how-sequoia-backed-ethos-reached-the-public-market-while-rivals-fell-short
- [S63] Ladder support pages: https://support.ladderlife.com/hc/en-us/articles/360001846568-Can-I-trust-Ladder ; https://support.ladderlife.com/hc/en-us/articles/360001837787-What-is-underwriting- ; Hannover Re (Business Wire): https://www.businesswire.com/news/home/20201020005201/en/Hannover-Re-US-and-Ladder-Announce-Partnership-Growth-in-the-US-Life-Insurance-Market
- [S64] Coverager, Vouch introduces AI Insurance: https://coverager.com/vouch-introduces-ai-insurance/ ; Vouch: https://www.vouch.us/verticals/ai
- [S65] Corgi Series B press release: https://www.corgi.insure/press-releases/series-b ; Yahoo Finance ($108M): https://finance.yahoo.com/news/corgi-insurance-secures-108m-launch-111921974.html
- [S66] TechCrunch, Harper (2026-02-25): https://techcrunch.com/2026/02/25/ai-insurance-brokerage-harper-raises-45m-series-a-and-seed/
- [S67] TechCrunch, Ominimo (2025-04-10): https://techcrunch.com/2025/04/10/ai-insurtech-ominimo-bags-its-first-investment-at-a-220m-valuation ; IBS Intelligence (Series B): https://ibsintelligence.com/ibsi-news/ominimo-reaches-1-6bn-valuation-after-series-b-funding-round/
- [S68] Carrier Management (2026-02-10): https://www.carriermanagement.com/news/2026/02/10/284411.htm ; FinTech Global (Tuio/WaniWani): https://fintech.global/2026/02/10/tuio-and-waniwani-bring-real-time-home-insurance-quoting-to-chatgpt/ ; Insurify: https://insurify.com/press/news/insurify-chatgpt-plugin-upgrade/ ; Coverager week in review (WaniWani seed): https://coverager.com/week-in-review-august-10-14-2026/
- [S69] ACORD (2026-05-28): https://acord.org/news-detail/2026/05/28/insurance-industry-is-now-agentic-ai-ready-with-mcp-architecture-from-acord-solutions-group ; Socotra MCP (Business Wire): https://www.businesswire.com/news/home/20250915015677/en/Socotra-Launches-MCP-Server-Enabling-Fast-and-Secure-Integrations-with-Agentic-AI
- [S70] Allianz, Project Nemo: https://www.allianz.com/de/mediencenter/news/artikel/251103-der-sturm-legt-sich-der-allianz-ki-agent-raeumt-auf.html
- [S71] ERGO Radar, AI agents & insurance sales (2026-06-08): https://ergo.com/en/radar-magazine/digitalisation-and-technology/2026/luisa-marie-schmolke-ai-agents-insurance-sales
- [S72] Armilla × Chaucer (2025-04-30): https://www.armilla.ai/resources/armilla-launches-affirmative-ai-liability-insurance-with-lloyds-underwriter-chaucer ; Chaucer PR: https://media.chaucergroup.com/documents/Press_release_-_Chaucer_x_Armilla_AI.pdf ; Armilla $25M limit: https://www.armilla.ai/resources/armilla-ai-raises-lloyds-backed-coverage-to-25m-as-traditional-insurers-retreat-from-ai-risk
- [S73] AIUC: Runtime Wire https://runtimewire.com/article/aiuc-raises-40m-ai-agent-certification-insurance ; launch https://www.webull.com/news/13211879479550976 ; ElevenLabs https://elevenlabs.io/blog/aiuc-announcement ; Coverager https://coverager.com/elevenlabs-secures-ai-agent-insurance/
- [S74] Munich Re aiSure: https://www.munichre.com/en/solutions/for-industry-clients/insure-ai.html ; itoo × Munich Re: https://www.cover.co.za/news/itoo-special-risks-launches-africas-first-ai-performance-insurance-in-partnership-with-munich-re
- [S75] Testudo: Coverager https://coverager.com/testudo-expands-ai-liability-capacity-with-atrium-and-qbe/ ; FinTech Global https://fintech.global/2026/03/09/testudo-expands-ai-liability-capacity-to-9-25m/ ; S&P Global https://www.spglobal.com/market-intelligence/en/news-insights/articles/2026/2/as-insurers-retreat-from-ai-risk-one-startup-plans-to-fill-the-gap-97375264 ; The Insurer https://www.theinsurer.com/cyber-risk/news/exclusive-testudo-to-launch-lloyds-capacity-backed-genai-liability-offering-as-2026-01-15
- [S76] Relm Insurance AI suite: https://relminsurance.com/relm-insurance-launches-ai-suite/ ; Business Insurance: https://www.businessinsurance.com/relm-unveils-artificial-intelligence-products/
- [S77] Google Cloud RPP blog: https://cloud.google.com/blog/products/identity-security/whats-new-with-google-clouds-risk-protection-program ; The Stack: https://www.thestack.technology/google-boosts-cloud-telematics-cyber-insurance-programme/
- [S78] Klaimee: FinTech Global (2026-07-22) https://fintech.global/2026/07/22/klaimee-lands-5-5m-to-insure-autonomous-ai-agents/ ; YC launch https://www.ycombinator.com/launches/QCC-klaimee-insures-your-ai-agents
- [S79] Big "I" / IA, Verisk GenAI exclusions: https://www.independentagent.com/vu_resource/verisk-to-roll-out-new-general-liability-exclusions-for-generative-ai-exposures/
- [S80] TechCrunch (citing FT, 2025-11-23): https://techcrunch.com/2025/11/23/ai-is-too-risky-to-insure-say-people-whose-job-is-insuring-risk/embed/ ; The Decoder: https://the-decoder.com/major-insurers-seek-to-exclude-ai-related-risks-from-corporate-policies/
- [S81] Geneva Association press release (2025-10-02): https://www.genevaassociation.org/sites/default/files/2025-10/genai_report_pr_0110_0.pdf ; report: https://www.genevaassociation.org/sites/default/files/2025-10/gen_ai_report_0110.pdf
- [S82] Eling & Lehmann (2018), Geneva Papers 43(3): https://ideas.repec.org/a/pal/gpprii/v43y2018i3d10.1057_s41288-017-0073-0.html
- [S83] Braun & Schreiber (2017), I.VW-HSG Vol. 62: https://ideas.repec.org/b/zbw/usgivw/62.html ; PDF: https://www.ivw.unisg.ch/wp-content/uploads/2023/08/ab-insurtech_2017.pdf
- [S84] Stoeckli, Dremel & Uebernickel (2018), Electronic Markets 28(3): https://ideas.repec.org/a/spr/elmark/v28y2018i3d10.1007_s12525-018-0304-7.html
- [S85] Cosma & Rimo (2024), Research in International Business and Finance 70:102301: https://airus.unisalento.it/retrieve/27b0b197-cb30-493d-a99b-be3139c9078b/insurtech.pdf
- [S86] Sosa & Sosa (2025), Risks 13(6):108: https://ideas.repec.org/a/gam/jrisks/v13y2025i6p108-d1671126.html
- [S88] OECD (2020): https://www.oecd.org/en/publications/the-impact-of-big-data-and-artificial-intelligence-ai-in-the-insurance-sector_c822ee53-en.html
- [S89] EIOPA (2019) Big Data Analytics thematic review: https://register.eiopa.europa.eu/Publications/EIOPA_BigDataAnalytics_ThematicReview_April2019.pdf
- [S90] EIOPA (2024) digitalisation report: https://www.eiopa.europa.eu/eiopa-report-takes-pulse-digitalisation-european-insurance-market-2024-04-30_en ; EIOPA GenAI survey (2025-05-15): https://www.eiopa.europa.eu/eiopa-surveys-european-insurers-their-use-generative-ai-2025-05-15_de
- [S91] EIOPA Opinion on AI governance and risk management (2025-08-06): https://www.eiopa.europa.eu/eiopa-publishes-opinion-ai-governance-and-risk-management-2025-08-06_en
- [S92] IAIS Application Paper on supervision of AI (2025-07): https://www.iais.org/2025/07/the-iais-publishes-application-paper-on-the-supervision-of-artificial-intelligence/
- [S93] Quarles, NAIC Model Bulletin adoption: https://quarles.com/newsroom/publications/nearly-half-of-states-have-now-adopted-naic-model-bulletin-on-insurers-use-of-ai
- [S94] arXiv:2607.11999 "Underwriting the Agent Economy" (not read): https://arxiv.org/pdf/2607.11999
