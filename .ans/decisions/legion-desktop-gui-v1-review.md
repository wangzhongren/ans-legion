# Legion Desktop GUI v1：提案评审

日期：2026-10-07。状态：RECOMMEND_APPROVAL / HUMAN_IMPLEMENTATION_CONFIRMATION_PENDING。

客户新增目标为“GUI，桌面程序，能配置AI配置，能看到角色和状态”。本轮完成可审阅的整体方案和原固定角色只读评估；尚未建立桌面应用、安装依赖或执行GUI测试。

## 评审版本与结论

canonical：[2026-10-07_design_desktop-gui-v1.md](../../docs/design/2026-10-07_design_desktop-gui-v1.md)。版本legion-desktop-gui-v1，SHA256 `58c79cae70bc45dcdda038e0e7944883dbee3ecfb2e277664a5954c3ec6a398d`。原固定Supervisor安排各原角色只读评估并汇总给ProjectManager；管理对实际同版设计正式给出 **recommend approval**，无必须修改本版的阻塞发现。

| 角色 | 实际评估结果 |
| --- | --- |
| ProjectManager | 推荐Electron与普通HTML/ESM及独立apps/desktop包；首版三页、连接测试与只读状态满足新增目标，避免Desktop Pipeline上调现有Kernel Interface。任务启动/取消另列O1，未选择 |
| KernelEngineer | 首版不改Kernel/API；治理index引用与运行Event镜像不是同一格式；ACCEPTED/verified不证明Agent在线；角色连接映射不改变权限 |
| AgentAdapterEngineer | 已安装Pi AI1.0.4的公开api/openai-completions、openai-responses、anthropic-messages支持streamSimple及自定义modelID/BaseURL，无需Adapter修改；由Desktop自身Probe Provider承担无工具短探测 |
| Reviewer | 同版推荐，无阻断修订；兑现主frame/窗口IPC校验、主进程项目句柄、凭据不回显、双记录格式与unavailable/时间投影边界 |
| Tester | 同版有限验收足够；须未来实际验证Windows窗口三页、DPAPI重启解密、受控HTTP三协议请求和ZIP解压启动；测试不能跳过或用明文回退 |

管理比较后推荐首版独立配置与观察面板。完整GUI任务控制需要新的Kernel编排/实时状态公开契约，会扩大本版源码与回归成本；O1收益和成本保留在canonical，未因默认推荐而选中。其他前端框架、额外数据库或新的调度引擎不属于本版必需实现。

## 实施约束与待确认范围

确认本版后，Governance才能按候选文件展开唯一owner、DesktopEngineer候选角色、源码/文档清单、测试和生成权限，冻结新阶段组织与配置；Supervisor据该版本派发实现。ProjectManager负责桌面依赖、入口与Windows发行，DesktopEngineer负责GUI与配置/观察能力，Reviewer/Tester独立验收。Kernel/Adapter原文件、根Node包与公开API保持。

Probe实现使用公开normalizeContext以及固定协议streamSimple(...).result()，不用不存在的completeSimple。协议决定固定入口，provider显示名不能变成任意模块导入。短探测Model元数据不宣称真实模型能力或价格；tools为空，限制maxTokens、禁重试并设置总Abort截止；检查stopReason的error/aborted，返回安全DTO，不把原始SDK响应/异常或密钥送入renderer。

Windows进程启动、窗口操作与视觉证据、safeStorage本机保存/退出重启/解密、测试本地HTTP服务和进程清理需在执行前明确实际owner与隔离目录。npm-cache/packaging归ProjectManager；不同测试角色的fixtures/userData/进程证据使用独立子目录，不能把canonical候选生成目录解读为共享写权限。此刻未把未来环境能力当作已通过。

GUI的连接配置和角色映射是桌面保存设置，外部CLI不会自动读取；首版显示现有任务/审计记录及时间，不派发任务、不宣称进程在线。O1仍PENDING，确认首版不选择O1。

## 当前证据与授权区别

根Governance实际复核canonical摘要，以及现有v3执行配置、总体设计、package/lock和tarball摘要；均保持原值。apps/desktop尚不存在。本轮产出仅整体设计和本评审记录；原141测试、Node发行包与其验证历史不被算作GUI证据。

管理推荐不等于客户授权，也不等于GUI通过。需客户确认上面的具体版本并指示实施。来源为已沿用的 [ans-governed-construction SKILL.md](C:/Users/MLoong/.codex/skills/ans-governed-construction/SKILL.md)：

> Do not change application code or tests until the customer confirms that document and instructs implementation based on it.

旧Node/Pi v3开发确认没有覆盖本版新增桌面角色、源码与持久化行为；本阶段不重复旧版审批，只请求新增GUI v1的实施确认。
