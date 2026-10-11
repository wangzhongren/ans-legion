# ProjectManager 当前职责与实现边界

本固定角色维护公共Node包、透明导出、真实本地安装、发行入口和管理文档。Kernel/Adapter/Desktop拥有业务Model、Provider、Service、Workbench Pipeline和Interface；PM不写其业务源码，不自行派worker或verify。Supervisor唯一调度建设任务；产品内PM对角色Shell审核是独立运行功能，不是本仓库配置授权。

runtime0.8.2包已真实安装至Desktop0.2.0，包含46文件/44mjs、62具名Model与八工作台子路径（七Service加Models），原根八API/CLI兼容，不公开Provider/私有receipt或SDK接口。tar1a2a7c48…与每源安装字节核对；固定SDK/Electron/Forge/Playwright版本保持。当前PM最终派发仅十份角色文档，早期bridge source/package/lock/README/exports以及其他owner和Reader两文件只读。

执行角色申请完整Shell调用，经原PM持续文本上下文独立串行审核、真实ledger一次消费后，在macOS隔离镜像执行。source text/binary/安全执行位/delete由原角色Mutation精确发布，生成只限本请求效果；读取已有依赖不授发布权限。结果回原pending，对话和主区阶段均为真实事件。固定Check和独立Acceptance仍是另一个验证门禁，Shell退出0不替代它们。

部分发布持久journal、暂停和重启恢复状态；Human新计划/当前基线/新授权实际恢复后才追加recovered和当前证据，旧partial保持。CLT/SDK或startup探针缺失失败关闭，没有裸Shell或全局安装。已测试localhost SDK/native/离线npm/build，外网未实跑，其他Shell平台与当前WindowsZIP未验收。Reader精确接受真实批准治理数据，candidate历史文字不自激活；Supervisor保持v2。

本阶段旧bridge-v3完整bytes/SHA/mode/path/log关系先归档，固定JSON可作为latest复验刷新，后保存新run；不得声称旧JSON原路径hash仍不变或使过期观察复活。原tar、源码、锁和历史task日志保持。[当前功能](docs/feature/project-shell.md)、[公共API](api-spec.md)、[架构](docs/architecture.md)与[最终任务](../../scheduling/handwell-project-shell-model-time-facts-repair-v1.md)分别说明行为、契约与实际当前验证。Owner通过不等于独立GUI/客户SSH完整交付。




## 0.8.2 显式Host时间事实

角色批准后可能在发许可与真正提交之间等待。纯Model现在不读取环境时钟或注入clock callback；Shell/Mutation的相邻Provider取得fresh safe epoch毫秒，经公开Service的 `observeTime()` 传入Model比较。Host每项proposal调用 `controller.issueShellPublication(proposal, receipt, service.observeTime())`，不为整批缓存旧时间。操作层在issue、consume、publication以及真正create/replace/delete和recheck前重新观察，缺失/无效/回退时间事实、到期、abort及replay仍失败关闭，不能凭旧issue事实延长许可。

publicfactory和62具名Model/helpers不变；该Host controller第三参数为必需caller调整，实际Desktop与包测试各自接线。SDK request/review/result、renderer与历史不新增clock字段，ordinary write/edit仍原用法。Policy的私有publication上下文使用真实receipt和 `observedAtMs: mutation.observeTime()`，Model值或时间数字不是审批授权。完整实际接口见Kernel API末节。

当前0.8.2 bridge-v3真实包SHA `1a2a7c483f04f2bb939d6bf4d25aa7a4318bc866a473dcac251f74d1ee592622`，46files/44mjs及安装每源相等，Desktop产品仍0.2.0。原0.8.1 bridge-v2和0.8.0 bridge-v1、旧proof及final before/after archive均保留。Owner实现和本阶段三固定门的最新候选/成绩、独立Reviewer/Tester状态以[时间事实修复任务](../../scheduling/handwell-project-shell-model-time-facts-repair-v1.md)记录，不复制活任务计数，不把下一检查写成已pass。当前包源保持冻结，本阶段只更新10文档，固定门前后完整保全bridge-v3快照并按Gov策略标注latest。


本机当前WindowsZIP本体及对应descriptor缺失；macOS可核验的是历史0.7.0 TGZ/descriptor的39file/37source身份与当前0.8.2真实安装，不读取不存在的ZIP字节，不以这些结果宣称Windows支持、exe/DPAPI或GUI发行通过。旧Windows精确断言和独立发行验证由后续原Reviewer/Tester保留。外网仍未实际运行，当前Shell仅macOS CLT/SDK与startup探针实际能力范围，失败unsupported；源码/生成恢复的新Human授权、当前baseline与追加recovered语义保持。


## 职责和发行历史

以下保留当时记录；版本、待办和通过状态仅适用于原记录候选，当前状态见上文。

# ProjectManager 功能与边界

本角色维护公共Node发行契约、透明包入口、实际本地安装、Windows入口/ZIP、使用说明与发行证据。业务Model、Provider、Service、Workbench Pipeline和Interface由各owner实现；PM入口只调用Desktop Interface startDesktop并管理进程启动、关停，不能构造下层或授予业务许可。

用户解压工作台0.2.0 ZIP，选择任意客户文件夹，在唯一项目管理入口讨论。首消息建立/绑定该项目PM，讨论只作用于Adapter会话与userData；Human确认完整计划后才由Desktop唯一Workbench Pipeline按依赖创建动态执行Agent，经Kernel权限与审计链执行精确writeSet。执行成员不可直接Human聊天/启动，客户组织不复制仓库固定开发角色。软件检查没有执行器，显示not_executed；未知模型metadata/费用保持unknown。

runtime0.4.0已从29文件真实tarball安装至Desktop生产依赖。根八API保持，workbench-models显式30项及四publicService子路径透明转发；没有privateSDK、开发树相对import或symlink安装。前core-package-deps11文件和当前Kernel/Adapter/Desktop候选只读；本desktop-package阶段只写10个派发输出，不再改锁、helper、dated设计或Node发行功能。

生成仅本角色v2 node/desktop精确目录、局部node_modules与desktop/out。实际当前make→解压→exe→原生UI与真实localhostSDK→DPAPI重启→close证明发行可启动并复用许可执行链；截图来自该ZIP实际窗口，禁止静态注入冒充。测试保留旧tarball、原型ZIP、历史记录/cache及当前core11/27source逐file身份；清理核对绝对范围与祖先无链接，只结束本次进程。

独立Reviewer与Tester继续负责结构/完整集成/视觉验收；管理package两项不替代。原型0.1与Node0.3历史不冒充当前验收，不registry发布、不付费推理。[当前流程](docs/feature/desktop-distribution.md)、[接口](api-spec.md)、[架构](docs/architecture.md)。
