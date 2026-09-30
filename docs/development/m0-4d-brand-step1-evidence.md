# M0.4 品牌清理第 1 步：站点身份与公开出口

所属任务：#12（父台账 #3、#4），[ADR-003](../adr/003-brand-cleanup.md) 第 1 步。owner 输入（2026-10-01，#15）：站名 `InsurHOT`，副标题「保险行业高价值变化与趋势情报」，subject「保险」，页脚致谢移除、致谢只放「关于」页与 NOTICE。

## 改了什么

| 面 | 改动 |
|---|---|
| 站点身份 `industry/site.ts` | `name`、`subject`、`homeTitle`、`description`、`tagline`、`organization.name`、`crawlerName`、`mcpPrefix`（`myhot` → `insurhot`）；`footerNote` 置空；关于页文案改为保险行业；新增 `acknowledgement`（开源致谢，关于页底部渲染） |
| 公开 JSON 字段 | `links.aihot` → `links.insurhot`：站点 JSON、公开 API v1、报告、事件、MCP 文本、`llms.txt` 说明、`reference/public-v1.openapi.json`（18 处） |
| MCP | 工具名随 `mcpPrefix` 变为 `insurhot_*`；`scripts/mcp-check.ts` 不再写死 `aihot_*`，示例查询改为「保险」 |
| 下载文件名 | Markdown 导出 `insurhot-<id>.md`、海报 `insurhot-<id>.png`、本地数据 `insurhot-local-data-<日期>.json` |
| 后台 cookie | `insurhot_admin`、`insurhot_oauth_state`（当前无部署，无旧会话需迁移） |
| 品牌素材 `industry/brand/` | 新的标志（深蓝圆角方块上一条浅色上行折线，末端一个琥珀色圆点；底色与强调色都不沿用上游的深灰与青色）：`logo.svg` 与由它生成的 `icon.png`、`icon-192.png`、`apple-icon.png`、`favicon.ico`；报头字 `nameplates/*` 用 `scripts/nameplates.ts` 按新的行业词「保险」重新生成（Noto Sans SC Black，SIL OFL 1.1）。上游的图标不再出现在任何输出里 |
| `industry/changelog.json` | 首条记录的「用 AIHOT 开源框架搭起了这个站」改为「基于开源框架搭起了这个站（致谢见「关于」页）」 |
| `apps/web/app/lib/markdown.ts` | 去掉写死的上游域名；带协议的链接一律按外站处理，本站页面用相对链接 |
| 写死的旧行业词 | 日报/周报/月报页标题与空状态（`report-latest.tsx`）、往期报告标题（`ReportPaper.tsx`）、热点榜的描述与正文（`hot.tsx`）原来写死「AI 日报」「AI 圈」，改为经 `withSubject()` / `SITE.subject` 生成（评审第 1 轮 P1） |

不改：许可与来源记录类文件（`LICENSE`、`NOTICE`、`vendor-manifests/`、`docs/upstream/`、`UPSTREAM.md` 等）。ADR 第 2–5 步的内容（localStorage 键与 CSS 类名、`x-aihot-ssr`/图片代理请求头、pg-boss `application_name`、compose 名、备份文件名、`_aihot` 数据键、`@aihot/*` 包名、`AIHOT_*` 环境变量、检查脚本）留在后续 PR。

## 验证（本机，全新一次性库，42 个迁移）

- `npm run typecheck`：通过（[日志](evidence/m0-4d-brand-step1-typecheck.log)）。
- `npm run build -w @aihot/web`：通过；web 测试 11/11。
- `bash scripts/test-unlocked.sh`：29 个文件，186/186（[日志](evidence/m0-4d-brand-step1-unlocked.log)）。两个后台 API 用例原来写死 `aihot_admin` cookie，改为读 `SESSION_COOKIE` 常量。
- 构建后站点 smoke：all checks passed（[日志](evidence/m0-4d-brand-step1-smoke.log)）。
- 公开出口的品牌字面量（[记录](evidence/m0-4d-brand-step1-public.log)，搜索口径 `myhot|aihot[a-z_.-]*|AI (日报|周报|月报|圈|动态|行业)`，即旧品牌名**和旧行业词**）：21 个公开路径里，页面只剩 localStorage 键 `aihot-theme`（第 2 步的范围，#33）；`/topics` 的 6 处「AI 动态」「AI 行业」来自 `industry/topics.json` 的示范主题内容，属于保险行业内容替换（不在 ADR-003 内，范围待 owner 确认），不是页面文案；`llms.txt`、两个 RSS、OpenAPI、manifest、robots、sitemap、`/api/v1/items`、`/api/site/timeline` 没有任何命中；日报/周报/月报/热点榜标题分别是「保险日报 · InsurHOT」等；MCP 工具列表是 `insurhot_get_latest`、`insurhot_search`、`insurhot_get_hot_topics`、`insurhot_get_story`、`insurhot_get_daily`；页脚没有「开源框架」字样。第 1 轮评审前的记录只搜了旧品牌名，漏掉了写死的「AI 日报」「AI 圈」，评审指出后已改。
- 图标：`icon-192.png` 打开查看过一次。评审指出第一版沿用了上游标志的底板尺寸与配色（深灰 `#13191c`、青 `#2ce2e8`），现改为深蓝底 `#12304a`、浅色折线、琥珀色圆点 `#f5b301`；圆角方块这一底板形状本身是通用图标形制。

## 未运行 / 未覆盖

- 分享图（OG 图片）与海报的视觉效果没有逐张看，只知道生成不报错（smoke 里的 `/og/site.png` 通过）。
- 新标志是实施会话画的占位图形，不是设计稿；owner 可随时替换 `industry/brand/logo.svg` 并重新生成图标。是否与上游标志构成近似，交 G2 法律核准时一并看。
- 关于页致谢里「不在本站的对外品牌中使用」：在第 2 步（#33）合入前，页面 HTML 里仍有 localStorage 键 `aihot-theme`，开发者工具里还能看到 `x-aihot-*` 请求头与 `aihot-*` 动画名；第 2 步合入后消失。
- **已写入的公开 API 账本**（`selected_ledger.payload` 是写入时持久化的 JSON）里存的是旧字段名 `links.aihot`；`/api/v1/selected/*` 的 minimal 模式会读不到、default 模式会原样返回旧名。当前没有部署；任何已有账本的库（如某人的开发库）在合入后需要重建账本或升 `selected_ledger_epoch`。
- MCP 工具名与 v1 字段名按 ADR「有外部接入前一次改定」处理；目前没有外部接入者，改完之后不再改。
- Docker smoke 与 CI：看本 PR。
- `raw._aihot` 键名（第 3 步）、`sources.config._aihot`（第 3 步）未动。

## 评审第 1 轮后的修改

独立评审（Opus 5.5 只读，绑定 `8fa576c`）结论 REQUEST_CHANGES：P1 写死的旧行业词（已改，见上表最后一行）；P2 证据文档把没清干净的写成清干净（已改写并放宽搜索口径）；P2 新标志沿用上游底板与配色（已换配色，并记入未覆盖交法务）；P3 账本旧字段名（记入未覆盖）；P3 致谢措辞（已改为「不在本站的对外品牌中使用」）。

## 回退

`git revert` 合并提交。不涉及数据库。
