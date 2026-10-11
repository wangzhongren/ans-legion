import { exactObject } from '../../models/desktop.mjs';
/** read/write a single atomic governed document including queue and conversation timeline; snapshot exact readonly inputs; physical check configuration. write(document,workspace,expectedDigest,signal=null) checks cancellation immediately before atomic rename; rename start is the commit point, and later cancellation cannot claim rollback. */
export function organizationProviderOptions(value) {
  exactObject(value, ['userDataDir']);
  if (typeof value.userDataDir !== 'string' || !value.userDataDir) throw new TypeError('user_data_required');
  return Object.freeze({ userDataDir: value.userDataDir });
}

/** Shell Host IO: inventory(projectId,workspace,artifactScopes), shellConfiguration(projectId,workspace,roleId,planDigest), appendShellArchive(projectId,workspace,requestId,{stream,text,truncated}); lockRoot shared with Check, no receipt/source bytes in public DTO. */
