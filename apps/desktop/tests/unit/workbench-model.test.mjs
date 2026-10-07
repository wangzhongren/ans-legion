import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planCandidate,
  boundPlan,
  planDocument,
  topologicalTasks,
  contextDescriptor,
  contextDigest,
  identityKey,
  projectDocument,
  workbenchDTO,
  workbenchInput,
  historyDocument
} from '../../src/models/workbench.mjs';
const identity = {
  canonicalPath: 'D:/customer',
  deviceId: '1',
  fileId: '2'
};
const projectId = identityKey(identity);
const sha = 'a'.repeat(64);
const candidate = {
  goal: '修改项目',
  roles: [{
    id: 'Builder',
    name: '开发',
    purpose: '实现',
    profileId: 'ai'
  }],
  tasks: [{
    id: 'first',
    title: '第一步',
    roleId: 'Builder',
    profileId: 'ai',
    dependsOn: [],
    writeSet: ['src/a.txt'],
    instruction: '第一行\n第二行'
  },
  {
    id: 'second',
    title: '第二步',
    roleId: 'Builder',
    profileId: 'ai',
    dependsOn: ['first'],
    writeSet: ['src/b.txt'],
    instruction: '实现'
  }]
};
const binding = {
  projectId,
  organizationVersion: 'customer-v1',
  revision: 1,
  profileBindings: [{
    profileId: 'ai',
    profileVersion: sha,
    contextSnapshotDigest: sha
  }],
  contextSnapshotDigest: sha
};
test('plan accepts finite DAG and rejects model authority, scope expansion, alias and cycles', () => {
  assert.deepEqual(topologicalTasks(planCandidate(candidate).tasks).map((item) => item.id), ['first', 'second']); for (const changed of [{
    ...candidate,
    approved: true
  }, {
    ...candidate,
    roles: [{
      ...candidate.roles[0],
      id: 'ProjectManager'
    }]
  }, {
    ...candidate,
    tasks: [{
      ...candidate.tasks[0],
      writeSet: ['.ans/role.yaml']
    }]
  }, {
    ...candidate,
    tasks: [{
      ...candidate.tasks[0],
      writeSet: ['a',
      'A']
    }]
  }, {
    ...candidate,
    tasks: candidate.tasks.map((item) => ({
      ...item,
      dependsOn: [item.id]
    }))
  }]) assert.throws(() => planCandidate(changed));
});
test('host digest binds every profile, context and org; stored digest tampering rejected', () => {
  const plan = boundPlan(candidate, binding); assert.ok(Object.isFrozen(plan.tasks[0])); assert.notEqual(boundPlan(candidate, {
    ...binding,
    organizationVersion: 'customer-v2'
  }).planDigest, plan.planDigest); assert.notEqual(boundPlan(candidate, {
    ...binding,
    profileBindings: [{
      ...binding.profileBindings[0],
      profileVersion: 'b'.repeat(64)
    }]
  }).planDigest, plan.planDigest); assert.throws(() => planDocument({
    ...plan,
    goal: '不同目标'
  })); assert.throws(() => boundPlan(candidate, {
    ...binding,
    profileBindings: []
  }));
});
test('context contract bounds precise files and includes SHA in digest', () => {
  const context = contextDescriptor({
    files: [{
      resource: 'src/a.txt',
      byteLength: 12,
      sha256: sha
    }],
    verifiedAt: '2026-10-07T09:44:22.2685583+08:00'
  }); assert.notEqual(contextDigest(context), contextDigest({
    ...context,
    files: [{
      ...context.files[0],
      sha256: 'b'.repeat(64)
    }]
  })); assert.throws(() => contextDescriptor({
    ...context,
    files: [{
      ...context.files[0],
      byteLength: 262145
    }]
  })); assert.throws(() => contextDescriptor({
    ...context,
    files: Array.from({
      length: 17
    }, (_, index) => ({
      ...context.files[0],
      resource: `${index}.txt`
    }))
  }));
});
test('IPC input is finite, PM only, multiline text preserved and path injection rejected', () => {
  assert.equal(workbenchInput('sendMessage', {
    projectId,
    roleId: 'Builder',
    text: '开始'
  }).error.code, 'manager_only'); assert.equal(workbenchInput('sendMessage', {
    projectId,
    roleId: 'ProjectManager',
    text: '第一行\n第二行'
  }).value.text, '第一行\n第二行'); assert.equal(workbenchInput('chooseProject', {
    path: 'D:/elsewhere'
  }).ok, false); assert.equal(workbenchInput('confirmPlan', {
    projectId,
    planDigest: sha,
    approved: true
  }).ok, false);
});
test('DTO strips private workspace identity; histories reject tool/secret envelopes', () => {
  const project = projectDocument({
    schemaVersion: 1,
    id: projectId,
    name: '客户',
    workspaceIdentity: identity,
    organizationVersion: 'customer-v1',
    manager: null,
    planRevision: 0,
    plan: null,
    context: {
      files: [],
      verifiedAt: null
    },
    tasks: []
  }); const dto = workbenchDTO({
    profiles: [],
    assignments: [],
    project,
    projects: [],
    history: {
      messages: [{
        role: 'user',
        text: '需求'
      }]
    }
  }); assert.equal(JSON.stringify(dto).includes('canonicalPath'), false); assert.deepEqual(dto.roles, []); assert.throws(() => historyDocument({
    schemaVersion: 1,
    projectId,
    roleId: 'ProjectManager',
    history: {
      messages: [{
        role: 'tool',
        text: 'x'
      }]
    }
  })); assert.throws(() => historyDocument({
    schemaVersion: 1,
    projectId,
    roleId: 'ProjectManager',
    history: {
      messages: [],
      apiKey: 'secret'
    }
  }));
});
