# 2026-10-07 GUI必要Node回归兼容修 v1.1

状态：原固定PM已只读recommend，Governance接受同GUI实施目标的必要测试细化；尚未实施/验证。客户对已评审GUI v1回复“开发”的授权继续有效，GUIcanonical/行为/O1未选均不变。GUI新增阶段收紧本次写权限，旧ownership测试却将当前任务writeFiles误当旧产品所有权；旧package测试又默认写冻结发行目录。修复仅测试的治理来源与生成位置，保留所有产品与行为断言。

三项精确变更：

1. 原PM仅写tests/package/test_package.mjs，LEGION_NODE_TEST_ROLE只允许ProjectManager/Reviewer/Tester（默认前者），固定本项目.ans/runtime/legion-node-fixture-compat-v1/<role>/{packaging,npm-cache,tmp}/，不接受任意path。旧cache仅复制_cacache为种子，拒绝链接/越界，缺seed或离线依赖直接失败；不复制_logs、不在旧cache跑npm、不联网退路。子进程TMP/TEMP及cache强制角色目录，不能被extraEnvironment覆盖。新tgz必须与原冻结发行同bytes，原27白名单/完整性/离线安装/真实Pi/CLI/README/包锁等所有断言保留；递归清理前验证绝对目标和每段链接。
2. 原Reviewer仅写tests/reviewer/test_structure.mjs，按原bytes先assert冻结Node-policy SHA25e46e9b7811685847116393d9c9982062e975f66e151ce3d094ef2be020cccb再解析；原23源码唯一owner、数量、三层与相邻边等全部断言保留。旧Node只读primary ownership由冻结历史策略证明，不恢复本阶段Core写权限。同文件temporaryRoot改为受控role tmp，保留全部清理守卫。
3. 原Tester仅写tests/integration/test_permission_flow.mjs与test_generic_agents.mjs；既有TEMP_ROOT/CLI子进程temp改为上述受控role tmp，角色enum未知拒绝，不接受任意path。原20完整行为用例及所有安全/关闭/模型隔离断言不变，随后公开141跨角色回归。

独立configPath、同固定身份补充role-card/Section1，三个节点package-fixtures→ownership-regression→integration-fixtures。不会原位改GUI e72/cards/contracts/freeze或当前Workspace预约。PM package原2项，Reviewer unit原22项，Tester unit原20项与regression公开npm test原141项，全部实际执行、0skip、同候选证据。check argv无env字段，Supervisor按执行角色在受控调用环境设置LEGION_NODE_TEST_ROLE、TEMP、TMP、npm_config_cache、NODE_DISABLE_COMPILE_CACHE=1；不得把此环境污染GUI检查。

只允许四个既有tests文件和九个角色独占生成子目录。原25产品源/root package-lock-README/runtime/CLI/稳定tgz、旧packaging/cache、Python历史均只读；检查前后核对旧产物bytes，旧cache种子前后核对文件SHA。原Reviewer22及全部141实际结果与版本/输入身份由worker/task_ops记录，不把历史141冒充新回归。此任务无GUI功能扩充、无生产代码修改、无权限放宽或断言删除。

首次细化发现Reviewer和Tester两个旧integration也硬编码顶层temp，故在未init/dispatch前补齐这三个既有文件的测试路径适配。初始未执行proposal/config/freeze保留initial备份；仅此必要效果隔离变化，无GUI设计变化。
