# 及时雨 / Handwell 桌面界面实施范围

日期：2026-10-09。状态：精确配置候选，等待客户审阅其 SHA-256；未初始化或派发执行任务。

客户已在最新双语品牌与近黑 v2 预览后回复“好的，可以开发了”，确认该设计实施。此次配置直接绑定[已确认的 ProductDesigner 设计](../../docs/roles/ProductDesigner/docs/design/2026-10-08_design_legion-ui.md)，并以[对应原型](../../docs/roles/ProductDesigner/prototypes/legion-ui.html)作为视觉与交互参考。设计文件 SHA-256：`71e1681f3085c3e4844695f2401b6e2e1af7440c2ac20b4318759c9f7f3b1ff1`。两者均为只读输入，不以旧 workflow 设计路径替代。

实施把“及时雨 / Handwell”、近黑暖中性视觉、中心输入、稳定成员栏、任务详情浮层、设置和确认弹窗落实到真实 Electron 界面。显示取现有真实 DTO 与 IPC；离线原型的演示数据、场景切换器和模拟执行不进入产品。现有 CSP、IPC、许可、凭据安全、停止撤权、真实自测与独立验收语义继续约束界面。

| 角色 | 精确可写文件数 | 工作及验证 |
| --- | ---: | --- |
| DesktopEngineer | 11 | 四个现有界面文件、两个现有单元测试、五个现有角色文档；实现与必要返修；复用原批准的 `model`、`unit` checks |
| Tester | 5 | 两个现有 UI 测试与三个现有角色文档；独立核对真实界面、流程与回归；复用原批准的 `integration`、`ui` checks |
| Reviewer | 2 | 仅两个现有审阅文档；独立审阅层次、权限与数据安全；原批准的 `structure` check 只读运行现有测试，无断言修改权限 |

完整 18 个项目相对路径及原样检查 argv 见[候选精确配置](legion-ui-handwell-implementation-v1-project.json)。全部路径均在各角色现有 boundary.md Section 1 内；任务派发只能进一步缩小 writeSet。无新增源码或测试路径；不修改角色卡、边界、旧配置或旧 registry。

Tester 在现有验证与设计文档追加本次 10 月 9 日 UI 验证章节，保留原有结果和失败证据。DesktopEngineer 先更新现有角色实施设计及行为说明，再按已确认的 ProductDesigner 设计实施。Reviewer 与 Tester 不修生产代码。真实界面需查看设置、会话和浮层在工作区内的可见性、导航、滚动、草稿与焦点，覆盖深浅主题、短窗口、键盘及减少动画；源码检查或原型操作不替代实际渲染。

配置只保留 DesktopEngineer 的 `implement` / `repair`、Tester 的 `test`、Reviewer 的 `review` 操作。`maxConcurrentWorkers` 为 3，三角色 `autoDispatch` 为 true，需求与设计修订均为 false。复用 checks 来自旧 workflow 已批准配置，仅作命令参考；新配置的设计绑定与文件授权独立审阅。

依据 ANS `task-operations.md`，客户需审阅新配置的精确 SHA-256 后才可 init / dispatch。自行计算摘要、客户已确认设计、旧任务获准或本文件的授权来源字段，都不构成新配置摘要获批准的证据。
