# Kernel 功能导航

当前产品为 Node ESM + Pi 1.0.4。身份与精确文件权限来自可信宿主，实例只能缩小权限。工作台 v2 增加 Human 上下文/任务确认、公开纯 authority 和提交前真实 SHA 重查；客户动态角色不复制开发组织。

| 功能 | 当前行为 | 说明 |
| --- | --- | --- |
| 文件提案与审计 | 五种决策、一次确认、单次许可、root/context SHA 与同步输出父链重查、index/daily 审计 | [权限流程](docs/feature/permission.md) |
| 具名通用 Agent | 原 single_run 保持；新增 tool-less conversation、纯连接/文本/历史共享契约 | [实例流程](docs/feature/generic-agents.md) |

[公开 API](api-spec.md) · [维护职责](functional-description.md) · [本阶段设计](docs/design/2026-10-07_design_desktop-workbench-v2.md) · [实施历史](changelog.md) · [当前任务与最终证据](../../scheduling/legion-desktop-workbench-v2.md)。

本阶段已实跑 Model45、Storage/Event24、Policy/Scope17（均0fail/0skip）；最终固定九suite结果与候选以当前任务记录为准。新增对话 Model 不代表 Adapter 多轮或 Desktop/ZIP 已验收，后段将以实际新 tarball 重新验证。

Runtime.close 同版修复让关闭等待活动运行的取消与终态审计，再关闭 Mutation；公共 API 不变。历史 pipeline13、八suite74项见[修复任务](../../scheduling/legion-pi-node-v3-close-repair.md)，不替代当前输入的九suite检查。原73项、Tester19通过/1失败和Python40/47项保留为历史。
