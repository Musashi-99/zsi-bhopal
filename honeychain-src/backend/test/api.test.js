const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, 'tmp-api.db');
process.env.ARANYA_DB_PATH = TEST_DB;
process.env.HONEYCHAIN_DB_PATH = TEST_DB;
process.env.JWT_SECRET = 'test-secret-for-api-test-only';

for (const ext of ['', '-shm', '-wal']) {
  try { fs.rmSync(TEST_DB + ext, { force: true }); } catch { /* ignore */ }
}

const app = require('../server');
const db = require('../db/db');
const { hashPassword } = require('../services/auth');

let baseUrl;
let server;

async function login(email) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'testpass123' }),
  });
  const cookie = res.headers.getSetCookie?.() || [];
  const raw = cookie[0] || res.headers.get('set-cookie') || '';
  return raw.split(';')[0];
}

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  const now = new Date().toISOString();
  db.exec(`INSERT INTO states (id, name, code, languages, is_active) VALUES ('ST-WB','West Bengal','WB','["en"]',1)`);
  db.exec(`INSERT INTO districts (id, state_id, name, is_active) VALUES ('DT-PUR','ST-WB','Purulia',1)`);
  db.exec(`INSERT INTO products (id, name, category, default_unit, units_json, handling_json, is_active) VALUES ('PR-MAH','Mahua','Flower','kg','["kg"]','{"expected":["drying"],"required":["drying"]}',1)`);
  const pass = hashPassword('testpass123');
  const add = db.prepare(`INSERT INTO users (id, name, email, password_hash, role, active, is_demo, created_at) VALUES (?, ?, ?, ?, ?, 1, 1, ?)`);
  add.run('U-A', 'Collector A', 'a@test.local', pass, 'collector', now);
  add.run('U-B', 'Collector B', 'b@test.local', pass, 'collector', now);
  add.run('U-BUY', 'Buyer', 'buy@test.local', pass, 'buyer', now);
  add.run('U-INS', 'Inspector', 'ins@test.local', pass, 'inspector', now);
  db.prepare(`INSERT INTO batches (id, batch_code, product_id, collector_id, state_id, district_id, quantity, unit, collection_date, status, public_share, source_declaration, created_at, updated_at)
    VALUES ('BT-A','AV-TEST-0001','PR-MAH','U-A','ST-WB','DT-PUR',10,'kg','2026-10-01','pending_verification',1,'declared',?,?)`).run(now, now);
  db.prepare(`INSERT INTO users (id, name, email, phone, password_hash, role, active, created_at) VALUES ('U-PHONE','Secret','phone@test.local','99999',?, 'collector', 1, ?)`).run(pass, now);
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  try { db.close(); } catch { /* ignore */ }
});

test('a collector cannot read another collector private batch and a buyer cannot verify', async () => {
  db.prepare(`INSERT INTO batches (id, batch_code, product_id, collector_id, state_id, district_id, quantity, unit, collection_date, status, public_share, created_at, updated_at)
    VALUES ('BT-PRIV','AV-PRIV','PR-MAH','U-B','ST-WB','DT-PUR',2,'kg','2026-10-01','draft',0,?,?)`).run(new Date().toISOString(), new Date().toISOString());
  const cookie = await login('a@test.local');
  const hidden = await fetch(`${baseUrl}/api/batches/BT-PRIV`, { headers: { cookie } });
  assert.equal(hidden.status, 403);
  const buyer = await login('buy@test.local');
  const verify = await fetch(`${baseUrl}/api/batches/BT-A/verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: buyer },
    body: JSON.stringify({ status: 'verified', summary: 'no' }),
  });
  assert.equal(verify.status, 403);
});

test('public passport hides contact details and an inspector cannot edit offers', async () => {
  db.prepare(`UPDATE users SET phone = '9999911111', email = 'a@test.local' WHERE id = 'U-A'`);
  const pub = await fetch(`${baseUrl}/api/passport/AV-TEST-0001`);
  const body = await pub.json();
  assert.equal(pub.status, 200);
  assert.equal(body.passport.collector.email, undefined);
  assert.equal(body.passport.collector.name, null);
  assert.equal(JSON.stringify(body).includes('9999911111'), false);
  const inspector = await login('ins@test.local');
  const offer = await fetch(`${baseUrl}/api/offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: inspector },
    body: JSON.stringify({ batch_id: 'BT-A', amount: 10, price_unit: 'kg' }),
  });
  assert.equal(offer.status, 403);
});

test('full verification is refused when a required measurement is missing', async () => {
  db.prepare(`UPDATE quality_parameters SET required = 0`).run();
  db.prepare(`INSERT INTO quality_profiles (id, product_id, name, version, illustrative) VALUES ('QP','PR-MAH','List','1',1)`).run();
  db.prepare(`INSERT INTO quality_parameters (id, profile_id, name, unit, required, sort_order) VALUES ('PA','QP','Moisture','%',1,1)`).run();
  const inspector = await login('ins@test.local');
  const res = await fetch(`${baseUrl}/api/batches/BT-A/verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: inspector },
    body: JSON.stringify({ status: 'verified', summary: 'try' }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.match(body.error, /cannot be marked fully verified/);
});
