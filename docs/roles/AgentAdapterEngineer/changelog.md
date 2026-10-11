# AgentAdapterEngineer 变化记录

## 2026-10-09 · 新任务前恢复纯文本角色记忆

依据客户已确认的 Handwell 角色上下文方案，在既有 `restore_history` 中允许 fresh `single_run` 实例于首次 `start_run` 前恢复一次当前绑定的 `PiConversationCheckpoint`。当前 `AgentInstance`、profileId/version、工具scope和系统提示仍来自本次新实例；checkpoint只重建user/assistant文字。运行中、有pending、已运行、重复恢复、close后、plain object或跨实例/profile绑定均拒绝。conversation 原有 idle/ready 恢复及禁止写工具规则保持。

复核SDK终止原因时发现 `stopReason:"length"`此前会被Provider当作成功。本次改为现有安全 `pi_model_error` 和 `failed` 终态，保留partial assistantText仅供诊断，宿主不能将它保存为完整摘要。未改变SDK自动压缩关闭、零retry、8192/180000业务预算或conversation limits。新增Provider/Service回归覆盖新实例连续纯文本、当前工具loadout、伪造/错绑/重复/活动态恢复拒绝、length失败映射。最终候选与固定unit实况由本次task_ops记录，不能据此声称Desktop长期记忆持久化或SSH项目验收。

## 2026-10-08 · 工程工作流的有界模型预算修复

真实桌面 DeepSeek v4 flash 连接的 ui/desktop 工程角色在60秒活动预算下返回 `pi_turn_timeout`。按[已确认完整工作流](../ProjectManager/docs/design/2026-10-08_design_legion-governed-workflow.md)的必要修复，在现有[本层设计](docs/design/2026-10-08_design_governed-agent-tools.md)先记具体失败，再将 `src/adapters/providers/impl/pi_session.mjs` 的 conversation 默认及cap由output2048/活动60000ms改为8192/180000ms。queue256/text65536、caller缩小预算、零重试、等待host停表及取消生命周期沿用；8192只代表宿主请求上限，未知供应商能力与价格仍为unknown。架构师超时前可能已提交提案，界面与该部分效果由Desktop处理。

正式范围为七个原已批准Adapter文件。临时Node24.14.0/SDK1.0.4四套件72项通过，0失败/取消/跳过；新增精确default/cap、旧预算缩小、8193/180001拒绝、配置复制、三协议wire预算及默认180秒下真实HTTP立即取消，旧typed关联、七工具停表/剩余预算、文本/队列和100/250ms timeout断言保留。最终冻结候选、配置unit及日志见[本次任务](../../scheduling/legion-governed-workflow-v1-model-budget-final.md)，正式证据对应其记录中的依赖及冻结候选；临时通过不代表真实桌面工程角色已修复或新包已安装。[当前功能](docs/feature/pi-agent.md) · [API](api-spec.md)。

## 2026-10-08 · 完整组织、交互与检查工具 v1

依据[已确认整套设计](../ProjectManager/docs/design/2026-10-08_design_legion-governed-workflow.md)，真实SDK按Kernel的AgentTools注册六项payload控制工具和只收checkId的检查工具。四类typed结果按原pending、当前run/request、checkId/tool校验后传回；新工具不会变成MutationResult或ActionProposal。conversation host等待暂停累计模型活动预算，回答后恢复剩余预算；cancel_turn、cancel、close结清pending，迟到结果及旧事件不能进入下一轮。

实际Node24.14.0、SDK1.0.4，bridge+Proposal25项和SDK/Service44项均通过零跳过。原localhost回归在sandbox遇EPERM，授权escalation后真实运行；未弱化Model/host参数校验。Anthropic SDK裁剪根schema字段，payload defs置于实际保留的property内，三协议wire均验证可解析；根额外字段仍由PiToolRequest拒绝。测试副作用仅本次角色runtime。最终四文件unit/candidate见[本次task_ops](../../scheduling/legion-governed-workflow-v1.md)，本层证据不代表完整检查运行器或Desktop/Tester验收。[设计](docs/design/2026-10-08_design_governed-agent-tools.md) · [当前功能](docs/feature/pi-agent.md) · [API](api-spec.md)。

## 2026-10-08 · 角色独占文件与受控编辑 v1

依据[客户确认的设计](../ProjectManager/docs/design/2026-10-08_design_legion-file-ownership-and-agent-edit.md)和Kernel的编辑Model合同，Pi Provider按`AgentScope.tools`显式加载`legion_edit_file`。single_run可只获编辑工具，或和完整写入及只读工具并用；PM conversation继续只读。真实SDK edit调用以原`PiToolRequest`进入pending，只有可信宿主返回同一次请求的typed写决定与结果才能继续。取消释放未完成编辑请求。SDK默认文件、Shell与资源发现保持关闭。

ProposalService把编辑工具精确转成`action:edit_file`、`capability:write_file`的`ActionProposal`，保留可信Session、run、完整文件旧SHA和有序替换，不传完整content。Adapter不读取或修改客户文件，不判断owner与审批；这些由Kernel和Workbench执行。Provider/Service/Proposal测试覆盖真实SDK read-SHA→edit工具、编辑单独授权、PM拒绝编辑、严格替换schema、提案摘要和取消迟到结果。最终配置`unit`、候选与日志见[本阶段任务记录](../../scheduling/legion-file-ownership-and-agent-edit-v1-delivery.md)；由项目角色验证，Tester另做端到端验收。[当前功能](docs/feature/pi-agent.md)和[API](api-spec.md)记载使用与边界。

## 2026-10-08 · 项目内广读 v1

依据[客户确认的跨角色设计](../ProjectManager/docs/design/2026-10-08_design_legion-project-wide-read.md)和Kernel公开`ProjectReadRequest/Decision/Result`合同，在Pi Provider中为被授予的`AgentScope.tools`加载`legion_list_files`与`legion_read_file`两个受控SDK custom tools。PM的conversation只读，single_run保留写工具且可附加读工具；未授权工具和旧仅写宿主原行为保持。所有请求通过原`PiToolRequest`排队，可信宿主用原对象和typed `PiToolResult`回应。本层不读取客户目录、发放只读或写权限、持久保存工具正文，也不调用Kernel Mutation。

Provider/Service测试增加真实SDK Faux流的多轮列目录和读文件、写读混合、typed结果资源/状态拒绝、读pending取消及原request一次响应。原v2历史结果仍保留；本阶段最终配置`unit`及候选以[当前task_ops记录](../../scheduling/legion-project-wide-read-v1.md)为准，由Supervisor验收，Tester另行验证桌面完整流程。当前[功能流](docs/feature/pi-agent.md)和[API](api-spec.md)记载宿主交接与限制。

## 2026-10-07 · legion-v1

依据客户已经确认并指示开发的六角色 Organization Proposal v1，首次实现两个本地受控参数变体。先写[角色设计](docs/design/2026-10-07_design_phase1.md)与功能草稿，再实现 Service abstract/public/impl 三个精确文件和 tests/adapters/test_proposal.py，最后将六个 owner 文档更新为实际行为。

公开工厂 create_codex_adapter/create_claude_adapter 返回本层 ProposalService。convert 固定受控工具与动作，保留 Session 原对象，丢弃未知身份/权限字段；错误输入 ValueError。Kernel Model、Runtime、治理定义与其他角色代码保持只读。

实际 owner 命令，在项目绝对根下以 UTF8、禁止 bytecode、TEMP/TMP 指向可写工作区运行：

```powershell
python -c "import sys,unittest;sys.path.insert(0,'src');result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.discover('tests/adapters'));sys.exit(not result.wasSuccessful())"
```

结果：Python 3.14.0 / Windows，14 项测试通过，0 跳过；共享测试对两个变体验证 exact Session、不可变结果、稳定摘要、未知字段不提权、空 content、非法工具/参数/身份、输入不修改、无文件/网络/进程效果。源码依赖审查确认仅 Model 和自身服务结构，无 Runtime 或 Kernel impl 引用、三元、吞异常、外部私有字段访问或未实现 stub。

任务操作使用绝对 `--root D:/work/code-work/agent-organization-runtime` 与 `--task legion-v1-development`：ack、progress、最终 run-check unit、complete。身份与 worker token 仅经私有请求传递，不写本记录。最终 candidate、实际 argv 与日志由[任务记录](../../scheduling/legion-v1-development.md)保存；Supervisor 进行验收。工作目录没有 Git 仓库，不报告虚构 commit。

当前限制：只转换本地受控参数，不连接厂商、启动 CLI、执行文件写入或发放权限。Session 来源认证和路径权限由 Kernel 处理；共同宿主进程不是恶意调用者隔离边界。无范围或合同差异，独立 Reviewer/Tester 检查仍由 Supervisor 调度。[完整功能](docs/feature/proposal-adapters.md)。

## 2026-10-07 · 同版依赖复核

Kernel 修复审批路径大小写/分隔符别名匹配及 RoleBoundary scalar collection 输入验证。Supervisor 接受的 Kernel 当前候选为 `d73b364c0660fb1abcae803d3f914faeb75c8c73d2b56c231d036ea62fa584f2`；owner 47 项与 demo 的上游证据见[新任务记录](../../scheduling/legion-v1-approval-repair.md)。本角色只读核对了 Model 与 Kernel 修复记录，AgentSession、ActionProposal 公开签名和 Adapter 所需语义没有变化，无兼容缺陷；Adapter 三个生产文件及测试保持原样。

原 14 项 Adapter 结果与原候选保留为历史，不作为当前依赖证据。本次仅更新六个现有 owner 文档，沿用同版授权与原 API；在文档完成后重新执行配置 `unit` 一次。运行环境和 unittest argv 与上文相同，task_ops 使用绝对项目根及 `--task legion-v1-approval-repair`。当前结果、候选身份和日志由[新任务记录](../../scheduling/legion-v1-approval-repair.md)保存；Supervisor 验证后再调度 Reviewer/Tester。没有新增功能、测试、权限或限制变更。

## 2026-10-07 · Node Pi v3

按客户Pi开发及全Node迁移直接授权，先落[本层设计](docs/design/2026-10-07_design_node-pi-v3.md)，实施9个ESM源码、3份Node测试及7份owner文档；旧Python/phase1只读历史。仅本角色19个writeSet，未改Kernel、package/lock或治理配置。

ProposalService.convert(PiToolRequest,AgentSession)用宿主requestId/runId绑定不可变ActionProposal，精确Session原对象、固定write_file动作。PiAgentService/Provider公共工厂返回各自契约，真实SDK1.0.4同进程创建独立ModelRuntime/内存凭据/session/settings与空resources/extensions。仅受控tool活动，execute入自身queue等deferred，由Kernelnext_event消费/respond_tool原对象；无向上callback。响应跨实例/重复/迟到拒绝，finish/cancel/close与latecreate清理。

实际Windows Node24.11.1/npm11.6.2 owner命令：

```powershell
node --test tests/adapters/test_proposal.mjs tests/adapters/test_pi_provider.mjs tests/adapters/test_pi_service.mjs
```

首次完整23通过、0失败/取消/跳过。真实Pi+官方Faux stream工具闭环、同名provider两实例不同模型/流/凭据/消息/scope/queue隔离、权限数据传播、精确身份、非法输入、toolloadout/无用户.pi读取及fetch、取消/释放均覆盖。SDK缺失直接fail，无付费调用。最终docs完成后以task_ops --root绝对项目根 --task legion-pi-node-v3 run-check unit取得不变候选，再report complete；候选/argv/退出码/日志以[当前任务](../../scheduling/legion-pi-node-v3.md)为准，不虚构Git commit。worker凭据不写文档。

[实际API](api-spec.md)明确下层modelProviders keyed record与产品数组的转换边界并给真实配置示例；[Pi流程](docs/feature/pi-agent.md)与[提案流程](docs/feature/proposal-adapters.md)描述全部分支。owner验证不替代后续Kernel文件写入/审计与独立Reviewer/Tester；同进程不隔离恶意代码。无本角色范围差异，Supervisor负责verify。

## 2026-10-07 · 已确认工作台v2

按canonical715639与正式adapter-1实施14exactfiles，先写[本层dateddesign](docs/design/2026-10-07_design_desktop-workbench-v2.md)，只改六Pi Service/Provider、两既有套件和六owner文档。旧proposal源码/test、Node dated历史、Kernel18文件、package/lock/旧产物只读。

默认single_run保留旧一次受控写入语义。conversation仅空tools/write，同一真实Session多轮、typed delta有界queue、history/typed checkpoint restore、cancel_turn回idle；wholecancel/close等run和restore后dispose。每轮SDK listener捕获原runId，旧事件不可重标。Provider内部选固定公开三协议，plain connection+私有credentials严格XOR legacy策略，实例profile/key/session/stream/queue隔离，历史不覆盖可信proxy/权限。未知metadata/费用保持unknown，不展示SDK占位为报价。

实际Windows Node24.11.1/npm11.6.2、SDK/pi-ai1.0.4。旧23断言未删改；初次扩展34项沙箱29pass/5fail，实际localhost fetch复现EACCES。自动批准require_escalated运行相同套件34pass；新增关闭/恢复收束后36pass，完整cancel/lateSDKlistener维度后38pass，0失败/取消/跳过。全部真实SDK，三个localhost协议SSE请求custommodel/字面key与工具空；官方Faux为推理流fixture，无SDK Session替身。安全auth错误、deadline、queue/text/history预算、typed restore、同provider隔离与实际SDK旧事件注入guard保留严格断言。

最终配置unit命令：

```powershell
node --test --test-concurrency=1 tests/adapters/test_proposal.mjs tests/adapters/test_pi_provider.mjs tests/adapters/test_pi_service.mjs
```

timeout180。6docs最终后唯一task_ops run-check unit使用绝对项目根和--task legion-desktop-workbench-v2，再complete，check后停止写；候选、argv、实际count及日志以[当前任务](../../scheduling/legion-desktop-workbench-v2.md)为准。NodeOptions/compilecache清理，TEMP/TMP在本角色当前tmp，不写旧runtime/user.pi/客户源码，不安装/付费/任意shell。worker凭据只私有请求，不写文档。

[API](api-spec.md)提供factory/完整协议/错误/预算/真实plainprofile示例，[feature](docs/feature/pi-agent.md)提供完整流程。typed历史检查不代表Hostworkspace认证；SDK事件注入与内存server不能作为恶意同进程/OS隔离证明。当前owner证据不替代后续PM新版tarball、Desktop Human确认与真实文件审计、DPAPI/ZIP/独立Reviewer/Tester。无范围差异，Supervisor唯一verify。


## 2026-10-10 项目 Shell

接入精确 request/review schema 与 Shell typed 最终回应，PM review 限定真实实例，扩大预算支持到 single_run，并未授Shell工具失败关闭。更新旧注册数量和未授工具断言；新本地三协议验证 pending、终态、预算、取消、历史和 metadata，详见 [变化记录](docs/change/2026-10-10_change_project-shell.md)。

## 2026-10-10 CLI 角色独占文件 v2

Provider 展示 Host 提供的角色 owned 精确文件与 granted tools，控制专用 single_run 不再被提示调用写工具。三项记忆/监督工具复用 Kernel typed 有界控制契约，并提供分类、来源、revision 和监督建议的用途说明。single_run 未授控制工具与 conversation 一样返回 pi_unexpected_tool_call，修复原来只限制 Shell 的 guard，避免 SDK 工具错误续轮被误认成成功。产品运行时取消任务文件子集，Adapter 不产生文件 owner 或 grant。

五文件固定 unit 新增三协议真实 SSE 调用及 Host typed 完成/拒绝/取消/过期/错误续轮、请求/工具/对象身份错配、Mutation 隔离、伪 caller/未授工具、pending 取消/HTTP 中断与鉴权脱敏，保留 Anthropic wire 差异及独立严格 Model 拒绝。首次沙箱 localhost listen EPERM 与随后测试调用修复的失败日志保留；最终候选与当前检查结果见 [阶段记录](../../scheduling/legion-cli-role-owned-v2.md)。旧阶段未提交修改保留，源码和测试只在 adapter-controls assignment 范围更新。

[设计](docs/design/2026-10-10_design_cli-controls.md) · [当前功能](docs/feature/cli-controls.md) · [API](api-spec.md)。本层结果不替代后续 Host/安装包/Tester/Reviewer 验收。

## 2026-10-11 Su 前台与后台控制工具

按已确认 Su v0.3 注册 delegate_pm/activity/log 的有限 payload schema 与真实用途描述。start/resume互斥，repair选择器必需；查询过滤、cursor及limit有限。复用Kernel三工具typed契约与独立capability，保持Host绑定前台委托资格/来源/真实Human答案和channel；Adapter不按lifecycle自授权限。request_interaction questionRef保持原bounded桥。

五测试更新新工具合法fixture与专属schema负例，并增加三协议真实六请求形状和五typed状态续轮、needs_human、前后台loadout、questionRef、未授委托、跨实例/旧run/克隆/取消/关闭、非Mutation转换、UTF-8与32KiB结果预算。日志测试只证明Host安全fixture投影未含原文/known-key及Model拒绝秘密字段，不声称Adapter承担Host日志脱敏。首轮新测试PiToolResult外层误带tool被严格Model拒绝，修正envelope后固定完整重验，失败日志保留。

当前候选与实际固定check见[Su任务记录](../../scheduling/legion-supervisor-frontdoor-v1.md)。旧包与旧证据保留；Host持久用途隔离、委托来源/真实答复和安全日志分页及最终安装验收由下游对应owner验证。

## 2026-10-11 Su 取消后继续的 Adapter 独立回归

新增 Provider 的真实部分SSE→cancel_turn→同实例继续对照（无restore与Human-only checkpoint restore），以及公开Service经生产Su八工具的同一路径。完整Human原文保留、未完成partial不进history/第二请求，且实际第二HTTP必须到达；测试只将SDK异常分类为静态安全阶段/类型/码，不输出原始异常文本、prompt或凭据。固定unit的实际候选和日志见[专项记录](../../scheduling/legion-supervisor-frontdoor-v1-su-cancel-repair-integration.md)。

两条Adapter路径当前通过，未复现Reviewer的Host cancel→Continue失败，故不凭资源runtime复用猜测修改impl，也不加重试/等待。Host同样会在prepareMemory/restoreRole的无code异常时给pi_run_failed，旧日志没有独立PiRunResult producer证据；具体根因及Host原用例独立重验待对应owner处理。此次作者修改仅两个测试与三文档，生产源码保持当前候选，不宣称产品取消问题已修复。
