const { v4: uuid } = require('uuid');
const db = require('../db/db');

function notify(userId, { kind, title, body = null, batch_id = null, link = null }) {
  if (!userId) return;
  db.prepare(`INSERT INTO notifications (id, user_id, kind, title, body, batch_id, link, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`)
    .run(`N-${uuid().slice(0, 8).toUpperCase()}`, userId, kind, title, body, batch_id, link, new Date().toISOString());
}

// Notify every active officer (inspector) and, optionally, jurisdiction-matching ones only.
function notifyOfficers(payload, { stateId = null, districtId = null } = {}) {
  const officers = db.prepare(`
    SELECT u.id, p.level, p.state_id, p.district_id FROM users u
    LEFT JOIN officer_profiles p ON p.user_id = u.id
    WHERE u.role = 'inspector' AND u.active = 1`).all();
  for (const o of officers) {
    if (o.level === 'district' && o.district_id && districtId && o.district_id !== districtId) continue;
    if (o.level === 'state' && o.state_id && stateId && o.state_id !== stateId) continue;
    notify(o.id, payload);
  }
}

module.exports = { notify, notifyOfficers };
