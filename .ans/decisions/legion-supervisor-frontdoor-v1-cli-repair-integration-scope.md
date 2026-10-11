# Su CLI 当前确认选择修复范围

## 已有授权与治理身份

本修复属于已接受 Su v0.3 的必要交付修复。Human 授权记录为 `.ans/decisions/legion-supervisor-frontdoor-v1-authorization.md`；原设计 SHA-256 为 `9f6628178502f5167b641c6bfe76d7e9b223ceb780f4ff79ba6dfa622cf5b0a1`，原 79 文件配置 SHA-256 为 `c8032728888d3652ce0987a94cb7ca84557c9ecf53bb3f27bb3f0df6d6b9e7b2`。两份接受输入保持原字节。

Governance 仅明确调度条件和修复约束；固定 ANS Supervisor 通过 task_ops 维护 `docs/scheduling/legion-supervisor-frontdoor-v1-cli-repair-integration.md`。新图使用原角色绑定、文件权限和固定检查；未增加应用路径或产品权限。旧八节点记录与已停止的 Tester attempt 保留为历史，不续写其验证结论。

## 实际缺陷

独立 Tester 的 `installed-cb5274c7` 从真实 npm 安装的 1.1.0 CLI 复现：同一 Su turn 两次合法 PM 委托产生 A/B 草案及不同 Host 确认；B 是当前 draft。CLI 用第一个 pending 请求展示 A，旧 A yes 被 Host 拒绝为 stale_interaction 后，CLI 又展示 A，未展示 B。两次后台 PM 委托均 completed/plan_ref，tasks 为空且目标文件不存在，旧答复没有转移为新授权。固定失败证据与安全 stdout 保留。

## 原 owner 最小修复

原 ProjectManager 在既有 17 路径子范围内修复 `bin/chat.mjs` 的当前请求选择与拒绝后的交互，并更新既有安装用例、文档及包装输入。实际 assignment 由固定 scheduler 缩小原范围。

- 执行计划确认应与当前计划和真实 Host 绑定匹配；讨论、选择、Shell 及其他既有 Human 请求保留各自有效绑定。
- 已过期/失效请求仅按 id/version/digest 在客户端局部排除；organization_busy 等暂态错误不得永久丢弃当前请求。
- 重新展示当前完整请求，并等新的 Human 输入；不得自动转移、重放旧 yes，或构造问题/答案/授权。
- Su 业务写入、Check、Shell、grant 和角色归属权限保持原设计；Host 仍是实际授权入口。
- 保留真实双 draft bin 复现，旧请求拒绝、零任务/零写与当前请求需要新答复的强断言；保留原三协议、返修、取消、密钥、owner/CAS/Shell 和上下文原文检查。

## 依赖重验与产物

顺序为原 PM 修复/真实安装 cli 门 → 原 Desktop 只读调用方 owner/host/parallel 门 → 原 Tester installed/regression 门 → 原 Reviewer structure 门。每个节点正文与 fixture 定稿后冻结，以当前候选和真实固定证据报告/验证；不以旧通过或诊断候选代替当前结论。

补丁版建议并接受为 1.1.1，fresh 产物路径为 `.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/su-frontdoor-cli-repair-v1/legion-runtime-1.1.1.tgz`，只在原允许的生成效果内创建。保留旧 1.1.0 tar SHA-256 `73064e934c2273d452a278380e02fcd59370973914c8faec63146b8c58ccd046`、旧 bridge/1.0.3 及全部失败证据。实际最终 SHA 由重新打包和独立安装确定。

没有完整身份链的旧 marker 保留并报告，不猜删。产品代码/tar 冻结后再关闭既有 feature/change 验收状态；旧 GUI 验收继续暂停。不要求重复 Human 确认同一接受范围。
