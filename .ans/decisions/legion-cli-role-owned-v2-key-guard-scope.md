# 完成 CLI v2 密钥保护所需的三文件授权补齐

## 为什么需要补齐

本次 CLI 已确认的要求包括：模型密钥仅从当前进程环境读取，不写入配置、项目、日志或角色记忆。Host 的分类记忆过滤不足以覆盖模型原文、交互、提案、摘要和受控写入，Desktop 原 owner 已接收必要修复。

只读审查又确认更早的路径：Shell Provider 会在把结果交给 Host 前建立运行镜像并写私有输出记录；Check 子进程可以把获准读取的输入复制到自己的 outputs/tmp。如果既有客户输入文件含当前密钥，Host 收到输出后再拒绝不能证明此前没有新增存储。子进程环境本来就不继承模型密钥，这次只处理已知本进程密钥出现在输入或返回数据的情形。

不能通过禁用真实 Check、放宽日志或输入规则、删除既有客户文件来满足交付。应在现有 Provider 的效果发生前拒绝含当前已知密钥的输入，并在 Shell 输出回调与私有日志之前阻断包含该值的输出。

## 最小实施范围

保持原 CLI v2 设计与功能要求，Kernel 两个 Service impl 私下把已知密钥的纯值传给各自公开 Provider。该私有参数不进入 Model、授权、digest、日志、环境或客户 DTO；不引入上游 IO 回调。Shell 在复制输入前拒绝命中的来源，并保护跨 stdout/stderr chunk 的父进程输出和私有日志。Check 在已有受控输入验证阶段、启动前拒绝当时命中的来源，阻断该静态输入复制路径。已有客户字节不修改，失败返回安全静态原因。

本次证明范围是 Host 已取得的**已知原始密钥值**：模型/工具回显进入 Host 持久数据或受控 Source 的路径、启动前命中的受控 Check 输入、Shell 镜像复制，以及父进程接收的输出/日志。它不提供任意程序的文件内容防火墙。Check 客户文件验证与使用之间仍可能被外部进程修改；子进程也可能从片段或编码自构某个值后直接写入自己的 tmp/outputs。运行后检查没有发现原始值，不能证明任意程序或外部干扰下该值从未瞬时落盘。严格覆盖这些情况需要另行评估不可变输入快照或子进程写通道，不属于本次三文件补齐，也不以事后扫描冒充该保证。

原精确配置已允许 Shell Provider impl、四个相应 Provider/Service 测试及 Kernel API/changelog，但遗漏以下三个已由 KernelEngineer 独占的源码文件：

| 额外配置路径 | 用途 |
| --- | --- |
| `src/kernel/providers/impl/check.mjs` | 在实际 Check 输入产生派生效果前拒绝含已知密钥的来源 |
| `src/kernel/services/impl/check.mjs` | 通过自身公开 Provider 工厂传递私有已知值 |
| `src/kernel/services/impl/shell.mjs` | 通过自身公开 Provider 工厂传递私有已知值 |

新[精确配置](legion-cli-role-owned-v2-key-guard-project.json)只扩这三项，从 141 个 authored 文件变为 144 个，其余角色、检查、最大三工人、原设计与自动派发规则保持原值。角色 boundary Section 1 已包含这三项，没有文件转交或新增角色。旧配置和旧调度记录保留为历史。

## 后续验收顺序

1. Kernel 在独立固定角色中实施最小 Provider/Service 修复；四个现有测试验证启动前命中的 Check 输入拒绝、Shell 镜像复制前拒绝、跨 chunk 父进程输出/日志阻断，以及客户原字节不变；检查这些实际运行面未发现已知原始值，运行现有完整 Kernel 门。
2. ProjectManager 制作新的 runtime tar 并验证 Desktop 消费者依赖身份。
3. Desktop 完成已知密钥 Host guard，验证首次状态/历史恢复、跨 delta、对话/提案/摘要/交互/验收/返修/Shell 这些实际工具持久路径及受控 Source effect；合法非敏感 Human 原文完整，并重验 owner、host、parallel 三门。
4. ProjectManager 实现 CLI、更新 README、制作最终 tar，在独立安装消费者运行真正的 `node_modules/.bin/legion chat`。
5. Tester 独立检查全流与所有持久面，Reviewer 完成最终结构/权限审查。

新的配置需要 Human 确认，原因是 ANS task_ops 只允许新任务缩小已批准的精确配置，不能由 AI 自行扩大它。批准前旧 PM/Host 修复 attempt 已安全停止，部分工作与失败证据保留。2026-10-11（Asia/Shanghai），Human 已明确接受本说明链接的新精确配置；[实际授权记录](legion-cli-role-owned-v2-key-guard-authorization.md)记录该答复及重新核对的 SHA。后续任务可按其精确范围继续。

## 评审状态

ProjectManager 与 KernelEngineer 已分别只读评审新 JSON、三个路径的 Section 1 归属、四个 impl 的最小接口和下游顺序，均推荐按本范围实施。public 工厂透传 options、abstract 只校验方法，无需再扩大这些文件。两者要求明确上述可证明范围，禁止声称任意子进程/外部干扰下的全称密钥存储隔离；本说明已据此修正。Reviewer 的独立只读源码核对确认 Host 事后过滤不能替代这些 Provider 前置检查。

评审时没有运行新范围的源代码任务或测试。Human 现已接受新增三个精确路径；原设计与其他既有授权保留，源码和测试结果由后续真实任务证据记录，不由本说明声称通过。
