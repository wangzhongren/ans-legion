# DesktopEngineer 变更记录

## 2026-10-11 — 终态记忆channel隔离

真实后台monitor收尾与失败后立即新Human屏障回归确认旧前台记忆CAS expectedRevision3/actualRevision4。memberEnd现在传真实log.channel，preflight/monitor仅维护自身缓存；临时Shell review不写pm_delegate。covered/source/revision强校验保留，安全分支诊断仅列channel/digest/revision，不含内容。当前功能/API及[修复图](../../scheduling/legion-supervisor-frontdoor-v1-role-memory-race-repair-integration.md)记录同候选四门，fresh包和独立验收在后续节点完成。

## 2026-10-11 — Su在途取消后继续

取消时Host的journal动作可能提前结束drain，而Adapter终态仍在队列；下一轮restore于是拒绝conversation_not_idle。现在按捕获run的终态消费标记收束后复用同一Su实例，Human原文保留，未完成片段不写历史，旧工具/授权不重放。真实SSE取消→第二HTTP续答及四门证据见[修复任务](../../scheduling/legion-supervisor-frontdoor-v1-su-cancel-host-repair-integration.md)；最终包与独立验收由后续节点完成。

## 2026-10-11 — Su唯一客户入口

按获批v0.3，唯一Pipeline改Su客户对话、普通项目read、可信工作分页；后台PM有界委托及真实Human问题接续，preflight/monitor与前台缓存隔离。Org v2原digest迁移，旧History只读、owner/source/lease和Host唯一grant保留；运行中Su只读不撤权，原UI必要兼容。真SDK专项及原Shell/长Human/key/并行/验收门按 [本次任务](../../scheduling/legion-supervisor-frontdoor-v1.md) 留证，当前 [功能](docs/feature/cli-project-host.md)/[API](api-spec.md)；不代表最终CLI包或独立产品验收已完成。

## 2026-10-11 — 显式凭据字段兼容

修复 saveProfile 重复设置已知 apiKey 被普通内容守门误拒；仅校验后的凭据字段沿原加密 Service 保存，metadata 与普通 Human/model/tool 拒绝门保留。真实 Pipeline 回归核重复保存、加密字节/公开状态无原值及拒绝时存储不变。正式证据见 [限定任务](../../scheduling/legion-cli-role-owned-v2-profile-secret-compat.md)，当前契约见 [API](api-spec.md) 与 [功能](docs/feature/cli-project-host.md)。

## 2026-10-08 — 修复跨实例归属覆盖

Reviewer 用两个 ProjectService 实例复现了旧实现的竞态：它们都读取相同的空归属，再各自保存同一文件的不同 owner，两个请求都报告成功，最后一次 rename 覆盖前一次。现在每次项目目录变更都带上读取时的完整目录摘要；Project Provider 在 userData 排他锁内重读并执行 CAS，再以临时文件同步和原子 rename 提交。锁等待有界，路径链接拒绝，释放时只删除本次锁。`select`、`saveProject`、`setDefaultProfile` 都使用此路径；归属变更冲突返回 `stale_file_owners`，其他目录冲突返回 `catalog_changed`，不再无声覆盖。

本角色增加确定性的两个实例归属争用、默认连接/选项目与归属并发、锁链接及工作台确认前外部归属更新回归；Reviewer 的独立 CAS 回归亦按当前候选只读运行。正式 unit 结果及候选摘要以当前 task_ops 记录为准。本修复不主张拦截绕开 Legion 锁协议直接修改 userData 的其他程序。

## 2026-10-08 — 角色文件独占与 Agent 受控编辑

项目 userData 文档新增版本化 `fileOwners`；旧项目缺字段时迁移为空归属表，原计划、上下文与历史仍可读取。PM 新计划会把任务文件聚合成角色申领；不同角色重复申领、同角色重复任务缺少直接依赖、已归属文件缺少明确转交均拒绝。确认界面逐项显示文件归属和旧角色到新角色的转交，计划摘要绑定完整归属变化；确认后在一次项目保存中提交新版 owner 和计划。每次任务派发及工具请求前复核当前 owner，确认授权与任务精确 `writeSet` 同时生效。

确认后的执行 Agent 新增 `legion_edit_file`，按其读取结果的完整文件 SHA 对已有普通文本作受控局部编辑；`legion_write_file` 继续用于完整写入。两者仍经相同的 Policy、一次性许可、Mutation 与审计。任务结果显示实际操作和成功后的最终摘要，软件检查仍为 `not_executed`。PM 没有写或编辑工具，讨论不写客户目录审计。当前角色测试新增归属迁移、冲突/转交摘要、真实 SDK 两份计划转交和按 SHA 编辑、界面结果展示；正式结果以本任务 task_ops 检查为准，独立验收由下游角色进行。

## 2026-10-08 — 当前客户项目内按需只读

按客户确认的项目级读取设计，PM 会话现在仅有受控目录列表和文本读取工具；确认后的执行成员在原精确写入工具之外也有这两个读工具。Pipeline 对每个请求复核当前项目身份、会话/运行、策略授权与固定上下文，调用公开 ReadService，单轮最多返回 2 MiB。项目切换、取消和关闭会中止旧读取。PM 自主读取不触发客户目录审计、不自动固定为计划上下文，也不扩大执行任务的 `writeSet`。

现有真实 SDK Workbench 单测增加 PM 列目录、读文本、凭据路径拒绝和成员读取后精确写入的回归。Desktop 当前实现只在本角色写入范围内；界面静态说明文件不在本阶段 writeSet，需补充限定任务后修正。正式 unit 与独立验收以当前任务的实际检查记录为准。

## 2026-10-07 — 工作台 v2 专注项目管理会话

按已确认 focus_conversation 方案，当前窗口改为左侧客户项目与动态成员、中央同一 PM 对话、底部固定输入，任务与来源详情按需展开，AI 连接在次级页，浅深色使用一致主题变量。任意真实文件夹可进入，客户无须提供开发组织；首消息创建或复用独立 PM，讨论工具/写入为空。Human 仅可与 PM 聊天和确认，其他成员只有任务、连接与范围状态。

唯一 WorkbenchPipeline 的15方法已在能力阶段冻结，Interface 使用14个固定IPC，以精确sender/mainframe/本地URL/输入白名单守卫并重建安全wire DTO；原启动readiness与Interface-owned幂等close形状保留。主进程原生目录框取得根；Human上下文输入仅精确相对列表，通过冻结品牌读授权/身份/预算/SHA路径处理，私有根、密钥、controller均不返Renderer。

聊天正文隐藏内部legion-plan块，真实历史完整保留；结构化确认显示角色、依赖与逐个文件，确认只提交宿主digest。模型completed文本不代表文件生成，结果显示实际目标写入数、缺失/拒绝、审计失败，软件检查明确未运行（not_executed）。无项目或连接时给可操作提示，发送/保存失败保留草稿，成功才清空接受输入/新密钥。每秒轮询保留输入、密钥动作、PM映射、筛选、滚动与聚焦select；项目切换显式回顶，worker点击先展开父成员详情，视图不提供直接chat/start。

能力原正式47/47已核验。发现公共测试caller生成目录问题后，原Interface在旧任务issue33/stop34停写；原owner在限定五测试节点修正import.meta绝对root与LEGION_DESKTOP_TEST_ROLE枚举/role目录，完整47/47再次通过并由Supervisor核验。产品能力源码与其他25前置输出未改；当前Interface用新任务收束原12文件。本候选检查入口为Pipeline4、IPC3，含真实公开Pipeline本地文件效果与聚焦DOM替身，正式日志见 [当前任务](../../scheduling/legion-desktop-workbench-v2-fixture-repair.md)，[旧任务](../../scheduling/legion-desktop-workbench-v2.md) 保留历史。

本阶段未运行v2原生Electron界面、DPAPI重启或便携ZIP；DOM/加密替身与旧v1窗口证据不能代替。PM接线/打包、Reviewer与Tester独立产品验证仍由下游实际执行。当前完整流程见 [工作台](docs/feature/desktop-console.md)，已冻结取舍见 [角色v2设计](docs/design/2026-10-07_design_desktop-workbench-v2.md)。

## 2026-10-07 — GUI v1 历史实施

按客户已确认并授权开发的同版设计，实现中文 AI 配置、角色映射和状态页。Profiles 前段完成不可变有限 Model、密钥保留/替换/清除、safeStorage、固定三协议探测和安全错误；Workspace 前段完成受限受控 YAML、真实组织/角色边界、task_ops Markdown 与双格式审计投影。两前段已经 Supervisor 验证冻结。

Interface 阶段组合 Pipeline，提供无导入启动副作用的 startDesktop/readiness/重复 close 契约；启用 Node off、contextIsolation、sandbox、固定 preload 与精确 sender/main frame/URL/输入守卫。每秒观察刷新保留 AI 表单、密钥动作、映射草稿、filter 与滚动位置；导航回顶，保存成功才清空密钥输入。来源失败与过期快照明确显示，治理/任务/审计均不声明在线。

前段单元为 Profiles14、Workspace9；当前 Pipeline3 与 IPC3 通过，无跳过。真实 Electron owner smoke 已完成 Windows DPAPI 保存/重启解密、受控 localhost 认证与中文三页截图，最终 evidence 目录 `fixtures/DesktopEngineer/interface-smoke-Fx9riG`。最初 smoke 的 Windows import URL、userdata 父目录、debugger argv 位移、入口顶层 readiness await 均是生成 fixture 问题，已经在本角色隔离范围修正；最后实际运行通过9项。查看截图后修正样式 class 对应与页首截图/导航。

当前五份角色文档报告实际行为与接口。便携 ZIP、PM 根接线、独立 Reviewer/Tester 与最终治理验收属于后续阶段；O1 任务启停未实施。历史方案保持原阶段事实，最新用户流程见 [桌面控制台](docs/feature/desktop-console.md)。

## 2026-10-08：完整持久组织与独立验收候选

落实[批准设计](docs/design/2026-10-08_design_governed-workbench.md)：组织/提案/交互/证据同事务锁与CAS，PM与只读RoleArchitect真实SDK审批，稳定成员侧栏、纯对话主区与三类弹窗，完整nonce绑定、重启事实恢复、Kernel实际检查、Acceptance自身范围及原owner限定返修。角色转交须候选审阅与Human计划确认。History新增锁+CAS。

原文件写/编辑、SHA、审计、context/owner变更、取消和三协议回归保留，fixture升级为真实角色审批、nonce答案、声明检查及Acceptance；新负例阻止未审批/未测/无覆盖计划。实际check和候选见[本次任务](../../scheduling/legion-governed-workflow-v1-desktop-implementation.md)，当前功能见[组织与验收](docs/feature/organization-and-acceptance.md)。独立UI/完整项目/Reviewer及fresh runtime发布Gate仍由对应角色完成。

## 2026-10-08：原生模型架构师失败与交互指南返修

真实GUI复现design_roles两次architect_failed且无提案，以及PM因options/allowSupplement组合不清而探测invalid_options。按原确认机制的[6文件返修](../../scheduling/legion-governed-workflow-v1-live-architect-repair.md)，保留13种实际Adapter安全终态码给PM，未知/原文fallback；补完整组织身份与14旧owner事实，给三类精确最短参数例子。不扩大预算或权限。真实SDK回归先保存3失败证据，再4项通过；最终本次unit以task_ops依赖冻结后记录为准。旧verified节点及其111项证据保留。

## 2026-10-08：持久对话顺序与部分提案作用返修

真实回归先复现active答案早于用户发起文字，以及RoleArchitect已经提交pending后SDK失败却返回空payload。增加单一host timeline/CAS，稳定turn/message/request/answer锚点、答案去重、continuation关联、旧交互顺序未知，SDKhistory仍纯role/text、不重放权限。安全失败结果附当前此instance/run实际观察到的pending候选，不冒充success；未知/vendor错误仍不泄露。临时全桌面121项通过，本阶段正式检查待依赖冻结记录。Adapter有界default/cap已独立调整8192/180000ms，caller可缩小、vendor能力unknown。当前[API](api-spec.md)、[设计](docs/design/2026-10-08_design_governed-workbench.md)、[任务](../../scheduling/legion-governed-workflow-v1-conversation-repair.md)。

## 2026-10-08：长对话prompt与启动拒绝返修

独立保存的完整UI DTO67733字符被重复放入prompt，超过65536并留下running锚点。分离当前模型事实与完整UI timeline，显式历史/日志省略；四个SDK入口按真正总长度检查，不扩cap、不截Human选择上下文。每轮用纯SDK文字checkpoint，最近完整128消息、旧文本省略明确声明；同步启动拒绝终结锚点failed、保留草稿。新增实际40轮完整UI历史及过大所选上下文拒绝后继续、当前失败事实与历史不重复的严格回归，原scope/check/acceptance/rival断言保留。[API](api-spec.md)、[任务](../../scheduling/legion-governed-workflow-v1-prompt-context-repair.md)。


## 2026-10-09 · 及时雨 / Handwell 沉稳对话界面

按照 Human 确认的 ProductDesigner v2 与双语品牌，生产四个 Interface 文件实现近黑空间、欢迎中心同一输入、圆形发送、四页签任务浮层和独立滚动确认弹窗。全部实际成员映射与完整计划/检查/独立验收/返修/候选及来源历史保留；草稿、聚焦选择、披露、原始回复与会话阅读位置由稳定节点维护。问题关闭仍 pending，真实 nonce 答复、重复提交锁和过期提示、IME 保护接入既有 IPC。

只改 11 个精确文件，没有原型数据或运行模拟，未扩大 preload/主进程权限或业务契约。DOM 事件回归和固定 model/unit 的实际候选、成绩和日志见 [本次任务](../../scheduling/legion-ui-handwell-implementation-v1.md)。原生布局、真实模型流和独立审查仍由 Tester/Reviewer 验证。


## 2026-10-09 · 检查记录变化后的键盘焦点

独立 Tester 用真实 Chromium 复现：同证据由当前计划改为历史计划后，旧 summary 断开，浏览器把焦点回到 BODY。Renderer 现在以替换前捕获的节点判断断开，先恢复同 key 展开状态再恢复 summary 和滚动，并保留用户主动移到其他已连接控件的焦点。未变披露不重建。unit DOM 替身按实际 UA 回 BODY，新增严格变化/不变/主动焦点回归。

同时补齐已确认设计的当前页面/项目 aria-current，将当前功能中的旧“按钮直接提交 digest”路径更新为查看真实弹窗→请求 ID/版本/摘要与真实答复→宿主重验。真实 organization_busy 失败焦点场景已通过，没有额外修复。只改本次七文件；最终固定 model/unit 与独立完整复验见 [最终任务](../../scheduling/legion-ui-handwell-final-v1.md)。


## 2026-10-09 · 真实答复失败后的提交焦点

最终严格 Electron 验收实际触发组织锁 organization_busy，观察到 submit 禁用期间焦点回到 BODY；重新可用时没有回到发起控件。Renderer 现在在禁用前捕获 submit/reject 焦点，失败后仅在同一仍打开的请求内、当前 BODY 且用户未主动改焦点时恢复有效发起按钮。stale 仍禁止旧提交并提供有效关闭焦点，主动编辑答案的焦点保留。

unit DOM 替身模拟实际 disabled→BODY，新增普通 submit/reject 失败恢复、主动改焦点保持和 stale 禁旧提交三项严格测试。没有 timer 或修改宿主/权限/nonce，也未改 A 及其他 UI 行为。旧 final-v1 失败证据保留；固定 model/unit、新候选与独立完整复验见 [v2 最终任务](../../scheduling/legion-ui-handwell-final-v2.md)。


## 2026-10-09 · 成员待任务与待答复区分

真实 Mac 客户项目中，无 pending 请求的 activity=waiting 成员被显示为“等待答复”，因为复用了 PM 轮次 waiting 文案。成员展示现在单独将 waiting 标为“等待任务”，仅 waiting_answer 标为“等待答复”；legacy 仍职责待补全，其他 activity 保持。全局 PM 轮次 waiting 和宿主数据不变。新增严格分支断言，按同一未验收 final-v2 assignment 重跑 model/unit 并提交新候选；旧报告和证据保留。


## 2026-10-09 · 欢迎设置 CTA 与正式导航标记

真实宿主结构验收发现欢迎“配置 AI 连接”CTA 被标为第三个 data-page，而正式页面导航契约为两个。现移除该 CTA 的导航标记，使用既有 welcome-settings ID 专门监听点击并进入同一设置页。入口完整保留，正式对话/设置导航、aria-current 与其他已通过能力不变。新增生产两标记严格计数及欢迎 CTA 事件回归；原 Reviewer 断言与失败日志不改。新候选固定检查和独立完整复验见 [v3 最终任务](../../scheduling/legion-ui-handwell-final-v3.md)。


## 2026-10-09 · 用户要求的 Markdown 与侧栏焦点纠错

助手正文从纯文本符号变为真实本地 marked18.0.11 Lexer→白名单 DOM，常用 Markdown、流式未闭合代码、表格和安全链接可读，完整 raw 保留；未闭合 legion-plan 隐藏，HTML/表单/图片无执行或抓取效果。合法 HTTP/S 仅当前实际鼠标/Enter 对精确 anchor 的一次绑定可由系统浏览器打开；程序打开、合成点击、任意最近点击、异源和过期关闭绑定拒绝，失败安全提示，WB IPC/权限不变。

项目/成员的 focus-visible 改为克制内侧环，导航无按压位移；关闭详情清空 selectedMember 并仍恢复键盘焦点。已有 A/B、导航、成员活动、草稿、nonce 与完整记录保留。十文件范围无新依赖或业务能力；Lexer 版本/安装文件只读，fallback 保留完整文本。新增常用 DOM/安全边界及真实 Electron local-module/gesture/geometry/Esc 回归，实际结果和独立复验以 [本次任务](../../scheduling/legion-ui-markdown-and-focus-v1.md)记录为准。


## 2026-10-09 · 取消后需求、完整角色方案与成员真实会话（代码已写，未测试）

SDK普通文本从真实持久PM timeline恢复Human/已答discussion，取消/失败不丢需求；先截取128条再typed、未完成助手文字留UI，legacy Human标未知顺序。PM普通/恢复及Architect委托共享完整实际Human facts和选择定义，超65536明确拒绝；execute_plan旧yes/tool/grant/非PM文字不恢复为权限或PM回复。

PM/Architect一次完整必要角色变更，成功后结束不分批；三系统固定与可revision+1开发定义分开，旧成员/owner/失败/批准保留，真实实例成功候选仍由PM精确审阅。新成员journal来自实际SDK文字与typed工具白名单元数据，同现有组织锁/CAS持久并兼容旧digest；无instruction冒充、文件正文/API/credential/reasoning泄露。非法/根目录资源投影null仍走原Policy，宿主停止旧run为interrupted不污染新项目。

主聊天出现实际非PM工作轻量入口；成员详情只读按run切换，event.id稳定节点、原阅读位置与聚焦旧链接保留，未知旧记录/结束时间明确标注。二十现有文件，无新file/pkg/IPC/权限，原检查/审计/owner/CSP预算保持。六份既有unit已追加针对性回归，按用户要求全部未运行，无run-check/model/app/模型测试或新SSH开发。[本次任务](../../scheduling/legion-workflow-context-and-member-chat-v1.md)保留pending验证，不能用旧通过成绩冒充本轮通过。


本轮最终只读反馈补正：工作入口按钮随工作结束移除时，关闭详情先回仍连接的原入口，否则回同角色稳定侧栏按钮，再无同角色时回“当前任务”。仅在详情拥有焦点时恢复，不抢用户主动移去编辑器的焦点；克制内侧focus样式保持。新增对应未运行回归，当前13项新回归全部deferred；旧1e0候选报告保留，由新冻结候选替代，未测试/未编译/未验收。


## 本轮用户恢复测试后的验证状态（2026-10-09）

用户最新“把两个ssh项目都清空，重新测试”已撤销此前tests deferred。Owner按原固定model/unit执行：首轮unit145/164，旧架构师prompt fixture解析、取消需求旧预期与新增manual/加密重启fixture错误已明确修正；第二轮162/164，再修同一JSON行布局与实际content+tool_calls协议fixture。全部原权限/owner/nonce/审计/预算断言保留，取消预期严格验证原需求不丢；生产源未因这些fixture返修改动。旧失败日志永久保留。

随后同固定model28/28、unit164/164通过，无fail/cancel/skip，包括新增13回归与隔离Electron原生用例；最终说明冻结后重新固定检查的候选/日志看 [当前任务](../../scheduling/legion-workflow-context-and-member-chat-v1.md)，不复用旧151或此前deferred候选证据。此为Owner实际单元/受控SDK与自有原生fixture结果，两个客户SSH目录清理、真实GUI/真实模型新开发及独立验收由root安排，不能称已完成真实客户项目验证。之前“未测试”是当时状态，当前代码仍待完整产品验收。


## 2026-10-09 · 真实提案边界拒绝诊断与成员任务详情

真实5成员提案的boundary被写成职责冒号prose/glob，裸TypeError无code，被控制层抹成control_failed而重复直到180秒；权限仍存在。当前组织Model保留严格路径/类型/系统职责/owner/revision规则，已知输入拒绝附安全固定field和expected，Control只传first-party有限诊断，Guide共同明确字段types与边界职责分区，模型可修正完整一次提案。未知运行故障不伪装输入错，坏值/SDK原文/credentials不传。

点击成员先看该成员当前任务/状态/精确范围/checks及自身证据，再自身定义/连接/真实run历史；不堆别人的卡和任务，不拿instruction补对话。Host实际Architect解析profileId与PM fallback公开元数据准确展示，原四tab、稳定节点/focus、权限/IPC/CSP/budget保持。16既有文件范围，无新包或文件；[当前固定检查和验收](../../scheduling/legion-role-proposal-diagnostics-and-member-detail-v1.md)。


本次Owner固定model30/30、unit170/170首轮通过，无fail/cancel/skip；新增6项明确验证实际形态prose/colon/glob拒绝的安全field/expected、不合法方案不提交pending/owner、SDK据提示改精确完整候选、所选成员自己的任务/证据/卡、公开fallback连接及原权限流程。16文件最终说明冻结后的同候选固定检查以 [新任务](../../scheduling/legion-role-proposal-diagnostics-and-member-detail-v1.md)当前证据为准，不能复用旧164或原失败。原真实5成员失败/180秒trace保留，root普通入口真实完整提案/GUI验收仍后续独立进行，没有假审批或客户项目操作。


本轮成员中心详情最终分支修正：新的真实RoleArchitect role-design与旧文档计划任务可同时显示，当前设计不被旧任务列表屏蔽；旧计划文档另标，无run仍不造设计工作。新增严格共存/无run回归，原3ee1检查保留，最终新候选重新固定验证。


## 2026-10-09 · 角色持续工作上下文与独立对话页

已确认具体PM方案下实现project+role私有roleMemories、真实来源水位、未覆盖Human/选择题语义、当前职责/owner原样pins、每任务fresh安全实例plain恢复、一次2048token/30秒tool-less自动摘要及失败保留。近文扣当前完整输入/pins和摘要wrapper后选整条；不重复全量已摘要事实、不恢复旧授权。旧digest迁移与CAS保持，补充Provider signal在rename提交前作最终取消检查，提交后不冒称回滚。

新增第五“对话”tab，实际PM timeline及角色run历史独立于成员任务资料，工作入口直接对话；已发送Host任务briefing独立标明来源。固定系统角色来源与项目/legacy区分，原focus/scroll/draft/稳定event节点/IPC/CSP保持。UI公开仅有限记忆计数/安全notice，不传私有摘要与source值。

新增Model/迁移/CAS/真实fs取消、localhost SDK阈值/重启/项目隔离/summary failure/length/tool/cancel、四角色持续上下文与五tab/IPC统计链回归；本候选正式检查待执行，历史证据保留，最终以新两task正式candidate/logs为准。未操作客户SSH目录、主窗口或真实模型。


本轮检查记录：补充任务首轮固定unit163/173、10fail、0skip，日志`legion-role-memory-cancel-commit-v1/evidence/organization-cancellable-commit-1-unit-078a6e33.log`保留。具体修复重复import、合法新来源badge/完整checkpoint断言、实际timeline种子（已import空legacy不重复导入）、cancel发生在prepare未start的真实分支与真实fs最终取消查询夹具；未更改预算或权限、未删除严格断言。新冻结候选待同固定门重验，最终结果以正式report为准。


最终来源保护修正：source工作文本按原始已记录createdAt规范排序，legacy未知来源优先且不伪造时间。活动PM running/waiting回合的真实Human与discussion问答为required完整来源，不能进入older摘要集合；近文选择先预留这些来源、当前完整prompt/pins和摘要wrapper。required+当前输入已超65536时不调用摘要或业务模型，明确拒绝并保原文。新增纯Model和真实localhost SDK“旧架构师45000字回复+本次完整Human”的回归，严格断言摘要请求不含当前需求、后续Architect实际请求含其逐字完整内容，原长journal不删除。此前主model33/unit187通过的c762候选与日志保留作为当时历史，最终固定门将对新候选重新执行；Provider3文件保持已核验原样，最终主unit包含其真实提交取消回归。


同一必要来源保护进一步覆盖执行角色情况：用本角色previous.messages/covered的ID+digest区分已交付与新Human/讨论答案；有previous时，尚未递送的新Human/答案required，且最新需求轮即使PM已completed仍保持完整。初次旧迁移历史至少保护最新真实Human及其问答（legacy无轮次保护最新user）；旧已听内容仍可摘要。required本身超过近文目标16k也不截断，目标先扣其占用；合并65k/恢复128硬限不升。新增纯Model和真实localhost双计划/实际自测验收回归，验证completed PM的18000字符新Human在worker实际请求逐字保留，而摘要仅处理自己前轮45000字符历史，旧工具结果不重放、原文不删除。最终门仅以本轮最新candidate证据为准。


本轮后续固定unit189/191（15eb32a1）保留：required+prompt超限的公开Model行为为提前prompt_budget，回归严格验证throw及完整原文保持；Native记录在自身Enter阶段前出现额外真实Enter输入，原fixture会抢前台。现将实际Electron fixture保持隐藏并只聚焦webContents以隔离用户键盘，真实sendInputEvent与全部精确一次打开/拒绝synthetic/几何/Esc断言及30秒限额不变，不修改Main。最终新候选再运行固定门，旧结果不复用。


## 2026-10-09 · 侧栏名称与角色来源分行

真实普通窗口中的6个长中文角色名被同flex行来源文字挤窄至两字一行。成员按钮CSS改为头像/名称/活动点三列，来源位于名称下方；固定头像26px、状态点6px跨两行，名称恢复剩余宽度且完整可读，不ellipsis。仅样式与既有设计/console说明改变，原DOM/aria/title、角色ID/来源文案、focus/scroll/五tabs与权限保持。按新4文件任务冻结后运行原固定unit，不新增镜像测试，独立Tester与root真实窗口验收后续记录。


## 2026-10-09 · 隐藏项目成员滚动条

依Human直接纠错，成员列表通过scrollbar-width:none和专属webkit伪元素隐藏滚动条，gutter改auto释放预留槽；overflow:auto仍支持wheel/keyboard访问成员。仅改成员列表样式及既有设计/console说明，不改其他区域滚动条、Renderer/Main、原grid布局或成员身份与焦点。新4文件任务冻结后重跑固定unit191，root真实窗口与Tester核验后续记录；低影响CSS不新增镜像测试。


## 2026-10-09 · 依赖只交接最新真实元数据

真实Core成功写9文件约90787bytes、自测先fail后edit修复并pass28，后继Renderer因自动灌整个依赖body/重复write快照超过65k而未调用SDK。已在7文件范围修复：成功write临时正文在纯Model计算UTF8 SHA后即投影六字段metadata，edit用实际result SHA/未知null；active.outputs仅存去重metadata，按实际任务完成顺序过滤deps而不按dependsOn排序覆盖新版本。后继明确自主read当前磁盘内容，旧正文不自动带入。原始记录/已写业务代码/硬预算/Human与canonical pins/权限/nonce/检查失败均保持。

新增纯Model的正文剔除、UTF8 SHA与repeat+edit/未知SHA/accessor拒绝回归，及真实SDK多owned文件>65k、实际check先fail后局部edit再pass、子收到完整Human/canonical并自主read最新内容/自身自测与独立验收回归。正式门只用新任务固定model/unit，未操作客户Core9文件、主GUI或真实模型，旧真实失败不删除。


本轮固定unit首轮192pass/1测试文件失败（193总项）日志1510e5ca保留。新大handoff夹具误用了read.content/contentDigest和edit.expectedContentDigest，真实公开接口是read.text/sha256与edit.expectedSha256；edit被严格拒绝，错误夹具不断重复导致V8 OOM。仅修此夹具字段及真实denied/error终态收束，仍严格要求最终completed、真实checks passed、完整Human/canonical、最新SHA和实际read正文。生产预算/权限、原191断言、argv、300秒与heap不变；source/docs重新冻结后同固定两门对新候选重验，不复用首轮Model证据。


随后0663aea9仍OOM的确切持续请求原因：多次write复用夹具completion默认toolCallId=call1，真实Adapter明确拒duplicate_tool_call，SDK错误不带Host result envelope，夹具success停在1并重复错误请求。每个实际write现使用唯一ID，实际tool消息必须有typed Host result；schema/duplicate/denied/error及错phase立即按失败收束，夹具自定义handler最多24请求以防错误循环，不改变production预算。按Supervisor指令先仅新case局部实际运行，handoff-focused-diagnostic-1.log记录12个自定义handler阶段、1/1成功（约2.47秒），父4次write→read→check failed→edit，子真实read当前全文/sha再write，全部原selfcheck/Acceptance最终completed断言保持。1510/0663失败留存；现在对统一冻结新候选重新跑固定model/unit，不将局部1/1冒充正式门或真实SSH完成。

## 2026-10-10 项目Shell v1生产接线候选

- 原role legion_request_shell pending→独立串行PM审核→持久exact claim→真实隔离Shell→publicMutation/generated publication→原PiToolResult继续；无新Human逐命令审批、无ShellReviewer成员、无裸Shell降级。
- 持久请求/真实审核/有限输出/逐文件发布journal与私有产物版本；同project Shell/Check锁，删除墓碑和严格absence，二进制Host内实际SHA/bytes，依赖仅metadata。
- source partial→重启安全暂停→新Human当前SHA/absence确认→新plan/newgrant恢复→当前检查证明后追加recovered；旧partial结果/旧批准/所有失败日志保留。
- UI真实phase与原成员/PM对话，生成范围完整披露，stable nodes/focus/draft/scroll/Esc/five tabs/CSP/IPC边界保留。
- 新Shell SDK/native本地回归和原严格回归维护；最终检查计数/日志以同candidate task_ops结果为准，独立验收待Supervisor后续安排。运行安装输入0.8.1 tarSHA970bf9954813022cef8f396b8ac388088024cdca9ffd18d1533347723b5a73f1，上游源码与产物未改。

## 2026-10-10 0.8.2 fresh时间事实Host caller适配

每个Shell源码proposal许可发放现场采用本次Shell Service.observeTime()第三参数，Model不观察系统时钟，消费/真正提交仍由Provider重新核对到期。普通write/edit、预算、原pending/partial真实观察和新Human恢复保持。新输入0.8.2 tarSHA1a2a7c483f04f2bb939d6bf4d25aa7a4318bc866a473dcac251f74d1ee592622；旧包/证据保留，当前三个固定门重新同candidate，未自验收。

## 2026-10-10 absence wire、活动入口焦点及正确资产恢复（同v1必要修复）

真实删除检查基线仅state:absent/sha256:null/byteLength:0/noexec可经原getState wire公开；legacy present仍严格SHA，非法状态/字段冲突/未知字段拒绝。成员证据和检查记录显示获准缺失，不显示SHA null。活动入口采用既有内侧1px/-3px焦点及无按下位移，保留真实鼠标/键盘/Esc回原trigger和结束fallback，不blur或隐藏键盘焦点。阶段截图由实际DOM/transition稳定判定，不猜新生产bug。

只针对旧partial中真实成功/observedMutation、actual publishedResources与candidate一致且当前仍匹配目标SHA/bytes/safeexec的产物，Host在新Human明确当前baseline和新plan确认后创建独立recovery_verified_retained事实。事实绑定旧request/proposal/candidate摘要、新Human请求/plan、currentowner/task/instance/run与已核验baseline；task.retainedOutputs与新Mutation results分列，不伪造observedMutation，不重写正确binary，不泛化普通nochange。新计划仍声明原精确writeSet与检查输入，保留事实仅承接该已明确范围内的交付。Human确认明示可核验保留的资源/来源，SDK只得到Host事实不是许可。当前selfchecks/Acceptance和末次磁盘/生成版本复核之后才append recovered，旧partial结果不改。SHA/bytes/mode改变、缺provenance、baseline/owner/task/plan不符均拒绝。

Core/Adapter/SDK工具/IPC操作与0.8.2包不变，公共Organization abstract/public/impl facade一致，仅Desktop可选task-state元数据兼容旧缺失字段。真实自有SDK/native partial→restart→newHuman/newPM/newShell保持正确binary无diff/无新Mutation，保留事实后检查/Acceptance；否定changedSHA/mode/missingprovenance；wire原IPC和native focus分支严格回归。全部三个固定门同新candidate，不复用旧177/34/199，独立验收由Supervisor后继调度。

## 2026-10-11 CLI Host 并行与 Node 入口

承接已验证角色owner及项目分类记忆/独立Supervisor，新增公开环境Profile Node工厂，复用唯一Pipeline；四任务有界ready-set、同role串行、独立实例取消与最新metadata串行合并。普通受控写与Check/Shell共享Host命令队列，保留真实基线/过期检查拒绝。变更及固定检查证据说明见[CLI Host](docs/change/2026-10-10_change_cli-host.md)。最终npm隔离安装消费者与独立测试由后续owner执行，不据本节点冒称包已发布。

## 2026-10-11 CLI Host 当前功能同步

[当前功能文档](docs/feature/cli-project-host.md)同步已 verified 的角色owner、权威catalog来源与迁移、共享租约、项目分类记忆、独立Supervisor、Node环境工厂和有界并行；完整流程说明真实Human确认、失败/返修、检查/Acceptance和全部实例取消。导航指向该稳定文档。仅文档更新，最终npm隔离消费者与独立验收仍由后续节点完成。

## 2026-10-11 已知进程key必要修复

[CLI Host当前行为](docs/feature/cli-project-host.md)新增明确拒绝、每run流缓冲、Human原文保护、受污染历史失败关闭和runtime0.9.2 Check/Shell私有knownKeys接线；Shell输出串行归档，普通edit重建候选仍保留CAS。随机canary实测持久/DTO/Source/双流与正常长Human、取消、owner、Shell门；精确匹配、TOCTOU及child直写tmp边界如实列明，不宣称全称DLP。

## 2026-10-11 当前Supervisor typed建议公开投影

getState新增当前plan有限supervisions：每phase最新pending/completed/failed、Host验证安全advice及当前任务/检查/验收来源状态，旧plan/别项目过滤；不暴露raw会话、私有身份/队列/凭据。真实SDK/getState覆盖pending→completed、text-only失败及key不泄漏，wire有限字段重验。当前流程见[CLI Host](docs/feature/cli-project-host.md)。
