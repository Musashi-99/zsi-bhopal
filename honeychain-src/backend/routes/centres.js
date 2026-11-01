const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { appendEvent } = require('../services/ledger');
const { hashPassword } = require('../services/auth');

const router = express.Router();

function nid(prefix) {
  return `${prefix}-${uuid().slice(0, 8).toUpperCase()}`;
}

function ownCentre(req, res) {
  const centre = db.prepare('SELECT * FROM centres WHERE id = ?').get(req.params.id);
  if (!centre) {
    res.status(404).json({ error: 'Collection centre not found.' });
    return null;
  }
  if (req.user.role === 'admin') return centre;
  if (req.user.role === 'centre' && req.user.centre_id === centre.id) return centre;
  res.status(403).json({ error: 'You cannot manage this collection centre.' });
  return null;
}

router.get('/', requireAuth, (req, res) => {
  let rows;
  if (req.user.role === 'admin') rows = db.prepare('SELECT * FROM centres ORDER BY name').all();
  else if (req.user.role === 'centre') rows = db.prepare('SELECT * FROM centres WHERE id = ?').all(req.user.centre_id);
  else rows = db.prepare('SELECT id, name, state_id, district_id, address, coverage_note, is_demo FROM centres').all();
  res.json({ centres: rows });
});

router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.state_id || !body.district_id) return res.status(400).json({ error: 'Name, state, and district are required.' });
  const id = nid('CE');
  db.prepare('INSERT INTO centres (id, name, state_id, district_id, manager_user_id, address, is_demo, coverage_note) VALUES (?, ?, ?, ?, ?, ?, 0, ?)')
    .run(id, body.name, body.state_id, body.district_id, body.manager_user_id || null, body.address || null, body.coverage_note || 'Added in this application. Not a claim that the centre is operational.');
  if (body.manager_user_id) db.prepare('UPDATE users SET centre_id = ? WHERE id = ?').run(id, body.manager_user_id);
  res.status(201).json({ centre: db.prepare('SELECT * FROM centres WHERE id = ?').get(id) });
});

router.get('/:id/collectors', requireAuth, (req, res) => {
  const centre = ownCentre(req, res);
  if (!centre) return;
  const collectors = db.prepare(`
    SELECT DISTINCT u.id, u.name, u.phone, u.district_id, u.is_demo
    FROM users u
    LEFT JOIN batches b ON b.collector_id = u.id
    WHERE u.role = 'collector' AND (b.centre_id = ? OR u.centre_id = ?)
  `).all(centre.id, centre.id);
  res.json({ collectors });
});

router.post('/:id/collectors', requireAuth, (req, res) => {
  const centre = ownCentre(req, res);
  if (!centre) return;
  const body = req.body || {};
  if (!body.name || !body.email || !body.password) return res.status(400).json({ error: 'Name, email, and a temporary password are required.' });
  if (String(body.password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(String(body.email).toLowerCase());
  if (exists) return res.status(409).json({ error: 'That email is already registered.' });
  const id = nid('U');
  db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, preferred_language, state_id, district_id, centre_id, active, is_demo, created_at)
    VALUES (?, ?, ?, ?, ?, 'collector', 'en', ?, ?, ?, 1, 0, ?)
  `).run(id, body.name, String(body.email).toLowerCase(), body.phone || null, hashPassword(body.password), centre.state_id, centre.district_id, centre.id, new Date().toISOString());
  res.status(201).json({ collector: { id, name: body.name, email: String(body.email).toLowerCase() }, notice: 'Share the temporary password with the collector once. It is not stored in plain text.' });
});

router.get('/:id/inventory', requireAuth, (req, res) => {
  const centre = ownCentre(req, res);
  if (!centre) return;
  const items = db.prepare(`
    SELECT i.*, b.batch_code, b.status AS batch_status, p.name AS product_name
    FROM inventory i
    JOIN batches b ON b.id = i.batch_id
    JOIN products p ON p.id = b.product_id
    WHERE i.centre_id = ?
    ORDER BY i.updated_at DESC
  `).all(centre.id);
  res.json({ inventory: items });
});

router.post('/:id/processing', requireAuth, (req, res) => {
  const centre = ownCentre(req, res);
  if (!centre) return;
  const body = req.body || {};
  if (!body.batch_id || !body.method) return res.status(400).json({ error: 'Batch and method are required.' });
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND centre_id = ?').get(body.batch_id, centre.id);
  if (!batch) return res.status(404).json({ error: 'That batch is not at this centre.' });
  const ts = new Date().toISOString();
  const id = nid('PRC');
  db.prepare(`
    INSERT INTO processing_records (id, centre_id, batch_id, method, input_qty, output_qty, unit, processed_at, operator_id, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, centre.id, batch.id, body.method, body.input_qty ?? batch.quantity, body.output_qty ?? null, body.unit || batch.unit, body.processed_at || ts.slice(0, 10), req.user.id, body.notes || null, ts);
  if (body.output_qty != null) {
    db.prepare('UPDATE inventory SET quantity = ?, status = ?, updated_at = ? WHERE centre_id = ? AND batch_id = ?')
      .run(Number(body.output_qty), 'processing', ts, centre.id, batch.id);
  }
  db.prepare(`
    INSERT INTO handling_records (id, batch_id, kind, method, location, start_date, end_date, notes, recorded_by, created_at)
    VALUES (?, ?, 'processing', ?, ?, ?, ?, ?, ?, ?)
  `).run(nid('HN'), batch.id, body.method, centre.name, body.processed_at || null, body.processed_at || null, body.notes || null, req.user.id, ts);
  appendEvent({ batch_id: batch.id, event_type: 'PROCESSING_RECORDED', actor: req.user.id, payload: { method: body.method } });
  res.status(201).json({ id });
});

router.post('/:id/dispatch', requireAuth, (req, res) => {
  const centre = ownCentre(req, res);
  if (!centre) return;
  const body = req.body || {};
  if (!body.batch_id || body.quantity == null) return res.status(400).json({ error: 'Batch and quantity are required.' });
  const batch = db.prepare('SELECT * FROM batches WHERE id = ? AND centre_id = ?').get(body.batch_id, centre.id);
  if (!batch) return res.status(404).json({ error: 'That batch is not at this centre.' });
  const ts = new Date().toISOString();
  const id = nid('DP');
  db.prepare(`
    INSERT INTO dispatches (id, centre_id, batch_id, order_id, buyer_user_id, quantity, unit, dispatch_date, delivery_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, centre.id, batch.id, body.order_id || null, body.buyer_user_id || null, Number(body.quantity), body.unit || batch.unit, body.dispatch_date || ts.slice(0, 10), body.delivery_status || 'dispatched', ts);
  db.prepare('UPDATE inventory SET status = ?, quantity = CASE WHEN quantity >= ? THEN quantity - ? ELSE quantity END, updated_at = ? WHERE centre_id = ? AND batch_id = ?')
    .run('dispatched', Number(body.quantity), Number(body.quantity), ts, centre.id, batch.id);
  db.prepare('UPDATE batches SET status = ?, updated_at = ? WHERE id = ?').run('dispatched', ts, batch.id);
  if (body.order_id) {
    db.prepare('UPDATE orders SET delivery_status = ?, status = ? WHERE id = ?').run(body.delivery_status || 'dispatched', 'dispatched', body.order_id);
  }
  appendEvent({ batch_id: batch.id, event_type: 'DISPATCH_RECORDED', actor: req.user.id, payload: { quantity: Number(body.quantity) } });
  res.status(201).json({ id });
});

router.get('/:id/analytics', requireAuth, (req, res) => {
  const centre = ownCentre(req, res);
  if (!centre) return;
  const byStatus = db.prepare('SELECT status, COUNT(*) AS count FROM inventory WHERE centre_id = ? GROUP BY status').all(centre.id);
  const incoming = db.prepare('SELECT COUNT(*) AS count FROM batches WHERE centre_id = ?').get(centre.id).count;
  const pending = db.prepare("SELECT COUNT(*) AS count FROM batches WHERE centre_id = ? AND status IN ('submitted', 'pending_verification', 'needs_info')").get(centre.id).count;
  const sales = db.prepare("SELECT COUNT(*) AS count FROM orders o JOIN batches b ON b.id = o.batch_id WHERE b.centre_id = ?").get(centre.id).count;
  res.json({
    note: 'Counts come from records stored for this centre. They are not a claim about district-wide trade.',
    incoming,
    pending_quality: pending,
    sales_recorded: sales,
    inventory_by_status: byStatus,
  });
});

module.exports = router;
