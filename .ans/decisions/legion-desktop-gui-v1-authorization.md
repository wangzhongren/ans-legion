# Legion Desktop GUI v1 实施确认

日期：2026-10-07，Asia/Shanghai。授权来源是客户直接消息，不是SHA、管理推荐或测试成绩。

客户先要求桌面GUI，能配置AI、看到角色和状态。已展示并链接GUI v1和只读评审结果，明确首版三页、独立Electron/Node桌面包、Windows便携ZIP，以及O1任务启停不在首版。
客户在该审批简报后明确回复：`开发`。这是本版文档确认及实施指令，无需重复询问。

已确认版本：legion-desktop-gui-v1；canonical `docs/design/2026-10-07_design_desktop-gui-v1.md`；SHA256 `58c79cae70bc45dcdda038e0e7944883dbee3ecfb2e277664a5954c3ec6a398d`。管理同版recommend approval见 [review](legion-desktop-gui-v1-review.md)。

覆盖：新增DesktopEngineer、唯一源码/测试/文档所有权、配置持久化与本机加密、受控连接测试、只读角色与状态、Windows真实Electron操作/重启加密/打包解压启动验收。O1仍未选择，不派发或启停Agent。
允许原固定Supervisor唯一调度、维护七份本阶段协调文档及接收记录；业务由各角色原独立上下文完成，新DesktopEngineer使用新独立上下文。

Node/Pi v3源码、root package/lock/CLI与既有27文件包只读，v002与政策/角色定义已快照。新组织与规则SHA仅固定已确认范围，不冒充额外人类授权。

安装仅项目局部桌面依赖，缓存及Electron官方二进制下载在PM生成范围；ignore-scripts安装后可显式执行唯一必要Electron官方安装脚本。新checks可启动项目依赖Electron、localhost受控HTTP、创建独立userData/fixtures/截图、结束自己启动的进程；不能读写全局Pi配置、发布或删除无关数据。
