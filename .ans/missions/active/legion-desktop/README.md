# Legion Desktop 工作台 v2 Mission

客户已直接确认[工作台 v2 方案](../../../../docs/design/2026-10-07_design_desktop-workbench-v2.md)，选择专注对话布局。组织 v004 和精确执行策略已接受；实际进度与证据见 [state.yaml](state.yaml)，完成情况以 Supervisor 的真实核验记录为准。

客户配置 AI，选择任意真实项目文件夹，向唯一“项目管理”发送需求。首条消息创建或复用该项目的管理会话，讨论后形成具体角色、任务、依赖和文件范围。客户确认当前计划后才创建并调度动态执行 Agent。其他成员只显示状态与详情；主进程同时拒绝对其直接聊天或启动。软件检查显示未运行，当前授权不包含任意 Shell 执行器。

DesktopEngineer 独占桌面能力及界面；原 ProjectManager 负责 Node 包、依赖、启动入口和 Windows 便携 ZIP；Reviewer、Tester 独立审查验收；Supervisor 是唯一调度者。Governance 只维护当前 Mission 说明和接受的治理定义，不实施或测试应用。

原任务 [legion-desktop-workbench-v2](../../../../docs/scheduling/legion-desktop-workbench-v2.md) 保留前三个未变化的已核验阶段，以及能力阶段原 47 项检查的历史。后续发现五个原 Desktop 测试需要按公共调用者隔离生成目录，原 Interface 已有效停止；修复依据见[必要测试修复说明](../../../decisions/legion-desktop-workbench-v2-fixture-isolation-repair.md)。同策略的[接续任务](../../../../docs/scheduling/legion-desktop-workbench-v2-fixture-repair.md) 执行修复后的能力检查、界面、桌面发行、独立审查和完整流程验收，最后由真实零 authored ProjectManager 任务执行公共桌面入口检查。

当前工作台已完成正式验收：八个逻辑阶段、十二项阶段检查全部通过，公开 Node 回归182项和桌面公开入口73项均无失败或跳过。公开入口重新生成 ZIP 后，独立 Reviewer 15项和 Tester 两个完整流程 runner 在最终产物上再次通过；所有节点 inactive。原始、接续、公开入口和[最终产物复核任务](../../../../docs/scheduling/legion-desktop-workbench-v2-artifact-recheck.md)分别保留真实记录。

`task-graph.yaml` 仅说明这些实际阶段的关联，不授予派发或验证权限。原 GUI v1 三页和旧 Node/Pi 成果保留历史，不能替代当前版本的界面、加密、真实协议、完整流程与 ZIP 启动证据。当前 Windows ZIP 为194645336 bytes，SHA256 `11c16a8c308d05f81ae66831f0a661d47547fd8a1e1606b4dcc149164722b298`。解压完整目录后运行 LegionDesktop.exe；最终产物、实际检查、使用步骤和局限见 [Supervisor 交付说明](../../../../docs/roles/Supervisor/docs/delivery-desktop-workbench-v2.md)。Git 发布按客户直接指示进行，范围见[发布记录](../../../decisions/legion-git-publication.md)。
