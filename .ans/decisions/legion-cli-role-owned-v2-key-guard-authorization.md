# CLI v2 known-key guard configuration: Human accepted

Status: Human accepted the exact replacement configuration on 2026-10-11 (Asia/Shanghai) in this conversation, answering “批准补齐这三项并继续（推荐）” to the question linking the reviewed three-file scope and configuration with its full SHA-256. This matching reply authorizes the accepted Supervisor to initialize scoped tasks and automatically continue the approved repair, runtime refresh, CLI implementation and independent verification.

The CLI role-owned v2 design and original configuration were Human-approved in this conversation. Their authorization remains evidence for the existing requirement and scope. The new configuration adds only three existing KernelEngineer-owned implementation paths needed to enforce the already-approved rule that the current process model key must not be persisted or propagated to command outputs.

- Original configuration: `legion-cli-role-owned-v2-project.json`, SHA-256 `d6014fa001e3422bcc86515126712a923f21f9d3b4808209858612972c3dd51a`.
- Accepted configuration: `legion-cli-role-owned-v2-key-guard-project.json`, SHA-256 `f27b9a3a63fe75443f6139dcd5089ec9379974a3117654b5f337ce9f2143e8d3`.
- Original approved design: `docs/roles/ProjectManager/docs/design/2026-10-10_design_cli-role-owned-files-v2.md`, SHA-256 `8ace0d4a1e153f3e57a4bdbaef89c7aff6ce5d52ba0a15f9be8869aa45e14521`.

Additional paths, all already owned by KernelEngineer in boundary Section 1:

1. `src/kernel/providers/impl/check.mjs`
2. `src/kernel/services/impl/check.mjs`
3. `src/kernel/services/impl/shell.mjs`

The accepted configuration has 144 exact authored paths instead of 141. It retains the original roles, operations, checks, concurrency limit, design restrictions and automatic dispatch settings. The authorization source points to this acceptance record. No existing configuration or scheduling evidence is rewritten.

ProjectManager and KernelEngineer independently completed read-only review of the configuration delta, existing Section 1 ownership, four implementation-file interfaces and downstream sequence. Both recommend the minimal amendment; Reviewer confirmed the earlier Provider effect paths. Their limitation on arbitrary encoded/fragmented values, external input races and child-written temporary files is recorded in `legion-cli-role-owned-v2-key-guard-scope.md`. Public factories and abstract method contracts need no added source scope.

Governance re-read the configuration after the Human reply and verified its actual SHA-256 matches the accepted value. The prior requirement/design approvals and this three-path amendment are distinct from subsequent implementation evidence. New tasks must use this exact pin, their assigned subsets and fresh artifacts; old stopped tasks and frozen evidence remain historical. An AI-generated SHA alone is not Human consent.
