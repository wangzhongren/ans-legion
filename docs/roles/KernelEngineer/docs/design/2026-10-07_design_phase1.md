---
id: kernel-phase1
type: design
title: 本地提案的权限判定与受控写入
created: "2026-10-07"
updated: "2026-10-07"
timezone: Asia/Shanghai
status: implemented-unverified
related: [kernel-permission]
events:
  - date: "2026-10-07"
    kind: designed
    summary: 按已接受 legion-v1 设计实施，无新增选装
---

Backend 提案写 backend 文件时可以执行，写 frontend/login.vue 时必须拒绝且保留文件。实现顺序为 Model、纯 PolicyDecision、MutationGate、EventLog 和临时工作区 demo；每步先跑所属 unittest 再连接依赖。

所有业务数据为不可变 Model。PolicyService 只计算五类决策，明确 deny 优先于审批、交接和扩权。Pipeline 保存可信 Session、边界、任务状态和组织版本；内部授权对象管理绑定摘要的单次许可。MutationService 不调用 PolicyService，授权不通过上层回调传入。普通公开 Service/Provider 工厂无授权，不能接受伪造 ALLOW 执行写入。许可内部验证是纯 Model 不变量；实际路径检查和原子替换留在 Provider。

Provider 在 workspace/.ans/events/index.jsonl 与 YYYY-MM-DD.jsonl 中记录带 Asia/Shanghai 时间的事件，核对两份内容一致；时间由 Provider 创建。Provider 再检查相对路径、控制面、大小写、链接及实际根目录。审计先记提案和决策，执行前记意图；意图失败关闭写入。文件成功替换后的结果审计失败报告 audit_failed 且 observed_mutation=true，不宣称文件与日志跨文件事务。Event 不记录正文或异常中的敏感原始字符串。

本地公开受控 API 为信任边界。私有实现反射、宿主权限和恶意共享 Python 进程不属于沙箱保证。只实现 write_file，无模型请求或 subprocess adapter。

验证覆盖冻结身份、默认拒绝、五类决策、直接调用与伪造/重放许可、身份任务版本边界和摘要变化、路径逃逸及链接、写失败、审计写前失败与写后失败。用标准库 unittest 和真实临时文件验证。

[当前功能](../feature/permission.md) · [接口](../../api-spec.md) · [已接受整体设计](../../../../design/2026-10-07_design_legion-v1.md)

实施结果：Model→Policy→Provider/Mutation→EventLog/Pipeline→Demo 按序连通，当前 40 项 owner unittest 与 CLI demo 通过，独立验收待 Supervisor。index/daily 部分失败会使后续写入关闭，无跨文件事务保证。

## 同版审批与集合契约修复（2026-10-07）

独立 Reviewer 在原候选发现两项 P1：审批资源原始字符串比较让大小写/反斜杠别名写入同一受审批文件；标量字符串 collection 被拆成字符，使 deny 或 action approval 丢失。两项严格回归在修改前重新执行，2 个测试产生 5 个失败断言。原 40 项 owner 与 demo 证据保留为历史，不能证明这两项契约成立。

本次修复沿用 legion-v1 和现有 writeSet：Model 在构造边界时拒绝七个 collection 字段的标量字符串/字节及不可迭代输入；路径审批条件在构造时验证合法相对资源。Policy 和 permit 复核共用一个纯 Model 审批谓词，以既有路径规范化、分隔符与 casefold 比较资源，保留 write_file action token。非法审批路径直接抛 ValueError，不忽略条件后 ALLOW。明确 deny 优先级保持原规则。

先运行 Model，再 Policy，然后实际 gate 与 Reviewer 原样只读回归；最后在文档完成后通过 [修复任务](../../../../scheduling/legion-v1-approval-repair.md) 固定 unit/demo 新候选。此段初写为待实施方案，同版契约修正已经授权，无新增选装。随后按序完成 Model 7、Policy 8、Gate 13 项检查，完整 owner 47 项通过；Reviewer 原样两个严格回归只读重跑通过。最终 task_ops unit/demo 与新组合验收见修复任务，原 candidate 证据不再作为当前依据。
