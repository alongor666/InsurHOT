# M0.4 品牌清理第 2 步：浏览器持久键与运维标识

所属任务：#12（父台账 #3、#4），[ADR-003](../adr/003-brand-cleanup.md) 第 2 步。与第 1 步（#32）改动面不相交，各自基于 main。

## 改了什么

| 面 | 改动 |
|---|---|
| 浏览器持久键 | localStorage 键 `insurhot-starred-items`、`insurhot-read-items`、`insurhot-theme`、`insurhot-changelog-seen-version`、`insurhot-feedback-draft-v1`；sessionStorage 前缀 `insurhot:list:`、`insurhot:groups:`。当前没有线上用户，不迁移旧键（ADR：上线前未完成则补读旧键一次；本 PR 在上线前合入，不需要） |
| CSS | 16 个 `@keyframes aihot-*` 改名 `insurhot-*`，引用处同步；文件头注释不再以上游品牌命名 |
| 请求头 | web SSR 发给 API 的 `x-insurhot-ssr`；图片代理探测头 `x-insurhot-img-proxy-auth`（仓库内没有发送方，只有读取处） |
| pg-boss | `application_name: "insurhot-jobs"` |
| 数据库默认名 | `config.ts` 的默认 `DATABASE_URL` 与 `.env.example` 注释：库名 `insurhot`；`docker-compose.yml`：项目名 `insurhot`、镜像 `insurhot-app`、库用户/库名 `insurhot`；CI `docker` job 的两条 `psql` 断言随之改 |
| 备份 | 文件名 `insurhot-<stamp>.dump`、`insurhot-files-<stamp>.tar.gz`；本地清理抽成 `pruneLocalBackups(dir)`，**同时按新旧前缀**保留每类最新 3 份（按时间戳排序，新旧名混排） |
| 文档 | `docs/deploy.md` 的手工备份命令 |

不改：`@aihot/*` 包名、`AIHOT_*` 环境变量、`_aihot` 数据键（第 3、4 步）；许可与来源记录类文件。例外：G 类里的上游随附文档 `docs/deploy.md` 改了一行手工备份命令的库用户与库名（否则在新 compose 下跑不通），属运维同步，不是品牌改写。

**已有数据卷的部署**要注意：compose 的项目名从 `aihot` 改为 `insurhot`，三个卷（`db`、`data`、`caddy`）没有显式 `name:`，卷名前缀随之从 `aihot_` 变为 `insurhot_`——旧卷不再挂载，compose 会新建空卷；库用户与库名也改了。当前没有任何部署，所以本 PR 不做迁移路径；将来若已有部署再改名，需先给卷写显式 `name:` 或迁移数据。

## 验证（本机，全新一次性库，42 个迁移）

- `npm run typecheck`：通过（[日志](evidence/m0-4e-brand-step2-typecheck.log)）。
- `npm run build -w @aihot/web`：通过；web 测试 11/11。
- `bash scripts/test-unlocked.sh`：30 个文件，187/187（[日志](evidence/m0-4e-brand-step2-unlocked.log)）。新增 `tests/backup-prune.test.ts`：新旧前缀混合的 11 个文件，每类保留最新 3 份、其他文件不动、第二次运行不再删。
- 构建产物里剩余的 `aihot` 字面量都属于第 1 步（#32）的范围：`footerNote` 的「由 AIHOT 开源框架驱动」、`markdown.ts` 里的 `aihot.news` 域名正则、两个下载文件名；`links.aihot` 在后端产物里，不在 web 构建里。

## 未运行 / 未覆盖

- `runBackup` 整体（需要 `pg_dump` 与对象存储）：只测了抽出来的清理函数。
- Docker compose 用新名字启动：本机无 Docker，看本 PR 的 CI `docker` job（它用新用户名/库名做断言）。
- 图片代理探测头没有发送方，改名只影响读取处。

## 回退

`git revert` 合并提交。不涉及数据库结构；若已有 compose 数据卷（当前没有），回退后库名恢复为 `aihot`。
