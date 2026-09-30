# Dot D1 加固与部署默认值修正

2026-09-30；Refs #8、#9。基线：PR #9 HEAD `4f3523f1ad9449ee99b64a089692e6038d0d0da3`（base 已改为 main `f08fe132e997544b8edb9ee75ff886bf0d2c74ab`）。独立分支 `fix/dot-ingest-hardening`，目标分支 `codex/dot-intake-contract`，合入后随 #9 进 main。实施者为 Claude 会话单一写入；独立只读评审另派，结果绑定固定 HEAD 记录于 PR，以下自检不冒称独立评审。

## 修正项

| 缺口 | 修正 | 文件 |
|---|---|---|
| GitGuardian 在 #9 报告测试文件含 40 位 hex 字面值，PR 正文未提及 | 测试 token 改为每次运行 `randomBytes(20)` 生成；仓库不再含 token 形状的字面值。原字面值仅为测试假值，从未对应真实凭据 | `tests/dot-ingest.test.ts` |
| `/api/ingest/dot` 无限流，token 猜测与批量重试不受约束 | 新增内存限流，在开关检查之后、鉴权之前计数：每客户端地址 60 次/分钟 + 全局 300 次/分钟；超限返回 429 + `Retry-After: 60`，不触达存储。全局窗口独立于地址 Map 保存，客户端伪造 `X-Forwarded-For`（`trustProxy: true` 取客户端可控的最左地址）轮换再多地址也只能触发地址 Map 的 `clear()`，不会重置全局计数；超限后不再追加时间戳，每个窗口最多 limit+1 条，内存与扫描成本有界。状态随 app 实例 | `apps/api/src/routes/dot-ingest.ts` |
| Docker 编排数据库密码有默认值 `aihot`，漏配即弱密码上线 | 去掉默认值 `aihot`：db 服务的 `POSTGRES_PASSWORD` 改为必填 `${POSTGRES_PASSWORD:?}`，应用连接串改为 `${POSTGRES_PASSWORD}`；Compose 在启动任何服务前对整个文件做变量插值，必填项未满足即整体拒绝，因此连接串不需要重复 `:?`（#16 原写法 `${POSTGRES_PASSWORD:?提示文字}` 以及连接串里的 `${POSTGRES_PASSWORD:?}` 先后被 GitGuardian 的 Generic Password 检测当作硬编码密码，取代 #9 时改为现写法，说明移到 YAML 注释），未设置或为空时 compose 拒绝解析（含 `down`/`config`）；`.env.example` 注明必填，并说明已有数据卷需先 `ALTER USER` 改库内密码再更新变量 | `docker-compose.yml`、`.env.example` |

盘点中怀疑管理员登录缺限流，核实 `apps/api/src/routes/admin-auth.ts` 已有每地址 10 次 / 总计 50 次每 15 分钟的限制，本轮不改。

## 本仓实测

Node v25.5.0（满足 `engines >=24.11`），`npm ci --ignore-scripts`。仅本仓结果。

| 命令/检查 | 结果 | 日志 |
|---|---|---|
| `node --test tests/dot-ingest.test.ts` | 13/13 PASS，exit0（新增 2 项限流用例） | [定向检查](evidence/dot-hardening-tests.log) |
| `npm run typecheck` | 全仓 PASS，exit0 | [类型检查](evidence/dot-hardening-typecheck.log) |
| `npm run build -w @aihot/web` | 客户端+SSR PASS，exit0 | [构建](evidence/dot-hardening-build.log) |
| `git diff --check` | PASS，exit0 | 提交前执行 |
| compose 缺密码拒绝启动 | **NOT RUN**：本机无 Docker；静态核对两处引用均为 `:?` 语法、无 `:-aihot` 残留 | 待 M0.5 Docker smoke |
| PG 迁移、真实并发幂等、Docker、完整应用 CI | **NOT RUN**，与 #9 相同 | 见 #10、#13 |

新增限流用例：(1) 同一地址 60 次未授权请求均 401，第 61 次持有效 token 仍 429 且零存储，另一地址持有效 token 200；(2) `trustProxy: true` 下同一 socket 每次换一个不同的伪造 `X-Forwarded-For` 地址：前 300 次均 401，第 301 次起直到第 5050 次全部 429（跨过地址 Map 的 5000 键 `clear()` 边界），零存储——该用例在没有全局上限、全局计数随 Map 一起清零、或未开 trustProxy 时都会失败。日志中主机名与本地路径已脱敏。

## 独立评审与返修

第一轮独立只读评审（Claude Opus 5.5，绑定 HEAD `346f5952f81d25386b5827f88e81ca8e801717f3`，见 PR 评论）结论 REQUEST_CHANGES：P1 伪造 XFF 绕过按地址限流、P2 Map 无界导致线性扫描放大、P3 已有数据卷升级缺说明、P3 测试未覆盖 trustProxy 路径。四项均已按上表修正；"与管理员登录同形"的原表述已更正为实际实现（第二轮返修时曾与其一致；第三轮后 Dot 的全局窗口独立于地址 Map，与管理员登录不再同形，见下文）。第二轮复审（HEAD `4f8b3da5ca424f8b6b697097043dc2a3014de1d1`）REQUEST_CHANGES：P2 `clear()` 同时清空全局计数使全局上限可被周期性重置；P3 超限后仍追加时间戳；P3 全局桶共享未写明；P3 文档地址数与实现不符。已修正为全局窗口独立保存、超限不追加、用例覆盖 5000 键边界，并补充下文说明。第三轮复审（HEAD `8c116fc9cb824d998c24e598929680f684c9abcb`）APPROVE，N1–N4 全部关闭，仅提出本段措辞过时（P3，不阻塞）；本次提交只改这一句措辞，不改代码。

## 未声称的性质

限流为单进程内存实现，多副本部署下按副本各自计数；不替代反向代理层限流。`trustProxy: true` 取代理头中客户端可控的地址，因此按地址限流只对不伪造头的客户端有意义，真正的兜底是全局上限；收窄 `trustProxy` 跳数需 owner 确认部署拓扑，本轮不改。全局桶由所有调用方共享：任何一方（含未认证方）在一分钟内打满 300 次，合法 Dot 投递在该窗口内也会收到 429——这是与管理员登录相同的取舍，Dot 按日投递、可按 `Retry-After` 重试，owner 知悉即可。管理员登录限流的 `clear()` 同样会清空其全局键，属既有问题，不在本 PR 范围。本轮不改变 D1 合同、存储或任何 M0.3a 控制门；未启用真实 Dot 连接、采集、付费模型或推送。

## 回退

按提交逆序 revert 本 PR；无数据库迁移。运维影响：已用默认密码初始化数据卷的部署，在设置新 `POSTGRES_PASSWORD` 前需先改库内密码，否则应用认证失败。
