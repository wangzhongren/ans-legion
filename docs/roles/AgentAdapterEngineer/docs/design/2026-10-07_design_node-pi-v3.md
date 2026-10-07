---
id: adapter-node-pi-v3-design
type: design
title: 同进程 Pi 会话与受控工具队列
created: '2026-10-07'
updated: '2026-10-07'
timezone: Asia/Shanghai
status: implemented-unverified
related: [legion-node-pi-v3, proposal-adapters, pi-agent]
events:
  - date: '2026-10-07'
    kind: designed
    summary: 按已授权 v3 固定 Node Model 与真实 SDK 接入边界
  - date: '2026-10-07'
    kind: implemented
    summary: 9份ESM源码及3份真实SDK套件完成，owner23项通过零跳过
---

# Pi 负责推理，Kernel 负责每次写入

本方案细化[已授权 v3](../../../../design/2026-10-07_design_node-pi-v3.md)。使用真实 Pi 1.0.4 与 pi-ai 1.0.4 的公开 ESM 入口，无 Python 桥接或 SDK Session 替身。只写本任务的 9 个源码、3 个测试及7份 owner 文档；不修改 Kernel Model、依赖、治理、Python 或 phase1 历史。

ProposalService.convert(request, session) 使用 PiToolRequest.requestId/runId 和可信 Session 构造 ActionProposal，固定 write_file 动作与能力，不执行也不授予权限。PiAgentService 与 PiSessionProvider 分别保留 abstract/public/impl；工厂只返回自己的层契约。Pipeline 组合服务，Provider 只接 SDK，不接上层 callback。

createPiAgentService({instance,proxy,scope,cwd,modelProviders,signal}) 创建单任务实例；start_run(runId,prompt)立即启动并返回，next_event 拉取冻结 envelope，respond_tool 回应原 PiToolRequest 和 PiToolResult 一次。工具请求使用宿主随机 requestId、当前 runId 与 SDK toolCallId。Provider execute 入自身队列等待 deferred；Pipeline 先消费请求，再判定、执行、回应，不能先等待完整 prompt。

每个实例创建独立 ModelRuntime、InMemoryCredentialStore、内存 SessionManager/SettingsManager、空 ResourceLoader/extension runtime、queue与pending map。modelProviders 为可信宿主 record，键为 provider ID，值只含 api/baseUrl/apiKey/models/streamSimple 等推理配置；相同名字的配置在各 ModelRuntime 实例中注册，不使用 SDK 全局注册。仅 legion_write_file 活动；排除 MCP/codemode/tool_search。prompt 禁用模板展开，settings 关闭压缩、重试、cache warming。

生命周期为 ready → running → completed/failed/cancelled → closed，一实例只启动一次。响应核验原请求对象、当前 run 和 request ID；重复、迟到和跨实例拒绝。取消先由 Kernel 撤销许可，再由 Provider 禁止请求、settle pending、abort等待idle、取消订阅及dispose；结束也清理。创建中的 signal 在每次异步步骤与真实Session建立后重验，晚到的Session也释放。

测试已实施：纯提案7项；Provider13项使用真实 createAgentSession 和公开 createFauxCore 的实际 streamSimple，驱动工具、回应、后续助手输出；两个相同provider名字但不同配置/模型/凭据/scope的实例不串用、默认工具关闭、非法配置、取消和晚到创建释放；Service3项验证公共组合与原对象保持。SDK缺失不能skip。实际完整命令 `node --test tests/adapters/test_proposal.mjs tests/adapters/test_pi_provider.mjs tests/adapters/test_pi_service.mjs` 初次23通过/0失败/0跳过；最终docs后approved unit证据见[当前API](../../api-spec.md)与[任务证据](../../../../scheduling/legion-pi-node-v3.md)，功能为[Pi会话](../feature/pi-agent.md)与[提案](../feature/proposal-adapters.md)。owner证据不替代Kernel完整写入/审计及独立验收。

本层factory modelProviders是provider名keyed record；产品createRuntime的modelProviders保持canonical数组，每项含provider及api/baseUrl/apiKey/models/streamSimple，由Kernel私有组合验证转换。选定entry准确字段/模型metadata/内存auth与真实离线示例见[API](../../api-spec.md)。直接依赖仅已锁定SDK/pi-ai1.0.4，Type与InMemoryCredentialStore公开root导入，无额外typebox或SDK私有import。
