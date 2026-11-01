const { v4: uuid } = require('uuid');
const db = require('../db/db');

// Append-only audit for non-batch changes. Batch events keep using the hash chain (services/ledger.js).
// This module is the single seam to swap in an external tamper-evident store later.
function audit(actor, { action, entity_type, entity_id = null, before = null, after = null, reason = null }) {
  db.prepare(`INSERT INTO audit_events (id, actor_id, actor_role, action, entity_type, entity_id, before_json, after_json, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(`AE-${uuid().slice(0, 8).toUpperCase()}`, actor ? actor.id : null, actor ? actor.role : null, action, entity_type, entity_id,
      before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after), reason, new Date().toISOString());
}

module.exports = { audit };
