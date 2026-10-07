# Legion Runtime v1 交付

本地开发与当前组合验收已完成。Backend 可以写本角色 backend 文件，写 frontend/login.vue 被拒绝且原值保持；两个本地提案适配器都走同一个受控 Runtime。

`legion-v1-approval-repair` 四节点均为 **verified、active=false**，stateRevision / lastEventSeq 均为 24。所有最终检查退出码为 0、候选保持不变，无未解决产品发现。当前 101 项 unittest 方法通过、0 跳过，另有独立的 CLI demo 检查通过。

| 当前套件 | 通过 / 跳过 | 固定证据 |
| --- | --- | --- |
| Kernel | 47 / 0 | [unit](../../../../.ans/runtime/legion-v1-approval-repair/evidence/kernel-1-unit-68d30e2c.log) |
| Adapter | 14 / 0 | [unit](../../../../.ans/runtime/legion-v1-approval-repair/evidence/adapter-1-unit-be82f9bf.log) |
| 独立 Reviewer | 23 / 0 | [unit](../../../../.ans/runtime/legion-v1-approval-repair/evidence/reviewer-1-unit-d86fbb8a.log) |
| 独立 Tester | 17 / 0 | [unit](../../../../.ans/runtime/legion-v1-approval-repair/evidence/tester-1-unit-ff6311ee.log) |

CLI [固定 demo 证据](../../../../.ans/runtime/legion-v1-approval-repair/evidence/kernel-1-demo-cfc7279c.log) 展示 1 个允许和 5 个拒绝场景，backend_written=True、frontend_preserved=True，包含 Frontend 初始化后的 23 个可读事件。Tester 也独立回归了真实 Interface demo 和两个 Adapter→Runtime→文件/审计的完整流程。

最终组合候选：`ae40078ff7460318d20028f263ef042a3635c684a3154a97df1d3a968111cd7e`。15 个生产 Python 文件的汇总 SHA-256：`16f071952ae0a3ba88931544bfa35e87c94ac471918c0803b362f5ed5f6246bf`，独立审查到集成结束未变。汇总方式为相对源码路径→文件 SHA-256 映射，按路径排序后对 compact JSON 再计算 SHA-256。项目没有 Git 元数据，不虚构提交版本。

当前配置 pin：`05d7740ffa3695044b98a4ed40c0b5d7080b9a94f80760c47951218d3f831c8c`；接受设计/合同仍为 legion-v1，未修改权限配置、边界或组织定义。Hash 固定输入，授权来自客户直接六角色方案及“开发”指令。

## 直接运行权限 demo

本次环境为 Python 3.14.0 / Windows，全部使用标准库，无依赖安装。PowerShell：

```powershell
Set-Location 'D:/work/code-work/agent-organization-runtime'
$env:PYTHONUTF8='1'
$env:PYTHONDONTWRITEBYTECODE='1'
$env:PYTHONPATH='src'
$env:TEMP='D:/work/code-work'
$env:TMP='D:/work/code-work'
python -m kernel.interface.demo
```

TEMP/TMP 指向已有可写工作区，是因为此宿主重定向的系统临时目录对子项返回 WinError 5；测试与 demo 使用随机临时目录并清理。模型提案不会写仓库 `.ans/organization`。

四套件按与 pinned 检查相同的标准库发现逻辑分别运行：

```powershell
foreach ($testSuite in @('kernel','adapters','reviewer','integration')) {
    python -c "import sys,unittest;sys.path.insert(0,'src');result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.discover('tests/$testSuite'));sys.exit(not result.wasSuccessful())"
    if ($LASTEXITCODE -ne 0) { throw "测试失败: $testSuite" }
}
```

精确任务授权、候选、真实 argv 与证据摘要见 [当前 task_ops 记录](../../../scheduling/legion-v1-approval-repair.md)。

## 实际行为与修复历史

共享 Model 固定 Session 身份与提案摘要。纯 Policy 判定后，Runtime 保留不可伪造的单次许可，写前重新核验角色、任务、组织版本、boundary 和提案/内容。直接 raw Provider/Mutation 公共调用及伪造 ALLOW、无效许可不能写入；DENY 优先，审批/交接/扩权决策不执行。

Provider 在临时工作区 `.ans/events/index.jsonl` 与日期 JSONL 记录顺序事件和 +08:00 时间，不存原始内容。审计意图失败时禁止业务目录/文件创建；替换文件后结果审计失败时明确返回 audit_failed、observed_mutation=true。审计镜像不一致会关闭后续写入。

独立审查曾实际复现两个 P1：审批路径大小写/反斜杠别名绕过，scalar string 限制拆成字符。原 Kernel owner 仅修 2 个生产文件及 3 个 owner 测试，并更新 6 个已有文档。共享纯审批谓词统一路径比较，边界集合与非法审批条件明确拒绝。原 Reviewer 测试/断言保持不变，源 SHA-256 为 `3ecad393e318da89ac6d241c94af1bd1b62b9ce3ceef3c5b476e00c618755b9e`；当前 23 项全部通过，两项 P1 已关闭。

原 [开发记录](../../../scheduling/legion-v1-development.md) 和 [失败日志](../../../../.ans/runtime/legion-v1-development/evidence/reviewer-1-unit-e51e1f72.log) 保留 23 项 / 2 失败 / 5 失败断言的历史。原 owner 40、Adapter 14 的旧候选不作为当前验收；所有受影响 owner、Reviewer 与 Tester 已重新验证当前组合。

## 使用范围

CodexAdapter 与 ClaudeAdapter 是本地受控 `legion_write_file` 参数转换，不是活跃厂商 Session、真实模型请求或通用 Agent CLI。只实现本阶段 write_file 权限演示；完整组织事务、组织审批创建角色、远程集群和 Web UI 不在此版。

保证针对正常受控本地公开 API。宿主限制实际 junction/symlink 创建，链接/重解析检测分支以受控替代验证；不声称隔离恶意共享 Python 进程或宿主管理员。业务文件、index 和日期审计文件没有跨文件事务保证；已观察到的写入不能当作安全回滚。

[架构与角色协作](architecture.md) · [Kernel 当前功能](../../KernelEngineer/docs/feature/permission.md) · [Adapter 当前功能](../../AgentAdapterEngineer/docs/feature/proposal-adapters.md) · [独立审查](../../Reviewer/docs/review.md) · [Tester 完整报告](../../Tester/docs/verification.md)
