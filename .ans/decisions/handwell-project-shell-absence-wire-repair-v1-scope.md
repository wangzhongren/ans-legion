# 项目 Shell v1 缺失状态 GUI wire 投影必要修复

日期：2026-10-10；固定内置ANS Governance，仅治理准备，不写源码/测试、不init/dispatch。

## 同版实际问题与授权

Root转交独立Tester实际发现：Desktop `apps/desktop/src/models/workbench.mjs`的governedWireDTO面对已批准delete后的state:absent、sha:null仍执行sha()，导致getState IPC返回invalid_input。这是已接受缺失基线/墓碑行为的实现投影缺陷，不改变既定产品契约。

Root转交的当前观察包括实际source/binary/exec/delete/dist/selfcheck/Acceptance1及native7通过、waiting/executing/publishing截图已存在；这些是此前真实观察，不在本scope中代替修复后验收或声称全流程已通过。Tester将按实际停止记录保留暂停候选，不能覆写原日志/截图或把暂停试验当最终通过。

同真人已接受主配置 [handwell-pm-approved-project-shell-v1-project.json](handwell-pm-approved-project-shell-v1-project.json)，SHA `c872245f285125eae264b77ef4447a97fe0dcb14506c0e77f216d41003865ea4`；同冻结设计 [handwell-pm-approved-project-shell-v1-design.md](handwell-pm-approved-project-shell-v1-design.md)，SHA `a5a0166dcd302ecd65416b85b2801a5a687972481e90f80c31ea23959eff59c0`，真实接受见 [handwell-pm-approved-project-shell-v1-config-authorization.md](handwell-pm-approved-project-shell-v1-config-authorization.md)。属于同版155文件内必要实现修复，不新增权限、设计revision或客户hashgate；不得修改主cfg或六owner定义。

## 最小范围状态

Desktop与PM已完成实际只读最小评估；真实四节点计划已收敛，三项同v1必要契约修复见末尾。每节点精确文件范围均已与主cfg核对子集，没有新增ownership。

拟四节点：Desktop当前46范围内required修复及原三门→Reviewer五份compat/structure测试→Tester当前16范围继续全六门→Reviewer八份docs。其余源码只读；由固定scheduler真正派发缩小task writeSet。Reviewer原断言/Tester全gate保持，不删case、skip或降低缺失证据门槛。

## 当前输入及历史证据

0.8.2 tar、Kernel、Adapter及public API不变，本修复不重包；包字节身份取既有真实记录保持。新节点readSet必须显式固定当前所有相关upstream、Reader两文件 `apps/desktop/src/providers/impl/workspace.mjs` 与 `apps/desktop/tests/unit/workspace.test.mjs`、此前paused Tester的实际测试文件及候选依赖。任何相关输入变化必须使当前证据失效，不能混用暂停前日志、旧检查与新版本结果。

原task_ops日志、已有waiting/executing/publishing截图、old package/0.8.2 tar以及所有已存失败/停止记录保留；新检查仅当前owner已接受生成路径中的fresh run，不覆盖历史输出。真实delete缺失只能由已批准操作及明确基线证明，不能任意缺失一概通过或把null当合法present SHA。具体wire修复语义待Desktop实际评估，不擅自引入新公共API或新的操作类型。

## 精确协调路径

`docs/scheduling/handwell-project-shell-absence-wire-repair-v1.md`仅固定Supervisor经task_ops维护同功能阶段修复和独立重验记录；Governance仅更新Supervisor自有boundary/card/changelog，不写运行记录或派发。本scope已按Desktop/PM真实评估与四节点计划最终补齐，Governance未实施或验收修复。

## 最终收敛的三项同版必要合同修复

来源：Root转交Desktop/PM实际只读评估，以及尚未init的 `/private/tmp/handwell-project-shell-absence-wire-repair-v1-plan.json`。PM确认均为当前已接受设计内必要修复，无新设计gate；不是修改Model/Core/SDK工具或授权规则。

1. **合法缺失wire投影。** governedWireDTO保留已批准删除的absent/null SHA/0bytes/noexec；legacy present仍执行strict SHA验证，非法present/absent字段冲突必须拒绝。renderer两处按真实缺失状态显示，不能把null当present SHA或把任意missing当获准删除。Model、wire、显示沿现有契约修实现，不重新定义缺失授权。
2. **成员activity按钮沿既有焦点约定。** `.member-activity button`使用内侧1px焦点边线、-3px偏移及transform:none；保留真实native pointer、keyboard、Esc焦点和原触发逻辑。已有phase截图滞后可能只是DOM/过渡未稳定，Tester应等真实DOM/过渡稳定后采集，不能因此虚构UI bug或靠图片把未发生状态说成通过。
3. **真实partial后保留正确产物的受控恢复。** 已有正确asset、新Shell无diff时，不能被task_outputs_missing与completeShellRecovery的observedMutation门永久卡死。但只允许专用Host `recovery_verified_retained`事实：旧partial已有可追溯的真实成功publication/observedMutation；当前资产仍匹配该原candidate SHA/bytes/mode；同时核验新Human批准的当前baseline、current owner/task/plan及当前磁盘状态。该事实与新Mutation/results分列，不能伪造observedMutation、重新改正确binary或把普通nochange泛化成新交付。缺provenance、内容/bytes/mode改变、基线不符、owner/task/plan不符均拒绝。当前checks通过且磁盘/依赖generation末次核验后才append recovered记录；旧partial原记录保持不变。

全部Desktop修改限当前46文件内的Model/Pipeline/Organization Service及必要public/abstract facade、renderer/styles、既有unit/docs。实际精确writeSet取计划，不扩大到Core、Kernel、Adapter、SDK工具或权限；0.8.2包保持不重打。

## 四节点计划核对与只读事实

Desktop46→Reviewer5 compat/structure→Tester16全六门（包含full_node/full_desktop及包契约）→Reviewer8 docs。四节点writeSet均直接从真实计划核对为对应主cfg精确子集：

```json
[
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
    "dependsOn": []
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
    "dependsOn": [
      "desktop-shell"
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
    "dependsOn": [
      "reviewer-test-compatibility"
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
    "dependsOn": [
      "tester-shell-flow"
    ]
  }
]
```

Root转交Tester已stop45且无本次残留进程；旧Owner/包装证明、旧日志/截图和暂停候选保留历史。新任务只重验当前组合版本，不能混用之前单项通过和新修复候选。Reader两文件必须保持相关显式readSet，不因此授予写入。计划中的0.8.2 tar、暂停manifest/截图等只读artifact实际字节身份如下；仅记录真实文件hash，不将自算hash当新增人类授权。其余源/测试readSet由task_ops初始化固定：

```json
{
  ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/evidence/paused-wire-v1-20261010T155737/manifest.json": {
    "byteLength": 10798,
    "sha256": "e5b1ae3925dd0fdb04fe8f2d1463787c4e6009965edc947cfc4ef9d5ad0cb285"
  },
  ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/evidence/shell-ui-Qoe8es/executing-shell.png": {
    "byteLength": 108227,
    "sha256": "a6a9c918a7ee1c14d28917e715a4f0fff57ecac61877721fad167dd60c98164e"
  },
  ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/evidence/shell-ui-Qoe8es/publishing.png": {
    "byteLength": 199872,
    "sha256": "22aaa01df04d2f80dcb9f89151b161a0c972622a516a78472ab2fc61b2454686"
  },
  ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/evidence/shell-ui-Qoe8es/waiting-pm.png": {
    "byteLength": 213140,
    "sha256": "9fff0a10c4a0675bb5a1c91b3fea5ea3b25513005c20dcd343a2b3064333d196"
  }
}
```

此scope完成本次最终补充后停止写入，供Root固定到任务readSet。Governance没有init/dispatch、源码/测试修改或业务check执行，没有改变主cfg/六role definitions、冻结设计/原auth/review。后续实施与当前证据验收由各固定owner及scheduler执行，不能用本范围核对代替真实门禁。
