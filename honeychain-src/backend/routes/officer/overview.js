const express = require('express');
const db = require('../../db/db');
const { verifyChain } = require('../../services/ledger');

// Government Officer API. Officers use the existing `inspector` role; admins may also read.
// Every route is server-guarded. The frontend guard is a convenience only.
const router = express.Router();

const PENDING = ['pending_verification', 'submitted'];
const APPROVED = ['verified', 'verified_with_limitations'];
const REJECTED = ['rejected', 'failed_checks'];
const CORRECTION = ['needs_info'];

const marks = (list) => list.map(() => '?').join(',');
const count = (sql, ...args) => db.prepare(sql).get(...args).c;

router.get('/overview', (req, res) => {
  const submitted = "status != 'draft'";
  const inStatus = (list) => count(`SELECT COUNT(*) AS c FROM batches WHERE status IN (${marks(list)})`, ...list);

  const totals = {
    collectors: count("SELECT COUNT(*) AS c FROM users WHERE role = 'collector' AND active = 1"),
    centres: count('SELECT COUNT(*) AS c FROM centres'),
    submitted: count(`SELECT COUNT(*) AS c FROM batches WHERE ${submitted}`),
    pending: inStatus(PENDING),
    approved: inStatus(APPROVED),
    rejected: inStatus(REJECTED),
    correction: inStatus(CORRECTION),
  };

  // Units differ (kg, litre, piece...). Never add across units.
  const quantity_by_unit = db.prepare(`
    SELECT unit, ROUND(SUM(quantity), 2) AS total, COUNT(*) AS batches
    FROM batches WHERE ${submitted} GROUP BY unit ORDER BY batches DESC
  `).all();

  const by_district = db.prepare(`
    SELECT d.name AS label, s.name AS state, COUNT(*) AS batches
    FROM batches b JOIN districts d ON d.id = b.district_id JOIN states s ON s.id = b.state_id
    WHERE b.${submitted} GROUP BY b.district_id ORDER BY batches DESC LIMIT 8
  `).all();

  const by_product = db.prepare(`
    SELECT p.name AS label, COUNT(*) AS batches
    FROM batches b JOIN products p ON p.id = b.product_id
    WHERE b.${submitted} GROUP BY b.product_id ORDER BY batches DESC LIMIT 8
  `).all();

  const by_status = db.prepare(`SELECT status, COUNT(*) AS batches FROM batches GROUP BY status ORDER BY batches DESC`).all();

  const recent_activity = db.prepare(`
    SELECT e.seq, e.event_type, e.timestamp, e.actor, b.batch_code, u.name AS actor_name, u.role AS actor_role
    FROM batch_events e
    JOIN batches b ON b.id = e.batch_id
    LEFT JOIN users u ON u.id = e.actor
    ORDER BY e.seq DESC LIMIT 10
  `).all();

  const queue = db.prepare(`
    SELECT b.id, b.batch_code, b.quantity, b.unit, b.updated_at, p.name AS product_name, d.name AS district_name
    FROM batches b JOIN products p ON p.id = b.product_id JOIN districts d ON d.id = b.district_id
    WHERE b.status IN (${marks(PENDING)}) ORDER BY b.updated_at ASC LIMIT 6
  `).all(...PENDING);

  const demo = {
    batches: count('SELECT COUNT(*) AS c FROM batches WHERE is_demo = 1'),
    users: count('SELECT COUNT(*) AS c FROM users WHERE is_demo = 1'),
    centres: count('SELECT COUNT(*) AS c FROM centres WHERE is_demo = 1'),
  };

  const chain = verifyChain();

  res.json({
    generated_at: new Date().toISOString(),
    officer: { id: req.user.id, name: req.user.name, role: req.user.role, organisation: req.user.organisation || null },
    totals,
    quantity_by_unit,
    by_district,
    by_product,
    by_status,
    recent_activity,
    queue,
    demo,
    chain: { valid: chain.valid, total_events: chain.total_events, broken: chain.broken_events.length },
  });
});

module.exports = router;
