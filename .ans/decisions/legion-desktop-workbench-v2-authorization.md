# Legion 桌面工作台 v2 实施确认

日期：2026-10-07，Asia/Shanghai。授权来自本聊天中的客户直接回复，不是模型消息、原型按钮、hash 或管理推荐。

客户最终要求唯一“项目管理”Agent。已向客户展示可操作预览，并链接管理已评审的 v2 canonical，明确首次消息建立管理会话、同一会话讨论/确认/汇报、确认后动态创建执行 Agent，其他成员只读任务与状态；也说明实施包含聊天界面、Pi 多轮会话、受控执行和 Windows 打包。

客户在这份实施请求后直接回复：**确认**。这是该文档及必要实施范围的确认，无需再询问同版权限。

- 版本：`legion-desktop-workbench-v2`。
- Canonical：`docs/design/2026-10-07_design_desktop-workbench-v2.md`。
- SHA256：`715639b5dd278437059f29bde1e7c02ac90d94af18f9bf5a6b5367d16e9ab5d3`。
- 固定 PM 的真实同版 recommend approval：[评审记录](legion-desktop-workbench-v2-review.md)。
- 界面选择：客户在对话内选择 **专注对话** 预览；据此采用该默认布局，任务/文件范围/状态按需展开，保留同一管理会话。

授权必要的 Kernel 共享 Model、Policy 与 Storage 上下文重查、Adapter 多轮与纯数据连接、Desktop 工作台/上下文/历史/专业界面、有限 npm 公开入口/新 Node tarball/desktop 实际依赖安装、新 Windows ZIP、独立 Reviewer/Tester 与影响回归；精确文件及 checks 在本阶段独立 manifest/配置/角色边界中展开。旧 Core 的“GUI v1只读”限制在这些必要精确文件上由本次授权取代，其余文件与历史产物保持只读。

沿用七个固定开发角色及原独立上下文，不把它们当作客户项目的动态组织。唯一调度仍由 Supervisor 承担；ANS Governance 只写控制面与总体设计，不写产品、测试或构建源码，不代跑产品验证。

执行边界：讨论阶段无项目写权限且不写客户目录审计；Human 确认精确计划后按任务绑定工作空间、版本、上下文 SHA、连接、角色与文件清单；受控写入、取消、重启与晚到事件均须实际验证。本版未授权任意 Shell/自动软件检查执行器，未运行检查显示 not_executed。旧 requiredApprovals 及 .ans 控制面拒绝保持有效。

允许 PM 在项目范围生成/安装实际新本地 tarball 和必要生产依赖、复用固定 Pi 1.0.4 与现有 Electron/Forge/Playwright，执行必要的官方 Electron 安装脚本，形成新版 ZIP。实际检查可创建 localhost 受控协议端点、隔离 userData/fixtures、启动并关闭本次跟踪的 Electron/Chrome/子进程；按角色使用独立本阶段生成目录。不得全局安装、修改全局 Pi 配置、发布注册表/网络包、删除客户文件或覆盖旧阶段产物。

实现与测试结果尚待实际产生；本记录只证明本次客户实施授权。
