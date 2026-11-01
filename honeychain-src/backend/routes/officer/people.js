const express = require('express');
const db = require('../../db/db');
const { APPROVED, REJECTED, scope, maskPhone, maskEmail } = require('./helpers');

const router = express.Router();

// Heuristic flags only. They point an officer at records worth a look; they are not findings of wrongdoing.
function computeFlags(batches) {
  const flags = new Map();
  const add = (id, f) => { if (!flags.has(id)) flags.set(id, []); flags.get(id).push(f); };
  const seen = new Map();
  for (const b of batches) {
    const key = [b.collector_id, b.product_id, b.collection_date, Number(b.quantity), b.unit].join('|');
    if (seen.has(key)) {
      add(b.id, { kind: 'possible_duplicate', text: `Same collector, product, date and quantity as ${seen.get(key)}.` });
      add(batches.find((x) => x.batch_code === seen.get(key)).id, { kind: 'possible_duplicate', text: `Matches ${b.batch_code}.` });
    } else seen.set(key, b.batch_code);
  }
  const groups = new Map();
  for (const b of batches) {
    const k = `${b.product_id}|${b.unit}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(b);
  }
  for (const list of groups.values()) {
    if (list.length < 4) continue;
    const sorted = list.map((b) => Number(b.quantity)).sort((a, c) => a - c);
    const median = sorted[Math.floor(sorted.length / 2)];
    for (const b of list) {
      if (median > 0 && Number(b.quantity) > median * 5) add(b.id, { kind: 'quantity_outlier', text: `${b.quantity} ${b.unit} is over 5x the median (${median} ${b.unit}) for this product.` });
    }
  }
  for (const b of batches) {
    if (REJECTED.includes(b.status)) add(b.id, { kind: 'rejected', text: 'Previously rejected.' });
  }
  return flags;
}

function allBatches(req) {
  const sc = scope(req);
  return db.prepare(`SELECT b.id, b.batch_code, b.collector_id, b.product_id, b.collection_date, b.quantity, b.unit, b.status
    FROM batches b WHERE b.status != 'draft' ${sc.sql}`).all(...sc.args);
}

router.get('/collectors', (req, res) => {
  const sc = scope(req, { state: 'u.state_id', district: 'u.district_id' });
  const users = db.prepare(`
    SELECT u.id, u.name, u.organisation, u.active, u.is_demo, u.created_at, d.name AS district_name, s.name AS state_name
    FROM users u LEFT JOIN districts d ON d.id = u.district_id LEFT JOIN states s ON s.id = u.state_id
    WHERE u.role = 'collector' ${sc.sql} ORDER BY u.name`).all(...sc.args);
  const batches = allBatches(req);
  const flags = computeFlags(batches);
  const centres = db.prepare('SELECT b.collector_id, c.name FROM batches b JOIN centres c ON c.id = b.centre_id GROUP BY b.collector_id, c.id').all();
  const out = users.map((u) => {
    const mine = batches.filter((b) => b.collector_id === u.id);
    return {
      ...u, is_demo: !!u.is_demo, active: !!u.active,
      batches: mine.length,
      approved: mine.filter((b) => APPROVED.includes(b.status)).length,
      rejected: mine.filter((b) => REJECTED.includes(b.status)).length,
      flags: mine.reduce((n, b) => n + (flags.get(b.id) || []).length, 0),
      centres: centres.filter((c) => c.collector_id === u.id).map((c) => c.name),
    };
  });
  res.json({ collectors: out, totals: { collectors: out.length, flagged: out.filter((c) => c.flags > 0).length } });
});

router.get('/collectors/:id', (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'collector'").get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Collector not found.' });
  const us = scope(req, { state: 'x.state_id', district: 'x.district_id' });
  if (!db.prepare(`SELECT 1 AS ok FROM users x WHERE x.id = ? ${us.sql}`).get(u.id, ...us.args)) {
    return res.status(403).json({ error: 'This collector is outside your jurisdiction.' });
  }
  const isAdmin = req.user.role === 'admin';
  const batches = db.prepare(`SELECT b.id, b.batch_code, b.collector_id, b.product_id, b.collection_date, b.quantity, b.unit, b.status, b.updated_at,
      p.name AS product_name, d.name AS district_name, c.name AS centre_name
    FROM batches b JOIN products p ON p.id = b.product_id JOIN districts d ON d.id = b.district_id LEFT JOIN centres c ON c.id = b.centre_id
    WHERE b.collector_id = ? AND b.status != 'draft' ORDER BY b.updated_at DESC`).all(u.id);
  const peers = allBatches(req);
  const flags = computeFlags(peers.length ? peers : batches);
  const activity = db.prepare(`SELECT e.seq, e.event_type, e.timestamp, b.batch_code FROM batch_events e JOIN batches b ON b.id = e.batch_id
    WHERE e.actor = ? ORDER BY e.seq DESC LIMIT 15`).all(u.id);
  res.json({
    collector: {
      id: u.id, name: u.name, organisation: u.organisation, active: !!u.active, is_demo: !!u.is_demo, member_since: u.created_at,
      phone: isAdmin ? u.phone : maskPhone(u.phone), email: isAdmin ? u.email : maskEmail(u.email),
      account_status: u.active ? 'Active account' : 'Deactivated',
    },
    batches: batches.map((b) => ({ ...b, flags: flags.get(b.id) || [] })),
    activity,
    privacy_note: isAdmin ? null : 'Contact details are masked for officers. Administrators can see full details.',
  });
});

module.exports = router;
