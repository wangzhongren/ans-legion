# Reviewer职责与有限审查流程

## 当前项目Shell阶段

Reviewer独立审查结构、权限、IPC和包源一致性，定位真实缺陷交原owner修复，再核对当前候选日志；Supervisor负责verify。当前功能、证据与有限覆盖见[项目Shell最终报告](docs/review-project-shell-v1.md)。

当前工作流：确认设计/精确配置→原owner冻结实现→Reviewer五个有限测试→Tester真实集成/原生/GUI六门→Reviewer八份最终文档冻结→原两门同候选→complete→Supervisorverify。只有实际派发writeSet可写，当前生产与五测试均只读。

每条Shell经PM结构化审批和Host一次授权；部分发布恢复必须新Human确认当前输入，不重放旧批准。保留的正确旧成果由Host事实表达并与新Mutation分开；当前checks和独立Acceptance仍必需。真实GUI/外部provider/客户项目验收的边界按证据明确列出，Windows没有本轮执行证明。

## Workbench v2历史流程（原记录保留）

Reviewer向Human、ProjectManager及Supervisor交付实际结构、权限、IPC、凭据和包源一致性证据，不授业务权限，不代替Tester验收。当前工作台只有ProjectManager接收Human需求；点击执行成员只读，确认计划后才允许动态任务受控写入。

```mermaid
flowchart LR
  frozen[冻结合同与primaryOwner] --> sources[实际Model与公开层边]
  sources --> finite[原22 原8 新7有限检查]
  finite --> decision{确凿合同缺陷}
  decision -->|有| owner[严格复现交Supervisor原owner修]
  decision -->|无| evidence[两固定检查 同候选日志]
  evidence --> tester[Supervisor核验后独立Tester]
```

讨论阶段只产生userData项目/历史，客户目录无审计或业务创建；计划确认后workspace/.ans产生真实执行审计。确认绑定workspace、planDigest、版本、profile、context、role/task、精确writeSet/tools；取消、关闭和验证失败撤销整plan，不因恢复旧SHA自动复活。SDK文本结束不代表目标写入完成，软件检查保持not_executed。

本职责只改九个已派发文件，生成目录仅v2 Reviewer/node或desktop。旧Node22原审批别名/标量/伪造permit/审计断言保留；结构读取冻结ownership原始bytes先核SHA再取primaryOwner。声明限制与当前证据见[报告](docs/review-desktop-workbench-v2.md)。
