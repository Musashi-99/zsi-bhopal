const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const frontend = path.join(__dirname, '..');
const src = path.join(frontend, '..', 'backend');
const dest = path.join(frontend, 'api-server');
const dbPath = path.join(dest, 'db', 'demo.db');

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, {
  recursive: true,
  filter: (from) => {
    const rel = from.slice(src.length);
    if (rel.split(path.sep).includes('node_modules')) return false;
    if (rel.split(path.sep).includes('test')) return false;
    if (rel.endsWith('.db') || rel.endsWith('.db-shm') || rel.endsWith('.db-wal')) return false;
    if (path.basename(from) === '.env') return false;
    return true;
  },
});

execSync('npm install --omit=dev', { cwd: dest, stdio: 'inherit' });
execSync('node db/seed.js', {
  cwd: dest,
  stdio: 'inherit',
  env: {
    ...process.env,
    ARANYA_DB_PATH: dbPath,
    JWT_SECRET: process.env.JWT_SECRET || 'aranyavalue-demo-vercel',
  },
});
const { DatabaseSync } = require('node:sqlite');
const seeded = new DatabaseSync(dbPath);
seeded.exec('PRAGMA wal_checkpoint(TRUNCATE)');
seeded.close();
fs.copyFileSync(dbPath, path.join(frontend, 'api', 'demo.db'));
