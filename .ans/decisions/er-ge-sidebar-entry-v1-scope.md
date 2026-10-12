# 二哥侧栏主入口分组：已评审方案 v1

固定PM根据客户参考图准备，DesktopEngineer独立只读评审已吸收。此方案冻结供精确实施配置绑定；当前尚待真人接受，不代表布局已实施。

### 待实施：侧栏二哥主入口分组（2026-10-12，draft v1）

**管理评审：推荐确认后实施。** DesktopEngineer独立只读复核确认D6覆盖现有实现与两个导航/焦点分支，无新增路径。 按客户参考图，左侧保留角色列表，分为“主入口”和“其他角色（查看/调试）”。这是当前项目侧栏的Interface调整，尚未实现；本draft与精确配置须Human一次确认后才派发。已完成二哥改名、现有连续对话和运行权限保持。

“主入口”仅放当前项目`Supervisor`对应的**二哥卡片**，视觉突出，显示“内置”标识和真实状态。状态来自Host已有`getState.roles[].activity`和turn/plan/pending：空项目“选择项目”、无计划“待讨论”、当前draft确认才“等待你确认”、waiting才“等待你的答复”，执行中标真实工作/只读对话；不把无计划误报待确认，不编造进度百分比。原孤立“对话”导航与卡片合为一个主入口，避免两个重复入口；点击二哥选择当前项目conversation和conversation工作区，当前旧`conversation-nav`只navigate，必须同时`selectZone('conversation')`才能从900项目/角色区真正回chat；关闭导航后焦点进入可用客户输入框，未选项目或输入disabled时落可用“选择项目/连接”CTA，不能指向隐藏或禁用输入。点击不启动新模型轮或新会话。

“其他角色（查看/调试）”排除Supervisor，沿当前组织列真实角色名称、职责短摘要与状态，视觉次级；不把参考图的测试者/规划者/实现者写死为项目角色。点击继续原`selectedRoleId → roles zone → refreshRoleZone`，不调用sendMessage，沿现有角色资料、运行区与安全行动日志查看，不新增直聊、原始私有消息、跨项目聊天、另一主页或Host。206/190px侧栏与900抽屉采用两行职责截断并用title保留完整说明，现有项目选择、AI连接、主题和900导航继续可达，状态需区分二哥对话与角色查看；设置页不能误标主卡选中。

未选项目时主卡显示“先选择项目”并禁用；当前项目缺Supervisor时明确“入口不可用”，不伪造内置角色。轮询复用稳定节点并只更新真实状态，不丢未发输入、问题草稿、滚动或焦点；角色查看后回二哥仍是原连续历史与输入。键盘可达、主卡aria-current/选择态准确，900导航Escape仍按既有规则归还焦点。

| owner | 精确文件 |
| --- | --- |
| DesktopEngineer（6） | `apps/desktop/src/interface/index.html`；`apps/desktop/src/interface/renderer.mjs`；`apps/desktop/src/interface/styles.css`；`apps/desktop/tests/unit/pipeline.test.mjs`；`apps/desktop/tests/unit/ipc.test.mjs`；`docs/roles/DesktopEngineer/docs/feature/desktop-console.md` |
| Tester（1） | `apps/desktop/tests/e2e/governed-workflow-ui.test.mjs` |

固定检查全部从仓库根执行：Desktop `node --test --test-concurrency=1 apps/desktop/tests/unit/pipeline.test.mjs apps/desktop/tests/unit/ipc.test.mjs`；独立Tester `node --test --test-concurrency=1 apps/desktop/tests/e2e/governed-workflow-ui.test.mjs`。保留现有Mac完整工作流与布局两用例，新增真实分组/唯一主卡/其它角色只查看、二哥回原chat、900键盘/主题及轮询草稿焦点断言。宽屏及900深浅主题真实Electron窗口逐图核验，不用静态原型或DOM隐藏替代；Windows/付费远端不计通过。Desktop完成后Tester验当前Interface候选；失败原owner必要修复，不扩功能或降低断言。

三份Interface不在Node包闭包，本次**不改Host/Model/IPC能力、版本/manifest/lock、README或冻结runtime1.2.3 tar**，不重包、不发布/推送；验收绑定当前Interface源码及同一冻结包。主要风险是错误选择态/误进入角色区或轮询丢输入，由上述分支与真实窗口断言验证。无待选增强；阶段目前仅文档准备，不宣称新布局已完成。

