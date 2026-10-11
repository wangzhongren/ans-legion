# UI 设计引用的现有接口

设计引用版本：`legion-ui-design-v2-grok`。本角色没有运行时 exports，也不新增 HTTP、SDK、IPC 或持久字段。正式契约与行为仍由 [DesktopEngineer API](../DesktopEngineer/api-spec.md) 和共享 Model 维护。本文件是界面实施索引。

## 真实入口与调用方向

生产入口 `apps/desktop/src/interface/main.mjs:startDesktop`；渲染层经 `preload.cjs` 暴露的冻结 `legionDesktop` 使用 `legion-desktop:<operation>` IPC。Interface 验证窗口、mainFrame、documentURL、字段后交 WorkbenchPipeline；Pipeline 调公开 Service，Service 调公开 Provider。原型不使用这些对象。

所有状态操作返回 `{ok:true,value}` 或 `{ok:false,error:{code,message,field}}`。失败显示固定安全消息并保留可重试输入；不显示私有 root、Key、授权对象、SDK 原始错误或 stack。

| 设计中的入口 | 现有操作与精确输入 | 结果或约束 |
| --- | --- | --- |
| 首次进入、后台状态更新 | `getState({})`；强制重查 `getState({force:true})` | WorkbenchDTO；轮询不抢焦点、不自动弹窗 |
| 选择项目文件夹、切换历史项目 | `chooseProject()` | 原生目录对话框→可信 root→`selectProject`；没有按 projectId 直接切换的 IPC。历史项提示重新选同一目录 |
| 刷新 | `refreshProject()` | 强制重新读取及 SHA 校验；保留表单、草稿、筛选和滚动 |
| 默认连接 | `setDefaultProfile({profileId})` | 变更旧计划绑定，旧执行撤销 |
| 新增/编辑连接 | `saveProfile({id?,name,protocol,provider,modelId,baseUrl,keyAction,apiKey?})` | 协议与 Key 动作见下表；保存成功才清空新 Key |
| 删除连接 | `deleteProfile({id})` | 删除及关联映射；保留现有确认步骤 |
| 当前项目成员的连接映射 | `assignProfile({roleId,profileId})`，profileId 可为 null | PM 或当前组织实际成员；现有 Renderer 只露出 PM 编辑，Pipeline 支持实际成员映射。本方案把既有映射集中到设置；不提供任意 roleId/成员创建 |
| 发送 | `sendMessage({projectId,roleId:'ProjectManager',text})` | 仅 PM；接受后仅清空已提交版本，失败留输入；活动 PM 轮次 running/waiting 或执行中不发送普通消息；已结束 PM 的待执行确认 draft 可补充需求，宿主先使旧计划/请求失效再重新讨论 |
| 固定计划上下文 | `selectContext({projectId,resources})` | 精确相对路径；空列表清除，16 个/单256KiB/共2MiB；变化使计划需重新确认 |
| 三类答复 | `answerInteraction({projectId,requestId,version,requestDigest,value})` | confirmation:boolean；choice:{optionId,text}；question:非空文本 |
| 稍后答复 / Esc | `closeInteraction({projectId,requestId,version,requestDigest})` | 只关闭展示，请求保持 pending；失败/过期不冒充关闭成功 |
| 确认执行 | 上述 `answerInteraction`，execute_plan 的 value=true | 宿主记录真实答案后内部调用 confirmPlanCore；按钮不先擅自调用独立确认 |
| 既有确认入口约束 | `confirmPlan({projectId,planDigest,requestId?,version?,requestDigest?})` | 实际授权要求当前 answered execute_plan 请求与匹配 nonce；无真实答复拒绝 |
| 停止回复 | `cancelTurn({projectId,turnId})` | 取消本轮，相关请求失效，会话可继续 |
| 停止任务 | `stopExecution({projectId})` | 入口先撤销该计划许可，等待收束；旧确认不能复用 |
| 测试已保存连接 | `testConnection({profileId})` | ProbeDTO；只证明固定短请求；不测试未保存草稿 |
| 取消连接测试 | `cancelProbe({probeId})` | null；测试运行时可取消 |

| 字段/公开数据 | 保持规则 |
| --- | --- |
| protocol | `openai-completions` / `openai-responses` / `anthropic-messages` |
| keyAction | `keep` / `replace` / `clear`，公开配置只返回 `hasSavedKey` |
| URL | HTTPS 或明确 localhost HTTP；拒绝 URL 凭据、query、fragment |
| timeline | legacyMessages 与 messages 按 host order；unknown 顺序有标记。不得用文本匹配答案或自造时间 |
| organization / proposals | 长期成员 revision/digest、候选台账与 PM 审阅；角色审批不产生文件写许可 |
| plan / tasks / fileOwners | 精确 writeSet、依赖、checks、accepts、maxRepairRounds、转交；不因摘要展示裁剪授权清单 |
| interactions | 三类持久队列，实际 status/version/digest；已答、拒绝、失效区分 |
| evidence / acceptances / repairs | 实际测试数/状态/输入版本/有限日志；原 owner、原 scope、原 checks、次数上限；Human 无直接 run-check 或任意返修调度 IPC |
| observation | 既有文件观察、cached/observedAt/verifiedAt/lastValidAt/来源错误；不表示成员在线 |
| cost / metadata | 未知保持 unknown；不得显示 0 元、预算、收益或估算 |

PM 通过控制工具调 RoleArchitect 提案与审阅、请求 Human 答复、请求原 owner 返修；独立 Acceptance 提交有当前证据的验收。界面提供查看和回 PM 讨论入口，不增加 Human 审阅角色或手动启动成员的快捷接口。原始完整 actualArgv 和私有授权对象不在公开投影内；界面只显示实际公开字段，不为高级详情绕过 IPC。

设计静态检查证据由 task_ops `design-deliverables` 记录：[v2任务](../../scheduling/legion-ui-productdesigner-v2-grok.md)。生产接口回归、真实连接和原生交互在后续 DesktopEngineer/Tester 实施任务中验证。

## v2 视觉重设计交接

v2只改变近黑画布、居中欢迎/输入、轻导航和详情/弹窗的层次与短过渡。使用相同操作、字段与状态；欢迎是空会话显示，不创建新thread、不清历史。停止/取消/绑定失效由宿主先处理，视觉退场不得延迟撤权。Grok公开首页只作气质与空间参考，没有真实网络连接或其账号/功能。v1证据保留在[旧任务](../../scheduling/legion-ui-productdesigner-v1.md)，不代表客户接受v1视觉，也不证明v2。
