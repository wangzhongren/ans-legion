---
id: legion-v1
type: design
title: Legion Runtime Organization Proposal v1
created: '2026-10-07'
updated: '2026-10-07'
timezone: Asia/Shanghai
status: designed
related: [organization-proposal-v1]
events:
  - date: '2026-10-07'
    kind: designed
    summary: 客户给出六角色版本并明确指示开发，替代旧候选
---

# Legion Runtime：已授权的第一阶段

用户给出 Organization Proposal v1，并以“开发”指示实施本版。六个初始角色为 ProjectManager、Supervisor、KernelEngineer、AgentAdapterEngineer、Tester、Reviewer；旧的九角色候选不再用于当前派发。项目物理目录保持现有位置，显示名称改为 Legion Runtime。

Human → ProjectManager → Supervisor → KernelEngineer / AgentAdapterEngineer / Tester；Reviewer 独立，向 Human 与 ProjectManager 报告。ProjectManager 负责整体架构与用户决策；Supervisor 是本项目明确指定的执行 scheduler，按接受的边界、合同与任务前置证据调度，不拥有工程师的写权限。治理定义仍由 ANS Governance 维护。

## 当前实施范围

按用户的五步图完成：1 核心模型 → 2 PolicyDecision → 3 MutationGate → 4 EventLog → 5 permission demo。CodexAdapter 与 ClaudeAdapter 对同一受控工具的提案做格式转换，绑定可信 Session 的角色和任务；提案内宣称的角色不能覆盖 Session。第一阶段是本地提案/权限演示，无真实付费模型请求、通用 Agent CLI 进程或远程集群。

只允许本阶段的 write_file 受控动作；shell、Git、网络、数据库和组织 Mutation 不通过这一动作执行。扩权、审批、交接返回对应决策，本阶段不实现这些组织生命周期完整闭环。后续组织创建需要另一个设计，不由 KernelEngineer 写 `.ans/organization`。

### 目录及职责

按用户目录覆盖技能默认顶层五层命名，在两个能力目录内保留五层职责：

```text
src/kernel/models/core.py                 核心不变量与数据结构
src/kernel/services/{abstract,public,impl}/policy.py
src/kernel/services/{abstract,public,impl}/mutation.py
src/kernel/providers/{abstract,public,impl}/storage.py
src/kernel/pipelines/permission.py        判定与受控修改编排
src/kernel/interface/demo.py              命令行演示
src/adapters/services/{abstract,public,impl}/proposal.py
tests/kernel/                             工程师层内检查
tests/adapters/                           两个提案适配器契约检查
tests/integration/                        Tester 独立完整流程检查
tests/reviewer/                           Reviewer 结构与安全检查
docs/roles/{Role}/                        owner 功能与验证文档
```

每个实际路径在角色 boundary.md Section 1 精确列明；用户给的目录范围是上限。Python 原生命名空间包避免空 __init__ 与多人共同入口。使用标准库 unittest，不安装依赖。

Interface → Pipeline → Service → Provider；Model 可供所有层使用。Service public 入口只暴露对应服务契约及 factory；内部构造不暴露 Provider 给 Pipeline。Pipeline 组合 policy 和 mutation；mutation Service 不调用 policy Service。Adapter 只依赖只读核心 Model，不调用 Kernel 实现。

## 契约 kernel-adapter / kernel-runtime

核心类型：RoleBoundary（read/write/deny scope、capabilities、tools、required approvals）、AgentSession（固定 role、task、organization_version）、ActionProposal（id、action、resource、content、tool、capability、session 引用）、PolicyDecision（五类 outcome、原因、proposal digest、版本）、ExecutionPermit（单次、绑定参数）、MutationResult、Event。

kernel-adapter：CodexAdapter / ClaudeAdapter 接收受控工具 `legion_write_file` 的参数（resource、content、proposal_id）与可信 AgentSession，返回不可变 ActionProposal。只处理本地受控工具参数协议，不假装兼容完整的厂商流式消息或已连接真实账号；两者保持相同安全保证。未知字段不得授予角色权限，非法工具与参数拒绝。

kernel-runtime：Pipeline 提供受控 runtime 操作，输入 workspace、accepted boundaries、organization version 和固定 sessions。PolicyService 纯判定；MutationService 只能接受 Pipeline 生成并保存在受控 runtime 内部的授权许可。调用者不能直接提交任意 ALLOW 结果绕过 gate。公开 API 必须绑定 proposal、role、task、版本、目标与内容摘要；许可使用后不能重放。Runtime 更新版本或任务状态使旧授权无效，拒绝写入 `.ans/organization`。不存在的角色、身份冲突和非法输入 fail closed。

判定优先级：无效身份/任务/版本、未知工具/能力或明确 deny → DENY；合法且需要审批 → REQUIRE_APPROVAL；越界且有合法 handoff target → REQUIRE_HANDOFF；越界且允许申请 → REQUIRE_SCOPE_EXPANSION；满足所有条件 → ALLOW。默认角色不具有全局 write；组织路径硬拒绝不能被业务 boundary 覆盖。

MutationGate 负责从判定到执行的完整受控通道。路径按实际工作根、组件与 Windows 大小写检查，拒绝绝对越根、`..`、控制面组织目录与链接/重解析点逃逸。执行前重新核验当前 boundary、task、version 和内容摘要，防止陈旧许可。文件替换使用同目录临时文件与 replace；失败明确返回，不声称修改成功。

EventLog 由 Provider 管理：按序追加 JSONL，记录 proposal、decision、mutation 成功/失败（含 role、task、version、resource、digest、correlation），日志不存原始内容和秘密。拒绝也有事件。执行前记录审计意图；审计不可用则 fail closed。写文件成功但结果审计失败时如实报告 audit failure 和 observed mutation，不能声称跨文件事务原子性；此阶段不等于正式组织事务实现。

权限许可和 boundary 位于可信本地 Runtime，对共享宿主进程的恶意 Python 调用者没有独立安全隔离。本版保证正常提案通道、直接 provider/gate 公共调用和无效许可不能绕过授权；不声称抵御宿主管理员或能改写进程内部状态的人。

## 演示与验收

命令预期为 `python -m kernel.interface.demo`（工作目录项目根、PYTHONPATH=src）。演示在临时 workspace 内展示：Backend 写 backend 文件成功；Backend 写 frontend/login.vue 被拒绝且目标不变；缺失能力/工具、明确 deny、版本不匹配拒绝；输出决策、结果及可读取的事件。运行时不修改本仓库 `.ans/organization`。

工程师从 Model 开始逐层单测；策略检查身份/deny/scope/tool/capability/approval/version/task；gate 检查伪造与重放、内容篡改、路径逃逸与链接；日志检查顺序、拒绝与失败。Adapter 以共同契约验证两实现。Reviewer 独立检查相邻层、所有权和提权路径；Tester 经真实公开入口验证允许/拒绝/完整日志，并对原样例回归。

用户的“开发”覆盖本版六角色任务分配与实际实施；没有默认推荐的可选项。Supervisor 在独立上下文以 task_ops 固定配置 hash、write set、stage 前置与检查命令。只有实际通过的当前组合版本可标记 verified；修复归 owner，不能修改治理定义、放宽测试或顶替角色。
