# Supervisor 接收 GUI v1

2026-10-07，本上下文保持唯一固定 Supervisor，接收 governance-legion-desktop。
已读取当前 role-card 与 Section 1、handoff/context/artifacts、desktop-console、manifest/stages/freeze、客户确认与同版评审。客户在评审的 GUI v1 后明确回复“开发”；这是真实授权依据，摘要只固定输入。

配置 SHA256：e72ba37fc080453ecf9ef0229c5f6f11bf4e41ecf017cf2febf85cea6ef6d89d。
canonical SHA256：58c79cae70bc45dcdda038e0e7944883dbee3ecfb2e277664a5954c3ec6a398d。
授权记录 SHA256：f6d9f891f4046d16785eefdd3516578556da857e53bfcb4cbf907d4f94194ad2。

按七节点 deps→profiles→workspace→interface→package→reviewer→tester 实施。原 PM/Reviewer/Tester 仅复用原角色；新 DesktopEngineer 使用独立新上下文，worker 不派发。deps/profiles 验证后冻结前置产物；自身七协调说明由本版实施确认直接授权，不虚构额外业务节点。

保留原 Node 源码、root 包锁、27 文件 tgz 和历史任务；O1 未选择。真实 Electron、三协议、safeStorage 重启及当前 ZIP 解压启动检查不得跳过。此接收不宣称 GUI 已实现或验收。

## 同版必要 Node 测试兼容修 v1.1

2026-10-07，继续固定Supervisor，接收独立配置 .ans/decisions/legion-node-fixture-compat-v1-project.json（SHA256 ecda2ee398fb389523683b1f9b464868d3c23faea86a7ed070e72893b73c3055）及提案（SHA256 b4dd6802847536f8c2d69c4b9ea4ad942eb359b96756c0f43b7f0062b6d0e3c4）。已实际读取final proposal/config/manifest/stages/freeze及补充角色范围，原固定PM对实际final两pin正式recommend，无必须修订差异。

此为客户GUI v1“开发”目标内必要严格回归依赖/隔离修；仅四个现有tests和九个固定角色生成目录，不修改产品、GUI e72或原GUI角色定义，不放宽断言/权限。原PM→Reviewer→Tester各自同身份补充卡执行三节点，原2/22/20/141有限检查实际跑；最多两个活跃业务worker，与GUI任务协调名额。前置候选及旧包/缓存均按范围冻结或只读，当前接收不等于通过。

## 工作台 v2 / v004 正式接收

2026-10-07，本上下文继续固定 Supervisor，接收 legion-desktop-workbench-v2。已加载当前角色卡与 Section 1、交接资料、客户确认、同版管理评审、canonical、manifest、stages、freeze、ownership 及 desktop-workbench/kernel-adapter/kernel-runtime 契约。客户真实回复“确认”，并选择专注对话；摘要用于固定文件身份，不代替客户授权。

- configuration：2546ebd0b8756eccb83bced6808c10d1c25c3bc175ca8f676a9f1d5172cb706b。
- canonical：715639b5dd278437059f29bde1e7c02ac90d94af18f9bf5a6b5367d16e9ab5d3。
- authorization：252ca93cd951947923cc22bc7ce52873a3696c6fe75683e509f52ceda96ce773。
- freeze：94594762d6a47b7333b94eef260bc4ae4348bbcbb48b680b123ce20f32513f8e。

按 kernel→adapter→core-package-deps→desktop-capabilities→desktop-interface→desktop-package→reviewer→tester 八节点执行。复用原固定 owner，上限两个业务 worker；不改变角色、不运行冻结 helper、不覆盖旧任务。阶段精确 writeSet 为 18/14/11/30/12/10/9/10，Supervisor 七份说明按本次客户授权直接维护，调度记录只由 task_ops 写入。

讨论阶段只产生 Adapter/userData 效果；Human 确认计划后才执行动态任务。真正 SDK、三协议、多轮、上下文写前 SHA、当前 ZIP、独立审核/测试与最终公开入口均以实际证据验收。旧 Node tarball、旧 GUI ZIP 及历史记录保持只读，旧成绩不代替 v2。此接收不宣称实现完成。
