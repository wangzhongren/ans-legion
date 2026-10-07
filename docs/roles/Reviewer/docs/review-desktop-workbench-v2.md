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
