# Workbench v2独立有限审查记录

2026-10-07，固定Reviewer；任务legion-desktop-workbench-v2-fixture-repair/reviewer-1。仅本职责九文件，生产与其他owner证据只读。依据[accepted canonical](../../../design/2026-10-07_design_desktop-workbench-v2.md) SHA715639b5dd278437059f29bde1e7c02ac90d94af18f9bf5a6b5367d16e9ab5d3、config2546ebd0…、[desktop-workbench合同](../../../../.ans/contracts/desktop-workbench.yaml)及冻结ownership87808cec2739fdbbc9520631637b4ddcb2adc2f8680a6e849ec8885d01a35187。

实际结构为纯Model共享、Interface→唯一WorkbenchPipeline→公开Desktop/Kernel/Adapter Services→本层Providers；无旧Core Interface/peerPipeline调用。公开workbench-models显式30值/纯authority导出，lower mutationAuthority只有consume/recheck/release，SDK与密钥只在main。模型协议使用实际安装Pi1.0.4；本轮受控localhost不收费。原22与8所有测试名称保留，新7有限检查覆盖：

| 范围 | 有限目标 |
| --- | --- |
| Node22 | primaryOwner先rawSHA、24源层边/纯Model、旧P1、raw/forged/replay身份、控制面、审计与SDK隔离、29包项 |
| Desktop8 | 36源/相邻public、exact IPC、safeDTO、真实完整任务记录/双审计、篡改与stale时间、legacy CRUD、native sandbox/DPAPI/重复close、ZIP与嵌入Core全部字节 |
| Workbench7 | branded read/保留审批/永久撤权；唯一PM双轮无工具及无确认零workspace写；确认真实文件/审计与安全历史重启；写前context变更整plan失效；队列阻塞时入口stop同步撤权；in-flight确认close；无输出task失败；cancel_turn后可继续 |

当前PM ZIP是LegionDesktop-0.2.0-win32-x64.zip，194645336bytes，SHA755e0950cbc2b44beb1d1888a19d85995ae781a2aedd36d3bce11bb3afbf6f56；descriptor SHA3465ff334e903f3a58fff112d0a206063a58cfb4ee0db708d71a85744e859b8b。Node0.4.0 TGZ29项SHAf3114a19205b69542c5629cfbb4a2664e9aebc62fc81f76a69d332e6f922140c。测试读当前真实descriptor再核产物，未来合法重make不依赖上述历史常量。Core源码聚合fa803823…为本轮PM输入身份，PM成绩不替Reviewer独立结果。

已实际开发检查：Node22首次21/1/0为Reviewer期待角色缩写错误，已严格修正并保留观察；Desktop8首次8/0/0。本文和六docs于最终approvedchecks前封存，不预称新7已通过。最终node-unit22及desktop-unit15的真实计数、候选与日志SHA由[同任务两次check事件及完成回执](../../../scheduling/legion-desktop-workbench-v2-fixture-repair.md)提供。未发现已复现生产契约缺陷；只有这两固定检查通过且Supervisor核验同候选后，recommend推进独立Tester。

保护基线75文件见[protected-before](../../../../.ans/runtime/legion-desktop-workbench-v2/Reviewer/node/packaging/protected-before.json)，结束复算保存在同目录protected-after.json；原22/8源备份、首次观察、native proof在本角色生成目录。普通ActionProposal .ans硬拒绝、旧requiredApprovals不消失；task目标与SDKrun状态分开，checkStatus仍not_executed。

局限：词法层边和有限公开调用不能证明所有潜在OS竞态/宿主攻击隔离。两个Node链接测试是lstat元数据拒绝分支，并非本机junction/reparse端到端证明；native8的DPAPI为同进程真实加解密及窗口重开，不声称跨进程重启密钥验收。新Workbench加密使用测试本地lower-infrastructure替身，SDK/HTTP/文件/审计是真实。未重复owner三协议全矩阵、完整Node回归、发行ZIP启动/视觉；独立Tester后续负责。记录预算16MiB/4096events/64MiB refresh，不截断伪成功；旧1MiB三项unavailable只是当时reader上限，不意味着历史task失败/损坏。旧GUI/Node历史只读保留。

正式首轮证据：node-unit22/0/0；desktop-unit15项9pass/6fail/0skip，日志reviewer-1-desktop-unit-acbfd2cb.log/SHA3c31d8b3083e8eff5c2880f30ca3611945f72f475bda8343852abbb5597ee5b7。Reviewer自身两处准备假设被纠正：嵌入Core只枚举Node .mjs产品，不含历史Python；turn completed后还须等待draft实际构造。核心断言/名称不变，原日志保留，正式两checks须重新核同候选。

## 2026-10-08 项目级读取 v1 审查增量

本次 Reviewer 派发为 `legion-project-wide-read-v1-final/reviewer-1`。已检查 Kernel 路径规则、Read Service 与 Storage Provider，Pi 受控工具，Node Runtime 默认关闭读取的 opt-in，Desktop 的 PM 与执行成员读请求协调、运行/项目失效，以及 0.5.0 包公开入口。Reviewer 只更新自身两份测试和本记录；生产修复归 Kernel owner。

**已复现的阻断问题：** 初始 `normalizeProjectReadResource` 只拒绝指定控制目录、`.env`、私钥后缀和几个私钥文件名。项目根 `.npmrc` 内的隔离假令牌可经 `createReadService().readFile()` 返回 `status: read` 与完整文本。`.netrc`、`.pypirc` 和 `.ssh/`、`.docker/`、`.kube/`、`.gnupg/` 路径同属需核对的常见凭据路径；新增 Reviewer 断言要求根目录列表隐藏它们，直接读取及嵌套大小写变体均返回 `restricted_resource` 且无正文。初始候选不满足这些断言，不应标记 Reviewer 通过。

旧 Reviewer 断言已跟随已实现的公开合同更新为 27 个 Node 源模块、32 项 0.5.0 tarball、34 个 workbench Model 导出及 PM 两个只读工具/执行成员额外一个精确写工具。原确认、旧审批、审计、无确认写入和取消断言保留。配置的 `review` 检查在首次执行时为 23 pass / 7 fail：六项 Desktop 本地 HTTP 夹具因本轮沙箱拒绝 `127.0.0.1` listen 而未执行到业务断言；包字节校验发现 Kernel owner 已开始并发修复，旧 tarball 与当前源码不同。该结果不是完整产品验证；Kernel 修复和重新打包后必须在新候选重跑。当前 macOS 主机未验证 Windows ZIP 启动或 DPAPI，不从已有测试外推该结论。

Kernel owner 修复凭据路径后，ProjectManager 已重新打包并安装本地 0.5.0 runtime。新 Reviewer 派发 `legion-project-wide-read-v1-review-final/reviewer-1` 把新增三层 Read Service 所有权核对改为读取本阶段已批准项目配置与 Kernel 边界，不再只比较源码路径前缀。直接执行 `TMPDIR=/private/tmp node --test tests/reviewer/test_structure.mjs apps/desktop/tests/reviewer/workbench-boundaries.test.mjs`，实际结果 **30 pass / 0 fail / 0 skip**；其中凭据列表/直读拒绝、原精确写入与审计、PM只读工具清单、0.5.0 tarball 全部字节与公开入口均通过。本轮直接检查获准使用 localhost 夹具；正式配置 `review` 的候选、日志与结果由新任务 `task_ops` 事件记录。本结论只覆盖这些实跑用例；Windows ZIP 启动与 DPAPI 仍未在 macOS 执行。

## 2026-10-08 文件归属与受控编辑 v1 审查增量

本次 Reviewer 派发为 `legion-file-ownership-and-agent-edit-v1-delivery/reviewer-1`。已检查不同角色写范围交叉、纯 Model 的 `ProjectFileOwners` 申领/转交/版本、Desktop 用户数据中的归属保存、确认与任务许可绑定、Storage 编辑 SHA/唯一替换/原子提交与审计、0.6.0 公开包以及 PM 无写工具的路径。旧读取、精确写入、审批与凭据断言继续保留。

**已复现的阻断问题：** `ProjectServiceImpl.saveProject` 的 `expectedFileOwnersDigest` 检查只受单个 Service 实例的 `#tail` 串行保护；`ProjectProviderImpl.write` 使用临时文件加 rename，却没有跨实例比较并交换。两个共享同一 userData 的 Service 同时读取 `owners-v0`，分别写 Backend/Frontend 的 `src/shared.ts`，两次 `saveProject` 都返回成功，最后一个写入覆盖另一个归属。Reviewer 新增同步两次读取的确定性回归，要求只有一次成功、另一请求返回 `stale_file_owners`，并核对磁盘上的 winner。初始候选该测试实际失败：**2 次成功，预期 1 次**。Desktop owner 必须修复持久化竞争后再对新候选完整复测。Windows ZIP/DPAPI 在本 macOS 主机未执行。

本轮配置 `review` 检查实际结果为 **31 pass / 8 fail / 1 skip**，候选在检查中未变。除上述真实归属竞争外，旧 Reviewer 测试对 0.5.0 包版本、34 个公开 Model 值和三工具执行成员的预期已过期；这些旧夹具导致另外七项失败，不能解释为新产品缺陷。Windows ZIP 项按平台跳过，macOS 原生 Electron 项实际通过。应先修复竞争，再更新 Reviewer 的 0.6.0 发行与四工具夹具并重跑完整检查；本轮不提交完成结论。

后续 Desktop owner 在用户数据 Provider 写入处增加跨实例锁，并在锁内重读实际目录、比较目录摘要与预期 owner 摘要；先前双实例回归现在只有一个请求成功，另一请求被拒。最终 Reviewer 派发 `legion-file-ownership-and-agent-edit-v1-final/reviewer-1` 已把旧 0.5.0/34 Model/三工具执行成员断言更新为实际安装的 0.6.0/41 Model/四工具合同，同时保留 PM 仅两个读取工具以及原写入、审批、审计、取消断言。新增公开 Model 独立检查覆盖目录与精确范围交叉、Windows 大小写别名、显式转交、旧 owner 和旧版本拒绝。Read Service、Policy、一次性许可、Storage 编辑两次 SHA/身份重查与最终审计摘要，及界面归属/转交展示均经源码与现有 owner 测试核对；正式全套结果以最终任务 `task_ops review` 事件为准。macOS 原生 Electron 和已安装包身份可在本机执行；Windows ZIP 与 DPAPI 仍未执行。


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


## 图片v1当前结构候选：Runtime1.3.0 / Desktop0.4.0

正式Reviewer-image-current-1，Human scope2236f669…/74配置e4e0282b…，仅R9七现有测试+两报告。最终fresh tar desktop-image-input-v1-final-20261012/legion-runtime-1.3.0.tgz，SHA0004ffe3c74cddf0960ce10c90da0283210e4fa11292d69f173539cb19d1afea；旧1.2.2/0.3.2及更早各门只保留历史，不作图片验收。包/version/modelExports/lock/已安装源字节迁当前身份；本角色gen仅command-center Reviewer根fresh，已授权Shell reviewer亦迁新fresh，旧包/证据不写。

本轮最小独立结构新增：纯PiImageReference/Input旧text JSON精确兼容、不含路径/owner/callback/IO授权、图片refs不能注入dispatch grant；Project public Service→Provider自身私有blob、不读peerOrg/private memory JSON。实际Project stage/preview读取原像素并核项目/ref/SHA，跨项目/变SHA/非法path拒绝；普通Host state无base64/私有blob路径/key、没有客户项目写或owner变化；仅专用受控preview IPC返回有限typed ref/data。Adapter真正SDK获typed图片后故意省图，实际image_omitted必须在HTTP前失败（requests0），不接受普通fake input或resolver回调、不自读Desktop图文件。原私有DTO/调用层/文本CLI/owner/lease/CAS/Shell/取消续轮/PM来源强门保持，UI像素流程由独立Tester负责，本R不扩GUI矩阵。

当前fixture/报告静态定稿后待唯一固定structure七入口，同候选exit0才可complete；不沿用旧通过。Windows/付费远端/旧Shell GUI不冒通过，known-key仍有限原值/前置与串流保证，不声称OCR/未知秘密/编码全称扫描。真实整仓库旧observer unavailable与隔离合法fixture、历史unknown markers保留；未知记录不删。未改产品、T、SDK依赖或无授权文档，不自verify/派发。


图片首结构门a66a2056实际83项79pass/4fail，旧证据保留且本图不complete。3个本角色旧fixture为imageCapability新DTO字段、ModelExports62→64、真实窗口标题现二哥；已按真实契约最小修正未重跑。新preview测试此前误用Headless，但静态真实链确认Desktop也缺公共入口：Main187→createWorkbenchPipeline1578→workbenchFacade1583未绑定stageImage/discardImage/readImagePreview，IPC调用会internal_error，不能绕Impl冒充通过。R仅将测试改真实public Desktop factory并严格断三方法存在；D原owner须补公开接线、重包及调用方重验。本轮partial冻结，无新的通过声明，不改产品/T/SDK依赖，不再跑旧图fixed门。实际SDK image_omitted requests0、纯refs/旧JSON/权限强门已作为有限首轮证据，其余必须新当前候选重验。

## 图片公开 Facade 返修当前候选：Runtime1.3.1 / Desktop0.4.1

当前正式 facade-repair 图承接旧 R9 partial。fresh stage desktop-image-input-v1-facade-repair-20261012，tar SHA555a4184456d6457674ded591e7dea3098cdb6b3fed4ad408c782019813dae46；原1.3.0首门79/83、issue37/stop38保留历史，不能作为当前通过。当前固定structure尚待运行。包/lock/安装字节使用当前身份，64 Model exports强断言保留。新增图片预览经真实公开createWorkbenchPipeline及Electron Main/preload stage→preview→discard；普通DTO无像素/私有blob路径，专用有限preview按project/ref绑定返回像素。旧文本、权限、真实SDK image_omitted零网络与取消历史门保留。仅结构证据，不冒充Tester实际图片UI像素场景；Windows unsupported与有限known-key/外部TOCTOU边界不变。

当前 facade-repair 首固定structure event20：83/83 pass，0fail/skip，exit0，candidate273cb84911632537c4713e3bf3633b05ae010bf0b83fe539bba9afb79c0e1e1f unchanged。日志 `.ans/runtime/desktop-image-input-v1-facade-repair-integration/evidence/reviewer-image-current-1-structure-3eb6f231.log`，SHAa63cb9577241accc995e535716b7fdbbd2bd0ef0b4524960d1403b9fd061f003。真实公开factory、Main/preload stage/preview/discard、ref/SHA/project绑定、普通DTO无pixel/path、SDK image_omitted零HTTP，以及既有文本/取消/owner/lease/commit/Shell边界均实际通过。本段文档改动后冻结，最终同候选固定门及调度验收待完成；不作Tester图片UI或整仓observer可用性全称证明。
