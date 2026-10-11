# 工作台Adapter功能与边界

客户从唯一项目管理对话讨论需求，确认计划后由Desktop创建动态执行Agent。本角色复用同一真实Pi引擎，提供两模式：默认single_run保持受控legion_write_file一次执行，conversation支持零工具/零写范围多轮对话、文本delta、轮取消和受限历史恢复。Human入口、任务创建、上下文读取、许可与文件审计由Desktop/Kernel承担。

public工厂返回自己的abstract契约，具体impl隐藏。Workbench Pipeline组合Adapter Service和其他公开Service；PiAgentService只调用PiSessionProvider public。Provider内部选择三个固定SDK api/*，创建独立ModelRuntime/内存凭据/session/settings/空resources/extensions与private queue，不接上层权限callback、不调用peer Service。

纯PiConnectionProfile与私有credentials严格XOR旧modelProviders推理策略，匹配宿主proxy并冻结profileVersion；每实例配置、凭据、Session、stream、history、queue/pending隔离。未知metadata/价格保持unknown，SDK运行默认不作为报价公开。创建/恢复均不发模型请求，start_run才发请求，Human send/test/confirm触发由上层管理。

每轮start_run立即返回，Service next_event拉取冻结typed text_delta或工具请求/终态。single_run工具只入deferred队列，Kernel判定/执行后回应原pending；conversation不注册任何工具。串行轮次使用新runId，消费旧终态后继续；旧listener绑定原runId，late event不能重标。固定队列/文本/token/deadline预算，错误明确终止当轮。

成功assistant与已提交user进入Kernel文本History；restore仅typed checkpoint、可信instance/profile匹配且idle，重建真实内存Session，不恢复权限/工具/活动任务或历史模型选择。cancel_turn仅当轮，Session回idle；wholecancel/close禁止新轮，abort/等待run与restore完成后dispose，清消费者，迟到Session也释放。

实际套件Provider27/Service4/Proposal只读7共38通过、零跳过。真实localhost三协议HTTP+SDK多轮、零工具、隔离、typed restore、预算、旧listener重放及cancel/close竞态均覆盖。沙箱localhost EACCES已实际验证，自动批准的相同命令38通过，断言保持。生成目录只在本角色本阶段，未安装或付费；owner结果不替代Kernel/Desktop/新版发行独立验收。[API](api-spec.md)、[功能流程](docs/feature/pi-agent.md)、[当前设计](docs/design/2026-10-07_design_desktop-workbench-v2.md)、[任务证据](../../scheduling/legion-desktop-workbench-v2.md)。



项目 Shell v1 增加两个精确 SDK 工具、PM 实例限定、Shell typed 终态摘要匹配及 single_run 活动预算。申请在原角色原工具调用等待，Host 收尾后一次回应。取消释放等待；恢复只载入当前绑定纯文本。功能与边界见 [project-shell](docs/feature/project-shell.md)。本层不执行命令或发布文件，Shell 成功不计检查通过。
