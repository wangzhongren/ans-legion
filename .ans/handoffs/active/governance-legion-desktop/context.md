# 工作台 v2 正式交接

继续同一固定 Supervisor 身份，加载新 role-card/Section 1 和 v2 canonical/授权/评审/manifest/stages/freeze/desktop-workbench 契约。客户对实际同 hash 方案直接回复“确认”，默认界面选择专注对话；同版不重复审批。

唯一调度任务为 legion-desktop-workbench-v2，由 Supervisor 自己创建 task_ops 计划和接收；Root 不初始化调度或读取 coordinator/worker 凭据。8个stage依赖：kernel→adapter→core-package-deps→desktop-capabilities→desktop-interface→desktop-package→reviewer→tester。实际 role docs 及 business changedPaths 仅各独立固定 owner 产生。

121 authored 精确唯一归属，33 条不重叠生成 scope。stage 子集数量分别18、14、11、30、12、10、9、10；另Supervisor7个协调文档。PM新角色设计先写于core阶段一次冻结，最终桌面说明在package阶段完成，不后改上游冻结输出。旧GUI board36只保留历史，不派发原Tester冒充v2。

共享Model公开具名30个，Service子路径各具名；根入口8个旧公开API保持，Node新包0.4.0仅增workbench façade与workbench Model，exact29files。desktop0.2.0真实安装本地tarball后才能执行bare imports；锁文件只对这一项接受精确local file/resolved/integrity，不全放宽非registry。

讨论仅Adapter/userData，ProjectManager首条消息自动创建/绑定；其他agent仅任务详情，不允许Human直接chat/start，IPC/Pipeline都拒绝。Human选择上下文产生品牌读许可，Provider只用ContextReadConfirmation.assertForRead，不接controller；Human确认计划才能注册/执行动态团队。Storage写前重查真实root/link/context SHA，不可用或变化以本人品牌receipt失效整个authority；恢复旧值不复活。release成功只释放receipt，继续支持合法多permits。

所有生成效果使用本v2的role-first目录。设置TEMP/TMP及必要角色/缓存环境后启动固定检查，并记录实际环境；禁止写旧runtime/cache。Tester公开Node regression固定wrapper清除NODE_OPTIONS/NODE_COMPILE_CACHE、设置LEGION_NODE_TEST_ROLE和本角色node cache/tmp。新版桌面public脚本最后由PM按固定desktop-public检查执行，LEGION_DESKTOP_TEST_ROLE=ProjectManager，清除NODE_OPTIONS/NODE_COMPILE_CACHE，自己的desktop cache/tmp。公开脚本中所有检查须支持被授权调用角色生成目录；最终源、包和检查前后身份明确记录，若新产物使先前读取证据失效，重新收集受影响证据，不能保持假current。

Owner单元检查不代替Reviewer/Tester。必须真实localhost三协议、多轮、首次消息、context实际供SDK、讨论零目录写、确认重放/范围拒绝、取消晚到事件、两项目隔离、DPAPI历史重启、当前大于1MB task source全链读取、新实际ZIP解压启动/界面/关闭。软件检查无executor只显示not_executed。开发不付费调用真人AI账户，不启用任意Shell，不发布包或删除客户源码。

历史Node tarball、旧GUI ZIP、旧v001–v003及原canonical与角色快照只读。所有跨角色缺口回报Governance按已有v2授权精确解决，不换角色，不自扩权限。实际产品代码、测试、依赖与打包由已授权owner完成，Root只检查治理和已有只读证据。
