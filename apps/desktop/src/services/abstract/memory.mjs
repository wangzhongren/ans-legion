import { exactObject } from '../../models/desktop.mjs';
/** remember/query use trusted Host actor/registry/secrets separately from model payload; no peer Services.
 * Query returns current project facts from all authors; only the author revises/retracts.
 * inspect is a separate customer read: it computes stale status without committing a revision or accepting a model actor.
 * Registry is recomputed from actual Organization/Human/check state by the Host, never model data. */
export function memoryServiceOptions(options){exactObject(options,['userDataDir']);if(typeof options.userDataDir!=='string'||!options.userDataDir)throw new TypeError('user_data_required');return Object.freeze({userDataDir:options.userDataDir});}
