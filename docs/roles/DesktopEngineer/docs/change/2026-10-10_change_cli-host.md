# CLI Host：唯一 Node 工厂与按角色并行

已确认 v2 设计的本节点实施说明。入口为 `createHeadlessWorkbenchPipeline({userDataDir,leaseRoot?,profile})`，profile 使用现有 EnvironmentProfiles Service 的配置；环境凭据仅在进程内，不调用 Electron 加解密。Node 与 Desktop 复用唯一 Workbench Pipeline，项目租约继续通过 Project Service public 生命周期取得。

Host 最多同时派发四个依赖就绪任务。同角色任务串行，不同角色的 Pi 推理与读取可重叠，独占 owner 的受控写请求可同时提出，实际提交经共享队列。每个任务保存自己的 Agent、读取/检查 AbortController、日志、结果；取消先撤销全部授权、取消全部活动实例，再等待操作结束与租约释放。

metadata 保存使用独立串行队列，在队列回调内读取最新项目再合并任务状态，避免晚提交覆盖其他任务结果。普通受控 Mutation、Check 与 Shell 请求进入 Host 共享命令队列，执行时重验绑定并生成实际输入快照；Shell 全 authored snapshot 从准备到发布期间其他普通提交等待；内部发布不递归进入此队列。任务终态证据/保留输出复核和Acceptance提交同样进入此队列，避免复核库存时与另一合法提交交叉。检查过期仍失败，不以排队掩盖变化。Kernel 提交锁及最终 owner/source 重验保持原协议，不添加普通写前全项目扫描。

固定 parallel 回归覆盖不同 owner 重叠、同角色串行、依赖失败/独立分支、结果合并、取消全部实例、Check/Shell排队，以及无 Electron 的公开 Node 工厂及凭据不落盘。结果与候选由 task_ops 保存。当前 feature 文档不在本节点范围，后续精确 assignment 更新。

## 2026-10-11 已知key必要拒绝修复

当前runtime0.9.2私有knownKeys接Check/Shell，Host初始Environment解析、Human/工具/历史/候选、Service/Provider CAS均拒绝当前已知值。助手流在每run内存到安全终态后发布，Key拒绝关闭污染会话再重建；正常取消入口捕获原manager/promise以消费真实终态，避免异步warm期间丢引用。Shell输出回调按请求串行，防安全tail结束时多个chunk并发首次创建archive目录。当前功能及限制见[CLI Host](../feature/cli-project-host.md)，最终三固定门证据由本任务记录。
