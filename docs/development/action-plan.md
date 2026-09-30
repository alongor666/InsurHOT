# InsurHOT 开发行动计划

2026-09-30。依据：Phase 0 基线 `bb9be912b07185939ef18bdfff1a21fe1403db2a`、项目台账 #3、M0任务 #4。当前事实以台账与PR固定HEAD为准。

## 目标和执行规则

先得到默认不产生外部调用、可复现验证的工程底座，再做一个证据闭环，最后扩展三支柱。Codex负责本会话开发、任务拆分与验收；独立评审者不参与被审修改。每个PR单一写入者。当前任务采用单一写入者，评审独立于修改；未启动后台常驻任务。

每项交付依次经过：独立分支 → Draft PR → 对应测试及日志 → 独立评审 → 固定HEAD验收 → 合并。未完成的验收不勾选，不用上游CI替代本仓结果。真实采集、模型费用和公开发布保持关闭。

## M0：分五次交付

| 顺序 | 交付与范围 | 通过条件 | 依赖/当前状态 |
|---|---|---|---|
| M0.1 | 固定上游清单、隔离导入工具、ADR-001、行动计划 | 489文件路径/模式/blob逐一验证；二进制及许可证保真；拒绝错误清单、覆盖目标、危险路径；工具CI | 已验收并通过[PR #5](https://github.com/alongor666/InsurHOT/pull/5)合入main：`46a411689780d251bd5f0161837d37813e04da30`；独立复审关闭M01-R01，bootstrap run 36641164748 attempt 3通过7项测试及清单验证 |
| M0.2 | 把固定快照整合到项目，保留LICENSE/NOTICE/第三方许可 | 新增UPSTREAM.md记录实际映射；保留本仓README/AGENTS/Phase0；上游同名文档归档；品牌素材不得对外发布；依赖锁定；typecheck/web build | 已合入 main：[PR #6](https://github.com/alongor666/InsurHOT/pull/6) 固定HEAD `b9183a226e97e0f332d12c82ce96b8f11b2bc2c0` 独立评审无阻断项，merge commit `c85db7958015b2014a1d7d08e49723be2dc63dc2`；[证据](m0-integration-evidence.md)。PG/Docker 在合并时 NOT RUN，其后由 [PR #17](https://github.com/alongor666/InsurHOT/pull/17) 本机 PG 补跑迁移/seed/backend tests |
| M0.3a | 默认拒绝及预算前置闭锁 | 缺省/false/true/非法值；实际外呼边界（含手工/旧队列）门控；缺预算拒绝；付费全局无条件关闭 | 已合入 main：[PR #7](https://github.com/alongor666/InsurHOT/pull/7) 固定HEAD `4ff2cdc994a86617fcd416c49a88d6cb97df03b2` 独立复审关闭 M03A-R01，merge commit `f08fe132e997544b8edb9ee75ff886bf0d2c74ab`；[证据与盘点](m0-3a-evidence.md)。付费出口仍无条件闭锁 |
| M0.3b | 金额预算硬边界 | 批准价格/币种、全局及任务金额硬上限、原子并发预留、未知回执占用、恢复/降档不得越限 | 未开始，任务 [#11](https://github.com/alongor666/InsurHOT/issues/11)；阻断点：owner 批准价格表与预算额度（[#15](https://github.com/alongor666/InsurHOT/issues/15)）。M0.3整体未完成，不移除付费闭锁、不自行批准金额 |
| M0.4 | 品牌与可选模块清理 | 保留许可原名；重命名公开品牌；删除leaderboard/monitor前盘点路由、队列、导入、测试，删除后无悬空依赖 | 任务 [#12](https://github.com/alongor666/InsurHOT/issues/12)；范围按 [ADR-002](../adr/002-optional-module-removal.md)（模块删除，含 X 采集/引文翻译/model-providers）与 [ADR-003](../adr/003-brand-cleanup.md)（分三步改名）扩大，并新增保险行业内容替换（`industry/sources.json`、`taxonomy.ts`、`topics.json`、`prompts/`、`gold.example.jsonl`）；两份 ADR 为 Proposed，owner 裁决后开工。不借改名改变产品使命 |
| M0.5 | 本仓应用CI与整体验收 | Node24 typecheck、web build/tests、临时PG迁移/seed/backend tests、Docker smoke；独立review绑定最终HEAD | 任务 [#13](https://github.com/alongor666/InsurHOT/issues/13)；其中应用 CI（Node24 + 临时PG：typecheck/build/web tests/migrate/backend tests）提前拆为 [#10](https://github.com/alongor666/InsurHOT/issues/10) 独立交付，Docker smoke 留在 M0.5；本机无 Docker，在具备服务的 CI 环境验证 |

本机 PostgreSQL 18 补跑结果（[PR #17](https://github.com/alongor666/InsurHOT/pull/17)）：main 35 个迁移与 topics seed 通过；backend 132 用例 73 通过、56 失败全部归因于 M0.3a 默认拒绝与付费闭锁，无数据库相关失败——上游测试需在测试进程内对 loopback stub 显式开采集门，付费闭锁挡住的文件在 #10 列 skip 清单，M0.3b 后清空。

G2 上线清单新增：上游 `privacy.tsx`/`terms.tsx`/`about.tsx` 为 AI 资讯站法律页与介绍页，InsurHOT 版本正文由 owner 与法律角色核准后替换（[#15](https://github.com/alongor666/InsurHOT/issues/15) 第 6 项），未替换前不得公开。

M0.1工具测试仅使用本地临时Git仓库；CI不克隆第三方、不执行上游脚本。首次真实快照验证通过独立下载上游后离线读取Git对象完成。M0.2的依赖安装是工程准备，不等于允许业务外部调用；安装前核查生命周期脚本及网络访问。上游品牌资源先保留来源记录，正式站点替换后才允许公开。

## 后续产品交付

| 阶段 | 最小产出 | 验收门 | 不能提前做的事 |
|---|---|---|---|
| T2 证据闭环 | 一种监管文件、一种公司文件类型；Document→Passage→Assertion→Entity→Event | 许可先行、事实发布100%证据门、三类拒绝测试、时间分离、删除/撤回一致 | 权限未确认则用自造样例，不自动抓取 |
| T3 新生样本 | 5张结构不同的candidate卡、编码手册 | 逐断言证据核验、人工判级；有资源后扩至20张listed与双人一致性评测 | 不把58个研究案例批量当事实导入 |
| T4 三支柱和接口 | Matters/Changes/Emerges及API/MCP/RSS同权投影 | 锁定金标、影子运行、安全与许可全出口测试 | 未达G2不公开上线 |
| T5 评测标准 | UIPS内部schema、方法RFC、编码手册 | 公开形态及法律适用另行核准 | 不以B2B/开放数据视为自动豁免 |

每完成一项再估算下一项工期；当前没有足够工程数据承诺12周总工期。每天/每轮执行结束记录已交付SHA、失败日志、阻断与下一可执行动作；此规则不表示已经配置自动调度。

## 失败条件与回退

最薄弱假设是上游结构能以有限成本改造成证据优先系统。若M0.2/3发现默认外部调用散落且无法集中控制，先暂停功能扩展，缩小导入范围并补技术ADR；不靠配置说明放行。若人工复核或来源许可资源不足，T2/T3保持少量样例与candidate，不降低事实门。

回退以独立PR回退提交为单位；导入工具仅向不存在的隔离目录写入，不覆盖现有项目。M0应用未验收前保持Draft；预算、付费模型、律所及生产部署不随本计划自动获批。
