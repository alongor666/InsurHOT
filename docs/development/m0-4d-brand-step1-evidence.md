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
| 品牌素材 `industry/brand/` | 新的标志（深色圆角方块上一条上行折线，末端一个亮点）：`logo.svg` 与由它生成的 `icon.png`、`icon-192.png`、`apple-icon.png`、`favicon.ico`；报头字 `nameplates/*` 用 `scripts/nameplates.ts` 按新的行业词「保险」重新生成（Noto Sans SC Black，SIL OFL 1.1）。上游的图标不再出现在任何输出里 |
| `industry/changelog.json` | 首条记录的「用 AIHOT 开源框架搭起了这个站」改为「基于开源框架搭起了这个站（致谢见「关于」页）」 |
| `apps/web/app/lib/markdown.ts` | 去掉写死的上游域名；带协议的链接一律按外站处理，本站页面用相对链接 |

不改：许可与来源记录类文件（`LICENSE`、`NOTICE`、`vendor-manifests/`、`docs/upstream/`、`UPSTREAM.md` 等）。ADR 第 2–5 步的内容（localStorage 键与 CSS 类名、`x-aihot-ssr`/图片代理请求头、pg-boss `application_name`、compose 名、备份文件名、`_aihot` 数据键、`@aihot/*` 包名、`AIHOT_*` 环境变量、检查脚本）留在后续 PR。

## 验证（本机，全新一次性库，42 个迁移）

- `npm run typecheck`：通过（[日志](evidence/m0-4d-brand-step1-typecheck.log)）。
- `npm run build -w @aihot/web`：通过；web 测试 11/11。
- `bash scripts/test-unlocked.sh`：29 个文件，186/186（[日志](evidence/m0-4d-brand-step1-unlocked.log)）。两个后台 API 用例原来写死 `aihot_admin` cookie，改为读 `SESSION_COOKIE` 常量。
- 构建后站点 smoke：all checks passed（[日志](evidence/m0-4d-brand-step1-smoke.log)）。
- 公开出口的品牌字面量（[记录](evidence/m0-4d-brand-step1-public.log)）：首页、关于、agent、隐私、条款、热点、日报页面里只剩 localStorage 键 `aihot-theme`（第 2 步的范围）和关于页的致谢正文；`llms.txt`、两个 RSS、OpenAPI、manifest、`/api/v1/items` 没有任何 `aihot`/`myhot`；MCP 工具列表是 `insurhot_get_latest`、`insurhot_search`、`insurhot_get_hot_topics`、`insurhot_get_story`、`insurhot_get_daily`；页面标题「InsurHOT — 保险行业高价值变化与趋势情报」；页脚没有「开源框架」字样。
- 图标：`icon-192.png` 打开查看过一次（深色方块、白色折线、青色圆点）。

## 未运行 / 未覆盖

- 分享图（OG 图片）与海报的视觉效果没有逐张看，只知道生成不报错（smoke 里的 `/og/site.png` 通过）。
- 新标志是实施会话画的占位图形，不是设计稿；owner 可随时替换 `industry/brand/logo.svg` 并重新生成图标。
- MCP 工具名与 v1 字段名按 ADR「有外部接入前一次改定」处理；目前没有外部接入者，改完之后不再改。
- Docker smoke 与 CI：看本 PR。
- `raw._aihot` 键名（第 3 步）、`sources.config._aihot`（第 3 步）未动。

## 回退

`git revert` 合并提交。不涉及数据库。
