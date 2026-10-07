import { workspaceOptions } from '../abstract/workspace.mjs';
import { WorkspaceProviderImpl } from '../impl/workspace.mjs';

/**
 * Supported YAML is deliberately finite: root scalar/flow collections and
 * two-space block sequences of flow maps, nesting <=3, UTF-8, schema_version1.
 * Scalars: bounded quoted/bare strings, booleans, safe decimal integers, null.
 * No aliases/anchors/tags/directives, multiline values, duplicate/unknown keys,
 * arbitrary object construction or dependency on development YAML packages.
 * Project/current/role/boundary schemas each have a fixed field allowlist.
 * Known v003 GUI and v004 workbench boundary versions are checked against the
 * actual project/current organization version. Mismatches remain unavailable.
 */
export function createWorkspaceProvider(options) {
  const provider = new WorkspaceProviderImpl(workspaceOptions(options));
  return Object.freeze({ read: provider.read.bind(provider) });
}
