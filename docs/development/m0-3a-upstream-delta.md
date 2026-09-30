# M0.3a 上游受控差异台账

基线：PR #6 `b9183a226e97e0f332d12c82ce96b8f11b2bc2c0`，原始489 blob/mode映射保留不变。以下15项是本PR有意安全修改；逐项 `git hash-object -- <destination>` 比对原始映射并以 `git ls-files -s` 验证模式。其余474项 blob和模式保持原样；所有489模式均不变。本台账不是对已修改树执行原样导入校验器。

| 路径 | 原始 blob | M0.3a blob |
|---|---|---|
| `.env.example` | `3fb8553f529a5dd8371d396ce628a6db4ed7db82` | `4f34d926cc7748e217a26de7e689d6ae511e5676` |
| `apps/worker/src/main.ts` | `e10a1773c45519f999a8dc3a904e8c7fb81bd5cd` | `7a90e62b7a9652263812a09189cd2677b6a3a8f7` |
| `apps/worker/src/schedules.ts` | `abbfac241fb5a0c2c384cd5552f47831e3a7be09` | `e195f9ad856c4fe2761a3d79c4b59e3145b5fd5d` |
| `packages/backend/src/admin/auth.ts` | `e7f8e420b0f2909b03174e87c7004fb60f1b8dd0` | `db85d7605764df698956e9ab382de5e912456049` |
| `packages/backend/src/config.ts` | `07c89ec76e6682cfe9d3bef847821cdf35d91c22` | `52a55f43c9be1c39a331b96145d2820e70bbb858` |
| `packages/backend/src/leaderboard/fetch/sources/artificial-analysis.ts` | `7979ac11bf9368406b02bf94264393c8536a22de` | `fa556864fbda9e35d086ac4171208a984ebe31d0` |
| `packages/backend/src/lib/http-fetch.ts` | `58a9ed8e8ea066b7c96f3959f174e54915724669` | `0fa73ed1a74664764eb732e35883f54f10cac693` |
| `packages/backend/src/media/prepare.ts` | `a7d017d89c70b6317e664a2d5d7de718bc8b770b` | `fa77338c7f3fc8726b051631d00b8e513f17e4bb` |
| `packages/backend/src/notify/feishu.ts` | `898639b8535171f43f0eef703d6c59d01ac4ccea` | `2c263e087ba63d5a2c42c0f39168336f12baf5a6` |
| `packages/backend/src/operations/alerts.ts` | `9e6bcb0fea4aff090192a91214fb2961154238f7` | `6a0831dbe588312830d643d8bc211675e8460c5a` |
| `packages/backend/src/operations/backup.ts` | `bc53352261446cad7e471fc31879e95f1fa06a08` | `166c6f85656140f7eb5fdd4d60ca611ef38df89b` |
| `packages/backend/src/operations/indexnow.ts` | `bb8e2f6fd721ffe1fdd03e9332c9d15795b83a37` | `5716c8de0774ce2fc9947b13c6d469e2468bad60` |
| `packages/backend/src/providers/embeddings.ts` | `f2387704c91ab62c45f292d7eda885290986fd6f` | `55aa884e9ac49b347a5e5bce854a560c02f3700e` |
| `packages/backend/src/providers/llm.ts` | `748569c8eae0b504a86ddd6b4b63d4315034e643` | `e7283eb699ff218b7148152d738400ae15f34c1f` |
| `packages/backend/src/providers/receipts.ts` | `64048742788f105f65ae6ffe5b64f63c08054558` | `64fb34b67d7702f2b693342baf0f55498c5f4049` |

新增 `packages/backend/src/outbound-policy.ts`、`tests/outbound-policy.test.ts` 与本轮治理文档不属于原始489。LICENSE、NOTICE、第三方许可及manifest未改。代码固定本地提交 `147fa9c`；本PR完整受控差异用 `git diff b9183a226e97e0f332d12c82ce96b8f11b2bc2c0..HEAD --stat` 查看；最终评审SHA在PR/协调器记录。
