# 二哥改名：依赖检查脚本单文件补齐

2026-10-12，PM只读核对并评审，固定Supervisor复核源码；Governance准备精确范围，尚待真人接受。

已接受29文件配置漏列既有PM独占文件`apps/desktop/scripts/verify-dependencies.mjs`。其9–10、17、24、29行固定绑定旧1.2.2包stage、tar与版本，新1.2.3实际安装后无法完成原固定desktop_dependency检查。此前“无硬编码”判断错误。

仅将该文件加入PM writeFiles：29→30，其余角色、文件、检查命令、并发数、原改名设计保持原值。PM将迁移至本次真实新包stage/version，或安全读取当前manifest的本地tar；必须保留tar/sourceHashes/lock resolved及integrity/installed字节/exports/SDK来源全部原强断言。不得用旧包、临时脚本或删除断言替代当前候选验收。

原二哥改名方案仍为aa40f95f…，范围变化只用于完成已经确认的新本地安装包与原依赖门，不新增功能或权限。Desktop原29范围执行可继续，旧任务/包/证据保留；新30配置生效后固定Supervisor接续PM包、Tester验收与交付文档。新条件记录`docs/scheduling/er-ge-display-name-v1-dependency-integration.md`只由固定Supervisor经task_ops维护，生成效果沿原获准fresh根。
