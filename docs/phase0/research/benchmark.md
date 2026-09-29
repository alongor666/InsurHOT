# InsurHOT「产品基准引擎（Product Benchmark Engine）」Phase-0 研究报告

- 研究日期：2026-09-29
- 研究范围：现有保险产品评级方法论、产品可比性难题、数据标准、分险种评测维度、价格可比性与法律边界、热度信号风险
- 标注约定：`[S#]` = 文末 Sources 编号（均为本次实际检索/抓取到的 URL）；**UNKNOWN** = 未能检索到可靠来源；**NEEDS VALIDATION** = 有线索但未经一手来源核实，或只来自二手摘要。
- 方法说明：本次 WebSearch 配额在研究中途用尽（200 次上限），后半程改用 WebFetch/curl 直接抓取官方原文（gov.cn、nfra.gov.cn JSON 接口、legislation.gov.uk、FCA Handbook、OPIN swagger 等）。凡只来自搜索摘要、未打开原文核实的，已单独标注。

---

## 0. 关键结论（TL;DR）

1. **全球没有一家机构用"一个分数"同时覆盖产品条款、价格、服务、偿付能力。** 成熟体系都是"分层 + 分画像"：Defaqto/Moneyfacts 只评条款特征、不评价格与服务 [S1][S3][S4]；Canstar 把价格与特征按**消费者画像**加权，同一产品对不同画像星级不同 [S11][S12]；Which? 把"保单分"与"客户分"分开，再用门槛规则给 Recommended Provider [S8][S9]；AM Best 等评的是保险公司偿付能力而非产品 [S18]；J.D. Power/Consumer Reports 评的是满意度/服务 [S15][S17]。InsurHOT 应显式保持这些层的分离。
2. **监管机构自己也不愿给单一分数。** FCA 的 GI value measures 明确称数据"不是为了帮助消费者直接选择产品"，且应"综合考虑而非孤立看单一指标" [S24]；EIOPA 的 value-for-money 基准是按产品聚类后的四分位阈值，"不是安全港"、也不是消费者披露工具 [S27]。这直接支持 InsurHOT 采用"多维基准 + 可选画像化综合分"。
3. **商业评级普遍存在利益冲突**：Defaqto、Canstar、J.D. Power 均向被评方收取徽标/评级使用授权费 [S3][S13][S17]；Canstar 还收导流佣金与推广位费用 [S13]；中国主流"测评"平台（深蓝保、小雨伞）本身是持牌**保险经纪公司** [S50][S51]，深蓝保同时自称"中立客观 独立第三方平台" [S50]。星级通胀也明显：Moneyfacts 2026 车险 218 款中 84 款五星（约 39%）[S6]。这是 InsurHOT 定位"独立、证据可追溯"的差异化空间，也是必须用制度设计（不收费、不导流）来守住的底线。
4. **中国法律边界是最大风险项，且 2026-09-30（明天）起更严。**
   - 《互联网保险业务监管办法》第二十三条：**非保险机构不得**"比较保险产品、保费试算、报价比价"、"提供保险产品咨询服务"、"为投保人设计投保方案"等 [S37]；第十五条（四）：营销宣传"不得片面比较保险产品价格和简单排名" [S37]。
   - 《金融产品网络营销管理办法》（八部门，2026-09-30 施行）第二条：金融机构及其委托的第三方互联网平台以外的"其他组织或者个人，不得开展或者变相开展金融产品网络营销"；"网络营销"定义为"通过互联网对金融产品进行**商业性宣传推介**的活动，包括但不限于展示介绍金融产品相关信息……提供转接渠道" [S38]。第十八条：未取得相应资质者**不得在网站、APP、账号名称中使用"保险"等字样**；第十九条对商标有类似限制 [S38]。
   - 结论：InsurHOT 在中国境内若带有任何商业属性（导流、佣金、保司付费、投保入口、个性化方案），极可能被认定为"变相开展互联网保险业务/金融产品网络营销"。必须设计为**非商业、面向公众的标准与数据研究**，不提供保费试算与个性化推荐，并对中文名称中是否出现"保险"二字做合规评估。
5. **欧盟/英国的边界更清晰**：IDD 把"根据客户所选标准提供信息、编制保险产品排名（含价格与产品比较）"算作保险分销，**前提是客户能直接或间接通过该网站订立合同** [S28]；"仅提供产品信息且不采取任何协助订约的额外步骤"不构成分销 [S28]。FCA PERG 指出：被动展示信息不构成"安排"；报刊/网站类出版物中的建议一般落入 RAO 第 54 条豁免；但"比较不同保单条款"**可能**构成 article 25(2) 下的"安排" [S32][S33]。→ 不设投保通道、不做"你应该买 X"的个别化推荐，是跨法域通用的护栏。
6. **可借用的数据标准**：Open Insurance Brasil（OPIN）公开了逐险种的产品 Open Data JSON schema（OpenAPI 3.0），覆盖人身、车、家财、网络风险、一般责任等数十个 API [S34]，是 Universal Insurance Product Schema（UIPS）最好的开放蓝本；EU IPID 给出了 9 类强制信息 + 固定标题结构 [S29][S31]；ACORD 有产品模型（Product Model/Product Schema）但为会员/订阅制 [S35]；schema.org 没有 `InsurancePolicy` 类型，只有通用的 `FinancialProduct` [S36]。
7. **推荐框架**：L1 通用 schema（身份/版本/证据/覆盖/除外/等待期/免赔/续保/价格结构/核保/服务/发行人）+ L2 险种 schema + 三分法维度（客观可测 / 半结构化需专家编码 / 不应打分）+ **画像化权重 + 永远同时展示分维度结果**（"分数卡"而非"单一排名"）+ 方法论语义化版本号 + 缺失数据显式化（覆盖率、置信区间、不插补为"好"）。

---

## 1. 现有产品评级方法论调研

### 1.1 方法论比较总表（交付物 a）

| 体系 | 地区 | 评价对象 | 核心维度 | 价格是否计入 | 数据来源 | 更新频率 | 独立性/商业模式 | 主要批评/局限 | 来源 |
|---|---|---|---|---|---|---|---|---|---|
| Defaqto Star Ratings | 英国 | 产品条款 | 每产品 40–100 项特征与利益，各 1–5 分，加总后由专家定星级阈值（"DNA"体系）；"core criteria"不满足则不得 4–5 星 | **否**（也不评服务） | 条款/产品资料 | 每年 2 月 1 日更新，新品随时评 | B2B；被评方不付费参评，但使用星级徽标需付授权费 | FOS 曾称其评级为"puff"；五星旅行险不含航空公司破产保障；AMII 批评其 PMI 评级"highly dangerous" | [S1][S2][S3][S4][S5] |
| Moneyfacts Star Ratings | 英国 | 产品条款 | 车险 >80 字段；家财 >140 数据点（摘要） | 提及"competitive charges"，细节不明（NEEDS VALIDATION） | 产品资料 | 年度 | 徽标"badge of approval"；收费细节未披露（UNKNOWN） | 2026 车险 218 款中 84 款五星（~39%），区分度弱 | [S6][S7] |
| Which? 保险评测 / Which? Recommended Provider | 英国 | 保险公司的标准保单 + 客户体验 | Policy score（车险 78 项/家财 85 项保单要素）+ Customer score（理赔客户满意度、推荐意愿调查） | 间接（调查中"value for money"） | 条款 + 调查（如车险 2,454 名近两年理赔客户，Dynata 执行） | 年度 | 非营利消费者组织 | WRP 采用门槛逻辑：客户分显著高 + 保单覆盖≥平均 + 理赔分不低于平均 | [S8][S9] |
| Finder UK | 英国 | 产品/保险公司 | Expert score（特征 1–5 星）+ 客户满意度（推荐 50%/五星比例 25%/平均满意度 25%） | 否（专家分） | 专家评审 + 每险种约 750 人年度调查 | 年度 | 明示收取合作方报酬，报酬"may affect the order, position or placement" | 商业排序与评分并存 | [S10] |
| Canstar Star Ratings | 澳大利亚/新西兰 | 产品×消费者画像 | Price score + Feature score，按画像加权（车险 <25 岁 80/20，30–49 岁 70/30；特征分含理赔满意度 20%） | **是**（用标准画像报价） | 标准画像报价（车险 6 类画像×6 州=36 profiles，每州 6 个地址、新车/5 年车两种车型）+ 特征库 + Qualtrics 理赔满意度调查 | 年度重算 + 持续监测 | 收导流佣金、推广位费（可能高于导流费）、评级徽标授权费；称评级不受商业影响 | 并非覆盖全市场；五星目标约为前 5–10%（摘要） | [S11][S12][S13] |
| Consumer Reports | 美国 | 保险公司 | 会员调查：理赔处理、代理沟通、保单清晰度、保费公平性等 | 主观"保费是否公平" | 会员调查（车险曾报 40,566 名投保人，NEEDS VALIDATION 出处） | 不定期 | 不接受外部广告；收入来自会员、捐赠、联盟链接、授权（授权使用须完整引用不得截取） | 服务评价而非产品评价 | [S15][S16] |
| J.D. Power | 美国等 | 保险公司服务 | 客户满意度研究 | 否 | 调查 | 年度研究 | 排名本身不收费，但在广告中引用/用徽标需付授权费；主要收入来自企业数据 | 服务≠产品 | [S17] |
| AM Best / S&P / Fitch | 全球 | **保险公司**偿付能力 | 财务实力评级（ability to pay claims） | 否 | 财务报表、监管数据 | 持续 | 发行人付费模式（行业通识，NEEDS VALIDATION）；AM Best 为 NRSRO | 不评产品 | [S18] |
| NAIC Complaint Index | 美国 | 保险公司×险种 | 投诉份额 ÷ 保费（市场）份额；1.00=行业平均 | 否 | 各州监管投诉数据 | 年度 | 监管数据 | 小公司波动大；未区分投诉是否成立（NEEDS VALIDATION） | [S19] |
| FCA GI Value Measures | 英国 | 公司×产品类别 | 理赔频率、理赔接受率、平均赔付额、理赔投诉占比、赔付占保费比例 | 否（赔付占保费比例间接反映价值） | 强制报送（零售保费>£40 万且有效保单>3,000 的公司） | 年度（2025 数据于 2026-07-21 发布） | 监管数据 | FCA 明示"不是为了帮助消费者直接选择产品"，家财险理赔接受率口径不一致 | [S24] |
| FCA Consumer Duty（fair value） | 英国 | 产品（制造商自评） | 价格与"可合理预期的利益"之关系；考虑产品性质、质量、总价格、目标市场特征、限制 | 是 | 企业内部评估 | 定期复核 | 监管义务 | 不对外公开打分 | [S25] |
| EIOPA VfM benchmarks | 欧盟 | 投连/混合型产品 | 先按 6 特征聚类，再用 8 项指标（入口费用/保费、总费用/保费、RIY、退保价值/保费、IRR、保险利益、盈亏平衡回报等）设四分位阈值 | 是（费用与回报） | 监管数据收集 | 2024-10-07 发布方法论 | 监管 | "不是安全港"，非消费者披露工具 | [S26][S27] |
| India Claim Settlement Ratio | 印度 | 寿险公司 | 已决/已报死亡理赔件数比 | 否 | IRDAI 年报 | 年度 | 监管数据 | 按件数不按金额（例：件数 95% 而金额仅约 48.7%）；不分险种、个团混合、小样本波动 | [S20] |
| compareFIRST | 新加坡 | 寿险产品 | 输入出生日期、性别、吸烟、保额、保障期、缴费期、是否含 CI；按保费、保险公司、保证身故利益等排序 | 是（原始保费） | 保险公司报送 | UNKNOWN | MAS、LIA、CASE、MoneySENSE 联合公共项目（2015-03-31 上线） | 只比较，不打综合分 | [S21][S22] |
| 보험다모아 | 韩国 | 产品 | 按公司对比保费与保障金额；险种：单独实损、车险、旅行、年金、保障/储蓄型 | 是 | 生/损保协会运营，金融当局支持 | UNKNOWN | 公共平台（2015-11-30 上线） | 字段细节 UNKNOWN（官网抓取失败） | [S23] |
| 深蓝保（深蓝Model/金榜） | 中国 | 产品 | 重疾险：以《中国人身保险业重大疾病经验发生率表(2020)》《经验生命表(2010-2013)》为基础算"保障得分"和"性价比得分"（保障/保费）；2024 年升级金榜为"五个维度 192 项细则"（媒体报道） | 是 | 条款 + 精算模型 | 持续 | **持牌保险经纪公司**（许可证 269594000000800），水滴集团入股，自称"中立客观 独立第三方" | 公式未公开；测评与销售一体 | [S50] |
| 小雨伞 | 中国 | 产品 | UNKNOWN（方法论未检索到） | — | — | — | **小雨伞保险经纪**（许可证 269633000000800） | 测评与销售一体 | [S51] |
| 蜗牛保险 / 多保鱼 / 沃保 | 中国 | 产品 | **UNKNOWN**（官网抓取失败或跳转至无关站点，方法论与牌照均未核实） | — | — | — | NEEDS VALIDATION | — | — |
| 中国保险行业协会标准 | 中国 | 条款定义 | 重疾定义 2020 版：28 种重度 + 3 种轻度；定期/终身寿险示范条款（2023，2026 修订征求意见）；商车险 NCD 方案（2020 版） | — | 行业标准 | 随修订 | 行业协会 | 标准化降低了"定义差异"，但未消除"额外病种/赔付结构"差异 | [S49][S52] |
| 金融机构消保监管评价 | 中国 | 金融机构 | 7 要素：体制机制≥10%、适当性≥10%、营销行为≥25%、纠纷化解≥25%、金融教育≥10%、消费者服务≥5%、个人信息保护≥5%；1–5 级 | 否 | 监管 | 年度 | 监管 | **结果不公开**，且"金融机构不得为广告、宣传、营销等商业目的将消保监管评价结果对外披露" | [S43] |
| 人身险公司服务评价 / 客户满意度指数 | 中国 | 公司 | 定性、定量指标 + 满意度（总体/承保/保全/理赔分指数） | 否 | 中保协 + 第三方调查 | 年度（2013 起） | 行业自律 | 当前公开程度 NEEDS VALIDATION | [S52] |
| 短期健康险综合赔付率披露 | 中国 | 公司（整体业务） | 综合赔付率 =（再保后赔款支出 + 再保后未决赔款准备金提转差）÷ 再保后已赚保费，每半年官网披露 | 间接 | 保险公司强制披露 | 半年 | 监管 | 公司整体口径，非单产品 | [S44] |
| 中国消费者协会保险评测 | 中国 | — | **UNKNOWN**（未检索到） | — | — | — | — | — | — |
| Morningstar 类比 | — | — | 保险领域无直接对应物；EIOPA VfM（聚类 + 分位基准）是最接近"同类比较"的思想 | — | — | — | — | — | [S27] |

### 1.2 从现有体系提炼的设计经验

1. **"特征评级（feature-based）"与"价格/价值评级（price-based）"应分开计算、分开展示。** Defaqto 明确不计价格 [S3]；Canstar 把两者用画像权重合成，但价格来自标准画像报价 [S11]。同一产品在 Canstar 中可能对某画像五星、对另一画像二三星 [S12]——这正是"单一分数掩盖结构差异"的反例与解药。
2. **"门槛 + 分数"优于"纯加权"。** Defaqto 的 core criteria [S2]、Which? WRP 的"客户分显著高 + 保单≥平均 + 理赔分不低于平均" [S9] 都用硬门槛防止"某项极差被其他项平均掉"。
3. **小样本要处理。** Canstar 对问卷不足 30 份的公司使用网络均值或"均值减一个标准误"的保守估计 [S11]；Which? 要求至少 30 个调查回复 [S8]；印度 CSR 小公司波动大 [S20]。
4. **"相对排名"会随市场而漂移**：Canstar 以最佳产品为满分、其他按比例指数化 [S11]，导致分数跨年不可比。InsurHOT 应同时提供"绝对刻度（对照固定参考产品/固定标准）"与"相对分位"。
5. **星级通胀与商业授权**：Moneyfacts 约 39% 五星 [S6]；Defaqto/Canstar/J.D. Power 均有徽标授权收入 [S3][S13][S17]。Consumer Reports 的做法（不收广告、授权必须完整引用不得截取）[S16] 是更好的独立性参照。
6. **监管指标可作"证据层"而非"结论层"**：FCA value measures、NAIC complaint index、中国短期健康险赔付率都是公司或产品线层面的聚合指标，受业务结构、通胀、灾害影响，监管本身都提示不可孤立解读 [S19][S24][S44]。

---

## 2. 为什么保险产品难以比较

### 2.1 结构性原因（逐项）

| 难点 | 说明 | 证据/来源 |
|---|---|---|
| 保障范围与除外 | 同名产品的"保什么/不保什么"差异大；监管强制文件（IPID）也专设"What is not insured?""Are there any restrictions on cover?"两个栏目 | [S29][S31] |
| 定义差异 | 中国重疾险由行业统一 28 种重度 + 3 种轻度定义，但此前旧规范为 25 种，2021-01-31 后停售旧定义产品——**同一名称的"重疾"在不同版本下含义不同** | [S49] |
| 免赔额/等待期/赔付比例 | 监管要求短期健康险在条款中"清晰、明确、无歧义"表述保险期间、责任、免除、理赔条件、退保、缴费、等待期、保额、免赔额、赔付比例 | [S44] |
| 续保条件 | 短期健康险须写明"不保证续保"，禁止使用"自动续保""承诺续保""终身限额"等易混淆表述；长期医疗险费率可调机制在健全中 | [S44][S45] |
| 价格依赖个体风险 | compareFIRST 需输入年龄、性别、吸烟等 [S22]；Canstar 需指定年龄段、州、地址、车型 [S11]。"价格"不是产品属性而是"产品×个体"的函数 | [S11][S22] |
| 免赔额与保费的替代关系 | Canstar 以目标免赔额 $700 取报价，若无该档则取最近档，并将 20% 免赔额（按每百张保单约 20 次理赔的频率）加到年保费上以抵消"高免赔低保费"偏差 | [S11] |
| 产品版本与停售 | 保险公司停售短期健康险须至少提前 30 日披露；已停售产品重新销售须重新报批/备案 | [S44] |
| 地区/时间差异 | 金融机构须提示产品仅面向许可区域客户 [S38]；Canstar 按州分别评级 [S11] | [S11][S38] |
| 附加服务捆绑 | OPIN 产品 schema 单列 `assistanceServices`/`assistanceType`（人身险 assistanceType 枚举 56 项）| [S34] |
| 公司层面风险 | 偿付能力（AM Best 等评公司"ability to pay claims"）[S18]、理赔实践（FCA 理赔接受率等）[S24]——产品条款相同，实际体验可能不同 | [S18][S24] |
| 数据口径不一 | FCA 承认家财险理赔接受率在公司间存在报告不一致 [S24]；印度 CSR 按件不按金额 [S20] | [S20][S24] |

### 2.2 学术与监管文献：复杂性、隐藏属性与选择错误

- **Bhargava, Loewenstein & Sydnor（NBER w21160, 2015；QJE 2017 "Choose to Lose"）**：在一家大公司的健康险菜单中存在大量"财务上被占优"的选项，**多数员工选择了被占优方案**；年长者、女性、低收入者更易选错；若统一分配到单一精算最优方案，员工会更好；原因是"严重的健康保险素养缺陷" [S53]。→ 启示：**"更多可选项 + 信息"不等于更好的决策**，基准应把"被占优（dominated）"识别作为一项客观、可验证的输出。
- **Gabaix & Laibson（QJE 2006）"Shrouded Attributes"**：在存在短视消费者的市场中，企业有动机隐藏附加费用，且即使竞争充分、广告无成本，信息隐藏也可持续，市场力量无法自行消除 [S54]。→ 保险中的除外责任、续保条件、费率调整权正是典型"隐藏属性"。
- **FCA Occasional Paper No.1（2013）**：金融产品"inherently complex"，消费者面对复杂性会简化决策（如只看首页价格）；人们是"糟糕的直觉统计学家"，易在保险决策中误判概率；企业倾向于"obfuscate unattractive product attributes, such as exclusions in insurance contracts"；并以 PPI 为例说明偏差导致的市场失灵 [S55]。
- **FCA 自身定位**：value measures 数据"not intended to help consumers choose insurance products directly" [S24]。
- **EIOPA IPID**：以两页 A4（例外三页）的标准化格式强制呈现 9 类信息 [S29][S30][S31]——监管层面承认需要"统一骨架"才能比较。
- Kunreuther 等关于保险决策行为偏差的研究（如 *Insurance and Behavioral Economics*, 2013）——**NEEDS VALIDATION**（本次未能打开原始出处）。

---

## 3. 可支撑 Universal Insurance Product Schema（UIPS）的数据标准

### 3.1 各标准概览

| 标准 | 开放性 | 与产品描述相关的内容 | 来源 |
|---|---|---|---|
| **Open Insurance Brasil（OPIN）Open Data 产品 API** | 公开（OpenAPI 3.0 YAML，v3.0.0） | 逐险种端点 `/open-insurance/products-services/v1/...`：auto-insurance、home-insurance、person、life-pension、cyber-risk、general-liability、D&O、E&O、environmental-liability、travel（作为报价域）、rural、transport、extended-warranty 等数十个 | [S34] |
| **EU IPID**（IDD Art.20 + Reg. 2017/1469） | 公开法规 | 9 类信息 + 固定标题（What is this type of insurance? / What is insured? / What is not insured? / Are there any restrictions on cover? / Where am I covered? / What are my obligations? / When and how do I pay? / When does the cover start and end? / How do I cancel the contract?）| [S29][S31] |
| **ACORD** | **会员/订阅制** | P&C XML/AL3、Life & Annuity XML、Next-Generation Digital Standards（面向 API/微服务，v1-13-0 于 2026-05 发布）；Reference Architecture 含 Business Glossary、Information Model（Policy/Product/Party/Claims）、Data Model、**Product Model + ACORD Product Schema（XML）** | [S35] |
| **schema.org** | 公开 | 无 `InsurancePolicy` 类型（404）；`FinancialProduct`（"insurance companies" 在定义中）继承 Service 属性：areaServed、audience、brand、category、feesAndCommissionsSpecification、aggregateRating 等 | [S36] |
| **FIBO** | 公开 | 保险领域覆盖程度 **UNKNOWN / NEEDS VALIDATION**（站点为 SPA，未能核实保险本体） | — |
| **中国人身保险产品信息披露** | 公开（平台查询） | 2022 征求意见稿：中国保险行业协会、中国银保信作为"行业公共平台"；应披露产品条款、费率、现金价值表等，覆盖售前/售中/售后 [S47]。正式稿文号与生效日 **NEEDS VALIDATION** | [S47] |
| **中国财产险产品自主注册平台** | 行业平台 | 《非车险综合治理行动方案》（2026-08）要求"优化险种分类，为产品报备……提供统一标准"，"推动财产保险公司保险产品自主注册平台更好发挥作用"，建设行业级数据库 | [S46] |
| **韩国 보험다모아** | 公共 | 保费与保障金额对比 [S23]；韩国"보험가격지수"（价格指数）字段 **NEEDS VALIDATION** | [S23] |
| **新加坡 compareFIRST** | 公共 | 输入：出生日期、性别、吸烟、保费类型、保障期、缴费期、保额、CI 附加；输出/排序：保费、保证身故利益、保证给付、总保费 | [S22] |

### 3.2 OPIN 字段（已从官方 swagger 解析，节选）

- **Person（人身险）产品**：`name, code, category, insuranceModality(11 枚举), coverages, assistanceType(56 枚举), additional, termsAndConditions{susepProcessNumber, definition}, globalCapital, validity, pmbacRemuneration, benefitRecalculation, reclaim, otherGuaranteedValues, allowPortability, portabilityGraceTime, premiumPayment{paymentMethod, frequency}, minimumRequirements{contractingType, contractingMinRequirement}, premiumRates, targetAudience`；
  覆盖属性 `PersonCoverageAttributes`：`indemnityPaymentMethod, indemnityPaymentFrequency, minValue, maxValue, indemnifiablePeriod, gracePeriod（等待期）, deductibleDays, deductibleBRL, excludedRisks（枚举：战争、核、既往症、流行病/大流行、自杀、故意违法等 10 项）, excludedRisksURL, allowApartPurchase（可否单独购买）, ageAdjustment` [S34]
- **Auto**：`coverages{coverage(23 枚举), coverageAttributes{minLMI, maxLMI, contractBase, fullIndemnityPercentage, deductibleType, deductiblePercentage, mandatoryParticipation, geographicScopeCoverage}}, carParts, carModels, assistanceServices, terms, customerServices, premiumPayment, minimumRequirements, targetAudiences, premiumRates` [S34]
- **Home**：`coverages{coverageType(32 枚举), coverageAttributes{minLMI, maxLMI, minDeductibleAmount, insuredMandatoryParticipationPercentage}}, propertyCharacteristics, propertyZipCode, protective, microInsurance, validity…` [S34]
- **Cyber risk**：`maxLMG, coverageAttributes{maxLMI, maxLA, insuredParticipation, indenizationBasis}, traits, validity…` [S34]
- 共用单位字典：`CoverageAttributesDetailsUnit{code(85 枚举), description(302 枚举)}` [S34]

### 3.3 跨标准共有字段（→ UIPS L1 的依据）

| 概念 | OPIN | IPID | compareFIRST | 中国短期健康险关键信息 | schema.org |
|---|---|---|---|---|---|
| 产品身份/名称/发行人 | name, code, brand/company | 制造商名称与 logo | 保险公司 | 产品全称、承保公司全称 [S37] | name, brand, provider |
| 监管备案号/条款文本 | termsAndConditions.susepProcessNumber, definition | 指向完整合同文件的声明 | — | 条款 | — |
| 险种分类 | category / coverage 枚举 | What is this type of insurance? | 产品类型 | 保险期间、产品类型 | category |
| 保障责任与保额 | coverages, min/maxValue, LMI | What is insured?（含保额） | 保额、保证身故利益 | 保险责任、保险金额 | — |
| 除外责任 | excludedRisks(+URL) | What is not insured? / restrictions | — | 责任免除 | — |
| 等待期/免赔/自付比例 | gracePeriod, deductible*, mandatoryParticipation | restrictions | — | 等待期、免赔额、赔付比例 | — |
| 地域范围 | geographicScopeCoverage | Where am I covered? | — | — | areaServed |
| 期限与续保 | validity | When does cover start/end | 保障期、缴费期 | 保险期间、不保证续保 | — |
| 缴费方式/频率 | premiumPayment | When and how do I pay? | 保费类型 | 保费交纳方式 | feesAndCommissionsSpecification |
| 投保条件/目标人群 | minimumRequirements, targetAudience | obligations | 年龄/性别/吸烟 | 如实告知、投保年龄与保费关联 | audience |
| 退保/解约 | reclaim | How do I cancel? | 退保价值（部分产品） | 退保约定、最低现金价值 | — |
| 附加服务 | assistanceServices | — | — | — | — |

---

## 4. 分险种评测维度（Layer 2）

> 三分法：**O = 客观可测**（可由条款/费率表机械抽取并验证）；**S = 半结构化**（需专家编码规则、可复核但有判断）；**N = 不应打分**（只展示、不进入分数，因高度个体化、不可验证或有法律/伦理风险）。
> 以下"变量清单"部分来自法规/标准（已标来源），其余为本研究的**设计建议**（未标来源者即为建议，非事实陈述）。

### 4.1 重疾险（CI）
- O：重度/中度/轻度病种数与是否全部采用行业统一定义（2020 版 28 重 + 3 轻）[S49]；各档赔付比例；是否多次赔付及间隔期；等待期；保障期限（定期/终身）；身故责任是否与重疾共用保额；豁免范围；现金价值表；费率（按年龄/性别）。
- S：非统一定义病种的定义宽严度；"额外赔付"触发条件；分组多次赔付的分组合理性；病种发生率加权后的"期望赔付"（可参考深蓝保用《重大疾病经验发生率表(2020)》加权的思路 [S50]，但 InsurHOT 必须**公开公式**）。
- N：单纯的"病种数量"排名（病种数量与发生率高度不对称，易误导）；保险公司"品牌大小"。

### 4.2 医疗险（百万医疗 / 中端医疗 / 城市商业医疗保险「惠民保」）
- O（短期健康险监管要求的"关键信息"本身就是现成的 O 类清单）：保险期间、保险责任、责任免除、理赔条件、退保约定、保费交纳方式、等待期、保险金额、免赔额、赔付比例 [S44]；是否"不保证续保"/续保条款文字 [S44]；长期医疗险费率调整机制 [S45]；公司短期健康险整体综合赔付率（半年披露）[S44]；停售披露与停售产品清单 [S44]。
- S：外购药/特药清单宽窄、医院范围（公立普通部/特需/国际部）、既往症处理（惠民保常见"既往症可保但赔付比例降低"——**NEEDS VALIDATION** 具体条款）、健康告知宽严度（监管要求健康告知"不得出现有违一般医学常识等情形" [S44]）。
- N：个人是否"能过健告"；以"保额越高越好"排序（监管禁止"严重背离理赔经验数据基础的、虚高的保险金额" [S44]）。
- 惠民保特别说明：监管文件现称"城市商业医疗保险"，要求"按照商业保险的基本原则和客观规律，平稳有序开展" [S45]；各城市版本逐年变化、带政府指导属性，应**按城市×年度版本**独立建档。

### 4.3 定期寿险
- O：保额、保障期、缴费期、免责条款数量与内容（行业有《定期寿险示范条款》2023 版，2026 年修订征求意见 [S52]）、等待期、保费（标准画像）、是否含全残/猝死等扩展、可转换权。
- S：健康告知宽严、职业类别限制、智能核保可用性。
- N：公司"理赔快慢"的非系统化口碑。

### 4.4 意外险
- O：意外身故/伤残保额、伤残评定标准（行业《人身保险伤残评定标准》[S52]）、意外医疗免赔额与比例、是否限社保内、职业类别、猝死责任、交通工具额外赔付。
- S：高风险运动除外清单宽窄。
- N：以"保费极低"单独排名（易与保障缩水混淆）。

### 4.5 车险（中国商车险）
- 结构性差异：商车险使用行业示范条款，保障结构高度同质 [S52]；差异集中在**定价（NCD、自主系数）与服务**（NCD 方案 2020 版 [S52]）。
- O：示范条款版本、附加险选择、NCD 系数、交强险/商业险分项保费（标准画像 × 车型 × 城市）、理赔时效等监管公开数据（如有）。
- S：救援与增值服务（代驾、检测等）。
- N：跨公司"条款优劣"打分（示范条款下意义有限）；个人化报价展示（中国法规风险，见 §8）。

### 4.6 家财险（Home）
- O：各保障项最低/最高限额（LMI）、免赔额、自负比例（OPIN 字段 [S34]）、自然灾害/盗抢/管道破裂等责任是否包含、地域。
- S：重置价值 vs 实际价值、租客/房东适用性。
- N：个人房屋风险定价。

### 4.7 旅行险
- O：医疗/医疗转运保额、行程取消/延误、行李、是否含航空公司破产（Defaqto 案例说明其重要性 [S4]）、年龄上限、既往症条款。
- S：高风险运动、目的地除外。
- 画像：Canstar 对老年画像以 30% 价格/70% 特征、其他画像 50/50（**来自搜索摘要，NEEDS VALIDATION**）[S14]。

### 4.8 宠物险
- O：意外/疾病/综合档次、年度限额、免赔、赔付比例、年龄上限、等待期、遗传/先天性疾病除外。
- 画像：Canstar 意外-only 55/45、意外+疾病 50/50、综合 45/55（**搜索摘要，NEEDS VALIDATION**）[S14]。

### 4.9 网络风险（Cyber）
- O：OPIN 字段 maxLMG、maxLMI、maxLA、insuredParticipation、indenizationBasis [S34]；第一方/第三方责任、勒索、业务中断等责任是否包含。
- S：战争/国家行为除外、系统性事件除外措辞。
- N：对企业个体安全水平的推断。

### 4.10 商业责任险（Commercial liability）
- O：OPIN 有 general-liability、D&O、E&O、environmental-liability 等独立 schema [S34]；限额（每次/累计）、自留额、追溯期、发生制/索赔制。
- S：除外条款宽窄、法域适用。
- N：面向中小企业的"最佳"推荐（高度依赖个体风险，且在多数法域接近"建议"）。

---

## 5. 价格可比性

### 5.1 现有平台如何"归一化"价格
1. **标准画像报价（persona pricing）**：Canstar 车险 6 类画像 × 6 州，每州 6 个地址、两种车龄车型，用新单报价（非续保价）[S11]。
2. **免赔额对齐**：目标免赔额 + 最近档替代 + 免赔额按理赔频率折算入保费 [S11]。
3. **相对指数化**：最低价满分，其余按相对成本计分 [S11]。
4. **用户自填参数即时比较**：compareFIRST（年龄/性别/吸烟/保额/期限）[S22]；보험다모아（保费/保障金额）[S23]。
5. **单位保额价格 / 期望赔付比**：深蓝保"保障 ÷ 保费"思路 [S50]；EIOPA 用 RIY、IRR、退保价值/保费等（投连）[S27]。

### 5.2 对 InsurHOT 的建议（设计建议）
- 只公布**少量固定"参考画像（reference personas）"**下、**来自公开费率表**的价格点（如 30 岁男性不吸烟 50 万保额 20 年缴），并在每个数字旁展示画像参数、费率表版本与抓取日期；**不提供用户自定义保费试算**（中国法规明确禁止非保险机构"保费试算、报价比价"[S37]）。
- 价格维度以"价格区间 + 分位"呈现，不做"最便宜"排序；明确"价格≠价值"。
- 对长期产品额外展示"费率是否可调""保证/非保证部分"。

### 5.3 中国关于价格比较与产品评价的法律要点
- 《互联网保险业务监管办法》（2021-02-01 施行）第二十三条：非保险机构不得开展互联网保险业务，包括"（一）提供保险产品咨询服务。（二）比较保险产品、保费试算、报价比价。（三）为投保人设计投保方案。（四）代办投保手续。（五）代收保费。" [S37]
- 同法第十五条（四）：互联网保险营销宣传"不得进行不实陈述或误导性描述，不得片面比较保险产品价格和简单排名……不得片面或夸大宣传"；（六）要求标明产品全称、承保公司全称，"突出说明容易引发歧义或消费者容易忽视的内容" [S37]。
- 《保险销售行为管理办法》（2023-09-28 公布，2024-03-01 施行，6 章 50 条）把销售分为销售前/中/后；"销售前行为"指"为订立保险合同创造环境、准备条件、招揽保险合同相对人的行为" [S39]。汉坤律师指出该办法以正面清单方式定义，需与互联网办法第二十三条负面清单结合判断，且对"销售导流"等擦边行为未作明确判断 [S39]。该办法中关于"比较宣传/诋毁同业"的具体条文 **NEEDS VALIDATION**（未能获取原文）。
- 《金融产品网络营销管理办法》（2026-09-30 施行）：第二条、第三条（定义）、第十条（不得"夸大保险责任或保险产品收益，将保险产品收益与存款、资产管理产品等金融产品简单类比"；不得"引用不真实、不准确或未经核实的数据"；不得利用监管/自律组织审核备案误导消费者认为其提供保证）、第十三条（算法推荐须提供不针对个人特征的选项）、第十八/十九条（名称与商标中"保险"等字样）、第二十条（第三方平台不得就金融产品与消费者"互动咨询"）[S38]。
- 《广告法》第九条（三）禁止使用"国家级""最高级""最佳"等用语；第十一条引证数据须真实准确并"表明出处"；第十三条不得贬低其他生产经营者；第十四条广告须可识别，不得以新闻报道形式变相发布广告 [S40]。
- 《反不正当竞争法》2025 修订（2025-10-15 施行）加大了商业诋毁罚则（来自搜索摘要）[S42]；具体条号 **NEEDS VALIDATION**。
- 《保险法》修订草案 2026-09-04 公开征求意见至 2026-10-03（搜索摘要）[S58]——可能改变"销售/中介"边界，需跟踪。

### 5.4 欧盟/英国关于比较网站与"分销/建议"的边界
- IDD Art.2(1)(1)："insurance distribution" 包括"the provision of information concerning one or more insurance contracts in accordance with criteria selected by customers through a website or other media and the compilation of an insurance product ranking list, including price and product comparison … **when the customer is able to directly or indirectly conclude an insurance contract using a website or other media**" [S28]。
- IDD Art.2(2)：不构成分销的包括"(d) the mere provision of information about insurance … products … to potential policyholders where the provider does not take any additional steps to assist in the conclusion of" a contract，以及"(a) the provision of information on an incidental basis in the context of another professional activity" [S28]。
- FCA PERG 5.15 表：被动展示信息不构成 article 25(2) 下的"安排"；"Explanation of the terms of a particular policy or comparison of the terms of different policies"——"Possibly"，"likely to amount to making arrangements under article 25(2)"，可能适用 article 72C 等排除；"Advice by journalists in newspapers, broadcasts etc."——"Generally, no because of the article 54 exclusion"；"Advising that a customer take out a particular policy"——Yes（regulated advice）[S32]。
- RAO 第 54 条：报纸、期刊、定期出版物或"regularly updated news or information"服务中的书面建议可被排除，前提是其"principal purpose"（含其中的广告与推广材料整体观察）不是提供该类建议或引导人们订立相关合同 [S33]。**注意**：第 54 条原文列举的"relevant investments"等是否覆盖一般保险合同的建议，需英国律师确认（NEEDS VALIDATION）。
- 英国一般保险"价格游走"禁令（续保价不得高于同渠道新单价，2022 起）——**NEEDS VALIDATION**（FCA PS21/5 页面抓取 404）。

**判断**：独立评测机构若（i）不提供投保通道或导流链接、（ii）不对个人作"你应买/不应买某产品"的推荐、（iii）以出版物形式向公众发布、（iv）不收取保险公司费用，则在 EU/UK 框架下较有可能落在"mere provision of information"/出版物豁免范围内；在中国则**即使非商业也存在"比较保险产品"被认定为互联网保险业务的风险**，须取得当地法律意见。

---

## 6. 产品"热度/人气"信号及其偏差与操纵风险

| 信号 | 偏差 | 操纵方式 | 相关规则 | 建议处理 |
|---|---|---|---|---|
| 平台销量/"爆款"标签 | 渠道偏差（只反映某一平台）；佣金驱动推荐导致"热度"是营销结果而非质量 | 刷单、补贴冲量 | 电子商务法第十七条禁止"虚构交易、编造用户评价" [S41] | 不作为评分输入；如展示须标注来源渠道与口径 |
| 搜索量/社媒声量 | 争议与营销同样带来声量；KOL 带货 | 购买流量、假粉丝 | FTC 规则禁止买卖虚假粉丝/浏览量等"fake social media indicators" [S56]；网络营销办法限制非金融机构从业人员通过直播短视频营销金融产品 [S38] | 仅作"关注度"指标，与质量评分物理隔离 |
| 用户评价/评分 | 选择性评价、幸存者偏差（未理赔者多给好评） | 虚假评价、刷好评、压制差评、员工评价 | FTC 禁止 fake reviews、review suppression、insider reviews、伪装独立的评价网站 [S56]；电子商务法第十七条 [S41] | 只采集可验证身份/保单的评价；区分"理赔体验"与"投保体验"；公开采集与剔除规则 |
| 平台排序位置 | 付费位置/竞价排名 | 付费置顶 | 电子商务法第四十条：竞价排名须显著标明"广告" [S41]；Finder 承认报酬可能影响排序位置 [S10] | 不接受任何付费排序 |
| 投诉量 | 规模偏差（大公司投诉绝对数高） | 劝退投诉、线下和解 | NAIC 用投诉份额/保费份额标准化 [S19] | 用"每亿元保费/每万张保单"类标准化，并显示样本量与置信区间 |
| 个性化推荐 | 信息茧房、过度消费 | 算法诱导 | 网络营销办法第十三条：须提供不针对个人特征的选项、不得设置诱导过度消费的算法 [S38]；电子商务法第十八条 [S41] | 默认非个性化 |

**原则**：热度（popularity）≠ 质量（quality）≠ 价值（value）。热度只能作为一个单独、标注清晰、不进入综合分的"市场关注度"面板；并按 Goodhart 效应预期一旦公开会被博弈。

---

## 7. 推荐框架（交付物 b）

### 7.1 总体架构

```
证据层 Evidence  ──>  事实层 Facts(UIPS L1/L2)  ──>  指标层 Metrics(O/S)  ──>  呈现层 Benchmarks
(条款PDF/费率表/          (结构化字段+来源定位+       (版本化计算规则，         (分维度分数卡 + 画像化
 监管披露/公司年报)        置信度+抓取时间)            可重放)                   可选综合分 + 门槛标记)
```
每个数值都能回溯到：文件哈希 → 页码/条款号 → 抽取人/模型 → 复核人 → 方法论版本。

### 7.2 Layer 1：通用字段（UIPS-Core，建议）

| 模块 | 字段（建议） | 对应来源依据 |
|---|---|---|
| Identity | product_id（InsurHOT 内部稳定 ID）、product_name_full、insurer_legal_name、insurer_id（统一社会信用代码/LEI）、distributor(s)、jurisdiction、regulatory_filing_no（备案/注册号）、line_of_business（受控词表）、product_family_id | OPIN susepProcessNumber、互联网办法要求标明产品全称和承保公司全称 [S34][S37] |
| Versioning | product_version、terms_doc_hash、rate_table_hash、effective_from、effective_to、sale_status（在售/停售/重新备案）、supersedes | 短期健康险停售披露 [S44] |
| Coverage[] | coverage_code（受控词表）、benefit_type（补偿/给付）、sum_insured_min/max、sub_limits、payout_ratio、trigger_definition_ref（如"重疾 2020 规范第 X 条"）、standard_definition_flag | OPIN coverages、IPID What is insured [S31][S34] |
| Exclusions[] | exclusion_code（受控词表：战争、核、既往症、自杀、故意行为、流行病等）、scope、text_ref | OPIN excludedRisks、IPID [S31][S34] |
| CostSharing | waiting_period_days、deductible(amount/days/per-claim/annual)、coinsurance_pct、mandatory_participation | OPIN gracePeriod/deductible* [S34]；短期健康险关键信息 [S44] |
| TermAndRenewal | policy_term、premium_term、renewability（保证/不保证/可调）、rate_adjustable_flag、renewal_wording_ref | [S44][S45] |
| Premium | premium_structure（固定/可调/自然费率）、payment_methods、payment_frequency、reference_persona_prices[]（persona_id, price, source_ref, as_of）| OPIN premiumPayment/premiumRates [S34] |
| Eligibility | age_range、occupation_class、health_declaration_ref、geographic_scope、target_audience | OPIN minimumRequirements/targetAudience [S34]；IPID Where am I covered [S31] |
| Termination | cancellation_terms、cash_value_table_ref、cooling_off | IPID How do I cancel [S31]；最低现金价值公式 [S44] |
| Services | assistance_services[]（受控词表）、claims_channels | OPIN assistanceServices [S34] |
| Issuer context（链接，不并入产品分） | solvency/财务评级引用、公司层面赔付率/投诉率引用、数据期间 | [S18][S19][S44] |
| Provenance（每字段） | source_url/doc_id、page/clause、extracted_at、extraction_method（人工/模型）、reviewer、confidence | InsurHOT 自有要求 |

### 7.3 Layer 2：险种扩展
按 §4 为每个险种定义扩展字段（如 CI：`illness_list[]{code, severity, standard_def}`、`multi_claim_rules`；Medical：`hospital_scope`、`drug_list_ref`、`preexisting_rule`；Auto-CN：`model_clause_version`、`ncd_table_ref`；Cyber：`first_party[]`、`third_party[]`、`war_exclusion_wording`），并保持与 OPIN 相应 schema 的**字段映射表**，以便跨法域对齐 [S34]。

### 7.4 维度分类规则（O / S / N）
- **O 客观可测**：可由条款/费率表抽取、两名独立抽取者一致率高、可自动校验（如等待期天数、免赔额、是否保证续保）。
- **S 半结构化**：需编码手册（codebook）+ 双人独立编码 + 分歧仲裁；公开编码规则与一致性指标（如 Cohen's κ）。例：除外条款宽严度、医院范围、健康告知宽严。
- **N 不应打分**：个体化（能否通过核保、个人风险价格）、不可验证（未经核实的口碑）、法律风险（个性化"最适合你"）、以及公司层面指标（偿付能力、投诉率）——后者作为**独立的"发行人面板"**并列展示，不混入产品分，避免把"公司好"误读为"产品好"。

### 7.5 权重与画像（Profiles）
1. **默认不给综合分**；默认视图是"分维度分数卡"（每个维度：数值 + 同类分位 + 证据链接）。
2. **可选综合分只在"命名画像"下出现**，例如"家庭支柱-保障优先""预算敏感-基础保障""带病体-可保性优先"。每个画像公开：权重向量、门槛规则、适用/不适用人群说明。这是对 Canstar"按画像加权、同一产品不同星级" [S11][S12] 的透明化升级。
3. **门槛（gates）先于加权**：如"不保证续保的长期医疗宣传""非标准重疾定义"等触发**红旗**，任何画像下综合分都附带红旗，不能被其他维度抵消（借鉴 Defaqto core criteria 与 Which? WRP 门槛 [S2][S9]）。
4. **敏感性分析**：公布"权重扰动 ±X% 时排名是否稳定"；排名不稳定的产品只显示"同一档（tier）"，不显示名次。
5. **用户可调权重但不产生"推荐"**：若允许用户调权重，输出仍是"在你设定的权重下的排序"，并附免责声明——在中国，此功能本身可能触及"为投保人设计投保方案/比较保险产品"，**须先取得法律意见**（见 §8）。

### 7.6 避免"单一分数掩盖结构差异"
- 同类比较仅在**可比集合（comparable set）**内进行：先按险种 × 保障期 × 续保属性 × 给付/补偿 × 目标人群聚类（借鉴 EIOPA 聚类思路 [S27]），跨聚类不排名。
- **被占优检测**：在同一聚类、同一参考画像下，若 A 在所有 O 类维度不劣且价格更低，则标注 B"被占优"——这是可验证、最有决策价值的输出（呼应 Bhargava 等 [S53]）。
- 分数卡始终并列显示：特征（Features）/ 价格（Price, 参考画像）/ 条款透明度（Clarity）/ 发行人面板（Issuer, 不计分）/ 证据覆盖率（Coverage of evidence）。
- 雷达图/分档替代单一名次；禁止"第一名/最佳"措辞（亦符合广告法第九条 [S40] 与互联网办法"简单排名"禁止 [S37] 的精神）。

### 7.7 方法论本身的版本化
- 语义化版本：`BM-<line>-MAJOR.MINOR.PATCH`（MAJOR：维度/权重结构变化；MINOR：新增字段/编码规则调整；PATCH：错误修正）。
- 每个已发布分数固化：方法论版本 + 数据快照 ID + 代码提交哈希，可重放（reproducible）。
- 变更流程：RFC → 公开征求意见期（参考监管征求意见实践，如中保协示范条款修订公开征求意见 [S52]）→ 影子运行（新旧版本并行计算并公布差异）→ 生效。
- 年度复审（参考 Defaqto 每年 2 月 1 日、Canstar 年度重算 [S2][S11]），并保留"历史版本可查"。
- 发布"方法论变更日志"和"已知局限"章节（参照 FCA 对口径不一致的明示做法 [S24]）。

### 7.8 缺失数据与不确定性
- **缺失≠0，缺失≠平均**：字段状态四态——`present`/`absent_in_terms`（条款明确不含）/`not_found`（未找到证据）/`not_applicable`。只有 `absent_in_terms` 可按"不含"计分；`not_found` 不插补，维度分显示"证据覆盖率 x%"，覆盖率低于阈值则不出维度分。
- 小样本指标（投诉、满意度）：设最小样本（参考 Which?/Canstar 的 30 份阈值 [S8][S11]），不足者显示"样本不足"；可选用保守收缩估计（参考 Canstar"均值减一个标准误" [S11]）并公开方法。
- 区间而非点值：S 类维度给出编码一致性与区间；综合分给出基于权重扰动与编码不确定性的区间。
- 时效：每个字段带 `as_of`；超过有效期（如费率表更新、惠民保新年度）自动降级为"待复核"。
- 纠错通道：保险公司与公众均可提交"证据型更正"（必须附条款/公告），处理记录公开。

---

## 8. 法律/合规护栏（交付物 c）

### 8.1 中国（最高优先级；**须取得持牌律所书面意见后才可上线任何比较功能**）
1. **不做"互联网保险业务"**：不提供保费试算、报价比价、投保方案设计、代办投保、代收保费、产品咨询（一对一问答）[S37]。
2. **不做"金融产品网络营销"**：不接受任何保险机构委托/付费/佣金；不设投保跳转/转接链接或二维码；不做"商业性宣传推介" [S38]。在内容层面避免可被认定为"推介"的表达（"推荐""首选""必买"）。
3. **名称与标识**：评估中文名称、域名、APP/账号名称、商标是否含"保险"等字样；未取得相应资质或未经同意不得使用（第十八、十九条）[S38]。"InsurHOT"英文名是否被视为"涉金融属性字样或者内容"——**NEEDS VALIDATION（律师判断）**。
4. **不做"简单排名"与绝对化用语**：不发布"最佳/第一/最好"榜单；不做"片面比较价格"[S37][S40]。
5. **数据引证**：所有数据"真实、准确并表明出处"，注明适用范围与有效期（广告法第十一条精神）[S40]；不得引用未经核实数据 [S38]。
6. **不贬低、不诋毁**：负面结论必须基于条款原文与公开方法，给被评方事前核对与更正通道（降低商业诋毁/名誉侵权风险；广告法第十三条 [S40]；反不正当竞争法商业诋毁条款 NEEDS VALIDATION [S42]）。
7. **不得使用监管背书**：不得暗示监管/行业协会对评测结果提供保证（网络营销办法第十条（五）[S38]）；不引用消保监管评价结果（其结果不对外，且金融机构不得用于营销 [S43]）。
8. **算法**：如有任何排序，默认提供"不针对个人特征"的选项；不设置诱导性算法 [S38][S41]。
9. **与 AI 助手的边界**：InsurHOT 若提供问答，应限定为"条款解释与方法论说明"，不针对个人给出"买/不买某产品"的结论（对应"提供保险产品咨询服务"禁区 [S37]）。
10. **关注立法动态**：《保险法》修订草案（2026-09-04 征求意见）[S58]；《银行保险机构信息披露管理办法（征求意见稿）》（2026-09-04）[S48]。

### 8.2 欧盟/英国
1. 不提供任何"直接或间接订立合同"的路径（含联盟链接/导流）——否则落入 IDD 分销定义 [S28]。
2. 定位为出版物/研究，内容面向公众而非个人化推荐；避免"Advising that a customer take out a particular policy" [S32]；比较条款本身"possibly"构成安排，**需英国律师确认**是否可依赖 article 72C/54 等排除 [S32][S33]。
3. 若未来引入个性化工具或导流，需评估是否需要 FCA 授权/成为 IDD 下的中介。

### 8.3 通用独立性护栏
- **资金隔离**：不接受被评方付费参评、徽标授权、导流佣金、广告（对比：Defaqto/Canstar/J.D. Power 的授权费模式 [S3][S13][S17]；参照 Consumer Reports 不接受外部广告 [S16]）。如确需授权，要求**完整引用不得截取**（CR 模式 [S16]）。
- **利益冲突披露**：团队成员与保险机构的雇佣/持股关系公开；评测人员回避规则。
- **方法论公开**：公式、权重、编码手册、数据快照全部公开（弥补深蓝保"公式未披露"类问题 [S50]）。
- **评价内容治理**：用户评价实名/保单验证，禁止刷评、压评、员工评价（FTC 规则可作为规范参照 [S56]；电子商务法第十七条 [S41]）。
- **免责声明模板**：本基准为基于公开条款的研究性信息，不构成保险销售、推荐或投保建议；以保险合同条款为准。

---

## 9. 待验证事项清单（NEEDS VALIDATION / UNKNOWN）
1. 蜗牛保险、多保鱼、沃保的榜单方法论与牌照主体（UNKNOWN）。
2. 中国消费者协会是否发布过保险产品评测（UNKNOWN）。
3. 《人身保险产品信息披露管理办法》正式稿文号、生效日与"行业公共平台"字段清单（NEEDS VALIDATION）。
4. 《保险销售行为管理办法》中关于"比较、贬低同业"的具体条文（NEEDS VALIDATION）。
5. 《反不正当竞争法》（2025 修订）商业诋毁条号与文本（NEEDS VALIDATION）。
6. 韩国 보험가격지수 定义与字段；보험다모아 现行字段（NEEDS VALIDATION）。
7. FIBO 对保险产品的本体覆盖（UNKNOWN）。
8. Canstar 旅行/宠物/寿险权重的具体年份与出处（搜索摘要，NEEDS VALIDATION）。
9. Consumer Reports 车险调查样本 40,566 的具体出处年份（NEEDS VALIDATION）。
10. FCA 一般保险定价规则（price walking ban）原文（NEEDS VALIDATION）。
11. "InsurHOT"名称是否触发《金融产品网络营销管理办法》第十八/十九条（需律师意见）。
12. 惠民保（城市商业医疗保险）的现行监管文件与各城市条款差异的系统数据源（NEEDS VALIDATION）。
13. 深蓝保"五个维度 192 项细则"的具体维度（仅见媒体报道，未见方法论原文）。

---

## Sources

- [S1] Defaqto – Star Ratings: https://www.defaqto.com/star-ratings
- [S2] Defaqto – Our methodology（每年 2 月 1 日更新、core criteria）: https://defaqto.com/our-methodology/
- [S3] ALA – What is Defaqto（DNA、40–100 项特征、1–5 分、不含价格/服务）: https://www.ala.co.uk/what-is-defaqto
- [S4] lovemoney – Can you trust Defaqto star ratings?（FOS "puff"、授权模式、不含价格）: https://lovemoney.com/news/79249/defaqto-star-ratings-what-do-they-mean
- [S5] Professional Adviser – Brokers slam Defaqto's 'highly dangerous' PMI ratings（2012-02-03）: https://professionaladviser.com/news/2143855/brokers-slam-defaqto-highly-dangerous-pmi-ratings
- [S6] Moneyfacts – Car Insurance Star Ratings 2026: https://moneyfactsgroup.co.uk/media-centre/star-ratings/car-insurance-star-ratings-2026/
- [S7] Moneyfacts – Home Insurance Star Ratings（>140 数据点，来自搜索摘要）: https://moneyfacts.co.uk/news/money/moneyfacts-home-insurance-star-ratings-announced/
- [S8] Which? – Premium quality: best and worst insurance providers（2022）: https://www.which.co.uk/policy-and-insight/article/premium-quality-which-reveals-best-and-worst-insurance-providers-aVb497h2uQo9
- [S9] Which? – Cover that won't take you for a ride（车险，2023-03-04）: https://www.which.co.uk/policy-and-insight/article/cover-that-wont-take-you-for-a-ride-which-reveals-the-best-car-insurance-policies-aconV3n1PP5v
- [S10] Finder UK – Methodology for insurance ratings: https://www.finder.com/uk/car-insurance/methodology-for-insurance-ratings
- [S11] Canstar – 2018 Car Insurance Star Ratings Methodology (PDF): https://cdn.canstar.com.au/wp-content/uploads/2018/05/2018-Car-Insurance-Methodology-130418.pdf
- [S12] Canstar NZ – About Star Ratings: https://www.canstar.co.nz/about-star-ratings/
- [S13] Canstar NZ – How we get paid: https://www.canstar.co.nz/how-we-get-paid/
- [S14] Canstar 其他险种方法论 PDF（权重来自搜索摘要，NEEDS VALIDATION）: https://cdn.canstar.com.au/wp-content/uploads/2018/08/Travel-Insurance-Methodology-2018.pdf ；https://cdn.canstar.com.au/wp-content/uploads/2016/07/Canstar-Pet-Insurance-SR-Methodology-2016.pdf ；https://cdn.canstar.com.au/wp-content/uploads/2016/06/Direct-Life-Methodology-Report-2016.pdf
- [S15] Consumer Reports – Car insurance（调查法，来自搜索摘要）: https://www.consumerreports.org/money/car-insurance/buying-guide
- [S16] Wikipedia – Consumer Reports（不接受外部广告、授权须完整引用）: https://en.wikipedia.org/wiki/Consumer_Reports
- [S17] Wikipedia – J.D. Power（排名不收费、广告使用需授权费）: https://en.wikipedia.org/wiki/J.D._Power
- [S18] Wikipedia – AM Best（financial-strength ratings, NRSRO）: https://en.wikipedia.org/wiki/AM_Best
- [S19] Indiana DOI – Complaint information（NAIC complaint index 口径）: https://www.in.gov/idoi/companyentity-financial-compliance/complaint-information ；Kansas Complaint Index Report 2024: https://insurance.ks.gov/documents/department/publications/complaint-index-report-2024.pdf
- [S20] freefincal – Claim settlement ratio: useful or not?: https://freefincal.com/claim-settlement-ratio-2018-19/
- [S21] LIA Singapore – compareFIRST: https://www.lia.org.sg/tools-and-resources/comparefirst/
- [S22] compareFIRST: https://www.comparefirst.sg/wap/homeEvent.action
- [S23] 뉴스토마토 – 온라인 보험 슈퍼마켓 '보험다모아' 출범: https://newstomato.com/ReadNews.aspx?no=604133
- [S24] FCA – General insurance value measures data 2025: https://www.fca.org.uk/data/general-insurance-value-measures-data-2025
- [S25] FCA Handbook – PRIN 2A.4 Consumer Duty: price and value outcome: https://www.handbook.fca.org.uk/handbook/PRIN/2A/4.html
- [S26] EIOPA – value-for-money benchmark methodology（2024-10-07）: https://www.eiopa.europa.eu/eiopa-presents-its-value-money-benchmark-methodology-unit-linked-and-hybrid-insurance-products-2024-10-07_es
- [S27] Arthur Cox – EIOPA methodology on value for money benchmarks: https://arthurcox.com/knowledge/eiopa-methodology-on-value-for-money-benchmarks
- [S28] IDD (EU) 2016/97 Article 2（定义与排除）: https://www.legislation.gov.uk/eudr/2016/97/article/2
- [S29] IDD (EU) 2016/97 Article 20（IPID 内容）: https://www.legislation.gov.uk/eudr/2016/97/article/20
- [S30] Commission Implementing Regulation (EU) 2017/1469 Article 3（长度）: https://www.legislation.gov.uk/eur/2017/1469/article/3/adopted
- [S31] Commission Implementing Regulation (EU) 2017/1469 Article 6（标题结构）: https://www.legislation.gov.uk/eur/2017/1469/article/6/adopted
- [S32] FCA Handbook – PERG 5（5.2、5.6、5.15 表）: https://www.handbook.fca.org.uk/handbook/PERG/5/15.html ；https://www.handbook.fca.org.uk/handbook/PERG/5/2.html ；https://www.handbook.fca.org.uk/handbook/PERG/5/6.html
- [S33] UK RAO (SI 2001/544) Article 54 – Advice given in newspapers etc.: https://www.legislation.gov.uk/uksi/2001/544/article/54
- [S34] Open Insurance Brasil – Área do Desenvolvedor 与产品 swagger: https://br-openinsurance.github.io/areadesenvolvedor/ ；https://br-openinsurance.github.io/areadesenvolvedor/files/swagger/person.yaml ；https://br-openinsurance.github.io/areadesenvolvedor/files/swagger/auto-insurance.yaml ；https://br-openinsurance.github.io/areadesenvolvedor/files/swagger/home-insurance.yaml ；https://br-openinsurance.github.io/areadesenvolvedor/files/swagger/cyber-risk.yaml
- [S35] ACORD – Data Standards / Next-Generation Digital Standards / Reference Architecture: https://www.acord.org/standards-architecture/acord-data-standards ；https://www.acord.org/standards-architecture/acord-data-standards/next-generation-digital-standards ；https://www.acord.org/standards-architecture/reference-architecture ；（补充）https://en.wikipedia.org/wiki/ACORD
- [S36] schema.org – FinancialProduct: https://schema.org/FinancialProduct ；InsurancePolicy（返回 404）: https://schema.org/InsurancePolicy
- [S37] 《互联网保险业务监管办法》（银保监会令 2020 年第 13 号）: https://www.gov.cn/zhengce/zhengceku/2020-12/14/content_5569402.htm
- [S38] 《金融产品网络营销管理办法》（八部门公告〔2026〕第 9 号）全文: https://www.nfra.gov.cn/cn/view/pages/governmentDetail.html?docId=1255778&itemId=861&generaltype=1 （数据接口：https://www.nfra.gov.cn/cn/static/data/DocInfo/SelectByDocId/data_docId=1255778.json ）；答记者问: https://www.nfra.gov.cn/cn/static/data/DocInfo/SelectByDocId/data_docId=1255773.json ；新华网报道: https://www.news.cn/20260424/bfb6cea6823a4b10b29bd381cb5a6537/c.html
- [S39] 《保险销售行为管理办法》报道与解读：中新网 https://www.chinanews.com.cn/cj/2023/09-28/10086269.shtml ；汉坤律师事务所 https://hankunlaw.com/upload/portal/20231013/7d53b8b39392cde34e8995fce1191f01.pdf ；中证网 https://www.cs.com.cn/bx/202309/t20230929_6369108.html
- [S40] 《中华人民共和国广告法》: https://www.gov.cn/guoqing/2021-10/29/content_5647620.htm
- [S41] 《中华人民共和国电子商务法》: http://www.npc.gov.cn/zgrdw/npc/lfzt/rlyw/2018-08/31/content_2060827.htm
- [S42] 反不正当竞争法 2025 修订（来自搜索摘要）: https://www.news.cn/20250627/f18760c6420e4376b9cfd1c62857ee07/c.html
- [S43] 《金融机构消费者权益保护监管评价办法》（2025-09-12）: https://www.nfra.gov.cn/cn/view/pages/ItemDetail.html?docId=1225502&itemId=928&generaltype=0 （数据接口：https://www.nfra.gov.cn/cn/static/data/DocInfo/SelectByDocId/data_docId=1225502.json ）
- [S44] 《中国银保监会办公厅关于规范短期健康保险业务有关问题的通知》（银保监办发〔2021〕7 号）: https://www.nfra.gov.cn/cn/view/pages/ItemDetail.html?docId=958198&itemId=926&generaltype=0 （数据接口：https://www.nfra.gov.cn/cn/static/data/DocInfo/SelectByDocId/data_docId=958198.json ）
- [S45] 《国家金融监督管理总局关于推动健康保险高质量发展的指导意见》（2025-09-30）: https://www.nfra.gov.cn/cn/static/data/DocInfo/SelectByDocId/data_docId=1228166.json
- [S46] 《非车险综合治理行动方案》（2026-08-21）: https://www.nfra.gov.cn/cn/static/data/DocInfo/SelectByDocId/data_docId=1268910.json
- [S47] 《人身保险产品信息披露管理办法（征求意见稿）》说明（2022-08-02）: https://www.nfra.gov.cn/cn/view/pages/ItemDetail.html?docId=1064791&itemId=915&generaltype=0
- [S48] 《银行保险机构信息披露管理办法（征求意见稿）》（2026-09-04）: https://www.nfra.gov.cn/cn/view/pages/ItemDetail.html?docId=1270932&itemId=915&generaltype=0
- [S49] 重疾定义 2020 修订版报道：中证网 https://cs.com.cn/xwzx/hg/202011/t20201105_6108694.html ；每日经济新闻 https://www.nbd.com.cn/articles/2020-11-05/1541959.html
- [S50] 深蓝保：官网（经纪许可证、"中立客观"表述）https://www.shenlanbao.com/ ；测评页示例 https://www.shenlanbao.com/pingce/120021821004227401 ；深蓝Model（投资界，2022-06-02）https://news.pedaily.cn/20220602/35718.shtml ；新京报（2026-08-04，金榜五维 192 项）https://www.bjnews.com.cn/detail/1785835357169272.html ；新京报（2026-02-03）https://www.bjnews.com.cn/detail/1770090407168252.html
- [S51] 小雨伞保险经纪官网: https://www.xiaoyusan.com/
- [S52] 中国保险行业协会：定期寿险示范条款（2023-07-18）https://www.iachina.cn/art/2023/7/18/art_94_107043.html ；定期/终身寿险示范条款 2026 修订征求意见 https://www.iachina.cn/art/2026/6/10/art_24_109080.html ；机动车商业保险无赔款优待优化方案（2020 版）https://www.iachina.cn/art/2024/1/25/art_94_107394.html ；人身保险公司服务评价（2014）https://www.iachina.cn/art/2014/4/1/art_95_2817.html ；条款费率栏目 https://www.iachina.cn/col/col38/index.html
- [S53] Bhargava, Loewenstein & Sydnor, NBER Working Paper 21160: https://www.nber.org/papers/w21160 （QJE 2017 版本：https://academic.oup.com/qje/article/132/3/1319/3748278 ）
- [S54] Gabaix & Laibson, "Shrouded Attributes…", NBER w11755 / QJE 2006: https://www.nber.org/papers/w11755
- [S55] FCA Occasional Paper No.1 – Applying behavioural economics at the FCA (2013): https://www.fca.org.uk/publication/occasional-papers/occasional-paper-1.pdf
- [S56] FTC – Final rule banning fake reviews and testimonials (2024-08-14): https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials
- [S57] （同 S38 新华网报道）
- [S58] 《保险法（修订草案征求意见稿）》公开征求意见（新华网，来自搜索摘要）: https://www.news.cn/20260904/f675c23a97014a439a6bcc59b0e40fe8/c.html
