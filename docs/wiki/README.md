# Legion 项目 Wiki

> 核对日期：2026-10-10。本文是阅读入口；版本、命令和公开导出按当前工作区核对。表中的版本号不表示 Windows ZIP 已验收；阶段验收以链接的任务记录及其对应候选为准。

## 这是一个什么项目

Legion 有两个相连的产品部分：

| 部分 | 给谁使用 | 作用 |
| --- | --- | --- |
| `legion-runtime`（当前 `0.8.1`） | 集成 Node.js 包的可信宿主 | 创建 Pi Agent 会话，将文件读写、编辑、检查及项目命令申请交给宿主的权限链；提供 CLI 演示和有限的公共 Model/Service 入口。 |
| `legion-desktop`（当前 `0.2.0`） | 操作客户项目的用户 | Electron 工作台：选择项目、配置 AI 连接、与每个项目唯一的项目管理会话讨论、确认计划与文件归属、查看角色执行、检查和验收状态。它使用本地安装的 runtime 包。 |

使用 `legion-runtime` Node.js 包或从源码开发需要 Node.js `>=22.19.0`。面向用户的 Windows 完整 ZIP 随带 Electron 和运行依赖，用户无需另装 Node.js 或 Python；当前 `0.8.1` 更新的 Windows ZIP 尚未在 Windows 主机验收。Python v1 保留为历史参考。仓库中的 `.ans/` 是**开发这个产品**的 ANS 角色、边界、任务和证据；桌面用户选择的客户项目不必带本仓库的 `.ans/` 或开发角色定义。受控执行确认后，Kernel 可以在客户项目中写入自己的审计记录。先读 [runtime README](../../README.md) 与 [桌面使用说明](../../apps/desktop/README.md) 获取完整操作细节。

## runtime 已实现的功能

下面列的是当前 `0.8.1` 源码及包公开契约提供的能力。模型提出操作请求，可信宿主核对真实身份、当前任务、授权和输入版本；导入一个入口或构造 Model 值本身不会授予权限。完整参数和失败状态以各 owner 的当前功能文档与 API 为准。

### 根包：Agent 与文件权限

- **创建具名 Agent 并运行一次任务。**可信宿主用 `legion-runtime` 的 `createRuntime` 注册角色边界、任务、模型连接和可用工具，再用 `createAgent({name,proxy,scope})` 取得独立实例。实例可 `run`、`cancel`、`close`；`runtime.close()` 先撤权并等待活动运行和终态审计。SDK 原生任意文件和 Shell 工具默认关闭。[Agent 当前流程](../roles/KernelEngineer/docs/feature/generic-agents.md) · [根包示例](../../README.md#run-an-offline-pi-agent)
- **先判定权限，再提交文件修改。**`prepare` 返回决策及获准时的一次性许可，`execute` 在提交前重查，`submit` 组合两步。角色边界、任务精确 `writeSet`、实例工具、拒绝范围和所需审批共同决定结果；未获批准、身份/版本变化或越界时不写入。工作台还把 Human 确认的文件归属和上下文 SHA 绑定到任务，同一文件转交其他角色须显式确认。[权限流程](../roles/KernelEngineer/docs/feature/permission.md)
- **按授权读取、完整写入或局部编辑项目文件。**可信宿主可显式开启 `projectRead`，并在角色、任务和实例范围内授予 `legion_list_files`/`legion_read_file`；目录分页与文本片段受路径、凭据过滤和预算限制，成功的文本片段带完整文件 SHA。`legion_write_file` 写完整文件；`legion_edit_file` 用已读文件的完整 SHA 和唯一文本替换提交，旧 SHA 或歧义匹配会拒绝整次编辑。读操作不会自动固定计划上下文，也不会带来写权限。[项目读取与编辑](../roles/KernelEngineer/docs/feature/permission.md) · [根包说明](../../README.md#permission-and-lifecycle)
- **观察结果和撤销旧权利。**可信宿主可调用 `events()` 查看审计、用 `readFile()` 观察文件；两者不是模型工具。`updateVersion`、`updateBoundary` 和 `setTaskStatus` 会使旧实例许可失效。写入和审计是两次效果；若结果审计失败，返回值可能标记文件已实际改变，不能当作回滚。[根入口源码](../../src/kernel/interface/runtime.mjs) · [权限流程](../roles/KernelEngineer/docs/feature/permission.md)

### 可信工作台子路径：Pi、检查与项目命令

- **受控 Pi 会话。**`services/pi-agent` 支持原单次运行和无写权限的多轮 `conversation`，连接可选 OpenAI Chat Completions、OpenAI Responses、Anthropic Messages 三种明确协议。宿主按 scope 加载工具，读取事件、给原待处理请求一次类型匹配的回应；取消和关闭拒绝迟到回应。历史恢复只包含经验证的用户/助手文本，不恢复旧工具请求、许可或批准。[Pi 会话流程](../roles/AgentAdapterEngineer/docs/feature/pi-agent.md) · [Adapter API](../roles/AgentAdapterEngineer/api-spec.md)
- **组织、交互和验收请求。**获授工具可提出角色设计/提案/审核、请求用户答复、提交验收或请求返修；`legion_run_check` 另请求获批的检查 ID。Adapter 只把请求和类型化结果往返交给原 Pi 会话，真实组织记录、用户决定、检查执行和权限核对由可信宿主负责；模型的文字同意不构成授权。[Pi 工具流程](../roles/AgentAdapterEngineer/docs/feature/pi-agent.md) · [工作流](../roles/ProjectManager/docs/feature/governed-workflow.md)
- **运行批准的软件检查。**`services/check` 以当前 live 授权、输入版本和固定检查规范执行 macOS Node 测试，返回真实 `CheckDecision`/`CheckResult`，区分通过、失败、取消、过期、不支持和错误。当前检查运行器禁止子进程；写出测试文件或打印假 TAP 都不能算通过。[检查功能](../roles/KernelEngineer/docs/feature/software-checks.md)
- **逐次审批项目 Shell。**`services/shell` 接收原角色完整命令，经产品内 PM 对该次请求结构化审核后在私有项目镜像隔离运行；宿主只将本任务获准的源码变更和生成产物受控发布。源码可包含二进制创建、替换与删除，但内容和一次性发布凭证只留在宿主。部分发布会留下真实记录并暂停，须由人确认新计划和当前基线后恢复；Shell 退出码零仍不等于检查或验收通过。当前后端依赖 macOS Command Line Tools/SDK 与安全探针，其他平台不提供无限制降级。[Shell 功能](../roles/ProjectManager/docs/feature/project-shell.md) · [Kernel 契约](../roles/KernelEngineer/docs/feature/project-shell.md)

这些能力已经有源码和 owner/包桥检查记录；[当前最终组合任务](../scheduling/handwell-project-shell-final-integration-v1.md)中的独立 Reviewer/Tester、完整客户流程与 Windows 交付仍须按各自候选验收，不能从某个公共 Service 可导入推断整个桌面产品已交付。

## 快速上手

### 从源码运行和检查

在仓库根目录使用 Node.js 22.19.0 或更新版本。以下是当前 `package.json` 和 `apps/desktop/package.json` 中的入口；命令是否通过要以本机这次运行结果判断。

```sh
npm run demo
npm test --ignore-scripts
npm --prefix apps/desktop run verify:dependencies --ignore-scripts
npm --prefix apps/desktop start
npm --prefix apps/desktop test --ignore-scripts
```

`npm run demo` 使用临时目录演示允许与拒绝写入，不请求付费模型。根目录 `npm test` 是 runtime 的固定 Node 测试入口；桌面 `test` 包含单元、边界、集成和 UI 模块。`verify:dependencies` 检查桌面实际安装依赖和 runtime 公共包身份。桌面 `start` 需要已安装的桌面依赖及可用的 Electron 二进制；`--ignore-scripts` 安装不会自行下载 Electron 二进制，具体安装前提见[桌面说明](../../apps/desktop/README.md)。

若要试用本地打好的 runtime 包，[根 README 的安装与离线 Pi 示例](../../README.md#install-the-local-package)给出了 `npm install ./legion-runtime-0.8.1.tgz --ignore-scripts` 与 `npm exec --offline -- legion demo`。这里的 tarball 路径是示例当前目录中的文件名；仓库内实际本地包由发行 owner 的[发行文档](../roles/ProjectManager/docs/feature/distribution.md)记录。没有向 npm registry 发布的声明。

Windows ZIP 是 `npm --prefix apps/desktop run make --ignore-scripts` 的目标产物；这条命令及在 macOS 的包检查**不能**代替 Windows 主机上的 ZIP、启动、DPAPI 和界面验收。发行条件见[桌面发行文档](../roles/ProjectManager/docs/feature/desktop-distribution.md)。

### 用桌面工作台处理一个项目

1. 选择客户项目文件夹，在“AI 连接设置”添加匹配服务的协议、model ID、地址和密钥，并选择默认项目管理连接。
2. 回到“项目管理对话”发送消息。项目管理会话可按规则读取普通项目文本来澄清需求，讨论本身没有文件写权限。
3. 检查结构化计划、角色、依赖、精确 `writeSet`、文件归属和固定上下文，再由人确认执行。执行角色只能在当前任务许可的文件范围内写或编辑；读权限不产生写权限。
4. 在任务详情和成员对话看真实阶段、检查证据与验收。写出测试文件、Shell 命令退出码为零、或曾有旧候选通过，都不等于当前候选已通过独立验收。

连接测试、真实对话和执行可能调用所配服务；[桌面说明](../../apps/desktop/README.md)详述三种协议、密钥保存、取消、重启与限制。项目 Shell 需要原执行角色提出完整命令、产品内 PM 对该次请求结构化批准，再由宿主隔离执行和受控发布；详见[当前流程](../roles/ProjectManager/docs/feature/project-shell.md)。

## 代码如何组织

```text
runtime.mjs / workbench.mjs / bin/legion.mjs   包根入口、工作台 Model 入口、CLI
src/kernel/                                  权限、文件变更、受控读取、检查、Shell
src/adapters/                                Pi SDK 会话和工具请求转换
apps/desktop/main.mjs                       Electron 启动入口
apps/desktop/src/                            界面、唯一 Workbench Pipeline、Services、Providers、Models
tests/ 与 apps/desktop/tests/                各自的回归、包、边界、集成和 UI 检查
.ans/roles/ 与 docs/roles/                   开发角色边界及各 owner 的当前功能文档
docs/scheduling/                             阶段任务与候选证据记录
```

主要调用方向是 **Interface → Pipeline → Service → Provider → 外部设施**；Model 是共享纯值。桌面唯一的 Workbench Pipeline 组合桌面服务、runtime 的 Kernel 服务及 Pi Adapter 服务；桌面依赖安装包的公共子路径。角色与具体能力的归属、当前接线和历史版本区别，见[整体架构](../roles/ProjectManager/docs/architecture.md)。

## 公开入口与权限边界

- `legion-runtime` 根入口位于 [`runtime.mjs`](../../runtime.mjs)，导出 `createRuntime` 与七个输入/结果类型；`legion` CLI 位于 [`bin/legion.mjs`](../../bin/legion.mjs)。离线示例和生命周期见[根 README](../../README.md)。
- 可信工作台使用 `legion-runtime/workbench-models`，以及 `legion-runtime/services/{policy,mutation,read,check,shell,proposal,pi-agent}` 七个 Service 子路径；这些入口由当前 [`package.json`](../../package.json) 固定。Model 构造值本身不是执行批准；Provider、实现层、私有许可或 receipt 不属于包公开入口。详细契约见[发行 API](../roles/ProjectManager/api-spec.md)、[Kernel API](../roles/KernelEngineer/api-spec.md)及[Adapter API](../roles/AgentAdapterEngineer/api-spec.md)。
- 桌面 `apps/desktop/main.mjs` 是应用启动入口，窗口通过受限 IPC 到 Workbench Pipeline；它不是另一个可任意调用权限内核的 npm 公共包。桌面可用操作和数据形状见[Desktop API](../roles/DesktopEngineer/api-spec.md)。

## 用 ANS 修改这个项目

开发工作从对应角色的 `role-card.md` 和 `boundary.md` Section 1 开始：角色卡说明职责，Section 1 给出**实际可写路径**；能读其他 owner 的文档不等于能改其文件。任务授权还可缩小范围。功能 owner 维护自己 `docs/roles/<角色>/feature-map.md` 下的当前功能说明，项目管理维护整体架构与公共发行，Supervisor 调度，Reviewer/Tester 独立检查。ProjectWiki 只维护本页和[本角色文档](../roles/ProjectWiki/feature-map.md)，不拥有运行时功能。

常见改动顺序是：确认任务和边界 → 阅读当前契约/功能文档 → 在获准范围修改 → 对**当前候选**运行相关检查 → 由独立角色按任务阶段评审和验收。每项结果要对应真实输入、版本和环境；旧包、旧任务或不同平台的成绩不自动迁移。具体职责入口：[Kernel](../roles/KernelEngineer/feature-map.md)、[Pi Adapter](../roles/AgentAdapterEngineer/feature-map.md)、[Desktop](../roles/DesktopEngineer/feature-map.md)、[ProjectManager](../roles/ProjectManager/feature-map.md)、[Supervisor](../roles/Supervisor/feature-map.md)、[Reviewer](../roles/Reviewer/feature-map.md)、[Tester](../roles/Tester/feature-map.md)。

## 当前状态和已知限制

- 当前 manifest 指向 runtime `0.8.1` 和桌面 `0.2.0`，桌面依赖本地 `0.8.1` tarball。runtime 包桥、Desktop owner 和 PM 最终包步骤有各自候选的检查记录；[项目 Shell 最终组合任务](../scheduling/handwell-project-shell-final-integration-v1.md)将这些结果与后续独立 Reviewer/Tester 验收分开记录。本文核对时独立验收尚未全部完成；应直接看该任务的最新事件，不能把 owner 检查写成完整产品验收。
- 当前软件检查是受批准的 macOS Node 测试执行，固定禁止子进程；需要启动其他进程的测试不适用。项目 Shell 的真实隔离后端也依赖 macOS Command Line Tools/SDK 和启动探针；缺少条件或其他平台返回不支持，不降级为无限制 Shell。Shell 成功仍须单独检查与验收。详见[检查功能](../roles/KernelEngineer/docs/feature/software-checks.md)与[Shell 功能](../roles/KernelEngineer/docs/feature/project-shell.md)。
- 当前 `0.8.1` 更新的 Windows ZIP 及原生 Windows 流程还缺该平台的当前验收；旧 ZIP 和 macOS 结果不能替代。[桌面发行](../roles/ProjectManager/docs/feature/desktop-distribution.md)和[最终任务](../scheduling/handwell-project-shell-final-integration-v1.md)保存准确进度。真实客户 SSH 项目、外网模型/下载等场景也不能从本地受控回归推断已验收。
- 历史文档有当时的“当前”版本和通过记录。[架构顶部的当前候选](../roles/ProjectManager/docs/architecture.md)、各 owner 当前功能页及任务最新状态优先；本 Wiki 只提供导航，不复制全部契约或任务日志。

## 维护导航

使用问题先看[桌面说明](../../apps/desktop/README.md)或[根 README](../../README.md)；接口问题看各 owner 的 API；整体归属看[架构](../roles/ProjectManager/docs/architecture.md)；阶段是否完成看[当前任务](../scheduling/handwell-project-shell-final-integration-v1.md)。发现文档与源码、manifest 或检查结果不一致时，向相应 owner 提出事实和来源；Wiki 只更新获准的文档路径。ProjectWiki 的[职责](../roles/ProjectWiki/functional-description.md)、[引用契约](../roles/ProjectWiki/api-spec.md)与[变更记录](../roles/ProjectWiki/changelog.md)记录本页的维护规则。
