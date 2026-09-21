import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  mergePiConfig,
  mergeOpenCodeConfig,
  applyToPiConfig,
  applyToOpenCodeConfig,
  readJsonFile
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
