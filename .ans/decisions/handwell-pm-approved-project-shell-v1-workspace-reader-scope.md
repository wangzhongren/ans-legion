# 项目 Shell v1 Workspace Reader 双文件兼容补充范围

状态：两个文件的既有owner Section1已覆盖；本双文件task配置候选尚待真人精确SHA接受。记录者固定ANS Governance，仅准备治理配置/scope，不改源码/测试、不运行应用check、不init/dispatch。

## 实际问题与同版依据

Root报告当前Desktop Shell与Model门禁已通过，旧unit回归仍有11个read-only观察失败为workspace_corrupt。本上下文实际读取发现Reader的BOUNDARY_KEYS仅接受旧字段，WORKFLOW_BOUNDARIES只认识ddc9旧治理元组；当前角色boundary YAML存在已准备的Shell candidate metadata及Section1精确路径扩展。当前实际candidate字段如下（以读取结果为准，不虚构第五个字段）：

```json
{
  "KernelEngineer": [
    "project_shell_candidate_version",
    "project_shell_candidate_status",
    "project_shell_candidate_write_scope",
    "project_shell_candidate_generated_effect_scope"
  ],
  "AgentAdapterEngineer": [
    "project_shell_candidate_version",
    "project_shell_candidate_status",
    "project_shell_candidate_write_scope",
    "project_shell_candidate_generated_effect_scope"
  ],
  "DesktopEngineer": [
    "project_shell_candidate_version",
    "project_shell_candidate_status",
    "project_shell_candidate_write_scope",
    "project_shell_candidate_generated_effect_scope"
  ],
  "ProjectManager": [
    "project_shell_candidate_version",
    "project_shell_candidate_status",
    "project_shell_candidate_write_scope",
    "project_shell_candidate_generated_effect_scope"
  ],
  "Reviewer": [
    "project_shell_candidate_version",
    "project_shell_candidate_status",
    "project_shell_candidate_write_scope",
    "project_shell_candidate_generated_effect_scope"
  ],
  "Tester": [
    "project_shell_candidate_version",
    "project_shell_candidate_status",
    "project_shell_candidate_write_scope",
    "project_shell_candidate_generated_effect_scope"
  ]
}
```

需要让只读Reader兼容已获真人接受的Shell v1配置治理元组，不能扩大客户编辑/执行权限。仍用冻结[handwell-pm-approved-project-shell-v1-design.md](handwell-pm-approved-project-shell-v1-design.md)，SHA `a5a0166dcd302ecd65416b85b2801a5a687972481e90f80c31ea23959eff59c0`；主配置已接受 SHA `c872245f285125eae264b77ef4447a97fe0dcb14506c0e77f216d41003865ea4`，事实见[handwell-pm-approved-project-shell-v1-config-authorization.md](handwell-pm-approved-project-shell-v1-config-authorization.md)。同版设计/主配置授权支持必要兼容方向，但不等于本双文件补充配置接受。不得使用旧90ebe或旧governed设计配置自称scope已批准。

## 唯一owner及精确实现范围

DesktopEngineer 的既有 Section1已独占下列两个文件；主155 task配置遗漏它们，因此另准备本补充task配置，不改冻结主配置或六角色定义：

```json
[
  "apps/desktop/src/providers/impl/workspace.mjs",
  "apps/desktop/tests/unit/workspace.test.mjs"
]
```

仅operation=repair；其他source、tests、docs、治理定义保持read-only。由同一固定Desktop owner在真正补充任务派发后修Reader及其对应测试。Supervisor拟对应 `docs/scheduling/handwell-project-shell-workspace-reader-v1.md`，初次准备时仅写两份decision文件；随后Root已明确确认该精确scheduler路径及下述最终集成路径，Governance仅更新Supervisor治理定义，仍未写任务记录。

## 必须保留的读取和安全契约

兼容必须只识别schema已知字段，并把真实人类接受的配置pin与六role具体YAML/Section1精确身份绑定；不得任意candidate metadata、任意revision、未知scope、移除已有拒绝断言或以candidate状态文字自动授权。当前candidate_status仍是冻结候选时的历史文字，人类后续真实接受在独立receipt；不能仅凭status字符串放行。

原旧合法v003/v004及ddc9历史治理快照仍可读取，异常role/status/approval/organization、Section1-only修改、YAML与Section1同时增加或删除scope、未知字段仍应workspace_corrupt；保持原全部测试及拒绝断言，并新增当前精确接受元组可读与篡改失败测试。客户计划批准、文件ownership、read-only Workspace Reader和Shell逐调用PM批准继续各自执行，不把观察读取能力升级成写权限。

以下是本准备时实际六role文件字节SHA，供精确兼容身份调查；不是自算的人类批准，也不代替源码owner实现中的canonical语义pin。实现须以可信已接受配置/receipt及确切元组核验，不能任意重算变更文件并承认新授权：

```json
{
  "KernelEngineer": {
    "boundary.yaml": "31ef86b046d000f771111593a998127ae49c45aa1108c7870a1a4ff1eecfe349",
    "boundary.md": "1338d16ae59beec583842ae6ee75df033b3a3110126cdf2b80134ece9240cfe1"
  },
  "AgentAdapterEngineer": {
    "boundary.yaml": "398e7e277db52135b13941e7f13adb73979a230b964062bf5ea0a61539bd3349",
    "boundary.md": "2f3d828a63db8a0e647af84187d5a0279e5e903bc86469ea1930e61b07057452"
  },
  "DesktopEngineer": {
    "boundary.yaml": "88df82734e48440d55e3892fad40b46a1e14f8d72c29554b90586d97ad7b91a9",
    "boundary.md": "17b71b364664140e1c11dae2179cd5f5a1e09d18494bc7593faf65a93663c8dc"
  },
  "ProjectManager": {
    "boundary.yaml": "a493a5bc78995abb0a23c8345bee7cda90476ecb6682b2fc32c580f6ad53094c",
    "boundary.md": "b733a0fcc19619fce2d8febb125c36c3772033dd7ff5425c1e76920120f2063d"
  },
  "Reviewer": {
    "boundary.yaml": "cf29f8f784c15d387b794079f39ec37d7a0dc0f5fd9a6771a173fab0039ecba9",
    "boundary.md": "15be40dcbaf53294a02bc5fbdea356502ec841f3fb612482f70a0598b35d1474"
  },
  "Tester": {
    "boundary.yaml": "ccedfd954c00b91ea7c8dc3b673065c504491aacebdc5e6d7e7d4cac960d6fa6",
    "boundary.md": "4052fee89810dd26ce7f8fdf8d3dc957817572eaa3783e334b22fd1a98b59b9e"
  }
}
```

## 精确检查与证据

三条check必须写入实际plan checks：workspace_reader单文件测试、desktop_unit_regression原完整Desktop unit回归（包含profiles/workspace）、desktop_shell_regression现Shell+关联Desktop unit门禁。argv逐个精确参数，timeout均300秒；其余full独立流程/UI/Reviewer验收仍在后续主配置下游任务，不由本双文件修复替代。禁止skip、删除case或降低断言。沿用已接受生成scope，新fixture限定本次fresh目录、旧包/history/evidence不覆盖。

本轮roles_valid PASS，schemaVersion=1，角色=1，精确writeFiles=2，checks=3。未执行应用checks，不将Root旧结果冒充本候选新测试。配置sourceAuthorization仅来源metadata，真正task初始化仍需本文件精确人类接受。

候选配置：[handwell-pm-approved-project-shell-v1-workspace-reader-project.json](handwell-pm-approved-project-shell-v1-workspace-reader-project.json)。SHA-256：`5c4f83a8e97155b43be589c8d42c63527c39e780b0cc2166e343bd4349a4deb6`。主cfg、六owner role card/boundary、冻结设计/原auth/review均未改。本scope仅准备，不授权派发；修复验证后Root应同主pin启动新的下游任务并诚实失效旧输入证据，保留全部原失败/暂停记录。

## Root 已确认的精确协调记录路径

- `docs/scheduling/handwell-project-shell-workspace-reader-v1.md`：双文件supp任务，只在本配置5c4f83a8…真正获真人接受后由固定Supervisor经task_ops操作；本scope新增路径不是接受事实。
- `docs/scheduling/handwell-project-shell-final-integration-v1.md`：同已接受c872主pin及主155file范围最终集成任务，不扩大writeScope；在Reader补充合法验证完成后，读取已验证Kernel/Adapter/PM0.8.1冻结当前输入和Reader Source/Tests，5节点 Desktop三门复验→PMfinal→ReviewerCompat→Tester六checks→ReviewerFinal。

Root转交的当前安排：原repair Desktop已记录issue35/stop36，旧计划readSet包含workspace.test但遗漏Provider隐式依赖。新final各相关节点必须在readSet同时明确 `apps/desktop/src/providers/impl/workspace.mjs` 与 `apps/desktop/tests/unit/workspace.test.mjs`，保持其readonly输入性质；实际变更使相关证据失效，禁止复用旧candidate通过结果。旧issue/stop/failed记录不覆盖。

本轮只改Supervisor自有boundary/card/changelog及本scope，未改六owner角色定义、已冻结主配置、补充配置字节、design/auth/review或应用/tests，未写schedule、未派发。Supplemental配置接受仍待真人。
