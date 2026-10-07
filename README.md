# Legion Runtime

Create named Pi agents whose file changes pass through a permission kernel. The product is a single Node.js ESM package, with Pi SDK and pi-ai fixed to 1.0.4. Node.js 22.19.0 or newer is required. Python is not a product dependency.

## Install the local package

```sh
npm install ./legion-runtime-0.4.0.tgz --ignore-scripts
npm exec --offline -- legion demo
```

The demo uses a temporary workspace. It shows one allowed Backend write, five denied attempts, preserved Frontend content and 23 audit events. It does not call a paid model.

## Run an offline Pi agent

Save this example as an `.mjs` file in the project where you installed the package, then run it with Node. It uses the official Pi Faux inference stream with a real Pi SDK Session and Agent loop. It writes inside a temporary workspace which Runtime cleans on close.

```javascript
import { createRuntime, RoleBoundary, TaskDispatchContext } from "legion-runtime";
import { createFauxCore, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";

const core = createFauxCore({
  provider: "offline", models: [{ id: "fixture" }], tokensPerSecond: 0,
});
core.setResponses([
  fauxAssistantMessage(fauxToolCall("legion_write_file", {
    resource: "backend/greeting.txt", content: "hello from Pi",
  }), { stopReason: "toolUse" }),
  fauxAssistantMessage("Finished."),
]);
const models = core.models.map(({ id, name, reasoning, input, cost, contextWindow, maxTokens }) =>
  ({ id, name, reasoning, input, cost, contextWindow, maxTokens }));
const runtime = createRuntime({
  workspace: null,
  organizationVersion: "example-v3",
  boundaries: [new RoleBoundary({
    roleId: "Backend", writeScope: ["backend/"], denyScope: ["backend/private/"],
    capabilities: ["write_file"], tools: ["legion_write_file"],
  })],
  dispatchContext: new TaskDispatchContext({
    roleId: "Backend", taskId: "greeting", organizationVersion: "example-v3",
    writeSet: ["backend/greeting.txt"], tools: ["legion_write_file"],
  }),
  modelProviders: [{
    provider: "offline", api: core.api, baseUrl: "https://legion.invalid",
    apiKey: "fixture-only", models, streamSimple: core.streamSimple,
  }],
});
try {
  const agent = await runtime.createAgent({
    name: "greeting-worker", proxy: { provider: "offline", model: "fixture" },
    scope: { write: ["backend/greeting.txt"], deny: [".ans/"], tools: ["legion_write_file"] },
  });
  const result = await agent.run({ taskId: "greeting", prompt: "Write the approved greeting." });
  console.log(result.status, result.toolResults[0].result.status);
  console.log(await runtime.readFile("backend/greeting.txt"));
} finally {
  await runtime.close();
}
```

Expected output is `completed written` and `hello from Pi`. The fixture URL and key are local test configuration; its stream makes no network requests. A real provider uses a trusted SDK-compatible inference stream and its model metadata. `modelProviders` is an array. The host controls that configuration; it never receives a file-execution callback, Runtime or permit.

`proxy` selects the provider and model. It does not configure an HTTP/SOCKS transport proxy. Names identify instances; permissions come from the accepted role, task and requested scope.

## Permission and lifecycle

Role write scopes may contain directories, but task `writeSet` contains exact files. An instance may only request the intersection; an unauthorized directory request is rejected rather than trimmed. A trailing slash denotes a directory; there are no glob scopes. Deny and protected control-plane paths take precedence.

Each instance has an independent Pi Session and runs once. `agent.cancel()`, `agent.close()` and `runtime.close()` release resources. Trusted host updates through `updateVersion`, `updateBoundary` and `setTaskStatus` revoke old rights before stopping sessions. A completed Pi run can contain denied tool results; inspect `toolResults` to determine what was written.

`runtime.close()` first prevents new work and revokes rights, then waits for active runs to finish their cancellation and terminal audit before closing storage. Await both the run result and close when shutting down a running agent. Normal cancellation returns `cancelled`; a genuine audit failure remains `failed/kernel_audit_failed`.

The only active model tool is `legion_write_file`. Default shell/file tools, extensions, MCP, skills, prompt templates and other resource discovery are disabled. `runtime.readFile` is a trusted-host observation method, not a model tool.

Trusted hosts may register `AgentSession` objects using the `sessions` option and construct public `ActionProposal` values. `prepare`, `execute` and `submit` preserve the single-use permit flow; an equal copy of a registered Session is not trusted. Other public input types are `RoleBoundary`, `TaskDispatchContext`, `AgentScope`, `PiConnection` and `Outcome`. The eight root exports remain unchanged. Trusted workbench hosts use the five explicit subpaths below; private authority helpers and Providers remain unexported.

Audit records are stored in the workspace under `.ans/events/index.jsonl` and daily JSONL. They omit content, prompts, credentials and raw model messages. Files and audit logs are separate writes: `auditFailed` with `observedMutation:true` means a file already changed. It does not mean rollback. The kernel controls normal local APIs; it is not a sandbox against malicious code in the same Node process. Windows coverage includes Node-recognized links and junctions, not every reparse tag.

## Local validation and history

The local package test checks the exact 29-file whitelist and all 27 shipped product .mjs identities, builds a tarball, installs it offline in an isolated consumer, checks the five subpaths, runs the public typed permission flow and real Pi tool loop, executes this example and starts the installed CLI. SDK or cache absence fails the check. Old 0.3.0 and GUI v1 artifacts and caches remain protected history.

```sh
node --test tests/package/test_package.mjs
```

From the source checkout, npm test runs 16 explicit Node modules serially: nine Kernel, three Adapter, package, Reviewer and two integration modules. It should run after downstream tests have been adapted and independently verified; this packaging stage does not claim the full suite has already passed.

```sh
npm test --ignore-scripts
```

Run that full source command after the current candidate's staged checks and independent verification. The tests use controlled local inference rather than paid model calls; their source modules are excluded from the installable package.

That development test is retained in the source project and excluded from the package. The published file set contains only the Node runtime, CLI, README and package metadata. The source lock records the tested dependency tree; another consumer resolves its own transitive tree. This work creates a local installable artifact; it does not publish to npm.

Source-project architecture and evidence: [architecture](docs/roles/ProjectManager/docs/architecture.md), [distribution flow](docs/roles/ProjectManager/docs/feature/distribution.md), [workbench v2 design](docs/design/2026-10-07_design_desktop-workbench-v2.md). Python v1 and its test history remain read-only reference material and are excluded from distribution.

## Trusted workbench integration (0.4.0)

The supported subpaths are `legion-runtime/workbench-models` and `legion-runtime/services/policy`, `/mutation`, `/proposal`, `/pi-agent`. The first explicitly exports the 30 shared Model/authority items defined by the accepted workbench contract; the others expose only their public Service contracts and factories. No private wiring or Provider path is public.

`createPiAgentService` supports the unchanged legacy single_run path and a tool-less conversation path using typed `PiConnectionProfile` plus private `{apiKey}` credentials, XOR legacy `modelProviders`. It statically selects the three installed public Pi protocol adapters. `start_run` starts a turn; consume `next_event` through the terminal before the next turn. `cancel_turn` stops only that turn; `get_history` and typed `restore_history` retain validated user/assistant text, never task grants, pending tools or credentials. Conversation completion returns idle; instance cancel/close disposes it. Model metadata and prices stay unknown when unavailable.

The desktop consumes an actual installed local tarball before any bare imports. Its sole Human conversation is the per-project PM, created or reused on the first message. Discussion uses no tools, file writes or workspace audit. A confirmed plan binds workspace, plan/profile/organization versions, context SHA, role/task and exact writeSet; only then may dynamic agents use the existing controlled write tool. Storage rechecks root and context before commit. Ordinary .ans writes remain denied, required approvals remain effective, and source changes revoke stale confirmation. Writing tests is not running them: software checks without executor evidence are `not_executed`.

This Node package and dependency stage is not a completed desktop release. The new desktop UI, Windows ZIP and independent Reviewer/Tester validation follow in separate stages. No publishing or paid model call is performed during local controlled verification.
