# Adapter实际公开API：工作台v2

本层实现真实Pi SDK1.0.4，不实现Desktop入口、计划确认、调度、客户目录读取或Kernel写审计。客户Human唯一项目管理入口与其他Agent禁止directchat/start由Desktop负责。Workbench Pipeline只组合公开Services；本Service只调用自身Provider public，Provider不接上层权限callback。

| 源public模块 | 具名导出 |
| --- | --- |
| src/adapters/services/public/pi_agent.mjs | PiAgentService、createPiAgentService |
| src/adapters/providers/public/pi_session.mjs | PiSessionProvider、createPiSessionProvider |
| src/adapters/services/public/proposal.mjs（未改） | ProposalService、createProposalService、createCodexAdapter、createClaudeAdapter |

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

single_run保留原行为：仅工具legion_write_file；启动一次，完成/取消即unsubscribe/dispose，不能restart。conversation必须scope.tools/write均空；SDK tools/customTools均为空，核验active/callable/all工具均空。模型hallucinated toolCall导致pi_unexpected_tool_call，不生成PiToolRequest或执行文件。两模式保留空ResourceLoader/独立extension runtime，禁MCP/codemode/tool_search及默认文件工具、skills/模板/AGENTS发现；prompt expandPromptTemplates:false。默认single_run没有新增conversation预算限制。

新connection为typed PiConnectionProfile({profileId,profileVersion,protocol,provider,model,baseUrl,modelMetadata?})，无secret/function，provider/model必须精确匹配proxy；credentials恰{apiKey}，非空字面值，拒绝!开头或含$表达式。protocol只允许openai-completions/openai-responses/anthropic-messages。Provider内部静态选择pi-ai公开api/* streamSimple；不要求内置catalog模型，支持自定义modelID与BaseURL。profile字段冻结，credentials值创建时复制到独立InMemoryCredentialStore，后续caller修改不影响实例。

每实例独立ModelRuntime registry、credentials、SessionManager/SettingsManager、SDK Session、stream、queue/pending；modelsPath:null、refreshOnCreate:false、allowModelNetwork:false，settings关闭compaction/retry/cache warming。仅所选provider注册于实例，旧用户.pi配置不读取。

modelMetadata由共享Model限制为plain数据，可含id/name/api/provider/baseUrl/reasoning/input/cost/contextWindow/maxTokens/compat，连接字段不得覆盖profile。缺失为null/unknown。SDK内部必要默认为文本输入、reasoning:false、32768上下文、2048输出、零cost占位，仅用于运行适配。get_history/终态不输出这些metadata或计费数据，不据此声称真实能力/价格。已知metadata交SDK验证；无准确价格就不能计算准确预算。

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
  scope:new AgentScope({write:[],tools:[]}), cwd:process.cwd(), lifecycle:"conversation",
  connection, credentials:{apiKey:privateMainProcessKey} });
service.start_run("turn1", humanSubmittedText);
```

示例的key/text为主进程可信输入，不是预置账号；本阶段不会自动运行此请求。Desktop负责URL允许策略、密钥加密、Human触发、工作空间/profile来源及费用提示。

## 方法与队列

| 方法 | 语义 |
| --- | --- |
| start_run(runId,prompt) | 同步立即返回undefined；两个非空字符串。仅ready/idle，新runId不可重用。拒绝并发或上一轮未消费事件；不排队steer/followUp |
| await next_event(runId,{signal}={}) | 本实例当前run的FIFO冻结envelope；最多一个等待消费者，signal仅取消本次等待 |
| respond_tool(originalRequest,result) | 同步void；保留原pending/instance/currentrun/once、typed PiToolResult、requestId/runId及decision/result摘要一致检查 |
| await cancel_turn(runId) | 仅conversation当前run；幂等停止该轮、abort/waitIdle，终态cancelled，Session保留；错误/旧run拒绝 |
| get_history() | conversation且未close返回冻结PiConversationHistory；包含已提交user及成功轮最终assistant，取消/失败partial不写历史 |
| await restore_history(checkpoint) | conversation ready/idle，队列及consumer空；typed checkpoint与可信instance所有身份字段、profileId/version匹配；重建真实内存Session，不发模型请求 |
| await cancel() | 幂等整实例终止，禁止以后start，settle pending、abort/等待run与进行中的restore、dispose，取消终态可消费 |
| await close() | 幂等，cancel完成后清所有queue/toolCallID、拒绝consumer；迟到restore Session也在返回前释放 |

conversation轮终态→idle，single_run→terminal并dispose。每轮subscribe捕获原runId，旧queued listener即使晚交付也不能重标当前轮；结束先waitIdle再unsubscribe。下一轮必须消费旧terminal，新run后旧next_event/cancel_turn身份拒绝。close/cancel不直接撤销Kernel许可，Workbench Pipeline需先撤销上层授权，再await本层取消及相关审计。

| type | 完整envelope |
| --- | --- |
| text_delta | {type,delta:PiTextDelta({runId,text})} |
| run_event | {type,runId,eventType}；有限agent_start/tool_execution_start/tool_execution_end/agent_settled |
| tool_request | {type,request:PiToolRequest}，仅single_run |
| run_finished/run_failed/run_cancelled | {type,result:PiRunResult({runId,status,assistantText,toolResults,errorCode})} |

delta仅文本，不传thinking/raw SDK/error/key。相邻delta合并，不丢工具/终态；终态assistantText校准最终文本。队列预算预留终态槽位。PiToolRequest字段与纯proposal.convert(request,trustedSession)不变，requestId宿主随机生成，固定legion_write_file/write_file。Kernel policy/mutation后respond_tool原对象释放execute deferred，typed结果含DENY/failed/audit_failed/observedMutation原样传播。

## 预算、历史与错误

conversation默认及最大budgets恰{maxQueueEvents:256,maxTextCharsPerTurn:65536,maxOutputTokens:2048,turnTimeoutMs:60000}。允许同名整数向下设置，queue至少2，不允许扩大；仅conversation使用。prompt/文本超限、queue溢出、总deadline分别拒绝输入或返回明确failed终态；SDK请求固定maxTokens、maxRetries:0、timeoutMs，deadline另主动abort。History共享Model至多256消息、单条65536、总2097152字符。

restore_history接受PiConversationCheckpoint({instance,profileId,profileVersion,history})，history为PiConversationHistory({messages:[{role:"user"|"assistant",text}]})。typed构造数据本身不是权限；host先核验工作空间和当前profile再构造，Adapter再次比较绑定。仅重建user/assistant文本，system/tool/SDK模型选择、pending、permit、确认或活动任务均不能恢复。plain连接绑定真实profile；legacy绑定profileId="legacy:"+provider+"/"+model、profileVersion=instance.organizationVersion。恢复失败终止该实例，必须新建；并发cancel/close等待恢复收束，expected AbortError作为关闭结果处理，其他真实恢复错误传播。

输入与身份错误TypeError；创建/restore取消AbortError。unknown_run/run_events_exhausted/one_event_consumer_required/pi_instance_closed等旧错误保留。终态安全code包括pi_model_error/pi_auth_error/pi_network_error/pi_protocol_error/pi_model_aborted/pi_run_failed/pi_cleanup_failed，以及pi_turn_timeout/pi_text_budget/pi_queue_budget/pi_history_budget/pi_unexpected_tool_call；取消pi_run_cancelled。认证/网络/已知格式提示仅内部归类，未知供应商错误保留generic code，不能承诺所有供应商细分类。raw errorMessage/headers/response/key不返回或记录。get_history只保存对话文本，仍需桌面userData保护。

## 实际验证与限制

Node24.11.1/npm11.6.2/SDK与pi-ai1.0.4。原23项断言保留，当前Provider27+Service4+Proposal只读7=38项，直接实际38通过/0失败/取消/跳过。三个localhost协议均经真实SDK多轮HTTP SSE请求，工具为空，验证custom model、auth、上下文、profile冻结及无metadata报价；Faux为官方实际stream fixture，无Session替身。

首个扩展34项在沙箱29pass/5fail，独立localhost fetch复现EACCES；相同套件经自动批准require_escalated后34pass，补并发后36、最终38pass。没有为环境失败放宽断言。最终6docs完成后唯一task_ops approved unit：`node --test --test-concurrency=1 tests/adapters/test_proposal.mjs tests/adapters/test_pi_provider.mjs tests/adapters/test_pi_service.mjs`，180秒，需localhost执行权限。候选/日志/结果以[当前任务](../../scheduling/legion-desktop-workbench-v2.md)为准；最终check后停止写入。

生成效果仅本角色fixtures/user-data/tmp，TEMP/TMP指向当前role tmp，清NODE_OPTIONS/NODE_COMPILE_CACHE，NODE_DISABLE_COMPILE_CACHE=1。无安装、付费调用或shell executor。真实SDK事件重放证明listener guard，不能当实际网络总会按时取消的OS隔离保证。owner结果不替代新版tarball、Desktop Human确认/完整执行/DPAPI/ZIP与独立验收。[功能](docs/feature/pi-agent.md)、[v2设计](docs/design/2026-10-07_design_desktop-workbench-v2.md)、[旧v3设计](docs/design/2026-10-07_design_node-pi-v3.md)。

