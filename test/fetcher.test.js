import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildModelsUrl } from '../src/fetcher.js';

describe('buildModelsUrl', () => {
  it('appends /models if baseUrl ends with /v1', () => {
    assert.strictEqual(
      buildModelsUrl('https://vibing.softyan.net/v1'),
      'https://vibing.softyan.net/v1/models'
    );
    assert.strictEqual(
      buildModelsUrl('https://vibing.softyan.net/v1/'),
      'https://vibing.softyan.net/v1/models'
    );
  });

  it('leaves url intact if already ending with /models', () => {
    assert.strictEqual(
      buildModelsUrl('https://vibing.softyan.net/v1/models'),
      'https://vibing.softyan.net/v1/models'
    );
    assert.strictEqual(
      buildModelsUrl('https://vibing.softyan.net/v1/models/'),
      'https://vibing.softyan.net/v1/models'
    );
  });

  it('appends /v1/models if root domain given', () => {
    assert.strictEqual(
      buildModelsUrl('https://vibing.softyan.net'),
      'https://vibing.softyan.net/v1/models'
    );
  });
});
