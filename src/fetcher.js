import { extractModelsList } from './parser.js';

/**
 * Normalizes baseUrl and computes the models endpoint URL
 */
export function buildModelsUrl(baseUrl) {
  if (!baseUrl) throw new Error('Base URL is required');

  let trimmed = baseUrl.trim().replace(/\/+$/, '');

  if (trimmed.endsWith('/models')) {
    return trimmed;
  }

  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/models`;
  }

  if (/\/v1(\/.*)?$/.test(trimmed)) {
    return `${trimmed}/models`;
  }

  return `${trimmed}/v1/models`;
}

/**
 * Fetch models from remote API endpoint
 */
export async function fetchModels({
  baseUrl,
  apiKey = '',
  customHeaders = {},
  timeoutMs = 30000
}) {
  const url = buildModelsUrl(baseUrl);

  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs / 1000}s`);
    }
    throw new Error(`Network error connecting to ${url}: ${err.message}`);
  }

  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Invalid JSON response from ${url} (HTTP ${response.status}): ${responseText.slice(0, 200)}`
    );
  }

  if (!response.ok) {
    const errorMsg =
      data?.error?.message ||
      data?.message ||
      `HTTP ${response.status} ${response.statusText}`;
    throw new Error(`API Error from ${url}: ${errorMsg}`);
  }

  const models = extractModelsList(data);

  return {
    url,
    status: response.status,
    rawResponse: data,
    models
  };
}
