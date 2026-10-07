# 交给独立 Supervisor 上下文

客户给出六角色 Legion Runtime Organization Proposal v1 并明确说“开发”。本上下文保持 ANS Governance；你必须只绑定已接受 Supervisor scheduler，不继承 Governance 身份。读取 role-card/boundary、设计 legion-v1 与 `.ans/project.json`。

已完成 accepted 六角色、组织 v001、kernel-adapter 与 kernel-runtime、精确可写文件策略。本版授权覆盖五步 permission demo 和两个本地提案适配器，标准库测试、独立 Reviewer 与 Tester；无真实模型调用。

task_ops 使用该明确用户指令作为权限证据，config hash 仅固定配置内容，不能说 hash 自身是批准。项目 role 定义已 autoDispatch 到确切 owner 的本版任务；只派发新上下文、fork_turns=none，卡和边界须先加载。无需重复确认。

用 task_ops 初始化 bounded task：kernel（Model→Policy→Gate→EventLog→Demo，要求逐层先测试）→ adapter → review → integration。worker 内部里程碑保持五步順序；代码源码未存在，不凭空写结果。每个 worker 在自己 scope 写功能导航、当前功能 flowchart 与实际 api-spec；角色无直接功能写明即可。

Reviewer 与 Tester 验证当前真实组合版本。缺陷必须返回原 owner，上游输出变更使 task_ops 下游证据失效，必要时 stop/revise/redispatch，禁止 Reviewer 或 Tester 修生产代码。不可修改配置/边界来让通过。Supervisor 独占 task_ops coordinator token，只向所属 worker 提供 assignment token，不写公开文档。

可在初期把四个节点均写进 plan；kernel/adapter 各自 code+tests+docs 的完整 writeSet 必须来自 pinned config；review/integration 各自专属 checks。所有必需文件作为输出；真实文件候选和实际 check 成功后 verify。开发文档在 docs/roles/<Role>，控制面仍在 .ans。交付时给可运行 demo 命令、测试结论和局限。

kernel-runtime 信任边界限正常受控 API；标准 Python 宿主不是恶意共享进程 sandbox。Raw provider 公共 API 与伪造 ALLOW 不能绕过授权。readonly 身份绑定、deny优先、路径边界、版本/task/参数重查和日志失败必须有可复现证据。最小本地方案不实现完整组织事务、审批创建角色或 Web UI。
