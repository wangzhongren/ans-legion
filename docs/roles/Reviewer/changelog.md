# Reviewer变化历史

## 2026-10-07 Workbench v2

同已确认canonical与固定Reviewer职责，新增本职责设计/当前报告/7项有限Workbench测试；精确适配原22/8至冻结primaryOwner与v2角色生成目录、公开façade、29项Node包、两主页和完整当前ZIP。未修改生产、其他owner测试、治理或旧历史产物。

首轮Node适配21通过/1失败/0skip：本测试误写owner缩写Adapter，而冻结真实ID为AgentAdapterEngineer/KernelEngineer。保留[观察](../../../.ans/runtime/legion-desktop-workbench-v2/Reviewer/node/packaging/development-observation.json)，修正为精确ID；全部22原测试名称与核心安全断言保留。旧Desktop8适配首次实际8/0/0通过，包含本机Electron/DPAPI与当前包检查。新增7与最终两approvedchecks以同候选task_ops日志为准，本文件在最终运行前封存。

GUI v1历史首轮4/4、第二6/2及原fixture日志不变；第三个超1MiB记录与premature进程退出的Reviewer假设已当时纠正。旧v1八项有限通过并非客户最终满意验收。旧Python23项两P1失败/修复通过及Node22的close-repair/fixture兼容历史分别保留。

正式首轮证据：node-unit22/0/0；desktop-unit15项9pass/6fail/0skip，日志reviewer-1-desktop-unit-acbfd2cb.log/SHA3c31d8b3083e8eff5c2880f30ca3611945f72f475bda8343852abbb5597ee5b7。Reviewer自身两处准备假设被纠正：嵌入Core只枚举Node .mjs产品，不含历史Python；turn completed后还须等待draft实际构造。核心断言/名称不变，原日志保留，正式两checks须重新核同候选。

## 2026-10-08 完整治理工作流独立评审

只改派发的八个 Reviewer 文件。旧成员表和无 checks 完成契约已改为批准的持久成员、当前 nonce 执行确认、真实开发自测与独立 Acceptance；原审批/权限/IPC/取消/包字节安全断言保持。纯 Model 允许校验输入日期和确定摘要，不读取当前时钟；独立检查仍拒绝 IO、随机和业务调用。

已正式 ack，并运行三轮 `structure`。首轮工具沙箱阻止 localhost、seatbelt 与 Electron，属于环境未执行，不能作通过证据。第三轮本机实际 49 项：44 pass、4 fail、1 Windows 平台未运行，源码候选一致。未通过的四项分别是 workspace 旧 boundary.version 硬编码导致角色/任务观察不可用（Desktop owner 已报 issue），以及 PM README 与尚未重装的 0.7.0 包字节差异（发行迭代待复验）。新增有限 fd3/空测试回归后需重新固定检查。当前状态见[报告](docs/review-governed-workflow-v1.md)。

第四轮本机固定检查50项：45pass、4fail、1Windows未运行；新增空测试/fd3回归实际拒绝通过，余R1/R2不删断言。日志与精确候选见报告，当前是issue，不是complete。

恢复同一assignment后，第五与第六轮各50项49pass0fail1Windows未运行。R1已由授权原owner helper修复，R2由PM刷新0.7.0；原失败证据保留。现有隔离副本测试新增未知boundary revision与匹配Markdown的未授权scope负例，均拒绝并可恢复批准读集。更新报告后需最终固定structure，使文档与源码同candidate。


## 2026-10-08 冻结候选有限最终评审

正式final-review重新ack，仅修改四份Reviewer文档，四个结构测试只读。审阅current timeline同queue事务CAS与真实锚点、legacy顺序未知、实际propose后安全error.payload.pendingProposals、8192/180000有界预算及当前0.7.0发行字节。读取owner当前verified Model26/unit121、Adapter72和PMpackage5证据，未冒称Reviewer重跑这些检查。新任务首轮structure50项49pass0fail1Windows平台未运行，candidateUnchanged true。文档冻结后最终fixedstructure与145readSet/只读测试SHA前后对比由正式task记录；Supervisor独立verify。

原workspace版本/包字节失败和此前阶段49pass历史保留。Tester最终集成与原生窗口另行验收；DeepSeek稳定和下一轮SSH功能未独立验证。新增ProductManager及商业UI方案尚未确认，不计入本轮交付。


最终complete曾因Tester新真实长prompt失败暂停，正式progress留存。原owner修复完整DTO67,733超过65,536输入cap问题，UI台账完整、模型当前事实投影、历史省略明确、四入口严格cap/不静默截所选context、启动拒绝不留running；原owner125unit正式verified，Model包含在unit而未单独分派。Tester完成本范围夹具契约修正且Scope/Cancel/CAS/返修上限不减，临时31int和2MacUI通过、1Windows未运行后十二文件freeze。Reviewer四测试只读SHA不变，仅更新四docs并按刷新145readSet重新固定structure。旧结构/诊断和原失败历史保留，不当当前全产品pass；新ProductDesigner另行design-only。

## 2026-10-09：及时雨 / Handwell 最终 UI 审阅

正式 `legion-ui-handwell-final-v2 / ui-review` 已 ack，客户批准配置 SHA `64f2679ac901bf72bf704e54ef44dc9807d49e21b95606d513697cf6017d9220`；Reviewer authored 范围只有本 changelog 和 [当前审阅报告](docs/review-governed-workflow-v1.md#2026-10-09及时雨--handwell-最终-ui-独立审阅)。原结构测试、生产和同行文件只读，旧候选与原失败不改写。源级对照 private baseline：宿主只改 title/background，CSP/IPC/公开层次/许可/nonce/取消/凭据边界保持；UI 使用真实成员/DTO、全成员既有映射、完整 scope/checks/Acceptance/返修及来源历史，没有原型七人名单或模拟场景进入生产。

原 A 实际 summary→BODY 与 final-v1 正式 B submit→BODY 均保留失败证据，原 owner 最小修复后 source 与独立 actual-UA/真实 host JSON分别观察 SUMMARY/BUTTON；主动焦点不抢回，stale不复活旧submit。成员waiting专用标等待任务、waiting_answer标答复，aria-current补齐。原 owner 当前Model26/unit139（candidate8cce0898…ede1）与Tester正式integration31/UI4实测通过+1Windows未运行（candidate6aafe99a…26f）分别属于其 producer，Reviewer未冒称重跑。两份文档冻结后仅运行原样 structure，实际结果/候选/log与unchanged由 [final-v2任务](../../scheduling/legion-ui-handwell-final-v2.md) 的 ui-review 当前 CheckEvidence 固定；仅在通过且输入当前时 complete，由Supervisor verify。

本轮结论限当前macOS及实际有限场景；WindowsZIP/DPAPI、外部模型稳定性、客户SSH功能验收和GUI发布不因本轮通过自动完成。A受控DOMfacts用例仅证明生产Renderer在真实UA的焦点合同，不与三个真实宿主UI用例混称。

### final-v3：导航兼容修复与 fresh 结构 gate

final-v2 原固定 structure 工具沙箱38pass11fail1Windows未运行，本机48pass1fail1Windows未运行，两个原日志/SHA与candidate a0528d3b…ac78保留在报告。Reviewer定位欢迎设置CTA第三个data-page与原严格两导航合同冲突，正式issue并stop；没有修改readonlytests。原Desktopowner移除该CTA标记、其既有id专门点击仍navigate(settings)，保留两个导航/aria-current、所有视觉功能及A/B/闲置/权限语义。当前ownerModel26/unit140全pass0skip，candidate5595c707…3c34；Tester一次fresh integration31/31及UI4pass1Windows未运行同candidate9377a844…da14且unchanged，全部旧失败留存。

正式 `legion-ui-handwell-final-v3 / ui-review` 新assignment已ack，仍只更新两份docs；冻结后直接用原approvedstructure命令在已授权host真实运行，current结果/候选/log由 [final-v3任务](../../scheduling/legion-ui-handwell-final-v3.md) 最新CheckEvidence及complete固定，Supervisor核验。当前scope继续限macOS有限场景，未发新GUI包、不将controlledDOMfacts冒充host端到端、Windows/外部模型/客户SSH功能验收不计入通过。

## 2026-10-09：Markdown 与导航焦点纠错

客户纠错三项可见问题后，Reviewer正式 `legion-ui-markdown-and-focus-v1 / ui-review` 已ack，范围仍只有两份docs，原readonly structuretests/断言、source/包/lock/治理未改。本地锁定prod Marked Lexer→固定DOM/textContent、rawHTML/图片不自动载入、双侧安全HTTP(S)与实际mouse/Enter精确目标一次消费、keyUp只读队列撤销、CSP/WBIPC/取消保持已作必要源审。project/member专用内侧1px焦点/静态press，Esc清selected且回trigger；两导航及A/B保持。没有发现本轮明确新安全或结构阻断。

owner当前Model26/unit151同candidate cef4d283…c578全pass0skip；Tester一次原样integration31/31与UI5pass0fail/cancel1Windows未运行，同candidate da99a24e…20ef unchanged且Supervisor verified。Reviewer读取正式日志/新markdown-proof，区分真实生产app/SDK/IPC/DOM与native输入、受控OSopener/messageBoxspy及有限missingLexerDOM合同，不宣称实际浏览器网络打开或新ZIP。两个docs冻结后原fixedstructure直接已授权host执行，实际count/candidate/log/SHA/complete由 [本任务](../../scheduling/legion-ui-markdown-and-focus-v1.md)当前记录固定。旧A/B/导航/其它失败及所有历史成绩保留，Windows/外部模型/客户SSH功能验收不计入本门通过。

## 2026-10-09：角色持续上下文与五页签当前审阅

正式 `legion-persistent-role-context-and-dialogue-v1 / role-context-review` 已ack并重新加载Reviewer边界/层/evidence；只更新两份文档，原只读结构测试与生产不改。冻结requirement是PM文档逐字保存的已确认角色上下文v1，原ddc9批准政策不变。必要源审确认project+role记忆/水位/CAS、current canonical pins、纯文本当前实例恢复、旧工具/yes/check授权不复活，原archive保留，Host briefing为数据；早报预算预留、统计/noticeWire、Provider取消提交门均已修。新未听Human（active或已completed PM）逐字保护，最近16k目标不替代完整当前需求；摘要同actualprofile一次2048/30s、失败/length/tool/cancel/CAS保旧，65k总budget仍硬拒绝。五tabs/sidebar→成员/working→对话、来源诚实、稳定焦点/阅读与长名/隐藏bar合法scroll保持。

Adapter75、PMpackage6及f45fa15e…新实际0.7.0安装、Desktop主33/191与后续CSS各自191门、取消Provider补充各为当时producer证据，源变化后不冒称当前同候选。最新独立Tester同candidate6d48eec6…c447 unchanged的integration34/34、MacUI6/6+1Windows未执行已Supervisor verified；正式log90c5bc8a/ab73e203的SHA与覆盖见 [本轮报告](docs/review-governed-workflow-v1.md#2026-10-09角色持续上下文五页签与来源的当前独立审阅)。旧34a/b91/ee/cca失败、旧formal-c84cc6ed和原deny断言保留；授权helper在所有SDK入口前prepare，当前fresh门含真实最终输入。

两docs冻结后只运行原fixedstructure，实际当前候选/结果/log由 [正式任务](../../scheduling/legion-persistent-role-context-and-dialogue-v1.md)最新Reviewer证据与complete固定，Supervisor最终verify。Windows、外部模型、SSH业务开发及新GUI发行未因本门通过自动完成；真实Electron native packets、限定DOM与OS opener spy范围保持诚实。

### 主Reviewer attempt2与三个旧检查合同更新

主attempt1 structure46pass/3fail/1Windows未执行，candidate7ddcd7aa…c89fb与原cc6d7754日志保留；三失败是旧TGZ路径/旧包对新source比字节及取消后期待空Human。正式issue/stop后按同ddc政策另行精确三文件补充，只改既有Reviewer检查：新f45fa15e…TGZ路径/pin/integrity/37源码SHA与installed逐byte、完整取消Human唯一/原文/raw partial保留而SDK无partial/tool/authority恢复。原50case、其他deny/scope/assert/skip/argv/timeout保留，源码和旧TGZ不改。

补充candidate5740558a…5269同structure49pass/0fail/cancel/1Windows未执行、unchanged，fcf99cc6日志SHAee6bf422…eaed，4.117秒，已Supervisor verified。主attempt2重新ack，只更新主2docs并冻结后同原structure一次；当前最终结果/candidate/log由 [主任务](../../scheduling/legion-persistent-role-context-and-dialogue-v1.md)当前证据固定，不用补充或旧owner成绩冒充。此前必要源审无明确阻断，未添加新源码、新功能或可选测试。

## 2026-10-09：依赖交接正文超预算修复

Root实际Core9文件90787字节/28自测通过后，Renderer因为全部dependency正文自动入prompt而预算拒绝、未调用SDK；九文件与原日志保留，不冒称整SSH完成。Owner仅七文件必要修复，write临时正文→纯Model真实UTF8 SHA→六字段metadata再存outputs，edit实际SHA或null；跨parent按真实完成Map序latest，不按dependsOn排序，child既有ordinaryread取当前实文件。原65k、Human/canonical/archive、scope/nonce/失败父依赖与真实evidence保持。Reviewer已定向复核两个WIP问题修正，无明确链路阻断，未改客户源码/运行客户程序/GUI/真实模型。

Owner最终c58fe890…f4de8的Model33/unit193 verified，新actualSDK超过78k/重复write/checkfail→read/edit→childread/selfcheck/Acceptance回归与focused1/1、12阶段trace属其证据；两OOM历史与fixture修复保留，原191断言/生产预算不弱化。Tester同current20ec7a20…b26b的integration34/MacUI6通过、Windows1未执行且unchanged，日志788342af/bdcb64af SHA见 [本轮报告](docs/review-governed-workflow-v1.md#2026-10-09依赖交接正文超预算的必要修复审阅)。本次正式Reviewer只有2docs可写，冻结后同原structure一次，实际count/candidate/log由 [本任务](../../scheduling/legion-bounded-dependency-review-v1.md)当前证据固定。源码/tests/旧TGZ/原失败只读，Windows/剩余SSH业务及外部模型不因本门自动完成。

## 2026-10-10：项目Shell当前有限最终审查

先完成五test阶段：严格当前包/公开层边/完整inventory/Host一次consume/PM-only真实SDK factory/持久CAS/新Human恢复结构；首51项47pass/4fail日志82e9620b保留。Reviewer fixture兼容修正保留局部2/3fail和3/3pass。原纯度门发现Core/Shell三个Date.now读取，issue/stop交Kernel修显式observedAtMs；原断言未弱化，当前0.8.2与调用方重验后两门51/51、50/50。

Tester真实GUI另发现absence Wire、activity Esc样式和正确binary无diff恢复三项；Desktop原owner必要修复后Reviewer仅补一个受影响测试的Wire正反例/来源与current reverify断言，兼容candidatebc94085b…e7238，两门51/51、50/50全0fail/skip/cancel。旧失败截图和旧partial保持。

当前Testerverified候选87167ead…a2f25f：Shell25pass/1Windows未执行、integration34/34、UI6pass/1Windows未执行、requiredMac7/7、Node295/295、Desktop244pass/1Windows未执行；同candidate且unchanged/无timeout，日志SHA经Reviewer实际核对。正确asset bytes/inode不变、无新assetcandidate/Mutation、旧partial全字段不变与新Human/currentchecks/Acceptance真实恢复均在当前fixture中验证。受控localhost模型服务不能当外部provider或SSH业务验收。

最终阶段仅八份Reviewer docs，当前五tests/source冻结，之后原shell/regression_structure结果由当前任务reviewer-final记录；完整证据和平台限制见[项目Shell最终报告](docs/review-project-shell-v1.md)。缺Windows历史ZIP/descriptor、GUI/DPAPI均未执行，Mac旧0.7实际archive不作替代。

## 2026-10-11 CLI v2 / npm 1.0.3 独立最终审查

合法 `reviewer-cli-1` ack 后只修改六份派发结构测试与 [CLI审查报告](docs/review-cli-v1.md)。旧任务writeSet/旧scope子集、旧包0.8.2和工具清单fixture迁为schema2、角色完整owned清单、typed memory/Supervisor与当前102文件tar；保留原安全断言及失败日志。新增真实Headless输入/跨delta工具密钥拒绝、私有文件扫描、Check/Shell写前门、提交前legacy/转交/marker/mutex拒绝及同字节检查过期。固定structure已64/64通过，收口后最终同候选证据见当前派发记录。未修生产或自verify/dispatch；有限known-key、外部TOCTOU/子进程自构、旧治理观察器unavailable、GUI暂停及早期未知marker保留在报告中说明。


## 2026-10-11 Su 1.1.3 channel/CAS 修复独立结构门

承接旧stop partial，原8文件范围内对齐当前1.1.3包/lock，保留真实cancel→同Su实例HTTP2继续强断言；当前正常流程明确preflight/monitor缓存渠道与su_customer水印不串，失败plan后立即新Human草案及旧PM History原字节只读。原分页/PM两问/owner/key/lease/commit/Shell检查保持。fixture/报告定稿后执行当前图固定structure；旧69/68失败停证据不作为通过结论。当前最终证据见role-memory-race调度记录；未修生产或自行verify/派发。


当前1.1.3固定structure收口前69/69实际通过；旧69/68取消失败已由原Host修复并由原真实SDK强回归验证HTTP2/同实例/无partial续轮。真实后台channel、失败后立即新Human/current Host确认、旧PM History原字节及当前Desktop lock/安装99源码身份核对纳入最终门；最终同候选日志/candidate见role-memory-race记录。全部失败日志保留，未新增GUI/可选审计或改其他owner文件。


## 2026-10-12 项目指挥台当前结构与私有边界

合法65文件补齐配置派发，只改本角色10文件。迁Node1.2.0/Desktop0.3.0包/manifest与安装闭包；当前Reviewer harness效果迁本阶段fresh，未派Shell-workflow仅保留Governance接受旧fresh例外。真实macOS当前指挥台结构/有限IPC/隐私投影、旧observer实际unavailable与合法隔离拒篡改/任务来源、原owner/lease/CAS/Shell安全门待当前固定structure实际验收，Windows旧用例保留unsupported。未改生产、治理或Tester，不自verify/派发。


## 2026-10-12 Su-label 1.2.2当前候选

承接旧UI图77/80 partial，只原R10，当前runtime1.2.2/Desktop0.3.2包、lock、安装99源码迁新smoke。隔离observer两失败根因是Supervisor旧tuple无空行接嵌套metadata，改旧9顶层key截基础tuple保留available/拒伪scope强门；真实旧observerunavailable与旧日志保留。当前七IPC查询/私有边界/在途Su不撤权/真实macOS900可发现导航/包身份固定structure待同候选实际结果，GUI完整验收归Tester，Windowsunsupported。未改D/T或自verify。


1.2.2取消fixture两样本证实Host捕获与drain两个合法私有终态竞速；原强断不放宽。经Supervisor授权，真实首su_customer日志已持久化后仅延迟其Service返回至实际cancel signal，以有界屏障确定复现interrupted/run_cancelled；实际SDK/两HTTP/同实例/零partial仍保留。当前最终结构候选定稿冻结，待T固定门释放。


## 1.2.2 / 0.3.2 结构门真实闭合

当前f5e18085七入口structure80/80、exit0、candidateUnchanged；两个observer fixture及取消私有终态竞态由本角色精确修fixture，原失败留证。真实有界beginMemberRun持久返回屏障固定Host interrupted/run_cancelled，实际SDK/HTTP2/同实例/零partial不替代；公共private-body隔离与Windowsunsupported保持。两份Reviewer报告关闭本轮结构待验收状态，非TesterGUI全验收；文档冻结后最终同候选structure由当前Su-label task记录，未加可选测试或改产品/他人文件。


本轮取消fixture最终采用实际terminal两条源码来源精确双证，移除晚装无效prototype wrapper，不追逐单常量、不mock SDK、不引入新hook。Host captured=interrupted/run_cancelled，drain=cancelled/null，身份/事件时间/空text/零assistant、公共cancelled/HTTP2/sameinstance/续completed/零partial强断保留；旧f5e80/80仅自然Host样本，旧文档后79/80失败保留。最终同候选structure待T安全窗口。
