# Su 客户入口与 CLI 项目 Host

用户选择自己的项目，与 Supervisor（Su）连续讨论需求，确认可读计划及角色文件归属后，让多个角色执行、检查并接受独立验收。Node 和 Desktop 复用唯一 Workbench Pipeline；Node 从环境取得模型密钥，归属、对话、结果及有来源的项目事实可以跨会话保留。

成功时项目显示 completed，留下当前检查和独立 Acceptance 证据，执行许可撤销、租约释放。拒绝、版本变化、取消、检查或验收失败均不会算成功；已有真实效果保留，Su把有来源的失败交后台PM形成限定返修或新计划。最终 npm 安装包、CLI 完整交互及独立整体验收仍由后续节点验证，本轮Su能力以当前任务四项固定检查及下游独立验收为准。

## 从哪里开始

公开 Node 入口为 [createHeadlessWorkbenchPipeline](../../../../../apps/desktop/src/pipelines/workbench.mjs)。可信 Host 的最短请求：

~~~js
import { createHeadlessWorkbenchPipeline } from './apps/desktop/src/pipelines/workbench.mjs';
const host = createHeadlessWorkbenchPipeline({
  userDataDir: '/absolute/private/legion-data',
  profile: {
    protocol: 'openai-completions', provider: 'local', modelId: 'test-model',
    baseUrl: 'http://127.0.0.1:8080/v1'
  }
});
try {
  const selected = await host.selectProject('/absolute/customer-project');
  if (!selected.ok) throw new Error(selected.error.code);
  await host.sendMessage({
    projectId: selected.value.currentProject.id,
    roleId: 'Supervisor', text: '实现需求，提供检查和独立验收方案'
  });
  const state = await host.getState();
  // Host 展示后续真实 Human 交互，取得实际答复后调用 answerInteraction。
} finally {
  await host.close();
}
~~~

启动环境需提供 LEGION_API_KEY，示例地址需有实际模型服务。缺密钥或配置无效时拒绝；默认 profileId 为 environment。各角色可共用模型但会话独立。工厂注入公开环境 Profile Service，不调用 Electron 加解密、不写 settings 密钥文件，公开状态没有密钥。重建实例产生新 profileVersion，旧执行确认不会复活。

getState 展示对话、角色、真实交互和任务。用户只向 Supervisor（Su）发需求，直接PM客户消息拒绝；confirmation/choice/question 各有真实请求，answerInteraction 的 ID/版本/digest 由可信 Host 对接，用户无需抄写或比较 SHA。普通对话中的“是”不签发执行许可。完整有限请求见 [api-spec](../../api-spec.md)。

## 完整流程

~~~mermaid
flowchart TD
 A[Human选项目并向Su发消息] --> B[只读旧PM历史 核known key与物理项目]
 B --> C{旧Org schema1?}
 C -->|是| D[共享lease内drain 验旧digest CAS迁Org v2 失效旧确认]
 C -->|否| E[恢复独立su_customer渠道]
 D --> E
 E --> F[Su普通项目read与可信activity 分页行动log]
 F --> G{需要计划角色设计或返修?}
 G -->|执行中| H[只读答复 不撤权 委托改变计划拒绝]
 G -->|否| H
 G -->|是且空闲| I[Host创建有界PM委托 独立实例与pm_delegate渠道]
 I --> J{PM需真实Human补充?}
 J -->|是| K[私有questionRef Su仅引用 Host原样呈现]
 K --> L[Human真实答复 Host登记answerRef 原PM继续]
 L --> I
 J -->|否| M[Architect完整提案 PM审核当前候选]
 M --> N[独立preflight渠道读事实 提typed建议]
 N --> O{预检与当前组织绑定有效?}
 O -->|否| H
 O -->|是| P[Host显示完整owner变化 检查验收与权威catalog来源]
 P --> Q{Human实际确认当前请求?}
 Q -->|拒绝或待答| H
 Q -->|确认| R[共享lease source marker commit mutex与catalog CAS复核]
 R --> S[Host独占grant 不同owner并行 同role串行]
 S --> T[Worker受控Mutation 原请求独立PM Shell审核]
 T --> U[真实Check 当前输入证据 独立Acceptance]
 U --> V{通过?}
 V -->|否| W[有来源失败 PM原owner限定返修或新计划]
 W --> H
 V -->|是| X[撤grant drain释放lease 异步monitor渠道]
 X --> Y[Su按实际结果与typed建议交付]
 Y --> E
 E --> Z[Human取消客户轮次或停止执行 关闭切项目]
 Z --> AA[分别撤客户委托 或全部执行实例 拒绝晚回调]
 AA --> E
~~~

1. **计划和归属。** v2 任务含目标、change/verify、依赖、CheckSpec、Acceptance、生成效果，没有 task.writeSet。写权来自跨计划持久角色 owner；未分配或他人精确文件拒绝写入。claim/transfer 来自已批准组织，在 Human 当前确认中完整展示；省略旧文件不自动撤销 owner，PM 审阅不代替 Human。预算不足明确失败，不截断授权事实。
2. **监督和确认。** Supervisor 是独立 single_run Pi 实例，只能 remember/query/submit_supervision，无 Mutation、Check、Shell、grant 权。预检含完整目标/指令、职责、当前及候选 owner、依赖、检查和验收。缺 typed 回复、事实改变或终态不正常返回 preflight_incomplete，不显示执行确认。合法 proceed/revise/block 都是建议，Host 验证后展示，不逐任务批准。成功、失败、返修均可后台 monitor，失败不把已验证成功任务改 failed；PM 只消费安全 typed 建议。
3. **并发和保存。** ready-set 上限四，同 role 全任务串行，依赖完成且运行收束才释放后继。每任务 Agent、读/检查 AbortController、日志和结果独立。推理、读取、受控写请求可重叠；普通提交、Check 快照/执行/记录、Shell 准备到发布、终态证据/保留输出复核及 Acceptance 提交实际共用 Host 串行命令队列。metadata updater 在另一临界区读最新 project 再合并，不排队旧快照。Shell 内部发布直接调用受控 Mutation，不递归进入同队列。
4. **当前证据。** change 需本 run 成功 Mutation、真实 Shell 发布或当前核验恢复效果；verify 可零写但仍需检查及必要验收。输入含确认规格、本轮实际输出和依赖，最后相关修改后须新检查；相同字节的后续实际写也使旧证据 stale。generatedOutputs 是 Host 观测，不是模型或 Human 授权字段，生成权限来自确认的 generatedEffects/artifactScopes。Shell 退出码 0 不替代 Check/Acceptance。
5. **失败与取消。** Acceptance issue 指向真实开发 task/run、相关资源及当前 owner；返修保持原 role、目标、checks 和确认轮次，版本或 owner 变化后旧返修失效。取消覆盖全部 Agent、审核、读/检查，先撤权再等受控操作结束才释放租约，不回滚成功写入。旧 Shell partial 需新 Human 基线确认、新 PM 审核、当前检查和验收；旧许可不重放，正确旧产物用独立 retainedOutputs 事实核验保留。

## 来源、租约和旧数据

Pipeline 只消费 [Project Service](../../../../../apps/desktop/src/services/public/project.mjs) 的 acquireExecution/assertExecution/releaseExecution，Lease Provider 在 Service 内创建。生产根固定同用户私有 ~/.legion-project-leases，键取真实 workspace 设备 ID/inode；路径别名、不同 userData 仍争同一租约。leaseRoot 只供可信 Host/隔离测试覆盖，生产 CLI 不从用户参数或 userData 推导/传入。

不可变 `<key>.owner-source.json` 以 0600 独占创建，绑定规范 catalog 目录及设备/inode、workbench-projects.json 和 projectId。异源确认/执行返回 owner_catalog_mismatch，新 userData 不可重用旧 catalog 绕过。先建 marker，再按共享 commit mutex→catalog lock 顺序 CAS；失败不自动解绑/改绑。私有 leaseContext 的 nonce/holder 身份只在 Host→Kernel 内流转，不进模型、状态或日志。Kernel Storage 在最终提交锁内自行同步重读 holder/source/owner，拒绝非 v2 catalog/project 和活动旧 writeSet 计划，无上层 IO callback。

旧 v1 先原样验证，旧 plan/task/repair/Shell 留只读历史，不从旧 writeSet 补 owner。首次迁移确认显眼显示实际 workspace、规范 catalog/userData 路径及旧 owner，要求实际肯定：

> 我确认已关闭该项目所有旧版 Legion 实例，并选择上述 catalog 为本项目权威 owner 来源；同意当前计划。

Host 撤销并等待自己跟踪的实例，不声称自动枚举未知旧 v1。待答/false 保留旧 catalog 字节、不建 marker、不备份写回、不发新 grant。true 仍重验身份/版本/CAS，私有备份旧字节后绑定并提交 v2。旧三系统组织先验证原 digest，再 CAS 补 Supervisor，旧待执行确认失效。

lease_busy/lease_lost、目录或 holder 替换均失败关闭，不抢锁、递归清锁或删其他实例记录。崩溃遗留锁需可信操作员确认旧进程退出后处理；进程内队列不代替跨进程租约。

## 项目内分类记忆

角色记录 pitfall（自己的真实失败）、decision（已生效决策）、preference（本项目用户偏好），query 可读本项目各角色当前有效事实。模型只提内容、引用和预期 revision，Host 验证项目/作者/活跃 run并生成时间与来源 digest。只有原作者可修订/撤回，保留 revision/supersedes 历史；普通记忆不授 owner 或源码权限。

来源含真实 Human turn/答复、确认计划、检查/验收和实际失败。安全不可变 confirmed-plan/task-failure 快照在确认后、替换旧计划前及返修清 failed 前持久登记，跨计划/返修不因当前视图缺项而丢重大事实。新 add/revise 须受信登记，模型不能补来源；真实撤回、digest 变化或凭据污染使事实 stale。私有 userData/workbench-memory 项目文件保留 CAS、预算、取消与链接保护。

已知密钥、疑似凭据和受污染来源拒绝保存。偏好不跨项目；默认 renderer/log 不显示事实正文、私有摘要或 Supervisor 原会话。角色启动注入有预算的有效事实，当前 Human、canonical plan/owner 优先。

## 调试入口

| 现象 | 当前处理与真实代码 |
| --- | --- |
| 无密钥或 profile 无效 | 启动/连接拒绝；[环境 Profile Service](../../../../../apps/desktop/src/services/public/environment_profiles.mjs)，不回退 Electron 密钥 |
| preflight_incomplete | [Pipeline Supervisor Runner](../../../../../apps/desktop/src/pipelines/workbench.mjs)核 typed 绑定与真实终态，PM 重新提出 |
| lease_busy / lease_lost | [Project Service](../../../../../apps/desktop/src/services/impl/project.mjs)和[租约 Provider](../../../../../apps/desktop/src/providers/impl/project_lease.mjs)核 holder/物理身份 |
| owner_catalog_mismatch / stale_file_owners | [Project Provider](../../../../../apps/desktop/src/providers/impl/project.mjs)核来源、commit mutex和CAS，拒绝异源改绑 |
| 缺效果、stale 检查或验收失败 | task results/evidenceIds/retainedOutputs；[Organization Service](../../../../../apps/desktop/src/services/impl/organization.mjs)核输入/mutation epoch及归因 |
| 事实引用/作者/revision拒绝或stale | [Memory Model](../../../../../apps/desktop/src/models/memory.mjs)、[Memory Service](../../../../../apps/desktop/src/services/impl/memory.mjs)及受信来源历史 |
| 并行、取消或队列异常 | [readyTaskBatch](../../../../../apps/desktop/src/models/workbench.mjs)和Pipeline metadata/命令队列/per-task runs；终态诊断仅静态阶段/有限码 |

方向为 Pipeline→Service→Provider，Model 共享纯数据。仓库 task_ops assignment.writeSet 只约束开发范围，与产品没有 task.writeSet 的规则不同。

## 验证与历史

已 verified 固定门：headless 8/8、owner 168/168、memory/supervisor host 121/121、parallel 98/98；历史失败和最终候选均保留，详细见[集成任务记录](../../../../../docs/scheduling/legion-cli-role-owned-v2-schema-repair-integration.md)。这些门不冒充最终 npm 安装消费者、CLI 完整交互或独立整体验收。

真实回归：[三协议、迁移、跨plan/repair记忆、监督和并行 SDK](../../../../../apps/desktop/tests/unit/workbench.test.mjs)、[Memory](../../../../../apps/desktop/tests/unit/memory.test.mjs)、[ready-set](../../../../../apps/desktop/tests/unit/parallel-scheduler.test.mjs)、[Project](../../../../../apps/desktop/tests/unit/project.test.mjs)、[Pipeline](../../../../../apps/desktop/tests/unit/pipeline.test.mjs)。已证明不同 owner 首请求重叠、同 role 串行、metadata保留、取消无晚客户写并可重获租约、真实 Shell 审核期间另一 owner 写排队并严格基线发布，以及 Node PM 不写 settings 密钥。

- [已确认角色独占文件 v2 设计](../../../ProjectManager/docs/design/2026-10-10_design_cli-role-owned-files-v2.md)
- [本角色 owner、记忆和 Supervisor 设计/实现](../design/2026-10-10_design_cli-host.md)
- [唯一 Node Host 和并行变更](../change/2026-10-10_change_cli-host.md)
- [先前 CLI 目标历史；权限以 v2 为准](../../../ProjectManager/docs/design/2026-10-10_design_cli-first-role-memory-supervisor.md)

## 已知进程密钥拒绝

Node 工厂在首次 getState/项目历史恢复前经公开 EnvironmentProfiles Service 私有 resolve 登记本进程精确 key，Pipeline 不读取环境。Desktop 已保存连接的 metadata 浏览不触发 Electron 解密；实际连接解析后，在 Human 记录或角色执行前登记其已知值。key 不进入模型 prompt、DTO、日志、普通记忆或 owner 授权。

模型/工具和 Human 内容命中已知值会明确 sensitive_output 拒绝；Human 原文不静默改字继续。交互 title/text/options、提案 purpose/interfaces/summary/review、验收/返修、摘要/roleMemories、fact及监督、普通write/edit都受守门。edit 在 Host 提交队列经现有公开 Read Service 核实际内容与重建候选，最终仍用原 expectedSha256/owner CAS，未新增每普通动作全项目扫描。已有客户文件读取命中时只返回安全拒绝，不自动删除或改写原字节；受污染旧历史拒绝恢复，不发模型调用或把残留状态当可用项目。

PM/member/Shell review/摘要的每run delta先留在私有内存，终态和跨delta累计验证后才写文本/DTO；Key命中取消并关闭对应上下文，PM下一合法消息用安全持久来源创建新实例。合法非敏感长Human、原nonce和完整文本保持。Shell安全输出回调在每请求独立串行队列写archive与组织记录，保持顺序，失败仍明确传回。

安装的runtime0.9.2公开Check/Shell Service接收Host私有knownKeys：在受控输入复制、stdout/stderr跨片段/双流、Shell候选发布前精确拒绝；不序列化此选项。Host再验证回传，Organization/Project/Memory私有读写以纯数据knownSecrets守护，规范化后也重验。这不是任意未知secret扫描或全称DLP：未捕获/编码值不在新增精确匹配范围；输入预检查仍有已review的外部TOCTOU边界，子进程可从非连续片段自构并直接写其获准tmp/outputs，不能据日志过滤声称所有暂存文件无secret。私有K选项的数量/字节预算超限失败关闭，不截断key后运行。

所有有效公共Human命令也在动作前校验，包括profile metadata、项目路径、映射/上下文及确认/关闭/取消参数；直接Probe保持异步响应但同样守入口/返回。此门在任何invalidate或写入之前，避免拒绝后已改状态。saveProfile 经输入校验的 apiKey 是 Human 显式凭据字段，仅沿原 Profiles→Settings 加密保存流程处理，replace 可重复设置已登记同值；其余 profile metadata 仍拒绝该值，普通 Human/model/tool 没有此例外。公开 DTO 与日志不返回凭据原值。

终态与delta可能不一致，守门先按Timeline/member的真实合并规则验证完整候选：终态延伸observed则取完整终态，否则验证observed+terminal。两段各自安全不等于同run合并安全；验证在任何第一片段写入之前，PM合法delta也在安全终态一次保存，避免丢合法观察。

显式停止/切换还同步标记不再创建新的结束monitor，并取消、等待本Host现有后台monitor的私有写入收束后返回；正常成功/失败的后台建议仍不逐任务阻塞。避免已停止后仍写Org导致下一同userData实例selectProject拿organization_busy。执行租约重获、零晚源码与全部实例取消继续是强验收门，不用重试隐藏冲突。

## 查看当前监督建议

Host/CLI读取getState.supervisions即可显示当前计划preflight/monitor的pending、completed或failed。每phase只取最新项，完成项显示Host已验证的proceed/revise与info/warn/block发现、关联task和sourceRef；pending/failed无advice。resultStates只含当前任务、同run检查与对应instance的验收状态，方便说明建议基于哪些实际结果。旧计划/别项目结果不混入，不展示SDK原话、instance/run、工具队列、私有来源digest/knownKeys或全历史。

监督启动IO阶段也显示pending；完成/失败后台建议不阻塞每个ready任务，monitor失败不改已成功任务。此投影不签发授权，owner/Human确认和最终提交重验不变。

## Su渠道、委托及真实工作查询

前台是唯一客户会话，只有普通项目list/read、分类记忆、可信activity/log、discussion及delegate_pm；没有业务write/edit、Check、Shell、角色审批、submit_supervision或grant。后台preflight/monitor是独立single_run，可read/query和typed建议，不能委托PM或提客户问题。执行中Su问答不调用invalidate、不改active epoch；只读session/dispatch/grant随当前组织与owner安全刷新，旧回调拒绝。

PM start限plan/role_design/repair、8KiB instruction和32个本项目可信sourceRefs，一项目仅一活跃委托，单客户turn最多4次start/resume。Host生成身份并重核workspace、owner、org、profile/context；模型不能指定caller/profile/owner/授权。PM needs_human只返questionRef；Su不能改问题，只有Host记录的实际Human answerRef才能恢复原挂起工具。重启把无live实例的委托置stale，私有待答对应公共请求失效，不重放旧工具或确认。

Org根v2保存customerTimeline v2与delegations v1；roleMemories v2按(roleId,channel)隔离。四系统渠道su_customer、pm_delegate、supervision_preflight、supervision_monitor，普通成员member_task。旧v1摘要留只读档案，不直接喂新渠道。旧History六层只load，原字节不写；Project/owner catalog仍schema2。迁移先验原digest、共享租约内drain、一次旧digest CAS，再沿公开Project API失效旧plan；rename后目录sync失败不声称回滚，下次按已提交v2恢复，无新grant。

日志沿真实journal，仅行动metadata与来源，排除assistant_text、prompt、工具正文、私有摘要/凭据；默认20、最大50、页32KiB。cursor绑定筛选记录的固定order边界与sourceDigest，不绑定Org整体revision；自身查询或边界外追加可继续，相关快照记录修改/丢失返回stale_cursor。读取和查询每run及委托链共2MiB，超预算明确拒绝，完整Human与授权事实不截断。PM Shell审核是原确认执行的独立短期实例，空checkpoint，无pm_delegate摘要读写，不需Su委托；公开状态不返回原reviewText。

真实调试：当前 [Su任务](../../../../scheduling/legion-supervisor-frontdoor-v1.md) 的headless/owner/host/parallel日志；源码 [Pipeline](../../../../../apps/desktop/src/pipelines/workbench.mjs)、[Organization Service](../../../../../apps/desktop/src/services/impl/organization.mjs)。源码路径本身不替代真实检查证据。获批 [v0.3设计](../../../ProjectManager/docs/design/2026-10-11_design_supervisor-frontdoor-global-read.md)，当前 [API](../../api-spec.md) 与 [变更历史](../../changelog.md)；最终CLI包与独立验收由后续owner完成。

## Su在途取消与后续对话

Host取消先中断捕获的Su运行并等待该轮Host promise，再按该run的终态事件消费标记排空Adapter事件；不以公开turn已cancelled代替实际队列收束。同一Su实例下一轮重建当前安全checkpoint后正常发出新模型请求。取消轮保留Human原文，未完成assistant片段不写客户timeline/history，也不恢复旧工具或授权。阶段诊断仅输出固定prepare_memory/restore/start/drain/next_event/finalize及白名单类型/合同码，不输出异常原文、history或凭据。真实SSE取消→继续回归及原owner/known-key/并行门按当前修复图留证，不替代独立产品验收。

## 后台终态与新Human记忆CAS

Host终态缓存以真实log.channel选择存储：Su前台只su_customer，后台预检/监控只supervision_preflight/supervision_monitor，成员member_task，PM委托pm_delegate。临时Shell review只有既有审核journal/审批事实，不写pm_delegate缓存。新Human可在真实selftest失败后立即发起草案，不等待后台监督；后台不会推进前台记忆revision。来源covered引用、整体sourceDigest和同channel expectedRevision仍分别拒绝真实失效，不忽略digest或无界重试。安全诊断区分covered/source_ref/source_digest/revision，仅投影白名单channel、64位来源id/digest和整数revision，原文/摘要/工具/凭据不输出。当前真实屏障回归与四门证据由修复图绑定，独立Tester旧失败证据保留。
