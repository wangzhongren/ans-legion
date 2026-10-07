# Legion 工作台 0.2.0

Windows 用户解压完整 ZIP 后双击 **LegionDesktop.exe**。Electron 和运行依赖已包含，不需要另装 Python 或 Node。请保留解压目录中的 resources、DLL 等文件；单独复制 exe 无法启动。

选择一个客户项目文件夹，然后到“AI 连接设置”添加连接并选择默认项目管理连接。返回“项目管理对话”，发送第一条消息后会建立或绑定此项目唯一的项目管理会话。文件夹不需要本仓库的 .ans、七个开发角色或任何初始化文件；应用数据目录与客户项目必须互不包含。选择目录本身不会调用模型，也不会写客户文件。

对话是默认工作区。任务、成员、上下文和来源放在按需展开的“任务详情”，AI 设置是次级页面；支持浅色、深色及最小 960×640 窗口。执行成员仅显示状态和任务，不能直接向其聊天或启动。

## 连接与对话

连接支持 OpenAI Chat Completions、OpenAI Responses、Anthropic Messages 三种明确协议。填入 provider 名称、自定义 model ID、HTTPS base URL（本地测试可用 localhost HTTP）和 API key。协议与 base URL 必须适配你的服务；provider/model 选择不是 HTTP/SOCKS 代理配置。未知模型能力、metadata 和费用保持 unknown，应用不会把 SDK 占位零值当报价。

密钥由主进程通过 Electron safeStorage / Windows DPAPI 在本机加密保存。输入框保存后清空，只显示是否已保存；可保留、替换或清除密钥。重启后在同一 Windows 用户与机器上解密使用，换机器需重新输入。加密不可用会明确失败，没有明文后备方式。

“测试”会向选定服务发一次无工具、有 token / 重试 / 总时限预算的真实请求，可取消。保存设置本身不会请求模型。发送消息、确认计划后的执行和点击连接测试会产生真实推理请求，可能按服务计费；本项目发行验证只使用 localhost 受控服务，付费调用为零。

## 确认范围后执行

项目管理使用真实 Pi 多轮会话澄清目标、返回文本与结构化方案。讨论工具和写范围均为空，文本、项目定义和历史仅保存在应用 userData，不在客户目录写审计。可停止当前回复，之后继续同一项目会话。

需要参考文件时，在详情中逐行指定精确相对路径并点击读取。最多16文件、单文件256KiB、总计2MiB；无递归发现。内容与 SHA 绑定当前计划，变化要求重新读取并确认。

检查结构化方案的角色、依赖、连接与精确文件列表，点击“确认以上计划并执行”。宿主验证整个 DAG、上下文和版本，才建立一次性确认及受控 Agent 实例。执行只使用 legion_write_file，经 Kernel Policy / Mutation / Storage 权限和审计链；没有默认 read/edit/bash、插件发现或任意 shell。确认后会在客户目录生成 Kernel .ans 审计；这是执行的明确效果，不复制开发组织。

“停止当前执行”、关闭、切换项目或更改连接/范围会撤销旧确认并等待本次资源结束。成功写入、拒绝、缺少目标、审计失败与取消分别显示；任务写了测试文件也不表示运行过测试。软件检查始终显示“未运行（not_executed）”，直到存在实际执行器证据，本版本不包含该执行器。重启恢复文本和记录，将原运行标为 interrupted，不自动重放确认或调用模型。

详情中的治理、任务与审计是实际文件记录，独立于当前 Agent 在线状态。任务记录读取上限16MiB、4096事件、本轮64MiB，完整验证后才缓存并记录观察/验证时间；force 刷新重新验证。缺损、预算超限和未知格式显示来源不可用，保留快照会标过期，不宣称文件损坏或任务业务失败。

## 本地开发与验证

从仓库根目录运行：

```powershell
npm --prefix apps/desktop start
npm --prefix apps/desktop test --ignore-scripts
npm --prefix apps/desktop run make --ignore-scripts
node --test apps/desktop/tests/package/desktop-package.test.mjs
```

公开 test 固定13模块串行运行，包含 owner、package、Reviewer 和 Tester；阶段尚未全部验收时不能把单阶段结果当全套通过。root npm test 是独立的 Node16模块回归。PM 发行检查使用已固定 npm CLI、ignore-scripts、离线缓存、本角色隔离 TEMP/userData/fixture，缺 SDK 或二进制会失败，不 skip。

固定 Electron44.6.0、Forge8.0.1、Playwright1.63.0、两个 Pi SDK1.0.4。生产依赖实际包含从29文件本地 tarball 安装的 legion-runtime0.4.0，Desktop 通过具名公共 subpath 调用，无开发树相对 imports 或 symlink。Forge 使用本阶段已核验 Electron archive；Playwright 操作实际 Electron，无额外 Chromium 下载。

当前稳定 ZIP：
`.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging/LegionDesktop-0.2.0-win32-x64.zip`。
make 可重新生成 ZIP，时间等封装身份可能变化；每次以同目录 desktop-package.json 的当前绝对路径、SHA、bytes 和源码核验为准，不使用旧 ZIP 的 SHA 冒充当前版本。该检查实际解压、运行 exe、操作两页面、浅深色/最小窗口、三协议连接、PM计划确认/写入/停止、DPAPI保存重启与 renderer 隔离，并守卫清理本次临时目录。独立 Reviewer/Tester 仍须完成验收。

旧0.1观察原型 ZIP、0.3核心 tarball、历史失败和缓存保持只读；它们不代表此工作台目标完成。未向 registry 发布。当前设计与接口见 [工作台设计](../../docs/design/2026-10-07_design_desktop-workbench-v2.md) 和 [Desktop API](../../docs/roles/DesktopEngineer/api-spec.md)。
