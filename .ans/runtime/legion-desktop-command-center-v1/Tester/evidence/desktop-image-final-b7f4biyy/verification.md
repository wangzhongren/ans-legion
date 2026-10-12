# 图片 v1 facade 修复：独立 Tester 最终验收

候选 `ed00bcb5496b9b92e48644033c543378cea2af85ad28e45dd3460b43c52c5f12`。Runtime1.3.1/Desktop0.4.1，真实fresh npm消费者与真实macOS Electron，三个固定门同候选退出0、未超时、未改候选。
终包：`/Users/wangzhongren/code/vibeingcode/解压/ans-legion/.ans/runtime/legion-desktop-command-center-v1/ProjectManager/packaging/desktop-image-input-v1-facade-repair-20261012/legion-runtime-1.3.1.tgz`；SHA256 `555a4184456d6457674ded591e7dea3098cdb6b3fed4ad408c782019813dae46`。

## 固定检查

- installed: 1/1; 14 CLI scenarios；`node --test --test-concurrency=1 tests/integration/test_cli_installed_flow.mjs`
  日志 `/Users/wangzhongren/code/vibeingcode/解压/ans-legion/.ans/runtime/desktop-image-input-v1-facade-repair-integration/evidence/tester-image-current-1-installed-e756c99d.log`；SHA256 `8f98601bacd4415434efbc3120ad3c9cc8c327e3b1e14a998ea19a037318d5cd`。
- integration: 5/5；`node --test --test-concurrency=1 apps/desktop/tests/integration/workbench-flow.test.mjs apps/desktop/tests/integration/governed-workflow.test.mjs`
  日志 `/Users/wangzhongren/code/vibeingcode/解压/ans-legion/.ans/runtime/desktop-image-input-v1-facade-repair-integration/evidence/tester-image-current-1-integration-737c55aa.log`；SHA256 `a55b45a38724f1b660ef482f019f1c1b23f522cadfcfb3f0e0fd5997d9a59d5c`。
- gui: 2/2 Mac; 0 skip；`node --test --test-concurrency=1 apps/desktop/tests/e2e/governed-workflow-ui.test.mjs`
  日志 `/Users/wangzhongren/code/vibeingcode/解压/ans-legion/.ans/runtime/desktop-image-input-v1-facade-repair-integration/evidence/tester-image-current-1-gui-6e79ba34.log`；SHA256 `1cf312aaf79cae840949c61d78e5307b8f61725d791ec42ebe89f3d8e95e4b01`。

## 真实证据

- 安装14场景：`/Users/wangzhongren/code/vibeingcode/解压/ans-legion/.ans/runtime/legion-desktop-command-center-v1/Tester/evidence/desktop-image-installed-lfCofZ/flows.json`。
- 三协议PNG/JPEG：`/Users/wangzhongren/code/vibeingcode/解压/ans-legion/.ans/runtime/legion-desktop-command-center-v1/Tester/evidence/governed-regression-u9XeWA/governed-flow.json`；每协议PM像素请求1、worker像素请求3，七字段task refs由收到实际像素的PM提出，当前Human确认digest/ref后执行真实Check与独立Acceptance。
- unknown/unsupported明确拒绝且零HTTP/保草稿；真实SDK省图一次注入、failed/精确internal_error/零HTTP/完整Human与ref可读；恢复+当前超过8张及16MiB真实明确预算拒绝。重启、取消第二HTTP、跨项目、缺失/篡改及原权限/known-key强门保留。
- 原生nativeImage→Electron44 ClipboardItem→真实MetaV、File选图、DataTransfer拖入、移除/纯图/历史预览、Host实际ref→网络SHA/bytes与有效像素、900草稿焦点；最终剪贴板恢复 `/Users/wangzhongren/code/vibeingcode/解压/ans-legion/.ans/runtime/legion-desktop-command-center-v1/Tester/evidence/desktop-image-1MvLA7/clipboard-restoration.json` 为used:true/restored:true。原内容仅main进程内存、不输出/持久化；当前类型/字节改变则不覆盖。
- 原两个Mac完整流程、两owner执行中只读/两页日志、当前确认、Check/独立验收失败→返修通过、取消Continue保持；22张最终截图逐张检查，弹窗/终态个别帧仍可处于动画/轮询，权威结果以真实Host强断为准。

## 截图manifest

- `/Users/wangzhongren/code/vibeingcode/解压/ans-legion/.ans/runtime/legion-desktop-command-center-v1/Tester/screenshots/desktop-image-AnctDA/manifest.json`：PID 72204，9图，SHA256 `cf62777f3e3c7431f78ceb4bbed29b835aadf1e5aea831dc46ca2b9a3c57923d`；每图含实际viewport/theme/终包SHA/imageSHA。
- `/Users/wangzhongren/code/vibeingcode/解压/ans-legion/.ans/runtime/legion-desktop-command-center-v1/Tester/screenshots/desktop-image-4I4AZv/manifest.json`：PID 72241，11图，SHA256 `21b1c455de68b60f5ec1c05eef208b30f5381ed6c43587f68d66d4b0fb3d5fb4`；每图含实际viewport/theme/终包SHA/imageSHA。
- `/Users/wangzhongren/code/vibeingcode/解压/ans-legion/.ans/runtime/legion-desktop-command-center-v1/Tester/screenshots/desktop-image-97jjwk/manifest.json`：PID 72233，2图，SHA256 `1a90217817688d186449d83ce7490c6be789806622ece2bf2bfe486ebb4c9edd`；每图含实际viewport/theme/终包SHA/imageSHA。

## 清理、历史与限制

All tracked Electron/CLI/HTTP fixtures ended; only exact proven fresh own shared markers removed.

- Windows ZIP/DPAPI/native picker and paid remote models not executed; no Mac skip.
- Old whole-repository observer governance metadata pin restriction remains; isolated observer coverage preserved.
- Old final Shell GUI acceptance remains paused.
- Previous no-snapshot ClipboardItem diagnostic wrote fixture PNG without original clipboard snapshot; earlier content cannot be reconstructed. Final GUI safely snapshot/restored in private main-process memory.
- Old 1.3.0 Tester issue39/stop40 had zero fixed checks; all original evidence remains.
- SDK internal image_omitted is intentionally public internal_error; tested exact failed/zero-network/ref preservation contract.

身份链不全的两项旧共享marker保留，未删除共享根或未知项：

- `/Users/wangzhongren/.legion-project-leases/85f6cbb5d433668ee49ccc7b161b39791e434edcd1ae451c1e83bef2011f89b5.owner-source.json`
- `/Users/wangzhongren/.legion-project-leases/3d85c08cf8d7485e85864710c081387c685be760e739a2e64d3d36591f1a400b.owner-source.json`

当前旧诊断失败日志（语法、ESM resolver、公开错误字面及旧clipboard API）与未快照诊断截图全部保留，未挪作本次三门。

## changedPaths

- `tests/integration/test_cli_installed_flow.mjs`
- `apps/desktop/tests/integration/workbench-flow.test.mjs`
- `apps/desktop/tests/integration/governed-workflow.test.mjs`
- `apps/desktop/tests/e2e/governed-workflow-ui.test.mjs`
- `docs/roles/Tester/docs/verification-desktop-workbench-v2.md`
- `docs/roles/Tester/docs/verification-governed-workflow-v1.md`
