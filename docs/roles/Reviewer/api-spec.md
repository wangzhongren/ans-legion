# Reviewer检查接口

前部保留既有阶段合同；2026-10-10当前项目Shell合同见本页末节与[最终报告](docs/review-project-shell-v1.md)。

没有业务API或伪造的业务feature。本职责维护三个独立测试入口，由冻结config和task_ops执行。

| checkId | 根目录argv | timeout |
| --- | --- | --- |
| node-unit | node --test tests/reviewer/test_structure.mjs | 300秒 |
| desktop-unit | node --test --test-concurrency=1 apps/desktop/tests/reviewer/desktop-boundaries.test.mjs apps/desktop/tests/reviewer/workbench-boundaries.test.mjs | 300秒 |

输入为冻结canonical715639b5…、config2546ebd0…、desktop-workbench合同22e3b93e…与ownership87808cec…原始字节；以及实际24下层源码、27Node产品源码、29项TGZ、36桌面src和当前ZIP descriptor。发行身份随真实合法重make更新，测试严格匹配当前descriptor的path/bytes/SHA及全部源字节，禁止把旧ZIP hash当永久源码合同。Desktop manifest只准installed Forge删除scripts/devDependencies/private/config.forge，其余全对象deepEqual；嵌入Core29文件逐字节一致。

调用者LEGION_NODE_TEST_ROLE/LEGION_DESKTOP_TEST_ROLE采用受控enum；Reviewer默认身份。生成目录在本阶段role/node/{packaging,npm-cache,tmp}与role/desktop/{fixtures,user-data,tmp}，未知角色拒绝。TEMP/TMP、缓存与compile-cache设置按角色隔离；localhost和Electron进程仅本次跟踪资源。

IPC检查精确window/mainFrame/documentURL及字段，未知操作与worker发送拒绝。Workbench使用已安装legion-runtime公开workbench-models与Service入口；controller/凭据/SDK/raw错误不运输到renderer或历史。检查输出是Node TAP计数和task_ops同候选日志/SHA；最终结果由[任务记录](../../scheduling/legion-desktop-workbench-v2-fixture-repair.md)核验。

## 2026-10-08 完整工作流阶段

本阶段实际固定检查 ID 为 `structure`，来自客户批准的配置 SHA-256 `ddc9cfd12dc62d413a6353c4150e488c3451bb6ac8f2f37550441e993a8ec4fa`。根目录实际 argv：

```sh
node --test tests/reviewer/test_structure.mjs apps/desktop/tests/reviewer/desktop-boundaries.test.mjs apps/desktop/tests/reviewer/workbench-boundaries.test.mjs apps/desktop/tests/reviewer/governed-workflow-boundaries.test.mjs
```

超时为 300 秒。本角色只通过正式 assignment 的 task_ops `ack`、`run-check` 和 `report` 提交反馈，不自 verify。token 由私有 assignment 在 Python 内存读取，经 stdin 传入，不进入公共文件。

新增输入是实际公开 CheckService、组织 Service/Provider、组织与交互 Model、持久项目身份与精确归属、真实 Node 候选测试及其全部声明依赖。50 项旧与新增结构用例保留真实 IPC、Pi SDK、macOS Electron/safeStorage、取消/重放拒绝与 0.7.0 tarball/installed 字节检查；Windows ZIP 只在 Windows 运行，在 macOS 报告未测。新增有限计数伪造回归要求空测试与直接 fd3 记录都不能成为通过证据。

Reviewer 生成效果限于 `.ans/runtime/legion-governed-workflow-v1/Reviewer/{fixtures,user-data,tmp,evidence}/`。旧产物不覆盖。固定 task_ops 自身日志由其配置执行路径生成于 `.ans/runtime/legion-governed-workflow-v1-independent-review/evidence/`，不是 Reviewer 手写的结果。

状态数据不自动成为权限。公开 Model 可表达 `passed`，但宿主只有在实际检查、当前输入摘要和真实成员绑定满足时才允许完成。交互关闭保留 pending；答复要求 request ID、版本、摘要与当前绑定，恢复不重放旧 runner 的批准。MAC 计数回归证明所测有限输入的拒绝，不是对任意恶意同进程 JS 的通用不可篡改保证。具体隔离来自 macOS seatbelt；Node permission 与 reporter 保护在固定运行模式内补充限制。


## 冻结候选最终任务

任务 `legion-governed-workflow-v1-final-review`、node `reviewer-final` 沿用批准的 `structure` 命令和300秒上限。writeSet仅本角色feature-map/api-spec/changelog/review-governed-workflow四份文档；原四个结构测试只读，50项保持。145个readSet覆盖当前生产、测试、peer API、README/manifests、installed和workspace修复；检查前后比较全部输入SHA和只读测试SHA。更改文档后再固定run-check，complete仅提交当前候选，Supervisor负责verify。

本轮当前契约由Desktop timeline、组织Service持久事务、Workbench Pipeline和有限IPC DTO支持；timeline数据不是权限或SDK工具响应。Adapter当前8192输出/180000活动ms默认及cap只可缩小；host pending停表、取消/关闭拒绝迟到响应。失败后的pendingProposals只是当前同项目/instance实际提交的待审候选，仍由PM审批，status保持error。各自精确字段由[Desktop API](../DesktopEngineer/api-spec.md)和[Adapter API](../AgentAdapterEngineer/api-spec.md)维护，本职责不复制业务实现。

本机structure实际覆盖与owner当前自测证据在[报告](docs/review-governed-workflow-v1.md)明确区分。没有本阶段Windows证据，也没有将尚待运行的Tester最终集成、真实外部模型或新增产品经理/UI需求表述为通过。历史旧包、旧诊断/stopped/stale和旧合同的结果不构成当前candidate证据。


最终readSet已因已定位的prompt修复和Tester契约适配刷新。Current Desktop `governedPromptDTO`为模型当前事实；完整UI `governedDTO`仍保留timeline。所有四个SDK启动入口使用实际拼接65,536字符校验；用户所选context不静默截，超预算拒绝，最近128完整纯文本消息省略明确。启动拒绝结束已beginTurn为failed。Reviewer只读审阅源码及owner正式unit125证据，不冒称单独Model已跑；最终structure仍原50项，与当前145输入及4只读测试SHA绑定。Tester临时31int/2MacUI通过和1Windows未运行，正式checks待Reviewer文档冻结后执行，结果不能提前升级。新治理设计职责不扩大本v1权限或上线范围。

## 2026-10-10 当前项目Shell检查合同

当前精确配置c872245f…65ea4，设计a5a0166d…59c0。当前固定门均300秒：

```sh
node --test --test-reporter=tap --test-concurrency=1 tests/reviewer/test_shell_boundaries.mjs apps/desktop/tests/reviewer/shell-workflow-boundaries.test.mjs tests/reviewer/test_structure.mjs apps/desktop/tests/reviewer/desktop-boundaries.test.mjs apps/desktop/tests/reviewer/workbench-boundaries.test.mjs
node --test tests/reviewer/test_structure.mjs apps/desktop/tests/reviewer/desktop-boundaries.test.mjs apps/desktop/tests/reviewer/workbench-boundaries.test.mjs apps/desktop/tests/reviewer/governed-workflow-boundaries.test.mjs
```

checkId依次为`shell`和`regression_structure`。默认Reviewer角色，新Shell效果在本阶段己方runtime；旧固定回归仅已有精确边界的fresh临时子目录，旧proof/tar/log不覆盖。task_ops记录argv、candidate前后、exitCode、timeout、log/SHA；当前文档阶段只有八份docs可写，五test冻结。

被审公开入口`legion-runtime/services/shell`只有ShellService/createShellService，Controller/receipt及Provider私有helper不出口。Shell/Mutation公开observeTime由Provider取得fresh数值；私有Model绑定参数observedAtMs，SDK request字段不加clock/permit。Host Model可表达数据，但构造ShellAuthorization或ShellResult不等于被批准或实际执行。

合法检查absence的Wire形状为`{resource,state:'absent',sha256:null,byteLength:0}`，不得含executable或授权字段；present与未知字段仍strict。`recovery_verified_retained`与Mutation.results分开，绑定旧request/proposal/candidate及新Human/current task/owner/run/baseline；旧delete保留墓碑，不能冒称新delete或新的许可。

当前严格runtime0.8.2 tar/source/installed一致（46/44/62）。历史0.7真实TGZ保持旧39/37快照；Windows ZIP/descriptor缺失，Windows GUI/DPAPI未执行。当前结果与全部限制见[最终报告](docs/review-project-shell-v1.md)，上面的旧版本计数属于历史阶段。
