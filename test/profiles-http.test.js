import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createServer, setProfilesFilePath } from '../src/server.js';
import { upsertProfile, loadProfiles } from '../src/profiles.js';

const SERVERS = [];

function assertIsoTimestamp(value) {
  assert.equal(typeof value, 'string');
  assert.ok(!Number.isNaN(Date.parse(value)));
  assert.equal(new Date(value).toISOString(), value);
}

async function makeTmpDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'profiles-http-test-'));
}

/**
 * Point the server module at a temp profiles file, then mount the real
 * server on port 0 of the loopback interface.
 */
async function mountServer(profilesPath) {
  setProfilesFilePath(profilesPath);
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  SERVERS.push(server);
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

after(async () => {
  await Promise.all(SERVERS.map(async (server) => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }));
});

describe('unknown /api routes', () => {
  it('still fall through to 404 Not Found', async () => {
    const tmpDir = await makeTmpDir();
    try {
      const { baseUrl } = await mountServer(path.join(tmpDir, 'profiles.json'));
      const res = await fetch(`${baseUrl}/api/404`);
      assert.equal(res.status, 404);
      assert.equal((await res.text()).trim(), 'Not Found');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('GET /api/profiles', () => {
  it('returns the empty list for a temp profiles file that does not exist yet', async () => {
    const tmpDir = await makeTmpDir();
    try {
      const { baseUrl } = await mountServer(path.join(tmpDir, 'nested', 'profiles.json'));
      const res = await fetch(`${baseUrl}/api/profiles`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { profiles: [] });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns profiles upserted into a temp file with an explicit profilesPath', async () => {
    const tmpDir = await makeTmpDir();
    try {
      const profilesPath = path.join(tmpDir, 'profiles.json');
      const saved = await upsertProfile({
        name: 'sabah-ai',
        providerId: 'sabah-ai',
        baseUrl: 'https://vibing.softyan.net/v1',
        api: 'openai-completions',
        apiKey: 'sk-test'
      }, profilesPath);
      assertIsoTimestamp(saved.savedAt);

      const { baseUrl } = await mountServer(profilesPath);
      const res = await fetch(`${baseUrl}/api/profiles`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { profiles: [saved] });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('POST /api/profiles', () => {
  it('round-trips an upsert into the temp profiles file', async () => {
    const tmpDir = await makeTmpDir();
    try {
      const profilesPath = path.join(tmpDir, 'profiles.json');
      const { baseUrl } = await mountServer(profilesPath);

      const post = (payload) => fetch(`${baseUrl}/api/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const first = await post({
        name: 'sabah-ai',
        providerId: 'sabah-ai',
        baseUrl: 'https://old.example/v1',
        api: 'openai-completions',
        apiKey: 'sk-old'
      });
      assert.equal(first.status, 200);
      const firstData = await first.json();
      assert.equal(firstData.ok, true);
      assertIsoTimestamp(firstData.profile.savedAt);
      assert.equal(firstData.profile.baseUrl, 'https://old.example/v1');

      const second = await post({
        name: 'sabah-ai',
        providerId: 'sabah-ai',
        baseUrl: 'https://new.example/v1',
        api: 'anthropic-messages',
        apiKey: 'sk-new'
      });
      assert.equal(second.status, 200);
      const secondData = await second.json();
      assert.equal(secondData.profile.baseUrl, 'https://new.example/v1');
      assert.notEqual(secondData.profile.savedAt, firstData.profile.savedAt);

      // Persisted at the injected temp path, no duplicates by name.
      const stored = await loadProfiles(profilesPath);
      assert.equal(stored.length, 1);
      assert.equal(stored[0].apiKey, 'sk-new');

      const get = await fetch(`${baseUrl}/api/profiles`);
      assert.deepEqual(await get.json(), { profiles: stored });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects a missing or empty name with 400 and writes nothing', async () => {
    const tmpDir = await makeTmpDir();
    try {
      const profilesPath = path.join(tmpDir, 'profiles.json');
      const { baseUrl } = await mountServer(profilesPath);

      for (const badBody of [
        { providerId: 'no-name' },
        { name: '' },
        { name: '   ' }
      ]) {
        const res = await fetch(`${baseUrl}/api/profiles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(badBody)
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.ok(typeof data.error === 'string' && data.error.length > 0);
      }

      assert.deepEqual(await loadProfiles(profilesPath), []);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
