# 二哥展示改名：已评审实施范围 v1

来源：固定 ProjectManager 在现有发行功能文档中提交并评审的改名草案。当前文件冻结为本次精确配置的方案依据，原功能文档可由 PM 在实施后更新交付状态。尚待真人接受，不是源码派发授权。

### 待实施：二哥展示改名（2026-10-12，draft v1）

**推荐确认后实施。** 客户已要求产品和客户助手统一叫“二哥”，并说“那就修改吧”；这里准备具体改名范围，源码/测试尚未派发，本draft和从零收窄的精确配置仍须实际Human接受。客户打开“二哥项目指挥台”，所有新助手气泡、欢迎/输入/任务引导、连接提示和CLI提示显示“二哥”，后台PM继续按真实职责与连接运行。

Desktop更改窗口/HTML标题、品牌字样/标记、页签/ARIA/输入占位、renderer头像/回复/PM问题转达及Supervisor展示别名；Model仅改`manager_only`、`preflight_incomplete`、`conversation_busy`、`invalid_plan`等精准客户可见错误文字，错误码不变；Pipeline两条客户首轮/恢复prompt自称“二哥（内部Supervisor）”，Human确认中的“Supervisor建议”改客户可读名称。后台监督prompt/PM GUIDE可保留内部身份。CLI仅改`bin/chat.mjs` banner、`Su>`/`Su:`、风险/监控/错误展示名。**持久`Supervisor` roleId、FIXED_ROLE_DUTIES、AgentInstance.name、组织name/digest、channel与旧历史原文不改**；`legion`命令/env/npm包/import/API/目录不改，不全局替换字符串、不重构或发布。

从零拟定**29个精确文件**（下列路径均为项目相对路径，测试只迁客户展示断言与当前候选，不改权限/业务断言）：

| 固定owner | 精确文件 |
| --- | --- |
| DesktopEngineer（13） | `apps/desktop/src/interface/main.mjs`；`apps/desktop/src/interface/index.html`；`apps/desktop/src/interface/renderer.mjs`；`apps/desktop/src/models/workbench.mjs`；`apps/desktop/src/pipelines/workbench.mjs`；`apps/desktop/tests/unit/ipc.test.mjs`；`apps/desktop/tests/unit/pipeline.test.mjs`；`apps/desktop/tests/unit/workbench-model.test.mjs`；`docs/roles/DesktopEngineer/docs/feature/desktop-console.md`；`docs/roles/DesktopEngineer/feature-map.md`；`docs/roles/DesktopEngineer/changelog.md`；`docs/roles/DesktopEngineer/api-spec.md`；`docs/roles/DesktopEngineer/docs/feature/cli-project-host.md` |
| ProjectManager（14） | `bin/chat.mjs`；`package.json`；`package-lock.json`；`apps/desktop/package.json`；`apps/desktop/package-lock.json`；`README.md`；`apps/desktop/README.md`；`docs/roles/ProjectManager/docs/feature/cli-project-workflow.md`；`tests/package/test_package.mjs`；`tests/cli/test_chat.test.mjs`；`apps/desktop/tests/package/desktop-package.test.mjs`；`docs/roles/ProjectManager/feature-map.md`；`docs/roles/ProjectManager/changelog.md`；`docs/roles/ProjectManager/docs/feature/desktop-distribution.md` |
| Tester（2） | `tests/integration/test_cli_installed_flow.mjs`；`apps/desktop/tests/e2e/governed-workflow-ui.test.mjs` |

最小固定门全部从仓库根目录执行：D `node --test --test-concurrency=1 apps/desktop/tests/unit/workbench-model.test.mjs apps/desktop/tests/unit/pipeline.test.mjs apps/desktop/tests/unit/ipc.test.mjs`，核客户名称/错误/真实连接/发送仍`roleId:Supervisor`及确认不变；PM `node --test --test-concurrency=1 tests/package/test_package.mjs tests/cli/test_chat.test.mjs apps/desktop/tests/package/desktop-package.test.mjs` 和只读脚本 `node apps/desktop/scripts/verify-dependencies.mjs`；T `node --test --test-concurrency=1 tests/integration/test_cli_installed_flow.mjs`（原14场景）与 `node --test --test-concurrency=1 apps/desktop/tests/e2e/governed-workflow-ui.test.mjs`（当前Mac指挥台完整流与布局，真实标题/助手与转达气泡/900设置主题/确认执行/取消，不计旧Windows成绩）。客户展示窄修不派发Reviewer/Kernel/Adapter；旧结构fixture/报告只读，不冒称新版通过。PM当前包原exports/私有authority/源码闭包/owner/Shell强门保留，未列检查fixture是只读输入，原权限/密钥断言不弱化。

Pipeline与CLI入口进入Node99mjs闭包，README也在npm包内，因此必须新fresh本地stage、新runtime1.2.3/Desktop0.3.3、先定稿再pack/真实安装并核tar-source-lock-integration字节；不能把旧1.2.2包当改名完成。D→PM当前包→Tester独立真实CLI与GUI验收→PM四文档收口；新证据生成在各原owner本阶段fresh目录，旧设计v0.3/包/报告只读。风险为漏改客户展示或误改内部身份；精确位置和双端实测控制风险。无新增功能/权限或待选增强，阶段成绩必须来自新候选。

