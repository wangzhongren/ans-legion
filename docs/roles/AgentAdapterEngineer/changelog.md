# AgentAdapterEngineer 变化记录

## 2026-10-07 · legion-v1

依据客户已经确认并指示开发的六角色 Organization Proposal v1，首次实现两个本地受控参数变体。先写[角色设计](docs/design/2026-10-07_design_phase1.md)与功能草稿，再实现 Service abstract/public/impl 三个精确文件和 tests/adapters/test_proposal.py，最后将六个 owner 文档更新为实际行为。

公开工厂 create_codex_adapter/create_claude_adapter 返回本层 ProposalService。convert 固定受控工具与动作，保留 Session 原对象，丢弃未知身份/权限字段；错误输入 ValueError。Kernel Model、Runtime、治理定义与其他角色代码保持只读。

实际 owner 命令，在项目绝对根下以 UTF8、禁止 bytecode、TEMP/TMP 指向可写工作区运行：

```powershell
python -c "import sys,unittest;sys.path.insert(0,'src');result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.discover('tests/adapters'));sys.exit(not result.wasSuccessful())"
```

结果：Python 3.14.0 / Windows，14 项测试通过，0 跳过；共享测试对两个变体验证 exact Session、不可变结果、稳定摘要、未知字段不提权、空 content、非法工具/参数/身份、输入不修改、无文件/网络/进程效果。源码依赖审查确认仅 Model 和自身服务结构，无 Runtime 或 Kernel impl 引用、三元、吞异常、外部私有字段访问或未实现 stub。

任务操作使用绝对 `--root D:/work/code-work/agent-organization-runtime` 与 `--task legion-v1-development`：ack、progress、最终 run-check unit、complete。身份与 worker token 仅经私有请求传递，不写本记录。最终 candidate、实际 argv 与日志由[任务记录](../../scheduling/legion-v1-development.md)保存；Supervisor 进行验收。工作目录没有 Git 仓库，不报告虚构 commit。

当前限制：只转换本地受控参数，不连接厂商、启动 CLI、执行文件写入或发放权限。Session 来源认证和路径权限由 Kernel 处理；共同宿主进程不是恶意调用者隔离边界。无范围或合同差异，独立 Reviewer/Tester 检查仍由 Supervisor 调度。[完整功能](docs/feature/proposal-adapters.md)。

## 2026-10-07 · 同版依赖复核

Kernel 修复审批路径大小写/分隔符别名匹配及 RoleBoundary scalar collection 输入验证。Supervisor 接受的 Kernel 当前候选为 `d73b364c0660fb1abcae803d3f914faeb75c8c73d2b56c231d036ea62fa584f2`；owner 47 项与 demo 的上游证据见[新任务记录](../../scheduling/legion-v1-approval-repair.md)。本角色只读核对了 Model 与 Kernel 修复记录，AgentSession、ActionProposal 公开签名和 Adapter 所需语义没有变化，无兼容缺陷；Adapter 三个生产文件及测试保持原样。

原 14 项 Adapter 结果与原候选保留为历史，不作为当前依赖证据。本次仅更新六个现有 owner 文档，沿用同版授权与原 API；在文档完成后重新执行配置 `unit` 一次。运行环境和 unittest argv 与上文相同，task_ops 使用绝对项目根及 `--task legion-v1-approval-repair`。当前结果、候选身份和日志由[新任务记录](../../scheduling/legion-v1-approval-repair.md)保存；Supervisor 验证后再调度 Reviewer/Tester。没有新增功能、测试、权限或限制变更。

## 2026-10-07 · Node Pi v3

按客户Pi开发及全Node迁移直接授权，先落[本层设计](docs/design/2026-10-07_design_node-pi-v3.md)，实施9个ESM源码、3份Node测试及7份owner文档；旧Python/phase1只读历史。仅本角色19个writeSet，未改Kernel、package/lock或治理配置。

ProposalService.convert(PiToolRequest,AgentSession)用宿主requestId/runId绑定不可变ActionProposal，精确Session原对象、固定write_file动作。PiAgentService/Provider公共工厂返回各自契约，真实SDK1.0.4同进程创建独立ModelRuntime/内存凭据/session/settings与空resources/extensions。仅受控tool活动，execute入自身queue等deferred，由Kernelnext_event消费/respond_tool原对象；无向上callback。响应跨实例/重复/迟到拒绝，finish/cancel/close与latecreate清理。

实际Windows Node24.11.1/npm11.6.2 owner命令：

```powershell
node --test tests/adapters/test_proposal.mjs tests/adapters/test_pi_provider.mjs tests/adapters/test_pi_service.mjs
```

首次完整23通过、0失败/取消/跳过。真实Pi+官方Faux stream工具闭环、同名provider两实例不同模型/流/凭据/消息/scope/queue隔离、权限数据传播、精确身份、非法输入、toolloadout/无用户.pi读取及fetch、取消/释放均覆盖。SDK缺失直接fail，无付费调用。最终docs完成后以task_ops --root绝对项目根 --task legion-pi-node-v3 run-check unit取得不变候选，再report complete；候选/argv/退出码/日志以[当前任务](../../scheduling/legion-pi-node-v3.md)为准，不虚构Git commit。worker凭据不写文档。

[实际API](api-spec.md)明确下层modelProviders keyed record与产品数组的转换边界并给真实配置示例；[Pi流程](docs/feature/pi-agent.md)与[提案流程](docs/feature/proposal-adapters.md)描述全部分支。owner验证不替代后续Kernel文件写入/审计与独立Reviewer/Tester；同进程不隔离恶意代码。无本角色范围差异，Supervisor负责verify。

## 2026-10-07 · 已确认工作台v2

按canonical715639与正式adapter-1实施14exactfiles，先写[本层dateddesign](docs/design/2026-10-07_design_desktop-workbench-v2.md)，只改六Pi Service/Provider、两既有套件和六owner文档。旧proposal源码/test、Node dated历史、Kernel18文件、package/lock/旧产物只读。

默认single_run保留旧一次受控写入语义。conversation仅空tools/write，同一真实Session多轮、typed delta有界queue、history/typed checkpoint restore、cancel_turn回idle；wholecancel/close等run和restore后dispose。每轮SDK listener捕获原runId，旧事件不可重标。Provider内部选固定公开三协议，plain connection+私有credentials严格XOR legacy策略，实例profile/key/session/stream/queue隔离，历史不覆盖可信proxy/权限。未知metadata/费用保持unknown，不展示SDK占位为报价。

实际Windows Node24.11.1/npm11.6.2、SDK/pi-ai1.0.4。旧23断言未删改；初次扩展34项沙箱29pass/5fail，实际localhost fetch复现EACCES。自动批准require_escalated运行相同套件34pass；新增关闭/恢复收束后36pass，完整cancel/lateSDKlistener维度后38pass，0失败/取消/跳过。全部真实SDK，三个localhost协议SSE请求custommodel/字面key与工具空；官方Faux为推理流fixture，无SDK Session替身。安全auth错误、deadline、queue/text/history预算、typed restore、同provider隔离与实际SDK旧事件注入guard保留严格断言。

最终配置unit命令：

```powershell
node --test --test-concurrency=1 tests/adapters/test_proposal.mjs tests/adapters/test_pi_provider.mjs tests/adapters/test_pi_service.mjs
```

timeout180。6docs最终后唯一task_ops run-check unit使用绝对项目根和--task legion-desktop-workbench-v2，再complete，check后停止写；候选、argv、实际count及日志以[当前任务](../../scheduling/legion-desktop-workbench-v2.md)为准。NodeOptions/compilecache清理，TEMP/TMP在本角色当前tmp，不写旧runtime/user.pi/客户源码，不安装/付费/任意shell。worker凭据只私有请求，不写文档。

[API](api-spec.md)提供factory/完整协议/错误/预算/真实plainprofile示例，[feature](docs/feature/pi-agent.md)提供完整流程。typed历史检查不代表Hostworkspace认证；SDK事件注入与内存server不能作为恶意同进程/OS隔离证明。当前owner证据不替代后续PM新版tarball、Desktop Human确认与真实文件审计、DPAPI/ZIP/独立Reviewer/Tester。无范围差异，Supervisor唯一verify。

