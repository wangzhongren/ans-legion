# 项目 Shell

Kernel 提供项目镜像中的真实 zsh/Node/npm capability。执行角色提交完整请求，PM 每次结构化审批，Host live validator 在资源锁后核对原角色、任务、plan/profile/context、完整 source owners 和 artifact scope。一次执行许可不离开 Host。

source create/replace/delete 经原 Mutation 发布，delete 返回真实缺失状态和墓碑。生成 dependencies/build 单独批准，不能伪装覆盖 authored source；合法 `.bin` 相对内链可发布，hardlink/escaping link/special permission 拒绝。失败或取消的镜像改动不发布。结果区分 ready_for_publication 与 published/partial_published，并记录实际 publishedResources。

macOS 使用独立 Seatbelt profile和Host外permission signature supervisor，覆盖组长退出/posix_spawn detached孤儿。当前依赖CLT/SDK及私有沙箱接口；startup probe失败不启动命令。其他平台不降级裸Shell。

原目录、控制与凭据目录默认不可读写。输出 archive合计最多1MiB，SDK预览缺省8KiB，可在模型预算内进一步缩小；ANSI/控制字符剔除，截断如实记录。none/localhost/external三种网络权限逐条钉住，未承诺域名隔离。

project锁共享给Shell和Check。生成发布有暂存/backup/fsync journal，partial会暂停，恢复检查当前版本；旧中断许可不恢复。原固定Node检查仍禁止子进程、使用批准输入及认证reporter，Shell结果不会变成自测通过。

实际 API 与限定信任边界见 [api-spec](../../api-spec.md)，本候选的检查记录见[变更](../change/2026-10-10_change_project-shell.md)。

普通source包括图片等binary regular文件：Host data API与私有canonical contentBase64兼容，仍有2MiB字节上限与真实SHA/nonce/owner/task/baseline约束。原SDK write/edit继续仅text。真实binary asset发布、SHA、重放和foreign-owner拒绝已验证；source安全执行位与生成目录存在也进入当前验证。

## 2026-10-10 依赖读取修复：输入范围与发布范围

实际函数签名、Shell Model字段与SDK参数均不变。factory.artifactScopes中 `kind:'dependencies'` 的精确scope声明可读取的已验证依赖；缺省 [] 不增加默认读取链接。输入树链接验证范围是这些dependency scopes与本条request.generatedEffects的并集。prepare/acquire、执行后mirror和原目录复查、生成发布前扫描及恢复扫描都使用该输入范围。相对链接目标必须仍在同一scope内的无硬链regular文件，保护路径、绝对/逃逸/断链/环/special权限仍拒绝。

`ShellPreparation.generationDigest`、同一authorization.generationDigest和result/publishGenerated.generationDigest，明确是完整 **input artifact generation**：固定读取dependencies与本条批准输出scopes中的普通文件字节、相对链接目标、执行位、目录存在。snapshotDigest保持原regular FileBaseline摘要；因此caller必须同时复用prepare给出的inputVersions/snapshotDigest/generationDigest，不能自行仅对dist计算替代，也不新增SDK请求的input digest或许可字段。

Provider私有writeGenerationDigest单独保存只针对本条generatedEffects的旧发布目录基线；readonlyDependencyDigest单独钉住本条未申请生成的fixed dependencies。执行后readonly依赖file/link/执行位/目录变化，返回error `shell_readonly_dependency_changed`、空candidates/effects，整次不发布；原目录在审批后改变依赖（包括两个相同bytes目标之间重定向链接）在acquire返回 `shell_input_changed`，或运行复查返回stale。本条只申请dist时不允许创建、替换、删除或发布node_modules，也不会为读.bin自动扩大授权；私有mirror运行仍沿v1允许临时处理，提交门禁要求readonly依赖完整不变。

候选source owner/task/writeSet、gen与完整authored inventory不重叠、Host private一次许可和真实PM审批都保持原约束。实际写/publish循环仍只有本条authorization.generatedEffects，返回resources仅含真正批准并发布的目录。现有node_modules/.bin用于only-dist真实build，不需要把node_modules放进request.genEffects。

验证使用新fresh受控fixture：先真实本地npm安装发布，再only-dist执行.bin并发布dist，比较原依赖bytes/link/mode及根inode完全不变；readonly dependency file/link/mode/dir修改整批拒绝；同bytes link retarget使旧授权stale；未声明/escaping/hardlink/broken/cycle/credential链接继续拒绝。三项最终配置检查与当前7文件SourceHashes以新task handwell-project-shell-dependency-read-repair-v1同候选记录为准，旧0.8.0和原verified成绩不充当新证据。

时间事实：Host/Provider每个issue、consume、publication与Storage最终commit前观察新observedAtMs；Model只比较显式事实。缺失/NaN/无效事实拒绝Shell路径，普通SDK字段不变，旧事实不用于后续阶段到期判断。
