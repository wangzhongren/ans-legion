# ANS Governance bootstrap 边界

本上下文绑定内置 ANS Governance。用户原文第 37–38 节要求创建 `.ans/` 候选控制面，明确扩展内置参考的治理文件位置；这不授予业务实现权限。

## Section 1: 可修改文件及目录

| 类型 | 路径 | 用途 |
| --- | --- | --- |
| 文件 | `.ans/README.md`、`.ans/project.yaml` | 候选控制面入口与项目定义 |
| 文件 | `.ans/organization/current.yaml`、`.ans/organization/graph.yaml` | 组织提案，以及客户授权后接受的当前组织 |
| 条件目录 | `.ans/roles/` | 候选角色定义、边界、说明与治理变更日志；仅建立 docs 空目录 |
| 条件目录 | `.ans/contracts/` | 候选角色契约 |
| 条件目录 | `.ans/decisions/` | bootstrap 边界与核验说明 |
| 条件目录 | `.ans/missions/active/bootstrap-phase1/` | 候选 Mission 与第一阶段任务图；不是实际派发记录 |
| 条件目录 | `docs/design/` | 原始需求副本、bootstrap 及客户授权阶段的总体方案 |
| 文件 | `.ans/project.json` | 客户指示开发后的精确执行策略 |
| 条件目录 | `.ans/organization/versions/` | 客户接受组织后的不可覆盖组织版本 |
| 条件目录 | `.ans/missions/active/legion-permission/` | 客户授权的第一阶段 Mission |
| 条件目录 | `.ans/missions/active/legion-pi/` | 客户根据 Pi 通用 Agent v2 草案指示开发后的 Mission 与治理状态 |
| 条件目录 | `.ans/missions/active/legion-desktop/` | 客户确认 GUI v1 后的桌面 Mission 与治理状态 |
| 条件目录 | `.ans/handoffs/active/governance-legion/` | 治理到独立 Supervisor scheduler 的正式交接 |
| 条件目录 | `.ans/handoffs/active/governance-legion-pi/` | Pi 阶段治理到同一固定 Supervisor 的交接；其 acceptance 由 Supervisor 单独拥有 |
| 条件目录 | `.ans/handoffs/active/governance-legion-desktop/` | GUI 阶段治理到同一固定 Supervisor 的交接；其 acceptance 由 Supervisor 单独拥有 |
| 条件目录 | `.ans/events/` | 记录实际客户授权及接受组织版本的治理事件，不伪造运行时测试结果 |

用户要求的其余 `.ans` 固定路径只创建空目录。不允许当前 Governance 创建业务代码、测试代码、构建配置或伪造审批与 Event。2026-10-07 客户给出 Legion Runtime 六角色版本并明确指示开发，授权接受这六个定义、精确执行策略、v001 与交接；原九角色保留 SUPERSEDED 历史。已有工作区其他目录不可修改。

2026-10-07 客户在看到最新 Pi 通用 Agent v2 草案后指示“开发把”，授权该目标与必要的接入边界细化。Governance 可在上述治理位置建立新阶段授权、精确角色边界、配置与组织 v002，保留 v001 历史不可覆盖。`docs/design/` 的本任务范围包括该整体接入方案及其必要契约细节；角色实现文档和应用代码仍由各自固定 owner 完成。

客户随后直接要求“你整个运行都切换成node 把，后面发行也好发行点”，授权 Node 产品迁移与本地 npm 包验证。Governance 据此固定 v3 设计和精确 Node 文件所有权；包配置、入口、源码和测试仍由原固定项目角色完成，不扩展当前 Governance 的应用写权限。

2026-10-07 客户在看到已评审的 GUI v1（三页面、Windows Electron、O1任务启停未选）后明确回复“开发”，确认该版实施。Governance可接受DesktopEngineer及精确桌面源码/文档所有权、新阶段组织v003和执行配置；旧v002与已验证Node产物保留历史。当前Governance仍仅写治理与整体设计，不写桌面应用、测试或构建文件。
