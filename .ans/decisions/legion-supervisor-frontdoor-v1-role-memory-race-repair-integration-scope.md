# Host 记忆 channel/CAS 竞争必要修复范围

## 接受输入与治理职责

沿用 `.ans/decisions/legion-supervisor-frontdoor-v1-authorization.md` 的直接 Human 接受：设计 v0.3 SHA-256 `9f6628178502f5167b641c6bfe76d7e9b223ceb780f4ff79ba6dfa622cf5b0a1`，六角色 79 文件配置 SHA-256 `c8032728888d3652ce0987a94cb7ca84557c9ecf53bb3f27bb3f0df6d6b9e7b2`。原文件保持原字节，不新增源码路径、角色或产品权限。

固定 ANS Supervisor 仅经 task_ops 维护 `docs/scheduling/legion-supervisor-frontdoor-v1-role-memory-race-repair-integration.md`。Governance 仅声明精确条件和约束，不改应用、运行记录或初始化/派发。原停止图与失败证据保留，不续写旧通过结论。

## 实际有限证据

Tester 的 1.1.2 installed14 通过；regression-8a631a41 为39/40。上一 selftest-failure 计划失败后，立即发送新 Human 草案，Su 在 prepare_memory 报 stale_role_memory，仍保持旧 failed 计划。该时段 fixture 无外部 Org/JSON 写。Tester 已 issue/stop，未 complete/verify。

原 Desktop 只读发现 memberEnd 调用 cacheRole 时遗漏 log.channel；后台 Supervisor 的 supervision_preflight/monitor 日志结束因此可能默认写 Supervisor|su_customer，随后又显式写自身 channel。此写点违反既有 channel 隔离意图并可与前台 expectedRevision CAS 竞争。原失败日志尚未区分 covered/source/revision 分支，不能虚报具体实际 digest 或根因行。

## 原 Desktop 最小正式工作

- 在当前26路径内对 Pipeline、既有 workbench/parallel 测试与文档正式派发最小子范围；必要的既有 Model/Organization Service 路径仍须在79内、由正确原 owner获得 assignment。
- 用静态安全 branch/类型和不含内容的来源 id/type/digest 定位，保留失败后立即新 Human 草案路由，建立真实后台 finalize 与前台 prepare/save 屏障。
- 显式保留 log 的真实 channel；后台 supervision 不得写 su_customer，临时 Shell review 不得污染 pm_delegate，普通 member 保持自身 channel。
- 不以忽略 digest/covered/revision、无界重试、增加 sleep 或延后 Human 消息掩盖竞争。若真实必需业务来源改变，继续拒绝旧绑定；完整 Human/选择事实及私有上下文隔离仍须严格保留。
- 保留真实失败/Check/Acceptance、owner、取消续轮、双 draft、日志/权限、Shell、CAS、租约和密钥强门。修复仅依据正式诊断，非已证明的其他竞争不得猜改。

## 重验与包装

顺序为原 Desktop 四门 → 原 PM fresh1.1.3 cli/真实安装 → Desktop 当前调用方三门 → Tester installed/regression → Reviewer structure。固定 checks 沿原配置，正文/fixture先定稿冻结，当前同候选、非超时、真实证据报告/verify。Adapter前述139/139诊断 test/doc作为只读现行输入保留，不冒充Host修复验收，不重复无关门。

采用补丁1.1.3，fresh建议路径 `.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/su-frontdoor-memory-repair-v1/legion-runtime-1.1.3.tgz`，在原生成root内创建。保留1.1.2、1.1.1、1.1.0及更早包/日志，不覆盖旧artifact。GUI验收继续暂停，无完整身份链的旧marker仅报告不猜删。

最终产品/tar冻结后关闭现有 feature/change 的待验收状态；同一已接受范围不重新询问Human。
