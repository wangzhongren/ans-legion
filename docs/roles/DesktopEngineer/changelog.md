# DesktopEngineer 变更记录

## 2026-10-07 — 工作台 v2 专注项目管理会话

按已确认 focus_conversation 方案，当前窗口改为左侧客户项目与动态成员、中央同一 PM 对话、底部固定输入，任务与来源详情按需展开，AI 连接在次级页，浅深色使用一致主题变量。任意真实文件夹可进入，客户无须提供开发组织；首消息创建或复用独立 PM，讨论工具/写入为空。Human 仅可与 PM 聊天和确认，其他成员只有任务、连接与范围状态。

唯一 WorkbenchPipeline 的15方法已在能力阶段冻结，Interface 使用14个固定IPC，以精确sender/mainframe/本地URL/输入白名单守卫并重建安全wire DTO；原启动readiness与Interface-owned幂等close形状保留。主进程原生目录框取得根；Human上下文输入仅精确相对列表，通过冻结品牌读授权/身份/预算/SHA路径处理，私有根、密钥、controller均不返Renderer。

聊天正文隐藏内部legion-plan块，真实历史完整保留；结构化确认显示角色、依赖与逐个文件，确认只提交宿主digest。模型completed文本不代表文件生成，结果显示实际目标写入数、缺失/拒绝、审计失败，软件检查明确未运行（not_executed）。无项目或连接时给可操作提示，发送/保存失败保留草稿，成功才清空接受输入/新密钥。每秒轮询保留输入、密钥动作、PM映射、筛选、滚动与聚焦select；项目切换显式回顶，worker点击先展开父成员详情，视图不提供直接chat/start。

能力原正式47/47已核验。发现公共测试caller生成目录问题后，原Interface在旧任务issue33/stop34停写；原owner在限定五测试节点修正import.meta绝对root与LEGION_DESKTOP_TEST_ROLE枚举/role目录，完整47/47再次通过并由Supervisor核验。产品能力源码与其他25前置输出未改；当前Interface用新任务收束原12文件。本候选检查入口为Pipeline4、IPC3，含真实公开Pipeline本地文件效果与聚焦DOM替身，正式日志见 [当前任务](../../scheduling/legion-desktop-workbench-v2-fixture-repair.md)，[旧任务](../../scheduling/legion-desktop-workbench-v2.md) 保留历史。

本阶段未运行v2原生Electron界面、DPAPI重启或便携ZIP；DOM/加密替身与旧v1窗口证据不能代替。PM接线/打包、Reviewer与Tester独立产品验证仍由下游实际执行。当前完整流程见 [工作台](docs/feature/desktop-console.md)，已冻结取舍见 [角色v2设计](docs/design/2026-10-07_design_desktop-workbench-v2.md)。

## 2026-10-07 — GUI v1 历史实施

按客户已确认并授权开发的同版设计，实现中文 AI 配置、角色映射和状态页。Profiles 前段完成不可变有限 Model、密钥保留/替换/清除、safeStorage、固定三协议探测和安全错误；Workspace 前段完成受限受控 YAML、真实组织/角色边界、task_ops Markdown 与双格式审计投影。两前段已经 Supervisor 验证冻结。

Interface 阶段组合 Pipeline，提供无导入启动副作用的 startDesktop/readiness/重复 close 契约；启用 Node off、contextIsolation、sandbox、固定 preload 与精确 sender/main frame/URL/输入守卫。每秒观察刷新保留 AI 表单、密钥动作、映射草稿、filter 与滚动位置；导航回顶，保存成功才清空密钥输入。来源失败与过期快照明确显示，治理/任务/审计均不声明在线。

前段单元为 Profiles14、Workspace9；当前 Pipeline3 与 IPC3 通过，无跳过。真实 Electron owner smoke 已完成 Windows DPAPI 保存/重启解密、受控 localhost 认证与中文三页截图，最终 evidence 目录 `fixtures/DesktopEngineer/interface-smoke-Fx9riG`。最初 smoke 的 Windows import URL、userdata 父目录、debugger argv 位移、入口顶层 readiness await 均是生成 fixture 问题，已经在本角色隔离范围修正；最后实际运行通过9项。查看截图后修正样式 class 对应与页首截图/导航。

当前五份角色文档报告实际行为与接口。便携 ZIP、PM 根接线、独立 Reviewer/Tester 与最终治理验收属于后续阶段；O1 任务启停未实施。历史方案保持原阶段事实，最新用户流程见 [桌面控制台](docs/feature/desktop-console.md)。
