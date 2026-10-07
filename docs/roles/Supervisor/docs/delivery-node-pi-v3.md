# Legion Runtime Node + Pi v3 交付记录

状态：完成当前验证。客户直接授权的全 Node 产品与 Pi 通用 Agent 已实现；[关闭修复任务](../../../scheduling/legion-pi-node-v3-close-repair.md) stateRevision 44 的七节点全部 verified，所有 active=false。随后公开 npm test 也实际通过。无未解决产品发现。

产品是纯 ESM npm 单包；真实 Pi SDK 在同一 Node 进程中提供 AgentSession、模型交互和 Agent 循环。Legion 配置 name、proxy、scope，绑定可信角色/任务，由 Kernel 执行受控 write_file。详见 [README](../../../../README.md)、[总体架构](architecture.md)、[Kernel 权限](../../KernelEngineer/docs/feature/permission.md)、[Agent 流程](../../KernelEngineer/docs/feature/generic-agents.md) 与 [Pi 接入](../../AgentAdapterEngineer/docs/feature/pi-agent.md)。

## 当前证据

| 节点 | 当前检查与实际数量 | 状态 |
| --- | --- | --- |
| deps | dependencies / sdk：两个真实公共包均 1.0.4，exit 0 | verified |
| model | 31 pass / 0 skip，纯不可变 Model；只读重验 | verified |
| adapter | 23 pass / 0 skip，真实 SDK 闭环与同名 provider 双实例隔离；只读重验 | verified |
| kernel-runtime | policy 15、mutation 14、pipeline 13、完整 unit 74（8 模块），全部 0 fail/skip；demo 六场景、23事件 | verified |
| package | unit 2 pass / 0 skip，pack/cli exit 0；27 文件实际包隔离安装、公开 API/真实 Pi/README/CLI | verified |
| reviewer | 22 pass / 0 skip，严格 P1 与当前包字节；无未解决发现 | verified |
| tester | 原 20 pass / 0 skip，测试与 fixture 字节未变；真实关闭取消及审计失败 | verified |

14 项 required checks 均 exit 0、candidateUnchanged=true、无超时；精确 argv、环境、日志 SHA 与节点候选见 [任务记录](../../../scheduling/legion-pi-node-v3-close-repair.md)。Model 31 与分层 checks 是完整 Kernel 74 的子集，不能相加当独立用例数。[Reviewer 报告](../../Reviewer/docs/review-node-pi-v3.md) 与 [Tester 报告](../../Tester/docs/verification-node-pi-v3.md) 保留各自有限覆盖范围。

七节点验收后，原 PM 只读执行一次 `node D:/soft/nodejs/node_modules/npm/bin/npm-cli.js test`：15 测试模块、141 tests / 141 pass / 0 fail/skip/cancel/todo，exit 0，28.390 秒。Kernel 74 + Adapter 23 + package 2 + Reviewer 22 + Tester 20 = 141。package 实际重生成与 Reviewer 包字节断言在同轮通过，产物 hash 相同；25 产品源码、package/lock/README、15 测试与 fixture 的前后 hash 全相同，临时 consumer 为 0。额外入口验证没有替代 required checks，也没有改 authored 文件。
[完整日志](../../../../.ans/runtime/legion-pi-node-v3/packaging/final-public-npm-test.log) SHA256 `599cd0a8cabb97404f297f1392737acebfd9a243262a592b765724c81b260332`；
[前后身份与实际命令](../../../../.ans/runtime/legion-pi-node-v3/packaging/final-public-npm-test.json) SHA256 `0f35d694c56a9d6ca8d49a2e77d3af0f2f8b10ef9f7826fd63fd4752cfe369c2`。

## 候选与本地发行包

最终 Tester 组合候选：`e6f2a819098fd2bf31cb53fb8bf57b415c7e1c3bfd3d6a012231341aca3c95b5`。
[正式 Tester 日志](../../../../.ans/runtime/legion-pi-node-v3-close-repair/evidence/tester-1-unit-05d516de.log) SHA256 `5a1ddc940695c96ffea26e9f34ff115af2c8bf56886e7b7031c5ac0cc3432fa6`。

25 个产品 .mjs 聚合 SHA256：`75ab247b8aafc224d39c926119e170bc56bbda966073a73eeab3bfa4a4bb8327`。
算法为相对路径统一 `/`、Ordinal 排序，每行 `path<TAB>fileSha256<LF>`，UTF-8 后 SHA256；逐文件身份见上方 JSON。PM 早期 `943318…` 是 mixed Windows 路径 object 的 JSON.stringify 聚合，算法单列于该证据，不能混用。

稳定 [legion-runtime-0.3.0.tgz](../../../../.ans/runtime/legion-pi-node-v3/packaging/legion-runtime-0.3.0.tgz)：
`D:/work/code-work/agent-organization-runtime/.ans/runtime/legion-pi-node-v3/packaging/legion-runtime-0.3.0.tgz`
SHA256 `a83a86499c4aaa7c997d94cabbb697efdc82f81475b622b85307ac682de4d8f0`。
包仅含 23 个 src .mjs、根 facade、CLI、README 与 package.json；不含 Python、task_ops、.ans、测试、lock 或缓存。已实际隔离 offline install，验证两 SDK 1.0.4、真实 Pi 两次受控推理、typed API、README 示例与安装后 CLI；未发布 registry。[当前 smoke](../../../../.ans/runtime/legion-pi-node-v3/packaging/package-smoke.json) 包含 integrity 与 consumer lock 身份。

## 直接运行

本工作区已安装依赖，直接运行 CLI 无需重新安装：

```powershell
Set-Location 'D:\work\code-work\agent-organization-runtime'
$env:TEMP = 'D:\work\code-work'
$env:TMP = 'D:\work\code-work'
node .\bin\legion.mjs demo
```

输出一项允许 Backend 写入、五项拒绝、Frontend 原内容保留和 23 条审计事件。产品需要 Node >=22.19.0；实际主机为 Node 24.11.1 / npm 11.6.2。外部 Python 3.14 仅用于开发治理，不是产品依赖。

公开 API 从 `legion-runtime` 导入 `createRuntime` 等八个导出，调用 `runtime.createAgent({name,proxy,scope})`，然后 `agent.run({taskId,prompt})`。宿主配置的 `modelProviders` 是数组，完整可执行离线例与模型 metadata 见 README；proxy 选择 provider/model。在另一个消费项目使用上方 tgz 路径执行 `npm install '<tarball绝对路径>' --ignore-scripts`，然后 `npm exec --offline -- legion demo`。

源码完整检查可复现为：

```powershell
$env:npm_config_cache = 'D:\work\code-work\agent-organization-runtime\.ans\runtime\legion-pi-node-v3\npm-cache'
$env:npm_config_ignore_scripts = 'true'
node D:\soft\nodejs\node_modules\npm\bin\npm-cli.js test
```

## 已知限制与保留历史

真实 SDK 与 Agent 循环已经运行，推理来自官方 Faux 受控模型；没有付费模型或外部 provider 请求的验证。Codex/Claude 提案工厂只是本地转换变体，没有真实厂商会话兼容承诺。唯一模型工具为 legion_write_file；默认 read/edit/write/bash、扩展、MCP、skills、模板与资源发现关闭。proxy 未实现 HTTP/SOCKS 传输配置。

权限保护正常受控本地 API，不能隔离恶意同进程宿主、管理员或并发 OS 路径替换。文件和 index/daily 审计并非跨文件事务；替换后审计失败保留 observedMutation=true，不能声称回滚。同工作区共享队列串行化 Provider 单次文件或审计操作。

本机两个创建 junction 用例因 EPERM 使用受控 lstat 元数据触发相同拒绝分支，断言保持且 0 skip；不能声称原生 junction/所有 reparse tag 端到端实测。其他文件和审计流程原生 Node 实跑。npm 包不携带源 lock，消费项目会解析自己的传递依赖树；源码 lock 是本次实际验证的树。

原 [Node 开发任务](../../../scheduling/legion-pi-node-v3.md) 的 Tester 19/1 失败、[正式失败日志](../../../../.ans/runtime/legion-pi-node-v3/evidence/tester-1-unit-f97ea4f6.log) 与旧包身份保留历史；关闭修复只改必要 Pipeline、一个 owner 回归与当前说明，旧20项严格测试原样。现在先同步撤权，等待运行取消及终态审计，再关闭 Mutation Provider；正常取消与真实 audit fault 分别返回真实语义。此前 junction EPERM、取消测试消息预期和 package cleanup realpath EPERM 的失败证据亦留在原任务。

固定 [接受设计](../../../design/2026-10-07_design_node-pi-v3.md) SHA256 `342fd522343126c31c7a7f1ee3c8befab9f363d5372297847ebc8f42b5f30bae`、配置 SHA256 `25e46e9b7811685847116393d9c9982062e975f66e151ce3d094ef2be020cccb` 全程未变。package.json SHA256 `09c91316f22a7b3f3c1097b71e1a6e0388736ff4d7540ea9e0583c9f0ddd6e0b`，package-lock.json SHA256 `f4649c6a7b8c2aa623c07097f01de2f340b561228d3cfa75a0a48cc7acdfb34b`；146 条依赖有完整性记录，安装使用 ignore-scripts、项目局部缓存。原 Python 源码/测试、政策快照和 [v1 交付](delivery.md) 只读保留，v1 的101通过不替代本阶段证据。

Supervisor 七份协调说明在全部业务验收后更新，身份单独记录；它们不属于业务 tests 的自验收输出。调度凭据保持私有。
