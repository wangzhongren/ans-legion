# Pi 通用 Agent v2 开发授权

日期：2026-10-07，Asia/Shanghai。授权来源是客户直接消息，不是配置 Hash、Agent 推荐或测试通过。

客户先要求“一个公用的 agent，传入名称和代理，和可操作的范围”，随后明确“让 PI 来做这个通用 agent”。已向客户展示并链接 [Pi 通用 Agent v2 草案](../../docs/design/2026-10-07_design_generic-agent-v2-draft.md)，说明 Pi 直接承载 AgentSession，Legion 仅提供创建配置、可信身份与权限执行。客户本轮直接指示：“开发把”。

授权覆盖该目标的实现与必要验证：现有 Python Kernel、Node.js Pi SDK 桥接、名称/模型连接/操作范围配置、独立实例与受控 write_file 闭环、生命周期、审查和受影响回归。具体文件路径、消息协议和依赖固定版本属于实现所需细化，须经管理与 owner 评估后由 Governance 写入精确执行配置。此记录不提前宣称评审或验证完成。

当前代理参数按已展示的模型 provider / 连接配置解释；HTTP/SOCKS 传输代理、模型读文件工具、通用 shell、动态插件、多角色并行调度不在首轮授权方案内。开发不依赖真实付费模型请求；验证需要实际 Pi SDK 会话与受控测试模型，不能以仿制 Pi 或只测本地提案代替真实接入。

同版授权跨阶段保持有效，不重复请求客户确认。若出现超出上述目标的实质性行为变化，先说明具体影响。原 v1 候选及失败修复证据保留为历史；新阶段只能以当前候选的新证据完成验收。

## 客户最新技术栈修订

客户随后直接要求：“你整个运行都切换成node 把，后面发行也好发行点”。本轮实际授权据此扩展为全产品 Node.js 迁移，替代上述 Python Kernel 与子进程桥接安排；Pi 通用 Agent、名称/连接/范围配置及权限行为目标保留。新的 [Node + Pi 正式实施设计](../../docs/design/2026-10-07_design_node-pi-v3.md) 将落实同进程 Pi SDK、Node 权限内核、Node 测试、npm 可安装结构及本地打包验证。

已有固定角色继续拥有各自能力。必要的源码和测试迁移、package/lock 与发行入口属于客户本次直接指令；不据此执行 npm 发布或其他外部部署。原 Python 实现与测试可作为只读历史保留，但不能成为产品运行或发行包依赖。开发时使用的外部 task_ops Python 脚本不是交付 Runtime。

固定角色：当前上下文仍为 ANS Governance；既有 `/root/legion_supervisor` 仍为唯一 Supervisor scheduler，ProjectManager、工程师、Reviewer 和 Tester 均在独立固定角色上下文工作。
