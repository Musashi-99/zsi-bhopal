const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

// Uses Node's built-in SQLite (no native compilation required - avoids the
// better-sqlite3/node-gyp/Visual-Studio pain on Windows). Requires Node 22.5+.

const DB_PATH = process.env.ARANYA_DB_PATH || process.env.HONEYCHAIN_DB_PATH || path.join(__dirname, 'aranyavalue.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
// If a second process/connection is mid-write when another tries to write,
// SQLite normally fails immediately with SQLITE_BUSY. This makes it instead
// wait up to 5s for the lock to free before giving up - turns a routine
// write-write race under load into a brief wait rather than a hard error.
db.exec('PRAGMA busy_timeout = 5000;');

function addColumn(table, column, ddl) {
  const has = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

function columnExists(table, column) {
  try {
    return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  } catch {
    return false;
  }
}

// A seeded file already has the latest columns. Re-running the schema and every
// column check on each serverless boot is what made sign-in wait.
const alreadyMigrated = columnExists('orders', 'enquiry_id') && columnExists('orders', 'updated_at') && columnExists('enquiries', 'updated_at');
if (!alreadyMigrated) {
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
  addColumn('users', 'profile_json', 'TEXT');
  addColumn('schemes', 'status', "TEXT NOT NULL DEFAULT 'published'");
  addColumn('schemes', 'publish_at', 'TEXT');
  addColumn('schemes', 'expires_at', 'TEXT');
  addColumn('schemes', 'application_steps', 'TEXT');
  addColumn('schemes', 'districts_json', "TEXT NOT NULL DEFAULT '[]'");
  addColumn('schemes', 'updated_at', 'TEXT');
  addColumn('schemes', 'updated_by', 'TEXT');
  addColumn('centres', 'status', "TEXT NOT NULL DEFAULT 'active'");
  addColumn('centres', 'block_name', 'TEXT');
  addColumn('centres', 'linked_groups', 'TEXT');
  addColumn('centres', 'updated_at', 'TEXT');
  addColumn('products', 'market_category_id', 'TEXT');
  addColumn('products', 'season', 'TEXT');
  addColumn('products', 'permissions_note', 'TEXT');
  addColumn('products', 'image', 'TEXT');
  addColumn('products', 'is_demo', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('centres', 'accreditation_status', "TEXT NOT NULL DEFAULT 'none'");
  addColumn('centres', 'accreditation_note', 'TEXT');
  addColumn('centres', 'accreditation_updated_at', 'TEXT');
  addColumn('centres', 'govt_registration', 'TEXT');
  addColumn('centres', 'equipment_json', "TEXT NOT NULL DEFAULT '[]'");
  addColumn('centres', 'facilities_json', "TEXT NOT NULL DEFAULT '[]'");
  addColumn('centres', 'contact_phone', 'TEXT');
  addColumn('centres', 'contact_email', 'TEXT');
  addColumn('centres', 'contact_public', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('centres', 'image', 'TEXT');
  addColumn('enquiries', 'quantity', 'REAL');
  addColumn('enquiries', 'unit', 'TEXT');
  addColumn('enquiries', 'intended_use', 'TEXT');
  addColumn('enquiries', 'delivery_location', 'TEXT');
  addColumn('enquiries', 'indicative_price', 'REAL');
  addColumn('enquiries', 'counter_price', 'REAL');
  addColumn('enquiries', 'responded_at', 'TEXT');
  addColumn('enquiries', 'responded_by', 'TEXT');
  addColumn('enquiries', 'order_id', 'TEXT');
  addColumn('enquiries', 'is_demo', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('enquiries', 'updated_at', 'TEXT');
  addColumn('orders', 'enquiry_id', 'TEXT');
  addColumn('orders', 'updated_at', 'TEXT');
}

// better-sqlite3 ships a `db.transaction(fn)` helper; node:sqlite doesn't, so
// we provide a tiny compatible shim (used in routes/hives.js and db/seed.js).
// `{ immediate: true }` uses BEGIN IMMEDIATE instead of plain BEGIN - it
// grabs SQLite's write lock up front rather than at the first write
// statement, which matters when the transaction does a read-then-write and
// needs the whole thing to be atomic against other writers (see
// services/ledger.js's appendEvent for why this matters).
db.transaction = function (fn, options = {}) {
  const beginStatement = options.immediate ? 'BEGIN IMMEDIATE' : 'BEGIN';
  return function (...args) {
    db.exec(beginStatement);
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
};

module.exports = db;
