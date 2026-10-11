---
id: tester-project-shell-verification-v1
type: verification
title: 项目Shell独立完整验收与实际平台边界
created: "2026-10-10"
updated: "2026-10-10"
status: implemented-unverified
---

# 原角色拿到真实结果，当前检查决定交付

本角色按真人接受c872配置、冻结Shell v1和16文件assignment验收。生产、客户SSH源码、真实profile/API key只读或未接触；所有新effects在Tester新Shell阶段fresh子目录。当前0.8.2 bridge-v3 tarSHA为1a2a7c483f04f2bb939d6bf4d25aa7a4318bc866a473dcac251f74d1ee592622；Core/Reader/权限及真实安装身份属于上游独立证据，不能代替本角色门。

## 已实际通过的必要诊断

| 实际入口 | 覆盖及结果 |
| --- | --- |
| Kernel公开Shell+真实PM SDK | 2项：精确结构化review/持久Host校验与一次consume、拒绝/错digest/replay、foreign owner与原输入变更不执行或不发布；opaque receipt不出Host。能力fixture是受控Host，与实际Workbench批准流程分开说明。 |
| 实际macOS native | 7项、0skip/todo：startup真实pipeline/继承child、干净环境、人工canary/原目录拒读，none拒localhost、localhost/external批准只访问人工server，offline npm安装并发布依赖、readonly .bin only-dist且node_modules inode/bytes/link/mode保持，修改readonly依赖整批拒绝，symlink/hardlink/setid拒绝、detached/leader exit回收、timeout镜像不发布。未访问外网。 |
| 实际Workbench/安装SDK/原Host | UTF8/binary/safeexec/delete墓碑/dist整批发布后原pending终态仅一次，原角色真实检查与独立Acceptance通过；getState与真实wire重验证合法absence。审批等待时getState/普通操作可响应，不占主tail；原PM审核理由关联request ID。 |
| 实际SDK拒绝/取消 | PM拒绝、错误精确digest、审批期取消三分支实际不执行，源码保持、没有自测/Acceptance伪报；旧pending/审批不复活。 |
| 实际source partial/恢复 | 第二源码commit的人工真实I/O故障留下先前成功binary和partial journal；重启仍暂停、旧批准不触发SDK或命令。新Human当前baseline/new plan、新PM/native与真实checks/Acceptance恢复；正确binary bytes/inode不变，无new candidate/Mutation。recovery_verified_retained承接真实旧request/proposal及currentowner/task/plan/Human，旧partial.result JSON全值不变。 |
| 实际generated partial/恢复 | 已真实发布dist后的人工ledger写故障如实记录partial，源码集合为空也不能伪完成；重启/旧确认不执行，新Human生成版本确认、新PM/native重建与当前selfcheck/Acceptance通过，旧partial真实结果保持，追加recovered。 |
| hidden真实GUI | 原review/executing/publishing标签严格等实际DOM；drawer等computed opacity1/无running过渡再截图；原成员真实输出安全文字、PM结构化理由同request、五tabs/来源/角色节点/焦点保持。Esc回同activity trigger且1px/-3px/transformnone；实际完整自测/Acceptance与缺失wire通过。PM理由最终图需滚入可见区，不以DOM存在代替可读截图。 |

这些诊断不代替六个正式门。本次[continuation任务](../../../scheduling/handwell-project-shell-absence-wire-repair-v1.md)的shell/regression_integration/regression_ui/macos_probe_required/full_node_regression/full_desktop_regression必须原argv、原300秒、同最终16输出candidate执行，macos_probe_required实际>0且0skip/todo。通过/失败/未知平台以真实CheckEvidence与完成报告为准，不预填正式计数。

## 发现、修复与历史

本角色最先发现governedWireDTO对获批删除检查的absence sha:null仍调用sha，真实GUI getState internal_error；原issue44/stop45与暂停bytes/SHA/mode快照位于Tester/evidence/paused-wire-v1-20261010T155737。原三截图只说明backend观察，Root实看DOM标签lag和drawer过渡，不能算预期呈现成功。原Desktop修复明确absent/null/0/noexec，未知/非法仍拒，并修activity内侧可见focus。原正确binary无diff恢复task_outputs_missing也已由Owner补充独立retained事实，与Mutation results分列；本角色不为制造diff改binary。原失败和Root批准continuation保留，非Tester修生产。

准备过程中npm CLI路径、owner规范化digest、Acceptance revision、reviewing阶段、task数组顺序、class/plain快照原型及named fs.open同步属于Tester fixture错误，日志/停止快照保留，未降权限、吞错、换argv/skip或裸fallback。原wire失败断言和正确binary inode/bytes/provenance严验修后通过。

四个旧获派integration/UI仅做新stage/fresh证据、实际已确认request_shell精确枚举兼容。旧runtime/proof/截图/tar不覆盖；每次进程和隔离目录只关闭/清理本次实例。完整Node/Desktop固定harness会刷新本阶段bridge-v3 latest JSON；先保存全部旧bytes/SHA/mode/path/原日志关联，检查后再保存新快照。旧v1/v2 archives、原task_ops日志、tar/源码/lock保持，不声称旧latest路径仍同hash。

macOS已实跑native，CLT/SDK/startup失败即unsupported失败关闭；Windows旧ZIP及descriptor本机缺失，保留原Windows branch并明确未执行，不以TGZ/descriptor或MacGUI冒充Win。网络external这里只访问受控localhost，未实跑外网；外部模型、正常主窗口和真实客户SSH后续由Root另验。native GUI输入包不等于OS物理键盘证明。

[方案](design/2026-10-10_design_project-shell.md) · [当前验收功能](feature/project-shell.md) · [本轮变化](change/2026-10-10_change_project-shell.md)

首次正式Shell固定门候选cd7f0b19为26总项：24通过、1失败、1Windows平台未执行、0取消/todo，原日志tester-shell-flow-1-shell-1b735257.log保留。唯一失败是旧macUI固定runtime0.7.0期望与实际已批准0.8.2不符，已同16范围改精确0.8.2并将该旧case完整5tool枚举改已确认6tool（加入request_shell），其他negative/permission完全保留；原具体macUI局部6.77秒通过。不是放宽版本、泛化includes或删Windows分支。16输出重新freeze后只运行原六门，macos_probe_required必须0skip/todo，其余含原Windows平台未执行单列，不计Mac通过。
