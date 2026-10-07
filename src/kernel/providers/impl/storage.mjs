import { promises as fs, lstatSync, realpathSync, mkdtempSync } from "node:fs";
import nodeFs from "node:fs";
import { resolve, join, dirname, relative, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { StorageProvider, StorageError } from "../abstract/storage.mjs";
import { ActionProposal, MutationResult, Event, normalizeResource, modelRecord, modelString,
  _isRuntimeAuthority } from "../../models/core.mjs";
import { MutationVerification, isWorkbenchMutationAuthority } from "../../models/workbench.mjs";

// Coordination is local to this process and keyed by the resolved workspace, across Runtime instances.
const workspaces = new Map();
class VerificationError extends StorageError {
  constructor(reason, cause) { super(reason, { cause }); this.reason = reason; }
}
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
function eventFor(proposal, kind, reason = "", observedMutation = false) {
  return new Event({ kind, roleId: proposal.session.roleId, taskId: proposal.session.taskId,
    organizationVersion: proposal.session.organizationVersion, resource: proposal.resource,
    proposalDigest: proposal.digest, correlationId: proposal.proposalId, reason, observedMutation });
}
function timestamp() { return new Date(Date.now() + 8 * 3600000).toISOString().replace("Z", "+08:00"); }

export class _LocalStorageProvider extends StorageProvider {
  #root; #authority; #shared; #closed = false; #temporary = false;
  constructor(options = {}) {
    super();
    modelRecord(options, "storage options", ["workspace", "_authority", "authority"]);
    if (options.authority !== undefined && options._authority !== undefined) {
      throw new TypeError("authority_inputs_conflict");
    }
    if (options.authority !== undefined && !isWorkbenchMutationAuthority(options.authority)) {
      throw new TypeError("branded_workbench_authority_required");
    }
    let workspace = options.workspace;
    if (workspace === undefined || workspace === null) {
      workspace = mkdtempSync(join(tmpdir(), "legion-node-"));
      this.#temporary = true;
    }
    const root = resolve(modelString(workspace, "workspace"));
    for (const component of ancestors(root)) {
      const info = lstatSync(component);
      if (linked(info) || !info.isDirectory()) throw new StorageError("invalid_workspace");
    }
    this.#root = realpathSync(root);
    if (_isRuntimeAuthority(options._authority)) this.#authority = options._authority;
    if (isWorkbenchMutationAuthority(options.authority)) this.#authority = options.authority;
    const key = this.#root.toLowerCase();
    if (!workspaces.has(key)) workspaces.set(key, { tail: Promise.resolve(), poisoned: false });
    this.#shared = workspaces.get(key);
    Object.freeze(this);
  }

  workspace() { return this.#root; }
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
        if (error.code !== "ENOENT" || mustExist || index !== parts.length - 1) throw error;
      }
      if (child !== undefined && linked(child)) throw new StorageError("linked_target");
      if (child !== undefined && index === parts.length - 1 && !child.isFile()) {
        throw new StorageError("target_not_file");
      }
    }
    return current;
  }
  #verify(proposal, receipt) {
    const verification = this.#authority.recheck(proposal, receipt);
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
    this.#authority.recheck(proposal, receipt);
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

  async write(proposal, permit) {
    let resource = ""; let proposalDigest = "";
    if (proposal instanceof ActionProposal) { resource = proposal.resource; proposalDigest = proposal.digest; }
    const result = (status, reason, observedMutation = false, auditFailed = false) => {
      let success = false;
      if (status === "written") success = true;
      return new MutationResult({ success, status, reason, resource, proposalDigest, observedMutation, auditFailed });
    };
    return await this.#lock(async () => {
      let receipt;
      try {
        if (!(proposal instanceof ActionProposal) || this.#closed || this.#authority === undefined) {
          return result("denied", "runtime_authority_required");
        }
        if (this.#shared.poisoned) return result("audit_failed", "audit_unavailable", false, true);
        receipt = this.#authority.consume(proposal, permit);
      } catch (error) {
        if (!(error instanceof TypeError)) throw error;
        return result("denied", "invalid_or_stale_authorization");
      }
      try {
        try {
          this.#verify(proposal, receipt);
          const target = await this.#target(proposal.resource);
          const info = await metadata(target);
          if (info !== undefined && !info.isFile()) throw new StorageError("target_not_file");
        } catch (error) {
          if (error instanceof VerificationError) {
            this.#authority.release(receipt, { verificationFailure: error.reason });
            receipt = undefined;
            return result("denied", error.reason);
          }
          if (error instanceof TypeError) return result("denied", "authorization_changed");
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
          if (info !== undefined && !info.isFile()) throw new StorageError("target_not_file");
          this.#verify(proposal, receipt);
          await fs.mkdir(dirname(target), { recursive: true });
          target = await this.#target(proposal.resource);
          this.#verify(proposal, receipt);
          temporary = join(dirname(target), ".legion-write-" + randomUUID());
          const handle = await fs.open(temporary, "wx");
          try { await handle.writeFile(proposal.content, "utf8"); await handle.sync(); }
          finally { await handle.close(); }
          target = await this.#target(proposal.resource);
          this.#verify(proposal, receipt);
          target = this.#targetSync(proposal.resource, false);
          this.#authority.recheck(proposal, receipt);
          // No event-loop gap between the final authority check and the observed local commit.
          nodeFs.renameSync(temporary, target);
          temporary = undefined;
          observed = true;
        } catch (error) {
          failure = "write_failed";
          if (error instanceof TypeError) { denied = true; failure = "authorization_changed"; }
          if (error instanceof StorageError) { denied = true; failure = "unsafe_target"; }
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
        try { await this.#append(eventFor(proposal, kind, failure, observed)); }
        catch (error) {
          if (!(error instanceof StorageError)) throw error;
          return result("audit_failed", "result_audit_failed", observed, true);
        }
        if (observed) return result("written", "write_completed", true);
        if (denied) return result("denied", failure);
        return result("failed", failure);
      } finally {
        if (receipt !== undefined) this.#authority.release(receipt);
      }
    });
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
        if (realpathSync(this.#root) !== this.#root || !relative(resolve(tmpdir()), this.#root).startsWith("legion-node-")) {
          throw new StorageError("unsafe_cleanup_target");
        }
        await fs.rm(this.#root, { recursive: true });
      }
    });
  }
}
