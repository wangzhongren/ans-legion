import { PermissionRuntime } from "../pipelines/permission.mjs";

/** Trusted host façade. Agent instances expose immutable identity and lifecycle only. */
export function createRuntime(options) {
  const pipeline = new PermissionRuntime(options);
  return Object.freeze({
    prepare: (proposal) => pipeline.prepare(proposal), execute: (proposal, permit) => pipeline.execute(proposal, permit),
    submit: (proposal) => pipeline.submit(proposal), updateVersion: (version) => pipeline.updateVersion(version),
    updateBoundary: (boundary) => pipeline.updateBoundary(boundary), setTaskStatus: (taskId, status) => pipeline.setTaskStatus(taskId, status),
    events: () => pipeline.events(), readFile: (resource) => pipeline.readFile(resource), close: () => pipeline.close(),
    createAgent: async (options) => {
      const instance = await pipeline.createAgent(options);
      return Object.freeze({ ...instance, run: (options) => pipeline.runAgent(instance.instanceId, options),
        cancel: () => pipeline.cancelAgent(instance.instanceId), close: () => pipeline.closeAgent(instance.instanceId) });
    },
  });
}
