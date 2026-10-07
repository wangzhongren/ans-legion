# Legion 桌面工作台 v2 管理评审记录

记录者：ANS Governance。日期：2026-10-07。以下记录来自固定 Supervisor 转交的固定 ProjectManager 实际只读评审，不是 Governance 代行管理评审，也不是客户实施授权。

Canonical：[桌面工作台 v2](../../docs/design/2026-10-07_design_desktop-workbench-v2.md)。版本：`legion-desktop-workbench-v2`。SHA256：`715639b5dd278437059f29bde1e7c02ac90d94af18f9bf5a6b5367d16e9ab5d3`。

## 实际管理结论

ProjectManager 对上述同 hash 文档返回 **recommend approval**。Supervisor 已实际读取并复算 hash，再将该确切版本交给原固定 PM；评审中未写应用、安装依赖、运行产品测试或请求模型。

PM 的理由：唯一项目管理入口、Human 确认后执行、Desktop 唯一 Workbench Pipeline、真实多轮、上下文写前重验和新 tarball 先实际安装，均符合受影响 owner 的能力评估，没有要求退回 canonical 的具体不兼容。文档明确未运行的软件检查、未知模型 metadata，以及缓存观察与验证时间，避免用示例或旧成绩冒充新版验证。

实际评估的 owner 包括 KernelEngineer、AgentAdapterEngineer、DesktopEngineer、Reviewer 和 Tester；PM 负责跨层组合、npm 公开入口、实际依赖及新发行包，Supervisor 维持唯一调度。旧 GUI v1 revision36 六节点 verified、全部 inactive；旧 Tester 未派发。新方案应用代码尚未开始。

## 比较及必要范围

仅在旧三页面增加输入框不能完成真实多轮、确认凭据和动态执行。独立 Reception 交接已由客户最终纠正撤销；单一管理会话减少一次交接和重复上下文。推荐实施完整 v2：项目管理聊天、上下文选择、可确认计划、动态任务团队、受控执行与状态、专业桌面布局、必要内核/适配器变更，以及新 Node tarball 和 Windows ZIP 的独立审查验收。没有待选额外功能；本版未包含任意 Shell 或自动软件检查执行器。

风险及验证成本来自会话生命周期、取消晚到事件、一次性确认和上下文变更、凭据隔离及发行依赖。实际新版需要模型、适配器、桌面单元检查，真实 localhost 协议/完整流程、重启与原包兼容检查，以及实际 ZIP 解压启动及视觉验收。原 141 项或旧 GUI 的成绩不能代替这些新证据。

## 实施前精确冻结事项

这份 recommendation 不扩大现行 e72ba37… GUI v1 执行策略。客户确认后，Governance 应先展开独立精确 manifest、契约、任务 scope 与必要组织版本，再由 Supervisor 派发；旧历史证据不可覆盖。

- Desktop 使用实际 owner 最终 42 文件建议作为精确清单基线：`project` 和 `history` 各自 Service/Provider 三层，Workspace Service/Provider 共六文件，旧 desktop Model 可以保持不动。PM 早期 `project_store/conversation_history` 命名仅是已撤销的候选，不能当作已接受权限。
- PM 建议新有限 root façade `workbench.mjs`，并指出 `workbench-models` 除确认/authority 项之外还须具名导出调用方实际需要的 AgentConfig、AgentInstance、PiConnectionProfile、文本流/历史/checkpoint/工具结果等纯 Model。确切名称、导出文件、包版本与 caller 输入在治理 manifest/契约中 pin；禁止私有 helper 或 lower-layer 导出。
- Kernel 精确范围须包含 Storage 提交前的根路径、context SHA 与链接重查及相应测试；context digest 不能代替实时重查。
- 必要阶段顺序：Kernel → Adapter → PM 公共入口/新 tarball/desktop 依赖 → Desktop 工作台/UI → PM ZIP → Reviewer → Tester。各 owner 只写自己的精确文件，受影响调用方重新验证。

以上是实现清单冻结工作，不改变 canonical 的用户行为和已评审必要架构；若实际冻结发现新增行为或重大范围差异，需反馈真实差异，不能暗中扩大。

## 可呈现的预览及当前状态

设计交互预览已通过仅针对设计文件的本地浏览检查：唯一项目管理入口；确认后 PM 加两任务实例；成员只能查看任务详情；首次消息、停止与 AI 设置交互；浅/深色及 1024/736/360 宽度无溢出，零页面异常、零 AI 调用。这是示例原型检查，不是产品测试或新版 GUI 交付。

呈现时状态：**READY_FOR_CUSTOMER_REVIEW**，彼时尚未取得实施确认。

后续实际客户决定：客户在展示该同版方案、交互预览和明确实施问题之后直接回复“确认”。现在已取得同版实施授权，见 [客户确认](legion-desktop-workbench-v2-authorization.md)；默认采用其对话内选中的“专注对话”布局。该决定不改变以上原始 PM recommendation 和 canonical hash。
