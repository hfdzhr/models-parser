import { extractModelsList, toPiConfig, toOpenCodeConfig } from '../src/index.js';
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
  const {
    providerId = 'custom-provider',
    baseUrl = '',
    api = 'openai-completions',
    apiKey = '',
    models = [],
    selectedModelIds = null
  } = body;

  try {
    const rawList = extractModelsList(models);

    const piConfig = toPiConfig({
      providerId,
      baseUrl,
      api,
      apiKey,
      models: rawList,
      selectedModelIds
    });

    const opencodeConfig = toOpenCodeConfig({
      providerId,
      baseUrl,
      apiKey,
      models: rawList,
      selectedModelIds
    });

    return sendJson(res, 200, {
      ok: true,
      piConfig,
      opencodeConfig,
      modelCount: rawList.length
    });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}
