# GUI v1 必要安装范围细化

用户同版“开发”授权继续有效；canonical设计、产品行为、组织关系和O1未选均不变。原PM经Supervisor报告：ignore-scripts后的Electron安装需固定版本官方下载、checksum和任务局部cache；公开SDK及实际binary检查需可重复执行。Governance在首次dispatch前增加两个PM精确工具路径，不增加业务能力，不授通用脚本/全局安装权限。

- apps/desktop/scripts/install-electron.mjs
- apps/desktop/scripts/verify-dependencies.mjs
- .ans/runtime/legion-desktop-gui-v1/electron-cache/（PM生成范围）

deps节点现4文件、dependency和sdk两项严格检查；其工具与包锁同节点通过后冻结。安装必须官方完整性校验、实际binary存在、Electron内置Node>=22.19、Pi AI1.0.4三公开API真实导入，缺失直接失败。GUI全范围69 authored文件；配置SHA e72ba37fc080453ecf9ef0229c5f6f11bf4e41ecf017cf2febf85cea6ef6d89d。初始未派发配置备份在legion-desktop-gui-v1-initial-policy.json；当前freeze/manifest/stages及handoff一致更新。没有应用/测试文件由Governance写入。
