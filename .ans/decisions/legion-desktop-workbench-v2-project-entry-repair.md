# 工作台 v2 项目入口同步

2026-10-07，当前上下文仍绑定 ANS Governance，只修改自身治理文件。DesktopEngineer 在读取真实项目入口时发现 `.ans/project.yaml` 的组织、设计与授权来源仍指向 GUI v1，而当前组织已为 v004。Supervisor 确认该入口不在本任务固定 readSet 中，返回治理修复。

依据客户已经确认并授权实施的 workbench v2，更新既有三个字段为 v004、工作台 v2 总体方案和客户同版确认来源。没有新增业务功能、角色权限或审批；冻结配置、canonical、合同、manifest、阶段、ownership 及已验证角色输出未变。当前仍在 Desktop capabilities 实施阶段，并非成品验收。

修改前 `.ans/project.yaml` SHA256：`bdbb1c876ba4c678e6006ed5b0ea11d08ed67a1348097cb345de27979098744f`。旧值为 `organization_version: v003`、`implementation_design: ../docs/design/2026-10-07_design_desktop-gui-v1.md`、`authorization_source: direct_customer_GUI_v1_develop_2026-10-07`；对应不可覆盖的组织 v003 与 GUI v1 历史仍保留。

治理仅核对入口与当前组织/授权的引用一致性，不运行业务测试。Workspace 的严格读取及本阶段检查由原 DesktopEngineer 验证。[已确认方案](../../docs/design/2026-10-07_design_desktop-workbench-v2.md)、[实施授权](legion-desktop-workbench-v2-authorization.md)、[当前项目入口](../project.yaml)。
