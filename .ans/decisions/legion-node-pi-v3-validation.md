# Legion Runtime Node + Pi v3 验证

客户已直接授权 Pi 通用 Agent 开发和全 Node 产品迁移。产品运行、Pi SDK 接入、测试与本地 npm 发行均使用 Node；外部 task_ops 是开发治理工具，不是产品依赖。本文记录实际验证，不代替授权或角色验收。

## 当前候选

修复任务 [legion-pi-node-v3-close-repair](../../docs/scheduling/legion-pi-node-v3-close-repair.md) 在 stateRevision44 七节点全部 verified，14 项 required checks 均通过，无活动 assignment。原任务 [legion-pi-node-v3](../../docs/scheduling/legion-pi-node-v3.md) 保留 Tester19通过/1失败的关闭缺陷历史。原 Kernel owner 最小修复完整运行等待和终态审计顺序，原20项集成测试及推理夹具未削弱或改写。

| 模块 | 最终正式检查 |
| --- | --- |
| Kernel | 74通过，包含31项Model；policy15、mutation14、pipeline13；demo6场景23事件 |
| Adapter | 23通过，真实 Pi SDK 会话和工具循环 |
| Package | 2通过；unit、pack和CLI退出0；27文件包隔离安装、README示例与CLI成功 |
| Reviewer | 22通过，无未解发现 |
| Tester | 原严格20项全部通过 |

随后原 ProjectManager 运行一次公开 `npm test`，15个明确列出的测试模块共141项通过、零失败、零跳过、零取消。打包测试与 Reviewer 字节断言同轮运行成功；产品源码、package/lock、README、15测试模块及夹具、tarball 前后哈希一致，隔离消费者已清理。详见 [机器证据](../runtime/legion-pi-node-v3/packaging/final-public-npm-test.json) 与 [完整日志](../runtime/legion-pi-node-v3/packaging/final-public-npm-test.log)。

## 产物与身份

本地 [legion-runtime-0.3.0.tgz](../runtime/legion-pi-node-v3/packaging/legion-runtime-0.3.0.tgz) 已验证，未发布 npm registry。Node要求 >=22.19.0；实际验证环境为 Windows / Node24.11.1 / npm11.6.2；两个 Pi 公共 SDK 实际版本均为固定1.0.4。

- 25个产品.mjs聚合SHA256：`75ab247b8aafc224d39c926119e170bc56bbda966073a73eeab3bfa4a4bb8327`。算法为统一 `/` 的相对路径按Ordinal排序，每行 `path + TAB + per-file SHA256 + LF`，对UTF-8全文做SHA256；根Governance独立只读复算一致。
- tarball SHA256：`a83a86499c4aaa7c997d94cabbb697efdc82f81475b622b85307ac682de4d8f0`。
- 执行配置SHA256：`25e46e9b7811685847116393d9c9982062e975f66e151ce3d094ef2be020cccb`；总体设计SHA256：`342fd522343126c31c7a7f1ee3c8befab9f363d5372297847ebc8f42b5f30bae`。
- package.json SHA256：`09c91316f22a7b3f3c1097b71e1a6e0388736ff4d7540ea9e0583c9f0ddd6e0b`；package-lock.json SHA256：`f4649c6a7b8c2aa623c07097f01de2f340b561228d3cfa75a0a48cc7acdfb34b`。
- 全套机器证据SHA256：`0f35d694c56a9d6ca8d49a2e77d3af0f2f8b10ef9f7826fd63fd4752cfe369c2`；全套日志SHA256：`599cd0a8cabb97404f297f1392737acebfd9a243262a592b765724c81b260332`。根Governance实际读取计数并核对两证据摘要。

PM早先聚合采用混合路径键的JSON.stringify对象，算法不同，不能与上述标准聚合直接比较。逐文件摘要一致证明内容未变。

## 验证范围

真实 Pi Session、Agent循环、受控工具、文件和审计流程均实际运行；推理使用本地受控流，未验证外部provider账号或收费服务。宿主明确传入name、provider/model代理配置与操作scope；权限取角色、任务和实例范围交集，deny优先。

宿主沙箱原生junction创建出现EPERM，链接拒绝分支的部分用例使用明确标注的受控lstat元数据，保留断言、失败历史且没有跳过。不能据此声称本机原生junction或所有reparse tag端到端验证。权限内核也不构成恶意同进程代码或OS竞争条件的隔离沙箱。

旧Python v1源码、组织v001及历史验证仅作只读参考，未进入Node发行包；旧101项成绩未用作Node证据。角色各自完成源码与测试，根Governance仅维护治理文件并只读核验；最终使用说明见 [README](../../README.md) 与 [Supervisor交付](../../docs/roles/Supervisor/docs/delivery-node-pi-v3.md)。
