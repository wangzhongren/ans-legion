# GUI v1 有限独立技术审查通过，保留待修订证据

2026-10-07，固定Reviewer向Human与ProjectManager报告：本次检查范围内未发现未解决的合同缺陷。8项独立检查全部通过，零失败、跳过、取消或todo；没有修改生产、其他测试、旧Node包或GUI治理。

依据[canonical](../../../design/2026-10-07_design_desktop-gui-v1.md) SHA256 `58c79cae70bc45dcdda038e0e7944883dbee3ecfb2e277664a5954c3ec6a398d`、[desktop-console](../../../../.ans/contracts/desktop-console.yaml)、实际config `e72ba37fc080453ecf9ef0229c5f6f11bf4e41ecf017cf2febf85cea6ef6d89d`和当前源码。原PM候选 `4e89dccfb774ab55fc6e75886b2a7418ffe15ba89b810aeb2aae5aa97c33f729`只是依赖证据；Reviewer候选与固定日志另由最后unit记录。

## 实际检查

| 独立用例 | 实际结果与覆盖 |
| --- | --- |
| 所有权/层边/Model | 22桌面源码唯一DesktopEngineer；Service/Provider三部分；root仅Interface；相邻public边、无Core调用；Model无导入、clock/random/fs/network效果 |
| IPC | 精确窗口、主frame对象、URL、已销毁窗口；未知操作、路径、projectId及字段不进入业务；合法getState实际投影 |
| 安全DTO | 固定字段、深冻结数组、存储密文/输入key/SDK原始错误不回显；keep/clear/replace及HTTP地址限制 |
| 当前Workspace | 真实v003/7角色、合法task_ops状态与来源时间；两旧Node任务和当前增长的GUI任务均超过1MB，逐项明确来源unavailable |
| 副本记录错误 | 人类表格篡改/坏机器尾拒绝；治理snake引用与camel日镜像独立读取；镜像不符、穿越、未知kind/版本、组织变化及过期快照时间 |
| 公共Pipeline | 真实桌面设置CRUD、无key时不发请求、未选项目不能映射、close后拒绝保存与重复close |
| 真实Electron | 项目安装Electron44.6.0实际启动三页；renderer无process/require；固定8方法；真实DPAPI密文保存/加解密及保存后DTO无key；销毁/重复close/同进程重开窗口 |
| 当前ZIP | 只读解析真实ZIP，descriptor路径/长度/SHA；24个src/main/README逐字节相同；完整生产manifest严格一致，SDK依赖恰为Pi AI1.0.4 |

人工追踪确认Desktop Pipeline仅调用Profiles/Workspace public Services，Profiles只调用Settings/Probe Providers；Provider不收上层业务callback。生产公开工厂只收普通选项，聚焦测试内部构造器不是生产接线。main持有目录选择，renderer不能提供路径/projectId；preload无通用invoke。沙箱、contextIsolation、无Node、禁新窗口/导航/webview与HTML CSP已经实际源码核对，记录通过文本节点显示。catch返回固定安全错误或unavailable，不把失败吞成成功。O1未实现。

## 包与历史

本轮ZIP路径 `.ans/runtime/legion-desktop-gui-v1/packaging/LegionDesktop-0.1.0-win32-x64.zip`，175656986字节，SHA256 `728a7da8fb0c94f5dade821a2edf9b6fa369410d8e2812c4f6417dc7383cf2a8`；当前descriptor SHA256 `1d9f1b583e9324b4adf353509d4117649b4b20616afa78ef29e259c9073a0d3e`。测试使用当次PM descriptor验证产物而非把此历史ZIP哈希当永久源码合同。已读安装的MakerZIP调用cross-zip，没有固定时间归一化；未重新make。

完整manifest变换依据安装源码：packager sanitize删除private/devDependencies/scripts，Forge移除config.forge，余下字段精确deepEqual；没有任意subset比较或忽略未知差异。其24源码/README仍为原字节。

首次普通沙箱8项4通过/4失败：Workspace真实realpath返回EPERM、Electron启动退出2147483651、测试错误地要求Forge manifest原字节。必要提权首轮6通过/2失败：GUI任务已增长到第三个超限来源，native helper在窗口全关闭时过早正常退出。修正Reviewer自己的固定数量/manifest假设，并让helper持有生命周期、必须写所有断言后的文件证据；产品与安全目标未修改，现8项全通过。观察保留在[initial-check.json](../../../../.ans/runtime/legion-desktop-gui-v1/fixtures/Reviewer/initial-check.json)，实际native证据见[native-boundary.json](../../../../.ans/runtime/legion-desktop-gui-v1/fixtures/Reviewer/native-boundary.json)。没有把环境失败记skip。

1MB cap错误名称workspace_corrupt在这里代表reader拒绝超限，不能据此称旧task损坏或执行失败。GUI任务目前也超限，面板显示其来源不可用是既定有限读取行为；组织、角色及其余可读来源继续显示。未改冻结前段来扩大cap。

原25-mjs标准聚合仍为 `75ab247b8aafc224d39c926119e170bc56bbda966073a73eeab3bfa4a4bb8327`，旧tgz仍为 `a83a86499c4aaa7c997d94cabbb697efdc82f81475b622b85307ac682de4d8f0`；只读compat Reviewer测试仍为 `55a5474297ce5494b52f0c492040e24c70aad6572e7c8ddaae880737204e0fdc`。旧141与owner成绩不计为本轮成绩。

## 交付与局限

本轮只写一个GUI测试及六Reviewer说明。最后固定 `node --test apps/desktop/tests/reviewer/desktop-boundaries.test.mjs` 的候选、实际退出码、日志与hash见[task_ops当前任务](../../../scheduling/legion-desktop-gui-v1.md)，检查后不再编辑。测试生成仅本角色fixtures/userData子目录，TEMP/TMP本角色，禁Node compile cache，结束本次Electron进程并清理临时子目录。无收费模型调用、安装、升级、发布或重打包。

本角色真实DPAPI是同进程加解密和窗口重开，不是跨进程重启；真实窗口来自项目安装Electron，不冒充本角色解压ZIP启动。三协议真实请求、跨进程重启、ZIP操作和视觉完整流程由独立Tester继续。词法导入检查不是完备静态证明；本轮没有native链接攻击测试，不冒用旧Node metadata刺激为所有reparse/恶意宿主/OS竞态证明。客户最新反馈需要发送需求聊天入口和更专业UI，v1不称最终满意交付。当前仅向Supervisor提交有限技术证据；Tester保持pending不派发，新聊天工作台方案由管理另评审后取得新scope。完整产品流程尚未独立验收。
