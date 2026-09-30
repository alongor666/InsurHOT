# M0.2 本地整合证据

2026-09-30；状态：integrated-pending-review（本记录为 M0.2 评审时的历史快照，不再更新；M0.2/M0.3a 合入 main 后 `aihot-import-map.json` 的 status 已改为 integrated，见 PR #18）。本记录对应包含它的提交，远程应用导入提交为 `8f5244905f076a9e8b31d79c7cc724c1639c68c3`，其树 `c0c2b667f69a12054cb9f45d66df69fe2654c0d6` 与本地验证的导入提交 `1b779ae53aeab383a73d21f9ef2f9513d82d6837` 相同；独立评审绑定最终提交，不把本作者自检作为独立通过。

## 范围

固定上游 `KKKKhazix/AIHOT@589f79eff09470b31ba8a7f1d9eb62d36ff2be6c` 的489个blob全部按[映射](../../vendor-manifests/aihot-import-map.json)整合：484项原路径，5项治理/启动/工作流文件归档。保留根README、AGENTS与Phase0；许可证、NOTICE、第三方许可、二进制及文件模式逐项不变。未修改package.json或package-lock.json；上游应用工作流归档，M0.5再编写本仓完整CI。

新增离线校验器对完整映射、每项Git blob摘要和0644/0755模式进行验证，拒绝缺失/修改、错误映射及目标或父目录symlink。4项新增测试与7项已有导入测试共11项。

## 环境与执行

工作目录：InsurHOT仓库根目录；Node `v24.19.0`，npm `11.9.0`。安装采用 `npm ci --ignore-scripts --no-audit --no-fund`；先前安装日志为“added 296 packages in 13s”，该次未记录退出码，不单独把此摘要算作退出码证据。下列typecheck/build在既有安装上重新执行，并单独捕获退出码。

运行前核查根及工作区package scripts、TypeScript配置、`apps/web/vite.config.ts`与`react-router.config.ts`：typecheck执行编译检查及路由类型生成；build生成客户端/SSR包，未配置prerender或buildEnd。Vite的API代理属于开发服务器hook；本轮没有启动开发服务器或调用路由loader。

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_*upstream*.py' -v
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_upstream_import.py

env -u DATABASE_URL -u OPENAI_API_KEY -u ANTHROPIC_API_KEY \
  MODEL_CALLS_ENABLED=false COLLECT_ENABLED=false PUSH_ENABLED=false INDEXNOW_ENABLED=false \
  API_BASE_URL=http://127.0.0.1:3001 npm run typecheck

env -u DATABASE_URL -u OPENAI_API_KEY -u ANTHROPIC_API_KEY \
  MODEL_CALLS_ENABLED=false COLLECT_ENABLED=false PUSH_ENABLED=false INDEXNOW_ENABLED=false \
  API_BASE_URL=http://127.0.0.1:3001 npm run build -w @aihot/web
```

每个npm命令将stdout/stderr重定向到日志；随后立即执行 `result=$?`，把 `EXIT_CODE=$result` 追加到同一日志，并以该状态退出。上述环境参数是本次静态验证的约束，不能证明上游已实现对应运行时开关。

| 验证 | 实际结果/日志摘要 | 退出码 |
|---|---|---|
| Python离线工具测试 | `Ran 11 tests ... OK`，全部使用本地临时文件/Git仓库 | 0 |
| 导入完整性 | `Verified 489 imported blobs/modes at 589f79eff09470b31ba8a7f1d9eb62d36ff2be6c, including archived files and licenses.` | 0 |
| npm run typecheck | 5个tsc项目及web的`react-router typegen && tsc -p .`完成；日志尾`EXIT_CODE=0` | 0 |
| npm run build -w @aihot/web | 客户端和SSR构建完成；生成`build/server/index.js`；日志尾`EXIT_CODE=0` | 0 |

npm日志存在继承环境的`Unknown env config "http-proxy"`警告；未调整npm配置。完整本地日志位于本次工作区的`m02-typecheck.log`与`m02-web-build.log`，本表保留必要输出及退出码。

## 未运行及后续门槛

- NOT RUN：web应用测试、backend应用测试、PostgreSQL临时库迁移/seed、Docker smoke、完整应用CI。当前环境无PG/Docker；不得把编译通过当作这些验收通过。
- NOT RUN：API/worker/dev/start、真实采集、付费模型、推送、生产部署。
- M0.3：MODEL_CALLS_ENABLED缺省true、采集缺省开启、缺预算行放行等风险仍保留在原始快照中，必须修复所有调用入口并用本地假服务验证。
- M0.4：品牌与可选模块尚未清理，上游品牌素材只用于内部来源保存，不公开发布。
- M0.5：完整应用CI及固定最终HEAD独立验收仍待完成。

交付的是可编译的原始工程快照，尚无运行时安全验收或生产可用结论。远程完整回退按逆序revert最终文档/验证器提交、应用导入提交 `8f5244905f076a9e8b31d79c7cc724c1639c68c3`，最后revert先前归档起始提交 `c8ea05c26ecaa49b31104594b0c3ee48273f0018`；保留已验收Phase0及M0.1工具。

## M0.2 固定HEAD评审及M0.3a后续状态

PR #6 固定远程HEAD `b9183a226e97e0f332d12c82ce96b8f11b2bc2c0` 已由非修改作者完成独立评审；仍保持Draft、未合并。本记录上方的原样验证结果仅对应M0.2快照。后续安全修改在stacked PR #7进行，原始489清单/映射不变，以[M0.3a证据](m0-3a-evidence.md)及[受控blob差异](m0-3a-upstream-delta.md)记录，不把原样校验器用于补丁后的树并假称通过。M0.3b金额预算、M0.4与M0.5尚未完成。
