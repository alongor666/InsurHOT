# Dot D1 加固与部署默认值修正

2026-09-30；Refs #8、#9。基线：PR #9 HEAD `4f3523f1ad9449ee99b64a089692e6038d0d0da3`（base 已改为 main `f08fe132e997544b8edb9ee75ff886bf0d2c74ab`）。独立分支 `fix/dot-ingest-hardening`，目标分支 `codex/dot-intake-contract`，合入后随 #9 进 main。实施者为 Claude 会话单一写入；独立只读评审另派，结果绑定固定 HEAD 记录于 PR，以下自检不冒称独立评审。

## 修正项

| 缺口 | 修正 | 文件 |
|---|---|---|
| GitGuardian 在 #9 报告测试文件含 40 位 hex 字面值，PR 正文未提及 | 测试 token 改为每次运行 `randomBytes(20)` 生成；仓库不再含 token 形状的字面值。原字面值仅为测试假值，从未对应真实凭据 | `tests/dot-ingest.test.ts` |
| `/api/ingest/dot` 无限流，token 猜测与批量重试不受约束 | 新增按客户端地址、每分钟 60 次的内存限流，在鉴权之前计数；超限返回 429 + `Retry-After: 60`，不触达存储。状态随 app 实例，与管理员登录限流同形 | `apps/api/src/routes/dot-ingest.ts` |
| Docker 编排数据库密码有默认值 `aihot`，漏配即弱密码上线 | 两处 `${POSTGRES_PASSWORD:-aihot}` 改为 `${POSTGRES_PASSWORD:?...}`，未设置时 compose 拒绝解析；`.env.example` 注明必填 | `docker-compose.yml`、`.env.example` |

盘点中怀疑管理员登录缺限流，核实 `apps/api/src/routes/admin-auth.ts` 已有每地址 10 次 / 总计 50 次每 15 分钟的限制，本轮不改。

## 本仓实测

Node v25.5.0（满足 `engines >=24.11`），`npm ci --ignore-scripts`。仅本仓结果。

| 命令/检查 | 结果 | 日志 |
|---|---|---|
| `node --test tests/dot-ingest.test.ts` | 12/12 PASS，exit0（新增 1 项限流用例） | [定向检查](evidence/dot-hardening-tests.log) |
| `npm run typecheck` | 全仓 PASS，exit0 | [类型检查](evidence/dot-hardening-typecheck.log) |
| `npm run build -w @aihot/web` | 客户端+SSR PASS，exit0 | [构建](evidence/dot-hardening-build.log) |
| `git diff --check` | PASS，exit0 | 提交前执行 |
| compose 缺密码拒绝启动 | **NOT RUN**：本机无 Docker；静态核对两处引用均为 `:?` 语法、无 `:-aihot` 残留 | 待 M0.5 Docker smoke |
| PG 迁移、真实并发幂等、Docker、完整应用 CI | **NOT RUN**，与 #9 相同 | 见 #10、#13 |

新增限流用例：同一地址 60 次未授权请求均 401，第 61 次持有效 token 仍 429 且零存储；另一地址持有效 token 200。日志中主机名与本地路径已脱敏。

## 未声称的性质

限流为单进程内存实现，多副本部署下按副本各自计数；不替代反向代理层限流。`trustProxy: true` 已在 app 中配置，地址取自代理头，与管理员登录一致。本轮不改变 D1 合同、存储或任何 M0.3a 控制门；未启用真实 Dot 连接、采集、付费模型或推送。

## 回退

按提交逆序 revert 本 PR；无迁移、无数据变化。
