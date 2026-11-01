const express = require('express');
const db = require('../../db/db');
const { audit } = require('../../services/audit');
const { nid, now, parse } = require('./helpers');

const router = express.Router();
const STATUSES = ['draft', 'published', 'inactive'];
const isUrl = (u) => /^https?:\/\/[^\s]+\.[^\s]+/i.test(String(u || ''));
const isDate = (d) => !d || !Number.isNaN(Date.parse(d));

function shape(row) {
  const today = new Date().toISOString().slice(0, 10);
  const live = row.status === 'published' && (!row.publish_at || row.publish_at <= today) && (!row.expires_at || row.expires_at >= today);
  return {
    ...row,
    documents: parse(row.documents_json, []),
    districts: parse(row.districts_json, []),
    summary_is_illustrative: !!row.summary_is_illustrative,
    live,
    state: row.state_name || null,
    saved: row.saved || 0,
    applied: row.applied || 0,
  };
}

const SELECT = `SELECT s.*, st.name AS state_name,
  (SELECT COUNT(*) FROM scheme_actions a WHERE a.scheme_id = s.id AND a.status = 'saved') AS saved,
  (SELECT COUNT(*) FROM scheme_actions a WHERE a.scheme_id = s.id AND a.status = 'applied') AS applied
  FROM schemes s LEFT JOIN states st ON st.id = s.state_id`;

router.get('/schemes', (req, res) => {
  res.json({ schemes: db.prepare(`${SELECT} ORDER BY s.updated_at DESC, s.name`).all().map(shape) });
});

router.get('/schemes/:id', (req, res) => {
  const row = db.prepare(`${SELECT} WHERE s.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Scheme not found.' });
  res.json({ scheme: shape(row) });
});

function validate(b, partial) {
  const need = (k, label) => (!partial || b[k] !== undefined) && !String(b[k] || '').trim() ? `${label} is required.` : null;
  const errs = [need('name', 'Scheme name'), need('department', 'Department'), need('official_url', 'Official application link'), need('source_url', 'Official source link')].filter(Boolean);
  if (b.official_url !== undefined && b.official_url && !isUrl(b.official_url)) errs.push('Official application link must be a full http(s) URL.');
  if (b.source_url !== undefined && b.source_url && !isUrl(b.source_url)) errs.push('Official source link must be a full http(s) URL.');
  if (!isDate(b.publish_at) || !isDate(b.expires_at)) errs.push('Publication and expiry must be valid dates.');
  if (b.publish_at && b.expires_at && b.expires_at < b.publish_at) errs.push('Expiry cannot be before publication.');
  if (b.status !== undefined && !STATUSES.includes(b.status)) errs.push('Unknown status.');
  if (b.level !== undefined && !['central', 'state', 'district'].includes(b.level)) errs.push('Level must be central, state or district.');
  return errs;
}

const listOf = (v) => (Array.isArray(v) ? v : String(v || '').split('\n')).map((s) => String(s).trim()).filter(Boolean);

router.post('/schemes', (req, res) => {
  const b = req.body || {};
  const errs = validate(b, false);
  if (errs.length) return res.status(400).json({ error: errs.join(' ') });
  if (b.state_id && !db.prepare('SELECT 1 FROM states WHERE id = ?').get(b.state_id)) return res.status(400).json({ error: 'Unknown state.' });
  const id = nid('SC');
  const status = STATUSES.includes(b.status) ? b.status : 'draft';
  const ts = now();
  db.prepare(`INSERT INTO schemes (id, name, department, level, state_id, category, beneficiaries, benefits, eligibility, documents_json, process, official_url, source_url,
      last_verified, summary_is_illustrative, status, publish_at, expires_at, application_steps, districts_json, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, String(b.name).trim(), String(b.department).trim(), b.level || (b.state_id ? 'state' : 'central'), b.state_id || null, b.category || null, b.beneficiaries || null,
      b.benefits || null, b.eligibility || null, JSON.stringify(listOf(b.documents)), b.process || null, b.official_url.trim(), b.source_url.trim(),
      ts.slice(0, 10), status, b.publish_at || null, b.expires_at || null, b.application_steps || null, JSON.stringify(listOf(b.districts)), ts, req.user.id);
  audit(req.user, { action: status === 'published' ? 'SCHEME_PUBLISHED' : 'SCHEME_CREATED', entity_type: 'scheme', entity_id: id, after: { name: b.name, status, publish_at: b.publish_at || null, expires_at: b.expires_at || null } });
  res.status(201).json({ id });
});

router.patch('/schemes/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM schemes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Scheme not found.' });
  const b = req.body || {};
  const errs = validate(b, true);
  if (errs.length) return res.status(400).json({ error: errs.join(' ') });
  if (row.status === 'published' && (!b.reason || String(b.reason).trim().length < 5)) {
    return res.status(400).json({ error: 'This scheme is live. Give a reason for the change.' });
  }
  const pick = (k, cur) => (b[k] !== undefined ? b[k] : cur);
  const next = {
    name: pick('name', row.name), department: pick('department', row.department), level: pick('level', row.level),
    state_id: pick('state_id', row.state_id) || null, category: pick('category', row.category), beneficiaries: pick('beneficiaries', row.beneficiaries),
    benefits: pick('benefits', row.benefits), eligibility: pick('eligibility', row.eligibility), process: pick('process', row.process),
    official_url: pick('official_url', row.official_url), source_url: pick('source_url', row.source_url),
    publish_at: pick('publish_at', row.publish_at) || null, expires_at: pick('expires_at', row.expires_at) || null,
    application_steps: pick('application_steps', row.application_steps), status: pick('status', row.status),
    documents_json: b.documents !== undefined ? JSON.stringify(listOf(b.documents)) : row.documents_json,
    districts_json: b.districts !== undefined ? JSON.stringify(listOf(b.districts)) : row.districts_json,
  };
  const ts = now();
  db.prepare(`UPDATE schemes SET name = ?, department = ?, level = ?, state_id = ?, category = ?, beneficiaries = ?, benefits = ?, eligibility = ?, process = ?,
      official_url = ?, source_url = ?, publish_at = ?, expires_at = ?, application_steps = ?, status = ?, documents_json = ?, districts_json = ?,
      last_verified = ?, summary_is_illustrative = 0, updated_at = ?, updated_by = ? WHERE id = ?`)
    .run(next.name, next.department, next.level, next.state_id, next.category, next.beneficiaries, next.benefits, next.eligibility, next.process,
      next.official_url, next.source_url, next.publish_at, next.expires_at, next.application_steps, next.status, next.documents_json, next.districts_json,
      ts.slice(0, 10), ts, req.user.id, row.id);
  const changed = (o) => Object.fromEntries(Object.keys(next).filter((k) => String(next[k] ?? '') !== String(o[k] ?? '')).map((k) => [k, o[k] ?? null]));
  const before = changed(row);
  const after = Object.fromEntries(Object.keys(before).map((k) => [k, next[k]]));
  const action = before.status !== undefined && next.status === 'published' ? 'SCHEME_PUBLISHED'
    : before.status !== undefined && next.status !== 'published' ? 'SCHEME_UNPUBLISHED' : 'SCHEME_UPDATED';
  audit(req.user, { action, entity_type: 'scheme', entity_id: row.id, before, after, reason: b.reason || null });
  res.json({ ok: true });
});

module.exports = router;
