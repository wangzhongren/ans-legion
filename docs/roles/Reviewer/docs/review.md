# 独立审查：两项原 P1 已修复，当前检查通过

面向 Human 与 ProjectManager：KernelEngineer 已修复原审批绕过与非法边界输入丢失限制。本角色在新分配 legion-v1-approval-repair 独立读取实际修复，原样 23 项检查全部通过，当前检查范围内没有未解决发现。Reviewer 不修复其他角色代码、不自验收；Supervisor 检查最终证据后继续 Tester 集成。

审查依据为 [已接受设计](../../../design/2026-10-07_design_legion-v1.md)、[runtime 合同](../../../../.ans/contracts/kernel-runtime.yaml)、[adapter 合同](../../../../.ans/contracts/kernel-adapter.yaml)、实际源码与两个 owner API/feature 文档。当前 Kernel candidate 为 `d73b364c0660fb1abcae803d3f914faeb75c8c73d2b56c231d036ea62fa584f2`（owner 47 项与 demo），受影响 Adapter 当前组合为 `84a356064f6c36b286794604514d653cd61e4b7497500d38766e2ee4dd064476`（owner 14 项）。Reviewer 最终七文件及依赖候选由文档完成后的 pinned unit 写入 [修复任务记录](../../../scheduling/legion-v1-approval-repair.md)，不是 Git 提交。

本次最小生产修复已独立检查：Model `_collection` 拒绝 str/bytes/bytearray 与不可迭代值；`requires_approval` 对 action token 保持精确匹配，对路径统一 normalize_resource/casefold。Policy 第 32 行与 Model authority 第 253 行共用此纯谓词，deny 优先与单次许可撤销保持不变；非法审批路径构造时拒绝。未新增效果、同行 Service 调用、权限范围或 Adapter 协议。Reviewer 原测试源码 SHA-256 `3ecad393e318da89ac6d241c94af1bd1b62b9ce3ceef3c5b476e00c618755b9e`，原样 23 项重跑全部通过，0 跳过，退出码 0。

## 历史 P1：Windows 文件别名绕过路径审批（已修复）

原缺陷位置：[PolicyService](../../../../src/kernel/services/impl/policy.py) 第 32 行和 [Model authority](../../../../src/kernel/models/core.py) 原第 228 行均以原始字符串成员关系匹配 required_approvals。以下表格与复现保留原候选观察，不代表修复后的行为。

可信 Backend Session 为 v1，write_scope=('backend/',)，tools={'legion_write_file'}，capabilities={'write_file'}，required_approvals={'backend/approved.txt'}。调用正常 PermissionRuntime.submit(ActionProposal(...)) 的结果如下：

| resource | 实际决策 | 实际修改结果 | 应有结果 |
| --- | --- | --- | --- |
| backend/approved.txt | REQUIRE_APPROVAL | denied | REQUIRE_APPROVAL，无写入 |
| BACKEND/APPROVED.TXT | ALLOW | written | REQUIRE_APPROVAL，无写入 |
| backend\\approved.txt | ALLOW | written | REQUIRE_APPROVAL，无写入 |

在随机临时 Windows workspace 实际执行，后两者指向同一目标，目录与文件被创建。审批是现有契约要求，不是可选加固。原 owner 应统一策略与执行前复核的路径身份比较；action 审批仍须保持 deny 优先。回归为 [test_path_approval_cannot_be_bypassed_by_case_or_separator](../../../../tests/reviewer/test_structure.py)。issue `reviewer-approval-alias` 已通过 task_ops 接受，stateRevision 18 / event legion-v1-development-18。Supervisor 已收到复现与原 owner 修复请求。

## 历史第二项 P1 与失败证据（已修复）

原第二个 P1 位于 [Model](../../../../src/kernel/models/core.py) 原第 34–45 行：collection 字段直接 tuple()/frozenset() 转换，scalar str 被拆成字符。保留合法 backend/ write scope、工具和能力，分别传 deny_scope='backend/private/' 或 required_approvals='write_file'，构造没有错误；正常 Runtime.submit 写 backend/private/key.txt 或 backend/file.txt，均 ALLOW/written。前者字符 tuple 无法匹配目录，后者字符 frozenset 无法匹配 action。非法限制输入应在构造时 fail closed，不能静默减少权限限制。原 Kernel owner 现已修复集合字段类型验证；原样严格回归 `test_scalar_restriction_fields_are_rejected_before_authorization` 两子例均通过。

Windows / Python 3.14.0，在项目根初次运行配置中的 unittest discover('tests/reviewer')，22 个测试，21 项测试通过；审批别名测试出现 3 个失败断言（两个别名决策以及目标目录已经创建），0 跳过，进程退出码 1。增加 scalar restriction 回归后的原 pinned unit 实际为 23 个测试、21 项通过、两个失败测试/5 个失败断言、0 跳过、退出码 1。历史 candidate `827c967413f383a37f109eaa32347fb4ce13ae9431950d4b4de96c1a2d848898`，[原失败日志](../../../../.ans/runtime/legion-v1-development/evidence/reviewer-1-unit-e51e1f72.log)，日志 SHA-256 `9ea4148db392f28f4c7eb0056e6044e27a6380efffeb82eef14e1476ac13e109`。原 Kernel `678dca60177e5e0efcc740de10e5c7b1eab6392bc0283b96d57e35072f5f4faa` 与 Adapter 组合 `82c195e32d7f3de226d401d1287e620004d5bf11291de081bbedff20495d3fc9` 保留为历史；[原任务记录](../../../scheduling/legion-v1-development.md)不作为当前候选验收证据。

## 当前检查覆盖

已通过的动态检查涵盖：无私有 authority 的原始 Service/Provider 公共工厂拒绝伪造 ALLOW 和任意 permit；raw audit append 拒绝；Runtime 伪造/重放拒绝；许可绑定内容、资源、ID、固定 Session；Session 冻结与对象登记身份；两适配器忽略角色等权限声明；默认无 scope；deny 优先及 deny 路径别名；控制面/绝对/遍历/设备路径；task/version/boundary 变更后回退仍永久撤销旧许可。

审计动态检查在临时 workspace 的 .ans/events/index.jsonl 与日期 JSONL 实际读取：序号、身份、相关 ID、Provider +08:00 时间、镜像一致性、正文与异常秘密不出现。daily/index 分裂关闭后续动作；实际 append 故障发生在 mutation_intent 时未创建目标目录，发生在 write 后 mutation_success daily append 时返回 audit_failed 和 observed_mutation=true，后续动作关闭。没有跨文件事务或自动回滚声明。

结构检查与人工源码追踪共同完成：15 个当前源码文件均有单一精确 owner；Service/Provider 三段结构、public 显式出口与局部 factory、Interface→Pipeline→Service→Provider、Adapter 仅共享 Model。Model 只包含共享不可变数据与 runtime 授权不变量，无文件/网络/时间/随机效果；私有 authority 通过相邻层注入，Mutation 不隐藏调用 Policy 同行或回调。未见三元、吞异常、跨对象双下划线内部字段读取、循环依赖、下层对象返给上层或接口导入初始化资源。AST 回归只覆盖列出的可判定规则，不宣称自动证明全部架构语义。

责任分离符合当前设计：Policy 做纯策略；Mutation 映射 storage/error；Provider 负责真实文件、安全目标、时间和双日志；Pipeline 编排并持有 authority；Interface 输出 demo；Adapter 无厂商/CLI 副作用。两业务 feature 文档与 public API 对实际入口的描述已人工核对；审查职责导航见 [feature-map.md](../feature-map.md)，不伪造 Reviewer 业务功能。

## 范围与剩余工作

重解析测试在 Provider 实际检测分支作受控注入，覆盖 business parent、工作区根、.ans 和 events；本次没有声称创建了真实 Windows junction/symlink，未验证恶意宿主竞争替换或 workspace 上级路径并发修改。保证限于正常公共 API，不扩大到恶意私有导入、管理员或进程内改写。

本角色未运行整个 owner 套件或 Tester 集成套件；读取 owner 当前 47/14 项证据作为基线，不能替代当前独立集成。本次仅更新六份 Reviewer 文档，原 23 项测试与所有断言保持不变，未改生产、合同或配置。Reviewer 检查完成、原两个 P1 在当前回归范围内已关闭；剩余步骤为 Supervisor 核对 pinned 当前候选并验收 Reviewer，再由 Tester 独立完整流程验证。任何依赖后续改变均需刷新有关证据。
