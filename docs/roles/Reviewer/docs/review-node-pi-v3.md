# Node+Pi v3 关闭修复独立复查通过，待协调者验收与完整集成

向 Human 与 ProjectManager 报告：本次已接受关闭修复复查范围内未发现未解决缺陷。Reviewer 保留22项有限 Node 检查，22通过、0失败/跳过/取消/todo；另只读执行原Tester的正常close与实际auditfault两个严格用例，2通过、零失败/跳过。没有以owner成绩替代独立检查，没有修改生产或放宽原P1断言。

依据[固定设计](../../../design/2026-10-07_design_node-pi-v3.md)、[runtime合同](../../../../.ans/contracts/kernel-runtime.yaml)、[adapter合同](../../../../.ans/contracts/kernel-adapter.yaml)和当前全部23个Node产品源码、根入口/bin/package、owner公共API文档。接受设计SHA256为 `342fd522343126c31c7a7f1ee3c8befab9f363d5372297847ebc8f42b5f30bae`，执行配置为 `25e46e9b7811685847116393d9c9982062e975f66e151ce3d094ef2be020cccb`，均已实际读取核对。

## 检查结论及证据覆盖

原Python P1语义已严格迁移到Node：requiredApprovals=['backend/approved.txt'] 对原路径、BACKEND/APPROVED.TXT、backend\\approved.txt 均 REQUIRE_APPROVAL且目录不创建；denyScope/requiredApprovals scalar string构造必须抛TypeError，七集合字段同样拒绝字符串，原断言目标未减弱。[原v1失败与修复历史](review.md)只读保留，不作为本次成绩。

真实产品根八项导出核对通过；createRuntime/Agent冻结闭包只暴露合同方法及只读身份，不暴露下层对象、SDKSession或许可。公开Model能构造ActionProposal并通过prepare/execute/submit写入；许可空键、冻结、单次，伪造ALLOW/ExecutionPermit与重放不能写。原始无authority Service/Provider工厂不能写文件、事件或产生运行身份。固定Session不能改角色，相等克隆不是已登记身份；digest绑定内容/路径/proposalId/runId。task/version/boundary变更后恢复旧值仍不能复用旧许可。默认无scope、deny优先、控制面/绝对/遍历/设备路径严格拒绝。

同一workspace两个真实Runtime并发提交，8事件连续有序、每提案顺序正确、日期日志与index一致、+08:00时间及无正文/prompt/凭据。实际fs.open故障注入：mutation_intent审计失败时目标目录未创建；文件replace后第四次daily append失败时明确audit_failed、observedMutation=true，目标内容实际存在、后续写关闭、坏日志读取抛MutationError。业务文件与两份日志没有跨文件事务或回滚声明。root/.ans/events链接检测分别在独立workspace触发实际lstat分支。

真实SDK测试：两独立Pi实例经产品公开modelProviders数组，各完成两次官方Faux推理及一个合法写入。观察实际AgentSession、工具/空resources/expandPromptTemplates=false、内存会话、独立session/model/凭据/transcript和dispose两次；fetch调用为0，推理options无Runtime/permit/submit写能力。另两真实Provider检查原请求/当前run一次回应，克隆与跨实例/重复/取消后回应拒绝，Proposal保留可信Session，payload角色字段拒绝。真实Pi尝试task外和instance外资源均DENY无目录创建；错误scope在推理前失败。真实SDK创建完成后发生取消，晚到Session被dispose且没有发布Agent或推理。

23个源码均单一精确owner，Service/Provider具有abstract/public/impl，abstract不反向依赖，public仅导出自身合同/工厂，factory选择内部实现。import路径检查加人工实际方法追踪确认Interface→Pipeline→Service→Provider，Model共享无上层依赖，PiSDK/时间/随机/文件效果归Provider。Model只允许纯createHash，集合复制为冻结数组；Policy纯计算，Mutation不调用Policy同行，Proposal纯转换，PiService只调用Provider，Provider仅收推理streamSimple而不收上层Kernel callback。root仅转Interface与输入Model，CLI调用demo Interface。未见三元、吞异常、外部私有字段访问、stub或循环依赖；空ResourceLoader钩子明确表示禁用发现。自动import测试是有限词法检查与实际模块导入，不宣称完整静态分析器证明。

本次重打包发行tarball实际SHA256 `a83a86499c4aaa7c997d94cabbb697efdc82f81475b622b85307ac682de4d8f0`。独立读取gzip/tar确认精确27普通文件，每文件内容hash与当前产品一致；无Python/.ans/tests/task_ops/node_modules。package仅rootexports和legionbin，直接SDK版本1.0.4。按包名self-reference实际导入八项，并验证三个内部深路径ERR_PACKAGE_PATH_NOT_EXPORTED；typed权限链实际可用。本角色没有重打包或改变已有产物。

## 同版关闭修复与历史证据

原Reviewer任务22项全通过的有限范围未覆盖完整活动run关闭；后续独立Tester完整20项出现19通过/1失败，正常close被误报kernel_audit_failed。原失败及issue保留在[Tester验证记录](../../Tester/docs/verification-node-pi-v3.md)，不以当前结果改写旧任务。原Reviewer候选 `a17b4a23f05f712aca5f9d7d0cebdaa7fd37e72b7c89f1c42f02efed0a966881`，原固定日志 `.ans/runtime/legion-pi-node-v3/evidence/reviewer-1-unit-431faeb0.log`（SHA256 `947d7f7f259b9889c582bd8fd1b6a60ed59901d93a3c04b4f31b111718302c21`），原tarball b63b82b3…均为历史证据。

独立读取当前Pipeline修复：close同步关闭入口、撤销许可并abort；异步先收集各Session.stop结果，再等待完整activeRun（包括finally的Pi资源释放和终态审计），最后关闭Mutation。stop不等待activeRun，run的finally不等待Runtime.close，因此没有互等。真实审计失败继续返回failed/kernel_audit_failed及observedMutation=true，不吞成取消。只读执行 `node --test --test-name-pattern="one run and Runtime close|real Pi committed file" tests/integration/test_generic_agents.mjs`：2通过/0失败/0跳过；原严格断言不变。22项Reviewer回归仅修改合法新包的哈希固定值，P1与其余断言不变。

当前25个产品mjs逐文件读取并按ordinal相对路径统一 `/` + TAB + SHA256 + LF计算，标准聚合为 `75ab247b8aafc224d39c926119e170bc56bbda966073a73eeab3bfa4a4bb8327`。tarball全部27文件继续逐字节匹配当前源码。PM交付候选 `c43d76ea8c50a0750f1ba1c390b3341d53c8bfa76ca07e7cdc4bae145bf15f39` 是owner证据，Reviewer候选另由最终unit记录，不混为一个候选。

## 环境、命令与交付

Windows / Node24.11.1，PiSDK/pi-ai1.0.4，TEMP/TMP=D:/work/code-work。真实命令 `node --test tests/reviewer/test_structure.mjs`，当前22项全通过。初次21项通过后发现审计父路径测试会共享fault状态而无法证明后两个分支，改为每组件独立workspace并断言实际检测次数；补齐已接受任务/实例交集的实际Pi拒绝路径后22项通过。这是Reviewer测试自身证据准确性调整，没有改生产或弱化权限断言。

最后七文件完成后的approvedunit、候选hash、退出码和完整输出由[task_ops当前任务](../../../scheduling/legion-pi-node-v3-close-repair.md)记录，检查后不再编辑。当前提交只包含一个Node测试与六份Reviewer说明；原Python/phase1review只读。[本阶段方案](design/2026-10-07_design_node-pi-v3.md)、[测试源码](../../../../tests/reviewer/test_structure.mjs)。

## 实际局限

本机owner两个nativejunction创建EPERM的失败历史仍保留，本次Reviewer仅注入lstat元数据覆盖同一拒绝分支；不宣称nativejunction/reparse端到端、所有tag、恶意同进程宿主/OS竞争替换隔离。可信streamSimple是宿主策略，不是外部敌对程序沙箱。真实Pi使用本地受控推理，无收费网络请求；不证明真实外部provider账号服务。

PM隔离离线安装、README例子和CLI以及owner Model31/Adapter23/修复后Kernel74等成绩仅为读取基线，本角色未重复owner全套/安装/CLI。Tester保留20项严格集成的完整复查、Supervisor当前候选验收及PM后续完整npm test仍是必要步骤；本次只执行所列有限检查。未知输入或未来代码/依赖变化需新证据，当前通过不授权npm发布。
