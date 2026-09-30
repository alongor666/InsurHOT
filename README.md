# InsurHOT

**Insurance High-value Observed Trends** · 保险行业高价值变化与趋势情报平台

> Discover what matters, what changes, and what emerges in insurance.
> 发现保险行业什么重要、什么正在变化、什么正在诞生。

InsurHOT 面向整个保险行业的公开信息空间，坚持 *Evidence first, opinion last*，服务人和 AI Agent。它不是保险热点站或新闻聚合站，也不是任何一家保险公司的内部经营系统。

当前阶段：Phase 0 规划基线已验收；M0.1 导入工具、M0.2 固定上游快照整合、M0.3a 默认拒绝与付费闭锁已合入 main（`f08fe132`），所有付费外呼无条件关闭。本机 PostgreSQL 已补跑迁移/seed/backend tests（#17）；M0.3b 金额预算、M0.4 模块删除与品牌清理、M0.5 应用 CI 与 Docker 验收未完成，应用未上线。任务与阻断点见 Issue #10–#15。 Dot 信息接入已规划，D1 接收端已实现（PR 待合并）；真实 Dot 连接、D2 交付通道与 D3 投影未配置。

- [开发行动计划](docs/development/action-plan.md)
- [Dot 信息接入规划](docs/development/dot-integration-plan.md)
- [上游基线及导入工具](UPSTREAM.md)
- [项目实时台账](https://github.com/alongor666/InsurHOT/issues/3)

- [Phase 0 Architecture & Product Specification](docs/phase0/InsurHOT-Phase0-Spec.md)
- [定位校准记录（Positioning Delta Review）](docs/phase0/positioning-delta-review.md)

- [独立评审与验收记录](docs/phase0/review-2026-09-29.md)
- [交付门槛与项目接管](docs/phase0/delivery-gates.md)
