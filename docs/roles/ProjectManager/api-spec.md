# 当前Su CLI公开合同

sendMessage({projectId,roleId:Supervisor,text})是唯一客户消息入口；PM直接客户消息拒绝。answerInteraction({projectId,requestId,version,requestDigest,value})只提交实际Human答复；questionRef/resume由Su与Host绑定，CLI不生成。运行中只读输入继续，/cancel明确停止，/exit关闭。公开角色状态/工作日志沿既有Service安全分页，不暴露私有prompt/summary。当前plan/run检查、缺失证据与monitor状态据Host投影呈现；配置字段与真实示例见README。

[当前功能](docs/feature/cli-project-workflow.md)；1.1.0候选的实际检查/安装身份以legion-supervisor-frontdoor-v1任务记录为准，未用旧1.0.3证据代替。

## 历史说明（旧PM前台版本）

# 公共发行接口：runtime0.8.2 / Desktop0.2.0

当前0.8.2真实包46文件、44mjs，根八具名API保持兼容，workbench-models62具名Model/helpers；公开Service subpaths为policy、mutation、read、check、shell、proposal、pi-agent，加Models共八工作台子路径。不公开Provider/impl、下划线authority/receipt注册函数、native helper或SDK私有API。支持完整字段以[Kernel实际API](../KernelEngineer/api-spec.md)、[Adapter实际API](../AgentAdapterEngineer/api-spec.md)、[Desktop实际API](../DesktopEngineer/api-spec.md)为准。

| 公开入口 | 实际契约及权限位置 |
| --- | --- |
| `legion-runtime` | createRuntime及原8 API；旧demo/读写/编辑保留 |
| `legion-runtime/workbench-models` | 现有51项加ShellRequest/Review/Preparation/Authorization/Decision/Candidate/Result/FileBaseline与shellEffects/shellArtifacts/shellBaselines；构造值不是批准 |
| `legion-runtime/services/shell` | ShellService/createShellService；observeTime由相邻Provider读取fresh事实，factory自己构造相邻Provider |
| `legion-runtime/services/mutation` | MutationService/MutationError/createMutationService；observeTime提供Host事实，既有execute处理受控write/edit及Host Shell delete |
| `legion-runtime/services/check` | CheckService/createCheckService；独立批准检查和真实报告，不能用ShellResult代替 |
| `legion-runtime/services/pi-agent` | start_run/next_event/respond_tool/cancel_turn/get_history/restore_history/cancel/close八生命周期，工具由Host scope固定 |

## Shell Host 接线

```javascript
import { createShellService } from 'legion-runtime/services/shell';
const service = createShellService({ workspaceRoot, runtimeExecutable, outputRoot, lockRoot,
  authorizationValidator, artifactScopes, npmCli, previewMaxBytes: 8192 });
const preparation = await service.prepare(request, { signal });
const pair = await service.run(request, authorization, review, { signal, onOutput });
// ready_for_publication is Host-only. Use the original role's controller and Mutation.
const receipt = await service.publicationReceipt(request.requestId);
const data = await service.readCandidateData(request.requestId, resource);
// Bind proposal bytes, executable and expectedBaseline to its actual candidate;
// controller.issueShellPublication(proposal, receipt, service.observeTime()) yields a once-use Mutation permit.
// Publish only approved source files and request.generatedEffects, then:
const final = await service.finishPublication(request.requestId, { results, generatedResult });
await service.close();
```

以上为签名接线片段，变量由可信Host提供，不是独立可运行授权示例。lockRoot须已存在、物理、绝对、Host私有并供同项目Shell/Check共享；outputRoot归原请求角色。artifactScopes[{scope,kind:dependencies|build}]来自Human确认计划，npmCli是Host固定正常安装CLI路径，不加载用户shellRc。完整fileOwners与authoredResources库存防生成目录覆盖owner或未归属源码。

Host validator `validate(request,authorization,review,{phase,signal})`在approve/consume/publication核对真实PM会话及structured decision、identity/plan/profile/context/owners/effects/expiry，返回matching typed decision、同一authorization/review与live AbortSignal；consume在共享锁内原子claim实际持久审批。ShellRequest/Review/Authorization及digest均不单独证明授权。prepare.inputVersions/snapshotDigest/generationDigest原样复用；generation包含固定dependency scopes∪请求outputs，不能仅计算dist。

Host方法为observeTime/prepare/run/readCandidate/readCandidateData/publicationReceipt/publishGenerated/finishPublication/recoverGenerated/close。ordinary binary取{encoding:base64,contentBase64}，canonical decode≤2MiB，content互斥，按真实bytes/SHA与candidate safe executable验证；正文不进SDK/renderer/history。source ActionProposal私有tool legion_shell_publish、capability request_shell，action write_file/delete_file，typed present/absent expectedBaseline。真实opaque receipt→controller.issueShellPublication→原Mutation.execute，delete实际missing/tombstone；receipt只能Host持有，不复制或重建。

ShellResult区分ready_for_publication/published/partial_published/failed/denied/cancelled/stale/unsupported/error；包含实际executed/exitCode、有限stdout/stderr/truncation、candidate metadata、publishedResources、generation与logical/actual目录关联。SDK只接最终ShellDecision+ShellResult，原PiToolRequest一次回应，review工具结果用AgentControl typed pair；迟到、跨run、clone、重复回应拒绝。

## 产品和恢复契约

legion_request_shell参数{command,cwd?,reason,generatedEffects?,network?,timeoutSeconds?}，默认空cwd、[]effects、none网络、300秒（最多900）；legion_review_shell参数{requestId,requestDigest,revision,approved,reason}只由PM受限review实例提供。single_run和conversation活动预算均有Host等待暂停机制；纯文字restore不恢复工具/批准。preview默认8KiB，最多64KiB并按上下文余量缩小，archive1MiB；PM等待5分钟，超时回收另30秒。

Desktop唯一Pipeline调用Organization enqueueShell/shellPhase/reviewShell/appendShellReview/claimShell/interruptShell/shellOutput/shellRecoveryInputs/completeShellRecovery/inventory/shellConfiguration。私有CAS ledger记真实请求、原绑定、prepare及逐Mutation结果/生成版本，不持久permit/receipt。renderer仅有限shellRequests DTO/安全文本，不新增任意命令IPC。PM回合/memory CAS串行、不改变原active generation；成员对话保原scope身份。

partial/restart持续暂停，旧许可和命令不能重放；源码恢复需Human新计划、新owner当前权限和当前baseline，新Mutation/新Shell审批逐项执行。全部实际任务/checks/最新磁盘与generation一致才追加recovered，旧partial保持；generated recoverGenerated是同会话版本核验能力，跨restart由Host显式处理，不承诺自动源码withdraw或全批原子。

Workspace只读Reader接受已确认c872治理元组与历史pins，四candidate字段的AWAITING标签不自授权，Supervisor仍v2。未知字段、范围或单独/同步篡改Section1/YAML仍拒绝。新的执行权限始终来自Human计划、当前owner与Host审批。

macOS需要CLT/SDK及startup探针；权限签名不是kernel object ID，故意可信Host clone在信任边界外。未支持平台和探针故障unsupported，无裸Shell降级。localhost/external均需批准，外网未实际实跑、不提供域名隔离。固定Check仍no-fork、真实报告、当前input/generation pin和独立Acceptance。

## 包身份和当前证据

实际依赖 `file:../../.ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/packaging/bridge-v3/legion-runtime-0.8.2.tgz`，SHA `1a2a7c483f04f2bb939d6bf4d25aa7a4318bc866a473dcac251f74d1ee592622`；SDK1.0.4/Electron44.6.0/Forge8.0.1/Playwright1.63.0不升级，Desktop仍0.2.0。lock真实integrity及44source字节匹配，旧0.8.0/f45/历史ZIP保留，未registry发布。

[依赖修复桥](../../scheduling/handwell-project-shell-dependency-read-repair-v1.md)实际实际包门与contract结果，已安装native/npm/build/only-dist、binary/delete、三协议Schema与Electron Check/旧恢复通过。Desktop当前组合及[Reader当前证据](../../scheduling/handwell-project-shell-workspace-reader-v1.md)为各Owner证据；独立完整流程/GUI/客户SSH和Windows交付仍看[最终任务](../../scheduling/handwell-project-shell-model-time-facts-repair-v1.md)。

本最终阶段仅10docs；相同固定package checks会更新当前Shell阶段的latest JSON。先保存完整旧archive与SHA/mode/path/log关联，复验后另存新archive；旧pinned JSON观察如已变化只能标历史，不能借copy恢复current。tar/source/lock/exports与原task日志不变。当前新checks实际结果以本次任务记录为准，不重复套用早期通过。

[当前功能](docs/feature/project-shell.md) · [架构](docs/architecture.md) · [变更](docs/change/2026-10-10_change_project-shell.md)




## 0.8.2 显式Host时间事实

角色批准后可能在发许可与真正提交之间等待。纯Model现在不读取环境时钟或注入clock callback；Shell/Mutation的相邻Provider取得fresh safe epoch毫秒，经公开Service的 `observeTime()` 传入Model比较。Host每项proposal调用 `controller.issueShellPublication(proposal, receipt, service.observeTime())`，不为整批缓存旧时间。操作层在issue、consume、publication以及真正create/replace/delete和recheck前重新观察，缺失/无效/回退时间事实、到期、abort及replay仍失败关闭，不能凭旧issue事实延长许可。

publicfactory和62具名Model/helpers不变；该Host controller第三参数为必需caller调整，实际Desktop与包测试各自接线。SDK request/review/result、renderer与历史不新增clock字段，ordinary write/edit仍原用法。Policy的私有publication上下文使用真实receipt和 `observedAtMs: mutation.observeTime()`，Model值或时间数字不是审批授权。完整实际接口见Kernel API末节。

当前0.8.2 bridge-v3真实包SHA `1a2a7c483f04f2bb939d6bf4d25aa7a4318bc866a473dcac251f74d1ee592622`，46files/44mjs及安装每源相等，Desktop产品仍0.2.0。原0.8.1 bridge-v2和0.8.0 bridge-v1、旧proof及final before/after archive均保留。Owner实现和本阶段三固定门的最新候选/成绩、独立Reviewer/Tester状态以[时间事实修复任务](../../scheduling/handwell-project-shell-model-time-facts-repair-v1.md)记录，不复制活任务计数，不把下一检查写成已pass。当前包源保持冻结，本阶段只更新10文档，固定门前后完整保全bridge-v3快照并按Gov策略标注latest。


本机当前WindowsZIP本体及对应descriptor缺失；macOS可核验的是历史0.7.0 TGZ/descriptor的39file/37source身份与当前0.8.2真实安装，不读取不存在的ZIP字节，不以这些结果宣称Windows支持、exe/DPAPI或GUI发行通过。旧Windows精确断言和独立发行验证由后续原Reviewer/Tester保留。外网仍未实际运行，当前Shell仅macOS CLT/SDK与startup探针实际能力范围，失败unsupported；源码/生成恢复的新Human授权、当前baseline与追加recovered语义保持。


## 0.7.0公共接口历史

以下保留当时记录；版本、待办和通过状态仅适用于原记录候选，当前状态见上文。

# 公共发行接口：runtime 0.7.0 / desktop 0.2.0

当前 runtime 根八项 API 与 CLI 保持兼容。`workbench-models` 具名导出 51 项共享 Model/纯函数；新增 CheckSpec、CheckRequest、CheckAuthorization、CheckDecision、CheckResult、checkSpecs、AgentControlDecision、AgentControlResult、AgentControlTools、AgentTools。公开 Services 为 policy、mutation、read、check、proposal、pi-agent，共七个子路径（含 Models）。不公开 Provider 或具体实现。

CheckService 公开 `createCheckService({workspaceRoot,runtimeExecutable,outputRoot,authorizationValidator})`、`run(request,authorization,{signal}={})`、`close()`。三个路径为可信宿主绝对路径，factory 自建相邻 Provider，拒绝 provider 注入。validator 的 `validate(request,authorization,{signal})` 允许时返回 matching typed `{decision,authorization,signal}`，signal 必须是真实 AbortSignal，在批准或身份版本撤销时 abort。Service 执行前后复核 live authorization；取消、失败、stale、unsupported 不变成通过。详见 [Kernel actual API](../KernelEngineer/api-spec.md)。

首版仅 macOS Node 检查（Electron 可用 Node 模式），固定 `--test-isolation=none` 并 deny process-fork，不支持测试启动其他进程；其他平台返回 unsupported/executed=false。Node 真实事件通过只读 reporter 的 fd3统计；stdout假TAP与空suite拒绝。检查保留输入SHA、实际argv、平台/运行时/隔离、时间和日志，close可重复且只清理本次资源。

Adapter 实际七项新工具含检查及六控制，四类 typed pair 为原读/写、新check/control；host等待暂停活动预算，取消释放pending，详见 [Adapter actual API](../AgentAdapterEngineer/api-spec.md)。Desktop持久组织/交互/验收Service与Provider、唯一Workbench Pipeline和UI已接线，owner实现见[Desktop任务](../../scheduling/legion-governed-workflow-v1-desktop-implementation.md)；后续[角色读取修复](../../scheduling/legion-governed-workflow-v1-workspace-reader.md)、[reporter修复](../../scheduling/legion-governed-workflow-v1-reporter-repair.md)及[Electron修复](../../scheduling/legion-governed-workflow-v1-electron-runner-repair.md)具有各自真实证据。当前[架构师诊断返修](../../scheduling/legion-governed-workflow-v1-live-architect-repair.md)与[独立集成/UI验收](../../scheduling/legion-governed-workflow-v1-final-integration.md)仍待当前候选检查；[独立结构评审](../../scheduling/legion-governed-workflow-v1-independent-review.md)原结果只代表其记录候选。普通测试入口和包刷新见[本次任务](../../scheduling/legion-governed-workflow-v1-test-entrypoints-release.md)。原主任务pending后段由这些具体任务接续，原状态与旧通过记录不能代替最终交付。

0.7.0本地包精确39文件/37 mjs，npm pack与安装效果位于 `.ans/runtime/legion-governed-workflow-v1/ProjectManager/packaging/`；desktop manifest/lock实际指向该tarball。SDK固定1.0.4，Electron44.6.0、Forge8.0.1、Playwright1.63.0。npm ignore-scripts保留已有官方Electron二进制；不全局安装或registry发布。旧0.4/0.5/0.6包受保护。

固定 `task_ops run-check` 的 package 检查运行根与desktop两测试文件。核验包白名单、所有安装文件摘要、公开import、旧读写/编辑/Pi/README/CLI和真实Electron Node CheckService smoke。此package检查仅5项包用例；Windows ZIP及独立完整UI验收仍需其当前证据。[任务证据](../../scheduling/legion-governed-workflow-v1.md)与本阶段package-smoke.json、electron-check-smoke.json记录真实执行。

当前计数通道已按[Kernel返修证据](../../scheduling/legion-governed-workflow-v1-reporter-repair.md)加强：每次随机初始化key、MAC与递增序号、captured方法及固定stream入口，裸fd3 JSON拒绝。Node固定permission补充限制inspector/native addon/worker/process.binding；真实文件/网络/进程隔离仍由Seatbelt承担。已测直接伪造与入口替换等范围不构成任意恶意JS的一般不可篡改保证，同进程测试断言与覆盖仍需审阅和独立验收。需要上述受限API或替换固定stream入口的测试不支持。本次Electron smoke使用实际安全flags验证普通test通过与直接fd3伪造拒绝。

Electron NODE_OPTIONS兼容问题已由Kernel原owner返修并verify，普通Node与真实Electron162项通过。当前执行显式argv固定四个权限参数后接isolation/reporter/spec.argv，Service逐参数核对；NODE_OPTIONS不设置或继承，逻辑CheckSpec.argv保持不变。PM当前包检查核验刷新后的源码/README/tarball/安装身份与真实Electron通过及fd3拒绝，最终以task_ops package结果和Supervisor验收为准。[实际失败任务](../../scheduling/legion-governed-workflow-v1.md)。

普通开发入口：根 `npm test` 串行22模块（Kernel13、Adapter4、package1、Reviewer1、integration3）；三个分类入口同步包含新Check/Control模块。Desktop `npm --prefix apps/desktop test` 串行20模块，保留原13模块，增加组织/交互/验收4项单元、工作流边界和独立工作流集成/UI。完整入口通过状态由各自实际执行记录决定。

当前Adapter conversation预算默认/最大 `{maxQueueEvents:256,maxTextCharsPerTurn:65536,maxOutputTokens:8192,turnTimeoutMs:180000}`，仅允许向下设定，原2048/60000调用仍兼容；超cap拒绝。host等待暂停累计活动计时，取消立即abort，8192为宿主上限且不证明供应商能力或价格。原60秒真实超时后必要修复及三协议wire/cancel证据见[Adapter任务](../../scheduling/legion-governed-workflow-v1-model-budget-final.md)，新0.7.0实际安装/当前package候选见[发行刷新任务](../../scheduling/legion-governed-workflow-v1-final-runtime-release.md)。既有22/20模块普通入口和原package断言保留，旧包证据不替代当前包；Windows与完整UI待独立当前证据。


## 2026-10-09 角色上下文 runtime 本地发行

本次仍为 runtime `0.7.0`、Desktop `0.2.0`，root manifest 与有限 exports 保持原版。新的实际本地依赖路径为 `file:../../.ans/runtime/legion-governed-workflow-v1/ProjectManager/packaging/role-context-20261009/legion-runtime-0.7.0.tgz`，由桌面 lock 的 SHA-512 integrity 绑定候选，不复用旧产物路径。新包包含 39 文件、37 项 mjs 来源、51 项具名 Model 与六个公开 Service（加 Models 共七个工作台子路径）。

现有 `createPiAgentService(options)` 的公开 `restore_history(checkpoint: PiConversationCheckpoint)` 已透传 Adapter 新行为：全新 `single_run` 实例只可在首次 `start_run` 前恢复一次当前实例与 profile ID/version 绑定的纯用户/助手文字。错误类型、跨实例或连接版本、重复、运行中与结束后恢复均拒绝；已结束实例不能发起第二 run。旧工具消息不能进入 `PiConversationHistory`，恢复不创建工具响应或权限；当次 `AgentScope` 决定可调用工具。`conversation` 原恢复规则保持。SDK `length` 停止为 `run_failed` / `pi_model_error`，不能当作完整摘要。

本机已实际离线安装，并通过隔离 consumer、桌面 Node 24.14.0、Electron 44.6.0 的 Node 24.21.0 验证恢复文字进入真实 Pi SDK 请求、当前工具集合、绑定/时序拒绝与截断失败；测试使用本机 fixture，不调用外部模型。宿主角色记忆、自动摘要、五页签与来源显示由 Desktop 后续交付，本包提供其必需恢复能力，未据此宣称这些界面功能完成。Windows ZIP 本轮未执行。

产物 SHA256：`f45fa15e8c0f195930c35c782904690ce7073680df1e4ec0d0ea6e80215bbad7`；integrity：`sha512-aOdtjtiQUjJWuQJiLY2kYtNC9lMYiRqQqTC5vAy1DLSNXY7ppQ0n/WaDqHhwGZ8Fkvi7R3lqoKZMtk4kVmuM0g==`。完整来源与行为证据在 `.ans/runtime/legion-governed-workflow-v1/ProjectManager/packaging/role-context-20261009/package-smoke.json` 和 `installed-role-memory-smoke.json`。固定 package 检查的最终结果见[本次任务](../../scheduling/legion-persistent-role-context-and-dialogue-v1.md)。


## 安装后的 CLI（2026-10-11）

`legion chat` 经 `bin/chat.mjs` 调用唯一公开 `createHeadlessWorkbenchPipeline`，保留当前 Human answerInteraction、角色 owner/检查/Acceptance/监督合同。包包含完整 Node 导入闭包；环境配置及共享租约见 [CLI 功能](docs/feature/cli-project-workflow.md)。owner固定cli检查9/9通过，无skip；当前任务记录保存冻结候选与完整日志，独立Tester/Reviewer尚待完成。


## 当前Su入口（2026-10-11）

客户sendMessage只使用Supervisor；PM为Host受控后台委托。CLI真实Human interaction、执行中只读问答、角色metadata分页、当前证据交付与默认lease/key合同按接受Su v0.3接线；新1.1.0包/示例/完整固定cli结果以当前任务为准，旧PM入口记录只作历史。新增架构：Interface bin/chat→唯一Headless Pipeline→公开Services→Providers，未复制编排或新建工作日志库。当前功能见 [Su项目流程](docs/feature/cli-project-workflow.md)。


## 当前确认选择必要修复（1.1.1）

真实1.1.0生产bin在同Su turn连续A/B草案时曾重复选旧pending A。当前CLI按current planDigest及公开Host组织/context/profile绑定选最新执行请求；discussion/choice/Shell相关Human请求沿自己的绑定，最终仍由Host校验。stale_interaction/interaction_invalidated/stale_file_owners只排除精确id/version/digest，暂态organization_busy不永久丢弃。A展示后B出现，旧A yes须被Host真实拒绝；重新呈现B完整请求并等待新的Human输入，零旧任务/零旧写、不重放旧yes。新增production bin双draft回归保留原三协议/Su读/分页日志/问答/Check/Acceptance/记忆/monitor/key/取消和包Shell门。

补丁1.1.1在su-frontdoor-cli-repair-v2鲜路径，旧1.1.0及全部失败证据保留；当前冻结候选/实际固定cli结果见legion-supervisor-frontdoor-v1-cli-repair-integration任务记录，独立Dfinal/T/R仍需新候选复核。此处修复合同与用例在pack/check前写定，非复用旧1.1.0通过。


## 当前取消续轮必要修复（1.1.2）

共享Host捕获并drain取消的前台run，保留真实终态，再为同项目Su新turn准备上下文。取消后的Continue须实际到达第二HTTP并正常回复；完整Human first input与Continue保留，partial SSE未完成文字不入SDK恢复或持久history。旧工具、肯定答复/grant不重放。Adapter真实139/139对照不冒充Host修复原因；实际Host候选已四门verify后由本包消费。

PM生产bin三协议回归在首partial SSE挂起时/cancel，同进程Continue，断言第二真实请求、Su完成、恢复SDK history/roleMemories无partial，取消journal可保留标明cancelled的原始片段；known-key全持久面及零旧任务。旧双draft当前确认、三协议全局读/状态/分页日志/问答/Check/Acceptance/分类事实/monitor/密钥与Shell强门保留。1.1.2 fresh su-frontdoor-cancel-repair-v1；冻结候选与当前固定cli日志见legion-supervisor-frontdoor-v1-su-cancel-host-repair-integration任务。旧1.1.1与失败证据只读，Dfinal/T/R需当前包重验，已评审有限保证及未验收平台/远端门不变。


## 失败计划后的新Human续轮（1.1.3）

共享Host将真实member log.channel传给cacheRole，后台supervision_preflight/monitor不写su_customer，临时Shell审批不污染pm_delegate；真实来源/covered/revision变化仍严格拒绝。原D定位的revision3→4后台错channel写已修并verify，本包消费当前源码，不以旧图39/40或Adapter139/139诊断冒充完成。

生产CLI必要回归：真实Node Check导致plan.failed，后台monitor终态回复屏障在途时立即新Human消息，实际新Su HTTP到达并释放后台终态，形成新草案及当前Human确认，无stale_role_memory/旧failed停留。CLI对已排队新消息优先处理，不在终态monitor摘要等待中阻塞；无sleep/retry或CAS弱化。取消→Continue三协议、双draft/旧yes不重放、key全持久面及owner/Check/Acceptance/Shell强门保留。1.1.3在su-frontdoor-memory-repair-v1鲜目录，正式冻结候选/cli结果见legion-supervisor-frontdoor-v1-role-memory-race-repair-integration；旧包/失败记录保留，Dfinal/T/R仍需当前包重验。
