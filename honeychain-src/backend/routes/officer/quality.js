const express = require('express');
const db = require('../../db/db');
const { appendEvent } = require('../../services/ledger');
const { loadContext } = require('../../services/records');
const { PENDING, APPROVED, nid, now, parse, scope, inScope, marks } = require('./helpers');

const router = express.Router();
const SOURCES = ['instrument', 'laboratory', 'officer_observation'];

// Product-specific quality standards (read-only for officers; administrators maintain limits).
router.get('/quality/standards', (req, res) => {
  const products = db.prepare('SELECT id, name, default_unit FROM products WHERE is_active = 1 ORDER BY name').all();
  const profiles = db.prepare('SELECT * FROM quality_profiles').all();
  const params = db.prepare('SELECT * FROM quality_parameters ORDER BY sort_order, name').all();
  res.json({
    standards: products.map((p) => ({
      ...p,
      profiles: profiles.filter((q) => q.product_id === p.id).map((q) => ({
        ...q, illustrative: !!q.illustrative,
        parameters: params.filter((x) => x.profile_id === q.id),
      })),
    })),
    note: 'Limits come from quality profiles configured per product. A blank limit means "not configured", not "no limit".',
  });
});

// Batches needing inspection attention + latest officer measurements.
router.get('/quality/queue', (req, res) => {
  const sc = scope(req);
  const rows = db.prepare(`
    SELECT b.id, b.batch_code, b.status, b.quantity, b.unit, p.name AS product_name, d.name AS district_name,
      (SELECT COUNT(*) FROM inspection_records i WHERE i.batch_id = b.id) AS inspections,
      (SELECT COUNT(*) FROM measurements m WHERE m.batch_id = b.id AND m.evidence_source = 'self_reported') AS self_reported
    FROM batches b JOIN products p ON p.id = b.product_id JOIN districts d ON d.id = b.district_id
    WHERE b.status IN (${marks([...PENDING, 'needs_info', ...APPROVED])}) ${sc.sql}
    ORDER BY (CASE WHEN b.status IN ('pending_verification','submitted') THEN 0 ELSE 1 END), inspections ASC, b.updated_at DESC
    LIMIT 100`).all(...PENDING, 'needs_info', ...APPROVED, ...sc.args);
  const recent = db.prepare(`
    SELECT i.*, b.batch_code, u.name AS inspector_name FROM inspection_records i
    JOIN batches b ON b.id = i.batch_id JOIN users u ON u.id = i.inspector_id
    WHERE 1 = 1 ${sc.sql} ORDER BY i.created_at DESC LIMIT 15`).all(...sc.args);
  res.json({ batches: rows, recent });
});

router.get('/batches/:id/quality', (req, res) => {
  const ctx = loadContext(req.params.id);
  if (!ctx || ctx.batch.status === 'draft') return res.status(404).json({ error: 'Batch not found.' });
  if (!inScope(req, ctx.batch)) return res.status(403).json({ error: 'This batch is outside your jurisdiction.' });
  const records = db.prepare(`SELECT i.*, u.name AS inspector_name FROM inspection_records i JOIN users u ON u.id = i.inspector_id
    WHERE i.batch_id = ? ORDER BY i.created_at`).all(ctx.batch.id);
  const superseded = new Set(records.map((r) => r.supersedes_id).filter(Boolean));
  res.json({
    batch: { id: ctx.batch.id, batch_code: ctx.batch.batch_code, status: ctx.batch.status, product_name: ctx.batch.product_name },
    parameters: ctx.parameters.map((p) => ({ name: p.name, unit: p.unit, min_value: p.min_value, max_value: p.max_value, required: !!p.required, method: p.method, source: p.source_name || p.profile_source, profile: p.profile_name, illustrative: !!p.profile_illustrative })),
    self_reported: ctx.measurements.filter((m) => m.evidence_source === 'self_reported'),
    records: records.map((r) => ({ ...r, superseded: superseded.has(r.id) })),
    evidence: ctx.evidence.map((e) => ({ id: e.id, kind: e.kind, label: e.label, filename: e.filename })),
    requirements: ctx.requirements.filter((r) => r.status === 'active').map((r) => ({ buyer: r.organisation || r.buyer_name, specs: parse(r.specs_json, []), grade_label: r.grade_label })),
    locked: APPROVED.includes(ctx.batch.status),
  });
});

router.post('/batches/:id/inspections', (req, res) => {
  const ctx = loadContext(req.params.id);
  if (!ctx || ctx.batch.status === 'draft') return res.status(404).json({ error: 'Batch not found.' });
  if (!inScope(req, ctx.batch)) return res.status(403).json({ error: 'This batch is outside your jurisdiction.' });
  const b = req.body || {};
  const name = String(b.parameter_name || '').trim();
  if (!name) return res.status(400).json({ error: 'Parameter name is required.' });
  if (!SOURCES.includes(b.evidence_source)) return res.status(400).json({ error: 'Evidence source must be instrument, laboratory or officer observation.' });
  const hasValue = b.value !== undefined && b.value !== null && b.value !== '';
  if (!hasValue && !b.text_value) return res.status(400).json({ error: 'Enter a measured value or a text result.' });
  if (hasValue && !Number.isFinite(Number(b.value))) return res.status(400).json({ error: 'Measured value must be a number.' });
  if (hasValue && !b.unit) return res.status(400).json({ error: 'Unit is required with a measured value.' });
  if (!b.method || !String(b.method).trim()) return res.status(400).json({ error: 'Testing method is required.' });
  if (!b.tested_on || Number.isNaN(Date.parse(b.tested_on))) return res.status(400).json({ error: 'Testing date is required.' });
  if (new Date(b.tested_on) > new Date(Date.now() + 86400000)) return res.status(400).json({ error: 'Testing date cannot be in the future.' });
  if (b.evidence_source === 'laboratory' && !String(b.lab_report_ref || '').trim()) return res.status(400).json({ error: 'A laboratory result needs a report reference.' });
  if (b.evidence_id && !ctx.evidence.some((e) => e.id === b.evidence_id)) return res.status(400).json({ error: 'That evidence file does not belong to this batch.' });

  const all = db.prepare('SELECT * FROM inspection_records WHERE batch_id = ? AND parameter_name = ? AND evidence_source = ?')
    .all(ctx.batch.id, name, b.evidence_source);
  const supersededIds = new Set(db.prepare('SELECT supersedes_id FROM inspection_records WHERE batch_id = ? AND supersedes_id IS NOT NULL').all(ctx.batch.id).map((r) => r.supersedes_id));
  const current = all.find((r) => !supersededIds.has(r.id));
  let version = 1;
  let supersedes = null;
  if (current) {
    if (b.supersedes_id !== current.id) {
      return res.status(409).json({ error: 'A result already exists for this parameter and source. Recorded results cannot be edited; submit a new version that replaces it.', current_id: current.id });
    }
    if (!b.change_reason || String(b.change_reason).trim().length < 5) return res.status(400).json({ error: 'Give a reason for the new version.' });
    version = current.version + 1;
    supersedes = current.id;
  } else if (b.supersedes_id) {
    return res.status(400).json({ error: 'Nothing to supersede for that parameter and source.' });
  }

  const id = nid('IR');
  db.prepare(`INSERT INTO inspection_records
    (id, batch_id, parameter_name, value, text_value, unit, method, tested_on, evidence_source, reference_standard, lab_report_ref, evidence_id, remarks, inspector_id, version, supersedes_id, change_reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, ctx.batch.id, name, hasValue ? Number(b.value) : null, b.text_value || null, b.unit || null, String(b.method).trim(), b.tested_on,
      b.evidence_source, b.reference_standard || null, b.lab_report_ref || null, b.evidence_id || null, b.remarks || null, req.user.id, version, supersedes, b.change_reason || null, now());
  appendEvent({ batch_id: ctx.batch.id, event_type: 'MEASUREMENT_RECORDED', actor: req.user.id, payload: { parameter: name, evidence_source: b.evidence_source, version, by: 'officer' } });
  res.status(201).json({ ok: true, id, version });
});

module.exports = router;
