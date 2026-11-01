const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const user = req.user;
  if (user.role === 'collector') return res.json(collector(user));
  if (user.role === 'buyer') return res.json(buyer(user));
  if (user.role === 'inspector') return res.json(inspector());
  if (user.role === 'centre') return res.json(centre(user));
  return res.json(admin());
});

function collector(user) {
  const batches = db.prepare(`
    SELECT b.*, p.name AS product_name, d.name AS district_name
    FROM batches b
    JOIN products p ON p.id = b.product_id
    JOIN districts d ON d.id = b.district_id
    WHERE b.collector_id = ? ORDER BY b.updated_at DESC
  `).all(user.id);
  const offers = db.prepare(`
    SELECT COUNT(*) AS count FROM offers o JOIN batches b ON b.id = o.batch_id
    WHERE b.collector_id = ? AND o.status = 'submitted'
  `).get(user.id).count;
  const orders = db.prepare(`
    SELECT COUNT(*) AS count FROM orders o JOIN batches b ON b.id = o.batch_id
    WHERE b.collector_id = ? AND o.status NOT IN ('cancelled')
  `).get(user.id).count;
  const pending = batches.filter((b) => ['submitted', 'pending_verification', 'needs_info'].includes(b.status)).length;
  const verified = batches.filter((b) => ['verified', 'verified_with_limitations'].includes(b.status)).length;
  return {
    role: 'collector',
    cards: [
      { label: 'Batches', value: batches.length, hint: 'Records you created' },
      { label: 'Awaiting review', value: pending, hint: 'Submitted or waiting on evidence' },
      { label: 'Reviewed', value: verified, hint: 'Includes reviews with limitations' },
      { label: 'Open offers', value: offers, hint: 'Recorded offers, not income' },
      { label: 'Orders', value: orders, hint: 'Accepted offers tracked as orders' },
    ],
    batches: batches.slice(0, 6),
    alerts: alertsFor(batches),
  };
}

function buyer(user) {
  const requirements = db.prepare('SELECT COUNT(*) AS count FROM buyer_requirements WHERE buyer_user_id = ? AND status = \'active\'').get(user.id).count;
  const offers = db.prepare('SELECT status, COUNT(*) AS count FROM offers WHERE buyer_user_id = ? GROUP BY status').all(user.id);
  const orders = db.prepare('SELECT * FROM orders WHERE buyer_user_id = ? ORDER BY created_at DESC LIMIT 6').all(user.id);
  const enquiries = db.prepare('SELECT COUNT(*) AS count FROM enquiries WHERE buyer_user_id = ? AND status = \'open\'').get(user.id).count;
  return {
    role: 'buyer',
    cards: [
      { label: 'Active requirements', value: requirements, hint: 'Specifications you stored' },
      { label: 'Open enquiries', value: enquiries, hint: 'Not completed sales' },
      { label: 'Offers', value: offers.reduce((s, r) => s + r.count, 0), hint: 'Recorded in this application' },
      { label: 'Orders', value: orders.length, hint: 'From accepted offers' },
    ],
    offer_breakdown: offers,
    orders,
  };
}

function inspector() {
  const queue = db.prepare(`
    SELECT b.id, b.batch_code, b.status, b.updated_at, p.name AS product_name, d.name AS district_name
    FROM batches b JOIN products p ON p.id = b.product_id JOIN districts d ON d.id = b.district_id
    WHERE b.status IN ('pending_verification', 'submitted', 'needs_info')
    ORDER BY b.updated_at DESC
  `).all();
  const history = db.prepare('SELECT COUNT(*) AS count FROM verifications').get().count;
  return {
    role: 'inspector',
    cards: [
      { label: 'Queue', value: queue.length, hint: 'Batches waiting for a review' },
      { label: 'Reviews stored', value: history, hint: 'Earlier reviews are kept' },
    ],
    queue,
  };
}

function centre(user) {
  const id = user.centre_id || '';
  const incoming = db.prepare('SELECT COUNT(*) AS count FROM batches WHERE centre_id = ?').get(id).count;
  const inventory = db.prepare('SELECT status, COUNT(*) AS count FROM inventory WHERE centre_id = ? GROUP BY status').all(id);
  const pending = db.prepare("SELECT COUNT(*) AS count FROM batches WHERE centre_id = ? AND status IN ('pending_verification', 'needs_info', 'submitted')").get(id).count;
  return {
    role: 'centre',
    cards: [
      { label: 'Batches at centre', value: incoming, hint: 'Linked to your centre' },
      { label: 'Pending checks', value: pending, hint: 'Not yet reviewed' },
    ],
    inventory_by_status: inventory,
  };
}

function admin() {
  return {
    role: 'admin',
    cards: [
      { label: 'Users', value: db.prepare('SELECT COUNT(*) AS count FROM users').get().count, hint: 'Includes demonstration accounts' },
      { label: 'Batches', value: db.prepare('SELECT COUNT(*) AS count FROM batches').get().count, hint: 'All stored batches' },
      { label: 'Products', value: db.prepare('SELECT COUNT(*) AS count FROM products').get().count, hint: 'Catalogue' },
    ],
    batches_by_status: db.prepare('SELECT status, COUNT(*) AS count FROM batches GROUP BY status').all(),
  };
}

function alertsFor(batches) {
  const alerts = [];
  for (const batch of batches) {
    const measurements = db.prepare('SELECT parameter_name, evidence_source FROM measurements WHERE batch_id = ?').all(batch.id);
    if (!measurements.length && batch.status !== 'draft') {
      alerts.push({ batch_id: batch.id, batch_code: batch.batch_code, text: 'No measurements are stored. Add a real measurement or leave the gap visible.' });
    }
    if (measurements.some((m) => m.evidence_source === 'self_reported')) {
      alerts.push({ batch_id: batch.id, batch_code: batch.batch_code, text: 'A measurement is self-reported. It is not marked laboratory-verified.' });
    }
  }
  return alerts.slice(0, 8);
}

module.exports = router;
