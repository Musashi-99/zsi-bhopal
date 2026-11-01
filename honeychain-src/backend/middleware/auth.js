const db = require('../db/db');
const { verifyToken, TokenError } = require('../services/auth');

const COOKIE_NAME = 'aranyavalue_session';

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return header.split(';').reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return acc;
    acc[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
    return acc;
  }, {});
}

function requireAuth(req, res, next) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not logged in.' });
  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    if (err instanceof TokenError) return res.status(401).json({ error: 'Session expired or invalid. Log in again.' });
    throw err;
  }
  const user = db.prepare(`
    SELECT id, name, email, phone, role, preferred_language, state_id, district_id,
           organisation, centre_id, active, is_demo, created_at, profile_json
    FROM users WHERE id = ?
  `).get(payload.userId);
  if (!user || !user.active) return res.status(401).json({ error: 'Account is not active.' });
  req.user = user;
  next();
}

function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: `This action needs one of these roles: ${allowed.join(', ')}.` });
    }
    next();
  };
}

function optionalAuth(req, res, next) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = db.prepare(`
      SELECT id, name, email, phone, role, preferred_language, state_id, district_id,
             organisation, centre_id, active, is_demo, created_at, profile_json
      FROM users WHERE id = ?
    `).get(payload.userId);
    if (user && user.active) req.user = user;
  } catch {
    /* public page still loads */
  }
  next();
}

module.exports = { requireAuth, requireRole, optionalAuth, parseCookies, COOKIE_NAME };
