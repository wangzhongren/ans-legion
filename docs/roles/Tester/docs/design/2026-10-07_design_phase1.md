---
id: tester-phase1
type: design
title: 通过两个本地适配器验证完整权限流程
created: '2026-10-07'
updated: '2026-10-07'
timezone: Asia/Shanghai
status: implemented-unverified
related: [legion-v1, kernel-permission, proposal-adapters]
events:
  - date: '2026-10-07'
    kind: designed
    summary: 在客户已授权的 v1 内准备有限独立集成方案
  - date: '2026-10-07'
    kind: implemented
    summary: 17 项独立集成已实施且开发检查通过，待最终 pinned check 和 Supervisor 验收
---

# 从提案到实际文件和审计的独立检查

Backend 通过两个本地适配器提出写入时，自己的 backend 文件应保存；frontend/login.vue 应保持原内容。Tester 将从公开工厂转换可信 Session 与受控参数，再调用 PermissionRuntime 的 submit、prepare、execute、events、read_file；以真实临时文件和 Provider 日志核验结果，不以模拟 Runtime 替代联调。

本方案属于 [已授权 v1](../../../../design/2026-10-07_design_legion-v1.md) 的独立测试范围，同版实施授权继续有效。仅编写一个独占 integration 测试文件和六份角色说明；不修改生产、合同、配置、组织或其他 owner 测试。当前依赖为 Kernel d73b364c…、Adapter 84a35606…、原样 Reviewer 23 项检查通过的候选；最终准确证据链接任务记录。

有限场景包括两变体等价、可信身份与伪造声明、工具/能力/动作拒绝、deny 和控制面/遍历拒绝、旧版本与任务/边界变更、单次许可及内容篡改、审批/交接/扩权不执行、两个已修复 P1 的公开流程回归。成功须证明目标内容和完整事件；拒绝须证明旧文件不变或新目标不存在。审计检查 index 与日期日志的事件镜像、序号、身份、摘要、相关 ID 和 +08:00 时间且无正文；通过实际 Path 文件追加故障验证意图失败前无写入、结果失败如实报告 observed_mutation。另从实际 Interface run_demo 复测原演示。

这些是正常受控本地 Python API 流程。没有真实 Codex/Claude 账号、CLI Agent、外部服务或依赖安装；不重复每个 owner 的全部单测。真实 Windows 链接/重解析权限与恶意共享宿主竞争隔离不在本次集成证明中，由 [Reviewer 限制](../../../Reviewer/docs/review.md) 和 Kernel owner 证据说明。

已在 Python 3.14 Windows 下，以 PYTHONUTF8=1、PYTHONDONTWRITEBYTECODE=1、TEMP=TMP=D:/work/code-work 运行标准库 unittest；随机工作区只在该目录创建并通过 TemporaryDirectory 清理。开发检查 17 项通过、0 跳过，包含真实路径阻塞和 replace 失败后旧内容保留。最初一次运行的 helper 参数重名造成一个测试方法两子例错误，在 Tester 自有 helper 修正，未改产品或断言。文档完成后用 task_ops pinned unit 执行 discover('tests/integration')，不在最终检查后修改输出；准确最终结果与候选见 [任务记录](../../../../scheduling/legion-v1-approval-repair.md)。测试报告见 [verification](../verification.md)。受测行为见 [Kernel 权限](../../../KernelEngineer/docs/feature/permission.md) 与 [Adapter 提案](../../../AgentAdapterEngineer/docs/feature/proposal-adapters.md)。
