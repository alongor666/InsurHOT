# M0.4 第 2 步 b：删除 X 采集与引文翻译

2026-09-30；Refs #12、#4；依据 [ADR-002](../adr/002-optional-module-removal.md)（owner 2026-09-30 批准，含范围扩大到 X 采集、引文翻译，以及不可自动回退的 drop 迁移）；前一部分见 [第 2 步 a 证据](m0-4b-remove-leaderboard-monitor-evidence.md)。基线 main `465a3d87`，分支 `feat/m0-4c-remove-x-collection`。实施者为 Claude 会话单一写入；独立评审另派，结果绑定固定 HEAD 记录于 PR，以下自检不冒称独立评审。

本 PR 完成 ADR-002 第 2 步的后半。做完后 ADR-002 列出的删除项全部落地。

## 删除了什么

**采集**

- `sources/x.ts`（X 搜索、分片、长文解析）与 `providers/socialdata.ts`（SocialData 三个端点）整个文件。
- `sources/collect.ts` 的 X 分支、`collectXShard`、分片调度；`jobs/sources.ts` 与 `jobs/queue.ts` 的 `sources.fetch-x` 队列；`scheduleDueSources` 的返回值去掉 `shards`。
- 信源类型 `x_search`：`sources/types.ts`、`config-keys.ts`、`admin/sources.ts`（新建校验、试抓、去重标识）、contracts 的 `SourceKind`、后台新建信源模板与标签、关于页的信源种类。
- `sources/icons.ts` 的 X 头像刷新；`events/hot.ts`、`collect.ts` 里按类型列举信源的 SQL。

**帖子数据与正文**

- 资料入口 `content/materials.ts` 的 `xPost`（`XPostData`、按 tweetId 的去重键、`x_post` 列的写入）。
- `content/extract.ts` 的 X 长文抓取（`extractXArticle`，走 SocialData）；`jobs/content.ts` 路由里的 `needsXArticle`。

**编辑步骤**

- `editorial/input.ts`、`writing.ts`、`analyze.ts` 里帖子专用的输入与文案：作者/句柄、引用帖块、短帖原文照用（`verbatim`）、短帖与长帖两套摘要提示词；现在所有材料都按文章处理。
- `editorial/translate.ts` 的帖子翻译分支与引文翻译（`translateQuotes`、`translate_quoted` 用途）；`translatePending` 的返回值去掉 `quotes`。
- 提示词文件 5 个：`summarize-short-post(-quoted)`、`summarize-long-post(-quoted)`、`translate-post`。摘要与翻译两步的提示词版本因此改变（版本由所用提示词文件算出），旧回执不会被这两步复用；当前没有已部署实例。
- `events/group.ts` 里靠「回复/引用哪条帖子」归组的路径：`referenced` 召回加权、`signal-native` 裁决、`reclaimWaiting`。按相似度归组的路径不变。

**公开读取**

- `publication/items.ts` 的 `xView` 与条目上的 `x` 字段；`detail.ts`、`feeds.ts` 里帖子的正文、译文、引用块；`publish.ts`/`rules.ts` 的 `channelOf`（频道现在恒为 `news`）。
- contracts：`XPostView`、`MediaView`、条目与详情上的 `x`；`ChannelKey` 去掉 `x`。
- web：条目卡片与详情页的帖子呈现、`QuotedPost.tsx`、`MediaGallery.tsx`、`MediaThumbs`、`SourceAvatar` 的头像参数。

**其余**

- `providers/money.ts`：`collect.socialdata` 归类与 `quote:<id>` 主体形态；`editorial/models.ts`：翻译 capability 的 `translate_quoted` 用途；`operations/alerts.ts`：SocialData 的服务名；`reports/compose.ts`：`X·官方`/`X·KOL` 角色。
- 测试：`x-article.test.ts`、`x-shards.test.ts` 两个文件；`signals`、`translate`、`collection`、`media-performance` 四个文件里各 1 个 X 专用用例；`analyze` 的一个用例去掉短帖那一半，`sources` 的一个用例去掉 `x_search` 那一行断言。
- 文档与配置：`docs/sources.md`、`customize.md`、`architecture.md` 的 X 信源说明；`.env.example` 的 `SOCIALDATA_API_KEY`；`industry/site.ts` 关于页的一句文案。

## 数据库

迁移 [`0043_drop_x_collection.sql`](../../database/migrations/0043_drop_x_collection.sql)：

| 对象 | 处置 |
|---|---|
| `sources.kind` CHECK | 去掉 `x_search`。已有的 X 信源改为停用的 `external` 信源（`enabled=false`、`health='paused'`、配置与游标清空）——行要留着，因为文章引用它；`external` 信源没有任何抓取 |
| `publications.channel` CHECK | 收窄为 `('news')`；已有的 `x` 行改为 `news`，仍然公开（标题与摘要在 publication 里） |
| `articles.x_post`、`articles.x_article` | 删列 |
| `quote_translations` | 删表 |
| `budgets` 的 `socialdata` 行 | 删除 |
| `settings` 的 `alerts.state` | 去掉 `budget.day.socialdata`、`provider.refused.socialdata` 两个键（若在报警中）。预算行删掉后这两个问题不会再被检查出来，不清的话下一次告警检查会发两条假的「已恢复」（评审第 1 轮 F1，做法同 0042） |
| 原 X 信源的 `icon_checked_at` | 置为迁移时刻。图标任务不再按类型跳过这些行，不置的话它会去 x.com 首页找图标（评审 F3）；30 天后仍会重查一次，属已知残留 |

不可自动回退：删掉的两列就是帖子原文本身。删除前的定义与行数记录在 [`m0-4c-dropped-ddl.sql`](evidence/m0-4c-dropped-ddl.sql)（main `465a3d8` 的全新库：全部为 0 行，`budgets` 的 `socialdata` 行是迁移 0022 预置的）。没有改写任何历史迁移文件。

没有动的库内对象：`service_prices`、`money_budgets`、`money_usage` 里可能存在的 SocialData 行（默认为空；价格与限额是 owner 批准的记录，不由迁移删除）；`receipts` 与 `receipt_attempts` 的历史行；pg-boss 里可能残留的 `sources.fetch-x` 队列（不再有消费者；若里面还有等待中的任务，按 `operations/alerts.ts` 的排队检查，它会每天在系统日报里出现一次「后台任务排队超过 2 小时」，直到 pg-boss 按保留期清掉——这是读代码的推断，保留期未实测；当前没有已部署实例，全新库迁移时还没有 `pgboss` schema，所以没有在迁移里删）。

## 对外行为的变化

- `/api/site/timeline?channel=x`、`/api/site/pool?channel=x` 由 200 变为 400（invalid channel）；页面 `/?channel=x`、`/all?channel=x` 把不认识的频道当作「全部」，仍是 200。
- 站点条目与详情的 JSON 不再有 `x` 字段；`channel` 字段保留，值恒为 `news`。
- 公开 API v1、RSS、MCP 的字段没有变化（它们本来就不输出 `x`）；全文 RSS 里帖子的特殊排版没有了。
- 后台新建信源不再接受 `x_search`。

## 没有动的

- 付费闭锁：`outbound-policy.ts` 未改；`providers/receipts.ts` 只改了文件头一行注释（去掉 SocialData 的名字），`paidRequest` 首行的 `assertPaidOutboundDisabled()` 与其余逻辑未动。三个调用点原样。
- `LICENSE`、`NOTICE`、`vendor-manifests/`。
- 通用的 URL 处理：`lib/url.ts` 仍把 x.com/twitter.com 的帖子链接规范成 `x:<id>` 去重键（别的信源转述同一条帖子时靠它判重）；`content/extract.ts` 仍不去抓 x.com 页面当正文；`apps/web/app/lib/seo.ts` 的 `twitter:card` 元标签是分享卡片的通用写法。
- `industry/prompts/content-understanding.md` 里一句提到「短 X 推文」的文案：属提示词内容，改它会改变模型行为，随保险行业内容替换处理，不在 ADR-002 内。
- Dajiala、Jina、RSS/网页/JSON 采集与 `external` 上报。

## 验证

环境：Node 25、本机 PostgreSQL 18.1 的一次性库；采集与模型开关关闭；未发出任何外部请求。日志中的主机名、本机路径与数据库用户已替换。

| 命令 | 结果 | 日志 |
|---|---|---|
| `npm run typecheck` | exit 0 | [`m0-4c-typecheck.log`](evidence/m0-4c-typecheck.log) |
| `npm run build -w @aihot/web` | exit 0 | 未入库 |
| `node --test apps/web/tests/*.test.ts` | 11/11 | 未入库 |
| `node scripts/migrate.ts`（全新库） | 40 个迁移，含 0043 | [`m0-4c-migrate.log`](evidence/m0-4c-migrate.log) |
| `node scripts/seed.ts`（全量） | 38 个 topic、18 个信源 | [`m0-4c-seed.log`](evidence/m0-4c-seed.log) |
| `node --test tests/removed-modules.test.ts` | 6/6 | [`m0-4c-removed-modules-tests.log`](evidence/m0-4c-removed-modules-tests.log) |
| `bash scripts/test-unlocked.sh` | 149/149（26 个文件，跳过付费闭锁挡住的 11 个用例） | [`m0-4c-unlocked.log`](evidence/m0-4c-unlocked.log) |
| 0043 作用在带 X 数据的旧库上 | 见下 | [`m0-4c-migrate-incremental.log`](evidence/m0-4c-migrate-incremental.log) |
| `node scripts/smoke.ts --base http://127.0.0.1:3000`（本机 API + 已构建的 web）与逐页请求 | all checks passed；见上「对外行为的变化」 | [`m0-4c-smoke.log`](evidence/m0-4c-smoke.log) |

**用例数的变化**（上一步是 151 个、27 个文件、跳过 15 个）：

- `x-shards.test.ts` 删除：6 个用例里 3 个原本在跑 → 少 3 个、少 1 个文件、跳过清单少 3 条。
- `x-article.test.ts` 删除：整个文件原本就在闭锁清单里（清单由 7 个文件变 6 个），不影响在跑的数。
- `collection.test.ts` 的 X 搜索用例删除：原本在跳过清单里 → 跳过清单少 1 条。
- `media-performance.test.ts` 的 `xView` 用例删除：少 1 个。
- `removed-modules.test.ts` 加 2 个用例：多 2 个。
- 合计 151 − 3 − 1 + 2 = 149 个，26 个文件，跳过 15 − 4 = 11 条。

**迁移作用在旧库上**：先用 main 的迁移建库（39 个），写入一个 `x_search` 信源和一个 RSS 信源、各一篇文章（X 那篇带 `x_post` 与 `x_article`）、各一条 publication（`x` 与 `news`）、一条引文翻译，再跑迁移。结果：X 信源变为 `external/停用/paused`、配置与游标清空，RSS 信源原样；两篇文章都在，两列消失；两条 publication 都是 `news` 且仍 `public`；引文翻译表消失；`budgets` 少了 `socialdata`；预置在 `alerts.state` 里的两个 SocialData 键被去掉、Jina 的键保留；原 X 信源的 `icon_checked_at` 已置、RSS 信源没有；两个 CHECK 是收窄后的定义；再跑一次迁移报告 up to date。

**非 X 文章的编辑输入不变（作者对照，不是独立评审）**：同 4 类非 X 材料（有正文、只有摘要加译文、只有标题、external）在 main `465a3d8`（`xPost: null`）与本分支上各跑一遍 `buildMaterial`、`renderContext`、`prefilterUser`、`understandUser`、`buildScoreInput`、`buildArticlePrompt`、`missingEvidence`、`waitsForPage`、`finalizeCopy`，输出逐字节相同；唯一差别是 `TranslateInput` 少了三个帖子专用字段（`mainText`、`quotedText`、`quotedAuthor`，main 上对文章恒为 undefined）。评审第 1 轮独立重做了同类对照（11 个函数，结果一致）。它只覆盖纯函数，不覆盖要调模型的路径。

**测试的区分力**：`removed-modules.test.ts` 新增的库结构用例在 main 的库结构（39 个迁移）上失败，其余 5 个通过；迁到 0043 后全部通过。`channel=x` 返回 400 的断言对应 contracts 里 `CHANNEL_KEYS` 的改动（main 上该请求是 200）。

**worker**：本机启动后正常报告 started 并可正常停止。

残留搜索：`grep -rn -i "x_post\|xPost\|x_search\|x_article\|quote_translation\|socialdata\|tweet\|twitter\|translate_quoted\|引用帖\|推特" apps packages scripts industry tests reference .env.example`（排除构建产物）只剩上文「没有动的」列出的三处通用 URL/元标签代码，以及 `removed-modules.test.ts` 自身。这个正则不覆盖「X account / X posts」这类写法：评审第 1 轮据此找到 `content/sanitize.ts` 里已无调用方的 `textToHtml` 和两处过期注释（`sources/icons.ts`、`contracts/src/site.ts`），已删除或改正。

## 未运行

- **被付费闭锁挡住的测试**：本 PR 改了 `analyze.test.ts`、`signals.test.ts`、`translate.test.ts`、`translate-shutdown.test.ts`、`collection.test.ts` 里的用例（删掉 X 专用的，改了一个用例名与一处期望值）。这些用例在闭锁清单里，运行不了，只过了 typecheck；它们改后是否仍与实现一致，要到闭锁解除（M0.3b 之后）才能实测。对应的实现改动（摘要只剩文章提示词、翻译只剩正文分支、归组去掉引用路径）因此没有运行时证据，只有类型检查与代码审阅。
- `tests/paid-wiring.test.ts` 的超限用例由 SocialData 改写为 Jina 后，原用例里「每个端点有自己的价格行，缺行即 `missing_price`」这条断言随 SocialData 一起没有了，没有为 Jina 补等价断言（评审 F6，记录在案）。
- Docker 镜像内的构建与冒烟（本机无 Docker；M0.5 #13）。
- 登录后台后的页面（新建信源表单、运行页）：未创建管理员账号，只做了 typecheck 与构建；后台新建 `x_search` 被拒由测试直接调 `createSource` 验证。
- `scripts/eval-selection.ts` 改了两行（不再把 `x_search` 的金标用例当帖子）：脚本不在 typecheck 范围内，也需要模型调用，未运行。
- 从一个真的采过 X 的库升级：没有这样的库；用上面「旧库带行」的实验代替。

## 回退

`git revert` 本 PR 的合并提交恢复代码、提示词与测试；数据库需按 [`m0-4c-dropped-ddl.sql`](evidence/m0-4c-dropped-ddl.sql) 恢复两列、一张表与两个 CHECK，并从 `schema_migrations` 移除 0043 的记录（或新增一个恢复迁移）。被改成 `external` 的 X 信源与被改成 `news` 的 publication 无法自动区分回去；帖子原文（`x_post`）无法恢复。
