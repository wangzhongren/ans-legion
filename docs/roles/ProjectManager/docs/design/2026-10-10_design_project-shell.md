---
date: 2026-10-10
type: design
status: accepted-integration-implemented
---

# 项目 Shell v1 的公共包与跨角色接线

角色在编译项目时需要运行 npm 和已安装 `.bin` 工具。此前只有固定 Node checks，不能满足通用命令；也不能直接放宽 Check 的 fork 限制，或给原项目父目录写权限。客户已确认[冻结 v1](../../../../../.ans/decisions/handwell-pm-approved-project-shell-v1-design.md)，SHA `a5a0166dcd302ecd65416b85b2801a5a687972481e90f80c31ea23959eff59c0`，以及[155文件精确配置](../../../../../.ans/decisions/handwell-pm-approved-project-shell-v1-config-authorization.md) c872245f285125eae264b77ef4447a97fe0dcb14506c0e77f216d41003865ea4。本文解释已接受方案在公共包中的实际接线，不替代或修订冻结设计。

## 过程和选择

采用原角色申请→独立串行 PM 审核→真实 Host 一次审批 ledger→OS 隔离项目镜像→整批候选验证→原 Mutation 与批准产物发布→原 pending 最终回应。完整成功/失败/恢复流程见[当前功能](../feature/project-shell.md)。副本允许编辑工具创建临时文件；原项目仍只允许精确 owner/task 文件提交。代价是复制、磁盘、版本检查与部分发布恢复协调。

Node runtime 公开透明具名 Model/helpers 和 Shell Service；Desktop 唯一 Workbench Pipeline 组合相邻公开 Services。Kernel拥有 Model/Storage/隔离执行与生成恢复，Adapter拥有 SDK pending及预算，Desktop拥有审批队列/CAS/原角色对话/发布ledger，PM拥有包入口、真实安装与文档。Service不互调，Provider不上调业务路由callback，root main仅启动公开 Interface。

prepare 的完整 input artifact generation 包含 fixed dependency scopes∪请求 outputs，不由 caller 重算局部 digest。发布只遍历本条 outputs；只读依赖改动整批拒绝。0.8.1依赖读取是原v1必要兼容修复；本次0.8.2另调整Host时间事实caller，SDK字段与factory保持。binary source 使用 Host-only readCandidateData/canonical bytes，与 text 互斥；安全执行位、删除缺失墓碑都保留原授权、基线与审计。

源码partial通过当前基线、显式Human新计划/新owner授权与新审批恢复，不使用旧receipt、自动源码withdraw或原子回滚。新任务与真实检查完成后追加 recovered关联，旧失败不改。generated既有同会话版本受控恢复不能冒称重启自动恢复。Workspace Reader仅新增已批准精确治理元组；其两文件补充配置独立真人接受，不改六角色冻结定义或通过candidate标签授予能力。

## 实际实施和验证边界

0.8.0 bridge-v1与0.8.2 bridge-v3分别真实pack/install，旧产物保持。当前0.8.2源清单44 mjs、总文件46、具名导出62，包SHA见[公共API](../../api-spec.md)。已安装包的 native隔离、离线npm/build、only-dist已有.bin、只读依赖拒绝、普通text/binary/delete发布、SDK三协议同pending、旧API/CLI/恢复与Electron Check实证见[依赖修复任务](../../../../scheduling/handwell-project-shell-dependency-read-repair-v1.md)。Desktop组合owner检查与Reader补修有各自当前证据，独立验收仍由[最终任务](../../../../scheduling/handwell-project-shell-model-time-facts-repair-v1.md)后段完成。

macOS需要本机CLT/SDK及startup探针；缺失失败关闭，权限签名不能识别信任边界外Host clone。外网未实跑，不承诺域名隔离、Linux/Windows Shell支持或当前Windows发行验收。固定Check仍独立受限，Shell exit0不替代验收。

本PM最终阶段只更新十份角色文档并复验原配置，不改变已经作为下游输入的tar、Source/lock/README/exports或owner代码。原固定harness会刷新当前阶段固定JSON，因此先后分别完整归档并标明latest，不覆盖历史task日志或把旧JSON observations改称当前。

[当前功能](../feature/project-shell.md) · [实际变更](../change/2026-10-10_change_project-shell.md)


## 0.8.2 显式Host时间事实

角色批准后可能在发许可与真正提交之间等待。纯Model现在不读取环境时钟或注入clock callback；Shell/Mutation的相邻Provider取得fresh safe epoch毫秒，经公开Service的 `observeTime()` 传入Model比较。Host每项proposal调用 `controller.issueShellPublication(proposal, receipt, service.observeTime())`，不为整批缓存旧时间。操作层在issue、consume、publication以及真正create/replace/delete和recheck前重新观察，缺失/无效/回退时间事实、到期、abort及replay仍失败关闭，不能凭旧issue事实延长许可。

publicfactory和62具名Model/helpers不变；该Host controller第三参数为必需caller调整，实际Desktop与包测试各自接线。SDK request/review/result、renderer与历史不新增clock字段，ordinary write/edit仍原用法。Policy的私有publication上下文使用真实receipt和 `observedAtMs: mutation.observeTime()`，Model值或时间数字不是审批授权。完整实际接口见Kernel API末节。

当前0.8.2 bridge-v3真实包SHA `1a2a7c483f04f2bb939d6bf4d25aa7a4318bc866a473dcac251f74d1ee592622`，46files/44mjs及安装每源相等，Desktop产品仍0.2.0。原0.8.1 bridge-v2和0.8.0 bridge-v1、旧proof及final before/after archive均保留。Owner实现和本阶段三固定门的最新候选/成绩、独立Reviewer/Tester状态以[时间事实修复任务](../../../../scheduling/handwell-project-shell-model-time-facts-repair-v1.md)记录，不复制活任务计数，不把下一检查写成已pass。当前包源保持冻结，本阶段只更新10文档，固定门前后完整保全bridge-v3快照并按Gov策略标注latest。


本机当前WindowsZIP本体及对应descriptor缺失；macOS可核验的是历史0.7.0 TGZ/descriptor的39file/37source身份与当前0.8.2真实安装，不读取不存在的ZIP字节，不以这些结果宣称Windows支持、exe/DPAPI或GUI发行通过。旧Windows精确断言和独立发行验证由后续原Reviewer/Tester保留。外网仍未实际运行，当前Shell仅macOS CLT/SDK与startup探针实际能力范围，失败unsupported；源码/生成恢复的新Human授权、当前baseline与追加recovered语义保持。
