# ProductDesigner 设计职责与交接

用户希望在 Legion 中专注讨论需求，在关键决定出现时看清会发生什么，执行后能找到实际结果。ProductDesigner 负责把这些现有能力组织成容易理解的界面，并把交互细节写给长期维护桌面程序的 DesktopEngineer。

本角色是本仓库的建设角色。客户项目仍由自己的 ProjectManager、RoleArchitect 与批准成员组成；本次不增加客户项目角色或模型职责。原型中的 Legion SSH 七名成员只是一个已有项目的演示数据，不是所有新项目的固定团队。

## 当前依据

先检查 [DesktopEngineer 当前功能](../DesktopEngineer/feature-map.md) 与 [公开接口](../DesktopEngineer/api-spec.md)，再核对实际 `apps/desktop/src/interface/index.html`、`renderer.mjs`、`styles.css`、`preload.cjs`、`main.mjs`，以及 `models/workbench.mjs`、`models/interaction.mjs`、`pipelines/workbench.mjs`。旧 v2 文档中的“软件检查未执行”不能覆盖最新组织与验收实现；当前组织、检查、返修、持久时间线以 [完整工作流](../DesktopEngineer/docs/feature/organization-and-acceptance.md) 与实际代码为准。

当前项目架构由 [ProjectManager](../ProjectManager/docs/architecture.md) 维护；未找到 `docs/roles/Supervisor/docs/architecture.md`，不创建替代架构。

## 交付与协作

- [界面设计](docs/design/2026-10-08_design_legion-ui.md) 记录当前行为清单、拟采用的导航、完整分支、功能保持矩阵、视觉规范、实施约束与待验证项目。
- [原型](prototypes/legion-ui.html) 用本地显示状态演示导航、表单、弹窗和任务详情。它不会接触真实目录、密钥、模型、IPC 或执行许可；演示检查及延迟不是产品证据。
- [接口引用](api-spec.md) 只索引现有公开入口，不定义第二套运行契约。
- [功能导航](feature-map.md) 指向实际 owner；[变更历史](changelog.md) 指向本次设计。

DesktopEngineer 在设计经客户确认、另行获得生产实施任务后实现 UI。Model、Pipeline、IPC、安全投影、请求版本与摘要、持久事务、检查及返修权限是实现约束，不能在渲染层替代。发现需要新的业务能力时返回 Supervisor 重新界定需求，本次没有选装功能。

当前交付为 v2 视觉重设计候选：用户明确不喜欢 v1 的传统管理界面感，要求灵动、未来感与 Grok 的沉稳感。新方案采用整体近黑画布、中心输入、轻成员导航、浮层与短过渡；功能和权限语义保持。v1历史保留，v2客户视觉评审待定，生产未实施。批准的静态交付检查仅证明六文件存在和原型的有限结构/脚本语法，不证明产品功能、真实连接、安全性或原生布局；任务证据见 [v2调度记录](../../scheduling/legion-ui-productdesigner-v2-grok.md)。
