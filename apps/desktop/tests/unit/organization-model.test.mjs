import test from 'node:test';
import assert from 'node:assert/strict';
import { digestValue } from 'legion-runtime/workbench-models';
import { FIXED_ROLE_DUTIES, createOrganization, organizationDocument, migrateLegacyOrganization,
  createRoleProposal, roleProposalDocument, reviewRoleProposal, approvedRoleDocument, createRoleProposalLedger, roleProposalLedgerDocument, submitRoleProposal, reviewQueuedRoleProposal } from '../../src/models/organization.mjs';

const projectId = 'a'.repeat(64);
const architect = { projectId, roleId: 'RoleArchitect', instanceId: 'architect-1' };
const manager = { projectId, roleId: 'ProjectManager', instanceId: 'pm-1' };
function member(overrides = {}) {
  return { id: 'SSH', name: 'SSH developer', purpose: 'Implement SSH transport', interfaces: ['SSH service'],
    boundary: ['src/ssh.mjs'], documents: [{ resource: 'docs/roles/SSH/role-card.md', contentDigest: digestValue('candidate'), summary: 'SSH responsibilities' }],
    revision: 1, enabled: true, status: 'approved', ...overrides };
}
function proposal(organization = createOrganization(projectId), members = [member()]) {
  return createRoleProposal(organization, { id: 'roles-1', version: 1, members }, architect);
}
function reviewInput(organization, candidate, decision = 'approve') {
  return { proposalId: candidate.id, version: candidate.version, digest: candidate.digest,
    organizationRevision: organization.revision, organizationDigest: organization.digest, decision, reason: 'Reviewed duties and files' };
}
function approve(organization, candidate) {
  return reviewRoleProposal(organization, candidate, reviewInput(organization, candidate), manager);
}

test('new organizations retain three fixed responsibilities with immutable canonical digests', () => {
  const organization = createOrganization(projectId);
  assert.deepEqual(organization.members.map((item) => item.id), ['Acceptance', 'ProjectManager', 'RoleArchitect','Supervisor']);
  for (const item of organization.members) assert.equal(item.purpose, FIXED_ROLE_DUTIES[item.id]);
  assert.equal(organization.revision, 0);
  assert.equal(organization.status, 'ready');
  assert.ok(Object.isFrozen(organization.members[0].boundary));
  assert.deepEqual(organizationDocument(JSON.parse(JSON.stringify(organization))), organization);
  assert.throws(() => organizationDocument({ ...organization, revision: 2 }), /digest_mismatch/);
  assert.throws(() => organizationDocument({ ...organization, apiKey: 'forged' }));
});

test('architect submits and PM approves the precise version, preserving previous roles across new plans', () => {
  const original = createOrganization(projectId);
  const candidate = proposal(original);
  const first = approve(original, candidate);
  assert.equal(original.members.length, 4);
  assert.equal(candidate.status, 'pending');
  assert.equal(first.proposal.status, 'approved');
  assert.equal(first.proposal.review.reviewedBy.instanceId, 'pm-1');
  assert.equal(first.organization.revision, 1);
  assert.deepEqual(first.organization.fileOwners, [{ resource: 'src/ssh.mjs', roleId: 'SSH' }]);
  const secondCandidate = createRoleProposal(first.organization, { id: 'sftp-roles', version: 1,
    members: [member({ id: 'SFTP', boundary: ['src/sftp.mjs'], documents: [] })] }, architect);
  const second = approve(first.organization, secondCandidate);
  assert.equal(second.organization.members.length, 6);
  assert.ok(second.organization.members.some((item) => item.id === 'SSH'));
  assert.equal(second.organization.fileOwners.length, 2);
});

test('returned proposal must be revised before approval and records actual reviewer reason', () => {
  const original = createOrganization(projectId);
  const candidate = proposal(original);
  const returned = reviewRoleProposal(original, candidate, reviewInput(original, candidate, 'return'), manager);
  assert.deepEqual(returned.organization, original);
  assert.equal(returned.proposal.status, 'returned');
  assert.equal(returned.proposal.review.reason, 'Reviewed duties and files');
  const revised = createRoleProposal(original, { id: candidate.id, version: 2, members: [member({ purpose: 'SSH plus transport errors' })] }, architect, returned.proposal);
  assert.notEqual(revised.digest, candidate.digest);
  assert.equal(approve(original, revised).organization.members.find((item) => item.id === 'SSH').purpose, 'SSH plus transport errors');
  assert.throws(() => createRoleProposal(original, { id: candidate.id, version: 1, members: [member()] }, architect, returned.proposal), /stale_proposal_version/);
  assert.throws(() => createRoleProposal(original, { id: candidate.id, version: 2, members: [member()] }, architect, candidate), /proposal_not_returned/);
});

test('review refuses stale proposal IDs, versions, digests and organization bindings', () => {
  const original = createOrganization(projectId);
  const candidate = proposal(original);
  for (const override of [{ proposalId: 'other' }, { version: 2 }, { digest: 'b'.repeat(64) }, { organizationRevision: 4 }, { organizationDigest: 'b'.repeat(64) }]) {
    assert.throws(() => reviewRoleProposal(original, candidate, { ...reviewInput(original, candidate), ...override }, manager), /stale_proposal/);
  }
  const accepted = approve(original, candidate);
  assert.throws(() => approve(accepted.organization, candidate), /stale_proposal/);
  assert.throws(() => approve(original, accepted.proposal), /already_reviewed/);
  assert.throws(() => roleProposalDocument({ ...candidate, members: [member({ purpose: 'tampered' })] }), /digest_mismatch/);
});

test('actor identity is a separate trusted input and payload role spoofing is rejected', () => {
  const original = createOrganization(projectId);
  const candidate = proposal(original);
  assert.throws(() => createRoleProposal(original, { id: 'p', version: 1, members: [member()] }, manager), /actor_forbidden/);
  assert.throws(() => reviewRoleProposal(original, candidate, reviewInput(original, candidate), architect), /actor_forbidden/);
  assert.throws(() => reviewRoleProposal(original, candidate, reviewInput(original, candidate), { ...manager, projectId: 'b'.repeat(64) }), /actor_forbidden/);
  assert.throws(() => reviewRoleProposal(original, candidate, { ...reviewInput(original, candidate), roleId: 'ProjectManager' }, architect));
});

test('stable role revisions forbid old or duplicate updates; disabling preserves reserved file ownership', () => {
  const first = approve(createOrganization(projectId), proposal()).organization;
  assert.throws(() => proposal(first), /stale_role_revision/);
  const disabled = approve(first, createRoleProposal(first, { id: 'disable-SSH', version: 1,
    members: [member({ revision: 2, enabled: false, boundary: [], documents: [] })] }, architect)).organization;
  assert.equal(disabled.members.find((item) => item.id === 'SSH').enabled, false);
  assert.deepEqual(disabled.fileOwners, first.fileOwners);
  assert.throws(() => proposal(disabled, [member({ id: 'Other', boundary: ['SRC/ssh.mjs'], documents: [] })]), /file_owned_by_other_role/);
});

test('file boundaries normalize separators, reject duplicates, cross-role claims and directory grants', () => {
  assert.deepEqual(proposal(undefined, [member({ boundary: ['src\\ssh.mjs'] })]).members[0].boundary, ['src/ssh.mjs']);
  assert.throws(() => proposal(undefined, [member({ boundary: ['src/ssh.mjs', 'SRC/SSH.mjs'] })]), /duplicate_resource/);
  assert.throws(() => proposal(undefined, [member(), member({ id: 'Other', documents: [] })]), /file_owned_by_other_role/);
  for (const boundary of [['src/'], ['src/*'], ['../escape'], ['/absolute'], ['C:/source'], ['.ans/config.json'], ['nested/.git/config'], ['nested/.env.local'], ['nested/.ssh/id_ed25519'], ['keys/server.pem'], ['.npmrc']]) {
    assert.throws(() => proposal(undefined, [member({ boundary })]), boundary.join(','));
  }
});

test('fixed responsibilities and role-specific business write exclusions cannot be rewritten', () => {
  const original = createOrganization(projectId);
  for (const id of Object.keys(FIXED_ROLE_DUTIES)) {
    const current = original.members.find((item) => item.id === id);
    assert.throws(() => proposal(original, [{ ...current, digest: undefined, revision: 2, status: 'approved', purpose: 'Overwrite duties' }]), /fixed_role_duty/);
    assert.throws(() => proposal(original, [{ ...current, digest: undefined, revision: 2, status: 'approved', enabled: false }]), /fixed_role_duty/);
    assert.throws(() => proposal(original, [{ ...current, digest: undefined, revision: 2, status: 'approved', boundary: ['src/business.mjs'] }]), /business_write/);
  }
  const acceptance = original.members.find((item) => item.id === 'Acceptance');
  assert.doesNotThrow(() => proposal(original, [{ ...acceptance, digest: undefined, revision: 2, status: 'approved', boundary: ['tests/Acceptance/ssh.test.mjs'] }]));
});

test('approved governance candidate selector verifies exact content, actor and review; issues no write authority', () => {
  const original = createOrganization(projectId);
  const candidate = proposal(original);
  const accepted = approve(original, candidate);
  const approved = accepted.proposal;
  const input = { proposalId: approved.id, version: approved.version, digest: approved.digest,
    resource: member().documents[0].resource, contentDigest: member().documents[0].contentDigest };
  assert.equal(approvedRoleDocument(accepted.organization, approved, input, architect).resource, input.resource);
  assert.throws(() => approvedRoleDocument(original, candidate, input, architect), /document_not_approved/);
  assert.throws(() => approvedRoleDocument(accepted.organization, approved, { ...input, contentDigest: 'b'.repeat(64) }, architect), /document_not_approved/);
  assert.throws(() => approvedRoleDocument(accepted.organization, approved, { ...input, resource: 'src/ssh.mjs' }, architect), /document_not_approved/);
  assert.throws(() => approvedRoleDocument(accepted.organization, approved, input, manager), /actor_forbidden/);
  const revised = approve(accepted.organization, proposal(accepted.organization, [member({ revision: 2, documents: [] })])).organization;
  assert.throws(() => approvedRoleDocument(revised, approved, input, architect), /document_not_approved/);
  assert.throws(() => proposal(original, [member({ documents: [{ ...member().documents[0], resource: 'docs/roles/Other/role-card.md' }] })]), /invalid_role_document/);
});

test('legacy migration recovers known IDs and inactive plan owners without synthesizing approval', () => {
  const migrated = migrateLegacyOrganization(projectId, { members: [{ id: 'SSH', name: 'Old SSH role' }],
    fileOwners: [{ resource: 'src/ssh.mjs', roleId: 'SSH' }, { resource: 'src/sftp.mjs', roleId: 'SFTP' }] });
  assert.equal(migrated.status, 'legacy');
  assert.equal(migrated.members.length, 6);
  for (const item of migrated.members) { assert.equal(item.status, 'legacy'); assert.equal(item.revision, 0); }
  assert.equal(migrated.members.find((item) => item.id === 'SSH').purpose, '');
  assert.deepEqual(migrated.members.find((item) => item.id === 'SSH').boundary, []);
  assert.deepEqual(organizationDocument(JSON.parse(JSON.stringify(migrated))), migrated);
  const supplemented = approve(migrated, proposal(migrated)).organization;
  assert.equal(supplemented.status, 'legacy');
  assert.equal(supplemented.members.find((item) => item.id === 'SSH').status, 'approved');
});

 test('proposal ledger binds mutable reviews for CAS and rejects repeated or old queued decisions', () => {
  const organization = createOrganization(projectId);
  const ledger = submitRoleProposal(createRoleProposalLedger(projectId), organization, { id: 'p', version: 1, members: [member()] }, architect);
  const first = ledger.proposals[0];
  const returned = reviewQueuedRoleProposal(ledger, organization, reviewInput(organization, first, 'return'), manager);
  assert.notEqual(returned.ledger.digest, ledger.digest);
  assert.throws(() => reviewQueuedRoleProposal(returned.ledger, organization, reviewInput(organization, first), manager), /already_reviewed/);
  const revised = submitRoleProposal(returned.ledger, organization, { id: 'p', version: 2, members: [member()] }, architect);
  assert.equal(revised.proposals.length, 2);
  assert.throws(() => reviewQueuedRoleProposal(revised, organization, reviewInput(organization, first), manager), /stale_proposal/);
  const approved = reviewQueuedRoleProposal(revised, organization, reviewInput(organization, revised.proposals[1]), manager);
  assert.equal(approved.organization.members.length, 5);
  assert.throws(() => submitRoleProposal(approved.ledger, approved.organization, { id: 'p', version: 3, members: [member({ revision: 2 })] }, architect), /proposal_not_returned/);
  assert.deepEqual(roleProposalLedgerDocument(JSON.parse(JSON.stringify(approved.ledger))), approved.ledger);
  assert.throws(() => roleProposalLedgerDocument({ ...ledger, proposals: returned.ledger.proposals }), /digest_mismatch/);
 });

test('explicit reviewed transfer requires removing old boundary and binds both precise owners in proposal digest', () => {
  const first = approve(createOrganization(projectId), proposal()).organization;
  const input = { id: 'transfer', version: 1, members: [member({ revision: 2, boundary: [], documents: [] }), member({ id: 'Editor', boundary: ['src/ssh.mjs'], documents: [] })], transfers: [{ resource: 'src/ssh.mjs', fromRoleId: 'SSH', toRoleId: 'Editor' }] };
  assert.throws(() => createRoleProposal(first, { ...input, transfers: [] }, architect), /file_owned_by_other_role/);
  assert.throws(() => createRoleProposal(first, { ...input, members: [member({ revision: 2 }), input.members[1]] }, architect), /invalid_transfer/);
  const candidate = createRoleProposal(first, input, architect); const next = approve(first, candidate);
  assert.equal(next.organization.fileOwners[0].roleId, 'Editor'); assert.deepEqual(first.fileOwners, [{resource:'src/ssh.mjs',roleId:'SSH'}]);
  assert.deepEqual(roleProposalDocument(JSON.parse(JSON.stringify(candidate))), candidate);
  assert.throws(() => roleProposalDocument({ ...candidate, transfers: [] }), /proposal_digest_mismatch/);
});


import { OrganizationValidationError, organizationValidationDiagnostic } from '../../src/models/organization.mjs';
test('actual proposal structural regression: prose/colon/glob boundaries remain rejected with safe precise coordinates', () => {
  const org = createOrganization(projectId); const acceptance = org.members.find((role) => role.id === 'Acceptance');
  for (const bad of ['职责:负责独立验收', 'tests/Acceptance/**', 'tests/Acceptance/']) {
    let error; try { proposal(org, [{ ...acceptance, digest: undefined, revision: 2, status: 'approved', boundary: [bad] }]); } catch (failure) { error = failure; }
    assert.ok(error instanceof OrganizationValidationError); assert.equal(error.code, 'invalid_role_resource'); const diagnostic = organizationValidationDiagnostic(error); assert.equal(diagnostic.field, 'members[0].boundary[0]'); assert.ok(diagnostic.expected.includes('exact project-relative file')); assert.equal(JSON.stringify(diagnostic).includes(bad), false);
  }
  assert.equal(organizationValidationDiagnostic(new TypeError('raw API credential sk-secret')), null);
  const valid = proposal(org, [{ ...acceptance, digest: undefined, revision: 2, status: 'approved', boundary: ['tests/Acceptance/check.test.mjs'] }]); assert.equal(valid.members[0].boundary[0], 'tests/Acceptance/check.test.mjs');
});

test('role type errors expose field and static expectation without echoing rejected input or changing fixed duties', () => {
  for (const [key, value, suffix] of [['interfaces', 'secret vendor input', '.interfaces'], ['revision', '1', '.revision'], ['enabled', 'true', '.enabled'], ['name', 42, '.name']]) {
    let error; try { proposal(undefined, [member({ [key]: value })]); } catch (failure) { error = failure; } const diagnostic = organizationValidationDiagnostic(error); assert.ok(diagnostic, key); assert.equal(diagnostic.field, 'members[0]' + suffix); assert.equal(JSON.stringify(diagnostic).includes('secret vendor input'), false);
  }
});
