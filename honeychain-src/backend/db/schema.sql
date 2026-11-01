-- AranyaValue schema. Local SQLite. Hash-chained batch_events are append-only.
-- A local hash chain is tamper-evident storage, not a public blockchain.

CREATE TABLE IF NOT EXISTS states (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  languages TEXT NOT NULL DEFAULT '["en"]',
  is_active INTEGER NOT NULL DEFAULT 1,
  coverage_note TEXT
);

CREATE TABLE IF NOT EXISTS districts (
  id TEXT PRIMARY KEY,
  state_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (state_id) REFERENCES states(id)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('collector', 'centre', 'buyer', 'inspector', 'admin')),
  preferred_language TEXT NOT NULL DEFAULT 'en',
  state_id TEXT,
  district_id TEXT,
  organisation TEXT,
  centre_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (state_id) REFERENCES states(id),
  FOREIGN KEY (district_id) REFERENCES districts(id)
);

CREATE TABLE IF NOT EXISTS centres (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state_id TEXT NOT NULL,
  district_id TEXT NOT NULL,
  manager_user_id TEXT,
  address TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  coverage_note TEXT,
  FOREIGN KEY (state_id) REFERENCES states(id),
  FOREIGN KEY (district_id) REFERENCES districts(id)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  local_names TEXT NOT NULL DEFAULT '{}',
  category TEXT NOT NULL,
  species_name TEXT,
  description TEXT,
  default_unit TEXT NOT NULL,
  units_json TEXT NOT NULL DEFAULT '["kg"]',
  handling_json TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS product_states (
  product_id TEXT NOT NULL,
  state_id TEXT NOT NULL,
  PRIMARY KEY (product_id, state_id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (state_id) REFERENCES states(id)
);

CREATE TABLE IF NOT EXISTS quality_profiles (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  region TEXT,
  source_name TEXT,
  source_url TEXT,
  effective_date TEXT,
  notes TEXT,
  illustrative INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS quality_parameters (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT,
  data_type TEXT NOT NULL DEFAULT 'number',
  min_value REAL,
  max_value REAL,
  text_expect TEXT,
  required INTEGER NOT NULL DEFAULT 0,
  method TEXT,
  grade_label TEXT,
  source_name TEXT,
  source_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (profile_id) REFERENCES quality_profiles(id)
);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  batch_code TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL,
  collector_id TEXT NOT NULL,
  centre_id TEXT,
  state_id TEXT NOT NULL,
  district_id TEXT NOT NULL,
  local_name TEXT,
  variety TEXT,
  grade_label TEXT,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  collection_date TEXT NOT NULL,
  collection_area TEXT,
  block_name TEXT,
  collection_method TEXT,
  source_type TEXT,
  source_declaration TEXT,
  source_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  public_share INTEGER NOT NULL DEFAULT 0,
  internal_notes TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (collector_id) REFERENCES users(id),
  FOREIGN KEY (centre_id) REFERENCES centres(id),
  FOREIGN KEY (state_id) REFERENCES states(id),
  FOREIGN KEY (district_id) REFERENCES districts(id)
);

CREATE TABLE IF NOT EXISTS handling_records (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  method TEXT,
  location TEXT,
  start_date TEXT,
  end_date TEXT,
  notes TEXT,
  recorded_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS measurements (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  parameter_name TEXT NOT NULL,
  value REAL,
  text_value TEXT,
  unit TEXT,
  measured_at TEXT,
  method TEXT,
  evidence_source TEXT NOT NULL CHECK (evidence_source IN ('measured', 'self_reported', 'imported', 'simulated', 'unavailable')),
  verified INTEGER NOT NULL DEFAULT 0,
  recorded_by TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT,
  filename TEXT,
  mime TEXT,
  stored_name TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  uploaded_by TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  inspector_id TEXT,
  status TEXT NOT NULL,
  summary TEXT,
  limitations TEXT,
  resolves_rejection_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS buyer_requirements (
  id TEXT PRIMARY KEY,
  buyer_user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  grade_label TEXT,
  min_qty REAL,
  max_qty REAL,
  unit TEXT NOT NULL,
  specs_json TEXT NOT NULL DEFAULT '[]',
  documents_json TEXT NOT NULL DEFAULT '[]',
  packaging TEXT,
  storage TEXT,
  delivery TEXT,
  reference_price REAL,
  currency TEXT DEFAULT 'INR',
  price_unit TEXT,
  offer_kind TEXT NOT NULL DEFAULT 'demonstration',
  source_label TEXT,
  valid_from TEXT,
  valid_until TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (buyer_user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  buyer_user_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  requirement_id TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  price_unit TEXT NOT NULL,
  quantity REAL,
  min_quantity REAL,
  grade_label TEXT,
  terms TEXT,
  delivery_terms TEXT,
  offer_kind TEXT NOT NULL DEFAULT 'recorded_offer',
  source_label TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  valid_until TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (buyer_user_id) REFERENCES users(id),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  offer_id TEXT,
  buyer_user_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  agreed_price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  price_unit TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  payment_status TEXT NOT NULL DEFAULT 'not_recorded',
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (buyer_user_id) REFERENCES users(id),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS rejections (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  offer_id TEXT,
  category TEXT NOT NULL,
  explanation TEXT NOT NULL,
  measurement_ref TEXT,
  corrective_action TEXT,
  reassessment_needed INTEGER NOT NULL DEFAULT 1,
  resolved_by_verification_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS enquiries (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  buyer_user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'enquiry',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  FOREIGN KEY (buyer_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  centre_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (centre_id) REFERENCES centres(id),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS processing_records (
  id TEXT PRIMARY KEY,
  centre_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  method TEXT NOT NULL,
  input_qty REAL,
  output_qty REAL,
  unit TEXT,
  processed_at TEXT,
  operator_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (centre_id) REFERENCES centres(id),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS dispatches (
  id TEXT PRIMARY KEY,
  centre_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  order_id TEXT,
  buyer_user_id TEXT,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  dispatch_date TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  FOREIGN KEY (centre_id) REFERENCES centres(id),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS schemes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  level TEXT NOT NULL,
  state_id TEXT,
  category TEXT,
  beneficiaries TEXT,
  benefits TEXT,
  eligibility TEXT,
  documents_json TEXT NOT NULL DEFAULT '[]',
  process TEXT,
  official_url TEXT NOT NULL,
  source_url TEXT NOT NULL,
  last_verified TEXT,
  summary_is_illustrative INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (state_id) REFERENCES states(id)
);

CREATE TABLE IF NOT EXISTS scheme_actions (
  user_id TEXT NOT NULL,
  scheme_id TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, scheme_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (scheme_id) REFERENCES schemes(id)
);

CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS batch_events (
  id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL UNIQUE,
  batch_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT,
  payload TEXT,
  timestamp TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE INDEX IF NOT EXISTS idx_batches_collector ON batches(collector_id, status);
CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id, status);
CREATE INDEX IF NOT EXISTS idx_batches_centre ON batches(centre_id);
CREATE INDEX IF NOT EXISTS idx_measurements_batch ON measurements(batch_id);
CREATE INDEX IF NOT EXISTS idx_offers_batch ON offers(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_events_batch ON batch_events(batch_id, seq);
CREATE INDEX IF NOT EXISTS idx_districts_state ON districts(state_id);

CREATE TRIGGER IF NOT EXISTS trg_batch_events_no_update
BEFORE UPDATE ON batch_events
BEGIN
  SELECT RAISE(ABORT, 'batch_events is append-only: UPDATE is not permitted');
END;

CREATE TRIGGER IF NOT EXISTS trg_batch_events_no_delete
BEFORE DELETE ON batch_events
BEGIN
  SELECT RAISE(ABORT, 'batch_events is append-only: DELETE is not permitted');
END;

-- ---- Government Officer Portal additions ----
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  batch_id TEXT,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at);

CREATE TABLE IF NOT EXISTS batch_revisions (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  submitted_by TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (batch_id, revision),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS correction_requests (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  officer_id TEXT NOT NULL,
  items_json TEXT NOT NULL DEFAULT '[]',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

-- Officer-recorded quality measurements. Append-only: a change is a new version row.
CREATE TABLE IF NOT EXISTS inspection_records (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  parameter_name TEXT NOT NULL,
  value REAL,
  text_value TEXT,
  unit TEXT,
  method TEXT,
  tested_on TEXT,
  evidence_source TEXT NOT NULL CHECK (evidence_source IN ('instrument', 'laboratory', 'officer_observation')),
  reference_standard TEXT,
  lab_report_ref TEXT,
  evidence_id TEXT,
  remarks TEXT,
  inspector_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  supersedes_id TEXT,
  change_reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);
CREATE INDEX IF NOT EXISTS idx_inspection_batch ON inspection_records(batch_id);
CREATE TRIGGER IF NOT EXISTS trg_inspection_no_update BEFORE UPDATE ON inspection_records
BEGIN SELECT RAISE(ABORT, 'inspection_records is append-only: add a new version instead'); END;
CREATE TRIGGER IF NOT EXISTS trg_inspection_no_delete BEFORE DELETE ON inspection_records
BEGIN SELECT RAISE(ABORT, 'inspection_records is append-only'); END;

-- Non-batch audit events (scheme publication, role changes, centre edits...).
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_events_time ON audit_events(created_at);
CREATE TRIGGER IF NOT EXISTS trg_audit_events_no_update BEFORE UPDATE ON audit_events
BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
CREATE TRIGGER IF NOT EXISTS trg_audit_events_no_delete BEFORE DELETE ON audit_events
BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;

CREATE TABLE IF NOT EXISTS officer_profiles (
  user_id TEXT PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'district' CHECK (level IN ('state', 'district')),
  designation TEXT,
  state_id TEXT,
  district_id TEXT,
  approved_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ---- Marketplace additions (buyer-facing storefront over the shared batch records) ----
CREATE TABLE IF NOT EXISTS market_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- Marketplace metadata attached to an existing batch. Not a second batch record:
-- status, quantity, centre and verification always come from the batch itself.
CREATE TABLE IF NOT EXISTS market_listings (
  batch_id TEXT PRIMARY KEY,
  listed INTEGER NOT NULL DEFAULT 1,
  indicative_price REAL,
  price_unit TEXT,
  price_updated_at TEXT,
  min_order_qty REAL,
  packaging TEXT,
  description TEXT,
  images_json TEXT NOT NULL DEFAULT '[]',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS buyer_saved (
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('product', 'centre')),
  ref_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, kind, ref_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS buyer_viewed (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('product', 'verify')),
  ref_id TEXT NOT NULL,
  outcome TEXT,
  viewed_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_buyer_viewed_user ON buyer_viewed(user_id, kind, viewed_at);

CREATE TABLE IF NOT EXISTS enquiry_messages (
  id TEXT PRIMARY KEY,
  enquiry_id TEXT NOT NULL,
  sender_id TEXT,
  sender_role TEXT,
  kind TEXT NOT NULL DEFAULT 'message',
  body TEXT,
  counter_price REAL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (enquiry_id) REFERENCES enquiries(id)
);
CREATE INDEX IF NOT EXISTS idx_enquiry_messages ON enquiry_messages(enquiry_id, created_at);
