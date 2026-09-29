# 上游来源与导入状态

- 仓库：https://github.com/KKKKhazix/AIHOT
- 固定提交：`589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`
- 原始清单：[489个Git blob及文件模式](vendor-manifests/aihot.json)
- 技术裁决：[ADR-001](docs/adr/001-pinned-upstream-import.md)
- **当前只实现导入准备工具；上游应用尚未整合到本仓。**

先在单独目录取得上游Git仓库，再执行：

```bash
python3 scripts/stage_upstream.py --source /path/to/AIHOT --destination /path/to/new-staging-directory
python3 -m unittest discover -s tests -p 'test_stage_upstream.py' -v
```

目标目录必须不存在。脚本从固定提交的Git对象导出，与工作区脏文件无关；检查完整清单和每个blob哈希，保留二进制、可执行位与LICENSE/NOTICE，不执行上游代码。清单不是对所有源码或来源内容的安全认证。

2026-09-30本地执行：489文件验证及隔离暂存成功，5项工具测试通过。Node v24.19.0可用；Docker/PostgreSQL不可用，未运行应用构建/数据库/容器验收。实际根目录整合、同名文件映射、品牌清理、安全默认修复及应用CI仍依行动计划完成。
