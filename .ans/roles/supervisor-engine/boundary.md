# Section 1: 可修改文件与目录

候选 proposal-v1；须客户接受边界并明确授权任务后才可使用。未覆盖路径默认只读。

| 类型 | 项目相对路径 | 用途 |
| --- | --- | --- |
| 文件 | `src/models/mission.py` | 本角色独占源码或成果文档 |
| 文件 | `src/pipelines/mission.py` | 本角色独占源码或成果文档 |
| 文件 | `src/pipelines/work.py` | 本角色独占源码或成果文档 |
| 文件 | `src/pipelines/handoff.py` | 本角色独占源码或成果文档 |
| 文件 | `src/services/abstract/mission.py` | 本角色独占源码或成果文档 |
| 文件 | `src/services/public/mission.py` | 本角色独占源码或成果文档 |
| 文件 | `src/services/impl/mission.py` | 本角色独占源码或成果文档 |
| 文件 | `.ans/roles/supervisor-engine/feature-map.md` | 本角色独占源码或成果文档 |
| 文件 | `.ans/roles/supervisor-engine/functional-description.md` | 本角色独占源码或成果文档 |
| 文件 | `.ans/roles/supervisor-engine/api-spec.md` | 本角色独占源码或成果文档 |
| 文件 | `.ans/roles/supervisor-engine/changelog.md` | 本角色独占源码或成果文档 |
| 独占目录 | `.ans/roles/supervisor-engine/docs/design/` | 本角色私有支持、测试或文档；仅授权任务可写 |
| 独占目录 | `.ans/roles/supervisor-engine/docs/feature/` | 本角色私有支持、测试或文档；仅授权任务可写 |
| 独占目录 | `.ans/roles/supervisor-engine/docs/change/` | 本角色私有支持、测试或文档；仅授权任务可写 |
| 独占目录 | `.ans/roles/supervisor-engine/docs/fix/` | 本角色私有支持、测试或文档；仅授权任务可写 |
| 独占目录 | `src/common/supervisor-engine/` | 本角色私有支持、测试或文档；仅授权任务可写 |
| 独占目录 | `tests/supervisor-engine/` | 本角色私有支持、测试或文档；仅授权任务可写 |
