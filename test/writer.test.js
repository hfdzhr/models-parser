import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  mergePiConfig,
  mergeOpenCodeConfig,
  applyToPiConfig,
  applyToOpenCodeConfig,
  readJsonFile,
  writeJsonFile
} from '../src/config-writer.js';

describe('applyToPiConfig and applyToOpenCodeConfig with custom path', () => {
  it('creates file and updates properly in custom directory', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
    const piPath = path.join(tmpDir, 'models.json');
    const opencodePath = path.join(tmpDir, 'opencode.json');

    try {
      await applyToPiConfig({
        providers: {
          testProv: { baseUrl: 'https://test', api: 'openai-completions', models: [] }
        }
      }, piPath);

      const savedPi = await readJsonFile(piPath);
      assert.ok(savedPi.providers.testProv);

      await applyToOpenCodeConfig({
        provider: {
          testProv: { name: 'Test', models: {} }
        }
      }, opencodePath);

      const savedOpencode = await readJsonFile(opencodePath);
      assert.ok(savedOpencode.provider.testProv);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('mergePiConfig', () => {
  it('merges new provider into existing providers without erasing others', () => {
    const existing = {
      providers: {
        existingProvider: {
          baseUrl: 'http://localhost:11434/v1',
          api: 'openai-completions',
          apiKey: 'ollama',
          models: [{ id: 'llama3' }]
        }
      }
    };

    const newConf = {
      providers: {
        'sabah-ai': {
          baseUrl: 'https://vibing.softyan.net/v1',
          api: 'openai-completions',
          apiKey: 'sk-test',
          models: [{ id: 'gemini' }]
        }
      }
    };

    const merged = mergePiConfig(existing, newConf);

    assert.ok(merged.providers.existingProvider);
    assert.ok(merged.providers['sabah-ai']);
    assert.strictEqual(merged.providers['sabah-ai'].baseUrl, 'https://vibing.softyan.net/v1');
    assert.strictEqual(merged.providers.existingProvider.models[0].id, 'llama3');
  });

  it('handles empty or null existing config', () => {
    const newConf = {
      providers: {
        'sabah-ai': {
          baseUrl: 'https://vibing.softyan.net/v1',
          models: []
        }
      }
    };

    const merged = mergePiConfig(null, newConf);
    assert.ok(merged.providers['sabah-ai']);
  });
});

describe('mergeOpenCodeConfig', () => {
  it('merges new provider while preserving plugins and other top-level keys', () => {
    const existing = {
      $schema: 'https://opencode.ai/config.json',
      plugin: ['some-plugin'],
      provider: {
        google: {
          models: {}
        }
      }
    };

    const newConf = {
      provider: {
        'sabah-ai': {
          name: 'Sabah AI',
          options: {
            baseURL: 'https://vibing.softyan.net/v1'
          },
          models: {
            'model-1': { name: 'Model 1' }
          }
        }
      }
    };

    const merged = mergeOpenCodeConfig(existing, newConf);

    assert.strictEqual(merged.$schema, 'https://opencode.ai/config.json');
    assert.deepStrictEqual(merged.plugin, ['some-plugin']);
    assert.ok(merged.provider.google);
    assert.ok(merged.provider['sabah-ai']);
    assert.ok(merged.provider['sabah-ai'].models['model-1']);
  });
});

describe('Rolling backups', () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Sibling files matching <basename>.bak-<ts>[-<n>]; plain .bak excluded.
  const backupPattern = (name) =>
    new RegExp(`^${escapeRegExp(name)}\\.bak-\\d+(-\\d+)?$`);

  async function readBackups(dir, name) {
    const entries = await fs.readdir(dir);
    const pattern = backupPattern(name);
    return Promise.all(entries
      .filter((entry) => pattern.test(entry))
      .map(async (entry) => ({
        file: entry,
        ts: Number(entry.match(/\.bak-(\d+)/)[1]),
        suffix: Number((entry.match(/\.bak-\d+(?:-(\d+))?$/)?.[1]) || 0),
        data: JSON.parse(await fs.readFile(path.join(dir, entry), 'utf8'))
      })));
  }

  // Newest first: highest timestamp, then highest collision suffix.
  const newestFirst = (a, b) => (b.ts - a.ts) || (b.suffix - a.suffix);

  it('first write to nonexistent file leaves zero .bak-* files', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bak-test-'));
    const file = path.join(tmpDir, 'models.json');

    try {
      const result = await writeJsonFile(file, { n: 1 });
      assert.strictEqual(result, file);

      const backups = await readBackups(tmpDir, 'models.json');
      assert.strictEqual(backups.length, 0);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('second write creates exactly one .bak-<ts> whose content equals the previous original content', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bak-test-'));
    const file = path.join(tmpDir, 'models.json');

    try {
      await writeJsonFile(file, { n: 1 });
      await sleep(5);
      await writeJsonFile(file, { n: 2 });

      const backups = await readBackups(tmpDir, 'models.json');
      assert.strictEqual(backups.length, 1);
      assert.match(backups[0].file, /\.bak-\d+$/);
      assert.deepStrictEqual(backups[0].data, { n: 1 });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('with maxBackups=2 after four writes only two newest remain and newest equals the second-to-last previous content', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bak-test-'));
    const file = path.join(tmpDir, 'models.json');

    try {
      await writeJsonFile(file, { n: 1 }, { maxBackups: 2 });
      await sleep(5);
      await writeJsonFile(file, { n: 2 }, { maxBackups: 2 });
      await sleep(5);
      await writeJsonFile(file, { n: 3 }, { maxBackups: 2 });
      await sleep(5);
      await writeJsonFile(file, { n: 4 }, { maxBackups: 2 });

      const backups = (await readBackups(tmpDir, 'models.json')).sort(newestFirst);
      assert.strictEqual(backups.length, 2);
      // newest backup holds the second-to-last written content (c3), one step behind the live file
      assert.deepStrictEqual(backups[0].data, { n: 3 });
      assert.deepStrictEqual(backups[1].data, { n: 2 });

      const live = JSON.parse(await fs.readFile(file, 'utf8'));
      assert.deepStrictEqual(live, { n: 4 });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('createBackup=false creates none', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bak-test-'));
    const file = path.join(tmpDir, 'models.json');

    try {
      await fs.writeFile(file, JSON.stringify({ n: 0 }, null, 2) + '\n', 'utf8');
      await sleep(5);
      await writeJsonFile(file, { n: 1 }, { createBackup: false });

      const backups = await readBackups(tmpDir, 'models.json');
      assert.strictEqual(backups.length, 0);

      const after = JSON.parse(await fs.readFile(file, 'utf8'));
      assert.deepStrictEqual(after, { n: 1 });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('a pre-existing plain .bak file survives untouched', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bak-test-'));
    const file = path.join(tmpDir, 'models.json');
    const plainBak = `${file}.bak`;

    try {
      await writeJsonFile(file, { n: 1 });
      await fs.writeFile(plainBak, 'legacy snapshot', 'utf8');

      await sleep(5);
      await writeJsonFile(file, { n: 2 });
      await sleep(5);
      await writeJsonFile(file, { n: 3 });
      await sleep(5);
      await writeJsonFile(file, { n: 4 });

      assert.strictEqual(await fs.readFile(plainBak, 'utf8'), 'legacy snapshot');

      const backups = await readBackups(tmpDir, 'models.json');
      assert.ok(backups.length > 0);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('with default maxBackups=5 after seven writes exactly five remain', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bak-test-'));
    const file = path.join(tmpDir, 'models.json');

    try {
      for (let n = 1; n <= 7; n++) {
        await writeJsonFile(file, { n });
        await sleep(5);
      }

      const backups = (await readBackups(tmpDir, 'models.json')).sort(newestFirst);
      assert.strictEqual(backups.length, 5);
      assert.deepStrictEqual(backups[0].data, { n: 6 });
      assert.deepStrictEqual(backups[4].data, { n: 2 });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('same-timestamp collision names suffixes -1, -2, ... in order', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bak-test-'));
    const file = path.join(tmpDir, 'models.json');
    const fixed = Date.now() - 1000;
    const clock = mock.method(Date, 'now', () => fixed);

    try {
      await writeJsonFile(file, { n: 1 });
      await writeJsonFile(file, { n: 2 });
      await writeJsonFile(file, { n: 3 }); // candidate bak-<fixed> exists -> bak-<fixed>-1

      const backups = (await readBackups(tmpDir, 'models.json')).sort(newestFirst);
      assert.deepEqual(backups.map((b) => b.file), [
        `models.json.bak-${fixed}-1`, // newest by suffix tie-break
        `models.json.bak-${fixed}`
      ]);
      assert.deepStrictEqual(backups[0].data, { n: 2 });
      assert.deepStrictEqual(backups[1].data, { n: 1 });
      assert.deepStrictEqual(JSON.parse(await fs.readFile(file, 'utf8')), { n: 3 });
    } finally {
      clock.mock.restore();
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('prune tie-break keeps higher collision suffix over plain sibling', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bak-test-'));
    const file = path.join(tmpDir, 'models.json');

    try {
      await writeJsonFile(file, { n: 1 });
      await sleep(5);
      await writeJsonFile(file, { n: 2 });
      await sleep(5);

      // Fabricate a same-timestamp collision sibling of the newest backup.
      const plainNewest = (await readBackups(tmpDir, 'models.json')).sort(newestFirst)[0];
      const plainName = plainNewest.file; // e.g. models.json.bak-<ts2>
      const collisionName = plainName.replace(/\.bak-(\d+)$/, '.bak-$1-2');
      await fs.writeFile(
        path.join(tmpDir, collisionName),
        JSON.stringify({ sentinel: 'collision' }),
        'utf8'
      );

      await writeJsonFile(file, { n: 3 }, { maxBackups: 2 });

      const backups = (await readBackups(tmpDir, 'models.json')).sort(newestFirst);
      const names = backups.map((b) => b.file);
      assert.strictEqual(backups.length, 2);
      assert.ok(names.some((f) => f.endsWith('-2')), 'collision sibling must survive the prune');
      assert.ok(!names.includes(plainName), 'plain newest sibling pruned away');
      const collision = backups.find((b) => b.file === collisionName);
      assert.deepStrictEqual(collision.data, { sentinel: 'collision' });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
