# Bootstrap 候选核验

生产者：ANS Governance；日期：2026-10-07（Asia/Shanghai）；范围：proposal-v1 治理候选。本记录不代表客户接受或运行时行为验证。

- 9 个角色各具备 README、role.yaml、boundary.yaml、state.yaml、role-card.md、boundary.md、changelog.md。
- PowerShell 对 129 个候选路径授予做两两比较：没有跨角色重复路径或目录覆盖冲突。
- PowerShell 对 18 个 proposed 任务节点做拓扑遍历：没有循环或缺失前置节点。
- Python / PyYAML 检查 38 个 YAML 可解析、Markdown 链接存在、机器与人类边界路径一致、原始需求副本字节相同。
- 检查正式版本、批准记录、事件目录为空；没有源码、测试代码或构建配置。

详细环境、输入文件 SHA-256 与结果将写入同目录 bootstrap-manifest.json。清单覆盖本次核验时的治理文件，不包含清单自身。

初次检查的预期 YAML 数量写错为 39，实际为 38，已按文件清单纠正；随后发现本验证记录尚未创建，补齐后重新检查所有链接。没有修改断言含义或权限来掩盖产品失败。

业务测试未运行，因为当前阶段禁止业务实现；Policy Kernel 隔离、真实 mutation、组织原子提交和 Demo A/B/C 都还是待实现与待验证设计。源码目录尚未创建，因此源码精确所有权是计划，不是现有代码覆盖证明。
