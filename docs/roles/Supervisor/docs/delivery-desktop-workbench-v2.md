# 工作台 v2 最终交付

工作台 v2 已完成当前候选验收：八个逻辑阶段、十二项阶段门禁、一次公开桌面入口及重生成 ZIP 的两项独立复核均通过，全部节点 inactive。唯一项目管理对话、Human 确认精确计划后动态执行、专注对话布局已实现。当前 Windows ZIP 为 `11c16a8c…`；旧 `755e0950…` 的产物专属结论保留历史。

用户解压完整 [LegionDesktop-0.2.0-win32-x64.zip](../../../../.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging/LegionDesktop-0.2.0-win32-x64.zip)，双击 **LegionDesktop.exe** 即可。保留 resources 和 DLL，无需另装 Python 或 Node。选择项目目录，配置默认 AI 连接，向项目管理发送需求；在对话中澄清方案，核对角色、依赖、上下文和精确文件清单后点击确认。其他执行成员仅展示任务和状态。使用说明见 [桌面 README](../../../../apps/desktop/README.md)。

## 当前产物身份

| 产物 | 大小 | SHA256 |
| --- | ---: | --- |
| Windows ZIP | 194645336 B | `11c16a8c308d05f81ae66831f0a661d47547fd8a1e1606b4dcc149164722b298` |
| [当前 ZIP descriptor](../../../../.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging/desktop-package.json) | 5481 B | `fa6acd9b2245c337407847da23b9dbfd055b3b5030560b26598244a7e7c7f0aa` |
| [Node 0.4.0 tarball](../../../../.ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/legion-runtime-0.4.0.tgz) | 33357 B / 29 entries | `f3114a19205b69542c5629cfbb4a2664e9aebc62fc81f76a69d332e6f922140c` |

绝对 ZIP 路径：`D:/work/code-work/agent-organization-runtime/.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging/LegionDesktop-0.2.0-win32-x64.zip`。新 tarball 位于同项目 `.ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/legion-runtime-0.4.0.tgz`，desktop 0.2.0 以唯一 file: resolved/integrity 实际 nonlink 安装；ZIP 自带运行依赖，未向 registry 发布。

规范聚合算法：相对路径统一为 `/`、Ordinal 排序，每文件一行 `path<TAB>fileSHA<LF>`，UTF-8 SHA256。不是 JSON.stringify 聚合。

| 范围 | 文件数 | 规范聚合 SHA256 |
| --- | ---: | --- |
| Core 产品 mjs | 27 | `fa803823991e81e54149289880a90e3a4693cfb313e36a821301b778ff785bd7` |
| Desktop source（含 main/HTML/CSS/CJS） | 37 | `e015b846ac11f42e539c8dba3d7dd2b3d5b6d9c4fad0c7d6425b548d3b95e1a0` |
| 两者全部产品源码 | 64 | `6394d750b636729bc3dc45d312f3b960b21146b543a51c0488c7eae3cbb7c454` |
| 本阶段业务 authored（含测试与 owner 文档，不含 Supervisor 七份协调说明） | 114 | `a8e8773b4575e4c43c8dd3f94c00e53a6c4a64ab7e74811f28d89f713ea9678f` |

## 实际门禁与候选

以下每项均为正式 task_ops check，失败/跳过/取消/todo 全为0；安装与依赖两项以 exit0 记录，不虚构测试数量。重叠套件分行记录，不将重复运行相加当作独立用例总数。

| 当前阶段 / check | 实际通过数 | candidate | 记录 |
| --- | ---: | --- | --- |
| Kernel / unit（9模块） | 100 | `62e19281594766df248f5e063bcfc04757d351e3cb06595d5252d9f31f0f9eeb` | 原任务 verify7 |
| Adapter / unit（3模块） | 38 | `90a2d2b8f1d1b576aec8ef52ebfc6c7c20d206877d73436f341593a980846f6e` | 原任务 verify14 |
| PM core-package | 2 | `e22a6341029fcce3d729a98e47b1a6f825da28ffd58ac94137102e50adf74765` | 原任务 verify25 |
| PM install-electron | exit0 | 同上 | 原任务 verify25 |
| PM verify-dependencies | exit0 | 同上 | 原任务 verify25 |
| Desktop cap-fixtures / capabilities（6模块） | 47 | `ac97a5af88dbbfa31f82459ec0af0b34224292700fc5a1296b451ee048b43fa0` | 修复任务 verify6 |
| Desktop Interface（2模块） | 7 | `e0c5a3da7eb84b2998604c9b201141a70e6aa74b640e98900744079a6bf7f0c0` | 修复任务 verify11 |
| PM desktop-package | 2 | `fc352fb8aea135d43fe5bf8ab227fef90aa8bd7adf34d578ff220a54a67d8c58` | 修复任务 verify19；755包历史产物身份 |
| Reviewer node-unit | 22 | `4d97d8e76524a674ed9577afb97c78dc18fcd2acfd09776ffc63d37a46420213` | 修复任务 verify27 |
| Reviewer desktop-unit | 15 | 同上 | 修复任务 verify27；755包历史产物身份 |
| Tester unit | 2 runner cases / 9内部完整流情景 | `04defa92ac27adf53158f527bfafa9e66034c3a331d81fb3734c97fe8ee2118b` | 修复任务 verify36；755包历史产物身份 |
| Tester Node 公开 regression（16模块） | 182 | 同上 | 修复任务 verify36 |
| PM desktop-public（13模块串行） | 73 | `e945b68989eda22e61a1c5e878f2f60ba9c609ccd5d38f86d33d7f5f6bfb1643` | public verify6；203.280s |
| 当前11 ZIP Reviewer desktop-unit | 15 | `2dc1e056a395f72b85333d9313e68bc74c25365e6210ef0125aaf81426166dae` | artifact-recheck verify6；3.848s |
| 当前11 ZIP Tester unit | 2 runner cases | `2dc1e056a395f72b85333d9313e68bc74c25365e6210ef0125aaf81426166dae` | artifact-recheck verify11；24.007s |

[原任务](../../../scheduling/legion-desktop-workbench-v2.md)保持 Interface issue33/stop34、全部 inactive。前三阶段候选与五份日志实际未变，作为当前只读前置复用；原 capabilities 的47成绩在五测试 fixture 修改后仅为历史。[fixture 修复任务](../../../scheduling/legion-desktop-workbench-v2-fixture-repair.md) revision36，五节点全 verified/inactive；只改五个已授权测试的 caller 生成路径，其余25 cap 输出只读，再接续原 Interface/package/Reviewer/Tester。这三加五构成当前八个逻辑阶段，不把原 stopped 图表称为八节点全通过。

[公开入口任务](../../../scheduling/legion-desktop-workbench-v2-desktop-public.md) revision6 verified/inactive，零 authored。它真实执行一次 npm --prefix apps/desktop test，重新make ZIP，114 authored、64产品源、152readSet、package/lock/README、Core tarball逐 SHA不变，4837历史 regular files/6links 不变。当前 ZIP 以[公开生成证据](../../../../.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging/final-public-npm-test.json)及当前 descriptor 为准。旧 desktop-package-complete.json（SHA56467145…）未改，是旧755阶段证据，不能代替当前交付。

[当前产物独立复核任务](../../../scheduling/legion-desktop-workbench-v2-artifact-recheck.md) revision11，Reviewer/Tester两节点 verified/inactive，均零 authored。固定当前ZIP/descriptor及源码，采集实际当前证据；未重复无变化的Node182回归。最后 candidate为 `2dc1e056a395f72b85333d9313e68bc74c25365e6210ef0125aaf81426166dae`，不是产品源规范聚合，二者用途分别记录。

## 最终证据入口

| 证据 | SHA256 |
| --- | --- |
| [公开桌面完整证据 JSON](../../../../.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging/final-public-npm-test.json) | `e52a45a99d96ccf5e0010229478f17efa31e8ac8630b4553ecbeb50f7e68c3f2` |
| [公开桌面实际日志](../../../../.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging/final-public-npm-test.log) | `675e8e724359e92c29026854a7865d0c92e2708d7635fbf0f7552a8953454d8b` |
| [当前ZIP Reviewer报告](../../../../.ans/runtime/legion-desktop-workbench-v2/Reviewer/desktop/fixtures/current-artifact-review.json) | `0d3cd11799adb2fb289a00e97f0b291a24b8d50ee2b27a0727208733e3134d71` |
| [当前ZIP Reviewer正式日志](../../../../.ans/runtime/legion-desktop-workbench-v2-artifact-recheck/evidence/reviewer-artifact-1-desktop-unit-b6eef77f.log) | `7b932f2f8069942ca357d3001be956e46c7487fc06d2a0ff9bf964e703dfa0cc` |
| [当前ZIP Tester报告](../../../../.ans/runtime/legion-desktop-workbench-v2/Tester/desktop/fixtures/current-artifact-verification.json) | `a4a4fd465a2ad84c1e2e1dba595cd58439533109c837b38f25fce67823f7e98e` |
| [当前ZIP Tester正式日志](../../../../.ans/runtime/legion-desktop-workbench-v2-artifact-recheck/evidence/tester-artifact-1-unit-802cf5ae.log) | `198ab4ef8873837a8062396580e23bd5c2658cf63b980e3fdcb820ff020f949f` |
| [当前源码完整Node回归与旧755独立验证记录](../../../../.ans/runtime/legion-desktop-workbench-v2/Tester/node/packaging/verification.json) | `be279dc149c494253cb07f0dad94314b12288f595bf94d01486d250af6870ace` |
| [182项Node实际回归日志](../../../../.ans/runtime/legion-desktop-workbench-v2-fixture-repair/evidence/tester-1-regression-cb0d8dee.log) | `43dcc322101f7a0775f0680c4240492fb1e21cc225b944730817261d207ae8ab` |

各阶段完整固定 argv、候选、输入与其余日志 SHA见以上 task_ops 记录。[Reviewer说明](../../Reviewer/docs/review-desktop-workbench-v2.md)和[Tester说明](../../Tester/docs/verification-desktop-workbench-v2.md)在最终检查前封存，其中等待验证文字是当时快照；实际结果由当前 check/complete/verify 与生成报告提供，未修改已验证文档伪造通过。

当前11ZIP验收覆盖真实解压 exe、包内38桌面文件及嵌入Core29项、14窄IPC、主PID绑定原生文件夹选择、真实SDK三协议与项目管理多轮、Human确认后的写入与完整审计、停止撤权、两项目隔离、DPAPI跨进程重启、轮询保留编辑与只读成员。公开入口及独立复核付费调用0；软件检查仍明确 not_executed。

原生代表截图：[当前公开对话浅色](../../../../.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging/desktop-package-conversation-light.png)、[设置深色](../../../../.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging/desktop-package-settings-dark.png)、[960×640对话深色](../../../../.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging/desktop-package-conversation-minimum-dark.png)。PM与Tester生成各自七张真实窗口截图；它们来自实际ZIP/SDK流程，非静态原型。代表图已实际查看，截图不代替行为断言。

## 可复现命令与范围

本开发机公开桌面测试的实际入口如下；会重新make ZIP，随后应按新 descriptor核对产物。阶段门禁仍需各自 task_ops assignment，此命令不代替权限与证据门禁。

```powershell
Set-Location D:/work/code-work/agent-organization-runtime
$phase = Join-Path (Get-Location) '.ans/runtime/legion-desktop-workbench-v2'
$env:LEGION_NODE_TEST_ROLE = 'ProjectManager'
$env:LEGION_DESKTOP_TEST_ROLE = 'ProjectManager'
$env:TEMP = Join-Path $phase 'ProjectManager/desktop/tmp'
$env:TMP = $env:TEMP
$env:npm_config_cache = Join-Path $phase 'ProjectManager/desktop/npm-cache'
$env:NODE_DISABLE_COMPILE_CACHE = '1'
Remove-Item Env:NODE_OPTIONS,Env:NODE_COMPILE_CACHE,Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $env:TEMP,$env:npm_config_cache | Out-Null
node D:/soft/nodejs/node_modules/npm/bin/npm-cli.js --prefix apps/desktop test --ignore-scripts
```

无需模型账号的权限CLI示例（已在PM core-package正式检查验证）：

```powershell
$env:TEMP = Join-Path $phase 'ProjectManager/node/tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
node ./bin/legion.mjs demo
```

CLI显示一项允许、五项拒绝、Frontend内容保持与23个审计事件。产品是Node/ESM；Python仅是外部开发治理工具。Git发布范围及干净clone限制见[发布记录](../../../../.ans/decisions/legion-git-publication.md)：仅新0.4.0有限tgz作为直接依赖纳入，其余runtime、密钥/userData、node_modules/out和私有凭据排除。本地完整回归读取未发布的旧历史保护产物，不能宣称干净clone已经运行过相同完整套件。

没有当前已复现且未修复的产品缺陷。明确限制：验证使用真实SDK与受控localhost模型，没有测试付费账号；测试/发送/确认执行会产生真实推理，费用与未知metadata显示unknown。DPAPI只验证同Windows用户/机器重启，换机需要重新配置密钥。只有受控write_file，没有任意Shell软件检查执行器，生成测试文件不意味着已运行软件测试。两个Core reparse/link用例在宿主EPERM时使用受控lstat元数据刺激，不声称原生junction端到端、恶意同进程或OS攻击隔离。写前审计失败不写文件，写后审计失败如实保留observedMutation并停止；文件与多份日志不构成完整计划事务。

## 版本与历史

当前配置 `2546ebd0b8756eccb83bced6808c10d1c25c3bc175ca8f676a9f1d5172cb706b`，canonical `715639b5dd278437059f29bde1e7c02ac90d94af18f9bf5a6b5367d16e9ab5d3`，[直接客户确认](../../../../.ans/decisions/legion-desktop-workbench-v2-authorization.md) SHA `252ca93cd951947923cc22bc7ce52873a3696c6fe75683e509f52ceda96ce773`；客户选择专注对话。组织v004、121 authored、33 bounded effects未扩大。Supervisor七份协调说明最后独立记录文件SHA，不冒称业务自验收。

原失败证据在 task_ops历史原样保留：Core入口解析/运行环境，Desktop五fixture caller隔离；PM package解压超时、chooser PID驱动与精确Forge private变换三失败；Reviewer产品枚举/draft等待；Tester解压/子进程环境及协议/DTO/typed文本fixture三失败。修复由各自原owner在原scope完成，未削减业务断言或用skip绕过检查。Forge仅删除当前已核验的scripts/devDependencies/private/config.forge，其余manifest完整deepEqual。

[旧GUI v1](delivery-desktop-gui-v1.md)六节点验证后因客户修订暂停Tester，旧观察面板不作为最终满意交付。[Node v3](delivery-node-pi-v3.md)的141项与旧0.3.0包、[Python v1](delivery.md)保留历史，均不冒充当前v2结果。
