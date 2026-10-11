# 项目 Shell v1 单文件 proposal 测试修复真人授权

2026-10-10，Root 从实际人类审批工具结果转交的回答原文：

> 批准这个单文件修复（推荐）

对应 questionItemId：`["request_user_input_async","call_b14a37c2868c48bcbe86595bf54784e8",0]`。实际批准对象为已展示的单文件修复精确配置。

配置：[handwell-pm-approved-project-shell-v1-proposal-test-project.json](handwell-pm-approved-project-shell-v1-proposal-test-project.json)。SHA-256：`2a7025e194ed99920ea1c3ac687df4fa420d84488c50392247f3c877762c8a4a`。

schemaVersion：1；唯一执行角色：AgentAdapterEngineer；唯一 authored 文件：`tests/adapters/test_proposal.mjs`；检查：proposal 单文件测试及原四 Adapter 回归。修复仅按实际工具 schema 更新 fixture 并保持拒绝转换和非法参数断言，既有case及失败证据不得删除。

同一已确认 Shell v1 设计：[handwell-pm-approved-project-shell-v1-design.md](handwell-pm-approved-project-shell-v1-design.md)，SHA `a5a0166dcd302ecd65416b85b2801a5a687972481e90f80c31ea23959eff59c0`。设计与主配置真实授权继续引用原记录；本次批准是该设计内必要fixture兼容的独立精确配置接受，不借用旧governed设计或旧配置扩大权限。

固定 Supervisor 的对应补充 task_ops scheduling 路径为 `docs/scheduling/handwell-project-shell-proposal-test-v1.md`，与本功能阶段同版。实际 init/dispatch 由 Root 的独立 scheduler 完成；本 Governance 只记录真实授权事实，不写运行记录、不修改源码/测试、不传播私有运行凭据。

本记录非测试验收，不改变被冻结配置、六个 owner 边界/角色卡、设计、原授权或评审；旧候选scope中的待接受文字保持历史原貌，本次最新接受事实以本记录为准。
