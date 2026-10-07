# Kernel Node + Pi v3 实施记录

2026-10-07，Asia/Shanghai；固定 KernelEngineer。客户同版开发授权与正式阶段派发见[总设计](../../../../design/2026-10-07_design_node-pi-v3.md)和[任务记录](../../../../scheduling/legion-pi-node-v3.md)。本阶段先完成实现与 owner 检查，再交 Supervisor 验证。

目标：可信宿主通过 Node createRuntime 创建具名 Pi 实例；实例只能操作角色、精确任务和请求范围的交集。保留 prepare/execute/submit 及五种决策。审批、交接、扩权均不执行。既有四份 Model、Adapter、package/lock 与 Python 历史只读。

Interface 仅适配公开 Runtime/Agent façade；单 PermissionRuntime Pipeline 私有持有 authority，组合纯 PolicyService、MutationService、ProposalService 与 PiAgentService。MutationService 仅调用 StorageProvider，Adapter Service 仅调用自己的 Provider。不存在同行 Service 或 Provider 上调 callback。

modelProviders 保持宿主数组接口，Pipeline 验证并复制唯一 provider 配置，转换为 Adapter 所需 record；只传推理 streamSimple，不传执行能力。StorageProvider 产生身份、runId、Asia/Shanghai 时间和文件效果。创建前拒绝越界、目录扩大精确任务、非唯一 legion_write_file 工具、未知连接；异步返回再核验上下文。每实例独立 Session，一次运行。取消、关闭、任务/边界/版本变化先永久撤销，再 await Pi 停止；晚到创建结果关闭。

写入持单次 opaque permit；Provider 消费并在异步审计和提交前重验可信 Session、当前任务、版本、边界、run/grant、目标和内容摘要。内部 .ans/events/index.jsonl 与日期日志检查工作区及所有父组件的链接/reparse、序号和一致性，同工作区 Runtime 协调提交顺序。意图审计失败不创建目标；替换成功但结果审计失败如实报告 observedMutation/auditFailed 并停后续写。文件与两份日志不是事务；不是恶意共享进程沙箱。

分层检查顺序固定为 policy/scope、mutation/events、agent runtime，再全部八个 suite 与 demo；最终文档收尾后对同一候选重跑全部五项 approved checks。真实 Pi 使用安装的 1.0.4 SDK 与受控离线推理，不跳过会话、无付费请求。Python v1/修复成绩保留为历史，不能代替 Node 当前证据。

当前功能入口说明：[权限功能](../feature/permission.md)、[通用实例](../feature/generic-agents.md)。最终实现、实际计数与失败边界将在本记录及 API 文档收尾同步。

## 实施与 owner 验证

本阶段 12 源码、6 测试、7 文档均已完成。公开 createRuntime 接收 modelProviders 数组；实例创建与权限方法由单 Pipeline 组合四个 public Service，最终文件提交位于 StorageProvider。手动提案在存在 dispatchContext 时也受精确任务限制；无 context 的历史手动流程仍使用可信 Session 与角色边界。路径危险目标在 mutation_intent 前拒绝，正常文件 IO 失败有 mutation_failure。

依赖顺序实际检查：policy/scope 15 项；mutation/events 首轮12通过/2失败，后修正14通过；pipeline 首轮11通过/1失败，后12通过；全部8 suite 合计73通过、0skip。真实安装 Pi1.0.4与官方公开 Faux流验证两个独立 SDK Session、工具闭环、取消、创建失效及写后审计失败。同步 rename 位于最终 authority recheck 后，使正常本地事件循环撤销不能插入提交间隙。

原失败未删除：mutation 日志 kernel-runtime-1-mutation-8f546b20.log，两链接创建均 EPERM，TEMP/source/target 都在允许 D:/work/code-work。仅此错误使用受控 lstat 元数据测试同一拒绝分支，不能宣称 native junction/reparse 端到端；只覆盖 Node 能识别的 symlink/junction，不保证全部 reparse tag。pipeline 日志 kernel-runtime-1-pipeline-0ebf32c6.log 为预期取消发生后消息正则不匹配，修正为严格 AbortError 类型断言，没有降低取消条件。后续正常取消返回 cancelled，真实审计故障保留 failed/audit_failed 和 observedMutation。

Demo 为6场景、23事件：Backend 成功、Frontend 越界、工具不符、能力不符、明确 deny、旧版本；临时工作区保留 frontend 原值后清理。最终五项 approved checks 在所有七文档完成后重跑，精确 candidate/hash/argv/exit/evidence 由[任务记录](../../../../scheduling/legion-pi-node-v3.md)保存。本角色不自 verify，发行与独立验收仍由下游完成。Python v1/修复的40/47与独立101项成绩均为历史证据，未重写历史文件。

## Runtime.close 同版修复

独立 Tester 原20项有19通过/1失败/0skip：持有真实 Pi 推理时 Runtime.close 先关闭 Mutation，run 的终态审计随后失败，把正常取消误报 failed/kernel_audit_failed。严格原测试与失败证据保留；本角色只读单例重跑再次得到相同失败。

本次最小修复不改变公共 API：Pipeline 私有记录每次完整 run Promise；close 同步关闭入口并撤销权限，然后等待 Adapter 停止及所有 run 的终态审计，最后关闭 Mutation。run 的 finally 只等 Adapter.close，不反向等待 Runtime.close，避免相互等待。真实审计故障仍返回 failed/kernel_audit_failed，绝不当成取消吞掉。新增一项 owner 真实 SDK close 回归，原 Tester20源文件不改。

新任务[legion-pi-node-v3-close-repair](../../../../scheduling/legion-pi-node-v3-close-repair.md)承载当前候选与五项最终检查；原73项证据是修复前历史，Model/Adapter/config/canonical/Python和历史 dated records保持只读。

实际窄回归：原严格 Tester 单例修前0通过/1失败/0skip，修后1通过/0失败/0skip；自有 pipeline 增加1项后13通过，写后真实审计故障用例仍通过。完整当前计数为74项；文档完成后对同一候选运行 policy/mutation/pipeline/unit/demo，独立Tester20仍由下游正式重验，本角色不替代该验收。
