# DesktopEngineer 当前公开接线

当前桌面使用唯一 WorkbenchPipeline，落实 [v2 canonical](../../design/2026-10-07_design_desktop-workbench-v2.md)、[客户确认](../../../.ans/decisions/legion-desktop-workbench-v2-authorization.md)与 [本角色能力设计](docs/design/2026-10-07_design_desktop-workbench-v2.md)。已核验的能力输出保持冻结；Interface 只调用 Pipeline 和纯 Model，不直接调用 Service、Provider、Kernel Interface 或 PermissionRuntime。

## 启动与关闭

ProjectManager 根入口调用 `apps/desktop/src/interface/main.mjs`：

```js
startDesktop({ userDataDir, initialWorkspace, show })
// Promise<{ readiness: { ready: true, windowId: number },
//   close: () => Promise<{ closed: boolean, error: SafeError | null }> }>
```

三个选项均可省略，目录必须为主进程可信绝对路径，show 为 boolean（默认显示）。导入无启动副作用；重复启动或启动期间重复调用拒绝。根入口用异步 bootstrap 或 then/catch 完成模块求值，避免入口顶层 await 等待 Electron app.whenReady。readiness 在窗口加载与 IPC 注册后返回。根入口拥有 app.quit、进程信号和退出状态。

Interface close 幂等返回同一 Promise，在入口立即调用 Pipeline close 撤权，移除自己的 IPC，等待 SDK/审计及下层资源，再移除窗口监听并销毁自己的窗口。窗口 close 先阻止直接销毁，沿此关闭路径收束；不关闭无关窗口或进程。部分启动失败同样关闭已创建资源。initialWorkspace 为可选启动选取，其失败留在安全状态，Renderer 不能提供根路径。

窗口启用 nodeIntegration:false、contextIsolation:true、sandbox:true、webviewTag:false，固定 .cjs preload；拒绝新窗口、非本地文档导航与 webview。CSP 限本地脚本/样式，connect/frame/object 为 none。模型、来源和错误只用 textContent 展示。

## 固定 IPC

preload 的 `window.legionDesktop` 只有以下 14 个具名操作，通道固定 `legion-desktop:`；无通用 invoke、事件订阅、Node、Shell 或文件路径接口。main 校验精确 webContents、主 frame 对象、当前本地文档 URL 和输入白名单后才进入 Pipeline。chooseProject 原生对话框返回后再次核对来源。

| 操作 | 输入 | 成功 value |
| --- | --- | --- |
| getState | {} 或 {force:boolean} | WorkbenchDTO |
| chooseProject | {}，主进程原生目录选择；取消保留当前项目 | WorkbenchDTO |
| refreshProject | {}，强制读取并验证 SHA | WorkbenchDTO |
| setDefaultProfile | {profileId} | WorkbenchDTO |
| saveProfile | {id?,name,protocol,provider,modelId,baseUrl,keyAction,apiKey?} | WorkbenchDTO |
| deleteProfile | {id} | WorkbenchDTO |
| assignProfile | {roleId,profileId:string|null}；当前 UI 仅编辑 PM 映射 | WorkbenchDTO |
| sendMessage | {projectId,roleId:"ProjectManager",text} | WorkbenchDTO |
| selectContext | {projectId,resources:string[]}；Human 明确相对路径，[] 清除 | WorkbenchDTO |
| confirmPlan | {projectId,planDigest}；不接受 Renderer 自带 plan/tools/writeSet/grant | WorkbenchDTO |
| cancelTurn | {projectId,turnId} | WorkbenchDTO |
| stopExecution | {projectId} | WorkbenchDTO |
| testConnection | {profileId} | ProbeDTO |
| cancelProbe | {probeId} | null |

Result 为 `{ok:true,value}` 或 `{ok:false,error:{code,message,field}}`。main 重建有限 DTO 与固定错误，移除额外字段、私有根/identity、SDK/key 原文和 stack。未知操作、未知字段、非 PM 直接 chat、任意 agent start、路径穿越、伪 frame 或另一窗口拒绝。输入规范化不能签发权限。

## Pipeline 与相邻层

`src/pipelines/workbench.mjs` 的 `createWorkbenchPipeline({userDataDir})` 为 Interface 公开 15 方法：上述 14 个操作中的 chooseProject 改为 `selectProject(trustedRoot)`，并增加 `close()`。其余参数同 IPC；refreshProject 无参数。生产工厂只收普通选项，不收 Service 实例、SDK 或上层业务 callback。getState、保存与项目变更受队列约束，停止执行/关闭对正确当前项目在入口同步撤权，覆盖尚未创建 active 的确认等待竞态。

| public Service | Pipeline 使用的能力 |
| --- | --- |
| createProjectService({userDataDir}) | catalog、select、saveProject、setDefaultProfile、readContext、newId、now、close |
| createHistoryService({userDataDir}) | load、save、close；仅 typed user/assistant 历史 |
| createProfilesService({userDataDir,probeTimeoutMs?}) | list、save、delete、assign、resolveConnection、testConnection、cancelProbe、getProbeState、close |
| createWorkspaceService({workspaceRoot}) | refresh（旧 WorkspaceDTO）、observe（v2 来源时间）、state、close |

Service 只调用自己的 public Provider 与纯 Model。Project/History Provider 保存于 userData 并按真实 project/session 隔离；Project Provider 接受品牌 readAuthorization 和有限 binding，通过 assertForRead 静态能力校验，不持上层 controller。Settings/Probe 继续原固定公开接口；resolveConnection 主进程调用既有 Settings read/decryptKey，生成 stable profileVersion、无 key 的 PiConnectionProfile 与单独 credentials，均不出 Renderer。

Kernel/Adapter 只通过实际安装 0.4.0 包公开 `legion-runtime/services/{policy,mutation,proposal,pi-agent}`、`legion-runtime/workbench-models` 组合。没有开发树跨包相对导入。测试内部 _Renderer、_validateIpcRequest、_dispatchDesktopIpc 只用于当前层聚焦测试，不作生产注入入口。

## 有限 DTO 和绑定

WorkbenchDTO 字段为 profiles、assignments、defaultProfileId、projects、currentProject、roles、history、turn、plan、tasks、context、observation、probe、error。currentProject 为 {id,name,organizationVersion,hasManager}；ID 从真实目录身份稳定派生，DTO 不含 canonicalPath/dev/ino。roles 是客户动态团队（最多 32 个执行角色及 PM），不复制 Legion 七角色。ProfileDTO 只有 id/name/protocol/provider/modelId/baseUrl/hasSavedKey；映射不改变权限。

PM 的内部唯一 fenced plan 数据为：
```js
{ goal, roles: [{ id, name, purpose, profileId }],
  tasks: [{ id, title, roleId, profileId, dependsOn, writeSet, instruction }] }
```
宿主拒绝未知字段、非法角色/连接/路径、重复任务、缺失依赖和环；绑定 projectId、organizationVersion、revision、各角色 profileVersion、contextSnapshotDigest 后计算 planDigest。Human 确认当前 digest 且全部重验通过才建立各任务 authority，PM 文本不授权。任何对应 verificationFailure 使整份已确认计划失效，包含独立待运行任务。旧 SHA 恢复不复活许可。

任务有限状态为 pending/running/completed/failed/blocked/cancelled/interrupted，计划还含 draft/confirmed/invalidated。task results 独立反映真实 resource/success/observedMutation/auditFailed，软件检查固定 not_executed。只有所有精确目标实际成功写入才显示目标完成；SDK terminal completed 不能替代此判断。上限：项目64、执行角色32、任务64、单任务文件64；项目 JSON 4MiB、历史 JSON 8MiB，历史最多256条、单条65536字符、总2097152字符。历史不恢复 permission、pending、活动运行或 credentials，重启旧 running 转 interrupted。

context 为 resources 对应的有限描述（resource、byteLength、SHA 与 verifiedAt），最多16文件、单256KiB、总2MiB，严格 UTF-8。客户/userData 重合、祖先关系、链接/junction别名、越界组件或读取前后身份变化拒绝；没有任意 recursivefs。上下文正文只供当轮模型，不入历史或 DTO。

observation 与客户团队/执行结果分开，保留治理、task_ops 阶段和已有审计，不声称在线。支持 schema_version1 受控 YAML 根 scalar/flow collection、两空格 flow-map 列表、最多3层；有界字符串/布尔/安全十进制整数/null，拒绝未知/重复键、锚点、别名、tag、directive、多行和任意对象。实际 project/current/role/boundary 的版本一致与 ACCEPTED 状态必须通过，已知 v003 GUI/v004 workbench 边界校验。

task_ops Markdown 完整校验 hash-chain 与 human render，最多16MiB/4096events；本轮读64MiB。治理 snake reference-index 仅受控日文件/有界行，Core camel full-index 校验日镜像；版本不匹配不可用。已验证来源身份/mtime/size不变时可缓存，Source 增加 observedAt、verifiedAt、cached，保留文件时间与错误；手动强制读取/SHA。缺失、未知、损坏、链接、超限明确 source 不可用，旧有效数据保留时标过期。时间支持既有 PowerShell 七位小数。观察上的组织接受、任务 verified 和审计 completed 互不推导。

ProbeDTO 为 {id,profileId,status,startedAt,finishedAt,latencyMs,error}。三个固定 Pi AI 1.0.4 协议先 normalizeContext 后 streamSimple(...).result()，无 tools、≤16输出token、零重试、总截止时间及 error/aborted stopReason 检查。只由用户测试/聊天/确认动作触发出站模型请求；没有入站 HTTP 服务或任意 provider/module 路由。费用/未知模型 metadata 保持 unknown。

## 当前验证和调用方隔离

能力层正式六 suite 47/47、零失败/跳过已由 Supervisor 核验，包含真实固定 SDK localhost 多轮、实际 Windows FS/品牌/写入、缓存/大记录和撤权竞态。当前 Interface 用 `node --test --test-concurrency=1 apps/desktop/tests/unit/pipeline.test.mjs apps/desktop/tests/unit/ipc.test.mjs` 运行7个有限用例：真实公开 Pipeline 选目录、聚焦 DOM 替身的轮询草稿/焦点/切项目/worker详情，以及 IPC 映射与安全投影、启动静态边界。正式当前候选证据见 [调度记录](../../scheduling/legion-desktop-workbench-v2.md)。

当前两 Interface suite 及新任务中已核验的五个能力效果 suite 用 LEGION_DESKTOP_TEST_ROLE=DesktopEngineer|ProjectManager|Reviewer|Tester，默认 DesktopEngineer；通过 import.meta 定位项目根。DesktopEngineer 生成于本版 DesktopEngineer/{fixtures,user-data,tmp}，其余角色生成于各自 role/desktop/{fixtures,user-data,tmp}；IPC suite 本身无生成效果。五个能力测试修复已在独立有限节点再次完整47/47并经 Supervisor 核验；Interface 本阶段不改其冻结产物。本候选正式 Interface 结果见 [当前调度记录](../../scheduling/legion-desktop-workbench-v2-fixture-repair.md)；原任务记录保留历史。

DOM 与加密替身不证明原生窗口或 Windows DPAPI。本阶段未运行 v2 原生 Electron/DPAPI 重启/ZIP；其验证与最终独立后验由下游实际执行。旧 GUI v1 smoke 只保留历史事实，不能充当 v2 产品证据。

