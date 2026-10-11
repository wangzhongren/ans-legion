import { MutationService, MutationError } from "../abstract/mutation.mjs";
import { createStorageProvider, StorageError } from "../../providers/public/storage.mjs";
export class _MutationService extends MutationService {
  #storage;
  constructor(options) { super(); this.#storage = createStorageProvider(options); Object.freeze(this); }
  observeTime(){return this.#storage.observeTime();}
  async execute(proposal, permit) {
    if(proposal?.action==="delete_file")return await this.#storage.delete(proposal,permit);
    if (proposal?.action === "edit_file") return await this.#storage.edit(proposal, permit);
    return await this.#storage.write(proposal, permit);
  }
  async recordEvents(events) {
    try { return await this.#storage.appendEvents(events); }
    catch (error) {
      if (!(error instanceof StorageError)) throw error;
      throw new MutationError("audit_unavailable", { cause: error });
    }
  }
  async events() {
    try { return await this.#storage.readEvents(); }
    catch (error) {
      if (!(error instanceof StorageError)) throw error;
      throw new MutationError("audit_unavailable", { cause: error });
    }
  }
  async readFile(resource) {
    try { return await this.#storage.readFile(resource); }
    catch (error) {
      if (!(error instanceof StorageError)) throw error;
      throw new MutationError("read_failed", { cause: error });
    }
  }
  createIdentity() { return this.#storage.createIdentity(); }
  workspace() { return this.#storage.workspace(); }
  async close() { await this.#storage.close(); }
}
