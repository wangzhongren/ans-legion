# Reviewer当前功能：项目 Shell 审查

当前版本runtime0.8.2/Desktop0.2.0，macOS首版。证据、当前计数与限制见[最终报告](../review-project-shell-v1.md)。

## 独立检查

- 包/source/installed真实字节、明确exports及private receipt隔离；Model无环境时钟、随机、IO或上层调用。
- 请求与权限分开：PM-only结构化审批、当前request/摘要、原requester、一次CAS；取消或重启不复活旧批准。
- 生成范围与完整authored inventory不重叠；源码按owner/writeSet/baseline经Mutation发布，binary/exec/delete不得绕过审批。
- 部分发布保留原结果；新Human/current baseline/新PM审核与当前check/Acceptance才可恢复。
- Host保留事实有旧真实publication来源和当前绑定；正确binary无diff不造新Mutation，获准旧delete保留墓碑来源，普通无变化任务不能完成。
- Wire严格保留合法absent/null/0/noexec，非法state/SHA/bytes/exec/授权字段拒绝。

## 当前结果

兼容节点Reviewer51/51和50/50，最终文档候选两门由调度记录当前结果。Tester当前六门：Shell25pass/1Windows未执行，integration34，UI6pass/1Windows未执行，Mac required7，Node295，Desktop244pass/1Windows未执行；全0fail/cancel，无timeout。

## 使用和限制

Reviewer只交付结构与证据审查，生产修复由原owner，Supervisorverify。实际GUI焦点和短暂阶段由Tester真实Electron断言/截图覆盖；本角色不新增GUI或原生全流程探针。外部商业模型、客户SSH业务和Windows产物/GUI/DPAPI未由本轮验证。旧TGZ、失败与partial记录保留。
