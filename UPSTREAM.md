# 上游来源与导入状态

- 仓库：https://github.com/KKKKhazix/AIHOT
- 固定提交：`589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`
- 原始清单：[489个Git blob及文件模式](vendor-manifests/aihot.json)
- 技术裁决：[ADR-001](docs/adr/001-pinned-upstream-import.md)
- **M0.2：固定489文件已整合到本仓，待独立评审；不代表应用可安全运行或已上线。**

先在单独目录取得上游Git仓库，再执行：

```bash
python3 scripts/stage_upstream.py --source /path/to/AIHOT --destination /path/to/new-staging-directory
python3 -m unittest discover -s tests -p 'test_stage_upstream.py' -v
```

目标目录必须不存在。脚本从固定提交的Git对象导出，与工作区脏文件无关；检查完整清单和每个blob哈希，保留二进制、可执行位与LICENSE/NOTICE，不执行上游代码。清单不是对所有源码或来源内容的安全认证。

2026-09-30本地执行：489文件验证及隔离暂存成功，7项工具测试通过。独立复审发现的目标目录竞态已修正：先独占创建目标目录，存在则失败；只清理本次创建且身份未变的目录，不能用rename替换他人目录。暂存输出不是对读者原子可见的发布，脚本成功退出后才可供后续整合使用。M0.2已进一步完成根目录映射整合、489项blob/模式验证、11项工具测试、typecheck及web build。Docker/PostgreSQL不可用，数据库/容器及应用测试未运行。品牌清理、安全默认/预算修复及完整应用CI仍依行动计划完成；[本地验收证据](docs/development/m0-integration-evidence.md)。

[M0.2路径/依赖/安全入口预检](docs/development/m0-integration-preflight.md)及[逐文件映射](vendor-manifests/aihot-import-map.json)已落实，当前状态为integrated-pending-review。可运行 `python3 scripts/verify_upstream_import.py` 复核489项原始字节与模式；该校验不认证运行时安全。
