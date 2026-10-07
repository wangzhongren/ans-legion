# Section 1: 同固定Tester的必要Node测试隔离范围

仅legion-node-fixture-compat-v1；GUI原卡和e72不变。task_ops缩小以下范围。

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 文件 | `tests/integration/test_permission_flow.mjs` | 原owner现有integration仅受控role tmp路径适配，全部行为断言保留 |
| 文件 | `tests/integration/test_generic_agents.mjs` | 原owner现有integration仅受控role tmp路径适配，全部行为断言保留 |
| 条件生成目录 | `.ans/runtime/legion-node-fixture-compat-v1/Tester/packaging/` | 仅Tester本任务受控完整回归生成 |
| 条件生成目录 | `.ans/runtime/legion-node-fixture-compat-v1/Tester/npm-cache/` | 仅Tester本任务受控完整回归生成 |
| 条件生成目录 | `.ans/runtime/legion-node-fixture-compat-v1/Tester/tmp/` | 仅Tester本任务受控完整回归生成 |

LEGION_NODE_TEST_ROLE固定Tester；caller TMP/TEMP/npm cache固定本role各目录，禁Nodecompile缓存。旧cache_cacache仅读取为新cache种子，旧产物全部只读。原unit20与公开完整141不得删/弱化断言或skip；原cleanup路径/链接守卫保留。不得写PM/Reviewertest、GUI或产品25files，不能授顶层散落prefix、任意path、全局Pi、发布。清理前验证绝对路径和每段链接，仅关闭自己创建且跟踪的进程。
