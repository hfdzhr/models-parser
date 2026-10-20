import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  getProfilesPath,
  loadProfiles,
  upsertProfile,
  seedProfilesFromPiConfig,
  seedProfilesFromOpenCodeConfig,
  mergeProfiles
} from '../src/profiles.js';

function assertIsoTimestamp(value) {
  assert.equal(typeof value, 'string');
  assert.ok(!Number.isNaN(Date.parse(value)));
  assert.equal(new Date(value).toISOString(), value);
}

async function makeTmpDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'profiles-test-'));
}

describe('getProfilesPath', () => {
  it('points at ~/.config/config-models-parser/profiles.json', () => {
    assert.equal(
      getProfilesPath(),
      path.join(os.homedir(), '.config', 'config-models-parser', 'profiles.json')
    );
  });
});

describe('loadProfiles', () => {
  it('returns empty array when file is missing', async () => {
    const tmpDir = await makeTmpDir();
    try {
      const profilesPath = path.join(tmpDir, 'nested', 'profiles.json');
      assert.deepEqual(await loadProfiles(profilesPath), []);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns profiles sorted by name', async () => {
    const tmpDir = await makeTmpDir();
    try {
      const profilesPath = path.join(tmpDir, 'profiles.json');
      await fs.writeFile(profilesPath, JSON.stringify({
        profiles: [
          { name: 'charlie', providerId: 'charlie', baseUrl: 'https://c', api: 'openai-completions', apiKey: 'k-c', savedAt: '2026-01-03T00:00:00.000Z' },
          { name: 'alpha', providerId: 'alpha', baseUrl: 'https://a', api: 'openai-completions', apiKey: 'k-a', savedAt: '2026-01-01T00:00:00.000Z' },
          { name: 'beta', providerId: 'beta', baseUrl: 'https://b', api: 'openai-completions', apiKey: 'k-b', savedAt: '2026-01-02T00:00:00.000Z' }
        ]
      }, null, 2) + '\n', 'utf8');

      const loaded = await loadProfiles(profilesPath);
      assert.deepEqual(loaded.map((p) => p.name), ['alpha', 'beta', 'charlie']);
      assert.equal(loaded[1].baseUrl, 'https://b');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws an error containing "Failed to read profiles" when file is corrupt', async () => {
    const tmpDir = await makeTmpDir();
    try {
      const profilesPath = path.join(tmpDir, 'profiles.json');
      await fs.writeFile(profilesPath, '{profiles: [broken', 'utf8');

      await assert.rejects(() => loadProfiles(profilesPath), (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Failed to read profiles/);
        return true;
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('upsertProfile', () => {
  it('creates directory recursively and writes pretty-printed profiles.json with trailing newline', async () => {
    const tmpDir = await makeTmpDir();
    try {
      const profilesPath = path.join(tmpDir, 'deep', 'nested', 'profiles.json');
      const saved = await upsertProfile({
        name: 'sabah-ai',
        providerId: 'sabah-ai',
        baseUrl: 'https://vibing.softyan.net/v1',
        api: 'openai-completions',
        apiKey: 'sk-test'
      }, profilesPath);

      assertIsoTimestamp(saved.savedAt);
      assert.equal(saved.name, 'sabah-ai');
      assert.equal(saved.providerId, 'sabah-ai');
      assert.equal(saved.baseUrl, 'https://vibing.softyan.net/v1');
      assert.equal(saved.apiKey, 'sk-test');

      const raw = await fs.readFile(profilesPath, 'utf8');
      const refetched = await loadProfiles(profilesPath);
      assert.equal(raw, JSON.stringify({ profiles: refetched }, null, 2) + '\n');
      assert.deepEqual(saved, refetched[0]);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('inserts a new profile then updates it by name without duplicating', async () => {
    const tmpDir = await makeTmpDir();
    try {
      const profilesPath = path.join(tmpDir, 'profiles.json');

      const first = await upsertProfile({
        name: 'sabah-ai',
        providerId: 'sabah-ai',
        baseUrl: 'https://old.example/v1',
        api: 'openai-completions',
        apiKey: 'sk-old'
      }, profilesPath);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = await upsertProfile({
        name: 'sabah-ai',
        providerId: 'sabah-ai',
        baseUrl: 'https://new.example/v1',
        api: 'openai-completions',
        apiKey: 'sk-new'
      }, profilesPath);

      const loaded = await loadProfiles(profilesPath);
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].baseUrl, 'https://new.example/v1');
      assert.equal(loaded[0].apiKey, 'sk-new');
      assert.equal(second.savedAt, loaded[0].savedAt);
      assert.notEqual(second.savedAt, first.savedAt);
      assert.deepEqual(second, loaded[0]);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('trims and defaults optional string fields to empty strings', async () => {
    const tmpDir = await makeTmpDir();
    try {
      const profilesPath = path.join(tmpDir, 'profiles.json');
      const saved = await upsertProfile({
        name: '  sabah-ai  ',
        providerId: '  sabah-ai  ',
        baseUrl: '  https://vibing.softyan.net/v1  '
      }, profilesPath);

      assert.equal(saved.name, 'sabah-ai');
      assert.equal(saved.providerId, 'sabah-ai');
      assert.equal(saved.baseUrl, 'https://vibing.softyan.net/v1');
      assert.equal(saved.api, '');
      assert.equal(saved.apiKey, '');

      // Same trimmed name must update the existing entry, not add another.
      await upsertProfile({ name: 'sabah-ai', baseUrl: 'https://updated/v1' }, profilesPath);
      const loaded = await loadProfiles(profilesPath);
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].baseUrl, 'https://updated/v1');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects empty, whitespace-only, or missing names', async () => {
    const tmpDir = await makeTmpDir();
    try {
      const profilesPath = path.join(tmpDir, 'profiles.json');
      await assert.rejects(() => upsertProfile({ name: '' }, profilesPath), /non-empty/);
      await assert.rejects(() => upsertProfile({ name: '   ' }, profilesPath), /non-empty/);
      await assert.rejects(() => upsertProfile({ baseUrl: 'https://x' }, profilesPath), /non-empty/);
      await assert.rejects(() => upsertProfile(null, profilesPath));
      assert.deepEqual(await loadProfiles(profilesPath), []);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('seedProfilesFromPiConfig', () => {
  it('yields one profile per provider entry with pi config shape', () => {
    const seeds = seedProfilesFromPiConfig({
      providers: {
        'sabah-ai': {
          baseUrl: 'https://vibing.softyan.net/v1',
          api: 'openai-completions',
          apiKey: 'sk-test',
          models: [{ id: 'gemini' }]
        },
        ollama: {
          baseUrl: 'http://localhost:11434/v1'
        }
      }
    });

    assert.equal(seeds.length, 2);

    const sabah = seeds[0];
    assert.equal(sabah.name, 'sabah-ai');
    assert.equal(sabah.providerId, 'sabah-ai');
    assert.equal(sabah.baseUrl, 'https://vibing.softyan.net/v1');
    assert.equal(sabah.api, 'openai-completions');
    assert.equal(sabah.apiKey, 'sk-test');
    assertIsoTimestamp(sabah.savedAt);

    const ollama = seeds[1];
    assert.equal(ollama.name, 'ollama');
    assert.equal(ollama.providerId, 'ollama');
    assert.equal(ollama.baseUrl, 'http://localhost:11434/v1');
    assert.equal(ollama.api, 'openai-completions');
    assert.equal(ollama.apiKey, '');
  });

  it('returns empty array for null or empty config', () => {
    assert.deepEqual(seedProfilesFromPiConfig(null), []);
    assert.deepEqual(seedProfilesFromPiConfig({}), []);
    assert.deepEqual(seedProfilesFromPiConfig({ providers: {} }), []);
  });
});

describe('seedProfilesFromOpenCodeConfig', () => {
  it('yields one profile per provider entry reading options.baseURL and options.apiKey', () => {
    const seeds = seedProfilesFromOpenCodeConfig({
      provider: {
        'sabah-ai': {
          name: 'Sabah AI',
          options: {
            baseURL: 'https://vibing.softyan.net/v1',
            apiKey: 'sk-test'
          },
          models: {
            'model-1': { name: 'Model 1' }
          }
        },
        ollama: {
          models: {}
        }
      }
    });

    assert.equal(seeds.length, 2);

    const sabah = seeds[0];
    assert.equal(sabah.name, 'sabah-ai');
    assert.equal(sabah.providerId, 'sabah-ai');
    assert.equal(sabah.baseUrl, 'https://vibing.softyan.net/v1');
    assert.equal(sabah.apiKey, 'sk-test');
    assert.equal(sabah.api, 'openai-completions');
    assertIsoTimestamp(sabah.savedAt);

    const ollama = seeds[1];
    assert.equal(ollama.name, 'ollama');
    assert.equal(ollama.providerId, 'ollama');
    assert.equal(ollama.baseUrl, '');
    assert.equal(ollama.apiKey, '');
    assert.equal(ollama.api, 'openai-completions');
  });

  it('returns empty array for null or empty config', () => {
    assert.deepEqual(seedProfilesFromOpenCodeConfig(null), []);
    assert.deepEqual(seedProfilesFromOpenCodeConfig({}), []);
    assert.deepEqual(seedProfilesFromOpenCodeConfig({ provider: {} }), []);
  });
});

describe('mergeProfiles', () => {
  it('keeps existing entries untouched and appends new seeds with their own savedAt', () => {
    const existing = [
      { name: 'sabah-ai', providerId: 'sabah-ai', baseUrl: 'kept.example/v1', api: 'openai-completions', apiKey: 'kept', savedAt: '2026-01-01T00:00:00.000Z' }
    ];
    const incoming = [
      { name: 'sabah-ai', providerId: 'sabah-ai', baseUrl: 'incoming.example/v1', api: 'openai-completions', apiKey: 'incoming', savedAt: '2026-01-02T00:00:00.000Z' },
      { name: 'ollama', providerId: 'ollama', baseUrl: 'http://localhost:11434/v1', api: 'openai-completions', apiKey: '', savedAt: '2026-01-03T00:00:00.000Z' }
    ];

    const merged = mergeProfiles(existing, incoming);

    assert.equal(merged.length, 2);
    // existing wins, completely untouched
    assert.deepEqual(merged[0], existing[0]);
    // incoming seed appended with its own savedAt
    assert.deepEqual(merged[1], incoming[1]);
  });

  it('appends only non-duplicate seeds when names collide', () => {
    const existing = [
      { name: 'a', savedAt: '2026-01-01T00:00:00.000Z' },
      { name: 'b', savedAt: '2026-01-02T00:00:00.000Z' }
    ];
    const incoming = [
      { name: 'b', savedAt: '2026-01-03T00:00:00.000Z' },
      { name: 'c', savedAt: '2026-01-04T00:00:00.000Z' }
    ];

    const merged = mergeProfiles(existing, incoming);
    assert.deepEqual(merged.map((p) => p.name), ['a', 'b', 'c']);
    assert.equal(merged[1].savedAt, '2026-01-02T00:00:00.000Z');
  });

  it('handles empty or null inputs without mutating arguments', () => {
    const existing = [{ name: 'a', savedAt: '2026-01-01T00:00:00.000Z' }];
    const incoming = [{ name: 'b', savedAt: '2026-01-02T00:00:00.000Z' }];

    assert.deepEqual(mergeProfiles(null, incoming), incoming);
    assert.deepEqual(mergeProfiles(existing, null), existing);
    assert.deepEqual(mergeProfiles([], []), []);

    const merged = mergeProfiles(existing, incoming);
    assert.deepEqual(existing, [{ name: 'a', savedAt: '2026-01-01T00:00:00.000Z' }]);
    assert.deepEqual(incoming, [{ name: 'b', savedAt: '2026-01-02T00:00:00.000Z' }]);
    assert.deepEqual(merged.map((p) => p.name), ['a', 'b']);
  });
});
