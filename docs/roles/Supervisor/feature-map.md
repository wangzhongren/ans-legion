# Supervisor 导航

Supervisor 负责把已授权任务交给正确 owner，并在当前候选的证据通过后放行下一阶段。工作台 v2 默认专注对话：唯一项目管理会话澄清需求，Human 确认精确计划后安排动态 Agent。八个逻辑阶段、公开桌面73项、Node回归182项及最终ZIP独立Reviewer15/Tester2均已通过，全部inactive；当前产物身份见交付说明。旧 GUI 原型和旧包成绩分别保留历史。

- [工作台 v2 分段执行](docs/design/2026-10-07_design_desktop-workbench-v2.md)
- [工作台 v2 当前交付状态](docs/delivery-desktop-workbench-v2.md)
- [工作台 v2 实际调度记录](../../scheduling/legion-desktop-workbench-v2.md)
- [工作台 v2 fixture修复与后续验收](../../scheduling/legion-desktop-workbench-v2-fixture-repair.md)
- [公开桌面入口](../../scheduling/legion-desktop-workbench-v2-desktop-public.md)
- [重生成ZIP独立复核](../../scheduling/legion-desktop-workbench-v2-artifact-recheck.md)

- [GUI 分段执行](docs/design/2026-10-07_design_desktop-gui-v1.md)
- [GUI 当前交付状态](docs/delivery-desktop-gui-v1.md)

- [职责与交接](functional-description.md)
- [调度操作说明](api-spec.md)
- [当前架构](docs/architecture.md)
- [Node + Pi 执行设计](docs/design/2026-10-07_design_node-pi-v3.md)
- [当前交付与复现](docs/delivery-node-pi-v3.md)
- [Python v1 历史交付](docs/delivery.md)
- [记录](changelog.md)

权限与实例由 [KernelEngineer](../KernelEngineer/feature-map.md) 维护，Pi 接入由 [AgentAdapterEngineer](../AgentAdapterEngineer/feature-map.md) 维护，工作台由 [DesktopEngineer](../DesktopEngineer/feature-map.md) 维护，npm/Windows 发行由 [ProjectManager](../ProjectManager/feature-map.md) 维护；独立检查见 [Reviewer](../Reviewer/feature-map.md) 与 [Tester](../Tester/feature-map.md)。
