# Supervisor 调度接口

工作台v2使用 `.ans/project.json`（SHA256 2546ebd0b8756eccb83bced6808c10d1c25c3bc175ca8f676a9f1d5172cb706b）。canonical715639…与客户确认252ca93c…固定同版输入；摘要固定内容，直接客户回复才是授权依据。八个逻辑阶段共十二项required checks，前三的五项门禁身份实际未变，`legion-desktop-workbench-v2-fixture-repair`后五节点以七项当前检查收束（verified revision36，全部inactive）。原任务Interface issue33/stop34与原cap47保留历史；cap-fixtures只写原Desktop五effect tests，其余25前段产物只读，后四沿用原精确12/10/9/10输出。

| stage | owner | authored 输出 | required checks |
| --- | --- | ---: | --- |
| kernel | KernelEngineer | 18 | unit：九个 Kernel 模块，300s |
| adapter | AgentAdapterEngineer | 14 | unit：三个模块，180s |
| core-package-deps | ProjectManager | 11 | core-package / install-electron / verify-dependencies，300/300/120s |
| desktop-capabilities | DesktopEngineer | 30 | capabilities：六个模块，300s |
| desktop-interface | DesktopEngineer | 12 | interface：两个模块，300s |
| desktop-package | ProjectManager | 10 | desktop-package，300s |
| reviewer | Reviewer | 9 | node-unit / desktop-unit，各300s |
| tester | Tester | 10 | unit / regression，各300s |

固定 argv 从配置读取；cwd 为项目根。角色先设置本阶段独占 TEMP/TMP/cache/userData/fixture 范围，清除 NODE_OPTIONS/NODE_COMPILE_CACHE，禁止旧 runtime 写入。需求、设计、角色边界、合同及前置 authored 输出参与 candidate；可变 Mission/handoff 进度和 Supervisor 协调说明不作为产品输入。较早 Kernel 阶段验证原 single_run Adapter 基线；新版组合由后续实际 Tester 全 Node 回归验证。

最终PM `desktop-public` 是配置中已固定的公开入口检查。task_ops不接受verified/inactive assignment的run-check，因此八个逻辑阶段验收后以同配置的零authored任务 `legion-desktop-workbench-v2-desktop-public`运行此检查：13模块串行、73pass/0fail/skip/cancel/todo，verified revision6。记录源码、包锁、tarball、ZIP前后身份；本次ZIP变化，再以零authored `legion-desktop-workbench-v2-artifact-recheck`运行原Reviewer desktop-unit→Tester unit。当前ZIP/descriptor作为这两个节点固定readSet，期间不可重make；Node回归未受影响不重复。实际最后状态与日志见[交付说明](docs/delivery-desktop-workbench-v2.md)。三项补充检查不代替十二项阶段门禁。

当前artifact-recheck revision11，Reviewer desktop-unit15与Tester unit2均通过/零fail/skip/cancel/todo，两节点verified且inactive；当前候选2dc1e056…，当前ZIP11c16a8c…，完整SHA见交付。coordinator和worker凭据保持私有，仅指定worker接收自己的assignment。自有七份协调文档直接按同版客户授权维护，最终单独记录身份，不冒称业务check。下方保留旧阶段当时的接口历史；其中“当前”属于对应旧任务。

当前 GUI 使用 `--task legion-desktop-gui-v1`，固定配置 SHA256 `e72ba37fc080453ecf9ef0229c5f6f11bf4e41ecf017cf2febf85cea6ef6d89d`。七节点为 deps/profiles/workspace/interface/package/reviewer/tester；共8个 required check。调用 cwd 固定项目根，继承外部环境，Node 检查明确写 apps/desktop 路径，npm 使用已核验 npm-cli.js 的 `--prefix apps/desktop`。

deps 的包锁与两个 PM helper、profiles 的 DTO/Model 和设计输出通过后冻结；后段不改前置候选。角色生成效果按自己的 userData/fixtures 子目录隔离，只有 PM 安装和打包。独占接收、七份协调说明由 GUI 实施授权维护；business stage 才需要 worker assignment。凭据保持私有。

GUI 当前 revision36：deps/profiles/workspace/interface/package/reviewer verified，Tester pending，所有节点 inactive。客户修订目标后暂停 Tester 派发；工作台只读评估不是新 task_ops 实施节点，也不产生业务写权限。下方为原 Node 阶段的历史调度说明。

Supervisor 维护协调 API，产品 Node API 由 [KernelEngineer](../KernelEngineer/api-spec.md)、[AgentAdapterEngineer](../AgentAdapterEngineer/api-spec.md) 与 [ProjectManager](../ProjectManager/api-spec.md) 维护。当前两个跨组件契约版本均为 `legion-node-pi-v3`。

调度入口是 `C:/Users/MLoong/.codex/skills/ans-governed-construction/scripts/task_ops.py`。当前参数为 `--root <项目绝对路径> --task legion-pi-node-v3-close-repair <operation> --request -`；status 无需请求正文。原 `legion-pi-node-v3` 任务保持历史。外部 Python 只用于开发治理，不属于 Node 产品的使用或发行依赖。

| 操作 | 使用者 | 结果与约束 |
| --- | --- | --- |
| init | Supervisor | 固定接受的配置、设计和七节点 DAG，保留旧任务 |
| dispatch | Supervisor | 前置证据通过后分配精确 writeSet 与 owner 独占 assignment |
| ack | 指定 owner | 确认任务、设计与边界版本后开始实现 |
| report | 指定 owner | 记录真实进展、问题、完成与变更路径 |
| run-check | 指定 owner | 运行配置内 argv，记录候选、退出码和日志 |
| verify | Supervisor | 要求输出完整、完成报告与全部当前检查一致 |
| stop / revise | owner / Supervisor | 先停止实际 writer；返工按冻结策略及实际影响处理 |
| status / recover | 只读 / Supervisor | 读取或核验完整持久化记录 |

当前设计/需求不允许在本任务内改版。必要的合同缺陷由原 owner 有界返工并重建调用方证据；权限或目标的实质变化返回 Governance。调度凭据与 worker token 只保留在私有上下文。task_ops 记录声明的权限与候选证据，不提供 OS 隔离或客户身份认证。

当前七节点已经 verified，14 项配置 checks 均通过。其后由原 ProjectManager 只读执行一次公开 npm test，结果141/141、0 skip，前后源码和包身份不变；它是单独的用户入口证据，不新增虚构节点或 checkId、不替代 required checks。命令、日志与身份见 [最终交付](docs/delivery-node-pi-v3.md)。

本机 task_ops 使用 `PYTHONUTF8=1` 与 `PYTHONDONTWRITEBYTECODE=1`。系统重定向 TEMP 对临时子项曾拒绝访问，产品检查使用 `TEMP=TMP=D:/work/code-work` 随机目录并验证清理路径。npm argv 固定为 `node D:/soft/nodejs/node_modules/npm/bin/npm-cli.js`，安装使用 ignore-scripts 与 PM 专有项目缓存。
