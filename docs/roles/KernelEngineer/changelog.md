# Kernel 实施历史

## 2026-10-07：工作台 v2 确认与真实上下文重查

客户确认 canonical715639…及专注对话布局后，本角色在新18文件范围实现纯连接/文本/History/Checkpoint、默认 single_run 兼容与空工具 conversation 配置；ContextReadConfirmation/Snapshot/ConfirmedTaskGrant、品牌只读断言、一次 taskApproval 和三方法 lower authority。Storage 根据 typed verification 真实核对根identity与context字节/SHA，最后同步输出目标/父链及授权检查后同步提交。验证失败立即永久 invalid 整个 authority；成功 release 支持同task多次独立 permits，旧审批和 audit_failed 如实语义保持。

实际分层 Model45、Storage/Event24、Policy/Scope17，均0skip。Model 首跑44/1失败是精确事件列表尚未追加已授权 text_delta，保留原五值后通过。Storage 首跑14/9失败是 async realpath EPERM，改用同产品原生 realpathSync；次跑21/2失败是 TEMP 正斜杠与 Node join 反斜杠的字面 prefix 验证，改为 resolve/relative 的严格范围断言。最终输出父链 timing 回归先23/1失败（guard 仍在临时文件创建前），移至最后提交前后24通过；原业务断言保留。失败日志在本阶段 KernelEngineer/tmp。context junction 本机 EPERM 采用注明的 lstat 元数据；输出父链晚变 timing 也是受控元数据刺激，不声称 native junction/reparse E2E。其余 root替换/恢复、同size恢复mtime、字节增长/删除、等待中变更、提交及审计原生实跑。

[本角色设计](docs/design/2026-10-07_design_desktop-workbench-v2.md) · [API](api-spec.md) · [最终固定九suite、候选和日志](../../scheduling/legion-desktop-workbench-v2.md)。旧Node包/74项成绩、Adapter/桌面/发行保持历史或下游待验；软件检查无executor显示not_executed。本条是owner层实现记录，不替代Supervisor verify及独立验收。

2026-10-07，legion-v1：完成不可变模型、五类纯权限判定、绑定身份/版本/边界/摘要的单次许可、受控文件替换、Control Plane EventLog 和 permission demo。旧许可在任务状态、版本或边界更新后永久失效。直接 public Provider/Mutation 与自行构造 ALLOW/permit 均不能授予写权限。

执行顺序证据：Model 5 项 → Policy 6 项（合计 11）→ Provider 8 项 → Mutation Service/Provider 10 项 → EventLog/Pipeline 合计 29 项 → Demo/Runtime 后 37 项 → Control Plane index/daily、时间和失败一致性测试后 40 项。每次连接依赖前运行真实 unittest；代码后续变化使有关旧证据失效，最后当前 unit/demo 由 task_ops 重跑。

[本次设计](docs/design/2026-10-07_design_phase1.md) · [当前功能](docs/feature/permission.md) · [公开 API](api-spec.md) · [最终证据](../../scheduling/legion-v1-development.md)。本条为 owner 实施记录，不替代 Supervisor 的独立验收。

## 2026-10-07：同版审批与边界输入修复

独立 Reviewer 的原 pinned 检查 23 项中两项失败（5 个断言），指出路径审批大小写/分隔符别名绕过，以及 scalar collection 被拆成字符后丢失限制。原 candidate 678dca60177e5e0efcc740de10e5c7b1eab6392bc0283b96d57e35072f5f4faa 与相关 40 项 owner 证据保留为历史，不能作为修复后的当前证据。

修复为统一纯 Model 审批谓词，在策略和许可复核中按实际资源语义匹配；动作审批 write_file 保持有效。构造边界拒绝七字段的 scalar str/bytes/bytearray 与不可迭代输入，非法资源审批条件抛 ValueError。Owner 按依赖顺序运行 Model 7、Policy 8、Mutation/Provider 13；完整 47 项通过。Reviewer 原样两项测试只读重跑两项通过，未修改任何独立断言。

[设计中的修复记录](docs/design/2026-10-07_design_phase1.md) · [当前功能](docs/feature/permission.md) · [独立缺陷发现](../Reviewer/docs/review.md) · [新候选证据](../../scheduling/legion-v1-approval-repair.md)。最终 unit/demo 在全部文档完成后由 task_ops 重跑；Supervisor 调度 Model 消费者的独立复核，不以 owner 结果替代独立验收。

## 2026-10-07：全 Node + Pi v3

客户直接授权全 Node 产品运行迁移；已接受 canonical v3 替代 Python 产品与 bridge 草案。前置 deps、Model、Adapter verified 后，本阶段实现12个 Node runtime 源码、6个测试与7份当前文档；Model4文件、Adapter、package/lock和全部Python历史不改。当前入口 createRuntime 以数组 modelProviders、可信 dispatchContext 和精确实例范围创建真实 Pi Session，一实例一次 run，取消先撤销权利再释放资源。

合法边保持 Interface→单 PermissionRuntime→Policy/Mutation/Proposal/PiAgent Service→各自 Provider。纯审批别名与 scalar集合回归保留；opaque单次许可、异步等待及最终提交前重验、控制面禁止、index/daily +08:00审计、同工作区提交协调与真实 observedMutation/auditFailed 语义已实跑。无SDK跳过、付费请求或Provider上调callback；同步 rename 避免正常事件循环撤销插入最后重验与提交之间。

实际分层：policy/scope15通过；mutation/events首轮12通过2失败（本机junction创建EPERM），限制内元数据刺激修正后14通过0skip；pipeline首轮11通过1失败（已发生取消但消息正则不匹配），严格AbortError断言修正后12通过。全部八suite73通过0skip；两个链接用例不是nativejunction/reparse端到端，其他文件审计与真实Pi会话原生实跑。原失败日志保留在当前任务，不以旧Python成绩替代Node证据。

[当前设计](docs/design/2026-10-07_design_node-pi-v3.md) · [权限流程](docs/feature/permission.md) · [具名实例](docs/feature/generic-agents.md) · [API](api-spec.md) · [最终五项检查及候选](../../scheduling/legion-pi-node-v3.md)。本条为owner完成记录，Supervisor verify、package与独立Reviewer/Tester验收尚需下游完成。

## 2026-10-07：Runtime.close 终态审计顺序修复

独立 Tester 原20项19通过/1失败/0skip：活动真实 Pi 被 Runtime.close 取消后，Mutation先关闭，run终态审计才执行，使正确取消变为 failed/kernel_audit_failed。原严格测试、失败日志与73项owner旧证据保持历史。本角色只读单例修前复现失败，未修改Tester源码或断言。

最小修复只改 permission Pipeline：私有记录完整 activeRun Promise，close同步撤权后等待Adapter停止与所有run终态审计，再关闭Mutation；run.finally不回等Runtime.close。异常仍明确传播，真实审计失败不转成取消。新增1个必要owner真实SDK关闭回归，自有pipeline13通过；原严格Tester单例修后1通过0skip。当前完整owner74项及五项最终配置检查见[修复任务](../../scheduling/legion-pi-node-v3-close-repair.md)。本次实际改动为Pipeline、1测试和7份当前文档，公共API/Model/Adapter/config/canonical/package/Python历史不改。下游包与独立验收按新候选刷新。
