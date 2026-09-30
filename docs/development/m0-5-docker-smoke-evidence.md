# M0.5 第 1 部分：构建后站点 smoke 与 Docker compose smoke

所属任务：#13（父台账 #3、#4）。改动只有 `.github/workflows/app.yml` 和本文档。M0 整体验收与 #4 关闭不在本 PR，仍依赖 M0.3b。

## 加了什么

- `app` job：迁移并 seed 主题后，启动 API 与 web（采集、模型调用关闭），跑 `scripts/smoke.ts`，停掉这两个进程，再跑后端测试；失败时输出两份服务日志。
- `docker` job：
  - `scripts/init-env.ts` 生成一次性 `.env`（随机密钥，输出丢弃），把 `COLLECT_ENABLED`、`MODEL_CALLS_ENABLED` 置为 false 并校验；
  - `docker compose up -d --build`，在 compose 网络内跑 `scripts/smoke.ts --base http://web:3000`；
  - smoke 之后等 20 秒，断言正在运行的服务恰为 `api db web worker`（smoke 本身够不着 worker），且 api、web、worker 三个容器状态为 running、重启次数为 0（崩溃的角色会被 compose 重启，单看 running 看不出来）；
  - 断言 `schema_migrations` 行数等于 `database/migrations/*.sql` 文件数，`sources` 行数等于 `industry/sources.json` 的条数（证明 `setup` 服务迁移并 seed 过；两个期望值取自仓库内容，不写死）；每条断言先把比较的两侧打印到日志；
  - 无论成败 `docker compose down -v`。

与上游 `docs/upstream/workflows/check.yml` 的差别：安装沿用本仓的 `--ignore-scripts`，checkout 不保留凭据，后端测试仍是 `scripts/test-unlocked.sh`（付费闭锁），信源数不写死，多了迁移数、各角色在运行且未重启的断言；`init-env` 的输出（上游会把管理员密码打到日志）丢弃；两个开关置 false 后再校验一次。不引用上游的 CI 记录。

## 证据

本机没有 Docker，证据只有 GitHub Actions，以 PR 页面上最终 HEAD 的运行为准（文档无法引用包含它自己的那次提交的运行）。

- 评审第 1 轮绑定的运行：<https://github.com/alongor666/InsurHOT/actions/runs/36722321176>（`b6b1297`）。`app`：web 测试 11/11，构建后站点 smoke「all checks passed」，后端 unlocked 149/149。`docker`：`docker compose ps` 显示 api、db（healthy）、web、worker 均为 Up；smoke 30 项全过（15 个页面、14 个机器可读出口、MCP initialize）。
- 该轮评审指出：三条断言虽然执行（`bash -e`），但日志里看不到比较的值；worker 只在启动后约 3 秒查了一次。之后的提交加了打印、20 秒等待和重启次数断言，它们的输出在最终 HEAD 的 `docker` job 日志「Smoke check」一步里。

## 未运行 / 未覆盖

- 登录后台后的页面、任何真实采集或模型调用：CI 里关闭，付费闭锁不变。
- worker 只证明「在运行」，没有证明它处理了任务。
- Docker 镜像里的 `npm ci` 没有 `--ignore-scripts`（上游原样），与 `app` job 的安装方式不同；未在本 PR 改 Dockerfile。
- `npm audit` 仍只报告不阻断，阈值未定。
- HTTPS（Caddy profile）。

## 回退

`git revert` 本 PR 的合并提交；只影响 CI。
