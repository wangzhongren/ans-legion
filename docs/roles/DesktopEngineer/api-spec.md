# DesktopEngineer 当前公开接线

图片输入候选接口：`stageImage({projectId,mimeType,data}) → {ref:PiImageReference}`，`discardImage({projectId,ref}) → null`，`readImagePreview({projectId,ref}) → {ref,data}`；`sendMessage`在原三字段后可选`imageRefs:PiImageReference[]`，有图时文本可为空。`ref`仅含`projectId,attachmentId,sha256,mimeType,byteLength,width,height`，图片原字节/base64不进入`getState`、Org JSON、角色日志或审批事实；历史预览是当前项目显式有限读。每图仅PNG/JPEG、≤4MiB/边≤8192/像素≤16MP，本轮≤4图/8MiB，恢复和当前网络合计≤8图/16MiB。旧无图输入、历史和CLI仍保持原字段。真实阶段证据以`desktop-image-input-v1`固定门为准。

> 2026-10-12 当前项目指挥台契约以本节和下方“项目指挥台只读查询”为准。较早章节记录历史阶段的 PM 客户入口、task.writeSet 与成员原文页；当前产品由“二哥”唯一对客，内部仍以 `Supervisor` 标识，角色精确 owner 决定写权，原文不公开。

客户聊天标签属于 Interface 投影：Human 为“你”，所有当前客户助手回复为“二哥”，`kind:question` 的实际持久问题显示“二哥 · 转达待答复问题”。这不改 timeline 的 `kind`、`requestId`、答案绑定或原问题文字，也不把后台 PM 变成客户发送入口。默认连接的设置标签是“默认二哥对话连接”；后台 PM 仍用其项目角色映射/已保存连接规则，Shell 审核与返修事实仍明确标 PM。计划协议 fallback 与无计划引导只在客户区使用二哥名称，后台 RoleArchitect/PM 原身份在角色区保持。窗口和 HTML 标题均为“二哥项目指挥台”；CLI 仍以 `roleId:Supervisor` 调用同一 Host。

桌面唯一入口为`apps/desktop/src/interface/main.mjs`，Interface→WorkbenchPipeline→public Services→public Providers，Model共享。生产从安装包`legion-runtime/workbench-models`及`services/{policy,mutation,read,proposal,pi-agent,check}`接线，不引用源码开发树或Kernel Interface。[完整功能](docs/feature/organization-and-acceptance.md)、[canonical设计](../ProjectManager/docs/design/2026-10-08_design_legion-governed-workflow.md)。

## 启动、IPC与关闭

`startDesktop({userDataDir?,initialWorkspace?,show?})`返回`{readiness:{ready,windowId},close}`。root bootstrap管理app生命周期。窗口关闭同步撤销授权/信号，再等待SDK、检查与审计结束；close幂等。Electron使用nodeIntegration:false/contextIsolation:true/sandbox:true，固定preload、CSP、导航与webview拒绝。IPC核对精确webContents、mainFrame和documentURL，原生目录选择返回后再核对一次。

| 操作 | 精确输入 | 结果 |
| --- | --- | --- |
| getState | {}或{force:boolean} | WorkbenchDTO |
| chooseProject / refreshProject | {}；chooseProject只能由原生目录选择 | WorkbenchDTO |
| setDefaultProfile | {profileId} | WorkbenchDTO |
| saveProfile | {id?,name,protocol,provider,modelId,baseUrl,keyAction,apiKey?} | WorkbenchDTO |
| deleteProfile | {id} | WorkbenchDTO |
| assignProfile | {roleId,profileId:string或null} | WorkbenchDTO |
| sendMessage | {projectId,roleId:Supervisor,text} | WorkbenchDTO |
| selectContext | {projectId,resources} | WorkbenchDTO |
| answerInteraction | {projectId,requestId,version,requestDigest,value} | WorkbenchDTO |
| closeInteraction | {projectId,requestId,version,requestDigest} | WorkbenchDTO；无答复效果 |
| confirmPlan | {projectId,planDigest,requestId?,version?,requestDigest?}；只接受已由真实Human答复的当前请求，缺nonce不授权 | WorkbenchDTO |
| cancelTurn / stopExecution | {projectId,turnId} / {projectId} | WorkbenchDTO |
| testConnection / cancelProbe | {profileId} / {probeId} | ProbeDTO / null |
| listProjectFiles | {projectId,resource?:相对目录,cursor?,limit?:1..200} | ProjectReadResult 的有限目录页 |
| readProjectFile | {projectId,resource:普通相对文件,startLine?:正整数,maxBytes?:1..65536} | ProjectReadResult 的文本片段、SHA、nextLine、complete |
| queryRoleActivity | {projectId,roleId?,taskId?,planDigest?} | 当前角色/任务状态、阻塞与来源摘要 |
| queryRoleLog | {projectId,roleId,taskId?,planDigest?,cursor?,limit?:1..50} | 仅行动元数据、来源摘要、快照游标 |
| queryProjectFacts | {projectId,kind:changes\|checks\|acceptances,taskId?,planDigest?,cursor?,limit?:1..50} | 实际修改、当前检查或独立验收的来源绑定页 |
| queryProjectOutputs | {projectId,taskId?,planDigest?,cursor?,limit?:1..50} | 实际发布与生成产物页；过期状态可见 |
| queryProjectMemory | {projectId,kind?:pitfall\|decision\|preference,cursor?,limit?:1..50} | 本项目来源验证分类事实页，不修改记忆 |

Result为`{ok:true,value}`或`{ok:false,error:{code,message,field}}`。主进程重建有限投影，隐藏私有root/credentials/SDK原文/授权对象与stack。`getState` 保留二哥客户 timeline、当前计划/任务/角色、有限监督和最近摘要；成员原始 journal 的 runs/events 不传，Check 原始日志与输入版本细目、Shell 命令/审核文字/输出/完整发布列表不传。详细事实只能按上表分页查询。角色定义独立revision/digest，activity是当前Host状态而非长期身份。未知操作/字段、伪来源、任意agent start和非 `Supervisor` 直接chat拒绝。

`createWorkbenchPipeline({userDataDir})`返回上述操作（chooseProject替换为`selectProject(trustedRoot)`）及close。工厂无Services/SDK注入。Impl只用于当前层聚焦测试。Interface调用本Pipeline；唯一Pipeline组合公开Services，不互调peer Services，也不让Provider回调Pipeline。

## 项目指挥台只读查询（当前）

所有新查询由 Workbench Pipeline 的独立有限读通道受理。输入 `projectId` 必须与当前选择一致；Host 在查询前后核当前项目、物理根身份、authority epoch 与运行 generation，失效返回安全错误。它们不调用 `selectContext`、不更新 plan/owner、不开启模型轮或签发工具许可。`listProjectFiles`/`readProjectFile` 使用公开 Kernel Read Service 的 typed request 和原 Storage 路径/预算/no-follow 限制，Host 生成私有 requestId/runId；renderer 不能传绝对路径、模型 actor、授权、用户数据目录。

`queryRoleActivity` 返回当前 planDigest、history 标记、roles 的 `{id,activity,phase,sourceRef}` 与 tasks 的 `{id,roleId,status,phase,checkStatus,acceptanceStatus,blockingTaskIds,observedChanges,checks,acceptances,sourceRef}`。`queryRoleLog` 调用 Organization 独立客户 `inspectRoleLog`，复用纯 `roleLogPage`：最多 50 项/32 KiB、项目/角色/任务/计划筛选、来源摘要固定页游标；仅 `{kind,tool,status,reason,resource,checkId,createdAt,sourceRef,...身份字段}`，没有 `assistant_text`、`host_briefing`、原始工具参数/结果。

`queryProjectFacts` 的 changes 仅取真实任务 `results`，包含成功、拒绝、缺失、审计失败与 SHA；checks 仅取指定计划与实际 task run 对应的当前 CheckResult，有限返回 executed/status/testCount/inputDigest/stdout/stderr；acceptances 仅取真实独立验收、evidenceIds 与 issue。`queryProjectOutputs` 仅取持久 `generatedOutputs` 和已记录 Shell `publishedResources`；当前生成资源比对原 Organization inventory 的生成摘要，不匹配为 stale，旧计划为 historical。所有页最多 50 行/32 KiB，游标绑定项目、计划、kind、来源摘要和 offset，数据改变后返回 `stale_cursor`，不能混合旧页和新页。没有旧正文时不返回伪造 diff；计划里只声明的目录不成为产物。

`queryProjectMemory` 经 Memory Service 的独立 `inspect` 读取。它按当前项目真实 registry 计算来源是否 stale，保留 `pitfall`、`decision`、`preference` 的事实文本、作者、修订、状态和有限来源标签。inspect 不调用原模型 `query` 的 staleView CAS 写，不接受 renderer actor/run；它不创建、修改或撤回事实。执行中二哥的 `delegate_pm`、`remember_fact` 和 `request_interaction` 在 Host control-tool 被拒绝；只读文件、行动与记忆检查保持可用，worker 的当前授权与 runId 不因浏览撤销。

`services/public/organization.mjs` 新增 `inspectRoleActivity/inspectRoleLog`，与仍要求真实 Supervisor actor 的模型工具 `queryRoleActivity/queryRoleLog` 分开；`services/public/memory.mjs` 新增 `inspect`，与角色 `query/remember` 分开。Interface 的 `publicQueryDTO` 对每种响应重新限定根字段与行字段；不直接透传 Service 对象。旧公共成员 journal 被投影为空，原私有 journal 持久存储与工作记忆来源继续由 Host 内部读取；Shell 公共 state 只有最近 32 条无正文状态，Check 公共 state 只有最近 32 条无原始日志摘要。

分页调用约定：`cursor?` 是**字段可省略**，不是空字符串占位。首次请求省略该字段；只有上一页给出非空 `nextCursor`（记忆为 `cursor`）才在追加请求带回原值。角色日志把显式 `cursor:''` 判 `stale_cursor`，分类记忆把它判 `invalid_input`；Renderer 不改这两条验证规则。游标失效时清除该页保存游标并隐藏追加按钮，安全错误保持可见；若追加按钮持有键盘焦点，焦点移至该区“刷新”。文件、修改、产物、检查与验收首页也统一省略 cursor。角色状态 `phase:not_recorded` 仍是 Host 原值，界面仅显示“尚未运行”；`waiting` 与 `waiting_answer` 分别显示“等待任务”和“等待你的答复”。

900px 及更窄的可折叠项目侧栏复用原项目列表、AI 连接和主题按钮，不新增 IPC：顶栏“项目与设置”按钮维护 `aria-expanded`，Escape/背板关闭回按钮，项目目录选择返回后回按钮，转设置或角色区则聚焦目标控件；扩大到宽屏时清除窄窗抽屉状态。无活动计划保存默认连接的提示只说明未来讨论使用新连接，只有 draft/confirmed/running 活动计划才宣称失效。以上均是显示与分页接线修复，不改变计划/权限或执行中的只读查询。

## 组织Service与Provider

`services/public/organization.mjs:createOrganizationService({userDataDir})`返回冻结接口。可信actor是与payload分离的`{projectId,roleId,instanceId}`；Human答复为`{projectId,roleId:Human}`。Pipeline从真实实例取身份，不能相信payload.roleId。

| 方法 | 行为 |
| --- | --- |
| load(project) | 读取/创建完整事务；从旧plan/fileOwners迁移legacy |
| submitProposal(project,input,actor) | RoleArchitect提交{id,version,members,transfers?}到版本台账 |
| reviewProposal(project,input,actor) | PM精确{proposalId,version,digest,organizationRevision,organizationDigest,decision,reason}审阅；组织与台账同事务 |
| validatePublication(project,resource,contentDigest,actor) | 验证仍是当前批准候选与实际内容SHA；无写授权 |
| validatePlan(project,plan) | 批准角色名称/职责/revision/digest、精确边界、checks及任务/依赖输入、独立验收覆盖和批准转交 |
| enqueue(project,input,origin) | 持久三类请求，origin来自可信PM/run/tool |
| answer(project,input,human,bindings) | 完整nonce/version/digest/当前绑定及答案验证，重复幂等 |
| invalidate(project,reason,executionOnly?) | 撤销pending并保留真实答案事实 |
| snapshotInputs(project,resources) | 精确安全输入的当前物理文件SHA/大小 |
| checkConfiguration(project) | 受控物理workspace/runtime/userData/checks配置，无检查执行效果 |
| recordCheck(project,id,authorization,result,actor) | 保存实际Kernel typed pair的完整证据和关联 |
| currentEvidence(project,task,ids?) | 当前plan/owner/spec通过证据及输入SHA重查；失败/过期拒绝 |
| submitAcceptance(project,{taskId,evidenceIds,decision,issues},actor) | 仅Acceptance；pass须自有当前通过证据及开发证据；fail须证据及原owner问题 |
| requestRepair(project,{acceptanceId,taskId,reason},actor) | 仅PM，当前失败、原owner/原writeSet/checks、真实失败输入与次数上限 |
| close() | 等待本Service事务并关闭Provider |

角色/提案/交互Model实际字段和纯exports见[设计](docs/design/2026-10-08_design_governed-workbench.md)。提案新增可选`transfers:[{resource,fromRoleId,toRoleId}]`；旧owner必须从此次更新边界移除，新owner明确申领，PM审阅digest覆盖转交，之后Human确认计划再次绑定转交。没有两步明确审阅，不能无声换owner。

组织Provider公开`read(projectId,workspaceIdentity)`、`write(document,workspaceIdentity,expectedDigest)`、snapshotInputs、checkConfiguration、close。完整事务位于物理userData/workbench-organization/<projectId>.json，schemaVersion1/projectId/revision/organization/ledger/queue/evidence/acceptances/repairs/digest。单项目锁目录、完整CAS、临时文件sync+rename；拒绝数据重叠、链接、物理root变化、损坏和过期摘要。路径及进程能力只在Provider/Kernel Provider。

ProjectService保持catalog/select/saveProject/setDefaultProfile/readContext/newId/now/close；saveProject使用完整catalog CAS和expectedFileOwnersDigest。HistoryService保持load/save/close，typed user/assistant历史仅在userData；本阶段增加锁与记住读取digest的CAS，两个窗口不能覆盖较新会话。Profiles/Workspace现有公开API保持，设置密钥仍经系统加密；未知metadata/费用保持unknown。

## 七工具与实际权限

PM会话含两个读工具及design_roles/review_roles/request_interaction/request_repair；RoleArchitect设计实例使用conversation的有界活动预算、只运行一轮后关闭，含两个读工具与propose_roles，空writeSet；执行任务含读、获批checks和自身精确写/编辑，Acceptance另有submit_acceptance。Scope、TaskDispatchContext和ConfirmedTaskGrant携带完全相同checks，工具不取任意命令。SDK工具腿按四类typed PiToolResult回应原始当前请求，检查/控制不转Mutation proposal。

六个控制工具只收`{payload}`，run_check只收`{checkId}`。计划roles有批准revision/digest；tasks增加checks和Acceptance accepts；governance为{organizationRevision,organizationDigest,maxRepairRounds}（0–5，建议2）。taskState增加evidenceIds/acceptanceStatus，checkStatus区分not_executed/passed/failed/cancelled/unsupported/stale/error。完成前重查证据，不靠写齐文件/文字自报。

Kernel `createCheckService({workspaceRoot,runtimeExecutable,outputRoot,authorizationValidator})`自己创建Provider。validator允许时返回matching CheckDecision、同一typed CheckAuthorization及live AbortSignal；Pipeline验证实际会话、run、plan/profile/root/context/owner和当前角色定义。取消、结束、关闭或改变绑定abort此信号。输出根是userData/checks，固定Node参数与真实隔离由Kernel负责，当前禁止派生进程。不支持/零测试/失败不降级通过。Domain保存CheckResult关联与输入版本，旧输入改变后拒绝完成或验收。Renderer显示日志已做控制字符清理与大小预算。

PM会话及架构师等待通过真实SDK事件，不凭普通文本审批。等待用户期间Adapter停活动预算；重启只恢复问题和答案事实，建立新PM上下文，不respond旧run。实际文件mutation原审计路径保持。

## 验证与限制

原三协议SDK、写/编辑SHA、读、取消、context/owner CAS回归保留并更新为真实审批/检查/Acceptance fixture。新增持久事务、三类答复、无审批/无checks/无覆盖拒绝、真实失败/过期、Acceptance范围、PM原owner两次返修上限及SDK失败→返修→复验。最终固定model/unit候选见[任务](../../scheduling/legion-governed-workflow-v1-desktop-implementation.md)。本角色证据不替代独立Tester真实窗口/客户项目、Reviewer层与权限审查、PM fresh0.7安装及发布。

## 原生真实模型诊断返修

`legion_design_roles`遇到架构师typed终态失败时，把Adapter实际安全码按显式allowlist保留到控制结果reason，status为error、decision.allowed=false；取消信号仍为cancelled。白名单为pi_model_error/auth_error/network_error/protocol_error/model_aborted/run_failed/run_cancelled/cleanup_failed/turn_timeout/text_budget/queue_budget/history_budget/unexpected_tool_call的完整pi_前缀代码。未知字符串、原始vendor message或空码只返回architect_failed；不传assistant片段、SDK错误原文或凭据。内部`_safeArchitectErrorCode`仅供聚焦契约测试，不出生产Pipeline facade/IPC。typed结果不含finish_reason，不能据通用错误声称输出截断。

架构师同时取得当前组织revision/digest、members及完整fileOwners事实，legacy空boundary不再被误认为没有旧归属。指南建议每次1至2名最小成员子集，PM精确审批后再设计下一批；现有2048输出及60000活动预算已由Adapter独立返修为8192输出/180000累计活动ms有界default/cap，caller只能缩小；vendor能力unknown，不提供无限重试。

PM交互指南列明confirmation/question必须options=[]、allowSupplement=false，只有choice携带选项并可显式允许补充。三类准确payload示例已经实际SDK验证；execute_plan仍仅由可信宿主绑定计划生成。新回归实际HTTP401/Invalid JSON失败映射、unknown/vendor码拒绝、14旧owner迁移及三类guide示例。此返修[任务](../../scheduling/legion-governed-workflow-v1-live-architect-repair.md)与原实现111项证据分开，最终unit等待本次依赖冻结。

## 当前持久conversation timeline与失败后的实际提案

组织事务新增timeline，与queue及answers在同一Provider锁、完整CAS、原子写中提交；它是唯一界面对话来源。`seedConversation(project,history)`只导入一次旧SDK文本，旧legacyMessages仅有role/text/sourceIndex，未记录时间或交互顺序。`beginTurn`、`appendText`、`finishTurn`和`resumeTurn`接受可信host生成的ID/文本/实际时间，不接模型权限凭据。queue enqueue同时写question，answer同时写answer消息；同answerId不重复。新turn具有唯一human message ID，continuationAnswerId必须指向真实已保存答案；消息以host实际单调order排序。SDK HistoryService仍只保存plainrole/text投影，恢复不respond旧tool，不恢复确认/grant。

WorkbenchDTO增加有限timeline：schemaVersion/projectId/revision/historyImported/legacyMessages/turns/messages/digest。turn只有{id,userMessageId,continuationAnswerId,status}；message只有{id,turnId,requestId,answerId,kind:human|assistant|question|answer,text,order,createdAt,orderKnown}。请求/答案与queue交叉验证，消息/turn/request/answer ID唯一、预算有界、摘要校验。新记录的order来自实际host事件；没有锚点的旧交互或不一致终态校准明确orderKnown:false，不能假造旧时间或用相同文字匹配。Renderer按timeline呈现用户→问题→答案→PM继续回复，后续turn不移动旧答案。

RoleArchitect宿主记录本instance/run实际成功propose的ID/version/digest；失败时从当前同项目ledger重查pending及submittedBy，再附到typed error.payload.pendingProposals。reason仍为实际安全错误码、status:error、decision.allowed:false，不冒充成功、成员或权限。取消/跨项目/stale返回空payload。已观察到的pending副作用不能被报告为零提案；PM仍必须精确审阅候选。

本阶段回归先保存两项真实失败于conversation-before-fix.log，再验证持久CAS/重复文字/answerId去重/恢复continuation/未来turn/实际proposal后认证失败。新Source依赖已实际安装0.7包SHA00382a9d3fdb3d2a10112b110b7a20b4b18d8b376d3045e50b459294c50b3b9e；Adapter有界8192/180000，取消与host等待停表保留。最终本阶段[任务证据](../../scheduling/legion-governed-workflow-v1-conversation-repair.md)取代旧6file的stale输入，独立native与客户验收另行记录。

## 当前模型输入与完整界面数据分离

`governedPromptDTO(domain,plan?)`是当前事实投影，完整`governedDTO`仍用于UI；模型输入不含timeline或legacyMessages，不重复历史answered queue/旧checks。它保留当前组织完整角色revision/digest/边界/owner、当前base pending提案、当前角色文档批准引用、当前plan每个task/check的最新实际结果摘要及最新Acceptance失败/返修关联。historyOmitted给省略计数，检查日志摘要2000字符并明确summaryTruncated；完整记录仍保存在台账/界面。

`boundedModelPrompt(parts)`按真正拼接后的JavaScript字符数检查固定65536，超出返回prompt_budget，不静默截Human文字、所选上下文或本次任务instruction。PM、架构师、恢复continuation和执行任务四个SDK入口均使用它。UI历史不裁剪；SDK每轮开始前以纯role/text checkpoint恢复最近完整128消息，较早文本省略在prompt中明确声明，防止SDK history继续累积全部旧事实/工具结果。模型上下文有限不代表vendor能力已知或扩大cap。

同步start_run拒绝会finish已创建turn为failed，返回有限conversation_start_refused（明确history_or_prompt_budget映射prompt_budget），草稿保留，没有orphan running或grant重放。有效较小输入可继续。实际原失败DTO67733字符及长多轮失败已留证，修后长40轮UI完整journal超过65536仍可以模型调用，所选过大上下文明确无调用/不截内容。[本次任务](../../scheduling/legion-governed-workflow-v1-prompt-context-repair.md)。


## 及时雨 / Handwell 生产界面（2026-10-09）

生产字标与原生窗口为“及时雨 · Handwell”，内部 legion 操作名、持久键和所有输入/输出契约保持。Renderer 的用户入口仍仅是以上固定 preload IPC；没有新执行 API、网络或 Node 能力。默认近黑，可切换同结构浅色；减少动效偏好下关闭过渡和背景模糊。

对话采用完整 timeline 稳定消息 ID，旧未知顺序明确标注；原始含 plan 区块回复可按需查看。欢迎和普通对话使用同一 composer；首次进入项目定位最新，返回设置或详情保留原浏览位置。主进程轮询更新改变的事实，不自动打开问题或重建未变控件。成员来自真实 roles，固定系统职责与长期角色不被原型名单替代；activity 与定义 revision/status 分开。

任务详情四个静态 tab/panel 为任务、文件与上下文、成员、记录。plan/tasks/fileOwners/context、完整 proposals、evidence、acceptances、repairs 和 observation 分别在对应页展示。记录包括历史计划标签、实际测试数、检查原因/环境/SHA/stdout/stderr/裁剪、独立验收可复现问题、返修原成员范围/轮次；缺失或未执行事实不冒称成功。返修讨论入口只填写给 PM 的文字。

AI 设置为当前实际角色逐个调用既有 assignProfile({roleId,profileId})；空值传 null，使用既有默认连接语义。所有密钥编辑、连接增改删/测试/取消、默认选择和绑定失效语义保持。聚焦 select、未保存密码及表单草稿保留。

三类 modal 在主动点击后打开当前请求：execute_plan 完整展开 writeSet/owner/transfers/checks/accepts、角色与连接版本、返修上限以及公开绑定。answerInteraction 只提交 projectId/requestId/version/requestDigest/value；关闭和 Esc 只 closeInteraction，保持 pending。窗口内草稿按四项请求身份保存，过期不可提交，空问题/非法选择不派 IPC，提交中禁重复。Ctrl/Cmd+Enter 在输入法合成期间不发送。

[本次设计交接](docs/design/2026-10-08_design_governed-workbench.md)、[固定候选与实际检查](../../scheduling/legion-ui-handwell-implementation-v1.md)记录实现和验证范围；原生窗口与真实三协议完整流由独立 Tester 检查。


## Markdown 展示与用户主动外链（2026-10-09）

Renderer 使用已锁定 prod transitive marked18.0.11 本地 UMD module 的 Lexer，令助手常用 Markdown 成为白名单 DOM。没有 HTML Parser、raw HTML DOM、Node 或外部资源读取；图片只 alt+合法链接。完整原始回复按需可读和选中复制；未闭合 legion-plan 协议 fence 隐藏到原文，不截持久数据。未变消息不重复解析；库缺失或超过262144字符/6000节点/32层展示预算时保持完整纯文本并在消息内说明 fallback，未删历史。

外链不增加 WB_OPERATIONS 或 preload IPC。助手链接只接受绝对 HTTP/HTTPS，经两侧 URL 校验，拒绝其他 scheme、凭据、反斜线规范化和编码控制字符。主进程 Interface 由当前 window/documentUrl/mainFrame 的 before-mouse-event 捕获实际左键按下/释放并以固定只读 DOM hit-test 绑定同一个精确 anchor href/target；before-input-event 仅非重复、非合成 Enter 的当前 anchor。setWindowOpenHandler 每个请求一次消费该精确绑定，始终 action:deny，只有匹配实际激活才由系统浏览器打开。异步 DOM 查询绑定原激活，不取最近任意点击。程序 window.open、synthetic click、错误 target/URL、foreign source、关闭后的绑定一律无打开效果。真实读取/系统打开失败仅显示有限安全提示，原文网址可手动复制。主 frame 导航、iframe/webview/CSP/connect-none 与全部权限语义保持。

本地 lexer UMD 与 package-lock 版本是只读安装依赖，不能手改或改成 CDN；当前包保留该 production transitive 依赖。`_createExternalLinkHandler`、`_externalLinkUrl`、`_markdownContent` 和 `_markdownLinkUrl` 是聚焦 Interface 验证内部入口，不出 WB facade/preload。新增 native unit 通过真实安装 Electron、生产 HTML/Renderer 与同一 host handler，使用受控 DTO/OS opener 验证离线加载顺序、真实鼠标/Enter与程序拒绝、项目焦点几何和成员 Esc；这不替代独立真实客户项目/OS 浏览器最终验收。[实际任务](../../scheduling/legion-ui-markdown-and-focus-v1.md)。


## 取消后的 Human 上下文与真实非 PM 成员会话（2026-10-09，未测试）

PM SDK checkpoint 由 validated timeline+queue 投影，先挑最近128 plain消息再构造 typed History，省略数量明确。已保存 Human 需求和真实 discussion 问答在取消/失败后仍恢复；未完成助手文字只保留完整 UI journal，不加标签撑破单消息65536，也不当作完成的 SDK 回复。当前与恢复 PM prompt、RoleArchitect 自动委托均携带完整实际 Human facts（含 question 的 kind/title/text/options 与实际 answer.value）；旧 legacy user 用 sourceIndex/顺序未知标记，仅为上下文，不猜批准。execute_plan 请求/答案与非 PM日志不进入该 SDK 投影，旧 tool/grant 不重放。65536 prompt 上限、128 checkpoint、8192/180000 SDK 上限保持；所需 Human facts 放不下会明确拒绝，不截本次 Human。

PM 与 RoleArchitect 共享一次完整必要角色变更指导，成功提交后正常结束，不 probe/拆批/预算降级。组织不是全量替换：未参与成员/owner保留；三系统固定职责单列，已有开发定义可revision+1经PM精确当前digest审阅。一次实例只接受一次成功候选，返回必须来自实际本run观察成功、本project/instance/ID/version/digest仍pending/current的候选；语义完整性由PM审阅，真实失败和pending旧候选保留。

getState 的 governed DTO 新增 memberConversations:{schemaVersion,projectId,revision,runs,events,digest}，通过原 governedWireDTO 重验项目和有限字段，无新 IPC。run:{id,roleId,taskId,instanceId,runId,planDigest,status,startedAt,finishedAt}，非PM；event:{id,conversationId,kind:assistant_text|tool_request|tool_result|terminal,text,tool,requestId,resource,checkId,status,reason,digest,order,createdAt,orderKnown}。只有实际 SDK text_delta/typed工具事实及实际SDK终态或宿主失败/停止记录进入；没有instruction、文件/读取正文、actualArgv、API原文、credentials、隐藏reasoning。工具路径无法安全投影时为null（含根目录''），不阻断原工具/Policy拒绝；status仅固定 typed 合集，reason限公开安全码。

member journal最多256 runs、1024 events、累计文字4MiB，单段65536，固定Provider完整文档16MiB/CAS保持。活动文本段同ID合并前验证纯string、拒accessor/coercion；为每个活动run保留终态事件空间，预算拒绝不删旧记录。Organization public Service新增 beginMemberRun/appendMemberEvent/finishMemberRun，trusted actor与payload分开，同项目/实例验证、live signal在写前后核对。旧字段缺失按旧字段集合先验原digest，再补空journal；Provider expected CAS仍为raw.digest。

切项目/取消/关闭后的晚到文字/工具保持原generation/project/instance/run guard；明确宿主stop仅结束捕获的旧run为interrupted，不把旧DTO赋给新#domain。重启未知结束时间仍null，UI标未记录，不补造。成员对话与PM历史完全隔离；主区只显示实际非PM working入口，点击现有成员pane只读具体run，历史从成员入口保留，稳定event.id节点与run阅读位置。只有PM可sendMessage，权限/nonce/owner/审计/预算不变。

[本次具体设计](docs/design/2026-10-08_design_governed-workbench.md#取消后真实需求恢复一次完整角色方案与成员工作对话2026-10-09)、[精确任务](../../scheduling/legion-workflow-context-and-member-chat-v1.md)。本轮用户要求测试暂缓：回归代码已编写，未运行model/unit/GUI/SDK/probe，旧证据不证明本候选，未验收。


## 本轮用户恢复测试后的验证状态（2026-10-09）

用户最新“把两个ssh项目都清空，重新测试”已撤销此前tests deferred。Owner按原固定model/unit执行：首轮unit145/164，旧架构师prompt fixture解析、取消需求旧预期与新增manual/加密重启fixture错误已明确修正；第二轮162/164，再修同一JSON行布局与实际content+tool_calls协议fixture。全部原权限/owner/nonce/审计/预算断言保留，取消预期严格验证原需求不丢；生产源未因这些fixture返修改动。旧失败日志永久保留。

随后同固定model28/28、unit164/164通过，无fail/cancel/skip，包括新增13回归与隔离Electron原生用例；最终说明冻结后重新固定检查的候选/日志看 [当前任务](../../scheduling/legion-workflow-context-and-member-chat-v1.md)，不复用旧151或此前deferred候选证据。此为Owner实际单元/受控SDK与自有原生fixture结果，两个客户SSH目录清理、真实GUI/真实模型新开发及独立验收由root安排，不能称已完成真实客户项目验证。之前“未测试”是当时状态，当前代码仍待完整产品验收。


## 角色提案字段诊断与成员当前任务（2026-10-09）

组织Model已知输入校验现在可产生first-party OrganizationValidationError的安全field/expected。字段路径仅固定members索引与已声明字段，expected仅静态类型/边界规则；不回显输入值、未知异常原文、SDK/API或credentials。normalizer绝对/冒号、非法组件/glob/目录、控制/凭据路径保持原拒绝。Control结果payload.validation:{code,field,expected}只来自该本方诊断类，帮助Architect修正同一完整提案；没有例外权限、假批准或probe/分批策略。未知故障仍泛化安全控制失败，不伪装用户字段错。

PM/Architect共用明确的payload/member types、长度、数组、revision/version、approved/boolean、documents实际SHA规则，职责写purpose、接口写interfaces，boundary仅精确文件字符串，合法示意不是可抄提交的实际scope。一次完整提交、PM当前digest/revision与Human计划批准、owner、budget全部不变。

成员pane按选中role显示自己的当前实际task/status/writeSet/checks和证据，再自己的职责/接口/边界、实际公开模型连接与run对话。其他role cards保留稳定节点但隐藏，所有相关task/evidence按role过滤；role-design只来自实际Architect run。Host roles.profileId在活跃Architect时为实际解析连接，空专属映射时沿当前PM/default fallback；仅既有公开profile id/model元数据，不输credentials、新IPC或外部能力。

具体设计与新候选证据见 [本次任务](../../scheduling/legion-role-proposal-diagnostics-and-member-detail-v1.md)，旧真实boundary-prose失败/timeout记录不覆盖；Owner固定model/unit与root普通入口真实项目验收分别记录。


本次Owner固定model30/30、unit170/170首轮通过，无fail/cancel/skip；新增6项明确验证实际形态prose/colon/glob拒绝的安全field/expected、不合法方案不提交pending/owner、SDK据提示改精确完整候选、所选成员自己的任务/证据/卡、公开fallback连接及原权限流程。16文件最终说明冻结后的同候选固定检查以 [新任务](../../scheduling/legion-role-proposal-diagnostics-and-member-detail-v1.md)当前证据为准，不能复用旧164或原失败。原真实5成员失败/180秒trace保留，root普通入口真实完整提案/GUI验收仍后续独立进行，没有假审批或客户项目操作。


## 2026-10-09 持续角色工作上下文与独立对话页

Organization private document增`roleMemories:{schemaVersion:1,projectId,revision,entries,digest}`。entry仅`roleId,revision,summary,covered:[{sourceId,sourceDigest}],messages:[{sourceId,sourceDigest,role:user|assistant,text}],sourceDigest,updatedAt`。原journal保持，不存工具reply/grant/checkpoint授权/读取或文件输出正文/私有连接。旧digest先按原字段集合验证，新字段缺失默认空；原CAS期待raw.digest。

Public Organization Service增`saveRoleMemory(project,{roleId,expectedRevision,summary,covered,messages,sourceDigest,updatedAt},trustedActor,signal=null)`，在原事务重算该角色validated sources、核源摘要与role记忆revision，messages文字必须等于来源原文，覆盖只合法source refs。Provider `write(document,workspace,expectedDigest,signal=null)`接受可选真实AbortSignal，紧邻rename发起前检查取消；rename发起是提交点，之后cancel不虚称回滚，返回实际已提交document。

`roleContextSources/prepareRoleContext/roleContextHistory/canonicalRolePins`为纯Model投影：共享真实Human/discussion问答，PM只自身完成assistant；非PM只该角色已结束run原文、固定工具元数据及实际宿主briefing。一次恢复≤128条，合并完整prompt+pins+history JSON计量硬65536，soft49152或96消息；保留近文按实际剩余空间、最多16384字符/64完整消息。摘要8192、全项目记忆2MiB；不截当前Human。实际window已配置时UTF8字节作明确估算提前触发，当前Desktop窗口/费用未知。

Pipeline在业务start前Host调度最多一次无tools/read/write/check、同角色真实解析连接的摘要conversation，maxOutputTokens2048/turnTimeoutMs30000，不启SDKauto compact/retry。只有真实completed、非空、无非法控制字符且≤8192的完整输出提交。runtime stopReason:length为安全failed，不把外观完整文字当success。Source版本/CAS/cancel失败保旧记忆；仍超cap拒绝业务模型请求，当前Human原文留timeline。新的single_run调用已安装runtime首run前restore_history绑定当前instance/profileVersion，只恢复plain文字，不复活旧队列与权限。

Public getState/原IPC增`roleMemory:{revision,localCharsLimit:65536,modelWindow:null,cost:null,entries:[{roleId,revision,hasSummary,summaryChars,recentMessages,coveredMessages,updatedAt}]}`及`memoryNotices:[{roleId,code,message}]`，notice仅固定本方摘要失败/长度/冲突/预算码；governedDTO→governedWireDTO→IPC完整链重建，私有summary/source/covered/消息/checkpoint不公开。

Member journal event新增`kind:host_briefing`，仅真实start_run后独立Host数据，`text`为安全instruction/taskId/title/writeSet/checkIds，不含read正文/输出内容/权限，其他工具metadata全null；正文在对话页标宿主任务输入不是assistant回复。已有字段形状/旧digest仍兼容。五tabs task/files/members/conversation/records，工作入口打开conversation、侧栏打开members，共享selected role；PM conversation来自真实timeline，旧运行实例/时间未知不补造。来源由3固定ID系统、approved非固定项目、legacy未知推导，不伪造PM创建者。原WB操作/权限/CSP未扩大。


本轮检查记录：补充任务首轮固定unit163/173、10fail、0skip，日志`legion-role-memory-cancel-commit-v1/evidence/organization-cancellable-commit-1-unit-078a6e33.log`保留。具体修复重复import、合法新来源badge/完整checkpoint断言、实际timeline种子（已import空legacy不重复导入）、cancel发生在prepare未start的真实分支与真实fs最终取消查询夹具；未更改预算或权限、未删除严格断言。新冻结候选待同固定门重验，最终结果以正式report为准。


最终来源保护修正：source工作文本按原始已记录createdAt规范排序，legacy未知来源优先且不伪造时间。活动PM running/waiting回合的真实Human与discussion问答为required完整来源，不能进入older摘要集合；近文选择先预留这些来源、当前完整prompt/pins和摘要wrapper。required+当前输入已超65536时不调用摘要或业务模型，明确拒绝并保原文。新增纯Model和真实localhost SDK“旧架构师45000字回复+本次完整Human”的回归，严格断言摘要请求不含当前需求、后续Architect实际请求含其逐字完整内容，原长journal不删除。此前主model33/unit187通过的c762候选与日志保留作为当时历史，最终固定门将对新候选重新执行；Provider3文件保持已核验原样，最终主unit包含其真实提交取消回归。


同一必要来源保护进一步覆盖执行角色情况：用本角色previous.messages/covered的ID+digest区分已交付与新Human/讨论答案；有previous时，尚未递送的新Human/答案required，且最新需求轮即使PM已completed仍保持完整。初次旧迁移历史至少保护最新真实Human及其问答（legacy无轮次保护最新user）；旧已听内容仍可摘要。required本身超过近文目标16k也不截断，目标先扣其占用；合并65k/恢复128硬限不升。新增纯Model和真实localhost双计划/实际自测验收回归，验证completed PM的18000字符新Human在worker实际请求逐字保留，而摘要仅处理自己前轮45000字符历史，旧工具结果不重放、原文不删除。最终门仅以本轮最新candidate证据为准。


本轮后续固定unit189/191（15eb32a1）保留：required+prompt超限的公开Model行为为提前prompt_budget，回归严格验证throw及完整原文保持；Native记录在自身Enter阶段前出现额外真实Enter输入，原fixture会抢前台。现将实际Electron fixture保持隐藏并只聚焦webContents以隔离用户键盘，真实sendInputEvent与全部精确一次打开/拒绝synthetic/几何/Esc断言及30秒限额不变，不修改Main。最终新候选再运行固定门，旧结果不复用。

## 2026-10-10 项目Shell生产契约（当前candidate）

执行任务tools含legion_request_shell。Host从原PiToolRequest推导requestId/runId与实际role/task/instance/session，参数为{command,cwd,reason,generatedEffects,network,timeoutSeconds}。默认产物授权[]；计划可声明generatedEffects与artifactScopes[{scope,kind:dependencies|build}]，同scope跨任务kind冲突拒绝。Human执行弹窗展示全部真实范围。PM fresh受限审核实例只提供legion_review_shell，参数exact {requestId,requestDigest,revision,approved,reason}；同一PM记忆/CAS串行。文字同意、错误digest/revision、SDK失败、过期均不执行。

Organization公共Service新增enqueueShell、shellPhase、reviewShell、appendShellReview、claimShell、interruptShell、shellOutput、shellRecoveryInputs、completeShellRecovery、inventory、shellConfiguration。它们只供Host Pipeline，不增加renderer IPC。claim在共享项目锁内用既有atomic CAS一次消费。private ledger固定请求、绑定、prepare、逐Mutation发布journal与私有artifactSnapshots；不持久permit/receipt。shellPhase不能复活终态。原document digest先校验旧字段、再兼容缺失shellWorkflow，CAS仍期待raw.digest。

Organization Provider的inventory返回安全完整ordinary source/allFiles、实际产物与目录摘要；拒绝危险链/普通源码symlink/hardlink/特殊权限，read exclusion照旧。shellConfiguration(projectId,workspace,roleId,planDigest)返回Host固定物理private outputRoot、runtimeExecutable、npmCli（存在时）及与Check相同lockRoot；恢复新计划与旧backend/journal分离，旧产物保留。appendShellArchive只保存有限有效UTF8 JSONL、0600/O_NOFOLLOW、1MiB。snapshotInputs的absence仅由当前plan真实授权删除墓碑证明，普通缺失仍拒；Acceptance和修复核验也使用同样证明。

getState新增白名单shellRequests[]：原role/task/instance/run、command/cwd/reason/network/effects/timeout、requestDigest/status、真实PM review/reviewer/reviewStatus/reviewText、有限output、final ShellResult、时间与可选恢复来源。原session许可/authorization/preparation/receipt/candidate正文/私有artifactSnapshots不公开。ShellResult ready_for_publication不能到SDK或wire；原SDK只收最终typed ShellDecision+ShellResult，允许时仍需same request引用。强制安全DOM输出，不扩CSP、导航、Node/network权限。

source candidate使用public ActionProposal(legion_shell_publish/request_shell)和controller.issueShellPublication(realReceipt)→publicMutation。UTF8/canonicalB64≤2MiB实际bytes/SHA/安全executable/present|absent基线整批预检；只有本role本task exact writeSet，RoleArchitect文档还须匹配批准SHA。删除长期owner保留，task/依赖元数据为missing/tombstone；source和generated都是真正发布后才计输出。Shell0退出≠checkpass/Acceptance。

partial或未完成发布记录暂停；不自动源码rollback。shellRecoveryInputs将当前SHA/absence送新Human确认，确认及执行期间复查；不同已确认新plan、新owner当前授权、新baseline才能恢复。completeShellRecovery只在全部实际任务/当前checks完成且最新观察与磁盘一致后记录recovered新plan/evidence，旧partial结果不变。旧command/receipt重启不恢复。

审批等待5min独立于执行，命令default300/max900sec与cleanup30sec由Kernel实际隔离Service约束。previewdefault8KiB/max64KiB并按恢复history+本prompt+真实事件累计chars进一步缩小，不足typed prompt_budget；token窗口/费用不伪造。实际运行输入是legion-runtime0.8.1 tarSHA970bf9954813022cef8f396b8ac388088024cdca9ffd18d1533347723b5a73f1。具体可运行平台以startup与最终检查证据为准。

发布收束仅一次finishPublication；其实际结果在Host记录故障时仍保留executed/publishedResources，Host状态partial_published(reason shell_publication_record_failed)，不能重新finish或伪装未执行。private inventory可选digestScopes仅筛实际产物摘要，安全扫描仍使用完整已确认artifactScopes。generated-only旧partial恢复要求新计划覆盖每个旧scope、新Shell真实published及当前私有generation一致，source集合为空不能直接成功。partial里的真实生成发布+仍匹配私有版本的Host事实可作来源；任何后来改变不隐去普通源码。

## 2026-10-10 当前0.8.2显式时间事实调用

ShellService.observeTime():number（以及MutationService.observeTime）均为Host-only Provider fresh safeepoch。生产Pipeline每个proposal直接使用controller.issueShellPublication(proposal,receipt,service.observeTime())第三参数，不在prepare/PM阶段缓存旧事实，不在Model取Date.now，不添加SDK/request/review/result/history/renderer字段。缺失/invalid/过期事实由下层拒绝；consume、context verify和实际create/replace/delete提交前各Provider仍fresh重验，不能回退旧事实重放。普通write/edit和原业务/活动预算不变。实际安装输入legion-runtime0.8.2，PMbridge-v3 tarSHA1a2a7c483f04f2bb939d6bf4d25aa7a4318bc866a473dcac251f74d1ee592622；前节0.8.1字样对应其先前候选历史，不是当前运行身份。当前验收仅以本任务三个固定门同candidate新证据为准，原partial真实记录与新Human/currentbaseline恢复不变。

## 2026-10-10 absence wire、活动入口焦点及正确资产恢复（同v1必要修复）

真实删除检查基线仅state:absent/sha256:null/byteLength:0/noexec可经原getState wire公开；legacy present仍严格SHA，非法状态/字段冲突/未知字段拒绝。成员证据和检查记录显示获准缺失，不显示SHA null。活动入口采用既有内侧1px/-3px焦点及无按下位移，保留真实鼠标/键盘/Esc回原trigger和结束fallback，不blur或隐藏键盘焦点。阶段截图由实际DOM/transition稳定判定，不猜新生产bug。

只针对旧partial中真实成功/observedMutation、actual publishedResources与candidate一致且当前仍匹配目标SHA/bytes/safeexec的产物，Host在新Human明确当前baseline和新plan确认后创建独立recovery_verified_retained事实。事实绑定旧request/proposal/candidate摘要、新Human请求/plan、currentowner/task/instance/run与已核验baseline；task.retainedOutputs与新Mutation results分列，不伪造observedMutation，不重写正确binary，不泛化普通nochange。新计划仍声明原精确writeSet与检查输入，保留事实仅承接该已明确范围内的交付。Human确认明示可核验保留的资源/来源，SDK只得到Host事实不是许可。当前selfchecks/Acceptance和末次磁盘/生成版本复核之后才append recovered，旧partial结果不改。SHA/bytes/mode改变、缺provenance、baseline/owner/task/plan不符均拒绝。

Core/Adapter/SDK工具/IPC操作与0.8.2包不变，公共Organization abstract/public/impl facade一致，仅Desktop可选task-state元数据兼容旧缺失字段。真实自有SDK/native partial→restart→newHuman/newPM/newShell保持正确binary无diff/无新Mutation，保留事实后检查/Acceptance；否定changedSHA/mode/missingprovenance；wire原IPC和native focus分支严格回归。全部三个固定门同新candidate，不复用旧177/34/199，独立验收由Supervisor后继调度。

保留事实在task.retainedOutputs显式呈现，并在完成恢复时追加到旧Shell recovery.retainedOutputs作为持久独立来源，后续新计划替换当前tasks不会丢掉该证明。事实纯验证归属Interaction Model，Workbench重用同一schema；旧缺失字段兼容，不改原partial result或伪造Mutation。正例binary原inode保持、newcandidate/results无该资源；changedSHA/mode先拒保留，只有新真实Mutation修复才可完成，missingprovenance无diff则继续缺交付拒绝。

## Node Host 与角色并行（v2）

公共 `createHeadlessWorkbenchPipeline({userDataDir,leaseRoot?,profile})` 位于唯一 `src/pipelines/workbench.mjs`。profile 精确字段 `profileId?,name?,protocol,provider,modelId,baseUrl,env?`，默认 id 为 environment；凭据来自可信环境 LEGION_API_KEY，仅内存。facade 与 Desktop 相同，未暴露 Service/Provider、授权或原始环境。leaseRoot 只供可信 Host/隔离测试注入，生产 CLI 不转发用户路径，默认同用户共享根；userData 不决定租约根。

运行时有界 ready-set 上限4，同role串行，依赖成功及失败后的独立Acceptance仍执行原真实证据门。任务 Agent/读与检查取消器/日志各自独立；撤权覆盖全部活动实例。metadata updater 在串行临界区读取当前项目后构造任务合并。普通 Mutation、Check 与 Shell 准备/审核/执行/发布共用 Host 命令队列；Shell 内部出版调用 Mutation 不递归排队。Pi 推理和独占任务仍重叠，磁盘提交串行，保持 Check 输入稳定和 Shell 全 authored baseline。外部修改继续拒绝，不弱化 owner/source/lease 校验。

## 已知key私有契约（runtime0.9.2）

唯一Headless工厂经EnvironmentProfiles Service在首次状态/历史恢复前resolve私有key；Pipeline没有直接env读取。knownKeys原值数组只传公开Check/Shell factory的私有options，不进SDK或DTO；K预算超限失败关闭。Organization load(project,knownSecrets?)与Project catalog/select及saveProject options.knownSecrets是Host提供的纯数据私有守门参数，集合只增加、close清引用；facade方法不变，模型无此输入。Memory已有trusted secrets参数同样守护完整文档/结果及Provider写前，历史污染拒绝，不先写后擦。

sensitive_output是明确拒绝，无Human静默替换。PM及各member/Shell review/摘要每run流在内存累计、完整安全终态前不持久或公开；已知值跨delta也拒绝，PM关闭污染实例后重建。普通edit只读核当前候选并保留原CAS，客户原含值文件读取被拒而不自动清理。Shell输出hook按请求串行归档，拒绝仍回传。保障限已知精确值与已review的输入/流/候选；外部TOCTOU、未捕获/编码值及child自构直写获准tmp/outputs边界保留。

## 当前产品Supervisor公开状态

getState新增supervisions，最多preflight/monitor各最新一项，仅同project当前v2 plan：{planDigest,phase,status:pending|completed|failed,advice:null|{recommendation:proceed|revise,findings:[{severity:info|warn|block,taskIds,sourceRefs,reason}]},resultStates:{tasks:[{id,status,checkStatus,acceptanceStatus}],checks:[{id,taskId,checkId,status}],acceptances:[{id,taskId,decision}]}}。结果仅当前task run/物理workspace的检查、当前instance对应验收；不包含instance/run/queue、raw SDK文本、sourceDigests、knownKeys或全历史。旧plan/别项目监督不投影，活动阶段同步登记pending（包括启动IO阶段）；仅Host验证的typed正常终态为completed，not_completed映射failed且advice=null。wire再核有限字段和当前plan绑定。

这些建议是可读事实，不发grant、不改变owner/Human确认；成功任务不因后台monitor失败被改failed，后台过程仍异步。

## 显式 Profile 凭据兼容

saveProfile 仅将校验后的 apiKey 从普通内容守门中排除，由 keyAction=replace 交原 Profiles Service→Settings 加密流程，可重复设置已登记同值；keep/clear 的既有校验与语义不变。name/provider/modelId/baseUrl 等 metadata、项目路径/defaultProfile 和普通 Human/model/tool 内容仍在动作前拒绝已知值，拒绝不改连接状态或存储。凭据不进入公开 DTO、日志或源码。真实公开 Pipeline 回归检查同值重复保存、解密连接仍相同、加密文件无原值及 metadata/Human 拒绝。

## Su frontdoor v0.3

sendMessage仅接受roleId:Supervisor；直接PM/执行成员客户消息拒绝，方法名/IPC不变。执行中可发只读问答，不invalidate执行epoch；delegate_pm改变计划在执行中拒绝。前台customerProfile优先Supervisor映射后environment/default；后台pmProfile优先PM映射、仍有效的project.manager配置，再environment/default，分别resolve与建实例。saveProfile显式apiKey加密例外保留。

Organization root schema2新增customerTimeline:{schemaVersion:2,actor:Supervisor,...}及delegations:{schemaVersion:1,...}；roleMemories schema2按(roleId,channel)唯一。四系统channel与member_task分别恢复已验证来源、checkpoint/摘要/缓存/notice；旧roleMemories只读存legacyRoleMemories。Project/owner catalog schema2、Project/History/Memory三层及Org Provider不改。History仅load旧PM原文，new Su/PM消息不调用History.save。

公开Organization Service新增migrate、saveDelegation、queryRoleActivity、queryRoleLog及invalidateCustomerTurn。migrate先验证旧固定职责/原digest，用原digest CAS一次提交，Host先获取共享lease并drain；旧pending讨论/确认/成员/Shell审批失效，组织revision/digest改变令旧plan不可dispatch。CAS/准备失败关闭；rename后的sync失败按已提交新域恢复，无旧grant回滚。新域重启将私有无live PM委托及其问题置stale/invalidated，普通当前Su讨论答复仅经Host真实continuation。

Su delegate_pm payload start {action:start,purpose:plan|role_design|repair,instruction,sourceRefs,acceptanceId?,taskId?}；repair核实际失败issue与原owner/确认轮次。resume {action:resume,delegationId,humanAnswerRef}，不得携answer/value；Host核已登记同委托真实Human答复。一项目一活跃委托，单Su turn最多4次请求，共享链读取/查询2MiB预算。PM私有问题只经request_interaction {questionRef}引用原样呈现；完整discussion字段分支与questionRef互斥，execute_plan只由Host创建和消费。

role activity返回当前plan实际status/phase/blockingTaskIds与观测change/check/Acceptance计数及来源；没有时间/进度则不编造。role log参数roleId、taskId?、planDigest?、cursor?、limit?；默认20/最大50、整页32KiB，cursor最大4096字节，绑定project/规范filter/固定order边界/来源digest/offset。边界内相关记录变化或丢失stale_cursor；自身查询journal及边界外新事件不使旧页失效。只返行动metadata，不返原文/tool参数/授权/nonce或私有instance。后台监督可read/query，不能delegate/Human交互；前台Su无submit_supervision、业务Mutation/Check/Shell权限。

PM Shell review独立绑定原Worker请求/准备快照/当前plan/owner，空checkpoint，不读写pm_delegate缓存；真实动作进入原Shell workflow和行动journal的shell_review用途，非新增记忆channel。公开Shell reviewText为空，typed审批reason/结果保留。后台known-key拒绝保留sensitive_output传到前台失败，监控失败不改变成功任务；公开失败终态先drain原turnPromise，下一次合法发送无需重试。

范围、流程及真实检查见 [当前功能](docs/feature/cli-project-host.md) 与 [本次任务](../../scheduling/legion-supervisor-frontdoor-v1.md)。旧API历史章节中的PM客户入口由本节取代。

## Su在途取消与后续对话

Host取消先中断捕获的Su运行并等待该轮Host promise，再按该run的终态事件消费标记排空Adapter事件；不以公开turn已cancelled代替实际队列收束。同一Su实例下一轮重建当前安全checkpoint后正常发出新模型请求。取消轮保留Human原文，未完成assistant片段不写客户timeline/history，也不恢复旧工具或授权。阶段诊断仅输出固定prepare_memory/restore/start/drain/next_event/finalize及白名单类型/合同码，不输出异常原文、history或凭据。真实SSE取消→继续回归及原owner/known-key/并行门按当前修复图留证，不替代独立产品验收。

## 后台终态与新Human记忆CAS

Host终态缓存以真实log.channel选择存储：Su前台只su_customer，后台预检/监控只supervision_preflight/supervision_monitor，成员member_task，PM委托pm_delegate。临时Shell review只有既有审核journal/审批事实，不写pm_delegate缓存。新Human可在真实selftest失败后立即发起草案，不等待后台监督；后台不会推进前台记忆revision。来源covered引用、整体sourceDigest和同channel expectedRevision仍分别拒绝真实失效，不忽略digest或无界重试。安全诊断区分covered/source_ref/source_digest/revision，仅投影白名单channel、64位来源id/digest和整数revision，原文/摘要/工具/凭据不输出。当前真实屏障回归与四门证据由修复图绑定，独立Tester旧失败证据保留。
