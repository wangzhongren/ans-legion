#二哥项目指挥台 0.3.3

桌面与 `legion-runtime` 1.2.3 共用唯一 Workbench Host，底层运行 Pi SDK 1.0.4。客户助手气泡与任务引导明确显示二哥，客户只与二哥（内部角色 Supervisor）连续对话，后台 PM 编排长期角色、文件归属、任务依赖与验收；角色运行区的 PM 职责和实际连接独立显示，不被误标为客户二哥连接。当前指挥台源码已通过 Desktop owner 门；本阶段包、真实 Electron 完整流和视觉验收仍以[当前任务](../../docs/scheduling/er-ge-display-name-v1-final-package-integration.md)为准，不能拿历史 GUI 成绩当本候选通过。

## 从仓库启动

要求 Node.js ≥22.19.0。PM 当前包门在本地生成 runtime tar，并将它实际安装为桌面 `file:` 依赖；包不来自 npm registry。本次包目录为 `.ans/runtime/legion-desktop-command-center-v1/ProjectManager/packaging/er-ge-display-name-v1-final-v2-a689a7d63d7dfc26/`。

从仓库根目录运行：

```sh
npm --prefix apps/desktop ci --ignore-scripts
npm --prefix apps/desktop run install:electron
npm --prefix apps/desktop start
```

需先存在 Desktop manifest/lock 引用的本地 `legion-runtime-1.2.3.tgz`；`npm ci` 依照锁文件安装该真实包和固定依赖。`--ignore-scripts` 不下载或安装 Electron 二进制；`install:electron` 使用项目已有官方安装能力。Electron 固定44.6.0、Forge8.0.1、Playwright1.63.0。本机macOS已具备真实Electron启动条件，尚不能据此宣称新UI已独立验收或macOS发行包完成。

Windows打包配置仍存在；当前没有经本候选Windows ZIP/DPAPI/exe验证的交付，不把旧ZIP当0.3.3。未向registry发布，不全局安装，不修改依赖源码。

## 打开项目并与二哥协作

1. 选择普通项目文件夹。客户目录不需要本仓库开发组织，也不会仅因选择就执行模型或修改文件。私有应用数据目录与客户项目互不包含。
2. 在“AI连接”添加服务并选择默认连接。支持 OpenAI Completions、OpenAI Responses、Anthropic Messages；协议、provider、model和base URL应匹配服务。未知模型能力和费用显示未知。
3. 回到二哥对话说明需求。后台PM的问题通过二哥转达；答复问题、选项或完整当前计划确认是不同交互。普通聊天里的“同意”不会赋予执行权限。
4. 查看Host当前完整目标、角色职责/连接、任务依赖、检查/独立验收、文件归属及转交，再确认执行。拒绝或稍后不授权。

桌面由主进程通过Electron safeStorage保存客户主动输入的密钥；加密不可用明确失败，没有明文后备。密钥不返回renderer或日志。连接测试与模型会话会产生实际请求；本阶段验收仅使用受控localhost与真实SDK，不宣称付费远端服务测试。

## 三个工作区

- **二哥对话**：完整客户历史、二哥回复、后台PM原问题、当前Host确认、未发送输入。切换工作区仍保留同一个客户入口。
- **项目工作**：普通目录分页、UTF-8分段预览、真实修改/发布/生成产物、当前Check与Acceptance。计划提到不等于已写；缺失、删除、partial、未运行与过期证据分别显示。没有旧正文时不伪造历史diff。
- **角色运行**：长期职责、当前状态、依赖阻塞、按角色/任务/计划分页的行动元数据、带实际来源的坑/决策/偏好。私有成员原文、briefing、恢复摘要和Shell原始命令/输出不发往界面。

宽屏三列且独立滚动；≤1280px使用二哥与当前工作区两列，≤900px用顶层页签。可折叠布局、深浅主题、键盘焦点与轮询保留草稿，900px窄窗顶部“项目与设置”打开可发现的项目导航，AI连接与主题入口仍可访问；Escape关闭后回到入口焦点，切换设置/主题保留客户输入。首屏各查询省略空cursor，仅下一页使用实际返回游标；角色阶段显示“尚未运行”等真实中文状态。实际表现仍须新Electron视觉门核验。

## 读取、执行与停止边界

文件浏览与 `selectContext` 分开：浏览不把正文注入固定模型上下文，不改计划/owner，不撤销运行grant。普通文件仍遵循项目根身份、no-follow、受保护控制/凭据资源、二进制和预算拒绝。列表每页最多200项、正文分段最多64KiB；角色行动日志默认20、最多50项且每页≤32KiB，游标绑定项目、筛选和来源快照。分类事实inspect只读，不保存记忆修订。

执行中二哥只允许读取和查询；Host拒绝PM委托、remember/revise/retract事实及新增讨论交互等变更工具，不依赖提示词自觉。预检/monitor是独立后台channel，建议不能替代用户批准、Check或Acceptance。

写权来自持久角色精确文件归属，产品任务没有 `writeSet`。新归属和转交须实际Human确认；当前计划/context/profile/owner版本、根身份与物理租约在实际提交前再核。界面不提供自由编辑器或直接给角色发执行消息。

停止当前项目会撤销当前运行权限并等待受控操作结束，已成功写入保留。取消完成后可在同Host继续新二哥消息；原Human保留，未完成assistant片段不恢复为有效历史。关闭或变更连接/项目仍遵循原失效边界。重启读取已有客户历史与分类事实，旧PM历史标为只读历史；旧pending确认、死委托与grant不重放。

## 包身份和验证

真实包门核 tar/sourceHashes/安装字节、Desktop manifest+lock的resolved/integrity和SDK来源；固定PM `cli` 再运行真实消费者bin、三协议、取消续轮、双draft旧yes拒绝、owner/Check/Acceptance/Shell和已知key负例。README自包含二哥示例保持原字节并在消费者实际执行。

本阶段独立Tester负责桌面完整流程和真实Electron截图；Reviewer负责五层调用、有限IPC、私有DTO与包闭包。新增macOS指挥台用例不得skip，原Windows平台用例未执行单列unsupported，不计为通过。旧GUI最终验收继续暂停。

[当前桌面功能](../../docs/roles/DesktopEngineer/docs/feature/desktop-console.md) · [已确认设计](../../docs/roles/ProjectManager/docs/design/2026-10-12_design_desktop-command-center.md) · [Desktop API](../../docs/roles/DesktopEngineer/api-spec.md) · [发行说明](../../docs/roles/ProjectManager/docs/feature/desktop-distribution.md)
