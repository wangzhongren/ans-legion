# 项目 Shell v1 Adapter proposal 测试最小补充范围

状态：候选精确配置待实际人类接受。固定 ANS Governance 仅准备本配置及scope，不改生产/测试，不init/dispatch。

## 现有同版授权和冻结输入

已确认设计：[handwell-pm-approved-project-shell-v1-design.md](handwell-pm-approved-project-shell-v1-design.md)，精确 SHA-256 `a5a0166dcd302ecd65416b85b2801a5a687972481e90f80c31ea23959eff59c0`。

真实设计授权：[handwell-pm-approved-project-shell-v1-authorization.md](handwell-pm-approved-project-shell-v1-authorization.md)。主配置真实人类接受记录：[handwell-pm-approved-project-shell-v1-config-authorization.md](handwell-pm-approved-project-shell-v1-config-authorization.md)，已接受主配置 SHA `c872245f285125eae264b77ef4447a97fe0dcb14506c0e77f216d41003865ea4`。这两个事实支持同版目标和必要fixture兼容方向，不是尚未接受的本补充配置hash授权。配置的 sourceAuthorization 仅来源metadata，task_ops仍要求真人接受本文件精确hash。

当前主任务已绑定的 design、authorization、review、main config、role boundary/card 均保持不变。补充配置不采用旧版设计策略，不更改主配置hash或借旧配置扩大权限。旧failed logs和所有测试case、断言保留。

## 唯一实施范围

- owner：同一固定 AgentAdapterEngineer，既有 Section 1 已覆盖 `tests/adapters/test_proposal.mjs`，无需boundary更新。
- writeFiles：只有该一个精确文件，无生产源码、其他测试、文档、runtime authored文件或别的owner权限。操作只允许repair/test。
- 修复：原控制工具loop采用generic payload，新增typed `legion_review_shell`在 PiToolRequest 构造时即抛schema错误，未到原 ProposalService拒绝断言。仅按工具真实schema构造requestId/requestDigest/revision/approved/reason fixture，保留原 `assert.throws`、`invalid_controlled_request`及所有factory断言。
- 同边界新增 `legion_request_shell`不能convert为普通Proposal的拒绝断言，并另测非法params仍拒绝。不可删case、skip、宽松断言或把schema失败当原转换拒绝已测试。其余Source及下游输入继续冻结。
- 已有其余三Adapter测试为只读回归输入。两条配置检查都必须纳入实际补充任务plan checks：单proposal精确检查及原四Adapter回归，timeout各300秒。既有固定回归生成效果沿用原边界内合法fresh fixture；不得覆盖旧proof/evidence/history。

## 治理验证和接受条件

`task_ops.roles_valid(root, config)`直接读取候选，PASS；schemaVersion=1，roles=1，唯一精确文件=1，无ownership扩展或重叠；检查argv精确、timeout<=300。本轮未运行应用测试，Root转交的78pass及75/76fail仅为实际已有现象，不在本文件冒充新验证。

候选配置：[handwell-pm-approved-project-shell-v1-proposal-test-project.json](handwell-pm-approved-project-shell-v1-proposal-test-project.json)。SHA-256：`2a7025e194ed99920ea1c3ac687df4fa420d84488c50392247f3c877762c8a4a`。自算hash仅标识候选；Root提交真人接受后方由固定scheduler合法派发同Adapterowner新scope。两条真实检查通过且原failed evidence保留后才可验收；本scope本身不是运行验收。
