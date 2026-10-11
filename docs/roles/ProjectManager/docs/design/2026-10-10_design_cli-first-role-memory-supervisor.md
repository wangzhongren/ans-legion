---
id: cli-first-role-memory-supervisor-v1
type: design
title: 纯 CLI 项目对话、分类角色记忆与产品内 Supervisor
created: "2026-10-10"
updated: "2026-10-10"
timezone: Asia/Shanghai
status: draft
related: [governed-workflow, organization-and-acceptance, desktop-console, legion-governed-workflow-v1, legion-project-wide-read-v1]
events:
  - date: "2026-10-10"
    kind: created
    summary: 记录纯 Node CLI 优先、第四系统角色和项目内分类记忆的跨角色待实施方案
---

# CLI 优先：连续项目管理对话、角色记忆与产品内 Supervisor

## 目标与本次决定

第一版交付门槛是**真实 npm 安装后直接运行 `legion` 命令**，在普通 Node 进程中完成交互式项目工作流；仅仓库内运行不算交付。Human 进入一个项目后，只与 ProjectManager（下称 PM）保持一条连续对话：讨论需求、看到完整计划、明确确认或拒绝、观察执行及独立 Acceptance 结果。RoleArchitect、Supervisor、开发角色和 Acceptance 在后台拥有各自独立的模型会话与工作上下文；CLI 不把它们伪装成 PM 消息，也不要求 Human 切换角色。需要向 Human 提问、请求执行确认或报告失败时，由 PM 对话统一呈现，Host 保留真实来源与审计记录。

本版固定系统角色为 ProjectManager、RoleArchitect、Acceptance、Supervisor。Supervisor 是**产品内**角色，负责在计划确认前独立检查任务依赖、角色分工、可并行范围和验收覆盖，并在执行中依据真实 Host 状态提出阻断风险、返修建议及最终交付摘要；它不为每项任务提供新的模型批准，也不替代 Human 确认、PM 角色审阅、独立 Acceptance 或可信 Host 的权限判断。仓库内 `.ans/roles/Supervisor` 是开发调度身份，两者不共享运行权限或 `task_ops` 凭据。

模型密钥只从当前 CLI 进程环境读取，不写入配置、项目、日志、角色记忆、命令行参数或子进程环境。用户偏好记忆只属于当前项目，并作为有来源的项目知识供本项目全部角色读取。所有角色可读普通项目知识；文件修改仍只由已确认计划、文件 owner、当前任务 writeSet 和受控授权决定，记忆不能扩大权限。项目 Shell 后续验收与新增页面工作按 Human 当前要求暂停；旧候选、失败及通过证据原样保留，不用 CLI 方案重标结果。

Human 已明确选择 npm 安装包作为第一版门槛。开发中的串行、仓库内或未安装 smoke 只能作为里程碑；最终还需本版并行 ready-set、Supervisor、分类记忆和安装后真实流程一并通过。

## 已实现底座与缺口

| 现有事实 | 证据 | 本版缺口 |
| --- | --- | --- |
| 根命令只接受 `legion demo`；根 npm `files` 不包含 Desktop 源码。 | `bin/legion.mjs`、`package.json`、`tests/package/test_package.mjs` | 没有可交互的纯 Node 项目 CLI，也没有可安装的共用 Host 入口。 |
| 唯一 Workbench Pipeline 已实现项目选择、PM 对话、RoleArchitect 提案、计划绑定、Human 交互、执行、检查、Acceptance、取消和持久化；模块在普通 Node 中可导入。 | `apps/desktop/src/pipelines/workbench.mjs` | 可导入不等于完整 CLI 可运行：实际连接仍走 Electron 密钥解密；无 CLI 输出与环境凭据接线；任务执行为串行。 |
| `answerInteraction` 对 `execute_plan` 的肯定答复会调用 `#confirmPlanCore` 并开始执行；拒绝使草案失效。 | `apps/desktop/src/pipelines/workbench.mjs` 的 `answerInteraction`/`#confirmPlanCore` | CLI 只调用一次 `answerInteraction`，不可随后重复 `confirmPlan`。 |
| Desktop profile 密钥由 `SettingsProviderImpl` 通过 `electron.safeStorage` 加解密。 | `apps/desktop/src/providers/impl/settings.mjs`、`apps/desktop/src/services/impl/profiles.mjs` | 普通 Node 不能沿用默认解密路径；不能暗中启动 Electron 充当 CLI 密钥服务。 |
| 私有 `roleMemories` 按项目和角色保存摘要、来源覆盖集合与近期消息，自动压缩仍保留原始对话日志。 | `apps/desktop/src/models/interaction.mjs`、`apps/desktop/src/models/workbench.mjs`、`apps/desktop/src/services/impl/organization.mjs` | 它是上下文预算机制，不是明确的“踩坑／重大决定／用户偏好”事实库；现有来源只输入本角色上下文。 |
| 固定系统角色目前只有 PM、RoleArchitect、Acceptance，组织文档强制包含它们。 | `apps/desktop/src/models/organization.mjs` | 直接添加 Supervisor 会使旧三角色组织文档读取失败。 |

## 复用架构

保留**一个**可信 Workbench 编排核心。现有 `apps/desktop/src/pipelines/workbench.mjs` 模块在普通 Node 中已可导入；为它增加受信的 Headless 工厂，在内部构造环境 Profile Service，Desktop 原工厂仍构造 Electron Profile Service。两者共用相同组织、项目、权限、Pi Agent、计划、检查和 Acceptance Service。工厂只接收 `userDataDir` 与经校验的非秘密配置，不接受 renderer、模型或项目文件提供的任意解密回调。

为尽快得到**可安装**的同一核心，根包本版把现有 `apps/desktop/src/models/**/*.mjs`、`providers/**/*.mjs`、`services/**/*.mjs` 和 `pipelines/workbench.mjs` 的 Node 文件列入 `package.json#files`，连同新 CLI Interface 一起打包；根 `bin/legion.mjs` 在安装后的包内以相对路径导入这份唯一 Pipeline。`apps/desktop/src/interface`、HTML/CSS、Electron 主入口与 `apps/desktop/package.json` 不进入根包，避免形成嵌套 package scope 或把 renderer 带入 CLI。包内这些模块对 `legion-runtime/services/*` 与 `legion-runtime/workbench-models` 的引用由根包自身 `name/exports` 自引用解析；桌面源码继续通过自己的安装依赖解析同一公开 runtime 契约。构建只收集文件并验证导入闭包，不复制/改写第二份 Workbench，也不要求客户电脑存在源码仓库。待后续整理目录时可整体迁到共享 Host 路径，但不作为第一版额外重构门槛。

`electron.safeStorage` 仍只在 Desktop Settings Provider 被实际调用时动态导入；CLI Headless 工厂从不创建该 Provider，打包导入闭包检查要证明 Node 路径没有静态 Electron 依赖，真实安装消费者在**未安装 Electron** 的环境中完成连接和执行。CLI 环境凭据只在受信 Profile Service 内解析，既不能回落到 Desktop 密文，也不能把 Electron 当作隐藏后台进程。

CLI Interface 只负责终端输入、单条 PM 时间线的增量显示、Human 交互表单与安全的状态投影。它不直接调用 Core Interface、Mutation、Check 或 Shell Provider，不读取私有记忆正文，不把后台成员原始会话当成客户回复。后台结果进入现有项目、任务、验收与审计记录，PM 根据这些真实事实形成客户可读报告。终端关闭或信号中断必须调用现有取消/关闭路径，撤销本次活动许可并等待当前跟踪进程收束；重启只恢复事实和纯文本历史，不恢复旧 pending 工具、确认或执行许可。

直接复制 Workbench 到 `src/cli` 会产生第二套 plan digest、文件 owner、确认、Shell/Check、取消和恢复规则。两套规则随修复分叉后，桌面证据也无法证明 CLI 的安全性。因此本版允许一个新 CLI Interface 和一个环境 Profile 实现，但不复制编排、组织文档或权限核心。

## CLI 用户过程与错误语义

安装后的用户入口为 `legion chat --project <绝对项目目录> --user-data <绝对数据目录> --protocol <协议> --provider <供应商> --model <模型> [--base-url <地址>]`；`legion demo` 保持兼容。项目目录和数据目录必须物理隔离，使用现有 Workspace/Project Provider 的身份与路径检查。密钥变量名在实现时固定并文档化（建议 `LEGION_API_KEY`）；启动时检查非空，进程内仅传给受信 Pi Provider，缺失或不可用则失败关闭。协议、供应商、模型和地址是非秘密的显式参数；首版可用同一个进程环境 Profile 映射全部角色，角色上下文仍各自独立。若计划指向当前 CLI 不存在的其他 Profile，明确拒绝并请 PM 修订计划，不能静默换模型。

TTY 中自然语言行送入 `sendMessage({projectId,roleId:'ProjectManager',text})`。CLI 只增量显示 PM 时间线和真正需要 Human 回答的 `discussion` 提问。计划草案显示目标、角色、任务、writeSet、依赖、检查、Acceptance、当前绑定摘要与失效条件；Human 明确回答现有 `execute_plan` 请求。肯定回答一次 `answerInteraction(value:true)` 已完成确认和启动；否定回答使草案失效。执行期间可用 `/status` 看有限任务/检查/验收状态，`/cancel` 撤销当前对话或执行，`/exit` 安全关闭；非 TTY 启动时不给隐式“是”，需要明确受支持的交互输入，否则拒绝执行。CLI 不能接受普通文本“yes”作为授权。

并发事件、重复输入、过期 request digest、计划/组织/上下文/Profile/owner 变化须沿用 Workbench 的 `conversation_busy`、`execution_busy`、`stale_interaction`、`plan_changed` 等受限错误；CLI 用中文解释可重试的下一步，保持安全错误码与原始失败事实，不输出 SDK 原文、密钥、私有模型上下文或客户秘密。网络/认证失败停止当前轮次；检查失败、Acceptance 否决或任务失败显示真实状态，由 PM 讨论返修或新计划，不自动宣布完成。Ctrl-C 第一次走取消和资源关闭，重复信号不跳过已启动的关闭承诺。

进程环境密钥有继承风险：CLI 启动后不应把完整 `process.env` 交给 Node Check、项目 Shell、npm 或其他子进程。现有受控 Provider 使用白名单环境，实施时必须以带 canary 的真实测试核对这条跨进程边界。环境 Profile 的 `profileVersion` 在同一进程内稳定，并绑定非秘密配置及本次进程凭据世代；重启或密钥变化让旧计划失效并要求重新确认，不能把密钥本身或其可离线猜测的裸摘要持久化。Desktop 已保存的 Electron 密文不由 CLI 解密、迁移或降级为明文。

## 组织、记忆与来源迁移

Supervisor 加入固定职责、system 状态与独立角色会话；旧组织读取先按旧 schema/digest 验证原文，再以显式版本迁移补齐 Supervisor，保留原成员、owner、提案、时间线、`roleMemories`、任务和审计历史。新组织有新 revision/digest；旧待确认计划与旧 `execute_plan` 请求因组织变化失效，需要 Human 在当前组织下重新确认。迁移必须支持中断重试、CAS 冲突和旧档重复读取，不能通过给旧对象硬塞新字段来绕过原 digest。旧 `roleMemories` 的摘要、covered/sourceDigest 与近期消息仍按原版本解释，不把它们自动升格为分类事实。

新增项目内分类记忆集合，独立于 `roleMemories` 的压缩字段：`factId、projectId、ownerRoleId、kind、statement、sourceRefs、sourceDigests、createdAt、revision、status、supersedes`。`kind` 仅 `pitfall | decision | preference`。采用**受控工具提交 + Host 确定性来源登记**：Human 回答、已确认计划、真实 Check/Acceptance/任务失败由 Host 登记为不可由模型伪造的来源；执行角色、PM、RoleArchitect、Supervisor 仅在自己的活动 run 中用 `legion_remember_fact` 提交 `{action:'add|revise|retract',factId?,kind?,statement?,sourceRefs?,expectedRevision}`，Host 从可信 run 绑定 `projectId/ownerRoleId/instanceId`，不接收模型自报 actor、时间或证据摘要。旧摘要不会自动生成事实；不存在“模型说过所以记住”的隐式导入。工具成功返回带 `factId/revision/status` 的 typed 结果；失败返回安全原因，原历史不变。

来源逐类校验：`decision` 只能引用当前项目真实 Human 明确确认的计划字段或已答复的 Human 决定；`preference` 只能引用 Human 原文/明确选择，且本版仅当前项目生效；两者 `statement` 必须是来源中的短原文摘录或 Host 可确定的结构化值，不接受模型释义冒充 Human 事实。`pitfall` 必须引用本角色实际失败、未通过检查、Acceptance 问题或已验证项目证据，记录具体失败码/资源/证据 id；成功日志和自动摘要本身不足以证明踩坑。Host 对三类都校验来源 id、当前 digest、项目一致性、事实与来源允许的字段、大小预算和受保护路径，绝不把提案当成权限或验收通过。语义推断另放非事实备注；无法核对的提案拒绝，并可由 PM 在对话中向 Human 求证。

`legion_query_memory` 是所有项目角色可调用的只读控制工具，输入仅 `{kind?,cursor?,limit?}`，项目与 actor 由 Host 绑定；按项目、kind、游标返回**所有 owner** 的已生效事实及有限来源标签。Host 也在每次角色启动时按预算注入同一事实视图。查询不返回原始 Human 全文、SDK/工具原文、私有摘要或密钥。只有原 `ownerRoleId` 的当前受信 run 可用 `legion_remember_fact` 携带 `factId/expectedRevision` 修订或撤回己方事实；修订建新 revision，撤回留墓碑及 supersedes 链，旧事实不再注入，其他角色只能提出更正请求给 owner/PM。Human 可以通过 PM 要求原角色更正；若来源被撤销或 digest 变化，Host 将事实标为 stale 并停止注入，不能静默沿用。普通项目文件继续通过既有受控 Read Service 读取，项目全角色读记忆不扩大局部写权。

写入前 Host 只从 Human/计划摘取短可核对片段或从检查/验收提取安全结构化元数据；不保存 raw stdout、SDK 原文、环境变量、凭据字段或受保护文件正文。对已知当前密钥做精确值排除，并对疑似 token/密钥格式及控制字符拒绝；过滤无法证明安全则不持久化。保存与查询 DTO 都限制长度、数量和来源，记忆正文不进入默认 CLI/renderer 状态投影。当前 Human 输入、已确认计划及规范角色/owner 优先于分类事实和本角色近期历史；预算不足压缩可压缩历史或明确拒绝，不能截断当前授权事实。记忆始终只作数据，不恢复旧 pending 工具、执行许可或检查结论。

## Supervisor 与并行执行

Supervisor 在 PM 形成完整草案后，由 Host 以独立 `AgentInstance`、受限工具集与自己的 `roleMemories`/分类记忆视图运行一次预检；输入是当前 plan/organization/owner digest、依赖图、检查/Acceptance 覆盖等 Host 事实。它用 `legion_submit_supervision` 返回 typed `{phase:'preflight',planDigest,findings:[{severity:'info|warn|block',taskIds,sourceRefs,reason}],recommendation:'proceed|revise'}`。Host 核对真实 Supervisor instance/run、计划 digest、task/source ids、来源 digest 与预算，原样保存建议；不接收模型生成的 grant、task 状态或执行指令。预检无合法终态时显示“未完成预检”并由 PM 重试，不把它写成“通过”。PM 修订或向 Human 展示有来源的阻断建议，Human 仍只确认当前 Host 计划。

执行中 Supervisor 可在 Host 检测到阶段变化、失败或返修时，用同一工具提交 `phase:'monitor'` 的风险与建议；事件触发而非每任务审批。`severity:block` 是建议标签，不能单独暂停已确认 ready 任务；只有 Host 独立验证的权限、依赖、版本、检查或 Acceptance 不变量会阻断调度。Supervisor 的建议进入 PM 可读的内部事件，由 PM 在唯一客户对话中解释，不把原始 Supervisor 会话展示给客户。可信 Host 依据已确认计划计算 ready-set，只有先决任务完成、当前授权仍有效、writeSet 与生成效果不冲突且共享项目锁可取得的任务才可并行。Acceptance 只在它覆盖的开发任务及必需检查有真实结果后运行，不能与所验收任务竞争同一文件。

现有 `#executePlan` 串行，且 `active.agent`、`checkAbort`、`readAbort`、`memberLog` 是单槽。并行不是把循环换成 `Promise.all`：须改为每任务独立 Agent/AbortController/日志/Check/Shell 状态与输出，项目保存及组织 CAS 更新仍串行提交，失败传播和全局撤权覆盖所有活动任务。默认有界并发建议 2；同一文件、owner 转交、生成目录重叠、共享项目级状态操作以 Host 锁串行。并行度只影响调度，不扩大 read/write/工具权限。A/B/C 可先形成串行垂直里程碑，但 **D 的真实并行 ready-set 是本版最终交付必需项，不能省略或以串行结果代替**。本版只承诺无冲突任务的独立 Pi 推理与受控写可重叠，不承诺同项目 Check、Shell 或任意命令并行。CLI 第一阶段不以项目 Shell 新验收作为前置；已有 Shell 请求继续走原逐调用 PM 审核与隔离，未支持平台失败关闭，绝不降为裸命令。

## 影响与边界：PM 审核意见

KernelEngineer 与 AgentAdapterEngineer 的独立只读评估支持复用现有 Pi Service：可创建多个互相独立的实例并发，单个 `single_run` 实例只启动一次；限制主要在 Desktop Pipeline 的单槽活动状态。新增 remember/query/supervise 控制工具要由 Kernel 扩 [AgentTools 与 AgentControlTools](../../../../../src/kernel/models/agent.mjs)，Adapter 扩 [Pi customTools 映射](../../../../../src/adapters/providers/impl/pi_session.mjs)；现有 `payload` 加 `AgentControlDecision/Result` 的 typed 回传形状可复用，无需另造授权结果通道。Host 仍独立核对记忆的原角色本地写、项目全角色读，以及 Supervisor 建议的真实 run/来源/计划绑定。

同项目 [Check](../../../../../src/kernel/providers/impl/check.mjs) 和 [Shell](../../../../../src/kernel/providers/impl/shell.mjs) 使用共享项目锁，实际命令可能串行；[Mutation 队列](../../../../../src/kernel/providers/impl/storage.mjs) 只协调本进程内同一 workspace。[组织 Service](../../../../../apps/desktop/src/services/impl/organization.mjs) 的事务队列/CAS 与 [项目 Provider](../../../../../apps/desktop/src/providers/impl/project.mjs) 的目录锁必须在并行任务提交时串行合并，不能让两个任务各自保存旧快照覆盖对方。第一版对同项目的 CLI/CLI 或 CLI/Desktop 多进程运行增加 Host 单实例租约；已有有效租约时明确拒绝第二执行实例，不把进程内队列误当跨进程互斥。租约不代替现有逐次授权和实际文件版本检查。

PM 建议按上述边界实施：先扩有限工具契约与可信 Host 来源/CAS，再把每任务运行状态拆开，最后用真实安装消费者证明两个无冲突 Pi 任务的推理和受控写发生重叠，同时证明 Check/Shell 锁、冲突资源、取消和 Acceptance 顺序仍正确。非 macOS 的现有 Check/Shell 为 unsupported；CLI 不能因目标是纯 Node 就改用未隔离命令。以上是设计审核判断，不是已通过的实现或跨平台验收。

## Owner、文件与阶段

以下是**候选影响范围**，不是本设计文件授予的写权限。各 owner 仍须在相应边界及精确任务派发后实施，Review/Tester 独立验证。

| 阶段 | 唯一 owner 与候选文件 | 具体交付 |
| --- | --- | --- |
| A. 契约、CLI 与根包布局 | ProjectManager：`bin/legion.mjs`（当前未列任何角色边界，先补归属）、`package.json`、`package-lock.json`、`README.md`、`tests/package/test_package.mjs`；DesktopEngineer：`apps/desktop/src/pipelines/workbench.mjs`、相应 Host/测试 | Headless 工厂、根命令 demo/chat、上述唯一 Workbench Node 导入闭包进入根包白名单；第一版不依赖未打包的仓库路径。 |
| B. Node 环境 Profile | DesktopEngineer：`apps/desktop/src/services/abstract/profiles.mjs`、`services/public/profiles.mjs`、`services/impl/profiles.mjs`、`providers/abstract/settings.mjs`、`providers/public/settings.mjs`、`providers/impl/settings.mjs` 或另设受限环境 Provider，以及 `apps/desktop/src/pipelines/workbench.mjs`、对应 unit | 可信 Profile Service 选择 Electron 加密实现或 CLI 环境实现；密钥不持久化、不进状态/子进程；旧 Desktop Profile 行为不变。新路径需 Governance 精确加入边界。 |
| C. 第四系统角色与记忆工具 | KernelEngineer：`src/kernel/models/agent.mjs` 的受限控制工具名与既有 Model tests；AgentAdapterEngineer：`src/adapters/providers/impl/pi_session.mjs` 的 customTools、相邻公开 Service 与 Adapter tests；DesktopEngineer：`apps/desktop/src/models/organization.mjs`、`models/interaction.mjs`、`models/workbench.mjs`、`services/impl/organization.mjs`、`services/public/organization.mjs`、`providers/impl/organization.mjs`、`pipelines/workbench.mjs` 与既有组织/记忆测试 | 原 owner 分别接线 `legion_remember_fact`、`legion_query_memory`、`legion_submit_supervision` 的有限 schema，复用现有 payload/control typed 结果；Host 校验真实 actor/source/CAS，迁移旧组织与摘要，Supervisor 独立会话，输出安全投影。新增文件须先获精确边界。 |
| D. 本版必需并行 ready-set | DesktopEngineer：`apps/desktop/src/pipelines/workbench.mjs`、`apps/desktop/src/models/workbench.mjs`、组织/项目 Service 及对应 tests；如权限 Model 需变则由 KernelEngineer 维护 `src/kernel/models/agent.mjs`、`workbench.mjs` 与对应 Service；Pi 会话变动仅由 AgentAdapterEngineer 维护 `src/adapters` | 每任务隔离活动状态、冲突与锁、取消、真实 checks/Acceptance；A/B/C 串行里程碑之后必须完成并验收本阶段。 |
| E. 第一版安装交付与独立验收 | ProjectManager：根包白名单/锁/发行说明及包测试；DesktopEngineer：同一 Host 的 Headless/Desktop 接线；Tester：安装消费者中的 CLI 端到端、真实 Node/三协议模拟、取消/重启/迁移/并行/机密 canary；Reviewer：结构、归属与授权审查；Supervisor：仅 `task_ops` 调度与证据汇总 | 实际 `npm pack`、隔离离线安装、在无仓库源码和无 Electron 的消费者中运行 `node_modules/.bin/legion chat` 全流程，并重验原 Desktop 消费者。新文件 owner 先获精确治理边界。 |

阶段 A/B/C 的串行垂直里程碑必须实际跑通：纯 Node 选项目→多轮 PM 讨论→真实 RoleArchitect 提案/PM 审阅→Supervisor typed 预检→显示准确计划→Human 明确确认→至少一个开发角色执行与真实 Check→独立 Acceptance→PM 汇报；取消、拒绝、重启失效、密钥缺失/泄漏、旧组织迁移、分类记忆的写入/跨角色查询/撤回同时验证。这只是开发里程碑，不是第一版交付。Supervisor 的预检与失败建议须有真实独立会话及 Host 验证记录，不能只显示角色名字。阶段 D 以两个互不冲突的 ready 任务 Pi 推理/受控写真实重叠、冲突任务不重叠、同项目第二进程租约拒绝、取消全撤权及 Check/Acceptance 顺序为本版必需项；不要求共享锁保护的命令重叠。阶段 E 用真实 tarball、`npm pack --dry-run` 清单、安装包文件摘要及隔离消费者验证：`node_modules/.bin/legion demo` 保持；`legion chat` 无仓库源码、无 Electron 地跑完整确认/并行/Acceptance 流程；根包 `exports` 自引用解析及 Desktop 当前 tar 消费者重新绑定并通过相关回归。不得把源码直跑或 pack dry-run 代替安装后结果。

这些检查要用本阶段新的独立 fixture、userData、临时包和证据目录，旧 `.ans/runtime/handwell-...` 的 frozen tar、日志、截图、快照及 task_ops 状态只读。既有 Shell 修复任务可能与 `apps/desktop/src/pipelines/workbench.mjs`、组织模型、package tests 共用输入；暂停其后续验收与 CLI 代码派发应由唯一仓库 Supervisor 在任务记录中明确协调，避免同一候选被不同阶段改写或把旧检查冒充 CLI 当前证据。本文不修改这些任务状态。

## 已确认交付门槛

Human 已选择首版必须从真实 npm 安装包直接运行 `legion`，所以阶段 E 与 D 一样是本版必达门槛。仓库内 CLI 只用于开发调试；第一版不能依赖 `apps/desktop` 的未打包路径、Electron 进程或旧本地 tarball 的历史通过记录。

本文件是待实施设计；CLI、分类记忆、产品内 Supervisor 与并行 ready-set 尚未按本方案实现或测试。现有功能以 [PM 工作流](../feature/governed-workflow.md) 和 [Desktop 组织与验收](../../../DesktopEngineer/docs/feature/organization-and-acceptance.md) 为当前入口；本方案不改写其当前行为说明。
