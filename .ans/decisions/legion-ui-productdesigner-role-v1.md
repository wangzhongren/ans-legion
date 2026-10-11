# Legion UI 产品设计角色提案

状态：Human 已接受 ProductDesigner 角色及精确六文件设计配置。该接受不修改当前组织登记、固定项目配置或现有角色快照；本次未初始化或派发任务。

## 提议

在 Legion 项目中新增 `ProductDesigner`（产品与界面设计）角色，负责重新设计工作台信息架构、导航、现有功能操作流程、视觉系统、响应式与无障碍设计，以及静态 HTML 原型。用户明确需要“产品重新设计交互，以及界面”。角色可以改变旧控件布局、交互位置、步骤安排和呈现方式。

用户要求“legion 保持当前功能一致”。因此，重新设计保留现有功能能力、API/IPC 契约、确认与权限规则、数据结果语义。设计覆盖项目创建/选择入口、AI 设置/连接测试、纯聊天与任务详情、固定成员状态、三类 Human 请求及关闭保留/恢复、真实检查与验收失败返修，以及空/加载/错误/取消状态；项目、成员和任务的可创建/选择行为必须以当前实现为准，不虚构指标或状态。不增加运行时 ProductManager 角色或新产品功能。

## 职责边界

- DesktopEngineer 保持所有 Desktop 运行时 UI 源码、接口、IPC、API 和现有实现测试的唯一 owner。
- ProductDesigner 只读项目资料；Human 接受并完成后续注册后，本角色仅可写 boundary.md Section 1 明列的六个设计交付文件。角色卡、boundary.md、boundary.yaml 与职责说明由 Governance 维护，对 ProductDesigner 只读。
- 当前桌面工作台的功能入口、流程和接口依据 DesktopEngineer 的功能地图、功能说明、API 规格及现有代码；未知行为不推测。
- 原型是离线交互表达材料，不代表产品已实现、已测试或已改变底层功能、接口、确认/权限规则和数据结果语义。

## Human 接受后仍需的治理步骤

规范当前仍登记在 `.ans/organization/current.yaml`，不可覆盖版本为 `.ans/organization/versions/v004.yaml`；`.ans/organization/graph.yaml` 与 `.ans/project.json` 也保持不变。当前 active workspace 的角色登记兼容由 Supervisor 协调。本次接受只记录 ProductDesigner 的角色定义及其精确六文件配置，不改动上述注册表或现行项目配置。

Supervisor 可依据已接受的精确配置为 ProductDesigner 派发设计任务；本次治理工作没有初始化或派发任务。

## 提案配置指纹

TaskOps 配置提案采用标准项目配置 schema。Human 已直接批准其完整 JSON 字节 SHA-256：`7b5addceef43202f4abf2411cb436275a097fa4bdcaf5e4a094386d75b5952b1`；Supervisor 可按该精确配置的 `autoDispatch` 与六文件 writeSet 正常派发。该哈希不是现行 `.ans/project.json` 的摘要。文档交付检查仅覆盖六个指定文件的存在/非空、ProductDesigner 文档路径，以及原型的有限静态检查：允许本地交互 JavaScript，使用 Node --check 从标准输入检查语法但不执行脚本；检查外部资源和若干直接网络、Electron、IPC 调用。该检查不构成安全证明或产品功能/视觉验收。

配置文件完整字节 SHA-256：`7b5addceef43202f4abf2411cb436275a097fa4bdcaf5e4a094386d75b5952b1`。该指纹唯一标识用户已批准的 ProductDesigner 配置。
