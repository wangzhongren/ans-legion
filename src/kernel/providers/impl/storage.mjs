import { promises as fs, lstatSync, realpathSync, mkdtempSync } from "node:fs";
import nodeFs from "node:fs";
import { resolve, join, dirname, relative, isAbsolute } from "node:path";
import { tmpdir, homedir } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { StorageProvider, StorageError } from "../abstract/storage.mjs";
import { ActionProposal, MutationResult, Event, normalizeResource, normalizeProjectReadResource, modelRecord, modelString,
  _isRuntimeAuthority } from "../../models/core.mjs";
import { MutationVerification, ProjectFileOwners, isWorkbenchMutationAuthority } from "../../models/workbench.mjs";

// Coordination is local to this process and keyed by the resolved workspace, across Runtime instances.
const workspaces = new Map();
class VerificationError extends StorageError {
  constructor(reason, cause) { super(reason, { cause }); this.reason = reason; }
}
const editDenials = new Set(["edit_target_missing", "edit_target_not_file", "edit_file_too_large",
  "edit_source_changed", "edit_sha_mismatch", "edit_invalid_utf8", "edit_binary_file",
  "edit_old_text_missing", "edit_ambiguous_old_text"]);
function linked(metadata) { return metadata.isSymbolicLink(); } // Node reports Windows junction/reparse links here.
function ancestors(path) {
  const values = [];
  let current = path;
  for (;;) {
    values.unshift(current);
    const parent = dirname(current);
    if (parent === current) return values;
    current = parent;
  }
}
async function metadata(path) {
  try { return await fs.lstat(path); }
  catch (error) { if (error.code === "ENOENT") return undefined; throw error; }
}
function eventFor(proposal, kind, reason = "", observedMutation = false, contentDigest) {
  const value = { kind, roleId: proposal.session.roleId, taskId: proposal.session.taskId,
    organizationVersion: proposal.session.organizationVersion, resource: proposal.resource,
    proposalDigest: proposal.digest, correlationId: proposal.proposalId, reason, observedMutation };
  if (contentDigest !== undefined) value.contentDigest = contentDigest;
  return new Event(value);
}
function timestamp() { return new Date(Date.now() + 8 * 3600000).toISOString().replace("Z", "+08:00"); }

export class _LocalStorageProvider extends StorageProvider {
  #root; #rootIdentity; #authority; #leaseContext; #leaseRoot; #leaseKey; #leaseIdentity; #leaseRootIdentity; #sourceWitness; #ownedState; #shared; #closed = false; #temporary = false;
  constructor(options = {}) {
    super();
    modelRecord(options, "storage options", ["workspace", "workspaceIdentity", "_authority", "authority", "leaseContext", "isolatedOwnerLease"]);
    if (options.authority !== undefined && options._authority !== undefined) {
      throw new TypeError("authority_inputs_conflict");
    }
    if (options.authority !== undefined && !isWorkbenchMutationAuthority(options.authority)) {
      throw new TypeError("branded_workbench_authority_required");
    }
    let workspace = options.workspace;
    if (workspace === undefined || workspace === null) {
      workspace = mkdtempSync(join(realpathSync(tmpdir()), "legion-node-"));
      this.#temporary = true;
    }
    const root = resolve(modelString(workspace, "workspace"));
    for (const component of ancestors(root)) {
      const info = lstatSync(component);
      if (linked(info) || !info.isDirectory()) throw new StorageError("invalid_workspace");
    }
    this.#root = realpathSync(root);
    const rootInfo = nodeFs.lstatSync(this.#root, { bigint: true });
    this.#rootIdentity = Object.freeze({ canonicalPath: this.#root.replaceAll("\\", "/"),
      deviceId: String(rootInfo.dev), fileId: String(rootInfo.ino) });
    if (options.workspaceIdentity !== undefined) {
      modelRecord(options.workspaceIdentity, "workspaceIdentity", ["canonicalPath", "deviceId", "fileId"]);
      if (String(options.workspaceIdentity.canonicalPath).replaceAll("\\", "/").toLowerCase() !==
          this.#rootIdentity.canonicalPath.toLowerCase() ||
          options.workspaceIdentity.deviceId !== this.#rootIdentity.deviceId ||
          options.workspaceIdentity.fileId !== this.#rootIdentity.fileId) throw new StorageError("root_identity_changed");
    }
    if (_isRuntimeAuthority(options._authority)) this.#authority = options._authority;
    if (isWorkbenchMutationAuthority(options.authority)) this.#authority = options.authority;
    if (options.isolatedOwnerLease === true) {
      if (!this.#temporary || this.#authority === undefined || options.leaseContext !== undefined) throw new TypeError("isolated_owner_lease_requires_private_temporary_workspace");
      this.#createIsolatedOwners();
    } else if (options.isolatedOwnerLease !== undefined && options.isolatedOwnerLease !== false) throw new TypeError("invalid_isolated_owner_lease");
    if (options.leaseContext !== undefined) this.#bindLease(options.leaseContext);
    const key = this.#root.toLowerCase();
    if (!workspaces.has(key)) workspaces.set(key, { tail: Promise.resolve(), poisoned: false });
    this.#shared = workspaces.get(key);
    Object.freeze(this);
  }

  observeTime(){return Date.now();}
  workspace() { return this.#root; }
  #readRoot() {
    if (this.#closed) throw new StorageError("read_service_closed");
    try {
      for (const component of ancestors(this.#root)) {
        const info = nodeFs.lstatSync(component);
        if (linked(info) || !info.isDirectory()) throw new StorageError("unsafe_workspace");
      }
      const info = nodeFs.lstatSync(this.#root, { bigint: true });
      if (String(info.dev) !== this.#rootIdentity.deviceId || String(info.ino) !== this.#rootIdentity.fileId ||
          nodeFs.realpathSync(this.#root).replaceAll("\\", "/").toLowerCase() !==
          this.#rootIdentity.canonicalPath.toLowerCase()) throw new StorageError("root_identity_changed");
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError("root_identity_changed", { cause: error });
    }
  }
  #readPath(resource, kind) {
    this.#readRoot();
    if (resource === "") {
      if (kind !== "directory") throw new StorageError("unsafe_resource");
      return this.#root;
    }
    let normalized;
    try { normalized = normalizeProjectReadResource(resource); }
    catch (error) {
      if (error.message === "restricted_resource") throw new StorageError("restricted_resource", { cause: error });
      throw new StorageError("unsafe_resource", { cause: error });
    }
    let current = this.#root;
    const parts = normalized.split("/");
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      let actual;
      try {
        const matches = nodeFs.readdirSync(current).filter((name) => name.toLowerCase() === part.toLowerCase());
        if (matches.length > 1) throw new StorageError("ambiguous_case");
        if (matches.length === 0) throw new StorageError("path_not_found");
        actual = matches[0];
      } catch (error) {
        if (error instanceof StorageError) throw error;
        throw new StorageError("path_not_found", { cause: error });
      }
      current = join(current, actual);
      let info;
      try { info = nodeFs.lstatSync(current); }
      catch (error) { throw new StorageError("path_not_found", { cause: error }); }
      if (linked(info)) throw new StorageError("linked_target");
      if (index < parts.length - 1 && !info.isDirectory()) throw new StorageError("unsafe_parent");
    }
    const info = nodeFs.lstatSync(current);
    if (kind === "directory" && !info.isDirectory()) throw new StorageError("target_not_directory");
    if (kind === "file" && !info.isFile()) throw new StorageError("target_not_file");
    return current;
  }
  listProjectFiles(resource, cursor = "", limit = 200, signal) {
    signal?.throwIfAborted();
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200 || typeof cursor !== "string") {
      throw new StorageError("read_budget");
    }
    const path = this.#readPath(resource, "directory");
    const before = nodeFs.lstatSync(path, { bigint: true });
    const compare = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase()) || a.localeCompare(b);
    const names = nodeFs.readdirSync(path).sort(compare);
    const entries = [];
    for (const name of names) {
      if (cursor !== "" && compare(name, cursor) <= 0) continue;
      try {
        this.#readPath(resource === "" ? name : resource + "/" + name, "entry");
        const info = nodeFs.lstatSync(join(path, name));
        if (info.isFile()) entries.push(Object.freeze({ name, kind: "file" }));
        if (info.isDirectory()) entries.push(Object.freeze({ name, kind: "directory" }));
      } catch (error) {
        if (!(error instanceof StorageError)) throw error;
        if (!["restricted_resource", "linked_target", "unsafe_resource", "target_not_file", "target_not_directory"].includes(error.message)) throw error;
      }
    }
    const after = nodeFs.lstatSync(path, { bigint: true });
    if (["dev", "ino", "mtimeNs", "ctimeNs"].some((key) => before[key] !== after[key])) {
      throw new StorageError("directory_changed");
    }
    this.#readRoot(); signal?.throwIfAborted();
    const page = entries.slice(0, limit);
    let nextCursor = "";
    if (entries.length > limit) nextCursor = page.at(-1).name;
    return Object.freeze({ entries: Object.freeze(page), nextCursor });
  }
  readProjectFile(resource, startLine = 1, maxBytes = 65536, signal) {
    signal?.throwIfAborted();
    if (!Number.isSafeInteger(startLine) || startLine < 1 || !Number.isSafeInteger(maxBytes) ||
        maxBytes < 1 || maxBytes > 65536) throw new StorageError("read_budget");
    const path = this.#readPath(resource, "file");
    const before = nodeFs.lstatSync(path, { bigint: true });
    if (before.size > 2097152n) throw new StorageError("file_too_large");
    const descriptor = nodeFs.openSync(path, nodeFs.constants.O_RDONLY | nodeFs.constants.O_NOFOLLOW);
    let text; let sha256;
    try {
      const opened = nodeFs.fstatSync(descriptor, { bigint: true });
      if (!opened.isFile() || ["dev", "ino", "size", "mtimeNs", "ctimeNs"].some((key) => opened[key] !== before[key])) {
        throw new StorageError("file_changed");
      }
      const bytes = Buffer.alloc(Number(before.size) + 1);
      let count = 0;
      while (count < bytes.length) {
        const read = nodeFs.readSync(descriptor, bytes, count, bytes.length - count, count);
        if (read === 0) break;
        count += read;
      }
      const after = nodeFs.fstatSync(descriptor, { bigint: true });
      const current = nodeFs.lstatSync(this.#readPath(resource, "file"), { bigint: true });
      if (count !== Number(before.size) || ["dev", "ino", "size", "mtimeNs", "ctimeNs"].some((key) =>
        before[key] !== after[key] || after[key] !== current[key])) throw new StorageError("file_changed");
      sha256 = createHash("sha256").update(bytes.subarray(0, count)).digest("hex");
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, count)); }
      catch (error) { throw new StorageError("invalid_utf8", { cause: error }); }
    } finally { nodeFs.closeSync(descriptor); }
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) throw new StorageError("binary_file");
    const lines = text === "" ? [] : text.split("\n");
    if (text.endsWith("\n")) lines.pop();
    if (startLine > lines.length + 1) throw new StorageError("start_line_out_of_range");
    let chunk = ""; let index = startLine - 1;
    for (; index < lines.length; index += 1) {
      let line = lines[index];
      if (index < lines.length - 1 || text.endsWith("\n")) line += "\n";
      if (Buffer.byteLength(chunk + line, "utf8") > maxBytes) {
        if (chunk === "") throw new StorageError("line_exceeds_budget");
        break;
      }
      chunk += line;
    }
    this.#readRoot(); signal?.throwIfAborted();
    return Object.freeze({ text: chunk, byteLength: Buffer.byteLength(chunk, "utf8"), sha256,
      nextLine: index < lines.length ? index + 1 : 0, complete: index >= lines.length });
  }
  createIdentity() {
    if (this.#closed || this.#authority === undefined) throw new StorageError("runtime_authority_required");
    return randomUUID();
  }
  async #lock(operation) {
    const previous = this.#shared.tail;
    let release;
    this.#shared.tail = new Promise((resolveLock) => { release = resolveLock; });
    await previous;
    try { return await operation(); } finally { release(); }
  }
  async #guardRoot() {
    for (const component of ancestors(this.#root)) {
      const info = await fs.lstat(component);
      if (linked(info) || !info.isDirectory()) throw new StorageError("unsafe_workspace");
    }
  }
  #targetSync(resource, mustExist = true) {
    const normalized = normalizeResource(resource);
    for (const component of ancestors(this.#root)) {
      const info = nodeFs.lstatSync(component);
      if (linked(info) || !info.isDirectory()) throw new StorageError("unsafe_workspace");
    }
    let current = this.#root;
    const parts = normalized.split("/");
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const parent = nodeFs.lstatSync(current);
      if (linked(parent) || !parent.isDirectory()) throw new StorageError("unsafe_parent");
      const matches = nodeFs.readdirSync(current).filter((entry) => entry.toLowerCase() === part.toLowerCase());
      if (matches.length > 1) throw new StorageError("ambiguous_case");
      let component = part;
      if (matches.length === 1) component = matches[0];
      current = join(current, component);
      let child;
      try { child = nodeFs.lstatSync(current); }
      catch (error) {
        if(error.code==="ENOENT" && !mustExist)return join(current,...parts.slice(index+1));
        if (error.code !== "ENOENT" || mustExist || index !== parts.length - 1) throw error;
      }
      if (child !== undefined && linked(child)) throw new StorageError("linked_target");
      if (child !== undefined && index === parts.length - 1 && !child.isFile()) {
        throw new StorageError("target_not_file");
      }
    }
    return current;
  }
  #directoryIdentity(path, privateMode = false) {
    for (const component of ancestors(path)) {
      const info = nodeFs.lstatSync(component, { bigint: true });
      if (linked(info) || !info.isDirectory()) throw new TypeError("unsafe_owner_path");
    }
    const info = nodeFs.lstatSync(path, { bigint: true });
    if (privateMode && process.platform !== "win32" && (info.uid !== BigInt(process.getuid()) || (info.mode & 0o077n) !== 0n)) throw new TypeError("unsafe_owner_path");
    return Object.freeze({ deviceId: String(info.dev), fileId: String(info.ino) });
  }
  #sameWorkspace(value) {
    return value !== null && typeof value === "object" && value.canonicalPath === this.#rootIdentity.canonicalPath &&
      value.deviceId === this.#rootIdentity.deviceId && value.fileId === this.#rootIdentity.fileId;
  }
  #sameIdentity(actual, expected) { return actual.deviceId === expected.deviceId && actual.fileId === expected.fileId; }
  #ownerFile(path, budget, privateMode = false) {
    this.#directoryIdentity(dirname(path));
    const descriptor = nodeFs.openSync(path, nodeFs.constants.O_RDONLY | nodeFs.constants.O_NOFOLLOW);
    try {
      const info = nodeFs.fstatSync(descriptor, { bigint: true });
      if (!info.isFile() || info.nlink !== 1n || info.size > BigInt(budget) ||
          (privateMode && process.platform !== "win32" && (info.uid !== BigInt(process.getuid()) || (info.mode & 0o777n) !== 0o600n))) throw new TypeError("unsafe_owner_file");
      const buffer = Buffer.alloc(budget + 1); let length = 0;
      while (length <= budget) {
        const count = nodeFs.readSync(descriptor, buffer, length, buffer.length - length, null);
        if (count === 0) break; length += count;
      }
      if (length > budget) throw new TypeError("owner_source_budget");
      const bytes = buffer.subarray(0, length);
      const final = nodeFs.lstatSync(path, { bigint: true });
      if (linked(final) || final.dev !== info.dev || final.ino !== info.ino || final.size !== info.size) throw new TypeError("owner_source_changed");
      return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), identity: { deviceId: String(info.dev), fileId: String(info.ino) } };
    } finally { nodeFs.closeSync(descriptor); }
  }
  #bindLease(context) {
    modelRecord(context, "leaseContext", ["leaseRoot", "nonce", "leaseIdentity", "holderIdentity"]);
    const nonce = modelString(context.nonce, "lease nonce");
    if (nonce.length > 100) throw new TypeError("invalid_lease_context");
    for (const identity of [context.leaseIdentity, context.holderIdentity]) {
      modelRecord(identity, "lease identity", ["deviceId", "fileId"]);
      modelString(identity.deviceId, "deviceId"); modelString(identity.fileId, "fileId");
    }
    if (context.leaseRoot !== undefined && !isAbsolute(context.leaseRoot)) throw new TypeError("invalid_lease_context");
    this.#leaseRoot = resolve(context.leaseRoot ?? join(homedir(), ".legion-project-leases"));
    this.#leaseRootIdentity = this.#directoryIdentity(this.#leaseRoot, true);
    this.#leaseKey = createHash("sha256").update(this.#rootIdentity.deviceId + ":" + this.#rootIdentity.fileId).digest("hex");
    this.#leaseIdentity = Object.freeze({ ...context.leaseIdentity });
    this.#leaseContext = Object.freeze({ nonce, holderIdentity: Object.freeze({ ...context.holderIdentity }) });
    this.#sourceWitness = this.#ownerFile(join(this.#leaseRoot, this.#leaseKey + ".owner-source.json"), 16384, true);
  }
  #createIsolatedOwners() {
    // Only the Provider-created temporary demo owns this private persistence/lease fixture.
    const state = mkdtempSync(join(realpathSync(tmpdir()), "legion-owner-state-"));
    this.#ownedState = state;
    const leaseRoot = join(state, "leases"), catalogDir = join(state, "catalog");
    nodeFs.mkdirSync(leaseRoot, { mode: 0o700 }); nodeFs.mkdirSync(catalogDir, { mode: 0o700 });
    const key = createHash("sha256").update(this.#rootIdentity.deviceId + ":" + this.#rootIdentity.fileId).digest("hex");
    const leaseDir = join(leaseRoot, key); nodeFs.mkdirSync(leaseDir, { mode: 0o700 });
    const nonce = randomUUID(); nodeFs.writeFileSync(join(leaseDir, "holder"), nonce, { mode: 0o600, flag: "wx" });
    const owners = this.#authority.snapshot().fileOwners;
    nodeFs.writeFileSync(join(catalogDir, "workbench-projects.json"), JSON.stringify({ schemaVersion: 2, projects: [{ schemaVersion: 2, id: owners.projectId, workspaceIdentity: this.#rootIdentity, fileOwners: { projectId: owners.projectId, version: owners.version, owners: owners.owners } }] }), { mode: 0o600, flag: "wx" });
    const catalogIdentity = this.#directoryIdentity(catalogDir);
    nodeFs.writeFileSync(join(leaseRoot, key + ".owner-source.json"), JSON.stringify({ schemaVersion: 1, workspace: this.#rootIdentity, source: { catalogDirCanonicalPath: catalogDir, dirDeviceId: catalogIdentity.deviceId, dirFileId: catalogIdentity.fileId, filename: "workbench-projects.json", projectId: owners.projectId } }), { mode: 0o600, flag: "wx" });
    const holder = nodeFs.lstatSync(join(leaseDir, "holder"), { bigint: true });
    this.#bindLease({ leaseRoot, nonce, leaseIdentity: this.#directoryIdentity(leaseDir), holderIdentity: { deviceId: String(holder.dev), fileId: String(holder.ino) } });
  }
  #leaseCurrent() {
    try {
    if (this.#leaseContext === undefined || !this.#sameIdentity(this.#directoryIdentity(this.#leaseRoot, true), this.#leaseRootIdentity) ||
        !this.#sameIdentity(this.#directoryIdentity(join(this.#leaseRoot, this.#leaseKey), true), this.#leaseIdentity)) throw new TypeError("lease_lost");
    const holder = this.#ownerFile(join(this.#leaseRoot, this.#leaseKey, "holder"), 100, true);
    if (holder.text !== this.#leaseContext.nonce || !this.#sameIdentity(holder.identity, this.#leaseContext.holderIdentity)) throw new TypeError("lease_lost");
      } catch (error) {
      if (error instanceof TypeError) throw error;
      throw new TypeError("lease_lost", { cause: error });
    }
  }
  #currentOwner(proposal) {
    try {
    this.#leaseCurrent();
    const binding = this.#authority.ownerBinding(proposal);
    const witness = this.#ownerFile(join(this.#leaseRoot, this.#leaseKey + ".owner-source.json"), 16384, true);
    if (!this.#sameIdentity(witness.identity, this.#sourceWitness.identity) || witness.text !== this.#sourceWitness.text) throw new TypeError("owner_catalog_mismatch");
    const marker = JSON.parse(witness.text);
    modelRecord(marker, "owner-source", ["schemaVersion", "workspace", "source"]);
    if (marker.schemaVersion !== 1 || !this.#sameWorkspace(marker.workspace)) throw new TypeError("owner_catalog_mismatch");
    const source = modelRecord(marker.source, "owner source", ["catalogDirCanonicalPath", "dirDeviceId", "dirFileId", "filename", "projectId"]);
    if (source.filename !== "workbench-projects.json" || source.projectId !== binding.projectId || !isAbsolute(source.catalogDirCanonicalPath) ||
        realpathSync(source.catalogDirCanonicalPath) !== source.catalogDirCanonicalPath ||
        !this.#sameIdentity(this.#directoryIdentity(source.catalogDirCanonicalPath), { deviceId: source.dirDeviceId, fileId: source.dirFileId })) throw new TypeError("owner_catalog_mismatch");
    const catalog = JSON.parse(this.#ownerFile(join(source.catalogDirCanonicalPath, source.filename), 4194304).text);
    if (catalog.schemaVersion !== 2) throw new TypeError("legacy_owner_catalog_rejected");
    if (!Array.isArray(catalog.projects)) throw new TypeError("owner_catalog_mismatch");
    const matches = catalog.projects.filter(project => project.id === source.projectId);
    if (matches.length !== 1 || !this.#sameWorkspace(matches[0].workspaceIdentity)) throw new TypeError("owner_catalog_mismatch");
    const project = matches[0];
    if (project.schemaVersion !== 2) throw new TypeError("legacy_owner_project_rejected");
    const hasLegacyWriteSet = value => {
      if (value === null || typeof value !== "object") return false;
      if (Object.hasOwn(value, "writeSet")) return true;
      return Object.values(value).some(hasLegacyWriteSet);
    };
    if ((project.plan !== undefined && project.plan !== null &&
         (project.plan.schemaVersion !== 2 || hasLegacyWriteSet(project.plan))) ||
        (project.tasks !== undefined && (!Array.isArray(project.tasks) || project.tasks.some(hasLegacyWriteSet)))) {
      throw new TypeError("legacy_active_task_grant_rejected");
    }
    const value = project.fileOwners;
    const owners = new ProjectFileOwners({ projectId: value.projectId, version: value.version, owners: value.owners });
    if (owners.projectId !== binding.projectId || owners.digest !== binding.fileOwnersDigest || owners.version !== binding.ownerGeneration || owners.ownerOf(binding.resource) !== binding.roleId) throw new TypeError("persistent_file_owner_changed");
    this.#leaseCurrent();
      } catch (error) {
      this.#authority.invalidateOwnership("persistent_owner_or_lease_changed");
      if (error instanceof TypeError) throw error;
      throw new TypeError("owner_source_unavailable", { cause: error });
    }
  }
  async #commitLock(operation) {
    const path = join(this.#leaseRoot, this.#leaseKey, "commit.lock");
    const deadline = Date.now() + 2000;
    let handle;
    for (;;) {
      this.#leaseCurrent();
      try { handle = await fs.open(path, nodeFs.constants.O_WRONLY | nodeFs.constants.O_CREAT | nodeFs.constants.O_EXCL | nodeFs.constants.O_NOFOLLOW, 0o600); break; }
      catch (error) {
        if (error.code !== "EEXIST") throw new TypeError("commit_lock_unavailable", { cause: error });
        if (Date.now() >= deadline) throw new TypeError("commit_lock_busy");
        await new Promise(resolveDelay => setTimeout(resolveDelay, 10));
      }
    }
    const lockInfo = await handle.stat({ bigint: true });
    let outcome;
    try { this.#leaseCurrent(); outcome = await operation(); return outcome; }
    finally {
      try {
        await handle.close();
        const current = nodeFs.lstatSync(path, { bigint: true });
        if (linked(current) || current.dev !== lockInfo.dev || current.ino !== lockInfo.ino) throw new TypeError("commit_lock_changed");
        nodeFs.unlinkSync(path);
      } catch (error) {
        this.#shared.poisoned = true;
        if (outcome instanceof MutationResult) return new MutationResult({ ...outcome, success: false, status: "audit_failed", reason: "commit_lock_release_failed", auditFailed: true });
        throw new TypeError("commit_lock_release_failed", { cause: error });
      }
    }
  }
  #verify(proposal, receipt) {
    this.#currentOwner(proposal);
    const verification = this.#authority.recheck(proposal, receipt, this.observeTime());
    if (!isWorkbenchMutationAuthority(this.#authority)) return;
    if (!(verification instanceof MutationVerification)) throw new TypeError("typed_verification_required");
    try {
      for (const component of ancestors(this.#root)) {
        const info = nodeFs.lstatSync(component);
        if (linked(info) || !info.isDirectory()) throw new VerificationError("root_identity_changed");
      }
      const actual = nodeFs.lstatSync(this.#root, { bigint: true });
      const expected = verification.workspaceIdentity;
      if (nodeFs.realpathSync(this.#root).replaceAll("\\", "/").toLowerCase() !==
          expected.canonicalPath.replaceAll("\\", "/").toLowerCase() ||
          String(actual.dev) !== expected.deviceId || String(actual.ino) !== expected.fileId) {
        throw new VerificationError("root_identity_changed");
      }
    } catch (error) {
      if (error instanceof VerificationError) throw error;
      if (error.code === "ENOENT") throw new VerificationError("root_identity_changed", error);
      throw new VerificationError("verification_unavailable", error);
    }
    for (const file of verification.contextFiles) {
      if(file.state==="absent") {
        const target=this.#targetSync(file.resource,false);
        try {nodeFs.lstatSync(target);throw new VerificationError("context_changed");}catch(error){if(error.code!=="ENOENT")throw error;}
        continue;
      }
      try {
        const path = this.#targetSync(file.resource);
        const fd = nodeFs.openSync(path, "r");
        try {
          const before = nodeFs.fstatSync(fd, { bigint: true });
          if (!before.isFile() || before.size !== BigInt(file.byteLength)) {
            throw new VerificationError("context_changed");
          }
          // Bounded reads cannot allocate an untrusted growing file's complete contents.
          const bytes = Buffer.alloc(file.byteLength + 1);
          let count = 0;
          while (count < bytes.length) {
            const read = nodeFs.readSync(fd, bytes, count, bytes.length - count, count);
            if (read === 0) break;
            count += read;
          }
          const after = nodeFs.fstatSync(fd, { bigint: true });
          const current = nodeFs.lstatSync(this.#targetSync(file.resource), { bigint: true });
          if (count !== file.byteLength || !current.isFile() ||
              ["dev", "ino", "size", "mtimeNs", "ctimeNs"].some((field) =>
                before[field] !== after[field] || after[field] !== current[field])) {
            throw new VerificationError("context_changed");
          }
          const content = bytes.subarray(0, count);
          new TextDecoder("utf-8", { fatal: true }).decode(content);
          if (createHash("sha256").update(content).digest("hex") !== file.sha256) {
            throw new VerificationError("context_changed");
          }
        } finally { nodeFs.closeSync(fd); }
      } catch (error) {
        if (error instanceof VerificationError) throw error;
        if (error instanceof StorageError || error.code === "ENOENT" || error.code === "ERR_ENCODING_INVALID_ENCODED_DATA") {
          throw new VerificationError("context_changed", error);
        }
        throw new VerificationError("verification_unavailable", error);
      }
    }
    this.#currentOwner(proposal);
    this.#authority.recheck(proposal, receipt, this.observeTime());
  }
  async #target(resource, allowControlPlane = false) {
    const normalized = normalizeResource(resource, { allowControlPlane });
    await this.#guardRoot();
    let current = this.#root;
    const parts = normalized.split("/");
    for (let index = 0; index < parts.length; index += 1) {
      const info = await metadata(current);
      let component = parts[index];
      if (info !== undefined) {
        if (linked(info) || !info.isDirectory()) throw new StorageError("unsafe_parent");
        const matches = (await fs.readdir(current)).filter((entry) => entry.toLowerCase() === component.toLowerCase());
        if (matches.length > 1) throw new StorageError("ambiguous_case");
        if (matches.length === 1) component = matches[0];
      }
      current = join(current, component);
      const child = await metadata(current);
      if (child !== undefined && linked(child)) throw new StorageError("linked_target");
      if (child !== undefined && index < parts.length - 1 && !child.isDirectory()) {
        throw new StorageError("unsafe_parent");
      }
    }
    const remainder = relative(this.#root, current);
    if (isAbsolute(remainder) || remainder === ".." ||
        remainder.startsWith("../") || remainder.startsWith("..\\")) throw new StorageError("escaped_workspace");
    return current;
  }
  async #auditPath(filename = "index.jsonl", create = false) {
    let directory = await this.#target(".ans/events", true);
    if (create) {
      await fs.mkdir(directory, { recursive: true });
      directory = await this.#target(".ans/events", true);
    }
    const info = await metadata(directory);
    if (info !== undefined && !info.isDirectory()) throw new StorageError("audit_unavailable");
    const path = await this.#target(".ans/events/" + filename, true);
    const file = await metadata(path);
    if (file !== undefined && !file.isFile()) throw new StorageError("audit_unavailable");
    return path;
  }
  async #readEventFile(path) {
    if ((await metadata(path)) === undefined) return [];
    const content = await fs.readFile(path, "utf8");
    if (content !== "" && !content.endsWith("\n")) throw new StorageError("incomplete_audit_record");
    return content.split("\n").filter((line) => line !== "").map((line) => new Event(JSON.parse(line)));
  }
  async #readEvents() {
    const events = await this.#readEventFile(await this.#auditPath());
    const daily = new Map();
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      if (event.sequence !== index + 1 || !/^\d{4}-\d{2}-\d{2}T.*\+08:00$/.test(event.recordedAt) ||
          !Number.isFinite(Date.parse(event.recordedAt))) throw new StorageError("invalid_audit_sequence_or_time");
      const date = event.recordedAt.slice(0, 10);
      if (!daily.has(date)) daily.set(date, []);
      daily.get(date).push(event);
    }
    const directory = await this.#target(".ans/events", true);
    if ((await metadata(directory)) !== undefined) {
      const indexedNames = new Set([...daily.keys()].map((date) => date + ".jsonl"));
      for (const name of await fs.readdir(directory)) {
        if (name !== "index.jsonl" && !indexedNames.has(name)) throw new StorageError("unindexed_audit_file");
      }
    }
    for (const [date, expected] of daily) {
      const actual = await this.#readEventFile(await this.#auditPath(date + ".jsonl"));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new StorageError("daily_index_mismatch");
    }
    return Object.freeze(events);
  }
  async readEvents() {
    return await this.#lock(async () => {
      try { return await this.#readEvents(); }
      catch (error) { this.#shared.poisoned = true; throw new StorageError("audit_unavailable", { cause: error }); }
    });
  }
  async #append(event) {
    try {
      if (this.#closed || this.#authority === undefined) throw new StorageError("runtime_authority_required");
      if (this.#shared.poisoned || !(event instanceof Event)) throw new StorageError("audit_unavailable");
      const prior = await this.#readEvents();
      const recordedAt = timestamp();
      const recorded = new Event({ ...event, sequence: prior.length + 1, recordedAt });
      const line = JSON.stringify(recorded) + "\n";
      for (const path of [await this.#auditPath("index.jsonl", true), await this.#auditPath(recordedAt.slice(0, 10) + ".jsonl")]) {
        const handle = await fs.open(path, "a");
        try { await handle.writeFile(line, "utf8"); await handle.sync(); }
        finally { await handle.close(); }
      }
      return recorded;
    } catch (error) {
      this.#shared.poisoned = true;
      throw new StorageError("audit_unavailable", { cause: error });
    }
  }
  async appendEvents(events) {
    return await this.#lock(async () => {
      const recorded = [];
      for (const event of events) recorded.push(await this.#append(event));
      return Object.freeze(recorded);
    });
  }

  #prepareEdit(proposal, expectedIdentity) {
    let path;
    try { path = this.#targetSync(proposal.resource); }
    catch (error) {
      if (error.code === "ENOENT") throw new StorageError("edit_target_missing", { cause: error });
      throw error;
    }
    const before = nodeFs.lstatSync(path, { bigint: true });
    if (!before.isFile()) throw new StorageError("edit_target_not_file");
    if (before.size > 2097152n) throw new StorageError("edit_file_too_large");
    const identity = String(before.dev) + ":" + String(before.ino);
    if (expectedIdentity !== undefined && identity !== expectedIdentity) throw new StorageError("edit_source_changed");
    const descriptor = nodeFs.openSync(path, nodeFs.constants.O_RDONLY | nodeFs.constants.O_NOFOLLOW);
    let content;
    try {
      const opened = nodeFs.fstatSync(descriptor, { bigint: true });
      if (!opened.isFile() || ["dev", "ino", "size", "mtimeNs", "ctimeNs"].some((key) => opened[key] !== before[key])) {
        throw new StorageError("edit_source_changed");
      }
      const bytes = Buffer.alloc(Number(before.size) + 1);
      let count = 0;
      while (count < bytes.length) {
        const read = nodeFs.readSync(descriptor, bytes, count, bytes.length - count, count);
        if (read === 0) break;
        count += read;
      }
      const after = nodeFs.fstatSync(descriptor, { bigint: true });
      const current = nodeFs.lstatSync(this.#targetSync(proposal.resource), { bigint: true });
      if (count !== Number(before.size) || ["dev", "ino", "size", "mtimeNs", "ctimeNs"].some((key) =>
        before[key] !== after[key] || after[key] !== current[key])) throw new StorageError("edit_source_changed");
      const sha256 = createHash("sha256").update(bytes.subarray(0, count)).digest("hex");
      if (sha256 !== proposal.expectedSha256) throw new StorageError("edit_sha_mismatch");
      try { content = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, count)); }
      catch (error) { throw new StorageError("edit_invalid_utf8", { cause: error }); }
    } finally { nodeFs.closeSync(descriptor); }
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(content)) throw new StorageError("edit_binary_file");
    for (const replacement of proposal.replacements) {
      const first = content.indexOf(replacement.oldText);
      if (first === -1) throw new StorageError("edit_old_text_missing");
      if (content.indexOf(replacement.oldText, first + 1) !== -1) throw new StorageError("edit_ambiguous_old_text");
      content = content.slice(0, first) + replacement.newText + content.slice(first + replacement.oldText.length);
      if (Buffer.byteLength(content, "utf8") > 2097152) throw new StorageError("edit_file_too_large");
    }
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(content)) throw new StorageError("edit_binary_file");
    return Object.freeze({ content, contentDigest: createHash("sha256").update(content, "utf8").digest("hex"),
      identity });
  }

  #publicationBaseline(proposal,target) {
    if(proposal.expectedBaseline===undefined)return;
    const baseline=proposal.expectedBaseline;let stat;
    try{stat=nodeFs.lstatSync(target,{bigint:true});}catch(error){if(error.code!=="ENOENT")throw error;}
    if(baseline.state==="absent") {if(stat!==undefined)throw new StorageError("publication_baseline_changed");return;}
    if(stat===undefined || !stat.isFile() || stat.nlink!==1n || stat.size!==BigInt(baseline.byteLength) || stat.size>2097152n)throw new StorageError("publication_baseline_changed");
    if(baseline.executable!==undefined && ((stat.mode & 0o111n)!==0n)!==baseline.executable)throw new StorageError("publication_baseline_changed");
    const descriptor=nodeFs.openSync(target,nodeFs.constants.O_RDONLY|nodeFs.constants.O_NOFOLLOW);
    try {
      const before=nodeFs.fstatSync(descriptor,{bigint:true});const content=nodeFs.readFileSync(descriptor);const after=nodeFs.fstatSync(descriptor,{bigint:true});const path=nodeFs.lstatSync(target,{bigint:true});
      if(["dev","ino","size","mtimeNs","ctimeNs","nlink"].some(key=>stat[key]!==before[key] || before[key]!==after[key] || after[key]!==path[key]) || createHash("sha256").update(content).digest("hex")!==baseline.sha256)throw new StorageError("publication_baseline_changed");
    }finally{nodeFs.closeSync(descriptor);}
  }
  async delete(proposal,permit){return await this.#mutate(proposal,permit);}
  async write(proposal, permit) {
    return await this.#mutate(proposal, permit);
  }
  async edit(proposal, permit) {
    return await this.#mutate(proposal, permit);
  }
  async #mutate(proposal, permit) {
    let resource = ""; let proposalDigest = "";
    if (proposal instanceof ActionProposal) { resource = proposal.resource; proposalDigest = proposal.digest; }
    let contentDigest;
    const result = (status, reason, observedMutation = false, auditFailed = false) => {
      let success = false;
      if (["written","deleted"].includes(status)) success = true;
      const fields = { success, status, reason, resource, proposalDigest, observedMutation, auditFailed };
      if (contentDigest !== undefined && observedMutation) fields.contentDigest = contentDigest;
      if(observedMutation && proposal.action==="delete_file" && ["deleted","audit_failed"].includes(status)) {
        fields.missing=true;fields.tombstone={resource:proposal.resource,priorSha256:proposal.expectedBaseline.sha256,proposalDigest:proposal.digest};
      }
      return new MutationResult(fields);
    };
    if (this.#leaseContext === undefined) return result("denied", "lease_context_required");
    try { return await this.#commitLock(() => this.#lock(async () => {
      let receipt;
      try {
        if (!(proposal instanceof ActionProposal) || this.#closed || this.#authority === undefined) {
          return result("denied", "runtime_authority_required");
        }
        if (this.#shared.poisoned) return result("audit_failed", "audit_unavailable", false, true);
        this.#currentOwner(proposal);
        receipt = this.#authority.consume(proposal, permit, this.observeTime());
      } catch (error) {
        if (!(error instanceof TypeError)) throw error;
        return result("denied", "invalid_or_stale_authorization");
      }
      try {
        let editSource;
        try {
          this.#verify(proposal, receipt);
          const target = await this.#target(proposal.resource);
          const info = await metadata(target);
          if (info !== undefined && (!info.isFile() || (proposal.expectedBaseline!==undefined && info.nlink!==1))) throw new StorageError("target_not_file");
          this.#publicationBaseline(proposal,target);
          if (proposal.action === "edit_file") editSource = this.#prepareEdit(proposal);
        } catch (error) {
          if (error instanceof VerificationError) {
            this.#authority.release(receipt, { verificationFailure: error.reason });
            receipt = undefined;
            return result("denied", error.reason);
          }
          if (error instanceof TypeError) return result("denied", "authorization_changed");
          if (proposal.action === "edit_file" && error instanceof StorageError && editDenials.has(error.message)) {
            return result("denied", error.message);
          }
          return result("denied", "unsafe_target");
        }
        try { await this.#append(eventFor(proposal, "mutation_intent")); }
        catch (error) {
          if (!(error instanceof StorageError)) throw error;
          return result("audit_failed", "intent_audit_failed", false, true);
        }
        let temporary; let observed = false; let failure = ""; let denied = false;
        try {
          this.#verify(proposal, receipt);
          let target = await this.#target(proposal.resource);
          const info = await metadata(target);
          if (info !== undefined && (!info.isFile() || (proposal.expectedBaseline!==undefined && info.nlink!==1))) throw new StorageError("target_not_file");
          this.#publicationBaseline(proposal,target);
          let content = proposal.content;
          if(proposal.contentBase64!==undefined)content=Buffer.from(proposal.contentBase64,"base64");
          let prepared;
          if (proposal.action === "edit_file") {
            prepared = this.#prepareEdit(proposal, editSource.identity);
            content = prepared.content;
          }
          this.#verify(proposal, receipt);
          if(proposal.action==="delete_file") {
            target=this.#targetSync(proposal.resource);
            this.#publicationBaseline(proposal,target);this.#currentOwner(proposal);this.#authority.recheck(proposal,receipt,this.observeTime());
            nodeFs.unlinkSync(target);observed=true;contentDigest=proposal.contentDigest;
          } else {
          if (proposal.action !== "edit_file") await fs.mkdir(dirname(target), { recursive: true });
          target = await this.#target(proposal.resource);
          this.#verify(proposal, receipt);
          temporary = join(dirname(target), ".legion-write-" + randomUUID());
          const handle = await fs.open(temporary, "wx");
          try { await handle.writeFile(content, "utf8"); await handle.sync(); }
          finally { await handle.close(); }
          target = await this.#target(proposal.resource);
          this.#verify(proposal, receipt);
          target = this.#targetSync(proposal.resource, proposal.action === "edit_file");
          if (proposal.action === "edit_file") {
            const final = this.#prepareEdit(proposal, editSource.identity);
            if (final.contentDigest !== prepared.contentDigest) throw new StorageError("edit_source_changed");
          }
          this.#currentOwner(proposal);
    this.#authority.recheck(proposal, receipt, this.observeTime());
          this.#publicationBaseline(proposal,target);
          if(proposal.tool==="legion_shell_publish") {
            let mode=0o600;if(proposal.expectedBaseline.state==="present")mode=nodeFs.lstatSync(target).mode & 0o777;
            if(proposal.executable===true)mode|=0o100;else mode&=0o666;
            nodeFs.chmodSync(temporary,mode);
          }
          this.#currentOwner(proposal);this.#authority.recheck(proposal,receipt,this.observeTime());
          // No event-loop gap between the final authority check and the observed local commit.
          nodeFs.renameSync(temporary, target);
          temporary = undefined;
          observed = true;
          if (proposal.action === "edit_file") contentDigest = prepared.contentDigest;
          if(proposal.tool==="legion_shell_publish")contentDigest=proposal.contentDigest;
          }
        } catch (error) {
          failure = "write_failed";
          if (error instanceof TypeError) { denied = true; failure = "authorization_changed"; }
          if (error instanceof StorageError) {
            denied = true;
            failure = "unsafe_target";
            if(error.message==="publication_baseline_changed")failure=error.message;
            if (proposal.action === "edit_file" && editDenials.has(error.message)) failure = error.message;
          }
          if (error instanceof VerificationError) {
            denied = true; failure = error.reason;
            this.#authority.release(receipt, { verificationFailure: error.reason });
            receipt = undefined;
          }
        } finally {
          if (temporary !== undefined) {
            try { await fs.unlink(temporary); }
            catch (error) { failure = "write_failed_cleanup_failed"; }
          }
        }
        let kind = "mutation_failure";
        if (observed) kind = "mutation_success";
        try { await this.#append(eventFor(proposal, kind, failure, observed, contentDigest)); }
        catch (error) {
          if (!(error instanceof StorageError)) throw error;
          return result("audit_failed", "result_audit_failed", observed, true);
        }
        if(observed && proposal.action==="delete_file")return result("deleted","delete_completed",true);
        if (observed) return result("written", "write_completed", true);
        if (denied) return result("denied", failure);
        return result("failed", failure);
      } finally {
        if (receipt !== undefined) this.#authority.release(receipt);
      }
    })); } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      if (["lease_lost", "owner_catalog_mismatch", "owner_source_unavailable"].includes(error.message)) this.#authority.invalidateOwnership(error.message);
      return result("denied", error.message);
    }
  }
  async readFile(resource) {
    return await this.#lock(async () => {
      try { return await fs.readFile(await this.#target(resource), "utf8"); }
      catch (error) { throw new StorageError("read_failed", { cause: error }); }
    });
  }
  async close() {
    return await this.#lock(async () => {
      if (this.#closed) return;
      this.#closed = true;
      if (this.#temporary) {
        await this.#guardRoot();
        if (realpathSync(this.#root) !== this.#root || !relative(realpathSync(tmpdir()), this.#root).startsWith("legion-node-")) {
          throw new StorageError("unsafe_cleanup_target");
        }
        await fs.rm(this.#root, { recursive: true });
        if (this.#ownedState !== undefined) {
          if (realpathSync(this.#ownedState) !== this.#ownedState || !relative(realpathSync(tmpdir()), this.#ownedState).startsWith("legion-owner-state-")) throw new StorageError("unsafe_cleanup_target");
          await fs.rm(this.#ownedState, { recursive: true });
        }
      }
    });
  }
}
