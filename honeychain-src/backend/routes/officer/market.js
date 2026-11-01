const express = require('express');
const db = require('../../db/db');
const { scope, maskEmail } = require('./helpers');

const router = express.Router();

// Monitoring only. Prices are shown with their unit, product and offer kind, and never averaged across units.
router.get('/market', (req, res) => {
  const sc = scope(req);
  const isAdmin = req.user.role === 'admin';

  const buyers = db.prepare(`
    SELECT u.id, u.name, u.organisation, u.email, u.active, u.is_demo,
      (SELECT COUNT(*) FROM buyer_requirements r WHERE r.buyer_user_id = u.id AND r.status = 'active') AS requirements,
      (SELECT COUNT(*) FROM offers o WHERE o.buyer_user_id = u.id) AS offers,
      (SELECT COUNT(*) FROM orders o WHERE o.buyer_user_id = u.id) AS orders
    FROM users u WHERE u.role = 'buyer' ORDER BY u.name`).all()
    .map((b) => ({ ...b, email: isAdmin ? b.email : maskEmail(b.email), active: !!b.active, is_demo: !!b.is_demo }));

  const enquiries = db.prepare(`
    SELECT q.id, q.kind, q.status, q.message, q.created_at, b.batch_code, p.name AS product_name, u.name AS buyer_name
    FROM enquiries q JOIN batches b ON b.id = q.batch_id JOIN products p ON p.id = b.product_id JOIN users u ON u.id = q.buyer_user_id
    WHERE 1 = 1 ${sc.sql} ORDER BY q.created_at DESC LIMIT 25`).all(...sc.args);

  const offers = db.prepare(`
    SELECT o.id, o.amount, o.currency, o.price_unit, o.quantity, o.grade_label, o.offer_kind, o.status, o.created_at,
      b.batch_code, b.unit AS batch_unit, p.name AS product_name, d.name AS district_name, u.name AS buyer_name
    FROM offers o JOIN batches b ON b.id = o.batch_id JOIN products p ON p.id = b.product_id JOIN districts d ON d.id = b.district_id
    JOIN users u ON u.id = o.buyer_user_id WHERE 1 = 1 ${sc.sql} ORDER BY o.created_at DESC LIMIT 25`).all(...sc.args);

  const orders = db.prepare(`
    SELECT o.id, o.quantity, o.unit, o.agreed_price, o.currency, o.price_unit, o.status, o.payment_status, o.delivery_status, o.created_at,
      b.batch_code, p.name AS product_name, d.name AS district_name, u.name AS buyer_name
    FROM orders o JOIN batches b ON b.id = o.batch_id JOIN products p ON p.id = b.product_id JOIN districts d ON d.id = b.district_id
    JOIN users u ON u.id = o.buyer_user_id WHERE 1 = 1 ${sc.sql} ORDER BY o.created_at DESC LIMIT 25`).all(...sc.args);

  const demand = db.prepare(`
    SELECT p.name AS product_name, r.unit, COUNT(*) AS requirements, ROUND(SUM(COALESCE(r.min_qty, 0)), 2) AS min_qty_total
    FROM buyer_requirements r JOIN products p ON p.id = r.product_id WHERE r.status = 'active'
    GROUP BY p.id, r.unit ORDER BY requirements DESC`).all();

  const district_activity = db.prepare(`
    SELECT d.name AS district_name,
      COUNT(DISTINCT o.id) AS offers, COUNT(DISTINCT q.id) AS enquiries, COUNT(DISTINCT ord.id) AS orders
    FROM districts d JOIN batches b ON b.district_id = d.id
    LEFT JOIN offers o ON o.batch_id = b.id LEFT JOIN enquiries q ON q.batch_id = b.id LEFT JOIN orders ord ON ord.batch_id = b.id
    WHERE b.status != 'draft' ${sc.sql} GROUP BY d.id HAVING (offers + enquiries + orders) > 0 ORDER BY offers + enquiries + orders DESC`).all(...sc.args);

  const demoOffers = db.prepare('SELECT COUNT(*) AS c FROM offers WHERE is_demo = 1').get().c;
  res.json({
    totals: { buyers: buyers.length, enquiries: enquiries.length, offers: offers.length, orders: orders.length },
    buyers, enquiries, offers, orders, demand, district_activity,
    notes: [
      'Offers are recorded in this application. They are not confirmed payments or market prices.',
      'Prices are shown per their own unit and grade. Do not compare across different units or grades.',
      demoOffers ? `${demoOffers} offers in this environment are demonstration data.` : null,
    ].filter(Boolean),
  });
});

module.exports = router;
