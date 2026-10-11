# AgentAdapterEngineer功能导航

| 功能 | 当前行为 | 状态/文档 |
| --- | --- | --- |
| 真实Pi会话与受控宿主工具 | scope授予的读/写/编辑/检查控制工具；typed回应；两种lifecycle等待暂停累计模型活动预算，取消与恢复拒绝旧工具重放 | 已实施，owner层检查通过；[完整功能](docs/feature/pi-agent.md) |
| 纯受控写/编辑提案转换 | 可信Session和run绑定；新检查与控制不转Mutation提案 | [历史功能](docs/feature/proposal-adapters.md)，当前契约见[API](api-spec.md) |

[本次设计](docs/design/2026-10-08_design_governed-agent-tools.md)、[API](api-spec.md)、[变化](changelog.md)。最终四文件approved unit和candidate见[当前任务](../../scheduling/legion-governed-workflow-v1.md)，本层不自verify，也不替代Kernel检查运行器、Desktop持久交互和独立验收。历史[工作台v2](docs/design/2026-10-07_design_desktop-workbench-v2.md)与[原Node](docs/design/2026-10-07_design_node-pi-v3.md)保留。

项目 Shell 工具和严格终态回应见 [完整功能](docs/feature/project-shell.md)，本次 [设计](docs/design/2026-10-10_design_project-shell.md)。
