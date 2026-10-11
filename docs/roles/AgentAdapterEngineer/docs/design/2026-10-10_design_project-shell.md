# 项目 Shell Adapter 设计（2026-10-10）

固定职责 AgentAdapterEngineer，精确派发 adapter-shell。采用已确认项目 Shell v1 与 Kernel 冻结 Model，六个既有 Service/Provider 文件保持相邻公开调用。

SDK 仅注册 scope 授予的 legion_request_shell 和 legion_review_shell。request 明确 command/cwd/reason/generatedEffects/network/timeoutSeconds；review 明确 requestId/requestDigest/revision/approved/reason，只有真实 ProjectManager 实例可获得审核工具。模型参数不能携带身份、permit、receipt 或授权回调。

原 PiToolRequest 保留在 pending Map。Host 完成 PM 审批、执行、发布后以 ShellDecision/ShellResult 回应一次；ready_for_publication 不交付 SDK。摘要重新从原请求参数推导匹配。审批和输出进度由 Host 记录，不提前完成工具。取消和关闭释放 pending；克隆请求、重复回应、迟到回应拒绝。

single_run 与 conversation 都使用可配置活动预算；等待 Host 时暂停，回应后恢复剩余预算。审批 TTL 和 Shell wall budget 不由 Adapter 延长。默认禁自动重试、自动 compaction、外部资源及原生 bash。单次运行恢复仍仅新实例首次运行前一次纯文本 checkpoint，绑定当前 instance/profile，不恢复工具和许可。

工具返回只含有限日志和候选 metadata/SHA/bytes，binary body 不进入模型。Shell 退出码零不构造 CheckResult，不代表 check 或 Acceptance 通过。

验证采用真实本地 SDK 三协议服务和独立 typed boundary checks；冻结全部源与文档后通过本阶段 shell/regression_unit 两个配置检查，不使用外部模型。
