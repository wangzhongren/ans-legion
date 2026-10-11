/** Pure software-check values. Construction validates data, never proves host approval or execution. */
import { modelRecord, modelString, normalizeProjectReadResource, digestValue } from "./core.mjs";

function sha(value, field) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new TypeError(field + " must be SHA256");
  return value;
}
function integer(value, field, maximum, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new TypeError(field + "_budget");
  return value;
}
function files(value, field, { directories = false, nonempty = false } = {}) {
  if (!Array.isArray(value) || value.length > 1024 || (nonempty && value.length === 0)) {
    throw new TypeError(field + "_collection_or_budget");
  }
  const seen = new Set();
  return Object.freeze(value.map((item) => {
    let resource;
    if (directories && typeof item === "string" && item.endsWith("/")) {
      resource = normalizeProjectReadResource(item.slice(0, -1)) + "/";
    } else resource = normalizeProjectReadResource(item);
    if (resource === "" || (!directories && resource.endsWith("/"))) throw new TypeError("exact_check_resource_required");
    const key = resource.toLowerCase();
    if (seen.has(key)) throw new TypeError("duplicate_check_resource_alias");
    seen.add(key);
    return resource;
  }));
}
function workspace(value) {
  modelRecord(value, "workspaceIdentity", ["canonicalPath", "deviceId", "fileId"]);
  const canonicalPath = modelString(value.canonicalPath, "canonicalPath").replaceAll("\\", "/");
  if ((!canonicalPath.startsWith("/") && !/^[A-Za-z]:\//.test(canonicalPath)) ||
      canonicalPath.includes("\0") || canonicalPath.split("/").some((part) => part === "." || part === "..")) {
    throw new TypeError("invalid_workspace_identity");
  }
  for (const field of ["deviceId", "fileId"]) {
    if (typeof value[field] !== "string" || !/^(0|[1-9][0-9]*)$/.test(value[field])) {
      throw new TypeError("invalid_workspace_file_identity");
    }
  }
  if (value.fileId === "0") throw new TypeError("unavailable_workspace_file_identity");
  return Object.freeze({ canonicalPath, deviceId: value.deviceId, fileId: value.fileId });
}
function versions(value) {
  if (!Array.isArray(value) || value.length > 1024) throw new TypeError("input_versions_budget");
  const resources = files(value.map((item) => item.resource), "inputVersions");
  const result = value.map((item, index) => {
    modelRecord(item, "input version", ["resource", "sha256", "byteLength", "state", "executable"]);
    if(item.state==="absent") {
      if(item.sha256!==null || item.byteLength!==0)throw new TypeError("absent_check_input_has_content");
      return Object.freeze({resource:resources[index],state:"absent",sha256:null,byteLength:0});
    }
    if(item.state!==undefined && item.state!=="present")throw new TypeError("invalid_check_baseline_state");
    return Object.freeze({ resource: resources[index], sha256: sha(item.sha256, "sha256"),
      byteLength: integer(item.byteLength, "byteLength", Number.MAX_SAFE_INTEGER) });
  });
  result.sort((a, b) => a.resource.toLowerCase().localeCompare(b.resource.toLowerCase()));
  return Object.freeze(result);
}

export class CheckSpec {
  constructor(options) {
    modelRecord(options, "CheckSpec", ["checkId", "kind", "argv", "testResources", "inputResources",
      "outputResources", "timeoutSeconds", "network", "logMaxBytes"]);
    this.checkId = modelString(options.checkId, "checkId");
    if (options.kind !== "node-test") throw new TypeError("unsupported_check_kind");
    this.kind = options.kind;
    this.testResources = files(options.testResources, "testResources", { nonempty: true });
    this.inputResources = files(options.inputResources, "inputResources", { nonempty: true });
    if (this.testResources.some((resource) => !this.inputResources.some((input) =>
      input.toLowerCase() === resource.toLowerCase()))) throw new TypeError("test_input_required");
    if (!Array.isArray(options.argv) || options.argv.length !== this.testResources.length + 1 ||
        options.argv[0] !== "--test" || this.testResources.some((resource, index) => options.argv[index + 1] !== resource) ||
        this.testResources.some((resource) => resource.startsWith("-"))) throw new TypeError("fixed_node_test_argv_required");
    this.argv = Object.freeze([...options.argv]);
    this.outputResources = files(options.outputResources ?? [], "outputResources", { directories: true });
    if (this.outputResources.some((output) => this.inputResources.some((input) => {
      const key = output.toLowerCase();
      const candidate = input.toLowerCase();
      if (key.endsWith("/")) return candidate.startsWith(key);
      return candidate === key;
    }))) throw new TypeError("check_output_overlaps_readonly_input");
    this.timeoutSeconds = integer(options.timeoutSeconds, "timeoutSeconds", 300, 1);
    this.network = options.network ?? "none";
    if (!["none", "localhost"].includes(this.network)) throw new TypeError("invalid_check_network");
    this.logMaxBytes = integer(options.logMaxBytes ?? 262144, "logMaxBytes", 1048576, 1);
    Object.freeze(this);
  }
  get digest() { return digestValue(this); }
}

export function checkSpecs(value = []) {
  if (!Array.isArray(value) || value.length > 64) throw new TypeError("checks_collection_or_budget");
  const seen = new Set();
  return Object.freeze(value.map((item) => {
    const spec = item instanceof CheckSpec ? item : new CheckSpec(item);
    if (seen.has(spec.checkId)) throw new TypeError("duplicate_check_id");
    seen.add(spec.checkId);
    return spec;
  }));
}

export class CheckRequest {
  constructor(options) {
    modelRecord(options, "CheckRequest", ["requestId", "runId", "checkId"]);
    for (const field of ["requestId", "runId", "checkId"]) this[field] = modelString(options[field], field);
    Object.freeze(this);
  }
  get digest() { return digestValue(this); }
}

/** Trusted host supplies this value only after validating a live customer approval. It is not a bearer capability. */
export class CheckAuthorization {
  constructor(options) {
    const textFields = ["authorizationId", "confirmationId", "organizationVersion", "roleId", "taskId",
      "sessionId", "instanceId", "runId", "profileVersion"];
    modelRecord(options, "CheckAuthorization", [...textFields, "workspaceIdentity", "planDigest",
      "fileOwnersDigest", "approvedChecks", "inputVersions", "generationDigest"]);
    for (const field of textFields) this[field] = modelString(options[field], field);
    this.workspaceIdentity = workspace(options.workspaceIdentity);
    this.planDigest = sha(options.planDigest, "planDigest");
    this.fileOwnersDigest = sha(options.fileOwnersDigest, "fileOwnersDigest");
    if(options.generationDigest!==undefined)this.generationDigest=sha(options.generationDigest,"generationDigest");
    this.approvedChecks = checkSpecs(options.approvedChecks);
    if (this.approvedChecks.length === 0) throw new TypeError("approved_check_required");
    this.inputVersions = versions(options.inputVersions);
    if (this.approvedChecks.some((spec) => spec.inputResources.some((resource) =>
      !this.inputVersions.some((input) => input.resource.toLowerCase() === resource.toLowerCase())))) {
      throw new TypeError("approved_input_version_required");
    }
    Object.freeze(this);
  }
  get inputDigest() { return digestValue(this.inputVersions); }
  get digest() { return digestValue(this); }
}

export class CheckDecision {
  constructor(options) {
    modelRecord(options, "CheckDecision", ["allowed", "reason", "requestId", "runId", "checkId", "authorizationDigest"]);
    if (typeof options.allowed !== "boolean") throw new TypeError("invalid_check_decision");
    this.allowed = options.allowed;
    for (const field of ["reason", "requestId", "runId", "checkId"]) this[field] = modelString(options[field], field);
    this.authorizationDigest = sha(options.authorizationDigest, "authorizationDigest");
    Object.freeze(this);
  }
}

export class CheckResult {
  constructor(options) {
    modelRecord(options, "CheckResult", ["requestId", "runId", "checkId", "authorizationDigest", "specDigest",
      "status", "reason", "executed", "actualArgv", "exitCode", "testCount", "stdout", "stderr", "logsTruncated",
      "inputVersions", "environment", "startedAt", "finishedAt"]);
    for (const field of ["requestId", "runId", "checkId", "reason"]) this[field] = modelString(options[field], field);
    this.authorizationDigest = sha(options.authorizationDigest, "authorizationDigest");
    this.specDigest = sha(options.specDigest, "specDigest");
    if (!["passed", "failed", "cancelled", "unsupported", "stale", "error"].includes(options.status)) {
      throw new TypeError("invalid_check_status");
    }
    this.status = options.status;
    if (typeof options.executed !== "boolean" || typeof options.logsTruncated !== "boolean") {
      throw new TypeError("check_execution_flags_required");
    }
    this.executed = options.executed;
    if (!Array.isArray(options.actualArgv)) throw new TypeError("actual_argv_array_required");
    this.actualArgv = Object.freeze(options.actualArgv.map((item) => modelString(item, "actualArgv")));
    if (this.actualArgv.length > 1026) throw new TypeError("actual_argv_budget");
    this.exitCode = options.exitCode;
    if (this.exitCode !== null && (!Number.isSafeInteger(this.exitCode) || this.exitCode < 0 || this.exitCode > 255)) {
      throw new TypeError("invalid_exit_code");
    }
    this.testCount = integer(options.testCount, "testCount", Number.MAX_SAFE_INTEGER);
    for (const field of ["stdout", "stderr"]) this[field] = modelString(options[field], field, { empty: true });
    if (Buffer.byteLength(this.stdout + this.stderr, "utf8") > 1048576) throw new TypeError("check_log_budget");
    this.logsTruncated = options.logsTruncated;
    this.inputVersions = versions(options.inputVersions);
    this.environment = null;
    if (options.environment !== null) {
      modelRecord(options.environment, "check environment", ["platform", "runtime", "runtimeVersion", "isolation", "network"]);
      const environment = {};
      for (const field of ["platform", "runtime", "runtimeVersion", "isolation", "network"]) {
        environment[field] = modelString(options.environment[field], field);
      }
      if (!["none", "localhost"].includes(environment.network)) throw new TypeError("invalid_check_network");
      this.environment = Object.freeze(environment);
    }
    for (const field of ["startedAt", "finishedAt"]) {
      this[field] = modelString(options[field], field);
      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(this[field]) ||
          !Number.isFinite(Date.parse(this[field])) || new Date(this[field]).toISOString() !== this[field]) {
        throw new TypeError("invalid_check_time");
      }
    }
    if (this.finishedAt < this.startedAt) throw new TypeError("invalid_check_time_order");
    if (this.executed && (this.actualArgv.length < 3 || this.environment === null)) {
      throw new TypeError("actual_execution_evidence_required");
    }
    if (!this.executed && (this.actualArgv.length !== 0 || this.exitCode !== null || this.testCount !== 0)) {
      throw new TypeError("unexpected_execution_evidence");
    }
    if (this.status === "passed" && (!this.executed || this.exitCode !== 0 || this.testCount === 0 ||
        this.inputVersions.length === 0)) throw new TypeError("passing_execution_evidence_required");
    if (this.status === "failed" && (!this.executed || this.exitCode === null || this.exitCode === 0)) {
      throw new TypeError("failed_execution_evidence_required");
    }
    if (this.status === "unsupported" && this.executed) throw new TypeError("unsupported_check_must_not_execute");
    Object.freeze(this);
  }
  get inputDigest() { return digestValue(this.inputVersions); }
  get digest() { return digestValue(this); }
}
