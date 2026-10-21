import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../src/server.js';
import { getProfilesPath } from '../src/profiles.js';
import statusHandler from '../api/status.js';
import fetchHandler from '../api/fetch.js';
import parseHandler from '../api/parse.js';
import saveHandler from '../api/save.js';
import profilesHandler from '../api/profiles.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers || {};
      return this;
    },
    end(data) {
      if (data && !this.body) {
        try {
          this.body = JSON.parse(data);
        } catch {
          this.body = data;
        }
      }
      return this;
    }
  };
  return res;
}

const SERVERS = [];

async function mountServer() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  SERVERS.push(server);
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

after(async () => {
  await Promise.all(SERVERS.map(async (server) => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }));
});

describe('Vercel environment mode', () => {
  it('detects cloud mode in GET /api/status when process.env.VERCEL is set', async () => {
    const origVercel = process.env.VERCEL;
    try {
      process.env.VERCEL = '1';
      const { baseUrl } = await mountServer();
      const res = await fetch(`${baseUrl}/api/status`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.cloud, true);
    } finally {
      if (origVercel === undefined) {
        delete process.env.VERCEL;
      } else {
        process.env.VERCEL = origVercel;
      }
    }
  });

  it('rejects POST /api/save with informative 400 when process.env.VERCEL is set', async () => {
    const origVercel = process.env.VERCEL;
    try {
      process.env.VERCEL = '1';
      const { baseUrl } = await mountServer();
      const res = await fetch(`${baseUrl}/api/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piConfig: {}, savePi: true })
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('Cloud deployment detected'));
    } finally {
      if (origVercel === undefined) {
        delete process.env.VERCEL;
      } else {
        process.env.VERCEL = origVercel;
      }
    }
  });

  it('getProfilesPath uses os.tmpdir() when process.env.VERCEL is set', () => {
    const origVercel = process.env.VERCEL;
    try {
      process.env.VERCEL = '1';
      assert.equal(
        getProfilesPath(),
        path.join(os.tmpdir(), '.config', 'config-models-parser', 'profiles.json')
      );
    } finally {
      if (origVercel === undefined) {
        delete process.env.VERCEL;
      } else {
        process.env.VERCEL = origVercel;
      }
    }
  });
});

describe('Vercel API Serverless Handlers', () => {
  it('api/status returns cloud: true and config paths', async () => {
    const req = { method: 'GET' };
    const res = createMockRes();
    await statusHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.cloud, true);
    assert.ok(res.body.pi);
    assert.ok(res.body.opencode);
  });

  it('api/status rejects non-GET with 405', async () => {
    const req = { method: 'POST' };
    const res = createMockRes();
    await statusHandler(req, res);
    assert.equal(res.statusCode, 405);
  });

  it('api/save returns 400 with cloud guidance', async () => {
    const req = { method: 'POST', body: {} };
    const res = createMockRes();
    await saveHandler(req, res);
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.includes('Cloud deployment detected'));
  });

  it('api/fetch requires baseUrl', async () => {
    const req = { method: 'POST', body: {} };
    const res = createMockRes();
    await fetchHandler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'Base URL is required');
  });

  it('api/parse transforms model list into Pi and OpenCode configs', async () => {
    const req = {
      method: 'POST',
      body: {
        providerId: 'my-prov',
        baseUrl: 'https://test.api/v1',
        apiKey: 'sk-test',
        models: [
          { id: 'test-model', context_length: 8192 }
        ]
      }
    };
    const res = createMockRes();
    await parseHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.modelCount, 1);
    assert.ok(res.body.piConfig.providers['my-prov']);
    assert.ok(res.body.opencodeConfig.provider['my-prov']);
  });

  it('api/profiles handles GET and rejects invalid POST', async () => {
    const reqGet = { method: 'GET' };
    const resGet = createMockRes();
    await profilesHandler(reqGet, resGet);
    assert.equal(resGet.statusCode, 200);
    assert.ok(Array.isArray(resGet.body.profiles));

    const reqPostBad = { method: 'POST', body: { name: '' } };
    const resPostBad = createMockRes();
    await profilesHandler(reqPostBad, resPostBad);
    assert.equal(resPostBad.statusCode, 400);
  });
});
