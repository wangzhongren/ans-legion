---
id: pm-desktop-workbench-v2
type: design
created: "2026-10-07"
updated: "2026-10-07"
timezone: Asia/Shanghai
status: authorized-implementation
related: [distribution, desktop-distribution]
---

# 工作台 v2：公开 Node 包与桌面依赖

客户已确认[canonical](../../../../design/2026-10-07_design_desktop-workbench-v2.md)，SHA256为715639b5dd278437059f29bde1e7c02ac90d94af18f9bf5a6b5367d16e9ab5d3，默认focus_conversation。唯一Human入口是每工作区项目管理Agent；首消息创建或复用PM，多轮讨论，确认后动态执行。没有Reception、任意Shell或模型自行授权。本文件在core-package-deps阶段一次完成并冻结，不以未来桌面验收补写上游候选。

PM发布legion-runtime0.4.0 ESM包。根runtime.mjs八项和CLI保持原样；增加唯一透明workbench.mjs及四个公开Service子路径。workbench-models按合同显式导出30项，禁止export星号、私有helper、Provider或预构造的下层对象。源码清单含24个Kernel/Adapter .mjs、runtime/workbench/bin三项产品入口，以及README/package.json，共29文件；source身份为27个产品.mjs逐文件SHA与统一/路径排序聚合。

真实tarball保留在.ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/legion-runtime-0.4.0.tgz。原两项包测试保留根八项、typed权限/permit不可重放、真实Pi两调用、README、CLI六场景23事件、离线安装及integrity断言；新版本精确清单和五子路径追加严格验证。生成产物路径/SHA512 integrity/SHA256与source27摘要分别记录，SDK或cache缺失必须失败。

独立desktop0.2.0唯一Legion依赖为上述本地tarball；npm将它真实安装到apps/desktop/node_modules，不使用workspace link、越界源码导入或开发目录。lock中只此文件依赖可用file resolved，其余依赖必须registry HTTPS和sha512 integrity。已安装包的29文件、五子路径与真实SDK须核对。Electron44.6.0、Forge8.0.1、Playwright1.63.0、两个Pi包1.0.4不升级；安装ignore-scripts，只显式调用固定Electron官方install.js。旧archive仅只读seedcopy到本任务electron-cache，并核对官方checksum；无额外Chromium下载。

core-package-deps依赖已verified Kernel和Adapter。完成本阶段11个authored文件后，固定checks core-package300秒、install-electron300秒、verify-dependencies120秒；最后一项通过实际安装公开Service，以localhost三协议验证plain连接/私有credentials和真实Pi会话，不付费、不fakeSession。阶段完成后文件冻结，Desktop只能消费此安装包。后续desktop-package另写入口/Forge/README/测试及本角色其余文档，真实make→解压ZIP→启动exe→关停，随后独立Reviewer/Tester。所有阶段verified后公开desktop npm test补充证据不是阶段检查替代；重make导致新ZIP身份时须重收相关证据。

效果只在PM角色优先node/desktop npm-cache/packaging/tmp、desktop electron-cache/user-data/fixtures及允许node_modules/out。旧0.3.0tgz、GUIv1ZIP、历史cache/compat路径全部只读，旧_cacache只复制种子。子进程固定TEMP/cache，清NODE_OPTIONS/NODE_COMPILE_CACHE并禁compile cache；清理先核对绝对范围与祖先无链接。默认权限不能隔离恶意同进程代码，也不证明全部Windows reparse行为。

讨论只产生userData会话，执行前Human确认绑定项目、计划、组织、连接、context SHA、角色、任务、精确writeSet和工具。Storage写前实际重查root/context；原requiredApprovals保留，写.ans硬拒绝。新增Controller能力只供可信主进程Pipeline，Mutation仅得品牌consume/recheck/release。模型能力/价格未知保持unknown；生成测试文件不能称软件检查已执行，状态为not_executed。

原包与GUI原型是历史。owner包/依赖checks只证明当前安装产物，不代表新版桌面已完成；实际结果与后续独立验收见[任务](../../../../scheduling/legion-desktop-workbench-v2.md)。[发行功能](../feature/distribution.md)、[桌面发行功能](../feature/desktop-distribution.md)。
