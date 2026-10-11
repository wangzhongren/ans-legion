import { ReadService } from "../abstract/read.mjs";
import { createStorageProvider, StorageError } from "../../providers/public/storage.mjs";
import { ProjectReadRequest, ProjectReadResult } from "../../models/agent.mjs";

const knownFailures = new Set(["unsafe_workspace", "root_identity_changed", "unsafe_resource",
  "restricted_resource", "ambiguous_case", "path_not_found", "linked_target", "unsafe_parent",
  "target_not_directory", "target_not_file", "directory_changed", "file_changed", "file_too_large",
  "invalid_utf8", "binary_file", "start_line_out_of_range", "line_exceeds_budget",
  "read_budget", "read_service_closed"]);
function failure(request, error) {
  let reason = "read_failed";
  if (error?.name === "AbortError") reason = "read_cancelled";
  else if (error instanceof StorageError && knownFailures.has(error.message)) reason = error.message;
  return new ProjectReadResult({ status: "denied", reason, resource: request.resource });
}
function checkSignal(signal) {
  if (signal !== undefined && !(signal instanceof AbortSignal)) throw new TypeError("invalid_signal");
}
export class _ReadService extends ReadService {
  #storage;
  constructor(options) {
    super();
    this.#storage = createStorageProvider(options);
    Object.freeze(this);
  }
  async listFiles(request, { signal } = {}) {
    if (!(request instanceof ProjectReadRequest) || request.tool !== "legion_list_files") {
      throw new TypeError("typed_list_request_required");
    }
    checkSignal(signal);
    try {
      const { entries, nextCursor } = this.#storage.listProjectFiles(request.resource, request.cursor, request.limit, signal);
      return new ProjectReadResult({ status: "listed", reason: "listed", resource: request.resource,
        entries, nextCursor });
    } catch (error) { return failure(request, error); }
  }
  async readFile(request, { signal } = {}) {
    if (!(request instanceof ProjectReadRequest) || request.tool !== "legion_read_file") {
      throw new TypeError("typed_file_request_required");
    }
    checkSignal(signal);
    try {
      const value = this.#storage.readProjectFile(request.resource, request.startLine, request.maxBytes, signal);
      return new ProjectReadResult({ status: "read", reason: "read", resource: request.resource, ...value });
    } catch (error) { return failure(request, error); }
  }
  async close() { await this.#storage.close(); }
}
