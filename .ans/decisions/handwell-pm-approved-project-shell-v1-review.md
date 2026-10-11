# Handwell 项目 Shell 设计管理评审

ProjectManager 综合终审结论：recommend approval。

评审对象：[v1 设计](2026-10-10_design_handwell-pm-approved-project-shell.md)，SHA-256 `a5a0166dcd302ecd65416b85b2801a5a687972481e90f80c31ea23959eff59c0`。

KernelEngineer、AgentAdapterEngineer 和 DesktopEngineer 在各自固定独立上下文完成只读影响评估；ProjectManager 实际复读修订稿后推荐批准。所有角色均未修改应用代码或测试，未运行客户命令。

推荐理由：通用 Shell 保留角色自己执行、原工具调用与持续上下文；PM 逐调用结构化审批；隔离项目副本与受控发布维持文件独占。与直接授权原目录父目录相比，这一方案增加复制和发布成本，但更适合现有精确文件边界。

已纳入修订：OS/链接/IPC/进程树隔离；single_run 预算契约；PM 独立队列且不撤销原 active generation；PM 记忆 CAS；源码删除受控操作和缺失基线；实际任务 outputs；跨进程锁、依赖 generation 和证据过期；部分发布、审计失败及恢复状态。

必要成本与限制：需跨 Kernel、Adapter、Desktop、ProjectManager、Tester/Reviewer 协作；增加磁盘和复制时间；首版 macOS 隔离后端须真实探针验证，其系统接口兼容性存在风险；其他平台失败关闭。联网默认 none，localhost/外网均须 PM 本条明确批准，不承诺域名级隔离。

客户确认范围：本版设计及按其实施的方向、必要角色边界和精确任务配置准备。应用派发仍须实际接受精确配置，安全能力和发布行为必须通过真实独立验收。推荐批准、客户授权及运行验证是三个不同状态。


## 实际收到的独立只读评估来源

以下是实际独立固定 role 的 collaboration 交付，非 Governance 扮演 owner、非既有仓库文档；本记录不会声称他们写了评估文件。Root 实际转发 Adapter/Desktop 交付；Kernel 本人于本治理上下文再次转交其此前评估。都未改应用或测试、未执行客户命令/网络。PM 记录源为 `/private/tmp/2026-10-10_review_handwell-pm-approved-project-shell.md`，本仓库副本保留原终审文本并补充真实 provenance。

### AgentAdapterEngineer — `/root/adapter_shell_assessment` 实际 final（Root 转发）

v1可兼容现有Adapter，但需补齐：同一原始 PiToolRequest 持续等待审批、执行、发布；最终只回应一次。取消后迟到回应必须拒绝。当前活动预算仅支持 conversation；single_run 不接受预算。执行角色预算需要新增契约与实现。single_run 恢复仅允许新实例首次运行前一次纯文本历史，不能恢复pending工具或旧许可。PM持续上下文可承载审核工具；Desktop须新增独立审核队列，串行使用PM session，避免主执行等待阻塞。Kernel新增专用Shell请求、审核和结果Model；严格绑定请求ID、版本、摘要及运行身份。许可由Host私有管理，模型不能构造或重放。Shell结果不得复用 CheckResult，退出码0不得更新检查通过状态。必要Adapter路径：src/adapters/providers/{abstract,public,impl}/pi_session.mjs、src/adapters/services/{abstract,public,impl}/pi_agent.mjs；对应 test_pi_provider.mjs、test_pi_service.mjs、test_control_tools.mjs。共享工具契约由Kernel独占维护 src/kernel/models/agent.mjs。已向Root和PM发送评估。未修改文件或运行外部模型、网络请求。

### DesktopEngineer — `/root/desktop_ui_implementation` 实际 final（Root 转发）

只读评估：草案主路径与当前Desktop架构兼容，需落实以下接线。实际入口：taskTools/#runTask新增Shell工具分支，通过Kernel公开Service执行，结果回原角色同一个pending调用。PM独立队列：不能调用sendMessage（执行时拒绝并可能撤销计划），不能直接复用#ensureManager（可能递增generation使执行角色失效）。审核使用独立队列、串行PM回合；等待不占主#tail。上下文/UI：保持原role/instance/run，不新增“Shell审核员”成员。显示真实“待PM审批／执行Shell／发布中”，审核理由与输出进入各自真实对话，保留焦点和阅读位置。取消：先撤队列与许可、取消审核及命令树、结束原pending，再等待执行promise；重启不重放批准。必要兼容修订：Shell发布纳入任务results、依赖元数据和证据失效；delete须支持缺失基线与检查快照，否则现有文件读取快照会失败。实施gate：独立Shell沙箱、链接与进程清理、产物generation、多文件部分发布恢复、PM记忆CAS及审核超时须实际验证。Node检查沙箱目前禁止fork，不能直接放开替用。通用Shell保持逐调用PM审批，不缩成安装白名单；源文件归属、task范围和保护目录继续约束发布。结论已发送PM。未改文件、未执行Shell。

### KernelEngineer — `/root/kernel_shell_assessment` 实际 handoff（本人转交）

固定 KernelEngineer 只读评估 handoff（来源为本上下文实际阅读，未写文件、未运行客户命令/网络）。建议已收敛 v1：私有项目镜像真实 Shell + 新 macOS deny-default OS profile + 原 Mutation 受控发布；原客户 workspace、宿主 userData、credentials 对 Shell 默认全拒绝，镜像排除保护路径，字节复制不硬链，失败/取消/超时不发布。镜像diff用于候选发布验证，不承担OS隔离。现有 CheckProvider 仅固定Node检查，禁止子进程；全局mach-lookup/bootstrap、metadata/map、/dev宽allow不能复制进Shell，旧独立checks不得放宽。
实际本机只读确认 macOS26.6.2 /usr/bin/sandbox-exec存在；man标DEPRECATED，dyld-support.sb标Apple私有接口。新profile/子进程/Mach隔离尚未真实验证。必须fail-closed验证fork、posix_spawn SETPGROUP/SETSID、detached/double-fork及组长退出后子树；旧deny SYS_setsid/setpgid不能证明posix_spawn属性不可逃组。Mach默认拒绝keychain/securityd、launchd、AppleEvents/GUI/剪贴板；继承Mach权利需要探针，不能证明则unsupported/native supervisor或VM。环境从空白名单构造私有HOME/TMP/cache，不继承APIkeys/NODE_OPTIONS/DYLD_*/SSH_AUTH_SOCK/用户npm配置；无无关fd。默认network none，外网PM逐条审批，不伪称域名隔离。
链接：所有可读输入/可发布输出拒绝普通文件nlink>1、special files、逃逸链接，宿主nofollow+fd/path identity复查；node_modules/.bin仅允许相对且真实目标在同一批准依赖树的安全链接，拒绝绝对/逃逸/环/断链/硬链，不继承setuid/setgid/ACL/任意xattrs。不得因owner某exact文件而开放父目录subpath写权。
发布：现有Storage只有进程内Map锁及单文件rename原子，没有跨进程锁/多文件事务。先全量检查候选：任意nonowner source变更拒绝整批，每文件绑定本条shell授权writeSet/owner/baselineSHA；持可信宿主跨进程发布锁逐项原Mutation。失败报告partial_published真实文件和证据失效，不宣称自动回滚事务。生成node_modules/build/cache/lockfile分别effects批准，共享依赖安装/发布排他锁，读依赖检查共享锁或不可变版本。锁不在Shell可写目录，禁止global install。
审批：host绑定真实role/task/session/instance/run，Agent只提出请求，PM逐条批准；digest至少command精确字节、shell/runtime argv、cwd、env策略、network、timeout/output、snapshot/workspace identity、owner/boundary/plan/profile/context版本、可发布writeSet/generated effects/锁资源。宿主私有registry opaque一次许可，Model constructor/digest或模型的PM批准文本无权限。锁/启动前复查后原子消费，失败不得重放，撤销abort执行和发布；可信host仍为信任边界。
建议新增精确Kernel文件（均未实施，当前Section1没有这些新文件）：src/kernel/models/shell.mjs；src/kernel/services/abstract/shell.mjs、public/shell.mjs、impl/shell.mjs；src/kernel/providers/abstract/shell.mjs、public/shell.mjs、impl/shell.mjs；tests/kernel/test_shell_models.test.mjs、test_shell_service.test.mjs、test_shell_provider.test.mjs；docs/roles/KernelEngineer/docs/design/2026-10-10_design_project-shell.md、docs/feature/project-shell.md。既有必要变更：models/agent.mjs、core.mjs、workbench.mjs及对应tests、本角色api-spec/feature-map/functional-description/changelog。新Provider管镜像/profile/进程/锁/候选安全读取，Workbench Pipeline组合ShellService与原MutationService，不让Provider调用peerProvider或上层。
人类已确认草案v1，但尚无precise hash grant；这里只交已有评估provenance，不授予实施。全role持久写与task.writeSet发布语义必须在本条shell grant明确；若全role持久写，则显式批准完整owner shell writeSet，不放宽旧edit/task授权。

## 配置准备结论

上述架构和安全问题为必过门禁，尚无生产实现或实测支持结论。PM 早期 bridge 和最终发行分开：前阶段 package/lock/public exports/test 精确文件建立runtime依赖，最终阶段只改新 feature/design/architecture/交付 docs 并复验保持包bytes，避免让前阶段candidate隐式stale。顺序 Kernel→Adapter→PM bridge→Desktop→PM final→Reviewer early（仅自有测试兼容及实际结构检查）→Tester→Reviewer final（审阅文档及同检查复验）。Governance 未启动任何任务；精确配置必须提交实际人类接受，PM逐Shell审核不是配置接受。

PM 实读补充：Reviewer 的 current package 身份断言须在 Tester 全回归前先由 Reviewer early 阶段更新并验证；该阶段仅用精确自有测试 writeSet，final 使用独立 review/docs writeSet并复验，避免下游输入变化被隐去。Reviewer 这三份既有测试的生成helper必须使用其新批准阶段生成根，不以运行回归为理由写旧阶段 evidence。历史tar/ZIP验证段必须继续保护原字节及原39file身份，不能全局替换旧计数。新current包的44source等数量只在实际清单吻合时采用，不提前编造新SHA。Tester 不代修Reviewer测试，也不跳过旧全回归。
