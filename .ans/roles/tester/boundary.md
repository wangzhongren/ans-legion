# Section 1: 可修改文件与执行效果

客户已确认工作台v2；task writeSet只能缩小本清单。权限以本阶段精确策略与实际派发为准。旧历史产物和未列出的源文件只读。

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 文件 | `tests/integration/test_permission_flow.mjs` | Tester独占 authored；实际任务需派发 |
| 文件 | `tests/integration/test_generic_agents.mjs` | Tester独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/tests/integration/workbench-flow.test.mjs` | Tester独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/tests/e2e/workbench-ui.test.mjs` | Tester独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Tester/feature-map.md` | Tester独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Tester/functional-description.md` | Tester独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Tester/api-spec.md` | Tester独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Tester/changelog.md` | Tester独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Tester/docs/design/2026-10-07_design_desktop-workbench-v2.md` | Tester独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Tester/docs/verification-desktop-workbench-v2.md` | Tester独占 authored；实际任务需派发 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/Tester/node/packaging/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/Tester/node/npm-cache/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/Tester/node/tmp/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/Tester/desktop/fixtures/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/Tester/desktop/user-data/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/Tester/desktop/tmp/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |

固定检查可创建localhost受控协议服务、启动项目安装的Electron及仅关闭本次跟踪的进程。TEMP/userData/fixture/截图在自己的本阶段隔离生成路径；不得写旧runtime阶段、全局Pi配置或客户实际源码。递归清理前核对真实绝对路径属于自己的生成子目录且无链接跳转。
其他角色源码、治理/组织/角色/策略、旧Node tarball及旧GUI ZIP只读。客户确认具体计划后动态Agent执行已纳入v2；不启用任意Shell检查执行器。
