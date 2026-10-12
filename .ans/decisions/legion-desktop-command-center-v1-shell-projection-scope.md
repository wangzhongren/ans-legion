# 当前 Shell 公开投影调用方测试补齐

真实固定 regression-3d0543a0 40项中36通过，3失败在既有Tester所有的 `apps/desktop/tests/integration/shell-workflow.test.mjs` 第29/35/52行：读取新安全getState已隐藏的Shell review/stdout/publishedResources/candidates。该文件已在Tester Section1，且固定回归argv已包括它，65清单漏项。

仅将此既有测试加入原Tester：65→66文件，检查命令、300秒超时、产品源码权限与设计e6cf4a93…不变；新授权receipt绑定新精确配置，不改原配置或角色定义。原owner从本次私有持久journal核完整Shell发布/部分结果/恢复，并从公共安全摘要/产物查询核不泄漏和可追溯，实际文件、owner、旧许可拒绝和Check/Acceptance强断言全部保留。不得回填私有字段、skip或通过helper把私有数据冒充公共API。

GUI真实截图发现首次空cursor接线疑点，待固定Tester实证；若确认，属于已接受Desktop renderer及当前公开接口范围内必要修复，由原Desktop角色修复/相关门与当前包重验，不借本补齐扩产品功能。当前设计仍为项目指挥台闭环。新精确条件记录拟为 `docs/scheduling/legion-desktop-command-center-v1-ui-repair-integration.md`，旧证据保留，最终同候选T/R/PM关闭。
