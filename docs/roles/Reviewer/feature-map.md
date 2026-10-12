# Reviewer独立审查导航

## 当前：项目Shell v1（2026-10-10）

- [最终有限审查](docs/review-project-shell-v1.md)：runtime0.8.2、当前Tester六门、Reviewer51/50与最后文档门、旧失败和平台限制。
- [当前审查功能](docs/feature/project-shell.md)、[本次审查设计](docs/design/2026-10-10_design_project-shell.md)、[变更记录](docs/change/2026-10-10_change_project-shell.md)。
- [职责与流程](functional-description.md)、[检查契约](api-spec.md)、[追加历史](changelog.md)。

## 既有阶段导航（原记录保留）

固定Reviewer只维护独立检查与证据，无直接业务功能；不修其他owner生产。

- [Workbench v2审查](docs/review-desktop-workbench-v2.md)、[本职责设计](docs/design/2026-10-07_design_desktop-workbench-v2.md)：原Node22、Desktop8与新增Workbench7有限检查。
- [职责与流程](functional-description.md)、[检查接口](api-spec.md)、[变化历史](changelog.md)。
- 被审公开合同：[Desktop API](../DesktopEngineer/api-spec.md)、[Kernel API](../KernelEngineer/api-spec.md)、[Adapter API](../AgentAdapterEngineer/api-spec.md)、[当前canonical](../../design/2026-10-07_design_desktop-workbench-v2.md)。
- [GUI v1记录](docs/review-desktop-gui-v1.md)、[Node v3历史](docs/review-node-pi-v3.md)、[Python P1历史](docs/review.md)只读保留，不作为本次通过成绩。完整流程与视觉验收仍由独立Tester负责。

- [完整治理工作流评审](docs/review-governed-workflow-v1.md)：当前阶段四个独立入口覆盖持续成员、准确审批、真实交互、自测/验收证据与原 owner 返修。本轮生产仍在迭代，结构通过只适用于报告中的候选。

- [冻结候选的有限最终评审](docs/review-governed-workflow-v1.md)：final-review只更新4份文档，原50项测试只读；当前timeline/部分提案错误副作用/有界模型预算与fresh0.7评审、范围和证据见报告。最终独立Tester阶段另行运行，新增ProductManager/UI需求尚待方案。

- final-review当前以提示词修复后的冻结输入复验：旧完整DTO67,733字符超cap失败保留；当前事实投影和完整UI台账按实际不同用途输出，详细owner125/Tester临时31及2MacUI证据与未测范围见同一评审报告。ProductDesigner另行design-only不等于运行功能上线。


## 项目指挥台 v0.3

当前公共DTO/IPC、只读查询、包身份与真实macOS窗口边界审查见 [Workbench审查](docs/review-desktop-workbench-v2.md) 与 [治理工作流审查](docs/review-governed-workflow-v1.md)。完整视觉/操作证明归独立Tester；Windows在本机未执行，旧observer pin与未知marker限制保持。
