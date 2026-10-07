import {
  projectProviderOptions
} from '../abstract/project.mjs';
import {
  ProjectProviderImpl
} from '../impl/project.mjs';
export function createProjectProvider(options) {
  const provider = new ProjectProviderImpl(projectProviderOptions(options));
  return Object.freeze(Object.fromEntries(['read', 'write', 'describeRoot', 'readContext', 'newId', 'now', 'close'].map((name) => [name, provider[name].bind(provider)])));
}
