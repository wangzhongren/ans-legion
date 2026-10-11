# Kernel Node 公开接口（工作台 v2 与保留的 v3 Runtime）

## 2026-10-08 文件独占与受控局部编辑 v1

`workbench.mjs` 导出纯 `ProjectFileOwners({projectId,version,owners:[{resource,roleId}]})`、`FileOwnershipTransfer({resource,fromRoleId,toRoleId})`、`FileOwnershipPlan({projectId,baseVersion,baseDigest,nextVersion,claims:[{resource,roleId}],transfers:[...]})`、`applyFileOwnershipPlan(current,plan)`、`assertFileOwner(snapshot,{projectId,version,resource,roleId})` 和 `FileOwnershipError{reason,resource,ownerRoleId}`。owners 只接受精确项目相对文件，拒绝目录、越根、大小写别名重复，以及任一层控制/常见凭据路径组件；申领和转交使用与受控读取相同的纯路径规则，`src/.git/config`、`src/.SSH/id_rsa`、`packages/.NpMrC` 等均不能取得 owner。普通嵌套源码和文档仍可归属；有限路径规则不识别任意命名的秘密。`ProjectFileOwners.digest` 绑定 projectId、version 与完整 owner 集合；`FileOwnershipPlan.digest` 绑定旧快照和所有申领/转交。相同角色的重复任务申领按一个文件合并；不同角色对同文件申领直接拒绝。转交必须显式列旧 owner、新 owner 和相应新申领；无主文件可新申领，已有 owner 不因文件被外部删除而消失。Desktop 可在展示计划和确认提交时对当前快照重复调用纯 `applyFileOwnershipPlan`，旧版本/摘要变化会拒绝，不修改原快照；执行写前用 `assertFileOwner` 复核。

`createWorkbenchAuthority` 增加可选 typed `fileOwners:ProjectFileOwners`。新工作台创建确认授权时传入**确认后**的归属快照；`ConfirmedTaskGrant` 增加与之相等的 `fileOwnersDigest`。确认任务时每个 `writeSet` 文件必须归属该 roleId；`controller.issue`、Mutation 的 `consume/recheck` 也检查当前绑定角色/路径。可信宿主在派发前及归属状态变化时调用 `controller.assertFileOwners(currentSnapshot)`；摘要不匹配会永久撤销旧 authority，转交后须建新 authority。未传 fileOwners 的旧宿主和旧 grant 仍保持原行为。Node Runtime 创建或更新不同角色的 `RoleBoundary` 时拒绝写范围重叠：目录/目录、目录/精确文件和大小写别名都算重叠；拒绝更新发生在变更及撤销许可之前。同一角色可在其边界内列重叠范围。只读 `readScope:['.']` 不参加写范围冲突。

执行 Agent 可用 `legion_edit_file` 编辑已有普通 UTF-8 文件。Pi 参数为 `{resource,expectedSha256,replacements:[{oldText,newText}]}`；`expectedSha256` 是 Agent 从 `legion_read_file` 的 `ProjectReadResult.sha256` 得到的**完整文件** SHA-256，分段结果带同一 SHA。`ActionProposal` 对编辑使用 `action:'edit_file'`、`tool:'legion_edit_file'`、`capability:'write_file'`、可信 session/run 及这些参数，`content` 省略；digest 绑定旧 SHA 和按序替换。替换数为 1–16；oldText 非空且不能重复，每一步须在当时完整文本中恰好出现一次，newText 可为空。旧 SHA 不同、找不到/出现多次、文件不存在/链接/非普通、无效 UTF-8、二进制、源或根变化、原文件或最终文本超过 2 MiB 均明确拒绝，原文件不部分修改。Mutation Service 经 Storage 临时文件、sync、最终同步授权/路径/源 SHA 重查后 rename。成功 `MutationResult.contentDigest` 和 `mutation_success Event.contentDigest` 是最终完整文件 SHA，不包含正文；旧 `legion_write_file` 的结果形状保持兼容。

`legion_edit_file` 与完整写同属 `write_file` capability，同受 `requiredApprovals:['write_file']` 及精确路径审批、角色/任务/实例 `writeSet`、一次性许可和审计限制。`ConfirmedTaskGrant.tools` 至少包含 `legion_write_file` 或 `legion_edit_file`，可同时包含两者及成对只读工具。PM 没有编辑工具。Adapter 仍只转交受控工具请求，Node Runtime 保留旧宿主工具默认值。当前确认设计见[文件独占与编辑方案](../ProjectManager/docs/design/2026-10-08_design_legion-file-ownership-and-agent-edit.md)，Owner 检查见[任务记录](../../scheduling/legion-file-ownership-and-agent-edit-v1.md)。

## 2026-10-08 项目内广读 v1 增量

`src/kernel/services/public/read.mjs` 导出 `ReadService` 和 `createReadService({workspace,workspaceIdentity?})`。可信宿主为当前项目构造一次，调用 `listFiles(request,{signal?})` 或 `readFile(request,{signal?})`，结束后 `close()`。`workspaceIdentity` 可选，提供时必须和真实根 canonicalPath、deviceId、fileId 匹配。Service 只做安全文件读取；Workbench 必须在调用前核对当前项目、实例、run 与授权，取消时传入 `AbortSignal`。PM 不需要 `ConfirmedTaskGrant`，自主读取不产生客户目录审计或上下文 SHA 快照。

`agent.mjs` 新增不可变 `ProjectReadRequest`、`ProjectReadDecision`、`ProjectReadResult`。请求字段为 `requestId/runId/tool/resource` 与列表专用 `cursor?`（默认空）、`limit?`（默认200）或文件专用 `startLine?`（默认1）、`maxBytes?`（默认65536）。`tool` 仅 `legion_list_files`、`legion_read_file`；列表的空 `resource` 是项目根，文件读取需要非空项目相对路径。列表成功结果 `{status:'listed',reason:'listed',resource,entries:[{name,kind}],nextCursor}`，kind 为 file/directory；真实文件读取成功结果 `{status:'read',reason:'read',resource,text,byteLength,nextLine,complete,sha256}`，sha256 始终是完整文件内容，完成时 nextLine 为0；拒绝结果 `{status:'denied',reason,resource}`，没有正文。`ProjectReadDecision` 是 `{allowed,reason}`。`PiToolRequest.parameters` 对两个读工具分别规范为 `{resource,cursor,limit}` 与 `{resource,startLine,maxBytes}`；`PiToolResult` 支持匹配的读 decision/result，原写 PolicyDecision/MutationResult 保留。

项目广读须显式授予：`RoleBoundary.readScope:['.']`、`capabilities:['read_project']`、两项读工具；AgentScope.tools 与 TaskDispatchContext.tools 也需包含两项。`PolicyService.evaluateRead(request,{boundary,session,trustedSession,currentVersion,taskStatus,instance,dispatchContext})` 返回纯只读决定，验证当前 Session、run、任务、版本、角色及三层工具交集。`PermissionRuntime` 的 `createRuntime({...,projectRead:true})` 才启用 Node 读工具；缺省仍是旧仅写工具。读写执行成员的 `ConfirmedTaskGrant.tools` 可为单个写工具，或写工具加两项读工具；原精确 `writeSet`、一次许可与审批规则不变。PM 的任务/实例可为 `writeSet:[]`、`scope.write:[]` 且仅有两项读工具。

Provider 每次检查项目根和文件身份，拒绝绝对路径、遍历、任一层控制目录 `.git/.ans/.aws/.agents/.codex`、凭据目录 `.ssh/.docker/.kube/.gnupg/.azure/.gcloud/.terraform/.terraform.d`、`.env`/`.env.*`、常见私钥文件、链接、非普通文件、无效UTF-8和二进制控制字节。凭据文件还包括 `.npmrc/.netrc/_netrc/.pypirc/.git-credentials/.authinfo/.authinfo.gpg/.pgpass/.my.cnf/.s3cfg/.boto`。匹配每个路径组件，大小写不敏感；列表同样隐藏这些项。此有限路径规则不能识别任意命名的秘密。列表每页至多200项，只返回可读普通项；文件最多2MiB，每次至多64KiB且按完整行续读，单行超预算明确拒绝。Node Runtime 将目录名和正文返回量合计限制为每轮2MiB。项目切换、取消、关闭使运行授权失效；Workbench 同样须核对这些绑定与轮次总预算。自主读过的文件不会隐式成为已固定计划上下文。

## 工作台共享契约与公开 Service

新包的有限子路径由 ProjectManager 透明转出 public Service 和以下30个具名纯 Model/工厂；本阶段不改根包、不导出私有 helper。真实已安装tarball与Adapter/Desktop组合由后段验证。既有8个root exports与Runtime默认single_run保持。

```text
ContextReadConfirmation ContextSnapshot ConfirmedTaskGrant MutationVerification
createWorkbenchAuthority isWorkbenchMutationAuthority
PiConnection PiConnectionProfile AgentScope AgentConfig TaskDispatchContext AgentInstance
PiEventType PiTextDelta PiConversationHistory PiConversationCheckpoint
PiToolRequest PiToolResult PiRunResult
AgentSession RoleBoundary ActionProposal PolicyDecision ExecutionPermit MutationResult Event Outcome
normalizeResource normalizeScope digestValue
```

下列字段均camelCase，拒绝未知字段并复制冻结集合；SHA为64位小写hex，根identity由Provider真实获取，Model不做IO。workspaceIdentity恰为 `{canonicalPath,deviceId,fileId}`，dev/ino为十进制字符串，fileId不能为0；比较路径使用统一分隔符/大小写，identity变化不是仅path变化。

| Model | 构造字段 |
| --- | --- |
| ContextReadConfirmation | confirmationId/workspaceIdentity/organizationVersion/profileVersion/contextReadSet |
| ContextSnapshot | confirmationDigest/workspaceIdentity/organizationVersion/profileVersion/files，每项resource/byteLength/sha256 |
| ConfirmedTaskGrant | confirmationId/workspaceIdentity/planDigest/organizationVersion/roleId/taskId/writeSet/tools/profileVersion/contextSnapshotDigest |
| MutationVerification | workspaceIdentity/organizationVersion/profileVersion/planDigest/contextSnapshotDigest/contextFiles（resource/byteLength/sha256） |
| PiConnectionProfile | profileId/profileVersion/protocol/provider/model/baseUrl，可选modelMetadata |
| PiTextDelta | runId/text，单项至多65536字符；队列envelope `{type:'text_delta',delta}` |
| PiConversationHistory | messages数组，每项仅role（user/assistant）及text；至多256条、每条65536字符、总2097152字符 |
| PiConversationCheckpoint | typed AgentInstance instance/profileId/profileVersion/typed或plain文本history |

contextReadSet是Human选定精确文件，不含目录/glob/控制面或重复Windows别名；最多16文件，单文件262144字节，总2097152字节。Snapshot排序和digest确定性绑定每个文件。空context集合允许空文件夹讨论/执行。TaskDispatchContext.digest保持原义；额外plan/profile/context绑定在ConfirmedTaskGrant中。旧确认仍支持仅 `legion_write_file`；项目广读允许它与两项受控读工具并存；局部编辑可再加入 `legion_edit_file`。构造该grant本身不授权。

AgentConfig新增lifecycle，默认single_run；conversation必须scope.write为空且不含写工具，可按项目广读增量请求两项受控读工具。PiConnectionProfile仅支持openai-completions/openai-responses/anthropic-messages；无key/function，baseUrl无内嵌凭据。metadata仅plain的id/name/api/provider/baseUrl/reasoning/input/cost/contextWindow/maxTokens/compat；连接相关字段不能覆盖可信profile。未提供metadata为null（unknown），不生成真实报价。History/Checkpoint不含permit、Human确认、SDK对象、工具pending或活动run；恢复时host验证workspace/profile并重建typed instance，不因历史自称身份产生权限。

```javascript
const { controller, mutationAuthority } = createWorkbenchAuthority({
  workspaceIdentity, organizationVersion, profileVersion, boundaries // typed RoleBoundary[]
});
const readAuthorization = controller.confirmContextRead(readConfirmation);
// ProjectProvider只接收opaque readAuthorization及可信当前binding，不接收controller。
ContextReadConfirmation.assertForRead(readAuthorization, {
  workspaceIdentity, organizationVersion, profileVersion, resources
});
controller.bindContextSnapshot(readAuthorization, snapshot); // typed ContextSnapshot
const taskApproval = controller.confirmTask(taskGrant); // typed ConfirmedTaskGrant
controller.registerInstance({ taskApproval, instanceId, session, dispatchContext, scope });
controller.beginRun(instanceId, runId);
const instance = controller.instanceSnapshot(instanceId);
const decision = policy.evaluate(proposal, {
  boundary, trustedSession: session, currentVersion: organizationVersion,
  taskStatus: 'active', knownRoles, instance, dispatchContext
});
const permit = controller.issue(proposal, decision);
const mutation = createMutationService({ workspace, authority: mutationAuthority });
const result = await mutation.execute(proposal, permit);
let status = 'failed';
if (result.success) status = 'completed';
controller.finishRun(instanceId, status);
```

factory/controller由可信主进程Human IPC之后调用，不向renderer/model提供。confirmContextRead返回私有registry opaque对象，纯confirmation构造值、JSON重建或相等对象不能通过assertForRead。checkContextRead(readAuthorization,resource)验证单个精确资源；bindContextSnapshot要求同确认、根/版本/profile、完整选取集合且只绑定一次。confirmTask要求该factory已绑定snapshot和已知role；确认ID不能重放。registerInstance精确消费taskApproval，实际AgentSession、typed TaskDispatchContext/AgentScope及task文件/tools必须匹配，实例scope只能缩小角色与任务。

controller公开方法仅confirmContextRead/checkContextRead/bindContextSnapshot/confirmTask/registerInstance/instanceSnapshot/beginRun/finishRun/issue/revoke。instanceSnapshot含原instanceId/session/grant/grantDigest/status/runId及typed workbenchGrant。执行instance仍ready→running→terminal一次；finishRun撤销其permits。revoke(reason)同步永久invalid所有实例和read/task/permit/receipt，恢复旧值不复活；plan/profile/context/org/boundary或scope变化由可信Pipeline先revoke，再等待取消及终态审计，最后关闭Mutation。真实审计fault不得伪装取消。

mutationAuthority仅三个方法：consume(proposal,permit)返回opaque receipt；recheck(proposal,receipt)返回typed MutationVerification；release(receipt,{verificationFailure}={})释放。Storage通过isWorkbenchMutationAuthority的私有registry品牌校验，无duck typing。成功release只删该receipt，可继续同task其他独立permits。verificationFailure限定root_identity_changed/context_changed/verification_unavailable，必须带本authority实际receipt；立即永久invalid整个authority。未知原因或外来receipt抛TypeError，不撤销另一个authority。Model的载荷构造也不能代替品牌receipt。

Storage options新增authority，与原私有_authority互斥，非品牌输入抛TypeError。Provider在串行提交中真实重查root canonical/dev/ino、所有路径组件及Node可识别链接、context bytes/SHA。使用有限fd读取，验证读取前后身份/size/mtime/ctime和当前路径身份；mtime/size相同仍必须比较SHA。最终同步root/context、输出目标/父链、authority重查后rename，中间无event-loop gap。context源被授权写改变后不静默刷新旧确认。失败立即通过lower release通知纯Model，无controller或上层callback。旧audit intent/result语义继续保持。

讨论必须走Desktop唯一WorkbenchPipeline→Adapter及userData能力，不调用旧Runtime/readFile/createAgent/run。Runtime.readFile仍是可信host观察，不是Agent读许可。首消息唯一PM与其他Agent direct chat/start拒绝属于Desktop。客户软件检查没有executor为not_executed；本版不新增shell。任务记录16MiB/4096事件/刷新64MiB由Desktop实现。

## 本阶段验证与限制

Model三suite45、Storage/Event24、Policy/Scope17分层实际通过，0fail/skip。Model首轮44/1事件列表遗漏text_delta保留实际工具输出；Storage async realpath EPERM及斜杠prefix断言失败日志保留当前KernelEngineer/tmp，修正为原生realpathSync和resolve/relative严格范围检查。输出父链timing回归修前23/1、最终24通过，断言保持。链接EPERM fallback及晚变timing为受控lstat元数据，不能当nativejunction/全部reparse/OS隔离证明；root替换与恢复、SHA、字节、audit、实际文件写原生执行。

最终固定命令为以下显式九suite，300秒、serial、缺失失败。候选、完整输出、最终实际计数见[工作台task_ops记录](../../scheduling/legion-desktop-workbench-v2.md)，不使用旧74项或桌面原型作为新版验证。所有文档完成后运行最终check，之后不再改候选。

```powershell
Set-Location 'D:/work/code-work/agent-organization-runtime'
$env:PYTHONUTF8='1'
$env:PYTHONDONTWRITEBYTECODE='1'
$env:TEMP='D:/work/code-work/agent-organization-runtime/.ans/runtime/legion-desktop-workbench-v2/KernelEngineer/tmp'
$env:TMP=$env:TEMP
$env:NODE_DISABLE_COMPILE_CACHE='1'
Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
Remove-Item Env:NODE_COMPILE_CACHE -ErrorAction SilentlyContinue
node --test --test-concurrency=1 tests/kernel/test_models.test.mjs tests/kernel/test_agent_models.test.mjs tests/kernel/test_policy.test.mjs tests/kernel/test_mutation.test.mjs tests/kernel/test_events.test.mjs tests/kernel/test_demo.test.mjs tests/kernel/test_agent_scope.test.mjs tests/kernel/test_agent_runtime.test.mjs tests/kernel/test_workbench_models.test.mjs
```

[当前设计](docs/design/2026-10-07_design_desktop-workbench-v2.md)。下列v3 API继续兼容，其74项旧证据为历史；Adapter conversation/新包/桌面整体验收尚由后续owner完成。

产品为 ESM .mjs；Kernel Interface 位于 src/kernel/interface/runtime.mjs，仅导出 createRuntime。既有 ProjectManager 根 runtime.mjs 转发此入口，当前修复只读其文件；包与 CLI 对新候选的检查由后续阶段刷新。无 HTTP 服务。

## 宿主与实例

```javascript
const runtime = createRuntime({
  workspace, boundaries, organizationVersion: "v3",
  dispatchContext: {
    roleId: "Backend", taskId: "task", organizationVersion: "v3",
    writeSet: ["backend/a.txt"], tools: ["legion_write_file"],
  },
  modelProviders: [{
    provider: "configured-provider", api: "configured-api",
    baseUrl: "https://configured-host", apiKey: "literal-key",
    models: [modelMetadata], streamSimple: trustedInferenceStream,
  }],
});
const agent = await runtime.createAgent({
  name: "worker", proxy: { provider: "configured-provider", model: "configured-model" },
  scope: { write: ["backend/a.txt"], deny: [".ans/"], tools: ["legion_write_file"] },
});
try {
  const result = await agent.run({ taskId: "task", prompt: "Update the approved file." });
} finally {
  await runtime.close();
}
```

workspace 为已存在目录；null/未提供时 StorageProvider 创建临时工作区并在 close 清理。boundaries 为 RoleBoundary 或对应 camelCase record 的数组。organizationVersion 是非空字符串。dispatchContext 为 TaskDispatchContext 或其 record；角色必须存在且版本一致。可选 sessions 数组用于保留可信宿主的手动 permission 流程，AgentSession 实际对象保留；未提供 dispatchContext 时 createAgent 拒绝。提供 context 时手动提案同样受精确任务限制。

modelProviders **必须为数组**，每项恰含 provider/api/baseUrl/apiKey/models/streamSimple。provider 唯一，models 为非空、id 唯一的元数据数组；三个连接字段非空，apiKey 是 literal，不支持 shell/变量解析。Pipeline 复制元数据并私有转换为 Adapter 所需 keyed record；推理函数不会收到 Runtime、permit、submit 或文件能力。未知 provider/model 创建失败。

AgentConfig 为 name/proxy/scope；proxy 仅 provider/model，模型输入不能覆盖角色/task/version。scope.write 为合法相对资源数组，deny 为目录或精确资源数组。默认旧宿主工具恰为 ["legion_write_file"]；显式项目广读时可只用两项读工具，或在写工具旁加两项读工具；受控编辑可加入 `legion_edit_file`。写请求范围必须同时属于角色和 task.writeSet，deny 优先；不静默裁剪。末尾 /（反斜杠等价）表示目录，其余为精确文件，无 glob；精确 task grant 不允许请求整个目录。空 write 可用于项目只读实例。

返回冻结 Agent façade：instanceId/name/sessionId/roleId/taskId/organizationVersion，只读；以及 run({taskId,prompt})、cancel()、close()。run 返回 Promise<PiRunResult>，taskId 必须匹配且 prompt 非空；一次实例仅运行一次。重复 name 拒绝，完成/失败/取消释放 SDK 会话，cancel/close 可重复。创建失败抛 TypeError 或 AbortError；创建期间上下文撤销会关闭结果，不发布可运行 façade。run 失效返回 cancelled/kernel_run_cancelled；真实审计故障返回 failed/kernel_audit_failed，已发生的修改保留在 toolResults。

## 权限与观察方法

单 PermissionRuntime 位于 src/kernel/pipelines/permission.mjs，Interface 只调用其公共方法。手动 permission 输入为共享 ActionProposal Model，session 必须是已注册可信对象；重建相等对象不被认可。

| Runtime 方法 | 返回与保证 |
| --- | --- |
| prepare(proposal) | Promise 冻结 {decision,permit}；记录 proposal/decision，允许才产生 opaque permit，不写目标 |
| execute(proposal,permit) | Promise<MutationResult>；当前策略与单次许可重验，PolicyDecision 不能作为权限 |
| submit(proposal) | Promise 冻结 {decision,result}；完整提案、决策、许可和执行 |
| createAgent(config) | Promise 冻结实例 façade |
| updateVersion(version) | 同步撤销全部旧权利后，Promise 等待相关会话停止 |
| updateBoundary(boundary) | 接收 Model 或 record；同步撤销该角色权利，Promise 等待停止 |
| setTaskStatus(taskId,status) | active/completed/cancelled；同步撤销该任务权利，Promise 等待停止 |
| events() | Promise 冻结 Event 数组，按序核对 index/daily；损坏抛 MutationError |
| readFile(resource) | Promise UTF8 文字，安全路径检查；是可信宿主观察，不是 Pi 读工具 |
| close() | 先关闭入口并撤销权利，再等待会话停止与全部运行终态审计，最后关闭 Mutation/清理临时工作区；幂等 Promise |

更新版本/边界/任务后，即使恢复旧值也不恢复旧 permit 或 Agent。新组织版本不能复用陈旧 dispatchContext；可信宿主需以新 context 构造 Runtime。prepare/execute 可分开使用；执行仍绑定 proposal/content digest 和当前 task/version/boundary。Runtime 故障时后续写入关闭。

## 下层公开入口

Policy public 模块仅导出 PolicyService/createPolicyService。evaluate(proposal,{boundary,trustedSession,currentVersion,taskStatus,knownRoles,instance,dispatchContext}) 返回不可变 PolicyDecision，纯计算；validateScope(boundary,dispatchContext,scope) 返回冻结 grant 或抛 TypeError。五值为 ALLOW、DENY、REQUIRE_APPROVAL、REQUIRE_HANDOFF、REQUIRE_SCOPE_EXPANSION，后三者不执行。shared requiresApproval 是 Policy 与 authority 同一个谓词，write_file 为 action token，其余审批条件为完整资源。

Mutation public 模块导出 MutationService/MutationError/createMutationService；工厂 options={workspace,_authority}，私有注入只供受控 Pipeline。execute/recordEvents/events/readFile/createIdentity/workspace/close；不调用 Policy 或 Adapter 同行。Storage public 模块导出 StorageProvider/StorageError/createStorageProvider；同 options，方法 write/appendEvents/readEvents/readFile/createIdentity/workspace/close。普通无 authority 的工厂不能写目标、写审计或产生 Runtime 身份。抽象类不能直接构造，具体实现不从 public 导出。

Pi Adapter 的 async createPiAgentService({instance,proxy,scope,cwd,modelProviders,signal}) 仅由 Pipeline 调用。start_run(runId,prompt) 立即启动并返回，随后 next_event(runId,{signal}) 拉取。tool_request 的 request 是原 PiToolRequest；run_event 包含 runId/eventType；终态包含 PiRunResult result。Pipeline 用可信 Session 调 ProposalService.convert(request,session)，回应 PiToolResult 一次。Agent 不暴露任何这些 Service、Provider、SDK 或 permit。

## 不可变共享 Model

core.mjs 导出 AgentSession、RoleBoundary、ActionProposal、PolicyDecision、ExecutionPermit、MutationResult、Event 与纯路径/审批/授权帮助函数。agent.mjs 导出 PiConnection、AgentScope、AgentConfig、TaskDispatchContext、AgentInstance、PiToolRequest、PiToolResult、PiRunResult、PiEventType。字段为 camelCase；Model 拒绝未知字段、非法标量集合，复制并冻结数组。AgentInstance Model 仅身份，Interface 才提供生命周期 façade。

ActionProposal 为 proposalId/action/resource/content/tool/capability/session/可选 runId；digest 绑定内容 SHA256、身份及全部动作字段。PolicyDecision 为 outcome/reason/proposalDigest/organizationVersion/可选 boundaryDigest/handoffTarget。PiToolRequest 为 requestId/runId/toolCallId/tool/parameters{resource,content}；PiToolResult 为 requestId/runId/decision/result；PiRunResult 为 runId/status/assistantText/toolResults/errorCode，status 为 completed/cancelled/failed。Model 不产生 fs/env/time/random/SDK 效果。私有-wiring authority 不是安全沙箱接口；保证适用于正常受控本地 API。

## 文件与审计语义

硬拒绝 .ans/.git/.agents/.codex/.aws 根、绝对路径、遍历、设备名、非法 Windows 组件和 Node 可识别的 symlink/junction。路径规范化分隔符、按 toLowerCase 比较别名。工作区根及所有父组件在执行/审计时重验，正常提案不能使用内部控制面权限。

StorageProvider 在同目录写 UTF8 临时文件、sync，最终 recheck 后同步 rename，避免授权撤销在最后检查与本地提交之间获得事件循环调度。单次 permit 消费后的 opaque receipt 支持异步等待之后重验。同工作区不同 Runtime 的提交在 Provider 协调，不锁住 Pi 事件等待循环。

日志为 workspace/.ans/events/index.jsonl 和 YYYY-MM-DD.jsonl。Provider 生成 Asia/Shanghai +08:00 recordedAt；两份 JSONL 分别 sync，读取核对序号、时间和内容一致。仅记录身份/路径/摘要/相关 ID/结果/安全事件类别，绝不写正文、prompt、模型原消息、凭证或原始错误。

正常允许：proposal → decision → mutation_intent → mutation_success；拒绝：proposal → decision → mutation_failure；文件错误：mutation_failure。Agent 增加 agent_created/agent_run_started/agent_run_event/agent_run_completed、cancelled 或 failed。correlationId 对动作是 proposalId，对运行是 runId。

| status | success | observedMutation | auditFailed |
| --- | --- | --- | --- |
| written | true | true | false |
| denied | false | false | false |
| failed | false | false | false |
| audit_failed | false | false 或 true | true |

意图审计失败不创建目标目录/文件；实际替换后的结果审计失败返回 observedMutation=true，绝不假装回滚，并停后续写。文件/index/daily 不是跨文件事务。坏日志需可信宿主处理。保证不覆盖所有 reparse tag、恶意同进程宿主或外部竞争替换。

## 可复制验证与证据

```powershell
Set-Location 'D:/work/code-work/agent-organization-runtime'
# 本 Windows sandbox 默认 TEMP 不适合子文件；普通宿主可省略这两行。
$env:TEMP='D:/work/code-work'
$env:TMP='D:/work/code-work'
node src/kernel/interface/demo.mjs
node --test tests/kernel/test_models.test.mjs tests/kernel/test_agent_models.test.mjs tests/kernel/test_policy.test.mjs tests/kernel/test_mutation.test.mjs tests/kernel/test_events.test.mjs tests/kernel/test_demo.test.mjs tests/kernel/test_agent_scope.test.mjs tests/kernel/test_agent_runtime.test.mjs
```

环境 Node24.11.1、Pi SDK/pi-ai1.0.4。本次八 suite 共74 tests：Model31、policy/scope15、mutation/events14、pipeline13、demo1；全部0skip。新增仅一项真实 SDK Runtime.close owner 回归，严格 Tester close 原样只读重跑通过。真实 SDK 与官方公开 Faux 推理辅助形成受控离线闭环，fetch 禁用断言通过；没有仿制 Agent 循环或付费请求。task_ops 使用 PythonUTF8/禁止字节码及相同 TEMP，仅为开发治理工具，产品无 Python。

两个链接测试本机 native junction 创建 EPERM，source/target/TEMP 均在 D:/work/code-work。仅该错误时注入 lstat 元数据进入同一真实拒绝分支，未 skip；因此这两个用例不是原生 junction/reparse 端到端证明，其他文件与审计效果原生实跑。原 mutation12pass/2fail、pipeline11pass/1fail与最终73项证据保留为历史。后来独立 Tester20项中19通过/1失败，活动 Pi 的 Runtime.close 使终态审计晚于 Mutation.close，误报 kernel_audit_failed。修复只跟踪完整 run Promise 并等待终态审计；run.finally 不反向 await Runtime.close，真实审计失败仍保持 failed。原严格测试与失败日志未改。当前五项最终检查见[修复任务](../../scheduling/legion-pi-node-v3-close-repair.md)，Supervisor与下游独立验收。

历史：[Python v1](docs/design/2026-10-07_design_phase1.md)、[审批修复](../../scheduling/legion-v1-approval-repair.md)、[独立原缺陷](../Reviewer/docs/review.md)。旧候选 40/47 tests 与整个 v1 独立101项成绩均不能证明 Node v3。

## 完整组织工作流：检查与控制工具（2026-10-08）

[共享 Model 规范](docs/design/2026-10-08_design_software-checks.md) 已 verified。Model 的实际导入路径为 `src/kernel/models/check.mjs` 与 `agent.mjs`；PM 负责新增包导出，本阶段不改 facade。CheckSpec/Request/Authorization/Decision/Result 和 AgentControlDecision/Result 均为冻结 typed 值，constructor 本身不证明客户批准或实际执行。

`validateInstanceGrant` 与 PolicyService.validateScope 现在支持现有四类读写和以下 capability 对：

| 工具 | role boundary 必须声明的 capability |
| --- | --- |
| `legion_run_check` | `run_check` |
| `legion_design_roles` | `design_roles` |
| `legion_propose_roles` | `propose_roles` |
| `legion_review_roles` | `review_roles` |
| `legion_request_interaction` | `request_interaction` |
| `legion_submit_acceptance` | `submit_acceptance` |
| `legion_request_repair` | `request_repair` |

工具必须同时位于角色 boundary、task dispatch 和实例 scope。检查 scope.checks 必须是 task checks 的完全 spec 子集；run_check 必须有非空检查授权。grant 快照新增 `taskChecks` 和 `checks`（仅传入 checks 时出现）；这两项为冻结普通记录，执行时仍须使用 typed CheckAuthorization。空 writeSet 拒绝写/编辑工具，原读工具成对约束、读 scope/capability 与精确写边界保持有效。Desktop 负责控制工具的实际身份与领域审批，payload 不提供调用者身份。

### 检查 Service 公共入口

```js
import { createCheckService, CheckService } from './src/kernel/services/public/check.mjs';
const service = createCheckService({
  workspaceRoot, runtimeExecutable, outputRoot, authorizationValidator,
});
const { decision, result } = await service.run(request, authorization, { signal });
await service.close();
```

这是本阶段实际签名。三个路径参数均为非空绝对 string；工作区和 outputRoot 必须已存在且物理祖先没有链接，二者不可相同；runtimeExecutable 为可信宿主固定 Node/Electron 可执行文件。Node 可用 process.execPath；Electron 实际 Node 模式启动会带固定 ELECTRON_RUN_AS_NODE=1。非 macOS、缺失实际隔离或运行时探测失败返回 unsupported。公共 factory 自行创建相邻 Provider；Pipeline 不接收/创建 Provider 来注入 Service。`provider` 不是公开选项。

`authorizationValidator` 是可信宿主的 live 校验端口，对外公开：

```js
await authorizationValidator.validate(request, authorization, { signal });
// 允许时必须返回：
{ decision: CheckDecision, authorization: CheckAuthorization, signal: AbortSignal }
// 拒绝时只要求 matching typed decision；不会启动测试进程。
```

宿主端口必须核实实际 customer confirmation、workspace/plan/organization/profile/fileOwners 和 role/task/session/instance/run 仍有效，匹配确切授权 digest。允许时必须提供真实 AbortSignal，并在确认撤销、身份/版本变化、任务或 run 结束时 abort。Service 校验返回 typed 值和 request/run/check/digest 对齐，执行前后验证，并组合此信号、调用者取消和 close；授权变化返回 stale。端口只留在 Service，不进入 Provider、不允许 Provider 回调 Pipeline 或其他 Services。构造 CheckAuthorization、返回模型填写的 roleId 或单个 true 都不能获得许可。

`run` 参数必须为 CheckRequest 与 CheckAuthorization，非法类型/取消信号抛 TypeError。正常业务失败返回冻结 `{decision, result}`，可直接构造 PiToolResult。passed 只来自真实非零测试数且退出 0；failed 为非零退出；取消或超时 cancelled；输入/授权变化 stale；不具备隔离 unsupported；零测试、证据错误或 host 校验错误 error。close 可重复，撤销并等待本 Service 当前执行。

### 相邻检查 Provider 公共入口

`src/kernel/providers/public/check.mjs` 实际导出 createCheckProvider、CheckProvider、CheckProviderError。Provider factory 配置仅 `{workspaceRoot,runtimeExecutable,outputRoot}`；方法为 `run(request,authorization,{signal})`、`notExecuted(request,authorization,status,reason)`、`close()`，runtimeExecutable 只读 getter 返回物理运行时路径。它不接受授权 validator；notExecuted 仅创建未执行 typed 观察值并取真实时间，不授予权限。

每次实际执行创建 outputRoot 下唯一 `check-*` 目录，含只读 reporter.mjs、`tmp/` 和 `outputs/`。CheckSpec.outputResources 映射在本次 outputs 下；模型/测试只经固定 LEGION_CHECK_OUTPUT_ROOT 找到输出。只有声明输出和本次 tmp 可写。输入读取采用批准 inputVersions 的精确文件和必要目录定位，其他个人目录/控制文件/凭据及业务文件写入默认拒绝。输入必须包含所有实际代码依赖、测试夹具和 package metadata，不能借泛目录读绕过声明。

固定宿主 reporter 由 Provider 生成、模型不可选择；实际完整命令记录 `[runtimeExecutable, '--permission', '--allow-fs-read=*', '--allow-fs-write=*', '--allow-child-process', '--test-isolation=none', '--test-reporter=<本次只读reporter>', ...spec.argv]`。固定 reporter 经运行初始化认证后通过 fd3 传递带 MAC 和严格递增序号的 Node 事件，用于 testCount；裸 JSON、错误认证或顺序不符会返回 error。计数排除自动 file wrapper、skip 和 todo；观察到真实失败不会因候选退出码 0 转成通过。stdout/stderr 与 TAP 文本只进入有界日志。此通道的已验证范围和同进程限制见下文。Service 按宿主派生的固定 reporter 形式及逻辑 spec.argv 验证完整命令，并核对 spec、输入摘要和环境网络。

工作区物理 identity、输入 SHA/大小/物理文件版本、固定运行时和输出 identity 在运行前、运行中及结束后重查；依赖更新使当前证据失效。环境为固定 PATH/LANG/TMPDIR/TMP/TEMP、ELECTRON_RUN_AS_NODE 和检查输出地址；不设置或继承 NODE_OPTIONS，也不继承 API keys、credentials、HOME/CODEX_HOME。固定 Node 权限参数显式位于实际 argv。stdout+stderr 按 spec.logMaxBytes 合计截断，logsTruncated 如实记录；超时包含准备和实际测试预算。

详细结果字段与七工具 schemas 见共享 Model 规范。当前真实测试只证明本机 macOS Node 运行，不代替其他平台、Electron 宿主或 Desktop UI 端到端验收。

本次运行器固定使用同进程 Node test isolation=none，并由实际 macOS sandbox deny process-fork 禁止检查主动创建子进程；spawn、spawnSync、fork 和 detached 的 posix_spawn 路径均实际 EPERM 拒绝。需要派生进程的测试会明确失败，不切回普通无隔离执行。environment.isolation 固定为 `macos-seatbelt+node-events-v1+no-child-process`，UI 应显示这一实际能力限制。单个隔离进程由本次独立进程组终止，取消和超时不触及其他进程。平台/运行时不支持安全 flags 或隔离时为 unsupported。

Permission demo 现在接受可选 `runPermissionDemo({workspace})`，角色测试显式传入本阶段隔离 fixture；缺省临时 workspace 由 Storage 使用 OS temp 的物理路径创建，保持原调用兼容。


### 2026-10-08：结果通道校验返修

旧 fd3 分离不能识别发送者：空候选直接写 `{type:'test:pass', ...}` 曾被错误计为通过。此问题已用真实隔离 fixture 复现，原失败候选保留于[返修任务](../../scheduling/legion-governed-workflow-v1-reporter-repair.md)。不能用原 153 项结果宣称旧通道已验证这一场景。

当前实现由宿主每次生成 32-byte 随机运行密钥，经额外初始化管道交给 reporter；reporter 在候选代码加载前消费并关闭该管道，构造 private KeyObject，清空初始 byte buffer。密钥不写 helper、环境、argv 或日志。Node 在初始化创建唯一 Reporter Transform 实例；重复创建、用伪造 this 调用报告方法被拒绝。发送函数和 crypto/IO/序列化方法引用在初始化捕获，关键 stream 入口固定，避免已测的 builtin export 和完成入口替换成为发送代理。

宿主 collector 先核对 MAC，再解析事件正文及序号；必须有初始化帧，重放、无认证的 fd3 JSON 和候选构造的假 MAC 都不能增加测试计数。完整 actualArgv 和公共 Model/Service 签名保持原约定，environment.isolation 仍为 `macos-seatbelt+node-events-v1+no-child-process`。

宿主固定补充运行参数是实际 argv 中的 `--permission`、`--allow-fs-read=*`、`--allow-fs-write=*`、`--allow-child-process`；probe 和正式 run 都传入，避免依赖 Electron 可能忽略的 NODE_OPTIONS。这里的 fs/child API grants 将真实效果继续交给 macOS 精确文件规则与实际 deny process-fork；不会给候选更大的文件或子进程能力。该模式不授予 inspector、native addons、worker threads 或 process.binding。执行候选前的固定运行时探测实际核查这些 API 拒绝成立；不满足前提时返回 unsupported。需要这些 API、篡改被固定 stream 入口或绕开 reporter 初始化的测试不在本模式支持范围。

**验证范围与限制：** 本机 macOS 普通 Node v24.14.0 的原 160 项回归继续通过，加入真实 Electron Node 宿主兼容用例后的完整 unit 为 162 项通过，覆盖直接 fd3 伪造、假认证封包、重复 reporter/伪造 this、syncBuiltinESMExports 和 stream 完成入口替换、常见 inspector/binding/addon/worker 调用拒绝、空文件/假 stdout、skip/todo 和既有实际通过/失败及所有原 153 项回归。

这是对所列结果通道场景的限定校验。候选和 reporter 仍在同一 JavaScript 进程中；没有建立一般的、针对任意恶意 JavaScript 的不可篡改执行证明。Node Permission 是补充 API 限制，官方明确它不提供恶意代码安全保证；真正的文件/网络/进程隔离仍由 macOS 执行。[Node 权限文档](https://nodejs.org/api/permissions.html#process-based-permissions)

因此批准的测试与输入仍须按普通软件质量流程审阅，测试的断言和覆盖由独立验收确认；认证帧不自动证明任意测试满足需求。其他 Node 版本和 GUI 集成以各自当前输入的真实检查为准；本次另已验证 Electron 44.6 内嵌 Node v24.21.0 的 Provider/Service 实际执行。


### Electron Node 运行参数兼容（2026-10-08）

PM 的实际 Electron 44.6/Node v24.21.0 检查发现，由其他应用调用时 Electron 忽略 NODE_OPTIONS，使普通有效检查返回 unsupported。返修将相同的固定权限参数显式传给运行时，未增加权限；逻辑 CheckSpec.argv、typed 授权和 reporter 认证机制保持原约定。

固定 probe 命令为 `[runtimeExecutable, ...四个权限参数, '--test-isolation=none', '--eval', fixedRuntimeGuardProbe]`，该 probe 是宿主固定代码，验证已有 runtime API 拒绝与实际版本，不由模型提供。正式测试命令如上 actualArgv 列表，Service 按每个固定参数、reporter 位置及全部 spec.argv 精确匹配。argv 不经过 shell，星号是 Node 参数字面内容。Electron 仍以固定 ELECTRON_RUN_AS_NODE=1 运行。

新增本机真实 Electron Provider 通过/非零失败及公共 Service live 批准/typed 结果测试；check 中确认 process.permission 生效且 NODE_OPTIONS 不存在。完整 162 项 unit 0 fail/skip，原 160 项保留；界面/安装包完整验收由 PM/Desktop/Tester 按刷新后的包运行。[兼容返修证据](../../scheduling/legion-governed-workflow-v1-electron-runner-repair.md)

## 项目 Shell v1（2026-10-10）

纯 Model 实际路径 `src/kernel/models/shell.mjs`：ShellRequest、ShellReview、ShellPreparation、ShellAuthorization、ShellDecision、ShellCandidate、ShellResult、FileBaseline；shellEffects、shellArtifacts、shellBaselines 为纯规范化函数。任何下划线 authority/receipt 函数都是 trusted wiring，不属于包、SDK、renderer 或历史公开 API。

```js
import { createShellService } from './src/kernel/services/public/shell.mjs';
const shell = createShellService({
  workspaceRoot, runtimeExecutable, outputRoot, lockRoot,
  authorizationValidator,
  artifactScopes: [{ scope: 'node_modules/', kind: 'dependencies' },
                   { scope: 'dist/', kind: 'build' }],
  npmCli, previewMaxBytes: 8192,
});
const preparation = await shell.prepare(request, {signal});
const pair = await shell.run(request, authorization, review, {signal, onOutput});
// only after ready_for_publication, Host obtains each candidate's text and receipt:
const receipt = await shell.publicationReceipt(request.requestId);
const content = await shell.readCandidate(request.requestId, resource);
// Host uses its existing workbench controller and public Mutation Service.
const permit = controller.issueShellPublication(proposal, receipt);
const result = await mutation.execute(proposal, permit);
const generatedResult = await shell.publishGenerated(request.requestId, {signal});
const final = await shell.finishPublication(request.requestId, {results, generatedResult});
await shell.close();
```

`lockRoot` 必须是已存在、物理、绝对的 Host 私有目录，所有访问同一项目的 Shell/Check 使用同一个目录；outputRoot 为本执行角色的私有效果范围。runtimeExecutable 为 Host 固定实际 Node/Electron 路径。npmCli 为 Host 固定实际 npm-cli.js；缺省仅查该 Node 安装前缀的 npm，不调用用户 shell 配置。artifactScopes 从已 Human 确认计划派生，缺省 []，不能由 request 自行授予。previewMaxBytes 缺省 8 KiB，上限 64 KiB；Host 应按当前模型上下文剩余预算进一步缩小，保留原 Human 内容。onOutput 收到 `{stream,text,truncated}`，允许异步持久化；持久化失败会撤销执行并拒绝发布。

ShellRequest：`{requestId,runId,command,cwd,reason,generatedEffects,network,timeoutSeconds}`。cwd 缺省空项目相对目录，generatedEffects 缺省 [] 且必须为精确目录 scope，network 缺省 none，可显式 localhost/external，timeoutSeconds 缺省300、最大900。请求 id/run 由 Host 从原 PiToolRequest 推导。ShellReview：`{requestId,requestDigest,revision,approved,reason}`，纯值不证明审批者身份。

ShellPreparation 包含 prepareId、requestId/requestDigest、actualCwd、inputVersions、generationDigest；snapshotDigest 是 inputVersions 摘要。审批必须展示逻辑 cwd 与实际镜像 cwd 并绑定该快照。

ShellAuthorization 绑定 authorizationId/projectId/prepareId/organizationVersion/roleId/taskId/sessionId/instanceId/runId/profileVersion/expiresAt；requestDigest/reviewDigest/planDigest/contextSnapshotDigest/fileOwnersDigest/snapshotDigest/generationDigest；workspaceIdentity、writeSet、generatedEffects、inputVersions、fileOwners、artifactScopes、authoredResources。fileOwners 是完整 `{projectId,version,owners:[{resource,roleId}]}`，digest 使用 ProjectFileOwners 同一算法。每个 source writeSet 必须属于本 role。任何生成 effect 必须带完整 authoredResources（含未归属普通源码），不得与任何 owner 或其他 authored 输入重叠；例如将 src/ 称作 build 不能授权覆盖其他 role 源码。Host validator 必须核对该清单真实、完整且仍为当前库存，并核对 artifact kind/scope 属于 Human 确认计划。

Host validator 实际签名 `validate(request,authorization,review,{phase,signal})`。phase 为 approve、consume、publication；返回 matching typed ShellDecision，允许时还必须返回同一 authorization/review 对象与真实 live AbortSignal。consume 在跨进程锁后调用；Host 应原子 claim 其持久审批记录，拒绝其他实例/重启重放，signal 在审批、任务、计划、角色、profile、owner、上下文变化时 abort。Model/digest/对话同意不能产生权限。内部 permit 一次消费，不出 Service。

ShellResult 区分 ready_for_publication、published、partial_published、failed、denied、cancelled、stale、unsupported、error。包含真实 executed/exitCode、有限 stdout/stderr/truncation、candidate metadata、generationDigest、actualCwd、logRef、publishedResources。ready_for_publication 不代表发布，也不代表 Check/Acceptance 通过。SDK 仅得到 Model 值，不得到 receipt/authorization/native helper/私有文件内容读取能力。finishPublication 接真实 MutationResult[] 和生成发布观察，返回最终 published 或 partial_published；不提供 results 时只撤下发布机会并释放锁。实际 source/生成产物纳入最终元数据，删除以 missing 与墓碑表示。

源文件 proposal 使用 `tool:'legion_shell_publish', capability:'request_shell', action:'write_file'|'delete_file', expectedBaseline:candidate.baseline`。baseline 为 `{resource,state:'present'|'absent',sha256:null|SHA,byteLength}`；write 新 SHA/字节必须匹配实际 candidate；delete 强制 present 基线。Host controller.issueShellPublication 验证 branded receipt、原 role/task/source scope、owner 与 context，返回原 Mutation permit；普通 Policy/Runtime 调用必须附同一真实 receipt 才支持此私有 operation。没有 SDK delete tool。原 write/edit 的工具与任务范围、requiredApprovals 均不放宽。

publishGenerated 只发布既定 artifacts，持 project 锁，合法内部相对 `.bin` 链接可复制，其余硬链、逃逸/环/断链、special files 与 setid 权限拒绝。暂存、backup、journal 与阶段 fsync 保留；失败返回 partial_published，并禁用该 backend。recoverGenerated 对当前已发布版本逐项核对后 withdraw，保留新产物与旧备份，不覆盖后续合法改变。同会话可调用版本受控恢复；重启遇未完成 journal 会失败关闭，需要 Host 显式恢复处理，不会自动重跑 Shell。源码多文件事务/恢复 ledger 由 Workbench Host 组合实际 Mutation 负责；Core 不声称它们天然原子。

CheckService 可选 lockRoot 与 Shell 相同，采用保守排他锁，保持旧无锁配置的逐输入 SHA/identity pinning。CheckAuthorization 可选 generationDigest，inputVersions 显式 absence `{resource,state:'absent',sha256:null,byteLength:0}`；只有实际 Host 批准该 absence 才有效，出现文件使证据 stale。原 node-test 固定 argv、no-child sandbox、报告认证与非零测试门禁全部保留。

### 本机隔离能力和信任边界

后端是 macOS Seatbelt + Host 外 native permission signature supervisor。本机 CLT clang/SDK 编译私有 helper；缺少工具或 startup 探针失败为 unsupported，禁止裸 Shell fallback。沙箱工具和 API 是 Apple 私有/弃用接口，版本适用性由实际探针确认。

进程所属采用本次 private positive-canary allow / negative-canary deny 的内核权限签名，并两次核对 PID start identity；不依赖 pgroup/父 PID，也不是 sandbox object ID。Host 外 supervisor freeze/reap/recheck，包括 posix_spawn 逃组和组长退出后的孤儿；sandbox_init 与低层 sandbox_apply 重新限制被真实拒绝，不能躲签名。合法不同 run 的随机 canary 不相交；恶意同用户/可信 Host 在沙箱外刻意复制完整私有 profile 属于既有 Host 信任边界外，不能用权限签名区分这样的克隆。

进程组长 exit 即开始回收，不等待被后台子进程继承的输出管道。回收最长另计30秒；失败禁用后端。Mach securityd/launchd lookup、Host task_for_pid、kern.procargs、extra fd、setuid/setgid 与嵌套 apply 由实际 startup 探针检查。系统 bin 的 setid 入口以及 sudo/su/ARDAgent 等显式拒绝；镜像和发布不复制 setuid/setgid/ACL/xattr。原目录与 Host 用户数据默认无读权限，只有系统 runtime、镜像、私有 HOME/TMP、单个 membership canary 与必要祖先 metadata 可访问。

network none 默认拒绝；localhost/external 必须单条审批。external 使用 IP 网络权限并读取公共 hosts/resolv 配置，不提供域名隔离保证；此轮真实网络测试仅受控 localhost 与 none 拒绝，未访问外网服务或客户目录。

### 普通二进制 source 兼容及安全权限

`readCandidateData(requestId,resource)` 仅供 Host，返回 `{encoding:'utf8',content}` 或 `{encoding:'base64',contentBase64}`；原 readCandidate 仍只返回 UTF8 string，binary时明确要求 Host data API。candidate.encoding 为 utf8/base64，candidate.executable 为真实安全执行位。Host 处理普通图片等二进制资源时构造私有 ActionProposal.contentBase64，必须与 content互斥、canonical decode、原始字节最多2MiB；内容SHA与byteLength按实际bytes核对，仍使用同一receipt/owner/task/currentbaseline。SDK原write/edit不接受base64字段，也没有新直接binary SDK写工具；payload/receipt不进入renderer/history/Pi结果。

source write publication必须设置 `executable:candidate.executable`；present Baseline可含 executable。提交前核对该位；替换保留已有安全读写权限，允许owner执行位，创建缺省0600或0700；不保留setuid/setgid/ACL/xattr。delete仍独立present基线及missing/tombstone。audit_failed但实际删除时也保留真实缺失墓碑，不伪称回滚。

snapshot不在内存累积所有文件Buffer，只保留hash/metadata。generation包含普通文件、合法链接、安全执行位及目录存在，空artifact目录与缺失不同。准备、执行前Host验证、锁等待、命令、候选检查和发布使用总预算；PM等待不计活动预算；取消后额外回收最多30秒。

## 2026-10-10 依赖读取修复：输入范围与发布范围

实际函数签名、Shell Model字段与SDK参数均不变。factory.artifactScopes中 `kind:'dependencies'` 的精确scope声明可读取的已验证依赖；缺省 [] 不增加默认读取链接。输入树链接验证范围是这些dependency scopes与本条request.generatedEffects的并集。prepare/acquire、执行后mirror和原目录复查、生成发布前扫描及恢复扫描都使用该输入范围。相对链接目标必须仍在同一scope内的无硬链regular文件，保护路径、绝对/逃逸/断链/环/special权限仍拒绝。

`ShellPreparation.generationDigest`、同一authorization.generationDigest和result/publishGenerated.generationDigest，明确是完整 **input artifact generation**：固定读取dependencies与本条批准输出scopes中的普通文件字节、相对链接目标、执行位、目录存在。snapshotDigest保持原regular FileBaseline摘要；因此caller必须同时复用prepare给出的inputVersions/snapshotDigest/generationDigest，不能自行仅对dist计算替代，也不新增SDK请求的input digest或许可字段。

Provider私有writeGenerationDigest单独保存只针对本条generatedEffects的旧发布目录基线；readonlyDependencyDigest单独钉住本条未申请生成的fixed dependencies。执行后readonly依赖file/link/执行位/目录变化，返回error `shell_readonly_dependency_changed`、空candidates/effects，整次不发布；原目录在审批后改变依赖（包括两个相同bytes目标之间重定向链接）在acquire返回 `shell_input_changed`，或运行复查返回stale。本条只申请dist时不允许创建、替换、删除或发布node_modules，也不会为读.bin自动扩大授权；私有mirror运行仍沿v1允许临时处理，提交门禁要求readonly依赖完整不变。

候选source owner/task/writeSet、gen与完整authored inventory不重叠、Host private一次许可和真实PM审批都保持原约束。实际写/publish循环仍只有本条authorization.generatedEffects，返回resources仅含真正批准并发布的目录。现有node_modules/.bin用于only-dist真实build，不需要把node_modules放进request.genEffects。

验证使用新fresh受控fixture：先真实本地npm安装发布，再only-dist执行.bin并发布dist，比较原依赖bytes/link/mode及根inode完全不变；readonly dependency file/link/mode/dir修改整批拒绝；同bytes link retarget使旧授权stale；未声明/escaping/hardlink/broken/cycle/credential链接继续拒绝。三项最终配置检查与当前7文件SourceHashes以新task handwell-project-shell-dependency-read-repair-v1同候选记录为准，旧0.8.0和原verified成绩不充当新证据。

本修复的公开Service兼容：acquire遇真实input/generation/root/snapshot变更时，Provider.notExecuted构造未执行stale值，避免沿既有Service包装为普通error；Service签名/源码不变。真实Service case在审批后将.bin链接换到相同bytes目标，返回stale、executed=false且无输出发布。中间候选配置shell156项通过保留历史；最终同candidate三检查以新task记录为准。

## 2026-10-10 显式时间事实修复（当前Host调用契约）

纯Model不读取时钟。ShellService与MutationService新增Host-only `observeTime(): number`，由其相邻Provider读取fresh epoch milliseconds；fact必须是非负safe integer。没有新SDK clock工具、request/review/result/history字段，也不接受Model clock callback、环境对象或旧issue时刻替代后续事实。public factory参数/导出不变。

`controller.issueShellPublication(proposal, receipt, observedAtMs)`第三参数现在为必需的fresh事实，Host调用例：`controller.issueShellPublication(proposal, receipt, shell.observeTime())`。每个proposal单独观察，不预先为整批缓存时间。PolicyService.evaluate的私有publication上下文也须 `{publicationReceipt, observedAtMs:mutation.observeTime()}`。普通write/edit/issue原用法不变。

内部execution authority issue/consume、Core RuntimeAuthority issue/consume/recheck与Workbench lower mutation authority逐层传事实；Model仅比较authorization.expiresAt和该显式事实，缺失/NaN/invalid事实拒绝Shell路径。Provider.consume读取新时间，user command真正spawn前再次检查到期；Service创建publication receipt观察新时间，Storage消费、context复核以及真正创建/替换/删除的同步commit前再次观察。生成目录commit同样观察fresh时间。到期检查不以abort timer替代；brand、request/role/task/owner/baseline、live AbortSignal、nonce/one-use仍同时有效。失败consume先删除旧permit，不能用更早事实重放。

实际自有测试包含：禁用全局Date.now时pure Model仍以显式事实完成验证；missing/NaN/负值/非整数拒绝；精确到期边界拒绝issue/consume；issue后的Provider实际到期消费未执行；publication issue后Storage新观察到期，真实文件未变且旧permit回退时间仍不能重放。此前普通binary、dependency-read、生成恢复和permission signature强断言保留。原Reviewer纯度正则只读对Models局部核对，不宣称运行其完整suite或修改其断言。

本次同v1、同主c872精确范围21文件repair，实际最终三checks与21outputs/sourceHashes见 handwell-project-shell-model-time-facts-repair-v1 的冻结candidate记录；旧0.8.1/0.8.0保持历史，0.8.2由PM后继实际包装，当前Kernel不声称其已发行。

## CLI 角色 owner v2（2026-10-10）

产品运行时 `TaskDispatchContext`、`ConfirmedTaskGrant` 和 `ShellAuthorization` 拒绝 `writeSet`；字段 `fileOwnersDigest` 与 `ownerGeneration` 绑定可信项目 owner 的 digest 与 `version`。TaskDispatchContext 不接收 owner 映射；映射仅由 Host 传给 `createWorkbenchAuthority({fileOwners: ProjectFileOwners,...})` 或 `PermissionRuntime({fileOwners: ProjectFileOwners,...})`。缺失 owner 快照拒绝。持久 owner 未变时跨计划沿用，任务只限制工具、checks、生成效果、实例与 run。

`validateScope(boundary, dispatch, scope, fileOwners)` 与 `validateInstanceGrant(boundary, dispatch, scope, fileOwners)` 新增显式 owner 快照参数。源码工具 scope.write 必须是该角色所有精确 owned 文件；不能传目录或任务子集。deny 和 requiredApprovals 保留。无源码工具的 scope.write 必须为空。不同实例 permit/receipt 仍不可复用；RuntimeAuthority 拒绝同角色同时可写 run；PermissionRuntime 把同角色 run 排队。

Storage/Mutation 接受私有纯数据 `leaseContext={leaseRoot?, nonce, leaseIdentity:{deviceId,fileId}, holderIdentity:{deviceId,fileId}}`。两个 identity 分别是 `<workspace-key>/` 目录与 `<workspace-key>/holder` 普通文件的原生 dev/ino。默认 root 为 `~/.legion-project-leases`；override 仅可信 Host 的隔离 fixture 构造使用，不能由产品 CLI 的任意 userData 决定。nonce/identity 不进入 DTO、Model、日志或 SDK；不存在 IO callback。

ProjectProvider 在 Human v2 确认时以 `0600`/`wx` 建不可变 `<key>.owner-source.json`：

```json
{"schemaVersion":1,"workspace":{"canonicalPath":"...","deviceId":"...","fileId":"..."},"source":{"catalogDirCanonicalPath":"...","dirDeviceId":"...","dirFileId":"...","filename":"workbench-projects.json","projectId":"..."}}
```

key 是实际 workspace `sha256(deviceId + ':' + fileId)`。marker source 绑定唯一 catalogDir 与原生 identity，catalog 中通过 `projects[].id` 找一个当前项目，核对 workspaceIdentity 和 fileOwners。不同 userData 必须在 Host confirm/execute 阶段返回 owner_catalog_mismatch；Kernel pin marker 的 inode/字节，拒绝替换、篡改、链接与非600 marker。

Storage 自己通过 FS 取得 `<key>/commit.lock`（`O_EXCL|O_NOFOLLOW`、0600，最大等候2秒）。锁内反复 no-follow 同步重读 holder（100 bytes）、marker（16KiB）和 catalog（4MiB预算），核 generation/digest/精确 owner、活跃holder identity/nonce与既有 permit/receipt，然后进行原有context核验、审计与原子源码 Mutation。最后一次同步 owner/permit核对与 rename/unlink 无 event-loop 间隙，finally 按锁inode核对释放；释放失效保留 observedMutation 并失败关闭。

Desktop ProjectProvider 所有 v2 catalog 写操作遵守同一 commit mutex；锁顺序为 commit mutex → catalog lock。转交在该保护内撤销当前实例、等待提交结束并 CAS 新 owner；Storage 无调用上层或 peer Provider 路径。未提供 leaseContext 拒写；旧 ownerGuard 参数直接作为未知字段拒绝。

`runPermissionDemo` 无 workspace 时仅使用 Provider 自行创建的临时工作区和真实隔离 owner catalog/lease，不接触客户目录；显式 workspace 必须提供 leaseContext。测试 helper `testLeaseContext` 在 Kernel fresh fixture 的同级私有目录创建真实 marker/catalog/holder，测试结束仅清理本次目录，不使用默认用户lease root。

ShellAuthorization 还携带 `fileOwners` 和同代 `ownerGeneration`；候选 create/replace/delete 精确 owner 必须是请求角色，源码 publication 经过 Storage 的同一 guard。生成 artifact 不作为源码 owner。

新增控制工具及能力为 `legion_remember_fact/remember_fact`、`legion_query_memory/query_memory`、`legion_submit_supervision/submit_supervision`。它们复用 bounded plain `payload` 和 typed AgentControlDecision/Result；Host 校验具体 domain schema、来源、actor、CAS。它们不产生 ActionProposal/Mutation，也不能分配 owner。

## 2026-10-10 owner catalog schema 修复设计

同 owner 映射与 generation 不能证明当前持久记录已经迁移。锁内每次最终 owner 重读必须同时要求 catalog 与选中 project 的 schemaVersion 为2；当前 plan/tasks 不得携带旧writeSet授权字段。旧字段只允许留在legacyHistory作为只读历史，不能据此恢复权限。Private demo 与Kernel fixture也创建明确schema2项目；真实回归在临时文件生成后回写同owner/generation的schema1记录，验证无源码效果、旧authority永久撤销。该修复沿Human已批准的同版v2必要修复范围实施，保护原edit CAS、租约与审计。

## 2026-10-11 已知原始密钥 Provider 守门设计

Check/Shell Service 构造参数新增私有 `knownKeys` 纯字符串数组，经既有 public factory传给相邻Provider，Provider复制为有预算的私有匹配字节；不进入Model、授权、digest、env、日志或DTO。兼容无key调用的空数组，Host应在创建时提供本轮所有已知值；之后新发现的key必须重建对应Service。

Shell对当时读取的客户文件原字节先匹配再复制镜像。父进程按stdout/stderr独立保留最长key长度减一的尾部，在累积、回调或output.json前匹配；发现key停止本次进程、不写污染日志，返回静态拒绝原因。Check在现有inputVersions实际读取核验时匹配，命中则不启动子进程；父进程stdout/stderr与已认证event的字段也须先匹配才形成结果。

本次保证仅覆盖Host传入已知原始key的上述路径。Check可变客户文件仍有验证后修改的TOCTOU；子进程从编码、片段或允许网络重构key后直接写tmp/outputs，不由四impl保证。不宣称全称从未落盘，不以事后scan、skip或裸Shell替代守门。四测试实际覆盖静态输入拒绝、分块输出拒绝、本run私有文件/回调未含原始canary及原客户字节不变，正常无key功能继续实跑。

## 2026-10-11 Su前台工具契约（已确认v0.3实施）

新增三个控制工具/capability独立配对：`legion_delegate_pm/delegate_pm`、`legion_query_role_activity/query_role_activity`、`legion_query_role_log/query_role_log`。沿现PiToolRequest `{requestId,runId,toolCallId,tool,parameters:{payload}}` → AgentControlDecision/Result → PiToolResult；Model仅拷贝冻结、纯字段/预算校验，不执行委托或读私有日志。

委托start payload为 `{action:'start',purpose:'plan|role_design|repair',instruction,sourceRefs,acceptanceId?,taskId?}`：instruction非空且UTF-8≤8192，sourceRefs数组≤32，每项非空≤200字符；repair必须实际acceptanceId/taskId，其他purpose不得混入repair选择器。resume为互斥 `{action:'resume',delegationId,humanAnswerRef}`；不接受Human答案value或模型自报project/profile/调用方身份。ID/过滤文本≤200字符。purpose是工作主题，不能证明前台用途或授权。

activity payload `{roleId?,taskId?,planDigest?}`；log `{roleId,taskId?,planDigest?,cursor?,limit?}`，roleId为目标过滤器，planDigest为SHA256，cursor非空且≤4096 UTF-8字节，limit整数1..50，缺省20由Host处理。两个查询的AgentControlResult.payload必须≤32768 UTF-8字节；外壳原depth8/nodes4096/单字符串65536/总256KiB限制继续适用。完整日志事件分页与safe DTO、cursor project/filter/plan/snapshot绑定、known-key过滤及每run/关联链累计2MiB预算由Host实现，不能以截断事件或重开子run绕过。

Host以私有真实project/instance/session/run/channel registry限制delegate仅su_customer前台；后台PM不能递归委托，单项目一个委托、深度1、每turn最多4次有效start/resume链。前台与后台preflight/monitor均可使用两个只读查询，后台保留独立bounded事实快照。委托completed仅指本次工具响应已返回，needs_human/plan_ref/result_ref内状态决定PM阶段；实际Human问题答复、取消、execute_plan确认均由Host继续验证，模型不得造answer/value/grant。

两类Su普通文件读取复用readScope:['.']、read_project与list/read双工具、现Policy真实身份/工具/run/版本、Restricted/链接/稳定性及预算守门；scope.write=[]且无write/edit/Check/Shell，不改Read/Policy/Provider公开方法，不改owner/grant。真实来源与用途绑定由Host验证，Kernel纯Model不能仅凭roleId或payload.purpose代替。
