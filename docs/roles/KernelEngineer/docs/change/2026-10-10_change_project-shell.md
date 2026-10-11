# 项目 Shell v1 变更与验证

固定 owner KernelEngineer，task handwell-pm-approved-project-shell-v1 / node kernel-shell。执行范围是已人类批准43精确文件；真正修改项与每项sourceHashes由task_ops candidate及worker最终报告记录，未声称全部43文件都修改。

新增独立纯Model、三层Service和三层Provider。原Model/Policy/Mutation/Storage/PermissionRuntime增加Host-only出版receipt、baseline和delete，不扩大普通write/edit授权。Check增加显式absent input和generation，保持原fork/argv/reporter隔离。

实际探针先复现旧进程组方法的posix_spawn逃组，再验证permission signature supervisor真实回收；不以执行后diff或回滚当OS隔离。离线npm本地安装/build、合法.bin内链、生成发布、source删除墓碑、取消/timeout、未批/伪permit拒绝、none/localhost、跨Host进程锁和注入发布中断/withdraw均已真实执行。所有fixture、native源码/二进制和日志在本阶段新fresh角色目录，未读取真实密钥或客户SSH项目，未请求外网。

当前只保留本机macOS/Node证据；CLT缺少或startup失败为unsupported，不能算支持。三配置最终 checks 与 Root accepted candidate 查询 task_ops 当前同候选记录；初期通过不充当独立验收。

限制：permission signature不是sandbox object ID，不覆盖恶意未受限Host克隆私有profile；源码多文件恢复由Workbench负责，只有单文件Mutation原子；跨重启未完成journal保留恢复门禁，不自动回滚或重跑。

普通source包括图片等binary regular文件：Host data API与私有canonical contentBase64兼容，仍有2MiB字节上限与真实SHA/nonce/owner/task/baseline约束。原SDK write/edit继续仅text。真实binary asset发布、SHA、重放和foreign-owner拒绝已验证；source安全执行位与生成目录存在也进入当前验证。

保留首个配置check失败日志 kernel-shell-2-shell-be81976d.log（149项148pass/1fail，candidate未变）；失败是实际同步FS提交primitive未被旧异步rename故障注入命中。修复为同Storage的nodeFs同步调用，强断言未改；其后同配置150项全部通过，均为历史候选。最终当前候选依 task_ops 三检查与 SourceHashes 核对，不能拿历史结果替代。

## 2026-10-10 依赖读取修复：输入范围与发布范围

实际函数签名、Shell Model字段与SDK参数均不变。factory.artifactScopes中 `kind:'dependencies'` 的精确scope声明可读取的已验证依赖；缺省 [] 不增加默认读取链接。输入树链接验证范围是这些dependency scopes与本条request.generatedEffects的并集。prepare/acquire、执行后mirror和原目录复查、生成发布前扫描及恢复扫描都使用该输入范围。相对链接目标必须仍在同一scope内的无硬链regular文件，保护路径、绝对/逃逸/断链/环/special权限仍拒绝。

`ShellPreparation.generationDigest`、同一authorization.generationDigest和result/publishGenerated.generationDigest，明确是完整 **input artifact generation**：固定读取dependencies与本条批准输出scopes中的普通文件字节、相对链接目标、执行位、目录存在。snapshotDigest保持原regular FileBaseline摘要；因此caller必须同时复用prepare给出的inputVersions/snapshotDigest/generationDigest，不能自行仅对dist计算替代，也不新增SDK请求的input digest或许可字段。

Provider私有writeGenerationDigest单独保存只针对本条generatedEffects的旧发布目录基线；readonlyDependencyDigest单独钉住本条未申请生成的fixed dependencies。执行后readonly依赖file/link/执行位/目录变化，返回error `shell_readonly_dependency_changed`、空candidates/effects，整次不发布；原目录在审批后改变依赖（包括两个相同bytes目标之间重定向链接）在acquire返回 `shell_input_changed`，或运行复查返回stale。本条只申请dist时不允许创建、替换、删除或发布node_modules，也不会为读.bin自动扩大授权；私有mirror运行仍沿v1允许临时处理，提交门禁要求readonly依赖完整不变。

候选source owner/task/writeSet、gen与完整authored inventory不重叠、Host private一次许可和真实PM审批都保持原约束。实际写/publish循环仍只有本条authorization.generatedEffects，返回resources仅含真正批准并发布的目录。现有node_modules/.bin用于only-dist真实build，不需要把node_modules放进request.genEffects。

验证使用新fresh受控fixture：先真实本地npm安装发布，再only-dist执行.bin并发布dist，比较原依赖bytes/link/mode及根inode完全不变；readonly dependency file/link/mode/dir修改整批拒绝；同bytes link retarget使旧授权stale；未声明/escaping/hardlink/broken/cycle/credential链接继续拒绝。三项最终配置检查与当前7文件SourceHashes以新task handwell-project-shell-dependency-read-repair-v1同候选记录为准，旧0.8.0和原verified成绩不充当新证据。

本修复的公开Service兼容：acquire遇真实input/generation/root/snapshot变更时，Provider.notExecuted构造未执行stale值，避免沿既有Service包装为普通error；Service签名/源码不变。真实Service case在审批后将.bin链接换到相同bytes目标，返回stale、executed=false且无输出发布。中间候选配置shell156项通过保留历史；最终同candidate三检查以新task记录为准。

## 2026-10-10 显式时间事实修复（当前Host调用契约）

纯Model不读取时钟。ShellService与MutationService新增Host-only `observeTime(): number`，由其相邻Provider读取fresh epoch milliseconds；fact必须是非负safe integer。没有新SDK clock工具、request/review/result/history字段，也不接受Model clock callback、环境对象或旧issue时刻替代后续事实。public factory参数/导出不变。

`controller.issueShellPublication(proposal, receipt, observedAtMs)`第三参数现在为必需的fresh事实，Host调用例：`controller.issueShellPublication(proposal, receipt, shell.observeTime())`。每个proposal单独观察，不预先为整批缓存时间。PolicyService.evaluate的私有publication上下文也须 `{publicationReceipt, observedAtMs:mutation.observeTime()}`。普通write/edit/issue原用法不变。

内部execution authority issue/consume、Core RuntimeAuthority issue/consume/recheck与Workbench lower mutation authority逐层传事实；Model仅比较authorization.expiresAt和该显式事实，缺失/NaN/invalid事实拒绝Shell路径。Provider.consume读取新时间，user command真正spawn前再次检查到期；Service创建publication receipt观察新时间，Storage消费、context复核以及真正创建/替换/删除的同步commit前再次观察。生成目录commit同样观察fresh时间。到期检查不以abort timer替代；brand、request/role/task/owner/baseline、live AbortSignal、nonce/one-use仍同时有效。失败consume先删除旧permit，不能用更早事实重放。

实际自有测试包含：禁用全局Date.now时pure Model仍以显式事实完成验证；missing/NaN/负值/非整数拒绝；精确到期边界拒绝issue/consume；issue后的Provider实际到期消费未执行；publication issue后Storage新观察到期，真实文件未变且旧permit回退时间仍不能重放。此前普通binary、dependency-read、生成恢复和permission signature强断言保留。原Reviewer纯度正则只读对Models局部核对，不宣称运行其完整suite或修改其断言。

本次同v1、同主c872精确范围21文件repair，实际最终三checks与21outputs/sourceHashes见 handwell-project-shell-model-time-facts-repair-v1 的冻结candidate记录；旧0.8.1/0.8.0保持历史，0.8.2由PM后继实际包装，当前Kernel不声称其已发行。
