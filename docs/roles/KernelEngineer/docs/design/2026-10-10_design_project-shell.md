# 项目 Shell v1 Kernel 设计

固定 owner：KernelEngineer。真人确认设计 a5a0166d 与精确配置 c872245f，实际 dispatch/ack 由 task_ops 记录。本文是同版实现细节，不产生新授权。本文件随最终候选冻结；三配置 checks 与 Root 验证以 task_ops 当前同候选记录为准。

## 概念与 API

独立 Shell Model/Service/Provider；构造 Model 不授予权限。Service.prepare 建立私有镜像，PM 审批绑定当前 snapshot，Service.run 在跨进程资源锁后再核对真实 Host 审批/current bindings，然后内部一用许可。详见本角色 api-spec 当前签名。Provider 不接业务 validator、不调用 peer Mutation。Workbench Host 获取 opaque publication receipt，经原 controller + Mutation 发布 source；生成发布是独立 artifact infrastructure 操作。

ShellRequest 完整字节 command、cwd、reason、generatedEffects、network、timeout 不自动改写。Review requestDigest/revision 精确匹配。Host 人工计划钉住 source owners 和 artifact kinds/scopes；完整 fileOwners/authoredResources 与生成 scope 无交集，gen='src/' 不可作为 owner 绕过。默认 artifacts=[]，默认 network none。

## 真实隔离与生命周期

独立 deny-default Seatbelt，原项目只进入普通输入副本。no-follow 字节复制、nlink/身份复核，拒绝保护路径、特殊权限、special files。只允许同批准依赖树的 relative 内链；生成 `.bin` 与普通 source 不共用权限。环境从空白名单构造私有 HOME/TMP/cache；固定 zsh -f -c，固定 Node/npm 路径，不继承 API keys、SSH agent、用户 rc 或代理凭证。

真实探针曾证明 SYS_setsid/setpgid 禁止不阻止 posix_spawn SETPGROUP。最终采用 Host 外权限签名 supervisor：unique positive-canary 可读而 negative 不可读、PID startidentity 重查、freeze/kill/recheck 全部成员。它不等于 sandbox object identity；合法不同 run 使用不同 canary，恶意不受限同用户 Host 克隆 profile 不在可信 Host 边界内。sandbox_init/低层 apply、Mach/Host task/sysctl/extra fd/UID 变更真实探针必须通过；任何失败不运行用户命令。后台组长退出立即回收；超时、取消、close 等待同批进程，额外回收最多30秒。

使用本机 CLT clang/SDK 编译 Host-only native helper，源嵌 Provider，产物仅该执行角色的私有 runtime。不存在全局安装；工具缺少或私有 API 不适用返回 unsupported。已实跑的能力不代表其他 macOS 或 Electron 宿主版本支持。

## 发布、并发和恢复

所有 source candidates 绑定 present/absent Baseline，新 SHA/字节由实际镜像读取。非 owner/非 task source 差异拒绝整批。删除为专门 Shell publish operation；missing 与墓碑进入实际 outputs。新 private receipt 只交 Host，不进 SDK/renderer/恢复历史。原 write/edit/task grants 和 requiredApprovals不放宽。

锁位置由 Host 固定，同项目 Shell 与 Check 使用同 lockRoot；目录原子创建+私有 owner nonce 支持跨进程排他，检查使用更保守排他，旧调用保持精确版本 pinning。发布前复查 source 和 generation。源文件通过原单文件 Mutation commit，Host 负责多文件 ledger/partial恢复，不伪称全事务。

生成树先安全暂存、逐步 fsync journal、backup、同步 commit，故障标 partial_published 并暂停；同会话恢复要求当前候选版本匹配，只 withdraw本次输出，保留备份和真实观察。重启旧未完成 journal 阻止新 Shell；恢复是 Host 明确维护动作，不能自动重放许可或 Shell。旧依赖 generation证据须失效并重测。

## 证据门禁

真实 fixture 使用新阶段 Kernel roots，不读取用户凭据或 SSH 项目。三项精确 task_ops checks 为 shell、regression_model、regression_unit；最终证据由配置 argv、candidate hash、环境、退出码与0skip实际结果支撑。Shell退出0不等于旧独立 checks或Acceptance通过。

普通source包括图片等binary regular文件：Host data API与私有canonical contentBase64兼容，仍有2MiB字节上限与真实SHA/nonce/owner/task/baseline约束。原SDK write/edit继续仅text。真实binary asset发布、SHA、重放和foreign-owner拒绝已验证；source安全执行位与生成目录存在也进入当前验证。

## 2026-10-10 已批准依赖读取兼容修复

同 frozen v1、同精确配置；仅此次7文件repair派发。已有 node_modules/.bin 读取不能要求本条node_modules生成/替换授权。输入链接范围是fixed factory artifactScopes中kind=dependencies与本条generatedEffects并集；write/publish范围仍只有本条批准effects和owner/task source。

preparation/authorization/result.generationDigest为完整input scopes的files/links/executable/dir existence摘要；Provider另保留仅本条write目录的旧基线。readonly dependency任何mirror变化拒绝整batch，原目录依赖更新/同bytes链接重定向均stale。prepare/acquire/postrun/original/publish/recovery树扫描使用同一输入链接验证规则，不放开generic symlink/defaults。

实际case先离线npm安装并发布dependency，再在同fixed factory下仅请求dist运行.bin；包括readonly file/link/mode/dir变化拒绝、审批后同bytesretarget stale、未声明/escape/hardlink拒绝。三配置checks冻结同candidate记录，不使用原v1历史成绩。

## 2026-10-10 Model 时间事实纯度修复

本次21精确文件同版repair保留原Reviewer纯度断言。Provider.observeTime读取当前epoch milliseconds，Service只向上提供该事实；Pipeline通过Mutation Service取得，Host出版控制器通过Shell/Mutation Service取得，Model只验证observedAtMs非负safe integer并比较固定expiresAt。Model没有时钟调用、callback或环境依赖。

execution authority.issue/consume与publication binding/RuntimeAuthority issue/consume/recheck逐次接收新事实，Storage在真正创建/替换/删除前的同步recheck重新观察；Workbench控制器issueShellPublication第三参数为fresh observedAtMs。普通SDK write/edit和request/review/result字段不增加时钟，原brand/abort/nonce/one-use/currentowner/baseline不变，失败消费不可用更早事实重放。

新增必要expiry/replay测试，并执行三配置checks；原ReviewerModel纯度断言只读核对，不修改、过滤或skip冒充完整Reviewer成绩。
