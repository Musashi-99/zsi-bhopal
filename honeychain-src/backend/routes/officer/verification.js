const express = require('express');
const db = require('../../db/db');
const { appendEvent } = require('../../services/ledger');
const { loadContext } = require('../../services/records');
const { evaluateProfile } = require('../../services/qualityEngine');
const { notify } = require('../../services/notify');
const { audit } = require('../../services/audit');
const { PENDING, GROUPS, nid, now, marks, parse, scope, inScope, maskPhone, maskEmail } = require('./helpers');

const router = express.Router();

const REJECT_CATEGORIES = ['evidence_insufficient', 'quantity_mismatch', 'quality_not_met', 'wrong_product_or_origin', 'duplicate_submission', 'other'];

router.get('/meta', (req, res) => {
  res.json({
    states: db.prepare('SELECT id, name FROM states WHERE is_active = 1 ORDER BY name').all(),
    districts: db.prepare('SELECT id, state_id, name FROM districts WHERE is_active = 1 ORDER BY name').all(),
    centres: db.prepare('SELECT id, name, district_id FROM centres ORDER BY name').all(),
    products: db.prepare('SELECT id, name, default_unit FROM products WHERE is_active = 1 ORDER BY name').all(),
    reject_categories: REJECT_CATEGORIES,
  });
});

const SUBMITTED_AT = '(COALESCE((SELECT MAX(r.created_at) FROM batch_revisions r WHERE r.batch_id = b.id), b.updated_at))';

router.get('/batches', (req, res) => {
  const { state, district, block, centre, product, from, to, status, q } = req.query;
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  let where = " WHERE b.status != 'draft'";
  const args = [];
  const sc = scope(req);
  where += sc.sql;
  args.push(...sc.args);
  if (state) { where += ' AND b.state_id = ?'; args.push(state); }
  if (district) { where += ' AND b.district_id = ?'; args.push(district); }
  if (block) { where += ' AND b.block_name LIKE ?'; args.push(`%${block}%`); }
  if (centre) { where += ' AND b.centre_id = ?'; args.push(centre); }
  if (product) { where += ' AND b.product_id = ?'; args.push(product); }
  if (from) { where += ` AND date(${SUBMITTED_AT}) >= date(?)`; args.push(from); }
  if (to) { where += ` AND date(${SUBMITTED_AT}) <= date(?)`; args.push(to); }
  if (status) {
    const list = GROUPS[status] || [status];
    where += ` AND b.status IN (${marks(list)})`;
    args.push(...list);
  }
  if (q) {
    where += ' AND (b.batch_code LIKE ? OR p.name LIKE ? OR u.name LIKE ?)';
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const fromSql = `FROM batches b JOIN products p ON p.id = b.product_id JOIN districts d ON d.id = b.district_id
    JOIN states s ON s.id = b.state_id JOIN users u ON u.id = b.collector_id LEFT JOIN centres c ON c.id = b.centre_id`;
  const total = db.prepare(`SELECT COUNT(*) AS c ${fromSql} ${where}`).get(...args).c;
  const rows = db.prepare(`
    SELECT b.id, b.batch_code, b.status, b.quantity, b.unit, b.collection_date, b.block_name, b.is_demo,
           p.name AS product_name, d.name AS district_name, s.name AS state_name, c.name AS centre_name,
           u.name AS collector_name, ${SUBMITTED_AT} AS submitted_at,
           (SELECT COUNT(*) FROM batch_revisions r WHERE r.batch_id = b.id) AS revisions
    ${fromSql} ${where}
    ORDER BY (CASE WHEN b.status IN ('pending_verification','submitted') THEN 0 ELSE 1 END), submitted_at ASC
    LIMIT ? OFFSET ?`).all(...args, limit, offset);
  res.json({ total, limit, offset, batches: rows });
});

function loadForOfficer(req, res) {
  const ctx = loadContext(req.params.id);
  if (!ctx || ctx.batch.status === 'draft') {
    res.status(404).json({ error: 'Batch not found.' });
    return null;
  }
  if (!inScope(req, ctx.batch)) {
    res.status(403).json({ error: 'This batch is outside your jurisdiction.' });
    return null;
  }
  return ctx;
}

router.get('/batches/:id', (req, res) => {
  const ctx = loadForOfficer(req, res);
  if (!ctx) return;
  const b = ctx.batch;
  const isAdmin = req.user.role === 'admin';
  const collector = db.prepare('SELECT id, name, organisation, phone, email, created_at FROM users WHERE id = ?').get(b.collector_id);
  const names = Object.fromEntries(db.prepare('SELECT id, name, role FROM users').all().map((u) => [u.id, u]));
  const inspections = db.prepare('SELECT * FROM inspection_records WHERE batch_id = ? ORDER BY created_at').all(b.id)
    .map((r) => ({ ...r, inspector_name: names[r.inspector_id] ? names[r.inspector_id].name : null }));
  const superseded = new Set(inspections.map((r) => r.supersedes_id).filter(Boolean));
  const inspectionsOut = inspections.map((r) => ({ ...r, superseded: superseded.has(r.id) }));
  res.json({
    batch: {
      id: b.id, batch_code: b.batch_code, status: b.status, is_demo: !!b.is_demo,
      product_id: b.product_id, product_name: b.product_name, local_name: b.local_name, variety: b.variety, grade_label: b.grade_label,
      quantity: b.quantity, unit: b.unit, collection_date: b.collection_date, collection_area: b.collection_area, block_name: b.block_name,
      state_name: b.state_name, district_name: b.district_name, centre_name: b.centre_name,
      collection_method: b.collection_method, source_type: b.source_type, source_declaration: b.source_declaration, source_note: b.source_note,
      created_at: b.created_at, updated_at: b.updated_at,
    },
    collector: {
      id: collector.id, name: collector.name, organisation: collector.organisation, member_since: collector.created_at,
      phone: isAdmin ? collector.phone : maskPhone(collector.phone), email: isAdmin ? collector.email : maskEmail(collector.email),
    },
    evidence: ctx.evidence.map((e) => ({
      id: e.id, kind: e.kind, label: e.label, filename: e.filename, mime: e.mime, note: e.note, visibility: e.visibility,
      created_at: e.created_at, url: e.stored_name ? `/api/evidence/${e.id}` : null,
    })),
    // Five evidence layers stay separate on purpose: self-reported, AI-assisted, instrument, laboratory, officer-reviewed.
    layers: {
      self_reported: ctx.measurements.filter((m) => m.evidence_source === 'self_reported' || m.evidence_source === 'imported'),
      ai_assisted: {
        note: ctx.intelligence.disclaimer,
        checks: ctx.intelligence.quality.checks,
        counts: ctx.intelligence.quality.counts,
        recommendations: (ctx.intelligence.recommendations || []).slice(0, 4),
      },
      instrument: inspectionsOut.filter((r) => r.evidence_source === 'instrument'),
      laboratory: inspectionsOut.filter((r) => r.evidence_source === 'laboratory'),
      officer_review: ctx.verifications.map((v) => ({
        id: v.id, status: v.status, summary: v.summary, limitations: v.limitations, officer: v.inspector_name, created_at: v.created_at,
      })),
    },
    inspections: inspectionsOut,
    handling: ctx.handling,
    rejections: ctx.rejections,
    corrections: db.prepare('SELECT * FROM correction_requests WHERE batch_id = ? ORDER BY created_at').all(b.id)
      .map((c) => ({ ...c, items: parse(c.items_json, []), officer_name: names[c.officer_id] ? names[c.officer_id].name : null })),
    revisions: db.prepare('SELECT * FROM batch_revisions WHERE batch_id = ? ORDER BY revision').all(b.id)
      .map((r) => ({ id: r.id, revision: r.revision, note: r.note, created_at: r.created_at, submitted_by: names[r.submitted_by] ? names[r.submitted_by].name : null, snapshot: parse(r.snapshot_json, {}) })),
    events: ctx.events.map((e) => ({
      seq: e.seq, event_type: e.event_type, timestamp: e.timestamp, payload: e.payload, hash: e.hash,
      actor_name: names[e.actor] ? names[e.actor].name : 'System', actor_role: names[e.actor] ? names[e.actor].role : null,
    })),
    requirements: ctx.requirements.filter((r) => r.status === 'active').map((r) => ({
      id: r.id, buyer: r.organisation || r.buyer_name, grade_label: r.grade_label, min_qty: r.min_qty, max_qty: r.max_qty,
      unit: r.unit, specs: parse(r.specs_json, []), valid_until: r.valid_until, offer_kind: r.offer_kind,
    })),
    qr: { code: b.batch_code, verify_path: `/market/verify/${b.batch_code}` },
    can_decide: PENDING.includes(b.status),
    can_suspend: !['suspended', 'draft'].includes(b.status),
    can_reinstate: b.status === 'suspended',
  });
});

function guardDecision(req, res) {
  const ctx = loadForOfficer(req, res);
  if (!ctx) return null;
  if (!PENDING.includes(ctx.batch.status)) {
    res.status(409).json({ error: `This batch is "${ctx.batch.status}" and is not waiting for a decision. Wait for a resubmission.` });
    return null;
  }
  return ctx;
}

function record(ctx, req, status, summary, limitations, eventPayload) {
  const vid = nid('VF');
  const ts = now();
  db.transaction(() => {
    db.prepare('INSERT INTO verifications (id, batch_id, inspector_id, status, summary, limitations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(vid, ctx.batch.id, req.user.id, status, summary || null, limitations || null, ts);
    db.prepare('UPDATE batches SET status = ?, updated_at = ? WHERE id = ?').run(status, ts, ctx.batch.id);
    appendEvent({ batch_id: ctx.batch.id, event_type: 'ASSESSMENT_REVIEWED', actor: req.user.id, payload: { status, officer_review: true, ...eventPayload } }, { inTransaction: true });
  }, { immediate: true })();
  return vid;
}

router.post('/batches/:id/approve', (req, res) => {
  const ctx = guardDecision(req, res);
  if (!ctx) return;
  const { summary, limitations } = req.body || {};
  const hasLimits = !!(limitations && String(limitations).trim());
  const profile = evaluateProfile(ctx.parameters, ctx.measurements);
  const missing = profile.checks.filter((c) => c.required && c.outcome === 'needs_additional_evidence').map((c) => c.parameter);
  if (missing.length && !hasLimits) {
    return res.status(400).json({ error: 'Required measurements are missing. Record the limitation to approve with limitations, or request a correction.', missing });
  }
  const status = hasLimits || missing.length ? 'verified_with_limitations' : 'verified';
  record(ctx, req, status, summary, limitations, {});
  notify(ctx.batch.collector_id, {
    kind: 'batch_approved', title: `Batch ${ctx.batch.batch_code} approved`,
    body: status === 'verified_with_limitations' ? `Approved with limitations: ${limitations}` : 'An officer reviewed and approved this batch.',
    batch_id: ctx.batch.id, link: `/passport/${ctx.batch.id}`,
  });
  res.status(201).json({ ok: true, status });
});

router.post('/batches/:id/reject', (req, res) => {
  const ctx = guardDecision(req, res);
  if (!ctx) return;
  const { category, explanation, remarks } = req.body || {};
  if (!REJECT_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Choose a rejection reason.' });
  if (!explanation || String(explanation).trim().length < 10) return res.status(400).json({ error: 'Explain the rejection in at least 10 characters.' });
  const rid = nid('RJ');
  db.prepare(`INSERT INTO rejections (id, batch_id, actor_id, category, explanation, corrective_action, reassessment_needed, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)`).run(rid, ctx.batch.id, req.user.id, category, String(explanation).trim(), remarks || null, now());
  record(ctx, req, 'rejected', String(explanation).trim(), null, { category });
  appendEvent({ batch_id: ctx.batch.id, event_type: 'REJECTION_RECORDED', actor: req.user.id, payload: { category, by: 'officer' } });
  notify(ctx.batch.collector_id, {
    kind: 'batch_rejected', title: `Batch ${ctx.batch.batch_code} rejected`,
    body: String(explanation).trim().slice(0, 200), batch_id: ctx.batch.id, link: `/rejections/${ctx.batch.id}`,
  });
  res.status(201).json({ ok: true, status: 'rejected', rejection_id: rid });
});

router.post('/batches/:id/request-correction', (req, res) => {
  const ctx = guardDecision(req, res);
  if (!ctx) return;
  const { items, message } = req.body || {};
  const list = (Array.isArray(items) ? items : []).map((i) => String(i).trim()).filter(Boolean).slice(0, 20);
  if (!list.length) return res.status(400).json({ error: 'List at least one missing document or incorrect field.' });
  if (!message || String(message).trim().length < 10) return res.status(400).json({ error: 'Add a message of at least 10 characters for the collector.' });
  const cid = nid('CR');
  db.prepare('INSERT INTO correction_requests (id, batch_id, officer_id, items_json, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(cid, ctx.batch.id, req.user.id, JSON.stringify(list), String(message).trim(), 'open', now());
  record(ctx, req, 'needs_info', String(message).trim(), null, { correction_items: list.length });
  notify(ctx.batch.collector_id, {
    kind: 'correction_requested', title: `Correction requested for ${ctx.batch.batch_code}`,
    body: `${list.join('; ')} - ${String(message).trim()}`.slice(0, 240), batch_id: ctx.batch.id, link: `/batches/${ctx.batch.id}/edit`,
  });
  res.status(201).json({ ok: true, status: 'needs_info', correction_id: cid });
});

// Suspension is separate from rejection: it can be applied to a batch in any reviewed state and is reversible.
// The marketplace and the public verify page read the status from the batch row, so the change is immediate.
function notifyAffected(ctx, title, body) {
  const ids = new Set([ctx.batch.collector_id]);
  if (ctx.batch.centre_id) {
    for (const u of db.prepare("SELECT id FROM users WHERE role = 'centre' AND centre_id = ? AND active = 1").all(ctx.batch.centre_id)) ids.add(u.id);
  }
  for (const u of db.prepare("SELECT DISTINCT buyer_user_id AS id FROM enquiries WHERE batch_id = ? AND status IN ('open','negotiating')").all(ctx.batch.id)) ids.add(u.id);
  for (const id of ids) notify(id, { kind: 'batch_suspended', title, body, batch_id: ctx.batch.id, link: id === ctx.batch.collector_id ? `/passport/${ctx.batch.id}` : null });
}

router.post('/batches/:id/suspend', (req, res) => {
  const ctx = loadForOfficer(req, res);
  if (!ctx) return;
  if (ctx.batch.status === 'suspended') return res.status(409).json({ error: 'This batch is already suspended.' });
  const reason = String((req.body && req.body.reason) || '').trim();
  if (reason.length < 10) return res.status(400).json({ error: 'Give a reason of at least 10 characters. It is kept in the audit trail.' });
  const previous = ctx.batch.status;
  record(ctx, req, 'suspended', reason, null, { suspended: true, previous_status: previous });
  audit(req.user, { action: 'BATCH_SUSPENDED', entity_type: 'batch', entity_id: ctx.batch.id, before: { status: previous }, after: { status: 'suspended' }, reason });
  notifyAffected(ctx, `Batch ${ctx.batch.batch_code} suspended`, reason.slice(0, 200));
  res.status(201).json({ ok: true, status: 'suspended' });
});

router.post('/batches/:id/reinstate', (req, res) => {
  const ctx = loadForOfficer(req, res);
  if (!ctx) return;
  if (ctx.batch.status !== 'suspended') return res.status(409).json({ error: 'Only a suspended batch can be reinstated.' });
  const reason = String((req.body && req.body.reason) || '').trim();
  if (reason.length < 10) return res.status(400).json({ error: 'Explain why the suspension is lifted (at least 10 characters).' });
  record(ctx, req, 'pending_verification', reason, null, { reinstated: true });
  audit(req.user, { action: 'BATCH_REINSTATED', entity_type: 'batch', entity_id: ctx.batch.id, before: { status: 'suspended' }, after: { status: 'pending_verification' }, reason });
  notifyAffected(ctx, `Batch ${ctx.batch.batch_code} reinstated for review`, reason.slice(0, 200));
  res.status(201).json({ ok: true, status: 'pending_verification' });
});

module.exports = router;
