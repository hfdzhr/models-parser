import { loadProfiles, upsertProfile, getProfilesPath } from '../src/profiles.js';
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

  const profilesFilePath = getProfilesPath();

  if (req.method === 'GET') {
    try {
      const profiles = await loadProfiles(profilesFilePath);
      return sendJson(res, 200, { profiles });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const { name, providerId, baseUrl, api, apiKey } = body;

    if (typeof name !== 'string' || name.trim() === '') {
      return sendJson(res, 400, { error: 'Profile name is required and must be non-empty' });
    }

    for (const field of ['providerId', 'baseUrl', 'api', 'apiKey']) {
      if (body[field] !== undefined && typeof body[field] !== 'string') {
        return sendJson(res, 400, { error: `Profile ${field} must be a string` });
      }
    }

    try {
      const profile = await upsertProfile({ name, providerId, baseUrl, api, apiKey }, profilesFilePath);
      return sendJson(res, 200, { ok: true, profile });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}
