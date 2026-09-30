# M0.5 第 1 部分：构建后站点 smoke 与 Docker compose smoke

所属任务：#13（父台账 #3、#4）。只改 `.github/workflows/app.yml`。M0 整体验收与 #4 关闭不在本 PR，仍依赖 M0.3b。

## 加了什么

- `app` job：迁移并 seed 主题后，启动 API 与 web（采集、模型调用关闭），跑 `scripts/smoke.ts`，再跑后端测试；失败时输出两份服务日志。
- `docker` job：
  - `scripts/init-env.ts` 生成一次性 `.env`（随机密钥，输出丢弃），把 `COLLECT_ENABLED`、`MODEL_CALLS_ENABLED` 置为 false 并校验；
  - `docker compose up -d --build`，在 compose 网络内跑 `scripts/smoke.ts --base http://web:3000`；
  - 断言正在运行的服务恰为 `api db web worker`（smoke 本身够不着 worker）；
  - 断言 `schema_migrations` 行数等于 `database/migrations/*.sql` 文件数，`sources` 行数等于 `industry/sources.json` 的条数（证明 `setup` 服务迁移并 seed 过；两个期望值取自仓库内容，不写死）；
  - 无论成败 `docker compose down -v`。

与上游 `docs/upstream/workflows/check.yml` 的差别：安装沿用本仓的 `--ignore-scripts`，checkout 不保留凭据，后端测试仍是 `scripts/test-unlocked.sh`（付费闭锁），信源数不写死，多了 worker 在运行的断言。不引用上游的 CI 记录。

## 证据

本机没有 Docker，证据只有 GitHub Actions：rebase 到 main `34bb339` 之前的分支提交上的运行（工作流文件内容与本 PR 相同） <https://github.com/alongor666/InsurHOT/actions/runs/36721669527>。

- `app`：通过。web 测试 11/11，构建后站点 smoke「all checks passed」，后端 unlocked 149/149。
- `docker`：通过。`docker compose ps` 显示 api、db（healthy）、web、worker 均为 Up；smoke 30 项全过（15 个页面、14 个机器可读出口、MCP initialize）；三条断言通过。

本文档提交之后的 HEAD 会再跑一次同样的检查，以 PR 页面上的结果为准。

## 未运行 / 未覆盖

- 登录后台后的页面、任何真实采集或模型调用：CI 里关闭，付费闭锁不变。
- worker 只证明「在运行」，没有证明它处理了任务。
- Docker 镜像里的 `npm ci` 没有 `--ignore-scripts`（上游原样），与 `app` job 的安装方式不同；未在本 PR 改 Dockerfile。
- `npm audit` 仍只报告不阻断，阈值未定。
- HTTPS（Caddy profile）。

## 回退

`git revert` 本 PR 的合并提交；只影响 CI。
