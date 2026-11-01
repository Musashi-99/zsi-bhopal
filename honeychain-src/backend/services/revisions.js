const { v4: uuid } = require('uuid');
const db = require('../db/db');

const FIELDS = ['local_name', 'variety', 'grade_label', 'quantity', 'unit', 'collection_date', 'collection_area', 'block_name',
  'collection_method', 'source_type', 'source_declaration', 'source_note'];

// Snapshot of what the collector submitted, taken every time a batch is (re)submitted.
function snapshotRevision(batchId, userId, note) {
  const b = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  const next = (db.prepare('SELECT COALESCE(MAX(revision), 0) AS r FROM batch_revisions WHERE batch_id = ?').get(batchId).r) + 1;
  const snap = Object.fromEntries(FIELDS.map((f) => [f, b[f]]));
  snap.measurements = db.prepare('SELECT parameter_name, value, text_value, unit, evidence_source FROM measurements WHERE batch_id = ?').all(batchId);
  snap.evidence_count = db.prepare('SELECT COUNT(*) AS c FROM evidence WHERE batch_id = ?').get(batchId).c;
  db.prepare('INSERT INTO batch_revisions (id, batch_id, revision, snapshot_json, submitted_by, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(`RV-${uuid().slice(0, 8).toUpperCase()}`, batchId, next, JSON.stringify(snap), userId, note || null, new Date().toISOString());
  // a resubmission closes open correction requests
  db.prepare("UPDATE correction_requests SET status = 'resubmitted', resolved_at = ? WHERE batch_id = ? AND status = 'open'")
    .run(new Date().toISOString(), batchId);
  return next;
}

module.exports = { snapshotRevision };
