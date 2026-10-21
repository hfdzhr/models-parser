import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../src/server.js';
import { getProfilesPath } from '../src/profiles.js';

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
