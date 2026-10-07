# Legion Runtime Node + Pi Mission

客户已授权全 Node 产品运行与 Pi 通用 Agent。本Mission已完成。当前同一冻结设计与配置下的修复任务七节点全部verified，14项required checks通过；原严格20项集成测试原样通过。随后公开npm test全15模块141项通过、零失败、零跳过，源码与发行包前后哈希一致。Supervisor交付说明已完成，所有执行worker结束，无活动assignment。

本地 [legion-runtime-0.3.0.tgz](../../../runtime/legion-pi-node-v3/packaging/legion-runtime-0.3.0.tgz) SHA256 为 a83a86499c4aaa7c997d94cabbb697efdc82f81475b622b85307ac682de4d8f0，27文件包已隔离安装并运行SDK/README/CLI。部分链接拒绝用例因沙箱 EPERM 使用明确标注的 lstat 元数据注入，未声称本机原生 junction 端到端。原关闭缺陷19通过/1失败记录保留为历史，原Kernel owner已修复；旧Python v1仅为只读历史，不在发行包中。

最终实际计数、环境、身份与局限见 [Governance验证](../../../decisions/legion-node-pi-v3-validation.md) 与 [全套测试证据](../../../runtime/legion-pi-node-v3/packaging/final-public-npm-test.json)。

设计：[Node + Pi v3](../../../../docs/design/2026-10-07_design_node-pi-v3.md)；当前任务：[close-repair](../../../../docs/scheduling/legion-pi-node-v3-close-repair.md)；原任务：[legion-pi-node-v3](../../../../docs/scheduling/legion-pi-node-v3.md)。当前任务是最新精确状态和验证的依据。
