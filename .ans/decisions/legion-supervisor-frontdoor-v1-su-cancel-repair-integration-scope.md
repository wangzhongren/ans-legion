# Su 取消后继续对话修复范围

## 接受输入

沿用 `.ans/decisions/legion-supervisor-frontdoor-v1-authorization.md` 的 Human 直接接受：设计 v0.3 SHA-256 `9f6628178502f5167b641c6bfe76d7e9b223ceb780f4ff79ba6dfa622cf5b0a1`，79 文件配置 SHA-256 `c8032728888d3652ce0987a94cb7ca84557c9ecf53bb3f27bb3f0df6d6b9e7b2`。不修改这两份冻结输入。

Governance 仅明确条件调度路径 `docs/scheduling/legion-supervisor-frontdoor-v1-su-cancel-repair-integration.md`；固定 ANS Supervisor 经 task_ops 初始化、派发及维护运行记录。原 Desktop/Adapter 可先只读定位真实层和文件；只有当前接受的 79 路径内、由原 owner 正式获得 assignment 的最小子范围可以实施。若必须修改范围外文件，先提供实际缺口，不用本记录扩大权限。

## 独立失败事实

Reviewer 的 structure 用例使用真实 Pi SDK directCustomer：Su 第一轮 SSE 在途，cancelTurn 返回 cancelled，Human 原文保留、未完成片段不进入历史；下一次 sendMessage(Supervisor, Continue) 返回 ok，随后 failed/pi_run_failed。本地服务端 calls 仍为 1、fixtureErrors 为空，第二轮尚未发出模型请求。`r-structure-recheck-1-structure-789055fb.log` 和后续诊断证据保留。69 项中 68 通过不代表完整验收；Reviewer 已用原 token stop，未报告 complete。

## 修复约束

- 从可信安全 code、实际生命周期和缓存/agent 状态判原因，不以 pi_run_failed 标签猜 SDK 内部错误。
- 取消必须真实终结在途运行、撤回相关执行许可并排空受控操作；已成功效果保留。
- 当前项目后续 Su 对话应正常发出新模型请求，使用正确独立上下文、Source/Actor 绑定和当前许可；旧请求、旧 yes、grant 及不完整回复不得重放。
- 不削弱完整 Human 原文、未完成片段不进 history、取消后的安全状态，以及角色 owner、Check/Shell、CAS、租约、密钥和权限边界。
- 保留 Reviewer 最小真实 cancel→Continue 回归，并在必要原 owner 门中复现；不替换真实 SDK，不增等待掩盖时序，不新增无关矩阵。

## 依赖与包装

固定 scheduler 根据只读定位决定 Desktop/Adapter 的最小正式任务及依赖次序，再完成 PM 新包/真实 cli 安装、Desktop 当前调用方、Tester installed/regression 和 Reviewer structure 独立重验；仍使用原固定 checks。正文和 fixture 定稿后冻结，再按当前候选/非超时/真实证据报告与 verify。

采用补丁版 1.1.2，fresh 产物建议为 `.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/su-frontdoor-cancel-repair-v1/legion-runtime-1.1.2.tgz`，在原允许生成 root 内创建；若新候选需不同 fresh 后缀，由 Governance 澄清并保留此前候选。1.1.1 repair-v2、首 1.1.1、1.1.0、bridge/1.0.3 与旧图全部只读保留，不改旧 verify 结论。

最终 feature/change 文档状态收尾在产品与 tar 冻结后处理；旧 GUI 验收保持暂停，无身份链的旧 marker 只报告不猜删。不重复询问 Human 已接受的同一范围。

## Adapter 对照后的 Host 原 owner 修复

Adapter 的真实无工具、生产 Su 八工具与公开 Service 对照均发出第二 HTTP，未证明 resourceLoader/runtime 假说。原失败中的 pi_run_failed 是 Host turn 通用码；Host prepareMemory/restore 等无 code 异常也可能映射为此码，不应把它当成实际 PiRunResult 根因证据。

固定 scheduler 将 Adapter 诊断 attempt 以真实有限证据安全 stop，不报告已修复，并保留原图。新的精确条件记录为 `docs/scheduling/legion-supervisor-frontdoor-v1-su-cancel-host-repair-integration.md`，仍采用同一 Human 接受配置/设计。原 Desktop 在已授权 26 文件范围的最小正式子范围增加安全阶段/白名单类型定位并修复已证根因；区分 prepareMemory、restore、start、nextEvent、finalize，不记录异常原文、SDK history 或凭据。不以通过的 Adapter 对照替代 Host cancel→Continue 失败关闭。

图顺序为 Desktop 正式诊断/最小修复及原固定门 → PM fresh 1.1.2 cli/包装 → Desktop 只读当前调用方三门 → Tester installed/regression → Reviewer structure。其余取消、Human 原文、partial 不入 history、旧授权不重放、安全边界和产物保留约束保持不变；没有新的应用文件权限。首次 1.1.2 尚未生成，继续使用上述 `su-frontdoor-cancel-repair-v1` fresh 建议路径。
