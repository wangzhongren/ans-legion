# Su 1.1.3 交付文档状态关闭

## 接受范围

沿 `.ans/decisions/legion-supervisor-frontdoor-v1-authorization.md` 的 Human 接受，原配置 SHA-256 `c8032728888d3652ce0987a94cb7ca84557c9ecf53bb3f27bb3f0df6d6b9e7b2`、设计 v0.3 SHA-256 `9f6628178502f5167b641c6bfe76d7e9b223ceb780f4ff79ba6dfa622cf5b0a1` 保持原字节。固定 ANS Supervisor 经 task_ops 维护精确条件记录 `docs/scheduling/legion-supervisor-frontdoor-v1-delivery-doc-close.md`；Governance 不写运行记录或应用。

当前 `docs/scheduling/legion-supervisor-frontdoor-v1-role-memory-race-repair-integration.md` 五节点已 verified；PM cli10、调用方207/157/123、Tester installed14/regression40、Reviewer structure69均通过当前候选固定门。文档中仍有中途“独立验收待完成”等状态，需如实关闭。

## 原 PM 唯一 authored 四路径

- `docs/roles/ProjectManager/feature-map.md`
- `docs/roles/ProjectManager/docs/feature/cli-project-workflow.md`
- `docs/roles/ProjectManager/docs/change/2026-10-11_change_supervisor-frontdoor-global-read.md`
- `docs/roles/ProjectManager/changelog.md`

以上是原接受范围内的现有文件，不授新源码路径。更新最新1.1.3完成状态、准确当前图/安装包/Tester/Reviewer证据链接和实际限制；旧阶段文字标历史，失败证据保留，不将旧通过混为当前。

## 固定门与生成效果

单 PM 节点运行原配置 `desktop_dependency`：`node apps/desktop/scripts/verify-dependencies.mjs`。它只读已安装依赖与 lock，在 PM 原允许的 `packaging/su-frontdoor-memory-repair-v1` 生成独立 UUID `desktop-dependency-*.json`；不得覆盖已有产物，不重新 pack，不修改源码或 manifest/lock。

readSet 显式绑定最终 `.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/su-frontdoor-memory-repair-v1/legion-runtime-1.1.3.tgz`（SHA-256 `e0ac5ebaee7caabc52175fe28e229c6fbc195d02890ec5bffe6ba76d80a6f73a`）、README、manifest/lock、Tester/Reviewer报告和已 verified 主记录。正文定稿后冻结，以当前候选和真实固定门报告/verify。

产品99mjs、README、package/lock、已安装产品及最终tar一律只读；PM核对前后哈希相同并检查文档链接与真实状态。没有必要重新运行D/T/R；如发现实际产品字节变化，立即停止按原owner处理，不用文档任务放行。

GUI旧验收仍暂停，测试为本地HTTP协议端点+真实Pi SDK；未宣称付费远程模型或Windows GUI验收。无完整身份链的旧marker保留报告，不猜删。同一接受范围不重问Human。
