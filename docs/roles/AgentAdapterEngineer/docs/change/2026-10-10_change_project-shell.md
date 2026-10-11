# 项目 Shell Adapter 变化（2026-10-10）

候选包括六个 Adapter 三层文件、三个既有测试、新 test_shell_tools 及七个职责文档，均在17项派发 scope 内。

Provider 自定义注册两工具，审核只向 ProjectManager 实例可用。结果绑定原 request 对象、run 和 Shell摘要，只回应终态一次；中间 ready_for_publication 拒绝。Service 继续公开转交 typed 生命周期，不暴露执行器或权限对象。single_run 和 conversation 共用活动预算，pending等待暂停、返回后恢复剩余时间。未授 Shell tool失败关闭；既有single_run未授edit保持SDK拒绝后继续、无Host请求的行为。

新增实际localhost SDK三协议请求/回应、schema、终态、binary metadata、摘要/identity防伪、duplicate/late/cancel、plain history恢复和single_run暂停/超时测试。既有 control loops 接纳精确review schema，既有数量断言根据Model实际工具清单检查。Anthropic wire的根schema字段缺失明确记录，并通过纯Model拒额外字段验证严格边界。

检查门禁：正式配置 shell 和 regression_unit，使用 task_ops 实际候选与输入SHA记录；不运行外部模型，不用旧证据充当当前证据。首轮 shell 失败日志保留 adapter-shell-1-shell-87b6397d.log，包含旧断言差异和Anthropic wire字段事实。完成报告及随后Root verify记录最终实际结果。本层验证不替代Shell OS探针、Desktop完整flow或独立验收。
