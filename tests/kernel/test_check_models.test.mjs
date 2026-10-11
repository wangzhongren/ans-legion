import test from "node:test";
import assert from "node:assert/strict";
import { CheckSpec, CheckRequest, CheckAuthorization, CheckDecision, CheckResult } from "../../src/kernel/models/check.mjs";

const digest = "a".repeat(64);
const inputVersions = [{ resource: "tests/unit.mjs", sha256: digest, byteLength: 23 },
  { resource: "src/main.mjs", sha256: digest, byteLength: 5 }];
function spec(extra = {}) {
  return new CheckSpec({ checkId: "unit", kind: "node-test", argv: ["--test", "tests/unit.mjs"],
    testResources: ["tests/unit.mjs"], inputResources: inputVersions.map((item) => item.resource),
    outputResources: ["test-output/"], timeoutSeconds: 300, ...extra });
}
function authorization(extra = {}) {
  return new CheckAuthorization({ authorizationId: "host-approval", confirmationId: "customer-confirmation",
    workspaceIdentity: { canonicalPath: "/tmp/project", deviceId: "1", fileId: "2" }, planDigest: digest,
    organizationVersion: "org-1", roleId: "Acceptance", taskId: "task", sessionId: "session", instanceId: "instance",
    runId: "run", profileVersion: "profile-1", fileOwnersDigest: digest, approvedChecks: [spec()], inputVersions, ...extra });
}
function result(extra = {}) {
  return new CheckResult({ requestId: "request", runId: "run", checkId: "unit", authorizationDigest: authorization().digest,
    specDigest: spec().digest, status: "passed", reason: "tests_passed", executed: true,
    actualArgv: ["/host/node", "--test", "tests/unit.mjs"], exitCode: 0, testCount: 2,
    stdout: "2 tests passed", stderr: "", logsTruncated: false, inputVersions,
    environment: { platform: "darwin", runtime: "node", runtimeVersion: "22", isolation: "macos-seatbelt", network: "none" },
    startedAt: "2026-10-08T01:00:00.000Z", finishedAt: "2026-10-08T01:00:01.000Z", ...extra });
}

test("check specs pin argv, exact tests, input and bounded capabilities", () => {
  const value = spec();
  assert.deepEqual(new CheckSpec(JSON.parse(JSON.stringify(value))), value);
  assert.ok(Object.isFrozen(value.argv));
  for (const change of [{ kind: "shell" }, { argv: ["sh", "-c", "echo ok"] }, { argv: ["--test", "other.mjs"] },
    { timeoutSeconds: 301 }, { timeoutSeconds: 0 }, { network: "internet" }, { testResources: [] },
    { inputResources: ["src/main.mjs"] }, { inputResources: ["tests/unit.mjs", "TESTS\\UNIT.MJS"] },
    { outputResources: ["src/.ans/"] }, { outputResources: ["tests/"] }, { inputResources: ["../outside"] }, { command: "node" },
    { testResources: ["--eval"], argv: ["--test", "--eval"], inputResources: ["--eval"] }]) {
    assert.throws(() => spec(change), TypeError);
  }
  assert.notEqual(value.digest, spec({ network: "localhost" }).digest);
});

test("authorization immutably binds host identity, approval, exact specs and input versions", () => {
  const raw = inputVersions.map((item) => ({ ...item }));
  const value = authorization({ inputVersions: raw });
  raw[0].sha256 = "b".repeat(64);
  assert.equal(value.inputVersions[1].sha256, digest);
  assert.deepEqual(new CheckAuthorization(JSON.parse(JSON.stringify(value))), value);
  for (const change of [{ planDigest: "b".repeat(64) }, { roleId: "Other" }, { taskId: "other" },
    { sessionId: "other" }, { instanceId: "other" }, { runId: "other" }, { profileVersion: "other" },
    { organizationVersion: "other" }, { fileOwnersDigest: "b".repeat(64) },
    { workspaceIdentity: { ...value.workspaceIdentity, fileId: "3" } }, { approvedChecks: [spec({ timeoutSeconds: 5 })] },
    { inputVersions: inputVersions.map((item) => ({ ...item, sha256: "c".repeat(64) })) }]) {
    assert.notEqual(authorization(change).digest, value.digest);
  }
  for (const change of [{ approvedChecks: [] }, { approvedChecks: [spec(), spec()] }, { inputVersions: [] },
    { workspaceIdentity: { ...value.workspaceIdentity, fileId: "0" } }, { approved: true }]) {
    assert.throws(() => authorization(change), TypeError);
  }
});

test("check request cannot carry commands or caller roles and decisions bind the request", () => {
  const request = new CheckRequest({ requestId: "request", runId: "run", checkId: "unit" });
  for (const extra of [{ argv: [] }, { roleId: "PM" }, { workspaceIdentity: {} }]) {
    assert.throws(() => new CheckRequest({ ...request, ...extra }), TypeError);
  }
  const decision = new CheckDecision({ ...request, allowed: true, reason: "host_approved", authorizationDigest: digest });
  assert.ok(Object.isFrozen(decision));
  assert.throws(() => new CheckDecision({ ...decision, allowed: "true" }), TypeError);
});

test("result evidence is immutable, bounded and distinguishes real failure from unexecuted", () => {
  const passed = result();
  assert.deepEqual(new CheckResult(JSON.parse(JSON.stringify(passed))), passed);
  assert.ok(Object.isFrozen(passed.environment));
  assert.ok(Object.isFrozen(passed.inputVersions[0]));
  for (const change of [{ testCount: 0 }, { exitCode: 1 }, { executed: false }, { inputVersions: [] },
    { actualArgv: [] }, { environment: null }, { status: "not_executed" }, { exitCode: -1 },
    { stdout: "x".repeat(1048577) }, { logsTruncated: "false" }, { startedAt: "2026-02-30T01:00:00.000Z" },
    { finishedAt: "2026-10-07T01:00:00.000Z" }]) assert.throws(() => result(change), TypeError);
  assert.equal(result({ status: "failed", reason: "tests_failed", exitCode: 1 }).status, "failed");
  for (const status of ["unsupported", "stale", "error", "cancelled"]) {
    const unexecuted = result({ status, reason: status, executed: false, actualArgv: [], exitCode: null,
      testCount: 0, environment: null });
    assert.equal(unexecuted.executed, false);
  }
  assert.throws(() => result({ status: "unsupported" }), /must_not_execute/);
  assert.throws(() => result({ status: "failed" }), /failed_execution/);
});
