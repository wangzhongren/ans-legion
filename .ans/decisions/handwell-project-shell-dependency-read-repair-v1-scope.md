# 项目 Shell v1 已批准依赖读取兼容修复

日期：2026-10-10。记录者：固定内置 ANS Governance；仅治理澄清，不实施源码/测试、不init/dispatch。

## 实际问题与同版依据

Root 转交 Desktop 实际发现及 Kernel 独立只读确认：当前 Kernel prepare 将 `request.generatedEffects` 同时用于输入依赖链接读取与产物写入判断。项目已有合法 `node_modules/.bin` 时，Shell 本条只批准生成 `dist` 的 build 会被 `shell_source_symlink` 拒绝。已有安全依赖的读取不应要求同时授予该依赖的生成/发布权限；这属于已确认 v1 的必要兼容修复。

已确认冻结设计：[handwell-pm-approved-project-shell-v1-design.md](handwell-pm-approved-project-shell-v1-design.md)，SHA `a5a0166dcd302ecd65416b85b2801a5a687972481e90f80c31ea23959eff59c0`。仍使用已获真人接受的精确主配置 [handwell-pm-approved-project-shell-v1-project.json](handwell-pm-approved-project-shell-v1-project.json)，SHA `c872245f285125eae264b77ef4447a97fe0dcb14506c0e77f216d41003865ea4`；真实授权见 [handwell-pm-approved-project-shell-v1-config-authorization.md](handwell-pm-approved-project-shell-v1-config-authorization.md)。本修复不产生新配置、permission或sourceDesignRevision，不改变冻结设计字节。

## 当前已授权的最小 Kernel 修复范围

```json
[
  "src/kernel/providers/impl/shell.mjs",
  "tests/kernel/test_shell_provider.test.mjs",
  "docs/roles/KernelEngineer/api-spec.md",
  "docs/roles/KernelEngineer/docs/feature/project-shell.md",
  "docs/roles/KernelEngineer/docs/design/2026-10-10_design_project-shell.md",
  "docs/roles/KernelEngineer/docs/change/2026-10-10_change_project-shell.md",
  "docs/roles/KernelEngineer/changelog.md"
]
```

上述全部属于当前43文件Kernel精确范围及既有Section1；实际任务writeSet继续缩小。修复由固定KernelEngineer实施，Governance不写源码/测试。六个owner的role card/boundary、原配置及冻结设计保持不变，其他角色源码读取不会转为写权限。

修复必须分离 `source generated scopes` 与 `read validated dependencies`：前者仅本条PM明确批准的生成/写入/发布目录；后者仅可信Host经验证并固定输入快照/generation的已有依赖读取集合。不得因读取 `node_modules/.bin` 而默许写入、安装或发布node_modules；本条仅生成dist仍只可发布获准dist及精确owner/task允许的源文件。

已有依赖链接仍必须严格验证：只允许批准依赖树内相对 `.bin` 链接，真实目标同树；拒绝绝对/越界/断链/环/硬链接和特殊文件，保持no-follow/descriptor身份检查及保护路径隔离。依赖generation/输入快照失效、未经验证依赖或权限变化时失败关闭。该修复不放宽原fixedCheck/no-child/no-network、源码独占、受控delete或逐调用PM审批。

## 依赖和证据安排

Root 已确定同版八节点任务：Kernel修复→Adapter只读重验→PM bridge真实重新包装0.8.1→Desktop继续→PM final→Reviewer early→Tester full→Reviewer final。实际派发及缩小范围由独立固定scheduler负责；本记录不代替任务操作，也不声称节点已通过。

旧任务和0.8.0真实包保留历史；改变Kernel输入后，旧输入对应证据必须标stale并重验，不能复用旧通过结论。PM 0.8.1的身份、清单及SHA取真实打包结果，不预填虚构值。原Desktop assignment已停用，但已写代码保留并在合法新assignment恢复；不能误记为原Desktop未改代码。本轮Governance没有修改这些代码。

Supervisor唯一补充任务记录路径：`docs/scheduling/handwell-project-shell-dependency-read-repair-v1.md`；这是同一已确认功能阶段内必要兼容修复，不借旧governed设计扩大权限。所有旧failed/停止记录及包证据保留。新授权效果和独立验收依然按现行精确配置与scope执行。
