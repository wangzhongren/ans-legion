---
id: supervisor-legion-v1-execution
type: design
title: 逐阶段完成权限演示并独立验收
created: '2026-10-07'
updated: '2026-10-07'
timezone: Asia/Shanghai
status: verified
related: [legion-v1]
events:
  - date: '2026-10-07'
    kind: designed
    summary: 接受客户同版开发指令，固定四阶段交付与证据门槛
  - date: '2026-10-07'
    kind: implemented
    summary: 完成四角色交付并将独立发现的两个 P1 交回原 owner 修复
  - date: '2026-10-07'
    kind: verified
    summary: 当前四节点全部验收，101 项通过及 CLI demo，0 跳过
---

# 逐阶段完成权限演示

Backend 提案可以写本角色的 backend 文件，但不能写 frontend/login.vue。要让这个差异可运行、可复现，先由内核 owner 建立固定身份和判定，再让受控 gate 在真正写文件前复核；两个本地适配器只转换提案，不能授予权限。

本记录组织执行顺序，行为与范围沿用客户已经授权的 [Legion Runtime v1 设计](../../../../design/2026-10-07_design_legion-v1.md)。没有增添选装。实际系统与角色协作见 [架构](../architecture.md)，业务完整流程由各 owner 的功能文档说明。

```mermaid
flowchart TD
    A[用户已授权 v1 开发] --> B[Supervisor 固定配置和任务范围]
    B --> C[Kernel Model → Policy → Gate → EventLog → Demo]
    C --> D{逐层及最终 unit/demo 当前证据通过}
    D -->|通过| E[两个本地 proposal adapter]
    D -->|失败| C
    E --> F{契约测试通过}
    F -->|通过| G[独立 Reviewer 结构与安全检查]
    F -->|失败| E
    G --> H{当前组合审查通过}
    H -->|通过| I[独立 Tester 完整流程回归]
    H -->|缺陷| J[回原代码 owner 修复]
    I --> K{当前组合验证通过}
    K -->|通过| L[Supervisor 交付命令、证据与局限]
    K -->|缺陷| J
    J --> M[重建受影响节点与下游证据]
    M --> G
```

每个执行节点使用 owner 的完整配置 writeFiles 作为精确 writeSet 与 requiredOutputs。kernel 检查为 unit 与 demo；adapter、reviewer、tester 各自使用其 unit。上游摘要、合同、设计或相关输入变化会使依赖证据失效。

调度记录只由 task_ops 写入。Worker 仅获得自身 assignment credential，不能自验收或创建子 worker。Supervisor 的文档属于已接受 Section 1 的调度职责，不冒充工程实现。

实际命令、候选与结果已记录在 [交付说明](../delivery.md)。原内核与适配器 owner 检查后，独立 Reviewer 复现审批路径别名及 scalar string 边界集合两个 P1。新的 [有界修复任务](../../../../scheduling/legion-v1-approval-repair.md) 沿用接受范围、合同和配置，原 Kernel owner 最小修复后，当前 Kernel 47、Adapter 14、独立 Reviewer 原样 23、独立 Tester 17 项及 CLI demo 全部通过。四节点已经验收，原开发记录不作为当前验收。此修复不改变客户需求或权限范围。
