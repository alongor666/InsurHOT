# M0.2 应用整合预检

2026-09-30；预检已落实，489文件已整合并经独立评审合入 main（PR #6，merge `c85db795`）；[执行证据](m0-integration-evidence.md)。上游固定SHA与ADR-001相同，不采用较新的上游HEAD。

## 路径映射

[逐文件映射](../../vendor-manifests/aihot-import-map.json)包含489项，目标唯一，与M0.1开发文件无碰撞。484项保持原路径，5项归档：

| 上游路径 | 目标路径 | 原因 |
|---|---|---|
| README.md | docs/upstream/README.md | 保留本项目使命及状态入口 |
| AGENTS.md | docs/upstream/AGENTS.md | 保留本项目权限与验收规则 |
| CLAUDE.md | docs/upstream/CLAUDE.md | 不覆盖本仓Agent工作约定 |
| .claude/launch.json | docs/upstream/claude-launch.json | 不自动启用上游启动配置 |
| .github/workflows/check.yml | docs/upstream/workflows/check.yml | 审核并改写后在M0.5启用应用CI |

所有行同时记录原blob SHA和模式；M0.2整合时再对最新项目HEAD检查冲突，不能因本次无冲突而省略复核。LICENSE/NOTICE与所有第三方许可保持字节一致；映射不代表授权使用上游品牌或采集示范信源。

## 依赖和运行准备

工作区package.json未见preinstall/postinstall/prepare钩子；锁文件只有node_modules/fsevents标hasInstallScript，不能据此认证整个依赖树安全。首轮安装使用npm ci --ignore-scripts --no-audit --no-fund；保留锁文件、不自动升级依赖。若构建需要生命周期脚本，先记录所需包与行为后单独启用，不直接取消限制。

本环境Node v24.19.0；Docker/PG不可用。可先检验typecheck/web构建，数据库及容器验收在具备服务的CI执行。CI未分配runner的失败不得改写成测试成功。

## 待实际修复的入口

- packages/backend/src/config.ts:57：MODEL_CALLS_ENABLED默认true。
- apps/worker/src/schedules.ts:36：COLLECT_ENABLED不是false就采集。
- packages/backend/src/providers/receipts.ts:87：缺预算行直接return，原意是无限预算。

M0.3必须盘点所有调用入口，再验证缺省关闭、显式启用、缺预算/价格拒绝、并发预留和未知回执。上游快照可暂存与静态检查；安全修复前不得启动worker或带真实凭据的应用。本轮已完成映射整合、489项校验、11项工具测试及typecheck/web build；M0.2仍待独立评审，M0.3–M0.5未验收。
