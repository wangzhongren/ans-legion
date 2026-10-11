# ProjectManager 变更记录

## 当前交付完成：1.1.3（2026-10-11）

当前 1.1.3 Su 唯一客户入口交付已完成：[当前主图](../../scheduling/legion-supervisor-frontdoor-v1-role-memory-race-repair-integration.md)五节点全部 verified。PM 固定 cli 10/10；Desktop caller owner 207/207、host 157/157、parallel 123/123；[Tester 独立验证](../Tester/docs/verification-cli-v1.md)真实 npm 安装 14 场景及 regression 40/40；[Reviewer 结构审查](../Reviewer/docs/review-cli-v1.md)69/69。上述结果绑定当前包和候选，不由历史阶段成绩替代。

最终 tar 为 `su-frontdoor-memory-repair-v1/legion-runtime-1.1.3.tgz`，SHA256 `e0ac5ebaee7caabc52175fe28e229c6fbc195d02890ec5bffe6ba76d80a6f73a`；102 包文件、99 mjs（含 54 个 Desktop Node 闭包模块），当前源码、tar 与安装来源一致，Desktop manifest/lock/resolved/integrity/installed 身份一致。README 示例实际执行，`readmeExample=true`。三协议生产 bin 保留双草案当前确认、取消后同进程 Continue、失败计划后立即新 Human 消息，以及 owner/Check/Acceptance/Shell/已知 key 强门。取消原始私有 journal 可保留绑定 cancelled turn 的 partial；公开 history、后续 SDK body、可恢复角色记忆与事实索引不消费它，Human 原文保留。

有限保证：仅针对已捕获环境 key 的受控数据路径，不能扩为未知/编码秘密泛扫或子进程自行构造与 TOCTOU 的一般保证。旧整仓库 observer 因旧治理 pin 不可用；旧 Shell/GUI E2E 暂停，Windows ZIP 与远程付费模型未验收。Tester 早期共享租约根中来源身份无法证明的 `85f6cbb5d433668ee49ccc7b161b39791e434edcd1ae451c1e83bef2011f89b5.owner-source.json` 和 `3d85c08cf8d7485e85864710c081387c685be760e739a2e64d3d36591f1a400b.owner-source.json` 保留，不猜测清理。

## 历史阶段记录

以下原有内容按当时状态保留，其中“当前”“待验收”“独立 T/R 尚待完成”等均为历史阶段描述；当前结论以上述 1.1.3 主图及独立报告为准。

## 2026-10-08 文件归属与执行编辑

Node runtime升至0.6.0，根八项入口不变；workbench-models增至41项具名导出，增加纯文件归属/转交与跨角色写范围校验。`ProjectReadResult.sha256`指向完整文件，执行成员可用`legion_edit_file`凭旧SHA在精确归属文件内做受控局部编辑，沿原一次性许可和审计。32文件/30mjs tarball已隔离离线安装核验，旧0.4/0.5 tarball未改。Desktop本地依赖实际重装0.6.0，已恢复本机Electron二进制。[已确认设计](docs/design/2026-10-08_design_legion-file-ownership-and-agent-edit.md)、[Node发行](docs/feature/distribution.md)。

Desktop包验证更新严格Windows分支：检查0.6.0/41 Model/32文件身份、计划归属展示、同角色依赖的写后受控编辑、确认后的显式转交、重启后owner持久性，并保留真实make/ZIP/exe、原生选择、DPAPI和视觉门禁。macOS仅运行已安装包、源码和Electron本机身份检查；Windows ZIP和独立Reviewer/Tester仍未由本机证明。实际候选和检查以[当前交付任务](../../scheduling/legion-file-ownership-and-agent-edit-v1-delivery.md)为准。

## 2026-10-08 项目内广读精写

Node runtime升至0.5.0；八项根入口保持，工作台有限入口增至34项具名Model/纯函数与五个public Service，新增ProjectReadRequest/Decision/Result、路径规范化及Read Service。新32文件tarball与Desktop本地依赖锁定，原仅写入宿主继续保持原工具集。PM讨论与确认后的成员现在可由可信宿主调用受控目录列表、分段读取当前客户项目普通文本；Human手动固定的重要上下文仍独立绑定SHA，模型自主读取不自动固定或扩大写范围。写入只限确认任务的精确writeSet，旧许可、审计与取消约束保留。[客户确认设计](docs/design/2026-10-08_design_legion-project-wide-read.md)、[Node发行](docs/feature/distribution.md)。

Desktop package严格Windows分支已更新0.5.0、34 Model、Read Service、32文件/30 mjs和PM只读工具契约；macOS分支验证实际安装包与Electron44.6本机二进制。当前主机未生成或验证Windows ZIP、DPAPI重启、原生目录选择和真实exe视觉路径，不能把本机包check当作这些证据。实际检查结果以[当前任务](../../scheduling/legion-project-wide-read-v1-final.md)为准；独立Reviewer/Tester和Windows发行仍待后续验证。

Reviewer发现原0.5.0 tarball与新Kernel凭据路径修复的源码身份不一致。ProjectManager用已验证的新Kernel源码重建同版本本地tarball，桌面锁更新为当前integrity，并在隔离安装smoke中断言嵌套`.npmrc`、`.ssh`和`.docker`路径拒绝且无正文。旧0.4.0 tarball保持只读，当前刷新与重新核验以[凭据修复任务](../../scheduling/legion-project-wide-read-v1-credential-repair.md)为准。

## 2026-10-07 工作台v2历史

2026-10-07 工作台v2：客户确认single-PM/focus_conversation方案。前core-package-deps阶段冻结runtime0.4.0/29文件包、30Model/四Service公共subpath、Desktop0.2.0本地file依赖和真实SDK/Electron；三approved检查通过，由Supervisor验证。两个SDK1.0.4、Electron44.6.0、Forge8.0.1、Playwright1.63.0不升级。

原desktop-package方案更新缓存接线、thin ESM入口、双页面使用说明、严格发行测试与文档，拟从源码make并解压0.2ZIP，验证包内runtime0.4/真实Pi、原生目录选择/唯一PM/结构化计划确认与受控写/停止、DPAPI跨重启、浅深色与最小窗口及close。该段是旧版方案历史，当前0.5候选的Windows ZIP执行状态见上文；旧截图或原型不能替代当前证据。

capabilities/Interface fixture隔离必要修复由Desktop owner在独立bounded任务完成，原Interface issue/stop保留；PM不修改业务候选。实际发生的sandbox/打包/窗口错误保留证据并按owner边界修复。未向registry发布，无付费模型调用，无任意shell软件执行器。

[当前发行](docs/feature/desktop-distribution.md)、[工作台设计](docs/design/2026-10-07_design_desktop-workbench-v2.md)、[Node发行](docs/feature/distribution.md)。

## 历史

0.1桌面GUI是AI配置/角色映射/只读观察原型，不满足后来客户提出的管理对话与动态任务最终目标；其ZIP、失败和原native证据只读保留。[原型设计](docs/design/2026-10-07_design_desktop-gui-v1.md)。

0.3Node迁移采用真实同进程PiSDK与受控工具，保留Python v1历史。close竞态独立Tester发现后Kernel修复，重新package与严格回归验收；后来fixturecompat4test隔离与所有权snapshot修复保留旧141结果，不能代替当前v2完整Node回归。[Node设计](docs/design/2026-10-07_design_node-pi-v3.md)。原cache不会在新任务中写日志，仅按授权只读seed。

## 2026-10-08 runtime0.7.0发布阶段

新增共享检查/控制具名导出与CheckService子路径，实际39文件pack及Desktop本地安装；51 Model、七子路径和真实Electron Node CheckService最小smoke纳入包检查。旧读写/编辑与历史0.4/0.5/0.6产物保留。runtime实现已就绪；Desktop纯组织/交互Models完成，持久Services/Pipeline/UI待后续。正式检查与候选由task_ops package证据及Supervisor verify确定。

当前计数通道已按[Kernel返修证据](../../scheduling/legion-governed-workflow-v1-reporter-repair.md)加强：每次随机初始化key、MAC与递增序号、captured方法及固定stream入口，裸fd3 JSON拒绝。Node固定permission补充限制inspector/native addon/worker/process.binding；真实文件/网络/进程隔离仍由Seatbelt承担。已测直接伪造与入口替换等范围不构成任意恶意JS的一般不可篡改保证，同进程测试断言与覆盖仍需审阅和独立验收。需要上述受限API或替换固定stream入口的测试不支持。本次Electron smoke使用实际安全flags验证普通test通过与直接fd3伪造拒绝。

Electron禁用NODE_OPTIONS的实际包测试失败保留；Kernel返修采用显式固定权限argv，PM包与桌面依赖重新生成安装，README和全部包内容按当前source身份复核。最终固定package证据决定本阶段状态。

## 2026-10-08 普通测试入口与0.7.0候选刷新

已授权完整方案要求新机制进入普通检查。根普通test由17增至22模块，kernel/adapters/integration分类入口同步补齐Check/Control；Desktop由13增至20模块，加入组织/交互/验收、工作流边界及独立集成/UI。原用例和断言保留，现有包用例核验入口不再遗漏。manifest/README变化后重新pack、真实离线安装和lock核验，旧0.4/0.5/0.6受保护；新结果见[本次任务](../../scheduling/legion-governed-workflow-v1-test-entrypoints-release.md)。Desktop持久Services/Pipeline/UI已有owner实现与当前诊断返修，独立完整流/UI仍待当前候选验收，未据此宣称全局交付。

## 2026-10-08 模型活动预算修复后的发行刷新

Adapter因真实桌面60秒 `pi_turn_timeout` 把conversation输出/累计活动默认和cap改为8192/180000，允许原调用缩小且保留等待停表、即时取消及vendor unknown。PM按相同授权重pack0.7.0并实际离线刷新安装/lock，39文件来源一致，保存此前bb54入口阶段产物和证据，普通Node22/Desktop20模块及原断言不变。当前包检查见[新发行任务](../../scheduling/legion-governed-workflow-v1-final-runtime-release.md)，完整软件与Windows不据包检查宣称通过。


## 2026-10-09 角色上下文恢复能力的独立本地发行

按客户已确认的 v1 集成规范，将 Adapter 新的全新 single_run 首次纯文字恢复及 SDK length-stop 失败处理打入新的 0.7.0 本地包。Desktop 0.2.0 file 依赖改用 `.ans/runtime/legion-governed-workflow-v1/ProjectManager/packaging/role-context-20261009/legion-runtime-0.7.0.tgz` 并实际离线安装更新 lock；root 版本未变。Node 包测试、Desktop 包测试与依赖校验读取新候选 smoke，原包文件清单、exports、CSP、角色生成范围与 Windows ZIP 严格验证保留。所有新 smoke/evidence 使用隔离子目录，原 tarball/ZIP/记录保持。

新包 SHA256 `f45fa15e8c0f195930c35c782904690ce7073680df1e4ec0d0ea6e80215bbad7`；原 0.7.0 tarball SHA256 `00382a9d3fdb3d2a10112b110b7a20b4b18d8b376d3045e50b459294c50b3b9e`。Node 与实际 Electron Node 的公开 Service 行为验证覆盖当前绑定、只恢复一次、当前工具集、旧工具消息/实例拒绝以及 length 截断失败；无外部模型调用。固定 package 检查以[本次任务](../../scheduling/legion-persistent-role-context-and-dialogue-v1.md)实际结果为准。当前尚待 Desktop 实现自动摘要和五页签、独立 Reviewer/Tester 集成验收，Windows ZIP 未执行。


## 2026-10-10 项目Shell公共包与最终管理文档

已确认冻结v1与c872精确配置；0.8.0 bridge-v1真实包/安装后，依赖读取必要修复形成0.8.1 bridge-v2（SHA970bf9954813022cef8f396b8ac388088024cdca9ffd18d1533347723b5a73f1）。当前46文件/44mjs/62具名Model、八Service/Model子路径，Desktop仍0.2.0；原根API和八Pi生命周期保持。0.8.1包门7/7、回归包7/7、contract通过，only-dist已有.bin和readonly依赖拒整批、binary/delete、真实三协议同pending及Electron检查有实际证据。首次旧lock完整性失败与旧0.8.0/f45/全部历史产物保留。

本次仅十份角色文档同步[当前功能](docs/feature/project-shell.md)、[实际API](api-spec.md)、[架构](docs/architecture.md)及[设计/变更](docs/change/2026-10-10_change_project-shell.md)。Desktop owner当前组合177/34/199、Reader精确兼容18/199/177分别绑定当前候选；独立Reviewer/Tester及GUI/客户SSH/Windows仍后续。Reader四candidate字段保持历史，仅已接受exact元组可读；sourcepartial新Human/currentbaseline/new approval恢复追加recovered，旧partial不改，不自动源码withdraw、不整体原子、不重放旧Shell。

macOSCLT/SDK及permission signature真实探针为前提，失败unsupported；网络none/localhost实际受控，外网未测试。最终固定包门前后完整archive旧/new bridge-v2，固定JSON标latest并记录旧观察历史，原tar/source/lock/导出/原task日志不变。当前三gates与最终Source/日志以[当前任务](../../scheduling/handwell-project-shell-final-integration-v1.md)为准，不据本条历史摘要捏造新的通过。


## 2026-10-10 Model纯度修复与0.8.2当前契约

Reviewer发现Model中的三个环境时钟读取后，由原Kernel在同v1范围修复。可信Provider→Service observeTime取得fresh事实，controller.issueShellPublication第三observedAtMs每proposal新观察，真实consume/recheck/commit前仍重验expiry/oneuse/replay/abort；未注入Modelcallback或新增SDKclock字段。0.8.2 bridge-v3实际打包安装，46file/44source/62导出，tarSHA `1a2a7c483f04f2bb939d6bf4d25aa7a4318bc866a473dcac251f74d1ee592622`；Desktop产品0.2.0，Host caller由原owner修复。前0.8.1/0.8.0、旧proof与final归档保留。

本最终阶段只同步10docs；bridge-v3旧输出先完整fresh归档SHA/mode/path/logmapping，原配置三门后固定JSON记latest，再完整归档新run。tar/Source/锁/导出/旧stage和原task日志不改；不以copy让过期观察复活。当前包/Owner与独立验收成绩看[实际修复任务](../../scheduling/handwell-project-shell-model-time-facts-repair-v1.md)，本文不写尚未运行的新门已pass。WindowsZIP/descriptor本机缺失，Mac历史TGZ39/37检查不充当Win证据；外网未测试，macOSCLT/native探针前提及恢复/独立Acceptance边界保持。


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
