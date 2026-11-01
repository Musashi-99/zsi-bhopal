import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const bundled = path.join(here, 'demo.db');
const live = '/tmp/aranyavalue.db';

if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'aranyavalue-demo-vercel';
if (process.env.VERCEL) {
  if (!fs.existsSync(live)) fs.copyFileSync(bundled, live);
  process.env.ARANYA_DB_PATH = live;
}

const app = require(path.join(here, '..', 'api-server', 'server.js'));

export default function handler(req, res) {
  const url = req.url || '/';
  if (!url.startsWith('/api')) req.url = `/api${url.startsWith('/') ? url : `/${url}`}`;
  return app(req, res);
}
