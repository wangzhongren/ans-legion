# 项目 Shell v1 最终有限审查（2026-10-10）

## 当前结论与固定输入

当前冻结组合的独立结构检查和Tester实际证据未发现尚未修复的确定阻断。该结论限定于下面的版本、受控fixture和macOS首版；正式最终文档候选由`handwell-project-shell-absence-wire-repair-v1 / reviewer-final`两项固定检查及complete记录绑定，Supervisor负责verify。

- 已确认设计SHA：`a5a0166dcd302ecd65416b85b2801a5a687972481e90f80c31ea23959eff59c0`。
- 精确配置SHA：`c872245f285125eae264b77ef4447a97fe0dcb14506c0e77f216d41003865ea4`。
- 当前 runtime **0.8.2**、Desktop **0.2.0**；bridge-v3 TGZ SHA：`1a2a7c483f04f2bb939d6bf4d25aa7a4318bc866a473dcac251f74d1ee592622`，46包文件、44源码条目、62公开Model/helper。源码、归档与实际installed包按字节严格校验。
- Desktop当前owner候选：`f1b26f01ab2034e97cfa05b57f11a9d623d860e750fdd193ce93d377c0b1b651`，34 Model / 185 Shell / 202 unit真实通过，无跳过。
- Tester当前verified候选：`87167ead8e18587d6be18b523f6b5dea77440714d72464fe6aed033313a2f25f`。所有六门exit0、candidateUnchanged、无timeout；各角色candidate覆盖其自身输入，不能互相代称。
- [Reviewer核对的当前日志/计数/截图SHA清单](../../../../.ans/runtime/handwell-pm-approved-project-shell-v1/Reviewer/evidence/final-review-inputs-6637a3b6.json)；历史日志及旧tar未覆盖。

## Tester六门：核实的最终结果

| 固定门 | 通过 / 总数 | 未执行 | 当前实际日志 |
| --- | --- | --- | --- |
| Shell 集成与原生/GUI组合 | 25 / 26 | 1 Windows未执行 | [tester-shell-flow-1-shell-cb307a1f.log](../../../../.ans/runtime/handwell-project-shell-absence-wire-repair-v1/evidence/tester-shell-flow-1-shell-cb307a1f.log) |
| 既有集成 | 34 / 34 | 0 Windows未执行 | [tester-shell-flow-1-regression_integration-f104938d.log](../../../../.ans/runtime/handwell-project-shell-absence-wire-repair-v1/evidence/tester-shell-flow-1-regression_integration-f104938d.log) |
| 既有 GUI | 6 / 7 | 1 Windows未执行 | [tester-shell-flow-1-regression_ui-e66297ff.log](../../../../.ans/runtime/handwell-project-shell-absence-wire-repair-v1/evidence/tester-shell-flow-1-regression_ui-e66297ff.log) |
| Mac 必需隔离探针 | 7 / 7 | 0 Windows未执行 | [tester-shell-flow-1-macos_probe_required-3952e230.log](../../../../.ans/runtime/handwell-project-shell-absence-wire-repair-v1/evidence/tester-shell-flow-1-macos_probe_required-3952e230.log) |
| 完整 Node 回归 | 295 / 295 | 0 Windows未执行 | [tester-shell-flow-1-full_node_regression-6a7b15ea.log](../../../../.ans/runtime/handwell-project-shell-absence-wire-repair-v1/evidence/tester-shell-flow-1-full_node_regression-6a7b15ea.log) |
| 完整 Desktop 回归 | 244 / 245 | 1 Windows未执行 | [tester-shell-flow-1-full_desktop_regression-f544aac0.log](../../../../.ans/runtime/handwell-project-shell-absence-wire-repair-v1/evidence/tester-shell-flow-1-full_desktop_regression-f544aac0.log) |

所有门失败数和取消数均为0。表内三个Windows未执行记录位于不同门，不能相加成三个不同的Windows行为已验证。日志完整SHA与命令见上面的核对清单及调度checkEvidence。本轮不修改Tester冻结前的诊断文字以制造新候选。

## Reviewer独立检查与职责

当前源码组合的兼容节点已Supervisor verified：candidate`bc94085bb917e004d32206c7d5a38bd1271ecb32ff09b999cb300b59342e7238`，`shell`51/51、`regression_structure`50/50，均0fail/cancel/skip且候选未变化。[五个冻结测试SHA与当前兼容结果](../../../../.ans/runtime/handwell-pm-approved-project-shell-v1/Reviewer/evidence/absence-wire-five-tests-final-6e712628.json)。本次最终阶段仅八份Reviewer文档写入；文档封存后重新运行同两项固定命令，最终日志和candidate以本任务`reviewer-final`记录为准，不能复制兼容节点哈希充当最终文档哈希。

有限独立检查覆盖纯Model/层边、公开exports、SDK拒绝私有delete/binary/publication、完整authored inventory和owner、Host私有permit/receipt逐候选一次消费、PM-only真实SDK工厂拒绝、实际持久ledger的PM精确review/原requester/CAS、独立PM队列以及新Human恢复结构。保留原nonce、权限、requiredApprovals、取消与IPC断言。内部typed receipt fixture只验证绑定，不冒充真实OS执行。

## 已审核的行为

### 逐调用审批与发布

请求角色等待原pending tool；PM用自己的实际profile/上下文和独立instance对requestId/digest/revision提交结构化批准或拒绝。文本yes不授权，未知或重复决定拒绝。Host绑定project、plan、role/task/instance/run、profile、context、owner、scope、输入generation与到期事实，原requester只能消费一次；取消、重启和旧纯文本历史不恢复许可。Shell/Mutation的时间事实来自下层Provider公开observeTime，Model不读取环境时钟。

命令在真实macOS OS profile与项目镜像中运行，权限/初始化失败关闭。源码候选经真实baseline、owner、写集合和完整inventory核验，再用Mutation逐文件发布；binary、safe executable与delete墓碑仍有真实摘要和字节约束。generated范围发布与当前generation关联。命令exit0不能替代selfcheck或Acceptance。公开Shell入口是Service，私有receipt/helper不在exports/SDK/Wire中。

### 部分发布与正确成果保留

部分发布保持历史`partial_published`结果；重启旧批准不能再次启动SDK或Shell。恢复必须由新Human计划批准当前baseline和原owner的完整任务范围，再提交新PM审批、当前实际checks及独立Acceptance。

`recovery_verified_retained`仅由Host核对旧successful/observed publication与当前SHA/bytes/mode、新Human/request/plan、owner/task/instance/run和磁盘/generation后产生；它独立于新Mutation.results。实际Tester恢复case验证正确binary的inode及bytes不变，该资源没有新candidate或新Mutation result，旧partial全部字段保持，recovered记录追加真实来源与新evidence。SHA或mode变化需要新真实Mutation；缺少旧provenance以及普通无变化任务仍不能作为已交付。保留的真实旧delete用absent/null/0、墓碑和旧request/proposal来源表达`retain_file`，不会伪造新delete。

Reviewer新增的严格Wire正反例验证合法absent/null/0/noexec与present，拒绝非法SHA/bytes/state/exec/授权字段。实际检查取当前project的获准缺失事实；renderer显示“获准缺失”，不显示SHA null。每次recovered前重核当前check输入、owner、磁盘与generation。

### 实际界面与焦点

Reviewer读取当前阶段截图并核对ui.json；等待PM、执行、发布、已发布可见，PM结构审核原因和原角色请求按真实run展示，记录提示旧审批不能重执行。[真实PM结构审核理由截图](../../../../.ans/runtime/handwell-pm-approved-project-shell-v1/Tester/evidence/shell-ui-PUg6eq/pm-structured-review-reason.png)显示批准原因。[activity Esc回焦点截图](../../../../.ans/runtime/handwell-pm-approved-project-shell-v1/Tester/evidence/shell-ui-PUg6eq/activity-esc-focus.png)与当前Tester实际Chromium/native输入断言共同证明本case的内侧focus可见；静态CSS或单张截图不代替键盘行为证据。

UI使用生产Renderer/Host/安装的SDK，受控filesystem暂停用于观察短暂发布阶段；原验证和commit仍实际执行，细节在ui.json中注明。原5tabs、稳定节点/输入/IME、member事实隔离、markdown/链接和nonce交互继续由当前回归覆盖。

## 失败和修复历史保留

- 首Shell Reviewer门51项中47pass/4fail/0skip，candidate`131ab216…ca35`，日志`reviewer-test-compatibility-1-shell-82e9620b.log`保留。三项fixture误配（projectId、公开Model数、合法旧authority出口）及局部异常类型误配已在本角色范围修复；局部2/3失败与3/3通过日志均保留。
- 原Model纯度断言准确发现Core/Shell三个Date.now环境时钟读取，报告issue并stop；Kernel原owner修为显式observedAtMs并重新验调用方/0.8.2包。原纯度断言未弱化，当前实际通过。旧0.8.1 tar与失败日志保留。
- Tester此前真实GUI发现合法absence Wire拒绝、activity Esc焦点样式及正确binary无diff被判task_outputs_missing，原owner完成当前必要修复；旧截图/旧frame观察未通过记录不升级成通过。当前六门与`PUg6eq`阶段证据替代旧候选作最终依据。
- source/generated partial、拒绝/错误摘要/取消与恢复实验保存旧事实，再由新Human/current baselines/PM审批/实际selfcheck和Acceptance完成；没有自动撤回客户源码或复活旧grant。

## 平台与证据边界

当前覆盖macOS真实原生执行/隔离、受控loopback网络canary、离线npm产物、实际Electron/installedSDK和临时项目的检查/恢复。SDK使用localhost可控模型协议fixture；这些结果不证明外部模型provider的语义质量、真实网络服务或客户SSH业务已完成，也没有使用真实凭据。

历史0.7 TGZ及package-smoke的f45 SHA、39文件/37源码字节真实验证，历史Windows ZIP及descriptor当前缺失；Windows ZIP本体/GUI/DPAPI未执行。Windows适用的原完整ZIP断言保留；Mac证据不替代Windows。当前无新的Windows发行产物或外部部署验收结论。
