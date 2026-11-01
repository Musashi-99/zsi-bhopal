const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { hashPassword } = require('../services/auth');
const { getEventsForBatch, verifyChain } = require('../services/ledger');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

function nid(prefix) {
  return `${prefix}-${uuid().slice(0, 8).toUpperCase()}`;
}

router.get('/dashboard', (req, res) => {
  res.json({
    users: db.prepare('SELECT role, COUNT(*) AS count FROM users GROUP BY role').all(),
    batches: db.prepare('SELECT status, COUNT(*) AS count FROM batches GROUP BY status').all(),
    offers: db.prepare('SELECT offer_kind, COUNT(*) AS count FROM offers GROUP BY offer_kind').all(),
    chain: verifyChain(),
  });
});

router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT id, name, email, phone, role, state_id, district_id, organisation, centre_id, active, is_demo, created_at
    FROM users ORDER BY created_at DESC
  `).all();
  res.json({ users });
});

router.post('/users', (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.email || !body.password || !body.role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required.' });
  }
  if (!['collector', 'centre', 'buyer', 'inspector', 'admin'].includes(body.role)) {
    return res.status(400).json({ error: 'Unknown role.' });
  }
  if (String(body.password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const id = nid('U');
  db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, preferred_language, state_id, district_id, organisation, centre_id, active, is_demo, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
  `).run(id, body.name, String(body.email).toLowerCase(), body.phone || null, hashPassword(body.password), body.role, body.preferred_language || 'en', body.state_id || null, body.district_id || null, body.organisation || null, body.centre_id || null, new Date().toISOString());
  res.status(201).json({ id });
});

router.patch('/users/:id', (req, res) => {
  const body = req.body || {};
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (body.role && !['collector', 'centre', 'buyer', 'inspector', 'admin'].includes(body.role)) {
    return res.status(400).json({ error: 'Unknown role.' });
  }
  db.prepare(`
    UPDATE users SET
      role = COALESCE(?, role),
      active = COALESCE(?, active),
      centre_id = COALESCE(?, centre_id),
      organisation = COALESCE(?, organisation),
      state_id = COALESCE(?, state_id),
      district_id = COALESCE(?, district_id)
    WHERE id = ?
  `).run(body.role ?? null, body.active == null ? null : (body.active ? 1 : 0), body.centre_id ?? null, body.organisation ?? null, body.state_id ?? null, body.district_id ?? null, user.id);
  res.json({ ok: true });
});

const PRODUCT_TEXT_MAX = 600;
function cleanText(v, max = PRODUCT_TEXT_MAX) {
  if (v === undefined) return undefined;
  if (v === null || String(v).trim() === '') return null;
  return String(v).trim().slice(0, max);
}
function cleanNames(v) {
  if (v === undefined) return undefined;
  if (!v || typeof v !== 'object') return {};
  const out = {};
  for (const key of ['en', 'bn', 'hi']) if (v[key] && String(v[key]).trim()) out[key] = String(v[key]).trim().slice(0, 120);
  if (Array.isArray(v.local)) out.local = v.local.map((x) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 10);
  return out;
}
function categoryExists(id) {
  return !id || !!db.prepare('SELECT 1 FROM market_categories WHERE id = ?').get(id);
}

router.post('/products', (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.category || !body.default_unit) return res.status(400).json({ error: 'Name, category, and default unit are required.' });
  if (!categoryExists(body.market_category_id)) return res.status(400).json({ error: 'Unknown marketplace category.' });
  const id = nid('PR');
  db.prepare(`
    INSERT INTO products (id, name, local_names, category, species_name, description, default_unit, units_json, handling_json, is_active,
                          market_category_id, season, permissions_note, image, is_demo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 0)
  `).run(id, String(body.name).trim(), JSON.stringify(cleanNames(body.local_names) || {}), body.category, cleanText(body.species_name) || null, cleanText(body.description, 2000) || null, body.default_unit,
    JSON.stringify(body.units || [body.default_unit]), JSON.stringify(body.handling || { expected: [], required: [] }),
    body.market_category_id || null, cleanText(body.season) || null, cleanText(body.permissions_note, 1200) || null, cleanText(body.image) || null);
  for (const stateId of body.state_ids || []) {
    db.prepare('INSERT OR IGNORE INTO product_states (product_id, state_id) VALUES (?, ?)').run(id, stateId);
  }
  res.status(201).json({ id });
});

// Catalogue fields are editable here. Pass null (or '') to clear an optional field; omit a key to leave it alone.
router.patch('/products/:id', (req, res) => {
  const body = req.body || {};
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  if (body.name !== undefined && !String(body.name).trim()) return res.status(400).json({ error: 'Product name cannot be empty.' });
  if (body.market_category_id !== undefined && !categoryExists(body.market_category_id)) return res.status(400).json({ error: 'Unknown marketplace category.' });
  const pick = (key, next) => (body[key] === undefined ? row[key] : next);
  db.prepare(`
    UPDATE products SET
      name = ?, description = ?, is_active = ?, handling_json = ?, local_names = ?, species_name = ?,
      season = ?, permissions_note = ?, market_category_id = ?, image = ?
    WHERE id = ?
  `).run(
    pick('name', String(body.name || '').trim()),
    pick('description', cleanText(body.description, 2000)),
    body.is_active == null ? row.is_active : (body.is_active ? 1 : 0),
    body.handling ? JSON.stringify(body.handling) : row.handling_json,
    body.local_names === undefined ? row.local_names : JSON.stringify(cleanNames(body.local_names)),
    pick('species_name', cleanText(body.species_name)),
    pick('season', cleanText(body.season)),
    pick('permissions_note', cleanText(body.permissions_note, 1200)),
    pick('market_category_id', body.market_category_id || null),
    pick('image', cleanText(body.image)),
    row.id,
  );
  if (body.state_ids) {
    db.prepare('DELETE FROM product_states WHERE product_id = ?').run(row.id);
    for (const stateId of body.state_ids) db.prepare('INSERT INTO product_states (product_id, state_id) VALUES (?, ?)').run(row.id, stateId);
  }
  res.json({ ok: true });
});

router.post('/quality-profiles', (req, res) => {
  const body = req.body || {};
  if (!body.product_id || !body.name) return res.status(400).json({ error: 'Product and name are required.' });
  const id = nid('QP');
  db.prepare(`
    INSERT INTO quality_profiles (id, product_id, name, version, region, source_name, source_url, effective_date, notes, illustrative)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, body.product_id, body.name, body.version || '1', body.region || null, body.source_name || null, body.source_url || null, body.effective_date || null, body.notes || null, body.illustrative === false ? 0 : 1);
  res.status(201).json({ id });
});

router.post('/quality-parameters', (req, res) => {
  const body = req.body || {};
  if (!body.profile_id || !body.name) return res.status(400).json({ error: 'Profile and parameter name are required.' });
  const id = nid('PA');
  db.prepare(`
    INSERT INTO quality_parameters (
      id, profile_id, name, unit, data_type, min_value, max_value, text_expect, required, method, source_name, source_url, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, body.profile_id, body.name, body.unit || null, body.data_type || 'number', body.min_value ?? null, body.max_value ?? null, body.text_expect || null, body.required ? 1 : 0, body.method || null, body.source_name || null, body.source_url || null, body.sort_order || 0);
  res.status(201).json({ id });
});

router.patch('/quality-parameters/:id', (req, res) => {
  const body = req.body || {};
  const row = db.prepare('SELECT * FROM quality_parameters WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Parameter not found.' });
  const clear = body.clear_limits === true;
  db.prepare(`
    UPDATE quality_parameters SET
      min_value = ?,
      max_value = ?,
      required = COALESCE(?, required),
      source_name = COALESCE(?, source_name),
      source_url = COALESCE(?, source_url),
      unit = COALESCE(?, unit)
    WHERE id = ?
  `).run(
    clear ? null : (body.min_value !== undefined ? body.min_value : row.min_value),
    clear ? null : (body.max_value !== undefined ? body.max_value : row.max_value),
    body.required == null ? null : (body.required ? 1 : 0),
    body.source_name ?? null,
    body.source_url ?? null,
    body.unit ?? null,
    row.id,
  );
  res.json({ parameter: db.prepare('SELECT * FROM quality_parameters WHERE id = ?').get(row.id) });
});

router.post('/states', (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.code) return res.status(400).json({ error: 'Name and code are required.' });
  const id = body.id || nid('ST');
  db.prepare('INSERT INTO states (id, name, code, languages, is_active, coverage_note) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, body.name, body.code, JSON.stringify(body.languages || ['en']), body.is_active === false ? 0 : 1, body.coverage_note || 'Configured location. Not an operating claim.');
  res.status(201).json({ id });
});

router.post('/districts', (req, res) => {
  const body = req.body || {};
  if (!body.state_id || !body.name) return res.status(400).json({ error: 'State and name are required.' });
  const id = nid('DT');
  db.prepare('INSERT INTO districts (id, state_id, name, is_active) VALUES (?, ?, ?, 1)').run(id, body.state_id, body.name);
  res.status(201).json({ id });
});

router.post('/schemes', (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.department || !body.official_url || !body.source_url) {
    return res.status(400).json({ error: 'Name, department, official URL, and source URL are required.' });
  }
  const id = nid('SC');
  db.prepare(`
    INSERT INTO schemes (id, name, department, level, state_id, category, beneficiaries, benefits, eligibility, documents_json, process, official_url, source_url, last_verified, summary_is_illustrative)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, body.name, body.department, body.level || 'central', body.state_id || null, body.category || null, body.beneficiaries || null, body.benefits || null, body.eligibility || null, JSON.stringify(body.documents || []), body.process || null, body.official_url, body.source_url, body.last_verified || new Date().toISOString().slice(0, 10));
  res.status(201).json({ id });
});

router.patch('/schemes/:id', (req, res) => {
  const body = req.body || {};
  const row = db.prepare('SELECT id FROM schemes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Scheme not found.' });
  db.prepare(`
    UPDATE schemes SET
      name = COALESCE(?, name),
      benefits = COALESCE(?, benefits),
      eligibility = COALESCE(?, eligibility),
      official_url = COALESCE(?, official_url),
      source_url = COALESCE(?, source_url),
      last_verified = COALESCE(?, last_verified)
    WHERE id = ?
  `).run(body.name ?? null, body.benefits ?? null, body.eligibility ?? null, body.official_url ?? null, body.source_url ?? null, body.last_verified ?? null, row.id);
  res.json({ ok: true });
});

router.get('/audit', (req, res) => {
  const rows = db.prepare('SELECT * FROM batch_events ORDER BY seq DESC LIMIT 300').all().map((row) => ({
    ...row,
    payload: JSON.parse(row.payload || '{}'),
  }));
  res.json({ events: rows, chain: verifyChain() });
});

router.get('/audit/:batchId', (req, res) => {
  res.json({ events: getEventsForBatch(req.params.batchId), chain: verifyChain() });
});

router.get('/settings', (req, res) => {
  res.json({ settings: db.prepare('SELECT * FROM settings').all() });
});

router.put('/settings', (req, res) => {
  const entries = req.body && req.body.settings;
  if (!entries || typeof entries !== 'object') return res.status(400).json({ error: 'Send a settings object.' });
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [key, value] of Object.entries(entries)) stmt.run(key, String(value));
  res.json({ ok: true });
});

module.exports = router;
