# Workbench v2 独立验证记录

2026-10-07，固定 Tester，任务 `legion-desktop-workbench-v2-fixture-repair/tester-1`。输入为已 verified Reviewer candidate `4d97d8e76524a674ed9577afb97c78dc18fcd2acfd09776ffc63d37a46420213`；canonical715639/config2546/contract22e3/ownership8780 实际匹配。PM、Reviewer 的成绩只作前置，不冒充独立 Tester 结果。

本角色十文件范围：原 Node integration 两文件各只改 TEMP_ROOT 一表达式，反向替换逐字节还原原内容；新 desktop 两文件与六简洁 docs。原20名称、断言、cleanup guard 和推理fixture保持。保护基线1767文件存 Tester/node/packaging/protected-before.json，覆盖现 source/发行 descriptor、新 ZIP/旧包/cache/旧阶段，结束复算记录具体差异。

有限 unit 两个 runner case：真实 Electron 公共完整流（九组情景）及当前 ZIP 原生 UI 完整流。前者包括首消息/同 PM/流取消与续轮/两项目、Human context/确认/真实写与完整审计及动态越界拒绝、三公开协议、context 变化整计划永久失效、无目标失败/not_executed、stop/close、safeStorage/历史、真实 intent/commit audit fault、当前超过1MiB记录完整读取。后者核对 descriptor 与 shipped bytes、实际 exe 和每次新 main PID 的 chooser、设置/对话/抽屉、Human 选上下文、只读 worker/IPC 安全、实际写/停止、跨进程 DPAPI 解密认证、无自动模型、轮询保留输入/连接/过滤/滚动以及浅深色最小窗口截图。

首轮 approved unit（revision30）实际2 tests、0 pass、2 fail、0 skip，均在业务断言前结束：PowerShell Archive 模块解压失败及 Electron 子进程启动退出2147483651，后者原因未确定。原日志 `.ans/runtime/legion-desktop-workbench-v2-fixture-repair/evidence/tester-1-unit-e8fa4173.log`（SHA256 `8d92986e4a37c69f2f53740715b524e5d97a88026c83fe57dfdd212b119f60dc`）保留。仅自身 harness 对齐已验证的 .NET 解压和 Electron cwd/stdio；完整重跑，不放宽业务断言。

第二轮提权 approved unit（revision31）已实际启动 Electron、ZIP 窗口、原生 chooser 和 SDK；2 tests、0 pass、2 fail、0 skip。自身 fixture 未剥离协议 URL query，以及未先展开状态过滤器所在 details，均保留日志 `tester-1-unit-6130a5a1.log`（SHA256 `f9462a2ea6d38bc341cfabf69bd02e049eea7c8743a102480ffd84251599fc8a`）。仅规范 localhost 请求 pathname、先展开 UI details，认证值和业务期望不变。

第三轮 approved unit（revision32）实际2 tests、0 pass、2 fail、0 skip：公共完整流已执行到第九组，误用兼容 refresh DTO 断言 v2 verifiedAt；ZIP 已取得七张图，但受控 server 未解析 SDK user content 的 typed text 数组，第二任务屏障未进入。日志 `tester-1-unit-ba4bd40e.log`（SHA256 `a1ac88a9bd223f6bdfc8385bf046308fcbf1dc82392142c5960f7fce9d5eeed2`）保留；改用已声明的 v2 observe，并解析实际 SDK text 数据，原严格断言保持。

本文在最终两个 approved checks 前封存，不预称通过。最终实际 candidate、unit/regression 计数与 logSHA 由[同任务 check 和 complete 记录](../../../scheduling/legion-desktop-workbench-v2-fixture-repair.md)提供；生成报告为 `.ans/runtime/legion-desktop-workbench-v2/Tester/node/packaging/verification.json`，桌面证明与截图位于本角色 desktop/fixtures。测试发现的问题保留真实日志，不修改生产或放宽期望；通过须 Supervisor 核验。

限制：localhost 证明公开 SDK 与受控推理路径，不验证付费账号；本机 DPAPI 重启不保证跨机器；audit fault 是明确 lower 文件句柄写刺激，真实文件效果仍核对。原两个 junction 用例在宿主 EPERM 下使用 lstat 元数据刺激，不证明本机全部 reparse/OS 或恶意同进程隔离。没有 Shell 软件检查执行器，not_executed 不是通过；截图须实际查看，不能代替行为断言。历史 v1/v3 不作为本版成绩。

## 2026-10-08 项目内广读精写独立验证

Tester 在 `legion-project-wide-read-v1-review-final/tester-1` 的当前候选上，通过公开 Node Runtime 与实际安装的 `legion-runtime` 0.5.0、Electron 44.6.0 arm64、Pi SDK 1.0.4 验证。macOS arm64、Node v24.14.0；模型请求只发往受控 localhost 服务，未向付费模型发请求。固定的配置检查 `integration` 执行 `node --test tests/integration/test_permission_flow.mjs tests/integration/test_generic_agents.mjs apps/desktop/tests/integration/workbench-flow.test.mjs`；最终结果与候选 SHA 以同任务 task_ops check 记录为准。另独立运行 `node --test apps/desktop/tests/e2e/workbench-ui.test.mjs`。

新验证通过实际 Pi Session 工具调用证明：显式启用的 Node Runtime 工作成员能列根目录、读取普通文本并从第二行续读；单行超过本次字节预算、文件超过 2 MiB、嵌套 `.ssh/id_rsa` 均拒绝且不返回正文；旧宿主不启用 `projectRead` 时拒绝新增读工具。读取没有产生写许可；精确 `writeSet` 中的写入成功，范围外写入被拒；审计只有写 proposal/结果，没有读出的正文。原取消、版本/任务撤销、一次性许可与审计故障回归仍运行。

真实 Electron 公共 Workbench 流验证 PM 在 Human 未选文件时自行列目录、读普通文件、拒绝嵌套凭据；内容不进入持久应用状态或客户项目审计，切换项目后新项目状态也不含旧正文。随后 Human 固定的上下文仍单独参与 SHA 绑定，确认计划后精确写入，停止与故障回归保持。Pi 同一现场会话的模型请求可以包含此前读工具结果；测试只要求其不进入持久应用状态，不误称后续请求完全忘记它。

macOS UI 通过实际安装的 Electron 窗口创建配置、发送 PM 消息、显示草案、确认计划，并让成员读普通文件、拒绝嵌套凭据、写唯一批准目标；测试检查确认前无目标文件、完成后的写入和审计、没有凭据正文、软件检查仍为 `not_executed`。草案实际渲染后截图保存在 `.ans/runtime/legion-desktop-workbench-v2/Tester/desktop/fixtures/tester-mac-read-draft.png`，已人工查看：项目、PM 回复、精确目标及确认按钮可见，确认前没有完成状态。Windows ZIP、原生 Windows chooser 和 DPAPI 跨进程验证在 macOS 明确跳过，未据此声称 Windows 通过。该 UI 检查使用启动参数选择隔离测试项目，未验证 macOS 原生文件选择器。

初次配置检查 20/22，两个失败均为 Tester fixture：macOS demo 子进程只设 `TEMP/TMP`，系统 `TMPDIR` 落在符号链接 `/var`；现设本角色规范临时根，Storage 链接拒绝规则未变。新增 HTTP 假模型误复用 tool-call ID，并把同一 Pi 会话历史工具响应错当作当前 Human 固定上下文。两处已修正，原安全断言不放宽。初次日志：`.ans/runtime/legion-project-wide-read-v1-review-final/evidence/tester-1-integration-d4a2dfed.log`。localhost 在默认沙箱中 EPERM，配置检查与真实 UI 均在获准的 localhost 环境运行。

## 2026-10-08 文件归属与 Agent 编辑独立验证

Tester 在 `legion-file-ownership-and-agent-edit-v1-final/tester-1` 的已确认设计上扩展公开路径测试。运行环境为 macOS arm64、Node v24.14.0、安装的 `legion-runtime` 0.6.0、Electron 44.6.0、Pi SDK 1.0.4。受控推理只连接 localhost。固定 `integration` 检查包含 Node 公开集成、真实 Electron 主进程集成与 macOS 窗口测试，使用规范的 `TMPDIR=/private/tmp`；最终候选、命令、计数和日志 SHA 以本任务的 task_ops check 为准。

公开 Node Runtime 测试验证：两个角色不能申领大小写别名文件，也不能通过目录范围覆盖另一个角色的精确文件。真实 Pi Agent 先使用 `legion_read_file` 得到完整文件 SHA-256，再由它自己提交 `legion_edit_file`；唯一旧文本的替换成功，最终内容摘要等于实际文件 SHA。继续用过期 SHA 和歧义旧文本申请编辑，两次都被明确拒绝，文件保持成功编辑后的完整字节；范围外文件也未创建。既有写入、只读工具默认关闭、取消、一次性许可和审计回归保留。

真实 Electron 公共 Workbench 测试验证：同一计划中的不同角色申领 `result.txt` 与大小写别名被拒；同角色多任务重复文件缺依赖被拒，显式依赖可进入确认。文件 owner 从首个确认计划持久保存，经过后续计划、项目切换与 Workbench 进程重建仍属于原角色。第二个 Workbench 实例推进 owner 版本后，第一实例持有的旧转交确认返回 `stale_file_owners`，客户文件不变。重新展示 `Writer → Other` 的精确转交后，Human 确认使新角色取得 owner；新任务 Agent 读取旧文件 SHA 并发起局部编辑，最终结果和审计都保留写入事实，旧确认不可重放。

macOS 实际窗口测试在旧版读写完整流后，又显示 `approved.txt：Writer → Editor` 的归属转交及明确确认按钮。确认前原文件内容和 owner 保持，确认后执行 Agent 使用读到的 SHA 编辑唯一批准文件，界面状态与实际最终摘要一致。`tester-mac-transfer-draft.png` 保存在本角色受控 desktop fixtures 目录，已经人工查看转交路径、旧/新角色与确认按钮确实可见。Windows ZIP、原生 Windows chooser 与 DPAPI 跨进程仍只能在 Windows 实测；macOS 对这项独立门禁作平台跳过，不将其计作通过。

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
