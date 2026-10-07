import { workspaceServiceOptions } from '../abstract/workspace.mjs';
import { createWorkspaceProvider } from '../../providers/public/workspace.mjs';
import { LIMITS, TASK_STATES, exactObject, assignmentDTO, workspaceDTO, emptyWorkspace, success, failure, validationFailure } from '../../models/desktop.mjs';
import { observationDTO } from '../../models/workbench.mjs';

const RUN_STATES = Object.freeze({ agent_run_started: 'running', agent_run_completed: 'completed', agent_run_cancelled: 'cancelled', agent_run_failed: 'failed' });
const RECORDED_TYPES = Object.freeze(['agent_instance_created', 'agent_task_cancelled', 'agent_run_event', 'mutation_intent', 'mutation_success', 'mutation_failure', 'mutation_denied', 'proposal', 'decision']);

function auditProjection(event, organization, roles) {
  let status = 'unavailable';
  if (event.organizationVersion === organization.version) {
    if (event.format === 'governance' && event.eventType === 'OrganizationChange' && event.result === 'ACCEPTED_AND_RECORDED') status = 'recorded';
    if (event.format === 'runtime' && roles.has(event.roleId)) {
      if (Object.hasOwn(RUN_STATES, event.eventType)) status = RUN_STATES[event.eventType];
      else if (RECORDED_TYPES.includes(event.eventType)) status = 'recorded';
    }
  }
  return { id: event.id, format: event.format, organizationVersion: event.organizationVersion, status, eventType: event.eventType, roleId: event.roleId, taskId: event.taskId, updatedAt: event.updatedAt };
}

function graphValid(roles) {
  const map = new Map(roles.map((role) => [role.id, role.reportsTo]));
  if (map.size !== roles.length) return false;
  for (const role of roles) {
    const seen = new Set();
    let current = role.id;
    while (current !== 'Human') {
      if (seen.has(current) || !map.has(current)) return false;
      seen.add(current);
      current = map.get(current);
    }
  }
  return true;
}

/** Internal constructor allows lower-layer doubles for focused unit tests only. */
export class WorkspaceServiceImpl {
  #provider;
  #current = emptyWorkspace();
  #lastValid = null;
  #closed = false;
  #tail = Promise.resolve();
  constructor(options, provider = null) {
    const checked = workspaceServiceOptions(options);
    this.#provider = provider;
    if (!provider) this.#provider = createWorkspaceProvider(checked);
  }
  state() { return this.#current; }
  close() { this.#closed = true; return success(null); }

  #unavailable(sources, errors, observedAt, assignments = []) {
    let previous = emptyWorkspace();
    let lastValidAt = null;
    if (this.#lastValid) { previous = this.#lastValid; lastValidAt = previous.observedAt; }
    const roles = previous.roles.map((role) => {
      let profileId = null;
      const mapping = assignments.find((item) => item.projectId === previous.project?.id && item.roleId === role.id);
      if (mapping) profileId = mapping.profileId;
      return { ...role, profileId };
    });
    if (!errors.length) errors = [{ code: 'workspace_corrupt' }];
    this.#current = observationDTO({ workspace: { ...previous, roles, status: 'unavailable', sources, errors, observedAt, lastValidAt } });
    return success(this.#current);
  }

  async refresh(options = {}) {
    const result = await this.observe(options); if (!result.ok) return result;
    try { return success(workspaceDTO(result.value)); } catch { return failure('workspace_corrupt'); }
  }
  observe(options = {}) {
    let assignments;
    try {
      exactObject(options, ['assignments', 'force']);
      if (options.force !== undefined && typeof options.force !== 'boolean') return Promise.resolve(failure('invalid_input'));
      assignments = options.assignments ?? [];
      if (!Array.isArray(assignments) || assignments.length > LIMITS.assignments) return Promise.resolve(failure('invalid_input'));
      assignments = assignments.map(assignmentDTO);
    } catch (error) { return Promise.resolve(validationFailure(error)); }
    const pending = this.#tail.then(async () => {
      if (this.#closed) return failure('closed');
      let data;
      try {
        const result = await this.#provider.read({ force: options.force === true });
        if (!result.ok) return this.#unavailable([], [{ code: result.error?.code }], null, assignments);
        data = result.value;
        if (this.#closed) return failure('closed');
        const critical = !data.project || !data.organization || !graphValid(data.roles) || data.sources.some((source) => ['organization', 'role', 'boundary'].includes(source.kind) && source.status !== 'available');
        if (critical) return this.#unavailable(data.sources, data.errors, data.observedAt, assignments);
        const ids = new Set(data.roles.map((role) => role.id));
        const selected = new Map();
        for (const assignment of assignments) if (assignment.projectId === data.project.id && ids.has(assignment.roleId)) selected.set(assignment.roleId, assignment.profileId);
        const roles = data.roles.map((role) => ({ ...role, profileId: selected.get(role.id) ?? null }));
        const tasks = data.tasks.map((task) => {
          if (!TASK_STATES.includes(task.status)) throw new TypeError('Unsupported record state');
          let reason = '';
          if (task.hasReason) reason = '任务记录包含原因；详细内容未在面板展开。';
          return { taskId: task.taskId, nodeId: task.nodeId, roleId: task.roleId, status: task.status, reason, updatedAt: task.updatedAt };
        });
        const audits = data.audits.map((event) => auditProjection(event, data.organization, ids));
        this.#current = observationDTO({ workspace: { status: 'available', project: data.project, organization: data.organization, roles, tasks, audits, sources: data.sources, errors: data.errors, observedAt: data.observedAt, lastValidAt: data.observedAt } });
        this.#lastValid = this.#current;
        return success(this.#current);
      } catch {
        let sources = [];
        let observedAt = null;
        if (data) { sources = data.sources; observedAt = data.observedAt; }
        try { return this.#unavailable(sources, [{ code: 'workspace_corrupt' }], observedAt, assignments); }
        catch { return this.#unavailable([], [{ code: 'workspace_corrupt' }], null, assignments); }
      }
    });
    this.#tail = pending.then(() => undefined);
    return pending;
  }
}
