# Legion Runtime 第一阶段验证记录

2026-10-07 10:38（Asia/Shanghai），ANS Governance 只读核验当前配置、组织、文件归属、task_ops 状态和真实日志。软件实施由固定工程师角色完成，独立 Reviewer 与 Tester 产出审查和集成证据；本记录汇总实际结果，不代替人工授权或伪造审批。

## 当前实施结果

核心模型、PolicyDecision 的五种决策、单次执行许可与 MutationGate、双 JSONL EventLog、权限 CLI demo 以及两个本地受控提案适配器已经实现。当前 [legion-v1-approval-repair 任务](../../docs/scheduling/legion-v1-approval-repair.md) 的四个节点均 `verified`、`active=false`。

| 节点 / 固定角色 | 当前已验证候选 | 实际测试方法数 | 跳过 |
| --- | --- | --- | --- |
| kernel / KernelEngineer | `d73b364c0660fb1abcae803d3f914faeb75c8c73d2b56c231d036ea62fa584f2` | 47，另 CLI demo | 0 |
| adapter / AgentAdapterEngineer | `84a356064f6c36b286794604514d653cd61e4b7497500d38766e2ee4dd064476` | 14 | 0 |
| reviewer / Reviewer | `940e7990c3a3ff1f4e54f9389f8517c156a2c518cfecc2571b955c32310bfb78` | 23 | 0 |
| tester / Tester | `ae40078ff7460318d20028f263ef042a3635c684a3154a97df1d3a968111cd7e` | 17 | 0 |

合计 101 个 unittest 方法全部通过；适用方法另含两个适配器的子用例。所有正式 check 的退出码为 0、未超时、`candidateUnchanged=true`。环境为 Windows / Python 3.14.0，UTF-8、禁用 bytecode，TEMP/TMP 指向 `D:/work/code-work`。项目没有 Git 元数据，候选身份来自文件摘要，未虚构提交。

真实日志：[Kernel unit](../runtime/legion-v1-approval-repair/evidence/kernel-1-unit-68d30e2c.log)、[CLI demo](../runtime/legion-v1-approval-repair/evidence/kernel-1-demo-cfc7279c.log)、[Adapter unit](../runtime/legion-v1-approval-repair/evidence/adapter-1-unit-be82f9bf.log)、[Reviewer unit](../runtime/legion-v1-approval-repair/evidence/reviewer-1-unit-d86fbb8a.log)、[Tester integration](../runtime/legion-v1-approval-repair/evidence/tester-1-unit-ff6311ee.log)。Governance 对四份 unit 日志分别核对 task_ops 记录的 SHA-256、实际 `Ran N tests` 与 `OK`，没有重新代替各 owner 运行测试。

演示观察到 Backend 目标写成功、Frontend 原内容保持、五种无权限请求拒绝，以及 23 个有序可读事件。完整流程观察与失败语义见 [Tester 报告](../../docs/roles/Tester/docs/verification.md)，当前系统结构和使用方法见 [Supervisor 交付](../../docs/roles/Supervisor/docs/delivery.md)。

Supervisor 已回传最终交付，四节点状态版本为 24，31 份角色交付文档无缺失或断链。Governance 另核对本次三个治理 Markdown 文档的 31 个本地链接，以及三个更新 YAML 的语法和 Mission 证据链接，均通过。

最终 15 个生产源文件汇总 SHA-256 为 `16f071952ae0a3ba88931544bfa35e87c94ac471918c0803b362f5ed5f6246bf`。按相对源码路径→文件 SHA-256 映射、路径排序的 compact JSON 计算；Governance 只读重新计算，与 Supervisor 最终交付一致。

## 治理与回归核验

- 客户授权仍为 Legion Runtime Organization Proposal v1 与“开发”直接指令；当前组织为 `ACCEPTED` / `v001`，包含六个指定角色。
- `.ans/project.json` SHA-256 保持 `05d7740ffa3695044b98a4ed40c0b5d7080b9a94f80760c47951218d3f831c8c`，没有为通过测试扩大权限。
- 60 个精确执行文件授权均属于各角色已接受边界。61 个角色边界条目之间无重叠，其中额外一项是 Supervisor 的交接接收确认。实际 15 个生产 Python 文件及所有实际测试文件均有唯一角色 owner。
- 两个原审批缺陷由原 Kernel owner 修复，再重新核验适配器、独立审查和完整流程。Reviewer 测试源码 SHA-256 保持 `3ecad393e318da89ac6d241c94af1bd1b62b9ce3ceef3c5b476e00c618755b9e`，失败断言未被删改或弱化。
- 原失败与旧候选保留在 [历史任务](../../docs/scheduling/legion-v1-development.md) 和 [Reviewer 报告](../../docs/roles/Reviewer/docs/review.md)，不用于当前最终验收。

本次早期治理核验误要求执行配置与边界列表完全相等，因 Supervisor 合法的额外交接确认条目而触发断言。改为核对“执行 scope 是边界子集”并检查唯一归属后通过；没有修改授权配置或边界来迎合断言。

## 证据范围

本版使用本地受控提案适配器，未调用真实厂商模型、Agent CLI 或外部服务。覆盖正常公开本地 API；不声称恶意共享进程、管理员或并发路径替换的宿主隔离，也没有真实 junction/symlink 创建证据。完整组织变更事务与远程执行不属于已实现第一阶段。

文件替换与两份审计日志没有跨文件事务。替换后结果日志失败可能已经修改目标，接口如实返回 `audit_failed`、`observed_mutation=true` 并关闭后续执行。细节和已测分支以角色报告为准。
