import { fetchModels } from '../src/index.js';
import { sendJson, parseBody } from './_utils.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead?.(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end?.();
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const body = parseBody(req);
  const { baseUrl, apiKey, timeoutMs } = body;

  if (!baseUrl) {
    return sendJson(res, 400, { error: 'Base URL is required' });
  }

  try {
    const result = await fetchModels({ baseUrl, apiKey, timeoutMs });
    return sendJson(res, 200, {
      ok: true,
      url: result.url,
      count: result.models.length,
      models: result.models,
      rawResponse: result.rawResponse
    });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
