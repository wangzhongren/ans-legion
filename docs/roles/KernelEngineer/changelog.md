# Kernel 实施历史

## 2026-10-08：归属表嵌套保护路径补强

上一候选的 `ProjectFileOwners`、申领和转交只用旧 `normalizeResource`，会接受 `src/.git/config` 等嵌套控制路径。现改为复用受控读的纯路径规则，阻断任一层控制/已知凭据组件及大小写别名，普通嵌套文件仍可归属。新增纯 Model 回归覆盖 owner 快照、计划、转交、查询四个入口。当前检查和候选见[补强任务](../../scheduling/legion-file-ownership-and-agent-edit-v1-owner-path-repair.md)；前一阶段的验证不覆盖这项修复。

## 2026-10-08：角色文件独占与 Agent 受控编辑 v1

新增纯项目文件归属快照、申领/转交计划与冲突错误；不同角色的写范围在 Runtime 构造和更新前检查，拒绝更新不改变边界或旧许可。Workbench 确认绑定 owner 摘要，提交链在 issue/consume/recheck 核对角色和文件归属，宿主提供当前归属变化时永久撤销旧 authority。执行 Agent 的局部编辑提案绑定读取的完整 SHA、1–16个唯一替换及既有角色/任务/实例许可；Storage 对现有UTF-8文件按序验证后原子替换，最终结果和审计只写完整新内容的 SHA。旧全文件写、项目读和审批保持。Owner Model、Policy、Storage、Runtime 新用例及当前证据见[任务记录](../../scheduling/legion-file-ownership-and-agent-edit-v1.md)；Adapter、Desktop 和独立验收按实际新候选重跑。

## 2026-10-08：项目广读凭据路径修复

Reviewer 用假 token 确认 `.npmrc/.netrc` 原先可通过直接读取取得正文。本角色扩展唯一纯 Model 读路径规则，加入明确的常见凭据文件和目录名单；Policy 与 Storage 的读取/目录列表沿用同一规则，大小写及嵌套路径一致拒绝。新增 Model 和真实 Read Service 回归，检验拒绝结果不含正文、目录不列出这些名字，同时保留普通文件可读。名单和不能识别任意命名秘密的限制见[API](api-spec.md)。当前候选及检查见[修复任务](../../scheduling/legion-project-wide-read-v1-credential-repair.md)；独立 Reviewer/Tester 复核仍由调度方完成。

## 2026-10-08：项目内广读 v1

新增项目根只读授权、独立读请求/决定/结果、Read Service 和 Storage 安全目录列表/文件分段读取。Node Runtime 显式 `projectRead:true` 才接入两项受控工具；PM 可零写授权读取，执行成员可在精确写 grant 旁申请读取。旧 permit、审计与写 `writeSet` 保持原判定。路径规则拒绝控制/常见凭据、越根、链接、非普通文件及无效UTF-8；列表200项/页，文本64KiB/次、2MiB/轮。新增 owner 用例覆盖独立类型、PM 授权、分页续读和受限路径。当前证据见[项目广读任务](../../scheduling/legion-project-wide-read-v1.md)，最终集成由后续角色复核。

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

## 2026-10-08：完整组织工作流的真实软件检查

共享 Model 已在独立契约阶段 verified，本阶段实现 core/Policy 七工具的精确 capability/check spec 交集、公共 CheckService 与 macOS CheckProvider 三层。Service 自行创建相邻 Provider，live validator 只在 Service；构造 typed authorization 不能得到批准，角色/任务/实例/确认改变会撤销。

固定 Node 同进程检查使用实际 macOS deny process-fork、独立 fd3 reporter 和有界日志。真实 Node 通过、非零失败、空文件/假 TAP、无网络/localhost、文件读取/写入拒绝、root/输入/授权变化、取消/超时及 close 已覆盖。首次 sandbox 初始化与 detached 清理严格失败保留；Supervisor 确认 no-child-process 模式后复验。需要派生进程的测试明确失败；不支持隔离/运行时不会降级。既有测试 fixture 改到本角色本阶段 runtime，demo 增加可选显式 workspace 并修复 Storage 缺省临时路径的物理祖先问题。

当前固定 unit 153 项通过、0 fail/skip；最终 candidate/check 日志以[任务记录](../../scheduling/legion-governed-workflow-v1.md)为准。未改冻结 check/agent/workbench Models、Model 测试或契约文档；独立 Tester/Reviewer 与 Desktop/SDK 完整接线仍由后续 owner 验证。[API](api-spec.md) · [检查功能](docs/feature/software-checks.md) · [共享契约设计](docs/design/2026-10-08_design_software-checks.md)。

## 2026-10-08：软件检查结果通道返修

协调者审阅发现 isolation=none 中 fd3 仍由候选进程可写。原 owner 用空候选直接发送 test:pass 真实复现错误通过；严格失败记录保留于[返修任务](../../scheduling/legion-governed-workflow-v1-reporter-repair.md)。

本次仅改批准的 5 文件：Check Provider、Provider 测试及 API/检查功能/本历史。宿主随机运行认证材料经初始化管道消费后关闭，reporter 绑定 Node 初始化创建的单一实例、捕获原方法，collector 校验认证和顺序；裸 JSON 或假 MAC 不能计数。固定 Node API 限制及探测覆盖 inspector、binding、addon、worker，真实 macOS 文件规则和 deny process-fork 保持有效。skip/todo 不冒充已执行，已观察失败不凭退出0获得通过。

当前 160 项 unit 通过，包含全部原 153 项以及直接 fd3、假 MAC、reporter 重用、ESM builtin 方法替换、stream 结束入口替换和反射 API 场景。最终候选以 task_ops 记录为准。公开 Model/Service、其他角色和包导出未改。此修复仅声明已测试场景的结果校验，不构成针对同进程任意恶意 JavaScript 的一般不可篡改保证；独立验收仍负责测试覆盖与内容。[API 说明](api-spec.md) · [检查流程](docs/feature/software-checks.md)。

## 2026-10-08：Electron Node 检查运行参数兼容

PM 用实际 Electron 44.6/Node v24.21.0 发现 NODE_OPTIONS 被 other-app 调用禁用，process.permission 缺失，普通有效检查返回 unsupported。仅在正式派发的 7 文件内返修：权限参数显式移到 probe/run 实际 argv，Service 同步准确完整前缀检查，两类 owner 测试加入真实 Electron；公开 API、功能说明记录真实参数与结果。未修改 Model、逻辑 CheckSpec.argv、审批契约、vendor 或其他角色。

本机普通 Node 原 160 项回归与新增 Electron Provider 通过/非零失败、public Service live 批准/typed 结果合计 162 项通过，0 fail/skip。结果通道认证、补充 API 限制及实际 macOS no-child-process/文件约束保持原强度；不把 unsupported 放宽为成功。PM 按新候选刷新包和实际宿主集成。[兼容返修任务](../../scheduling/legion-governed-workflow-v1-electron-runner-repair.md) · [API](api-spec.md) · [检查流程](docs/feature/software-checks.md)。

## 2026-10-10 项目 Shell v1

新增7个Shell源码与3组自有测试，保持原固定checks无子进程语义。原Core/Agent/Workbench/Policy/Storage增加Host-only publication receipt、全owner/artifact边界、delete墓碑、explicit absent/generation。真实native逃组发现已改用permission signature回收；限定trust boundary与toolchain前提均记入API/owner设计。三精确 checks 及最终验收状态见 task_ops 同候选记录；不宣称跨平台或 Desktop 完整 flow 验证。

## 2026-10-10 依赖读取兼容修复

同批准v1的7文件repair：fixed dependencies允许经验证输入内链，本条生成/写/发布仍精确隔离；完整input generation钉住files/links/exec/dir，Provider独立write基线保护发布范围。新增实际only-dist .bin build、readonly变化拒绝、同bytes链接retarget stale与既有链接guard测试。实际新task的三checks/candidate/7 source hashes为验收依据，未声称旧0.8.0已包含该修复。

## 2026-10-10 Model 时间事实纯度修复

消除3处Model live clock读取，Provider fresh observeTime经Service/Pipeline显式传递给纯Model；Host publication控制器第三时间参数必需。失败消费不可回退事实重放，Storage每次consume/verify/同步commit前新观察，普通SDK无新clock字段。必要Model/真实Provider/Storage expiry检查已通过，最终同candidate三门与21文件sourceHashes依新task记录；Reviewer原断言保持只读。

## 2026-10-10 CLI 角色 owner v2

运行时任务 writeSet 已移除，旧 grants 拒绝；角色 owner digest/generation 绑定实例、Policy 与 Shell 源码候选。同角色源码 run 串行，分类记忆与监督新增三个独立 capability 控制工具。保留原 edit CAS、上下文验证与审计。提交前持久owner重读采用PM确认的纯数据source-marker/leaseContext协议：Storage自行FS取得共享commit锁、核holder/marker/catalog与最终同步owner，旧IO回调方案已删除。最终检查实际输出与候选见本阶段任务记录；不把Kernel unit当下游CLI完整验收。

## 2026-10-10 最终owner重读schema修复

锁内当前catalog/project都必须schema2，当前plan/task中的writeSet拒绝并永久撤权；legacyHistory保留只读。私有demo/fixture项目明确schema2。新增真实持久回写回归保持owner映射/generation不变，在临时文件建立后回退catalog或project schema、或注入当前plan/task旧授权，验证拒写、无效果、原authority不可复活；另验证legacyHistory不授权也不阻断当前合法写。检查与新候选见schema-repair任务记录；旧候选与报告保留历史。

## 2026-10-11 Check/Shell已知原始key守门

两个Service经既有public factory私下传knownKeys给各自Provider，不入Model/授权/digest/env/DTO。Shell复制原文件前拒绝当时命中的字节，并在父进程跨chunk输出累积、回调及output.json前拒绝；Check输入核验命中则不启动，父进程stdout/stderr及认证event字段也先守门。四套测试以真实随机canary和子进程分块输出验证，检查本run文件/回调与原客户字节。正常无key功能仍走原完整隔离门；当前check输出见key-guard任务记录。

保证限定于已知原始值的指定路径：Check可变输入TOCTOU与子进程重构后直写tmp/outputs不被四impl覆盖，不宣称全称从未落盘。原客户文件及历史partial/包/日志保留；Desktop后续在自身factory传当前密钥集合。

## 2026-10-11 Su唯一客户入口控制契约

已确认v0.3下新增delegate_pm/query_role_activity/query_role_log及三个独立capability；复用现typed Pi外壳。委托start/resume互斥、指令8KiB、来源32×200、日志最多50条、查询结果payload32KiB；拒绝伪调用方/Human value/混用字段/预算越界。前后台查询均只读；foreground委托、真实Human续答、cursor来源和关联run2MiB累计预算由Host登记并校验，纯Model不按模型purpose授权。

新增Su无owner写权时实际跨role读取普通文件与Restricted/链接/旧run拒绝对照；Read/Policy/Provider及owner/grant接口未改。三个工具不能使前后台得到write/edit/Check/Shell。完整Kernel固定unit与候选见legion-supervisor-frontdoor-v1任务，Adapter/Host用途隔离与CLI持续对话验收需其各owner继续验证。
