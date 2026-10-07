---
id: adapter-phase1-design
type: design
title: 本地受控工具参数转换为写入提案
created: '2026-10-07'
updated: '2026-10-07'
timezone: Asia/Shanghai
status: implemented-unverified
related: [legion-v1, proposal-adapters]
events:
  - date: '2026-10-07'
    kind: designed
    summary: 根据已确认并指示开发的 legion-v1 制定角色实现方案
  - date: '2026-10-07'
    kind: implemented
    summary: 两个本地变体按共同契约实现，owner 14 项测试通过，独立验收待调度
  - date: '2026-10-07'
    kind: evidence-invalidated
    summary: Kernel 同版依赖修复后原证据转为历史，沿用原方案重新检查
---

# 先生成提案，再交给权限通道

模型工具参数声称自己是其他角色时，不能因此获得该角色权限。本版计划把 `legion_write_file` 的 resource、content、proposal_id 转为 Kernel 已有的不可变 ActionProposal，并把可信宿主传入的 AgentSession 原对象保存在 proposal.session。

本记录细化[已接受 v1 设计](../../../../design/2026-10-07_design_legion-v1.md)，同版开发已获授权。所属[功能说明](../feature/proposal-adapters.md)先以草稿记录，代码实现后更新为实际流程。

两个本地变体使用同一 ProposalService 契约：`convert(tool, parameters, session)`。公开入口通过 `create_codex_adapter()` 和 `create_claude_adapter()` 返回本层服务契约；具体类留在 impl。共用转换实现是因为本阶段两者收到相同受控参数，并无厂商消息封装差异；保留两个工厂满足两策略的共同契约验收，不构造虚假的厂商协议。

验证 tool 必须精确等于 legion_write_file；parameters 必须是 Mapping，三个必需字段存在，resource、proposal_id 为非空字符串，content 为字符串（允许空文本）；session 必须是有效 AgentSession，其四个公开身份字段为非空字符串。未知字段丢弃，包含 role_id、task_id、session、action、capability；只有可信参数 session 决定身份。将 action 与 capability 固定为 write_file。非法输入抛 ValueError，不能返回半成品。

Adapter 不认证 Session 的来源、角色是否存在或当前 task/version；可信宿主提供 Session，Kernel Runtime 以对象身份与登记集合核验。路径权限与安全语义也留给 Kernel；适配器保持 resource 原字符串。无文件写入、网络、子进程、真实付费模型调用、一般 CLI 或流式协议。

## 变更范围与验证条件

仅写 pinned `.ans/project.json` 中 AgentAdapterEngineer 的 10 个 writeFiles：三层 Service 文件、一个 unittest 文件及六个 owner 文档。Kernel Model 与所有治理、其他角色文件只读。项目未发现 Git 仓库，使用 task_ops 的候选内容哈希记录版本。

Service 只依赖只读 Kernel Model，不引用 Kernel 实现或 Runtime。公共入口只导出 ProposalService 和两个工厂，无导入时外部资源初始化；命名空间包不添加 __init__。

共同契约测试计划验证两个实现的精确 Session 保留、不可变返回、稳定相同 digest、未知身份字段不能覆盖、空内容、非空字符串与类型检查、错误工具、错误 Session、输入保持及无文件/网络/子进程副作用。标准库 unittest 命令为 pinned unit：

```powershell
python -c "import sys,unittest;sys.path.insert(0,'src');result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.discover('tests/adapters'));sys.exit(not result.wasSuccessful())"
```

设计先于代码记录；随后三层 Service 与共同契约测试已实施，owner 实际命令通过 14 项测试、0 跳过。实际接口见[api-spec](../../api-spec.md)。最终 task_ops unit 与 Supervisor 验证记录在[任务证据](../../../../scheduling/legion-v1-development.md)；owner 单测不替代 Reviewer/Tester 的独立检查。

## 同版依赖修复后的复核

2026-10-07 Kernel 已修复审批路径别名及 RoleBoundary 集合输入验证，当前上游候选 `d73b364c0660fb1abcae803d3f914faeb75c8c73d2b56c231d036ea62fa584f2` 已由 Supervisor 接受。只读核对显示 AgentSession 和 ActionProposal 的签名及转换需要的语义未改变；原方案继续适用，不改 Adapter 生产代码与测试。以上最初测试记录保留为历史，当前对 unchanged Adapter 行为重新执行 pinned unit，在全部文档完成后运行一次；实际结果与独立验收由[新任务证据](../../../../scheduling/legion-v1-approval-repair.md)记录。
