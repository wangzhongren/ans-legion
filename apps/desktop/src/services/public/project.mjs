import {
  projectServiceOptions
} from '../abstract/project.mjs';
import {
  ProjectServiceImpl
} from '../impl/project.mjs';
export function createProjectService(options) {
  const service = new ProjectServiceImpl(projectServiceOptions(options));
  return Object.freeze(Object.fromEntries(['migrationPending','acquireExecution','releaseExecution','assertExecution','ownerSource','bindOwnerSource','catalog', 'select', 'saveProject', 'setDefaultProfile', 'readContext', 'stageImage','readImage','discardImage','pruneImages','newId', 'now', 'close'].map((name) => [name, service[name].bind(service)])));
}
