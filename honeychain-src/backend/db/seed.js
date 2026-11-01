require('dotenv').config();

const fs = require('fs');
const path = require('path');

const dbFile = process.env.ARANYA_DB_PATH || path.join(__dirname, 'aranyavalue.db');
for (const ext of ['', '-shm', '-wal']) {
  const file = dbFile + ext;
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

const db = require('./db');
const { hashPassword } = require('../services/auth');
const { appendEvent } = require('../services/ledger');

const now = new Date().toISOString();
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

function user(row) {
  db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, preferred_language, state_id, district_id, organisation, centre_id, active, is_demo, created_at)
    VALUES (@id, @name, @email, @phone, @password_hash, @role, @preferred_language, @state_id, @district_id, @organisation, @centre_id, 1, 1, @created_at)
  `).run({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || null,
    password_hash: hashPassword(row.password),
    role: row.role,
    preferred_language: row.preferred_language || 'bn',
    state_id: row.state_id,
    district_id: row.district_id,
    organisation: row.organisation || null,
    centre_id: null,
    created_at: now,
  });
}

const seed = db.transaction(() => {
  db.prepare('INSERT INTO states (id, name, code, languages, is_active, coverage_note) VALUES (?, ?, ?, ?, 1, ?)').run(
    'ST-WB', 'West Bengal', 'WB', '["en","bn","hi"]', 'Initial demonstration geography. Not an operating deployment.',
  );
  db.prepare('INSERT INTO states (id, name, code, languages, is_active, coverage_note) VALUES (?, ?, ?, ?, 1, ?)').run(
    'ST-JH', 'Jharkhand', 'JH', '["en","hi"]', 'Configured for expansion. Not an operating location.',
  );
  db.prepare('INSERT INTO states (id, name, code, languages, is_active, coverage_note) VALUES (?, ?, ?, ?, 1, ?)').run(
    'ST-OD', 'Odisha', 'OD', '["en","hi"]', 'Configured for expansion. Not an operating location.',
  );
  for (const [id, state, name] of [
    ['DT-PUR', 'ST-WB', 'Purulia'],
    ['DT-BAN', 'ST-WB', 'Bankura'],
    ['DT-JHA', 'ST-WB', 'Jhargram'],
    ['DT-PME', 'ST-WB', 'Paschim Medinipur'],
    ['DT-RAN', 'ST-JH', 'Ranchi'],
    ['DT-MAY', 'ST-OD', 'Mayurbhanj'],
  ]) {
    db.prepare('INSERT INTO districts (id, state_id, name, is_active) VALUES (?, ?, ?, 1)').run(id, state, name);
  }

  user({ id: 'U-MINA', name: 'Mina Mahato (demo)', email: 'mina@aranya.demo', phone: '9000000001', password: 'collector123', role: 'collector', state_id: 'ST-WB', district_id: 'DT-PUR' });
  user({ id: 'U-SUKU', name: 'Sukurmoni Hembram (demo)', email: 'sukurmoni@aranya.demo', phone: '9000000002', password: 'collector123', role: 'collector', state_id: 'ST-WB', district_id: 'DT-JHA' });
  user({ id: 'U-BASA', name: 'Basanti Mandi (demo)', email: 'basanti@aranya.demo', phone: '9000000003', password: 'collector123', role: 'collector', state_id: 'ST-WB', district_id: 'DT-BAN' });
  user({ id: 'U-CEN1', name: 'Anita Mahato (demo centre)', email: 'centre.purulia@aranya.demo', password: 'centre12345', role: 'centre', state_id: 'ST-WB', district_id: 'DT-PUR', organisation: 'Purulia demo collection centre' });
  user({ id: 'U-CEN2', name: 'Ratan Hansda (demo centre)', email: 'centre.jhargram@aranya.demo', password: 'centre12345', role: 'centre', state_id: 'ST-WB', district_id: 'DT-JHA', organisation: 'Jhargram demo collection centre' });
  user({ id: 'U-BUY1', name: 'Demo buyer — Jangal Haat', email: 'buyer.haat@aranya.demo', password: 'buyer12345', role: 'buyer', state_id: 'ST-WB', district_id: 'DT-PUR', organisation: 'Jangal Haat (demonstration buyer)' });
  user({ id: 'U-BUY2', name: 'Demo buyer — Processing desk', email: 'buyer.desk@aranya.demo', password: 'buyer12345', role: 'buyer', state_id: 'ST-WB', district_id: 'DT-JHA', organisation: 'Processing desk (demonstration buyer)' });
  user({ id: 'U-BUY3', name: 'Demo buyer — Herbal unit', email: 'buyer.herbal@aranya.demo', password: 'buyer12345', role: 'buyer', state_id: 'ST-WB', district_id: 'DT-BAN', organisation: 'Herbal unit (demonstration buyer)' });
  user({ id: 'U-INS', name: 'Demo quality reviewer', email: 'inspector@aranya.demo', password: 'inspector123', role: 'inspector', preferred_language: 'en', state_id: 'ST-WB', district_id: 'DT-PUR', organisation: 'Demonstration review desk' });
  user({ id: 'U-ADM', name: 'Demo administrator', email: 'admin@aranya.demo', password: 'admin12345', role: 'admin', preferred_language: 'en', state_id: 'ST-WB', district_id: 'DT-PUR', organisation: 'AranyaValue demo' });

  db.prepare('INSERT INTO centres (id, name, state_id, district_id, manager_user_id, address, is_demo, coverage_note) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
    .run('CE-PUR', 'Purulia demo collection centre', 'ST-WB', 'DT-PUR', 'U-CEN1', 'Illustrative address, Purulia', 'Not a real collection centre.');
  db.prepare('INSERT INTO centres (id, name, state_id, district_id, manager_user_id, address, is_demo, coverage_note) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
    .run('CE-JHA', 'Jhargram demo collection centre', 'ST-WB', 'DT-JHA', 'U-CEN2', 'Illustrative address, Jhargram', 'Not a real collection centre.');
  db.prepare('UPDATE users SET centre_id = ? WHERE id = ?').run('CE-PUR', 'U-CEN1');
  db.prepare('UPDATE users SET centre_id = ? WHERE id = ?').run('CE-JHA', 'U-CEN2');

  const products = [
    ['PR-MAH', 'Mahua flowers', '{"bn":"মহুয়া","hi":"महुआ"}', 'Flower', 'Madhuca longifolia', 'Dried mahua flowers recorded as forest produce. This catalogue entry is not a food-safety standard.', 'kg', '["kg","g","quintal"]', '{"expected":["drying","storage","packaging"],"required":["drying","storage"]}'],
    ['PR-HON', 'Forest honey', '{"bn":"মধু","hi":"शहद"}', 'Honey', null, 'Forest honey batch records. Moisture is an attribute buyers sometimes ask for. No statutory limit is stored unless an administrator configures one with a source.', 'kg', '["kg","g"]', '{"expected":["storage","packaging"],"required":["storage"]}'],
    ['PR-SAL', 'Sal leaves', '{"bn":"শাল পাতা","hi":"साल पत्ते"}', 'Leaf', 'Shorea robusta', 'Sal leaf batches counted in pieces or bundles. No statutory grade is stored in this demo.', 'piece', '["piece","bundle"]', '{"expected":["storage","packaging"],"required":["packaging"]}'],
    ['PR-MED', 'Medicinal and aromatic plants', '{"bn":"ঔষধি উদ্ভিদ","hi":"औषधीय पौधे"}', 'Medicinal plant', null, 'Dried plant material records. This profile does not state any therapeutic use or legal pharmacopoeia limit.', 'kg', '["kg","g"]', '{"expected":["drying","storage","packaging"],"required":["drying","storage"]}'],
  ];
  for (const row of products) {
    db.prepare('INSERT INTO products (id, name, local_names, category, species_name, description, default_unit, units_json, handling_json, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').run(...row);
  }
  for (const productId of ['PR-MAH', 'PR-HON', 'PR-SAL', 'PR-MED']) {
    db.prepare('INSERT INTO product_states (product_id, state_id) VALUES (?, ?)').run(productId, 'ST-WB');
  }
  db.prepare('INSERT INTO product_states (product_id, state_id) VALUES (?, ?)').run('PR-HON', 'ST-JH');
  db.prepare('INSERT INTO product_states (product_id, state_id) VALUES (?, ?)').run('PR-MED', 'ST-JH');
  db.prepare('INSERT INTO product_states (product_id, state_id) VALUES (?, ?)').run('PR-HON', 'ST-OD');
  db.prepare('INSERT INTO product_states (product_id, state_id) VALUES (?, ?)').run('PR-MED', 'ST-OD');

  const profiles = [
    ['QP-MAH', 'PR-MAH', 'Mahua attribute list', 'demo-1'],
    ['QP-HON', 'PR-HON', 'Forest honey attribute list', 'demo-1'],
    ['QP-SAL', 'PR-SAL', 'Sal leaf attribute list', 'demo-1'],
    ['QP-MED', 'PR-MED', 'Dried plant attribute list', 'demo-1'],
  ];
  for (const [id, productId, name, version] of profiles) {
    db.prepare(`INSERT INTO quality_profiles (id, product_id, name, version, region, source_name, source_url, effective_date, notes, illustrative)
      VALUES (?, ?, ?, ?, 'West Bengal demonstration', 'AranyaValue demonstration profile', NULL, '2026-10-31', 'Thresholds are not filled in. A blank limit means not configured. This is not a statutory standard.', 1)`).run(id, productId, name, version);
  }
  const params = [
    ['PA-M1', 'QP-MAH', 'Moisture', '%', 1],
    ['PA-M2', 'QP-MAH', 'Foreign matter', '%', 2],
    ['PA-H1', 'QP-HON', 'Moisture', '%', 1],
    ['PA-H2', 'QP-HON', 'Foreign matter', '%', 2],
    ['PA-S1', 'QP-SAL', 'Damaged leaves', '%', 1],
    ['PA-D1', 'QP-MED', 'Moisture', '%', 1],
    ['PA-D2', 'QP-MED', 'Foreign matter', '%', 2],
  ];
  for (const [id, profile, name, unit, sort] of params) {
    db.prepare(`INSERT INTO quality_parameters (id, profile_id, name, unit, data_type, min_value, max_value, required, source_name, sort_order)
      VALUES (?, ?, ?, ?, 'number', NULL, NULL, 0, 'Not configured — no verified limit is stored', ?)`).run(id, profile, name, unit, sort);
  }

  const batches = [
    ['BT-M1', 'AV-WB-MAH-0001', 'PR-MAH', 'U-MINA', 'CE-PUR', 'DT-PUR', 'মহুয়া', 'Dried flowers', 80, 'kg', day(-12), 'Balarampur block illustration', 'Hand picked', 'community forest', 'pending_verification'],
    ['BT-M2', 'AV-WB-MAH-0002', 'PR-MAH', 'U-SUKU', 'CE-JHA', 'DT-JHA', 'Mahua', 'Dried flowers', 240, 'kg', day(-20), 'Jhargram block illustration', 'Hand picked', 'community forest', 'pending_verification'],
    ['BT-H1', 'AV-WB-HON-0003', 'PR-HON', 'U-BASA', 'CE-PUR', 'DT-BAN', 'মধু', 'Multifloral', 18, 'kg', day(-8), 'Bankura block illustration', 'Wild comb', 'declared forest patch', 'pending_verification'],
    ['BT-H2', 'AV-WB-HON-0004', 'PR-HON', 'U-MINA', 'CE-PUR', 'DT-PUR', 'Honey', 'Multifloral', 12, 'kg', day(-30), 'Purulia block illustration', 'Wild comb', 'declared forest patch', 'verified_with_limitations'],
    ['BT-S1', 'AV-WB-SAL-0005', 'PR-SAL', 'U-MINA', 'CE-PUR', 'DT-PUR', 'শাল পাতা', 'Plate grade', 400, 'piece', day(-15), 'Purulia block illustration', 'Collected from fallen twigs', 'community forest', 'verified'],
    ['BT-D1', 'AV-WB-MED-0006', 'PR-MED', 'U-SUKU', 'CE-JHA', 'DT-JHA', 'Kalmegh', 'Andrographis paniculata', 15, 'kg', day(-18), 'Jhargram block illustration', 'Hand cut aerial parts', 'farm edge declared', 'rejected'],
    ['BT-M3', 'AV-WB-MAH-0007', 'PR-MAH', 'U-BASA', null, 'DT-BAN', 'Mahua', 'Fresh flowers', 40, 'kg', day(-2), 'Bankura block illustration', 'Hand picked', 'community forest', 'draft'],
    ['BT-H3', 'AV-WB-HON-0008', 'PR-HON', 'U-SUKU', 'CE-JHA', 'DT-JHA', 'Honey', 'Multifloral', 8, 'kg', day(-6), 'Jhargram block illustration', 'Wild comb', 'declared forest patch', 'pending_verification'],
    ['BT-S2', 'AV-WB-SAL-0009', 'PR-SAL', 'U-SUKU', 'CE-JHA', 'DT-JHA', 'Sal', 'Cup grade', 120, 'piece', day(-9), 'Jhargram block illustration', 'Collected from fallen twigs', 'community forest', 'needs_info'],
    ['BT-D2', 'AV-WB-MED-0010', 'PR-MED', 'U-MINA', 'CE-PUR', 'DT-PUR', 'Kalmegh', 'Andrographis paniculata', 22, 'kg', day(-11), 'Purulia block illustration', 'Hand cut aerial parts', 'farm edge declared', 'pending_verification'],
  ];
  for (const b of batches) {
    db.prepare(`INSERT INTO batches (
      id, batch_code, product_id, collector_id, centre_id, state_id, district_id, local_name, variety, grade_label,
      quantity, unit, collection_date, collection_area, collection_method, source_type, source_declaration, status,
      public_share, is_demo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'ST-WB', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Declared by the collector. Not independently verified.', ?, ?, 1, ?, ?)`).run(
      b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[0] === 'BT-M3' ? 0 : 1, now, now,
    );
  }

  const handling = [
    ['BT-M1', 'drying', 'Sun drying on a raised mat', 'Home yard', day(-11), day(-8)],
    ['BT-M1', 'storage', 'Jute bag indoors', 'Home store', day(-8), null],
    ['BT-M2', 'drying', 'Sun drying', 'Centre yard', day(-19), day(-14)],
    ['BT-M2', 'storage', 'Raised wooden platform', 'Jhargram demo centre', day(-14), null],
    ['BT-H1', 'storage', 'Food-grade plastic container', 'Home', day(-8), null],
    ['BT-H2', 'storage', 'Steel container', 'Purulia demo centre', day(-28), null],
    ['BT-S1', 'packaging', 'Tied bundles of 100', 'Purulia demo centre', day(-14), day(-14)],
    ['BT-S1', 'storage', 'Dry room, off the floor', 'Purulia demo centre', day(-14), null],
    ['BT-D2', 'drying', 'Shade drying', 'Home', day(-10), day(-7)],
    ['BT-D2', 'storage', 'Cloth bag', 'Home', day(-7), null],
    ['BT-H3', 'storage', 'Plastic bucket', 'Home', day(-6), null],
    ['BT-S2', 'storage', 'Stacked indoors', 'Home', day(-8), null],
  ];
  let n = 1;
  for (const h of handling) {
    db.prepare('INSERT INTO handling_records (id, batch_id, kind, method, location, start_date, end_date, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`HN-${n}`, ...h, 'U-MINA', now);
    n += 1;
  }

  const measures = [
    ['MS-1', 'BT-M1', 'Moisture', 16, '%', 'self_reported', 0, 'U-MINA', 'Pin sample, collector estimate'],
    ['MS-2', 'BT-M2', 'Moisture', 9, '%', 'measured', 0, 'U-INS', 'Meter at the centre. Not marked verified.'],
    ['MS-3', 'BT-H2', 'Moisture', 19, '%', 'measured', 1, 'U-INS', 'Reviewer measurement. Not a statutory pass.'],
    ['MS-4', 'BT-S1', 'Damaged leaves', 3, '%', 'self_reported', 0, 'U-MINA', 'Counted from one bundle'],
    ['MS-5', 'BT-H3', 'Moisture', 21, '%', 'simulated', 0, 'U-ADM', 'Simulated demonstration value. Not a laboratory result.'],
    ['MS-6', 'BT-D2', 'Moisture', 11, '%', 'self_reported', 0, 'U-MINA', 'Collector reading'],
    ['MS-7', 'BT-D2', 'Foreign matter', 1.5, '%', 'self_reported', 0, 'U-MINA', 'Collector sorting note'],
  ];
  for (const m of measures) {
    db.prepare(`INSERT INTO measurements (id, batch_id, parameter_name, value, unit, measured_at, method, evidence_source, verified, recorded_by, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Recorded method note', ?, ?, ?, ?, ?)`).run(m[0], m[1], m[2], m[3], m[4], day(-3), m[5], m[6], m[7], m[8], now);
  }

  db.prepare(`INSERT INTO evidence (id, batch_id, kind, label, visibility, uploaded_by, note, created_at) VALUES (?, ?, ?, ?, 'public', ?, ?, ?)`)
    .run('EV-1', 'BT-M1', 'declaration', 'Collection declaration', 'U-MINA', 'Written declaration only. No photograph is stored.', now);
  db.prepare(`INSERT INTO evidence (id, batch_id, kind, label, visibility, uploaded_by, note, created_at) VALUES (?, ?, ?, ?, 'private', ?, ?, ?)`)
    .run('EV-2', 'BT-M1', 'note', 'Internal handling note', 'U-MINA', 'Private note: bags were moved once during rain. Not shown on the public passport.', now);

  db.prepare(`INSERT INTO verifications (id, batch_id, inspector_id, status, summary, limitations, created_at) VALUES (?, ?, 'U-INS', ?, ?, ?, ?)`)
    .run('VF-1', 'BT-H2', 'verified_with_limitations', 'Moisture was recorded by the reviewer. No statutory honey limit is configured in the catalogue, so this is not a full verification.', 'Profile limits are not configured. One measurement is reviewer-entered.', now);
  db.prepare(`INSERT INTO verifications (id, batch_id, inspector_id, status, summary, limitations, created_at) VALUES (?, ?, 'U-INS', 'verified', ?, ?, ?)`)
    .run('VF-2', 'BT-S1', 'Packaging and a self-reported damage count are on file. The damage count was not rechecked by the reviewer.', 'Self-reported damage percentage remains self-reported.', now);
  db.prepare(`INSERT INTO verifications (id, batch_id, inspector_id, status, summary, limitations, created_at) VALUES (?, ?, 'U-INS', 'rejected', ?, ?, ?)`)
    .run('VF-3', 'BT-D1', 'The configured checklist expects a drying record. None is stored, so the batch was not reviewed as complete.', 'Rejection is about the missing record, not a laboratory fail.', now);
  db.prepare(`INSERT INTO rejections (id, batch_id, actor_id, category, explanation, measurement_ref, corrective_action, reassessment_needed, created_at) VALUES (?, ?, 'U-INS', ?, ?, ?, ?, 1, ?)`)
    .run('RJ-1', 'BT-D1', 'missing_record', 'Drying is on the product checklist and no drying record was entered.', 'Drying record', 'Add a drying record if drying happened, including method and dates, or state that the material was not dried. Then submit again. The earlier review stays in the history.', now);

  const reqs = [
    ['RQ-1', 'U-BUY1', 'PR-MAH', 'Dried flowers', 50, null, 'kg', JSON.stringify([{ parameter: 'Moisture', unit: '%', max: 12, required: true, source: 'Buyer-stated demonstration specification' }, { parameter: 'Foreign matter', unit: '%', max: 2, required: true, source: 'Buyer-stated demonstration specification' }]), 180, 'kg'],
    ['RQ-2', 'U-BUY2', 'PR-MAH', 'Dried flowers', 200, null, 'kg', JSON.stringify([{ parameter: 'Moisture', unit: '%', max: 8, required: true, source: 'Buyer-stated demonstration specification' }]), 240, 'kg'],
    ['RQ-3', 'U-BUY1', 'PR-HON', 'Multifloral', 5, null, 'kg', JSON.stringify([{ parameter: 'Moisture', unit: '%', max: 20, required: true, source: 'Buyer-stated demonstration specification' }]), 350, 'kg'],
    ['RQ-4', 'U-BUY3', 'PR-MED', 'Dried herb', 10, null, 'kg', JSON.stringify([{ parameter: 'Moisture', unit: '%', max: 10, required: true, source: 'Buyer-stated demonstration specification' }, { parameter: 'Foreign matter', unit: '%', max: 3, required: true, source: 'Buyer-stated demonstration specification' }]), 90, 'kg'],
    ['RQ-5', 'U-BUY2', 'PR-SAL', 'Plate grade', 100, null, 'piece', JSON.stringify([{ parameter: 'Damaged leaves', unit: '%', max: 5, required: true, source: 'Buyer-stated demonstration specification' }]), 3, 'piece'],
  ];
  for (const r of reqs) {
    db.prepare(`INSERT INTO buyer_requirements (
      id, buyer_user_id, product_id, grade_label, min_qty, max_qty, unit, specs_json, documents_json, reference_price,
      currency, price_unit, offer_kind, source_label, valid_from, valid_until, status, is_demo, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, 'INR', ?, 'demonstration', 'Demonstration sample entered for the hackathon. Not a live market price and not an MSP notification.', ?, ?, 'active', 1, ?)`).run(
      r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], day(-5), day(40), now,
    );
  }

  db.prepare(`INSERT INTO offers (
    id, buyer_user_id, batch_id, requirement_id, amount, currency, price_unit, quantity, min_quantity, grade_label, terms,
    delivery_terms, offer_kind, source_label, status, valid_until, is_demo, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, 'demonstration', 'Demonstration sample. Not a live market price.', 'submitted', ?, 1, ?, ?)`).run(
    'OF-1', 'U-BUY1', 'BT-M1', 'RQ-1', 150, 'kg', 80, 50, 'Dried flowers',
    'Demonstration terms: moisture at or below 12 percent and foreign matter at or below 2 percent.',
    'Buyer collects from the centre.', day(20), now, now,
  );
  db.prepare(`INSERT INTO offers (
    id, buyer_user_id, batch_id, requirement_id, amount, currency, price_unit, quantity, min_quantity, grade_label, terms,
    delivery_terms, offer_kind, source_label, status, valid_until, is_demo, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, 'demonstration', 'Demonstration sample. Not a live market price.', 'submitted', ?, 1, ?, ?)`).run(
    'OF-2', 'U-BUY2', 'BT-M1', 'RQ-2', 220, 'kg', 240, 200, 'Dried flowers',
    'Demonstration terms: minimum 200 kg and moisture at or below 8 percent.',
    'Seller delivers to Jhargram.', day(25), now, now,
  );
  db.prepare(`INSERT INTO offers (
    id, buyer_user_id, batch_id, requirement_id, amount, currency, price_unit, quantity, min_quantity, grade_label, terms,
    offer_kind, source_label, status, valid_until, is_demo, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, 'INR', 'kg', 80, 50, 'Dried flowers', 'Earlier demonstration figure. The end date has passed.', 'demonstration', 'Demonstration sample. Not a live market price.', 'submitted', ?, 1, ?, ?)`).run(
    'OF-3', 'U-BUY1', 'BT-M1', 'RQ-1', 130, day(-1), now, now,
  );
  db.prepare(`INSERT INTO offers (
    id, buyer_user_id, batch_id, requirement_id, amount, currency, price_unit, quantity, min_quantity, grade_label, terms,
    offer_kind, source_label, status, valid_until, is_demo, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, 'INR', 'piece', 400, 100, 'Plate grade', 'Demonstration offer for sal leaves. Damage percentage is self-reported.', 'demonstration', 'Demonstration sample. Not a live market price.', 'accepted', ?, 1, ?, ?)`).run(
    'OF-4', 'U-BUY2', 'BT-S1', 'RQ-5', 3, day(15), now, now,
  );
  db.prepare(`INSERT INTO orders (id, offer_id, buyer_user_id, batch_id, quantity, unit, agreed_price, currency, price_unit, status, payment_status, delivery_status, is_demo, created_at)
    VALUES ('OR-1', 'OF-4', 'U-BUY2', 'BT-S1', 400, 'piece', 3, 'INR', 'piece', 'confirmed', 'not_recorded', 'pending', 1, ?)`).run(now);

  for (const [centre, batch, qty, unit, status] of [
    ['CE-PUR', 'BT-M1', 80, 'kg', 'stored'],
    ['CE-PUR', 'BT-H2', 12, 'kg', 'stored'],
    ['CE-PUR', 'BT-S1', 400, 'piece', 'ready'],
    ['CE-PUR', 'BT-D2', 22, 'kg', 'stored'],
    ['CE-JHA', 'BT-M2', 240, 'kg', 'stored'],
    ['CE-JHA', 'BT-D1', 15, 'kg', 'received'],
    ['CE-JHA', 'BT-H3', 8, 'kg', 'stored'],
    ['CE-JHA', 'BT-S2', 120, 'piece', 'stored'],
  ]) {
    db.prepare('INSERT INTO inventory (id, centre_id, batch_id, quantity, unit, location, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(`INV-${batch}`, centre, batch, qty, unit, 'Demo store room', status, now);
  }

  db.prepare(`INSERT INTO schemes (id, name, department, level, state_id, category, beneficiaries, benefits, eligibility, documents_json, process, official_url, source_url, last_verified, summary_is_illustrative)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-10-31', 1)`).run(
    'SC-VD',
    'Van Dhan Vikas Karyakram',
    'Ministry of Tribal Affairs, implemented by TRIFED',
    'central',
    null,
    'livelihood',
    'Tribal gatherers and Van Dhan groups, as defined on the official page',
    'The official programme describes value addition and livelihood support around minor forest produce. This demo does not restate benefit amounts.',
    'Eligibility is defined by the Ministry and TRIFED. This application does not decide eligibility.',
    JSON.stringify(['Use the official page for the current document list']),
    'Open the official TRIFED page and follow the process published there.',
    'https://trifed.tribal.gov.in/pmvdy',
    'https://trifed.tribal.gov.in/pmvdy',
  );
  db.prepare(`INSERT INTO schemes (id, name, department, level, state_id, category, beneficiaries, benefits, eligibility, documents_json, process, official_url, source_url, last_verified, summary_is_illustrative)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-10-31', 1)`).run(
    'SC-WB',
    'TRIFED note for West Bengal',
    'TRIFED',
    'state',
    'ST-WB',
    'marketing',
    'Implementing agency contact published by TRIFED for West Bengal',
    'The page identifies the state implementing channel. It is not an AranyaValue partnership.',
    'See the official page. This demo does not add eligibility rules.',
    JSON.stringify(['Use the official page']),
    'Open the TRIFED West Bengal page and use only the contacts published there.',
    'https://trifed.tribal.gov.in/West%20Bengal',
    'https://trifed.tribal.gov.in/West%20Bengal',
  );
  db.prepare(`INSERT INTO schemes (id, name, department, level, state_id, category, beneficiaries, benefits, eligibility, documents_json, process, official_url, source_url, last_verified, summary_is_illustrative)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-10-31', 1)`).run(
    'SC-FRA',
    'Forest Rights Act — official ministry page',
    'Ministry of Tribal Affairs',
    'central',
    null,
    'rights',
    'Forest rights holders, as defined in the Act and the ministry material',
    'This is a link to the ministry page about the Forest Rights Act. It is not a cash scheme and this demo does not interpret individual eligibility.',
    'Read the Act and the ministry material. AranyaValue does not certify a forest right.',
    JSON.stringify(['See the official page']),
    'Open the ministry page. Do not treat this application as an application portal for the Act.',
    'https://tribal.nic.in/FRA.aspx',
    'https://tribal.nic.in/FRA.aspx',
  );

  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
    'banner',
    'Illustrative demo. Prices, buyers, centres, and measurements are sample records unless you add your own. Nothing here is a live market price, a laboratory certificate, or a government endorsement.',
  );
}, { immediate: true });

seed();

const events = [
  ['BT-M1', 'BATCH_CREATED', 'U-MINA'],
  ['BT-M1', 'HANDLING_RECORDED', 'U-MINA'],
  ['BT-M1', 'MEASUREMENT_RECORDED', 'U-MINA'],
  ['BT-M1', 'OFFER_CREATED', 'U-BUY1'],
  ['BT-M1', 'PASSPORT_GENERATED', 'U-MINA'],
  ['BT-M2', 'BATCH_CREATED', 'U-SUKU'],
  ['BT-M2', 'MEASUREMENT_RECORDED', 'U-INS'],
  ['BT-H1', 'BATCH_CREATED', 'U-BASA'],
  ['BT-H2', 'BATCH_CREATED', 'U-MINA'],
  ['BT-H2', 'ASSESSMENT_REVIEWED', 'U-INS'],
  ['BT-S1', 'BATCH_CREATED', 'U-MINA'],
  ['BT-S1', 'ASSESSMENT_REVIEWED', 'U-INS'],
  ['BT-S1', 'OFFER_UPDATED', 'U-BUY2'],
  ['BT-D1', 'BATCH_CREATED', 'U-SUKU'],
  ['BT-D1', 'REJECTION_RECORDED', 'U-INS'],
  ['BT-M3', 'BATCH_CREATED', 'U-BASA'],
  ['BT-H3', 'BATCH_CREATED', 'U-SUKU'],
  ['BT-H3', 'MEASUREMENT_RECORDED', 'U-ADM'],
  ['BT-S2', 'BATCH_CREATED', 'U-SUKU'],
  ['BT-D2', 'BATCH_CREATED', 'U-MINA'],
];
for (const [batch_id, event_type, actor] of events) {
  appendEvent({ batch_id, event_type, actor, payload: { demo: true, batch_id } });
}

console.log('AranyaValue demo data ready.');
console.log('mina@aranya.demo / collector123');
console.log('centre.purulia@aranya.demo / centre12345');
console.log('buyer.haat@aranya.demo / buyer12345');
console.log('inspector@aranya.demo / inspector123');
console.log('admin@aranya.demo / admin12345');

// Marketplace catalogue, demo centres, demo batches and sample buyer activity
require('./seedMarket').run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
