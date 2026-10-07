# 工作台 v2 验证目录修复

客户已直接确认工作台 v2，并选择专注对话布局。本项是完成该授权中的真实公共回归所必需的测试修复；不增加产品能力、角色权限或客户操作步骤。

Supervisor 和原 DesktopEngineer 在 Interface 阶段发现：已核验的 capabilities 中五个有文件效果的测试仍固定使用 DesktopEngineer 的生成目录，部分测试还从当前工作目录定位项目。后续 ProjectManager、Reviewer、Tester 的公共入口按已确认策略传入 `LEGION_DESKTOP_TEST_ROLE`，应分别写入各自的本阶段 desktop 生成目录。固定目录会违反这些调用者的已接受隔离范围。

修复仅由原 DesktopEngineer 修改已接受的五个精确文件：

- `apps/desktop/tests/unit/project.test.mjs`
- `apps/desktop/tests/unit/history.test.mjs`
- `apps/desktop/tests/unit/workbench.test.mjs`
- `apps/desktop/tests/unit/profiles.test.mjs`
- `apps/desktop/tests/unit/workspace.test.mjs`

保留所有行为断言、真实 SDK 和文件系统覆盖，统一使用约定的 caller role、基于文件位置定位项目及已有的角色专用生成目录。无文件效果的 Model 测试无需修改。产品源码、tarball 和安装依赖不变。Interface 本身的两项测试仍属于原 Interface 任务范围，由同一 owner 处理。

执行策略 SHA256 `2546ebd0b8756eccb83bced6808c10d1c25c3bc175ca8f676a9f1d5172cb706b`、客户确认方案 SHA256 `715639b5dd278437059f29bde1e7c02ac90d94af18f9bf5a6b5367d16e9ab5d3`、组织 v004、121 个 authored 白名单及 33 个生成范围均不变。无需修改冻结的原任务定义或重走客户确认。

原 capabilities 47/47 是原候选的真实历史证据。不得原地更改已 verified 的前段，再继续使用其原候选作当前证据。Supervisor 须先取得当前 Interface worker 的有效 stop，然后以同一策略创建新的有限五节点任务：五测试修复并执行已批准的 capabilities 检查 → 原十二文件 Interface → 原十文件 desktop-package → 原九文件 Reviewer → 原十文件 Tester。新任务固定其他二十五个 capabilities 输出、原前三个已 verified 阶段和所有相关依赖作为只读输入，记录修改前后实际候选。前三个阶段若实际输入与日志均未变化，可保留原证据；受五测试变化影响的后段必须使用新证据。

最后仍须执行真实零 authored ProjectManager `desktop-public` 补充检查，并在重新 make 改变 ZIP 时核对最终实际产物和相应启动证据。原任务记录、旧日志、旧 Node 包和旧 GUI ZIP 保留历史。Root 在此只说明必要治理判断，不写测试，不调度业务 worker，不替代 Supervisor 的任务记录、核验或最终交付。
