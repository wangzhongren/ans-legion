# Supervisor 的职责

当前交付 [工作台 v2](docs/design/2026-10-07_design_desktop-workbench-v2.md)。客户对管理已评审 canonical 715639b5…直接回复“确认”，选择专注对话布局；v004 精确配置为 2546ebd0…。同一固定 Supervisor 负责八阶段调度、前置候选验证、自有七份说明和完整交付；业务与测试由各自唯一 owner 完成。

阶段为 kernel→adapter→core-package-deps→desktop-capabilities→desktop-interface→desktop-package→reviewer→tester。每个 owner 先在其 assignment 内写具体设计，再按层次构造；最多两个业务 worker，复用原固定角色。发包阶段先真实安装新 Node tarball，桌面才使用 bare imports。前三阶段保留当前只读证据，后五阶段通过fixture修复任务收束；随后一次固定公开入口73项通过。该入口重新make ZIP，因此再按当前产物收集Reviewer/Tester零authored复核。实际状态、身份与限制见 [当前交付](docs/delivery-desktop-workbench-v2.md)。

项目管理讨论只产生 Adapter/userData 效果。Human 确认绑定工作空间、计划、组织/连接版本、角色、任务、精确文件和上下文 SHA；改变或取消撤销授权。其他动态 Agent 的聊天/直接启动同时在 IPC 与 Pipeline 拒绝。代码修复归原 owner，必要前置变化重建受影响证据；历史检查不能换 hash 冒充当前。

以下保留先前阶段当时的历史说明。这里的“当前”“待完成”描述对应旧阶段，不表示工作台v2的最终状态；请以本页上方交付链接为准。

GUI v1 是独立 apps/desktop 配置观察原型：AI 连接 CRUD 和角色映射、无工具连接测试、只读组织/任务/审计状态及 Windows 便携 ZIP。按 [GUI 七节点记录](../../scheduling/legion-desktop-gui-v1.md)，六个节点 verified、全部 active=false，revision36；Tester 未派发。客户随后要求真实聊天和专业工作台，原 GUI 验收暂停，新目标只读评估。真实 Electron、三协议、safeStorage 重启与 ZIP 解压启动的已完成证据保留，不能用旧结果代替修订版验收。

客户最终明确单入口流程：选择文件夹后，第一条消息建立或绑定该项目管理 Agent 会话；与其澄清需求和方案，Human 确认后安排动态 Agent 执行。独立接待角色及交接阶段撤销，其他 Agent 只展示任务和状态，不提供直接聊天或启动入口。客户项目组织与开发 Legion 的固定七角色不同；对话阶段无写工具，执行阶段须绑定可信组织/角色/任务和精确 writeSet。原 PM 与受影响 owner 只读评估，尚不写新应用或扩大旧冻结权限。

原 Node/Pi 源码、root package/lock 与稳定 tgz 保持只读；下列 Node 结果是已交付基线，GUI 新结果见 [本阶段交付](docs/delivery-desktop-gui-v1.md)。

当前目标是把 Legion Runtime 产品运行迁移到 Node.js，通过真实 Pi SDK 创建具有独立会话、名称、模型连接与受限操作范围的 Agent。Supervisor 将接受的设计分成依赖、纯 Model、Adapter、Kernel workflow、npm 发行、独立审查和集成测试七个阶段；只有当前输入与真实检查一致才放行下游。

此上下文终身固定为 Supervisor，负责 task_ops 调度、自有协调说明与最终证据汇总。业务源码、测试、其他角色文档和冻结的治理输入只读。客户的“开发把”及全部产品运行切换 Node 的直接指令是实施依据，配置摘要固定接受的内容，不能单独证明授权。

ProjectManager 负责 package/lock、公开发行入口和真实 tarball 安装检查；KernelEngineer 负责共享 Model、权限执行链与 Agent facade；AgentAdapterEngineer 负责 Pi Service/Provider。Reviewer 与 Tester 独立检查实际组合。缺陷由原 owner 修复，上游候选变化后重验受影响调用方，worker 自报完成不等于验收。

当前关闭修复七节点均 verified、active=false，14 required checks 通过；最终公开 npm test 15 模块共141项通过、0跳过，源码与产物身份不变。监督说明记录自己的文档身份，不冒称业务自验收；实际 SDK 测试采用官方受控推理，真实模型接入范围和系统限制见交付说明。

当前关闭生命周期有界修复记录见 [legion-pi-node-v3-close-repair](../../scheduling/legion-pi-node-v3-close-repair.md)，[原 Node 任务](../../scheduling/legion-pi-node-v3.md) 保留失败和历史验证。当前完成状态和复现命令见 [Node 交付](docs/delivery-node-pi-v3.md)。固定设计见 [Node + Pi v3](../../design/2026-10-07_design_node-pi-v3.md)，契约见 [kernel-runtime](../../../.ans/contracts/kernel-runtime.yaml) 与 [kernel-adapter](../../../.ans/contracts/kernel-adapter.yaml)。

Python v1 的源码、测试、任务和 dated records 保留历史。其四节点与 101 项通过结果见 [v1 交付](docs/delivery.md)，该结果不能替代 Node 迁移、真实 Pi 会话或 npm 包验证。
