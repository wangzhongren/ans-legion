# 2026-10-10 项目 Shell：Reviewer 审查设计

## 已确认输入与职责

采用已确认项目 Shell v1；设计 SHA `a5a0166dcd302ecd65416b85b2801a5a687972481e90f80c31ea23959eff59c0`，精确配置 SHA `c872245f285125eae264b77ef4447a97fe0dcb14506c0e77f216d41003865ea4`。本角色维护有限结构检查和审查文档，生产修复交原 owner，Supervisor负责最终verify。当前阶段只有八份文档可写，五个Reviewer测试冻结。

## 审查方法

1. 核对纯Model、Service/Provider公开相邻层与包exports，私有authority/receipt不进入SDK或renderer；既有纯度与权限断言保持。
2. SDK请求只表达命令/cwd/reason/network/效果，身份由Host绑定；每次PM结构化审核当前摘要，再由原requester一次消费。PM审核独立队列不占主Pipeline等待锁。
3. publication逐文件以owner、task.writeSet、真实baseline与当前输入约束，通过Mutation发布；生成范围对完整authored inventory验交集，macOS隔离失败关闭。
4. 用真实持久ledger和受控SDK工厂检查PM-only、CAS、取消/重启失效；Host内部fixture提供显式observedAtMs，Model不读取时钟，也不接收时钟callback。
5. 恢复审核要求新Human计划与当前baseline、旧真实publication来源、当前owner/run/check/gen；正确保留事实与新Mutation分开，旧partial结果保持。
6. 检查Tester当前同候选六门的实际日志SHA、计数和阶段截图，分开记录受控localhost模型服务、真实Mac原生效果及Windows未执行。

最终文档封存后执行原`shell`和`regression_structure`，当前candidate、日志和计数由该任务`reviewer-final`的checkEvidence与complete报告固定。结果不能由旧owner通过或历史文档推断。

## 范围约束

仅macOS首版得到本轮实际覆盖；缺失的历史Windows ZIP/descriptor、Windows GUI与DPAPI均未验证。Mac旧0.7 TGZ实字节检查保留，不能替代Windows产物。没有外部商业模型、真实凭据、客户SSH源码写入或任意线上网络测试。失败历史只追加引用，不覆盖。
