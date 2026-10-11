/** Persistent organization values and invariant-preserving transitions. No infrastructure effects. */
import { digestValue, normalizeResource, normalizeProjectReadResource } from 'legion-runtime/workbench-models';
import { exactObject, identifier, projectIdentifier, textValue, immutable, DesktopValidationError } from './desktop.mjs';

export const FIXED_ROLE_DUTIES = immutable({
  ProjectManager: '讨论需求、审批角色提案、形成计划、安排原角色返修并汇报真实结果',
  RoleArchitect: '拟定职责、接口和精确边界；只发布已批准的角色治理文档',
  Acceptance: '独立验证跨角色和完整流程；只维护自己的测试、夹具和报告',
  Supervisor: '客户连续对话入口，自主读取项目与工作事实、委托后台PM并独立预检与监督；不签发许可或改变任务与归属'
});
const EXPECTED = immutable({
  object: 'object with only the declared role fields', identifier: 'nonempty identifier string, up to 128 characters',
  name: 'nonempty display name string, up to 100 characters', purpose: 'responsibility string, up to 4000 characters; descriptions belong here, not boundary',
  interfaces: 'array of up to 32 nonempty interface-description strings, each up to 1000 characters', boundary: 'array of exact project-relative file strings; no description, colon, glob or directory grant',
  resource: 'exact project-relative file string; no description/colon, absolute path, glob, trailing slash, control or credential path',
  documents: 'array of up to 32 document objects: resource, contentDigest, summary; use [] when no actual prepared document',
  document: 'object containing only resource, contentDigest and summary', documentPath: 'exact file under docs/roles/{this role id}/',
  digest: '64 lowercase hexadecimal SHA-256 string of the actual UTF-8 document content', summary: 'nonempty document-summary string, up to 2000 characters',
  revision: 'integer revision; new role 1, changed existing role current revision + 1', enabled: 'boolean enabled', status: 'role status system, approved or legacy; proposed changes use approved',
  fixed: 'fixed system duty must equal its current purpose and remain enabled', array: 'array within the existing collection budget'
});
export class OrganizationValidationError extends Error {
  constructor(code = 'invalid_organization', field = '', expected = '') { super(code); this.code = code; this.field = field; this.expected = expected; }
}
function fail(code, field = '', expected = '') { throw new OrganizationValidationError(code, field, expected); }
function checked(field, expected, action) {
  try { return action(); }
  catch (error) {
    if (error instanceof OrganizationValidationError) { if (!error.field) { error.field = field; error.expected = expected; } throw error; }
    if (error instanceof DesktopValidationError) fail('invalid_role_field', field, expected);
    throw error;
  }
}
/** Only safe first-party field coordinates and static expectations, never rejected values. */
export function organizationValidationDiagnostic(error) {
  if (!(error instanceof OrganizationValidationError) || !Object.values(EXPECTED).includes(error.expected) || typeof error.field !== 'string' || error.field.length > 160 || !/^(?:members|transfers|id|version)(?:\[\d{1,4}\]|\.(?:id|name|purpose|interfaces|boundary|documents|revision|enabled|status|resource|contentDigest|summary|fromRoleId|toRoleId))*$/u.test(error.field)) return null;
  if (!/^[a-z][a-z0-9_]{0,79}$/u.test(error.code)) return null;
  return immutable({ code: error.code, field: error.field, expected: error.expected });
}
function list(value, max = 4096) { if (!Array.isArray(value) || value.length > max) fail('organization_budget'); return value; }
function revision(value, minimum = 0) { if (!Number.isSafeInteger(value) || value < minimum) fail('invalid_revision'); return value; }
function sha(value) { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) fail('invalid_digest'); return value; }
function resource(value, field = '') {
  if (typeof value !== 'string' || !value.trim()) fail('invalid_role_resource', field, EXPECTED.resource);
  try { return normalizeProjectReadResource(normalizeResource(value)); }
  catch (error) { if (error instanceof TypeError && ['absolute_resource', 'invalid_component', 'reserved_component', 'control_plane', 'restricted_resource'].includes(error.message)) fail('invalid_role_resource', field, EXPECTED.resource); throw error; }
}
function files(value, field = '') {
  const source = checked(field, EXPECTED.boundary, () => list(value)); const result = source.map((item, index) => resource(item, field + '[' + index + ']')).sort();
  if (new Set(result.map((path) => path.toLowerCase())).size !== result.length) fail('duplicate_resource', field, EXPECTED.boundary); return result;
}
function documents(value, roleId, field = '') {
  const source = checked(field, EXPECTED.documents, () => list(value, 32)); const result = source.map((item, index) => {
    const prefix = field + '[' + index + ']'; checked(prefix, EXPECTED.document, () => exactObject(item, ['resource', 'contentDigest', 'summary']));
    const path = resource(item.resource, prefix + '.resource'); if (!path.startsWith(`docs/roles/${roleId}/`)) fail('invalid_role_document', prefix + '.resource', EXPECTED.documentPath);
    return { resource: path, contentDigest: checked(prefix + '.contentDigest', EXPECTED.digest, () => sha(item.contentDigest)), summary: checked(prefix + '.summary', EXPECTED.summary, () => textValue(item.summary, '', 2000)) };
  }).sort((a, b) => a.resource.localeCompare(b.resource, 'en')); files(result.map((item) => item.resource)); return result;
}
function definition(value, field = 'members', fixedDuties=FIXED_ROLE_DUTIES) {
  checked(field, EXPECTED.object, () => exactObject(value, ['id', 'name', 'purpose', 'interfaces', 'boundary', 'documents', 'revision', 'enabled', 'status', 'digest']));
  const id = checked(field + '.id', EXPECTED.identifier, () => identifier(value.id)); if (id === 'Human') fail('reserved_role', field + '.id', EXPECTED.identifier);
  if (!['system', 'approved', 'legacy'].includes(value.status)) fail('invalid_role', field + '.status', EXPECTED.status); if (typeof value.enabled !== 'boolean') fail('invalid_role', field + '.enabled', EXPECTED.enabled);
  const fixed = Object.hasOwn(fixedDuties, id); const purpose = checked(field + '.purpose', EXPECTED.purpose, () => textValue(value.purpose, '', 4000, value.status === 'legacy'));
  if (fixed && (purpose !== fixedDuties[id] || !value.enabled)) fail('fixed_role_duty', field + '.purpose', EXPECTED.fixed); if (value.status === 'system' && !fixed) fail('invalid_role', field + '.status', EXPECTED.status);
  const boundary = files(value.boundary, field + '.boundary'); if (id === 'Supervisor'&&fixed&&boundary.length)fail('supervisor_business_write',field+'.boundary',EXPECTED.boundary); if (id === 'ProjectManager' && boundary.length) fail('manager_business_write', field + '.boundary', EXPECTED.boundary);
  if (id === 'RoleArchitect' && boundary.some((path) => !/^docs\/roles\/[^/]+\/.+$/u.test(path))) fail('architect_business_write', field + '.boundary', EXPECTED.boundary);
  if (id === 'Acceptance' && boundary.some((path) => !path.startsWith('tests/Acceptance/') && !path.startsWith('test/Acceptance/') && !path.startsWith('docs/roles/Acceptance/'))) fail('acceptance_business_write', field + '.boundary', EXPECTED.boundary);
  const interfaces = checked(field + '.interfaces', EXPECTED.interfaces, () => list(value.interfaces, 32)).map((item, index) => checked(field + '.interfaces[' + index + ']', EXPECTED.interfaces, () => textValue(item, '', 1000)));
  if (new Set(interfaces).size !== interfaces.length) fail('duplicate_interface', field + '.interfaces', EXPECTED.interfaces);
  const fields = { id, name: checked(field + '.name', EXPECTED.name, () => textValue(value.name, '', 100)), purpose, interfaces, boundary, documents: documents(value.documents, id, field + '.documents'), revision: checked(field + '.revision', EXPECTED.revision, () => revision(value.revision)), enabled: value.enabled, status: value.status };
  if (value.status !== 'legacy' && fields.revision < 1) fail('invalid_revision', field + '.revision', EXPECTED.revision);
  const digest = digestValue(fields); if (value.digest !== undefined && value.digest !== digest) fail('role_digest_mismatch'); return immutable({ ...fields, digest });
}
function owners(value, members) {
  const checked = list(value).map((item) => {
    exactObject(item, ['resource', 'roleId']);
    const roleId = identifier(item.roleId);
    if (!members.some((member) => member.id === roleId)) fail('unknown_owner');
    return { resource: resource(item.resource), roleId };
  }).sort((a, b) => a.resource.localeCompare(b.resource, 'en'));
  files(checked.map((item) => item.resource));
  const claimed = new Map(checked.map((item) => [item.resource.toLowerCase(), item.roleId]));
  for (const member of members) {
    for (const path of member.boundary) {
      const prior = claimed.get(path.toLowerCase());
      if (prior !== undefined && prior !== member.id) fail('file_owned_by_other_role');
      if (prior === undefined) checked.push({ resource: path, roleId: member.id });
      claimed.set(path.toLowerCase(), member.id);
    }
  }
  return checked.sort((a, b) => a.resource.localeCompare(b.resource, 'en'));
}
function organizationValue(value, requiredRoles, fixedDuties) {
  exactObject(value, ['schemaVersion', 'projectId', 'revision', 'status', 'members', 'fileOwners', 'digest']);
  if (value.schemaVersion !== 1) fail('organization_schema');
  const members = checked('members', EXPECTED.array, () => list(value.members, 64)).map((item, index) => definition(item, 'members[' + index + ']',fixedDuties)).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  if (new Set(members.map((item) => item.id)).size !== members.length || requiredRoles.some((id) => !members.some((item) => item.id === id))) fail('missing_fixed_roles');
  let status = 'ready';
  if (members.some((item) => item.status === 'legacy')) status = 'legacy';
  if (value.status !== undefined && value.status !== status) fail('organization_status');
  const fields = { schemaVersion: 1, projectId: projectIdentifier(value.projectId), revision: revision(value.revision),
    status, members, fileOwners: owners(value.fileOwners, members) };
  const digest = digestValue(fields);
  if (value.digest !== undefined && value.digest !== digest) fail('organization_digest_mismatch');
  return immutable({ ...fields, digest });
}
export function organizationDocument(value){return organizationValue(value,Object.keys(FIXED_ROLE_DUTIES),FIXED_ROLE_DUTIES);}
/** Readonly original three-role validation; it cannot activate a new organization. */
export function legacyOrganizationDocument(value){const {Supervisor,...originalDuties}=FIXED_ROLE_DUTIES;return organizationValue(value,Object.keys(originalDuties),originalDuties);}
export function previousOrganizationDocument(value) { const duties={...FIXED_ROLE_DUTIES,Supervisor:'独立预检计划与观察执行风险；提交有来源的建议，不签发许可或改变任务与归属'}; return organizationValue(value,Object.keys(duties),duties); }
export function createOrganization(projectId) {
  return organizationDocument({ schemaVersion: 1, projectId, revision: 0,
    members: Object.entries(FIXED_ROLE_DUTIES).map(([id, purpose]) => ({ id, name: id, purpose,
      interfaces: [], boundary: [], documents: [], revision: 1, enabled: true, status: 'system' })), fileOwners: [] });
}
/** Known IDs and ownership are observations, never synthesized historical approvals. */
export function migrateLegacyOrganization(projectId, value) {
  exactObject(value, ['members', 'fileOwners']);
  const observed = list(value.members, 64).map((item) => {
    exactObject(item, ['id', 'name']);
    return { id: identifier(item.id), name: textValue(item.name, '', 100) };
  });
  if (new Set(observed.map((item) => item.id)).size !== observed.length) fail('duplicate_role');
  const byId = new Map(observed.map((item) => [item.id, item]));
  for (const owner of list(value.fileOwners)) {
    exactObject(owner, ['resource', 'roleId']);
    const id = identifier(owner.roleId);
    if (!byId.has(id)) byId.set(id, { id, name: id });
  }
  for (const id of Object.keys(FIXED_ROLE_DUTIES)) if (!byId.has(id)) byId.set(id, { id, name: id });
  return organizationDocument({ schemaVersion: 1, projectId, revision: 0,
    members: [...byId.values()].map((item) => ({ ...item, purpose: FIXED_ROLE_DUTIES[item.id] ?? '',
      interfaces: [], boundary: [], documents: [], revision: 0, enabled: true, status: 'legacy' })), fileOwners: value.fileOwners });
}
function actorFor(actor, projectId, roleId) {
  exactObject(actor, ['projectId', 'roleId', 'instanceId']);
  identifier(actor.instanceId);
  if (actor.projectId !== projectId || actor.roleId !== roleId) fail('actor_forbidden');
  return { projectId, roleId, instanceId: actor.instanceId };
}
function mergeMembers(organization, candidates, transfers = []) {
  const byId = new Map(organization.members.map((member) => [member.id, member]));
  for (const candidate of candidates) {
    const previous = byId.get(candidate.id);
    let expectedRevision = 1;
    if (previous) expectedRevision = previous.revision + 1;
    if (candidate.revision !== expectedRevision || candidate.status !== 'approved') fail('stale_role_revision');
    byId.set(candidate.id, candidate);
  }
  const members = [...byId.values()];
  owners(transferredOwners(organization, members, transfers), members);
  return members;
}
export function roleProposalDocument(value) {
  exactObject(value, ['schemaVersion', 'id', 'projectId', 'version', 'baseRevision', 'baseDigest', 'members', 'submittedBy', 'status', 'review', 'digest', 'transfers']);
  if (value.schemaVersion !== 1 || !['pending', 'approved', 'returned'].includes(value.status)) fail('invalid_proposal');
  const projectId = projectIdentifier(value.projectId);
  const members = checked('members', EXPECTED.array, () => list(value.members, 64)).map((item, index) => definition(item, 'members[' + index + ']')).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  if (!members.length || new Set(members.map((item) => item.id)).size !== members.length || members.some((item) => item.status !== 'approved')) fail('invalid_proposal');
  const fields = { schemaVersion: 1, id: identifier(value.id), projectId, version: revision(value.version, 1),
    baseRevision: revision(value.baseRevision), baseDigest: sha(value.baseDigest), members,
    submittedBy: actorFor(value.submittedBy, projectId, 'RoleArchitect') };
  if (value.transfers !== undefined) fields.transfers = proposalTransfers(value.transfers);
  const digest = digestValue(fields);
  if (value.digest !== undefined && value.digest !== digest) fail('proposal_digest_mismatch');
  let review = null;
  if (value.status !== 'pending') {
    exactObject(value.review, ['decision', 'reason', 'reviewedBy']);
    let decision = 'approve';
    if (value.status === 'returned') decision = 'return';
    if (value.review.decision !== decision) fail('invalid_review');
    review = { decision, reason: textValue(value.review.reason, '', 2000, decision === 'approve'),
      reviewedBy: actorFor(value.review.reviewedBy, projectId, 'ProjectManager') };
  } else if (value.review !== null) fail('invalid_review');
  return immutable({ ...fields, digest, status: value.status, review });
}
export function createRoleProposal(organizationValue, input, actor, previousValue = null) {
  const organization = organizationDocument(organizationValue);
  exactObject(input, ['id', 'version', 'members', 'transfers']);
  let expectedVersion = 1;
  if (previousValue !== null) {
    const previous = roleProposalDocument(previousValue);
    if (previous.projectId !== organization.projectId || previous.id !== input.id || previous.status !== 'returned') fail('proposal_not_returned');
    expectedVersion = previous.version + 1;
  }
  if (input.version !== expectedVersion) fail('stale_proposal_version');
  const proposal = roleProposalDocument({ schemaVersion: 1, id: input.id, projectId: organization.projectId,
    version: input.version, baseRevision: organization.revision, baseDigest: organization.digest,
    members: input.members, ...transferFields(input), submittedBy: actorFor(actor, organization.projectId, 'RoleArchitect'), status: 'pending', review: null });
  mergeMembers(organization, proposal.members, proposal.transfers ?? []);
  return proposal;
}
export function reviewRoleProposal(organizationValue, proposalValue, input, actor) {
  const organization = organizationDocument(organizationValue);
  const proposal = roleProposalDocument(proposalValue);
  exactObject(input, ['proposalId', 'version', 'digest', 'organizationRevision', 'organizationDigest', 'decision', 'reason']);
  const reviewedBy = actorFor(actor, organization.projectId, 'ProjectManager');
  if (proposal.status !== 'pending') fail('proposal_already_reviewed');
  if (proposal.projectId !== organization.projectId || input.proposalId !== proposal.id || input.version !== proposal.version || input.digest !== proposal.digest ||
    input.organizationRevision !== organization.revision || input.organizationDigest !== organization.digest ||
    proposal.baseRevision !== organization.revision || proposal.baseDigest !== organization.digest) fail('stale_proposal');
  if (!['approve', 'return'].includes(input.decision)) fail('invalid_review');
  let next = organization;
  let status = 'returned';
  if (input.decision === 'approve') {
    status = 'approved';
    const members = mergeMembers(organization, proposal.members, proposal.transfers ?? []);
    const byResource = new Map(transferredOwners(organization, members, proposal.transfers ?? []).map((item) => [item.resource.toLowerCase(), item]));
    for (const member of members) for (const path of member.boundary) if (!byResource.has(path.toLowerCase())) byResource.set(path.toLowerCase(), { resource: path, roleId: member.id });
    next = organizationDocument({ schemaVersion: 1, projectId: organization.projectId, revision: organization.revision + 1,
      members, fileOwners: [...byResource.values()] });
  }
  const reviewed = roleProposalDocument({ ...proposal, status, review: { decision: input.decision,
    reason: input.reason, reviewedBy } });
  return immutable({ organization: next, proposal: reviewed });
}
/** Select approved candidate data; actual publication still requires a Human-confirmed write plan. */
export function approvedRoleDocument(organizationValue, proposalValue, input, actor) {
  const organization = organizationDocument(organizationValue);
  const proposal = roleProposalDocument(proposalValue);
  exactObject(input, ['proposalId', 'version', 'digest', 'resource', 'contentDigest']);
  actorFor(actor, proposal.projectId, 'RoleArchitect');
  if (organization.projectId !== proposal.projectId || proposal.status !== 'approved' || input.proposalId !== proposal.id || input.version !== proposal.version || input.digest !== proposal.digest) fail('document_not_approved');
  const path = resource(input.resource);
  const document = proposal.members.filter((member) => organization.members.some((current) => current.id === member.id && current.digest === member.digest))
    .flatMap((member) => member.documents).find((item) => item.resource === path && item.contentDigest === input.contentDigest);
  if (!document) fail('document_not_approved');
  return immutable({ projectId: proposal.projectId, proposalId: proposal.id, proposalDigest: proposal.digest,
    resource: document.resource, contentDigest: document.contentDigest, summary: document.summary });
}
/** Full ledger digest includes review state, suitable for a later Provider compare-and-swap. */
export function roleProposalLedgerDocument(value) {
  exactObject(value, ['schemaVersion', 'projectId', 'revision', 'proposals', 'digest']);
  if (value.schemaVersion !== 1) fail('proposal_ledger_schema');
  const projectId = projectIdentifier(value.projectId);
  const proposals = list(value.proposals, 256).map(roleProposalDocument);
  const latest = new Map();
  for (const proposal of proposals) {
    if (proposal.projectId !== projectId) fail('proposal_project_mismatch');
    const previous = latest.get(proposal.id);
    let expectedVersion = 1;
    if (previous) {
      if (previous.status !== 'returned') fail('proposal_not_returned');
      expectedVersion = previous.version + 1;
    }
    if (proposal.version !== expectedVersion) fail('stale_proposal_version');
    latest.set(proposal.id, proposal);
  }
  const fields = { schemaVersion: 1, projectId, revision: revision(value.revision), proposals };
  const digest = digestValue(fields);
  if (value.digest !== undefined && value.digest !== digest) fail('proposal_ledger_digest_mismatch');
  return immutable({ ...fields, digest });
}
export function createRoleProposalLedger(projectId) {
  return roleProposalLedgerDocument({ schemaVersion: 1, projectId, revision: 0, proposals: [] });
}
export function submitRoleProposal(ledgerValue, organizationValue, input, actor) {
  const ledger = roleProposalLedgerDocument(ledgerValue);
  const organization = organizationDocument(organizationValue);
  if (ledger.projectId !== organization.projectId) fail('proposal_project_mismatch');
  const previous = [...ledger.proposals].reverse().find((proposal) => proposal.id === input.id) ?? null;
  const proposal = createRoleProposal(organization, input, actor, previous);
  return roleProposalLedgerDocument({ schemaVersion: 1, projectId: ledger.projectId,
    revision: ledger.revision + 1, proposals: [...ledger.proposals, proposal] });
}
export function reviewQueuedRoleProposal(ledgerValue, organizationValue, input, actor) {
  const ledger = roleProposalLedgerDocument(ledgerValue);
  const organization = organizationDocument(organizationValue);
  if (ledger.projectId !== organization.projectId) fail('proposal_project_mismatch');
  let index = -1;
  for (let cursor = 0; cursor < ledger.proposals.length; cursor += 1) if (ledger.proposals[cursor].id === input.proposalId) index = cursor;
  if (index < 0) fail('unknown_proposal');
  const result = reviewRoleProposal(organization, ledger.proposals[index], input, actor);
  const proposals = [...ledger.proposals];
  proposals[index] = result.proposal;
  return immutable({ organization: result.organization,
    ledger: roleProposalLedgerDocument({ schemaVersion: 1, projectId: ledger.projectId,
      revision: ledger.revision + 1, proposals }) });
}

function transferFields(input) { if (input.transfers === undefined) return {}; return { transfers: input.transfers }; }
function proposalTransfers(value) {
  const transfers = list(value).map((item) => { exactObject(item, ['resource', 'fromRoleId', 'toRoleId']); const fromRoleId = identifier(item.fromRoleId), toRoleId = identifier(item.toRoleId); if (fromRoleId === toRoleId) fail('invalid_transfer'); return { resource: resource(item.resource), fromRoleId, toRoleId }; });
  files(transfers.map((item) => item.resource)); return transfers;
}
function transferredOwners(organization, members, transfers) {
  const map = new Map(organization.fileOwners.map((item) => [item.resource.toLowerCase(), item]));
  for (const transfer of transfers) {
    const prior = map.get(transfer.resource.toLowerCase());
    const from = members.find((item) => item.id === transfer.fromRoleId), to = members.find((item) => item.id === transfer.toRoleId);
    if (!prior || prior.roleId !== transfer.fromRoleId || !from || !to || from.boundary.some((path) => path.toLowerCase() === transfer.resource.toLowerCase()) || !to.boundary.some((path) => path.toLowerCase() === transfer.resource.toLowerCase())) fail('invalid_transfer');
    map.set(transfer.resource.toLowerCase(), { resource: transfer.resource, roleId: transfer.toRoleId });
  }
  return [...map.values()];
}
