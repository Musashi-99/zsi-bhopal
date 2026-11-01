const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { appendEvent } = require('../services/ledger');
const { loadContext, canRead, shapePassport, listCard } = require('../services/records');
const { evaluateProfile } = require('../services/qualityEngine');
const { snapshotRevision } = require('../services/revisions');
const { notify, notifyOfficers } = require('../services/notify');

const router = express.Router();
const UPLOADS = path.join(__dirname, '..', 'uploads');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function nid(prefix) {
  return `${prefix}-${uuid().slice(0, 8).toUpperCase()}`;
}

function now() {
  return new Date().toISOString();
}

function announceSubmission(batch, kind, actor) {
  const link = `/batches/${batch.id}`;
  notify(batch.collector_id, { kind: 'batch_submitted', title: `Batch ${batch.batch_code} submitted`, body: 'Verification is pending with a government officer.', batch_id: batch.id, link });
  notifyOfficers({
    kind: kind === 'new' ? 'new_batch' : 'batch_resubmitted',
    title: kind === 'new' ? `New batch ${batch.batch_code}` : `Batch ${batch.batch_code} resubmitted`,
    body: kind === 'new' ? 'Waiting in the verification queue.' : 'Collector responded to a correction or rejection. Review the revision history.',
    batch_id: batch.id, link: `/officer/verification/${batch.id}`,
  }, { stateId: batch.state_id, districtId: batch.district_id });
}

function readOwned(req, res) {
  const ctx = loadContext(req.params.id);
  if (!ctx) {
    res.status(404).json({ error: 'Batch not found.' });
    return null;
  }
  if (!canRead(req.user, ctx.batch)) {
    res.status(403).json({ error: 'You cannot open this batch.' });
    return null;
  }
  return ctx;
}

router.get('/', requireAuth, (req, res) => {
  const { status, product, q } = req.query;
  let sql = `
    SELECT b.*, p.name AS product_name, p.category, s.name AS state_name, d.name AS district_name, c.name AS centre_name
    FROM batches b
    JOIN products p ON p.id = b.product_id
    JOIN states s ON s.id = b.state_id
    JOIN districts d ON d.id = b.district_id
    LEFT JOIN centres c ON c.id = b.centre_id
    WHERE 1 = 1
  `;
  const args = [];
  if (req.user.role === 'collector') {
    sql += ' AND b.collector_id = ?';
    args.push(req.user.id);
  } else if (req.user.role === 'centre') {
    sql += ' AND b.centre_id = ?';
    args.push(req.user.centre_id || '');
  } else if (req.user.role === 'buyer') {
    sql += ' AND b.public_share = 1 AND b.status != \'draft\'';
  } else if (req.user.role === 'inspector') {
    sql += ' AND b.status != \'draft\'';
  }
  if (status) {
    sql += ' AND b.status = ?';
    args.push(status);
  }
  if (product) {
    sql += ' AND b.product_id = ?';
    args.push(product);
  }
  if (q) {
    sql += ' AND (b.batch_code LIKE ? OR p.name LIKE ? OR b.local_name LIKE ? OR d.name LIKE ?)';
    const like = `%${q}%`;
    args.push(like, like, like, like);
  }
  sql += ' ORDER BY b.updated_at DESC';
  res.json({ batches: db.prepare(sql).all(...args).map(listCard) });
});

router.post('/', requireAuth, requireRole('collector', 'centre', 'admin'), (req, res) => {
  const body = req.body || {};
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(body.product_id);
  if (!product) return res.status(400).json({ error: 'Choose an active product.' });
  const district = db.prepare('SELECT * FROM districts WHERE id = ?').get(body.district_id);
  if (!district) return res.status(400).json({ error: 'Choose a district.' });
  const stateId = body.state_id || district.state_id;
  if (district.state_id !== stateId) return res.status(400).json({ error: 'That district is not in the selected state.' });
  if (!body.collection_date || body.quantity == null || !body.unit) {
    return res.status(400).json({ error: 'Collection date, quantity, and unit are required.' });
  }
  const units = JSON.parse(product.units_json || '[]');
  if (units.length && !units.map((u) => u.toLowerCase()).includes(String(body.unit).toLowerCase())) {
    return res.status(400).json({ error: `Unit must be one of: ${units.join(', ')}.` });
  }
  const qty = Number(body.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'Quantity must be greater than zero.' });

  let collectorId = req.user.id;
  let centreId = body.centre_id || null;
  if (req.user.role === 'centre') {
    centreId = req.user.centre_id;
    if (!centreId) return res.status(400).json({ error: 'Your account is not linked to a collection centre.' });
    if (body.collector_id) {
      const member = db.prepare('SELECT id FROM users WHERE id = ? AND role = \'collector\'').get(body.collector_id);
      if (!member) return res.status(400).json({ error: 'Collector not found.' });
      collectorId = body.collector_id;
    }
  }
  if (req.user.role === 'collector') collectorId = req.user.id;

  const state = db.prepare('SELECT code FROM states WHERE id = ?').get(stateId);
  const count = db.prepare('SELECT COUNT(*) AS c FROM batches').get().c + 1;
  const slug = product.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'NTP';
  const id = nid('BT');
  const code = `AV-${state.code}-${slug}-${String(count).padStart(4, '0')}`;
  const status = body.submit ? 'pending_verification' : 'draft';
  const ts = now();

  const save = db.transaction(() => {
    db.prepare(`
      INSERT INTO batches (
        id, batch_code, product_id, collector_id, centre_id, state_id, district_id, local_name, variety,
        grade_label, quantity, unit, collection_date, collection_area, block_name, collection_method,
        source_type, source_declaration, source_note, status, public_share, internal_notes, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      id, code, product.id, collectorId, centreId, stateId, district.id,
      body.local_name || null, body.variety || null, body.grade_label || null, qty, body.unit,
      body.collection_date, body.collection_area || null, body.block_name || null, body.collection_method || null,
      body.source_type || null, body.source_declaration || null, body.source_note || null,
      status, body.public_share ? 1 : 0, body.internal_notes || null, ts, ts,
    );
    for (const row of body.handling || []) {
      if (!row.kind) continue;
      db.prepare(`
        INSERT INTO handling_records (id, batch_id, kind, method, location, start_date, end_date, notes, recorded_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(nid('HN'), id, row.kind, row.method || null, row.location || null, row.start_date || null, row.end_date || null, row.notes || null, req.user.id, ts);
    }
    for (const row of body.measurements || []) {
      insertMeasurement(id, row, req.user, ts);
    }
    if (centreId) {
      db.prepare(`
        INSERT INTO inventory (id, centre_id, batch_id, quantity, unit, location, status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'received', ?)
      `).run(nid('INV'), centreId, id, qty, body.unit, body.storage_location || null, ts);
    }
    appendEvent({
      batch_id: id,
      event_type: 'BATCH_CREATED',
      actor: req.user.id,
      payload: { batch_code: code, product: product.name, status },
    }, { inTransaction: true });
    if (status !== 'draft') {
      appendEvent({
        batch_id: id,
        event_type: 'ASSESSMENT_SUBMITTED',
        actor: req.user.id,
        payload: { status },
      }, { inTransaction: true });
      snapshotRevision(id, req.user.id, 'Initial submission');
    }
  }, { immediate: true });

  try {
    save();
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Could not save the batch.' });
  }
  if (status !== 'draft') announceSubmission({ id, batch_code: code, collector_id: collectorId, state_id: stateId, district_id: district.id }, 'new', req.user);
  const ctx = loadContext(id);
  res.status(201).json({ passport: shapePassport(ctx, req.user) });
});

router.get('/:id', requireAuth, (req, res) => {
  const ctx = readOwned(req, res);
  if (!ctx) return;
  res.json({ passport: shapePassport(ctx, req.user) });
});

router.get('/:id/intelligence', requireAuth, (req, res) => {
  const ctx = readOwned(req, res);
  if (!ctx) return;
  if (req.user.role === 'buyer' || req.user.role === 'collector' || req.user.role === 'centre' || req.user.role === 'admin' || req.user.role === 'inspector') {
    return res.json(ctx.intelligence);
  }
  return res.status(403).json({ error: 'You cannot view this comparison.' });
});

router.patch('/:id', requireAuth, (req, res) => {
  const ctx = readOwned(req, res);
  if (!ctx) return;
  const locked = ['verified', 'verified_with_limitations', 'dispatched'].includes(ctx.batch.status);
  const writer = req.user.role === 'admin'
    || (req.user.role === 'collector' && req.user.id === ctx.batch.collector_id)
    || (req.user.role === 'centre' && req.user.centre_id === ctx.batch.centre_id);
  if (!writer) return res.status(403).json({ error: 'You cannot edit this batch.' });
  const body = req.body || {};
  if (locked && (body.quantity != null || body.product_id)) {
    return res.status(400).json({ error: 'Quantity and product stay as recorded after verification. Add a new measurement instead of rewriting history.' });
  }
  const ts = now();
  db.prepare(`
    UPDATE batches SET
      local_name = COALESCE(?, local_name),
      variety = COALESCE(?, variety),
      grade_label = COALESCE(?, grade_label),
      quantity = COALESCE(?, quantity),
      unit = COALESCE(?, unit),
      collection_date = COALESCE(?, collection_date),
      collection_area = COALESCE(?, collection_area),
      block_name = COALESCE(?, block_name),
      collection_method = COALESCE(?, collection_method),
      source_type = COALESCE(?, source_type),
      source_declaration = COALESCE(?, source_declaration),
      source_note = COALESCE(?, source_note),
      public_share = COALESCE(?, public_share),
      internal_notes = COALESCE(?, internal_notes),
      updated_at = ?
    WHERE id = ?
  `).run(
    body.local_name ?? null,
    body.variety ?? null,
    body.grade_label ?? null,
    body.quantity ?? null,
    body.unit ?? null,
    body.collection_date ?? null,
    body.collection_area ?? null,
    body.block_name ?? null,
    body.collection_method ?? null,
    body.source_type ?? null,
    body.source_declaration ?? null,
    body.source_note ?? null,
    body.public_share == null ? null : (body.public_share ? 1 : 0),
    body.internal_notes ?? null,
    ts,
    ctx.batch.id,
  );
  appendEvent({
    batch_id: ctx.batch.id,
    event_type: 'COLLECTION_UPDATED',
    actor: req.user.id,
    payload: { fields: Object.keys(body) },
  });
  res.json({ passport: shapePassport(loadContext(ctx.batch.id), req.user) });
});

router.post('/:id/submit', requireAuth, (req, res) => {
  const ctx = readOwned(req, res);
  if (!ctx) return;
  if (![ctx.batch.collector_id, ctx.batch.centre_id && req.user.centre_id].includes(req.user.id) && req.user.role !== 'centre' && req.user.role !== 'admin') {
    if (req.user.id !== ctx.batch.collector_id && !(req.user.role === 'centre' && req.user.centre_id === ctx.batch.centre_id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the collector or the collection centre can submit this batch.' });
    }
  }
  if (!['draft', 'needs_info', 'rejected', 'failed_checks'].includes(ctx.batch.status)) {
    return res.status(400).json({ error: 'This batch is not in a state that can be submitted again.' });
  }
  db.prepare('UPDATE batches SET status = ?, public_share = CASE WHEN public_share = 1 THEN 1 ELSE ? END, updated_at = ? WHERE id = ?')
    .run('pending_verification', req.body && req.body.public_share ? 1 : ctx.batch.public_share, now(), ctx.batch.id);
  appendEvent({ batch_id: ctx.batch.id, event_type: 'ASSESSMENT_SUBMITTED', actor: req.user.id, payload: { status: 'pending_verification', resubmission: ctx.batch.status !== 'draft' } });
  const rev = snapshotRevision(ctx.batch.id, req.user.id, ctx.batch.status === 'draft' ? 'Initial submission' : `Resubmitted after "${ctx.batch.status}"`);
  announceSubmission(ctx.batch, ctx.batch.status === 'draft' ? 'new' : 'resubmitted', req.user);
  res.json({ passport: shapePassport(loadContext(ctx.batch.id), req.user) });
});

router.post('/:id/handling', requireAuth, (req, res) => {
  const ctx = readOwned(req, res);
  if (!ctx) return;
  if (!['collector', 'centre', 'admin', 'inspector'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You cannot add handling records.' });
  }
  if (req.user.role === 'collector' && req.user.id !== ctx.batch.collector_id) {
    return res.status(403).json({ error: 'You cannot add handling records to another collector\'s batch.' });
  }
  const row = req.body || {};
  if (!row.kind) return res.status(400).json({ error: 'Handling kind is required.' });
  db.prepare(`
    INSERT INTO handling_records (id, batch_id, kind, method, location, start_date, end_date, notes, recorded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nid('HN'), ctx.batch.id, row.kind, row.method || null, row.location || null, row.start_date || null, row.end_date || null, row.notes || null, req.user.id, now());
  appendEvent({ batch_id: ctx.batch.id, event_type: 'HANDLING_RECORDED', actor: req.user.id, payload: { kind: row.kind } });
  res.status(201).json({ passport: shapePassport(loadContext(ctx.batch.id), req.user) });
});

router.post('/:id/measurements', requireAuth, requireRole('collector', 'inspector', 'admin', 'centre'), (req, res) => {
  const ctx = readOwned(req, res);
  if (!ctx) return;
  if (req.user.role === 'collector' && req.user.id !== ctx.batch.collector_id) {
    return res.status(403).json({ error: 'You cannot add measurements to another collector\'s batch.' });
  }
  try {
    insertMeasurement(ctx.batch.id, req.body || {}, req.user, now());
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  appendEvent({
    batch_id: ctx.batch.id,
    event_type: 'MEASUREMENT_RECORDED',
    actor: req.user.id,
    payload: { parameter: req.body.parameter_name || req.body.parameter, evidence_source: req.body.evidence_source || 'self_reported' },
  });
  res.status(201).json({ passport: shapePassport(loadContext(ctx.batch.id), req.user) });
});

router.post('/:id/evidence', requireAuth, (req, res) => {
  const ctx = readOwned(req, res);
  if (!ctx) return;
  if (req.user.role === 'buyer') return res.status(403).json({ error: 'Buyers cannot change batch evidence.' });
  if (req.user.role === 'collector' && req.user.id !== ctx.batch.collector_id) {
    return res.status(403).json({ error: 'You cannot add evidence to another collector\'s batch.' });
  }
  const body = req.body || {};
  let stored = null;
  let filename = body.filename || null;
  let mime = body.mime || null;
  if (body.data_base64) {
    if (!ALLOWED_MIME.has(mime)) return res.status(400).json({ error: 'Upload a JPEG, PNG, WEBP, or PDF.' });
    const buf = Buffer.from(body.data_base64, 'base64');
    if (!buf.length || buf.length > 1_200_000) return res.status(400).json({ error: 'File must be under 1.2 MB.' });
    fs.mkdirSync(UPLOADS, { recursive: true });
    const ext = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1].replace('jpeg', 'jpg');
    stored = `${uuid()}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS, stored), buf);
  }
  const visibility = body.visibility === 'public' ? 'public' : 'private';
  db.prepare(`
    INSERT INTO evidence (id, batch_id, kind, label, filename, mime, stored_name, visibility, uploaded_by, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nid('EV'), ctx.batch.id, body.kind || 'note', body.label || null, filename, mime, stored, visibility, req.user.id, body.note || null, now());
  appendEvent({ batch_id: ctx.batch.id, event_type: 'EVIDENCE_ADDED', actor: req.user.id, payload: { kind: body.kind || 'note', visibility } });
  res.status(201).json({ passport: shapePassport(loadContext(ctx.batch.id), req.user) });
});

router.post('/:id/verification', requireAuth, requireRole('inspector', 'admin'), (req, res) => {
  const ctx = readOwned(req, res);
  if (!ctx) return;
  const status = req.body && req.body.status;
  const allowed = ['verified', 'verified_with_limitations', 'failed_checks', 'rejected', 'needs_info', 'pending_verification'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Unknown verification status.' });
  const profile = evaluateProfile(ctx.parameters, ctx.measurements);
  const missing = profile.checks.filter((c) => c.required && c.outcome === 'needs_additional_evidence');
  if (status === 'verified' && missing.length) {
    return res.status(400).json({
      error: 'This batch cannot be marked fully verified while required measurements are missing.',
      missing: missing.map((c) => c.parameter),
    });
  }
  const id = nid('VF');
  const ts = now();
  db.prepare(`
    INSERT INTO verifications (id, batch_id, inspector_id, status, summary, limitations, resolves_rejection_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, ctx.batch.id, req.user.id, status, req.body.summary || null, req.body.limitations || null, req.body.resolves_rejection_id || null, ts);
  if (req.body.resolves_rejection_id) {
    db.prepare('UPDATE rejections SET resolved_by_verification_id = ? WHERE id = ? AND batch_id = ?')
      .run(id, req.body.resolves_rejection_id, ctx.batch.id);
  }
  db.prepare('UPDATE batches SET status = ?, updated_at = ? WHERE id = ?').run(status, ts, ctx.batch.id);
  appendEvent({ batch_id: ctx.batch.id, event_type: 'ASSESSMENT_REVIEWED', actor: req.user.id, payload: { status } });
  res.status(201).json({ passport: shapePassport(loadContext(ctx.batch.id), req.user) });
});

router.post('/:id/rejections', requireAuth, requireRole('inspector', 'buyer', 'admin'), (req, res) => {
  const ctx = readOwned(req, res);
  if (!ctx) return;
  const body = req.body || {};
  if (!body.category || !body.explanation) return res.status(400).json({ error: 'A reason category and an explanation are required.' });
  const id = nid('RJ');
  db.prepare(`
    INSERT INTO rejections (id, batch_id, actor_id, offer_id, category, explanation, measurement_ref, corrective_action, reassessment_needed, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, ctx.batch.id, req.user.id, body.offer_id || null, body.category, body.explanation, body.measurement_ref || null, body.corrective_action || null, body.reassessment_needed === false ? 0 : 1, now());
  if (req.user.role === 'inspector' || req.user.role === 'admin') {
    db.prepare('UPDATE batches SET status = ?, updated_at = ? WHERE id = ?').run('rejected', now(), ctx.batch.id);
  }
  if (body.offer_id && req.user.role === 'buyer') {
    db.prepare('UPDATE offers SET status = ?, updated_at = ? WHERE id = ? AND buyer_user_id = ?')
      .run('rejected', now(), body.offer_id, req.user.id);
  }
  appendEvent({ batch_id: ctx.batch.id, event_type: 'REJECTION_RECORDED', actor: req.user.id, payload: { category: body.category } });
  res.status(201).json({ passport: shapePassport(loadContext(ctx.batch.id), req.user) });
});

router.post('/:id/passport', requireAuth, (req, res) => {
  const ctx = readOwned(req, res);
  if (!ctx) return;
  appendEvent({ batch_id: ctx.batch.id, event_type: 'PASSPORT_GENERATED', actor: req.user.id, payload: { batch_code: ctx.batch.batch_code } });
  res.json({ passport: shapePassport(loadContext(ctx.batch.id), req.user) });
});

function insertMeasurement(batchId, row, user, ts) {
  const name = row.parameter_name || row.parameter;
  if (!name) throw new Error('Parameter name is required.');
  let source = row.evidence_source || 'self_reported';
  if (user.role === 'collector' || user.role === 'centre') {
    if (!['self_reported', 'imported'].includes(source)) source = 'self_reported';
    if (source === 'imported' && !row.notes) throw new Error('An imported value needs a note naming the source.');
  }
  if (source === 'simulated' && user.role !== 'admin') {
    throw new Error('Simulated values can only be entered by an administrator on demonstration data.');
  }
  const verified = user.role === 'inspector' || user.role === 'admin' ? (row.verified ? 1 : 0) : 0;
  if ((row.value == null || row.value === '') && !row.text_value) {
    source = 'unavailable';
  }
  db.prepare(`
    INSERT INTO measurements (
      id, batch_id, parameter_name, value, text_value, unit, measured_at, method, evidence_source, verified, recorded_by, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nid('MS'), batchId, name,
    row.value == null || row.value === '' ? null : Number(row.value),
    row.text_value || null,
    row.unit || null,
    row.measured_at || ts.slice(0, 10),
    row.method || null,
    source,
    verified,
    user.id,
    row.notes || null,
    ts,
  );
}

router.use('/evidence-file', (req, res) => res.status(404).end());

module.exports = router;
