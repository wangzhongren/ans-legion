# Section 1: 可修改文件与执行效果

客户已确认工作台v2；task writeSet只能缩小本清单。权限以本阶段精确策略与实际派发为准。旧历史产物和未列出的源文件只读。

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 文件 | `apps/desktop/src/models/workbench.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/pipelines/workbench.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/providers/abstract/project.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/providers/public/project.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/providers/impl/project.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/services/abstract/project.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/services/public/project.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/services/impl/project.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/providers/abstract/history.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/providers/public/history.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/providers/impl/history.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/services/abstract/history.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/services/public/history.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/services/impl/history.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/services/abstract/profiles.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/services/public/profiles.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/services/impl/profiles.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/providers/abstract/workspace.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/providers/public/workspace.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/providers/impl/workspace.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/services/abstract/workspace.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/services/public/workspace.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/services/impl/workspace.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/interface/main.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/interface/preload.cjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/interface/index.html` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/interface/renderer.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/src/interface/styles.css` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/tests/unit/workbench-model.test.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/tests/unit/project.test.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/tests/unit/history.test.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/tests/unit/workbench.test.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/tests/unit/profiles.test.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/tests/unit/workspace.test.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/tests/unit/pipeline.test.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/tests/unit/ipc.test.mjs` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `docs/roles/DesktopEngineer/feature-map.md` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `docs/roles/DesktopEngineer/functional-description.md` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `docs/roles/DesktopEngineer/api-spec.md` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `docs/roles/DesktopEngineer/changelog.md` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `docs/roles/DesktopEngineer/docs/design/2026-10-07_design_desktop-workbench-v2.md` | DesktopEngineer独占 authored；实际任务需派发 |
| 文件 | `docs/roles/DesktopEngineer/docs/feature/desktop-console.md` | DesktopEngineer独占 authored；实际任务需派发 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/DesktopEngineer/fixtures/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/DesktopEngineer/user-data/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/DesktopEngineer/tmp/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |

固定检查可创建localhost受控协议服务、启动项目安装的Electron及仅关闭本次跟踪的进程。TEMP/userData/fixture/截图在自己的本阶段隔离生成路径；不得写旧runtime阶段、全局Pi配置或客户实际源码。递归清理前核对真实绝对路径属于自己的生成子目录且无链接跳转。
其他角色源码、治理/组织/角色/策略、旧Node tarball及旧GUI ZIP只读。客户确认具体计划后动态Agent执行已纳入v2；不启用任意Shell检查执行器。
