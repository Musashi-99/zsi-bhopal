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

function originalPath(req) {
  const current = req.url || '/';
  const qIndex = current.indexOf('?');
  const search = qIndex >= 0 ? current.slice(qIndex + 1) : '';
  const params = new URLSearchParams(search);
  const stamped = params.get('__path');
  if (!stamped) return current.startsWith('/api') ? current : `/api${current.startsWith('/') ? current : `/${current}`}`;
  params.delete('__path');
  const rest = params.toString();
  return rest ? `${stamped}?${rest}` : stamped;
}

export default function handler(req, res) {
  req.url = originalPath(req);
  return app(req, res);
}
