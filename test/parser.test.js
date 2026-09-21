import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractModelsList,
  parseModel,
  toPiConfig,
  toOpenCodeConfig
} from '../src/parser.js';

const sampleApiResponse = {
  object: 'list',
  data: [
    {
      id: 'gs/ag/gemini-3.8-flash-high',
      object: 'model',
      created: 1790008210,
      owned_by: 'gs',
      permission: [],
      root: 'ag/gemini-3.8-flash-high',
      parent: null,
      context_length: 1048576,
      capabilities: {
        vision: true,
        tool_calling: true,
        reasoning: true
      },
      input_modalities: ['text', 'image'],
      output_modalities: ['text'],
      name: 'ag/gemini-3.8-flash-high'
    },
    {
      id: 'gs/ag/gemini-3-flash',
      object: 'model',
      created: 1790008210,
      owned_by: 'gs',
      permission: [],
      root: 'ag/gemini-3-flash',
      parent: null,
      context_length: 1048576,
      capabilities: {
        vision: true,
        tool_calling: true,
        reasoning: true
      },
      input_modalities: ['text', 'image'],
      output_modalities: ['text'],
      name: 'ag/gemini-3-flash'
    }
  ]
};

describe('extractModelsList', () => {
  it('extracts list from standard OpenAI object response', () => {
    const list = extractModelsList(sampleApiResponse);
    assert.strictEqual(Array.isArray(list), true);
    assert.strictEqual(list.length, 2);
  });

  it('extracts list from stringified JSON', () => {
    const list = extractModelsList(JSON.stringify(sampleApiResponse));
    assert.strictEqual(list.length, 2);
  });

  it('extracts list from raw array', () => {
    const list = extractModelsList(sampleApiResponse.data);
    assert.strictEqual(list.length, 2);
  });
});

describe('parseModel', () => {
  it('correctly maps raw model to Pi model shape', () => {
    const raw = sampleApiResponse.data[1];
    const parsed = parseModel(raw, { providerApi: 'openai-completions' });

    assert.strictEqual(parsed.id, 'gs/ag/gemini-3-flash');
    assert.strictEqual(parsed.name, 'Ag/Gemini 3 Flash');
    assert.strictEqual(parsed.api, 'openai-completions');
    assert.deepStrictEqual(parsed.input, ['text', 'image']);
    assert.strictEqual(parsed.contextWindow, 1048576);
    assert.strictEqual(parsed.reasoning, true);
  });
});

describe('toPiConfig', () => {
  it('creates complete Pi configuration format', () => {
    const config = toPiConfig({
      providerId: 'sabah-ai',
      baseUrl: 'https://vibing.softyan.net/v1',
      api: 'openai-completions',
      apiKey: 'sk-6b8d16c81d863312-d37acc-47f9ce40',
      models: sampleApiResponse.data
    });

    assert.ok(config.providers['sabah-ai']);
    const provider = config.providers['sabah-ai'];
    assert.strictEqual(provider.baseUrl, 'https://vibing.softyan.net/v1');
    assert.strictEqual(provider.api, 'openai-completions');
    assert.strictEqual(provider.apiKey, 'sk-6b8d16c81d863312-d37acc-47f9ce40');
    assert.strictEqual(provider.models.length, 2);

    const firstModel = provider.models[0];
    assert.strictEqual(firstModel.id, 'gs/ag/gemini-3.8-flash-high');
    assert.strictEqual(firstModel.name, 'Ag/Gemini 3.8 Flash High');
    assert.strictEqual(firstModel.contextWindow, 1048576);
    assert.strictEqual(firstModel.reasoning, true);
  });

  it('filters selected models when selectedModelIds is provided', () => {
    const config = toPiConfig({
      providerId: 'sabah-ai',
      baseUrl: 'https://vibing.softyan.net/v1',
      api: 'openai-completions',
      apiKey: 'sk-6b8d16c81d863312-d37acc-47f9ce40',
      models: sampleApiResponse.data,
      selectedModelIds: ['gs/ag/gemini-3-flash']
    });

    const provider = config.providers['sabah-ai'];
    assert.strictEqual(provider.models.length, 1);
    assert.strictEqual(provider.models[0].id, 'gs/ag/gemini-3-flash');
  });
});

describe('toOpenCodeConfig', () => {
  it('creates complete OpenCode configuration format', () => {
    const config = toOpenCodeConfig({
      providerId: 'sabah-ai',
      baseUrl: 'https://vibing.softyan.net/v1',
      apiKey: 'sk-6b8d16c81d863312-d37acc-47f9ce40',
      models: sampleApiResponse.data
    });

    assert.ok(config.provider['sabah-ai']);
    const provider = config.provider['sabah-ai'];
    assert.strictEqual(provider.name, 'Sabah AI');
    assert.strictEqual(provider.options.baseURL, 'https://vibing.softyan.net/v1');
    assert.strictEqual(provider.options.apiKey, 'sk-6b8d16c81d863312-d37acc-47f9ce40');
    assert.ok(provider.models['gs/ag/gemini-3-flash']);

    const model = provider.models['gs/ag/gemini-3-flash'];
    assert.strictEqual(model.name, 'Ag/Gemini 3 Flash');
    assert.strictEqual(model.limit.context, 1048576);
    assert.strictEqual(model.reasoning, true);
    assert.strictEqual(model.tool_call, true);
  });
});
