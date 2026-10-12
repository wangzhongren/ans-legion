- 2026-10-07：依客户六角色 Legion Runtime v1 接受并授权第一阶段开发；明确源码和文档边界。

## 2026-10-07 Node + Pi v3
客户直接要求全 Node 产品运行，更新接受边界、公共契约和固定检查；v1 政策及治理定义已快照。仅授本轮精确文件，非生产完成证据。

## 2026-10-07 GUI v1
客户在同版管理评审后回复开发，接受本阶段精确范围与Supervisor职责。原v002定义已完整快照；新增桌面不改Core，O1未选。这是授权/治理变更，不是业务完成证据。

## 2026-10-10 项目 Shell v1 治理准备
追加 `docs/scheduling/handwell-pm-approved-project-shell-v1.md` 条件task_ops记录权限；精确配置未接受，不启动执行；无应用写权限变更。

2026-10-10：依真实单文件配置接受，明确同版Shell supplemental精确scheduling路径 `docs/scheduling/handwell-project-shell-proposal-test-v1.md`；仅task_ops记录权限澄清，六owner冻结输入及其他范围不变。

2026-10-10：明确同版依赖读取兼容修复精确记录 `docs/scheduling/handwell-project-shell-dependency-read-repair-v1.md`，沿用已接受主配置humanpin及冻结设计；读取验证依赖与生成写入授权分离，无新源码ownership。

2026-10-10：依Root确认，补精确 `docs/scheduling/handwell-project-shell-workspace-reader-v1.md` 与 `docs/scheduling/handwell-project-shell-final-integration-v1.md` 条件task_ops记录路径及Reader两文件readSet要求；Reader双文件配置仍待真人接受，final沿用c872主155范围，六owner冻结输入不变。

2026-10-10：新增 `docs/scheduling/handwell-project-shell-model-time-facts-repair-v1.md` 同版条件记录路径及Model纯度修复scope；真实Kernel列表待评估，同主155权限不扩大，新bridge-v3与旧0.8.1/日志保全，六owner冻结输入不变。

2026-10-10：补 `docs/scheduling/handwell-project-shell-absence-wire-repair-v1.md` 同版必要GUI absence wire修复条件路径；Desktop最小方案待评估，主配置/六owner权限不扩大，0.8.2不重包，旧日志/截图和暂停候选输入保全。

- 2026-10-10：为已确认的 CLI 优先 v1 增加 Supervisor 精确源码/测试归属及隔离运行效果；代码实施仍待 task_ops 精确配置接受与派发。

- 2026-10-10：为 Human 已明确的角色独占文件 v2 更新当前必读与独立运行效果；旧 task.writeSet 产品规则由新设计替代，旧任务记录保留。

## 2026-10-11 Su 客户入口方案与调度候选

Governance 为用户要求的产品 Su 客户入口、全项目读取及角色工作状态/日志方案，补充一份精确条件 scheduling 路径 `docs/scheduling/legion-supervisor-frontdoor-v1.md`。仅在新设计和新精确配置获得真人确认后由固定 ANS Supervisor 经 task_ops 创建与维护；当前只读评审不构成派发或源码授权。产品 Supervisor 的能力不因与仓库调度角色同名而扩大；旧 1.0.3 包、原任务记录与通过证据保留。

同日 Human 接受新设计 v0.3 与精确配置 SHA `c8032728888d3652ce0987a94cb7ca84557c9ecf53bb3f27bb3f0df6d6b9e7b2`，授权本固定 scheduler 初始化与自动派发六个原 owner 的 79 文件子范围及真实 npm/独立验收。授权依据见 `.ans/decisions/legion-supervisor-frontdoor-v1-authorization.md`；旧 GUI 验收保持暂停，配置与设计不得在实施中自行改写。

## 2026-10-11 Su CLI 当前确认选择必要修复

独立 Tester 在真实安装的 1.1.0 bin 中复现：同一 Su turn 的两份草案都保留 pending Host 确认，CLI 拒绝旧 A 的 yes 后反复呈 A，无法展示当前 B；旧 yes 未执行任务或写入。Governance 明确新增条件记录 `docs/scheduling/legion-supervisor-frontdoor-v1-cli-repair-integration.md`，沿原 Human pin/79 文件/六 owner/固定 checks 安排原 PM 修复与 Desktop、Tester、Reviewer 独立重验。补丁版采用 fresh 1.1.1，旧 1.1.0/bridge/1.0.3 与所有失败证据保留。未新增源码权限，Governance 未改应用或运行记录，修复尚未实施/验收。

## 2026-10-11 Su 取消后继续对话必要修复

独立 Reviewer 在 1.1.1 真实 Pi SDK directCustomer 场景复现：Su SSE 在途取消后，下一次 sendMessage 被 Host 接收，但终态为 pi_run_failed，受控服务端仍只有一次请求。Human 原文保留且未完成片段不进入 history；structure 68/69，失败证据保留，Reviewer attempt 已安全 stop。Governance 新增精确条件记录 `docs/scheduling/legion-supervisor-frontdoor-v1-su-cancel-repair-integration.md`；沿同一接受配置/设计，原 Desktop/Adapter 先只读定位，仅对当前 79 范围内的实际原 owner 文件正式派发。新补丁版 1.1.2，旧 1.1.1 包及证据保留；未新增源码权限，尚未实施或验收。

同日 Adapter 真实 SDK 无工具、生产 Su 工具集及公开 Service 的 cancel→安全 history restore→同实例继续对照均通过，未证明资源 runtime 假说。Host 同样会把恢复阶段的无 code 异常映射为 pi_run_failed，不能据原日志判定 Adapter catch。Governance 新增同 pin 条件记录 `docs/scheduling/legion-supervisor-frontdoor-v1-su-cancel-host-repair-integration.md`，由原 Desktop 在既有 26 路径内正式进行安全阶段诊断和最小修复，随后 PM、Desktop 调用方、Tester、Reviewer 重验；原 Adapter 诊断图 stop/证据保留，79 范围不扩。

## 2026-10-11 Host 记忆 channel/CAS 竞争必要修复

独立 Tester 的 1.1.2 installed14 通过，regression39/40；失败验收后立即新 Human 草案在 prepare_memory 报 stale_role_memory，未形成新 draft。原 Desktop 只读发现 memberEnd 缺少 log.channel，后台 Supervisor 可默认写入 Supervisor|su_customer 并与前台 CAS 竞争；原日志不足以判 covered/source/revision 具体抛行，必须正式安全诊断与真实屏障复现，不虚报根因细节。Governance 增加 `docs/scheduling/legion-supervisor-frontdoor-v1-role-memory-race-repair-integration.md` 同 pin 条件路径，D→PM fresh1.1.3→D caller→T→R，79 范围与接受设计不扩；旧1.1.2及T停止证据保留。

## 2026-10-11 Su 1.1.3 文档交付状态关闭

当前记忆修复集成图五节点已 verified，真实1.1.3 CLI10、调用方207/157/123、独立安装14场景/回归40、Reviewer69通过。Governance 仅新增 `docs/scheduling/legion-supervisor-frontdoor-v1-delivery-doc-close.md` 条件路径，原 PM 在已接受范围内关闭 feature-map、cli-project-workflow、Su change 和 changelog 四份文档的中途状态。沿原 desktop_dependency 只读固定门；产品99mjs、README、manifest/lock和tar不写，前后哈希核对，新增依赖检查JSON采用UUID独立文件。没有新源码权限，不重复D/T/R，文档收尾尚未派发/完成。

## 2026-10-12 项目指挥台调度候选

登记新阶段唯一精确调度记录。当前设计/配置待Human接受；未初始化或派发应用任务，旧暂停GUI记录不复活。

2026-10-12：Human接受v0.3及64文件修正版配置，固定Supervisor可初始化项目指挥台单图并自动派发，最多三工人；先完成独立实际验收再报告交付。旧Shell GUI暂停不复活。

2026-10-12：Human接受单Reviewer调用方检查漏项补齐配置86dccc57…，允许新精确集成记录接续原D/PM verified候选；原64配置及执行角色定义保持原字节，避免使在途D证据失效。

2026-10-12：Human接受66文件Caller测试补齐及既有Desktop范围GUI实证必要修复，允许精确新UI repair集成图自动闭环；原四执行角色定义/旧config/design不改，旧失败保留。

2026-10-12：登记同66接受范围内实际Su助手误标PM与GUI闭环必要修复的新精确集成图；原设计/config/执行role defs不变，不重复同版Human批准；旧证据保留，最终实际同候选验收。

2026-10-12：根据客户产品与助手改名“二哥”的实施意图，登记29文件窄范围候选调度路径；具体方案及精确配置尚待真人接受。仅复用既有生成根的全新stage，不改旧验收证据，不在接受前派发。

2026-10-12：真人正式确认二哥展示改名方案aa40f95f…及29文件配置f27e36af…，固定Supervisor条件记录生效，可依法自动派发并完成新候选验证；不开新功能、不发布推送。

2026-10-12：核出新包依赖门仍绑定1.2.2，登记仅补PM既有verify-dependencies脚本的30文件候选接续记录；待真人接受，原D29执行不受影响。

2026-10-12：真人批准单依赖文件补齐配置68d86b8f…，30文件条件记录生效；原29方案及D已在途候选保留。

2026-10-12：在已接受30范围内登记README漏改纠正后的fresh final-v2新包接续记录，避免最终tar与旧readSet错绑；不改配置/设计，不覆盖诊断包/证据，不重复确认。

2026-10-12：根据客户侧栏参考图登记二哥主入口/其它角色查看分组候选，7文件/两owner，待真人确认具体方案和配置；原改名已完成候选保持。

2026-10-12：真人确认二哥侧栏方案d9d8e759…及7文件配置afbcb443…，条件记录生效；固定Supervisor可派发两原owner并验证真实桌面，不改包或权限。

2026-10-12：根据客户要求加图片，登记桌面粘贴/拖入/选图、typed图片历史、真实Pi模型与角色像素交接的74文件候选；新方案/config待真人接受，生成沿旧已准根的fresh桥/终包，不改旧证据。

2026-10-12：真人接受桌面图片输入方案2236f669…及74文件配置e4e0282b…，固定Supervisor可按精确依赖派发六既有owner并完整验证；不发布或推送。

2026-10-12：独立审查定位真实公开Pipeline白名单漏图片三方法，同74接受范围登记facade必要修复新接续图；旧T/R安全停止保失败，重包1.3.1/0.4.1并重验真实public factory，不重复基础门或真人确认。
