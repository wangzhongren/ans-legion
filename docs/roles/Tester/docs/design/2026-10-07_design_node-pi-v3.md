---
id: tester-node-pi-v3
type: design
title: 独立验证 Node 权限与两个真实 Pi 实例
created: '2026-10-07'
updated: '2026-10-07'
timezone: Asia/Shanghai
status: implemented-unverified
related: [legion-node-pi-v3, kernel-generic-agents, pi-agent]
events:
  - date: '2026-10-07'
    kind: designed
    summary: Supervisor 接受只读准备的 permission12 与 generic8 有限方案并正式派发
  - date: '2026-10-07'
    kind: blocked
    summary: 20项已实施，19通过；真实Runtime close返回错误已独立复现，等待Kernel owner修复
  - date: '2026-10-07'
    kind: repaired
    summary: Kernel修复完整run关闭时序，前六节点verified；Tester保持20项不变等待最终完整复验
---

# 两个真实 Pi 实例各自操作允许的文件

本方案实施客户已授权的 [全 Node/Pi v3](../../../../design/2026-10-07_design_node-pi-v3.md)，终身固定Tester。原阶段实施三个integration mjs和六份角色说明；当前关闭修复阶段只更新六份文档，原20测试与fixture不变。前六节点已verified；当前Reviewer候选 `4d6eb703b331c5d53b10229fd464d923e73243bf9bf11b36341c6b3a8c3bdcff`，22项严格检查通过无未解决发现。原Reviewer a17b4a23…与Tester19/1为历史。[Reviewer报告](../../../Reviewer/docs/review-node-pi-v3.md) 与旧Python/phase1历史只读，不修改产品或发行产物。

直接从根 runtime.mjs 八项公开入口调用真实 createRuntime。permission 文件计划12项：两 Adapter 等价允许/拒绝及文件保留、身份和工具拒绝、原审批 case/slash 与 deny 优先、scalar 集合严格拒绝、控制面/遍历、非执行分支、opaque 单次许可与篡改、三类权限回退永久失效、replace 失败、intent 审计失败、commit 后审计失败、原 Node demo。generic 文件计划8项：同 provider 两实例并行与会话/流/request/result 隔离、精确 role/task/scope 创建限制、模型身份声明拒绝、活动推理取消、三类状态撤销回退、真实 Pi 两个审计失败点、Runtime close 与一次运行释放。

controlled_pi_model.mjs 只使用 pi-ai 公共 Faux stream 辅助实现受控推理，不替换 SDK Session 或 Agent loop。产品配置是 modelProviders 数组；streamSimple 只接 SDK model/context/options，按 options.sessionId 保存独立 core 与 response 进度。测试屏障只控制推理响应，支持 AbortSignal，无 Runtime/submit/文件/permit callback。真实 SDK 1.0.4 的 prompt/dispose 仅透明观察并转调原方法；缺版本或真实 Session 未执行必须失败，不 skip、不收费网络调用。

真实临时文件、index/daily 日志和 Runtime 结果都必须一致；事件核对顺序、身份、版本、resource/digest/correlation、+08:00 且无正文/prompt/凭证/原异常。故障仅在标准库文件边界受控注入，intent 失败须无业务目录/文件，commit 后失败须保留 observedMutation=true 且停止后续写，不宣称事务回滚。

Windows Node24.11.1，TEMP/TMP=D:/work/code-work。工作区随机生成，清理前验证绝对路径位于该根与逐组件 lstat 非链接。两文件保持有限20顶层测试，文档完成后执行唯一approvedunit：node --test tests/integration/test_permission_flow.mjs tests/integration/test_generic_agents.mjs。最终候选/实际检查结果见 [关闭修复任务](../../../../scheduling/legion-pi-node-v3-close-repair.md)，本角色不自验收。Kernel当前关闭过程先同步撤权，再等待Session.stop及包含终态审计的activeRun，最后关闭Mutation；原关闭与真实audit fault断言由Reviewer原样2/2通过，完整20项仍由Tester最终检查。

本环境owner两个nativejunction用例EPERM，只以metadata刺激检测，Reviewer同样受控注入；不扩大为native全部reparse/OS或恶意共享进程隔离证明。受测功能见 [Kernel](../../../KernelEngineer/docs/feature/generic-agents.md)、[Pi Adapter](../../../AgentAdapterEngineer/docs/feature/pi-agent.md)。原20项19通过/1失败/0跳过及issue完整保留，当前修复不改变断言，历史与实际新证据见 [verification](../verification-node-pi-v3.md)。
