const express = require('express');
const db = require('../../db/db');
const { requireRole } = require('../../middleware/auth');
const { hashPassword, verifyPassword } = require('../../services/auth');
const { verifyChain } = require('../../services/ledger');
const { audit } = require('../../services/audit');
const { nid, now, parse, officerProfile } = require('./helpers');

const router = express.Router();

// ---- Audit logs: hash-chained batch events + append-only audit_events ----
router.get('/audit', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 60, 200);
  const kind = req.query.kind; // 'batch' | 'admin'
  const users = Object.fromEntries(db.prepare('SELECT id, name, role FROM users').all().map((u) => [u.id, u]));
  const batchEvents = kind === 'admin' ? [] : db.prepare(`SELECT e.id, e.seq, e.event_type, e.actor, e.payload, e.timestamp, e.hash, b.batch_code
      FROM batch_events e JOIN batches b ON b.id = e.batch_id ORDER BY e.seq DESC LIMIT ?`).all(limit).map((e) => ({
    source: 'batch_chain', event_id: e.id, seq: e.seq, action: e.event_type, entity: `Batch ${e.batch_code}`, timestamp: e.timestamp,
    actor_id: e.actor, actor_name: users[e.actor] ? users[e.actor].name : 'System', actor_role: users[e.actor] ? users[e.actor].role : null,
    detail: parse(e.payload, {}), hash: e.hash.slice(0, 12),
  }));
  const adminEvents = kind === 'batch' ? [] : db.prepare('SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?').all(limit).map((e) => ({
    source: 'audit_log', event_id: e.id, seq: null, action: e.action, entity: `${e.entity_type} ${e.entity_id || ''}`.trim(), timestamp: e.created_at,
    actor_id: e.actor_id, actor_name: users[e.actor_id] ? users[e.actor_id].name : 'System', actor_role: e.actor_role,
    detail: { before: parse(e.before_json, null), after: parse(e.after_json, null), reason: e.reason },
  }));
  const events = [...batchEvents, ...adminEvents].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, limit);
  const chain = verifyChain();
  res.json({
    events,
    chain: { valid: chain.valid, total_events: chain.total_events, broken: chain.broken_events },
    admin_events: db.prepare('SELECT COUNT(*) AS c FROM audit_events').get().c,
    note: 'The chain shows records were not altered after they were written. It does not prove that the information submitted was correct.',
  });
});

// ---- Officer management (administrators only) ----
const adminOnly = requireRole('admin');

function officerRows() {
  return db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.active, u.is_demo, u.created_at, p.level, p.designation, p.state_id, p.district_id,
      s.name AS state_name, d.name AS district_name,
      (SELECT COUNT(*) FROM verifications v WHERE v.inspector_id = u.id) AS decisions
    FROM users u LEFT JOIN officer_profiles p ON p.user_id = u.id
    LEFT JOIN states s ON s.id = p.state_id LEFT JOIN districts d ON d.id = p.district_id
    WHERE u.role = 'inspector' ORDER BY u.created_at DESC`).all().map((o) => ({ ...o, active: !!o.active, is_demo: !!o.is_demo }));
}

router.get('/officers', adminOnly, (req, res) => {
  res.json({ officers: officerRows(), note: 'Officer accounts are created by an administrator. Officers cannot register themselves.' });
});

router.post('/officers', adminOnly, (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.email || !b.password) return res.status(400).json({ error: 'Name, email and password are required.' });
  if (!/^\S+@\S+\.\S+$/.test(b.email)) return res.status(400).json({ error: 'Enter a valid email.' });
  if (String(b.password).length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters.' });
  const level = b.level === 'state' ? 'state' : 'district';
  if (level === 'district' && !b.district_id) return res.status(400).json({ error: 'A district officer needs a district.' });
  if (level === 'state' && !b.state_id) return res.status(400).json({ error: 'A state officer needs a state.' });
  const district = b.district_id ? db.prepare('SELECT * FROM districts WHERE id = ?').get(b.district_id) : null;
  if (b.district_id && !district) return res.status(400).json({ error: 'Unknown district.' });
  const stateId = b.state_id || (district && district.state_id) || null;
  const mail = String(b.email).toLowerCase().trim();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(mail)) return res.status(409).json({ error: 'An account with that email already exists.' });
  const id = nid('U');
  const ts = now();
  db.transaction(() => {
    db.prepare(`INSERT INTO users (id, name, email, phone, password_hash, role, preferred_language, state_id, district_id, organisation, active, is_demo, created_at)
      VALUES (?, ?, ?, ?, ?, 'inspector', 'en', ?, ?, ?, 1, 0, ?)`)
      .run(id, String(b.name).trim(), mail, b.phone || null, hashPassword(b.password), stateId, level === 'district' ? b.district_id : null, b.designation || null, ts);
    db.prepare('INSERT INTO officer_profiles (user_id, level, designation, state_id, district_id, approved_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, level, b.designation || null, stateId, level === 'district' ? b.district_id : null, req.user.id, ts);
  })();
  audit(req.user, { action: 'OFFICER_CREATED', entity_type: 'user', entity_id: id, after: { email: mail, level, state_id: stateId, district_id: b.district_id || null }, reason: b.reason || 'Account created by administrator' });
  res.status(201).json({ id });
});

router.patch('/officers/:id', adminOnly, (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'inspector'").get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Officer not found.' });
  const b = req.body || {};
  if (!b.reason || String(b.reason).trim().length < 5) return res.status(400).json({ error: 'Give a reason for this change.' });
  if (b.active === false && u.id === req.user.id) return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  const prof = officerProfile(u) || { level: 'district', designation: null, state_id: u.state_id, district_id: u.district_id };
  const before = { active: !!u.active, level: prof.level, designation: prof.designation, state_id: prof.state_id, district_id: prof.district_id };
  const next = {
    active: b.active === undefined ? !!u.active : !!b.active,
    level: b.level === undefined ? prof.level : (b.level === 'state' ? 'state' : 'district'),
    designation: b.designation === undefined ? prof.designation : b.designation,
    state_id: b.state_id === undefined ? prof.state_id : b.state_id || null,
    district_id: b.district_id === undefined ? prof.district_id : b.district_id || null,
  };
  if (next.level === 'district' && !next.district_id) return res.status(400).json({ error: 'A district officer needs a district.' });
  db.transaction(() => {
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(next.active ? 1 : 0, u.id);
    db.prepare(`INSERT INTO officer_profiles (user_id, level, designation, state_id, district_id, approved_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET level = excluded.level, designation = excluded.designation, state_id = excluded.state_id, district_id = excluded.district_id`)
      .run(u.id, next.level, next.designation || null, next.state_id, next.level === 'district' ? next.district_id : null, req.user.id, now());
  })();
  audit(req.user, { action: before.active !== next.active ? (next.active ? 'OFFICER_ACTIVATED' : 'OFFICER_DEACTIVATED') : 'OFFICER_JURISDICTION_CHANGED', entity_type: 'user', entity_id: u.id, before, after: next, reason: String(b.reason).trim() });
  res.json({ ok: true });
});

// ---- Settings (own account) ----
router.get('/settings', (req, res) => {
  const p = officerProfile(req.user);
  const named = (table, id) => (id ? (db.prepare(`SELECT name FROM ${table} WHERE id = ?`).get(id) || {}).name || null : null);
  res.json({
    account: { name: req.user.name, email: req.user.email, role: req.user.role === 'admin' ? 'Administrator' : 'Government Officer', organisation: req.user.organisation },
    jurisdiction: p ? { level: p.level, designation: p.designation, state: named('states', p.state_id), district: named('districts', p.district_id) }
      : { level: req.user.role === 'admin' ? 'all' : 'unrestricted', designation: null, state: null, district: null },
    notifications: {
      unread: db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).c,
      total: db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?').get(req.user.id).c,
    },
  });
});

router.post('/settings/password', (req, res) => {
  const { current, next } = req.body || {};
  if (!current || !next) return res.status(400).json({ error: 'Enter your current and new password.' });
  if (String(next).length < 10) return res.status(400).json({ error: 'New password must be at least 10 characters.' });
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(current, row.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), req.user.id);
  audit(req.user, { action: 'PASSWORD_CHANGED', entity_type: 'user', entity_id: req.user.id });
  res.json({ ok: true });
});

module.exports = router;
