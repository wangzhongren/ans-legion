# AgentAdapterEngineer功能导航

| 功能 | 当前行为 | 状态/文档 |
| --- | --- | --- |
| 真实Pi单次执行与多轮管理对话 | 默认single_run保持；conversation零工具/零写、delta/history/轮取消、纯数据三协议连接 | 已实施，owner38项通过；[完整功能](docs/feature/pi-agent.md) |
| 纯受控提案转换 | 保留精确Session与run绑定，不执行写入/发许可；本阶段源码及测试只读 | [历史功能](docs/feature/proposal-adapters.md)，实际接口说明在[API](api-spec.md) |

[当前设计](docs/design/2026-10-07_design_desktop-workbench-v2.md)、[概述](functional-description.md)、[API](api-spec.md)、[变化](changelog.md)。当前最终approved unit及candidate见[本阶段任务](../../scheduling/legion-desktop-workbench-v2.md)；原v3及其23项为[历史](docs/design/2026-10-07_design_node-pi-v3.md)，不替代工作台后段完整验收。

