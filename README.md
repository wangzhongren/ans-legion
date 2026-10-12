# 二哥

**以角色为核心的多 Agent 项目运行时。** 底层使用 Pi 执行模型会话，上层将角色职责、项目意图、文件归属、依赖调度、记忆和验收组织成持续工作的项目。当前 runtime **1.3.1**，桌面 **0.4.1**。CLI 与桌面项目指挥台共用一个 Host。图片功能源码已完成各 owner 检查，当前终版包及独立图片流程/视觉/结构验收进行中。

客户始终与二哥（内部角色 Supervisor）连续对话，客户助手气泡和任务引导统一标识二哥。二哥理解需求、读取项目、汇报状态；ProjectManager（PM）在后台编排角色与计划。每个角色拥有自己的上下文、记忆和文件职责，客户无需切换角色窗口。

## 核心能力

| 能力 | 当前行为 |
| --- | --- |
| 单一客户入口 |二哥承接连续对话，后台 PM 提问通过二哥转达 |
| 全局项目理解 | 角色可读取权限允许的普通项目文件；二哥可自主读取、查询所有角色状态与分页工作日志 |
| 角色独占文件 | 持久文件归属决定可写范围；任务无需 `writeSet`。新增归属和转交由实际用户确认 |
| 依赖与并行 | 按任务依赖、角色归属和运行授权调度，无冲突任务可并行执行 |
| 项目分类记忆 | 保存坑（pitfall）、重大决策（decision）、用户偏好（preference）；偏好仅在当前项目共享 |
| 私有角色上下文 | 客户对话、PM 委托、二哥预检与监控、成员任务分别保存上下文，工作日志不暴露私有对话 |
| 检查与独立验收 | 实际 Check 和 Acceptance 决定结果；二哥汇报当前证据及阻塞 |
| 执行中交互 | 执行期间可继续向二哥查询文件、状态和日志，不撤销正在工作的角色授权 |

“全局可读”限于普通项目文件：凭据、私有运行记录、受保护目录及不允许的符号链接仍受读取策略约束。二哥的业务写入和授权权限保持原边界，没有 Mutation、Check、Shell 或授予权限的工具。

## 工作流程

```mermaid
flowchart TD
    U[客户连续对话] <--> Su[二哥 / 内部Supervisor]
    Su <--> PM[后台 ProjectManager]
    Su --> Read[普通项目文件 · 角色状态 · 分页工作日志]
    PM --> Draft[角色职责 · 文件归属 · 任务依赖 · 检查与验收计划]
    Draft --> Confirm[Host 展示完整计划并请求用户确认]
    U --> Confirm
    Confirm --> Host[Host 授权与依赖调度]
    Host --> A[角色 A / 独占文件与私有上下文]
    Host --> B[角色 B / 独占文件与私有上下文]
    A --> Checks[实际检查与独立验收]
    B --> Checks
    Checks --> Su
    Host --> Monitor[后台二哥预检与监控]
    Monitor --> Su
```

二哥和 PM 的建议不直接产生执行权限。Host 生成当前计划的完整确认，用户审阅任务、检查、归属与转交后，在 `Answer>` 输入 `yes` 或 `no`。普通聊天中的“同意”不能替代这一步。PM 的问题也在 `Answer>` 回答；选项问题使用显示的选项 ID。CLI 自动绑定请求版本与摘要，客户无需操作 SHA。

## 桌面项目指挥台

桌面包含二哥对话、项目工作、角色运行三个工作区。可以浏览普通项目文件、实际变更和产物、当前 Check/Acceptance、角色依赖与分页行动日志、分类记忆。宽屏三列，窄窗折叠或使用页签；后台角色私有原文和恢复摘要不传到界面。文件浏览是纯读，不改变固定上下文或撤销执行授权。首屏查询省略空游标，只有读取下一页才传真实游标；900px窄窗顶部“项目与设置”可打开项目导航、AI连接和深浅主题入口，Escape关闭后恢复焦点。角色状态用当前工作、等待答复、依赖阻塞及“尚未运行”等真实中文阶段呈现。

在已准备本地 runtime 包并安装项目依赖的仓库中运行：

```sh
npm --prefix apps/desktop ci --ignore-scripts
npm --prefix apps/desktop run install:electron
npm --prefix apps/desktop start
```

`--ignore-scripts` 不会安装 Electron 二进制；`install:electron` 使用项目既有官方安装能力。当前 macOS 启动条件已具备，新的真实 Electron 流程与视觉验收由独立 Tester 执行。选择项目并在“AI 连接”设置服务后，只与二哥对话；完整当前计划必须由客户确认后执行。桌面主动保存的密钥沿 Electron safeStorage 加密路径，CLI 仍仅用进程环境。Windows ZIP/DPAPI 未完成本候选验收。详见[桌面说明](apps/desktop/README.md)。

## 桌面图片输入（1.3.1 候选）

在二哥输入框粘贴截图、拖入本地图片或点击选图，发送前可预览、移除；可以只发送图片。首版支持 PNG/JPEG，每轮最多4张，单图≤4MiB、合计≤8MiB，单边≤8192、像素≤16MP。图片来源是本地 File，不能粘贴远程图片URL要求程序下载。

在AI连接设置中显式选择模型图片能力 `supported`。默认 `unknown` 或声明 `unsupported` 会在含图发送前明确拒绝并保留草稿；协议/模型名称本身不能证明视觉支持，所用服务实际拒绝也如实报错。二哥、需看图的后台PM与工作角色分别使用各自真实连接，按可信Human来源和确认任务的精确图片引用重载真实像素，不仅转发文字描述。能力设置绑定连接版本，改变连接仍沿原计划失效规则。

图片保存在当前项目的应用私有数据目录，通过SHA、类型、尺寸和引用校验；普通状态/行动日志/Org JSON不包含base64。客户历史可显式打开有限图片预览，重启保留可信引用，取消不重放工具或执行确认。项目blob总量≤64MiB/最多256引用；只有未被历史、委托、任务或恢复引用且非活动的staged孤儿可经身份/no-follow核后回收，已引用历史不删。恢复/当前请求合计最多8图/16MiB，超过预算、缺图或字节改变明确失败，不能静默将图片替换成摘要。

图像能力基于真实Pi SDK `images`，网络前拒绝SDK静默省图为文字hint；三协议图像请求体、PM/worker交接、历史和真实Mac粘贴/拖入/选图完整流程仍待本候选独立验收。这里不做OCR、图片生成或远程URL下载，图片像素不宣称已做秘密扫描；原文本/元数据及模型输出的known-key门继续生效。**CLI本次仍仅文本输入**，`legion`命令、包名、导入和环境参数不变；以下JavaScript文本示例维持原字节兼容。

## CLI 安装与启动

要求 **Node.js ≥ 22.19.0**。CLI 是 Node ESM 包，不依赖 Electron 或 Python；Pi SDK 与 pi-ai 固定为 1.0.4。

当前提供本地 npm 包安装，尚未声明发布到 npm registry。取得 `legion-runtime-1.3.1.tgz` 后，在消费者目录安装：

```sh
npm install ./legion-runtime-1.3.1.tgz --ignore-scripts
export LEGION_API_KEY='your-current-provider-key'
export LEGION_PROTOCOL='openai-completions'
export LEGION_PROVIDER='your-provider'
export LEGION_MODEL='your-model'
export LEGION_BASE_URL='https://your-provider.example/v1'
./node_modules/.bin/legion chat --project /absolute/project --user-data /absolute/private/legion-data
```

也可从本仓库生成本地包，再按上述方式安装：

```sh
npm pack
```

支持 `openai-completions`、`openai-responses`、`anthropic-messages` 三种协议。模型、provider 和 base URL 填写所选服务的实际值；非密钥字段也支持 `--protocol`、`--provider`、`--model`、`--base-url`。CLI 仅从本次进程环境读取密钥，不提供命令行密钥参数，不保存密钥。

启动后可直接说：“阅读这个项目，给我一个开发计划”，或“哪些角色正在工作？查看最近的工作日志”。运行中改变计划或文件归属需先取消，再确认新计划。

- `/cancel` 或 SIGINT：取消当前对话及委托，并停止当前项目执行；保留已成功写入的结果，撤销授权并等待受控操作结束。
- 取消完成后：可在同一进程输入新消息继续对话，取消轮的未完成模型回复不会作为后续有效历史恢复。
- `/exit` 或 SIGTERM：关闭 Host。
- `legion demo`：运行权限演示。

`--user-data` 指定私有项目目录；同一项目应复用同一目录。物理项目租约位于 `~/.legion-project-leases`，更换目录不能绕过文件归属来源。不要自行删除来源不明的租约或标记。

## 记忆、日志与执行边界

项目记忆记录可复用的坑、决策和偏好，角色的私有会话与恢复摘要按角色及用途分隔。新二哥客户历史、PM 委托与后台监控不会混入旧 PM 历史；旧历史只读，旧确认与失效授权不会自动重放。

二哥工作日志呈现真实动作元数据与来源，如角色、任务、工具、资源、状态、原因和检查结果，并支持分页。日志不包含原始模型消息、提示词、私有摘要或凭据。文件写入仍在实际提交前校验当前角色归属、版本和物理项目租约。

1.1.3 已修复旧确认遮挡新计划、取消后无法继续，以及后台监控记忆干扰客户新消息的问题。旧计划的 `yes` 不会转用到新计划；失败后的新需求必须形成新草案和新的实际确认。

## 验证状态

**当前 1.3.1 / 桌面 0.4.1**：图像纯契约、真实 Pi 图像调用与桌面图片接线已分别通过 owner 门；本次 PM 终版包/文本 CLI 兼容、独立图片流程/真实 Electron 与结构验收以[本次任务记录](docs/scheduling/desktop-image-input-v1-facade-repair-integration.md)为准，尚不宣称全部交付通过。

**历史 1.1.3 CLI** 已完成真实 npm 安装及独立验收，以下成绩属于该旧候选：

| 验证 | 结果 |
| --- | --- |
| 独立 Tester：安装后真实 `legion chat` | 14 场景通过 |
| 独立 Tester：既有回归 | 40/40 |
| 独立 Reviewer：结构审查 | 69/69 |
| PM：CLI 与 README Host 示例 | 10/10，示例实际运行通过 |
| Desktop 调用侧：归属 / Host / 并行 | 207/207 · 157/157 · 123/123 |

测试在 macOS 上使用受控本地 HTTP 协议端点与真实 Pi SDK，覆盖三协议、计划确认、并行归属、问答、检查与验收、记忆、监控、取消续轮及已知密钥负例。旧 GUI 验收继续暂停，Windows 与付费远端模型尚未验收。

历史 1.1.3 已验收安装包 SHA-256：`e0ac5ebaee7caabc52175fe28e229c6fbc195d02890ec5bffe6ba76d80a6f73a`。这是已验收 tar 的身份；从修改后的仓库重新 `npm pack` 生成的包会有不同摘要。

已知密钥保护针对已捕获的原值和受控数据路径，不代表未知或编码秘密扫描，也不覆盖外部文件竞态、子进程自行重构秘密等一般情况。Shell 退出码为零不等于 Check 或 Acceptance 成功。

## 文档入口

- [项目 Wiki](docs/wiki/README.md)
- [桌面指挥台功能](docs/roles/DesktopEngineer/docs/feature/desktop-console.md)
- [桌面指挥台设计](docs/roles/ProjectManager/docs/design/2026-10-12_design_desktop-command-center.md)
- [当前功能地图](docs/roles/ProjectManager/feature-map.md)
- [CLI 项目工作流](docs/roles/ProjectManager/docs/feature/cli-project-workflow.md)
- [二哥入口与全局读取设计](docs/roles/ProjectManager/docs/design/2026-10-11_design_supervisor-frontdoor-global-read.md)
- [版本变更说明](docs/roles/ProjectManager/docs/change/2026-10-11_change_supervisor-frontdoor-global-read.md)
- [独立测试报告](docs/roles/Tester/docs/verification-cli-v1.md)
- [独立审查报告](docs/roles/Reviewer/docs/review-cli-v1.md)
- [1.1.3 已验收任务记录](docs/scheduling/legion-supervisor-frontdoor-v1-role-memory-race-repair-integration.md)

## JavaScript Host 示例

以下自包含示例使用真实本地 HTTP 协议和 Pi SDK，在空临时项目中完成一次二哥对话，不调用付费模型或写入业务文件。安装包也导出 `legion-runtime/headless-workbench`，供 Node 程序复用同一 Host。

<details>
<summary>展开已验收的 Host 示例</summary>

```javascript
import { createHeadlessWorkbenchPipeline } from 'legion-runtime/headless-workbench';
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const directory = await fs.mkdtemp(join(tmpdir(), 'legion-su-example-'));
const project = join(directory, 'project');
await fs.mkdir(project);
const server = createServer(async (request, response) => {
  for await (const chunk of request) {}
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  const first = { id: 'local', object: 'chat.completion.chunk', model: 'local',
    choices: [{ index: 0, delta: { role: 'assistant', content: 'Su discussion complete' }, finish_reason: null }] };
  const last = { ...first, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] };
  response.end('data: ' + JSON.stringify(first) + '\n\ndata: ' + JSON.stringify(last) + '\n\ndata: [DONE]\n\n');
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const host = createHeadlessWorkbenchPipeline({ userDataDir: join(directory, 'private'),
  profile: { protocol: 'openai-completions', provider: 'local', modelId: 'local',
    baseUrl: 'http://127.0.0.1:' + server.address().port + '/v1', env: { LEGION_API_KEY: 'readme-local-fixture' } } });
try {
  const selected = await host.selectProject(project);
  if (!selected.ok) throw new Error(selected.error.code);
  const sent = await host.sendMessage({ projectId: selected.value.currentProject.id, roleId: 'Supervisor', text: 'Discuss this project.' });
  if (!sent.ok) throw new Error(sent.error.code);
  let state;
  for (let attempt = 0; attempt < 200; attempt++) {
    state = await host.getState();
    if (!state.ok) throw new Error(state.error.code);
    if (state.value.turn?.status === 'completed') break;
    if (state.value.turn?.status === 'failed') throw new Error(state.value.error?.code ?? 'run_failed');
    await new Promise(done => setTimeout(done, 25));
  }
  if (state.value.turn?.status !== 'completed') throw new Error('example_timeout');
  console.log(state.value.turn.text);
} finally {
  await host.close();
  server.closeAllConnections();
  await new Promise(done => server.close(done));
}
```

</details>

预期输出：`Su discussion complete`。示例保留临时私有记录供检查，不更改 HOME 或租约根，也不删除共享标记。
