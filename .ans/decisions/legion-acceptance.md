# Legion v1 的授权依据

2026-10-07（Asia/Shanghai），客户在当前聊天给出 Legion Runtime Organization Proposal v1，明确六角色及 ProjectManager → Supervisor → 工程师/Tester、Reviewer 独立；给出 KernelEngineer 的 src/kernel 与 tests/kernel 范围和禁止 src/ui/.ans/organization，以及 AgentAdapterEngineer 的 src/adapters/tests/adapters 范围；指明 kernel-adapter、kernel-runtime 合同和五步图，最后明确指示“开发”。

本记录据此接受本版任务和角色分配，不是 Agent 自批自己的权限。精确路径策略 `.ans/project.json` 是将客户范围收窄为实际实施清单；hash 只是 pin 文件，用户指令才是授权来源。跨出本版范围的后续变化仍需另行授权。

物理项目目录沿用 agent-organization-runtime，项目显示名称为 Legion Runtime。旧九角色候选及 bootstrap 核验作为历史保留，旧治理状态改为 SUPERSEDED，正式 current 只引用六个接受的角色。

Governance 已将实施移交新的 Supervisor 上下文，固定角色不切换。本阶段不调用真实模型账号，不启动通用 Agent CLI 或给宿主 Agent 提供原始 mutation 工具。
