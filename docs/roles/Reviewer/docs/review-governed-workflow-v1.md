# 完整工作流独立结构与权限评审

## 提示词超限修复后的当前最终候选

最终阶段曾按Supervisor指示暂停：Tester严格完整用例暴露长多轮的真实输入预算错误，完整`governedDTO`自身达67,733字符，超过Adapter原65,536字符上限，导致PM发送失败。先前50项结构通过覆盖有限边界，未覆盖该长期台账增长；不能据此否定新的真实失败。验收失败描述换行和SDK身份断言的夹具问题由Tester在自身范围内按真实契约修正，Scope/Cancel/CAS/返修上限断言保留。

原Desktop owner已在[精确提示词修复任务](../../../scheduling/legion-governed-workflow-v1-prompt-context-repair.md)完成并由Supervisor verified：唯一正式`unit`125/125、0 fail/cancel/skip，候选 `efa081fc29d45f5b29c0cf35f97025776dcf1dbd5a6ba6f2138f1d5c2597aa32`，candidateUnchanged=true；日志`desktop-prompt-repair-1-unit-c1f4fab5.log` SHA `a987888f1494b63620ee88e1987b6d28161488d6203a9e740edca66bf6ee43b4`。该unit已包含Model suites，没有本assignment单独Model检查；旧Model26/unit121只能说明旧候选，不代替本次125项。

Reviewer读取实际修复源码、当前API和对应回归：Model `governedPromptDTO`只投影当前组织、当前base待审候选、当前角色文档批准引用、当前plan最新真实checks/Acceptance/repair关联，明确`historyOmitted`和日志`summaryTruncated`。完整timeline/旧记录仍留在UI与持久台账，历史answered queue/所有旧checks不重复嵌到模型输入。`boundedModelPrompt`对真正拼接结果验证65,536字符；PM、RoleArchitect、持久答复continuation、执行任务四个SDK入口均调用它。Human文本、所选context和本次任务instruction不静默截断，超预算明确拒绝。每轮SDK保留最近完整128条纯role/text消息，较早省略明确说明，不恢复tool/grant。同步`start_run`拒绝会把已创建turn记录为failed，返回有限错误并保留草稿，避免孤立running。层职责仍为纯Model值、Pipeline组合公共Service、Provider执行实际SDK；Adapter原输入cap、取消与清理不扩大。

40轮长台账大于65,536字符仍可继续、过大所选context零模型调用/无running残留、较小有效输入恢复，是当前owner自测证据；本次Reviewer按源与断言审阅，未冒称自己重跑这125项。Tester已冻结十二文件并回报精确临时组合integration31/31、实际Mac UI2通过、Windows1平台未运行；对应原失败与修后重新执行日志保留。临时诊断与冻结说明不替代[final-integration](../../../scheduling/legion-governed-workflow-v1-final-integration.md)正式checks与Supervisor核验。

四个Reviewer测试保持只读，原50项及严格断言全部保留；本轮只更新四份文档。原首轮145输入的十个变化是已识别prompt修复源码、owner测试/API及Tester测试/API，不能继续沿用首轮候选。当前145输入清单`.ans/runtime/legion-governed-workflow-v1/Reviewer/evidence/final-review-inputs-prompt-fixed.json`摘要 `53233e7483a6d5b4d188c2a90e3f01a72ce6633d1b042aa390ad025b10754eb6`，含四个只读结构测试SHA并与首轮一致。文档此后冻结；最终固定structure和前后输入SHA结果以本任务最新check及final证据元数据为准，不在通过后继续改文档制造新候选。

本轮runtime 0.7.0 TGZ SHA仍为`00382a9d3fdb3d2a10112b110b7a20b4b18d8b376d3045e50b459294c50b3b9e`；安装字节/真实Electron/Node有限检查须由本轮structure再次确认。新Gov.ProductDesigner治理角色已另行获批并派发独立设计任务；没有修改apps业务源码或Legion运行成员登记，不能表述为ProductManager已上线或商业界面已升级。本评审只结束既有v1机制的有限结构阶段，Windows、DeepSeek稳定、下一轮SSH功能与整产品交付仍按未独立验证范围报告。

## 12:53 UTC 冻结候选的有限最终评审

本轮正式任务是 [final-review](../../../scheduling/legion-governed-workflow-v1-final-review.md)，node `reviewer-final`；使用同一客户批准配置。新 assignment 仅授予 feature-map、api-spec、changelog 和本报告四份文档。四个结构测试只读，50 项全部保留，没有删测试、改断言或新增跳过。已私下 ack，不执行 coordinator verify。

冻结候选首轮实际 `structure` 为 50 项、49 pass、0 fail、1 Windows 平台未运行，exit=0、candidateUnchanged=true。当前任务的最终正式结构日志/候选以文档冻结后的最新 task_ops check 记录为准。本轮的实际检查覆盖既有权限、五层结构、精确 owner/plan/check authority、组织审批、nonce/取消、Node 检查/有限伪计数回归、本机 Electron/safeStorage 和 0.7.0 TGZ/installed 全源字节。未发现本次变化引入的明确层调用或权限范围违例；这只是所列输入与场景的有限审阅。

此次主要变化与审阅依据：

| 当前变化 | 实际源码及审阅结果 | 证据范围 |
| --- | --- | --- |
| 持久对话顺序 | interaction Model 定义唯一 turn/message/request/answer 锚点；Organization Service 在与 queue/answer 同一个 Provider CAS 中保存 timeline。Workbench Pipeline 调用公共 Service，Renderer 只消费有限 DTO。旧无锚点文本保留 legacy/sourceIndex，顺序未知，不虚构时间；SDK History 仍纯 role/text，恢复不重放 tool/grant。 | Reviewer 读取实际 Model、Service、Pipeline、Renderer 和回归用例；本次 structure 实际运行原取消/恢复/对话回归。专门顺序/重复文本/CAS场景来自原 owner 当前冻结 Model26/unit121 证据，非 Reviewer 重新运行。 |
| 已提交提案后 SDK 失败 | Pipeline 只记录当前 instance/run 实际成功 propose 的 ID/version/digest；错误时重读当前同项目、同组织 ledger，仅返回匹配 submittedBy、pending 与已观察摘要的候选。结果保持 status:error、allowed:false 和有限错误码；取消/过期/跨项目不会暴露该 payload。PM 后续仍须精确审阅，提案不变成批准成员或权限。 | 源码检查及 owner 的实际 propose 后401失败回归；未将外部模型某次失败归类为稳定截断或网络保证。 |
| 模型预算必要修复 | Adapter Provider 当前默认/最大输出8192 tokens、累计活动180000ms；queue256/text65536保持有界，caller只能缩小。每次网络流使用剩余timeout、maxRetries:0；host工具等待暂停活动计时，回复不补回已用时间，cancel/close立即终止。只有常量必要修复，身份/公开接口和scope规则保持。8192是宿主请求限制，未知供应商能力/价格仍unknown。 | 读取实际 LIMITS、范围校验、网络options和pause/resume/cancel；本次结构SDK/关闭回归实际通过。当前 owner72项三协议/wire/缩小预算/cancel/toolpause正式证据已verified，历史v2文档原2048/60000只作旧合同。 |
| 当前安装字节 | 0.7.0 TGZ SHA `00382a9d3fdb3d2a10112b110b7a20b4b18d8b376d3045e50b459294c50b3b9e`。当前 TGZ39文件及桌面installed全部源码字节与source一致；本机Electron界面与密钥保护实际检查通过。 | Reviewer当前structure独立字节核对；PM package5/5及真实Electron Node宿主证据已verified。本报告不把旧8997/旧README字节当当前。 |

本轮审阅的 owner 正式记录分别是 [conversation修复](../../../scheduling/legion-governed-workflow-v1-conversation-repair.md)、[Adapter预算](../../../scheduling/legion-governed-workflow-v1-model-budget-final.md)、[当前runtime发行](../../../scheduling/legion-governed-workflow-v1-final-runtime-release.md)。实际日志核对：Desktop Model26/unit121、Adapter72、PM package5，均0fail/skip且Supervisor verified。它们是各自 producer 的自测/装配证据，不能冒称 Reviewer 自己重跑或 Tester 已完成。

首轮145个声明生产、测试、API、README、manifest、installed/helper输入及四个只读测试的 SHA 清单在 `.ans/runtime/legion-governed-workflow-v1/Reviewer/evidence/final-review-inputs-125420.json`，清单摘要 `0d07216e8306b70fa5948f707d90e9100df1712f8933495ddb30cec3d790299d`。本轮首轮候选 `88709f292f340503f06441b2d0b4e7cc354ba05ce901451439917e5ad6a354ae`；日志 `.ans/runtime/legion-governed-workflow-v1-final-review/evidence/reviewer-final-1-structure-201a1778.log`，SHA `0183c747c6c41167e3c37f8db31ac3ef1b3627c31ce8b66a9eb72e8c92506f82`。四份文档冻结后重跑相同 fixedcheck，前后逐项核对该145输入与测试SHA，并通过 task_ops complete 给Supervisor核验。若Tester按当前契约适配其测试/API，该首轮清单会过期，最终清单及实际固定结果以本阶段最新evidence和task记录为准。

尚未由本阶段验证：Windows ZIP/DPAPI；最终 Tester [完整集成与真实窗口阶段](../../../scheduling/legion-governed-workflow-v1-final-integration.md)正在准备、适配及诊断，正式验收在相关测试/API与本轮文档都冻结后运行。准备或诊断的结果不替代该正式验收；当前原生冷启动/legacy迁移与真实外部模型项目进展是PM另行记录的观察，本阶段不承诺DeepSeek稳定，也未独立验收下一轮SSH功能。本轮初稿时新增ProductManager与商业界面升级仍待具体方案；最新独立设计任务状态见上节，均不是本v1运行功能完成项，Reviewer没有顺带改生产。

macOS Node无子进程模式、结果MAC和API限制仍只证明已列有限拒绝场景，不是任意恶意同进程JS的通用不可篡改保证。后续生产/测试输入改变会使当前候选证据失效。完整产品是否可交付应以PM汇总当前独立Tester结果和未测范围决定。

## 先前独立评审阶段历史（原失败与修复保留）

截至 2026-10-08 11:26 UTC，修复后的当前结构检查通过：50 项中 49 通过、0 失败、1 项 Windows 平台检查在 macOS 未运行。原四个失败均已实测恢复；未知边界版本与匹配 Section 1 的伪扩权仍被拒绝。通过范围是本报告的有限结构/权限/本机边界检查，完整产品与 SSH 真实窗口验收继续由 PM/Tester 完成。输入改变后需当前候选复验。

依据 [客户已确认方案](../../ProjectManager/docs/design/2026-10-08_design_legion-governed-workflow.md)、正式配置 SHA-256 `ddc9cfd12dc62d413a6353c4150e488c3451bb6ac8f2f37550441e993a8ec4fa` 及 [正式任务](../../../scheduling/legion-governed-workflow-v1-independent-review.md)。Reviewer 只改三个旧结构测试、新 `governed-workflow-boundaries.test.mjs`、本角色 feature-map/api-spec/changelog 和本报告；生产、同行测试、治理、旧发行产物只读。已通过 task_ops ack，未执行 coordinator verify。

## 已实测的行为

- 对 34 个核心源码文件与 44 个桌面源码文件检查实际 owner、Model 无外部效果、Service/Provider 三部分、相邻层公开入口、根入口和有限导出。确定性摘要和给定日期校验不读取当前时钟。责任划分结合已确认设计与实际调用路径审阅，文件数量不是安全证明。
- 固定 ProjectManager 无业务写权限，RoleArchitect 只允许治理文档，Acceptance 只允许自身测试/报告。提案调用使用宿主另传 actor；工具参数冒认身份、未知字段、随意 command 被拒绝。PM 审阅准确 ID/版本/摘要和当前组织；重复批准、过期摘要和未批准文档字节被拒绝。后续提案保存已批准成员与 owner。
- 确认、选择、询问校验具体答复。request ID、版本、摘要与当前 context/organization 绑定阻止重放；关弹窗保持 pending，恢复保留请求并明确不向旧 runner 重放响应。旧成员迁移仅观察 ID/归属，仍为 legacy；旧 completed 状态的 checkStatus 保持 not_executed。Model 表达 passed 并不签发权限，实际完成由宿主证据检查保护。
- 公共 CheckService 在宿主未批准时不执行；批准后实际 Node 测试通过，源码依赖改变使证据 stale，实际非零失败不能完成。实际 macOS 检查拒绝候选源码写入、`.ans/private` 内容读取和子进程创建，原源码字节保持。
- Acceptance 引用自身实例与真实失败证据，pass 无当前通过证据被拒绝；问题文件必须对应原开发任务 owner。PM 返修保持原 writeSet/checks/owner，重复请求和确认的两轮上限拒绝，旧失败证据改变后也不能用于返修。实际原角色修复与重新运行检查后可提交 pass。
- 空脚本打印伪 TAP 仍为 no_tests_executed；直接向 fd3 写伪计数仍为 error、testCount=0。该有限回归覆盖已发现的计数伪造路径，不构成任意恶意同进程 JavaScript 的通用防篡改证明。实际 OS 限制来自 macOS seatbelt，Node permission/reporter 是固定模式内补充限制。
- 受控 localhost 经真实 Pi SDK 完成 PM 对话→当前用户执行答复→开发写入与真实自测→独立 Acceptance。上下文改变拒绝晚到写入，stop 同步撤销，close 中的确认不能发布，重复 close 可安全结束。SDK 自报完成但未生成目标不能完成。真实 Electron 窗口验证 sandbox、renderer 无 Node、safeStorage 密钥往返且 DTO 不泄漏、主进程精确 IPC sender/frame/URL 与字段、关闭和重启。

## 原发现与复验结果（保留首次失败）

| 事项 | 预期与实际 | 责任 owner / 文件 | 复现与状态 |
| --- | --- | --- | --- |
| R1 工作区来源观察回归 | 已批准本项目应可读取治理角色与任务来源。实际返回 roles=[]，`.ans/roles/ProjectManager/boundary.yaml` 标 unavailable、workspace_corrupt | DesktopEngineer / `apps/desktop/src/providers/impl/workspace.mjs`，角色边界版本校验处 | 公共 `createWorkspaceProvider({workspaceRoot:项目根}).read()`；Provider 将 v004 固定映射为 legion-desktop-workbench-v2，但本次 boundary.version 已是 legion-governed-workflow-v1。原真实项目与隔离副本两项断言失败。已提交正式 issue `reviewer-workspace-version-regression`。原 owner 授权 helper 修复为已批准版本和语义范围 pin；本机第五/六轮角色观察与副本测试通过，额外实际篡改 unknown revision 和带匹配Markdown行的新增未授权scope均 unavailable，恢复批准文件后 available。Reviewer 未改生产。 |
| R2 当前安装与发行字节未刷新 | 0.7.0 tarball 和 installed 应匹配当前源码。实际 README SHA 为 3dff042c11ffb93f0f983392307d9c9608bc2e5061658fde049f1cddea49918d，源码为 84942eb886558696b85bb0816b88924a44eb7079acd816c600dd900096c1e69f | ProjectManager / `README.md`、0.7.0 打包/安装输出 | 两项全字节检查失败；原记录为当时的未完成发行。PM刷新后0.7.0 TGZ SHA为8997f8ef6f779248600f42144f3d68435d447be07a1226681d887fe12ebb3743；本机第五/六轮TGZ和installed全源码字节核对通过。此结果不把旧失败改写成通过。 |

## 候选和证据

固定命令：

```sh
node --test tests/reviewer/test_structure.mjs apps/desktop/tests/reviewer/desktop-boundaries.test.mjs apps/desktop/tests/reviewer/workbench-boundaries.test.mjs apps/desktop/tests/reviewer/governed-workflow-boundaries.test.mjs
```

本机 macOS、Node v24.14.0，实际安装 Electron 44.6.0；模型服务只用本机受控测试，不发付费模型请求。检查执行 timeout 300 秒。生成效果均在本角色本阶段 fixtures/user-data/tmp/evidence。固定 task_ops 日志由其自身运行路径产生，Reviewer 未手写结果或修改旧日志。

| 运行 | 实际结果 | 精确 task_ops 候选 | 日志 |
| --- | --- | --- | --- |
| 工具沙箱首轮 | 30 pass / 18 fail / 1 skip；localhost EPERM、sandbox_apply EPERM、Electron 未启动均记录为环境阻止 | a744226cf8fe9f2cb1f06f6284667c403031d36a3afb73a97311c2064f2ee8bc | `.ans/runtime/legion-governed-workflow-v1-independent-review/evidence/independent-review-1-structure-8ec24039.log` |
| 本机第三轮 | 44 pass / 4 fail / 1 skip；此前本测试的日期纯度、SDK结果字段、spawnSync错误返回及新版计划准备差异已按实际契约修正 | 3cd9a503d40f4c038eef32b117259349b484b428299320f08a89e5d3298ebca0 | `.ans/runtime/legion-governed-workflow-v1-independent-review/evidence/independent-review-1-structure-f511bd7f.log` |
| 本机第四轮，新增空测试/fd3回归 | 45 pass / 4 fail / 1 skip，exit=1，candidateUnchanged=true；只剩 R1/R2 | 0dfc8eb9219e62024885df7c97ed435c944d8ae575a762b7ec2a4630da3f33e6 | `.ans/runtime/legion-governed-workflow-v1-independent-review/evidence/independent-review-1-structure-58a8e3fd.log`，SHA256 02d03f382a191b48698aad2c00f2b870a1cc7290389bede543242af5a9267fc3 |
| 本机第五轮，复验R1/R2 | 49 pass / 0 fail / 1 skip，exit=0，candidateUnchanged=true | 2e6755b04eabe79b5c573251471577b9195d5531d896a9762a250489879c4dcc | `.ans/runtime/legion-governed-workflow-v1-independent-review/evidence/independent-review-1-structure-c093899f.log`，SHA256 6100f6faa1f1f29c80646f6739b37fc3ee0e0cc742a5d85c968f1acac83ab14d |
| 本机第六轮，增加未知版本/匹配Section1伪扩权负例 | 49 pass / 0 fail / 1 skip，exit=0，candidateUnchanged=true | 5dce686f618cc28f7588236bbb27ca3438bb70cc08b2212da86d1669e2d6c495 | `.ans/runtime/legion-governed-workflow-v1-independent-review/evidence/independent-review-1-structure-641ef704.log`，SHA256 064eb86ac1a1110beb884608c398b9c760afdd64820f981ed9b9f53da8aa6964 |

第四轮运行前另保存 86 个源码/公开入口/package/config/design 输入的具体文件 SHA：`.ans/runtime/legion-governed-workflow-v1/Reviewer/evidence/source-inputs-093640.json`，清单摘要 `c762474a695134d4800e895788db0244acb63b0d968f3dc8c0f54dacf8ae5088`。清单不代表完整 node_modules 依赖树鉴证；当时发行字节不一致的两项明确失败。修复后第六轮通过，另保存当前86项输入清单 `.ans/runtime/legion-governed-workflow-v1/Reviewer/evidence/source-inputs-112954.json`，清单摘要 `e2976a6bc35672167ee84b7c23bfeacd4a4cd9d69a7cee209143946d124bbebe`。最终固定检查前后还需比较该清单，防止未纳入task读集的源变化漏检。

## 尚未验证

Windows ZIP/DPAPI 在本机未测，原 Windows 用例保留平台条件和严格字节断言。完整三协议和真实 SSH 后续变更、组织审批/三类弹窗的最终真实窗口完整流、PM 返修后的全部 Desktop 交付行为由 Tester 与 PM 继续验收。本轮对 Model/Service 进行的三类交互验证不代替最终窗口验证。Node 无子进程模式不代表任意原生构建或任意恶意 JS 均安全可运行。

Kernel/Adapter/Desktop 输入或当前发行字节改变后必须重跑固定 structure，并记录新源码与输入候选。R1/R2 原 issue 与失败日志保留，当前已实测修复。只有最终固定检查通过且源码/安装证据 current 才提交 complete，不执行自 verify；当前源码仍须以任务最新检查和Supervisor核验为准。

## 2026-10-09：及时雨 / Handwell 最终 UI 独立审阅

本章属于 [final-v2 最终任务](../../../scheduling/legion-ui-handwell-final-v2.md) 的 `ui-review`，Reviewer 已通过正式 assignment 的 revision ack。客户批准配置 SHA-256 为 `64f2679ac901bf72bf704e54ef44dc9807d49e21b95606d513697cf6017d9220`，设计输入是 [已确认 ProductDesigner 近黑 v2 与双语品牌](../../ProductDesigner/docs/design/2026-10-08_design_legion-ui.md)。本次 authored writeSet 只有本报告与本角色 changelog；四个结构测试保持只读，生产、同行测试、公开契约、治理和旧证据均未由 Reviewer 修改。上方 v1 的原失败及修复记录继续保留，不把旧成绩换成本轮成绩。

### 当前实现与信任边界

Reviewer 对照实施前 private baseline 阅读最终四个 Interface 文件、两个 owner unit 文件和五份 owner 文档，跟踪既有 DTO、IPC、公开 Pipeline 与组织/交互合同。未发现本轮引入的明确越权、凭据泄露或跨层绕行。判断依据如下，源码审阅和各 producer 的实际执行证据分别列出。

| 审阅内容 | 最终源码与合同判断 |
| --- | --- |
| 原生宿主与 Renderer 权限 | `main.mjs` 相对 UI 实施前仅改变窗口标题与背景色。`nodeIntegration:false`、`contextIsolation:true`、`sandbox:true`、固定 preload、拒绝导航/webview/window.open、精确 sender/mainFrame/documentURL 及原生选择返回后的二次校验保留。HTML CSP 仍只许本地脚本/样式，connect/frame/object/base 关闭，没有 unsafe-inline/unsafe-eval、inline handler 或新网络能力。Renderer 以 textContent 安全呈现公开 DTO，不读取私有目录或授权对象。 |
| 真实项目与成员 | 及时雨 / Handwell、中心 composer、稳定成员和四页签浮层由真实 WorkbenchDTO 驱动。没有复制原型七人名单、SSH 示例、场景选择器或 CANDIDATE。真实客户项目有七名成员不等于演示数据；持续定义与当前 activity 分开。闲置 waiting 在成员中显示等待任务，waiting_answer 显示等待答复，legacy 缺失职责如实标注，PM 全局等待语义保留。成员点击只打开资料；所有真实成员映射调用原 assignProfile，未新增聊天/启动成员能力。 |
| 完整执行确认 | execute_plan 弹窗按当前 planDigest 展示目标、角色与连接版本、全部任务/依赖、每个精确 writeSet 与 owner、明确 transfers、检查参数/测试/输入/输出/网络/限时/日志预算、独立 Acceptance accepts、maxRepairRounds 和公开绑定。关键检查展开；范围不以文件数量摘要替代。answerInteraction 仅发送 projectId/requestId/version/requestDigest/value，权限仍由宿主当前绑定复验签发。普通讨论确认、旧摘要、缺 nonce 不产生执行授权。 |
| 三类请求与输入 | 请求 identity 同时含项目、requestId、version、digest；confirmation 布尔、choice 当前 optionId/许可补充、question 非空且有长度上限。提交中禁重复；关闭/稍后/Esc 走 closeInteraction 保持 pending，轮询不自动开窗。失效请求留错误和答案、禁旧提交，重新查看由用户主动触发；恢复只使用持久问题/真实答案事实，不重放旧 tool/grant。消息只发给 ProjectManager；活动 waiting/执行期间禁普通发送，IME 合成不发送，成功仅清空同一提交文本，失败和发送期间新文本保留。 |
| 记录与真实结果 | 记录页保留完整公开 evidence 的 executed/status/真实测试数/原因/环境/输入 SHA/stdout/stderr/裁剪，历史计划明确标注；自测与 Acceptance 分开。未运行、不支持、零测试、错误、过期不被改称通过。验收问题显示文件/原 owner/期望/实际/复现；返修显示原 scope/checks/轮次和确认上限，讨论入口只填 PM 草稿，不直接派发返修。候选仍区分 pending/approved/returned；来源治理、task_ops、审计及缓存时间不被称为进程在线。 |

### 原焦点问题与当前证据

预审 A 指出真实 DOM 移除已聚焦 summary 后 activeElement 回 BODY，原 `region` 因只检查新的 activeElement 而无法恢复。原 owner 已改为先捕获 originalFocus，保留 same-key disclosure 的 open/scroll；仅当该原节点断开且焦点仍在 BODY/原节点时恢复对应 summary，主动移到其他连接控件的焦点不抢回。原预审 B 指出禁用已聚焦 submit/reject 可能使焦点回 BODY；final-v1 正式 UI 实际出现该失败，不能以先前局部通过覆盖。最终实现捕获 disable 前的 submittedFocus，普通失败只在同请求、弹窗仍开且焦点回 BODY 时恢复有效发起按钮；stale 保持旧提交禁用、指向有效关闭入口，正在编辑的 textarea 不抢回。aria-current 已补齐。

Reviewer 阅读最终实现与严格 owner 回归、独立 Tester 的真实输出。Tester 的 `final-v2/actual-region-focus.json` 记录原节点断开、same ID 替换后 activeTag=SUMMARY；该用例使用生产 Renderer 与实际 Chromium UA、受控 DOM facts，只证明此焦点合同。`final-v2/actual-host-submit-focus.json` 经真实 Electron renderer/preload/IPC/Organization Provider 的隔离组织锁得到 organization_busy，记录答案保留、弹窗仍开、submit 可用、实际 activeTag=BUTTON。原 A 与 final-v1 正式 B 失败日志/JSON/截图仍保留，Reviewer 未修改这些断言或证据。

当前 owner 的 Model26/26、unit139/139 均 0 fail/skip，冻结候选为 `8cce08983e2d153f2ae1cb1b3db6a698722dc5dfe8ff58e7e53fbb68ada6ede1`，两项 candidateUnchanged=true。它们是 DesktopEngineer 的开发证据，Reviewer 未冒称自己重跑。独立 Tester 正式两个 gate 已由 Supervisor verified，candidate 同为 `6aafe99a470f44b88a77c9beba11d00609cf116bc2fd38ef59311e6ed6ecf26f` 且 unchanged：integration31/31，0 fail/cancel/skip；UI 四项实际通过、0 fail/cancel、一项 Windows 平台未运行。UI 包含三项实际宿主/工作流用例和一项限定实际 UA 合同，不把 DOM facts 用例称为宿主端到端。

Reviewer 已读取原样正式日志：`ui-verification-1-integration-cd7603c9.log`（SHA `0d2aaaed434f0307df190fc93e7a086b448b930b179571bf3abd154bdf00a3b7`）与 `ui-verification-1-ui-34915569.log`（SHA `5a5abf2545fe65c1f74fc3e9a9954974c2ec67da6ffb6373df8ae805ccb6b731`）。新 JSON/截图位于 `.ans/runtime/legion-governed-workflow-v1/Tester/evidence/handwell-ui-20261009/final-v2/`。真实完整 UI 覆盖独立自测通过→Acceptance 实际失败→原 owner 同范围返修与重新检查、三类请求/关闭/重启/取消失效、全成员映射失效旧计划、完整许可清单与小窗口 footer、页签/草稿/历史/IME 接收边界/深浅主题/减少动画以及 Mac read/SHA/转交；详见 [Tester 当前报告](../../Tester/docs/verification-governed-workflow-v1.md#final-v2真实宿主失败焦点与成员闲置状态复验)。Reviewer 审阅这些证据，不重复宣称独立 Tester 的 GUI 操作由自己执行。

### Reviewer 固定结构 gate 与适用范围

两份 Reviewer 文档在固定 gate 前冻结。唯一 approved structure argv 与原四个测试不变：

```sh
node --test tests/reviewer/test_structure.mjs apps/desktop/tests/reviewer/desktop-boundaries.test.mjs apps/desktop/tests/reviewer/workbench-boundaries.test.mjs apps/desktop/tests/reviewer/governed-workflow-boundaries.test.mjs
```

本轮正式 `structure` 的实际计数、candidate、candidateUnchanged、日志路径/SHA和可能的环境失败，以 [final-v2 任务](../../../scheduling/legion-ui-handwell-final-v2.md) 最新 ui-review CheckEvidence 与 completion 记录为准；未通过或输入改变时不能提交 complete。固定检查实际包含五层/owner/权限、nonce与取消、真实 Node 隔离拒绝、真实 Electron/safeStorage、当前0.7.0包及 installed 字节，不能把它称为仅静态检查。工具沙箱若阻止 localhost/seatbelt/Electron，保留该次日志，在同一 approved 命令和隔离目录下使用实际宿主环境复验，不放宽 argv、超时、权限断言或 skip。

范围限于当前 macOS arm64、已安装 Node/Electron/runtime 及所列输入场景。Windows ZIP/DPAPI 未运行；本轮没有发布新 GUI 包、没有验证外部模型稳定性，也不把 Supervisor 的真实 SSH 七成员查看或本机 controlled localhost 结果冒称客户项目功能验收。减少动画与真实窗口布局来自独立 Tester 当前证据；Node 有限反伪造检查仍不构成任意恶意同进程 JavaScript 的通用安全证明。后续源、测试、契约或依赖变化会使相关证据失效。

### final-v3：保留原结构失败，恢复导航合同后最终复验

上一轮 final-v2 Reviewer 原样 `structure` 首次在工具沙箱实际 38 pass、11 fail、1 Windows 未运行；localhost listen EPERM、seatbelt sandbox_apply EPERM 与 Electron 启动受限的日志 `ui-review-1-structure-f5d55ea4.log`（SHA `496271f2e35c3376a52ba560ce8a3788df48f39d1191e3ae8de3df667b8fce52`）保留。相同命令在本机复验实际 48 pass、1 fail、1 Windows 未运行；候选 `a0528d3b2fed5b241adbdab95c4301be66fe5043e234a2b62e56e2125d67ac78` unchanged，日志 `ui-review-1-structure-e0027c35.log`（SHA `9dac1c1d9f92719c3cf90c405f6142bb98e66ceb0aa70e9b51b7f7b525341362`）保留。唯一原生 helper 失败只返回有限错误；源码存在明确冲突：旧严格检查要求两个 `[data-page]` 导航，而欢迎设置 CTA 增加了第三个同名标记。Reviewer 已正式 issue/stop，未修改只读检查或把本轮记为 complete。

原 Desktop owner 在同配置内移除 `welcome-settings` 的 data-page，并用既有 ID 的单独点击事件调用原 navigate(settings)。两个页面导航、aria-current、欢迎入口的视觉/可见条件/实际操作保持；A/B焦点、闲置状态、main/CSP/IPC/nonce/权限没有改变。Reviewer 已核对最终 HTML 只含对话和 AI 连接两个导航标记、CTA 仍有真实 handler；不以删入口或修改断言消除失败。当前 owner Model26/26、unit140/140 均0 fail/skip，候选 `5595c7071a496f2ebbb41d3c2bdcda405a966d23d3e4e066f985c0f7815e3c34` unchanged。

独立 Tester 已在 [final-v3](../../../scheduling/legion-ui-handwell-final-v3.md) 用一次原样 integration 与一次原样 UI 刷新证据并由 Supervisor verified：31/31 integration，0 fail/cancel/skip；UI4 pass、0 fail/cancel、1 Windows 未运行，二者同候选 `9377a84484dcd5e85008bd14077cffba7620f37e08f5664d534553c5d8d6da14` unchanged。Reviewer 读取并核对正式日志摘要：`ui-verification-1-integration-48856c7b.log` SHA `a8abca4932c49b36eef426bfbdd513b7c96f6a5153bcecd79c90c6f09e4d5aee`，`ui-verification-1-ui-2f59b6d1.log` SHA `01301d056374028488aef5822519084153edbc5e028b833ea8f104f54496d2d8`。final-v3 新 JSON 再次实际观察 A 的 SUMMARY 与 B 的 BUTTON、保留答案/弹窗/可用提交；完整原严格 UI 已加入欢迎 CTA 进入 settings 与两导航标记验证。三项真实宿主场景和一项受控 DOM facts 的实际 UA 合同仍分别记录，不把后者称为端到端。

Reviewer final-v3 新 assignment 已 ack，角色边界与两份 authored 文档范围不变。本小节和 changelog 冻结后，直接在已授权本机环境运行上列完全相同的 fixed structure；已确证的工具沙箱 EPERM 不再重复制造。当前 Reviewer 自己的最终实际计数/candidate/log/SHA/unchanged，只以 [final-v3 ui-review 最新 CheckEvidence 与 completion](../../../scheduling/legion-ui-handwell-final-v3.md) 为准，并由 Supervisor verify。没有通过或候选变化就不 complete；不修改断言、skip、argv 或 timeout。

本次最小兼容修复没有引入新的信任边界疑点；此前源码审阅判断与 macOS 有限覆盖继续适用。Windows ZIP/DPAPI、外部模型稳定性、客户 SSH 功能验收与 GUI 发布仍不在本 Reviewer 通过范围内。final-v1/final-v2 的 A/B和结构失败均为历史事实保留，当前 fresh 证据不覆盖旧日志。

## 2026-10-09：Markdown 与导航焦点纠错独立审阅

客户指出真实界面未渲染 Markdown、点击项目出现滚动条、成员 Esc 返回后的焦点样式刺眼，本轮按 [原 owner 的现有设计记录](../../DesktopEngineer/docs/design/2026-10-08_design_governed-workbench.md#模型回复按-markdown-格式阅读)及 [精确任务](../../../scheduling/legion-ui-markdown-and-focus-v1.md)修复。Reviewer 新 assignment 已正式 ack，仍仅可修改本报告和 changelog；已批准配置仍为 `64f2679ac901bf72bf704e54ef44dc9807d49e21b95606d513697cf6017d9220`。生产、只读结构测试/断言、角色边界、包/lock及旧证据均未由 Reviewer 修改。上方 final-v1/v2/v3 的真实失败与成绩保留，不用于代替当前输入的验证。

### 源码与实际公开边界

Reviewer 已只读核对最终 index/renderer/styles/main、owner 测试及实际 API/设计。Markdown 是 Interface 展示适配：生产 HTML 先加载已锁定 production transitive Marked18.0.11 本地 UMD module，再加载 renderer；现 package/lock 与 production 依赖链包含该库，Forge 的现行 prune/目录布局可保留它。本轮 readSet 包含实际 UMD、ESM、包描述及 desktop lock，不引入 CDN、vendor 源修改、Node 权限或新业务层能力。HTML 本地显示资源不绕行 Pipeline/Service；Renderer 仍不相对导入 node_modules 或同行实现。静态依赖/路径核对和实际本机离线加载不是新 Windows ZIP 的发行证明。

Lexer 只产生 tokens，不调用 HTML Parser；界面用固定 tag/有限属性和 textContent 构造标题、强调、列表、引用、代码、表格及安全链接。raw HTML/未知语法显示文字，图片只 alt 与普通链接、不创建 img，不因解析发送 HTTP 或打开 URL。两侧 URL 校验只接受绝对 HTTP(S)，拒绝其他 scheme、凭据、反斜线、原始及编码控制字符和异常 URL。未闭合 legion-plan 从可见文本剔除，实际完整原文仍按需只读；用户消息保持 literal。相同消息正文未变不重复解析，持久时间线和 raw 不被修改；缺 Lexer 或超显示字符/节点/深度预算时保留完整纯文本并给出就地说明。

主进程新增的外链处理仅属于 GUI 传输边界，WB_OPERATIONS、preload/IPC、计划授权、取消和原持久合同不变；本轮 main 已包含此显式链接处理，不能继续沿用旧 UI 阶段“只改 title/background”的差异描述。处理器绑定本窗口、精确 documentUrl/mainFrame；实际左键 down/up 分别用固定只读 DOM hit-test 核对相同 href/target，或由非合成、非重复 Enter 读取当前 anchor。每个新窗口请求一次消费该精确激活；错误来源/URL/target、postBody、无激活程序调用和关闭后的绑定拒绝，handler 始终 action:deny。异步结果仍重查窗口/文档存活，仅匹配原目标才请求系统浏览器。Enter keyUp 后的只读 renderer 队列 roundtrip 撤销未消费绑定，兼容真实晚到 popup；不用任意最近点击或时间窗放行。关闭先撤销外链绑定再同步撤销 Pipeline，移除输入监听；外页导航/webview/新 Electron 窗口继续拒绝，CSP 与 renderer 无 Node 保持。读取或系统打开失败只显示有限安全文字，不披露原异常，原文网址可复制。

导航修复仅对 project/member/nav 设置1px内侧可见 focus ring 与静态按压；合法多项目/长名称纵向滚动保持。关闭详情清除 selectedMember、更新已有 role-card 选态并恢复原触发焦点，没有全局 blur/移除 keyboard focus。两处 data-page、aria-current、稳定成员/输入节点、A/B 焦点保护、Human nonce/pending及旧完整验收/返修语义保留。所读源码未发现本轮明确新增越权、HTML 注入、自动外部资源加载或原结构合同冲突。

### 当前独立证据与适用范围

DesktopEngineer 最终候选 `cef4d28394c1f61851e422fac93328a3345bfa82c020073bf06b6e357d49c578` 的正式 Model26/26、unit151/151 均0 fail/skip且 unchanged；这是原 owner 的执行证据，Reviewer未冒称重跑。Tester 五文件冻结后的原样 integration/UI 各正式一次，Supervisor 已 verified：integration31/31、0 fail/cancel/skip；UI5 pass、0 fail/cancel、1 Windows未运行，同候选 `da99a24e710d2bbbf657da9a05e4f235c29316c3a3552caf9c089761851820ef` unchanged。Reviewer 读取并核对正式日志 SHA：`ui-verification-1-integration-7a757946.log` 为 `2f29cea56a545893ba5d88ffaf7cb7f5324ab74bf047992db2c1fd4064393384`，`ui-verification-1-ui-e9629376.log` 为 `4ff955b9a6a355bef00f9e28165899c815795aec003b532a59e1b633e4ebe95e`。

新证据仅在 `.ans/runtime/legion-governed-workflow-v1/Tester/evidence/handwell-ui-20261009/markdown-focus-v1/`。Reviewer 读取 `markdown-proof.json`：rendererHTTP requests=[]、unsafeExecuted=false、streamNodePreserved=true；单项目实际 scrollWidth/clientWidth 均166、scrollHeight/clientHeight 均33；缺 Lexer 返回完整 literal fallback 和明确说明。生产本机 Electron/真实 SDK/IPC/DOM 覆盖 rich Markdown、Human literal、完整 raw/流式 fence、unsafe HTML/URL/image、真实 mouse/native Enter 精确链接与已消费/程序/错误 href 拒绝、失败安全提示、项目按压/焦点几何、member Esc 内环/选态清除，以及9个长目录的合法滚动。完整旧 host流程、A/B、映射/nonce/独立失败→原 owner返修与复验、Mac read/SHA转交仍由同一当前 gate 覆盖，详见 [Tester 当前报告](../../Tester/docs/verification-governed-workflow-v1.md#2026-10-09markdown--导航焦点纠错当前门)。

系统浏览器 opener 和失败 messageBox 使用明示的受控 spy；准确目标和拒绝行为有实际原生窗口输入证据，但不宣称已启动真实 OS 浏览器或访问外网。缺 Lexer 的单独分支属于有限 DOM 合同；真实 local UMD 顺序另由生产 app 观察，二者不混称。旧 CDP Enter 夹具误配与真正原生 keyUp 晚到问题的失败/诊断留存，不把 CDP 事件冒充 main before-input-event。Reviewer未自行执行上述 Tester GUI 操作，也不把 Supervisor 的真实 SSH 七成员视觉查看当客户项目功能验收。

两份 Reviewer 文档在本轮 fixed structure 前冻结。仍使用上列原四个只读测试、原 argv/timeout/skip条件，直接在已授权本机环境实际运行；工具沙箱已确证的 EPERM 不重复制造。Reviewer自己的最终实际计数、候选、unchanged、日志/SHA以 [本任务 ui-review 最新 CheckEvidence 与 completion](../../../scheduling/legion-ui-markdown-and-focus-v1.md)为准，只有通过且输入仍当前才 complete，由Supervisor最终verify。结论限本机macOS与实际有限场景，不扩大 CommonMark 全语法保证、外部网络、WindowsZIP/DPAPI或新GUI发行范围。

## 2026-10-09：角色持续上下文、五页签与来源的当前独立审阅

正式 [本轮任务](../../../scheduling/legion-persistent-role-context-and-dialogue-v1.md) 的 `role-context-review` 已派发并 ack。Reviewer 固定身份、Section 1 与各层/evidence 规则重新加载；本次 authored 范围仍仅本报告和 changelog，生产、测试/断言、治理、包/lock及历史证据只读。客户批准配置 SHA `ddc9cfd12dc62d413a6353c4150e488c3451bb6ac8f2f37550441e993a8ec4fa` 未改变。[PM 文档末尾逐字保存的已确认具体规范](../../ProjectManager/docs/design/2026-10-08_design_legion-governed-workflow.md#2026-10-09-已确认集成追加角色持续上下文与成员对话-v1)是本轮冻结 requirement；原 canonical 继续决定相邻层、精确授权、自测/独立验收和返修基础，不能用原基础设计代替本轮记忆规范。

### 必要源审及已纠正问题

Reviewer 沿 Model→公共 Service→公共 Provider 与唯一 Workbench Pipeline→Interface 阅读实际接线，并复核早期反馈后的最终源码/对应断言。当前未发现已确认机制内的明确新增权限、来源混入或结构阻断。

| 本轮合同 | 最终源码与证据判断 |
| --- | --- |
| 角色与项目隔离 | roleMemories 的项目身份、角色 ID、修订、sourceDigest 与 covered sourceId/sourceDigest 均校验；Service 重读实际本项目来源及 CAS，不能用另一项目或角色记录保存。PM timeline/讨论答案与同角色 member journal 是不同来源；host_briefing 只含真实已发送的安全任务输入，不含读取正文、credentials、SDK授权或隐藏推理，也不被标为助手发言。 |
| 纯文本延续与当前权限 | checkpoint 只有有限 plain user/assistant 文字，并绑定当前实际实例/profile/version。新 fresh single_run 只允许首次运行前一次恢复；旧实例、重复/运行中/结束/取消后恢复和旧工具响应拒绝。execute_plan yes 不进入讨论来源；历史工具/测试成功文字只是历史数据，不签发 grant/check authority，当前实际自测/Acceptance仍重查输入 SHA、身份、作用域和 live signal。 |
| 当前确定事实 | 每轮 prompt 原样包含 canonical role name/purpose/interfaces/boundary/revision/digest、当前任务、owner/checks及依赖；摘要明确为模型生成的历史，不能改写这些 host facts。最新 Human 和本角色尚未听到的新需求/讨论答案被保护；active 及 PM 已 completed 的新18k需求配旧45k角色日志，仍向实际角色逐字交付，不被16k recent目标摘要掉。选择答案同时带原问题类型/题目/选项与实际 value，a/b/true 不成为无含义短词。 |
| 合并预算与摘要 | 早报的固定16k retained未预留当前输入问题已修：先计完整 prompt/pins、摘要标签、JSON/分隔开销与必要未听 Human，再选完整可携带的历史。硬65536、软49152/96、最近16k/64目标、摘要8192、恢复128与项目记忆2MiB保持；不能截当前输入，仍超硬限时明确拒绝。摘要使用该角色同一实际 profile，fresh tool-less/read-less/write-less/check-less 会话只请求一次，2048输出/30秒，不自动重试。未知模型窗口/费用保持未知；估算不称真实 token 或报价。 |
| 成功、失败与存储 | 摘要 completed、非空、合法文本/长度且来源水位/expectedRevision仍一致，才 CAS 保存；失败、length、tool、取消与冲突不虚报新覆盖。旧记忆可容纳时安全 notice 后继续，否则暂停新调用；完整当前 Human 与原始 archive 保留，失败/取消收束当前 turn，SDK资源关闭。旧数据先排除不存在的新字段验证原 raw digest，再补默认值；Provider CAS仍期待实际 raw.digest。 |
| 取消提交门 | 早报的 Service检查后 Provider多 await 窗口已由另行授权的三文件补充修复：原 AbortSignal 经公共 Service透传 Provider.write，在根路径复验后、rename发起前同步重查。之前取消不替换旧target、清本次temp/lock；rename发起是明确提交线性化，之后取消返回真实已提交document，不能谎称回滚。原锁、CAS与路径保护保留。 |
| 公开投影与界面 | 早报 roleMemory/notice被Wire丢失已修：governedDTO提供有限统计，Wire验证公开字段，notice只允许固定code并重建安全文案，summary/source/checkpoint不出renderer。五页签为任务、文件、成员、对话、记录；sidebar→成员，实际working入口→对话，两页共享角色/run选择，保持节点/草稿/阅读位置/Esc/IME。三固定ID持续为系统角色，真实批准其他成员为项目角色，legacy未知来源如实显示。长名称布局与隐藏成员bar仅视觉改变，合法wheel/Tab滚动保持。CSP、原IPC、owner及检查权限不变。 |

### 当前 producer 与独立真实门

Adapter 当前 fresh首次恢复/严格绑定/length失败的75项是其开发证据；PM的新 runtime0.7.0 tarball SHA `f45fa15e8c0f195930c35c782904690ce7073680df1e4ec0d0ea6e80215bbad7` 已实际安装并由其6项 package检查覆盖 Node/Electron接线。Desktop主角色记忆候选 `7c98cc83cc1fafd614123177caf188579f17f43a66b579a024a8d9f0a3198942` 的 Model33/unit191，以及其后长名称CSS和用户明确隐藏成员滚动条的各自191项unit，分别记录当时真实输入。Provider三文件取消提交门亦属独立补充阶段。后续源变化使旧候选成为历史；Reviewer没有把这些分阶段成绩伪称当前全部输入同一候选，也未冒称自己重跑 owner 门。

Supervisor 当前已 verified 的独立 Tester 两个原固定门使用同候选 `6d48eec6770f800d570b1df1a80376814ad08c86ebfd28587a36d3327813c447` 且 candidateUnchanged=true：integration34/34、0 fail/cancel/skip；UI实际macOS6/6、0 fail/cancel、一项 Windows未执行。Reviewer读取实际日志并核对摘要：`independent-role-context-verification-1-integration-90c5bc8a.log` SHA `c4187086d22e7ccce1f746b0db41b97be1391197c1f20bca84f7337150d4aa87`；`independent-role-context-verification-1-ui-ab73e203.log` SHA `60a4c029b673710e32259d7bde3883c4b7cfe2cb22c45e5fdf0f1a5946406a39`。它们覆盖当前源码、实际安装依赖、最后CSS和已授权旧helper修复；新观察/截图仅在 `.ans/runtime/legion-governed-workflow-v1/Tester/evidence/role-context-20261009/`，此前 `formal-c84cc6ed/` 不覆盖。

实际覆盖包含四类角色跨任务/原owner返修/重启与项目隔离、真实纯文本首次恢复及旧实例拒绝、真实Host一次摘要/30秒超时/认证/length/超长/tool/取消/来源CAS、18k新Human完整保留、选择语义/水位去重/原archive逐条不变、完整当前purpose与权限、自测和独立失败→返修→复验、旧digest迁移及实际磁盘取消提交、五页签/来源/长名称/隐藏bar仍可wheel和Tab、旧Markdown/弹窗/映射/IME/A/B/读取及编辑SHA/转交。GUI证据由独立 Tester实际生产 Electron/renderer/preload/IPC取得；native packets证明Electron事件处理，不冒称OS物理输入。限定DOM/OS opener spy范围仍单独注明。详情见 [Tester当前报告](../../Tester/docs/verification-governed-workflow-v1.md#2026-10-09完整角色持续记忆与成员对话)。

旧正式失败全部保留：主 `34a292ec` 的旧6条期待与新第7条cancelled Human合同冲突；补充 `b91b5451` 的数组fixture误用；`ee464811` 的HTTP回调准备catalog并发；`cca46f06` 的rival直接SDK入口漏准备。授权原Tester仅修其helper，补齐SDK启动前实际准备及逐字/唯一/顺序/跨项目隔离断言，没有弱化旧deny/owner/取消/权限断言。最新helper SHA `a39f607c952f37904f0468ef7057c554495591e076b2e70b812c670fe36118c1`已纳入当前 fresh gate；旧失败或首次UI通过不替代当前证据。

两份 Reviewer 文档冻结后，使用本报告上列同一原 `structure` argv、timeout与四个只读测试运行当前正式 gate。Reviewer自己的实际计数/candidate/unchanged/log/SHA只以 [本轮 role-context-review 最新 CheckEvidence与completion](../../../scheduling/legion-persistent-role-context-and-dialogue-v1.md) 为准；测试失败或输入变化不能 complete，最终由Supervisor verify。结论仍限本机macOS与所列有限场景：WindowsZIP/DPAPI未执行，外部模型、真实SSH业务开发及新GUI发行不计入本次完成。Root普通窗口的无bar观察不能代替尚未执行的SSH全流程。

### 首次结构失败与已核验的最小检查合同补充

主 Reviewer attempt1 原样 structure 实际50项：46 pass、3 fail、1 Windows未执行，exit1且candidateUnchanged=true；候选 `7ddcd7aade2e49b0e4fbb653faf85d399f98b886dc100f1d147a42daa01c89fb`，原日志 `role-context-review-1-structure-cc6d7754.log`（SHA `704fe75093218673e6d9b76143e48daa47a37f153137c163d4480da19b604f72`）保留。失败分别是 desktop-boundaries 硬编码旧TGZ路径、workbench-boundaries 取消后期待空Human历史、test_structure 仍用保留的旧TGZ比较新Adapter源码。这些旧检查与已确认的新实际安装/保留Human合同冲突；Reviewer正式issue并stop，未以改生产回退、删Human或覆盖旧TGZ取得通过。

随后 [三文件补充任务](../../../scheduling/legion-role-context-review-contracts-v1.md) 仅授权原Reviewer更新三个既有检查。新发行路径明确绑定 `role-context-20261009/legion-runtime-0.7.0.tgz`、精确f45fa15e…SHA、真实SHA512 integrity、39文件白名单、37份声明源码SHA及source/installed逐字节；原公开exports/禁止内部开发内容断言保留。原取消用例用实际SSE产生partial后取消，严格检查完整Human原文唯一、原archive保留partial；SDK续轮只恢复Human纯文本，不恢复partial/tool/permit/authority，确认仍拒绝、业务目录零写。原50个case名称/其他否定与scope断言、argv/timeout/平台skip保持，没有新增case。

补充三文件冻结后的同原structure实际50项49 pass、0 fail/cancel、1 Windows未执行，exit0、candidateUnchanged=true；候选 `5740558a81fa80db45b9dea75ba646bf7c31c1c27d2ad88bad8a8e56d14d5269`，日志 `current-package-and-cancel-contracts-1-structure-fcf99cc6.log` SHA `ee6bf42244e08892cffc2cb5d48eff8e4ebcd44d30ba9c503abfe9158d98eaed`，实际4.117秒。Supervisor已verified此补充；它不代替主任务当前最终门。主 Reviewer attempt2 已按精确retryReason重新派发并ack，仅这两份文档可写，源码/三个补充检查只读。文档冻结后主原structure只运行一次，最终当前candidate/结果/日志以主task最新attempt2 CheckEvidence和completion为准，Supervisor最后verify。所有原失败与旧产物留存，范围仍为已列macOS有限验证，Windows/外部模型/SSH业务完成不混入声明。

## 2026-10-09：依赖交接正文超预算的必要修复审阅

Root 在普通 SSH 开发流程观察到 Core 实际写入9文件、90787字节并运行28项自测通过；后续 Renderer 尚未调用 SDK 就收到 prompt_budget。原因是 Pipeline 自动把所有依赖成功 write 的完整正文保存到 outputs，再 JSON 注入后继固定 prompt，超过原65536硬限。这是已确认真实任务交接的缺陷；Core文件与自测记录保留，不能据此说整个SSH程序或Renderer已完成。上述客户流程是Root的观察，Reviewer未重跑客户测试、未读取或修改九文件正文。本次 [Owner七文件修复](../../../scheduling/legion-bounded-dependency-handoff-v1.md) 不改客户源码、权限或预算。

Reviewer在WIP阶段指出的两个具体问题已按完整链复核修正。成功完整write只在临时候选带该次proposal.content，立即由纯Model计算实际UTF8 SHA256，返回并保存resource/taskId/roleId/action/contentDigest/proposalDigest六字段；local/active outputs和receiver prompt均不带正文。edit只接受实际成功result的最终SHA，未知保持null；proposalDigest/replacement摘要或旧write SHA不会冒称编辑后文件摘要。同parent内部按实际成功变更覆写resource Map，跨parent从active.outputs真实完成插入序筛选requested dependencies后再聚合latest，不能用dependsOn声明/排序顺序推测文件版本。后继用既有ordinaryread工具读取当前磁盘内容， metadata仅为历史成功变更提示，不是许可、当前自测或验收通过证据。

本次没有增加层间调用或能力：Model纯投影，Pipeline仍调用公共Services，原read/writeSet/owner/nonce/取消/检查证据规则保持；完整当前Human、canonical facts、所选上下文与原archive不截断。普通缺失/failed父任务继续阻塞后继；Acceptance既有失败证据检查路径保持真实语义。去除的是未经Human选择而自动拼入的依赖正文；metadata或必要输入本身仍超硬限时明确拒绝，不能扩大65k或依赖旧grant继续。

Owner最终同候选 `c58fe890a5ee98a3e6f6fe95243797afeef3c13c6e64302ec30ec88e325f4de8` 的固定Model33/unit193均通过且unchanged，Supervisor已verified。新实际localhost SDK用例覆盖producer三owned文件总量超过78k、重复write/真实selfcheck失败→read+edit最终SHA→child初始prompt仅metadata且Human/canonical完整→child自主read实际全文/SHA、仅自身scope写入、自测与独立Acceptance。聚焦诊断1/1与有限12阶段trace保留；原 `1510e5ca` / `0663aea9` 两次fixture接口/重复toolCallId循环造成的OOM失败也保留。修复fixture使用actual text/sha256/expectedSha256与唯一call ID，错误回复及时终止，fixture24请求上限不改变生产堆、超时/预算或原191断言。Reviewer没有把早期失败改写为无失败的首次成功，也未冒称自己重跑Owner193项。

独立Tester本轮仅刷新说明、冻结既有source/tests后运行原integration/UI，Supervisor已verified：同候选 `20ec7a202bc0bbb701acc8082fbc223defe44516d5b3c7b7cc95b8cf10c0b26b` unchanged，integration34/34、0fail/cancel/skip；MacUI6/6、0fail/cancel、1Windows未执行。Reviewer读取并核对当前日志SHA：`current-handoff-caller-verification-1-integration-788342af.log` 为 `de288fac3d44fc9325eaf3d8437dfb7edcb90ad72ca320bb05a9ecde6fcb8229`，`current-handoff-caller-verification-1-ui-bdcb64af.log` 为 `d842aa8eb5f19a2ac0fb07ecd675306b8e9beaac4349fac6d9e8a3d76193cd23`。现有完整权限/上下文/真实检查/返修/角色记忆/五页签及实际Mac窗口回归因此具备当前证据，不沿用修复前旧候选。

正式 [本轮Reviewer任务](../../../scheduling/legion-bounded-dependency-review-v1.md) 已ack，只有两份既有文档可写；生产、测试、旧TGZ与失败日志只读。必要前置源审未发现这条交接链的剩余明确阻断；本章与changelog冻结后只运行一次原fixed structure，三份已授权更新的新tarball/取消Human检查合同继续适用，不再改断言。Reviewer自己的当前candidate/count/log/SHA/unchanged以本任务CheckEvidence和completion为准，Supervisor最终verify。Windows、外部真实模型、客户剩余SSH任务和新GUI发行未包含在Reviewer通过声明中；后续Root须让PM对当前剩余任务产生fresh Human确认，不能重用旧grant。


## 2026-10-12 项目指挥台 v0.3 当前独立结构审查

合法reviewer-current-structure派发，仅已接受65配置中的10Reviewer文件。当前Node runtime1.2.0 tar SHA b13e830a94ee5f07a2e256c0591302a99236ce10da220604d97032127b952c82，Desktop0.3.0；旧包/GUI/观察器记录仅历史。fixture迁当前tar/manifest/lock/安装字节与本阶段fresh生成根；只读旧Shell-workflow固定harness按Governance精确解释仅原范围fresh随机子目录，检查前no-follow、无旧证据/包覆盖，不改未派发源文件。

当前结构门待实际执行，暂不声明通过。审查目标为七有限公共读取/IPC允许字段、getState/wire/DOM无raw成员文本/briefing/private摘要/Shell reviewText/key、Su执行中读取不撤任务许可、源绑定文件/产物/Mutation/Check/Acceptance/任务阻塞/分页日志、真实macOS Electron当前三工作区/沙箱/API/凭据安全与包身份。原owner/lease/CAS/取消续轮/PM两问/Shell强门保持。GUI完整视觉/操作验收由独立Tester当前门验证，本角色窗口结构证明不冒充该流程；Windows ZIP/DPAPI在macOS unsupported，旧Windows用例保留不计当前支持。

整仓库旧治理observer受boundary metadata pin仍unavailable，使用合法隔离v004 fixture验证读者来源/拒篡改/旧任务字节，未改变真实治理metadata。未知共享marker保持原样，不猜删。最终候选、structure argv/日志/SHA与实际结论只取本task最新证据，旧历史通过不作本次验收。


## 2026-10-12 UI-repair 当前候选

Human接受66配置85c6197…并合法派发当前reviewer-current-structure，仅原10文件。新runtime1.2.1/Desktop0.3.1，tar desktop-command-center-ui-repair-v1-fe4e7524cf78/legion-runtime-1.2.1.tgz SHA9dfdd564d67e3ae46d7a2abeb075d26fa25a1768b9e46bbba0948d7171ab1b6e；旧65首structure74/78/71a41a10保留，只作历史失败证据。本轮迁四项旧fixture而不弱化：当前60源文件、真实observer成功返回含metadata unavailable、隔离历史pin只用原accepted YAML段+精确Markdown、私有成员journal只在Reviewer-owned fixture核验不要求公开DTO回泄。宏观GUI操作/截图验收仍归Tester；本角色实际macOS窗口结构不冒充完整视觉通过。当前固定structure尚待执行，结果仅按本图最新同候选证据。


## 2026-10-12 Su-label 当前1.2.2结构候选

合法reviewer-current-122-1，仅原R10文件。runtime1.2.2/Desktop0.3.2，fresh tar desktop-command-center-su-label-repair-v1-9850a3707d523eba/legion-runtime-1.2.2.tgz，SHA773da2d1dbb58b7a9ff251e14f1cf80281a8b9286348d7a864589dd92832eef2。保留旧65的74/78与旧UI图77/80/897ce8ea证据，不作当前通过。两项observer fixture根因已定位：Supervisor YAML旧tuple之后直接追加嵌套调度metadata，没有空行，原首空行切割失败；本角色隔离fixture改按旧9允许顶层key截基础tuple，六业务角色既有canonical YAML/scope pins不变，真实仓库metadata unavailable不变。available、未知版本/匹配Markdown伪scope拒绝、真实任务记录/镜像/遍历及缓存时间强断言保留。

当前七查询实际IPC/authority字段拒绝/私有response拒绝、真实文件/Mutation/Check/Acceptance来源、执行中Su查询后记忆/问答/委托execution_busy不撤plan/owner/run、sameSu取消续轮、私有channel/History、当前包/lock/安装字节、真实macOS三工作区/900导航连接主题、安全存钥与沙箱均在固定七入口。成员raw/briefing/summary/Shell review/key不能回公共getState/wire/DOM；Private journal核验只读Reviewer own fixture。Source/Shell/lease/CAS/marker强门保持；只读Shell旧fresh随机fixture按Governance裁定，不覆写稳定输出。文档/fixture定稿冻结后，当前通过与candidate/log/SHA仅以本图最新structure证据和完成报告为准。

本角色窗口结构证明不替代Tester完整GUI/视觉门；Windows ZIP/DPAPI仍在macOS unsupported，历史档案验证不算Windows通过。未知共享marker不删，旧observer治理pin限制不修，未改生产或T文件、不自verify/派发。


本图首structure7124a8bd为79/80，observer可用性/拒伪scope已过。唯一旧fixture私有run期待cancelled，实际Host cancelTurn明确记录公共cancelled后捕获未finalize日志为interrupted，terminal.reason=run_cancelled；本角色按该真实分支精确核值，并保持同Su HTTP2/续轮completed/零partial强断，未使用宽匹配或修改产品。失败日志保留，最终当前同候选门必须重验。


取消私有日志的第二次固定样本b241f8fc仍79/80，显示drain先finalize时私有cancelled、Host捕获时私有interrupted二条合法路径。经固定Supervisor许可，本R fixture仅在第一su_customer真实beginMemberRun持久化后有界等待实际cancel signal，再交还真实响应，确定性覆盖Host捕获路径；严格断interrupted/run_cancelled，不宽匹配终态。SDK、HTTP2、同instance、原日志写、公共cancelled/后续completed与零partial全保持真实；未修改产品或增加授权。所有旧失败日志保留，当前最终门待窗口。


## 当前结构验收结果：runtime1.2.2 / Desktop0.3.2

固定七入口structure本轮实际80/80通过，零fail/cancel/skip/todo、非超时、candidateUnchanged。源码/fixture候选69811baba56b73ad6593d65bfd69149151dd4dfbf2782f7969ff527f11673a3c，日志reviewer-current-122-1-structure-f5e18085.log，SHA37af8e5a2839ffc8e7d76c58f7789e52de1745dbf875445a78f7fd8c296eb876。本段/历史状态关闭后须再跑同文档候选最终structure，最终candidate与日志只取当前Su-label图最新checkEvidence及完成报告；本段不冒称旧证据仍覆盖编辑后字节。

已实际闭合：当前102文件/99源码tar、精确version/exports、Desktop lock/integrity/已安装源字节；60桌面来源的精确owner/相邻层与纯Model；七公共查询输入白名单和私有响应拒绝、真实文件/Mutation/Check/Acceptance来源；Su执行中实际只读查询及变更工具拒绝且plan/owner/run不撤权；真实SDK取消后同instance HTTP2完成且partial不进可续历史/记忆；PM两问来源/旧答复拒绝、旧History字节、channel/owner/lease/CAS/marker/commit/Shell强门。隔离observer基础tuple/七角色/current真实任务/拒篡改与缓存时间通过；真实仓库新治理metadata仍unavailable，未改真实角色定义。真实macOS Electron启动与重复关闭、Node-off/CSP/API、三工作区/900导航连接主题及安全存钥通过；窗口结构不替代独立Tester全流程/逐张截图验收。

Windows ZIP/DPAPI在本机未执行、unsupported；历史0.7.0档案只读字节验证虽是实际通过用例，不能计为Windows支持或GUI通过。旧各图失败/包/证据保留，未删未知共享marker；已知key保护仍有限原值/前置输入/流水输出，外部TOCTOU及子进程自构/编码不作全称保证。本角色没有新增须产品owner修复的结构/权限缺陷；T的GUI尚须其当前独立门，本角色未宣称总体产品验收完成。未新增可选测试/矩阵，未改D/T/治理，不自verify/派发。


取消分支证据修正：旧f5e18085的80/80是自然Host路径实际通过，不能声称原prototype屏障起效；public Service facade在fixture创建时已绑定原方法，晚装wrapper未改变它。文档后dcb92ad9样本自然drain cancelled失败于错误单常量预期，全部日志保留。本角色已移除wrapper、不增加生产hook或mockSDK；仅按实际私有terminal的conversationId/runId/同instance、createdAt=finishedAt、空text/零assistant与两个源码来源对作精确校验：#interruptCapturedMember→interrupted+run_cancelled；#memberEnd drain→cancelled+null reason。Model没有额外SDK-origin字段，不编造该字段；公共turn.cancelled与实际HTTP2/后续completed/原Human/无partial仍独立严格验证。除此两对不接受其他状态，最终同文档候选需固定门实跑。
