const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { verifyChain } = require('../services/ledger');
const { loadContext, canRead, shapePassport, listCard } = require('../services/records');

const router = express.Router();
const UPLOADS = path.join(__dirname, '..', 'uploads');

router.get('/meta', (req, res) => {
  const states = db.prepare('SELECT * FROM states ORDER BY name').all().map((s) => ({
    ...s,
    languages: JSON.parse(s.languages || '[]'),
    is_active: !!s.is_active,
  }));
  const districts = db.prepare('SELECT * FROM districts WHERE is_active = 1 ORDER BY name').all();
  const products = db.prepare('SELECT id, name, local_names, category, default_unit, is_active FROM products WHERE is_active = 1').all()
    .map((p) => ({ ...p, local_names: JSON.parse(p.local_names || '{}') }));
  const banner = db.prepare('SELECT value FROM settings WHERE key = ?').get('banner');
  res.json({
    service: 'aranyavalue',
    banner: banner ? banner.value : null,
    states,
    districts,
    products,
    languages: [
      { id: 'en', label: 'English' },
      { id: 'bn', label: 'বাংলা' },
      { id: 'hi', label: 'हिन्दी' },
    ],
  });
});

router.get('/products', (req, res) => {
  const { state } = req.query;
  let rows;
  if (state) {
    rows = db.prepare(`
      SELECT p.* FROM products p
      JOIN product_states ps ON ps.product_id = p.id
      WHERE ps.state_id = ? AND p.is_active = 1
      ORDER BY p.name
    `).all(state);
  } else {
    rows = db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY name').all();
  }
  res.json({ products: rows.map(hydrateProduct) });
});

router.get('/products/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  const states = db.prepare(`
    SELECT s.id, s.name, s.coverage_note FROM states s
    JOIN product_states ps ON ps.state_id = s.id WHERE ps.product_id = ?
  `).all(row.id);
  const profiles = db.prepare('SELECT * FROM quality_profiles WHERE product_id = ?').all(row.id);
  const parameters = db.prepare(`
    SELECT qp.* FROM quality_parameters qp
    JOIN quality_profiles prof ON prof.id = qp.profile_id
    WHERE prof.product_id = ? ORDER BY qp.sort_order
  `).all(row.id);
  res.json({ product: hydrateProduct(row), states, profiles, parameters });
});

router.get('/schemes', (req, res) => {
  const { state, q, category, beneficiary } = req.query;
  let sql = "SELECT * FROM schemes WHERE status = 'published' AND (publish_at IS NULL OR publish_at <= date('now')) AND (expires_at IS NULL OR expires_at >= date('now'))";
  const args = [];
  if (state) {
    sql += ' AND (state_id IS NULL OR state_id = ?)';
    args.push(state);
  }
  if (category) {
    sql += ' AND category = ?';
    args.push(category);
  }
  if (beneficiary) {
    sql += ' AND beneficiaries LIKE ?';
    args.push(`%${beneficiary}%`);
  }
  if (q) {
    sql += ' AND (name LIKE ? OR department LIKE ? OR eligibility LIKE ? OR benefits LIKE ?)';
    const like = `%${q}%`;
    args.push(like, like, like, like);
  }
  sql += ' ORDER BY name';
  const schemes = db.prepare(sql).all(...args).map(hydrateScheme);
  res.json({ schemes });
});

router.get('/schemes/:id', (req, res) => {
  const row = db.prepare("SELECT * FROM schemes WHERE id = ? AND status = 'published' AND (publish_at IS NULL OR publish_at <= date('now')) AND (expires_at IS NULL OR expires_at >= date('now'))").get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Scheme not found.' });
  res.json({ scheme: hydrateScheme(row) });
});

router.post('/schemes/:id/save', requireAuth, (req, res) => {
  const status = req.body && req.body.status === 'applied' ? 'applied' : 'saved';
  const scheme = db.prepare('SELECT id FROM schemes WHERE id = ?').get(req.params.id);
  if (!scheme) return res.status(404).json({ error: 'Scheme not found.' });
  db.prepare(`
    INSERT INTO scheme_actions (user_id, scheme_id, status, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, scheme_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
  `).run(req.user.id, req.params.id, status, new Date().toISOString());
  res.json({ ok: true, status });
});

router.get('/schemes-saved', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, a.status AS my_status FROM scheme_actions a
    JOIN schemes s ON s.id = a.scheme_id
    WHERE a.user_id = ?
  `).all(req.user.id).map((row) => ({ ...hydrateScheme(row), my_status: row.my_status }));
  res.json({ schemes: rows });
});

router.get('/marketplace', (req, res) => {
  const { state, district, product, status, q } = req.query;
  let sql = `
    SELECT b.*, p.name AS product_name, p.category, s.name AS state_name, d.name AS district_name, c.name AS centre_name
    FROM batches b
    JOIN products p ON p.id = b.product_id
    JOIN states s ON s.id = b.state_id
    JOIN districts d ON d.id = b.district_id
    LEFT JOIN centres c ON c.id = b.centre_id
    WHERE b.public_share = 1 AND b.status != 'draft'
  `;
  const args = [];
  if (state) { sql += ' AND b.state_id = ?'; args.push(state); }
  if (district) { sql += ' AND b.district_id = ?'; args.push(district); }
  if (product) { sql += ' AND b.product_id = ?'; args.push(product); }
  if (status) { sql += ' AND b.status = ?'; args.push(status); }
  if (q) {
    sql += ' AND (b.batch_code LIKE ? OR p.name LIKE ? OR d.name LIKE ?)';
    const like = `%${q}%`;
    args.push(like, like, like);
  }
  sql += ' ORDER BY b.updated_at DESC';
  res.json({
    notice: 'Listed batches are demonstration or user-entered records shared by their collectors. A listing is not a completed sale.',
    batches: db.prepare(sql).all(...args).map(listCard),
  });
});

router.get('/marketplace/:id', optionalAuth, (req, res) => {
  const ctx = loadContext(req.params.id);
  if (!ctx || !ctx.batch.public_share || ctx.batch.status === 'draft') {
    return res.status(404).json({ error: 'Batch not available.' });
  }
  const viewer = req.user && canRead(req.user, ctx.batch) ? req.user : null;
  res.json({ passport: shapePassport(ctx, viewer) });
});

router.get('/passport/:code', optionalAuth, (req, res) => {
  const ctx = loadContext(req.params.code);
  if (!ctx) return res.status(404).json({ error: 'Passport not found.' });
  const viewer = req.user && canRead(req.user, ctx.batch) ? req.user : null;
  if (!viewer && (!ctx.batch.public_share || ctx.batch.status === 'draft')) {
    return res.status(404).json({ error: 'This passport is not public.' });
  }
  res.json({
    passport: shapePassport(ctx, viewer),
    chain_note: 'The integrity check covers the local append-only event log. It is not a public blockchain and does not prove where the produce was collected.',
  });
});

router.get('/ledger/verify', (req, res) => {
  const result = verifyChain();
  res.json({
    ...result,
    proves: 'Stored events still match the hash chain. An edit or deletion inside this database would break it.',
    does_not_prove: 'It does not prove geographical origin, laboratory accuracy, or that a QR code cannot be copied.',
  });
});

router.get('/evidence/:id', optionalAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM evidence WHERE id = ?').get(req.params.id);
  if (!row || !row.stored_name) return res.status(404).json({ error: 'File not found.' });
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(row.batch_id);
  const allowed = row.visibility === 'public' || (req.user && canRead(req.user, batch) && req.user.role !== 'buyer')
    || (req.user && req.user.role === 'buyer' && row.visibility === 'public');
  if (!allowed) return res.status(403).json({ error: 'This file is not public.' });
  const file = path.join(UPLOADS, path.basename(row.stored_name));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'File missing on disk.' });
  res.setHeader('Content-Type', row.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${(row.filename || 'evidence').replace(/"/g, '')}"`);
  fs.createReadStream(file).pipe(res);
});

router.post('/contact', (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !message) return res.status(400).json({ error: 'Name and message are required.' });
  db.prepare('INSERT INTO support_messages (id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(`SM-${uuid().slice(0, 8).toUpperCase()}`, String(name).slice(0, 120), email || null, String(message).slice(0, 4000), new Date().toISOString());
  res.status(201).json({ ok: true, notice: 'Message stored locally in this demo. It is not sent to an external inbox.' });
});

function hydrateProduct(row) {
  return {
    ...row,
    local_names: JSON.parse(row.local_names || '{}'),
    units: JSON.parse(row.units_json || '[]'),
    handling: JSON.parse(row.handling_json || '{}'),
    is_active: !!row.is_active,
  };
}

function hydrateScheme(row) {
  return {
    ...row,
    documents: JSON.parse(row.documents_json || '[]'),
    summary_is_illustrative: !!row.summary_is_illustrative,
  };
}

module.exports = router;
