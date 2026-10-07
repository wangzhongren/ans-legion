# Section 1: 可修改文件与执行效果

客户已确认工作台v2；task writeSet只能缩小本清单。权限以本阶段精确策略与实际派发为准。旧历史产物和未列出的源文件只读。

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 文件 | `package.json` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `package-lock.json` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `workbench.mjs` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `README.md` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/package.json` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/package-lock.json` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/forge.config.mjs` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/main.mjs` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/README.md` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/scripts/install-electron.mjs` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/scripts/verify-dependencies.mjs` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `tests/package/test_package.mjs` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `apps/desktop/tests/package/desktop-package.test.mjs` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `docs/roles/ProjectManager/feature-map.md` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `docs/roles/ProjectManager/functional-description.md` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `docs/roles/ProjectManager/api-spec.md` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `docs/roles/ProjectManager/changelog.md` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `docs/roles/ProjectManager/docs/design/2026-10-07_design_desktop-workbench-v2.md` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `docs/roles/ProjectManager/docs/feature/distribution.md` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `docs/roles/ProjectManager/docs/feature/desktop-distribution.md` | ProjectManager独占 authored；实际任务需派发 |
| 文件 | `docs/roles/ProjectManager/docs/architecture.md` | ProjectManager独占 authored；实际任务需派发 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/npm-cache/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/tmp/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/npm-cache/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/electron-cache/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/user-data/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/fixtures/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/tmp/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `node_modules/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `apps/desktop/node_modules/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |
| 条件生成目录 | `apps/desktop/out/` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |

固定检查可创建localhost受控协议服务、启动项目安装的Electron及仅关闭本次跟踪的进程。TEMP/userData/fixture/截图在自己的本阶段隔离生成路径；不得写旧runtime阶段、全局Pi配置或客户实际源码。递归清理前核对真实绝对路径属于自己的生成子目录且无链接跳转。
仅PM安装项目内真实本地tarball及必要依赖、使用官方Electron安装能力与生成ZIP；不全局安装、不注册表发布、不改依赖包源码。
其他角色源码、治理/组织/角色/策略、旧Node tarball及旧GUI ZIP只读。客户确认具体计划后动态Agent执行已纳入v2；不启用任意Shell检查执行器。
