# Section 1: 同固定ProjectManager的必要Node测试兼容范围

仅用于legion-node-fixture-compat-v1；身份不变，GUI e72原边界不变。任务writeSet只能缩小此补充范围。

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 文件 | `tests/package/test_package.mjs` | 原owner既有测试的严格治理/生成隔离修，不改产品与断言 |
| 条件生成目录 | `.ans/runtime/legion-node-fixture-compat-v1/ProjectManager/packaging/` | 仅本角色本任务受控测试数据/缓存/包/证据 |
| 条件生成目录 | `.ans/runtime/legion-node-fixture-compat-v1/ProjectManager/npm-cache/` | 仅本角色本任务受控测试数据/缓存/包/证据 |
| 条件生成目录 | `.ans/runtime/legion-node-fixture-compat-v1/ProjectManager/tmp/` | 仅本角色本任务受控测试数据/缓存/包/证据 |

原Node25产品源、root package/lock/README/CLI、旧stable tgz/packaging/cache只读。旧_cacache仅read-copy到自己的新cache。原PM package2/Reviewer22/公开141不得删断言或skip。caller及子进程TMP/TEMP/cache固定本角色根；清理前验证绝对路径及链接，只终止自己创建且跟踪的进程。新tgz需与原字节相同，前后核对旧产物身份。不可写GUI/他人test/全局Pi或自行变更角色、派发worker、放宽Core权限。

补充v1.1：LEGION_NODE_TEST_ROLE只允许ProjectManager/Reviewer/Tester，测试生成根仍只能取当前caller对应role子目录。Reviewer同文件temporaryRoot必须使用本role tmp，保留cleanup断言；PM须支持Tester的完整suite隔离运行。
