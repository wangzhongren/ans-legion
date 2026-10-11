import { digestValue } from 'legion-runtime/workbench-models';
import {
  exactObject,
  projectIdentifier
} from '../../models/desktop.mjs';
import {
  workspaceIdentity,
  historyDocument,
  wbSuccess,
  wbFailure,
  wbCaught
} from '../../models/workbench.mjs';
import {
  createHistoryProvider
} from '../../providers/public/history.mjs';
import {
  historyServiceOptions
} from '../abstract/history.mjs';
export class HistoryServiceImpl {
  #provider;
  #tail = Promise.resolve();
  #closed = false;
  #digests = new Map();
  constructor(options, provider = null) {
    const checked = historyServiceOptions(options);
    this.#provider = provider ?? createHistoryProvider(checked);
  }
  async load(input) {
    await this.#tail;
    try {
      if (this.#closed) return wbFailure('closed');
      exactObject(input, ['projectId', 'workspaceIdentity']);
      const root = workspaceIdentity(input.workspaceIdentity);
      const read = await this.#provider.read(projectIdentifier(input.projectId), root);
      if (!read.ok) return read;
      this.#digests.set(input.projectId, digestValue(read.value));
      return wbSuccess(historyDocument(read.value).history);
    } catch (error) {
      return wbCaught(error, 'history_corrupt');
    }
  } save(input) {
    const pending = this.#tail.then(async () => {
      try {
        if (this.#closed) return wbFailure('closed'); exactObject(input, ['projectId', 'workspaceIdentity', 'history']); const root = workspaceIdentity(input.workspaceIdentity); const document = historyDocument({
          schemaVersion: 1,
          projectId: input.projectId,
          roleId: 'ProjectManager',
          history: input.history
        }); let expectedDigest = this.#digests.get(document.projectId);
        if (expectedDigest === undefined) { const read = await this.#provider.read(document.projectId, root); if (!read.ok) return read; expectedDigest = digestValue(read.value); }
        const result = await this.#provider.write(document, root, { expectedDigest }); if (!result.ok) return result; this.#digests.set(document.projectId, digestValue(document)); return wbSuccess(document.history);
      } catch (error) {
        return wbCaught(error, 'history_corrupt');
      }
    });
    this.#tail = pending.then(() => undefined);
    return pending;
  }
  async close() {
    this.#closed = true;
    await this.#tail;
    return this.#provider.close();
  }
}
