import {
  createProjectProvider
} from '../../providers/public/project.mjs';
import {
  projectServiceOptions
} from '../abstract/project.mjs';
import {
  identifier
} from '../../models/desktop.mjs';
import {
  WB_LIMITS,
  identityKey,
  projectDocument,
  catalogDocument,
  wbSuccess,
  wbFailure,
  wbCaught
} from '../../models/workbench.mjs';
export class ProjectServiceImpl {
  #provider;
  #tail = Promise.resolve();
  #closed = false;
  constructor(options, provider = null) {
    const checked = projectServiceOptions(options);
    this.#provider = provider ?? createProjectProvider(checked);
  }
  newId() {
    return this.#provider.newId();
  }
  now() {
    return this.#provider.now();
  }
  async catalog() {
    await this.#tail;
    if (this.#closed) return wbFailure('closed');
    const result = await this.#provider.read();
    if (!result.ok) return result;
    try {
      return wbSuccess(catalogDocument(result.value));
    } catch (error) {
      return wbCaught(error, 'project_corrupt');
    }
  }
  #mutate(action) {
    const pending = this.#tail.then(async () => {
      if (this.#closed) return wbFailure('closed'); try {
        const read = await this.#provider.read(); if (!read.ok) return read; return await action(catalogDocument(read.value));
      } catch (error) {
        return wbCaught(error, 'project_unavailable');
      }
    });
    this.#tail = pending.then(() => undefined);
    return pending;
  } select(path) {
    return this.#mutate(async (catalog) => {
      const described = await this.#provider.describeRoot(path); if (!described.ok) return described; const identity = described.value.workspaceIdentity; const id = identityKey(identity); let project = catalog.projects.find((item) => item.id === id); if (!project) {
        if (catalog.projects.length >= WB_LIMITS.projects) return wbFailure('project_unavailable'); project = projectDocument({
          schemaVersion: 1,
          id,
          name: described.value.name,
          workspaceIdentity: identity,
          organizationVersion: `customer-${id.slice(0, 16)}-v1`,
          manager: null,
          planRevision: 0,
          plan: null,
          context: {
            files: [],
            verifiedAt: null
          },
          tasks: []
        });
      } else {
        let plan = project.plan; if (plan && ['draft', 'confirmed', 'running'].includes(plan.status)) plan = {
          ...plan,
          status: 'invalidated'
        }; project = projectDocument({
          ...project,
          plan,
          tasks: project.tasks.map((task) => {
            if (['running', 'pending'].includes(task.status)) return {
              ...task,
              status: 'interrupted',
              updatedAt: this.now()
            }; return task;
          })
        });
      }
  const written = await this.#provider.write({
        ...catalog,
        projects: [...catalog.projects.filter((item) => item.id !== id),
        project]
      }, project.workspaceIdentity); if (!written.ok) return written; return wbSuccess(project);
    });
  } saveProject(raw) {
    return this.#mutate(async (catalog) => {
      const project = projectDocument(raw); if (!catalog.projects.some((item) => item.id === project.id)) return wbFailure('project_missing'); const written = await this.#provider.write({
        ...catalog,
        projects: catalog.projects.map((item) => {
          if (item.id === project.id) return project; return item;
        })
      }, project.workspaceIdentity); if (!written.ok) return written; return wbSuccess(project);
    });
  } setDefaultProfile(profileId) {
    return this.#mutate(async (catalog) => {
      identifier(profileId); const written = await this.#provider.write({
        ...catalog,
        defaultProfileId: profileId
      }); if (!written.ok) return written; return wbSuccess(profileId);
    });
  }
  async readContext(input) {
    if (this.#closed) return wbFailure('closed');
    return this.#provider.readContext(input);
  }
  async close() {
    this.#closed = true;
    await this.#tail;
    return this.#provider.close();
  }
}
