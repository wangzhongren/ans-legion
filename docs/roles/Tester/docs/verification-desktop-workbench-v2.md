# Workbench v2 独立验证记录

2026-10-07，固定 Tester，任务 `legion-desktop-workbench-v2-fixture-repair/tester-1`。输入为已 verified Reviewer candidate `4d97d8e76524a674ed9577afb97c78dc18fcd2acfd09776ffc63d37a46420213`；canonical715639/config2546/contract22e3/ownership8780 实际匹配。PM、Reviewer 的成绩只作前置，不冒充独立 Tester 结果。

本角色十文件范围：原 Node integration 两文件各只改 TEMP_ROOT 一表达式，反向替换逐字节还原原内容；新 desktop 两文件与六简洁 docs。原20名称、断言、cleanup guard 和推理fixture保持。保护基线1767文件存 Tester/node/packaging/protected-before.json，覆盖现 source/发行 descriptor、新 ZIP/旧包/cache/旧阶段，结束复算记录具体差异。

有限 unit 两个 runner case：真实 Electron 公共完整流（九组情景）及当前 ZIP 原生 UI 完整流。前者包括首消息/同 PM/流取消与续轮/两项目、Human context/确认/真实写与完整审计及动态越界拒绝、三公开协议、context 变化整计划永久失效、无目标失败/not_executed、stop/close、safeStorage/历史、真实 intent/commit audit fault、当前超过1MiB记录完整读取。后者核对 descriptor 与 shipped bytes、实际 exe 和每次新 main PID 的 chooser、设置/对话/抽屉、Human 选上下文、只读 worker/IPC 安全、实际写/停止、跨进程 DPAPI 解密认证、无自动模型、轮询保留输入/连接/过滤/滚动以及浅深色最小窗口截图。

首轮 approved unit（revision30）实际2 tests、0 pass、2 fail、0 skip，均在业务断言前结束：PowerShell Archive 模块解压失败及 Electron 子进程启动退出2147483651，后者原因未确定。原日志 `.ans/runtime/legion-desktop-workbench-v2-fixture-repair/evidence/tester-1-unit-e8fa4173.log`（SHA256 `8d92986e4a37c69f2f53740715b524e5d97a88026c83fe57dfdd212b119f60dc`）保留。仅自身 harness 对齐已验证的 .NET 解压和 Electron cwd/stdio；完整重跑，不放宽业务断言。

第二轮提权 approved unit（revision31）已实际启动 Electron、ZIP 窗口、原生 chooser 和 SDK；2 tests、0 pass、2 fail、0 skip。自身 fixture 未剥离协议 URL query，以及未先展开状态过滤器所在 details，均保留日志 `tester-1-unit-6130a5a1.log`（SHA256 `f9462a2ea6d38bc341cfabf69bd02e049eea7c8743a102480ffd84251599fc8a`）。仅规范 localhost 请求 pathname、先展开 UI details，认证值和业务期望不变。

第三轮 approved unit（revision32）实际2 tests、0 pass、2 fail、0 skip：公共完整流已执行到第九组，误用兼容 refresh DTO 断言 v2 verifiedAt；ZIP 已取得七张图，但受控 server 未解析 SDK user content 的 typed text 数组，第二任务屏障未进入。日志 `tester-1-unit-ba4bd40e.log`（SHA256 `a1ac88a9bd223f6bdfc8385bf046308fcbf1dc82392142c5960f7fce9d5eeed2`）保留；改用已声明的 v2 observe，并解析实际 SDK text 数据，原严格断言保持。

本文在最终两个 approved checks 前封存，不预称通过。最终实际 candidate、unit/regression 计数与 logSHA 由[同任务 check 和 complete 记录](../../../scheduling/legion-desktop-workbench-v2-fixture-repair.md)提供；生成报告为 `.ans/runtime/legion-desktop-workbench-v2/Tester/node/packaging/verification.json`，桌面证明与截图位于本角色 desktop/fixtures。测试发现的问题保留真实日志，不修改生产或放宽期望；通过须 Supervisor 核验。

限制：localhost 证明公开 SDK 与受控推理路径，不验证付费账号；本机 DPAPI 重启不保证跨机器；audit fault 是明确 lower 文件句柄写刺激，真实文件效果仍核对。原两个 junction 用例在宿主 EPERM 下使用 lstat 元数据刺激，不证明本机全部 reparse/OS 或恶意同进程隔离。没有 Shell 软件检查执行器，not_executed 不是通过；截图须实际查看，不能代替行为断言。历史 v1/v3 不作为本版成绩。
