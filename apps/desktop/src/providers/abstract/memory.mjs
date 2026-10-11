import { exactObject } from '../../models/desktop.mjs';
/** Private project memory persistence: read(project), write(document,project,expectedDigest,signal), newId,now,close.
 * Atomic CAS/no-follow filesystem effects only; never source-file or owner mutation. */
export function memoryProviderOptions(options){exactObject(options,['userDataDir']);if(typeof options.userDataDir!=='string'||!options.userDataDir)throw new TypeError('user_data_required');return Object.freeze({userDataDir:options.userDataDir});}
