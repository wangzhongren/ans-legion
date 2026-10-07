# Supervisor 接收：Node + Pi v3

日期：2026-10-07。本上下文继续终身绑定 Supervisor，作为唯一 task_ops scheduler 接收本阶段正式实施交接。

已读取本角色 role-card 与 boundary Section 1、治理交接、客户直接授权记录、两个 v3 合同、固定设计与执行配置。权限来源为客户“开发把”及“你整个运行都切换成node 把，后面发行也好发行点”的直接指令；SHA256 只固定已授权内容，不代替授权。

- 设计：`docs/design/2026-10-07_design_node-pi-v3.md`，SHA256 `342fd522343126c31c7a7f1ee3c8befab9f363d5372297847ebc8f42b5f30bae`。
- 执行配置：`.ans/project.json`，SHA256 `25e46e9b7811685847116393d9c9982062e975f66e151ce3d094ef2be020cccb`。
- 新任务：`legion-pi-node-v3`，deps 与 model 可并行，随后 adapter → kernel-runtime → package → reviewer → tester；最多两个 worker。
- 原 Python 实现、v1 policy 快照与旧任务证据保留只读，不覆盖。Node 产品不依赖 Python。

Worker 仅在自己的固定角色上下文和 task_ops 精确分配范围实施；不派发子 worker。协调 token 保持私有。必须运行真实 Pi SDK 的受控离线推理闭环、Node 权限回归、独立 Reviewer/Tester 与实际 npm tarball 隔离安装及 CLI 验证，不将本接收记录视为实现验收。

Governance 已明确本轮直接启动/交付指令允许 Supervisor 维护 Section 1 中七份自有说明和本 acceptance；调度记录仍只由 task_ops 写入，不虚构第八节点或业务自验收。
