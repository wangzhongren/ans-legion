import { workspaceServiceOptions } from '../abstract/workspace.mjs';
import { WorkspaceServiceImpl } from '../impl/workspace.mjs';

export function createWorkspaceService(options) {
  const service = new WorkspaceServiceImpl(workspaceServiceOptions(options));
  return Object.freeze({ refresh: service.refresh.bind(service), observe: service.observe.bind(service), state: service.state.bind(service), close: service.close.bind(service) });
}
