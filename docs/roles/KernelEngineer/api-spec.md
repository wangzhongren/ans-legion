# Kernel Node 公开接口（工作台 v2 与保留的 v3 Runtime）

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

contextReadSet是Human选定精确文件，不含目录/glob/控制面或重复Windows别名；最多16文件，单文件262144字节，总2097152字节。Snapshot排序和digest确定性绑定每个文件。空context集合允许空文件夹讨论/执行。TaskDispatchContext.digest保持原义；额外plan/profile/context绑定在ConfirmedTaskGrant中。tools仅受控legion_write_file；构造该grant本身不授权。

AgentConfig新增lifecycle，默认single_run；conversation必须scope.write/tools均空。PiConnectionProfile仅支持openai-completions/openai-responses/anthropic-messages；无key/function，baseUrl无内嵌凭据。metadata仅plain的id/name/api/provider/baseUrl/reasoning/input/cost/contextWindow/maxTokens/compat；连接相关字段不能覆盖可信profile。未提供metadata为null（unknown），不生成真实报价。History/Checkpoint不含permit、Human确认、SDK对象、工具pending或活动run；恢复时host验证workspace/profile并重建typed instance，不因历史自称身份产生权限。

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

AgentConfig 为 name/proxy/scope；proxy 仅 provider/model，模型输入不能覆盖角色/task/version。scope.write 为合法相对资源数组，deny 为目录或精确资源数组，tools 恰为 ["legion_write_file"]。请求范围必须同时属于角色和 task.writeSet，deny 优先；不静默裁剪。末尾 /（反斜杠等价）表示目录，其余为精确文件，无 glob；精确 task grant 不允许请求整个目录。空 write 可以创建仅产生拒绝结果的实例，但工具仍须唯一受控工具。

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
