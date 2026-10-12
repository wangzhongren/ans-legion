import { assertKnownKeyFree } from '../../models/workbench.mjs';
import { createProjectLeaseProvider } from '../../providers/public/project_lease.mjs';
import {
  createProjectProvider
} from '../../providers/public/project.mjs';
import {
  projectServiceOptions
} from '../abstract/project.mjs';
import {
  identifier
} from '../../models/desktop.mjs';
import { digestValue } from 'legion-runtime/workbench-models';
import {
  WB_LIMITS,
  identityKey,
  projectDocument, migrateLegacyProject,
  catalogDocument,
  wbSuccess,
  wbFailure,
  wbCaught
} from '../../models/workbench.mjs';
export class ProjectServiceImpl {
  #knownSecrets = new Set(); #provider; #leases; #held=new Map(); #viewCatalog=null; #legacyBaseDigest=null;
  #tail = Promise.resolve();
  #closed = false;
  constructor(options, provider = null) {
    const checked = projectServiceOptions(options);
    this.#provider = provider ?? createProjectProvider(checked); this.#leases=createProjectLeaseProvider({leaseRoot:checked.leaseRoot});
  }
  async #write(catalog,root,options){
    const acquired=[];
    try{
      let roots=catalog.projects.map(item=>item.workspaceIdentity);if(root)roots=[root];
      for(const item of roots){const project=catalog.projects.find(p=>p.workspaceIdentity.deviceId===item.deviceId&&p.workspaceIdentity.fileId===item.fileId);if(!project)throw new Error('project_missing');if(!this.#held.has(project.id)){const lease=await this.#leases.acquire(item.canonicalPath);if(!lease.ok)return lease;this.#held.set(project.id,lease.value);acquired.push(project.id);}}
      if(this.#legacyBaseDigest && !options.confirmMigration){this.#viewCatalog=catalog;return wbSuccess(catalog);}
      const written=await this.#provider.write(assertKnownKeyFree(catalog,this.#knownSecrets),root,{...options,knownSecrets:[...this.#knownSecrets]});if(written.ok){this.#viewCatalog=null;this.#legacyBaseDigest=null;}return written;
    }finally{for(const id of acquired){const lease=this.#held.get(id);const released=await this.#leases.release(lease);if(released.ok)this.#held.delete(id);else throw new Error(released.error.code);}}
  }
  async acquireExecution(project){
    if(this.#closed)return wbFailure('closed');
    if(!this.#held.has(project.id)){const result=await this.#leases.acquire(project.workspaceIdentity.canonicalPath);if(!result.ok)return result;this.#held.set(project.id,result.value);}
    const checked=await this.#leases.assertCurrent(this.#held.get(project.id));if(!checked.ok)return checked;
    return this.#provider.executionContext(project.workspaceIdentity);
  }
  async releaseExecution(project){const handle=this.#held.get(project.id);if(!handle)return wbSuccess(null);const result=await this.#leases.release(handle);if(result.ok)this.#held.delete(project.id);return result;}
  async assertExecution(project){const lease=this.#held.get(project.id);if(!lease)return wbFailure('lease_lost');const current=await this.#leases.assertCurrent(lease);if(!current.ok)return current;const source=await this.#provider.assertOwnerSource(project);if(source.ok&&source.value===null)return wbFailure('owner_catalog_mismatch');return source;}
  async ownerSource(project){try{return wbSuccess(await this.#provider.ownerSource(project));}catch(error){return wbCaught(error,'owner_catalog_mismatch');}}
  migrationPending(){return this.#legacyBaseDigest!==null;}
  async bindOwnerSource(project){const lease=await this.acquireExecution(project);if(!lease.ok)return lease;return this.#provider.assertOwnerSource(project,true);}
  newId() {
    return this.#provider.newId();
  }
  now() {
    return this.#provider.now();
  }
  async stageImage(project,input){if(this.#closed)return wbFailure('closed');return this.#provider.stageImage(project,input);}
  async readImage(project,ref){if(this.#closed)return wbFailure('closed');return this.#provider.readImage(project,ref);}
  async discardImage(project,ref,referenced){if(this.#closed)return wbFailure('closed');if(referenced)return wbFailure('image_referenced');return this.#provider.discardImage(project,ref);}
  async pruneImages(project,protectedIds){if(this.#closed)return wbFailure('closed');return this.#provider.pruneImages(project,protectedIds);}
  async catalog(knownSecrets = []) {
    for (const key of knownSecrets) this.#knownSecrets.add(key);
    await this.#tail;
    if (this.#closed) return wbFailure('closed');
    const result = await this.#provider.read([...this.#knownSecrets]);
    if (!result.ok) return result;
    try {
      return wbSuccess(this.#viewCatalog??catalogDocument(result.value));
    } catch (error) {
      return wbCaught(error, 'project_corrupt');
    }
  }
  #mutate(action) {
    const pending = this.#tail.then(async () => {
      if (this.#closed) return wbFailure('closed'); try {
        const read = await this.#provider.read([...this.#knownSecrets]); if (!read.ok) return read;
        const original=catalogDocument(read.value);let catalog=original; if(original.schemaVersion===1){const digest=digestValue(original);if(this.#legacyBaseDigest && this.#legacyBaseDigest!==digest)return wbFailure('catalog_changed');this.#legacyBaseDigest=digest;catalog=this.#viewCatalog??catalogDocument({...original,schemaVersion:2,projects:original.projects.map(migrateLegacyProject)});}return await action(catalog,digestValue(original));
      } catch (error) {
        return wbCaught(error, 'project_unavailable');
      }
    });
    this.#tail = pending.then(() => undefined);
    return pending;
  } select(path, knownSecrets = []) {
    for (const key of knownSecrets) this.#knownSecrets.add(key);
    assertKnownKeyFree(path, this.#knownSecrets);
    return this.#mutate(async (catalog, expectedCatalogDigest) => {
      const described = await this.#provider.describeRoot(path); if (!described.ok) return described; const identity = described.value.workspaceIdentity; const id = identityKey(identity); let project = catalog.projects.find((item) => item.id === id); if (!project) {
        if (catalog.projects.length >= WB_LIMITS.projects) return wbFailure('project_unavailable'); project = projectDocument({
          schemaVersion: 2,
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
        if(project.schemaVersion===1)project=migrateLegacyProject(project);
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
  const written = await this.#write({
        ...catalog,
        projects: [...catalog.projects.filter((item) => item.id !== id),
        project]
      }, project.workspaceIdentity, { expectedCatalogDigest }); if (!written.ok) return written; return wbSuccess(project);
    });
  } saveProject(raw, options = {}) {
    return this.#mutate(async (catalog, expectedCatalogDigest) => {
      for (const key of options.knownSecrets ?? []) this.#knownSecrets.add(key);
      const project = assertKnownKeyFree(projectDocument(raw), this.#knownSecrets);
      const stored = catalog.projects.find((item) => item.id === project.id);
      if (!stored) return wbFailure('project_missing');
      const expected = options.expectedFileOwnersDigest ?? project.fileOwners.digest;
      if (stored.fileOwners.digest !== expected) return wbFailure('stale_file_owners');
      const written = await this.#write({
        ...catalog,
        projects: catalog.projects.map((item) => {
          if (item.id === project.id) return project; return item;
        })
      }, project.workspaceIdentity, { expectedCatalogDigest,
        ownerExpectation: { projectId: project.id, digest: expected },confirmMigration:Boolean(options.confirmMigration),bindOwnerSource:Boolean(options.bindOwnerSource) });
      if (!written.ok) return written; return wbSuccess(project);
    });
  } setDefaultProfile(profileId) {
    return this.#mutate(async (catalog, expectedCatalogDigest) => {
      identifier(profileId); const written = await this.#write({
        ...catalog,
        defaultProfileId: profileId
      }, null, { expectedCatalogDigest }); if (!written.ok) return written; return wbSuccess(profileId);
    });
  }
  async readContext(input) {
    if (this.#closed) return wbFailure('closed');
    return this.#provider.readContext(input);
  }
  async close() {
    this.#closed = true;
    await this.#tail;
    const leases=await this.#leases.close();if(!leases.ok)return leases;this.#held.clear();this.#knownSecrets.clear();return this.#provider.close();
  }
}
