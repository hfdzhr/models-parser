import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatModelName, formatProviderName } from '../src/formatter.js';

describe('formatModelName', () => {
  it('formats gemini models with ag prefix', () => {
    assert.strictEqual(
      formatModelName('gs/ag/gemini-3.8-flash-high', 'ag/gemini-3.8-flash-high'),
      'Ag/Gemini 3.8 Flash High'
    );
    assert.strictEqual(
      formatModelName('gs/ag/gemini-3-flash', 'ag/gemini-3-flash'),
      'Ag/Gemini 3 Flash'
    );
    assert.strictEqual(
      formatModelName('gs/ag/gemini-3.5-flash-extra-low', 'ag/gemini-3.5-flash-extra-low'),
      'Ag/Gemini 3.5 Flash Extra Low'
    );
  });

  it('formats claude models with cc prefix and removes date suffix', () => {
    assert.strictEqual(
      formatModelName('9dak/cc/claude-haiku-4-5-20251001', 'cc/claude-haiku-4-5-20251001'),
      'Cc/Claude Haiku 4.5'
    );
    assert.strictEqual(
      formatModelName('9dak/cc/claude-opus-5', 'cc/claude-opus-5'),
      'Cc/Claude Opus 5'
    );
  });

  it('formats models with gc prefix', () => {
    assert.strictEqual(
      formatModelName('gs/gc/gemini-2.5-flash-lite', 'gc/gemini-2.5-flash-lite'),
      'Gc/Gemini 2.5 Flash Lite'
    );
  });

  it('formats models without prefix', () => {
    assert.strictEqual(formatModelName('gpt-4o'), 'GPT 4o');
    assert.strictEqual(formatModelName('claude-3-7-sonnet'), 'Claude 3.7 Sonnet');
    assert.strictEqual(formatModelName('deepseek-r1'), 'DeepSeek R1');
  });

  it('handles models where rawName is empty or same as id', () => {
    assert.strictEqual(
      formatModelName('gs/ag/gemini-3-flash-agent', null),
      'Ag/Gemini 3 Flash Agent'
    );
  });
});

describe('formatProviderName', () => {
  it('formats kebab-case provider id to Title Case', () => {
    assert.strictEqual(formatProviderName('sabah-ai'), 'Sabah AI');
    assert.strictEqual(formatProviderName('open-router'), 'Open Router');
    assert.strictEqual(formatProviderName('my_custom_provider'), 'My Custom Provider');
  });
});
