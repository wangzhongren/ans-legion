# 项目 Shell v1 Workspace Reader 双文件修复真人授权

日期：2026-10-10。记录者：固定内置ANS Governance。

Root 从实际人类审批工具结果转交的回答原文：

> 批准这个双文件修复（推荐）

对应 questionItemId：`["request_user_input_async","call_e073180b207e4bf181fe91925620a0d5",0]`。对应完整题干已明确展示并请求接受下列配置及精确SHA；本记录保存实际回答和配置身份，不虚构问题全文。

已批准配置：[handwell-pm-approved-project-shell-v1-workspace-reader-project.json](handwell-pm-approved-project-shell-v1-workspace-reader-project.json)。SHA-256：`5c4f83a8e97155b43be589c8d42c63527c39e780b0cc2166e343bd4349a4deb6`。schemaVersion=1。

唯一角色：DesktopEngineer；仅operation=repair；唯一两个authored文件：

- `apps/desktop/src/providers/impl/workspace.mjs`
- `apps/desktop/tests/unit/workspace.test.mjs`

三条检查：workspace_reader、desktop_unit_regression、desktop_shell_regression，各timeout300秒，实际plan必须包含全部门禁。授权仅用于当前已接受Shell治理元组的只读Reader兼容及对应测试，不接受任意candidate、未知scope、任意approval/revision或删除拒绝断言。

沿用冻结已确认 [handwell-pm-approved-project-shell-v1-design.md](handwell-pm-approved-project-shell-v1-design.md)，SHA `a5a0166dcd302ecd65416b85b2801a5a687972481e90f80c31ea23959eff59c0`。这是同版方案内经ProjectManager审查的必要读取兼容修复；实际同版PM评审与总体授权分别见 [handwell-pm-approved-project-shell-v1-review.md](handwell-pm-approved-project-shell-v1-review.md)、[handwell-pm-approved-project-shell-v1-authorization.md](handwell-pm-approved-project-shell-v1-authorization.md)，主配置真实接受见 [handwell-pm-approved-project-shell-v1-config-authorization.md](handwell-pm-approved-project-shell-v1-config-authorization.md)。本补充独立接受不改变主155文件配置或六角色边界。

具体scope和精确协调路径见 [handwell-pm-approved-project-shell-v1-workspace-reader-scope.md](handwell-pm-approved-project-shell-v1-workspace-reader-scope.md)。后续由独立固定Supervisor经task_ops操作并缩小writeSet。此文件只记录真人授权事实，不表示已经实施或通过验收；实际源码变化与全部检查结果必须另有当前候选证据。

本轮Governance仅新增本receipt，不改源码/测试、配置、六角色定义、冻结设计、原授权或评审；不init/dispatch，不传播运行凭据。旧scope的待接受文字保留其准备时历史原貌，最新双文件配置接受事实以本记录为准。
