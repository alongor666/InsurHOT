# ADR-003：公开品牌从 AIHOT 改为 InsurHOT，许可与来源记录保留原名

状态：Accepted（owner 于 2026-10-01 经结构化提问批准五步全做，记录见 Issue #15；原稿 2026-09-30 由 Claude 会话起草。按 `docs/phase0/delivery-gates.md` §5，可逆改名属 Codex 技术裁决；正式品牌对外使用前的核准属 owner 与法律角色，本 ADR 不替代该核准）。Refs #4、#12；主规格 §ADR-003 要求"`@insurhot/*`；检查脚本禁止对外出现 AIHOT"；上游许可见 `LICENSE`、`NOTICE`、`UPSTREAM.md`。

## 背景：痕迹分类（main `f08fe132`；排除 `apps/web/build`、`.react-router`、`node_modules`）

| 类别 | 数量与计数命令 | 例子 | 可见性 |
|---|---|---|---|
| A. workspace 包名与导入 | 7 个 package.json（根 `aihot` + 6 个 `@aihot/*`）；185 个文件含 `@aihot/`：`grep -rl "@aihot/" apps packages scripts tests industry \| grep -vE "/build/\|\.react-router" \| wc -l` | `@aihot/backend`、`@aihot/web` | 仅代码内 |
| B. 环境变量前缀 `AIHOT_` | 6 个：`AIHOT_DATA_DIR`、`AIHOT_CREDENTIALS_DIR`、`AIHOT_MODELS`、`AIHOT_RELEASE`、`AIHOT_ENVIRONMENT`、`AIHOT_CHANGELOG_FILE` | — | 部署配置 |
| C. 读者/外部可见标识 | 34 个源文件含品牌字面量（除导入与环境变量行外）：`grep -rniE aihot apps packages industry \| grep -vE "/build/\|\.react-router" \| grep -vE "@aihot/\|AIHOT_" \| cut -d: -f1 \| sort -u \| wc -l`；其中哪些读者可见需逐文件人工判定；+ 下列专项 | publication 下 feeds/v1/llms/items/stories 的 generator/命名空间；`reference/public-v1.openapi.json`（18 处）；`industry/changelog.json` 正文；`industry/site.ts:31` `footerNote: "由 AIHOT 开源框架驱动"`；`PosterSheet.tsx` 下载文件名 `aihot-<id>.png`；`markdown.ts:13-14` 硬编码域名 `aihot.news`；`admin/auth.ts:10-11` cookie `aihot_admin`/`aihot_oauth_state`；web `local-state.ts`/`starred.tsx`/`restore.ts` 的 localStorage 键；`app.css` 动画类名；`media.ts` `aihot-img-proxy-auth`；`mcp.ts` 与 `scripts/mcp-check.ts` 的 `aihot_*` 工具名（与 `site.ts` 的 `mcpPrefix: "myhot"` 已不一致） | 公开出口、浏览器、下载文件 |
| D. 站点身份 | `industry/site.ts`（`name: "MyHOT"`、`subject: "AI"`、`homeTitle`、`description`、`tagline`、`mcpPrefix`、`footerNote`）、`industry/brand/*`（logo、icon）、`assets/og-fonts` | — | 全部对外 |
| E. 运维可见标识 | 请求头 `x-aihot-ssr`（`api.server.ts:21`）；pg-boss `application_name: "aihot-jobs"`（`jobs/queue.ts:48`）；备份文件名 `aihot-<stamp>.dump`/`aihot-files-<stamp>.tar.gz` 与清理匹配前缀 `"aihot-2"`/`"aihot-files-"`（`operations/backup.ts:84-119`）；`docker-compose.yml` 服务/镜像/库名 `aihot`；`.env.example` | 部署与运维 |
| F. 数据键与外部约定 | 两处：(1) `sources.config` jsonb 中的 `_aihot` 键（`sources/config-keys.ts:7,21,28`、`sources/collect.ts:130-131`、`industry/sources.json` 18 处）；(2) 外部采集/推送方提交条目时的 `raw._aihot.{backfill,baseline}` 约定（`ingest/items.ts:24,55`，随 `raw` 存入 `articles.raw`；`docs/sources.md:97` 与主规格 F-13 均以 `raw._aihot` 命名） | — | 存量数据 + 对外接口约定 |
| G. 许可与来源记录（保留原名） | `LICENSE`、`NOTICE`、`assets/*/NOTICE.md`、`assets/og-fonts/LICENSE`、`vendor-manifests/aihot*.json`、`scripts/stage_upstream.py`、`scripts/verify_upstream_import.py`、`.github/workflows/bootstrap.yml:25`（断言上游仓库名）、`UPSTREAM.md`、`docs/upstream/*`、`docs/adr/001-*`、`docs/phase0/*`（含 `aihot-audit.md`、研究附录）、`docs/development/m0-*`、上游随附文档 `docs/customize.md`/`leaderboard.md`/`selection.md`/`sources.md`/`architecture.md`/`deploy.md`、`tests/setup.ts` 对上游模型预设的注释 | — | 来源归属，不是品牌 |

> 2026-10-01 owner 输入（Issue #15）：站名 `InsurHOT`，副标题「保险行业高价值变化与趋势情报」，subject「保险」；页脚的 AIHOT 致谢**移除**，致谢只放「关于」页与 NOTICE；`raw._aihot` 改为 `_insurhot`（现无外部接入者）。对外正式使用品牌仍等 G2 的法律核准。第 1 步的实施见 `docs/development/m0-4d-brand-step1-evidence.md`。

## 决定（建议）

按可见性从外到内分四个 PR，每个独立回退：

1. **站点身份与公开出口**（C、D 中对外部分，先做）：`industry/site.ts` 改为 InsurHOT 的 name/subject/homeTitle/description/tagline/`mcpPrefix`（文案由 owner 给定，缺省用 README 的中英一句话）；`footerNote` 的"由 AIHOT 开源框架驱动"**需 owner 决定保留（致谢）或移除**——主规格要求"禁止对外出现 AIHOT"，若保留须作为许可致谢明示例外；替换 `industry/brand/*` 与 OG 字体来源记录；publication 输出（RSS generator、v1 API 命名空间、`public-v1.openapi.json`、llms.txt、MCP 工具名与 `mcp-check.ts`）、`changelog.json` 正文、下载文件名、`markdown.ts` 域名、admin cookie 名改为 `insurhot`。**MCP 工具前缀与 v1 命名空间在有外部接入前一次改定，之后不再改。** 上游品牌素材在替换完成前不得对外发布。
2. **浏览器持久键与运维标识**（C 中 localStorage/CSS、E）：localStorage 键与 CSS 类名改前缀（当前无线上用户，不做旧键迁移；上线前未完成则补读旧键一次）；`x-aihot-ssr` 头、pg-boss `application_name`、compose 服务/镜像/库名改名；备份文件名改前缀的同时，清理逻辑须**同时匹配新旧前缀**，否则旧备份永不清理。
3. **数据键与外部约定**（F）：`sources.config._aihot` → `_insurhot` 需迁移 jsonb（新迁移重命名键 + 代码同步），`industry/sources.json` seed 与 `config-keys.ts` 白名单同一提交改完（其中 `x_search` 条目随 ADR-002 删除）；`raw._aihot` 是对外采集约定，改名须同时兼容新旧键读取一段时间、迁移 `articles.raw` 存量、并同步 `docs/sources.md`——是否改这个对外键名由 owner 决定（不改则记入 G 类白名单并注明理由）。
4. **代码内标识**（A、B）：`@aihot/*` → `@insurhot/*`（7 个 package.json + 185 个导入，机械替换 + typecheck，`package-lock.json` workspace 条目随之变化并在 PR 单列），`AIHOT_*` → `INSURHOT_*`（6 个变量，`.env.example`/compose/文档同步，不留旧名回退读取——当前无部署）。
5. **检查脚本**（主规格要求）：新增 `scripts/check-brand.sh`，对 A–F 类路径全仓 `grep -i aihot`，仅允许 G 类白名单文件命中；接入应用 CI（#10）。M0.4 完成时把白名单固化到证据文档。

不改：G 类文件。

## 备选方案

- **A. 全仓字符串替换一次到位**：最快，但会改写 LICENSE/NOTICE/来源清单中的原名，违反 AGENTS.md"许可文本保留原名"与 ADR-001 的来源固定；且一次改 200+ 文件难以评审。不采纳。
- **B. 只改站点身份，代码内保留 `@aihot`**：对外足够，但 `AIHOT_*` 环境变量、compose 库名、备份文件名会长期出现在运维口径里，两套名字。部分采纳其"先外后内"的顺序，但不停在第一步。
- **C. 等法律核准品牌名后再动**：InsurHOT 名称已在 ADR-023 由 owner 确认使命与品牌；法律核准是对外正式使用的门（G2），不阻塞仓内改名。改名本身可逆。不采纳等待。

## 后果

- ADR-002 完成后再做，减少改名面（leaderboard/monitor 相关文件不需改名）。
- 第 1 步需要 owner 输入：站名展示形式、subject（"保险"）、一句话描述、`footerNote` 去留。
- 第 3 步是唯一涉及数据迁移的步骤；第 2 步的备份清理兼容需在改名 PR 内附测试。

## 回退

每步独立 revert。第 1 步涉及公开出口命名空间（MCP 前缀、v1、OpenAPI），有外部接入后不再回退，因此在有接入前完成。第 3 步的 jsonb 键迁移需配反向迁移或在临时 PG 验证后执行。
