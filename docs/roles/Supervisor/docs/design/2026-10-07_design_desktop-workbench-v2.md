---
id: supervisor-desktop-workbench-v2
type: design
created: "2026-10-07"
updated: "2026-10-07"
status: delivered-verified
related: [legion-desktop-workbench-v2]
---

# 工作台 v2 调度设计

客户已对 [canonical](../../../../design/2026-10-07_design_desktop-workbench-v2.md) 同版回复“确认”，默认专注对话。此说明具体化 Supervisor 的阶段和证据管理，不另设客户审批。项目的固定七个开发角色与客户目录中的动态 Agent 组织分别管理；只有项目管理是 Human 对话入口。

```mermaid
flowchart LR
  k[Kernel Model/Policy/Storage] --> a[Pi 多轮 Service/Provider]
  a --> c[公开入口 新tarball 实际安装]
  c --> d[桌面能力和工作台Pipeline]
  d --> i[原生IPC与专注对话]
  i --> p[Windows ZIP]
  p --> r[独立Reviewer]
  r --> t[独立Tester完整流和Node回归]
  t --> u[PM固定公开入口检查]
  u --> r2[重新make后的当前ZIP独立审查]
  r2 --> t2[当前ZIP独立完整流]
```

八阶段精确输出为18/14/11/30/12/10/9/10，共114，另Supervisor七份说明直接按本次客户授权维护。原task_ops任务 [legion-desktop-workbench-v2](../../../../scheduling/legion-desktop-workbench-v2.md) 保留Interface issue33/stop34与原47历史。当前 [fixture修复任务](../../../../scheduling/legion-desktop-workbench-v2-fixture-repair.md) 只改原Desktop五effect tests，并接续原12/10/9/10后四阶段；前三原verified候选和日志实际未变，25其他cap产物只读，基线身份固定新plan。此为公共caller效果隔离必要修复，原canonical/角色/121 whitelist/33生成范围不变。角色定义和治理冻结输入只读；owner设计先于本阶段代码，后段不普通重写已验收前置输出。

每个节点的 candidate 包括本阶段 writeSet、相关冻结合同与已存在前置 authored 输出。未来阶段将修改的文件不提前加入上游固定读集合，避免把基线检查误写成最终组合证据；当前 Kernel owner 检查旧 single_run 兼容，Adapter后最终组合由独立完整回归覆盖。实际变更使依赖候选失效时，停止依赖派发，原 owner 有界修复并重建受影响门禁，不把历史证据重命名为当前。

Model/品牌 read/task/permit 合同由 Kernel 唯一负责。Storage验证真实root/link/context bytesSHA；Provider不得持有上层 controller。Adapter管理实例私有SDK会话与轮次；Desktop唯一Workbench Pipeline仅组合公开Service。ProjectManager先完成0.4.0精确29文件tarball、desktop0.2.0真实local依赖安装，然后桌面实现才可运行其bare imports。现有旧公开入口与历史0.3.0包、GUIv1 ZIP独立保留。

通过 required checks、owner完整输出与独立验收才能释放下游。真实SDK缺失失败、无skip；开发验收使用受控localhost三协议，不调用付费模型。测试只写角色本阶段生成目录，软件检查无executor显示not_executed。真实Windows DPAPI、重启、取消、当前大任务记录、浅深色/最小窗及实际ZIP均由正式证据覆盖。

八个逻辑阶段验收后，PM使用同冻结配置的零 authored [公开入口任务](../../../../scheduling/legion-desktop-workbench-v2-desktop-public.md)执行已批准desktop-public：13模块串行、73项通过，源码与包锁不变。原因是task_ops verified节点不再active，不能复用原worker凭据run-check。本次make将ZIP从755e0950…变为11c16a8c…，按[当前产物复核任务](../../../../scheduling/legion-desktop-workbench-v2-artifact-recheck.md)重新收集Reviewer desktop-unit与Tester unit；旧产物结论保留历史，不重跑未变化的Node回归。凭据从不写公开记录。

当前八个逻辑阶段与十二项门禁均通过，public verified6（73项），当前ZIP复核 verified11（Reviewer15、Tester2），全部inactive。完整结果记录于 [交付](../delivery-desktop-workbench-v2.md)。本说明只说明调度设计，不是业务自验收。
