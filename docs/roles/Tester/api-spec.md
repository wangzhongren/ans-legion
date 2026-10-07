# Tester 验证入口

本角色无生产 API。两 authored 桌面入口：`apps/desktop/tests/integration/workbench-flow.test.mjs` 在实际 Electron main 运行公开 Workbench Pipeline/真实 SDK/本机 safeStorage；`apps/desktop/tests/e2e/workbench-ui.test.mjs` 解压当前 descriptor 对应 ZIP，通过实际 exe、原生 chooser 与固定 preload 操作。

正式 unit：`node --test --test-concurrency=1 apps/desktop/tests/integration/workbench-flow.test.mjs apps/desktop/tests/e2e/workbench-ui.test.mjs`，300秒。

正式 regression：配置固定 Node wrapper 执行 `node D:/soft/nodejs/node_modules/npm/bin/npm-cli.js test --ignore-scripts`，总300秒/child280秒；role=Tester，TMP/TEMP/npm cache 为 Tester/node，移除 NODE_OPTIONS/NODE_COMPILE_CACHE。原20 test 名称/行为与安全断言不变。

桌面 caller `LEGION_DESKTOP_TEST_ROLE=Tester`；TMP/TEMP 为 Tester/desktop/tmp。测试可公开导出自己的受控协议/隔离目录辅助函数供同角色 E2E 引用；生产不引用测试。所有 owned 进程/HTTP/socket 必须关闭，清理前检查绝对归属与各级链接。实际检查日志由 task_ops 写入，最终计数见[验证](docs/verification-desktop-workbench-v2.md)。
