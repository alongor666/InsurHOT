# InsurHOT Phase-0 公开信源架构研究（Source Architecture Research）

- 版本：v0.1（2026-09-29）
- 范围：中国 + 美国、英国、欧盟、日本、韩国、新加坡、印度 + 全球（含巴西 Open Insurance 作为产品 API 标杆）
- 原则：只用**公开、合法、可核验**的信息；未能核实的内容标注 **UNKNOWN / NEEDS VALIDATION**。

---

## 0. 核验方法与局限（请先读）

1. **实测为主**：2026-09-29 在研究沙箱中用 `curl`/WebFetch 实际请求了 robots.txt、RSS、JSON 接口和条款页面，每条"已验证"结论都附了被请求的 URL。
2. **出口在境外（美国）**：部分站点会按地理位置封锁或重置连接，**不代表从中国大陆访问的情况**，例如：
   - `12378.cn`、`cbirc.gov.cn`、`bimasugam.co.in` 返回 "Access Restricted by Location"
   - `e-insmarket.or.kr`、`serff-sfa.naic.org`、`filingaccess.serff.com` 返回 403
   - `cninfo.com.cn/robots.txt`、`cbit.com.cn` 连接被重置或返回 504

   V1 需要在**目标部署地域**（中国大陆节点、海外节点各一套）复测。
3. **WebSearch 配额已用完**：研究中途会话级网页搜索配额（200 次）耗尽。之后的判断都来自直接抓取的一手页面；个别二手来源已注明。
4. 本文不构成法律意见。涉及法律风险的结论需由中国、欧盟、美国律师复核。

---

## 1. 对原始分层（Tiering）的批判与改进

原始分层是"监管/法规 → 公司披露 → 协会/学术 → 专业媒体 → 大众媒体/社交 → 热度信号"。它把**来源类型**和**可信度**混在了一个维度里，会带来几个问题：

| 问题 | 说明 | 改进 |
|---|---|---|
| "一手"≠"独立" | 保险公司的法定披露（偿付能力摘要、年报、条款）是一手材料，但由被监管主体自己报送，存在利益冲突。FCA 在 GI value measures 中明确提示"firms 之间仍可能存在报告不准确或不一致"（[FCA](https://www.fca.org.uk/data/general-insurance-value-measures-data-2025)） | 增加 **independence（独立性）** 维度：监管机构汇总 > 行业协会汇总 > 公司自披露 |
| 协会不中立 | 中保协、ABI、KLIA、LIA 属于行业自律或代表组织；Swiss Re Institute 是再保险公司下属研究机构；Geneva Association 是行业智库（[Geneva Association](https://www.genevaassociation.org/) 自称 "Global Insurance Think Tank"） | 标注 **conflict-of-interest（利益冲突）** 标签 |
| 比价平台被当成"数据源" | Policybazaar 等商业平台既是经纪人又是信息源 | 单独归为"商业中介"，只作为线索，不作为证据 |
| 热度信号不是证据 | 百度指数、小红书等只能反映关注度，而且可以被操纵 | 从证据体系中拆出，单列 **Signal 层**，不参与事实判定 |
| 法律可用性缺位 | 同一可信度的来源，可复用程度差别很大：FCA 数据集适用 OGL，而 FCA 网站本身禁止爬虫（见 §4） | 增加 **Reuse Class（复用等级）** 维度 |
| 缺少"更正机制" | 例如 EIOPA 的 provisional 统计会修订（[EIOPA](https://www.eiopa.europa.eu/tools-and-data/insurance-statistics_en)） | 增加 **correction handling（更正处理）** 维度与版本快照 |

完整提案见 §15。

---

## 2. 中国（China）

### 2.1 监管 / 法律 / 官方数据库

| 来源 | URL | 内容 | 频率 | 格式 / 机器可读性（实测） | 语言 | 法律与复用 | 可靠性 |
|---|---|---|---|---|---|---|---|
| **国家金融监督管理总局 NFRA**（2023-05-18 挂牌，在原银保监会基础上组建，统一负责除证券业以外的金融业监管）（[NFRA docId=1108819](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1108819)） | https://www.nfra.gov.cn | 规章、规范性文件、公告、政策解读、统计数据、行政处罚、消费投诉通报 | 日更 | 前端是 Angular，背后有**未公开文档的 JSON 接口**（已验证）：`/cbircweb/DocInfo/SelectDocByItemIdAndChild?itemId={id}&pageSize=&pageIndex=`，返回 `docId/docTitle/publishDate/docFileUrl(.doc)/pdfFileUrl(.pdf)`；正文接口为 `/cbircweb/DocInfo/SelectByDocId?docId=`，字段 `docClob` 是 HTML（[示例](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectDocByItemIdAndChild?itemId=4113&pageSize=3&pageIndex=1)）。实测单页最多约 20 条。`robots.txt` 返回 404（没有 robots 文件）。未发现 RSS | 中文 | 《著作权法》第五条：法律、法规及国家机关具有立法、行政、司法性质的文件及其官方正式译文，以及单纯事实消息，不适用该法（[gov.cn](https://www.gov.cn/guoqing/2021-10/29/content_5647633.htm)），因此法规和公告原文可全文存储。网站自己的使用声明 **UNKNOWN / NEEDS VALIDATION**。接口未公开，应低频礼貌抓取 | 最高权威 |
| NFRA 已验证的栏目 itemId（实测样本） | 同上 | `954`：统计数据（月度"保险业经营情况表 / 财产险公司经营情况表 / 人身险公司经营情况表 / 全国各地区原保险保费收入情况表"，季度"保险公司资金运用情况表"）；`926`：规章（如《保险公司资产负债管理办法》）；`928`：规范性文件；`925`：公告（如 2025 年度交强险业务情况公告）；`916`：政策解读；`915`：监管动态（含季度消费投诉通报）；`4113/4114/4115`：总局机关 / 监管局 / 监管分局 的行政处罚信息公示（分别累计 661、32,928、41,788 条）（[954 示例](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectDocByItemIdAndChild?itemId=954&pageSize=20&pageIndex=1)、[4115 示例](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectDocByItemIdAndChild?itemId=4115&pageSize=1&pageIndex=1)） | — | 月度统计的发布节奏：2026 年 8 月数据于 2026-09-24 发布，7 月数据于 2026-08-28 发布，6 月数据于 2026-07-24 发布（均取自 itemId=954） | 附件多为 .doc/.pdf/.wps，需要做解析 | 中文 | 同上 | 行政处罚是事实数据，可做"合规事件"信号 |
| NFRA 消费投诉通报 | 在监管动态中，例如 [docId=1113173](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1113173) | 季度保险消费投诉情况通报（首期为 2023 年一季度，2023-06-15 发布） | 季度 | HTML + 附件 | 中文 | 官方文件 | 可做"服务质量"独立指标（监管口径） |
| 12378 银行保险消费者投诉维权热线 | https://www.12378.cn | 投诉渠道 | — | **从境外访问被地理封锁（实测）** | 中文 | **UNKNOWN** | 以投诉入口为主，数据以 NFRA 通报为准 |
| 国家法律法规数据库（全国人大） | https://flk.npc.gov.cn | 法律、行政法规、司法解释 | 随立法更新 | 实测可访问（SPA）。API **UNKNOWN** | 中文 | 法律文本不受著作权保护（著作权法第五条） | 权威 |
| 中国政府网 · 政策文件库 | https://www.gov.cn/zhengce/ | 国务院及部委文件，例如金规〔2025〕13号（[gov.cn](https://www.gov.cn/zhengce/zhengceku/202504/content_7019852.htm)） | 日更 | HTML。robots 允许 `/1`，另有若干 Disallow 路径（[robots](https://www.gov.cn/robots.txt)） | 中文 | 同上 | 权威 |
| 中国证监会 / 上交所 / 深交所 / 巨潮资讯（A 股上市险企，如中国平安、中国人寿、中国太保、新华保险、中国人保） | https://www.sse.com.cn/disclosure/listedinfo/announcement/ ；https://www.cninfo.com.cn | 定期报告、临时公告 | 实时 | 巨潮页面源码中配置了 `apiServer = "http://api.cninfo.com.cn"`（巨潮 API 域名，已验证）（[cninfo](https://www.cninfo.com.cn/new/index)），商业条款 **NEEDS VALIDATION**。上交所公告页实测可访问 | 中文 | 上市公司公告属于法定披露；逐字转载的版权状态 **NEEDS VALIDATION**，建议存全文用于分析，对外只展示摘要、引用和链接 | 高（有证券法信披责任） |
| 港交所披露易 HKEXnews（H 股险企） | https://www1.hkexnews.hk/search/titlesearch.xhtml?lang=zh | 年报、公告 | 实时 | 标题搜索页可访问（已验证）；robots.txt 返回 404。RSS 或 API **UNKNOWN** | 中 / 英 | HKEX 条款 **NEEDS VALIDATION** | 高 |

### 2.2 行业自律组织 / 基础设施

| 来源 | URL | 内容 | 机器可读性（实测） | 法律 / 备注 |
|---|---|---|---|---|
| **中国保险行业协会（IAC）** | https://www.iachina.cn | 新闻、条款费率、示范条款、统计数据（`/col/col41/`）、行业指数（`/col/col43/`）、研究报告；**信息披露**频道（`/col/col4/`）下设：保险公司年度信息披露（col26）、资金运用关联交易（col27）、资金运用风险责任人（col28）、**互联网保险信息披露（col29）**、交强险信息披露（col30）、举牌上市公司股票（col31）、重大关联交易（col32）、非保险子公司（col33）、**偿付能力信息披露（col34）**、其他（col35）（均为实测栏目标题，例如 [col34](https://www.iachina.cn/col/col34/index.html)） | 使用 Hanweb CMS，列表由 `/module/web/jpage/dataproxy.jsp` 以 JS 方式加载，直接 GET/POST 未返回数据（**NEEDS VALIDATION**）。互联网保险信息披露链接指向裸 IP 系统 `http://139.224.139.151:8090/ICID/`，从境外访问超时。条款费率栏目（col38）中有示范条款文件 | 使用条款 **UNKNOWN**（首页未找到版权声明） |
| **中国人身保险产品信息库 / 条款库** | https://tiaokuan.iachina.cn （Vue SPA，后端 baseURL 为 `https://tiaokuan.iachina.cn/sinopipi`，前端含"消费者查询"模块，实测抓取了 [app.js](https://tiaokuan.iachina.cn/static/js/app.ea735e08.js)）；旧系统 `icid.iachina.cn` 会跳转到登录页 | 覆盖 2009 年新《保险法》实施后向监管报备或获批的全部人身险产品（含在售和停售）；支持按公司名称、产品名称、产品类别、产品特殊属性、保险期间等"10 个维度、23 个子维度"查询；条款上有二维码可验证；基本信息包括公司名称、产品名称、公司报送文件编号、条款内部编号、报送年度；产品类别覆盖寿险、年金、健康（疾病 / 医疗 / 失能 / 护理）、意外，设计类型为普通型 / 分红 / 万能 / 投连（来源：中保协发〔2014〕560 号 FAQ，转载于 [平安人寿 PDF](https://life.pingan.com/upload/file/changjianwenti.pdf)） | **没有公开 API**，是有反爬特征的 SPA。可行路径：①向中保协申请数据合作；②低频人工或半自动核验单个产品 | 按 2025 年修订的《反不正当竞争法》第十三条，**不得"避开或者破坏技术管理措施"获取他人合法持有的数据**（[新华网](https://www.news.cn/legal/20250627/4b6ec78bc9be4ea9a2968a9d34abd724/c.html)）→ 高风险，V1 不建议批量爬取 |
| 财产险条款费率注册 / 备案查询 | 中保协"条款费率"栏目 https://www.iachina.cn/col/col38/index.html | 示范条款，例如 2025-09-08 发布的新材料、首台（套）重大技术装备综合保险示范条款（试行） | HTML | 财产险注册 / 备案查询系统的入口和字段 **NEEDS VALIDATION** |
| 中国精算师协会 | https://www.e-caa.org.cn | 经验生命表、疾病发生率表、行业精算研究 | 实测可访问（标题"中国精算师协会"）；RSS / API UNKNOWN | UNKNOWN |
| 上海保险交易所 | https://www.shie.com.cn | 保险交易平台、再保险登记、指数 | 实测可访问 | UNKNOWN |
| 中国银保信（中国银行保险信息技术管理有限公司） | https://www.cbit.com.cn | 《人身保险产品信息披露管理办法》第九条要求其与中保协"发挥行业保险产品信息披露的平台作用"（[NFRA docId=1081986](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1081986)） | 从境外访问返回 504（实测） | NEEDS VALIDATION |

### 2.3 保险公司法定"公开信息披露"（Insurer official disclosures）

- **产品层**：《人身保险产品信息披露管理办法》（银保监会令〔2022〕8号，2022-11-17 发布，**2023-06-30 施行**）规定，产品信息可以通过以下渠道披露：①公司官网和官方公众服务号等自营平台；②中国保险行业协会等行业公共信息披露渠道；③授权或委托的合作机构和第三方媒体……。另外要求官网以外的披露内容不得与官网冲突（[NFRA docId=1081986](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1081986)）。按行业报道，该办法要求全面披露条款、费率、现金价值全表等信息，费率表和一年期以上产品的现金价值全表首次作为主动公开材料（[中证网](https://cs.com.cn/tj/02/01/202211/t20221118_6308816.html)，二手来源）。
- **分红险 / 万能险 / 投连险**：《一年期以上人身保险产品信息披露规则》（银保监规〔2022〕24号，2023-06-30 施行）规定：
  - 分红方案宣告后 15 个工作日内，在官网披露各分红产品的**红利实现率**；
  - 投连产品须披露资产配置等信息（[NFRA docId=1088640](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1088640)）；
  - 2024 年《关于健全人身保险产品定价机制的通知》进一步要求，**以销售时使用的演示利率为基础计算红利实现率**（[NFRA docId=1175200](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1175200)）。

  → 这是 InsurHOT 的**高价值结构化指标**（"产品兑现度"）。
- **销售与退保**：《保险销售行为管理办法》（国家金融监督管理总局令〔2023〕2号，2024-03-01 施行）规定：
  - 第十四条：在官网、官方 APP 等官方线上平台公示现有保险产品的条款信息和产品说明；
  - 第四十条：在官方线上平台披露退保条件标准和退保流程时限（[NFRA docId=1129945](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1129945)）。
- **公司层**：《保险公司信息披露管理办法》目前仍有效（NFRA 在 2026 年征求意见稿说明中称，新办法将"整合和修订"该办法并同步废止它）（[NFRA docId=1270935](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1270935)）。原办法的文号和施行日期（一般认为是银保监会令 2018 年第 2 号）**NEEDS VALIDATION**。
- **偿付能力**：中保协设有"偿付能力信息披露"栏目（col34，实测）。C-ROSS 季度摘要的具体披露规则（偿二代监管规则第 13 号）的原文链接 **NEEDS VALIDATION**。NFRA 已于 2024-12-20 发文延长偿付能力监管规则（Ⅱ）的实施过渡期（[NFRA 规范性文件列表](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectDocByItemIdAndChild?itemId=928&pageSize=20&pageIndex=1)，docId=1191077）。
- **互联网保险**：《互联网保险业务监管办法》于 2020-12-14 发布，共 5 章 83 条（[NFRA docId=949136](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=949136)）。施行日期（2021-02-01）和其中关于"中保协网站披露"的条款 **NEEDS VALIDATION**。中保协设有"互联网保险信息披露"栏目（col29，实测）。

**机器可读性**：各公司官网的"公开信息披露"栏目格式不统一，以 HTML + PDF 为主，需要逐家写适配器。V1 建议先覆盖头部约 30 家人身险公司和约 15 家财险公司。

### 2.4 专业媒体 / 大众媒体 / 社交（中国）

| 来源 | URL | 机器可读性（实测） | 法律要点 |
|---|---|---|---|
| 中国银行保险报（中国银行保险传媒） | https://www.cbimc.cn （旧站 bbtnews.com.cn 从境外访问连接被重置） | SPA，robots 返回 HTML（没有标准 robots 文件）；RSS UNKNOWN | 新闻作品受著作权保护。《著作权法》第二十四条的合理使用情形有限（[gov.cn](https://www.gov.cn/guoqing/2021-10/29/content_5647633.htm)），只能存摘要和链接 |
| 慧保天下、13 精等（主要是微信公众号） | mp.weixin.qq.com | `mp.weixin.qq.com/robots.txt` 对 `User-Agent: *` 设置 `Disallow: /`（只放行少数路径）（[robots](https://mp.weixin.qq.com/robots.txt)） | 禁止爬取。只能人工引用并附链接，或取得授权 |
| 雪球 | https://xueqiu.com | robots 返回 302 + 阿里 WAF 脚本（实测） | 反爬，禁止爬取 |
| 知乎 | https://www.zhihu.com | robots 对具名搜索引擎（如 Googlebot）列了 Disallow 规则（[robots](https://www.zhihu.com/robots.txt)）。ToS **NEEDS VALIDATION** | 用户生成内容（UGC）+ 个人信息，风险高 |
| 小红书 | https://www.xiaohongshu.com | robots 对 `User-agent: *` 设置 `Disallow: /`（[robots](https://www.xiaohongshu.com/robots.txt)） | 禁止爬取 |
| 抖音 | https://www.douyin.com | robots 对大量具名 spider 设有规则；从境外访问 `*` 规则时连接被重置，**NEEDS VALIDATION** | 禁止爬取（推定） |

---

## 3. 美国（US）

| 来源 | URL | 内容 | 机器可读性（实测） | 法律 / 备注 |
|---|---|---|---|---|
| **SEC EDGAR** | https://www.sec.gov/search-filings/edgar-application-programming-interfaces | 上市险企 10-K/10-Q/8-K 和 XBRL 财务数据 | `data.sec.gov` 提供 RESTful JSON，**不需要认证或 API key**；每晚约 3:00 ET 更新批量 ZIP；访问限制为**每个用户不超过 10 次请求/秒**，并需声明 User-Agent（[SEC](https://www.sec.gov/about/developer-resources)）。实测 `https://data.sec.gov/submissions/CIK0000005272.json`（AIG，SIC 6331）返回成功；全文检索接口 `efts.sec.gov/LATEST/search-index` 返回 JSON | 美国联邦政府作品，通常不受版权保护（**NEEDS VALIDATION**：17 U.S.C. §105）。企业提交的文件版权另议 |
| **Federal Register API** | https://www.federalregister.gov/api/v1/documents.json | 联邦规则 | 实测返回 JSON（关键词 "insurance" 命中 ≥10,000 条） | 公共领域（NEEDS VALIDATION） |
| **SERFF Filing Access (SFA)** | 新入口 `https://serff-sfa.naic.org/serff/sfa/home/{STATE}`（据 [Oklahoma DOI](https://www.oid.ok.gov/regulated-entities/rate-and-form-filing/public-rate-and-form-filings/)、[Alabama DOI](https://aldoi.gov/RatesForms/SERFFsPublicAccess.aspx)） | 各州"标记为可公开"的费率 / 条款备案 | **从本研究环境访问返回 403**（新旧入口都是）。按 Alabama DOI 的说明，filings "subject to … public access statute"，只有被标记为公开的才能看到 | 使用条款、批量访问限制、是否收费 **NEEDS VALIDATION**；产品库价值最高的美国来源 |
| NAIC | https://content.naic.org | 统计、Model Laws、Consumer Insurance Search (CIS)，其中投诉数据在 CIS 中 | Cloudflare 挑战页，curl 返回 403（实测）；WebFetch 只拿到 CIS 的简述："search insurance companies… verify names in your policy"（[NAIC CIS](https://content.naic.org/cis_consumer_information.htm)） | InsData 收费、ToS **NEEDS VALIDATION** |
| 州监管（例如 California CDI、NY DFS） | https://www.insurance.ca.gov ；https://www.dfs.ny.gov | 新闻稿、处罚、费率 | CDI 的 `rss.xml` 路径返回 HTML、DFS 的 `rss.xml` 返回 404（实测），RSS **UNKNOWN** | — |
| Federal Insurance Office（财政部） | https://home.treasury.gov | FIO 年报 | RSS 路径没有返回 XML（实测） | 公共领域（推定） |
| AM Best | — | 评级 | 付费，**NEEDS VALIDATION** | 不纳入 V1 |

---

## 4. 英国（UK）

| 来源 | URL | 内容 | 机器可读性（实测） | 法律 / 备注 |
|---|---|---|---|---|
| **FCA 新闻 RSS** | https://www.fca.org.uk/news/rss.xml | 新闻、执法 | **RSS 已验证**（application/rss+xml，条目为当期内容） | FCA 条款**明确禁止**未经事先书面同意使用 "scraper, robot, bot, spider, data mining" 等自动化工具；Handbook 适用 OGL v3.0；**Data 栏目的统计产出和数据集适用 UK Open Government Licence**（[FCA legal](https://www.fca.org.uk/legal)）→ 用 RSS 发现更新，再人工或低频下载 OGL 数据集；最好书面征得同意 |
| **FCA GI Value Measures 2025** | https://www.fca.org.uk/data/general-insurance-value-measures-data-2025 | 2026-07-21 发布（2026-09-11 更新），覆盖 2025 年全年；**Excel**；包含**公司级 + 产品级**的理赔频率、理赔接受率、平均赔付、理赔投诉率、赔付占保费比例；产品覆盖车险、家财险、旅行险、电子产品险、法律费用险、GAP、婚礼 / 派对险、健康现金计划、道路救援；报告门槛为保费超过 £400k 且有效保单 3,000 张以上；聚合数据至少需 5 家公司 | Excel | FCA 提示家财险的理赔接受率口径不一致，需谨慎使用 → **英国最接近"产品价值数据库"的来源** |
| FCA Financial Services Register API | https://register.fca.org.uk/Developer/s/ | 持牌机构名录 | 需要注册登录（重定向到 `ShAPI_LoginPage`，实测） | 条款禁止"provide a data feed to any comparison table … without written permission"（[FCA legal](https://www.fca.org.uk/legal)） |
| **PRA（英格兰银行）** | https://www.bankofengland.co.uk/rss/prudential-regulation-publications | 审慎监管出版物 | **RSS 已验证** | BoE 条款 **NEEDS VALIDATION** |
| FOS（金融申诉专员） | https://www.financial-ombudsman.org.uk | 按公司的投诉数据、裁决案例 | 旧数据页会 301 跳转到 `/businesses/resolving-complaint/our-insight`；robots 基本放开（[robots](https://www.financial-ombudsman.org.uk/robots.txt)） | 发布频率和格式 **NEEDS VALIDATION** |
| ABI、Lloyd's | https://www.abi.org.uk ；https://www.lloyds.com | 行业统计、市场报告 | ABI 有 Cloudflare 挑战（实测 403）；Lloyd's `/rss` 返回 404 | 行业组织，存在利益冲突 |
| 产品数据库 | — | **英国没有集中的产品条款数据库**（未发现），以 value measures 作为替代 | — | — |

---

## 5. 欧盟（EU）

| 来源 | URL | 内容 | 机器可读性（实测） | 法律 |
|---|---|---|---|---|
| **EIOPA Insurance Statistics** | https://www.eiopa.europa.eu/tools-and-data/insurance-statistics_en | 基于 Solvency II 报送：Solo Quarterly（2016Q3 至 2026Q1，另有 2026Q2 临时数据）、Solo Annual（2016–2025）、Group Quarterly / Annual；主题包括资产负债表、自有资金、保费 / 赔款 / 费用、资产敞口；**xlsx + csv 快捷下载**；最近更新于 2026-09-01（临时数据），并说明临时统计"may be revised" | 已验证 | EIOPA 允许在注明来源的前提下复制；改编内容需加免责声明；商业出售时须告知买方该材料可在 EIOPA 网站免费获取（[EIOPA legal notice](https://www.eiopa.europa.eu/legal-notice_en)） |
| **EIOPA 新闻 RSS** | https://www.eiopa.europa.eu/node/4816/rss_en | 新闻 | **RSS 已验证**（RSS 2.0） | 同上 |
| EIOPA 保险企业名录 | https://register.eiopa.europa.eu | 各国 NCA 汇总的保险企业名录 | 返回 403（Azure 应用网关，实测）；`opendata.eiopa.europa.eu` 不可达 | NEEDS VALIDATION |
| EUR-Lex | https://eur-lex.europa.eu | Solvency II、IDD、DSM 指令；**IPID 标准格式由 Commission Implementing Regulation (EU) 2017/1469 规定**（[EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32017R1469)） | HTML | EU 法律文本可自由复用（NEEDS VALIDATION：Decision 2011/833/EU） |
| IPID（保险产品信息文件） | 各保险公司官网 | 格式统一但**没有集中数据库**（未发现），需要逐公司抓取 PDF | PDF | 版权归保险公司 |
| 各国监管机构（BaFin、ACPR 等） | https://www.bafin.de | — | BaFin 的 RSS 路径猜测为 404，**NEEDS VALIDATION** | — |

---

## 6. 日本（Japan）

| 来源 | URL | 内容 | 机器可读性（实测） | 法律 |
|---|---|---|---|---|
| **金融庁 FSA** | https://www.fsa.go.jp | 新闻、监管、行政处分 | **RSS 已验证**：https://www.fsa.go.jp/fsaNewsListAll_rss2.xml | 条款 NEEDS VALIDATION |
| **e-Gov 法令 API v2** | https://laws.e-gov.go.jp/api/2/swagger-ui | 法令全文 JSON | **已验证**：可按标题检索到 保険業法（law_id `407AC0000000105`，最近修订于 2026-08-12 施行）；按条文获取第 111 条成功（[API](https://laws.e-gov.go.jp/api/2/laws?law_title=保険業法&limit=3)） | 法令文本（日本著作权法第 13 条不保护，**NEEDS VALIDATION**） |
| 保険会社ディスクロージャー誌 | 各社官网 | **保险业法第 111 条**要求保险公司每个事业年度编制记载业务和财产状况的说明书类，并供公众阅览，可以用电磁方式提供（[e-Gov API](https://laws.e-gov.go.jp/api/2/law_data/407AC0000000105?elm=MainProvision-Part_2-Chapter_5-Article_111&response_format=json)） | PDF | 公司版权 |
| 損害保険料率算出機構 GIROJ | https://www.giroj.or.jp | 计算并向会员公司提供车险、火灾险、伤害险的**参考纯率**，以及自赔责、地震险的**基准料率**；出版《自動車保険の概況》《火災保険・地震保険の概況》统计集（[GIROJ 刊行物](https://www.giroj.or.jp/publication/)） | HTML/PDF | NEEDS VALIDATION |
| 生命保険協会 | https://www.seiho.or.jp/data/statistics/ | 统计资料 | 实测可访问 | 行业组织 |
| 日本損害保険協会 | https://www.sonpo.or.jp/report/statistics/ | 统计 | 实测可访问 | 行业组织 |
| 产品数据库 | — | **没有集中的产品库**（未发现） | — | — |

---

## 7. 韩国（Korea）

| 来源 | URL | 内容 | 机器可读性（实测） | 备注 |
|---|---|---|---|---|
| **FSS 金融统计信息系统 FISIS** | https://fisis.fss.or.kr/openapi/ | 金融公司（含保险）经营统计 | **OpenAPI 已验证存在**：`/openapi/companySearch.json?auth=...` 使用未注册 key 时返回 `{"err_cd":"010","err_msg":"미등록 인증키"}`，需要申请认证 key | 条款 NEEDS VALIDATION |
| FSC 金融公共数据（data.go.kr） | https://www.fsc.go.kr/no010101/85738 | 2025-11-26 新开放 8 个 API（含保险开发院的"汽车保险受害者统计""寿险事故原因"）；截至 2025-10，金融领域共 102 个 API、335 张表 | API（data.go.kr；从本环境访问超时） | 公共数据，需按 data.go.kr 条款使用 |
| **生命保险协会 공시실** | https://pub.insure.or.kr | 상품비교공시（保障型、储蓄型、变额、退休年金、年金储蓄、实损医疗）、경영공시、대출공시、手续费、불완전판매비율、保险金不支付 / 纠纷、消费者投诉等（[WebFetch 结果](https://pub.insure.or.kr/)） | HTML；是否能下载 Excel **NEEDS VALIDATION** | 行业组织托管的法定比较公示 |
| 损害保险协会 공시실 | https://kpub.knia.or.kr | 비교공시 | 实测可访问（跳转到 `/main.do`） | — |
| **보험다모아**（保险比价门户） | https://www.e-insmarket.or.kr | 线上保险比价 | **从境外访问返回 403 / 503**（实测）；页面样式显示由 KNIA 托管 | 运营方、上线日期、字段均 **NEEDS VALIDATION** |
| FSS 보도자료 | https://www.fss.or.kr/fss/bbs/B0000188/list.do?menuNo=200218 | 新闻稿 | HTML；robots 只对 Yeti（Naver）限制部分路径 | — |

---

## 8. 新加坡（Singapore）

| 来源 | URL | 内容 | 机器可读性（实测） | 法律 |
|---|---|---|---|---|
| MAS | https://www.mas.gov.sg | 监管、统计 | robots 为 `Crawl-delay: 2`；统计页在测试时处于维护状态；RSS 未能验证 | 网站内容：除非另有规定，未经书面许可不得复制，只允许个人非商业下载一份；**数据集适用 Singapore Open Data Licence v1.0**（全球、永久、免版税、可商用，需注明来源）（[MAS terms](https://www.mas.gov.sg/terms-of-use)） |
| MAS Financial Institutions Directory | https://eservices.mas.gov.sg/fid | 持牌机构名录 | 实测可访问 | 同上 |
| **compareFIRST** | https://www.comparefirst.sg | 2015-04-07 上线，由 CASE、MAS、LIA、MoneySENSE 联合推出；覆盖所有面向零售市场的寿险公司产品：DPI、定期寿险、终身寿险、储蓄型保险，以及 ILP 一般信息（[About](https://www.comparefirst.sg/wap/webAggregatorEvent.action)） | HTML（Struts `.action`）；robots 返回 404 | **网站归 MAS 所有；内容未经 MAS 事先书面许可不得复制、再发布**（[Terms](https://www.comparefirst.sg/wap/termsEvent.action)）→ 必须申请授权 |
| LIA / GIA | https://www.lia.org.sg ；https://gia.org.sg | 行业统计 | LIA 可访问；GIA 返回 406（Mod_Security） | 行业组织 |

---

## 9. 印度（India）

| 来源 | URL | 内容 | 机器可读性（实测） | 法律 |
|---|---|---|---|---|
| **IRDAI** | https://irdai.gov.in | 月度业务数据（寿险 / 非寿险）、理赔数据、年报、《Handbook on Indian Insurance Statistics》、保险公司公开披露（寿险 / 非寿险）、通函、法规（[WebFetch 首页](https://irdai.gov.in/)） | **robots.txt 对 `User-Agent: *` 设置 `Disallow: /`，并点名禁止 Googlebot、bingbot、ChatGPT-User 等**（[robots](https://irdai.gov.in/robots.txt)）；RSS 路径为 404 | 版权政策："Material featured on this site may be reproduced free of charge"，但须准确、不得用于误导，并**醒目标注来源**（[policy](https://irdai.gov.in/website-policies)）→ **内容可复用，但禁止爬取**：V1 用人工下载或申请许可 |
| Bima Sugam | https://www.bimasugam.co.in | IRDAI 推动的数字保险市场 | 从境外访问被地理封锁（实测） | 据二手报道，网站于 2025-09 上线；IRDAI 主席表示首批产品（车险、健康险、定期寿险）力争 2026-09 底前上线（[Loop Health](https://www.loophealth.com/post/bima-sugam-irdai-marketplace-2026)、[ReinAsia](https://reinasia.com/tag/bima-sugam/)）——**NEEDS VALIDATION**（二手来源） |
| Policybazaar | — | 商业比价平台 / 经纪人 | ToS **NEEDS VALIDATION** | 有利益冲突，只作线索 |
| 理赔率（claim settlement ratio） | 见 IRDAI 年报和公开披露 | — | PDF | 以 IRDAI 口径为准 |

---

## 10. 全球（Global）与巴西标杆

| 来源 | URL | 内容 | 机器可读性（实测） | 备注 |
|---|---|---|---|---|
| **IAIS** | https://www.iais.org | ICP、ComFrame、**GIMAR**：年度全版每年 12 月发布，年中更新每年 6–7 月发布；GIMAR 2025 于 2025-12-02 发布，2026 年中更新于 2026-07-09 发布（[GIMAR](https://www.iais.org/activities-topics/financial-stability/gimar/)） | robots 宽松；`/feed/` 返回 HTML（不是 RSS） | PDF |
| **OECD Global Insurance Statistics** | https://sdmx.oecd.org/public/rest/ | **SDMX API 已验证**。dataflow（agency `OECD.DAF.CM`）：`DSD_INS@DF_IND`（保险指标）、`DF_UNDERWRITING`（保费、赔款、费用）、`DF_CLASSES`（按险种）、`DF_ASSET_ALLOC`、`DF_BSI`、`DF_BUSINESS_ABROAD`、`DF_NB_COMP` | API | OECD 条款 NEEDS VALIDATION |
| World Bank GFDD | https://api.worldbank.org/v2/ | 例如 `GFDD.DI.09` 寿险保费占 GDP 比例 | API 已验证，但**数据最后更新于 2022-09-23，已陈旧** | 只作为历史参考 |
| Swiss Re Institute sigma | https://www.swissre.com/institute/research/sigma-research.html | 全球保费和巨灾损失 | Cloudflare 挑战（实测 403） | 商业再保险公司出品，有利益冲突；条款 NEEDS VALIDATION |
| Geneva Association | https://www.genevaassociation.org | 行业智库研究 | 可访问 | 行业智库 |
| BIS FSI | — | 监管政策摘要 | 未验证 | NEEDS VALIDATION |
| **巴西 Open Insurance**（产品 API 标杆） | https://opinbrasil.com.br ；目录 https://data.directory.opinbrasil.com.br/participants | **公开的 products-services API（已验证）**：目录中 38 个参与机构、约 30 类产品族，例如 `person`、`life-pension`、`auto-insurance`、`home-insurance`、`cyber-risk`、`rural`。实测 Bradesco 的 `/open-insurance/products-services/v2/person` 返回字段 `name, code, category, insuranceModality, coverages{coverage, coverageAttributes}, termsAndConditions{susepProcessNumber}, validity, premiumPayment{paymentMethod, frequency}, minimumRequirements, targetAudience, reclaim, allowPortability`，带分页（[示例](https://opin.bradescoseguros.com.br/open-insurance/products-services/v2/person)） | JSON API，无需认证 | 可以作为 InsurHOT **产品 Schema 的参考模型** |

---

## 11. 热度信号（"Product Hot Score"候选）

| 信号 | 可用性（实测 / 文献） | 成本 | 条款与法律 | 操纵风险 | 建议 |
|---|---|---|---|---|---|
| **Google Trends API (alpha)** | 2025-07-24 宣布；**只向极少数测试者开放**，需申请；提供跨请求**一致缩放**的数据，覆盖过去 1,800 天（约 5 年），可按日、周、月、年聚合，支持地区和子地区（[Google](https://developers.google.com/search/blog/2025/07/trends-api)） | 免费（alpha 阶段） | Google API 条款 | 中 | 海外市场可用；中国大陆样本偏差大 |
| **百度指数** | 实测接口 `index.baidu.com/api/SearchApi/index` 返回 `status 10018`（"监测到您疑似存在异常访问行为"），需要登录和 Cookie | 官方商业 API 的情况 **UNKNOWN** | 绕过验证属于"避开技术管理措施"（反不正当竞争法第十三条）→ 禁止 | 高 | 只能人工查看或申请官方合作 |
| 微信指数 | **UNKNOWN**（本次未能核验获取方式） | — | — | 高 | NEEDS VALIDATION |
| 小红书 / 抖音指标 | 小红书 robots 对 `*` 设置 `Disallow: /`（实测） | 平台商业数据产品（蒲公英、巨量算数等）**NEEDS VALIDATION** | 禁止爬取；个人信息保护法风险 | **很高**（刷量、KOL 投放） | 只接受官方授权数据 |
| **App Store 排行** | Apple Marketing Tools RSS 已验证：`https://rss.marketingtools.apple.com/api/v2/cn/apps/top-free/10/apps.json`，返回"免费 App 排行"，版权属 Apple | 免费 | Apple 条款 NEEDS VALIDATION | 中 | 适合做"保险 App 排名"辅助信号（需按类目过滤，是否支持 **NEEDS VALIDATION**） |
| X（Twitter）API | 按用量付费：帖子读取 $0.005/条，按量付费方案每月上限 300 万次读取（[X docs](https://docs.x.com/x-api/getting-started/pricing)） | 付费 | X 开发者条款 | 高 | 海外舆情，低权重 |
| Reddit | 从本环境访问返回 403 "blocked due to a network policy"（实测） | Data API 条款 NEEDS VALIDATION | — | 中 | V2 再考虑 |

**结论**：Hot Score 应以**监管与官方可核验数据**为主干，例如：
- 新备案产品数；
- 停售数；
- 分险种、分公司保费（NFRA 月度表）；
- 投诉量（NFRA 季度通报）；
- 行政处罚。

社交热度只作为低权重、带异常检测的"关注度"子项，并在页面上注明"不代表产品质量"。2025 年修订的反不正当竞争法第十三条第四款禁止"虚假交易、虚假评价"（[新华网](https://www.news.cn/legal/20250627/4b6ec78bc9be4ea9a2968a9d34abd724/c.html)），这也说明刷量是真实存在的风险。

---

## 12. 专题一：各法域"机器可读产品数据库"对比

| 法域 | 数据库 | 覆盖 | 关键字段 | 获取方式 | V1 可行性 |
|---|---|---|---|---|---|
| 中国（人身险） | 中保协 人身保险产品信息库（tiaokuan.iachina.cn） | 2009 年后全部报备或获批的人身险产品（含停售） | 公司、产品名称、报送文件编号、条款内部编号、报送年度、类别、设计类型、条款全文（[FAQ PDF](https://life.pingan.com/upload/file/changjianwenti.pdf)） | SPA，无公开 API | **需授权**，否则人工逐条核验 |
| 中国（公司官网） | 条款、费率表、现金价值全表、红利实现率、退保规则 | 各公司 | 同左 | HTML / PDF | 可行（法定公开）；逐家适配 |
| 美国 | SERFF Filing Access | 各州标记为公开的费率 / 条款备案 | NEEDS VALIDATION（本环境返回 403） | Web 查询 | 需复测，并确认 ToS |
| 英国 | 无；以 FCA GI value measures 替代 | 零售财险产品 | 公司 × 产品的理赔指标 | Excel（OGL） | 可行 |
| 欧盟 | 无集中库；IPID 格式统一（Reg 2017/1469） | — | — | 各公司 PDF | 逐家抓取 |
| 日本 | 无；GIROJ 参考纯率 + 各社ディスクロージャー誌 | — | — | PDF | 有限 |
| 韩国 | 生保协会 / 损保协会 비교공시 + 보험다모아 + FISIS OpenAPI | 按险种比较公示 | NEEDS VALIDATION | HTML / API（需 key） | 中 |
| 新加坡 | compareFIRST（MAS 所有） | 全部零售寿险公司 | 保费、保障等（NEEDS VALIDATION） | HTML | **需 MAS 书面许可** |
| 印度 | IRDAI 公开披露 + Bima Sugam（筹建中） | — | — | robots 全禁 | 人工 / 许可 |
| 巴西 | Open Insurance products-services API | 约 30 类产品族 | 见 §10 | **公开 JSON API** | 最佳标杆 |

---

## 13. 专题二：中国相关监管变化时间线（2018–2026，与公开数据有关）

| 日期 | 事件 | 对 InsurHOT 的意义 | 来源 |
|---|---|---|---|
| 2014 | 中保协发〔2014〕560 号：人身险产品信息库上线，条款带二维码 | 产品库的基础 | [FAQ PDF](https://life.pingan.com/upload/file/changjianwenti.pdf) |
| 2018（**NEEDS VALIDATION**：文号和日期） | 《保险公司信息披露管理办法》 | 公司级披露的基础制度（将被 2026 年新办法替代） | [NFRA docId=1270935](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1270935) |
| 2020-06-30 | 《关于规范互联网保险销售行为可回溯管理的通知》 | — | NFRA 列表 docId=912726（[监管动态接口](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectDocByItemIdAndChild?itemId=915&pageSize=20&pageIndex=1)） |
| 2020-12-14 | 《互联网保险业务监管办法》发布（5 章 83 条） | 互联网保险信息披露 | [docId=949136](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=949136) |
| 2022-11-17 | 《人身保险产品信息披露管理办法》（令〔2022〕8号），**2023-06-30 施行**；第九条规定中保协、中国银保信承担平台作用 | 产品级公开的法律依据 | [docId=1081986](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1081986) |
| 2022-12-30 | 《一年期以上人身保险产品信息披露规则》（银保监规〔2022〕24号），2023-06-30 施行；要求红利实现率在 15 个工作日内于官网披露 | 分红兑现度指标 | [docId=1088640](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1088640) |
| **2023-05-18** | **国家金融监督管理总局挂牌** | 信源域名从 cbirc.gov.cn 迁到 nfra.gov.cn（旧站从境外访问被封锁） | [docId=1108819](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1108819) |
| 2023-06-15 | NFRA 首次发布季度银行业保险业消费投诉通报（2023Q1） | 投诉指标 | [docId=1113173](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1113173) |
| 2023-08 / 2024-02 / 2024-08 | "报行合一"依次推进：银保渠道（2023-08）→ 经代渠道（2024-02）→ 个险渠道（2024-08）（二手来源） | 费用率透明度 | [中国银行保险报 2024-05-09](https://www.bbtnews.com.cn/2024/0509/514192.shtml)（据检索摘要，NEEDS VALIDATION） |
| 2023-09-28 | 《保险销售行为管理办法》（令〔2023〕2号），**2024-03-01 施行**；第十四条要求官网公示条款，第四十条要求披露退保规则 | 条款和退保信息公开 | [docId=1129945](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1129945) |
| 2024-08-02 | 《关于健全人身保险产品定价机制的通知》（预定利率机制；红利实现率以演示利率为计算基础） | 产品定价指标 | [docId=1175200](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1175200) |
| 2024-12-20 | 延长偿付能力监管规则（Ⅱ）实施过渡期 | 偿付能力解读 | docId=1191077（[规范性文件列表](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectDocByItemIdAndChild?itemId=928&pageSize=20&pageIndex=1)） |
| 2024-12-27 | 《银行保险机构数据安全管理办法》：对外公开的数据应当在机构官方渠道发布（第三十五条） | 支持"以官方渠道为准"的采集原则 | [docId=1192308](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1192308) |
| 2025-04-14 / 04-18 | 《关于推动深化人身保险行业个人营销体制改革的通知》（金规〔2025〕13号）：佣金递延发放；精算假设费用、预算费用、考核费用"三费合一" | 个险"报行合一" | [gov.cn](https://www.gov.cn/zhengce/zhengceku/202504/content_7019852.htm)；[docId=1205253 列表](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectDocByItemIdAndChild?itemId=928&pageSize=20&pageIndex=1) |
| 2025-10-15 | 修订后的《反不正当竞争法》施行（新增数据条款第十三条） | 爬取合规边界 | [新华网](https://www.news.cn/legal/20250627/4b6ec78bc9be4ea9a2968a9d34abd724/c.html) |
| 2025-12-25 | 《银行保险机构资产管理产品信息披露管理办法》 | 保险资管产品披露 | 规范性文件列表 docId=1239473 |
| 2026-08-21 | 《保险公司资产负债管理办法》（令〔2026〕4号），**2027-01-01 施行**，同时废止银保监发〔2019〕32号 | ALM 指标 | [docId=1268952](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1268952) |
| **2026-09-04** | **《银行保险机构信息披露管理办法（征求意见稿）》**：6 章 46 条；整合并修订《商业银行信息披露办法》《保险公司信息披露管理办法》《信托投资公司信息披露管理暂行办法》，新办法实施后这三项同步废止；董事长为信息披露第一责任人；上市机构已按上市规则披露的可免于重复披露；**征求意见截至 2026-10-03** | **V1 必须跟踪：披露口径、渠道和时间将变化** | [答记者问 docId=1270935](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1270935)；[公告 docId=1270944](https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1270944) |

---

## 14. 专题三：跨境法律问题

### 14.1 中国

- **反不正当竞争法（2025 年修订，2025-10-15 施行）第十三条**：
  - 第三款："经营者不得以欺诈、胁迫、**避开或者破坏技术管理措施**等不正当方式，获取、使用其他经营者合法持有的数据……"；
  - 第二十九条：违反者处 10 万至 100 万元罚款，情节严重的处 100 万至 500 万元（[新华网](https://www.news.cn/legal/20250627/4b6ec78bc9be4ea9a2968a9d34abd724/c.html)）。

  → 对验证码、登录墙、签名参数、WAF（如百度指数、小红书、雪球）一律**不得绕过**。
- **个人信息保护法**：
  - 第十三条（处理个人信息的合法性基础）；
  - 第二十七条：可以在合理范围内处理个人自行公开或其他已合法公开的个人信息，但个人明确拒绝的除外；对个人权益有重大影响的，应取得同意（[全国人大](http://www.npc.gov.cn/npc/c2/c30834/202108/t20210820_313088.html)）。

  → 行政处罚公示中的个人姓名、社交平台用户数据要最小化、去标识化，并且不做个人画像。
- **著作权法**：
  - 第五条：法律法规、国家机关文件、单纯事实消息不受保护；
  - 第二十四条：合理使用范围有限（[gov.cn](https://www.gov.cn/guoqing/2021-10/29/content_5647633.htm)）。

  → 监管文件可存全文；媒体文章只能存"摘要 + 链接 + 短引用"。
- **数据出境**：《促进和规范数据跨境流动规定》（2024-03-22 公布施行）。不含个人信息或重要数据的数据，免于申报数据出境安全评估等（第三条）；另有合同履行、年累计 10 万人以下非敏感个人信息等豁免（[网信办](https://www.cac.gov.cn/2024-03/22/c_1712776611775634.htm)）。

  → 公开监管数据属于非个人信息，出境风险低；但若在中国境内采集并含个人信息（如处罚公示中的个人），应做"境内处理、脱敏后出境"。
- **判例线索**（**NEEDS VALIDATION**，本次未能取得原文）：大众点评诉百度、淘宝诉美景、微博诉脉脉等数据爬取不正当竞争案。

### 14.2 欧盟

- **DSM 指令（EU）2019/790 第 4 条**：成员国应为"lawfully accessible works"的 TDM 复制与提取规定例外；复制件可以在 TDM 目的所需期间内保留；**条件是权利人没有以适当方式明示保留，对于网上公开的内容，例如以 machine-readable means 保留**（[EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32019L0790)）。第 4 条同时覆盖数据库指令 96/9/EC 的特别权利（同一来源）。

  → 必须把 robots.txt 和 TDM 保留声明当作**法律上的 opt-out** 来处理，例如 Artemis 和 Reinsurance News 都屏蔽了 GPTBot / ChatGPT-User（[Artemis robots](https://www.artemis.bm/robots.txt)、[Reinsurance News robots](https://www.reinsurancene.ws/robots.txt)）。

### 14.3 美国

- **17 U.S.C. §107** 合理使用的四要素（[Cornell LII](https://www.law.cornell.edu/uscode/text/17/107)）。
- **hiQ v. LinkedIn**：第九巡回法院维持了允许抓取公开资料的初步禁令；但 hiQ 后来被认定违反 LinkedIn 条款，双方和解（[Wikipedia](https://en.wikipedia.org/wiki/HiQ_Labs_v._LinkedIn)）。

  → 抓取公开页面不一定违反 CFAA，但**违反 ToS 的合同风险仍然存在**。
- 2025 年 AI 训练相关判例（Thomson Reuters v. Ross、Bartz v. Anthropic、Kadrey v. Meta）**NEEDS VALIDATION**（本次未能取得原文）。

### 14.4 日本

- **著作权法第 30-4 条**："情報解析"（从大量作品中提取、比较、分类或做其他统计分析）等"非享受目的"的利用，在必要限度内允许；**但不当损害著作权人利益的除外**（[Japanese Law Translation](https://www.japaneselawtranslation.go.jp/en/laws/view/4207)）。文化厅指引见 2019-10-24《柔軟な権利制限規定に関する基本的な考え方》和 2024-03-15《AIと著作権に関する考え方》（[文化庁](https://www.bunka.go.jp/seisaku/chosakuken/aiandcopyright.html)）。

  → 分析可以做，但对外展示原文仍受限制。

### 14.5 站点条款（汇总）

| 站点 | 自动化访问 | 复用 |
|---|---|---|
| FCA | 未经书面同意禁止使用 bot 或 scraper | Data 栏目适用 OGL（[FCA legal](https://www.fca.org.uk/legal)） |
| MAS / compareFIRST | 不得造成不合理负载 | 网站内容需许可；数据集适用 SODL（[MAS](https://www.mas.gov.sg/terms-of-use)、[compareFIRST](https://www.comparefirst.sg/wap/termsEvent.action)） |
| IRDAI | robots 全部禁止 | 注明来源即可免费复制（[IRDAI](https://irdai.gov.in/website-policies)） |
| EIOPA | 未见限制 | 注明来源即可复制（[EIOPA](https://www.eiopa.europa.eu/legal-notice_en)） |
| SEC | ≤10 次请求/秒 | 公开（[SEC](https://www.sec.gov/about/developer-resources)） |
| Insurance Journal | "Use of any robot, spider … to monitor or copy … is strictly forbidden" | 只允许个人非商业使用（[IJ terms](https://www.insurancejournal.com/terms/)） |
| Artemis / Reinsurance News | 屏蔽 GPTBot 和 ChatGPT-User | 条款 NEEDS VALIDATION |

---

## 15. 提案：InsurHOT Source Tier 体系

### 15.1 证据层级（Evidence Tier）

| Tier | 名称 | 定义 | 示例 | 默认可信度 |
|---|---|---|---|---|
| **T0** | 法定原文 | 法律、规章、规范性文件原文 | flk.npc、NFRA 规章、EUR-Lex、e-Gov | 最高 |
| **T1** | 监管机构数据与决定 | 监管机构发布的统计、处罚、投诉通报、监管数据集 | NFRA 统计 / 处罚 / 投诉、FCA value measures、EIOPA statistics | 很高（注意数据由公司自报） |
| **T2** | 法定强制披露 | 被监管主体按法规披露的材料（公司自报） | 公开信息披露、偿付能力摘要、年报、交易所公告、IPID、SERFF 备案 | 高，**非独立** |
| **T3** | 行业基础设施 / 自律组织 | 协会、精算师协会、交易所、比较公示平台 | 中保协产品库、KLIA 공시실、GIROJ、compareFIRST | 中高，有利益冲突标签 |
| **T4** | 国际组织与研究 | IAIS、OECD、World Bank；学术；行业智库 | GIMAR、OECD SDMX、Swiss Re sigma（标注商业属性） | 中高 |
| **T5** | 专业媒体 | 行业媒体 | Artemis、Reinsurance News、中国银行保险报 | 中，**只作线索和背景** |
| **T6** | 大众媒体 | — | — | 中低 |
| **S** | 信号层（不作证据） | 社交、搜索、App 排名 | Google Trends、百度指数、App Store | 只衡量"关注度" |

### 15.2 每条记录的元数据维度

- `authority`：0–5
- `independence`：`regulator` / `mandated-self-report` / `industry-body` / `commercial` / `ugc`
- `timeliness`：发布日期、数据期间、采集时间、预期频率、是否滞后
- `verifiability`：稳定 URL、原始文件 SHA-256、快照（WARC）、docId
- `correction_handling`：
  - 监测同一 docId 或同一 URL 的内容变化，保留版本链；
  - 对临时数据（如 EIOPA provisional）打 `provisional=true`；
  - 更正时在前台显示"已更正"及差异
- `reuse_class`：
  - **R0**：可全文存储和展示（法规、官方文件、OGL / SODL / EIOPA 数据）
  - **R1**：可全文存储用于分析，对外只展示摘要、引用和链接（上市公告、公司披露 PDF）
  - **R2**：只存元数据、摘要和链接（媒体）
  - **R3**：不采集，只允许人工引用（robots 禁止、登录墙、反爬，如小红书、微信公众号、百度指数）
- `access_method`：`api` / `rss` / `bulk-file` / `html-lowfreq` / `manual` / `licensed`
- `jurisdiction`、`language`

### 15.3 采集规则（Collection Policy）

1. 遵守 robots.txt 与 TDM 保留声明，把它们视为 DSM 第 4 条意义上的 opt-out。
2. 不绕过任何技术措施（登录、验证码、签名、WAF），以符合反不正当竞争法第十三条的要求。
3. 自报 UA 和联系邮箱，限速（SEC 上限为 10 次请求/秒，建议 ≤1 次/秒；MAS 要求 Crawl-delay 2 秒）。
4. 优先级：API 或 RSS > 官方批量文件 > 低频 HTML > 人工 > 授权。
5. 所有展示中的事实都必须能回溯到 T0–T2 原文链接加快照哈希。

---

## 16. V1 推荐信源清单（China + Global，共 48 项）

优先级：**P0** = V1 必上；**P1** = V1 可上（需要轻量验证或适配）；**P2** = 待授权、待验证或 V2。

| # | 信源 | Tier | 访问方式 | Reuse | 优先级 | 备注 |
|---|---|---|---|---|---|---|
| 1 | NFRA 统计数据（itemId 954）：月度保险业、财产险、人身险经营表，分地区保费，季度资金运用 | T1 | JSON 接口 + .doc/.pdf | R0 | **P0** | 月度，约次月下旬发布 |
| 2 | NFRA 规章（926）和规范性文件（928） | T0 | JSON 接口 | R0 | **P0** | |
| 3 | NFRA 公告（925）和政策解读（916） | T0 / T1 | JSON 接口 | R0 | **P0** | |
| 4 | NFRA 监管动态（915），含季度消费投诉通报 | T1 | JSON 接口 | R0 | **P0** | |
| 5 | NFRA 行政处罚（4113/4114/4115） | T1 | JSON 接口 + 附件 | R0（个人信息需脱敏） | **P0** | 数据量大（累计 7 万条以上） |
| 6 | NFRA 征求意见（2026 信披办法等） | T0 | JSON 接口 | R0 | **P0** | 关注截至 2026-10-03 的意见征求 |
| 7 | 国家法律法规数据库 flk.npc.gov.cn | T0 | HTML / 低频 | R0 | P1 | API 待查 |
| 8 | 中国政府网 政策文件库 | T0 | HTML | R0 | P1 | |
| 9 | 中保协 信息披露：偿付能力（col34） | T2 / T3 | HTML（CMS） | R1 | **P0** | 列表接口需验证 |
| 10 | 中保协 信息披露：互联网保险（col29 / ICID） | T2 / T3 | 待验证 | R1 | P1 | 裸 IP 系统 |
| 11 | 中保协 信息披露：年度信息披露、关联交易、交强险（col26/30/32） | T2 / T3 | HTML | R1 | P1 | |
| 12 | 中保协 人身险产品信息库（tiaokuan） | T3 | **授权或人工** | R1 | P1（先谈授权） | 禁止绕过反爬 |
| 13 | 中保协 条款费率 / 示范条款（col38） | T3 | HTML | R1 | P1 | |
| 14 | 中保协 统计数据（col41）和行业指数（col43） | T3 | HTML | R1 | P1 | |
| 15 | 头部人身险公司官网"公开信息披露"（约 30 家）：条款、费率、现价、**红利实现率**、退保规则 | T2 | HTML / PDF 适配器 | R1 | **P0** | 法定公开 |
| 16 | 头部财险公司官网"公开信息披露"（约 15 家） | T2 | HTML / PDF | R1 | P1 | |
| 17 | 各公司偿付能力季度报告摘要（官网） | T2 | PDF | R1 | **P0** | 与 #9 交叉核对 |
| 18 | 巨潮资讯（A 股险企公告） | T2 | HTML / API（条款待确认） | R1 | **P0** | |
| 19 | 上交所公告 | T2 | HTML | R1 | P1 | 与 #18 冗余 |
| 20 | HKEXnews（H 股险企） | T2 | HTML | R1 | **P0** | 平安、国寿、太保、新华、人保、众安、友邦等 |
| 21 | 中国精算师协会 | T3 | HTML | R1 | P2 | |
| 22 | 上海保险交易所 | T3 | HTML | R1 | P2 | |
| 23 | 中国银保信 | T3 | 待验证（境外 504） | — | P2 | |
| 24 | 12378 | T1 | 境外被封锁 | — | P2 | 以 #4 替代 |
| 25 | 中国银行保险报 cbimc.cn | T5 | HTML | R2 | P1 | 只存摘要和链接 |
| 26 | 行业公众号（慧保天下等） | T5 | **人工** | R3 | P2 | robots 禁止 |
| 27 | 百度指数 | S | 人工 / 官方合作 | R3 | P2 | 有反爬 |
| 28 | IAIS（GIMAR、ICP、新闻） | T4 | HTML / PDF | R1 | **P0** | |
| 29 | OECD Global Insurance Statistics（SDMX） | T4 | **API** | R0/R1（待验证） | **P0** | |
| 30 | EIOPA Insurance Statistics（xlsx/csv） | T1 | **批量文件** | R0（注明来源） | **P0** | |
| 31 | EIOPA 新闻 RSS | T1 | **RSS** | R0 | **P0** | |
| 32 | EUR-Lex（Solvency II、IDD、IPID Reg 2017/1469） | T0 | HTML | R0 | P1 | |
| 33 | FCA 新闻 RSS | T1 | **RSS** | R1 | **P0** | 禁止爬取站点页面 |
| 34 | FCA GI Value Measures（Excel） | T1 | 人工或低频下载 | R0（OGL） | **P0** | 最好书面确认 |
| 35 | PRA RSS（BoE） | T1 | **RSS** | R1 | P1 | |
| 36 | SEC EDGAR（data.sec.gov） | T2 | **API** | R1 | **P0** | 美国上市险企 |
| 37 | Federal Register API | T0 | **API** | R0 | P1 | |
| 38 | NAIC（统计、Model Laws、CIS） | T3 | 被 Cloudflare 拦截，人工 | R2 | P1 | ToS 待查 |
| 39 | SERFF Filing Access | T2 | 人工（本环境 403） | R1 | P2 | 需复测并确认 ToS |
| 40 | 金融庁 FSA RSS | T1 | **RSS** | R1 | P1 | |
| 41 | e-Gov 法令 API | T0 | **API** | R0 | P1 | |
| 42 | FSS FISIS OpenAPI | T1 | **API（需 key）** | 待验证 | P1 | |
| 43 | 韩国生保 / 损保协会 공시실 | T3 | HTML | R1 | P2 | |
| 44 | MAS FID + compareFIRST | T1 / T3 | 需 **MAS 书面许可** | R3（在获许可前） | P2 | |
| 45 | IRDAI（年报、Handbook、公开披露） | T1 | **人工**（robots 全禁） | R0（注明来源） | P1 | |
| 46 | 巴西 Open Insurance products-services API | T2 | **API** | 待验证 | P1 | Schema 标杆 |
| 47 | Artemis / Reinsurance News RSS | T5 | RSS（只用标题和链接） | R2 | P1 | 屏蔽 AI bot，尊重 opt-out |
| 48 | Google Trends API（alpha）/ Apple App Store RSS | S | API / RSS | R2 | P2 | 低权重 |

**不纳入 V1**：Insurance Journal（ToS 明确禁止 robot，可人工阅读）、小红书、抖音、雪球、Reddit（robots 或网络策略屏蔽）、AM Best、InsData（付费）、中国裁判文书网（未验证，登录墙）、World Bank GFDD（数据陈旧）。

---

## 17. 待验证清单（NEEDS VALIDATION，按重要性排序）

1. 中保协人身险产品库的数据授权渠道、字段全集，以及财产险条款注册 / 备案查询入口。
2. 中保协 col34 / col29 列表接口的结构；ICID 裸 IP 系统能否从中国大陆访问。
3. 《保险公司信息披露管理办法》的文号和施行日期；偿二代规则第 13 号的原文链接；《互联网保险业务监管办法》的施行日期和信息披露条款。
4. 2026 年《银行保险机构信息披露管理办法》正式稿（征求意见截至 2026-10-03）。
5. SERFF SFA 的 ToS 和字段（需从美国住宅或企业网络复测）。
6. NFRA、中保协、巨潮、HKEX 网站的使用声明。
7. 보험다모아的运营方和字段；KLIA 比较公示是否可下载 Excel。
8. 百度指数、微信指数、小红书、抖音的**官方**商业数据接口及其条款。
9. 中国数据爬取判例原文（大众点评诉百度、淘宝诉美景等）；美国 2025 年 AI 训练 fair use 判例。
10. OECD、Swiss Re、NAIC 的数据复用许可。

---

## Sources

### 中国监管与法律

- NFRA 首页：https://www.nfra.gov.cn/cn/view/pages/index/index.html
- NFRA 列表接口示例：
  - https://www.nfra.gov.cn/cbircweb/DocInfo/SelectDocByItemIdAndChild?itemId=4113&pageSize=3&pageIndex=1
  - https://www.nfra.gov.cn/cbircweb/DocInfo/SelectDocByItemIdAndChild?itemId=954&pageSize=20&pageIndex=1
  - https://www.nfra.gov.cn/cbircweb/DocInfo/SelectDocByItemIdAndChild?itemId=928&pageSize=20&pageIndex=1
  - https://www.nfra.gov.cn/cbircweb/DocInfo/SelectDocByItemIdAndChild?itemId=915&pageSize=20&pageIndex=1
  - https://www.nfra.gov.cn/cbircweb/DocInfo/SelectDocByItemIdAndChild?itemId=4115&pageSize=1&pageIndex=1
- NFRA 文档：
  - docId=1270935（信披办法征求意见稿答记者问）：https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1270935
  - docId=1270944（征求意见公告）：https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1270944
  - docId=1081986（人身保险产品信息披露管理办法）：https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1081986
  - docId=1088640（一年期以上人身保险产品信息披露规则）：https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1088640
  - docId=1175200（健全人身保险产品定价机制）：https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1175200
  - docId=1129945（保险销售行为管理办法）：https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1129945
  - docId=1192308（银行保险机构数据安全管理办法）：https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1192308
  - docId=1268952（保险公司资产负债管理办法）：https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1268952
  - docId=949136（互联网保险业务监管办法）：https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=949136
  - docId=1108819（NFRA 揭牌）：https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1108819
  - docId=1113173（2023Q1 消费投诉通报）：https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1113173
- 金规〔2025〕13号：https://www.gov.cn/zhengce/zhengceku/202504/content_7019852.htm
- 著作权法：https://www.gov.cn/guoqing/2021-10/29/content_5647633.htm
- 个人信息保护法：http://www.npc.gov.cn/npc/c2/c30834/202108/t20210820_313088.html
- 反不正当竞争法（2025 修订）：https://www.news.cn/legal/20250627/4b6ec78bc9be4ea9a2968a9d34abd724/c.html
- 促进和规范数据跨境流动规定：https://www.cac.gov.cn/2024-03/22/c_1712776611775634.htm
- gov.cn robots：https://www.gov.cn/robots.txt
- 国家法律法规数据库：https://flk.npc.gov.cn/

### 中国行业、市场与媒体

- 中国保险行业协会：
  - 首页：https://www.iachina.cn/
  - 条款费率：https://www.iachina.cn/col/col38/index.html
  - 偿付能力信息披露：https://www.iachina.cn/col/col34/index.html
  - 互联网保险信息披露：https://www.iachina.cn/col/col29/index.html
  - 统计数据：https://www.iachina.cn/col/col41/index.html
- 中保协条款库：https://tiaokuan.iachina.cn/ ；bundle：https://tiaokuan.iachina.cn/static/js/app.ea735e08.js
- 中保协发〔2014〕560号 FAQ（平安人寿转载）：https://life.pingan.com/upload/file/changjianwenti.pdf
- 中证网（人身险信披办法报道）：https://cs.com.cn/tj/02/01/202211/t20221118_6308816.html
- 中国银行保险报（报行合一，二手来源）：https://www.bbtnews.com.cn/2024/0509/514192.shtml
- 巨潮资讯：https://www.cninfo.com.cn/new/index
- 上交所公告：https://www.sse.com.cn/disclosure/listedinfo/announcement/
- HKEXnews：https://www1.hkexnews.hk/search/titlesearch.xhtml?lang=zh
- 中国精算师协会：https://www.e-caa.org.cn/
- 上海保险交易所：https://www.shie.com.cn/
- 中国银行保险报：https://www.cbimc.cn/
- robots 文件：
  - 微信公众平台：https://mp.weixin.qq.com/robots.txt
  - 小红书：https://www.xiaohongshu.com/robots.txt
  - 知乎：https://www.zhihu.com/robots.txt
- 百度指数接口（实测反爬响应）：https://index.baidu.com/api/SearchApi/index

### 美国

- SEC EDGAR APIs：https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- SEC developer resources：https://www.sec.gov/about/developer-resources
- data.sec.gov（AIG 示例）：https://data.sec.gov/submissions/CIK0000005272.json
- Federal Register API：https://www.federalregister.gov/api/v1/documents.json
- SERFF：
  - Oklahoma DOI：https://www.oid.ok.gov/regulated-entities/rate-and-form-filing/public-rate-and-form-filings/
  - Alabama DOI：https://aldoi.gov/RatesForms/SERFFsPublicAccess.aspx
- NAIC CIS：https://content.naic.org/cis_consumer_information.htm
- 17 U.S.C. §107：https://www.law.cornell.edu/uscode/text/17/107
- hiQ v. LinkedIn：https://en.wikipedia.org/wiki/HiQ_Labs_v._LinkedIn

### 英国

- FCA 新闻 RSS：https://www.fca.org.uk/news/rss.xml
- FCA legal：https://www.fca.org.uk/legal
- FCA GI Value Measures 2025：https://www.fca.org.uk/data/general-insurance-value-measures-data-2025
- FCA Register Developer：https://register.fca.org.uk/Developer/s/
- FCA robots：https://www.fca.org.uk/robots.txt
- PRA RSS：https://www.bankofengland.co.uk/rss/prudential-regulation-publications
- FOS robots：https://www.financial-ombudsman.org.uk/robots.txt

### 欧盟

- EIOPA insurance statistics：https://www.eiopa.europa.eu/tools-and-data/insurance-statistics_en
- EIOPA legal notice：https://www.eiopa.europa.eu/legal-notice_en
- EIOPA 新闻 RSS：https://www.eiopa.europa.eu/node/4816/rss_en
- DSM 指令：https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32019L0790
- IPID Reg 2017/1469：https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32017R1469

### 日本

- FSA RSS：https://www.fsa.go.jp/fsaNewsListAll_rss2.xml
- e-Gov 法令 API：
  - https://laws.e-gov.go.jp/api/2/swagger-ui
  - https://laws.e-gov.go.jp/api/2/laws?law_title=保険業法&limit=3
- GIROJ 刊行物：https://www.giroj.or.jp/publication/
- 生命保険協会：https://www.seiho.or.jp/data/statistics/
- 日本損害保険協会：https://www.sonpo.or.jp/report/statistics/
- 著作权法英译（第 30-4 条）：https://www.japaneselawtranslation.go.jp/en/laws/view/4207
- 文化庁 AI 与著作权：https://www.bunka.go.jp/seisaku/chosakuken/aiandcopyright.html

### 韩国

- FISIS OpenAPI：https://fisis.fss.or.kr/openapi/
- FSC 金融公共数据新闻稿：https://www.fsc.go.kr/no010101/85738
- 生命保险协会 공시실：https://pub.insure.or.kr/
- 损害保险协会 공시실：https://kpub.knia.or.kr/
- FSS robots：https://www.fss.or.kr/robots.txt
- 보험다모아：https://www.e-insmarket.or.kr/

### 新加坡

- MAS terms：https://www.mas.gov.sg/terms-of-use
- MAS robots：https://www.mas.gov.sg/robots.txt
- MAS FID：https://eservices.mas.gov.sg/fid
- compareFIRST terms：https://www.comparefirst.sg/wap/termsEvent.action
- compareFIRST about：https://www.comparefirst.sg/wap/webAggregatorEvent.action

### 印度

- IRDAI 首页：https://irdai.gov.in/
- IRDAI robots：https://irdai.gov.in/robots.txt
- IRDAI website policies：https://irdai.gov.in/website-policies
- Bima Sugam（二手来源）：
  - https://www.loophealth.com/post/bima-sugam-irdai-marketplace-2026
  - https://reinasia.com/tag/bima-sugam/

### 全球与巴西

- IAIS GIMAR：https://www.iais.org/activities-topics/financial-stability/gimar/
- OECD SDMX：https://sdmx.oecd.org/public/rest/dataflow/all?detail=allstubs
- World Bank API：https://api.worldbank.org/v2/country/CN/indicator/GFDD.DI.09?format=json
- Geneva Association：https://www.genevaassociation.org/
- 巴西 Open Insurance：
  - 门户：https://opinbrasil.com.br/
  - 参与机构目录：https://data.directory.opinbrasil.com.br/participants
  - Bradesco person 产品 API：https://opin.bradescoseguros.com.br/open-insurance/products-services/v2/person

### 专业媒体与热度信号

- Artemis：https://www.artemis.bm/feed/ ；https://www.artemis.bm/robots.txt
- Reinsurance News：https://www.reinsurancene.ws/feed/ ；https://www.reinsurancene.ws/robots.txt
- Insurance Journal：https://www.insurancejournal.com/rss/news/ ；https://www.insurancejournal.com/terms/
- Google Trends API：https://developers.google.com/search/blog/2025/07/trends-api
- Apple 排行 RSS：https://rss.marketingtools.apple.com/api/v2/cn/apps/top-free/10/apps.json
- X API 定价：https://docs.x.com/x-api/getting-started/pricing
