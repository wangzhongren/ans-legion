# Tester 当前验证导航

Tester 独立检查真实 SDK、权限、持久组织、交互、软件检查和完整返修流程；生产修复交原 owner，最终证据交 Supervisor。职责没有授予生产 API 或业务文件写权限。

- 当前：[已确认验证方案](docs/design/2026-10-08_design_governed-workflow-verification.md)、[验证与实际限制](docs/verification-governed-workflow-v1.md)、[检查入口](api-spec.md)。
- 受测行为：[持久组织与验收](../DesktopEngineer/docs/feature/organization-and-acceptance.md)、[桌面对话](../DesktopEngineer/docs/feature/desktop-console.md)、[真实隔离检查](../KernelEngineer/docs/feature/software-checks.md)、[真实 Pi 工具](../AgentAdapterEngineer/docs/feature/pi-agent.md)。
- [职责](functional-description.md)、[变化记录](changelog.md)。
- 历史：[Workbench v2](docs/verification-desktop-workbench-v2.md)、[Node v3](docs/verification-node-pi-v3.md)、[Python v1](docs/verification.md)。这些历史成绩不代替当前验证。

- [项目Shell独立完整验收](docs/feature/project-shell.md)：真实申请/PM/Host/native/发布/原pending、自测和Acceptance、partial重启新Human恢复、GUI阶段和必要六门。Tester无直接业务源码责任。
