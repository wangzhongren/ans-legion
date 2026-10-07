# KernelEngineer 维护内容

Kernel 让可信宿主接收文件提案或创建具名 Pi Agent。Backend 只能修改获准文件，Frontend 登录文件收到越界提案仍保持原值；实例范围还必须包含在当前任务精确文件集合内。

本角色长期维护纯共享 Model、PolicyService、MutationService、StorageProvider、单 PermissionRuntime Pipeline、Runtime Interface 和 permission demo。当前工作台 v2 派发只覆盖5源码、6测试、7文档：共享连接/对话与确认 Model、Policy scope、Storage 真实上下文验证。既有 Interface/Pipeline、Adapter、package/lock、旧dated设计与Python历史只读。精确权限仍以 boundary Section 1 与正式 assignment 为准。

DesktopEngineer 独占 WorkbenchPipeline，直接调用各 public Services。唯一 ProjectManager 的首消息绑定、Human IPC、动态团队、连接解密和 userData 属于 Desktop；本角色不调度它们。讨论无工具/写范围，不调用旧 Runtime。确认后的执行使用 factory controller 和仅含 consume/recheck/release 的品牌 mutationAuthority；Provider 不持有 controller。既有 Mutation public options 可原样转交新增 authority，无额外包装层。

确认绑定真实 workspace identity、plan digest、profile/context、组织/角色/task/精确writeSet。ContextReadConfirmation.assertForRead 只认可 factory registry 的 opaque readAuthorization；构造数据或恢复 JSON 不授权。Storage 从 receipt 得到 immutable MutationVerification，重查实际root、链接、字节/SHA，并在最终同步输出父链检查后 rename。发现验证失败立刻通过 release failure 永久 invalid 整个 authority；成功释放支持后续独立许可。

Interface → PermissionRuntime → Policy/Mutation/Proposal/PiAgent Service；Mutation → Storage Provider，PiAgent → PiSession Provider → SDK。Policy 是纯计算；共享 Model 只维持不可变契约和纯授权状态。身份/runId、时间、文件效果在 StorageProvider，Pipeline 通过 MutationService 获取。同行 Service 不互调，Provider 不收到上层执行 callback。

Runtime 私有持有 authority；Agent 仅公开只读身份及 run/cancel/close。Session 以实际对象身份识别，权限绑定 task/version/boundary/proposal/content/run/grant，单次 permit 被消费后仍用 opaque receipt 重查。审批匹配统一分隔符和大小写规则，标量集合和非法审批条件在 Model 构造时拒绝。任务、版本、边界改变永久撤销旧权利；取消先撤销，再等待 Pi 停止。

同工作区 Provider 协调文件/日志提交顺序。审计意图失败无目标写入；替换后的结果审计失败如实保留 observedMutation，并关闭后续写。Node lstat 可识别的 symlink/junction 与控制面逃逸拒绝，不声称覆盖所有 Windows reparse tag、恶意共享进程或跨文件事务。

Runtime.close 同步撤权后等待 Adapter 停止及完整 run 终态审计，最后才关闭 Mutation。run.finally 只等待 Adapter，不回等 Runtime.close；真实审计故障保持失败。此前 Tester19通过/1失败定位了关闭顺序缺陷，严格原测试未改。

[当前总设计](../../design/2026-10-07_design_desktop-workbench-v2.md) · [功能导航](feature-map.md) · [公开接口](api-spec.md) · [当前证据](../../scheduling/legion-desktop-workbench-v2.md)。原13项pipeline、74项Node close修复证据是历史；本阶段固定九suite与下游独立验收刷新其输入。
