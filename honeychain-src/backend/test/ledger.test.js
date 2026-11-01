const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

// Isolated test database so this never touches the real dev/demo DB.
const TEST_DB = path.join(__dirname, 'tmp-ledger.db');
process.env.HONEYCHAIN_DB_PATH = TEST_DB;
cleanupDbFiles();

const db = require('../db/db');
const { appendEvent, verifyChain } = require('../services/ledger');

function cleanupDbFiles() {
  for (const ext of ['', '-shm', '-wal']) {
    const p = TEST_DB + ext;
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (err) {
      // Windows can briefly hold a lock on the file even right after close();
      // this is just temp test data, so don't fail the suite over cleanup.
      console.warn(`Warning: could not remove ${p}: ${err.message}`);
    }
  }
}

function seedMinimalBatch(batchId) {
  db.exec(`INSERT OR IGNORE INTO states (id, name, code, languages, is_active) VALUES ('ST-T','Test','TT','["en"]',1)`);
  db.exec(`INSERT OR IGNORE INTO districts (id, state_id, name, is_active) VALUES ('DT-T','ST-T','Test',1)`);
  db.exec(`INSERT OR IGNORE INTO users (id, name, email, password_hash, role, created_at) VALUES ('U-T','T','t@test.local','x','collector','2026-01-01')`);
  db.exec(`INSERT OR IGNORE INTO products (id, name, category, default_unit, is_active) VALUES ('PR-T','Test','other','kg',1)`);
  db.prepare(`INSERT INTO batches (id, batch_code, product_id, collector_id, state_id, district_id, quantity, unit, collection_date, status, created_at, updated_at) VALUES (?, ?, 'PR-T', 'U-T', 'ST-T', 'DT-T', 1, 'kg', '2026-01-01', 'draft', '2026-01-01', '2026-01-01')`)
    .run(batchId, batchId + '-CODE');
}

test('verifyChain reports valid on an untouched chain', () => {
  seedMinimalBatch('BT-1');
  appendEvent({ batch_id: 'BT-1', event_type: 'TEST_EVENT_A', actor: 'test', payload: { a: 1 } });
  appendEvent({ batch_id: 'BT-1', event_type: 'TEST_EVENT_B', actor: 'test', payload: { b: 2 } });

  const result = verifyChain();
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.broken_events.length, 0);
});

// IMPORTANT: this test must run before the "bypassed" test below, since that
// one deliberately drops the trigger being tested here.
test('append-only triggers block direct UPDATE and DELETE on batch_events', () => {
  seedMinimalBatch('BT-2');
  const ev = appendEvent({ batch_id: 'BT-2', event_type: 'TEST_EVENT', actor: 'test', payload: {} });

  assert.throws(() => {
    db.prepare(`UPDATE batch_events SET payload = '{}' WHERE id = ?`).run(ev.id);
  }, /append-only/);

  assert.throws(() => {
    db.prepare(`DELETE FROM batch_events WHERE id = ?`).run(ev.id);
  }, /append-only/);
});

test('verifyChain detects tampering if append-only protection is bypassed', () => {
  seedMinimalBatch('BT-3');
  const ev = appendEvent({ batch_id: 'BT-3', event_type: 'TEST_EVENT', actor: 'test', payload: { untouched: true } });

  // Simulate an attacker with elevated DB access disabling the trigger first
  // (the scenario the hash-chain exists to defend against even when the
  // application-level/trigger-level protections have been circumvented).
  db.exec('DROP TRIGGER IF EXISTS trg_batch_events_no_update');
  db.prepare(`UPDATE batch_events SET payload = '{"untouched":false}' WHERE id = ?`).run(ev.id);

  const result = verifyChain();
  assert.strictEqual(result.valid, false);
  assert.ok(result.broken_events.some(b => b.id === ev.id));
});

test.after(() => {
  // Windows locks the file while the connection is open - close it first so
  // the unlink below doesn't fail with EBUSY (harmless on Linux/macOS either way).
  try { db.close(); } catch { /* already closed or never opened */ }
  cleanupDbFiles();
});
