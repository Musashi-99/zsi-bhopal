const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { appendEvent } = require('../services/ledger');
const { loadContext, canRead } = require('../services/records');
const { matchRequirement, isExpired } = require('../services/priceEngine');

const router = express.Router();

function nid(prefix) {
  return `${prefix}-${uuid().slice(0, 8).toUpperCase()}`;
}

router.get('/buyer-requirements', requireAuth, (req, res) => {
  let sql = `
    SELECT br.*, u.name AS buyer_name, u.organisation, p.name AS product_name
    FROM buyer_requirements br
    JOIN users u ON u.id = br.buyer_user_id
    JOIN products p ON p.id = br.product_id
    WHERE 1 = 1
  `;
  const args = [];
  if (req.user.role === 'buyer') {
    sql += ' AND br.buyer_user_id = ?';
    args.push(req.user.id);
  } else if (!['admin', 'inspector', 'collector', 'centre'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You cannot view requirements.' });
  }
  if (req.query.product) {
    sql += ' AND br.product_id = ?';
    args.push(req.query.product);
  }
  sql += ' ORDER BY br.created_at DESC';
  res.json({
    requirements: db.prepare(sql).all(...args).map(hydrate),
  });
});

router.post('/buyer-requirements', requireAuth, requireRole('buyer', 'admin'), (req, res) => {
  const body = req.body || {};
  if (!body.product_id || !body.unit) return res.status(400).json({ error: 'Product and unit are required.' });
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(body.product_id);
  if (!product) return res.status(400).json({ error: 'Unknown product.' });
  const id = nid('RQ');
  const buyerId = req.user.role === 'admin' && body.buyer_user_id ? body.buyer_user_id : req.user.id;
  db.prepare(`
    INSERT INTO buyer_requirements (
      id, buyer_user_id, product_id, grade_label, min_qty, max_qty, unit, specs_json, documents_json,
      packaging, storage, delivery, reference_price, currency, price_unit, offer_kind, source_label,
      valid_from, valid_until, status, is_demo, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?)
  `).run(
    id, buyerId, body.product_id, body.grade_label || null,
    body.min_qty ?? null, body.max_qty ?? null, body.unit,
    JSON.stringify(body.specifications || []),
    JSON.stringify(body.required_documents || []),
    body.packaging || null, body.storage || null, body.delivery || null,
    body.reference_price ?? null, body.currency || 'INR', body.price_unit || body.unit,
    body.offer_kind || 'recorded_offer',
    body.source_label || 'Entered by the buyer in this application. Not a published market price.',
    body.valid_from || null, body.valid_until || null, new Date().toISOString(),
  );
  res.status(201).json({ requirement: hydrate(db.prepare(`
    SELECT br.*, u.name AS buyer_name, u.organisation, p.name AS product_name
    FROM buyer_requirements br JOIN users u ON u.id = br.buyer_user_id JOIN products p ON p.id = br.product_id
    WHERE br.id = ?
  `).get(id)) });
});

router.patch('/buyer-requirements/:id', requireAuth, requireRole('buyer', 'admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM buyer_requirements WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Requirement not found.' });
  if (req.user.role === 'buyer' && row.buyer_user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can edit only your own requirements.' });
  }
  const body = req.body || {};
  db.prepare(`
    UPDATE buyer_requirements SET
      grade_label = COALESCE(?, grade_label),
      min_qty = COALESCE(?, min_qty),
      max_qty = COALESCE(?, max_qty),
      specs_json = COALESCE(?, specs_json),
      documents_json = COALESCE(?, documents_json),
      packaging = COALESCE(?, packaging),
      delivery = COALESCE(?, delivery),
      reference_price = COALESCE(?, reference_price),
      price_unit = COALESCE(?, price_unit),
      valid_until = COALESCE(?, valid_until),
      status = COALESCE(?, status),
      source_label = COALESCE(?, source_label)
    WHERE id = ?
  `).run(
    body.grade_label ?? null,
    body.min_qty ?? null,
    body.max_qty ?? null,
    body.specifications ? JSON.stringify(body.specifications) : null,
    body.required_documents ? JSON.stringify(body.required_documents) : null,
    body.packaging ?? null,
    body.delivery ?? null,
    body.reference_price ?? null,
    body.price_unit ?? null,
    body.valid_until ?? null,
    body.status ?? null,
    body.source_label ?? null,
    row.id,
  );
  res.json({ ok: true });
});

router.get('/buyer-requirements/:id/matches', requireAuth, (req, res) => {
  const requirement = db.prepare(`
    SELECT br.*, u.name AS buyer_name, u.organisation FROM buyer_requirements br
    JOIN users u ON u.id = br.buyer_user_id WHERE br.id = ?
  `).get(req.params.id);
  if (!requirement) return res.status(404).json({ error: 'Requirement not found.' });
  if (req.user.role === 'buyer' && requirement.buyer_user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You cannot match another buyer\'s requirement.' });
  }
  const batches = db.prepare(`
    SELECT * FROM batches WHERE product_id = ? AND public_share = 1 AND status != 'draft'
  `).all(requirement.product_id);
  const matches = batches.map((batch) => {
    const measurements = db.prepare('SELECT * FROM measurements WHERE batch_id = ?').all(batch.id);
    const evidence = db.prepare('SELECT * FROM evidence WHERE batch_id = ?').all(batch.id);
    const result = matchRequirement(batch, requirement, measurements, evidence);
    return {
      batch_id: batch.id,
      batch_code: batch.batch_code,
      quantity: batch.quantity,
      unit: batch.unit,
      district_id: batch.district_id,
      status: batch.status,
      match: result.match,
      checks: result.checks,
      quantity_fit: result.quantity,
      limitations: result.limitations,
      scorecard: result.scorecard,
    };
  });
  res.json({ requirement_id: requirement.id, matches });
});

router.get('/offers', requireAuth, (req, res) => {
  let sql = `
    SELECT o.*, u.organisation, u.name AS buyer_name, b.batch_code, p.name AS product_name
    FROM offers o
    JOIN users u ON u.id = o.buyer_user_id
    JOIN batches b ON b.id = o.batch_id
    JOIN products p ON p.id = b.product_id
    WHERE 1 = 1
  `;
  const args = [];
  if (req.user.role === 'buyer') {
    sql += ' AND o.buyer_user_id = ?';
    args.push(req.user.id);
  } else if (req.user.role === 'collector') {
    sql += ' AND b.collector_id = ?';
    args.push(req.user.id);
  } else if (req.user.role === 'centre') {
    sql += ' AND b.centre_id = ?';
    args.push(req.user.centre_id || '');
  } else if (req.user.role === 'inspector') {
    return res.status(403).json({ error: 'Inspectors do not manage offers.' });
  }
  sql += ' ORDER BY o.created_at DESC';
  res.json({ offers: db.prepare(sql).all(...args).map(withExpiry) });
});

router.post('/offers', requireAuth, requireRole('buyer', 'admin'), (req, res) => {
  const body = req.body || {};
  if (!body.batch_id || body.amount == null || !body.price_unit) {
    return res.status(400).json({ error: 'Batch, amount, and price unit are required.' });
  }
  const ctx = loadContext(body.batch_id);
  if (!ctx || !canRead(req.user, ctx.batch)) return res.status(404).json({ error: 'Batch not available.' });
  const id = nid('OF');
  const ts = new Date().toISOString();
  const buyerId = req.user.role === 'buyer' ? req.user.id : (body.buyer_user_id || req.user.id);
  db.prepare(`
    INSERT INTO offers (
      id, buyer_user_id, batch_id, requirement_id, amount, currency, price_unit, quantity, min_quantity,
      grade_label, terms, delivery_terms, offer_kind, source_label, status, valid_until, is_demo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recorded_offer', ?, 'submitted', ?, 0, ?, ?)
  `).run(
    id, buyerId, ctx.batch.id, body.requirement_id || null, Number(body.amount), body.currency || 'INR',
    body.price_unit, body.quantity ?? null, body.min_quantity ?? null, body.grade_label || null,
    body.terms || null, body.delivery_terms || null,
    'Offer recorded in this application. Not an independently verified market price.',
    body.valid_until || null, ts, ts,
  );
  appendEvent({ batch_id: ctx.batch.id, event_type: 'OFFER_CREATED', actor: req.user.id, payload: { offer_id: id, status: 'submitted' } });
  res.status(201).json({ offer: db.prepare('SELECT * FROM offers WHERE id = ?').get(id) });
});

router.patch('/offers/:id', requireAuth, (req, res) => {
  const offer = db.prepare('SELECT o.*, b.collector_id, b.centre_id FROM offers o JOIN batches b ON b.id = o.batch_id WHERE o.id = ?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found.' });
  if (req.user.role === 'inspector') return res.status(403).json({ error: 'Inspectors cannot change offers.' });
  const body = req.body || {};
  const buyerOwns = req.user.role === 'buyer' && offer.buyer_user_id === req.user.id;
  const collectorOwns = req.user.role === 'collector' && offer.collector_id === req.user.id;
  const centreOwns = req.user.role === 'centre' && offer.centre_id === req.user.centre_id;
  const admin = req.user.role === 'admin';
  if (!buyerOwns && !collectorOwns && !centreOwns && !admin) return res.status(403).json({ error: 'You cannot change this offer.' });
  if ((collectorOwns || centreOwns) && body.status && !['accepted', 'declined', 'info_requested'].includes(body.status)) {
    return res.status(400).json({ error: 'A collector can accept, decline, or ask for more information.' });
  }
  if (buyerOwns && body.status && !['submitted', 'withdrawn', 'rejected'].includes(body.status)) {
    return res.status(400).json({ error: 'A buyer can update, withdraw, or reject their own offer.' });
  }
  const ts = new Date().toISOString();
  db.prepare(`
    UPDATE offers SET
      amount = COALESCE(?, amount),
      quantity = COALESCE(?, quantity),
      min_quantity = COALESCE(?, min_quantity),
      terms = COALESCE(?, terms),
      delivery_terms = COALESCE(?, delivery_terms),
      valid_until = COALESCE(?, valid_until),
      status = COALESCE(?, status),
      updated_at = ?
    WHERE id = ?
  `).run(
    buyerOwns || admin ? (body.amount ?? null) : null,
    buyerOwns || admin ? (body.quantity ?? null) : null,
    buyerOwns || admin ? (body.min_quantity ?? null) : null,
    buyerOwns || admin ? (body.terms ?? null) : null,
    buyerOwns || admin ? (body.delivery_terms ?? null) : null,
    buyerOwns || admin ? (body.valid_until ?? null) : null,
    body.status ?? null,
    ts,
    offer.id,
  );
  if (body.status === 'accepted') {
    const existing = db.prepare('SELECT id FROM orders WHERE offer_id = ?').get(offer.id);
    if (!existing) {
      db.prepare(`
        INSERT INTO orders (id, offer_id, buyer_user_id, batch_id, quantity, unit, agreed_price, currency, price_unit, status, payment_status, delivery_status, is_demo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'not_recorded', 'pending', 0, ?)
      `).run(nid('OR'), offer.id, offer.buyer_user_id, offer.batch_id, body.quantity || offer.quantity || 0, offer.price_unit, offer.amount, offer.currency, offer.price_unit, ts);
    }
  }
  appendEvent({ batch_id: offer.batch_id, event_type: 'OFFER_UPDATED', actor: req.user.id, payload: { offer_id: offer.id, status: body.status || 'updated' } });
  res.json({ offer: db.prepare('SELECT * FROM offers WHERE id = ?').get(offer.id) });
});

router.get('/orders', requireAuth, (req, res) => {
  let sql = `
    SELECT o.*, b.batch_code, p.name AS product_name, u.organisation
    FROM orders o
    JOIN batches b ON b.id = o.batch_id
    JOIN products p ON p.id = b.product_id
    JOIN users u ON u.id = o.buyer_user_id
    WHERE 1 = 1
  `;
  const args = [];
  if (req.user.role === 'buyer') { sql += ' AND o.buyer_user_id = ?'; args.push(req.user.id); }
  else if (req.user.role === 'collector') { sql += ' AND b.collector_id = ?'; args.push(req.user.id); }
  else if (req.user.role === 'centre') { sql += ' AND b.centre_id = ?'; args.push(req.user.centre_id || ''); }
  else if (req.user.role === 'inspector') return res.status(403).json({ error: 'Inspectors do not manage orders.' });
  sql += ' ORDER BY o.created_at DESC';
  res.json({ orders: db.prepare(sql).all(...args) });
});

router.get('/orders/:id', requireAuth, (req, res) => {
  const row = db.prepare(`
    SELECT o.*, b.batch_code, b.collector_id, b.centre_id, p.name AS product_name
    FROM orders o JOIN batches b ON b.id = o.batch_id JOIN products p ON p.id = b.product_id
    WHERE o.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Order not found.' });
  const allowed = req.user.role === 'admin'
    || (req.user.role === 'buyer' && row.buyer_user_id === req.user.id)
    || (req.user.role === 'collector' && row.collector_id === req.user.id)
    || (req.user.role === 'centre' && row.centre_id === req.user.centre_id);
  if (!allowed) return res.status(403).json({ error: 'You cannot open this order.' });
  res.json({ order: row });
});

router.patch('/orders/:id', requireAuth, requireRole('buyer', 'centre', 'collector', 'admin'), (req, res) => {
  const row = db.prepare(`
    SELECT o.*, b.collector_id, b.centre_id FROM orders o JOIN batches b ON b.id = o.batch_id WHERE o.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Order not found.' });
  const allowed = req.user.role === 'admin'
    || (req.user.role === 'buyer' && row.buyer_user_id === req.user.id)
    || (req.user.role === 'collector' && row.collector_id === req.user.id)
    || (req.user.role === 'centre' && row.centre_id === req.user.centre_id);
  if (!allowed) return res.status(403).json({ error: 'You cannot update this order.' });
  const body = req.body || {};
  db.prepare('UPDATE orders SET status = COALESCE(?, status), payment_status = COALESCE(?, payment_status), delivery_status = COALESCE(?, delivery_status) WHERE id = ?')
    .run(body.status ?? null, body.payment_status ?? null, body.delivery_status ?? null, row.id);
  res.json({ order: db.prepare('SELECT * FROM orders WHERE id = ?').get(row.id) });
});

router.post('/enquiries', requireAuth, requireRole('buyer'), (req, res) => {
  const body = req.body || {};
  if (!body.batch_id || !body.message) return res.status(400).json({ error: 'Batch and message are required.' });
  const ctx = loadContext(body.batch_id);
  if (!ctx || !canRead(req.user, ctx.batch)) return res.status(404).json({ error: 'Batch not available.' });
  const id = nid('EN');
  db.prepare('INSERT INTO enquiries (id, batch_id, buyer_user_id, message, kind, status, created_at) VALUES (?, ?, ?, ?, ?, \'open\', ?)')
    .run(id, ctx.batch.id, req.user.id, body.message, body.kind || 'enquiry', new Date().toISOString());
  appendEvent({ batch_id: ctx.batch.id, event_type: 'ENQUIRY_RECORDED', actor: req.user.id, payload: { kind: body.kind || 'enquiry' } });
  res.status(201).json({ id, notice: 'Enquiry stored. It is not a completed sale.' });
});

router.get('/enquiries', requireAuth, (req, res) => {
  let sql = `
    SELECT e.*, b.batch_code, b.collector_id, b.centre_id, u.organisation
    FROM enquiries e JOIN batches b ON b.id = e.batch_id JOIN users u ON u.id = e.buyer_user_id
    WHERE 1 = 1
  `;
  const args = [];
  if (req.user.role === 'buyer') { sql += ' AND e.buyer_user_id = ?'; args.push(req.user.id); }
  else if (req.user.role === 'collector') { sql += ' AND b.collector_id = ?'; args.push(req.user.id); }
  else if (req.user.role === 'centre') { sql += ' AND b.centre_id = ?'; args.push(req.user.centre_id || ''); }
  else if (req.user.role === 'inspector') return res.status(403).json({ error: 'Inspectors do not manage enquiries.' });
  res.json({ enquiries: db.prepare(sql).all(...args) });
});

function hydrate(row) {
  return {
    ...row,
    specifications: JSON.parse(row.specs_json || '[]'),
    required_documents: JSON.parse(row.documents_json || '[]'),
    is_demo: !!row.is_demo,
    expired: isExpired(row.valid_until),
  };
}

function withExpiry(row) {
  return { ...row, expired: isExpired(row.valid_until), is_demo: !!row.is_demo };
}

module.exports = router;
