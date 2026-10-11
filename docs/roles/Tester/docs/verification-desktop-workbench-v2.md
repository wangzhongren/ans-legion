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
