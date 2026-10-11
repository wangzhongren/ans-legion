# 项目 Shell 受控 SDK 工具

执行角色通过 legion_request_shell 申请完整命令，Host 推导真实身份，PM 独立审核。Adapter 将原工具调用保持等待，直到 Host 返回执行及发布终态；PM 不代替角色执行。审批进度和实时输出由 Host 成员记录提供。

| 工具 | 参数 | typed 回应 |
| --- | --- | --- |
| legion_request_shell | command、reason；cwd 默认空、generatedEffects 默认 []、network 默认 none、timeoutSeconds 默认 300 最大 900 | ShellDecision + ShellResult |
| legion_review_shell | requestId、requestDigest、revision、approved、reason | AgentControlDecision + AgentControlResult |

审核工具只向真实 ProjectManager 实例开放且必须在 Host scope 内。模型自报身份、结构外字段、对话中的同意均不形成许可。公开 Service 保持八个生命周期方法，没有 Host grant、Shell receipt、执行器、二进制 body 或 SDK bash API。

原 PiToolRequest 对象是 pending identity；克隆、重复、摘要不符、跨运行或取消后的结果被拒。ready_for_publication 是 Host 中间状态，不能交付 SDK。published/partial_published/failed/denied/cancelled/stale/unsupported/error 返回真实 typed 结果。候选包含 metadata、SHA 与 bytes，encoding 可表示 binary；没有 binary payload。Shell 退出码 0 不生成 CheckResult，不代表检查或验收通过。

两种 lifecycle 都接受 budgets，默认活动时间 180000ms、maxOutputTokens 8192、maxTextCharsPerTurn 65536、maxQueueEvents 256。Host 等待暂停累计活动时间，回应后使用剩余时间；Host 管理审批 TTL 和 Shell 总执行期限。禁 SDK 自动重试、compaction、资源发现和原生 Shell。单次运行新实例仅第一次 start_run 前可恢复一次绑定当前 instance/profile 的纯 user/assistant 文本，不恢复旧 pending 或许可。

Kernel Host Shell Service 默认预览 8KiB，上限 64KiB；Host 可按当前上下文进一步缩小。Adapter 不访问 publicationReceipt/readCandidateData。Anthropic SDK 1.0.4 wire 会丢根 additionalProperties；Model 严格字段验证仍在发出 Host 请求前执行。

当前 Adapter 本层本地 SDK 三协议验证；实际 OS 沙箱、PM 队列、受控发布和独立验收分别由 Kernel、Desktop、Tester 提供，本层不声明其已验收。
