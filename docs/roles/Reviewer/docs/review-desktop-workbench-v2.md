# Workbench v2独立有限审查记录

2026-10-07，固定Reviewer；任务legion-desktop-workbench-v2-fixture-repair/reviewer-1。仅本职责九文件，生产与其他owner证据只读。依据[accepted canonical](../../../design/2026-10-07_design_desktop-workbench-v2.md) SHA715639b5dd278437059f29bde1e7c02ac90d94af18f9bf5a6b5367d16e9ab5d3、config2546ebd0…、[desktop-workbench合同](../../../../.ans/contracts/desktop-workbench.yaml)及冻结ownership87808cec2739fdbbc9520631637b4ddcb2adc2f8680a6e849ec8885d01a35187。

实际结构为纯Model共享、Interface→唯一WorkbenchPipeline→公开Desktop/Kernel/Adapter Services→本层Providers；无旧Core Interface/peerPipeline调用。公开workbench-models显式30值/纯authority导出，lower mutationAuthority只有consume/recheck/release，SDK与密钥只在main。模型协议使用实际安装Pi1.0.4；本轮受控localhost不收费。原22与8所有测试名称保留，新7有限检查覆盖：

| 范围 | 有限目标 |
| --- | --- |
| Node22 | primaryOwner先rawSHA、24源层边/纯Model、旧P1、raw/forged/replay身份、控制面、审计与SDK隔离、29包项 |
| Desktop8 | 36源/相邻public、exact IPC、safeDTO、真实完整任务记录/双审计、篡改与stale时间、legacy CRUD、native sandbox/DPAPI/重复close、ZIP与嵌入Core全部字节 |
| Workbench7 | branded read/保留审批/永久撤权；唯一PM双轮无工具及无确认零workspace写；确认真实文件/审计与安全历史重启；写前context变更整plan失效；队列阻塞时入口stop同步撤权；in-flight确认close；无输出task失败；cancel_turn后可继续 |

当前PM ZIP是LegionDesktop-0.2.0-win32-x64.zip，194645336bytes，SHA755e0950cbc2b44beb1d1888a19d85995ae781a2aedd36d3bce11bb3afbf6f56；descriptor SHA3465ff334e903f3a58fff112d0a206063a58cfb4ee0db708d71a85744e859b8b。Node0.4.0 TGZ29项SHAf3114a19205b69542c5629cfbb4a2664e9aebc62fc81f76a69d332e6f922140c。测试读当前真实descriptor再核产物，未来合法重make不依赖上述历史常量。Core源码聚合fa803823…为本轮PM输入身份，PM成绩不替Reviewer独立结果。

已实际开发检查：Node22首次21/1/0为Reviewer期待角色缩写错误，已严格修正并保留观察；Desktop8首次8/0/0。本文和六docs于最终approvedchecks前封存，不预称新7已通过。最终node-unit22及desktop-unit15的真实计数、候选与日志SHA由[同任务两次check事件及完成回执](../../../scheduling/legion-desktop-workbench-v2-fixture-repair.md)提供。未发现已复现生产契约缺陷；只有这两固定检查通过且Supervisor核验同候选后，recommend推进独立Tester。

保护基线75文件见[protected-before](../../../../.ans/runtime/legion-desktop-workbench-v2/Reviewer/node/packaging/protected-before.json)，结束复算保存在同目录protected-after.json；原22/8源备份、首次观察、native proof在本角色生成目录。普通ActionProposal .ans硬拒绝、旧requiredApprovals不消失；task目标与SDKrun状态分开，checkStatus仍not_executed。

局限：词法层边和有限公开调用不能证明所有潜在OS竞态/宿主攻击隔离。两个Node链接测试是lstat元数据拒绝分支，并非本机junction/reparse端到端证明；native8的DPAPI为同进程真实加解密及窗口重开，不声称跨进程重启密钥验收。新Workbench加密使用测试本地lower-infrastructure替身，SDK/HTTP/文件/审计是真实。未重复owner三协议全矩阵、完整Node回归、发行ZIP启动/视觉；独立Tester后续负责。记录预算16MiB/4096events/64MiB refresh，不截断伪成功；旧1MiB三项unavailable只是当时reader上限，不意味着历史task失败/损坏。旧GUI/Node历史只读保留。

正式首轮证据：node-unit22/0/0；desktop-unit15项9pass/6fail/0skip，日志reviewer-1-desktop-unit-acbfd2cb.log/SHA3c31d8b3083e8eff5c2880f30ca3611945f72f475bda8343852abbb5597ee5b7。Reviewer自身两处准备假设被纠正：嵌入Core只枚举Node .mjs产品，不含历史Python；turn completed后还须等待draft实际构造。核心断言/名称不变，原日志保留，正式两checks须重新核同候选。

## 2026-10-08 项目级读取 v1 审查增量

本次 Reviewer 派发为 `legion-project-wide-read-v1-final/reviewer-1`。已检查 Kernel 路径规则、Read Service 与 Storage Provider，Pi 受控工具，Node Runtime 默认关闭读取的 opt-in，Desktop 的 PM 与执行成员读请求协调、运行/项目失效，以及 0.5.0 包公开入口。Reviewer 只更新自身两份测试和本记录；生产修复归 Kernel owner。

**已复现的阻断问题：** 初始 `normalizeProjectReadResource` 只拒绝指定控制目录、`.env`、私钥后缀和几个私钥文件名。项目根 `.npmrc` 内的隔离假令牌可经 `createReadService().readFile()` 返回 `status: read` 与完整文本。`.netrc`、`.pypirc` 和 `.ssh/`、`.docker/`、`.kube/`、`.gnupg/` 路径同属需核对的常见凭据路径；新增 Reviewer 断言要求根目录列表隐藏它们，直接读取及嵌套大小写变体均返回 `restricted_resource` 且无正文。初始候选不满足这些断言，不应标记 Reviewer 通过。

旧 Reviewer 断言已跟随已实现的公开合同更新为 27 个 Node 源模块、32 项 0.5.0 tarball、34 个 workbench Model 导出及 PM 两个只读工具/执行成员额外一个精确写工具。原确认、旧审批、审计、无确认写入和取消断言保留。配置的 `review` 检查在首次执行时为 23 pass / 7 fail：六项 Desktop 本地 HTTP 夹具因本轮沙箱拒绝 `127.0.0.1` listen 而未执行到业务断言；包字节校验发现 Kernel owner 已开始并发修复，旧 tarball 与当前源码不同。该结果不是完整产品验证；Kernel 修复和重新打包后必须在新候选重跑。当前 macOS 主机未验证 Windows ZIP 启动或 DPAPI，不从已有测试外推该结论。

Kernel owner 修复凭据路径后，ProjectManager 已重新打包并安装本地 0.5.0 runtime。新 Reviewer 派发 `legion-project-wide-read-v1-review-final/reviewer-1` 把新增三层 Read Service 所有权核对改为读取本阶段已批准项目配置与 Kernel 边界，不再只比较源码路径前缀。直接执行 `TMPDIR=/private/tmp node --test tests/reviewer/test_structure.mjs apps/desktop/tests/reviewer/workbench-boundaries.test.mjs`，实际结果 **30 pass / 0 fail / 0 skip**；其中凭据列表/直读拒绝、原精确写入与审计、PM只读工具清单、0.5.0 tarball 全部字节与公开入口均通过。本轮直接检查获准使用 localhost 夹具；正式配置 `review` 的候选、日志与结果由新任务 `task_ops` 事件记录。本结论只覆盖这些实跑用例；Windows ZIP 启动与 DPAPI 仍未在 macOS 执行。

## 2026-10-08 文件归属与受控编辑 v1 审查增量

本次 Reviewer 派发为 `legion-file-ownership-and-agent-edit-v1-delivery/reviewer-1`。已检查不同角色写范围交叉、纯 Model 的 `ProjectFileOwners` 申领/转交/版本、Desktop 用户数据中的归属保存、确认与任务许可绑定、Storage 编辑 SHA/唯一替换/原子提交与审计、0.6.0 公开包以及 PM 无写工具的路径。旧读取、精确写入、审批与凭据断言继续保留。

**已复现的阻断问题：** `ProjectServiceImpl.saveProject` 的 `expectedFileOwnersDigest` 检查只受单个 Service 实例的 `#tail` 串行保护；`ProjectProviderImpl.write` 使用临时文件加 rename，却没有跨实例比较并交换。两个共享同一 userData 的 Service 同时读取 `owners-v0`，分别写 Backend/Frontend 的 `src/shared.ts`，两次 `saveProject` 都返回成功，最后一个写入覆盖另一个归属。Reviewer 新增同步两次读取的确定性回归，要求只有一次成功、另一请求返回 `stale_file_owners`，并核对磁盘上的 winner。初始候选该测试实际失败：**2 次成功，预期 1 次**。Desktop owner 必须修复持久化竞争后再对新候选完整复测。Windows ZIP/DPAPI 在本 macOS 主机未执行。

本轮配置 `review` 检查实际结果为 **31 pass / 8 fail / 1 skip**，候选在检查中未变。除上述真实归属竞争外，旧 Reviewer 测试对 0.5.0 包版本、34 个公开 Model 值和三工具执行成员的预期已过期；这些旧夹具导致另外七项失败，不能解释为新产品缺陷。Windows ZIP 项按平台跳过，macOS 原生 Electron 项实际通过。应先修复竞争，再更新 Reviewer 的 0.6.0 发行与四工具夹具并重跑完整检查；本轮不提交完成结论。

后续 Desktop owner 在用户数据 Provider 写入处增加跨实例锁，并在锁内重读实际目录、比较目录摘要与预期 owner 摘要；先前双实例回归现在只有一个请求成功，另一请求被拒。最终 Reviewer 派发 `legion-file-ownership-and-agent-edit-v1-final/reviewer-1` 已把旧 0.5.0/34 Model/三工具执行成员断言更新为实际安装的 0.6.0/41 Model/四工具合同，同时保留 PM 仅两个读取工具以及原写入、审批、审计、取消断言。新增公开 Model 独立检查覆盖目录与精确范围交叉、Windows 大小写别名、显式转交、旧 owner 和旧版本拒绝。Read Service、Policy、一次性许可、Storage 编辑两次 SHA/身份重查与最终审计摘要，及界面归属/转交展示均经源码与现有 owner 测试核对；正式全套结果以最终任务 `task_ops review` 事件为准。macOS 原生 Electron 和已安装包身份可在本机执行；Windows ZIP 与 DPAPI 仍未执行。
