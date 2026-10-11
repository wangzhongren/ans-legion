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
| 文件 | `docs/roles/ProjectManager/docs/design/2026-10-08_design_legion-project-wide-read.md` | 已确认跨角色读取方案；实际任务需派发 |
| 文件 | `docs/roles/ProjectManager/docs/design/2026-10-08_design_legion-file-ownership-and-agent-edit.md` | 已确认跨角色文件归属与编辑方案；实际任务需派发 |
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

| 文件 | `docs/roles/ProjectManager/docs/design/2026-10-08_design_legion-governed-workflow.md` | 本次完整组织与验收工作流；精确任务派发后可修改 |
| 文件 | `docs/roles/ProjectManager/docs/feature/governed-workflow.md` | 本次完整组织与验收工作流；精确任务派发后可修改 |
| 条件生成目录 | `.ans/runtime/legion-governed-workflow-v1/ProjectManager/fixtures/` | 仅本角色本阶段测试、隔离进程、证据与发布输出 |
| 条件生成目录 | `.ans/runtime/legion-governed-workflow-v1/ProjectManager/user-data/` | 仅本角色本阶段测试、隔离进程、证据与发布输出 |
| 条件生成目录 | `.ans/runtime/legion-governed-workflow-v1/ProjectManager/tmp/` | 仅本角色本阶段测试、隔离进程、证据与发布输出 |
| 条件生成目录 | `.ans/runtime/legion-governed-workflow-v1/ProjectManager/evidence/` | 仅本角色本阶段测试、隔离进程、证据与发布输出 |
| 条件生成目录 | `.ans/runtime/legion-governed-workflow-v1/ProjectManager/packaging/` | 仅本角色本阶段测试、隔离进程、证据与发布输出 |
| 条件生成目录 | `.ans/runtime/legion-governed-workflow-v1/ProjectManager/npm-cache/` | 仅本角色本阶段测试、隔离进程、证据与发布输出 |
| 条件生成目录 | `.ans/runtime/legion-governed-workflow-v1/ProjectManager/electron-cache/` | 仅本角色本阶段测试、隔离进程、证据与发布输出 |

固定检查可创建localhost受控协议服务、启动项目安装的Electron及仅关闭本次跟踪的进程。TEMP/userData/fixture/截图在自己的本阶段隔离生成路径；不得写旧runtime阶段、全局Pi配置或客户实际源码。递归清理前核对真实绝对路径属于自己的生成子目录且无链接跳转。
仅PM安装项目内真实本地tarball及必要依赖、使用官方Electron安装能力与生成ZIP；不全局安装、不注册表发布、不改依赖包源码。
其他角色源码、治理/组织/角色/策略、旧Node tarball及旧GUI ZIP只读。客户确认具体计划后动态Agent执行已纳入v2；不启用任意Shell检查执行器。

本次新增边界依据客户“全都要开发”及本次确切配置哈希批准；实际激活仍由精确任务派发缩小。新功能允许执行已批准检查，禁止任意 Shell 或无隔离降级。旧产物不得覆盖。


本次项目 Shell v1 新增候选边界（设计已确认，精确配置等待人类接受；未派发）：

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 文件 | `docs/roles/ProjectManager/docs/feature/project-shell.md` | ProjectManager 唯一 owner；仅本设计、配置接受及 task writeSet 派发后实施 |
| 文件 | `docs/roles/ProjectManager/docs/design/2026-10-10_design_project-shell.md` | ProjectManager 唯一 owner；仅本设计、配置接受及 task writeSet 派发后实施 |
| 文件 | `docs/roles/ProjectManager/docs/change/2026-10-10_change_project-shell.md` | ProjectManager 唯一 owner；仅本设计、配置接受及 task writeSet 派发后实施 |
| 条件生成目录 | `.ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/fixtures/` | 本角色本阶段隔离运行效果；不是 authored 源码或永久产物权限 |
| 条件生成目录 | `.ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/user-data/` | 本角色本阶段隔离运行效果；不是 authored 源码或永久产物权限 |
| 条件生成目录 | `.ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/tmp/` | 本角色本阶段隔离运行效果；不是 authored 源码或永久产物权限 |
| 条件生成目录 | `.ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/evidence/` | 本角色本阶段隔离运行效果；不是 authored 源码或永久产物权限 |
| 条件生成目录 | `.ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/packaging/` | 本角色本阶段隔离运行效果；不是 authored 源码或永久产物权限 |
| 条件生成目录 | `.ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/npm-cache/` | 本角色本阶段隔离运行效果；不是 authored 源码或永久产物权限 |
| 条件生成目录 | `.ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/electron-cache/` | 本角色本阶段隔离运行效果；不是 authored 源码或永久产物权限 |
| 条件生成目录 | `.ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/shell-mirrors/` | 本角色本阶段隔离运行效果；不是 authored 源码或永久产物权限 |
| 条件生成目录 | `.ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/shell-home/` | 本角色本阶段隔离运行效果；不是 authored 源码或永久产物权限 |
| 条件生成目录 | `.ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/shell-logs/` | 本角色本阶段隔离运行效果；不是 authored 源码或永久产物权限 |
| 条件生成目录 | `.ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/publication-staging/` | 本角色本阶段隔离运行效果；不是 authored 源码或永久产物权限 |
| 条件生成目录 | `.ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/recovery/` | 本角色本阶段隔离运行效果；不是 authored 源码或永久产物权限 |

项目 Shell 是独立受控 capability：逐调用 PM 结构化审批、Host 私有一次许可、独立 macOS OS profile、项目副本和受控发布。上述新增不是放宽原 fixedCheck、Node check sandbox、no-child/no-network、现有 edit/task 权限。此前“不启用任意 Shell 检查执行器”继续约束原检查执行器；不得以 Shell 退出码 0 替代 checks/Acceptance。未支持平台失败关闭。
源文件 delete 仅产品内精确受控 Mutation 操作，必须 owner + 本条 grant + task.writeSet + 真实基线/墓碑，不扩大本仓库实现角色的删除或父目录权限。生成镜像由 Host Provider 创建，授权效果仍归请求执行 role 的上述 runtime 路径，禁止使用 Kernel runtime 承载其他角色效果。旧 runtime/evidence/config 不覆盖；清理先验证真实路径和 no-follow，仅关闭本次跟踪子树，禁止 globkill。固定回归可继续使用已批准旧角色 fixture 生成边界，但只创建唯一临时目录，不覆写历史证据；新增 Shell 用本阶段路径。
真实探针可在己方 fixture 放置人工秘密 canary、启动受控 localhost 服务及 fork/native/shell 子进程，网络效果仅此受控 fixture。不得读取真实 profile、密钥、客户 SSH 项目或宿主秘密。普通 npm/系统读取仅白名单且隔离探针通过后可用，禁止默认不受限系统效果。
Tester UI/e2e 默认 hidden 不抢用户焦点；真实 live GUI 展示单独由原 owner 执行且明确展示。测试不能 skip、降低断言、自动裸 Shell fallback 或以 Windows 未执行冒充支持。


**CLI 优先阶段：项目管理设计文件**

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 文件 | `docs/roles/ProjectManager/docs/design/2026-10-10_design_cli-first-role-memory-supervisor.md` | 本次 CLI 优先、角色分类记忆与产品内 Supervisor 的跨角色集成方案；仅文档，不授予源码或测试写入权 |
| 文件 | `docs/roles/ProjectManager/docs/design/2026-10-10_design_cli-role-owned-files-v2.md` | Human 新确认“运行时取消任务 writeSet、角色独占文件决定可改范围”的替代设计；仅文档 |
| 文件 | `docs/roles/ProjectManager/docs/design/2026-10-11_design_supervisor-frontdoor-global-read.md` | 2026-10-11 用户要求 Su 自主读取项目、作为客户对话入口，并讨论角色状态和工作日志；仅用于方案准备与跨角色评审，不授应用源码、测试或新执行权限 |
| 条件文件 | `docs/roles/ProjectManager/docs/change/2026-10-11_change_supervisor-frontdoor-global-read.md` | Su 客户入口、项目读取和角色状态/日志的实施变更记录候选；仅在新设计与精确配置获得真人确认并实际派发后可写 |

本条仅供本次用户明确要求的方案准备与实质审核。旧 Shell 任务已按用户要求暂停；其冻结候选和历史证据不因本条自动获得新执行授权或新验收结论。


既有 fixed regression 精确兼容例外（只读核对已有配置 argv 的 harness，不扩展源码或其他角色 ownership）：无本配置必需旧路径写入；PM packager 已在精确授权内，必须迁新 stage。允许该 harness 原已接受生成边界中的本次 fresh mkdtemp/UUID 子目录，写入只限其中的fixture/temp/userData，之后只清理本次目录。不得覆盖旧 evidence、proof、tar、ZIP、history 或稳定命名输出；不是旧 runtime 通配授权。Adapter 的固定 fixtures/pi-provider、pi-service、control-tools 仅初始化无链接普通目录供 SDK inMemory 使用，未授权在其中覆写持久会话/历史；真正需要文件必须本次 fresh 子目录。新 Shell capability 执行/镜像/日志/probe 一律新 stage；上述例外仅既有固定回归。带固定旧 proof/output 的 Tester 4 文件、PM package tests、Reviewer current包验证已在精确授权内，由各原 owner 迁新 stage/fresh run，不靠此例外放行旧路径覆盖。


**CLI 优先 v1：新增角色边界**

客户已确认设计 SHA-256 `8800a806da30da543a326c160a02a885b7187ffedd0f1cc7429addfddb7fa3e5`。以下仅确立本阶段唯一归属；应用源码与测试仍须经客户审阅的精确 task_ops 配置及节点派发后修改。旧 Shell 验收与证据暂停且只读。

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 文件 | `bin/legion.mjs` | ProjectManager 本阶段独占；仅精确任务派发后可写 |
| 文件 | `bin/chat.mjs` | ProjectManager 本阶段独占；仅精确任务派发后可写 |
| 文件 | `tests/cli/test_chat.test.mjs` | ProjectManager 本阶段独占；仅精确任务派发后可写 |
| 文件 | `docs/roles/ProjectManager/docs/feature/cli-project-workflow.md` | ProjectManager 本阶段独占；仅精确任务派发后可写 |
| 文件 | `docs/roles/ProjectManager/docs/change/2026-10-10_change_cli-first.md` | ProjectManager 本阶段独占；仅精确任务派发后可写 |
| 条件生成目录 | `.ans/runtime/legion-cli-first-v1/ProjectManager/packaging/` | 仅本角色本阶段检查产生的隔离临时效果；不得覆盖旧候选 |
| 条件生成目录 | `.ans/runtime/legion-cli-first-v1/ProjectManager/npm-cache/` | 仅本角色本阶段检查产生的隔离临时效果；不得覆盖旧候选 |
| 条件生成目录 | `.ans/runtime/legion-cli-first-v1/ProjectManager/fixtures/` | 仅本角色本阶段检查产生的隔离临时效果；不得覆盖旧候选 |
| 条件生成目录 | `.ans/runtime/legion-cli-first-v1/ProjectManager/evidence/` | 仅本角色本阶段检查产生的隔离临时效果；不得覆盖旧候选 |

本边界不授权密钥持久化、旧 Shell 记录重验、其他角色源码写入或扩大产品内 Agent 权限。


**CLI 角色独占文件 v2：运行效果与调度记录**

本阶段产品运行时取消 task.writeSet，普通项目修改权来自当前持久角色 owner。开发角色的文件归属仍由本 Section 1 确定；ANS 开发派发列表只约束本仓库实施，不进入产品运行时计划。

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 条件生成目录 | `.ans/runtime/legion-cli-role-owned-v2/ProjectManager/fixtures/` | 仅本角色本阶段隔离运行产物；新 run 不覆盖历史证据 |
| 条件生成目录 | `.ans/runtime/legion-cli-role-owned-v2/ProjectManager/user-data/` | 仅本角色本阶段隔离运行产物；新 run 不覆盖历史证据 |
| 条件生成目录 | `.ans/runtime/legion-cli-role-owned-v2/ProjectManager/tmp/` | 仅本角色本阶段隔离运行产物；新 run 不覆盖历史证据 |
| 条件生成目录 | `.ans/runtime/legion-cli-role-owned-v2/ProjectManager/evidence/` | 仅本角色本阶段隔离运行产物；新 run 不覆盖历史证据 |
| 条件生成目录 | `.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/` | 仅本角色本阶段隔离运行产物；新 run 不覆盖历史证据 |
| 条件生成目录 | `.ans/runtime/legion-cli-role-owned-v2/ProjectManager/npm-cache/` | 仅本角色本阶段隔离运行产物；新 run 不覆盖历史证据 |
