# Tester 变化记录

2026-10-07 Workbench v2：按已确认 canonical 和正式十文件任务，原20仅迁 Tester 新阶段 node/tmp；新增真实 Electron 公共完整流与当前 ZIP 原生 UI/DPAPI 重启验收，更新四 current docs 与本版设计/验证。仅两个 approved checks，实际计数与失败历史由 task_ops 留存，旧记录不改写。详见 [v2验证](docs/verification-desktop-workbench-v2.md)。


2026-10-07，客户全 Node/Pi v3 授权下实施 accepted permission12+generic8 有限方案。新增两个 Node integration 与一个 inference-only fixture，更新四份 current 说明并新增本阶段设计/验证；旧 Python/phase1 文件只读保留。

原开发实际20项：19通过、1失败、0跳过。首轮 permission 11/12 的一个测试误用 Error.name 判定自定义 MutationError，改为严格 instanceof 构造类型后 permission12通过；未放宽产品要求。原generic7/8通过，Runtime.close 活动真实 Pi 的取消返回错误被完整及单例运行独立复现。issue tester-runtime-close-terminal-audit 已由 task_ops 接受 stateRevision51，原 [正式失败日志](../../../.ans/runtime/legion-pi-node-v3/evidence/tester-1-unit-f97ea4f6.log) 保留，不以新证据改写历史。

同日关闭修复：原Kernel owner以activeRun覆盖完整终态审计，在同步撤权后先停止会话、等待run完成再关闭Mutation；不吞真正audit fault。当前前六节点verified，Kernel74项和Reviewer22项通过；Reviewer另运行原关闭/真实写后审计错误两严格回归2/2通过。Tester只更新六份current文档，原20测试及fixture逐字节不改；文档完成后仅运行一次approvedunit，当前实际candidate/20项组合结果见 [关闭修复任务](../../scheduling/legion-pi-node-v3-close-repair.md)。

当前状态和精确复现见 [Node验证](docs/verification-node-pi-v3.md)、[设计](docs/design/2026-10-07_design_node-pi-v3.md) 和 [任务记录](../../scheduling/legion-pi-node-v3.md)。前代审批 alias/scalar P1 继续严格迁移，原失败记录见 [Reviewer历史](../Reviewer/docs/review.md)。Python v1 17项报告保留为 [历史](docs/verification.md)，不作为 Node 成绩；业务导航见 [feature-map](feature-map.md)。
