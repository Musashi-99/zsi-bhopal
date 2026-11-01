const { v4: uuid } = require('uuid');
const db = require('../../db/db');

const PENDING = ['pending_verification', 'submitted'];
const APPROVED = ['verified', 'verified_with_limitations'];
const REJECTED = ['rejected', 'failed_checks'];
const CORRECTION = ['needs_info'];
const GROUPS = { pending: PENDING, approved: APPROVED, rejected: REJECTED, correction: CORRECTION };

const nid = (prefix) => `${prefix}-${uuid().slice(0, 8).toUpperCase()}`;
const now = () => new Date().toISOString();
const marks = (list) => list.map(() => '?').join(',');
const parse = (v, f) => { try { return v ? JSON.parse(v) : f; } catch { return f; } };

function officerProfile(user) {
  return db.prepare('SELECT * FROM officer_profiles WHERE user_id = ?').get(user.id) || null;
}

// Jurisdiction filter. Admins and officers without a profile see everything.
// `col` maps to the state / district columns of the aliased table.
function scope(req, { state = 'b.state_id', district = 'b.district_id' } = {}) {
  if (req.user.role === 'admin') return { sql: '', args: [] };
  const p = officerProfile(req.user);
  if (!p) return { sql: '', args: [] };
  if (p.level === 'district' && p.district_id) return { sql: ` AND ${district} = ?`, args: [p.district_id] };
  if (p.level === 'state' && p.state_id) return { sql: ` AND ${state} = ?`, args: [p.state_id] };
  return { sql: '', args: [] };
}

function inScope(req, batchLike) {
  const s = scope(req, { state: '?', district: '?' });
  if (!s.sql) return true;
  const p = officerProfile(req.user);
  if (p.level === 'district') return batchLike.district_id === p.district_id;
  return batchLike.state_id === p.state_id;
}

const maskPhone = (p) => (p ? `${'•'.repeat(Math.max(0, String(p).length - 3))}${String(p).slice(-3)}` : null);
const maskEmail = (e) => {
  if (!e) return null;
  const [u, d] = String(e).split('@');
  return `${u.slice(0, 1)}•••@${d || ''}`;
};

const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (['=', '+', '-', '@'].includes(s.charAt(0)) && Number.isNaN(Number(s))) s = `'${s}`; // block spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (columns, rows) => [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\n');

module.exports = { PENDING, APPROVED, REJECTED, CORRECTION, GROUPS, nid, now, marks, parse, scope, inScope, officerProfile, maskPhone, maskEmail, toCsv };
