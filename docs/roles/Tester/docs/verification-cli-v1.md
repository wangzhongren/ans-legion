# CLI v2 独立安装与回归验证

2026-10-11；固定 Tester。沿用本路径历史名称，受测版本为 CLI v2 / npm 1.0.3。依据 [验证设计](design/2026-10-10_design_cli-verification.md) 和 [当前任务记录](../../../scheduling/legion-cli-role-owned-v2-final-profile-current.md)。生产代码由原 owner 修复、打包，本角色只维护已派发测试与报告。

## 实际结果

独立安装检查已实际通过全部13个场景；固定回归已实际40/40通过，零失败、取消、skip或todo。文档收口后的同候选最终 installed/regression gate、候选SHA及每份日志SHA以当前任务记录最新checkEvidence与完成报告为准；旧失败日志全部保留，不能代替最终证据。

受测fresh tar：`.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/final-profile-current-v1/legion-runtime-1.0.3.tgz`。SHA256：`d17acf528bcfbe9c057988d0a10184dc88aba082989555565fbfe414b52b333a`。Tester在自己的fresh packaging/npm-cache隔离安装，真实从消费者`node_modules/.bin/legion chat`启动；无仓库源码引用、Electron或测试工厂替代执行。

| 已验证流程 | 实际证据与断言 |
| --- | --- |
| 三协议、多轮PM、Human确认 | 真实Pi SDK受控localhost，普通yes仅讨论；完整owner/claim/transfer当前确认后才执行 |
| 转交与角色范围 | 确认前原owner，确认后generation变化、新role真实写入；跨owner拒写导致任务失败 |
| 并行与串行 | 两个不同owner的模型响应同时在途；同role后一个任务推理时，前一个真实task状态已completed |
| Check/Acceptance/返修 | 实际Node检查；独立客户契约真实失败后回原owner，修正后新检查与独立验收通过 |
| 取消与重启 | 在途讨论/任务取消，零晚写；重启不重放；旧pending确认返回stale_interaction、零执行 |
| 记忆与Supervisor | 分类事实跨plan实际查询，新plan digest；不同项目无旧事实；Supervisor只有typed建议工具无写工具 |
| 旧v1 | 有效旧schema/digest与原字节只读；当前Human确认关闭旧实例/权威catalog后真实迁移、Mutation、Check、Acceptance；legacyHistory保留旧字段、私有backup等于原字节 |
| 来源隔离与密钥 | 同物理workspace异userData拒绝；随机已知LEGION_API_KEY模型/工具/fact负例，stdout/stderr及全fixture普通持久文件含备份/临时/历史/角色记忆/分类事实无原值 |
| 既有回归 | 原审计失败、CAS、取消、拒写、真实sandbox、治理/修复、记忆摘要及native Shell兼容40项；保持强断言 |

## 大记录与治理观察限制

隔离合法格式observer输入中的真实task_ops记录为`legion-cli-role-owned-v2-schema-repair-integration.md`，1282488 bytes，SHA256 `03fe1a26077e2a25630d4c3b1def35da9574749bb0a135c50d81637e98439a39`。公开Service实际available、全记录/哈希与读取后字节不变、verifiedAt/readAt有效，9项task与2条governance审计分别投影。

本仓库整仓库旧观察器实际仍unavailable：首拒`.ans/roles/ProjectManager/boundary.md`的旧治理metadata pin；并非记录字节预算。CLI新owner授权不依赖此路径，旧GUI观察/旧Shell最终GUI与E2E验收继续暂停；本报告不声明该观察器恢复。

## 租约与保留项

生产CLI保留真实HOME与默认`~/.legion-project-leases`。每个fresh物理workspace在首次启动前验证对应目录/marker不存在；关闭跟踪进程后，仅清理workspace、目录、marker身份/来源/字节精确匹配且无活跃lease目录的本次marker。共享根、未知holder/commit.lock不删除。直接Host回归fixtures显式使用自身私有leaseRoot。

早期1.0.2失败运行中未捕获完整marker身份，因此保留：`/Users/wangzhongren/.legion-project-leases/85f6cbb5d433668ee49ccc7b161b39791e434edcd1ae451c1e83bef2011f89b5.owner-source.json`，对应早期`Tester/fixtures/installed-IEPerg/project`；已观察对应lease目录不存在。本次不会事后猜测删除它。

实际执行环境为macOS、受控localhost模型服务；不代表付费远端模型或Windows ZIP/GUI验收。密钥检查针对本fixture已知原值，不进行未知秘密或编码穷举。所有旧包/旧失败证据保留；不得据历史通过复活v1许可。

## Su v0.3 / 1.1.0 本次独立验证方案（尚未执行）

接受设计v0.3与t-su-installed精确10文件派发。保留上述1.0.3历史证据；新结果另用fresh目录。本次实际安装生产bin三协议覆盖唯一Su、全项目普通读取、同PM委托两道真实Human问题/旧answerRef拒新问/有效resume幂等、完整Host确认、owner串并行与执行中Su读/状态/两页日志不撤权、真实Check/Acceptance/原owner返修、channel隔离/旧History原字节/旧确认不重放、known-key全持久面和取消。分页固定snapshot边界外新增不stale，边界内修改/删除/身份变化才stale。原Shell/owner/CAS/sandbox强门保留，合法fixture预置等待后台收束。旧观察器pin限制与GUI暂停仍保留；不改生产或新增范围。最终installed/regression只能使用本次当前候选证据。

## Su v0.3 / 1.1.1 当前修复验收

固定Tester新图t-installed-recheck承接已停止partial，仅原10文件。真实fresh v2包SHA-256为3a2390c90b76012f7d5684e0dc445d8962fe0ebd86a4d389879125459956c431；独立消费者npm离线安装实际生产node_modules/.bin/legion，不注入Host工厂、不替换HOME。保留原13安装场景，并保留已复现的双草案强回归：A/B不同Host digest，旧A yes精确stale_interaction且零任务/零写，完整B展示后新的Human no必须持久化为当前B rejected，不能自动转移旧yes。

回归继续验证实际Su输出长文、完整Human与选择原文、摘要水印和失败无新增coverage。超预算业务调用使用实际Su SDK前置基线，之后零新增；新计划必须真实Su completed与当前draft，当前digest pending确认才可授权。保留owner/CAS/Shell/sandbox/Check/Acceptance强门。分页边界及legacy/channel/History现有Host覆盖由Reviewer结构门复核；按收敛scope不重复新增seed或矩阵。

历史主图installed-cb5274c7确证1.1.0旧A循环遮挡B，旧yes未重放，日志SHA bac08528c0fa1390bb8d0149b2baff3c35e71b960c749b100d3c43ba22a4ddca；regression-d5582cf1为38/40，日志SHA5c7cbd74353b3840f56e2be2ba49ec6cc05511ba1e4b8461b8b8750082a8748f。均保留，不代替新图证据。本文与fixture定稿冻结后，installed/regression结论以新图task_ops的当前candidate、candidateUnchanged与两份完整日志为准；未通过不得报告complete。

共享lease只清本次捕获workspace/source/dev/ino/marker原字节且tracked进程结束的精确项，根与未知holder/commit.lock不删。历史不明marker保留：~/.legion-project-leases/85f6cbb5d433668ee49ccc7b161b39791e434edcd1ae451c1e83bef2011f89b5.owner-source.json；~/.legion-project-leases/3d85c08cf8d7485e85864710c081387c685be760e739a2e64d3d36591f1a400b.owner-source.json（installed-y3yOCi，早期未捕获完整身份链）。新双草案复现marker已按精确身份清理。

整仓库observer仍受旧开发治理boundary metadata pin限制；隔离observer实际1,282,488字节/hash/verifiedAt证据保留，CLI新owner授权不依赖该旧观察路径。旧GUI/最终Shell GUI验收暂停；本次不覆盖Windows、付费外网或GUI。

## Su Host cancel→Continue / 1.1.2 独立验收

本图t-installed-recheck承接原10文件，主要修改安装fixture/本文/changelog，不增总14场景。真实fresh 1.1.2 tar SHA3a532204158a0bb096b341c9ec3777317cacd32d1e03a6188eff2ceb670aecd7；生产bin首Su真实HTTP partial SSE挂起，/cancel后同PID Continue完整Human、第二真实HTTP正常回复。断言恰两请求、同Su instance两run cancelled/completed、customerTimeline完整两Human与唯一完成assistant，续轮SDK/public history/private roleMemories checkpoint/summary/facts无partial；取消journal可保留事实，不产生PM委托、交互确认、grant、业务任务或写入。不得用重启或新工厂实例代替同进程继续。

保留既有13其他场景含三协议、双草案A旧yes精确stale/B新Human no持久拒绝、owner串并行/转交、两PM问答与answerRef、Check/Acceptance/返修、known-key与旧v1Human迁移。旧1.1.1 installed-8702c94e14场景及regression-9859f78d40/40同候选证据只作为历史保留；本图必须本文/fixture/changelog定稿冻结后，新的installed与regression同candidate/candidateUnchanged通过，结果记录到本图task_ops报告。

共享marker只清本次身份完整精确项；85f6…与installed-y3yOCi的3d85…历史未知来源残留保留。旧整仓库observer治理pin限制、隔离1,282,488字节/hash/verifiedAt证据及GUI/最终Shell GUI暂停仍保留；仅macOS受控localhost，不声明Windows/付费远端/GUI验证。Tester不修生产，不新增重复日志seed/Org1矩阵。

## Supervisor channel /立即新Human CAS / 1.1.3 独立验收

新role-memory-race图t-installed-recheck仅原10文件，最小四文件收口。真实fresh1.1.3 tar SHAe0ac5ebaee7caabc52175fe28e229c6fbc195d02890ec5bffe6ba76d80a6f73a；原14安装与40回归完整保留。原no-check→selftest-failure→postcheck-change链在真实计划失败后立即发送新Human，不等待后台monitor、sleep或盲retry；强断Su completed、新digest draft及唯一当前Host pending执行确认。读取本fixture实际domain，核Supervisor su_customer/supervision_preflight/supervision_monitor三channel独立、(roleId,channel)唯一、私有memory refs/covered属于本channel、后台assistant不入Su checkpoint/summary或SDK。原12k/18k完整Human、choice语义/optionId、source原字节、摘要watermark及失败coverage不增严格保留。

原1.1.2 installed-dd040c2d14pass仅历史；regression-8a631a41 39/40 prepare_memory/stale_role_memory失败及issue/stop全部保留。当前fixture/docs定稿冻结后，本图installed/regression必须同candidate/candidateUnchanged真实通过才可complete。取消同PID同Su实例HTTP2、raw取消journal事实允许但public history/续轮SDK/privatecheckpoint/summary/facts不含partial；双draft A旧yes精确stale、B新Human拒绝持久化保持。

未知85f6…和y3的3d85…共享marker不删；只清本次身份完整匹配且跟踪进程结束的项。旧整仓库observer治理pin限制/隔离1,282,488字节/hash/verifiedAt证据及GUI/最终Shell GUI暂停仍保留。仅macOS受控localhost，不宣称Windows/付费远端/GUI；不改生产，不加重复矩阵。
