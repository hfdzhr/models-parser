import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import {
  fetchModels,
  extractModelsList,
  toPiConfig,
  toOpenCodeConfig,
  applyToPiConfig,
  applyToOpenCodeConfig,
  getPiConfigPath,
  getOpenCodeConfigPath
} from './index.js';
import { getProfilesPath, loadProfiles, upsertProfile, seedProfilesFromPiConfig, seedProfilesFromOpenCodeConfig } from './profiles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_DIR = path.join(__dirname, 'web');

// Module-level override so tests (or embedders) can point the profile
// routes at a custom profiles.json before mounting. Defaults to the
// real user-level profiles path.
let profilesFilePath = getProfilesPath();

/**
 * Point the profile routes at a different profiles.json file.
 * Pass null/undefined (or omit) to restore the default path.
 */
export function setProfilesFilePath(customPath) {
  profilesFilePath = customPath || getProfilesPath();
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

async function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        // 20MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error(`Invalid JSON body: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

/**
 * Derive one provider profile from a saved config: the first provider
 * entry of the Pi config (or the OpenCode config as fallback) becomes a
 * profile named after that providerId, carrying its baseUrl and apiKey.
 * Reuses the seed helpers from profiles.js so the config-shape knowledge
 * lives in one place.
 */
function deriveSavedProfile(piConfig, opencodeConfig) {
  const [saved] = [
    ...seedProfilesFromPiConfig(piConfig),
    ...seedProfilesFromOpenCodeConfig(opencodeConfig)
  ];
  return saved ?? null;
}

export function createServer() {
  return http.createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    try {
      // API Routes
      if (pathname === '/api/status' && req.method === 'GET') {
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
          pi: { path: piPath, exists: piExists },
          opencode: { path: opencodePath, exists: opencodeExists }
        });
      }

      if (pathname === '/api/fetch' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const { baseUrl, apiKey, timeoutMs } = body;

        if (!baseUrl) {
          return sendJson(res, 400, { error: 'Base URL is required' });
        }

        const result = await fetchModels({ baseUrl, apiKey, timeoutMs });
        return sendJson(res, 200, {
          ok: true,
          url: result.url,
          count: result.models.length,
          models: result.models,
          rawResponse: result.rawResponse
        });
      }

      if (pathname === '/api/parse' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const {
          providerId = 'custom-provider',
          baseUrl = '',
          api = 'openai-completions',
          apiKey = '',
          models = [],
          selectedModelIds = null
        } = body;

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
      }

      if (pathname === '/api/save' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const { piConfig, opencodeConfig, savePi, saveOpenCode } = body;

        const results = {};

        if (savePi && piConfig) {
          const p = await applyToPiConfig(piConfig);
          results.piSavedPath = p;
        }

        if (saveOpenCode && opencodeConfig) {
          const p = await applyToOpenCodeConfig(opencodeConfig);
          results.opencodeSavedPath = p;
        }

        // Remember the saved provider as a profile. A profiles failure
        // (unreadable file, bad shape, ...) must never break the save
        // response, so it is logged as a warning instead.
        try {
          const savedProfile = deriveSavedProfile(piConfig, opencodeConfig);
          if (savedProfile) {
            await upsertProfile(savedProfile, profilesFilePath);
          }
        } catch (err) {
          console.warn('Could not update provider profiles after save:', err.message);
        }

        return sendJson(res, 200, { ok: true, ...results });
      }

      if (pathname === '/api/profiles' && req.method === 'GET') {
        const profiles = await loadProfiles(profilesFilePath);
        return sendJson(res, 200, { profiles });
      }

      if (pathname === '/api/profiles' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const { name, providerId, baseUrl, api, apiKey } = body;

        if (typeof name !== 'string' || name.trim() === '') {
          return sendJson(res, 400, { error: 'Profile name is required and must be non-empty' });
        }

        for (const field of ['providerId', 'baseUrl', 'api', 'apiKey']) {
          if (body[field] !== undefined && typeof body[field] !== 'string') {
            return sendJson(res, 400, { error: `Profile ${field} must be a string` });
          }
        }

        const profile = await upsertProfile({ name, providerId, baseUrl, api, apiKey }, profilesFilePath);
        return sendJson(res, 200, { ok: true, profile });
      }

      // Static File Serving
      let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
      const filePath = path.join(WEB_DIR, relativePath);

      // Prevent directory traversal
      if (!filePath.startsWith(WEB_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      try {
        const fileContent = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(fileContent);
      } catch (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.error('Server error:', err);
      sendJson(res, 500, { error: err.message });
    }
  });
}

export async function startServer(port = 3001) {
  const server = createServer();
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log();
      console.log(pc.bold(pc.green(`Config Models Parser Web UI is running!`)));
      console.log(pc.cyan(`Open in browser: `) + pc.bold(pc.underline(`http://localhost:${port}`)));
      console.log(pc.gray(`Press Ctrl+C to stop the server.`));
      console.log();
      resolve(server);
    });
  });
}

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const port = parseInt(process.env.PORT, 10) || 3001;
  startServer(port);
}
