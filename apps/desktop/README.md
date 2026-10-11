# Legion 工作台 0.2.0

Windows 完整 ZIP 经当前版本验证后，用户解压并双击 **LegionDesktop.exe**。Electron 和运行依赖随 ZIP 提供，不需要另装 Python 或 Node。请保留解压目录中的 resources、DLL 等文件；单独复制 exe 无法启动。当前 0.8.2 Shell runtime 更新的 Windows ZIP 尚未在 Windows 主机验证。

选择一个客户项目文件夹，然后到“AI 连接设置”添加连接并选择默认项目管理连接。返回“项目管理对话”，发送第一条消息后会建立或绑定此项目唯一的项目管理会话。文件夹不需要本仓库的 .ans、七个开发角色或任何初始化文件；应用数据目录与客户项目必须互不包含。选择目录本身不会调用模型，也不会写客户文件。

对话是默认工作区。任务、成员、上下文和来源放在按需展开的“任务详情”，AI 设置是次级页面；支持浅色、深色及最小 960×640 窗口。执行成员仅显示状态和任务，不能直接向其聊天或启动。

## 连接与对话

连接支持 OpenAI Chat Completions、OpenAI Responses、Anthropic Messages 三种明确协议。填入 provider 名称、自定义 model ID、HTTPS base URL（本地测试可用 localhost HTTP）和 API key。协议与 base URL 必须适配你的服务；provider/model 选择不是 HTTP/SOCKS 代理配置。未知模型能力、metadata 和费用保持 unknown，应用不会把 SDK 占位零值当报价。

密钥由主进程通过 Electron safeStorage / Windows DPAPI 在本机加密保存。输入框保存后清空，只显示是否已保存；可保留、替换或清除密钥。重启后在同一 Windows 用户与机器上解密使用，换机器需重新输入。加密不可用会明确失败，没有明文后备方式。

“测试”会向选定服务发一次无工具、有 token / 重试 / 总时限预算的真实请求，可取消。保存设置本身不会请求模型。发送消息、确认计划后的执行和点击连接测试会产生真实推理请求，可能按服务计费；本项目发行验证只使用 localhost 受控服务，付费调用为零。

## 确认范围后执行

项目管理使用真实 Pi 多轮会话澄清目标、返回文本与结构化方案。它可按需使用 `legion_list_files` 列出当前项目的普通目录，并用 `legion_read_file` 按行分段读取普通 UTF-8 文件；讨论期间没有写权限。文本、项目定义和历史仅保存在应用 userData，读取正文不写客户目录审计或持久历史。可停止当前回复，之后继续同一项目会话。

需要把重要文件固定到计划确认时，在详情中逐行指定精确相对路径并点击读取。最多16文件、单文件256KiB、总计2MiB；固定上下文不递归发现。内容与 SHA 绑定当前计划，变化要求重新读取并确认。模型自主读取的文件不会自动进入这份固定上下文，后续变化也不会自动撤销计划。

项目读取只限当前客户项目：控制目录（如 `.git`、`.ans`）、常见凭据文件、链接、越根路径、非普通文件、二进制和超预算文本会被拒绝。目录每页最多200项，文本每次最多64 KiB，每轮累计最多2 MiB；失败会返回明确原因。切换项目、取消或关闭会使旧读取请求失效。

检查结构化方案的角色、依赖、连接、精确文件列表及“本计划的文件归属”，再点击“确认以上计划及文件归属并执行”。同一文件只能属于一个角色；不同角色同时申领会被拒绝。同一角色的后续任务再次修改该文件时，需要明确依赖前一任务。归属保存在此项目的应用数据中，跨后续计划持续有效；旧项目的历史文件不会被自动认领。若要交给另一角色，新计划会逐项显示文件、旧角色和新角色，等待你确认后才转交。文件即使被外部删除，原归属仍保留。

宿主验证整个 DAG、固定上下文、项目归属和版本后，才建立一次性确认及受控 Agent 实例。执行成员可读取当前项目允许读取的普通文件；写入只限本任务确认的精确 `writeSet`。`legion_write_file` 可写完整文件；`legion_edit_file` 可对已有普通 UTF-8 文件做局部编辑，必须提交读取时得到的完整文件 SHA-256 和最多16组文本替换。旧SHA、缺失或重复匹配、越权路径会拒绝整次编辑，不部分修改。两种写入都经过 Kernel Policy / Mutation / Storage 权限和审计链；读操作不产生写许可。没有默认 SDK 文件/编辑/Shell 工具、插件发现或任意 Shell。确认后会在客户目录生成 Kernel `.ans` 审计；这是执行的明确效果，不复制开发组织。

“停止当前执行”、关闭、切换项目或更改连接/范围会撤销旧确认并等待本次资源结束。成功写入、拒绝、缺少目标、审计失败与取消分别显示；任务写了测试文件也不表示运行过测试。软件检查在实际执行前显示“未运行（not_executed）”，批准的检查运行后显示真实通过、失败、取消、不支持、过期或错误；仅当前证据通过并完成独立验收才可交付。重启恢复文本和记录，将原运行标为 interrupted，不自动重放确认或调用模型。

详情中的治理、任务与审计是实际文件记录，独立于当前 Agent 在线状态。任务记录读取上限16MiB、4096事件、本轮64MiB，完整验证后才缓存并记录观察/验证时间；force 刷新重新验证。缺损、预算超限和未知格式显示来源不可用，保留快照会标过期，不宣称文件损坏或任务业务失败。

## 本地开发与验证

从仓库根目录运行：

```powershell
npm --prefix apps/desktop start
npm --prefix apps/desktop test --ignore-scripts
npm --prefix apps/desktop run make --ignore-scripts
node --test apps/desktop/tests/package/desktop-package.test.mjs
```

公开 test 固定20模块串行运行，包含原13模块及组织/交互/验收4项单元、工作流边界、工作流集成与UI模块；阶段尚未全部验收时不能把单阶段结果当全套通过。root npm test 是独立的 Node26模块回归，包含三项Check单元、受控工具与Check集成。当前 macOS 包检查验证实际安装的依赖、runtime 公共入口和源码身份；Windows ZIP 检查只在 Windows 执行，仍须验证真实 ZIP、窗口与 DPAPI。

固定 Electron44.6.0、Forge8.0.1、Playwright1.63.0、两个 Pi SDK1.0.4。生产依赖使用新阶段46文件本地 tarball 的 legion-runtime0.8.2，包含44个实际 .mjs 源文件，提供62个具名工作台 Model/纯函数及 Shell Service 子路径；Desktop 通过公共 subpath 调用，无开发树相对 imports 或 symlink。当前 macOS arm64 已安装 Electron 二进制，不能代替 Windows archive 与 ZIP 验证。

Windows ZIP 目标路径：
`.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging/LegionDesktop-0.2.0-win32-x64.zip`。
当前 0.8.2 更新尚无已验证的 Windows ZIP 或对应的 desktop-package.json。Windows 主机运行 make 和严格包检查后，才可依据当前绝对路径、SHA、bytes 和源码证据交付。该检查须实际解压、运行 exe、操作两页面、浅深色/最小窗口、三协议连接、PM计划确认/归属转交/受控写与编辑/停止、DPAPI保存重启与 renderer 隔离，并守卫清理本次临时目录。独立 Reviewer/Tester 仍须完成验收。

旧0.1观察原型 ZIP、0.3核心 tarball、历史失败和缓存保持只读；它们不代表此工作台目标完成。未向 registry 发布。当前设计与接口见 [工作台设计](../../docs/design/2026-10-07_design_desktop-workbench-v2.md) 和 [Desktop API](../../docs/roles/DesktopEngineer/api-spec.md)。

## runtime 0.8.2 package bridge integration

The desktop dependency now points to the actual local 0.8.2 tarball in `.ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/packaging/bridge-v3/`. Installation uses npm with `--ignore-scripts` and preserves the existing official Electron 44.6.0 binary; skipping scripts does not install an Electron binary. Package verification checks lock integrity, all 46 package files, 44 .mjs source hashes, 62 named Model exports and eight public Service/Model subpaths. On macOS it additionally runs CheckService under the real Electron Node host with the same isolated process execution used in production.

The runtime check/control contracts and SDK tools are implemented. Desktop connects persistent organization, interaction and acceptance Services, the Workbench Pipeline and governance UI. An approved execution can invoke actual checks and retains their observed status. The current architect diagnostic repair and independent integration/UI verification are pending; package smoke proves only the installed runtime and its Electron executor scenarios. Windows ZIP and native Windows flows require separate platform evidence.

The first check executor accepts approved Node tests on macOS, fixes test isolation to none and denies child processes. Tests that launch another process cannot run under this capability; other platforms return unsupported rather than a passing result.

The current reporter uses a fresh run key delivered only through initialization, authenticated frames and increasing sequence numbers; directly writing JSON to fd 3 is rejected. Captured methods and fixed stream entry points cover the tested replacement scenarios. A fixed Node permission mode adds restrictions on inspector, native addons, workers and process.binding; Seatbelt remains responsible for actual filesystem, network and process isolation. Tests requiring those APIs or replacing fixed stream entry points are outside this mode. Candidate code and reporter still share a JavaScript process, so this is limited verification of the documented cases, with no general tamper proof guarantee for arbitrary hostile JavaScript. Approved test inputs and coverage still require review and independent acceptance. The Electron package smoke verifies a normal test with the actual permission flags, API restrictions and rejection of direct fd3 forgery.

The executor passes its fixed permission options explicitly in argv: `--permission --allow-fs-read=* --allow-fs-write=* --allow-child-process`, followed by `--test-isolation=none`, the fixed reporter and approved test arguments. `NODE_OPTIONS` is neither set nor inherited. This allows Electron hosts that ignore that environment variable to apply the same restrictions. The filesystem and child process API grants still defer actual effects to Seatbelt; no arbitrary command options are accepted.

当前conversation宿主预算默认及最大为输出8192、累计模型活动180000ms，调用方只能缩小。原60秒真实 `pi_turn_timeout` 后由Adapter owner必要修复；等待Human/读取/检查等host工具暂停计时，回应只恢复剩余预算，取消仍立即中止请求。8192不代表已核实的供应商能力，未知模型能力与价格保持unknown。0.8.2新版本本地包真实安装后，新桌面进程才消费本次修复；完整交互、纯对话和独立UI验收另见当前任务结果。


## 项目 Shell 包桥及后续接线

本阶段只交付新的真实 runtime 包、公共契约和安装身份，不把包 smoke 当作新 PM 审批界面或完整 SSH 项目验收。下一 Desktop 阶段使用 `legion-runtime/services/shell`，PM 独立审核队列必须保持原 active run，审批、执行、发布结果回到原角色同一个 pending 请求；不并发复用 PM SDK session，不恢复旧许可。

Host 必须提供已存在的私有物理 `lockRoot`，同项目 Shell/Check 共用；`artifactScopes` 从 Human 已确认计划推导，授权包含完整 fileOwners 和 authoredResources 库存。生成 node_modules/dist 不赋予角色永久源码目录权限。源码通过原角色 Mutation 受控发布，二进制由 Host-only `readCandidateData` 读取，正文、opaque receipt 和 permit 不进入 SDK、renderer 或历史。安全执行位和删除墓碑纳入实际交付。部分发布与依赖 generation 变化失效相关检查证据。

macOS Shell 需要本机 CLT clang/SDK，私有 native supervisor 只编译到角色运行目录；缺失或安全探针失败返回 unsupported，不全局安装工具、不裸 Shell 降级。进程追踪采用私有 canary 的权限签名，不是内核 sandbox 对象 ID；可信 Host 或同 OS 用户在沙箱外故意 clone profile 不在该信任边界内。Windows 目前不支持该 Shell 后端，旧 ZIP 与本机结果不证明 Windows 支持。

每次 Shell 调用批准完整命令及继承隔离的子进程，默认断网，localhost/外网逐次审批；不承诺域名隔离。禁止全局安装、sudo、控制目录和凭据读取。退出码0不表示自测或独立验收通过，原 `legion_run_check` 和 Acceptance 保留。完整 GUI/旧 SSH app 的继续开发由后续独立验收记录。


### 0.8.1依赖读取修复（0.8.2继续保留）

`artifactScopes` 中固定 `kind: dependencies` 的目录属于受验证输入，不必为了使用已有 `.bin` 工具而加入本条输出申请。Host 原样使用 `prepare` 的 inputVersions/snapshotDigest/generationDigest；该 generation 覆盖固定读取依赖和本条获准输出，不自行仅计算 dist。只请求 dist 时只发布 dist，node_modules 的内容、链接、执行位或目录发生改变会拒绝整批；审批后的真实输入或同字节链接重定向使旧批准过期。新安装包使用 bridge-v3，原 bridge-v1 的0.8.0与全部证据保留。


### 0.8.2 Host时间事实接线

Shell/Mutation Service 的 `observeTime()` 从相邻Provider取得新的safe epoch毫秒事实，纯Model只比较数据，不查询时钟或接受clock callback。每项源码proposal调用 `controller.issueShellPublication(proposal, receipt, shell.observeTime())`；不能整批缓存旧时间。Storage在consume/recheck及真正create/replace/delete前继续重新观察，过期、无效/回退事实、abort和replay均拒绝。SDK/renderer/历史没有新的clock字段，factory与62项具名导出不变。当前包测试Host caller已接线；实际Desktop Pipeline由后继原owner按新签名修复，包桥不冒称其完整UI新候选已验证。新包bridge-v3，0.8.0/0.8.1与final旧证据归档保持。
