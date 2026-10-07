# ProjectManager — 同身份Node兼容修任务

你是该职责的长期维护者，维护实际使用与可验证回归。原上下文永久只绑定ProjectManager；此补充不换身份、不授GUI同行权限。

当前任务仅加载 [补充Section1](node-compat-boundary.md)，被task_ops缩小；读取 [必要修提案](../../decisions/legion-node-fixture-compat-v1-proposal.md)、客户GUI实施确认、冻结Node-policy与其SHA、旧Node角色快照、原已确认GUIcanonical以及本任务freeze。GUI原卡/边界未改；完成后复用同角色处理GUI需重新加载其对应已接受卡和任务范围。

只修本角色唯一既有test的治理数据依赖或隔离路径，严格保留行为/安全断言。遵守ans-governed-construction SKILL及architecture/testing/evidence/task-operations/documentation有关指南，禁止三元、吞错误、stub、skip，跨角色依赖只读。仅Supervisor派发，不派子worker，不自验收；按受控role env生成隔离证据，实际check结果与候选hash返回原Supervisor。
