# ProjectWiki 引用契约

ProjectWiki 没有运行时 API、CLI、IPC 或可供业务代码调用的新接口。本文件只说明[项目 Wiki](../../wiki/README.md)引用哪些现有公开入口，以及由谁维护详细契约。

| Wiki 中的入口 | 维护者与详细契约 |
| --- | --- |
| `legion-runtime` 根包、`legion` CLI、`legion-runtime/workbench-models` 和七个 `services/*` 子路径 | [ProjectManager 发行 API](../ProjectManager/api-spec.md)汇总；[Kernel API](../KernelEngineer/api-spec.md)与[Adapter API](../AgentAdapterEngineer/api-spec.md)定义能力。实际包导出以当前 [`package.json`](../../../package.json)和[`runtime.mjs`](../../../runtime.mjs)、[`workbench.mjs`](../../../workbench.mjs)为准。 |
| 桌面应用启动、受限 IPC 与 Workbench 操作 | [Desktop API](../DesktopEngineer/api-spec.md)；实际入口见[`apps/desktop/main.mjs`](../../../apps/desktop/main.mjs)及其[`package.json`](../../../apps/desktop/package.json)。 |
| 用户操作与本地开发命令 | [桌面 README](../../../apps/desktop/README.md)和[根 README](../../../README.md)；命令脚本以两个 manifest 为准。 |

Model 值或本 Wiki 文字都不授予写入、检查或 Shell 执行权限。批准、实例身份、当前版本和受控效果由相应产品契约负责；本角色只维护链接与解释。
