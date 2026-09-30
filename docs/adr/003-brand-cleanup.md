# ADR-003：公开品牌从 AIHOT 改为 InsurHOT，许可与来源记录保留原名

状态：Proposed（2026-09-30，Claude 会话起草。按 `docs/phase0/delivery-gates.md` §5，可逆改名属 Codex 技术裁决；正式品牌对外使用前的核准属 owner 与法律角色，本 ADR 不替代该核准）。Refs #4、#12；上游许可见 `LICENSE`、`NOTICE`、`UPSTREAM.md`。

## 背景

上游 AIHOT 在 main `f08fe132` 中的品牌痕迹分四类（不含 `apps/web/build` 构建产物与 `.react-router` typegen）：

| 类别 | 数量 | 例子 | 可见性 |
|---|---|---|---|
| workspace 包名与导入 `@aihot/*` | 7 个 package 名，185 个文件导入 | `@aihot/backend`、`@aihot/web` | 仅代码内 |
| 环境变量前缀 `AIHOT_` | 6 个变量 | `AIHOT_DATA_DIR`、`AIHOT_CREDENTIALS_DIR`、`AIHOT_MODELS`、`AIHOT_RELEASE`、`AIHOT_ENVIRONMENT`、`AIHOT_CHANGELOG_FILE` | 部署配置 |
| 读者/客户端可见标识 | 约 25 个文件 | `packages/contracts/src/site.ts`、publication 下 feeds/v1/llms/items/stories 的 generator/命名空间、web `local-state.ts` 的 localStorage 键（`aihot-read-items` 等）、`app.css` 动画类名、`media.ts` 的 `aihot-img-proxy-auth`、`mcp.ts`、`docker-compose.yml` 服务名/镜像名/数据库名 `aihot` | 公开出口、浏览器、部署 |
| 站点身份 | `industry/site.ts`（`name: "MyHOT"`、`subject: "AI"`、`homeTitle`、`description`、`tagline`、MCP 工具前缀）、`industry/brand/*`（logo、icon）、`assets/og-fonts` | 全部对外 |

许可相关：`LICENSE`（MIT）、`NOTICE`、`assets/*/NOTICE.md`、`assets/og-fonts/LICENSE`、`vendor-manifests/aihot*.json`、`scripts/stage_upstream.py`、`scripts/verify_upstream_import.py`、`UPSTREAM.md`、`docs/upstream/*`、`docs/adr/001-*`——这些文件中的 AIHOT 是来源归属与许可条款，不是品牌。

## 决定（建议）

按可见性从外到内分三个 PR，每个独立回退：

1. **站点身份与公开出口**（对外可见，先做）：`industry/site.ts` 改为 InsurHOT 的 name/subject/homeTitle/description/tagline/MCP 前缀（文案由 owner 给定，缺省用 README 的中英一句话）；替换 `industry/brand/*` 与 OG 字体来源记录；publication 输出（RSS generator、v1 API 命名空间、llms.txt、MCP 工具名）与 `docker-compose.yml` 的服务/镜像/库名改为 `insurhot`。**MCP 工具前缀与 v1 命名空间在有外部接入前一次改定，之后不再改。** 上游品牌素材在替换完成前不得对外发布（行动计划既有约束）。
2. **浏览器与客户端持久键**：`local-state.ts`、`starred.tsx`、`restore.ts` 等 localStorage 键与 CSS 类名改前缀。当前无线上用户，不做旧键迁移；若上线前改名未完成，则需补读旧键一次。
3. **代码内标识**：`@aihot/*` → `@insurhot/*`（7 个 package.json + 185 个导入，机械替换 + typecheck），`AIHOT_*` → `INSURHOT_*`（6 个变量，`.env.example`/compose/文档同步，不留旧名回退读取——当前无部署）。

不改：许可与来源记录类文件（上表"许可相关"），`docs/upstream/*` 归档原文，`vendor-manifests`，ADR-001，测试中作为上游行为描述的 AIHOT 字样（如 `tests/setup.ts` 对上游模型预设的注释）。全仓 `grep -i aihot` 的预期残留即这些文件，M0.4 完成时把残留清单固化到证据文档。

## 备选方案

- **A. 全仓字符串替换一次到位**：最快，但会改写 LICENSE/NOTICE/来源清单中的原名，违反 AGENTS.md"许可文本保留原名"与 ADR-001 的来源固定；且一次改 200+ 文件难以评审。不采纳。
- **B. 只改站点身份，代码内保留 `@aihot`**：对外足够，但 `AIHOT_*` 环境变量与 compose 库名会出现在部署文档与运维口径里，长期两套名字；且 `docker-compose.yml` 的 `aihot` 数据库名是运维可见的。部分采纳其"先外后内"的顺序，但不停在第一步。
- **C. 等法律核准品牌名后再动**：InsurHOT 名称已在 ADR-023 由 owner 确认使命与品牌；法律核准是对外正式使用的门（G2），不阻塞仓内改名。改名本身可逆。不采纳等待。

## 后果

- ADR-002 完成后再做，减少改名面（leaderboard/monitor 相关文件不需改名）。
- 第 1 步文案需要 owner 输入：站名展示形式（"InsurHOT" / "InsurHOT 保险情报"）、subject（"保险"）、一句话描述。缺省值见 README。
- 第 3 步改 package 名后 `package-lock.json` 的 workspace 条目会变，属预期变更，需在 PR 中单列。

## 回退

每步独立 revert。第 1 步涉及公开出口命名空间（MCP 前缀、v1），有外部接入后不再回退，因此在有接入前完成。
