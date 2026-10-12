# 桌面图片输入 v1：公开工厂入口必要修复

2026-10-12，独立Reviewer真实structure首门发现并由Governance只读源码复核。沿真人已接受方案2236f669…及74文件配置e4e0282b…，不新增功能/文件/权限，不重复真人接受。

## 实际缺陷

`apps/desktop/src/pipelines/workbench.mjs`的`workbenchFacade`白名单缺少已实现的`stageImage`、`discardImage`、`readImagePreview`。真实`createWorkbenchPipeline`和Headless都返回该facade，Interface main通过public factory得到pipeline，因此图片IPC实际会调用undefined并返回internal_error。此前Impl/界面局部检查不能证明真实公开入口工作。Reviewer首门83项79pass/4fail保留历史，独立流程不能标通过。

## 同范围实施

先让当前T/R安全结束跟踪进程、记录首失败/partial并issue+stop；原主图及1.3.0/0.4.0包保留。固定Supervisor新精确记录`docs/scheduling/desktop-image-input-v1-facade-repair-integration.md`，仅经task_ops维护。

D在原D32内最小修公开白名单及现有测试：通过真实public factory断言三方法、真实IPC与图片请求，不让测试直接引用Impl绕过。所有原权限/图片预算/来源、角色交接、私有数据边界保持。运行原配置D images九unit固定门，当前候选冻结后报告。

PM在原15文件及原固定检查内生成新fresh Runtime1.3.1/Desktop0.4.1实际包与安装，sourceHashes/lock/resolved/integrity/exports/CLI/README例子全部原强断不弱化。新包stage路径由Supervisor在新图init前固定并精确绑定readSet，不覆盖原1.3.0或桥包。

T/R使用原6/9文件和原固定argv，对当前真实公开factory、安装包、Su→PM→Human确认taskRefs→worker网络像素、真实Electron三输入/纯图/预览/900，以及完整结构与原文本/权限强门重验；PM原四文档关闭当前状态。K/A/桥包字节未变时可引用原verified来源，不复跑无关基础门；D改后旧236/旧PM包证据不代表新候选通过。生成仅原owner已获准根的fresh修复stage，旧报告与失败原位保留。
