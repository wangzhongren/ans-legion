import { CheckService } from "../abstract/check.mjs";
import { createCheckProvider } from "../../providers/public/check.mjs";
import { CheckRequest, CheckAuthorization, CheckDecision, CheckResult } from "../../models/check.mjs";
import { modelRecord } from "../../models/core.mjs";

export class _CheckService extends CheckService {
  #provider; #validator; #closing = new AbortController(); #running = new Set(); #closed = false;
  constructor(options) {
    super();
    modelRecord(options, "check service options", ["workspaceRoot", "runtimeExecutable", "outputRoot", "authorizationValidator", "lockRoot", "knownKeys"]);
    if (options.authorizationValidator === null || typeof options.authorizationValidator !== "object" ||
        typeof options.authorizationValidator?.validate !== "function") throw new TypeError("trusted_authorization_validator_required");
    this.#validator = options.authorizationValidator;
    this.#provider = createCheckProvider({ workspaceRoot: options.workspaceRoot,
      runtimeExecutable: options.runtimeExecutable, outputRoot: options.outputRoot, lockRoot:options.lockRoot, knownKeys: options.knownKeys });
    Object.freeze(this);
  }
  #decision(request, authorization, allowed, reason) {
    return new CheckDecision({ allowed, reason, requestId: request.requestId, runId: request.runId,
      checkId: request.checkId, authorizationDigest: authorization.digest });
  }
  async #validate(request, authorization, signal) {
    if (signal.aborted) throw new TypeError("host_check_validation_cancelled");
    const pending = this.#validator.validate(request, authorization, { signal });
    const value = await new Promise((resolve, reject) => {
      const abort = () => reject(new TypeError("host_check_validation_cancelled"));
      Promise.resolve(pending).then((result) => {
        signal.removeEventListener("abort", abort); resolve(result);
      }, (error) => { signal.removeEventListener("abort", abort); reject(error); });
      if (signal.aborted) { abort(); return; }
      signal.addEventListener("abort", abort, { once: true });
    });
    if (value === null || typeof value !== "object" || !(value.decision instanceof CheckDecision) ||
        value.decision.requestId !== request.requestId || value.decision.runId !== request.runId ||
        value.decision.checkId !== request.checkId || value.decision.authorizationDigest !== authorization.digest) {
      throw new TypeError("invalid_host_check_validation");
    }
    if (value.decision.allowed && (!(value.authorization instanceof CheckAuthorization) ||
        value.authorization.digest !== authorization.digest || !(value.signal instanceof AbortSignal))) {
      throw new TypeError("live_host_check_authorization_required");
    }
    return value;
  }
  async #run(request, authorization, signal) {
    const unexecuted = (status, reason, allowed = false) => Object.freeze({
      decision: this.#decision(request, authorization, allowed, reason),
      result: this.#provider.notExecuted(request, authorization, status, reason) });
    if (this.#closed || signal?.aborted) return unexecuted("cancelled", "check_cancelled");
    if (request.runId !== authorization.runId || !authorization.approvedChecks.some((spec) => spec.checkId === request.checkId)) {
      return unexecuted("error", "check_authorization_binding_mismatch");
    }
    const combined = [this.#closing.signal];
    if (signal !== undefined) combined.push(signal);
    let validation;
    try { validation = await this.#validate(request, authorization, AbortSignal.any(combined)); }
    catch (error) {
      if (this.#closed || signal?.aborted) return unexecuted("cancelled", "check_cancelled");
      return unexecuted("error", "authorization_verification_failed");
    }
    if (!validation.decision.allowed) return Object.freeze({ decision: validation.decision,
      result: this.#provider.notExecuted(request, authorization, "error", validation.decision.reason) });
    if (validation.signal.aborted) return unexecuted("stale", "authorization_changed");
    combined.push(validation.signal);
    const result = await this.#provider.run(request, authorization, { signal: AbortSignal.any(combined) });
    if (!(result instanceof CheckResult) || result.requestId !== request.requestId || result.runId !== request.runId ||
        result.checkId !== request.checkId || result.authorizationDigest !== authorization.digest) {
      throw new TypeError("invalid_provider_check_result");
    }
    const spec = authorization.approvedChecks.find((value) => value.checkId === request.checkId);
    if (result.specDigest !== spec.digest) throw new TypeError("provider_check_spec_mismatch");
    const prefix = [this.#provider.runtimeExecutable, "--permission", "--allow-fs-read=*", "--allow-fs-write=*",
      "--allow-child-process", "--test-isolation=none"];
    if (result.executed && (prefix.some((arg, index) => result.actualArgv[index] !== arg) ||
        !/^--test-reporter=\//.test(result.actualArgv[prefix.length]) ||
        !result.actualArgv[prefix.length].endsWith("/reporter.mjs") ||
        result.actualArgv.length !== spec.argv.length + prefix.length + 1 ||
        spec.argv.some((arg, i) => result.actualArgv[i + prefix.length + 1] !== arg) ||
        result.environment?.network !== spec.network ||
        result.environment?.isolation !== "macos-seatbelt+node-events-v1+no-child-process" || result.inputDigest !== authorization.inputDigest)) {
      throw new TypeError("provider_execution_evidence_mismatch");
    }
    if (signal?.aborted || this.#closed) return Object.freeze({ decision: validation.decision,
      result: new CheckResult({ ...result, status: "cancelled", reason: "check_cancelled" }) });
    let current;
    try { current = await this.#validate(request, authorization, AbortSignal.any(combined)); }
    catch (error) { current = undefined; }
    if (signal?.aborted || this.#closed) return Object.freeze({ decision: validation.decision,
      result: new CheckResult({ ...result, status: "cancelled", reason: "check_cancelled" }) });
    if (validation.signal.aborted || current === undefined || !current.decision.allowed || current.signal.aborted) {
      return Object.freeze({ decision: validation.decision,
        result: new CheckResult({ ...result, status: "stale", reason: "authorization_changed" }) });
    }
    return Object.freeze({ decision: validation.decision, result });
  }
  async run(request, authorization, { signal } = {}) {
    if (!(request instanceof CheckRequest) || !(authorization instanceof CheckAuthorization)) {
      throw new TypeError("typed_check_request_authorization_required");
    }
    if (signal !== undefined && !(signal instanceof AbortSignal)) throw new TypeError("invalid_signal");
    const running = this.#run(request, authorization, signal);
    this.#running.add(running);
    try { return await running; } finally { this.#running.delete(running); }
  }
  async close() {
    this.#closed = true; this.#closing.abort();
    await this.#provider.close();
    await Promise.all([...this.#running]);
  }
}
