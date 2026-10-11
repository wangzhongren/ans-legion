# Legion 客户项目广读精写 v1 授权记录

- 日期：2026-10-08（Asia/Shanghai）。
- 客户要求：Legion 产品中每个角色在当前客户项目内广泛读取普通文件，写入仍限定在已确认任务的精确范围。
- 客户澄清：适用于 PM 和执行成员；排除 `.git`、`.ans`、`.aws` 等控制及凭据目录。
- 客户已确认 `legion-project-wide-read-v1` 设计草案并指示实施，同时授权必要的角色 Section 1 边界与任务配置更新。
- 被确认的方案将归档在 `docs/roles/ProjectManager/docs/design/2026-10-08_design_legion-project-wide-read.md`。该确认授权方案及必要治理准备；实际代码与验证结果仍须由相应角色产生。
- 本任务新配置：`.ans/decisions/legion-project-wide-read-v1-project.json`。使用 `task_ops` 前仍须按其协议取得客户审阅配置的精确 SHA-256，不能由开发者自行生成哈希代替客户审阅。
