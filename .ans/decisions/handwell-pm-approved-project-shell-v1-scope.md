# 项目 Shell v1 精确治理 scope

状态：设计同版已确认；精确配置候选待人类 SHA 接受。Governance 固定角色，不 init/dispatch，不实施应用或测试。

配置 `handwell-pm-approved-project-shell-v1-project.json` 使用 task_ops schemaVersion 1；writeFiles 逐个精确文件，不含目录、runtime 或控制面。六 owner 合计 155 authored 文件，互不重叠；autoDispatch 只在后续真人接受该配置及 scheduler 实际 init 后生效。操作枚举是任务阶段种类：Kernel/Adapter/Desktop/PM implement/review/test/repair，Tester/Reviewer review/test；这些枚举不授权原仓库任意删除。产品受控 delete 契约在 Kernel Mutation/Storage 中实现。

## 责任和阶段门禁

Kernel 独占 Shell Model、Service三层、Provider三层、原 Mutation/Storage delete 和 check/agent/core/workbench generation及缺失基线契约。Adapter 独占 typed pending、一原请求单响应、single_run activity budget 和公开 API。Desktop 独占 PM 独立 review queue、组织持久 ledger、snapshot缺失基线、CAS、UI、Shell outputs/task metadata 接线。PM 独占 package exports、包锁、公开纯模型导出、依赖验证脚本及本角色 docs；不公开 Provider/Host permit。Tester 独立完整 Shell/发布/恢复/UI 与真 macOS 探针；Reviewer 独立结构和安全审阅。新文档均唯一 owner。其他源码/测试只读，不授予 Tester/Reviewer 修生产权限。

后续 scheduler 必须分阶段：Kernel Model→Provider→Service及受控发布契约；Adapter 接入；PM 早期 public runtime packaging bridge；Desktop queue/ledger/UI；PM 最终 packaging release；Reviewer early 精确自有测试兼容/结构检查；Tester 独立 flow/macOS/UI/现有完整回归；最后 Reviewer 安全结构审阅及同检查复验。阶段任务 writeSet 只能缩小配置；旧任一结果不自动视作当前证据。角色设计必须保持本次冻结同版；实质变化重新评审。

Tester 验收节点必须包含 `shell`、`macos_probe_required`、`regression_integration`、`regression_ui`、`full_node_regression`、`full_desktop_regression`；Reviewer 必须包含 `shell` 与 `regression_structure`；各实施 owner 必须包含 shell 及所配置 regression checks；PM 另必须包含 contract。task_ops schema 不提供独立 requiredGate 字段，故上述全部 ID 必须写入实际 plan checks，不得仅靠此文字假称工具已自动强制。checks 为精确 argv、超时均<=300秒；本轮只校验配置，不运行尚未实施的测试。

macos_probe_required 在其他平台明确失败，验证>0实际测试及0 skip/todo。探针必须实际执行普通管道/子进程/npm依赖安装（受控本地fixture，无全局安装）、network none/localhost/外网审批模式，精确许可/防伪造/过期/重放、硬链接/符号链接/no-follow竞态、IPC/Mach/Keychain/launchd/host userData/原目录拒绝、posix_spawn SETPGROUP/SETSID、detached/double-fork/组长先退出及取消/timeout无残留，跨进程lock/半套依赖/generation证据失效、delete/缺失墓碑、PM CAS/队列/迟到单回应、多文件partial_published/审计失败/恢复。无法证明隔离时关闭backend，不能把探针skip或unsupported当macOS支持，也不更改原fixedCheck规则。外网审批模式只用受控测试服务和已明确批准测试范围，无客户命令或真实凭据。

新 runtime 生成仅每角色私有阶段目录，Host 创建请求执行角色镜像也归该角色effects。node_modules/dist批准效果是产品内请求临时效果，不成为实现角色永久源码授权；发布manifest/lock仍须文件owner。旧阶段config/evidence及产物不可覆盖，不修改旧审批文字。固定回归在既有精确生成边界只可创建独立fixture并清理本次目录；新增Shell所有输出在新stage。真实用户SSH app/fixture活进程不可globkill；探针只清理本次记录pid/子树。TesterUI hidden不抢焦点，live GUI单独可视展示。

## 精确路径和生成效果

```json
{
  "KernelEngineer": {
    "authoredFileCount": 43,
    "newPaths": [
      "src/kernel/models/shell.mjs",
      "src/kernel/services/abstract/shell.mjs",
      "src/kernel/services/public/shell.mjs",
      "src/kernel/services/impl/shell.mjs",
      "src/kernel/providers/abstract/shell.mjs",
      "src/kernel/providers/public/shell.mjs",
      "src/kernel/providers/impl/shell.mjs",
      "tests/kernel/test_shell_models.test.mjs",
      "tests/kernel/test_shell_service.test.mjs",
      "tests/kernel/test_shell_provider.test.mjs",
      "docs/roles/KernelEngineer/docs/feature/project-shell.md",
      "docs/roles/KernelEngineer/docs/design/2026-10-10_design_project-shell.md",
      "docs/roles/KernelEngineer/docs/change/2026-10-10_change_project-shell.md"
    ],
    "generatedEffects": [
      ".ans/runtime/handwell-pm-approved-project-shell-v1/KernelEngineer/fixtures/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/KernelEngineer/user-data/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/KernelEngineer/tmp/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/KernelEngineer/evidence/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/KernelEngineer/packaging/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/KernelEngineer/npm-cache/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/KernelEngineer/electron-cache/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/KernelEngineer/shell-mirrors/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/KernelEngineer/shell-home/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/KernelEngineer/shell-logs/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/KernelEngineer/publication-staging/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/KernelEngineer/recovery/"
    ]
  },
  "AgentAdapterEngineer": {
    "authoredFileCount": 17,
    "newPaths": [
      "tests/adapters/test_shell_tools.mjs",
      "docs/roles/AgentAdapterEngineer/docs/feature/project-shell.md",
      "docs/roles/AgentAdapterEngineer/docs/design/2026-10-10_design_project-shell.md",
      "docs/roles/AgentAdapterEngineer/docs/change/2026-10-10_change_project-shell.md"
    ],
    "generatedEffects": [
      ".ans/runtime/handwell-pm-approved-project-shell-v1/AgentAdapterEngineer/fixtures/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/AgentAdapterEngineer/user-data/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/AgentAdapterEngineer/tmp/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/AgentAdapterEngineer/evidence/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/AgentAdapterEngineer/packaging/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/AgentAdapterEngineer/npm-cache/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/AgentAdapterEngineer/electron-cache/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/AgentAdapterEngineer/shell-mirrors/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/AgentAdapterEngineer/shell-home/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/AgentAdapterEngineer/shell-logs/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/AgentAdapterEngineer/publication-staging/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/AgentAdapterEngineer/recovery/"
    ]
  },
  "DesktopEngineer": {
    "authoredFileCount": 46,
    "newPaths": [
      "apps/desktop/tests/unit/shell-review.test.mjs",
      "apps/desktop/tests/unit/shell-publication.test.mjs",
      "docs/roles/DesktopEngineer/docs/feature/project-shell.md",
      "docs/roles/DesktopEngineer/docs/design/2026-10-10_design_project-shell.md",
      "docs/roles/DesktopEngineer/docs/change/2026-10-10_change_project-shell.md"
    ],
    "generatedEffects": [
      ".ans/runtime/handwell-pm-approved-project-shell-v1/DesktopEngineer/fixtures/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/DesktopEngineer/user-data/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/DesktopEngineer/tmp/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/DesktopEngineer/evidence/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/DesktopEngineer/packaging/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/DesktopEngineer/npm-cache/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/DesktopEngineer/electron-cache/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/DesktopEngineer/shell-mirrors/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/DesktopEngineer/shell-home/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/DesktopEngineer/shell-logs/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/DesktopEngineer/publication-staging/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/DesktopEngineer/recovery/"
    ]
  },
  "ProjectManager": {
    "authoredFileCount": 20,
    "newPaths": [
      "docs/roles/ProjectManager/docs/feature/project-shell.md",
      "docs/roles/ProjectManager/docs/design/2026-10-10_design_project-shell.md",
      "docs/roles/ProjectManager/docs/change/2026-10-10_change_project-shell.md"
    ],
    "generatedEffects": [
      ".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/fixtures/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/user-data/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/tmp/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/evidence/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/packaging/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/npm-cache/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/electron-cache/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/shell-mirrors/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/shell-home/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/shell-logs/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/publication-staging/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/recovery/"
    ]
  },
  "Reviewer": {
    "authoredFileCount": 13,
    "newPaths": [
      "tests/reviewer/test_shell_boundaries.mjs",
      "apps/desktop/tests/reviewer/shell-workflow-boundaries.test.mjs",
      "docs/roles/Reviewer/docs/review-project-shell-v1.md",
      "docs/roles/Reviewer/docs/feature/project-shell.md",
      "docs/roles/Reviewer/docs/design/2026-10-10_design_project-shell.md",
      "docs/roles/Reviewer/docs/change/2026-10-10_change_project-shell.md"
    ],
    "generatedEffects": [
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Reviewer/fixtures/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Reviewer/user-data/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Reviewer/tmp/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Reviewer/evidence/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Reviewer/packaging/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Reviewer/npm-cache/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Reviewer/electron-cache/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Reviewer/shell-mirrors/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Reviewer/shell-home/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Reviewer/shell-logs/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Reviewer/publication-staging/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Reviewer/recovery/"
    ]
  },
  "Tester": {
    "authoredFileCount": 16,
    "newPaths": [
      "tests/integration/test_shell_flow.mjs",
      "tests/integration/test_shell_macos_probe.mjs",
      "apps/desktop/tests/integration/shell-workflow.test.mjs",
      "apps/desktop/tests/e2e/shell-workflow-ui.test.mjs",
      "docs/roles/Tester/docs/verification-project-shell-v1.md",
      "docs/roles/Tester/docs/feature/project-shell.md",
      "docs/roles/Tester/docs/design/2026-10-10_design_project-shell.md",
      "docs/roles/Tester/docs/change/2026-10-10_change_project-shell.md"
    ],
    "generatedEffects": [
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/fixtures/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/user-data/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/tmp/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/evidence/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/packaging/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/npm-cache/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/electron-cache/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/shell-mirrors/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/shell-home/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/shell-logs/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/publication-staging/",
      ".ans/runtime/handwell-pm-approved-project-shell-v1/Tester/recovery/"
    ]
  }
}
```

## 变更前治理基线

旧 `oldpolicyhash='ddc9cfd12dc62d413a6353c4150e488c3451bb6ac8f2f37550441e993a8ec4fa'`。保留所有既有授权/证据；本次只追加治理候选。

```json
{
  ".ans/roles/KernelEngineer/boundary.md": "5dd258783497ae15e0c8ac94b4dbf4c956ba95897807662b367757a04f96ba52",
  ".ans/roles/KernelEngineer/boundary.yaml": "7b4af1219057197fdecfc69cf071bfb3a3ee8d5d1149842a4af7a58f22ffa0a1",
  ".ans/roles/KernelEngineer/role-card.md": "e5b1c8c3984ae49e937e79ef722f8d1e4d0970509e5a4cd1aac75107137fae0d",
  ".ans/roles/KernelEngineer/changelog.md": "952b84a8fa7302d7213955178ee6f5a363c53da003730f266214c4191347b9a8",
  ".ans/roles/AgentAdapterEngineer/boundary.md": "dc9f17d83dbe74328419546072c3f81e7a4e560ca2896789f5a0dc14008213e9",
  ".ans/roles/AgentAdapterEngineer/boundary.yaml": "e1d1e1ccad175b2b3e0e00b16dfad773217e049722c82f70da1e5970647cbe28",
  ".ans/roles/AgentAdapterEngineer/role-card.md": "dd665764ac118c69907bc2ee8a39bfb8c33d467799da802c660036e4276ce944",
  ".ans/roles/AgentAdapterEngineer/changelog.md": "e6becb93fa7b1e55c6998c8ccae429625a0911a36d6280fca5cee984af0d36df",
  ".ans/roles/DesktopEngineer/boundary.md": "2a53b59b670b91bbe2ac808faf7110fae9c79543442ce90ccc00c9edcfa89000",
  ".ans/roles/DesktopEngineer/boundary.yaml": "7a926514c403d3df87e273a8b35db711cddcae9602e9ef162bdb7322c24b1973",
  ".ans/roles/DesktopEngineer/role-card.md": "6f72e68ed627670fe5ed032bb1b78eec172ae1e27c46e853bb6bbb8b6e18db8f",
  ".ans/roles/DesktopEngineer/changelog.md": "d57d310906a745cf9a332155df86521c40ba2b5f74a19156f562b984e4f7a6ce",
  ".ans/roles/ProjectManager/boundary.md": "a3e738943b4d07909e428013b39a48b441ef373c46cf218dd434cbf1d2aed204",
  ".ans/roles/ProjectManager/boundary.yaml": "016540d4d94c32f0bd641c9bbb1d31e712d8af06c54f97de580904e5a7dd70ff",
  ".ans/roles/ProjectManager/role-card.md": "2e6df99abea4ac1cadd6cbaee7603fdde71e80cb6b8d1f92aadacce150ad653d",
  ".ans/roles/ProjectManager/changelog.md": "3811394afcd1d25794957dad686e8a0a9e3add7e0a3ef11322d7e662610291ed",
  ".ans/roles/Reviewer/boundary.md": "08b8f7fe5c9cfb1bed02a40c67831b6b02205ebe55e76286dfe1ed2ecdcc18b2",
  ".ans/roles/Reviewer/boundary.yaml": "f68adb7d3ac5976cbc9670c75e05efe4c5187891b1f814cde31724e76643fbee",
  ".ans/roles/Reviewer/role-card.md": "8cdc203cbcb9975446266f45cb61f4852c3974fec3ed966f473aa0977da6c3b4",
  ".ans/roles/Reviewer/changelog.md": "ea08592cc149dee254768e3542fa18dee6ee8d653feb309b06be749a31155601",
  ".ans/roles/Tester/boundary.md": "20220efb9b7a38b16a16d06dc3db8e50c24f1f7018c00e2752b7cafede1aabbb",
  ".ans/roles/Tester/boundary.yaml": "d34f4a14282ee98b850b8ef9c7888d0db6325f2df7232d77b32ae86f3ec9ebde",
  ".ans/roles/Tester/role-card.md": "83c8f0a7391ff81d6ee48da4e26a1b3608d0a835d377b2b0c6708796e8c8c52d",
  ".ans/roles/Tester/changelog.md": "cfabda93c02f309b954a59fa2f4296e7ef2ed600db1d2df8f65fb6b5fc31557d"
}
```

配置hash不等于真人接受；必须将候选原文/SHA提交 Root 给人类确认后，才可由已有固定scheduler准备计划并执行。PM对产品内每次Shell审批不是本配置接受。

Supervisor 仅追加精确 `docs/scheduling/handwell-pm-approved-project-shell-v1.md` 条件范围，不属于六个执行owner配置、不产生应用所有权；只在真人接受配置后可由task_ops创建。Governance本轮不写schedule。PM bridge/final阶段writeSet须分离，最终只改其独立docs并复验包身份，不更改bridge已作为下游输入的package/lock/export字节；若必须改变则诚实失效并重测依赖。

## 必要调用方兼容补充

Kernel 已有独占 Policy impl、Permission pipeline、test_policy 精确加入本配置：delete 仍须独立合法工具/capability/请求授权，不放宽已有 approve/deny。Policy abstract/public 的当前 `evaluate` / `createPolicyService` 契约不需新增参数或方法，保持只读；如果实际实施必须改变它们，先提供具体必要性再精确补配置。新增源码删除操作不是删除实现仓库文件的无限权限。

Reviewer 已有独占 test_structure、desktop-boundaries、workbench-boundaries 精确加入：现有 tarball固定SHA、39file/37sources以及固定工具列表必须在新真实包/typed工具变化后由原Reviewer更新新发行身份断言，保留旧历史tar字节保护。应验证真实新tar/source每文件SHA/精确count，禁止移除哈希或以>=判断降低断言。新增7个Shell源码后的准确数量取实际包清单；没有提前编造新SHA。

新增精确授权补充：
```json
{
  "KernelEngineer": [
    "src/kernel/services/impl/policy.mjs",
    "src/kernel/pipelines/permission.mjs",
    "tests/kernel/test_policy.test.mjs"
  ],
  "Reviewer": [
    "tests/reviewer/test_structure.mjs",
    "apps/desktop/tests/reviewer/desktop-boundaries.test.mjs",
    "apps/desktop/tests/reviewer/workbench-boundaries.test.mjs"
  ]
}
```

## 既有 fixed regression 的精确生成路径兼容核验

新Shell capability执行/镜像/日志/probe只能新stage。以下例外仅已配置既有fixed regression，沿用 harness 原owner已接受生成边界，且本次fresh mkdtemp/UUID子目录；不授权任何旧稳定proof/evidence/tar/history覆写，不是oldruntime glob。全回归调用各owner既有harness的限定生成效果，不能把读取/执行测试当该测试源码所有权转移。SDK inMemory固定空cwd仅mkdir初始化，不能写持久会话。

```json
{
  "KernelEngineer": [
    ".ans/runtime/legion-governed-workflow-v1/KernelEngineer/tmp/"
  ],
  "AgentAdapterEngineer": [
    ".ans/runtime/legion-governed-workflow-v1/AgentAdapterEngineer/tmp/",
    ".ans/runtime/legion-governed-workflow-v1/AgentAdapterEngineer/fixtures/pi-provider/",
    ".ans/runtime/legion-governed-workflow-v1/AgentAdapterEngineer/fixtures/pi-service/",
    ".ans/runtime/legion-governed-workflow-v1/AgentAdapterEngineer/fixtures/control-tools/"
  ],
  "DesktopEngineer": [
    ".ans/runtime/legion-governed-workflow-v1/DesktopEngineer/fixtures/",
    ".ans/runtime/legion-governed-workflow-v1/DesktopEngineer/user-data/",
    ".ans/runtime/legion-governed-workflow-v1/DesktopEngineer/tmp/"
  ],
  "ProjectManager": [],
  "Reviewer": [
    ".ans/runtime/legion-governed-workflow-v1/Reviewer/tmp/",
    ".ans/runtime/legion-governed-workflow-v1/Reviewer/fixtures/",
    ".ans/runtime/legion-governed-workflow-v1/Reviewer/user-data/"
  ],
  "Tester": [
    ".ans/runtime/legion-governed-workflow-v1/Tester/tmp/"
  ]
}
```

实际读取核验：Kernel events/agent_runtime/project_read/mutation/demo/check_provider/check_service 在原 Kernel tmp 下 mkdtemp，然后所有改变均在其新子目录；Tester generic_agents/permission_flow 在 Tester tmp 下 mkdtemp，哨兵及控制目录也是该fixture内；Desktop profiles/workspace/history/project/workbench/pipeline/ipc/organization/acceptance 都在原 fixtures/user-data 内 mkdtemp；Adapter pi_provider/pi_service/control_tools 的固定fixture cwd只初始化目录、SettingsManager/SessionManager均inMemory，无旧proof写入。Reviewer governed-workflow-boundaries及其旧current tests 的fixture也fresh，三份已精确列入的current tests可迁新stage。

发现的真实覆写风险必须修正，保留断言：

| Owner | 精确文件 | 实际风险与必要修正 |
| --- | --- | --- |
| Tester | `apps/desktop/tests/integration/workbench-flow.test.mjs` | 原stable rival-timeline-refusal.json、public-flow-proof.json；生成helper/proof迁新stage+fresh run |
| Tester | `apps/desktop/tests/integration/governed-workflow.test.mjs` | 原stable governed-flow.json、memory-flow.json；迁新stage+fresh run |
| Tester | `apps/desktop/tests/e2e/workbench-ui.test.mjs` | 原固定 handwell截图及zip-ui-proof.json；迁新stage+fresh run，旧ZIP保持只读 |
| Tester | `apps/desktop/tests/e2e/governed-workflow-ui.test.mjs` | 原固定role-context-20261009截图/actual json；迁新stage+fresh run |
| PM | `tests/package/test_package.mjs`、`apps/desktop/tests/package/desktop-package.test.mjs` | 已配置；原stable tar/package-smoke/protected-before/after及desktop smoke输出；由PM迁新stage，原历史tar/ZIP仍核验原bytes |

只因这些实际风险将上述四Tester旧owner文件补进writeFiles；其余旧fresh harness不扩源码配置。Reviewer三个已有精确测试可修自己的newstagehelper/current包身份，旧历史身份保护段不能一概替换。任何后续发现的稳定旧输出仍要先定位并由原owner精确授权修正，不能用本例外放行。没有运行回归或改测试源码。

## 实际治理校验

`task_ops.roles_valid(root, config)` 以读取候选配置直接调用，无init/dispatch，无schedule写入。校验配置/全部活跃边界的文件与生成效果独占；旧明确SUPERSEDED角色历史不作为当前owner且未修改。检查超时上限和Python gate语法通过；尚未执行业务checks，未产生支持平台/隔离通过结论。

```json
{
  "roles_valid": "PASS",
  "schemaVersion": 1,
  "executionRoles": 6,
  "exactAuthoredFiles": 155,
  "perRole": {
    "KernelEngineer": 43,
    "AgentAdapterEngineer": 17,
    "DesktopEngineer": 46,
    "ProjectManager": 20,
    "Reviewer": 13,
    "Tester": 16
  },
  "checkCommands": 19,
  "timeoutBounds": "1..300 PASS",
  "activeBoundaryOwnershipAudit": "PASS",
  "auditedRoles": [
    "DesktopEngineer",
    "reviewer",
    "ProjectManager",
    "tester",
    "KernelEngineer",
    "AgentAdapterEngineer",
    "ProductDesigner",
    "Supervisor"
  ],
  "preservedSupersededRolesExcludedFromActiveOwnership": [
    "project-manager",
    "organization-engine",
    "assembly",
    "supervisor-engine",
    "agent-adapter",
    "control-plane",
    "kernel"
  ],
  "designExactSha256": "PASS",
  "configSha256": "c872245f285125eae264b77ef4447a97fe0dcb14506c0e77f216d41003865ea4",
  "taskInitDispatch": "NOT_RUN",
  "applicationTests": "NOT_RUN"
}
```
