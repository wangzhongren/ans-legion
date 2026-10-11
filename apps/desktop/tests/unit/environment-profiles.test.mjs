import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createEnvironmentProfilesService } from '../../src/services/public/environment_profiles.mjs';
import { createEnvironmentProfileProvider } from '../../src/providers/public/environment_profile.mjs';

const options = { protocol: 'openai-completions', provider: 'local', modelId: 'test-model', baseUrl: 'http://127.0.0.1:8080/v1', env: { LEGION_API_KEY: 'fixture-secret-value-123' } };
test('headless Profile: stable process generation, private credentials, no Electron, unknown profile rejection', async () => {
  const env = { ...options.env };
  const service = createEnvironmentProfilesService({ ...options, env });
  try {
    const listed = await service.list();
    assert.equal(listed.ok, true);
    assert.deepEqual(listed.value.assignments, []);
    assert.equal(listed.value.profiles[0].id, 'environment');
    assert.equal(JSON.stringify(listed).includes(env.LEGION_API_KEY), false);
    const first = await service.resolveConnection('environment');
    const second = await service.resolveConnection('environment');
    assert.equal(first.ok, true);
    assert.equal(first.value.connection.profileVersion, second.value.connection.profileVersion);
    assert.equal(first.value.credentials.apiKey, options.env.LEGION_API_KEY);
    env.LEGION_API_KEY = 'changed-after-start';
    assert.equal((await service.resolveConnection('environment')).value.credentials.apiKey, options.env.LEGION_API_KEY);
    assert.equal((await service.resolveConnection('other')).error.code, 'not_found');
    assert.equal((await service.save({ apiKey: 'never-save' })).error.code, 'profile_read_only');
    assert.equal((await service.delete('environment')).error.code, 'profile_read_only');
    const assigned = await service.assign({ projectId: 'a'.repeat(64), roleId: 'Developer', profileId: 'environment' });
    assert.equal(assigned.value.assignments.length, 1);
    assert.equal((await service.assign({ projectId: 'a'.repeat(64), roleId: 'Developer', profileId: 'other' })).error.code, 'not_found');
    assert.equal((await service.assign({ projectId: 'a'.repeat(64), roleId: 'Developer', profileId: null })).value.assignments.length, 0);
    assert.equal(service.getProbeState().value.status, 'idle');
  } finally { assert.equal(service.close().ok, true); }
  assert.equal(service.close().ok, true);
  assert.equal((await service.resolveConnection('environment')).error.code, 'closed');
  assert.equal((await service.list()).error.code, 'closed');
});
test('same config/key in another process generation invalidates profile version without a key digest', () => {
  const first = createEnvironmentProfileProvider(options);
  const second = createEnvironmentProfileProvider(options);
  try {
    assert.notEqual(first.read().value.profileVersion, second.read().value.profileVersion);
    assert.equal(JSON.stringify(first.read()).includes(options.env.LEGION_API_KEY), false);
  } finally { first.close(); second.close(); }
});
test('missing key, invalid protocol, credential-bearing endpoint and unknown configuration fail closed', () => {
  for (const changed of [{ env: {} }, { env: { LEGION_API_KEY: ' ' } }, { protocol: 'unknown' }, { baseUrl: 'https://user:password@example.com' }, { userDataDir: '/unused' }]) {
    assert.throws(() => createEnvironmentProfilesService({ ...options, ...changed }));
  }
});
test('headless import closure: Service has no infrastructure, provider has no persistence/Electron/subprocess', async () => {
  const service = await readFile(new URL('../../src/services/impl/environment_profiles.mjs', import.meta.url), 'utf8');
  const provider = await readFile(new URL('../../src/providers/impl/environment_profile.mjs', import.meta.url), 'utf8');
  assert.equal(/node:|providers\/(?:impl|abstract)|electron/u.test(service), false);
  assert.equal(/node:fs|electron|child_process|writeFile|process\.env\s*=/u.test(provider), false);
});
