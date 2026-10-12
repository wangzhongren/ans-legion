# 桌面图片输入 v1：已评审方案 v2

来源：固定ProjectManager在现有发行功能文档提交的feature draft v2，吸收固定Kernel、Adapter与Desktop独立只读评估和调度依赖复核。本文冻结为精确实施配置设计输入，原功能文档可在交付时更新。当前尚待真人接受，不代表已实现。

### 待实施：桌面图片输入 v1（2026-10-12，draft v2）

**推荐确认后实施；目前只有方案，未开发或验证。** 客户可以在桌面粘贴截图、拖入或选图，发送前预览/移除，允许纯图片消息。视觉模型必须收到真实图片，客户历史、后台PM及执行角色能按可信引用重载图像；不支持模型明确拒绝并保留草稿。用户已说“加一下”，本具体方案/精确配置仍须Human一次接受。K/A/D固定owner独立只读意见已齐，SDK1.0.4真实支持`PromptOptions.images`，现Provider仅text、history仅text是本次必要跨层改动；旧二哥布局与已验收1.2.3包不改作新证据。

**确定预算与能力。** 首版仅PNG/JPEG：每轮≤4张，每张原始字节≤4MiB、总≤8MiB，每张≤16MP且单边≤8192；base64按编码后字节另限，单图IPC≤6MiB，总序列化模型请求≤24MiB。项目私有blob总≤64MiB（含staged），至多256个引用；恢复单次请求图像总≤16MiB/最多8张，单条Human仍≤4张。超过预算明确拒绝，不自动压缩丢图或删旧历史。设置新增`imageCapability: unknown|supported|unsupported`，旧profile缺字段按unknown；首版由用户对真实所选模型显式设置supported，绑定profileVersion，协议/模型名不能自动证明视觉能力。unknown/unsupported遇图在发送前拒绝，文本照旧；服务真实不支持仍如实失败，不承诺用户声明就是服务已验证。改变能力仍沿原profile失效边界。

**合同和保存路径。** Kernel在现`agent.mjs`增加纯`PiImageReference`（projectId/attachmentId/SHA-256/MIME/字节/宽高）与`PiImageInput`（typed reference+受限base64），引用不是许可；`PiConversationHistory`的user消息可选imageRefs，旧{role,text}字段/序列化字节不变，不向assistant追加虚构图片。Adapter `start_run(runId,text,{images})`与`restore_history(checkpoint,{images})`接受Host临时重载的PiImageInput数组，按reference.id/SHA精确匹配当前user/imageRefs（不接受缺失、额外或跨项目输入），恢复时按每条user refs顺序组装，不让Provider自行读磁盘；旧无图两参text调用/单参restore保持兼容。真正调用`session.prompt(text,{images})`和SDK appendUser(text,images)。PM根`workbench.mjs`显式导出新纯类，PermissionRuntime旧text路径不动。

复用Desktop Project Service/Provider既有六层文件，私有`userData`按projectId保存不可变blob、digest元数据；不用客户项目Mutation/owner，不把base64放Org JSON、普通DTO或日志。Provider核PNG/JPEG magic/尺寸、规范base64与实际字节/SHA，安全派生路径、no-follow、普通文件、0600及原子写；每次恢复/预览/交接重新核SHA与项目身份。UI只传本地File字节，不接受绝对路径或远程URL；有限stage/preview/discard IPC由Host验证当前项目，preview只返回本项目有限图像。移除未发送附件仅清本次未引用staged blob；已被历史/角色引用的图不删，项目预算满先有限回收再拒绝：仅本project未被客户timeline、委托、plan/task或角色恢复refs引用且不属于活动上传/发送的staged孤儿，Provider重新核项目身份、索引/文件SHA、普通文件、no-follow及计数后删除；重启或失败后可执行同一安全回收，回收失败保留文件并明确清理错误，不靠静默减计数。已引用历史一律不自动GC。切项目不串草稿引用，异步旧预览失效；取消后的已发送Human及图片历史保留，旧请求/工具/yes不重放。

Org客户timeline消息可选imageRefs，角色恢复缓存只存引用；Host以可信Human消息/来源绑定重载像素，旧无图schema继续读且不改旧原文/历史字节，真实写入才按原CAS升级保存。PM委托、plan/task确认包含精确Human imageRefs及内容摘要，Host核来源/项目/当前版本后给PM和需看图任务的worker**真实像素**；仅传文字id不算看图。需图片的PM/worker连接能力在委托/计划预检时明确验证；图片缺失/篡改/历史图超请求预算明确失败。摘要可保图片引用但不能把模型看图描述冒充Human原话或自动事实；必需Human图片不能静默丢弃为摘要，模型拒绝看图不能伪称交接成功。

**禁止SDK静默降级。** SDK processImage失败可能省图加hint。Adapter在现`streamSimple`网络前包装核当前run真实最后user image blocks数量、MIME和字节预算；少图/只hint报`image_omitted`，不发送文本替代。允许SDK对已校验图做受控规范化/resize，但必须保留图块；原blobSHA证明来源，三协议localhost验实际网络base64解码图像/MIME/顺序，不能拿原base64哈希误拒有效规范化。敏感值规则继续保护文本/文件名元数据/模型输出；图片像素不做OCR或全称DLP，不能宣称图片中的秘密已被自动扫描。

必需全部如上，无默认可选增强；**不做CLI图片、OCR、图片生成或远程URL下载**。CLI本次无附件交互需求且原text调用保持兼容，公共SDK能力留给未来明确需求，不冒称CLI已支持。新文件：无，优先复用现有Project层；只有图头验证确需新Model文件时才提交具体唯一Desktop owner路径补授权，不能默认增7层附件目录。

<details>
<summary>精确候选实施文件（全部现存，待Governance核范围）</summary>

| 唯一owner | 项目相对路径 |
| --- | --- |
| KernelEngineer（3） | `src/kernel/models/agent.mjs`；`tests/kernel/test_agent_models.test.mjs`；`docs/roles/KernelEngineer/api-spec.md` |
| AgentAdapterEngineer（9） | `src/adapters/services/abstract/pi_agent.mjs`；`src/adapters/services/public/pi_agent.mjs`；`src/adapters/services/impl/pi_agent.mjs`；`src/adapters/providers/abstract/pi_session.mjs`；`src/adapters/providers/public/pi_session.mjs`；`src/adapters/providers/impl/pi_session.mjs`；`tests/adapters/test_pi_provider.mjs`；`tests/adapters/test_pi_service.mjs`；`docs/roles/AgentAdapterEngineer/api-spec.md` |
| DesktopEngineer（32） | `apps/desktop/src/models/desktop.mjs`；`apps/desktop/src/models/workbench.mjs`；`apps/desktop/src/models/interaction.mjs`；`apps/desktop/src/pipelines/workbench.mjs`；`apps/desktop/src/services/abstract/project.mjs`；`apps/desktop/src/services/public/project.mjs`；`apps/desktop/src/services/impl/project.mjs`；`apps/desktop/src/providers/abstract/project.mjs`；`apps/desktop/src/providers/public/project.mjs`；`apps/desktop/src/providers/impl/project.mjs`；`apps/desktop/src/services/abstract/organization.mjs`；`apps/desktop/src/services/public/organization.mjs`；`apps/desktop/src/services/impl/organization.mjs`；`apps/desktop/src/providers/impl/organization.mjs`；`apps/desktop/src/services/impl/profiles.mjs`；`apps/desktop/src/interface/main.mjs`；`apps/desktop/src/interface/preload.cjs`；`apps/desktop/src/interface/index.html`；`apps/desktop/src/interface/renderer.mjs`；`apps/desktop/src/interface/styles.css`；`apps/desktop/tests/unit/workbench-model.test.mjs`；`apps/desktop/tests/unit/interaction-model.test.mjs`；`apps/desktop/tests/unit/project.test.mjs`；`apps/desktop/tests/unit/organization.test.mjs`；`apps/desktop/tests/unit/profiles.test.mjs`；`apps/desktop/tests/unit/pipeline.test.mjs`；`apps/desktop/tests/unit/ipc.test.mjs`；`apps/desktop/tests/unit/memory.test.mjs`；`apps/desktop/tests/unit/workbench.test.mjs`；`docs/roles/DesktopEngineer/api-spec.md`；`docs/roles/DesktopEngineer/docs/feature/desktop-console.md`；`docs/roles/DesktopEngineer/docs/feature/cli-project-host.md` |
| ProjectManager（15） | `workbench.mjs`；`package.json`；`package-lock.json`；`apps/desktop/package.json`；`apps/desktop/package-lock.json`；`README.md`；`apps/desktop/README.md`；`apps/desktop/scripts/verify-dependencies.mjs`；`tests/package/test_package.mjs`；`tests/cli/test_chat.test.mjs`；`apps/desktop/tests/package/desktop-package.test.mjs`；`docs/roles/ProjectManager/feature-map.md`；`docs/roles/ProjectManager/changelog.md`；`docs/roles/ProjectManager/docs/feature/desktop-distribution.md`；`docs/roles/ProjectManager/docs/feature/cli-project-workflow.md` |
| Tester（6） | `tests/integration/test_cli_installed_flow.mjs`；`apps/desktop/tests/integration/workbench-flow.test.mjs`；`apps/desktop/tests/integration/governed-workflow.test.mjs`；`apps/desktop/tests/e2e/governed-workflow-ui.test.mjs`；`docs/roles/Tester/docs/verification-desktop-workbench-v2.md`；`docs/roles/Tester/docs/verification-governed-workflow-v1.md` |
| Reviewer（9） | `tests/reviewer/test_cli_boundaries.mjs`；`tests/reviewer/test_shell_boundaries.mjs`；`tests/reviewer/test_structure.mjs`；`apps/desktop/tests/reviewer/workbench-boundaries.test.mjs`；`apps/desktop/tests/reviewer/governed-workflow-boundaries.test.mjs`；`apps/desktop/tests/reviewer/desktop-boundaries.test.mjs`；`apps/desktop/tests/reviewer/shell-workflow-boundaries.test.mjs`；`docs/roles/Reviewer/docs/review-desktop-workbench-v2.md`；`docs/roles/Reviewer/docs/review-governed-workflow-v1.md` |

</details>

**检查与依赖（全部仓库根目录执行）。** Desktop生产Pipeline实际消费已安装`legion-runtime/services/pi-agent`及`workbench-models`，旧1.2.3包没有新类/Service能力。必须K→A→PM桥包/真实安装→D→PM终版新包→T/R并行→PM文档；D不能用开发树私有import或旧包声称通过。具体固定门：

- K：`node --test --test-concurrency=1 tests/kernel/test_agent_models.test.mjs`。
- A：`node --test --test-concurrency=1 tests/adapters/test_pi_provider.mjs tests/adapters/test_pi_service.mjs`。
- PM bridge：K/A verified后，PM根`workbench.mjs`显式导出新纯类，真实pack/install后唯一固定门`node apps/desktop/scripts/verify-dependencies.mjs`。桥版runtime **1.3.0-image-bridge.1**、Desktop仍 **0.3.3**；不宣称桥版完整桌面已完成。
- D：`node --test --test-concurrency=1 apps/desktop/tests/unit/workbench-model.test.mjs apps/desktop/tests/unit/interaction-model.test.mjs apps/desktop/tests/unit/project.test.mjs apps/desktop/tests/unit/organization.test.mjs apps/desktop/tests/unit/profiles.test.mjs apps/desktop/tests/unit/pipeline.test.mjs apps/desktop/tests/unit/ipc.test.mjs apps/desktop/tests/unit/memory.test.mjs apps/desktop/tests/unit/workbench.test.mjs`。接线与模型能力存储在Model/Profiles Service，既有Settings Provider只读，不扩大密钥加密实现范围。
- PM final：终版runtime **1.3.0** / Desktop **0.4.0**，`node --test --test-concurrency=1 tests/package/test_package.mjs tests/cli/test_chat.test.mjs apps/desktop/tests/package/desktop-package.test.mjs`及`node apps/desktop/scripts/verify-dependencies.mjs`，真实安装及source/lock/integrity检查，不能把bridge当最终图像实现。
- T installed：`node --test --test-concurrency=1 tests/integration/test_cli_installed_flow.mjs`（CLI仍text，证明调用兼容）；integration：`node --test --test-concurrency=1 apps/desktop/tests/integration/workbench-flow.test.mjs apps/desktop/tests/integration/governed-workflow.test.mjs`（新增图片全链场景）；GUI：`node --test --test-concurrency=1 apps/desktop/tests/e2e/governed-workflow-ui.test.mjs`。
- R完整七入口：`node --test --test-concurrency=1 tests/reviewer/test_cli_boundaries.mjs tests/reviewer/test_shell_boundaries.mjs tests/reviewer/test_structure.mjs apps/desktop/tests/reviewer/desktop-boundaries.test.mjs apps/desktop/tests/reviewer/workbench-boundaries.test.mjs apps/desktop/tests/reviewer/governed-workflow-boundaries.test.mjs apps/desktop/tests/reviewer/shell-workflow-boundaries.test.mjs`。

桥包固定fresh路径`.ans/runtime/legion-desktop-command-center-v1/ProjectManager/packaging/desktop-image-input-v1-bridge-20261012/legion-runtime-1.3.0-image-bridge.1.tgz`及同目录`package-smoke.json`；终包另fresh路径`.ans/runtime/legion-desktop-command-center-v1/ProjectManager/packaging/desktop-image-input-v1-final-20261012/legion-runtime-1.3.0.tgz`及同目录smoke。缓存、fixture、tmp/userData/evidence各沿原owner获准生成根并使用对应fresh stage/run。初始化计划精确绑定PM bridge的K/A来源与facade、D的bridge tar/smoke/锁/安装来源、PM final的D来源与bridge只读身份、T/R的final tar/smoke/当前fixture readSet，不在派发后偷改消费包路径。每个包固定字节不覆盖；桥与终版分别记录SHA/sourceHashes/真实Desktop manifest-lock-resolved-integrity，旧1.2.3与桥所有产物/失败证据保留。命令在配置提前冻结，不修改SDK依赖源码、不追加多余桥门；相邻层/权限/历史/取消强断保留，新契约变化后重验调用方，UI准备可并行但实际能力必须依赖桥安装。

最低验收：PNG/JPEG纯图与两图顺序、粘贴/拖入/选图/移除、三协议真实SDK网络图块解码与PM/worker实际像素交接、视觉unknown/unsupported保草稿及零图像网络、SDK省图网络前拒绝、重启原图恢复/旧text字节兼容、取消HTTP2不重放、跨项目/根链接/图缺失篡改/MIME及像素和总预算拒绝、无base64/私有图出普通日志与known-key负例，保留原文本全流程。真实Electron截图/焦点/900布局核验，Windows/付费远端不冒通过。尚需实现时验证SDK规范化和模型服务实际能力，当前无测试通过声明；上述有限存储/来源/预算合同是待接受设计，不是已存在功能。

