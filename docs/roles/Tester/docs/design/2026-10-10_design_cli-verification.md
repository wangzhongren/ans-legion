# CLI v2 独立验证设计

固定 Tester；依据已确认 [角色独占文件设计](../../../ProjectManager/docs/design/2026-10-10_design_cli-role-owned-files-v2.md) 与 final-current 精确派发实施。仅修改本次 13 文件，不修生产；旧 Shell 最终 GUI/E2E 仍暂停。

## 消费者流程

安装已验证 1.0.3 tar 到本角色 v2 fresh packaging，用真实 node_modules/.bin/legion chat 与受控 localhost 三协议完成多轮 PM、角色提案/审核、完整 Human owner 确认、不同 owner 同时在途、同 owner 串行、真实 Check/Acceptance、返修、取消与重启。测试控制器从真实 SDK 请求识别 task/工具，不修改生产或 SDK。检查输出与当前持久记录，不以文字声明完成。跨计划查询分类事实，监督建议是 typed control 而非 grant。旧 v1 历史及其他 userData catalog 来源负例均在隔离 fixture。

已知随机 LEGION_API_KEY 的模型文字/工具/记忆失败场景检查 stdout/stderr 和本 fixture 所有普通持久文件（包括 history/member/roleMemories/facts/备份/临时文件/source）；避免把 key 写入测试证据；不扫描未知 secret。

## 共享租约

生产 CLI 保持真实 HOME/default lease root，不接收测试注入。fresh workspace 的 realpath/dev/ino 计算键，启动前精确 lease 目录与 owner-source 文件须不存在。观察本次 marker 身份、字节、workspace/source userData 身份。关闭并确认跟踪进程退出后仅删除身份/权限/来源/字节仍匹配且 lease 目录已不存在的 marker；无法证明则保留并报告，不清共享根或未知条目。

## 回归

旧任务文件列表 fixture 改独立预期输出、角色 owner 和 schema2 intent；Kernel fixture 使用可信 owner/canonical catalog/私有 lease；直接 Desktop factory 同时传隔离 userData/leaseRoot。共享 test helpers 迁本阶段 fresh 生成路径。GUI 无隔离入口的外部缺口报告，不用 HOME 替换。已批准 installed/regression 经 task_ops 真跑；失败记录复现和角色归属，不 skip 或削弱断言。

## 证据

记录 final tar SHA、安装身份、实际 binary/argv、候选、固定 checks 日志及各场景结果。控制 localhost 的 SDK 全流不代表付费远端服务或 Windows ZIP 验收。

2026-10-11 收口：旧v1先验证只读历史与原字节，再实际经过当前Human关闭旧实例/选择权威catalog声明，验证schema2真实执行、Check、独立Acceptance及原字节备份。组织预置等待真实Supervisor pending结束，不重试抢锁。大记录观察使用隔离合法格式输入和一份当前真实1282488字节记录，验证全字节SHA/verifiedAt/治理与runtime分离；不将本仓库不断变化的治理pin作为该格式测试的输入。整仓库旧观察器的boundary pin限制保留，CLI新owner授权不依赖此；旧GUI观察验收继续暂停。
