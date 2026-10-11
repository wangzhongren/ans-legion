# Tester 独立检查入口

本角色无生产 API。当前正式任务为 `legion-governed-workflow-v1-final-integration`，只有派发的十二个测试/文档文件可修改。测试副作用限定在 `.ans/runtime/legion-governed-workflow-v1/Tester/{fixtures,user-data,tmp,evidence}/`；检查由 task_ops 执行配置固定的 argv，不编辑旧阶段或其他角色文件。

`integration` 的准确命令：

```sh
node --test --test-concurrency=1 tests/integration/test_permission_flow.mjs tests/integration/test_generic_agents.mjs tests/integration/test_check_flow.mjs apps/desktop/tests/integration/workbench-flow.test.mjs apps/desktop/tests/integration/governed-workflow.test.mjs
```

`ui` 的准确命令：

```sh
node --test --test-concurrency=1 apps/desktop/tests/e2e/workbench-ui.test.mjs apps/desktop/tests/e2e/governed-workflow-ui.test.mjs
```

均限 300 秒。Node permission/generic 用实际公开 Runtime/Pi SDK；check 用公开 Check Service 和实际安装 Electron Node 进程。Workbench regression 用实际 Electron main、安装的 runtime 公共入口、safeStorage 与三类 localhost HTTP SDK 协议。Governed 用真实 SDK 工具完成架构提案/退回/审批、三类等待、开发/独立检查及 PM 原 owner 返修复验；空测试或模型自报不能通过。新增严格断言 DTO 单一 timeline 的真实 Human/问题/答案/后续回复顺序、answerId 去重、重复文字不同 ID、重启与未来轮次，以及实际已提交角色提案后 SDK 失败仍返回 exact pendingProposals、status:error、decision.allowed:false。

同角色 E2E 可使用测试导出的受控协议和严格目录辅助函数，生产不引用它们。Playwright 驱动独立实际 BrowserWindow、renderer、preload、IPC 和系统加密，启动只选本次隔离 fixture；不控制客户活动窗口。Windows ZIP 原生 chooser/DPAPI 测试保留平台门禁，macOS 明确显示未执行。两个实际 macOS UI 用例分别验证治理完整流及原有项目读/编辑/转交；Windows ZIP、客户真实 SSH 项目是不同证据范围。PM 持久实例/session/profile 保持相同；底层 SDK Session 按新契约每轮从 plain checkpoint 重建，完整 UI journal 保持，真实长期请求须在既有 65536 上限内并明确历史省略。

当前测试环境从真实 argv 去除 NODE_OPTIONS/NODE_PATH/ELECTRON_RUN_AS_NODE 等启动覆盖，TMPDIR/TMP/TEMP 在 Tester/tmp。软件检查环境由 Kernel 另行固定并实际 seatbelt 隔离，不能把外层测试进程的效果误作检查子进程权限。关闭跟踪的 SDK/HTTP/socket/Electron 资源，递归清理先核对绝对归属和各级无链接。

最终计数、候选、跳过及截图见[验证记录](docs/verification-governed-workflow-v1.md)；正式 task_ops 输出是候选与完整输入的权威绑定。

## 2026-10-10 Shell独立验收入口

当前正式handwell-project-shell-absence-wire-repair-v1仅16个获派输出。四新测试为test_shell_flow/test_shell_macos_probe与Desktop shell-workflow/shell-workflow-ui；只导出test-owned实际fixture/controlled protocol helpers，生产不引用。其余四原fixture迁新stage/fresh输出。六fixed gates原argv/300秒均经task_ops，本阶段effects在Tester新Shell runtime；native probe必须真实>0/0skip，其他平台失败关闭。公开Shell能力fixture使用真实PM SDK决定和受控持久Host validator，实际生产PM/CAS/许可由Workbench complete flow独立验证。准确覆盖、source/partial/generated恢复和平台范围见[Shell验证](docs/verification-project-shell-v1.md)。
