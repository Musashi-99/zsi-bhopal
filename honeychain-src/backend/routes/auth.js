const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { hashPassword, verifyPassword, signToken } = require('../services/auth');
const { requireAuth, COOKIE_NAME } = require('../middleware/auth');
const { cookieOptions } = require('../services/session');

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    role: user.role,
    preferred_language: user.preferred_language || 'en',
    state_id: user.state_id || null,
    district_id: user.district_id || null,
    organisation: user.organisation || null,
    centre_id: user.centre_id || null,
    is_demo: !!user.is_demo,
    created_at: user.created_at || null,
    profile: parseProfile(user.profile_json),
  };
}

function parseProfile(value) {
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}

router.post('/register', (req, res) => {
  const { name, email, password, phone, role, state_id, district_id, organisation, preferred_language } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required.' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const allowed = role === 'buyer' ? 'buyer' : 'collector';
  if (role && !['buyer', 'collector'].includes(role)) {
    return res.status(400).json({ error: 'Self-registration is open to collectors and buyers. Other roles are created by an administrator.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });
  const id = `U-${uuid().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role, preferred_language, state_id, district_id, organisation, active, is_demo, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
  `).run(id, name.trim(), String(email).toLowerCase(), phone || null, hashPassword(password), allowed, preferred_language || 'en', state_id || null, district_id || null, organisation || null, now);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.cookie(COOKIE_NAME, signToken({ userId: id, role: allowed }), cookieOptions());
  res.status(201).json({ user: publicUser(user) });
});

// Demo convenience: outside production, any email + password signs in.
// Unknown emails get a collector account created on the fly; known emails sign in without a password check.
const OPEN_LOGIN = process.env.NODE_ENV !== 'production' && process.env.OPEN_LOGIN !== 'off';

router.post('/login', (req, res) => {
  const { email, password, portal } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  const mail = String(email).toLowerCase().trim();
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(mail);
  // The login tab is only a hint. Officer sign-in never auto-creates accounts.
  if (portal === 'officer' && !user) return res.status(401).json({ error: 'Invalid email or password.' });
  // Buyer sign-in never creates accounts either. Buyers register explicitly, or use the clearly labelled Demo Buyer access.
  if (portal === 'buyer' && !user) return res.status(401).json({ error: 'No buyer account found for that email. Create a buyer account, or use Demo Buyer access.' });
  // Officer/admin accounts always require a real password check, even in demo mode.
  const privileged = user && ['inspector', 'admin'].includes(user.role);
  // Buyers always need a real password. Arbitrary credentials never create or enter a buyer account;
  // the labelled Demo Buyer endpoint is the only passwordless buyer path.
  if (OPEN_LOGIN && !privileged && !(user && user.role === 'buyer')) {
    if (!user) {
      const id = `U-${uuid().slice(0, 8).toUpperCase()}`;
      const name = mail.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'New Collector';
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role, preferred_language, state_id, district_id, active, is_demo, created_at)
        VALUES (?, ?, ?, ?, 'collector', 'en', 'ST-WB', 'DT-PUR', 1, 0, ?)
      `).run(id, name, mail, hashPassword(String(password)), new Date().toISOString());
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }
    if (!user.active) return res.status(401).json({ error: 'Invalid email or password.' });
  } else if (!user || !verifyPassword(password, user.password_hash) || !user.active) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  // Credentials are valid; now make sure they belong to the portal that was chosen.
  const PORTAL_ROLES = { collector: ['collector', 'centre'], buyer: ['buyer'], officer: ['inspector', 'admin'] };
  const PORTAL_NAMES = { collector: 'Collector / Producer', buyer: 'Buyer', officer: 'Government Officer' };
  if (portal && PORTAL_ROLES[portal] && !PORTAL_ROLES[portal].includes(user.role)) {
    return res.status(403).json({ error: `This account is not a ${PORTAL_NAMES[portal]} account. Choose the correct login option.` });
  }
  res.cookie(COOKIE_NAME, signToken({ userId: user.id, role: user.role }), cookieOptions());
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch('/me', requireAuth, (req, res) => {
  const { name, phone, preferred_language, state_id, district_id, organisation, profile } = req.body || {};
  if (name !== undefined && !String(name).trim()) return res.status(400).json({ error: 'Name cannot be empty.' });
  let profileJson = null;
  if (profile && typeof profile === 'object') {
    const merged = { ...parseProfile(req.user.profile_json), ...profile };
    profileJson = JSON.stringify(merged);
    if (profileJson.length > 4000) return res.status(400).json({ error: 'Profile data is too large.' });
  }
  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      preferred_language = COALESCE(?, preferred_language),
      state_id = COALESCE(?, state_id),
      district_id = COALESCE(?, district_id),
      organisation = COALESCE(?, organisation),
      profile_json = COALESCE(?, profile_json)
    WHERE id = ?
  `).run(name || null, phone || null, preferred_language || null, state_id || null, district_id || null, organisation || null, profileJson, req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

module.exports = router;
