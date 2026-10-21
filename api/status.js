import fs from 'node:fs/promises';
import { getPiConfigPath, getOpenCodeConfigPath } from '../src/index.js';
import { sendJson } from './_utils.js';

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

  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const piPath = getPiConfigPath();
  const opencodePath = getOpenCodeConfigPath();

  let piExists = false;
  try {
    await fs.access(piPath);
    piExists = true;
  } catch {}

  let opencodeExists = false;
  try {
    await fs.access(opencodePath);
    opencodeExists = true;
  } catch {}

  return sendJson(res, 200, {
    cloud: true,
    pi: { path: piPath, exists: piExists },
    opencode: { path: opencodePath, exists: opencodeExists }
  });
}
