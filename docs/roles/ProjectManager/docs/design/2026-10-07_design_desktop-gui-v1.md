---
date: 2026-10-07
timezone: Asia/Shanghai
status: authorized-implementation
---

# Windows 桌面发行：已接受 GUI v1 的管理实现

客户对[冻结 canonical](../../../../design/2026-10-07_design_desktop-gui-v1.md)回复开发，SHA256 为58c79cae70bc45dcdda038e0e7944883dbee3ecfb2e277664a5954c3ec6a398d。首版三页配置/角色映射/真实记录观察；O1 创建启动取消 Agent 任务未选择。此文件解释当前发行实现，不追加设计或权限。

采用独立 apps/desktop ESM package，Electron44.6.0/Forge8.0.1/Playwright1.63.0/PiAI1.0.4 已实际安装并验收冻结。PM entry 只调用公开 startDesktop，启动 Promise 让 ESM loader 完成；退出等待公开 close。Forge 使用核验的本任务 Electron archive，以无 asar、生产依赖 prune 的 Windows ZIP 发行，便于严格核验实际包内容。

用户解压完整 ZIP 后双击 LegionDesktop.exe；不需要安装 Python 或外部 Node。主进程密钥 DPAPI，renderer 无 Node；失败不明文回退。历史超1MB任务读取显示 unavailable，不把记录状态等同 Agent 在线或全部业务成功。

发行检查两项：入口导入/输入验证，当前 ZIP make→解压→包内 Pi 三公开 API→真实窗口三页/隔离→退出。SDK/二进制缺失失败，所有生成物归本任务 PM 范围。旧源码25、root package/lock/README、旧稳定tarball与cache逐文件前后哈希比较；不发布 registry。[当前发行流程](../feature/desktop-distribution.md)和[任务记录](../../../../scheduling/legion-desktop-gui-v1.md)记录实际检查，独立 Reviewer/Tester 后续验收不由管理烟测替代。
