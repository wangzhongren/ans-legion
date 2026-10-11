# Kernel 功能导航

当前产品为 Node ESM + Pi 1.0.4。身份与精确文件权限来自可信宿主，源码实例使用当前角色全部精确owned文件，task只限定工具/检查/生成效果。工作台 v2 增加 Human 上下文/任务确认、公开纯 authority 和提交前真实 SHA 重查；客户动态角色不复制开发组织。

| 功能 | 当前行为 | 说明 |
| --- | --- | --- |
| 软件检查与控制工具授权 | 真实 macOS Node 检查、live 批准与输入版本、无子进程运行、十工具精确 capability 交集 | [检查流程](docs/feature/software-checks.md) |
| 文件提案与审计 | 五种决策、一次确认、单次许可、root/context SHA 与同步输出父链重查、index/daily 审计 | [权限流程](docs/feature/permission.md) |
| 具名通用 Agent | 原 single_run 保持；新增 tool-less conversation、纯连接/文本/历史共享契约 | [实例流程](docs/feature/generic-agents.md) |

[公开 API](api-spec.md) · [维护职责](functional-description.md) · [本阶段设计](docs/design/2026-10-07_design_desktop-workbench-v2.md) · [实施历史](changelog.md) · [当前任务与最终证据](../../scheduling/legion-desktop-workbench-v2.md)。

本阶段已实跑 Model45、Storage/Event24、Policy/Scope17（均0fail/0skip）；最终固定九suite结果与候选以当前任务记录为准。新增对话 Model 不代表 Adapter 多轮或 Desktop/ZIP 已验收，后段将以实际新 tarball 重新验证。

Runtime.close 同版修复让关闭等待活动运行的取消与终态审计，再关闭 Mutation；公共 API 不变。历史 pipeline13、八suite74项见[修复任务](../../scheduling/legion-pi-node-v3-close-repair.md)，不替代当前输入的九suite检查。原73项、Tester19通过/1失败和Python40/47项保留为历史。

2026-10-08 完整组织阶段的实际检查/授权 API 见[公开契约](api-spec.md)与[检查流程](docs/feature/software-checks.md)，证据由[本次任务](../../scheduling/legion-governed-workflow-v1.md)记录。软件检查通过不自动等同 Desktop 独立验收通过。

## 项目 Shell v1

- [project-shell](docs/feature/project-shell.md)：PM逐调用批准、私有镜像、真实OS隔离、Host-only receipt、源删除及生成发布。
- [2026-10-10设计](docs/design/2026-10-10_design_project-shell.md)与[实际变更](docs/change/2026-10-10_change_project-shell.md)。原software-checks独立保留。

## CLI角色owner v2（2026-10-10）

- [当前权限流程](docs/feature/permission.md)：持久独占owner、旧任务文件授权拒绝、租约内Storage同步重读、真实提交审计。
- [当前Agent流程](docs/feature/generic-agents.md)：全部角色owned文件，同角色串行，不同角色独立上下文。
- [CLI控制工具](docs/feature/cli-controls.md)：分类记忆query/remember与Supervisor typed建议，不授owner。
- [实施设计](docs/design/2026-10-10_design_cli-controls.md)、[API](api-spec.md)、[本轮候选与实际检查](../../scheduling/legion-cli-role-owned-v2.md)。旧Shell最终验收仍暂停。
