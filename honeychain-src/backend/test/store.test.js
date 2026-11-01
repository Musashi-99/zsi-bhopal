const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, 'tmp-store.db');
process.env.ARANYA_DB_PATH = TEST_DB;
process.env.HONEYCHAIN_DB_PATH = TEST_DB;
process.env.JWT_SECRET = 'test-secret-for-store-test-only';
delete process.env.DEMO_BUYER;

for (const ext of ['', '-shm', '-wal']) {
  try { fs.rmSync(TEST_DB + ext, { force: true }); } catch { /* ignore */ }
}

const app = require('../server');
const db = require('../db/db');
const { hashPassword } = require('../services/auth');

let baseUrl;
let server;

async function login(email, portal) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'testpass123', portal }),
  });
  const raw = (res.headers.getSetCookie?.() || [])[0] || res.headers.get('set-cookie') || '';
  return { status: res.status, cookie: raw.split(';')[0] };
}

async function call(method, url, { cookie, body } = {}) {
  const res = await fetch(`${baseUrl}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})), headers: res.headers };
}

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => { baseUrl = `http://127.0.0.1:${server.address().port}`; resolve(); });
  });
  const now = new Date().toISOString();
  db.exec(`INSERT INTO states (id, name, code, languages, is_active) VALUES ('ST-WB','West Bengal','WB','["en"]',1)`);
  db.exec(`INSERT INTO districts (id, state_id, name, is_active) VALUES ('DT-PUR','ST-WB','Purulia',1)`);
  db.exec(`INSERT INTO market_categories (id, slug, name, description, image, sort_order) VALUES ('MC-MAH','mahua-flowers','Mahua Flowers','d','/img/mahua.jpg',1)`);
  db.exec(`INSERT INTO products (id, name, local_names, category, species_name, default_unit, units_json, handling_json, is_active, market_category_id)
    VALUES ('PR-MAH','Mahua flowers','{"bn":"মহুয়া"}','Flower','Madhuca longifolia','kg','["kg"]','{"expected":["drying"],"required":[]}',1,'MC-MAH')`);
  db.exec(`INSERT INTO centres (id, name, state_id, district_id, is_demo, accreditation_status) VALUES ('CE-T','Test centre','ST-WB','DT-PUR',1,'active')`);
  const pass = hashPassword('testpass123');
  const add = db.prepare(`INSERT INTO users (id, name, email, password_hash, role, centre_id, active, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)`);
  add.run('U-COL', 'Collector', 'col@test.local', pass, 'collector', null, now);
  add.run('U-COL2', 'Other collector', 'col2@test.local', pass, 'collector', null, now);
  add.run('U-CEN', 'Centre op', 'cen@test.local', pass, 'centre', 'CE-T', now);
  add.run('U-BUY1', 'Demo buyer', 'buyer.haat@aranya.demo', pass, 'buyer', null, now);
  add.run('U-BUY', 'Real buyer', 'buy@test.local', pass, 'buyer', null, now);
  add.run('U-INS', 'Inspector', 'ins@test.local', pass, 'inspector', null, now);
  const batch = db.prepare(`INSERT INTO batches (id, batch_code, product_id, collector_id, centre_id, state_id, district_id, quantity, unit, collection_date, status, public_share, source_declaration, created_at, updated_at)
    VALUES (?, ?, 'PR-MAH', 'U-COL', ?, 'ST-WB', 'DT-PUR', ?, 'kg', '2026-10-01', ?, ?, 'declared', ?, ?)`);
  batch.run('BT-1', 'AV-T-0001', 'CE-T', 100, 'verified', 1, now, now);
  batch.run('BT-2', 'AV-T-0002', 'CE-T', 50, 'rejected', 1, now, now);
  batch.run('BT-3', 'AV-T-0003', 'CE-T', 50, 'pending_verification', 0, now, now);
  batch.run('BT-4', 'AV-T-0004', 'CE-T', 40, 'pending_verification', 1, now, now);
  const listing = db.prepare(`INSERT INTO market_listings (batch_id, listed, indicative_price, price_unit, price_updated_at, min_order_qty, is_demo, created_at, updated_at) VALUES (?, 1, 100, 'kg', ?, 10, 1, ?, ?)`);
  for (const id of ['BT-1', 'BT-2', 'BT-3', 'BT-4']) listing.run(id, now, now, now);
  db.prepare(`INSERT INTO verifications (id, batch_id, inspector_id, status, summary, created_at) VALUES ('VF-1','BT-1','U-INS','verified','ok',?)`).run(now);
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  try { db.close(); } catch { /* ignore */ }
});

test('browse is public, hides rejected batches by default and never leaks private batches', async () => {
  const all = await call('GET', '/api/store/listings');
  assert.equal(all.status, 200);
  const codes = all.body.listings.map((l) => l.code);
  assert.ok(codes.includes('AV-T-0001'));
  assert.ok(!codes.includes('AV-T-0002'), 'rejected is not browsable by default');
  assert.ok(!codes.includes('AV-T-0003'), 'a batch that is not shared publicly is never listed');
  const rejected = await call('GET', '/api/store/listings?status=rejected');
  assert.deepEqual(rejected.body.listings.map((l) => l.code), ['AV-T-0002']);
  const priced = await call('GET', '/api/store/listings?min_price=500');
  assert.equal(priced.body.total, 0);
  const search = await call('GET', '/api/store/listings?q=madhuca');
  assert.equal(search.body.total >= 1, true, 'scientific name is searchable');
  assert.equal((await call('GET', '/api/store/listings/AV-T-0003')).status, 404);
});

test('verify resolves real records only and separates invalid format from unknown ids', async () => {
  const ok = await call('GET', '/api/store/verify/av-t-0001');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.status.label, 'Verified by Officer');
  assert.equal(ok.body.flags.lab_tested, false, 'no lab evidence means no lab badge');
  assert.equal(ok.body.flags.centre_checked, false);
  assert.equal(ok.body.integrity.valid, true);
  const unknown = await call('GET', '/api/store/verify/AV-T-9999');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.reason, 'not_found');
  const bad = await call('GET', '/api/store/verify/%3Cscript%3E');
  assert.equal(bad.status, 400);
  const hidden = await call('GET', '/api/store/verify/AV-T-0003');
  assert.equal(hidden.body.public_record, false);
  assert.equal(hidden.body.batch, undefined, 'private batches expose no details');
});

test('lab and centre badges only appear once matching evidence exists', async () => {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO inspection_records (id, batch_id, parameter_name, value, unit, evidence_source, inspector_id, lab_report_ref, created_at)
    VALUES ('IR-1','BT-1','Moisture',9,'%','laboratory','U-INS','LAB-1',?)`).run(now);
  db.prepare(`INSERT INTO measurements (id, batch_id, parameter_name, value, unit, evidence_source, recorded_by, created_at)
    VALUES ('MS-1','BT-1','Moisture',10,'%','measured','U-CEN',?)`).run(now);
  const v = await call('GET', '/api/store/verify/AV-T-0001');
  assert.equal(v.body.flags.lab_tested, true);
  assert.equal(v.body.flags.centre_checked, true);
  const types = v.body.quality.map((q) => q.source_type).sort();
  assert.deepEqual(types, ['centre_checked', 'laboratory_tested']);
  const lab = await call('GET', '/api/store/listings?lab=1');
  assert.deepEqual(lab.body.listings.map((l) => l.code), ['AV-T-0001']);
});

test('demo buyer access needs non-empty credentials, never creates an account and is the predefined buyer', async () => {
  const before = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const empty = await call('POST', '/api/store/demo-login', { body: { email: '', password: '' } });
  assert.equal(empty.status, 400);
  const any = await call('POST', '/api/store/demo-login', { body: { email: 'whoever@example.com', password: 'x' } });
  assert.equal(any.status, 200);
  assert.equal(any.body.user.id, 'U-BUY1');
  assert.equal(any.body.demo, true);
  const oneClick = await call('POST', '/api/store/demo-login', { body: {} });
  assert.equal(oneClick.status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM users').get().c, before, 'no account created');
  const unknownBuyer = await login('nobody@example.com', 'buyer');
  assert.equal(unknownBuyer.status, 401, 'buyer portal sign-in does not auto-create accounts');
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM users').get().c, before);
});

test('enquiry validation, seller negotiation and order creation keep stock honest', async () => {
  const anon = await call('POST', '/api/store/enquiries', { body: { batch_code: 'AV-T-0001', quantity: 10, intended_use: 'x' } });
  assert.equal(anon.status, 401);
  const col = await login('col@test.local');
  assert.equal((await call('POST', '/api/store/enquiries', { cookie: col.cookie, body: { batch_code: 'AV-T-0001', quantity: 10, intended_use: 'x' } })).status, 403);

  const buyer = await login('buy@test.local');
  const post = (body) => call('POST', '/api/store/enquiries', { cookie: buyer.cookie, body });
  assert.equal((await post({ batch_code: 'AV-T-0001', kind: 'purchase_request', quantity: 500, intended_use: 'x', delivery_location: 'Kolkata' })).status, 400, 'more than available');
  assert.equal((await post({ batch_code: 'AV-T-0001', kind: 'purchase_request', quantity: 5, intended_use: 'x', delivery_location: 'Kolkata' })).status, 400, 'below minimum order');
  assert.equal((await post({ batch_code: 'AV-T-0001', kind: 'purchase_request', quantity: 20, intended_use: '', delivery_location: 'Kolkata' })).status, 400, 'intended use is required');
  assert.equal((await post({ batch_code: 'AV-T-0002', kind: 'purchase_request', quantity: 20, intended_use: 'x', delivery_location: 'K' })).status, 409, 'rejected batch is blocked');

  const made = await post({ batch_code: 'AV-T-0001', kind: 'purchase_request', quantity: 60, intended_use: 'Processing', delivery_location: 'Kolkata', message: 'Need 60 kg' });
  assert.equal(made.status, 201);
  const id = made.body.enquiry.id;
  assert.ok(db.prepare("SELECT 1 FROM notifications WHERE user_id = 'U-COL' AND kind = 'market_enquiry'").get(), 'seller is notified');

  const other = await login('col2@test.local');
  assert.equal((await call('POST', `/api/store/seller/enquiries/${id}/respond`, { cookie: other.cookie, body: { action: 'accept' } })).status, 404, 'unrelated collector cannot answer');

  const neg = await call('POST', `/api/store/seller/enquiries/${id}/respond`, { cookie: col.cookie, body: { action: 'negotiate', counter_price: 90, message: 'We can do 90 per kg' } });
  assert.equal(neg.status, 200);
  const acc = await call('POST', `/api/store/my/enquiries/${id}/accept-counter`, { cookie: buyer.cookie });
  assert.equal(acc.status, 200);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(acc.body.order_id);
  assert.equal(order.agreed_price, 90);
  assert.equal(order.payment_status, 'not_recorded', 'no payment is ever simulated');

  const detail = await call('GET', '/api/store/listings/AV-T-0001');
  assert.equal(detail.body.listing.available_qty, 40, 'accepted order reserves stock');
  const again = await post({ batch_code: 'AV-T-0001', kind: 'purchase_request', quantity: 50, intended_use: 'x', delivery_location: 'K' });
  assert.equal(again.status, 400, 'cannot over-order what is left');

  const seller = await call('PATCH', `/api/store/seller/orders/${order.id}`, { cookie: col.cookie, body: { status: 'delivered' } });
  assert.equal(seller.status, 409, 'order status must follow the flow');
  assert.equal((await call('PATCH', `/api/store/seller/orders/${order.id}`, { cookie: col.cookie, body: { status: 'packed' } })).status, 200);
  assert.equal((await call('POST', `/api/store/my/orders/${order.id}/cancel`, { cookie: buyer.cookie })).status, 409, 'packed orders cannot be cancelled by the buyer');
});

test('an officer suspension is reflected on the very next marketplace request', async () => {
  const ins = await login('ins@test.local', 'officer');
  assert.equal(ins.status, 200);
  const short = await call('POST', '/api/officer/batches/BT-4/suspend', { cookie: ins.cookie, body: { reason: 'short' } });
  assert.equal(short.status, 400);
  const res = await call('POST', '/api/officer/batches/BT-4/suspend', { cookie: ins.cookie, body: { reason: 'Storage complaint referred for inspection' } });
  assert.equal(res.status, 201);
  const v = await call('GET', '/api/store/verify/AV-T-0004');
  assert.equal(v.body.status.label, 'Suspended');
  assert.equal(v.body.warning.level, 'danger');
  assert.equal(v.body.flags.officer_verified, false);
  const list = await call('GET', '/api/store/listings');
  assert.ok(!list.body.listings.some((l) => l.code === 'AV-T-0004'), 'suspended batches drop out of browse');
  const buyer = await login('buy@test.local');
  const enq = await call('POST', '/api/store/enquiries', { cookie: buyer.cookie, body: { batch_code: 'AV-T-0004', quantity: 20, intended_use: 'x' } });
  assert.equal(enq.status, 409);
  const back = await call('POST', '/api/officer/batches/BT-4/reinstate', { cookie: ins.cookie, body: { reason: 'Inspection found no issue' } });
  assert.equal(back.status, 201);
  assert.equal((await call('GET', '/api/store/verify/AV-T-0004')).body.status.label, 'Pending Officer Review');
  const collector = await login('col@test.local');
  assert.equal((await call('POST', '/api/officer/batches/BT-4/suspend', { cookie: collector.cookie, body: { reason: 'Collectors cannot do this' } })).status, 403);
});

test('sellers can price only their own batches', async () => {
  const col = await login('col@test.local');
  const ok = await call('PUT', '/api/store/seller/listings/AV-T-0001', { cookie: col.cookie, body: { indicative_price: 120, min_order_qty: 10, packaging: 'Sacks' } });
  assert.equal(ok.status, 200);
  assert.equal((await call('GET', '/api/store/listings/AV-T-0001')).body.listing.price.amount, 120);
  const bad = await call('PUT', '/api/store/seller/listings/AV-T-0001', { cookie: col.cookie, body: { indicative_price: -5 } });
  assert.equal(bad.status, 400);
  const other = await login('col2@test.local');
  assert.equal((await call('PUT', '/api/store/seller/listings/AV-T-0001', { cookie: other.cookie, body: { indicative_price: 1 } })).status, 404);
});

test('centres separate AranyaValue accreditation from any government licence', async () => {
  const c = await call('GET', '/api/store/centres/CE-T');
  assert.equal(c.status, 200);
  assert.equal(c.body.credentials.government.recorded, false);
  assert.equal(c.body.credentials.aranyavalue.is_government_licence, false);
  const ins = await login('ins@test.local', 'officer');
  const sus = await call('PATCH', '/api/officer/centres/CE-T', { cookie: ins.cookie, body: { accreditation_status: 'suspended', accreditation_note: 'Re-inspection pending', reason: 'Quality complaint' } });
  assert.equal(sus.status, 200);
  const after = await call('GET', '/api/store/centres/CE-T');
  assert.equal(after.body.centre.accreditation.key, 'suspended');
  assert.equal(after.body.centre.verified_centre, false, 'a suspended centre never keeps the verified mark');
});
