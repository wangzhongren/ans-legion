# Adapter实际公开API：受控组织、交互、检查与Pi生命周期

## 2026-10-12 图片输入实施契约

依据已接受的 [图片v1范围](../../../.ans/decisions/desktop-image-input-v1-scope.md)，A9仅接Pi SDK边界。支持 `start_run(runId,text,{images})`、`restore_history(checkpoint,{images})`；images仅Kernel PiImageInput({ref,data})，ref为唯一PiImageReference({projectId,attachmentId,sha256,mimeType,byteLength,width,height})。历史仅user.imageRefs，Host提供已经校验项目/来源的临时字节，Adapter不读磁盘。旧text调用保持；纯图可空text。能力来自显式modelMetadata.input，缺失unknown、有图unsupported/unknown拒绝。单turn4图/8MiB，restore或一次完整上下文8图/16MiB，context及SDK实际序列化请求24MiB。

SDK自动缩放关闭，使用有效PNG/JPEG保原字节。在受控streamSimple调用真实网络前核用户图块数量、顺序、MIME、规范base64及实际解码字节SHA；省图hint报image_omitted，换图/重排报image_content_changed，不发送文本替代。内部SDK onPayload只核最终实际请求24MiB，非Host回调。恢复按引用顺序重建SDK用户图块，hydration数组可乱序但必须与引用一一匹配，少图/额外图/变更引用拒绝。同一引用重复出现在历史时每次图块计入请求预算；恢复输入每个引用提供一次。whole cancel/close释放临时图片cache，cancel_turn保留已发送Human引用供Host安全恢复。

固定images门：`node --test --test-concurrency=1 tests/adapters/test_pi_provider.mjs tests/adapters/test_pi_service.mjs`；真实SDK三协议原PNG/JPEG字节/顺序、Provider与公开Service纯图/恢复/续轮、unknown/unsupported零网络、SDK省图/重排/换图网络前拒绝、图片HTTP取消及旧文本强回归见 [当前候选证据](../../scheduling/desktop-image-input-v1.md)。第一轮图片强门已通过，最终当前候选结果以阶段记录为准；不将旧检查算作图片证据。Host负责源项目绑定、PNG/JPEG解码/像素校验、私有blob/预览、来源及profile失效；输入能力是客户声明而非已探明远端能力，引用不授写权，像素不做OCR/DLP扫描。

本层实现真实Pi SDK1.0.4，不实现Desktop入口、计划确认、调度、客户目录读取或Kernel写审计。客户Human唯一项目管理入口与其他Agent禁止directchat/start由Desktop负责。Workbench Pipeline只组合公开Services；本Service只调用自身Provider public，Provider不接上层权限callback。项目目录与文本由可信宿主调用Kernel受控Read Service读取，本层只转交工具请求和结果。

## 2026-10-11 Su 客户入口控制合同（当前）

同实例取消/恢复契约：conversation 的 cancel_turn(runId) 收束在途SDK流后可继续新run；已取消的原请求拒绝迟到回应。restore_history仅接受当前实例/profile完整绑定的typed checkpoint，在idle且队列/pending收束后替换SDK Session；不恢复工具或旧许可。Provider与公开Service的真实部分SSE回归验证了生产Su八工具、取消→Human-only安全checkpoint→第二HTTP，Human全文保留而partial/旧Host briefing不进入恢复后的续轮。当前Adapter未复现Host Reviewer失败，也未修改SDK资源生命周期；[专项证据](../../scheduling/legion-supervisor-frontdoor-v1-su-cancel-repair-integration.md)不替代Host原cancel→Continue验收。

Su 为唯一客户连续对话入口，PM 为后台委托实例；上文旧 PM 客户入口表述与下面旧阶段权限文字仅为历史，当前以 [Su v0.3](../ProjectManager/docs/design/2026-10-11_design_supervisor-frontdoor-global-read.md) 为准。Adapter 不选择入口、channel、Profile或权限；Host 为前台 conversation/后台 single_run 分别提供独立 instance 与 scope.tools。

| 工具 | payload 精确形状 | 返回 pair |
| --- | --- | --- |
| legion_delegate_pm start | action:start、purpose:plan/role_design、instruction、sourceRefs；purpose:repair 另必须 acceptanceId/taskId | AgentControlDecision + AgentControlResult |
| legion_delegate_pm resume | action:resume、delegationId、humanAnswerRef；不接 answer/value 或 start 字段 | 同上 |
| legion_query_role_activity | 可选 roleId/taskId/planDigest；空对象为当前项目活动查询 | 同上 |
| legion_query_role_log | roleId 必需，可选 taskId/planDigest/cursor/limit | 同上 |

三个工具均只有 payload 根字段，内部字段严格有限。ID/sourceRefs 每项≤200字符，refs≤32；planDigest为64位小写SHA；limit1–50，缺省20由Host处理；cursor非空且Model核≤4096 UTF-8字节；instruction非空且Model核≤8192 UTF-8字节。SDK schema 的 maxLength只限制字符，不代替 Model 字节预算。查询结果 payload Model核≤32KiB；Host核安全 metadata 白名单、known-key和每run累计预算。Adapter不把raw日志或任意文本自动清洗成安全投影。

Host供前台 read/memory/request_interaction/delegate/activity/log，后台供read/memory/activity/log/submit_supervision；Adapter原样注册该子集，不凭lifecycle或模型用途自增工具。委托仅受信前台可用的资格、channel/来源/continuation/CAS由Host核。request_interaction保持原有bounded payload，questionRef引用与完整discussion分支的互斥由Host领域Model核；execute_plan确认只能Host创建。needs_human/awaiting_human为委托待答，控制completed不代表项目完成。

复用独立inMemory Session、原pending对象与typed request/run/tool关联，旧run/跨实例/克隆/重复/取消后回应拒绝。三协议实际调用续轮、typed五种状态、前后台工具隔离、questionRef、取消和Model字节负例由当前五测试unit验证；Anthropic SDK root additionalProperties差异继续与Model严格拒绝独立验证。[当前功能](docs/feature/cli-controls.md) · [当前候选证据](../../scheduling/legion-supervisor-frontdoor-v1.md)。这不替代Host持久channel/委托/日志脱敏与安装消费者独立验收。

## 2026-10-10 CLI 角色独占文件 v2

产品运行时 TaskDispatchContext 不接受 writeSet。Host 提供的 `AgentScope.write` 是当前持久角色 owner 的精确文件集合；任务仍授予自己的工具、checks 和生成效果。Provider 将该文件集合、deny、实际 granted tools 写入系统提示，不将任务再解释成文件子集。owner 快照/generation 与提交前重新授权由 Kernel/Host 完成；Adapter 不读取 owner 台账，不产生 owner 变更。以下历史章节中每任务 writeSet 规则均已由 v2 取代。

| 新工具 | 唯一参数 | Host 回答 |
| --- | --- | --- |
| legion_remember_fact | `{payload}`，领域数据为 action:add/revise/retract、factId、kind:pitfall/decision/preference、statement、sourceRefs、expectedRevision | AgentControlDecision + AgentControlResult |
| legion_query_memory | `{payload}`，领域数据为 kind/cursor/limit | 同上 |
| legion_submit_supervision | `{payload}`，领域数据为 phase/planDigest/findings/recommendation | 同上 |

复用 Kernel 有界纯数据 schema、十项 AgentControlTools 与独立 capability；字段领域限制、真实 actor、来源登记、revision/CAS 与监督资格由 Host 校验。scope.tools 决定真实 SDK 注册子集。无源码写工具的 single_run 可使用控制工具且不会得到写工具指令；conversation 保持 write 为空，可让 Supervisor 在同一独立会话多轮使用控制工具。控制请求只接 AgentControlDecision/Result，不接 MutationResult、grant 或 owner 变化。结果状态 completed/denied/cancelled/stale/error 与安全 reason/payload 原样进入 SDK 下一次协议请求；run completed 不能替代 Host 任务验收。

completions/responses/anthropic 均使用现有公开 SDK stream。Anthropic SDK 的根 additionalProperties 丢失事实保留在 wire 断言中，PiToolRequest 对未知根字段/caller/凭据的严格拒绝独立验证。原 pending 对象、requestId/runId/tool、类型和一次性答复要求不变；cancel_turn/cancel/close 释放 pending 并中断网络，迟到结果拒绝。鉴权错误脱敏、HTTP 超时与 no-retry 保持。

详见 [当前功能](docs/feature/cli-controls.md)、[具体设计](docs/design/2026-10-10_design_cli-controls.md) 与 [固定检查证据](../../scheduling/legion-cli-role-owned-v2.md)。新增三协议实际调用、typed 五种状态、跨工具/实例回应拒绝、取消后复用、分类事实修订/撤回及 HTTP 失败；未宣称 Host 领域存储或安装后 CLI 全流已验收。

## 2026-10-08 完整组织、交互与检查工具 v1

共享工具集合直接采用 Kernel `AgentTools`/`AgentControlTools`；每个 SDK Session 只注册 `scope.tools` 实际授予的子集，并后验检查 active/callable/all。`conversation` 仍要求 write 为空且无写/编辑工具，可加载读、检查和控制工具；`single_run` 可含受控写/编辑或新检查/控制工具，检查/控制成员无需伪造写工具。普通只读 single_run 保持原拒绝行为。工具名不在共享集合中即创建失败；SDK 默认文件/Shell/MCP、extension、skills、resources 发现保持关闭。

| 工具 | 唯一参数 | host typed pair |
| --- | --- | --- |
| legion_run_check | `{checkId: nonemptyString}` | CheckDecision + CheckResult |
| legion_design_roles | `{payload: plainRecord}` | AgentControlDecision + AgentControlResult |
| legion_propose_roles | 同上 | 同上 |
| legion_review_roles | 同上 | 同上 |
| legion_request_interaction | 同上 | 同上 |
| legion_submit_acceptance | 同上 | 同上 |
| legion_request_repair | 同上 | 同上 |

六项 payload 使用 Kernel PiToolRequest 的有界规则：depth≤8、nodes≤4096、单 string≤65536 chars、JSON≤262144 UTF-8 bytes，仅 JSON 数据；拒绝 class、getter、symbols、secret/caller 字段和 prototype 字段。注册 schema 对顶层未知参数、嵌套深度、字符串、数组/对象及禁用 key 作限制；总节点/字节及 JS 对象性质最终由共享 Model 检查。SDK 1.0.4 Anthropic 序列化只保留根 type/properties/required，payload `$defs` 因放在 property 内仍能在实际 wire schema 解析，根 additionalProperties 被 SDK 省略；PiToolRequest 在发 host 请求前仍严格拒绝额外顶层字段。OpenAI 两协议保留根限制。这是实际 SDK 映射限制，不是扩大参数/权限。

`respond_tool(originalRequest, PiToolResult)` 保留原 pending 对象、一次响应、当前 runId/requestId/instance 校验；仅接受与请求工具匹配的四类 pair。写/编辑为 PolicyDecision+MutationResult 并校对 resource/proposalDigest；读为 ProjectReadDecision+ProjectReadResult 并校对 resource/listed/read/denied；检查为 CheckDecision+CheckResult 并校对 request.checkId、decision/result.checkId；控制为 AgentControlDecision+AgentControlResult 并校对 request.tool、decision/result.tool。共享 PiToolResult 已要求检查/控制内外 requestId/runId、authorizationDigest 或 tool 完全匹配，拒绝检查不得 executed、拒绝控制不得 completed。本层不把检查转为写结果，也不构造 passed 或自行执行检查。拒绝、cancelled、stale、unsupported 和 error 的真实 reason/payload/logs/evidence 都经 typed host 结果传回 SDK。

conversation 的 turnTimeoutMs 为累计**模型活动**预算，本阶段默认/最大为180000ms，只可缩小；maxOutputTokens 默认/最大为8192。真实桌面工程角色在旧60000ms预算下已返回 `pi_turn_timeout`，因此按已确认工作流作必要有界预算修复。首次 pending 停表并扣已用时间；全部 pending 答复或结束后恢复剩余时间。所有 host 等待（用户、架构师、读取、检查、控制）暂停该时钟；回答不会增加活动预算。每次真实模型流带 maxTokens、maxRetries:0、timeoutMs≤当前剩余预算，并由活动计时主动 abort。invalid response 保持 pending；cancel_turn/cancel/close 立即取消SDK请求、释放 pending 并拒绝迟到结果，不等待180秒到期。项目/权限变更由宿主调用 cancel/close；Desktop 负责持久交互与批准，恢复 history 不重放旧工具。

公开工厂和方法仍为下表，无新增进程/文件/权限入口。`createPiAgentService(options)` 和 `createPiSessionProvider(options)` 返回各自冻结 contract；实例配置/连接/budgets 参数格式保持下文。ProposalService 的三个工厂只转写/编辑，七项新工具一律拒绝转换。

本层按 Node24.14.0/SDK1.0.4 实际执行 Provider/Service/Proposal checks：新bridge+Proposal25项、原SDK/Service及三协议回归44项均通过、无跳过。最终四文件 task_ops unit 与 candidate 见[当前任务](../../scheduling/legion-governed-workflow-v1.md)；Kernel完整隔离检查、Desktop持久交互和独立验收由对应owner提供证据。[本层设计](docs/design/2026-10-08_design_governed-agent-tools.md)。

预算修复临时四套件实际72项通过、0失败/取消/跳过，覆盖新默认与精确cap、旧调用预算缩小、8193/180001拒绝、配置复制、三协议输出wire、默认180秒下的实际HTTP立即取消；原typed关联、队列/文本限制、等待停表、剩余活动预算和小预算timeout断言保留。最终冻结候选的正式unit见[预算修复任务](../../scheduling/legion-governed-workflow-v1-model-budget-final.md)，临时结果不代替桌面真实模型复验或重新打包安装。

## 2026-10-08 文件独占与受控编辑 v1（历史阶段）

执行Agent的`single_run`需要在`AgentScope.tools`中获得`legion_write_file`或`legion_edit_file`，可获得两者及读工具。PM的`conversation`保持`scope.write:[]`，只允许读工具或空工具集；编辑不能在PM会话中加载。SDK自定义`legion_edit_file`参数恰为`{resource,expectedSha256,replacements:[{oldText,newText}]}`，路径为项目相对文件，SHA为64位小写十六进制；替换1–16项、oldText非空、newText可空，拒绝未知字段。SDK工具描述与参数校验不发放权限；宿主仍须按当前文件owner、角色、任务、精确`writeSet`、审批与SHA核准。

Provider把真实SDK调用封装为当前run的冻结`PiToolRequest`并发出`tool_request`。`ProposalService.convert(originalRequest,trustedSession)`只接受`legion_write_file`或`legion_edit_file`；编辑生成`ActionProposal({proposalId:requestId,runId,action:'edit_file',tool:'legion_edit_file',capability:'write_file',resource,expectedSha256,replacements,session:trustedSession})`，构造输入不传`content`。Kernel决定是否允许及是否修改文件。宿主用原request对象和同requestId/runId、同proposalDigest的typed `PiToolResult(PolicyDecision,MutationResult)`调用`respond_tool`；Adapter拒绝clone、跨实例、重复、取消后和摘要不一致的响应。编辑取消会释放pending，不能留下有效写许可。旧完整写入和项目只读工具协议保持。

Adapter不自行读取或修改客户文件。读工具返回的`ProjectReadResult.sha256`是完整文件SHA，可由执行Agent在编辑请求里用作`expectedSha256`；Adapter仅转交。最终内容、原子替换、一次性许可、owner重查及审计属于Kernel和可信宿主。[当前设计](../ProjectManager/docs/design/2026-10-08_design_legion-file-ownership-and-agent-edit.md)与[本阶段证据](../../scheduling/legion-file-ownership-and-agent-edit-v1-delivery.md)分别说明目标与实际检查。

## 2026-10-08 项目内广读 v1（历史阶段）

`AgentScope.tools` 是SDK受控工具的显式清单。`conversation` 要求 `scope.write:[]`，允许空工具集或 `legion_list_files`、`legion_read_file` 的授权子集，拒绝写/编辑工具及其他名称。`single_run` 需含一个受控写或编辑工具，可附带两项读工具；旧仅写入清单仍只加载写工具。每个实例仅加载被授予的customTools，后验检查active/callable/all工具；SDK默认文件、Shell、MCP、skills及资源发现继续关闭。SDK工具描述不授权，宿主对每次请求核对项目、实例、run与Kernel只读权限。

`legion_list_files` 参数为 `{resource,cursor?,limit?}`，`resource:""` 表示项目根；`legion_read_file` 参数为 `{resource,startLine?,maxBytes?}`，resource须为项目相对文件路径。Model补齐默认值后，Adapter向宿主发送 `{type:'tool_request',request:PiToolRequest}`；两个工具都用随机requestId、当前runId和SDK toolCallId。宿主应构造 `ProjectReadRequest`、调用Kernel读授权和Read Service，然后用**原request对象**回应 `PiToolResult({requestId,runId,decision:ProjectReadDecision,result:ProjectReadResult})`。授权拒绝与文件检查拒绝都以typed `denied` 返回，不伪装成写入结果。Adapter核验类型、ID、原对象、资源、工具对应结果状态及一次性pending；迟到、重复、跨实例或取消后的响应拒绝。结果正文仅送当前SDK工具调用与当前run的typed结果；`PiConversationHistory`/checkpoint不单独保存工具正文，只保存user和最终assistant文本。模型回复可能引用所读内容，历史文本不能作为可信文件证据。

PM多轮可在同一Session中发起读请求，读取失败不会变成写许可。`cancel_turn`、`cancel`、`close` 释放pending并拒绝迟到响应；同一个SDK toolCallId在下一轮可重新使用。未授予的toolCall仍以`pi_unexpected_tool_call`失败。目录分页、文件分段、路径/凭据拒绝和每轮读预算由可信Kernel/Workbench执行，本层不直接接触客户文件。

| 源public模块 | 具名导出 |
| --- | --- |
| src/adapters/services/public/pi_agent.mjs | PiAgentService、createPiAgentService |
| src/adapters/providers/public/pi_session.mjs | PiSessionProvider、createPiSessionProvider |
| src/adapters/services/public/proposal.mjs | ProposalService、createProposalService、createCodexAdapter、createClaudeAdapter |

工厂返回自己的冻结契约，隐藏impl/SDK Session/ModelRuntime/下层Provider。PM后段透明发布legion-runtime/services/pi-agent及proposal子路径；本owner阶段验证源码实际接口，不宣称新版tarball已验收。

## 工厂输入

Service/Provider同签名：await createPiAgentService(options) / createPiSessionProvider(options)。options仅允许instance、proxy、scope、cwd、signal、lifecycle、connection、credentials、modelProviders、budgets；拒绝其他字段。

| 字段 | 实际约束 |
| --- | --- |
| instance | typed AgentInstance({instanceId,name,sessionId,roleId,taskId,organizationVersion})，由可信宿主绑定工作空间 |
| proxy | typed PiConnection({provider,model})，连接只选推理模型，不是HTTP/SOCKS代理 |
| scope | typed AgentScope({write,deny,tools})，本层不授予权限 |
| cwd | 非空文本解析为绝对目录；SDK资源发现关闭，不意味着Agent获得读权限 |
| lifecycle | 默认single_run；另有conversation |
| signal | 可选AbortSignal，仅管理异步创建；晚到Session释放 |
| connection+credentials | 新plain路径，严格与legacy modelProviders二选一 |
| budgets | 只允许conversation，见下文；single_run传入即拒绝 |

single_run启动一次，完成/取消即unsubscribe/dispose，不能restart；新实例可在首次start前恢复一次typed纯文本checkpoint。conversation禁止写范围和写工具；没有任何工具授权时为零工具。未授予的模型hallucinated toolCall导致pi_unexpected_tool_call，不生成PiToolRequest或执行文件。两模式保留空ResourceLoader/独立extension runtime，禁MCP/codemode/tool_search及默认文件工具、skills/模板/AGENTS发现；prompt expandPromptTemplates:false。默认single_run没有新增conversation预算限制。

新connection为typed PiConnectionProfile({profileId,profileVersion,protocol,provider,model,baseUrl,modelMetadata?})，无secret/function，provider/model必须精确匹配proxy；credentials恰{apiKey}，非空字面值，拒绝!开头或含$表达式。protocol只允许openai-completions/openai-responses/anthropic-messages。Provider内部静态选择pi-ai公开api/* streamSimple；不要求内置catalog模型，支持自定义modelID与BaseURL。profile字段冻结，credentials值创建时复制到独立InMemoryCredentialStore，后续caller修改不影响实例。

每实例独立ModelRuntime registry、credentials、SessionManager/SettingsManager、SDK Session、stream、queue/pending；modelsPath:null、refreshOnCreate:false、allowModelNetwork:false，settings关闭compaction/retry/cache warming。仅所选provider注册于实例，旧用户.pi配置不读取。

modelMetadata由共享Model限制为plain数据，可含id/name/api/provider/baseUrl/reasoning/input/cost/contextWindow/maxTokens/compat，连接字段不得覆盖profile。缺失为null/unknown。SDK内部必要默认为文本输入、reasoning:false、32768上下文、8192输出、零cost占位，仅用于运行适配；8192是宿主配置的请求上限，不是已核实的供应商输出能力。get_history/终态不输出这些metadata或计费数据，不据此声称真实能力/价格。已知metadata交SDK验证；无准确价格就不能计算准确预算。

legacy modelProviders仍为provider名keyed record，选定entry={api,baseUrl,apiKey,models,streamSimple}，models非空metadata列表含选中model，streamSimple是可信host推理函数，无Runtime/submit/许可或写文件callback。Pipeline新路径使用plain connection，不构造函数。旧single_run调用者不需新字段。

以下实际源接口示例可放项目根ESM脚本；只有Human send之后才调用start_run：

```js
import { createPiAgentService } from "./src/adapters/services/public/pi_agent.mjs";
import { AgentInstance, AgentScope, PiConnection, PiConnectionProfile } from "./src/kernel/models/agent.mjs";
const instance = new AgentInstance({ instanceId:"pm1", name:"项目管理", sessionId:"s1",
  roleId:"ProjectManager", taskId:"discussion", organizationVersion:"customer-v1" });
const connection = new PiConnectionProfile({ profileId:"profile1", profileVersion:"revision1",
  protocol:"openai-completions", provider:"customer-model", model:"custom-id",
  baseUrl:"http://127.0.0.1:8080/v1" });
const service = await createPiAgentService({ instance,
  proxy:new PiConnection({provider:connection.provider,model:connection.model}),
  scope:new AgentScope({write:[],tools:["legion_list_files","legion_read_file"]}),
  cwd:process.cwd(), lifecycle:"conversation",
  connection, credentials:{apiKey:privateMainProcessKey} });
service.start_run("turn1", humanSubmittedText);
```

示例的key/text为主进程可信输入，不是预置账号；本阶段不会自动运行此请求。Desktop负责URL允许策略、密钥加密、Human触发、工作空间/profile来源及费用提示。

## 方法与队列

| 方法 | 语义 |
| --- | --- |
| start_run(runId,prompt) | 同步立即返回undefined；两个非空字符串。仅ready/idle，新runId不可重用。拒绝并发或上一轮未消费事件；不排队steer/followUp |
| await next_event(runId,{signal}={}) | 本实例当前run的FIFO冻结envelope；最多一个等待消费者，signal仅取消本次等待 |
| respond_tool(originalRequest,result) | 同步void；保留原pending/instance/currentrun/once、typed PiToolResult、requestId/runId及四类pair和请求关联检查（见本页新工具契约） |
| await cancel_turn(runId) | 仅conversation当前run；幂等停止该轮、abort/waitIdle，终态cancelled，Session保留；错误/旧run拒绝 |
| get_history() | conversation且未close返回冻结PiConversationHistory；包含已提交user及成功轮最终assistant，取消/失败partial不写历史 |
| await restore_history(checkpoint) | conversation ready/idle，或single_run新实例首次start前且仅一次；无queue/waiter/pending；typed checkpoint与当前instance所有身份字段、profileId/version匹配；重建真实内存Session，不发模型请求 |
| await cancel() | 幂等整实例终止，禁止以后start，settle pending、abort/等待run与进行中的restore、dispose，取消终态可消费 |
| await close() | 幂等，cancel完成后清所有queue/toolCallID、拒绝consumer；迟到restore Session也在返回前释放 |

conversation轮终态→idle，single_run→terminal并dispose。每轮subscribe捕获原runId，旧queued listener即使晚交付也不能重标当前轮；结束先waitIdle再unsubscribe。下一轮必须消费旧terminal，新run后旧next_event/cancel_turn身份拒绝。close/cancel不直接撤销Kernel许可，Workbench Pipeline需先撤销上层授权，再await本层取消及相关审计。

| type | 完整envelope |
| --- | --- |
| text_delta | {type,delta:PiTextDelta({runId,text})} |
| run_event | {type,runId,eventType}；有限agent_start/tool_execution_start/tool_execution_end/agent_settled |
| tool_request | {type,request:PiToolRequest}，single_run写/编辑/读/检查/控制或conversation读/检查/控制 |
| run_finished/run_failed/run_cancelled | {type,result:PiRunResult({runId,status,assistantText,toolResults,errorCode})} |

delta仅文本，不传thinking/raw SDK/error/key。相邻delta合并，不丢工具/终态；终态assistantText校准最终文本。队列预算预留终态槽位。写与编辑PiToolRequest走纯proposal.convert(request,trustedSession)：前者固定legion_write_file/write_file，后者固定legion_edit_file/edit_file且共用write_file审批能力；Kernel policy/mutation后respond_tool原对象释放execute deferred，typed结果含DENY/failed/audit_failed/observedMutation原样传播。读PiToolRequest不经过Proposal/Mutation，以独立只读类型回应。

## 预算、历史与错误

conversation默认及最大budgets恰{maxQueueEvents:256,maxTextCharsPerTurn:65536,maxOutputTokens:8192,turnTimeoutMs:180000}。允许同名安全整数向下设置，queue至少2，其余至少1；例如旧{maxOutputTokens:2048,turnTimeoutMs:60000}仍可调用。输出8193、时间180001、queue257、text65537及非整数等一律TypeError，不能扩大；仅conversation使用。prompt/文本超限、queue溢出、累计活动时间用尽分别拒绝输入或返回明确failed终态；pending期间停表，每次SDK请求固定maxTokens、maxRetries:0、有界timeoutMs，活动计时另主动abort。History共享Model至多256消息、单条65536、总2097152字符。

restore_history接受PiConversationCheckpoint({instance,profileId,profileVersion,history})，history为PiConversationHistory({messages:[{role:"user"|"assistant",text}]}). typed构造数据本身不是权限；host先核验工作空间和当前profile再构造，Adapter再次比较当前绑定。conversation保留ready/idle恢复；single_run只允许fresh `ready` 实例、`start_run`前恢复一次，active/pending/closed/reused/再次恢复都拒绝。仅重建user/assistant文本，system/tool/SDK模型选择、pending、permit、确认或旧活动任务均不能恢复；SDK会使用新实例当前scope加载工具。plain连接绑定真实profile；legacy绑定profileId="legacy:"+provider+"/"+model、profileVersion=instance.organizationVersion。恢复失败终止该实例，必须新建；并发cancel/close等待恢复收束，expected AbortError作为关闭结果处理，其他真实恢复错误传播。

输入与身份错误TypeError；创建/restore取消AbortError。unknown_run/run_events_exhausted/one_event_consumer_required/pi_instance_closed等旧错误保留。终态安全code包括pi_model_error/pi_auth_error/pi_network_error/pi_protocol_error/pi_model_aborted/pi_run_failed/pi_cleanup_failed，以及pi_turn_timeout/pi_text_budget/pi_queue_budget/pi_history_budget/pi_unexpected_tool_call；取消pi_run_cancelled。SDK `stopReason:"length"` 表示输出不完整，映射到 `failed/pi_model_error`，保留的部分assistantText不得当作成功摘要。认证/网络/已知格式提示仅内部归类，未知供应商错误保留generic code，不能承诺所有供应商细分类。raw errorMessage/headers/response/key不返回或记录。get_history只保存对话文本，仍需桌面userData保护。

## 工作台v2历史验证与限制

Node24.11.1/npm11.6.2/SDK与pi-ai1.0.4。原23项断言保留，当前Provider27+Service4+Proposal只读7=38项，直接实际38通过/0失败/取消/跳过。三个localhost协议均经真实SDK多轮HTTP SSE请求，工具为空，验证custom model、auth、上下文、profile冻结及无metadata报价；Faux为官方实际stream fixture，无Session替身。

首个扩展34项在沙箱29pass/5fail，独立localhost fetch复现EACCES；相同套件经自动批准require_escalated后34pass，补并发后36、最终38pass。没有为环境失败放宽断言。最终6docs完成后唯一task_ops approved unit：`node --test --test-concurrency=1 tests/adapters/test_proposal.mjs tests/adapters/test_pi_provider.mjs tests/adapters/test_pi_service.mjs`，180秒，需localhost执行权限。候选/日志/结果以[当前任务](../../scheduling/legion-desktop-workbench-v2.md)为准；最终check后停止写入。

生成效果仅本角色fixtures/user-data/tmp，TEMP/TMP指向当前role tmp，清NODE_OPTIONS/NODE_COMPILE_CACHE，NODE_DISABLE_COMPILE_CACHE=1。无安装、付费调用或shell executor。真实SDK事件重放证明listener guard，不能当实际网络总会按时取消的OS隔离保证。owner结果不替代新版tarball、Desktop Human确认/完整执行/DPAPI/ZIP与独立验收。[功能](docs/feature/pi-agent.md)、[v2设计](docs/design/2026-10-07_design_desktop-workbench-v2.md)、[旧v3设计](docs/design/2026-10-07_design_node-pi-v3.md)。


## 项目 Shell SDK 接线（2026-10-10）

createPiAgentService(options) 的公开方法保持 start_run/next_event/respond_tool/cancel_turn/get_history/restore_history/cancel/close；scope.tools 可选择 legion_request_shell、legion_review_shell。后者要求 options.instance.roleId === ProjectManager。scope 来自可信 Host，Model 与聊天文本不授权。single_run 现在也接受 budgets（默认 turnTimeoutMs 180000，maxOutputTokens 8192，maxTextCharsPerTurn 65536，maxQueueEvents 256），暂停所有 pending Host 等待期间的活动计时，回应恢复剩余预算。

request 精确参数为 {command,cwd?,reason,generatedEffects?,network?,timeoutSeconds?}，默认 cwd 空、effects []、network none、timeout 300s（最大900）。review 精确参数为 {requestId,requestDigest,revision,approved,reason}。Model 校验请求中任何额外身份/授权字段；审核不是 {payload} 形式。SDK registration 根 additionalProperties=false；Anthropic SDK 1.0.4 传输会丢该根字段，Model 仍严格校验。

respond_tool(originalRequest, new PiToolResult({requestId,runId,decision:ShellDecision,result:ShellResult})) 重新计算原 ShellRequest.digest 并要求匹配两个 typed 值；禁止 ready_for_publication 中间态。最终结果回应一次，Host streaming 不调用 respond_tool。取消/关闭拒 pending，克隆原请求、重复/迟到/跨run/摘要错误回应均拒。review 自己的工具回应使用 AgentControlDecision/AgentControlResult。

候选仅 metadata/SHA/bytes/encoding，不传 binary body/receipt/authorization/permit；Host Shell 默认8KiB preview，可降低，上限64KiB。ShellResult 不是 CheckResult，原检查证据契约保留。single_run 恢复仅 fresh instance 首次run前一次纯文本 checkpoint，instance/profile身份绑定，不恢复旧 pending。详情见 [Shell 功能](docs/feature/project-shell.md)。
