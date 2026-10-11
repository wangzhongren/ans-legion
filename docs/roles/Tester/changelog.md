# Tester 变化记录

2026-10-07 Workbench v2：按已确认 canonical 和正式十文件任务，原20仅迁 Tester 新阶段 node/tmp；新增真实 Electron 公共完整流与当前 ZIP 原生 UI/DPAPI 重启验收，更新四 current docs 与本版设计/验证。仅两个 approved checks，实际计数与失败历史由 task_ops 留存，旧记录不改写。详见 [v2验证](docs/verification-desktop-workbench-v2.md)。


2026-10-07，客户全 Node/Pi v3 授权下实施 accepted permission12+generic8 有限方案。新增两个 Node integration 与一个 inference-only fixture，更新四份 current 说明并新增本阶段设计/验证；旧 Python/phase1 文件只读保留。

原开发实际20项：19通过、1失败、0跳过。首轮 permission 11/12 的一个测试误用 Error.name 判定自定义 MutationError，改为严格 instanceof 构造类型后 permission12通过；未放宽产品要求。原generic7/8通过，Runtime.close 活动真实 Pi 的取消返回错误被完整及单例运行独立复现。issue tester-runtime-close-terminal-audit 已由 task_ops 接受 stateRevision51，原 [正式失败日志](../../../.ans/runtime/legion-pi-node-v3/evidence/tester-1-unit-f97ea4f6.log) 保留，不以新证据改写历史。

同日关闭修复：原Kernel owner以activeRun覆盖完整终态审计，在同步撤权后先停止会话、等待run完成再关闭Mutation；不吞真正audit fault。当前前六节点verified，Kernel74项和Reviewer22项通过；Reviewer另运行原关闭/真实写后审计错误两严格回归2/2通过。Tester只更新六份current文档，原20测试及fixture逐字节不改；文档完成后仅运行一次approvedunit，当前实际candidate/20项组合结果见 [关闭修复任务](../../scheduling/legion-pi-node-v3-close-repair.md)。

当前状态和精确复现见 [Node验证](docs/verification-node-pi-v3.md)、[设计](docs/design/2026-10-07_design_node-pi-v3.md) 和 [任务记录](../../scheduling/legion-pi-node-v3.md)。前代审批 alias/scalar P1 继续严格迁移，原失败记录见 [Reviewer历史](../Reviewer/docs/review.md)。Python v1 17项报告保留为 [历史](docs/verification.md)，不作为 Node 成绩；业务导航见 [feature-map](feature-map.md)。

2026-10-08：按已确认完整治理工作流和精确十二文件派发，迁移原 integration 生成目录到新的 Tester 范围；保留许可、审批、SDK 多会话/取消、写入审计、编辑、三个真实 HTTP 协议与 owner/CAS 回归，并给 Workbench 夹具加真实角色审批、当前 Human 请求及软件检查/独立 Acceptance。新增公开 Check Service 真执行反伪证据、完整 SDK 架构/交互/自测/验收/限定原角色返修复验和实际隔离 Electron UI。旧历史/Windows 证据不被改写为 macOS 通过。详见[当前设计](docs/design/2026-10-08_design_governed-workflow-verification.md)及[当前验证](docs/verification-governed-workflow-v1.md)。

同版独立复验：适配实际持久聊天 timeline 与真实提案后失败的 pendingProposals 公共契约，保持所有旧执行/取消/作用域/检查/返修断言。完整长期流程独立发现 PM 把全 timeline/历史/证据嵌入 prompt 造成既有 65536 输入预算溢出、留下运行态；保留真实失败及安全 JSON，返回 Desktop 原 owner，未提高预算或删除后续轮次。最终修复/复验状态见当前验证和调度证据。

同版当前独立临时组合最终31/31 integration、2个实际macOS UI通过和1个明确Windows跳过；新timeline、真实partialproposal、boundedprompt和旧read/edit/transfer由当前安装0.7严格复验。SDK对象身份断言按明示checkpoint合同改为持久PM实例/session/profile精确相等、plain历史连续及无工具/授权重放；未减少文件作用域、检查、取消、SHA或CAS断言。全部authored测试/说明冻结后，正式当前task_ops结果由调度记录固定。

2026-10-09：按客户已确认及时雨 / Handwell 生产界面与18文件配置，Tester五文件任务追加真实新布局验证；旧结果/失败保留。两现有E2E明确进入任务/文件/成员/记录页签、同nonce弹窗草稿/固定footer、全部实际成员映射及撤旧计划、尺寸/主题paint/IME接收/回看滚动/减少动画，继续实际SDK+检查失败→原owner返修→复验和读/凭据/SHA/转交回归。真实UA确证同ID区域焦点A失败交原Desktop最小修复；原失败断言修后通过，真实host组织锁答复焦点B原与新均通过。新截图/JSON用原批准子树的 handwell-ui-20261009/final-v1，不覆盖基线。正式当前证据以 legion-ui-handwell-final-v1 调度记录为准，无生产源码修改，无WindowsonMac或外部客户/发布冒充声明。见本角色设计与验证的10/9新UI章节。

2026-10-09 final-v2：final-v1正式UI真实host组织忙焦点B落BODY已记录issue/stop，未以局部通过刷绿。原Desktop最小B修复与真实成员idle状态更正后，Tester同五文件只切final-v2证据prefix、增waiting title/AX真实准确观测并记录当前门；原A/B/完整矩阵与权限/nonce/SHA/取消/返修、Windows诚实skip断言及固定预算不变。旧证据保留，当前正式结论链接legion-ui-handwell-final-v2，独立流程退出后交Supervisor核验。

2026-10-09 final-v3：原结构两data-page导航契约的最小欢迎CTA修复后，Tester同scope只更新final-v3输出并使原真实完整UI矩阵从welcome-settings实际点击进入settings、两导航标记与可见性仍严验。final-v2同candidate31integration/4UIpass及Windows未运行历史保留；A/B/idle/权限/nonce/修复/布局等断言不降级，固定两门各一次当前formal以legion-ui-handwell-final-v3记录为准。

2026-10-09 Markdown/focus纠错：同五文件范围保留旧全部证据，新markdown-focus-v1实际生产UMD/SDK rich语义/原文与Human literal、安全HTML/协议/图片无fetch、原生链接gesture/exact/oneuse（末端OSspy明示）、真实旧磁盘history与增量stream article/draft/focus/阅读锚点、单项目press/focus和memberEsc内环/selected解除、9长目录合法verticalscroll通过必要诊断；缺lexer明确限定DOM合同。原fullUI、安全/检查/返修与固定两门保持，正式当前结论由legion-ui-markdown-and-focus-v1记录，不声称外部浏览器/Windows/客户项目已通过。

2026-10-09 角色持续记忆与第五对话页：正式Tester六文件范围新增公开Adapter一次fresh恢复、真实Host11摘要/预算/timeout/语义/CAS/取消/迁移分支与公开存储after-rename取消独立验证；原完整SDK治理流程继续核对四角色跨任务/返修/重启/职责变更的独立文字和完整当前canonical pins。真实Electron五页签、working/Sidebar入口、共享成员选择、PM与journal隔离、DOM/阅读/焦点/Esc、系统/项目/旧未知来源和长中文名字布局通过必要局部诊断，原权限/检查/失败/返修/Markdown/native断言保留。六文件冻结后正式原配置integration/ui由legion-persistent-role-context-and-dialogue-v1当前同candidate证据固定；新截图与JSON仅role-context-20261009，旧日志保留。无生产写入，无客户SSH/外部模型/真实Windows冒充声明。详见本角色设计与验证本轮章节。

同轮客户要求隐藏项目成员栏可见滚动条：独立真实长成员列表补滚轮/Tab/DOM身份/无占位bar与截图观察，正式检查等待原Owner最小CSS验证，其他阅读滚动和权限不变。

首次正式integration33/34发现旧只读Workbench的6条历史期望遗漏取消轮次完整Human；正式UI同candidate Mac6通过/Windows1未执行。原失败34a与通过eb日志、38截图/JSON保留。随后同fixed Tester一文件supplemental派发ack，旧helper两count改7且严格证明新增Human/顺序/唯一、实际SDK无partial助手、raw archive保留partial与项目隔离；主6+补充1冻结，先补充integration/Coordinator verify，再刷新主两个fixed门，不修production。

2026-10-09 有界依赖交接调用方刷新：正式docs-only任务legion-bounded-dependency-verification-v1仅更新设计/验证/changelog，源码与既有测试只读，无新case。记录真实Core9文件/90787bytes/28自测后的Renderer前SDK prompt_budget历史，以及Owner六字段最新变更元数据交接、自主读取现依赖、完整Human/canonical与预算/权限保持的已verified c58源码和33/193开发证据；旧夹具OOM与此前Tester34/Mac6结果保留。三文档冻结后原fixed integration/ui刷新实际caller，Windows仍诚实未执行，不把Owner新case当独立Tester成绩，不续旧grant或写客户Core。

2026-10-10：正式16文件Shell验收，新增公开能力/必需native probe/实际Workbench/hidden GUI四入口及八自身docs；原四fixture仅新stage/fresh和明确SDK工具契约适配。实际发现absence wire和正确binary恢复矛盾，issue/stop及旧未稳GUI图保留，由原Desktop修；同原失败wire与no-diff资产案例严格复验，retained与Mutation分列、inode/bytes/旧partial不变。PM拒/错digest/取消、source/generated partial重启新Human审批/checks/Acceptance诊断完成。六fixed原门在同16输出冻结candidate执行，当前结果看正式任务；不改production/客户SSH/真实key、不声称Win/外网或OS物理键盘实测。见[验收](docs/verification-project-shell-v1.md)。

## 2026-10-11 CLI v2 / npm 1.0.3独立安装验收

承接已停止attempt的Tester fixture，独立安装13场景与既有回归40项实际通过；修正旧task.writeSet/角色完整owner scope、固定Supervisor时序、PM真实请求归因及隔离leaseRoot。旧v1实际Human迁移、新检查/独立验收和原字节备份均验证；已知随机密钥全fixture扫描。最终同候选双门证据见[CLI验证报告](docs/verification-cli-v1.md)。生产Profile兼容问题由原owner修复后重包；Tester未修改生产。整仓库旧治理observer pin限制与旧GUI验收暂停保留，早期不明marker保留并列精确路径。

## 2026-10-11 Su v0.3 / npm 1.1.1修复独立验收

承接原10文件partial，真实1.1.0 bin双草案缺陷保留并交原PM修复；新图安装verified fresh v2 1.1.1包，保留原13场景及双草案旧yes拒绝/当前B新Human答复强门。回归接线按实际Su channel、当前turn工具结果和SDK预算基线，保留完整原文、摘要水印及原权限检查。报告/fixture定稿后固定双门按同当前candidate记录，历史诊断通过不作完成证据；具体结果见CLI验证报告与新图调度证据。旧observer pin/GUI暂停/不明marker保留，Tester不改生产。

## 2026-10-11 Su Host取消后继续 / npm 1.1.2

接原owner取消生命周期修复后的fresh1.1.2包，强化既有cancel场景为真实partial SSE→/cancel→同PID/同Su实例Continue→第二实际HTTP正常完成，总安装场景仍14。完整Human/取消事实保留，partial不入续轮SDK/history/checkpoint/summary/facts、不复活旧授权；原双draft/三协议/owner/Check/Acceptance/安全和回归40强门保留。正文冻结后本图双门同candidate真实记录；旧1.1.1证据、未知marker、observer旧pin与GUI暂停保留。

## 2026-10-11 Supervisor channel/CAS / npm 1.1.3

原owner修复后台Supervisor channel误写后，真实fresh1.1.3独立安装保留14场景，治理现有失败后立即Human新draft链增当前digest确认/三Supervisor channel来源隔离强断，保留全部40回归及完整Human/choice/covered水印。旧1.1.2安装通过与39/40真实prepare_memory失败保留；本图先冻结四文件正文，再同candidate双门，证据以本图记录为准。未知marker/旧observer pin/GUI暂停不变，Tester不改生产。
