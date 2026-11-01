import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiServer = path.join(here, '..', 'api-server');
const require = createRequire(path.join(apiServer, 'package.json'));

if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'aranyavalue-demo-vercel';
if (process.env.VERCEL) {
  const live = '/tmp/aranyavalue.db';
  if (!fs.existsSync(live)) fs.copyFileSync(path.join(here, 'demo.db'), live);
  process.env.ARANYA_DB_PATH = live;
}

const express = require('express');
const authRouter = require(path.join(apiServer, 'routes', 'auth.js'));
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', authRouter);

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
