import { createProfilesService } from '../services/public/profiles.mjs';
import { createWorkspaceService } from '../services/public/workspace.mjs';
import { exactObject, operationInput, desktopDTO, emptyWorkspace, safeError, success, failure, validationFailure } from '../models/desktop.mjs';

/** Production creation accepts only plain options; Services remain private. */
export function createDesktopPipeline(options) { return new _DesktopPipeline(options); }

/** Internal constructor's adjacent Service doubles are for focused tests. */
export class _DesktopPipeline {
  #profiles;
  #workspace = null;
  #workspaceFactory;
  #closed = false;
  #tail = Promise.resolve();
  #state = desktopDTO({ profiles: [], assignments: [], workspace: emptyWorkspace(), probe: { status: 'idle' } });
  constructor(options, services = null) {
    exactObject(options, ['userDataDir']);
    if (typeof options.userDataDir !== 'string' || !options.userDataDir) throw new TypeError('Invalid userDataDir');
    this.#workspaceFactory = createWorkspaceService;
    if (services) { this.#profiles = services.profiles; this.#workspaceFactory = services.createWorkspace; }
    else this.#profiles = createProfilesService({ userDataDir: options.userDataDir });
  }
  #serial(action) {
    const pending = this.#tail.then(async () => {
      if (this.#closed) return failure('closed');
      try { return await action(); }
      catch { return failure('internal_error'); }
    });
    this.#tail = pending.then(() => undefined);
    return pending;
  }
  async #snapshot(refresh) {
    const profiles = await this.#profiles.list();
    let fields = { profiles: this.#state.profiles, assignments: this.#state.assignments };
    let error = null;
    if (profiles.ok) fields = profiles.value;
    else error = safeError(profiles.error?.code);
    let workspace = this.#state.workspace;
    if (this.#workspace) {
      if (refresh) {
        const result = await this.#workspace.refresh({ assignments: fields.assignments });
        if (result.ok) workspace = result.value;
        else error = safeError(result.error?.code);
      } else workspace = this.#workspace.state();
    }
    const probe = this.#profiles.getProbeState();
    let probeState = this.#state.probe;
    if (probe.ok) probeState = probe.value;
    else error = safeError(probe.error?.code);
    this.#state = desktopDTO({ ...fields, workspace, probe: probeState, error });
    return success(this.#state);
  }
  getState() { return this.#serial(() => this.#snapshot(true)); }
  refreshProject() { return this.getState(); }
  selectProject(workspaceRoot) {
    if (typeof workspaceRoot !== 'string' || !workspaceRoot || workspaceRoot.length > 32767) return Promise.resolve(failure('invalid_input'));
    return this.#serial(async () => {
      const previous = this.#workspace;
      this.#workspace = this.#workspaceFactory({ workspaceRoot });
      if (previous) previous.close();
      return this.#snapshot(true);
    });
  }
  #input(operation, value) { return operationInput(operation, value); }
  saveProfile(value) {
    const input = this.#input('saveProfile', value);
    if (!input.ok) return Promise.resolve(input);
    return this.#serial(async () => {
      const result = await this.#profiles.save(input.value);
      if (!result.ok) return failure(result.error?.code, result.error?.field);
      return this.#snapshot(true);
    });
  }
  deleteProfile(value) {
    const input = this.#input('deleteProfile', value);
    if (!input.ok) return Promise.resolve(input);
    return this.#serial(async () => {
      const result = await this.#profiles.delete(input.value.id);
      if (!result.ok) return failure(result.error?.code);
      return this.#snapshot(true);
    });
  }
  assignProfile(value) {
    const input = this.#input('assignProfile', value);
    if (!input.ok) return Promise.resolve(input);
    return this.#serial(async () => {
      const state = await this.#snapshot(true);
      if (!state.ok) return state;
      const { workspace } = state.value;
      if (workspace.status !== 'available' || !workspace.project || !workspace.roles.some((role) => role.id === input.value.roleId)) return failure('workspace_unavailable');
      const result = await this.#profiles.assign({ projectId: workspace.project.id, ...input.value });
      if (!result.ok) return failure(result.error?.code);
      return this.#snapshot(true);
    });
  }
  async testConnection(value) {
    const input = this.#input('testConnection', value);
    if (!input.ok) return input;
    if (this.#closed) return failure('closed');
    try {
      const result = await this.#profiles.testConnection(input.value.profileId);
      if (!result.ok) return failure(result.error?.code);
      return result;
    } catch { return failure('internal_error'); }
  }
  cancelProbe(value) {
    const input = this.#input('cancelProbe', value);
    if (!input.ok) return input;
    if (this.#closed) return failure('closed');
    try { return this.#profiles.cancelProbe(input.value.probeId); }
    catch (error) { return validationFailure(error); }
  }
  async close() {
    if (this.#closed) return success(null);
    this.#closed = true;
    const result = this.#profiles.close();
    if (this.#workspace) this.#workspace.close();
    await this.#tail;
    if (!result.ok) return failure(result.error?.code);
    return success(null);
  }
}
