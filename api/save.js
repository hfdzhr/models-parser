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

  return sendJson(res, 400, {
    error: 'Cloud deployment detected: Direct save to local files is disabled on Vercel. Please use Copy or Download instead.'
  });
}
