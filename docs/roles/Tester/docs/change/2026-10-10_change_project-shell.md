---
id: tester-project-shell-change-v1
type: change
title: 独立Shell验收和原fixture新阶段兼容
created: "2026-10-10"
updated: "2026-10-10"
status: implemented-unverified
related: [tester-project-shell]
---

# 从框架单元成绩走到真实角色与界面

旧Tester只验证受控文件/Check流程，本轮增加四个独立测试入口，通过真实安装SDK、独立PM、Host validator、native镜像、原Mutation和真实GUI检查Shell与恢复。Shell0退出保持与实际selfcheck/Acceptance分开。

源partial和generated记录故障都保留已经实际发生的效果，重启旧授权不运行；新Human当前SHA/absence/generation确认后才新审批恢复。正确已交付binary用独立retained事实承接，inode/bytes不改，结果不伪装新Mutation。真正发现的absence wire/focus/无diff恢复问题由原Owner修，Tester保留同复现与失败历史。

四个旧fixture改到新stage/fresh目录，SDK完整工具枚举增加已确认Shell一项，原negative/permission/读/编辑/转交/焦点/Markdown/记录断言保留。固定完整回归采用已批准harness效果例外，latest package JSON先后完整归档，不回写旧历史或tar。

当前诊断已经跑过，正式六门须在16输出冻结后同candidate运行；结果和平台未执行范围见[验证记录](../verification-project-shell-v1.md)，功能入口见[独立验收说明](../feature/project-shell.md)。
