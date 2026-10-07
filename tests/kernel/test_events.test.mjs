import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import nodeFs from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createMutationService, MutationError } from "../../src/kernel/services/public/mutation.mjs";
import { AgentSession, ActionProposal, RoleBoundary, PolicyDecision, Outcome, Event, _createRuntimeAuthority } from "../../src/kernel/models/core.mjs";
async function fixture(t) {
  const workspace = await fs.mkdtemp(join(tmpdir(), "legion-events-"));
  const session = new AgentSession({ sessionId: "s", roleId: "Backend", taskId: "task", organizationVersion: "v3" });
  const boundary = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"], tools: ["legion_write_file"], capabilities: ["write_file"] });
  const authority = _createRuntimeAuthority({ sessions: [session], boundaries: [boundary], organizationVersion: "v3" });
  const service = createMutationService({ workspace, _authority: authority });
  const proposal = new ActionProposal({ proposalId: "p", action: "write_file", resource: "backend/a.txt", content: "secret-body", tool: "legion_write_file", capability: "write_file", session });
  const permit = () => authority.issue(proposal, new PolicyDecision({ outcome: Outcome.ALLOW, reason: "ok", proposalDigest: proposal.digest, organizationVersion: "v3", boundaryDigest: boundary.digest }));
  t.after(async () => { t.mock.restoreAll(); await service.close(); await fs.rm(workspace, { recursive: true }); });
  return { workspace, service, proposal, authority, permit };
}
test("internal index and daily logs contain same ordered events and Shanghai time", async (t) => {
  const f = await fixture(t);
  assert.deepEqual(await f.service.events(), []);
  await f.service.recordEvents([new Event({ kind: "proposal", resource: "backend/a.txt" }), new Event({ kind: "decision", outcome: "DENY" })]);
  const events = await f.service.events(); assert.deepEqual(events.map((e) => e.sequence), [1, 2]);
  assert.match(events[0].recordedAt, /\+08:00$/); assert.ok(Object.isFrozen(events));
  const directory = join(f.workspace, ".ans/events");
  assert.equal(await fs.readFile(join(directory, "index.jsonl"), "utf8"),
    await fs.readFile(join(directory, events[0].recordedAt.slice(0, 10) + ".jsonl"), "utf8"));
});
test("same workspace Runtime providers serialize event sequence across concurrent commits", async (t) => {
  const f = await fixture(t); const other = createMutationService({ workspace: f.workspace, _authority: f.authority });
  try {
    await Promise.all([f.service.recordEvents([new Event({ kind: "one" })]), other.recordEvents([new Event({ kind: "two" })]),
      f.service.execute(f.proposal, f.permit())]);
    const events = await other.events(); assert.deepEqual(events.map((e) => e.sequence), [1, 2, 3, 4]);
    assert.deepEqual(events.map((e) => e.kind), ["one", "two", "mutation_intent", "mutation_success"]);
  } finally { await other.close(); }
});
test("intent audit failure creates no target and closes later writes", async (t) => {
  const f = await fixture(t);
  await fs.mkdir(join(f.workspace, ".ans/events/index.jsonl"), { recursive: true });
  const result = await f.service.execute(f.proposal, f.permit());
  assert.equal(result.status, "audit_failed"); assert.equal(result.observedMutation, false); assert.equal(result.auditFailed, true);
  await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
  await fs.rm(join(f.workspace, ".ans"), { recursive: true });
  assert.equal((await f.service.execute(f.proposal, f.permit())).status, "audit_failed");
});
test("observed replace followed by result audit failure reports truth and stops writes", async (t) => {
  const f = await fixture(t); const rename = nodeFs.renameSync;
  t.mock.method(nodeFs, "renameSync", (...args) => {
    rename(...args);
    nodeFs.rmSync(join(f.workspace, ".ans/events/index.jsonl"));
    nodeFs.mkdirSync(join(f.workspace, ".ans/events/index.jsonl"));
  });
  const result = await f.service.execute(f.proposal, f.permit());
  assert.equal(result.success, false); assert.equal(result.status, "audit_failed");
  assert.equal(result.observedMutation, true); assert.equal(result.auditFailed, true);
  assert.equal(await fs.readFile(join(f.workspace, "backend/a.txt"), "utf8"), "secret-body");
  assert.equal((await f.service.execute(f.proposal, f.permit())).status, "audit_failed");
});
test("daily/index divergence and incomplete JSONL fail closed", async (t) => {
  const f = await fixture(t); await f.service.recordEvents([new Event({ kind: "proposal" })]);
  const event = (await f.service.events())[0];
  await fs.appendFile(join(f.workspace, ".ans/events/" + event.recordedAt.slice(0, 10) + ".jsonl"), "{}\n");
  await assert.rejects(f.service.events(), MutationError);
  assert.equal((await f.service.execute(f.proposal, f.permit())).status, "audit_failed");
});
test("both audit parents and file reject junction metadata, actual link where host allows", async (t) => {
  const f = await fixture(t); const outside = await fs.mkdtemp(join(tmpdir(), "legion-audit-outside-"));
  t.after(() => fs.rm(outside, { recursive: true }));
  for (const parent of [".ans", ".ans/events", ".ans/events/index.jsonl"]) {
    await fs.rm(join(f.workspace, ".ans"), { recursive: true, force: true });
    await fs.mkdir(join(f.workspace, parent, ".."), { recursive: true });
    try { await fs.symlink(outside, join(f.workspace, parent), "junction"); }
    catch (error) {
      if (error.code !== "EPERM") throw error;
      t.diagnostic("Host EPERM junction restriction: controlled metadata at " + parent + ", no skip.");
      await fs.mkdir(join(f.workspace, parent));
      const lstat = fs.lstat;
      t.mock.method(fs, "lstat", async (path, ...args) => {
        if (String(path).toLowerCase() === join(f.workspace, parent).toLowerCase()) {
          return { isSymbolicLink: () => true, isDirectory: () => true, isFile: () => false };
        }
        return await lstat(path, ...args);
      });
    }
    await assert.rejects(f.service.events(), MutationError);
    assert.deepEqual(await fs.readdir(outside), []);
  }
});
