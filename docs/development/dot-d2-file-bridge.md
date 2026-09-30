# Dot D2：受控文件交付桥

任务 [#14](https://github.com/alongor666/InsurHOT/issues/14)，父任务 [#8](https://github.com/alongor666/InsurHOT/issues/8)；合同与边界见 [Dot 信息接入规划](dot-integration-plan.md)。

这是 D2 的第一种交付通道，也是规划第 8 节写明的退路：**交付者把 v1 JSON 批次落盘到一个收件目录，运营者机器上的桥把它提交到 InsurHOT 自己的 `POST /api/ingest/dot`，保存服务器回执并归档。** 它不是「官方 Dot API」，不假设 Dot 有 REST API 或 webhook；不调用任何模型，不访问批次里的来源链接，不触发分析、队列、推送或公开发布。

**当前状态**：桥已实现，并在本机对真实的接收端与真实 PostgreSQL 验证（见文末）。**真实 Dot 账户连接与首批真实 Dot 数据：NOT RUN**——账户连接尚未完成，Dot 能否把文件写到运营者机器上的目录也还没有在真实账户里核实。

## 用法

```
DOT_INGEST_TOKEN=<专用凭据> node scripts/dot-bridge.ts --inbox <收件目录> [--endpoint https://<主机>/api/ingest/dot]
```

- 跑一轮就退出。要定时执行，由运营者自己的调度器（cron、launchd 等）调用；桥本身不常驻、不自带定时。
- **凭据**只从环境变量 `DOT_INGEST_TOKEN` 读取，不接受命令行参数（命令行对同机其他进程可见）。它不会出现在任何输出、台账、回执或错误文件里。取值与服务端的 `DOT_INGEST_TOKEN` 相同，由私有凭据渠道配置，不入 Git、不写进交给 Dot 的说明。
- **端点**来自 `--endpoint` 或环境变量 `DOT_BRIDGE_ENDPOINT`，必须是完整的 `/api/ingest/dot` 地址、不带查询串和内嵌凭据；除本机地址（`localhost`、`127.0.0.1`、`[::1]`）外必须是 `https`。不跟随重定向。
- 服务端要先启用接收：`DOT_INGEST_ENABLED=true` 且 `DOT_INGEST_TOKEN` 是一个至少 32 字符的非占位值（规划第 5 节）。缺省关闭时桥会收到 503，文件原样等待。

## 收件目录

```
<收件目录>/
  pending/      待交付：只处理这一层、扩展名为 .json 的普通文件
  delivered/    <deliveryId>.json（原文件，字节不变）与 <deliveryId>.receipt.json（服务器回执）
  rejected/     被永久拒绝的文件与 <文件名>.error.json（HTTP 状态、错误代码、时间）
  ledger.jsonl  台账：每处理一个文件一行
  .lock         运行中的桥的进程号
```

目录与文件由桥以 0700 / 0600 创建。**落盘约定**：交付者先写 `<名字>.json.part`，写完再改名为 `<名字>.json`。桥会跳过 `.part`、隐藏文件、子目录、符号链接，以及最近 5 秒内还被修改过的文件。

## 每个文件的结果

| 情形 | 文件去向 | 台账 `outcome` |
|---|---|---|
| 服务器回执 `received` | `delivered/` | `delivered` |
| 服务器回执 `duplicate`（同一 `deliveryId`、同一内容已收过） | `delivered/` 里已有的第一份保留，这一份删除；回执更新（时间仍是首次接收的时间） | `duplicate` |
| 400 格式不合法、409 同 `deliveryId` 内容不同、413 超限、415 | `rejected/`，附 `.error.json` | `rejected` |
| 发送前就能判定不可用：超过 256 KiB、不是 JSON、没有字符串 `deliveryId`、`deliveryId` 不符合合同的安全 ID 规则 | `rejected/`（不发请求，保留原文件名） | `rejected` |
| 网络不通、超时、重定向、401/403、429、5xx（含 503 接收未启用）、2xx 但不是这份批次的回执 | **留在 `pending/`，字节不变** | `retry` |
| 符号链接、子目录、刚修改过 | 留在 `pending/` | `skipped` |

401/403（凭据有问题）、429（速率窗口已满）和网络不通会结束本轮，后面的文件不再发送。重试始终用同一个文件、同一个 `deliveryId`；接收端按 `deliveryId` 幂等，重复提交不新增数据。被 409 拒绝的批次要由交付者换一个新的 `deliveryId` 重新落盘。

台账每行只有：`at`、`file`、`deliveryId`、`outcome`、`httpStatus`、`receivedAt`、`firstSeenAt`、`itemCount`、`error`。不含标题、摘要、来源链接或凭据。

**退出码**：0 没有遗留；2 有文件等待重试（或另一个桥正占着锁）；3 有文件被永久拒绝；1 配置错误（缺凭据、端点不合规、未知参数）。标准输出是一行 JSON 计数。

**一次只跑一个**：`.lock` 独占创建；已有且进程还在，第二个桥什么都不做；进程已不在则接管。

## 失败与回退

- 桥在「回执已写、文件未移动」之间中断：下一轮得到 `duplicate` 并完成归档。
- 服务器已入库但回执丢失：下一轮得到 `duplicate`，回执里的时间是首次接收的时间。
- 停用：不再调用脚本即可；服务端关闭 `DOT_INGEST_ENABLED` 或撤销凭据后，文件留在 `pending/` 等待。桥不删除任何未被服务器确认的文件。
- 回退代码：revert 本 PR；不涉及数据库结构。

## 给 Dot 的责任说明（待配置，不是已建立的任务）

连接完成后可以直接交给 Dot 的文字。它描述的是待配置的方案；目前没有创建任何真实的 Dot 责任、连接或定时计划。

> 你负责持续关注保险行业的公开信息：重要变化、保险产品及其评价标准、AI 带来的新商业模式。保持行业客观，不偏向任何一家保险公司。
>
> 每个工作日北京时间 09:00 前交付一个常规批次；出现重大事件时另行交付。每个批次是一个 JSON 文件，先写成 `<批次ID>.json.part`，写完后改名为 `<批次ID>.json`，放进约定的收件目录的 `pending/`。
>
> 文件内容：`schemaVersion` 固定为 `insurhot.dot.v1`；`deliveryId` 是这个批次稳定的 ID（1–80 个字符，只用字母、数字、`.`、`_`、`-`，以字母或数字开头），同一批次重试时不变，内容有任何修改就换新 ID；`items` 有 1–50 条，整个文件不超过 256 KiB。每条包含：批内唯一的 `itemId`；`title`（不超过 500 字符）；`summary`（不超过 4000 字符，必须是你自己写的摘要，不要粘贴原文）；`pillars`（`matters`、`changes`、`emerges` 中的 1–3 个）；`assertionKind`（来源明确报道的写 `reported`，你自己的推断写 `inference`）；`sources`（1–10 个原始来源，每个有 `https` 的 `url`、`publisher`、`publishedAt`，不知道发布时间就写 `null`）；`dotObservedAt`（你看到这条信息的时间）。不要添加其他字段。
>
> 优先保留原始文件的链接与发布者；同一事件的重复报道合并成一条；区分报道与你的推断。访问不到的来源如实写明，不要声称读过。不要购买订阅，不要向任何公开渠道发布，不要把任何凭据写进文件或对话。

## 连接台账

| 项目 | 内容 |
|---|---|
| 通道类型 | 受控文件交付桥（本文档） |
| 交付者如何写入收件目录 | **NOT RUN：真实 Dot 账户连接尚未完成。** Dot 的本机连接依赖运营者的电脑在线且 ChatGPT 应用在运行（规划第 2 节）；它能否按上面的落盘约定写入指定目录，要在真实账户里核实 |
| 专用凭据 | 服务端 `DOT_INGEST_TOKEN`；桥从自己的环境读取同一取值。轮换：先在服务端换新值，再更新桥的环境；旧值立即失效，`pending/` 里的文件下一轮用新值重试 |
| 运行计划 | 待配置方案：每日北京时间 09:00 之后由运营者的调度器运行一次桥。目前没有建立任何定时任务 |
| 首批真实 `deliveryId` 与服务器回执 | **NOT RUN：真实 Dot 账户连接尚未完成。** 首批到达后在此填入 `deliveryId`、`receivedAt` 与 `delivered/<deliveryId>.receipt.json` 的内容 |
| 重复提交不新增数据 | 本机用合成批次验证（见下）；真实批次 NOT RUN |

其他通道（把提交动作做成 Dot 可调用的工具，如 `submit_dot_batch`）没有实现：它需要一个 Dot 连得上的已部署服务，并在真实账户里核实 Dot 能调用。

## 验证（本机，PostgreSQL 18.1，一次性库 `*_test`）

`tests/dot-bridge.test.ts`，8 个用例：在测试进程里把本仓的 API 应用监听在 `127.0.0.1` 的临时端口，启用接收并使用每次运行随机生成的凭据；批次是合成数据。

- 交付一次并归档，库里一行批次一行条目；同一文件重交付与「同内容、键序不同」都是 `duplicate`，库里不新增，回执时间等于首次接收时间。
- 同 `deliveryId` 不同内容得到 409，未知字段得到 400，都进入 `rejected/`；库里原批次的哈希不变。
- 超限、非 JSON、缺 `deliveryId`、`deliveryId` 为 `../../escaped` 的文件不发请求直接拒绝；符号链接、子目录、`.part`、隐藏文件、刚修改的文件不处理；收件目录之外没有任何写入。
- 接收未启用（503）、端口无人监听、凭据错误（401）时文件字节不变地留在 `pending/`，之后用同一 `deliveryId` 交付成功。
- 重定向不被跟随（重定向目标收到 0 个请求）；429 结束本轮；一个 200 但 `deliveryId` 不符的回答不算回执。
- 端点校验；锁（持有者在、持有者已不在、两轮同时运行只入库一份）。
- 以子进程运行脚本：汇总与退出码 0/2/3/1；命令行不接受 `--token`；两个凭据都不出现在台账、回执、错误文件、标准输出和标准错误里；台账与回执的权限是 0600。

命令与结果：

- `npm run typecheck`：通过（[日志](evidence/dot-d2-typecheck.log)）。`scripts/dot-bridge.ts` 本身不在类型检查范围内（仓库的 `scripts/` 都不在），它只有十几行，逻辑在被检查的 `packages/backend/src/ingest/dot-bridge.ts` 里，并由子进程用例实际运行。
- `bash scripts/test-unlocked.sh`：29 个文件，179/179，跳过清单 11 条不变（[日志](evidence/dot-d2-unlocked.log)）。
- 变异验证（[日志](evidence/dot-d2-mutations.log)）：14 项都让用例失败——跟随重定向、409 当作重试、503 当作永久拒绝、跟随符号链接、发送刚修改的文件、使用不安全的 `deliveryId`、发送超限文件、接受别的批次的回执、凭据被拒后继续发送、服务器不通后继续发送、忽略锁、把凭据写进台账、脚本接受 `--token`、接受到其他主机的明文 http。其中「跟随符号链接」第一次的变异写法无法编译，那次的失败不算数，重做后有效。

## 未运行 / 未覆盖

- **真实 Dot 账户连接、Dot 写入收件目录、首批真实 Dot 数据**：NOT RUN，账户连接尚未完成。
- 对已部署的 HTTPS 端点运行：NOT RUN，没有已部署的实例。`https` 分支只测了端点校验，没有真实 TLS 请求。
- 由调度器定时运行、长时间运行、磁盘写满、跨文件系统的收件目录：NOT RUN。
- Windows：NOT RUN（文件权限与锁的语义不同）。
- Docker smoke 与 web 构建：本机没有 Docker，看本 PR 的 CI。
- 付费闭锁、采集、模型、推送：本 PR 没有触碰，仍全部关闭。
