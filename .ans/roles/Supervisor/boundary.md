# Section 1: 可修改文件与执行效果

客户已确认工作台v2；task writeSet只能缩小本清单。权限以本阶段精确策略与实际派发为准。旧历史产物和未列出的源文件只读。

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 文件 | `docs/roles/Supervisor/feature-map.md` | Supervisor独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Supervisor/functional-description.md` | Supervisor独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Supervisor/api-spec.md` | Supervisor独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Supervisor/changelog.md` | Supervisor独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Supervisor/docs/design/2026-10-07_design_desktop-workbench-v2.md` | Supervisor独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Supervisor/docs/architecture.md` | Supervisor独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Supervisor/docs/delivery-desktop-workbench-v2.md` | Supervisor独占 authored；实际任务需派发 |
| 条件目录 | `docs/scheduling/` | 仅task_ops生成本阶段记录 |
| 文件 | `.ans/handoffs/active/governance-legion-desktop/acceptance.md` | 本角色独占正式接收 |
| 条件文件 | `docs/scheduling/legion-supervisor-frontdoor-v1.md` | 固定 ANS Supervisor 经 task_ops 维护 Human 已接受的 Su v0.3 与 c8032728…精确配置实施记录 |
| 条件文件 | `docs/scheduling/legion-supervisor-frontdoor-v1-cli-repair-integration.md` | 固定 ANS Supervisor 仅经 task_ops 维护同一已接受 79 文件配置内的 CLI 当前确认选择修复及 PM→Desktop→Tester→Reviewer 重验；旧记录保留 |
| 条件文件 | `docs/scheduling/legion-supervisor-frontdoor-v1-su-cancel-repair-integration.md` | 固定 ANS Supervisor 仅经 task_ops 维护同一已接受 79 文件配置内的 Su 取消后连续对话必要修复及依赖重验；实际原 owner 子范围须先定位，旧记录保留 |
| 条件文件 | `docs/scheduling/legion-supervisor-frontdoor-v1-su-cancel-host-repair-integration.md` | 固定 ANS Supervisor 仅经 task_ops 维护同一已接受 79 文件配置内的 Desktop Host 取消恢复诊断、最小修复及依赖重验；Adapter 诊断图和旧证据保留 |
| 条件文件 | `docs/scheduling/legion-supervisor-frontdoor-v1-role-memory-race-repair-integration.md` | 固定 ANS Supervisor 仅经 task_ops 维护同一已接受 79 文件配置内的 Host 记忆 channel/CAS 竞争必要修复及依赖重验；旧图与失败证据保留 |
| 条件文件 | `docs/scheduling/legion-supervisor-frontdoor-v1-delivery-doc-close.md` | 固定 ANS Supervisor 仅经 task_ops 维护同一已接受范围内 PM 四份既有文档的交付状态关闭；产品与最终 tar 只读，沿原 desktop_dependency 固定门 |

固定检查可创建localhost受控协议服务、启动项目安装的Electron及仅关闭本次跟踪的进程。TEMP/userData/fixture/截图在自己的本阶段隔离生成路径；不得写旧runtime阶段、全局Pi配置或客户实际源码。递归清理前核对真实绝对路径属于自己的生成子目录且无链接跳转。
其他角色源码、治理/组织/角色/策略、旧Node tarball及旧GUI ZIP只读。客户确认具体计划后动态Agent执行已纳入v2；不启用任意Shell检查执行器。


项目 Shell v1 本阶段 scheduling 候选补充（精确配置尚待人类接受）：

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 条件文件 | `docs/scheduling/handwell-pm-approved-project-shell-v1.md` | 仅独立固定 Supervisor 在本配置真实人类接受后经 task_ops 创建/维护；Governance 不写运行记录 |

该精确记录仅用于本阶段，不扩展其他源码、治理、其他owner或旧任务记录。不得用已批准设计替代新配置SHA接受；只有真人接受配置后方可init/dispatch。保留原scheduler身份及旧证据。


同版项目 Shell v1 已批准 supplemental proposal 测试修复的 scheduling 精确澄清：

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 条件文件 | `docs/scheduling/handwell-project-shell-proposal-test-v1.md` | 仅固定 Supervisor 经 task_ops 维护已获真人精确哈希批准的同版单文件 Adapter 修复记录 |

依据独立授权记录 `.ans/decisions/handwell-pm-approved-project-shell-v1-proposal-test-config-authorization.md` 及精确 SHA `2a7025e194ed99920ea1c3ac687df4fa420d84488c50392247f3c877762c8a4a`。该补充使用同一被冻结Shell v1设计，属于本功能阶段的必要fixture兼容；不扩大六个执行owner、其他任务、业务源码或原配置权限。Governance不写schedule、不init/dispatch；运行验收仍需真实检查与现行candidate证据。


同版项目 Shell v1 已授权依赖读取兼容修复 scheduling 精确澄清：

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 条件文件 | `docs/scheduling/handwell-project-shell-dependency-read-repair-v1.md` | 固定Supervisor仅经task_ops维护同humanpin、同冻结v1设计的八节点依赖读取兼容修复记录 |

依据已接受主配置 `c872245f285125eae264b77ef4447a97fe0dcb14506c0e77f216d41003865ea4` 及 `.ans/decisions/handwell-project-shell-dependency-read-repair-v1-scope.md`。该记录属于本功能阶段必要修复，不扩大六owner源码权限，不修改冻结设计、原配置或原任务历史；Governance不写运行记录、不init/dispatch。


项目 Shell v1 Workspace Reader 补充及最终集成的精确 scheduling 澄清：

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 条件文件 | `docs/scheduling/handwell-project-shell-workspace-reader-v1.md` | 仅固定Supervisor经task_ops维护Reader双文件补充任务，必须先取得5c4f83a8…精确配置的真人接受 |
| 条件文件 | `docs/scheduling/handwell-project-shell-final-integration-v1.md` | 仅固定Supervisor经task_ops维护同c872245f…主pin最终集成；仅在Reader已独立合法验证后继续，writeSet不扩大主155文件 |

两个条件路径不授予业务源码或其他owner权限。六owner绑定输入及两份配置不修改。最终集成各相关readSet须显式包含 `apps/desktop/src/providers/impl/workspace.mjs` 与 `apps/desktop/tests/unit/workspace.test.mjs`，连同已验证Kernel/Adapter/PM0.8.1当前输入固定，读者依赖变化必须失效证据。双文件补充配置尚待真人接受，不可因此声明已派发；Governance不写运行记录、不init/dispatch。


同版项目 Shell v1 Model 时间事实纯度必要修复的 scheduling 精确澄清：

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 条件文件 | `docs/scheduling/handwell-project-shell-model-time-facts-repair-v1.md` | 固定Supervisor仅经task_ops维护同c872主pin、同冻结设计的必要Model纯度修复及依赖重验记录 |

具体范围及当前证据安排见 `.ans/decisions/handwell-project-shell-model-time-facts-repair-v1-scope.md`。仅本功能阶段条件路径，无六owner新增写权限；真实Kernel最小writeSet尚待评估，实际任务仍缩小主155范围。Reader Source/Tests两个当前输入必须在相关readSet明确，旧包/日志/失败证据保全；Governance不写运行记录、不init/dispatch。


同版项目 Shell v1 删除后缺失状态 GUI投影必要修复的精确记录路径：

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 条件文件 | `docs/scheduling/handwell-project-shell-absence-wire-repair-v1.md` | 固定Supervisor仅经task_ops维护同c872主155范围的Desktop wire必要修复及四节点独立重验 |

具体问题/最小行为状态见 `.ans/decisions/handwell-project-shell-absence-wire-repair-v1-scope.md`。不扩大六owner权限，0.8.2 tar/Kernel/Adapter/publicAPI不变，不重包；相关readSet必须固定Reader两文件和paused Tester实际输入，旧日志/截图/包保全。Governance不写schedule、不init/dispatch。


**CLI 优先 v1：新增角色边界**

客户已确认设计 SHA-256 `8800a806da30da543a326c160a02a885b7187ffedd0f1cc7429addfddb7fa3e5`。以下仅确立本阶段唯一归属；应用源码与测试仍须经客户审阅的精确 task_ops 配置及节点派发后修改。旧 Shell 验收与证据暂停且只读。

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 文件 | `docs/scheduling/legion-cli-first-v1.md` | Supervisor 本阶段独占；仅精确任务派发后可写 |

本边界不授权密钥持久化、旧 Shell 记录重验、其他角色源码写入或扩大产品内 Agent 权限。


**CLI 角色独占文件 v2：运行效果与调度记录**

本阶段产品运行时取消 task.writeSet，普通项目修改权来自当前持久角色 owner。开发角色的文件归属仍由本 Section 1 确定；ANS 开发派发列表只约束本仓库实施，不进入产品运行时计划。

Su CLI 当前确认选择修复依据 `.ans/decisions/legion-supervisor-frontdoor-v1-cli-repair-integration-scope.md`。它沿用 Human 已接受配置 SHA-256 `c8032728888d3652ce0987a94cb7ca84557c9ecf53bb3f27bb3f0df6d6b9e7b2` 与冻结设计 v0.3；不增加源码路径或角色权限。Governance 不写调度记录、不初始化或派发，旧 1.1.0 包及失败证据只读保留。

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 条件文件 | `docs/scheduling/legion-cli-role-owned-v2.md` | 固定 Supervisor 经 task_ops 维护本阶段记录；旧 v1 记录不续派 |
