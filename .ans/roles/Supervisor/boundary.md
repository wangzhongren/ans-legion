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


| 文件 | `docs/scheduling/legion-desktop-command-center-v1.md` | 项目指挥台精确配置接受后由固定Supervisor通过task_ops维护的本阶段唯一调度记录；当前待Human确认，Governance不写记录 |

Human已接受项目指挥台v0.3和精确超时修正版586fa7aa…：允许固定Supervisor经task_ops维护 `docs/scheduling/legion-desktop-command-center-v1.md` 并自动派发四既有角色。可信操作者私有计划/令牌仅写 `.ans/runtime/legion-desktop-command-center-v1/Supervisor/operator/` 新run，token不进文档或worker正文；协调锁/日志按task_ops工具既定生成路径，不授应用源码。


| 条件文件 | `docs/scheduling/legion-desktop-command-center-v1-shell-caller-integration.md` | Human已接受65文件补齐配置86dccc57…；固定Supervisor仅经task_ops维护当前T/R/PM文档集成，绑定原D/PM已verified来源，旧图与证据保留 |


| 条件文件 | `docs/scheduling/legion-desktop-command-center-v1-ui-repair-integration.md` | Human已接受66文件配置85c6197c…；固定Supervisor仅经task_ops维护既有Desktop UI必要修复、PM新候选包与独立T/R/PM关闭，原失败图/证据保留 |


| 条件文件 | `docs/scheduling/legion-desktop-command-center-v1-su-label-repair-integration.md` | 同Human已接受66配置85c6197c…内Su客户身份误标与实际GUI流程接线必要修复，固定Supervisor仅经task_ops维护，旧1.2.1与失败保留 |


**二哥展示改名 v1：已由真人接受的条件记录**

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 条件文件 | `docs/scheduling/er-ge-display-name-v1.md` | 固定 Supervisor 经已接受的本次独立改名方案及29文件配置，通过 task_ops 初始化、自动派发并维护 |

配置 `.ans/decisions/er-ge-display-name-v1-project.json`，SHA-256 `f27e36af6aca342b6644d305a8c56ca4590076812b9ab740ff10f54f680b6b5a`。生成证据及私有operator仅使用既有获准 `.ans/runtime/legion-desktop-command-center-v1/` 各owner根下全新 er-ge stage/run；旧1.2.2包与历史只读。无新增应用归属或权限。

2026-10-12 真人已接受上述二哥改名方案及29文件配置（call_c8153a14b05949d78b19b2c9774d1548，答复“确认并实施”），条件记录现可按精确配置执行。配置/方案保持确认时字节，既有执行owner边界未扩展。


**二哥依赖检查单文件补齐：真人已接受**

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 条件文件 | `docs/scheduling/er-ge-display-name-v1-dependency-integration.md` | 真人已接受30文件补齐配置，由固定Supervisor经task_ops初始化接续原D候选与PM/T/交付；旧图保留 |

配置SHA-256 `68d86b8f279e23f52a335f3d704492ebe85b0632047d1f9707a0fc458e6a318f`，原二哥方案不变。精确原因见 `.ans/decisions/er-ge-display-name-v1-dependency-scope.md`。2026-10-12 真人已通过 call_17adcf87fd8a48b2beb90eac65cbc2a7 批准，可按30文件精确配置派发。


| 条件文件 | `docs/scheduling/er-ge-display-name-v1-final-package-integration.md` | 同真人已接受30配置68d86b8f…内README当前称呼与事实修正后的fresh final-v2包接续PM/T/文档；固定Supervisor仅经task_ops维护，首诊断包和记录保留 |

此接续不新增源码路径、角色权限或设计变更，不重复同版真人确认。先结束旧在途固定门并保留证据，按原30配置派发原owner；新图readSet必须绑定真实final-v2 tar/package-smoke及已verified D来源，不在同图偷换旧tar路径。生成仍用既有获准根，旧包不覆盖。


**二哥侧栏主入口分组：真人已接受的条件记录**

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 条件文件 | `docs/scheduling/er-ge-sidebar-entry-v1.md` | 真人已接受7文件配置，固定Supervisor经task_ops初始化、自动派发D6/T1并维护 |

候选配置 `.ans/decisions/er-ge-sidebar-entry-v1-project.json` SHA-256 `afbcb443c97778f501467e93d1bd3792860e31f6c76e6e9ee17a3a5d844adb7f`，方案 `.ans/decisions/er-ge-sidebar-entry-v1-scope.md`。仅侧栏Interface与原owner测试/功能说明，生成沿既有获准根的fresh sidebar-entry stage；不新增Host或私有消息权限，不改版本、README或已冻结tar。

2026-10-12 真人已通过call_Pi1zzPGohNCbOcjDzhWFtbQs答复“按图实施”，上述侧栏7文件配置与方案生效。
