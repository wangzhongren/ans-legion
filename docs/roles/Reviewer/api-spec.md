# Reviewer检查接口

没有业务API或伪造的业务feature。本职责维护三个独立测试入口，由冻结config和task_ops执行。

| checkId | 根目录argv | timeout |
| --- | --- | --- |
| node-unit | node --test tests/reviewer/test_structure.mjs | 300秒 |
| desktop-unit | node --test --test-concurrency=1 apps/desktop/tests/reviewer/desktop-boundaries.test.mjs apps/desktop/tests/reviewer/workbench-boundaries.test.mjs | 300秒 |

输入为冻结canonical715639b5…、config2546ebd0…、desktop-workbench合同22e3b93e…与ownership87808cec…原始字节；以及实际24下层源码、27Node产品源码、29项TGZ、36桌面src和当前ZIP descriptor。发行身份随真实合法重make更新，测试严格匹配当前descriptor的path/bytes/SHA及全部源字节，禁止把旧ZIP hash当永久源码合同。Desktop manifest只准installed Forge删除scripts/devDependencies/private/config.forge，其余全对象deepEqual；嵌入Core29文件逐字节一致。

调用者LEGION_NODE_TEST_ROLE/LEGION_DESKTOP_TEST_ROLE采用受控enum；Reviewer默认身份。生成目录在本阶段role/node/{packaging,npm-cache,tmp}与role/desktop/{fixtures,user-data,tmp}，未知角色拒绝。TEMP/TMP、缓存与compile-cache设置按角色隔离；localhost和Electron进程仅本次跟踪资源。

IPC检查精确window/mainFrame/documentURL及字段，未知操作与worker发送拒绝。Workbench使用已安装legion-runtime公开workbench-models与Service入口；controller/凭据/SDK/raw错误不运输到renderer或历史。检查输出是Node TAP计数和task_ops同候选日志/SHA；最终结果由[任务记录](../../scheduling/legion-desktop-workbench-v2-fixture-repair.md)核验。
