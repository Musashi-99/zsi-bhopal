const express = require('express');
const db = require('../../db/db');
const { audit } = require('../../services/audit');
const { PENDING, CORRECTION, now, marks, scope, maskPhone } = require('./helpers');

const router = express.Router();

function centreScope(req) {
  return scope(req, { state: 'c.state_id', district: 'c.district_id' });
}

router.get('/centres', (req, res) => {
  const sc = centreScope(req);
  const rows = db.prepare(`
    SELECT c.*, s.name AS state_name, d.name AS district_name, u.name AS operator_name,
      (SELECT COUNT(*) FROM batches b WHERE b.centre_id = c.id AND b.status != 'draft') AS batches,
      (SELECT COUNT(*) FROM batches b WHERE b.centre_id = c.id AND b.status IN (${marks([...PENDING, ...CORRECTION])})) AS pending,
      (SELECT COUNT(DISTINCT b.collector_id) FROM batches b WHERE b.centre_id = c.id) AS collectors,
      (SELECT ROUND(SUM(i.quantity), 2) FROM inventory i WHERE i.centre_id = c.id AND i.status = 'received') AS inventory_qty,
      (SELECT MAX(b.updated_at) FROM batches b WHERE b.centre_id = c.id) AS last_activity
    FROM centres c JOIN states s ON s.id = c.state_id JOIN districts d ON d.id = c.district_id
    LEFT JOIN users u ON u.id = c.manager_user_id
    WHERE 1 = 1 ${sc.sql} ORDER BY c.name`).all(...PENDING, ...CORRECTION, ...sc.args);
  res.json({ centres: rows.map((r) => ({ ...r, is_demo: !!r.is_demo })) });
});

router.get('/centres/:id', (req, res) => {
  const sc = centreScope(req);
  const c = db.prepare(`SELECT c.*, s.name AS state_name, d.name AS district_name FROM centres c
    JOIN states s ON s.id = c.state_id JOIN districts d ON d.id = c.district_id WHERE c.id = ? ${sc.sql}`).get(req.params.id, ...sc.args);
  if (!c) return res.status(404).json({ error: 'Collection centre not found in your jurisdiction.' });
  const isAdmin = req.user.role === 'admin';
  const operators = db.prepare("SELECT id, name, phone, active FROM users WHERE centre_id = ? AND role = 'centre'").all(c.id)
    .map((u) => ({ ...u, phone: isAdmin ? u.phone : maskPhone(u.phone) }));
  const collectors = db.prepare(`SELECT u.id, u.name, COUNT(b.id) AS batches, MAX(b.updated_at) AS last_activity
    FROM batches b JOIN users u ON u.id = b.collector_id WHERE b.centre_id = ? GROUP BY u.id ORDER BY batches DESC`).all(c.id);
  const byStatus = db.prepare('SELECT status, COUNT(*) AS n FROM batches WHERE centre_id = ? GROUP BY status').all(c.id);
  const byProduct = db.prepare(`SELECT p.name AS label, ROUND(SUM(b.quantity), 2) AS qty, b.unit, COUNT(*) AS batches
    FROM batches b JOIN products p ON p.id = b.product_id WHERE b.centre_id = ? AND b.status != 'draft' GROUP BY p.id, b.unit`).all(c.id);
  const inventory = db.prepare(`SELECT i.status, ROUND(SUM(i.quantity), 2) AS qty, i.unit, COUNT(*) AS lots FROM inventory i WHERE i.centre_id = ? GROUP BY i.status, i.unit`).all(c.id);
  const batches = db.prepare(`SELECT b.id, b.batch_code, b.status, b.quantity, b.unit, b.updated_at, p.name AS product_name
    FROM batches b JOIN products p ON p.id = b.product_id WHERE b.centre_id = ? AND b.status != 'draft' ORDER BY b.updated_at DESC LIMIT 12`).all(c.id);
  const activity = db.prepare(`SELECT e.seq, e.event_type, e.timestamp, b.batch_code, u.name AS actor_name FROM batch_events e
    JOIN batches b ON b.id = e.batch_id LEFT JOIN users u ON u.id = e.actor WHERE b.centre_id = ? ORDER BY e.seq DESC LIMIT 12`).all(c.id);
  const edits = db.prepare("SELECT * FROM audit_events WHERE entity_type = 'centre' AND entity_id = ? ORDER BY created_at DESC LIMIT 10").all(c.id);
  res.json({
    centre: { ...c, is_demo: !!c.is_demo, linked_groups: c.linked_groups ? c.linked_groups.split('\n').filter(Boolean) : [] },
    operators, collectors, by_status: byStatus, by_product: byProduct, inventory, batches, activity, edits,
    can_edit: true,
  });
});

const CENTRE_STATUS = ['active', 'inactive', 'under_review'];
const ACCREDITATION = ['none', 'active', 'suspended', 'expired'];

// Officers can update operational details. Every change is audited with before/after and a reason.
router.patch('/centres/:id', (req, res) => {
  const sc = centreScope(req);
  const c = db.prepare(`SELECT c.* FROM centres c WHERE c.id = ? ${sc.sql}`).get(req.params.id, ...sc.args);
  if (!c) return res.status(404).json({ error: 'Collection centre not found in your jurisdiction.' });
  const b = req.body || {};
  if (!b.reason || String(b.reason).trim().length < 5) return res.status(400).json({ error: 'Give a reason for the change.' });
  if (b.status !== undefined && !CENTRE_STATUS.includes(b.status)) return res.status(400).json({ error: 'Unknown centre status.' });
  if (b.name !== undefined && !String(b.name).trim()) return res.status(400).json({ error: 'Centre name cannot be empty.' });
  if (b.accreditation_status !== undefined && !ACCREDITATION.includes(b.accreditation_status)) return res.status(400).json({ error: 'Unknown accreditation status.' });
  const linked = b.linked_groups !== undefined ? (Array.isArray(b.linked_groups) ? b.linked_groups : String(b.linked_groups).split('\n')).map((s) => String(s).trim()).filter(Boolean).join('\n') : undefined;
  const next = {
    name: b.name !== undefined ? String(b.name).trim() : c.name,
    address: b.address !== undefined ? b.address : c.address,
    block_name: b.block_name !== undefined ? b.block_name : c.block_name,
    status: b.status !== undefined ? b.status : c.status,
    linked_groups: linked !== undefined ? linked : c.linked_groups,
    accreditation_status: b.accreditation_status !== undefined ? b.accreditation_status : c.accreditation_status,
    accreditation_note: b.accreditation_note !== undefined ? (String(b.accreditation_note).trim().slice(0, 300) || null) : c.accreditation_note,
  };
  const accChanged = next.accreditation_status !== c.accreditation_status || next.accreditation_note !== c.accreditation_note;
  db.prepare('UPDATE centres SET name = ?, address = ?, block_name = ?, status = ?, linked_groups = ?, accreditation_status = ?, accreditation_note = ?, accreditation_updated_at = ?, updated_at = ? WHERE id = ?')
    .run(next.name, next.address || null, next.block_name || null, next.status, next.linked_groups || null, next.accreditation_status, next.accreditation_note || null, accChanged ? now() : c.accreditation_updated_at, now(), c.id);
  const before = { name: c.name, address: c.address, block_name: c.block_name, status: c.status, linked_groups: c.linked_groups, accreditation_status: c.accreditation_status, accreditation_note: c.accreditation_note };
  audit(req.user, { action: 'CENTRE_UPDATED', entity_type: 'centre', entity_id: c.id, before, after: next, reason: String(b.reason).trim() });
  res.json({ ok: true });
});

module.exports = router;
