# ProjectManager 当前功能导航

- [Windows 工作台发行](docs/feature/desktop-distribution.md)：真实0.2.0 ZIP、唯一项目管理对话、确认后的受控执行与两页面原生验证。
- [本地 Node 包发行](docs/feature/distribution.md)：runtime0.4.0、29文件白名单、真实隔离安装、30具名Model及四Service子路径。
- [整体架构](docs/architecture.md)：唯一Workbench Pipeline组合公开Services及固定owner边界。
- [公开入口与检查](api-spec.md)：thin bootstrap、窄IPC引用、当前生成证据和复现命令。
- [本阶段设计](docs/design/2026-10-07_design_desktop-workbench-v2.md)：客户已确认的single-PM/focus_conversation方案。

PM owner检查与生成产物身份由 task_ops/evidence 和本阶段 desktop-package.json 记录；不替代独立Reviewer/Tester。runtime与Desktop两个前后stage分开冻结，禁止后段普通修改前core11文件。

历史：[Node v3](docs/design/2026-10-07_design_node-pi-v3.md)、[GUI v1观察原型](docs/design/2026-10-07_design_desktop-gui-v1.md)。历史产物与失败保留，不充当工作台v2验收。未registry发布。
