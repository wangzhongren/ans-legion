---
id: cli-role-owned-files-v2
type: design
title: CLI 第一版按角色独占文件授权
created: "2026-10-10"
updated: "2026-10-10"
timezone: Asia/Shanghai
status: draft
related: [cli-first-role-memory-supervisor-v1, governed-workflow, organization-and-acceptance, legion-file-ownership-and-agent-edit-v1]
events:
  - date: "2026-10-10"
    kind: created
    summary: Human 改为由当前项目持久角色 owner 决定修改权，替代旧任务 writeSet 方案
---

# CLI 第一版：角色拥有文件，任务只描述要做的事

Human 已在[本次要求](../../../../../.ans/decisions/legion-cli-role-owned-v2-requirement-and-scope.md)明确改变核心权限规则：运行时**没有每任务 `writeSet`**。一个执行角色能改的普通项目文件，直接由当前项目持久化的独占文件 owner 决定。计划仍说明目标、角色、依赖、检查和验收；Human 确认计划后才开始执行，但无需逐项列文件作为任务修改许可。新文件先分配唯一 owner，未分配或属于他人的文件不能创建、编辑、删除或由 Shell 发布。客户在 CLI 只确认可读的计划及角色归属变化，不输入、对照或反复确认 SHA。

本文替代 [旧 CLI 设计](2026-10-10_design_cli-first-role-memory-supervisor.md) 中一切基于任务 `writeSet` 的授权、检查覆盖、完成和返修规则。旧设计及旧九节点配置留作历史，不能据此继续派发；已停止的 Kernel 首节点未修改源码。仍保留已确定的 npm 安装后直接运行 `legion`、连续 PM 对话、后台角色独立上下文、产品内 Supervisor、项目内分类角色记忆和安全并行。项目 Shell 后续验收与新增页面继续暂停，本设计不增加新 Shell 功能。

## 当前事实与 PM 选择

当前计划/任务校验、文件 claim 与 transfer 从每任务 `writeSet` 推导；[Workbench Model](../../../../../apps/desktop/src/models/workbench.mjs) 同时把它写入 plan digest 和 task state。Pipeline 在 staging、Human 确认、角色 grant、写入、Shell 发布及“目标文件写齐”完成门使用它；[Organization Service](../../../../../apps/desktop/src/services/impl/organization.mjs) 用它做检查输入覆盖、Acceptance issue、repair 和部分发布恢复。[Kernel grant](../../../../../src/kernel/models/workbench.mjs)、[TaskDispatchContext/RuntimeAuthority](../../../../../src/kernel/models/agent.mjs)、[Policy](../../../../../src/kernel/services/impl/policy.mjs)、[ShellAuthorization](../../../../../src/kernel/models/shell.mjs) 与 [Shell Provider](../../../../../src/kernel/providers/impl/shell.mjs) 也取任务文件交集。因此不能只从 PM 提示词或 CLI 页面删字段；必须把这些交集同步换成可信角色 owner 校验。

PM 推荐保留项目 catalog 中的 `ProjectFileOwners` 作为**唯一运行时 owner 台账**：精确项目相对文件、唯一 roleId、单调 owner generation，并继续保存现有内部 digest 供版本兼容与不可变绑定。组织成员的 `boundary` 和 `organization.fileOwners` 表示 RoleArchitect 提案、PM 审阅后的**待生效归属**，不能单独授予正在运行的 agent。Host 比较它与当前项目 owner 台账，形成可读的新增 claim 与跨角色 transfer 差异；每项接收角色必须为已批准且启用的成员。只有 Human 确认包含这份差异的当前计划，项目 Provider 才以 CAS 一次提交新 owner generation。已有 owner 在无变更时跨计划持续有效。RoleArchitect 候选文档仍要求实际内容与已批准的内容摘要一致；PM 审阅不取代 Human 对 owner 变更的计划确认。

这个选择让角色拥有同一文件的权限可跨任务持续使用，同时避免组织/项目两份持久记录同时被当成许可。组织改变期间旧活动计划立刻失效；若 Human 拒绝新计划，项目 owner 台账不改变，组织提案差异保留为待确认事实，任何角色不得拿它写文件。角色提案省略旧文件不自动撤销其持久 owner；若职责改由另一角色承担，必须明确 transfer 并由 Human 确认。新增文件先以精确路径 claim；本版不增加 release 流程，不使用目录、通配符或“该角色能写整个项目”的替代物。

## 新计划、确认与运行授权

新 plan/task schema 为 v2：任务保留 `id/title/roleId/profileId/dependsOn/instruction/checks/accepts/generatedEffects/artifactScopes`，增加明确 `intent: change | verify`；**不接受** `task.writeSet`、基于它的 claims 或 repair.writeSet。`change` 任务完成须有本 run 的真实成功 Mutation/Shell 发布或经当前基线核验的恢复输出；`verify` 可不写文件，但仍需其已确认检查与必要 Acceptance。RoleArchitect 发布治理文档时还要满足已批准候选 SHA。Human 确认中显示每个任务目的、检查、依赖、独立验收、当前各角色可改的精确文件清单及本计划新增 claim/transfer 差异；文件多时可分页查看并显示总数，不能隐藏差异后只让用户确认摘要。

确认绑定 workspace 身份、plan/organization/profile/context 版本、owner base generation、owner 差异和当前检查/生成效果；Human 的一次肯定 `answerInteraction` 仍是唯一执行入口，普通“是”不授权。Host 先按当前组织批准记录验证 owner 差异及转交来源，再在项目 catalog CAS 中提交新的 owner generation，随后为各 Profile 建立共享 `ProjectFileOwners` 快照和受控权限。任一版本或角色归属变化撤销旧许可并要求新确认。角色权限是该 owner 快照内**全部由该角色独占的精确文件**，不是 PM 在单项任务里重新列出的子集；工具、检查和生成效果仍只授给当前已确认任务。

新发布版本的**所有标准活跃路径**，包括 `TaskDispatchContext`、`ConfirmedTaskGrant`、`RuntimeAuthority`、Policy 与 Workbench grant，均不接收任务 `writeSet`，必须使用可信 owner 快照和 owner generation；不保留可继续执行旧 v1 task grant 的分支。Host 从受信 owner 快照构造 `RoleBoundary.writeScope` 与每个实例的角色级 `AgentScope.write`。Model 在注册、issue、consume/recheck 对每个 proposal 的精确资源核对 owner roleId、owner generation、当前实例/run、工具及其 plan；缺失 owner 快照直接拒绝。无 owned 文件的任务不能得到源码写工具。`ProjectFileOwners` 的 case-insensitive alias/唯一 owner 检查继续适用。现有局部编辑 `expectedSha256` 仍防止旧读覆盖；它校验文件内容版本，**不是**文件归属授权。

只凭创建 authority 时捕获的 owner 快照不够：转交后旧实例可能继续持有旧许可。所有 CLI/Desktop 对同一物理项目须共用跨进程执行租约，锁键取可信物理 workspace 身份、锁根置于同一用户可共享的 Host 私有位置而非任意 `--user-data`；第二实例有有效租约时拒绝开始。单进程内 owner 转交先撤销该项目全部活动实例、等待已开始的受控提交结束，再在同一租约下更新 owner generation。每次源码 Mutation 与 Shell 源码发布前由可信 Host 在租约内重读持久 owner generation/角色映射并核对提案；不匹配即拒绝并使当前 plan 失效。Provider 真正提交前的授权重查必须处在同一租约/版本保护下，不能依赖模型传来的 owner、进程内队列或一次性启动快照。项目目录被外部修改仍按现有基线/审计规则拒绝。

SHA 用在确有内容身份需求的地方：`legion_edit_file` 的旧读 CAS，已批准角色文档内容，检查输入当前版本、候选文件/不可变证据和现有 plan/owner 内部摘要。owner 的**来源**仍是受信持久记录与角色 ID，版本/代数负责计划和授权失效；不新增每次普通写入前的全项目内容扫描、逐动作 SHA 审批或客户手抄长哈希。现有 Shell prepare/发布的受控库存与基线校验是该 capability 的原安全流程，本版不借此增加普通编辑扫描。

## 检查、Shell、验收与返修

检查规格仍是 Human 确认计划中的固定 `CheckSpec`，含明确 `testResources/inputResources/outputResources`。删除旧规则“`task.writeSet` 必须被 `inputResources` 覆盖”，也**不**改成“角色全部 owned 文件都须列进检查”。本轮实际成功修改/删除、Shell 源码发布、核验保留输出及依赖任务输出，Host 均按 task/run 记录资源与当前基线；运行检查时将 `CheckSpec.inputResources` 与这些**实际相关**资源一起纳入 `CheckAuthorization.inputVersions`。已核源码：Check Model 允许它是 `approvedCheck.inputResources` 的超集，Check Provider 遍历该版本集合，Service 核对 `inputDigest`，因此通常只需 Host 接线，不改 Check Model。检查结果须在最后一次相关 Mutation 之后取得，全部实际输出和必要依赖有当前输入版本、真实 passed 且 owner generation 未变，才可使任务通过。若输入预算超限或检查不能覆盖本轮实际输出，明确失败并由 PM 修订计划/检查；不截断、不用历史通过证据。`CheckSpec` 的 node-test argv、sandbox、无任意子进程等限制不变。

已有项目 Shell 若被角色任务调用，仍按每条请求由独立 PM 实例结构化审核、Host 一次许可、原隔离副本/候选/受控发布。新 `ShellAuthorization` 不再使用任务 `writeSet`：候选源码创建/覆盖/删除必须在当前 owner 快照中属于原请求角色，发布前按上述租约和 generation 再核；`generatedEffects`、artifactScopes 仍只来自 Human 已确认任务且逐请求声明，生成目录不是源码 owner 权。Shell 退出码 0 不替代当前 Check 或 Acceptance。旧 partial 记录不回滚、不重放许可；恢复须新 Human 计划、当前 owner、当前基线、新 PM 审核、当前检查与独立验收。旧 `writeSet` 只作为历史记录解释，不作为恢复许可。

Acceptance 对它 `accepts` 的开发任务读取当前检查及实际变更/依赖交接。失败 issue 必须指向其中一个真实 taskId 和精确 resource，Host 验证该 resource 当前属于该开发角色，并与该任务本轮输出或已确认检查输入相关；多项同角色任务可能涉及同一文件时必须按 task/run 证据明确归因，不能用“最新任务”猜测。Acceptance 仍只维护自己的独占测试/报告文件。PM 返修只派回原 roleId、原任务目标、原 checks 与已确认的轮次上限；repair 记录不含文件子集，原角色可改其当前 owned 文件。owner 转交、plan/check/profile/context 改变后旧返修失效，须新 Human 确认；不得把返修当隐式转交。开发 `change` 任务未实际改变文件、写入被拒、审计失败、检查过期或 Acceptance 未通过均不能报告完成。

## 并行、CLI 与项目记忆

有界 ready-set 由 Host 按已确认依赖计算。多个不同角色拥有互不重叠的精确文件，可让其独立 Pi 推理和受控写重叠；**同角色的可写任务一次仅运行一个**，因为它们共享整套角色 owner 文件，不能靠已取消的任务文件列表判冲突。跨角色检查读到其他正在写的文件时，检查须等待稳定版本或在重验时判 stale；Check/Shell 共享锁保护的命令无需并行。每任务独立 Agent/AbortController/日志/输出，组织/项目 CAS 状态串行合并，取消撤销全部活动许可。Supervisor 用独立 Pi 上下文作计划预检、异常建议，提交 Host 验证的 typed 建议；它不发 grant、不逐任务卡住 ready-set。

CLI 的单条 PM 对话、真实 Human 交互、环境密钥只在进程内、分类记忆由原角色提出/修订且项目全部角色可读，沿用旧设计中与 `writeSet` 无关的部分。PM 提示词、计划展示和 Desktop 现有任务详情必须改成“当前角色 owned 文件与本轮实际结果”，不显示虚构的“实际修改 x / 任务目标 y”。默认状态不暴露私有记忆、密钥或后台会话。第一版依然必须实际 `npm pack`、隔离安装后从 `node_modules/.bin/legion` 完成连续讨论、Human 确认、角色执行、并行、Check、Acceptance；根包收录唯一 Workbench Node 导入闭包，不复制第二套编排，也不加载 Electron 密钥服务。

## 旧数据迁移、兼容与回退

读取旧 schema/摘要时先原样验证，再保留 v1 plan、task、repair、Shell ledger、检查和对话为只读历史；含 `writeSet` 的 draft/running/pending 计划标为失效并撤销所有旧 grants、pending 工具答复和执行确认，绝不剥掉字段后沿用旧 digest。已完成结果仍可查看但不作为 v2 当前检查或 owner 权。当前 `project.fileOwners` 的精确映射直接作为 v2 owner 基线；若它与已批准组织定义不一致，展示待 claim/transfer 差异并等待新的 Human owner 确认，不能从旧任务 `writeSet` 补造 owner。新 plan 使用 schemaVersion 2、新 plan digest 与 owner generation，必须重新经过完整可读确认。旧 partial Shell 按新恢复条件处理。新发布版本的独立 PermissionRuntime 与 demo 同样改用角色 owner 契约；旧 v1 序列化 grant/permit 只读且不可执行，不提供运行时降级 API。

迁移须先取得上述跨进程独占租约并确认旧 v1 产品实例已退出；无法确认时拒绝迁移。先在隔离 userData 上演练中断/CAS，再以原子写与私有备份保存旧字节；迁移失败保持旧文件和权限关闭。降回只懂 v1 的包不能打开迁移后的 v2 项目并继续旧计划。仅在没有 v2 真实写入、所有进程已关闭且备份身份核对通过时可显式恢复旧数据；有 v2 效果时需新版本修复或受控导出，不能静默降级、自动删数据或把旧许可复活。旧 npm tar、Shell 验收记录和冻结证据不覆盖。

## 受影响 owner 与可执行门槛

| Owner | 关键 authored 文件与责任 |
| --- | --- |
| KernelEngineer | `src/kernel/models/agent.mjs`、`src/kernel/models/core.mjs`、`src/kernel/models/workbench.mjs`、`src/kernel/models/shell.mjs`、`src/kernel/services/impl/policy.mjs`、`src/kernel/providers/impl/shell.mjs`、`src/kernel/interface/demo.mjs`；`tests/kernel/test_agent_models.test.mjs`、`test_agent_scope.test.mjs`、`test_workbench_models.test.mjs`、`test_policy.test.mjs`、`test_shell_models.test.mjs`、`test_shell_provider.test.mjs`、`test_demo.test.mjs`（后六均在 `tests/kernel/`）。所有标准活跃入口移除任务文件交集，保留角色 owner/实例/工具/检查/生成绑定；Shell 源码候选改按 owner，demo 改用新契约。新增记忆/监督工具时同时扩 `AgentTools` 和 `core.mjs` 的 `controlledCapabilities`，只加工具名会缺 capability。`src/kernel/models/check.mjs` 已支持输入版本超集，本版通常无需改。 |
| AgentAdapterEngineer | `src/adapters/providers/impl/pi_session.mjs`、`tests/adapters/test_control_tools.mjs`、`tests/adapters/test_pi_provider.mjs`、`tests/adapters/test_proposal.mjs`：Pi Provider/Service 不直接读取 `TaskDispatchContext.writeSet`；Host 提供受信角色级 `scope.write` 后，Adapter 只更新 scope 提示和记忆/query/监督工具注册。确认这些控制工具只产生 `AgentControlDecision/Result`，不能走 Mutation 或带来 owner 变更。 |
| DesktopEngineer | `apps/desktop/src/models/organization.mjs`、`interaction.mjs`、`workbench.mjs`（后二位于同一 `models/`）；`apps/desktop/src/services/abstract/organization.mjs`、`public/organization.mjs`、`impl/organization.mjs`、`abstract/project.mjs`、`public/project.mjs`、`impl/project.mjs`（均在 `apps/desktop/src/services/`）；`apps/desktop/src/providers/impl/organization.mjs`、`impl/project.mjs`（均在 `apps/desktop/src/providers/`）；`apps/desktop/src/pipelines/workbench.mjs`、`apps/desktop/src/interface/renderer.mjs`。对应已有 `apps/desktop/tests/unit/organization-model.test.mjs`、`workbench-model.test.mjs`、`organization.test.mjs`、`acceptance.test.mjs`、`workbench.test.mjs`、`project.test.mjs`、`pipeline.test.mjs`、`ipc.test.mjs`、`shell-publication.test.mjs`、`shell-review.test.mjs`（均在 `apps/desktop/tests/unit/`）及 `apps/desktop/tests/integration/governed-workflow.test.mjs`；新并发/迁移/租约测试单列入边界。原 Desktop 只改现有任务/计划文字，不做新页面。环境 Profile、Headless 与租约新文件沿 CLI 目标由原 owner 建立。 |
| ProjectManager | `bin/legion.mjs`、新 `bin/chat.mjs`、`package.json`、`package-lock.json`、`README.md`、`tests/package/test_package.mjs`、新 `tests/cli/test_chat.test.mjs`、`apps/desktop/package.json`、`apps/desktop/package-lock.json`、`apps/desktop/scripts/verify-dependencies.mjs`、`apps/desktop/tests/package/desktop-package.test.mjs`：阶段性新 runtime tar 安装 Desktop，最终包收唯一 Host 闭包；旧 demo 兼容，安装消费者真实走 v2。 |
| Tester / Reviewer / Supervisor | Tester 新 `tests/integration/test_cli_installed_flow.mjs`；Reviewer `tests/reviewer/test_structure.mjs`、`apps/desktop/tests/reviewer/workbench-boundaries.test.mjs`、`governed-workflow-boundaries.test.mjs`、`shell-workflow-boundaries.test.mjs`（后二位于同一 reviewer 目录）及新 `tests/reviewer/test_cli_boundaries.mjs`。两者独立核查旧数据、转交竞态、并行、检查/Acceptance/取消与包；仓库 Supervisor 只用新任务记录派发、保全旧配置与暂停 Shell 证据，不编辑业务源码。新文件和开发任务配置的精确 writeSet 须先由治理分配给原 owner，它不成为产品运行时任务字段。 |

建议阶段门：① Kernel Model/Policy/Shell 对“同 owner 允许、他人/未归属拒绝、旧 task grant 拒绝、转交撤权、提交前 owner 变化拒绝”通过；② Adapter 三协议工具行为与拒绝通过；③ PM 新 tar 安装供 Desktop 消费；④ Desktop 新旧 schema/owner 差异和迁移、检查实际输出覆盖、Acceptance/repair/recovery、跨进程租约与同角色互斥通过；⑤ PM 最终包实际 `npm pack`、无源码仓库/无 Electron 的隔离消费者完整运行，Desktop 重新消费当前 tar；⑥ Tester 独立真实全流与 Reviewer 结构/权限验证后由 Supervisor 汇总。至少证明两个**不同 owner** 的 Pi 任务可重叠，属于同一角色的任务串行；Human 不被要求核对 SHA，普通写不新增全项目逐动作扫描。所有检查使用新阶段 fixture/userData/evidence；历史 Shell 检查不续跑。

本文是替代设计，应用代码、包与测试尚未按 v2 实施或验证。当前行为仍以 [PM 工作流](../feature/governed-workflow.md) 和 [Desktop 组织与验收](../../../DesktopEngineer/docs/feature/organization-and-acceptance.md) 为准。
