# CLI v2 / Su 独立结构与权限审查

最新审查为Su v0.3 / npm 1.1.3，结果见文末当前role-memory-race章节；下列1.0.3与1.1.1记录只作历史保留。

## 历史：CLI v2 / 1.0.3

2026-10-11；固定 Reviewer。路径沿用历史名称，实际审查 CLI 角色独占文件 v2。依据[已确认设计](../../ProjectManager/docs/design/2026-10-10_design_cli-role-owned-files-v2.md)与[合法派发记录](../../../scheduling/legion-cli-role-owned-v2-final-profile-current.md)。本角色仅修改派发的六份独立测试、本报告与 changelog，未修生产、修改其他 owner 文件或重新派发任务。

## 结论与候选

当前独立结构行为检查通过。固定 `structure` 已实际64/64通过、零失败/取消/skip/todo；文档收口后同候选最终日志、候选SHA及日志SHA，以派发记录最新 `checkEvidence.structure` 和本角色完成报告为准。首轮沙箱 localhost 拒绝和旧fixture失败日志保留，不能作为通过证据。

审查当前真实 npm tar：`.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/final-profile-current-v1/legion-runtime-1.0.3.tgz`，SHA256 `d17acf528bcfbe9c057988d0a10184dc88aba082989555565fbfe414b52b333a`。独立解析tar全部102个普通文件，核对 whitelist、当前工作树每份产品字节、sourceHashes、完整 exports 与 bin；无tests、`.ans`、node_modules或内部 task_ops 入包。历史0.8.2包和失败证据保持只读。

## 独立检查覆盖

| 检查 | 实际证据与判断 |
| --- | --- |
| 唯一 Node Host 与分层 | 生产bin到Headless的导入闭包完整；Headless与Desktop入口共享WorkbenchPipelineImpl，Pipeline只组合公开Service，各Service只经公开Provider。包仍包含Desktop settings模块的延迟Electron encryption函数，但生产Headless使用EnvironmentProfiles Service，独立实际getState/select/send拒绝流程无需加载Electron；不把“闭包中没有Electron字样”当功能保证。 |
| 持久角色owner | Scope为角色完整精确owned集合；旧task.writeSet字段拒绝、owner digest/generation绑定、别名/转交与全部实例撤权保留。实际授权写作为正向对照，随后提交前引入旧active plan、owner转交或替换来源marker，均拒绝且零目标写入；占用commit.lock实际拒绝。 |
| 来源与租约 | 公共lease Provider两独立实例对同一物理workspace只允许一个有效持有者；释放后另一实例可取得。catalog CAS竞争只允许一个提交；fixture显式私有leaseRoot，不接触未知共享holder/marker。 |
| 检查证据 | 真macOS Node检查、任意argv拒绝、无实际test/fd3伪事件拒绝；输入变更及相同字节的Host mutation provenance均使既有检查过期；独立Acceptance失败、原角色返修与轮次限制实际验证。 |
| 已知密钥 | 首次Host操作通过公开Profiles Service暖入私有已知集合；Model/renderer输入拒绝knownKeys。实际Headless Human已知key在记录前失败；受控模型返回跨delta key及interaction工具文字key均失败，检查全userData普通文件无原值。PM/member/summary/Shell-review先缓冲后检查，Organization/Project/Memory写前守门；非敏感Human长文保持原文。 |
| Check/Shell有限前置门 | 独立公开Check调用含已知key的声明输入，child未执行且原客户字节不变；公开Shell prepare在镜像复制前拒绝普通文件canary，全部私有output无原值且原客户文件不变。内部knownKeys不进入Model授权或子进程env。 |
| Supervisor | 实际独立SDK工具列表仅query/remember/submit_supervision；typed建议经Host校验，不含Mutation/Check/Shell/grant/owner工具。它不替代Human执行确认。原角色模型私有会话、scope、凭据隔离断言保留；同角色共享完整owner清单是v2明确契约。 |
| 取消/恢复 | 讨论取消后Human原文不丢失，晚写拒绝；关闭确认前撤权，安全历史重启不自动推理；Shell旧partial恢复须新Human计划、当前owner/基线/检查与独立验收，历史记录不重放。 |

## 上游证据与有限保证

重新读取[Tester最终报告](../../Tester/docs/verification-cli-v1.md)：当前1.0.3真实隔离消费者13场景与固定regression40/40，同候选已verified；包括不同owner并行、同role串行、真实迁移、跨plan事实和项目隔离。Reviewer实际公共Host/SDK/Provider检查与包字节核查独立补充这些证据，不复制或宣称重跑冻结上游门。

known-key保证限定已知原值、Host持久入口与Provider已检查的输入/流式输出。外部并发修改客户文件仍可能在核验与子进程读取之间发生TOCTOU；子进程主动编码、重构或分片写入任意tmp不作全称保证。不做未知secret泛扫，不删改含key的既有客户文件，不以事后擦日志替代写前门。实际执行环境为macOS和受控localhost，不声明付费远端、Windows ZIP或旧GUI验收通过。

本仓库整仓库旧治理观察器仍因ProjectManager boundary旧metadata pin为unavailable，CLI新的owner授权与该观察器独立；旧GUI/E2E、旧Shell最终GUI门继续暂停。本次未修治理pin或覆盖历史证据。

Tester早期精确marker仍保留：`/Users/wangzhongren/.legion-project-leases/85f6cbb5d433668ee49ccc7b161b39791e434edcd1ae451c1e83bef2011f89b5.owner-source.json`，对应旧`Tester/fixtures/installed-IEPerg/project`。缺失当时完整身份链，不能事后猜测删除；本次Reviewer没有删除它或其他未知条目。

没有本轮需原owner返修的新增生产缺陷；上述限制和历史保留项均明确保留。最终任务verify/整体交付由Supervisor处理。


## Su v0.3 / 1.1.1 当前 repair 独立结构审查

固定 Reviewer，合法 r-structure-recheck-1；依据已接受Su v0.3及原范围CLI repair。仅原8文件，结构fixture更新客户角色为Supervisor、独立PM委托、前后台channel、当前日志分页与旧History只读契约；原owner/lease/marker/commit/known-key强门保留。最终包su-frontdoor-cli-repair-v2/legion-runtime-1.1.1.tgz，SHA256 3a2390c90b76012f7d5684e0dc445d8962fe0ebd86a4d389879125459956c431，102文件/99sourceHashes；最终同候选结果只取当前repair调度记录，不沿用本报告前面1.0.3证据。

本轮待固定structure执行，暂不声明通过。重新读取Tester当前repair报告与同候选36b05fde验收记录：真实消费者13场景与40回归，保留A/B双草案、旧A精确stale_interaction且零写、B完整展示后新Human答复、两问委托/日志分页/channel由本门独立验证。有限known-key/外部TOCTOU/子进程自构边界、旧observer pin unavailable与GUI暂停保持。除前述marker，Tester早期3d85c08cf8d7485e85864710c081387c685be760e739a2e64d3d36591f1a400b.owner-source.json（installed-y3yOCi）同样保留，不删未知条目。


## Su v0.3 / 1.1.3 role-memory-race 当前独立审查

固定Reviewer合法r-structure-recheck-1；本图只修改原8文件范围内必要fixture与文档。当前唯一tar为su-frontdoor-memory-repair-v1/legion-runtime-1.1.3.tgz，SHAe0ac5ebaee7caabc52175fe28e229c6fbc195d02890ec5bffe6ba76d80a6f73a，102文件/99sourceHashes；当前Desktop lock与安装依赖同身份。前述1.1.1 structure69项68pass及789055fb/5742b003取消续轮失败与stop为历史，保留全部字节，不作为本轮通过证据。

本轮实际独立验证：原真实Pi SDK cancel→Continue强回归继续要求同Su instance两run、实际HTTP恰2、cancelled/completed、完整Human与唯一完成assistant，partial不进入可续public/private history。原正常流程实际后台preflight/monitor独立channel，并核su_customer缓存无后台水印；失败计划后立即发新Human、新Su completed/current digest草案及唯一Host确认，不sleep等待monitor。旧PM History真实原文件字节经过新Su问答、计划、重启保持不变，私有PM水印不进Su。此前普通读取无write/grant、PM两道实际Human问题和旧answerRef拒绝、分页snapshot/cursor、owner/key/lease/commit/Shell强门全部保留。固定structure已经69/69通过、零fail/cancel/skip/todo，文档收口后最终结果只取本图最新同候选checkEvidence与完成报告。当前包身份门同时独立核Desktop package/lock的版本、resolved/integrity与已安装99份源码SHA，不将旧包身份当当前证据。

重新读取Tester当前报告/088d55c2同候选输入，真实安装14场景和40回归由Tester独立完成，本角色不复跑整套安装门。有限known-key/外部TOCTOU/子进程自构tmp边界、旧observer metadata pin unavailable、GUI/E2E暂停、两枚85f6…/3d85…未知来源marker均继续保留。未改生产、Tester或治理文件，不删未知条目。


本轮首批fixture失败日志7bd41b45/3c4f843a保留：运行中的首HTTP可早于成员run记录提交，测试现在等待真实首run后取消；新草案预检fixture曾错误从旧历史提取digest，Host正确拒绝，已改只取当前监督snapshot。严格同Su实例HTTP2与当前Host确认断言均保留，未修改产品或忽略CAS。69/69通过日志65fab657与SHAfe8803afa18193d1d738ccc7134efcee2cefef63e0ecd7a01119ff70d5d9db29为本轮收口前实际证据；最终测试与报告同候选证据以当前调度记录最新structure门为准。没有新增需原owner返修的产品缺陷。
