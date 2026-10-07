---
id: pm-node-pi-v3
type: design
title: Node npm 包的公共入口与隔离验证
created: "2026-10-07"
updated: "2026-10-07"
timezone: Asia/Shanghai
status: implemented-unverified
related: [distribution]
events:
  - date: "2026-10-07"
    kind: designed
    summary: 客户授权Pi及全Node迁移，管理与owner落实同进程合同
  - date: "2026-10-07"
    kind: implemented
    summary: 局部固定依赖及发行入口完成，首次owner隔离smoke通过
---

# 用户安装一个包后即可使用

客户要求整个运行时切换 Node，以方便发行。完整授权目标与固定跨角色契约见[canonical v3](../../../../design/2026-10-07_design_node-pi-v3.md)；本记录说明管理负责的[发行功能](../feature/distribution.md)，不重新授予权限。

采用纯ESM而非TypeScript编译链。package/lock先完成并固定SDK1.0.4；Kernel与Adapter通过各自层检查后，管理仅加透明Interface根facade、CLI和README。公共Session/Proposal Model必须可从根取得，保证手动许可流程能使用，不开放内部authority。

files白名单只包含Node源码、两个入口、README和自动包含的package.json。拒绝以源码导入代替包验证：本地tarball离线装到隔离consumer，再按包名导入，走实际SDK/Faux推理与Kernel文件审计，运行README和安装CLI。未打包的Python、治理、tests和缓存不能影响产品启动。

生成目录与源码候选分开，保留稳定tarball及其SHA256/integrity证据。消费者传递依赖另行解析，因此只报告实际测试的安装树，不把开发lock当全部未来消费者保证。SDK或cache不存在即失败。

首次owner发行检查两项通过、零跳过。文档完成后的最终候选unit/pack/cli及独立Reviewer/Tester仍以[执行任务](../../../../scheduling/legion-pi-node-v3.md)验收；本记录未自验收，也未发布npm。

同版关停修复不改上述设计：close等待运行终态审计后才关闭Mutation，修复由Kernel实施。管理刷新相同27文件产物及原smoke，保存旧artifact/25产品基线；新的证据见[修复任务](../../../../scheduling/legion-pi-node-v3-close-repair.md)。完整npm test将在全部修复节点验收后另行记录，不能用旧任务通过数替代。
