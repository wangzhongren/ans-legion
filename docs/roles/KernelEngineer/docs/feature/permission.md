---
id: kernel-permission
type: feature
title: Node 文件提案的权限判定与写入
created: "2026-10-07"
updated: "2026-10-07"
timezone: Asia/Shanghai
status: implemented-owner-tested
---

# 只修改有权修改的文件

工作台 v2 先由 Human 明选精确 contextReadSet，Desktop ProjectProvider 用品牌只读断言有限读取；ContextSnapshot 绑定路径、字节/SHA。计划确认产生一次 taskApproval，绑定 workspace identity、plan/profile/context、组织、role/task 和精确 writeSet。Model 构造本身不授权，旧 requiredApprovals 仍返回 REQUIRE_APPROVAL，控制面写仍硬拒绝。

```mermaid
flowchart TD
  selected[Human 明选文件] --> read[opaque readAuthorization 与有限原生读取]
  read --> snapshot[不可变路径 bytes SHA 快照]
  snapshot --> confirm[Human 确认计划和精确 task]
  confirm --> instance[一次 taskApproval 绑定实际 Session 和实例]
  instance --> policy[纯 Policy 与单次 opaque permit]
  policy --> verify[Storage 实际root context字节 SHA重查]
  verify -->|变化或无法验证| invalid[release verificationFailure 永久撤销整个authority]
  verify -->|匹配| intent[意图审计与临时文件]
  intent --> final[最后同步root context 输出父链 授权重查]
  final --> commit[同步rename]
  commit --> audit[结果审计 如实observedMutation]
```

mutationAuthority 只有 consume/recheck/release；recheck 返回 MutationVerification，Provider 不调用 controller 或 Pipeline。成功 release 只清理本次 receipt，允许同task后续独立 permit；三个验证失败原因会立即永久 invalid 全部 read/task/permit/receipt，恢复旧文件/版本不复活。授权写若改变确认上下文，也不能静默刷新旧SHA。

本阶段 Model45、Storage/Event24、Policy/Scope17 已通过；最终九suite证据见[工作台任务](../../../../scheduling/legion-desktop-workbench-v2.md)。新增context链接EPERM及输出父链晚变用例明确为元数据刺激；其余root替换/SHA/字节/原生审计实跑。下列 Runtime 使用与 close 行为继续兼容；旧74项成绩是历史。参见[当前设计](../design/2026-10-07_design_desktop-workbench-v2.md)和[API](../../api-spec.md)。

可信宿主通过 createRuntime 注册角色边界和固定身份，提交文件提案后得到决策及实际结果。Backend 合法文件写入成功；越界 Frontend 登录文件保持原值。公开入口为 Runtime.submit；permission demo 用临时工作区实跑六个场景并退出清理。

```mermaid
flowchart TD
    input[可信身份提交文件提案] --> policy[纯 Policy 检查身份任务版本工具能力资源]
    policy --> audit[记录 proposal 和 decision]
    audit --> auditok{审计可用？}
    auditok -->|否| blocked[返回 audit_failed 停后续写]
    auditok -->|是| deny{明确 deny 或非法资源？}
    deny -->|是| no[不执行并记录 mutation_failure]
    deny -->|否| approval{需要动作或资源审批？}
    approval -->|是| wait[REQUIRE_APPROVAL 不执行]
    approval -->|否| scope{在角色和可选任务实例范围？}
    scope -->|否| branch[返回 DENY 或合法交接扩权建议 不执行]
    scope -->|是| permit[私有 authority 颁发单次许可]
    permit --> gate{当前绑定仍有效且路径安全？}
    gate -->|否| no
    gate -->|是| intent[记录 mutation_intent]
    intent --> intentok{审计成功？}
    intentok -->|否| blocked
    intentok -->|是| recheck[异步等待后重验并写同目录临时文件]
    recheck --> commit{最终绑定与路径有效？}
    commit -->|否| failure[清理临时文件并记录 mutation_failure]
    commit -->|是| replace[同步 rename 实际替换]
    replace --> result[记录 mutation_success 或文件失败]
    result --> resultok{结果审计成功？}
    resultok -->|是| done[返回 written 或 failed]
    resultok -->|否| observed[返回 audit_failed 保留 observedMutation 停后续写]
    failure --> resultok
    wait --> no
    branch --> no
```

七个边界集合字段必须为元素集合，字符串不能拆成字符。审批 write_file 为 action token；其余条件为合法完整相对资源。策略和许可共用 Model 谓词，规范化分隔符和大小写；非法条件直接拒绝构造。创建和执行都遵守 deny 优先，审批/交接/扩权仅返回，不执行组织生命周期。

prepare 返回 decision/opaque permit；execute 再查当前状态与摘要且消费许可。替换内容、目标、身份、run、grant 或任务/边界/版本会失效；恢复旧版本也不恢复旧许可。正常 public Provider/Mutation 工厂无授权，伪造 ALLOW 或 permit 无法写入。Controller 身份与 Session 从可信宿主绑定，不相信模型声明。

内部审计只写 .ans/events/index.jsonl 及日期文件，时间由 Provider 生成 +08:00。工作区和所有父组件检查 Node lstat 可识别 symlink/junction；普通提案写控制面始终拒绝。同工作区不同 Runtime 串行提交。坏日志关闭后续写，index/daily/目标不是事务；替换后审计失败如实报告已经改动。

原Node demo 输出一成功、五拒绝、backendWritten=true、frontendPreserved=true 与23条有序事件，其断言包含在当前固定九suite。原生文件/审计回归与注明的链接元数据刺激分开记录，不声称所有reparse tag覆盖。完整命令与结果字段见[API](../../api-spec.md)。

Runtime.close 同版修复仅改变关闭顺序：先撤销权利，等待活动 Pi 运行取消与终态审计，再关闭 Mutation。权限决策、文件及审计故障语义不变，真实审计失败不会被误报为取消。当前74项 owner 与五项最终检查见[修复任务](../../../../scheduling/legion-pi-node-v3-close-repair.md)；原73项为历史，严格 Tester 关闭发现保留。

[Pipeline 源码](../../../../../src/kernel/pipelines/permission.mjs) · [当前设计](../design/2026-10-07_design_node-pi-v3.md) · [当前任务证据](../../../../scheduling/legion-pi-node-v3.md)。
历史：[Python v1 设计](../design/2026-10-07_design_phase1.md)、[审批同版修复](../../../../scheduling/legion-v1-approval-repair.md)、[原独立缺陷](../../../Reviewer/docs/review.md)。这些保留原发现与成绩，不充当当前 Node 验收。
