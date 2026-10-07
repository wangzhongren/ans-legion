# Section 1: 可修改文件与执行效果

客户已确认工作台v2；task writeSet只能缩小本清单。权限以本阶段精确策略与实际派发为准。旧历史产物和未列出的源文件只读。

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 文件 | `tests/reviewer/test_structure.mjs` | Reviewer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/tests/reviewer/desktop-boundaries.test.mjs` | Reviewer独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/tests/reviewer/workbench-boundaries.test.mjs` | Reviewer独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Reviewer/feature-map.md` | Reviewer独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Reviewer/functional-description.md` | Reviewer独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Reviewer/api-spec.md` | Reviewer独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Reviewer/changelog.md` | Reviewer独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Reviewer/docs/design/2026-10-07_design_desktop-workbench-v2.md` | Reviewer独占 authored；实际任务需派发 |
| 文件 | `docs/roles/Reviewer/docs/review-desktop-workbench-v2.md` | Reviewer独占 authored；实际任务需派发 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/Reviewer/node/packaging/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/Reviewer/node/npm-cache/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/Reviewer/node/tmp/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/Reviewer/desktop/fixtures/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/Reviewer/desktop/user-data/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/Reviewer/desktop/tmp/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |

固定检查可创建localhost受控协议服务、启动项目安装的Electron及仅关闭本次跟踪的进程。TEMP/userData/fixture/截图在自己的本阶段隔离生成路径；不得写旧runtime阶段、全局Pi配置或客户实际源码。递归清理前核对真实绝对路径属于自己的生成子目录且无链接跳转。
其他角色源码、治理/组织/角色/策略、旧Node tarball及旧GUI ZIP只读。客户确认具体计划后动态Agent执行已纳入v2；不启用任意Shell检查执行器。
