# 既有固定回归的临时 fixture 例外裁定

2026-10-12；ANS Governance，只读核对后应用现有接受范围，不增加源码授权，不改冻结设计、配置、四角色定义或已验证输入。

## 已有授权与具体事实

DesktopEngineer、Tester、Reviewer 的 boundary.md Section 1 都已明示：固定回归可继续使用已批准旧角色 fixture 生成边界，只创建唯一临时目录，不覆写历史证据；精确兼容例外允许该 harness 原已接受生成边界中的 fresh mkdtemp/UUID fixture/temp/userData 子目录。该例外在本次配置所引用的角色边界中仍然保留，没有被撤销。

已核五份未派写的既有固定回归入口；它们只用 mkdtemp 创建本次唯一临时子目录，读取的是当前源码，未固定消费旧包；源文件无需修改：

- `apps/desktop/tests/unit/project.test.mjs`：DesktopEngineer/fixtures 与 tmp，均已在原接受 Section 1 生成路径中。
- `tests/integration/test_generic_agents.mjs`：Tester/tmp，测试 role 保持默认 Tester。
- `tests/integration/test_permission_flow.mjs`：Tester/tmp，测试 role 保持默认 Tester。
- `tests/integration/test_shell_flow.mjs`：Tester/fixtures 的唯一临时子目录。
- `apps/desktop/tests/reviewer/shell-workflow-boundaries.test.mjs`：Reviewer/fixtures 的唯一临时子目录。

以上根均为 `.ans/runtime/legion-cli-role-owned-v2/<原角色>/` 下原已接受生成边界，部分脚本有祖先/子目录检查，project.test 未自动清理其临时目录。Governance当前只读核以上五根及工作区内祖先均为无链接普通目录；每次检查前仍须原角色复核，不能以可选环境变量改成其他角色，更不能指向客户目录。

## 适用解释与不变约束

本次新阶段目录规则约束新增指挥台/当前包/当前GUI/新查询测试的交付产物、缓存、日志和截图；既有固定回归的明确、更具体临时 fixture 例外仍适用。本裁定解决 Governance 前缀总述“本阶段生成效果仅”与原明确例外的歧义；不是旧 runtime 通配权限，也不授权新功能在旧路径生成产物。

允许上述只读源入口执行当前已接受固定命令，在原角色允许根中新建 mkdtemp/UUID 私有子目录。仅在本次子目录写 fixture/temp/userData；原 tar、cache、日志、报告、proof、历史、稳定命名文件和任何已有子目录保持原字节。清理只限本次身份已捕获且无链接跳转、跟踪进程结束的目录；未知租约根/marker/他人子目录不碰。project.test 未捕获完整身份的本次疑似 project-* 残留保留并报告，不能仅凭mtime或目录前缀猜删；保留受约束临时fixture不构成改写历史证据。

新指挥台的包、CLI安装fixture、GUI完整流/截图、当前包结构检查等已授权迁移项仍在 command-center 新阶段。不能用此例外运行旧1.1.3 tar，不能覆盖旧 package-smoke/report，不能将旧结果当当前候选。Reviewer旧版本/旧smoke两处绑定仍需已获Human接受的65文件补齐，不用本例外规避。

## 验收与记录

固定 Supervisor 将此裁定作为新集成图只读输入；各原角色报告上述兼容 fixture 情况和本次身份清理，不以其根路径名称声称测试旧产品。若发现任何稳定旧文件写入、目录非随机、链接跳转或超出上述五只读入口，停止该具体检查并提交实际路径，不推断额外许可。

D已运行的 project 单元 fixture 符合上述既有例外，来源未改变且旧证据未被覆盖；D/PM 当前验证不因本解释失效。无需为这五份未修改源文件扩大65配置或重验相同D源码。新集成仍按已接受65配置与冻结设计进行。
