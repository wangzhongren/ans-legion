---
id: adapter-workbench-v2-design
type: design
title: 同一真实Pi引擎的多轮对话与纯数据连接
created: '2026-10-07'
updated: '2026-10-07'
timezone: Asia/Shanghai
status: implemented-unverified
related: [legion-desktop-workbench-v2, pi-agent]
---

# 工作台Pi会话实现

本角色按[客户已确认canonical](../../../../design/2026-10-07_design_desktop-workbench-v2.md)与冻结desktop-workbench契约实施14精确输出。单一项目管理Human入口、计划确认与动态执行由Desktop负责；本层不调Mutation，不读客户文件，不启动模型请求直到start_run。原Node dated设计保持历史。

保留createPiAgentService和五旧方法及默认single_run；新增lifecycle conversation、cancel_turn、get_history、restore_history。conversation要求scope.tools/write为空，SDK tools/customTools均空并后验active/callable/all loadout；默认模式仍唯一legion_write_file。完成/轮取消后对话回idle，wholecancel/close永久终止并abort/waitForIdle/unsubscribe/dispose。下一轮必须用新runId且消费上一轮终态，防止队列旧事件错绑。

Provider内部静态导入pi-ai公开三协议streamSimple。typed PiConnectionProfile +私有credentials与旧modelProviders严格XOR；provider/model匹配proxy，profile版本冻结。每实例独立ModelRuntime、内存credential/session/settings/resource/extensions、stream/queue/pending，无Pipeline构造callback/peer Service调用。未知metadata为null，SDK运行适配的零成本/文本/有限上下文占位不对外作为真实价格/能力。

conversation预算固定queue256、文本65536字符、输出2048tokens、deadline60000ms，测试可向下指定budgets以验证有限失败（不得扩大冻结上限）。text_delta使用Kernel PiTextDelta与规定envelope，邻接文本可合并，预留终态位置；溢出明确abort。单轮取消先禁止新事件/工具、settle deferred，abort并等idle，保留单轮终态；调用者撤权属于上层，不将controller传入本层。

历史只返回Kernel PiConversationHistory；restore_history仅idle且typed checkpoint绑定可信instance/profileId/profileVersion，重建真实内存Session而不发请求，恢复user/assistant文本，不恢复SDK模型选择、system/tool/permit/pending/确认。旧legacy连接恢复绑定使用稳定derived profileId与instance.organizationVersion；plain连接使用真实profile字段。文本历史受Kernel256条/单条65536/总2Mi字符预算，失败保留安全错误。

实现已完成，保留旧23项断言，当前Provider27+Service4+Proposal只读7共38通过/0失败/取消/跳过；真实SDK多轮/零工具/delta/轮取消/typed恢复及隔离/预算均覆盖。三协议使用仅本机受控localhost HTTP SSE，实际SDK公开入口发送，非Session替身，无付费模型。服务器内存响应，不写客户文件；TEMP/TMP仅本角色tmp。首扩展34项沙箱29pass/5fail由loopback EACCES导致，独立fetch复现；相同命令自动批准require_escalated后34pass，再增加竞态至38pass，断言保持。

具体生命周期：每轮subscribe闭包捕获原runId，waitIdle后unsubscribe，旧listener晚到guard有实际SDK事件重放测试。wholecancel/close等待restorePromise收束并dispose迟到真实Session；两个独立并发测试计数前后Session均释放。restore只接typed checkpoint并比较全部instance身份/profile，SDK只装入纯user/assistant文本及当前可信模型，失败永久终止实例。

plain Profile未知metadata在共享Model仍null；SDK内部文本/reasoning关闭/32768上下文/2048输出/零cost为运行适配，不公开真实报价。safeError区分已知认证/网络/协议模式与fallback generic，不输出原文。预算仅conversation，向下参数不得超冻结上限，single_run保持旧语义。API的factory示例与完整fields见[当前API](../../api-spec.md)。

全部副作用仅本角色fixtures/user-data/tmp；缺SDK失败不可skip。最终6docs写齐后唯一approved unit串行三files/180秒，需要相同localhost执行权限；候选不变后complete并停止修改。[当前任务](../../../../scheduling/legion-desktop-workbench-v2.md)、[功能](../feature/pi-agent.md)。owner结果不替代下游新版包/完整工作台/独立验收，旧dated Node设计不改。

