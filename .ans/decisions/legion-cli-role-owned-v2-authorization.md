# CLI role-owned v2 implementation review

Status: Human confirmed the revised design and exact implementation configuration on 2026-10-10 in this conversation, replying “确认设计和配置并实施（推荐）” to the question linking both artifacts and naming the configuration's full SHA-256.

The Human explicitly instructed runtime tasks to stop using `writeSet` and use persistent exclusive role file ownership, and authorized necessary SHA usage at the implementer's discretion. The reviewed proposal incorporates this change with the previously selected installable CLI, Supervisor, classified project memory and safe parallel execution.

- Design: `docs/roles/ProjectManager/docs/design/2026-10-10_design_cli-role-owned-files-v2.md`, SHA-256 `8ace0d4a1e153f3e57a4bdbaef89c7aff6ce5d52ba0a15f9be8869aa45e14521`.
- Configuration: `.ans/decisions/legion-cli-role-owned-v2-project.json`, SHA-256 `d6014fa001e3422bcc86515126712a923f21f9d3b4808209858612972c3dd51a`.
- Plan: `.ans/decisions/legion-cli-role-owned-v2-plan.json`, SHA-256 `3988347e7b27cf8b8dd79e20d58c14839e66096b5fc2e43b70c013c12935b7e9`.

The six implementation roles keep their existing unique file ownership; the exact 141-file configuration and ten-node plan describe repository construction scope. Its ANS developer assignment lists do not become product runtime task fields. Kernel authority and Desktop environment/lease stages may start concurrently; the remaining gates require current dependencies and independent final integration/review evidence.

ProjectManager substantively reviewed the design and proposed configuration with independent Kernel, Desktop and Adapter assessments. The one reported ordering risk was corrected: the intermediate package stage checks the runtime tar and Desktop dependency identity; complete Desktop package/workflow checks run after the new owner runtime has been wired, in the final package and independent verification stages. The revised configuration and plan passed read-only task_ops validation.

The old CLI v1 task is stopped and historical. Old Shell final acceptance remains paused. At confirmation time no runtime v2 source or tests had been implemented or verified. The actual Human reply now authorizes Supervisor initialization with the exact reviewed configuration and automatic dispatch of its nodes; an AI-computed digest alone is not consent.
