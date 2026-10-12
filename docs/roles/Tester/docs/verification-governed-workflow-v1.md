---
type: verification
title: 完整治理工作流独立验证与环境限制
created: "2026-10-08"
status: verified
---

# 当前候选以独立实际执行证明

Tester 仅持有本次十二文件白名单，已通过 task_ops ack 激活。方案见[已确认范围](design/2026-10-08_design_governed-workflow-verification.md)，正式任务及准确检查记录见[调度记录](../../../scheduling/legion-governed-workflow-v1-final-integration.md)。该任务的 `integration`/`ui` 检查固定输入包括实际安装的 runtime、Desktop 实现、公开契约和文档；依赖修改后须重跑。

环境为实际 macOS arm64、Node v24.14.0、Electron 44.6.0 内嵌 Node v24.21.0、已安装 Pi SDK 1.0.4、legion-runtime 0.7.0。localhost 模型服务只提供实际 SDK 协议响应及工具参数，软件检查始终执行真实候选 Node 断言；付费推理请求为零。桌面加密使用实际 Electron safeStorage，软件检查使用实际 macOS seatbelt，不用伪造 passed 结果。

| 验证入口 | 实际覆盖 |
| --- | --- |
| permission / generic | 原角色/任务/版本/原审批/作用域/审计、真实 SDK 会话隔离与取消、只读和编辑 SHA 回归 |
| public check flow | 实际 Electron Node 正确/失败断言，空测试/TAP/fd3 伪造拒绝，缺 live approval/输入变更，越权写与 spawn 受实际隔离阻止，取消撤销 |
| Workbench public flow | 三种实际 HTTP SDK 协议，纯对话、项目与上下文隔离，角色批准、Human 请求、真实写入及独立验收，取消/close/审计故障/owner别名/依赖/转交/CAS |
| governed workflow | 真实 RoleArchitect 提案→PM 退回→修订→批准；安全架构错误可恢复；真实 propose 后认证失败保留同实例确切 pending 提案，不冒充成功/批准；三类等待/关闭/过期/幂等答复；无角色批准/无检查/无验收拒绝；开发实际成功及独立失败→原 Builder 返修→实际自测/复验通过；新轮次缺检查/检查失败/检查后输入变化拒绝；Acceptance 仅自己的报告范围；返修上限；重启无旧 SDK/授权重放；持久单一 timeline、answerId 去重、重复文字不同 ID、未来轮次不移动旧答案 |
| public organization | 已知旧 owner 迁移不编造批准，PM/Acceptance 业务范围拒绝，角色文档必须经当前审批并匹配实际 SHA，持久恢复 |
| current Electron UI | 实际 renderer/preload/IPC/系统加密，成员节点/输入/焦点跨轮询稳定，三类弹窗关闭/重开/真实答复，question 重启持久事实不重放旧工具，真实失败→PM 修复→独立复验，浅色/深色与最小窗口布局 |

独立生成证据位于 `.ans/runtime/legion-governed-workflow-v1/Tester/evidence/`：`governed-flow.json`、`governed-ui.json` 及 `ui-*.png`；最终日志/候选哈希由 task_ops 固定。截图须在实际 renderer 状态更新后记录，不用仅 main 状态冒充可见结果。

## 证据状态

独立诊断实际通过：Node 原 integration 23/23、公开 Check Service 5/5、Workbench 14 场景、完整治理 SDK 16 场景（107 次真实本机 SDK HTTP 请求、17 次执行检查）、公开组织迁移/文档 SHA，以及真实治理 UI 完整流 1/1（35 次本机 SDK HTTP 请求、4 次执行检查），以及保留的 macOS 项目读/凭据拒绝/实际写/转交编辑 UI 1/1（20 次真实 SDK HTTP 请求）。当前确切组合实际临时执行 `integration` 为 31/31、0 fail/cancel/skip；`ui` 为 2 个实际 macOS UI 通过、0 fail/cancel、1 个明确 Windows 平台跳过。完整原始临时结果保留 `preformal-integration.log` 和 `preformal-ui-final.log`。正式验收结论、实际计数、输入/candidate 摘要、耗时和 stdout/stderr 始终读取调度记录当前 `integration`/`ui` CheckEvidence；只有其均为当前候选 passed 且阶段 verified 才代表本角色完成。缺失、失败或相关输入改变时不能使用诊断成绩代替。

## 未运行与实测边界

Windows ZIP 原生 chooser 与 DPAPI 在 macOS 显式跳过，未被表述为通过。实际原生选择器/Deepseek/客户 SSH 项目由 Supervisor 单独实测，本角色的 localhost 工具场景不证明外部模型能稳定形成角色提案，也不代替客户项目验收。软件检查的首版 Node 模式不支持派生子进程；反伪证据断言证明具体测试场景，不能证明任意恶意 JavaScript 都无法欺骗同进程 reporter。

先前反馈的聊天顺序问题已由 Desktop 原 owner 改为单一持久 timeline，Tester 新增 actual UI/SDK Human→question→answer→continuation、重复文字/answerId 与重启/未来轮次严格复验。旧无锚点记录只标顺序未知，不假造时间。新增长期完整复验又发现全 governedDTO（包含完整 timeline）进入 PM prompt 的增长问题：安全快照中该 JSON 单独已有 67733 字符，大于既有 65536 输入上限，尚未加 GUIDE/其他事实；真实 sendMessage 在 SDK 调用前拒绝为 internal_error 且留下 running Human 消息。实际失败日志与安全快照 `current-long-conversation-fail.log`、`rival-timeline-refusal.json` 保留在 Tester/evidence。Desktop 原 owner 随后改为有界 current facts/明确省略标记与最近完整 plain checkpoint，同步启动拒绝收束终态；65536 硬上限未提高。Tester 保留并复验后续同 owner 返修/两轮上限/双实例 CAS/旧确认拒绝：真实完整 journal 已超过 65536，实际 model prompt 仍在上限内且显示 historyOmitted。新契约下 SDK Session 每轮重建，测试精确核对持久 PM instanceId/sessionId/profile 仍相同、历史连续、取消和权限不复活。当前确切组合已通过，正式验收仍须绑定当前 task_ops 输入/候选。生产失败归原 owner 修复。测试夹具曾出现新版内容数组/任务排序/异步 UI/生命周期格式、single-line 失败描述、旧 0.6 macOS 夹具误配，修正测试使用契约后继续保留原安全行为断言；没有修改生产、放宽写权限或把未运行项变成成功。

本次 v1 结论只覆盖实际组织/交互/检查/独立验收/返修机制。另议的产品设计职责或离线 UI 原型不在此验收声明中，不能据本报告说新的产品角色已在 Runtime 实现。所有临时失败与原 owner 返修保持历史，正式阶段完成仍由 Supervisor 校验当前两个 CheckEvidence 后记录。

## 2026-10-09：及时雨 / Handwell 生产 UI 当前验证

本章节追加新 UI 实施与最小焦点返修，不改写上方完整治理工作流的历史候选和结果。任务为 `legion-ui-handwell-final-v1`，客户批准配置 `64f2679ac901bf72bf704e54ef44dc9807d49e21b95606d513697cf6017d9220`，Tester 仅更新两份现有 E2E 与三个本角色说明文件。生产、API/IPC、Pipeline、权限和 readonly integration helper 均由原 owner 维护，本角色未修改。

真实环境为已安装 macOS arm64 / Electron 44.6.0 / Node 24.21.0 / runtime 0.7.0。完整新 UI 用实际生产 BrowserWindow、renderer/preload/IPC、localhost 真实 Pi SDK 请求和实际隔离软件检查；协议服务提供确定的工具参数，不能生成假的 passed 检查。实际窗口外部尺寸 1260×860 与 960×640；窗口内容因原生标题栏略低，记录中的 viewport 为实际 innerWidth/innerHeight。IME 断言用真实 renderer 的 composition/KeyboardEvent 接收边界及实际 Enter/Meta+Enter；不宣称测试了整个 macOS 输入法引擎。

| 已实际执行的边界 | 本轮观察 |
| --- | --- |
| 新画布与欢迎/内容输入 | 及时雨 / Handwell、默认近黑与浅色，两尺寸输入/发送可见，无横向溢出；截图等待实际主题 paint 完成 |
| 正常会话/成员 | 普通回复不重复原文；真实 RoleArchitect/PM 提案/退回/批准；4 个实际 fixture 成员按 ID 保持节点与状态名称，没有原型7成员或模拟scenario默认数据 |
| 浮层与页签 | 任务/文件与上下文/成员/记录明确点击后内容可见，620px上限及实际 viewport；键盘页签与关闭返回触发焦点，records 才显示检查详情 |
| 连接与映射 | 安全校验失败保留新 Key、真实加密保存成功清空；全部实际成员映射可见，选择草稿/焦点保持；Builder 保存真实映射使旧计划失效且旧确认拒绝，清除后重新讨论 |
| 三类请求 | 真实 confirmation/choice/question、关闭/Esc保pending、同nonce草稿/选择恢复、重启不重放旧tool；空/实际非法答案拒绝保留输入；真实取消使当前请求 stale、保留答案且禁提交 |
| 执行确认 | 960短窗口的所有精确文件/owner、任务依赖、checkspec/argv/input、Acceptance覆盖和返修上限可读；完整公开binding可展开，内容独立滚动，footer/确认按钮保持 viewport 内可见；欠nonce/关闭不写源码 |
| 软件交付 | 开发真正自测通过、独立测试真正失败、记录显示真实测试数/输入SHA/环境/stdout/stderr；PM交回原 Builder、同scope修复、实际自测与独立复验通过，原失败与第1轮返修仍可读 |
| 来源/历史/输入 | unavailable/cached/record观察依真实 DTO 条件显示，不说成当前在线；完整 host timeline、重复文字不同ID/answerId去重、回看滚动与草稿/焦点跨轮询和导航保持 |
| 动效与安全 | reduce 实际媒体偏好下非必要 animation/transition 关闭，操作继续可用；无 renderer Node/require、未披露 fixture Key，权限/取消/编辑SHA/转交旧回归保留 |

初轮真实 Chromium 限定 DOM 合同用例确证 `_Renderer.region` 同 ID disclosure 替换把已聚焦 summary 移到 BODY。旧实际失败保留于 `handwell-ui-20261009/focus-repro.log` 与 `actual-region-focus.json`，不是离线原型或伪host结果。Desktop 原 owner 最小修复后，保持原失败断言的真实 UA 复验观察新 summary 获焦点（SUMMARY）、原节点断开、same ID事实正常替换。本用例的输入是受控 DOM facts，只证明生产 renderer 在真实 UA 的焦点合同；不冒充完整业务端到端。

另用本次独立 userData 的真实组织锁产生 `organization_busy`，经过真实 UI/IPC/Provider答复失败：错误保持可见、答案保留、弹窗未关闭、submit恢复且仍获焦点。该 B 场景原实现和修后均通过，没有为未复现问题改生产。新结果在 `final-v1/actual-host-submit-focus.json/png`。

准备阶段保留所有失败：即时 host completed 与 renderer poll 未同步的按钮断言、modal 打开时背景主题点击正常被 dialog 阻止、浮层未关闭拦截 composer、stdout/stderr 多节点与 source-unavailable 文字的测试定位误配。调整的是实际导航/同步/真实 DTO 分支；没有 forceclick、放宽可见性/权限断言、提高超时、改变 fixed argv 或把未运行改成通过。旧 `matrix-second.log` 及 `final-v1/strict-ui-first/second/strict-matrix-third.log` 保留。

最终独立源/说明冻结后只运行配置原样 `integration` 与 `ui`。正式结果、候选和未变更输入由[最终任务记录](../../../scheduling/legion-ui-handwell-final-v1.md)的两个当前 CheckEvidence 固定。UI 预期四个实际执行用例（完整新 UI、限定实际 UA焦点合同、真实 host答复失败、原macOS读/凭据拒绝/写入/编辑转交）及一个 Windows ZIP/DPAPI明确未运行；正式计数以记录为准。任何失败、输入变化或未验收状态都不能使用此说明代替当前通过。

全部新截图/JSON在 `.ans/runtime/legion-governed-workflow-v1/Tester/evidence/handwell-ui-20261009/final-v1/`；`governed-ui.json` 记录真实 localhost SDK 请求38次、实际检查4次、观察边界与截图路径，付费请求0。截图已目视核对近黑/浅色、欢迎/内容、完整scope小窗口footer和返修记录；不覆盖旧v1或本轮失败证据。Windows、原生客户 SSH/外部模型、发行包发布仍是单独证据，不因本角色 controlled localhost 或 DOM用例自动宣称通过。

### final-v2：真实宿主失败焦点与成员闲置状态复验

final-v1 正式 integration31/31通过，但正式 UI 为3通过/1失败/1Windows未运行：真实组织锁 `organization_busy` 失败保留答案与按钮可用，实际焦点却落在BODY，确证B有时序分支；不能用此前局部B通过替代。原正式失败 `ui-verification-1-ui-d07638d1.log`、`final-v1/actual-host-submit-focus.json/png` 与issue/stop保留，未重复刷绿。

原Desktop同范围最小修复捕获disable前的真实submit/reject焦点，只在同请求/弹窗仍有效且焦点回BODY时恢复有效发起控件；主动移动到textarea不抢回，stale仍禁旧提交。真实项目又发现idle activity:waiting误标答复，本轮专用成员闲置为等待任务、waiting_answer为等待答复、legacy职责待补全，PM全局waiting语义不变。该原owner候选Model26/unit139通过是其开发证据，不能代替Tester当前formal。

Tester新任务 `legion-ui-handwell-final-v2` 继续同五文件，仅改证据prefix并增加实际idle title/无障碍名称准确观测；A/B和完整UI、原Mac读/SHA转交、nonce/取消/范围/返修等失败断言不变，未改fixedargv/超时/skip条件或forceclick。全部新截图/JSON在 `handwell-ui-20261009/final-v2/`，原final-v1与更早证据冻结保留。五文件冻结后仅一次配置原样formal integration→ui；最终通过须来自[final-v2调度记录](../../../scheduling/legion-ui-handwell-final-v2.md)两个当前、同candidate且unchanged的CheckEvidence。当前预期31integration及UI4实际执行/1Windowsonly未运行，具体计数以实际日志为准；任何失败立即返回原owner。

### final-v3：欢迎设置 CTA 的最后当前门

final-v2当前正式integration31/31与UI4通过/0失败/1Windows未运行，由同candidate `6aafe99a470f44b88a77c9beba11d00609cf116bc2fd38ef59311e6ed6ecf26f`固定，原A/B严格断言通过，旧完整日志和final-v2截图/JSON保留。随后独立结构检查发现welcome-settings第三个data-page标记不符原两实际导航契约；原Desktop只去除该CTA的data-page并用同id click→settings接线，原readonly结构断言未改。

本次 `legion-ui-handwell-final-v3` 同五文件、同批准配置和固定检查。Tester仅切换final-v3证据prefix并在原完整矩阵首次设置入口用实际欢迎CTA点击，仍严格验证settings实际可见及两navigation标记；之后侧栏设置、映射、所有旧nonce/焦点A/B/检查返修/窗口/主题/IME/日志/旧Mac编辑转交断言保持。没有提高预算、forceclick或改变Windows未运行条件。五文件冻结后配置原样integration和ui各正式一次，最终结论读取[final-v3任务](../../../scheduling/legion-ui-handwell-final-v3.md)当前相同且unchanged候选的两项证据。所有新截图/JSON只在handwell-ui-20261009/final-v3，旧候选与失败/pass历史均不覆盖；外部模型/原生客户/Windows/发行仍不混入本门声明。

## 2026-10-09：Markdown / 导航焦点纠错当前门

任务 `legion-ui-markdown-and-focus-v1` 同获准配置和五文件范围；旧final-v1/v2/v3所有pass/fail、Root前截图不改写。新证据只在 `handwell-ui-20261009/markdown-focus-v1/`。生产/锁定marked18.0.11本地UMD资源/包与lock/原owner151单元测试是只读输入，不能用其通过代替Tester当前两formal门。

必要实际Markdown用例已经通过：生产app、真实main/renderer/preload/IPC、受控localhost真实SDK文本使h1/strong/em/嵌套list/quote/GFM表格/inline与fencedcode获得正确DOM及阅读textContent；raw恶意HTML只作为文本，script/img/iframe不存在、危险/多重编码协议不成为链接，图片描述为可点击网址而无自动fetch，rendererHTTP请求为0。用户/Human保留literal Markdown/HTML；真实旧HistoryService磁盘恢复的未知顺序前缀与原文保留、旧assistant同样rich显示。

链接使用真实生产main的物理gesture/frame/exactURL/one-use处理：mouse和Electron webContents native keyDown/up Enter分别触发准确网址，synthetic click/programmatic window.open、已消费手势及mousedown后href变更不触发；不会创建Electron新窗口。最后一步OS browser opener和失败messageBox是明示的受控spy，故本门不宣称启动真实系统浏览器或访问外网。真实opener拒绝显示有界安全提示，不含原异常。CDP keypress不代表main原生before-input-event，这个早期fixture失败保留并改用真实native事件，未把不可信事件伪装trusted。

真实流式SDK回复逐段更新：闭合前与闭合后的legion-plan从visible Markdown排除而raw原文完整可读；外部article ID不变、输入草稿/焦点与主动回看位置不丢。缺Lexer分支另标限定DOM合同：直接调用生产内容函数显示完整纯文本和加载说明，不当作真实UMD已加载证据。实际self module顺序/global Lexer以及renderer无Node/require另由生产app观察确认。

真实单项目鼠标down/up、focus/Enter时scrollWidth=clientWidth且scrollHeight=clientHeight，不产生瞬态bar；member Esc清selected并回原控件，静态1px内侧focus环仍可见。实际public ProjectService登记9个长目录后合法纵向scroll保持、横向不溢出，未通过全面禁overflow掩盖问题。Markdown表格/代码的局部滚动与960/1260、明暗主题的整页无横向溢出分别核对。

早期fixture期待误配（旧unknown-order前缀/current host与renderer poll、CDP Enter）保留日志，不退化为旧literal ** 样式。上述必要诊断不替代正式集成/UI：五文件冻结后用原fixedargv/budget各一次，当前结果读取[本任务](../../../scheduling/legion-ui-markdown-and-focus-v1.md)相同candidate且unchanged的CheckEvidence。完整旧UI/检查失败→独立验收→原owner返修/复验、A/B/idle/弹窗/nonce/映射/crypto/来源/proposal/draft/IME/reduced-motion、原Mac凭据拒绝与SHA转交仍保留；Windows明确未运行。

## 2026-10-09：完整角色持续记忆与成员对话

本轮独立 Tester 仅改派发的六个文件，没有修改生产、其他角色测试、角色权限或客户源码。当前生产输入包含实际安装的 0.7.0 新 tarball（SHA256 `f45fa15e8c0f195930c35c782904690ce7073680df1e4ec0d0ea6e80215bbad7`）和原 Owner 后续确认的成员名称 CSS 修复；其单元成绩不能代替本轮独立结果。已执行的局部实际诊断如下；最终相同候选的原配置 `integration` / `ui` 结果由[本轮任务记录](../../../scheduling/legion-persistent-role-context-and-dialogue-v1.md)中的当前 CheckEvidence 固定，不从旧记录推定正式通过。

| 独立实际入口 | 已观察的合同 |
| --- | --- |
| 原完整 Workbench / 实际 Pi SDK / 实际 Check | PM、RoleArchitect、Builder、Acceptance 继续携带本角色实际文字；原 owner 返修、新任务、PM/架构师重启和需求/职责 revision 变化保留连续历史。当前完整 purpose/revision/digest/owner/task 来自 Host 原样引用，旧工具不恢复。原权限、欠确认、过期、取消、真实自测失败、独立验收失败、原角色修复、输入变更使证据失效与返修次数断言保留。局部执行记录18个流程观察、114次受控请求、17条真实检查。 |
| 公开 Adapter Service / 实际 SDK | 当前实例/profile 的 fresh single_run 首次前一次纯文本恢复；错 profile/版本/旧实例、旧 tool、重复/运行中/结束后/取消后恢复均拒绝，历史 yes 不产生文件或授权效果。 |
| 真实 Host 自动摘要 / localhost SDK | 49152字符触发、96条触发、完整新18k Human 配旧45k日志、合并prompt/pins/history≤65536、超限拒绝但当前65000字符输入原样存档；2048输出限制、无工具、同实际profile、一次请求，实际30秒超时无重试。 |
| 成功摘要 / 持久原文 | 来源题目、a/b标签、真实 b 答案与补充语义进入摘要请求并在纯文本记忆保留；水位防重复注入与重复整理；角色记忆重启恢复、另一项目隔离；原消息逐条深比较不变。 |
| 失败与取消 / 公开存储 | SDK认证错误、8193超长输出、真实length-stop、tool输出、30秒超时、取消和同项目并发来源CAS冲突都不虚报新覆盖、不覆写旧摘要。旧输入容纳得下时有固定安全notice继续，容纳不下时明确prompt_budget；实际rename后取消仍返回已提交文档，磁盘digest一致，无遗留temp/lock。 |
| 迁移 / 真实磁盘 | 删除旧roleMemories字段后原raw digest合法才补空记忆；同raw digest但修改revision被拒绝，旧timeline保持。工作预算仍有限，不声称无限存储。 |
| 实际隐藏 Electron / renderer/preload/IPC | 五页签为任务、文件与上下文、成员、对话、记录；members ArrowRight严格经过conversation才到records。Sidebar打开成员、实际working入口打开对话，四角色共享所选成员及真实run；PM timeline与其他role journal隔离，host_briefing标明宿主数据。event节点、run选择、阅读位置、焦点、草稿和Esc保持。 |
| 实际成员来源与布局 | 固定三个ID在真实Approval/revision后仍系统角色；真实批准Builder为项目角色；实际旧owner迁移为来源未记录，无虚构run。长中文名完整显示，badge在名称下，avatar/activity及真实边界信息可见。两窗口尺寸/明暗/原Markdown/弹窗/映射/nonce/权限/滚动回归保留。 |
| IPC记忆元数据 | 仅实际统计字段和有限notice；无私有summary/source/checkpoint/SDK原错误，窗口/费用未知。 |

局部完整 UI、摘要11场景、迁移/系统来源和实际native事件已运行通过；正式集成和UI必须使用六文件最终冻结候选执行，失败或变化须保留证据并交回原Owner。所有新截图、JSON与本轮冻结manifest在 `.ans/runtime/legion-governed-workflow-v1/Tester/evidence/role-context-20261009/`；包括 `governed-flow.json`、`memory-flow.json`、`governed-ui.json`、`ui-working-role-conversation.png`、四个 `ui-actual-dialogue-<Role>.png`、`ui-five-tabs-small.png`、`legacy-role-origin.png`。对话与五页签截图已目视核对布局。

实际环境为 macOS、Node 24、Electron 44.6.0、已安装 Pi 1.0.4；本机HTTP模型响应受控，付费请求0。窗口hidden且只webContents.focus后发送native packets，证明Electron事件处理，不能说成OS物理输入。末端OS浏览器opener仍为明示spy。真实Windows ZIP/DPAPI用例在macOS明确未执行；客户主窗口、真实外部模型、SSH业务开发与发行发布由各自后续流程验收，本轮不作完成声明。

同轮客户新增要求隐藏成员列表可见滚动条。Tester保留原滚动/焦点回归，使用真实公开ProjectService/旧owner迁移创建长列表，经实际Electron滚轮及Tab浏览不可见成员，核对列表仍有合法scroll范围、没有占位bar、DOM身份保持；呈现截图为 `member-scroll-without-visible-bar.png`。正式输入包含原Desktop专属CSS修复，检查等待其Coordinator verify后运行；不以隐藏全部overflow取得通过。

### 首次正式失败与旧取消 Human 断言更新

首次当前候选 `c84cc6ed63a4e608e2a616145e31ad607c25264c4ad38add09e8fec779296dcb` 正式integration34项为33通过/1失败/0取消/跳过；失败日志 `independent-role-context-verification-1-integration-34a292ec.log` 保留。精确失败是旧 `workbench-flow.test.mjs:254` 的history消息条数7与旧6期望冲突，不是SDK会话计数。新完整需求合同保留取消轮次Human；原SDK取消partial仍不得伪装成已完成助手回复。首次UI同候选6项实际macOS通过、0失败/取消，1项真实Windows未执行，日志 `independent-role-context-verification-1-ui-eb7469de.log` 保留，38个原截图/JSON另存 `role-context-20261009/formal-c84cc6ed/`。

同固定Tester获得[单文件补充派发](../../../scheduling/legion-role-context-cancelled-human-assertions-v1.md)并ack后，仅改旧helper两处6条为7条，并增加完整Human原文/唯一性/顺序、SDK不恢复partial助手、原timeline保留partial事实、项目B不混入该Human及回项目A历史逐条相同的严格断言。主六文件和补充一文件统一冻结。补充原fixed integration必须当前通过并经Supervisor验证，随后主原integration与ui刷新同候选；最终成绩以主任务当前CheckEvidence为准，不沿用首次UI pass或改写失败。生产实现没有因该断言更新被修改。

补充第一次正式integration仍33/34，日志 `old-cancelled-human-contract-1-integration-b91b5451.log` 保留：取消Human原文/顺序/唯一性、SDK无partial与raw archive断言通过，之后Tester新增隔离断言错误地把已是数组的historyB写成historyB.messages。已在同一授权文件改为historyB.some，未改变断言含义；实际完整PublicFlows局部10秒复验通过，无生产修复。随后七文件再次统一冻结，仅刷新规定门。

下一补充正式日志 `old-cancelled-human-contract-1-integration-ee464811.log` 的33/34失败发生在旧read-plan模型回调prepareCandidate改catalog时，getState的真实读取碰上原子替换，正确返回context_changed；同输入局部此前通过，原日志保留。协调方明确授权同一文件必要fixture时序修复，现将prepare从模型HTTP回调移到现有send启动实际SDK之前。没有放宽变更拒绝、加retry/吞错误、改权限或生产实现；七文件再次冻结后刷新固定门。

时序移动后的 `old-cancelled-human-contract-1-integration-cca46f06.log` 继续保留：read-plan并发拒绝已解除，后续rival实例直接调用sendMessage而未经过send准备函数，导致旧候选未准备、无法得到draft。已补齐这个直接SDK入口的同一prepare步骤，原归属与stale确认断言不变；完整PublicFlows局部9.59秒再次通过。没有添加其他场景，七文件再次冻结后完成必要固定门。

## 2026-10-09：有界依赖交接的当前调用方证据

真实SSH的Core9文件90787bytes与28条自测通过是Root记录的业务历史；Renderer未启动SDK的prompt_budget也保留。原问题是宿主自动把父任务全部write body带入继任prompt。当前Owner候选 `c58fe890a5ee98a3e6f6fe95243797afeef3c13c6e64302ec30ec88e325f4de8` 经Supervisor验证：纯Model只返回六字段元数据，Pipeline按active.outputs真实完成顺序筛选依赖并保留每资源最新成功变更；write为实际UTF8 SHA，edit为实际result SHA或unknown null，正文不保留到自动交接。当前完整Human/canonical、原archives、权限/确认、预算及读取工具保持。继任必须自主读取当前磁盘，元数据不代替读取或真实检查。

已只读核对Owner当前[unit193日志](../../../../.ans/runtime/legion-bounded-dependency-handoff-v1/evidence/bounded-real-dependency-handoff-1-unit-6d3662d0.log)的12个实际受控SDK阶段及断言：父3文件>78k、重复write、check failed→edit→pass，child取得无body的最新edit SHA与完整Human/canonical，实际read获得全文/sha256，写自己scope、自测与Acceptance通过。[Model33日志](../../../../.ans/runtime/legion-bounded-dependency-handoff-v1/evidence/bounded-real-dependency-handoff-1-model-25b44b51.log)与unit同candidate且unchanged。早期1510e5ca/0663aea9 OOM来自新增Owner夹具接口与重复callId错误，现实际字段text/sha256/expectedSha256、unique call IDs及fixture-only24请求上限已修，原191断言、heap/time及生产预算没有放宽；这些失败仍是历史，不能算生产或Tester通过。

独立Tester本任务只更新三份自己的设计/验证/changelog；已有四份测试与生产只读，不重做Owner案例。前一Tester候选6d48的正式integration34/Mac6、Windows未执行及所有失败日志仍保留，依赖输入改变后不能沿用。三文档冻结后通过[本次正式任务](../../../scheduling/legion-bounded-dependency-verification-v1.md)原fixed integration/ui刷新，当前同candidate的CheckEvidence及完成报告给出实际计数；未执行/失败不改成通过。

本次冻结manifest及生成证据归档位于 `.ans/runtime/legion-governed-workflow-v1/Tester/evidence/bounded-dependency-20261009/`，原角色记忆截图/JSON在运行只读测试之前归档，防止既有输出路径覆盖旧候选。实际macOS/Node/Electron/localhost覆盖边界保持；Windows ZIP/DPAPI未执行，外部模型与Root重新开启真实窗口、由新PM重新确认的SSH后续执行不是本角色本机门的成绩。旧grant不续用，Tester不修改客户Core源码。

## 2026-10-12 项目指挥台 v0.3 当前独立验收

Human接受65文件补齐配置86dccc571af65c3466dc60c8e3fcb4d3b8259c4f38298684eb7c303bbc092c2a，Tester精确9文件、固定installed/regression/gui各300秒。当前runtime1.2.0真实fresh tar SHA b13e830a94ee5f07a2e256c0591302a99236ce10da220604d97032127b952c82，Desktop0.3.0；旧1.1.3包与证据只读，不挪用旧GUI成绩。

安装保留14场景/三协议、双draft旧A精确stale与B新Human答、同PID取消后真实HTTP2、owner串并行与转交/Check/独立Acceptance返修/known-key/旧Human迁移。新增实际macOS Electron+Playwright两E2E：无连接→真实加密配置、六viewport/theme(1440x900/1280x800/900x700深浅)与Tab/Enter/Escape、真实轮询1秒的焦点/选区/草稿持久、普通文件预览不改context；实际PM原question/choice→完整当前Host确认→两owner真实HTTP同时在途→执行中文件/状态/两页固定snapshot日志只读与Su变更工具硬拒不撤权→Mutation/Check/独立Acceptance失败→原owner返修通过→partial取消同Host继续。客户查询核源持久字节不变，私有member assistant/briefing/key不入IPC/DOM；日志使用有限公开投影。

本次新包/fixture/userData/proof/截图均在.ans/runtime/legion-desktop-command-center-v1/Tester/fresh子目录。截图manifest记录应用PID、物理workspace realpath/dev/ino、viewport/theme/scenario/包SHA/imageSHA，并逐张人工看实际截图；不能用HTML原型替代真实窗口。固定旧generic_agents/permission_flow/shell_flow等五harness随机临时fixture遵Governance解释：每门前核原Tester已接受根无链接、只mkdtemp随机子目录、不覆盖稳定历史，其源码只读消费当前产品。

所有9文件先定稿冻结；结果仅用本图task_ops当前candidate/candidateUnchanged与三份固定日志报告，尚无当前结果时不得complete。新增macOS场景无skip；旧Windows ZIP/nativeChooser/DPAPI原用例保留并在macOS单列unsupported，不计通过。Windows发行、付费外网、旧最终Shell GUI验收仍未完成；旧整仓库observer治理pin限制保留，不声称恢复。

默认共享~/.legion-project-leases仅清本次已捕获workspace/source/dev/ino/marker字节并已关闭跟踪进程的精确项，不替HOME、不改生产共享根。历史未知85f6cbb5d433668ee49ccc7b161b39791e434edcd1ae451c1e83bef2011f89b5.owner-source.json与y3的3d85c08cf8d7485e85864710c081387c685be760e739a2e64d3d36591f1a400b.owner-source.json保留；未知holder/commit.lock不删。生产问题给原owner修，Tester只修自有fixture。

## 2026-10-12 66范围 UI修复当前验收

新图legion-desktop-command-center-v1-ui-repair-integration，Human接受66配置SHA85c6197ccad1a0b67454a42966b3fce53d701170c41092a9fdc4b355a5b37366；Tester10文件(原9+ShellWorkflow)正式派发，生产只读。当前fresh runtime1.2.1/Desktop0.3.1包SHA9dfdd564d67e3ae46d7a2abeb075d26fa25a1768b9e46bbba0948d7171ab1b6e、当前package-smoke/lock与安装身份为输入，旧1.2.0 tar/四布局图/900失败图/首屏IPC proof只留历史。

ShellWorkflow完整PM review理由/实际原角色Shell结果/stdout/candidates/publishedResources/partial恢复，从本次物理fixture userData私有Org JSON核顶层digest及typed shellWorkflowDocument；只供Tester核原文件/sha/binary/执行位/墓碑/owner/旧Human许可拒重放/CheckAcceptance，绝不合回公共IPC。公共getState核精确安全摘要，queryProjectFacts(changes/checks/acceptances)和queryProjectOutputs以limit1真实分页核sourceRef→Shell entry/角色/资源可追溯及只读后private Shell source不变；恢复前后完整旧partial result不可变强断保留。

GUI在900实宽直接点击mobile-nav-toggle显示真实sidebar，点击theme/AI设置，Escape真实归还焦点，导航回Su保留draft；不宽屏先切主题、不force隐藏DOM。真实1440x900/1280x800/900x700深浅六图及900AI设置图均记录当前包SHA/应用PID/viewport/theme/workspace身份/imageSHA逐张人工核。首屏真实omitted cursor查询正常，空cursor负例仍拒；实际DOM无首屏stale_cursor/invalid_input、rawnot_recorded，初始无plan保存连接文案不误报旧计划已失效。实际模型连接probe、PM原问题/choice、完整当前Human确认、两不同owner真实HTTP同时在途期间文件/状态/两页日志及Su变更工具拒绝不撤权、Mutation/Check独立Acceptance失败返修、partial取消同HostContinue原文强门保持。

原14安装和40回归完整保留，macOS新GUI不得skip，旧Windows ZIP/DPAPI单列unsupported。固定旧harness五项仍只旧批准根默认Tester新mkdtemp随机fixture，门前核普通无链接；所有新CLI/GUI/截图/proof/cache在本阶段Tester fresh目录，不覆写历史。10文件正文冻结后本图installed/regression/gui各300秒三门必须同candidate/candidateUnchanged实际通过才complete。当前結果只以本图task_ops记录为准，诊断门或旧通过不冒充最终验收。未知85f6与y3 3d85 marker/旧observer治理pin/Windows付费远端和旧ShellGUI最终验收限制继续如实保留。

## 2026-10-12 同66范围 Su标签修复 / 当前1.2.2候选

新图legion-desktop-command-center-v1-su-label-repair-integration，Tester10文件承接停止的1.2.1 partial；冻结设计e6cf4a93…及66配置85c6197…保持不改。fresh runtime1.2.2/Desktop0.3.2 tar SHA773da2d1dbb58b7a9ff251e14f1cf80281a8b9286348d7a864589dd92832eef2、当前package-smoke/lock为安装/GUI身份输入，不使用旧包或旧截图作为当前验收。

真实GUI客户所有assistant avatar/name必须Su，PM原问题显示Su转达；实际question/choice/完整原Human/当前Host确认强门保持。send在真实DOM按钮可用后用Meta+Enter，安全记录按键meta/ctrl/activeElement/disabled、旧turn/http计数和可见状态；失败记录实际publicState/输入草稿/HTTP计数，不以API先终态假设UI已解锁、不sleep/盲retry。1.2.1旧失败的plan Human未落入Host archive/无新HTTP与委托，事件瞬态未记录，未擅定产品快捷键坏；保留真实失败证据。

原六尺寸主题、900实宽顶部导航/主题/AI连接/Escape/focus/草稿与全部14安装/40回归强门保留，Shell私有validated journal/公开安全分页双证不回填IPC。新GUI新增Mac场景不skip，WindowsZIP/DPAPI仍unsupported；未知lease marker/旧observer pin/付费远端与旧ShellGUI限制不变。10文件定稿冻结后仅当前三门installed/regression/gui同candidate/candidateUnchanged可报告complete，三门遵task_ops全局锁窗口。新截图仍本阶段fresh，逐张人工核manifest PID/viewport/theme/包SHA/imageSHA，不挪用旧1.2.1八图。


## 图片输入 v1 独立验收（当前候选）

输入包为 runtime 1.3.1/Desktop 0.4.1，终包 SHA256 `555a4184456d6457674ded591e7dea3098cdb6b3fed4ad408c782019813dae46`。固定 installed 保留生产 CLI 14 个文本场景；integration 在真实 Electron SDK 上覆盖三协议 Su 图片→可信 Human source→PM 像素与七字段 task.imageRefs→当前完整确认→worker 网络像素及实际 Check/独立 Acceptance。普通 DTO/私有 sidecar 只存引用，像素由项目普通文件重核加载。unknown/unsupported 拒绝不得新增 HTTP，预览与草稿可继续使用。历史重启、跨项目、篡改/缺失和预算均保留拒绝断言。

GUI 继续两个真实 macOS 用例及完整双 owner/返修/取消续轮，加入原生剪贴板、文件选择、DataTransfer 拖入、预览移除、纯图与历史预览。截图均为本阶段 fresh desktop-image 目录，manifest 记录 PID、尺寸、主题、终包 SHA 与 imageSHA。固定三门最终结果及日志 SHA 在 fresh generated 报告记录，未跑结果不作通过声明。Windows ZIP/DPAPI/原生 Windows picker 与付费远端模型未执行；旧整仓库 observer 治理 pin 限制及两个身份链不全的历史共享 marker 继续保留，不据本次结果宣称恢复或删除。

SDK省图负例向真实已安装SDK传入两张已核SHA的有效图片后，受控删除SDK images；Adapter guard 的 image_omitted 按已批准安全白名单规范为公开 internal_error。断言必须是当前turn.failed、精确internal_error、一次故障注入、零新增HTTP、完整Human原文与七字段引用及可读草稿图片保留，不能接受任意错误。恢复与本轮合计超过8张或16MiB的Host前检允许精确image_budget（或Adapter image_request_budget），要求客户可读提示及零新增HTTP。

真实Electron剪贴板使用44版ClipboardItem API：写入前将全部可读类型仅在当前main进程内克隆为Blob快照，读取失败则不写；finally只在当前内容仍是本fixture已知像素时恢复原快照，客户剪贴板内容不返回测试进程、不持久化。GUI正例用实际File经Host stage生成ref的SHA/bytes与SDK网络decoded bytes比较，按有效像素核验；不要求nativeImage最初PNG压缩字节等于系统剪贴板重编码字节。首旧API失败未写剪贴板；其后未快照诊断轮为环境效果限制，不能倒推恢复更早原内容，保留该轮证据，最终验收必须使用快照恢复的新候选。
