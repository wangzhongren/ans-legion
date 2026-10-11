---
date: 2026-10-10
type: change
status: implemented-independent-acceptance-pending
---

# 项目 Shell 公共包与最终文档接线

用户在已确认项目中需要编译或安装依赖时，执行成员现在可以通过 `legion_request_shell` 申请完整命令。PM在独立串行回合明确审阅摘要与范围后，Host才为原角色运行隔离镜像；原角色“对话”得到实际输出并回到同一SDK pending，主区显示等待审批、执行和发布。完整分支与恢复见[当前功能](../feature/project-shell.md)。

此前 `legion_run_check` 仅支持受限固定Node runner，不能作为通用Shell入口。新增公开 `legion-runtime/services/shell`，`workbench.mjs`显式导出八类纯Shell Model与三个helper；旧根八API和PiAgent八生命周期接口保持。PM实际更改位置为 package manifests/locks、workbench.mjs、README/依赖验证与两个package tests；本最终阶段只写十份PM文档，不再改桥接源字节。运行接线实际位于Desktop `src/pipelines/workbench.mjs`、Organization公共Service/Provider与Kernel公开Shell/Mutation，业务owner源码不是PM写域。

源码发布支持普通text、Host-only binary、安全执行位及删除墓碑；生成产物需要计划scope/kind和本条申请。0.8.1已修正只申请dist时读取已有依赖的契约：完整input generation直接采用prepare值，只发布当前请求输出，readonly dependency改变拒绝整批，链接同bytes重定向仍使授权stale。原Shell后台清理、Host审批、精确owner/task/current baseline与Check/Acceptance门禁保持。

0.8.0归档SHA `4b03aca112fa3755a4bbdca5ce5fdff62ffe26b03ea4a33fb09f31622a9353b8`；0.8.1历史SHA `970bf9954813022cef8f396b8ac388088024cdca9ffd18d1533347723b5a73f1`；当前0.8.2 SHA `1a2a7c483f04f2bb939d6bf4d25aa7a4318bc866a473dcac251f74d1ee592622`。Desktop产品仍0.2.0，使用新local file+实际sha512完整性。首次旧lock integrity导致EINTEGRITY失败保留，按新tar真实完整性更新后重新安装和逐源核对。旧0.7/f45及更早tar/ZIP也不覆盖。

源码partial记录真实效果、暂停和重启恢复状态；新Human计划/current baseline/new approval实际恢复并经新checks后追加recovered，旧partial不改，不声称自动withdraw或整体原子。Reader旧schema拒绝真实c872治理元组的11次失败保留，精确双文件补修后当前候选验证；候选AWAITING标签保持历史，未知字段/Scope和伪配置仍拒绝。

验证：[依赖修复桥](../../../../scheduling/handwell-project-shell-dependency-read-repair-v1.md)的实际包门与contract结果和contract；[Reader](../../../../scheduling/handwell-project-shell-workspace-reader-v1.md)及[最终组合](../../../../scheduling/handwell-project-shell-model-time-facts-repair-v1.md)的Desktop当前owner证据分别绑定实际候选。本阶段先保存完整旧bridge-v3 archive与SHA/mode/path/log关联，固定JSON作为latest复验后另存完整新run；当前三检查结果看最终任务，不伪称旧原路径JSON hash保持，也不以归档复活已过期观察。独立Reviewer/Tester、真实GUI/客户SSH后续开发与Windows当前ZIP仍待各自验收，外网未测试。

[同版设计](../design/2026-10-10_design_project-shell.md) · [公开API](../../api-spec.md) · [当前功能](../feature/project-shell.md)


## 0.8.2 显式Host时间事实

角色批准后可能在发许可与真正提交之间等待。纯Model现在不读取环境时钟或注入clock callback；Shell/Mutation的相邻Provider取得fresh safe epoch毫秒，经公开Service的 `observeTime()` 传入Model比较。Host每项proposal调用 `controller.issueShellPublication(proposal, receipt, service.observeTime())`，不为整批缓存旧时间。操作层在issue、consume、publication以及真正create/replace/delete和recheck前重新观察，缺失/无效/回退时间事实、到期、abort及replay仍失败关闭，不能凭旧issue事实延长许可。

publicfactory和62具名Model/helpers不变；该Host controller第三参数为必需caller调整，实际Desktop与包测试各自接线。SDK request/review/result、renderer与历史不新增clock字段，ordinary write/edit仍原用法。Policy的私有publication上下文使用真实receipt和 `observedAtMs: mutation.observeTime()`，Model值或时间数字不是审批授权。完整实际接口见Kernel API末节。

当前0.8.2 bridge-v3真实包SHA `1a2a7c483f04f2bb939d6bf4d25aa7a4318bc866a473dcac251f74d1ee592622`，46files/44mjs及安装每源相等，Desktop产品仍0.2.0。原0.8.1 bridge-v2和0.8.0 bridge-v1、旧proof及final before/after archive均保留。Owner实现和本阶段三固定门的最新候选/成绩、独立Reviewer/Tester状态以[时间事实修复任务](../../../../scheduling/handwell-project-shell-model-time-facts-repair-v1.md)记录，不复制活任务计数，不把下一检查写成已pass。当前包源保持冻结，本阶段只更新10文档，固定门前后完整保全bridge-v3快照并按Gov策略标注latest。


本机当前WindowsZIP本体及对应descriptor缺失；macOS可核验的是历史0.7.0 TGZ/descriptor的39file/37source身份与当前0.8.2真实安装，不读取不存在的ZIP字节，不以这些结果宣称Windows支持、exe/DPAPI或GUI发行通过。旧Windows精确断言和独立发行验证由后续原Reviewer/Tester保留。外网仍未实际运行，当前Shell仅macOS CLT/SDK与startup探针实际能力范围，失败unsupported；源码/生成恢复的新Human授权、当前baseline与追加recovered语义保持。
