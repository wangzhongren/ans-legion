# 项目 Shell v1 Model 时间事实纯度修复范围

2026-10-10，固定内置 ANS Governance 准备；仅治理记录，不写业务源码/测试、不init/dispatch。

## 同版依据与实际问题

沿用真人已接受主配置 [handwell-pm-approved-project-shell-v1-project.json](handwell-pm-approved-project-shell-v1-project.json)，精确SHA `c872245f285125eae264b77ef4447a97fe0dcb14506c0e77f216d41003865ea4`；同冻结设计 [handwell-pm-approved-project-shell-v1-design.md](handwell-pm-approved-project-shell-v1-design.md)，SHA `a5a0166dcd302ecd65416b85b2801a5a687972481e90f80c31ea23959eff59c0`。真实接受事实仍见 [handwell-pm-approved-project-shell-v1-config-authorization.md](handwell-pm-approved-project-shell-v1-config-authorization.md)。本任务是同版必需Model纯度修复，不是新设计或新配置；不修改主cfg、六owner定义、冻结设计/原auth/review，不另制造自算hash客户gate。

Root转交Reviewer实际结构检查发现：`src/kernel/models/core.mjs`及`src/kernel/models/shell.mjs`直接调用Date.now，违反保留的原Model纯度断言。Reviewer已记录issue19/stop20，现五份测试保持冻结，不能修改纯度断言、删除case、skip或将时钟访问伪装成Model能力。

Kernel/PM正在固定角色只读评估将可信当前时间由操作层作为事实传入纯Model。修复必须保持权限判断、许可expiresAt、消费、防重放、取消/超时及失败关闭语义；不能由模型任意自报时间获得许可，也不能用固定假时间绕过过期验证。新增真实时间获取只在合法操作层，Model仅处理显式事实和纯计算。

## 精确修改范围状态

预计实现、测试及包装文件均已在当前主155精确范围；本scope最终补充已从Root准备的八节点private plan准确提取Kernel 21文件最小writeSet，全部核对属于主cfg已接受43文件子集。完整列表与调用方要求见末尾；没有新增ownership或配置权限。

## 当前依赖与证据安排

Root拟同主pin八节点：Kernel→Adapter只读重验→PM bridge（10文件范围）→Desktop（46文件范围复验）→PM docs（10文件范围）→Reviewer五份测试→Tester16文件范围→Reviewer八份docs。实际plan由固定Supervisor私有准备和task_ops派发，本记录不声称节点已经执行/通过；每节点writeSet只能缩小其已接受owner范围。

所有相关readSet必须明确Reader两个当前输入：`apps/desktop/src/providers/impl/workspace.mjs`、`apps/desktop/tests/unit/workspace.test.mjs`，连同实际Kernel/Adapter/包装当前输入固定；它们保持read-only依赖，不能因本任务重验就获得新的写权限。

Model/操作层契约变更使下游旧candidate输入和证据失效，必须按依赖重新检验。新的真实runtime包拟0.8.2、PM本阶段fresh bridge-v3生成；准确文件清单、包hash、完整SHA证据取实际打包结果，不预填虚构SHA或宣称已发行。包/lock/export变化须使依赖证据诚实失效。

旧0.8.1包、bridge-v2历史run快照、旧0.8.0、task_ops原日志、失败/issue/stop记录全部保留。新bridge-v3使用已接受PM本阶段生成边界内fresh路径；不覆盖旧包或以重测抹去原失败。固定checks当前输出刷新遵循原完整历史快照/manifest保全及当前readSet失效规则，不能以copy冒充旧原路径输入仍未变。

## 唯一新增协调路径

`docs/scheduling/handwell-project-shell-model-time-facts-repair-v1.md` 仅独立固定Supervisor经task_ops维护，同已确认功能阶段条件记录；不扩大六owner应用权限，不修改原任务运行记录。Governance仅澄清Supervisor自有boundary/card/changelog。本scope已按真实Kernel评估/计划收敛，具体列表见末尾；没有在Governance启动任何任务或验证生产修复。

## 收敛后的精确评估和调用方范围

来源：Root已准备、尚未init的 `/private/tmp/handwell-project-shell-model-time-facts-repair-v1-plan.json`。Governance直接读取计划并核对主cfg，Kernel唯一节点的精确21文件如下；不是自行扩展文件清单：

```json
[
  "src/kernel/models/core.mjs",
  "src/kernel/models/shell.mjs",
  "src/kernel/models/workbench.mjs",
  "src/kernel/services/impl/shell.mjs",
  "src/kernel/providers/impl/shell.mjs",
  "src/kernel/providers/impl/storage.mjs",
  "src/kernel/services/impl/policy.mjs",
  "src/kernel/pipelines/permission.mjs",
  "src/kernel/services/abstract/shell.mjs",
  "src/kernel/services/abstract/mutation.mjs",
  "src/kernel/services/impl/mutation.mjs",
  "src/kernel/providers/abstract/shell.mjs",
  "src/kernel/providers/abstract/storage.mjs",
  "tests/kernel/test_shell_models.test.mjs",
  "tests/kernel/test_shell_service.test.mjs",
  "tests/kernel/test_shell_provider.test.mjs",
  "docs/roles/KernelEngineer/api-spec.md",
  "docs/roles/KernelEngineer/changelog.md",
  "docs/roles/KernelEngineer/docs/feature/project-shell.md",
  "docs/roles/KernelEngineer/docs/design/2026-10-10_design_project-shell.md",
  "docs/roles/KernelEngineer/docs/change/2026-10-10_change_project-shell.md"
]
```

主配置授权43文件与本21文件关系已核对：精确子集，无新增scope。真实PM独立只读评估确认同v1必要纯度修复，不需设计revision或再造设计审批。

可信当前时间接口只由Host操作层提供：Shell/Mutation.observeTime由Provider获取fresh整数事实，经Service传递；controller.issueShellPublication新增observedAtMs。Core authority issue、consume、recheck，以及Storage真正create/replace/delete各时点均需fresh事实；缺失、NaN和非法时间必须拒绝，不准Model自行Date.now，也不能拿旧时间重用绕过过期/重放门禁。普通SDK、legion_write_file/legion_edit_file的模型参数不新增clock字段，model自报时间不能产生权限。原批准/拒绝、expiry/replay和Model purity断言保持。

Desktop节点是当前46文件范围内必要Host-only API调用方修复及三门复验，不是纯readonly节点；PM bridge是在现已批准10文件范围内修改包测试对应caller，并真实包装0.8.2到本阶段fresh bridge-v3。Reader两个当前Source/Tests仍只作为相关readSet输入，无新的write授权。所有节点文件已逐一核对为其主cfg owner writeFiles子集。计划节点范围摘要：

```json
[
  {
    "nodeId": "kernel-shell",
    "roleId": "KernelEngineer",
    "operation": "repair",
    "writeFileCount": 21,
    "checks": [
      "shell",
      "regression_model",
      "regression_unit"
    ],
    "readerInputsPresent": [
      "apps/desktop/src/providers/impl/workspace.mjs",
      "apps/desktop/tests/unit/workspace.test.mjs"
    ]
  },
  {
    "nodeId": "adapter-shell",
    "roleId": "AgentAdapterEngineer",
    "operation": "test",
    "writeFileCount": 0,
    "checks": [
      "shell",
      "regression_unit"
    ],
    "readerInputsPresent": [
      "apps/desktop/src/providers/impl/workspace.mjs",
      "apps/desktop/tests/unit/workspace.test.mjs"
    ]
  },
  {
    "nodeId": "pm-runtime-bridge",
    "roleId": "ProjectManager",
    "operation": "implement",
    "writeFileCount": 10,
    "checks": [
      "shell",
      "regression_package",
      "contract"
    ],
    "readerInputsPresent": [
      "apps/desktop/src/providers/impl/workspace.mjs",
      "apps/desktop/tests/unit/workspace.test.mjs"
    ]
  },
  {
    "nodeId": "desktop-shell",
    "roleId": "DesktopEngineer",
    "operation": "repair",
    "writeFileCount": 46,
    "checks": [
      "shell",
      "regression_model",
      "regression_unit"
    ],
    "readerInputsPresent": [
      "apps/desktop/src/providers/impl/workspace.mjs",
      "apps/desktop/tests/unit/workspace.test.mjs"
    ]
  },
  {
    "nodeId": "pm-package-final",
    "roleId": "ProjectManager",
    "operation": "implement",
    "writeFileCount": 10,
    "checks": [
      "shell",
      "regression_package",
      "contract"
    ],
    "readerInputsPresent": [
      "apps/desktop/src/providers/impl/workspace.mjs",
      "apps/desktop/tests/unit/workspace.test.mjs"
    ]
  },
  {
    "nodeId": "reviewer-test-compatibility",
    "roleId": "Reviewer",
    "operation": "review",
    "writeFileCount": 5,
    "checks": [
      "shell",
      "regression_structure"
    ],
    "readerInputsPresent": [
      "apps/desktop/src/providers/impl/workspace.mjs",
      "apps/desktop/tests/unit/workspace.test.mjs"
    ]
  },
  {
    "nodeId": "tester-shell-flow",
    "roleId": "Tester",
    "operation": "test",
    "writeFileCount": 16,
    "checks": [
      "shell",
      "regression_integration",
      "regression_ui",
      "macos_probe_required",
      "full_node_regression",
      "full_desktop_regression"
    ],
    "readerInputsPresent": [
      "apps/desktop/src/providers/impl/workspace.mjs",
      "apps/desktop/tests/unit/workspace.test.mjs"
    ]
  },
  {
    "nodeId": "reviewer-final",
    "roleId": "Reviewer",
    "operation": "review",
    "writeFileCount": 8,
    "checks": [
      "shell",
      "regression_structure"
    ],
    "readerInputsPresent": [
      "apps/desktop/src/providers/impl/workspace.mjs",
      "apps/desktop/tests/unit/workspace.test.mjs"
    ]
  }
]
```

Governance本轮只完成本scope最终补充；主cfg、六owner角色定义和其他冻结设计/授权/评审未改变。此scope从本次交付起停止写入，由Root以本精确版本纳入task readSet。后续真正init/dispatch与当前检查证据由固定scheduler执行，不能把本规划核对当实施或验证通过。
