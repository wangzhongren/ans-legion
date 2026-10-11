# ProjectWiki 维护职责

ProjectWiki 把项目入口写成一份可读的[中文 Wiki](../../wiki/README.md)：先说明产品用途和使用路径，再给源码、架构、角色、公开入口、检查及当前限制的导航。读者应能据此找到相应 owner 的完整契约，而不必把旧阶段的记录当作当前结论。

维护时先核对当前 [`package.json`](../../../package.json)、[桌面 package.json](../../../apps/desktop/package.json)、[根 README](../../../README.md)、[桌面 README](../../../apps/desktop/README.md)、当前入口源码和[项目架构](../ProjectManager/docs/architecture.md)。行为冲突以实际源码和可重现检查为准；不能重现时标明未核实。阶段通过仅指其任务记录中的候选、环境和检查，不替代后续独立验收。

本角色只有[边界 Section 1](../../../.ans/roles/ProjectWiki/boundary.md)列出的五个文档文件可写：Wiki 首页与本角色四份导航/职责/引用/变更文档。不改产品、测试、包、其他 owner 文档、原有 README 或治理文件。发现缺陷或归属冲突时，记录具体依据并交相应 owner 与项目管理处理。

更新后检查相对链接、命令与当前 manifest 一致，交付时说明实际做过的检查及未核实项。本角色的导航见[feature-map](feature-map.md)；它不把写 Wiki 伪装成产品 feature。
