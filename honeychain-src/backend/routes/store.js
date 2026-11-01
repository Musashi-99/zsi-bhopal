/**
 * AranyaValue Marketplace API  (mounted at /api/store)
 *
 *  - Public: browse listings, catalogue, centres, and verify a batch by code / QR. No account needed.
 *  - Buyer:  enquiries, purchase requests, orders, saved items, history. Real buyer accounts only,
 *            or the clearly labelled Demo Buyer (never creates or upgrades an account).
 *  - Seller: collectors / centres answer enquiries, advance orders and price their own batches.
 *
 * It reads the same batches / verifications / measurements the Producer and Officer portals write.
 */
const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { requireAuth, requireRole, optionalAuth } = require('../middleware/auth');
const { appendEvent, verifyChain } = require('../services/ledger');
const { loadContext } = require('../services/records');
const { notify } = require('../services/notify');
const { startSession } = require('../services/session');
const M = require('../services/marketplace');

const router = express.Router();
const nid = (prefix) => `${prefix}-${uuid().slice(0, 8).toUpperCase()}`;
const now = () => new Date().toISOString();
const text = (v, max) => (v == null ? '' : String(v).trim().slice(0, max));
const DEMO_BUYER_ID = 'U-BUY1';

/* ------------------------------------------------------------------ helpers */

function recordView(user, kind, ref, outcome = null) {
  if (!user || user.role !== 'buyer' || !ref) return;
  const recent = db.prepare("SELECT 1 FROM buyer_viewed WHERE user_id = ? AND kind = ? AND ref_id = ? AND viewed_at > ?")
    .get(user.id, kind, ref, new Date(Date.now() - 120000).toISOString());
  if (recent) return;
  db.prepare('INSERT INTO buyer_viewed (id, user_id, kind, ref_id, outcome, viewed_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(nid('VW'), user.id, kind, ref, outcome, now());
}

function sellersOf(batch) {
  const ids = new Set();
  if (batch.collector_id) ids.add(batch.collector_id);
  if (batch.centre_id) {
    for (const u of db.prepare("SELECT id FROM users WHERE role = 'centre' AND centre_id = ? AND active = 1").all(batch.centre_id)) ids.add(u.id);
  }
  return [...ids];
}

function notifySellers(batch, payload) {
  for (const id of sellersOf(batch)) notify(id, { batch_id: batch.id, ...payload });
}

function isSellerOf(user, batch) {
  if (user.role === 'admin') return true;
  if (user.role === 'collector') return batch.collector_id === user.id;
  if (user.role === 'centre') return !!batch.centre_id && batch.centre_id === user.centre_id;
  return false;
}

function availableQty(batchId) {
  const row = db.prepare(`SELECT MAX(0, b.quantity - COALESCE((SELECT SUM(o.quantity) FROM orders o WHERE o.batch_id = b.id AND o.status != 'cancelled'), 0)) AS q
    FROM batches b WHERE b.id = ?`).get(batchId);
  return row ? row.q : 0;
}

function shortName(name = '') {
  const clean = String(name).replace(/\s*\(.*?\)\s*/g, ' ').replace(/^Demo\s+/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || 'Operator';
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/* ------------------------------------------------------------------ public: meta + home */

router.get('/meta', (req, res) => {
  const stateId = req.query.state || 'ST-WB';
  res.json({
    states: db.prepare('SELECT id, name, code, is_active FROM states ORDER BY name').all(),
    districts: db.prepare(`
      SELECT d.id, d.name, d.state_id,
        (SELECT COUNT(*) FROM market_listings l JOIN batches b ON b.id = l.batch_id
          WHERE l.listed = 1 AND b.district_id = d.id AND b.public_share = 1 AND b.status NOT IN ('draft','rejected','failed_checks','suspended','dispatched')) AS listings
      FROM districts d WHERE d.is_active = 1 ORDER BY d.name`).all(),
    categories: categoriesWithCounts(),
    centres: db.prepare("SELECT id, name, district_id FROM centres ORDER BY name").all(),
    statuses: M.FILTER_STATUSES,
    source_types: M.SOURCE_TYPES,
    default_state: stateId,
    demo_notice: 'Demonstration marketplace. Records labelled DEMO DATA are illustrative samples, not live inventory, live prices or verified trade.',
  });
});

function categoriesWithCounts() {
  return db.prepare(`
    SELECT mc.id, mc.slug, mc.name, mc.description, mc.image,
      (SELECT COUNT(*) FROM products p WHERE p.market_category_id = mc.id AND p.is_active = 1) AS product_types,
      (SELECT COUNT(*) FROM market_listings l JOIN batches b ON b.id = l.batch_id JOIN products p ON p.id = b.product_id
        WHERE l.listed = 1 AND p.market_category_id = mc.id AND b.public_share = 1
          AND b.status NOT IN ('draft','rejected','failed_checks','suspended','dispatched')) AS listings
    FROM market_categories mc WHERE mc.is_active = 1 ORDER BY mc.sort_order, mc.name`).all();
}

router.get('/home', (req, res) => {
  const stateId = req.query.state || 'ST-WB';
  const featured = M.searchListings({ state: stateId, sort: 'verified', limit: 24 }).listings
    .filter((l) => l.can_enquire)
    .sort((a, b) => Number(b.flags.officer_verified) - Number(a.flags.officer_verified))
    .slice(0, 8);
  const districts = db.prepare(`
    SELECT d.id, d.name,
      (SELECT COUNT(*) FROM centres c WHERE c.district_id = d.id) AS centres
    FROM districts d WHERE d.state_id = ? AND d.is_active = 1 ORDER BY d.name`).all(stateId).map((d) => {
    // Products are listed per district only where a real batch is recorded there. No catalogue-wide guess.
    const prods = db.prepare(`
      SELECT DISTINCT p.name, p.id FROM market_listings l JOIN batches b ON b.id = l.batch_id JOIN products p ON p.id = b.product_id
      WHERE l.listed = 1 AND b.district_id = ? AND b.public_share = 1 AND b.status NOT IN ('draft','rejected','failed_checks','suspended','dispatched')
      ORDER BY p.name`).all(d.id);
    return { ...d, listings: prods.length ? db.prepare(`SELECT COUNT(*) AS c FROM market_listings l JOIN batches b ON b.id = l.batch_id
      WHERE l.listed = 1 AND b.district_id = ? AND b.public_share = 1 AND b.status NOT IN ('draft','rejected','failed_checks','suspended','dispatched')`).get(d.id).c : 0, products: prods };
  });
  const centres = db.prepare(`SELECT id FROM centres ORDER BY (accreditation_status = 'active') DESC, name LIMIT 4`).all().map((c) => centreCard(c.id));
  const stats = {
    listings: db.prepare("SELECT COUNT(*) AS c FROM market_listings l JOIN batches b ON b.id = l.batch_id WHERE l.listed = 1 AND b.public_share = 1 AND b.status NOT IN ('draft','rejected','failed_checks','suspended','dispatched')").get().c,
    centres: db.prepare('SELECT COUNT(*) AS c FROM centres').get().c,
    districts: districts.filter((d) => d.listings > 0).length,
    verified: db.prepare("SELECT COUNT(*) AS c FROM batches WHERE public_share = 1 AND status IN ('verified','verified_with_limitations')").get().c,
    product_types: db.prepare('SELECT COUNT(*) AS c FROM products WHERE is_active = 1').get().c,
  };
  res.json({ categories: categoriesWithCounts(), featured, districts, centres, stats });
});

/* ------------------------------------------------------------------ public: listings */

router.get('/listings', (req, res) => res.json(M.searchListings(req.query)));

router.get('/listings/:code', optionalAuth, (req, res) => {
  const row = M.getListingRow(req.params.code);
  if (!row) return res.status(404).json({ error: 'This listing is not available. The batch may not exist, may not be listed, or may be private.' });
  const card = M.shapeCard(row);
  const ctx = loadContext(row.id);
  ctx.inspections = db.prepare('SELECT * FROM inspection_records WHERE batch_id = ? ORDER BY created_at').all(row.id);
  const names = M.parse(row.local_names, {});
  const latest = ctx.verifications.at(-1) || null;
  const related = M.searchListings({ category: card.product.market_category ? card.product.market_category.slug : undefined, state: row.state_id, limit: 8 })
    .listings.filter((l) => l.code !== card.code).slice(0, 4);
  const expected = ctx.parameters.map((p) => ({ name: p.name, unit: p.unit, standard: p.source_name && !/^not configured/i.test(p.source_name) ? p.source_name : null }));
  const handling = M.parse(ctx.product.handling_json, {});
  recordView(req.user, 'product', card.code);
  const saved = req.user && req.user.role === 'buyer'
    ? !!db.prepare("SELECT 1 FROM buyer_saved WHERE user_id = ? AND kind = 'product' AND ref_id = ?").get(req.user.id, card.code)
    : false;
  res.json({
    listing: card,
    detail: {
      description: row.listing_description || row.product_description || ctx.product.description || null,
      product_description: ctx.product.description || null,
      scientific_name: row.species_name || null,
      local_names: names,
      season: row.season || null,
      permissions_note: row.permissions_note || null,
      packaging: row.packaging || null,
      handling_expected: handling.expected || [],
      collection: {
        date: row.collection_date,
        area: row.collection_area || null,
        block: row.block_name || null,
        district: row.district_name,
        state: row.state_name,
        method: ctx.batch.collection_method || null,
        source_type: ctx.batch.source_type || null,
        source_statement: 'Source is declared by the collector. Independent verification of origin is unavailable.',
      },
      quality: M.buildQuality(ctx, row.centre_name),
      conditions: M.buildConditions(ctx, row.centre_name),
      expected_parameters: expected,
      documents: M.publicDocuments(ctx),
      history: M.buildHistory(ctx),
      officer: latest
        ? { status: M.primaryStatus(latest.status), summary: latest.summary, limitations: latest.limitations, decided_at: latest.created_at, by: 'Authorised officer' }
        : null,
      warning: M.warningFor(row.status),
      verify_path: `/market/verify/${card.code}`,
    },
    centre: row.centre_id ? centreCard(row.centre_id) : null,
    related,
    buyer: { saved },
  });
});

/* ------------------------------------------------------------------ public: batch verification (QR target) */

router.get('/verify/:code', optionalAuth, (req, res) => {
  const raw = text(req.params.code, 60);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{3,59}$/.test(raw)) {
    return res.status(400).json({ found: false, reason: 'invalid_format', error: 'That does not look like an AranyaValue batch ID. Batch IDs look like AV-WB-HON-0004.' });
  }
  const code = raw.toUpperCase();
  const batch = db.prepare('SELECT id, batch_code, status, public_share FROM batches WHERE batch_code = ? OR id = ?').get(code, raw);
  if (!batch || batch.status === 'draft') {
    recordView(req.user, 'verify', code, 'not_found');
    return res.status(404).json({ found: false, reason: 'not_found', error: 'No batch record matches this ID. Do not rely on a QR code that does not resolve to a record.' });
  }
  const primary = M.primaryStatus(batch.status);
  if (!batch.public_share) {
    recordView(req.user, 'verify', batch.batch_code, 'private');
    return res.json({
      found: true, public_record: false, code: batch.batch_code, status: primary,
      message: 'This batch exists, but its collector has not shared the record publicly. No further details can be shown here.',
      warning: M.warningFor(batch.status), integrity: integrity(),
    });
  }
  const ctx = loadContext(batch.id);
  ctx.inspections = db.prepare('SELECT * FROM inspection_records WHERE batch_id = ? ORDER BY created_at').all(batch.id);
  const b = ctx.batch;
  const flags = {
    centre_checked: !!db.prepare("SELECT 1 FROM measurements m JOIN users u ON u.id = m.recorded_by WHERE m.batch_id = ? AND m.evidence_source = 'measured' AND u.role = 'centre'").get(batch.id),
    lab_tested: ctx.inspections.some((r) => r.evidence_source === 'laboratory'),
    officer_verified: ['verified', 'verified_with_limitations'].includes(b.status),
  };
  const centreRow = b.centre_id ? db.prepare('SELECT * FROM centres WHERE id = ?').get(b.centre_id) : null;
  const latest = ctx.verifications.at(-1) || null;
  const docs = M.publicDocuments(ctx);
  const listingRow = M.getListingRow(b.id);
  recordView(req.user, 'verify', b.batch_code, b.status);
  res.json({
    found: true,
    public_record: true,
    code: b.batch_code,
    is_demo: !!b.is_demo,
    batch: {
      product: b.product_name,
      local_name: b.local_name || null,
      scientific_name: b.species_name || null,
      category: b.category,
      grade_label: b.grade_label || null,
      quantity: b.quantity,
      unit: b.unit,
      collection_date: b.collection_date,
      collection_area: b.collection_area || null,
      block: b.block_name || null,
      district: b.district_name,
      state: b.state_name,
      collection_method: b.collection_method || null,
      source_statement: 'Source is declared by the collector. Independent verification of origin is unavailable.',
    },
    centre: centreRow
      ? { id: centreRow.id, name: centreRow.name, district: b.district_name, accreditation: M.accreditation(centreRow), verified_centre: M.isVerifiedCentre({ ...centreRow, centre_status: centreRow.status }) }
      : null,
    status: { key: primary.key, label: primary.label, tone: primary.tone, note: primary.note || null, raw: b.status },
    badges: M.badgesFor(primary, flags),
    flags,
    warning: M.warningFor(b.status),
    officer: latest
      ? { status: M.primaryStatus(latest.status), summary: latest.summary, limitations: latest.limitations, decided_at: latest.created_at, by: 'Authorised officer' }
      : null,
    quality: M.buildQuality(ctx, b.centre_name),
    conditions: M.buildConditions(ctx, b.centre_name),
    photos: docs.filter((d) => d.is_image),
    documents: docs.filter((d) => !d.is_image),
    history: M.buildHistory(ctx),
    listing: listingRow ? M.shapeCard(listingRow) : null,
    integrity: integrity(),
    not_shown: ['Collector contact details', 'Private notes and documents', 'Buyer offers and enquiries'],
    retrieved_at: now(),
    limitations: [
      'A QR code only opens this record. It does not by itself prove authenticity, origin or laboratory certification.',
      'Status shown here is read live from the AranyaValue batch record at the time of this request.',
    ],
  });
});

function integrity() {
  const chain = verifyChain();
  return { valid: chain.valid, total_events: chain.total_events, note: 'Covers the local append-only event log. It is not a public blockchain and does not prove geographical origin.' };
}

/* ------------------------------------------------------------------ public: catalogue */

function shapeProduct(row) {
  const names = M.parse(row.local_names, {});
  const districts = db.prepare(`
    SELECT DISTINCT d.name FROM market_listings l JOIN batches b ON b.id = l.batch_id JOIN districts d ON d.id = b.district_id
    WHERE l.listed = 1 AND b.product_id = ? AND b.public_share = 1 AND b.status NOT IN ('draft','rejected','failed_checks','suspended','dispatched')
    ORDER BY d.name`).all(row.id).map((d) => d.name);
  const handling = M.parse(row.handling_json, {});
  return {
    id: row.id,
    name: row.name,
    names: { en: names.en || row.name, bn: names.bn || null, hi: names.hi || null, local: names.local || [] },
    scientific_name: row.species_name || null,
    category: row.category,
    market_category: row.mc_id ? { id: row.mc_id, slug: row.mc_slug, name: row.mc_name } : null,
    description: row.description || null,
    season: row.season || null,
    permissions_note: row.permissions_note || null,
    default_unit: row.default_unit,
    units: M.parse(row.units_json, []),
    handling_expected: handling.expected || [],
    handling_required: handling.required || [],
    image: row.image || row.mc_image || null,
    is_demo: !!row.is_demo,
    is_active: !!row.is_active,
    districts_with_batches: districts,
    listing_count: db.prepare(`SELECT COUNT(*) AS c FROM market_listings l JOIN batches b ON b.id = l.batch_id
      WHERE l.listed = 1 AND b.product_id = ? AND b.public_share = 1 AND b.status NOT IN ('draft','rejected','failed_checks','suspended','dispatched')`).get(row.id).c,
  };
}

const PRODUCT_SELECT = `SELECT p.*, mc.id AS mc_id, mc.slug AS mc_slug, mc.name AS mc_name, mc.image AS mc_image
  FROM products p LEFT JOIN market_categories mc ON mc.id = p.market_category_id`;

router.get('/catalogue', (req, res) => {
  const where = ['p.is_active = 1'];
  const args = [];
  const q = text(req.query.q, 80);
  if (q) {
    where.push('(p.name LIKE ? OR p.local_names LIKE ? OR p.species_name LIKE ? OR p.category LIKE ? OR mc.name LIKE ?)');
    const like = `%${q}%`;
    args.push(like, like, like, like, like);
  }
  if (req.query.category) { where.push('(mc.slug = ? OR mc.id = ?)'); args.push(req.query.category, req.query.category); }
  if (req.query.state) { where.push('EXISTS(SELECT 1 FROM product_states ps WHERE ps.product_id = p.id AND ps.state_id = ?)'); args.push(req.query.state); }
  const rows = db.prepare(`${PRODUCT_SELECT} WHERE ${where.join(' AND ')} ORDER BY mc.sort_order, p.name`).all(...args);
  res.json({ products: rows.map(shapeProduct) });
});

router.get('/catalogue/:id', (req, res) => {
  const row = db.prepare(`${PRODUCT_SELECT} WHERE p.id = ? AND p.is_active = 1`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Catalogue entry not found.' });
  const parameters = db.prepare(`
    SELECT qp.name, qp.unit, qp.min_value, qp.max_value, qp.required, qp.method, qp.source_name, qp.source_url, prof.name AS profile_name, prof.illustrative
    FROM quality_parameters qp JOIN quality_profiles prof ON prof.id = qp.profile_id
    WHERE prof.product_id = ? ORDER BY qp.sort_order, qp.name`).all(row.id).map((p) => ({
    name: p.name, unit: p.unit, min: p.min_value, max: p.max_value, required: !!p.required, method: p.method,
    standard: p.source_name && !/^not configured/i.test(p.source_name) ? p.source_name : null, source_url: p.source_url,
    profile: p.profile_name, illustrative: !!p.illustrative,
  }));
  const states = db.prepare('SELECT s.id, s.name FROM product_states ps JOIN states s ON s.id = ps.state_id WHERE ps.product_id = ?').all(row.id);
  const listings = M.searchListings({ product: row.id, limit: 12 }).listings;
  res.json({ product: shapeProduct(row), parameters, states, listings });
});

/* ------------------------------------------------------------------ public: centres */

function centreCard(id) {
  const c = db.prepare(`
    SELECT c.*, s.name AS state_name, d.name AS district_name,
      (SELECT COUNT(*) FROM market_listings l JOIN batches b ON b.id = l.batch_id WHERE l.listed = 1 AND b.centre_id = c.id AND b.public_share = 1
         AND b.status NOT IN ('draft','rejected','failed_checks','suspended','dispatched')) AS available_batches,
      (SELECT COUNT(*) FROM batches b WHERE b.centre_id = c.id AND b.public_share = 1 AND b.status != 'draft') AS total_batches
    FROM centres c JOIN states s ON s.id = c.state_id JOIN districts d ON d.id = c.district_id WHERE c.id = ?`).get(id);
  if (!c) return null;
  const products = db.prepare(`SELECT DISTINCT p.name FROM batches b JOIN products p ON p.id = b.product_id
    WHERE b.centre_id = ? AND b.public_share = 1 AND b.status != 'draft' ORDER BY p.name`).all(id).map((p) => p.name);
  return {
    id: c.id,
    name: c.name,
    district: { id: c.district_id, name: c.district_name },
    state: { id: c.state_id, name: c.state_name },
    block: c.block_name || null,
    location: c.address || null,
    status: c.status || 'active',
    accreditation: M.accreditation(c),
    verified_centre: M.isVerifiedCentre({ ...c, centre_status: c.status }),
    products,
    available_batches: c.available_batches,
    total_batches: c.total_batches,
    contact: c.contact_public ? { phone: c.contact_phone || null, email: c.contact_email || null } : null,
    image: c.image || null,
    is_demo: !!c.is_demo,
    coverage_note: c.coverage_note || null,
  };
}

router.get('/centres', (req, res) => {
  const where = ['1 = 1'];
  const args = [];
  const q = text(req.query.q, 80);
  if (q) {
    where.push('(c.name LIKE ? OR c.id LIKE ? OR d.name LIKE ? OR c.address LIKE ? OR EXISTS(SELECT 1 FROM batches b JOIN products p ON p.id = b.product_id WHERE b.centre_id = c.id AND p.name LIKE ?))');
    const like = `%${q}%`;
    args.push(like, like, like, like, like);
  }
  if (req.query.district) { where.push('(c.district_id = ? OR d.name = ?)'); args.push(req.query.district, req.query.district); }
  if (req.query.state) { where.push('c.state_id = ?'); args.push(req.query.state); }
  if (req.query.accreditation) { where.push('c.accreditation_status = ?'); args.push(req.query.accreditation); }
  if (req.query.product) { where.push('EXISTS(SELECT 1 FROM batches b WHERE b.centre_id = c.id AND b.product_id = ? AND b.public_share = 1 AND b.status != \'draft\')'); args.push(req.query.product); }
  const ids = db.prepare(`SELECT c.id FROM centres c JOIN districts d ON d.id = c.district_id WHERE ${where.join(' AND ')} ORDER BY c.name`).all(...args);
  res.json({ centres: ids.map((r) => centreCard(r.id)) });
});

router.get('/centres/:id', optionalAuth, (req, res) => {
  const base = centreCard(req.params.id);
  if (!base) return res.status(404).json({ error: 'Collection centre not found.' });
  const c = db.prepare('SELECT * FROM centres WHERE id = ?').get(base.id);
  const inventory = M.searchListings({ centre: c.id, limit: 24 }).listings;
  const history = db.prepare(`
    SELECT b.batch_code, b.status, b.quantity, b.unit, b.collection_date, b.updated_at, p.name AS product_name, b.is_demo
    FROM batches b JOIN products p ON p.id = b.product_id
    WHERE b.centre_id = ? AND b.public_share = 1 AND b.status != 'draft' ORDER BY b.updated_at DESC LIMIT 20`).all(c.id)
    .map((r) => ({ code: r.batch_code, product: r.product_name, quantity: r.quantity, unit: r.unit, collection_date: r.collection_date, updated_at: r.updated_at, status: M.primaryStatus(r.status), is_demo: !!r.is_demo }));
  const outcomes = db.prepare(`SELECT status, COUNT(*) AS n FROM batches WHERE centre_id = ? AND public_share = 1 AND status != 'draft' GROUP BY status`).all(c.id);
  const count = (list) => outcomes.filter((o) => list.includes(o.status)).reduce((s, o) => s + o.n, 0);
  const operators = db.prepare("SELECT name FROM users WHERE role = 'centre' AND centre_id = ? AND active = 1").all(c.id).map((u) => ({ display_name: shortName(u.name), role: 'Authorised centre operator' }));
  const productIds = db.prepare('SELECT DISTINCT product_id AS id FROM batches WHERE centre_id = ? AND public_share = 1 AND status != \'draft\'').all(c.id).map((r) => r.id);
  const permissions = productIds.length
    ? db.prepare(`SELECT name, permissions_note FROM products WHERE id IN (${productIds.map(() => '?').join(',')}) ORDER BY name`).all(...productIds)
      .map((p) => ({ product: p.name, note: p.permissions_note || 'No product-specific permission is recorded in this catalogue. Confirm with the local forest authority.' }))
    : [];
  const requirements = productIds.length
    ? db.prepare(`SELECT br.specs_json, p.name AS product_name FROM buyer_requirements br JOIN products p ON p.id = br.product_id
        WHERE br.status = 'active' AND br.product_id IN (${productIds.map(() => '?').join(',')})`).all(...productIds)
      .map((r) => ({ product: r.product_name, buyer: 'A registered buyer', specs: M.parse(r.specs_json, []).map((s) => ({ parameter: s.parameter, unit: s.unit, max: s.max ?? null, min: s.min ?? null })) }))
    : [];
  const saved = req.user && req.user.role === 'buyer'
    ? !!db.prepare("SELECT 1 FROM buyer_saved WHERE user_id = ? AND kind = 'centre' AND ref_id = ?").get(req.user.id, c.id)
    : false;
  res.json({
    centre: base,
    equipment: M.parse(c.equipment_json, []),
    facilities: M.parse(c.facilities_json, []),
    // Four different things that must never be blended into one "verified" claim.
    credentials: {
      government: {
        label: 'Government licence / registration',
        recorded: !!c.govt_registration,
        detail: c.govt_registration || 'No government licence or registration is recorded in this application for this centre.',
      },
      aranyavalue: { label: 'AranyaValue accreditation (private programme)', ...base.accreditation },
      product_permissions: permissions,
      buyer_requirements: requirements,
    },
    performance: {
      total: count(['verified', 'verified_with_limitations', 'pending_verification', 'submitted', 'needs_info', 'rejected', 'failed_checks', 'suspended', 'dispatched']),
      verified: count(['verified', 'verified_with_limitations']),
      pending: count(['pending_verification', 'submitted', 'needs_info']),
      rejected: count(['rejected', 'failed_checks']),
      suspended: count(['suspended']),
      note: 'Counts of public batches handled by this centre. They describe record outcomes, not the centre\'s overall quality.',
    },
    operators,
    inventory,
    history,
    buyer: { saved },
  });
});

/* ------------------------------------------------------------------ demo buyer access */

// One-click or any-non-empty-credentials access to the predefined Demo Buyer. It never creates
// an account, never reads the supplied values, and is switched off in production.
router.post('/demo-login', (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.DEMO_BUYER === 'off') {
    return res.status(403).json({ error: 'Demo buyer access is disabled on this deployment.' });
  }
  const body = req.body || {};
  const supplied = 'email' in body || 'password' in body;
  if (supplied && (!text(body.email, 200) || !text(body.password, 200))) {
    return res.status(400).json({ error: 'Enter an email and a password (any values work in demo mode), or use one-click Demo Buyer.' });
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'buyer' AND is_demo = 1 AND active = 1").get(DEMO_BUYER_ID);
  if (!user) return res.status(404).json({ error: 'The demo buyer account has not been seeded. Run the seed script.' });
  startSession(res, user);
  res.json({
    demo: true,
    notice: 'Signed in as the predefined Demo Buyer. Data on this account is sample data.',
    user: { id: user.id, name: user.name, email: user.email, role: user.role, organisation: user.organisation, is_demo: true },
  });
});

/* ------------------------------------------------------------------ buyer: saved + viewed + overview */

const buyerOnly = [requireAuth, requireRole('buyer')];

router.get('/my/overview', buyerOnly, (req, res) => {
  const id = req.user.id;
  const one = (sql, ...a) => db.prepare(sql).get(...a).c;
  res.json({
    enquiries: one('SELECT COUNT(*) AS c FROM enquiries WHERE buyer_user_id = ?', id),
    open_enquiries: one("SELECT COUNT(*) AS c FROM enquiries WHERE buyer_user_id = ? AND status IN ('open','negotiating')", id),
    awaiting_reply: one("SELECT COUNT(*) AS c FROM enquiries WHERE buyer_user_id = ? AND status = 'negotiating'", id),
    orders: one('SELECT COUNT(*) AS c FROM orders WHERE buyer_user_id = ?', id),
    active_orders: one("SELECT COUNT(*) AS c FROM orders WHERE buyer_user_id = ? AND status NOT IN ('delivered','cancelled')", id),
    saved_products: one("SELECT COUNT(*) AS c FROM buyer_saved WHERE user_id = ? AND kind = 'product'", id),
    saved_centres: one("SELECT COUNT(*) AS c FROM buyer_saved WHERE user_id = ? AND kind = 'centre'", id),
    verifications: one("SELECT COUNT(*) AS c FROM buyer_viewed WHERE user_id = ? AND kind = 'verify'", id),
    unread_notifications: one('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0', id),
  });
});

router.get('/my/saved', buyerOnly, (req, res) => {
  const rows = db.prepare('SELECT * FROM buyer_saved WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const products = rows.filter((r) => r.kind === 'product').map((r) => M.getListingRow(r.ref_id)).filter(Boolean).map(M.shapeCard);
  const centres = rows.filter((r) => r.kind === 'centre').map((r) => centreCard(r.ref_id)).filter(Boolean);
  res.json({ products, centres, keys: rows.map((r) => `${r.kind}:${r.ref_id}`) });
});

router.post('/my/saved', buyerOnly, (req, res) => {
  const kind = req.body && req.body.kind;
  const ref = text(req.body && req.body.ref_id, 60);
  if (!['product', 'centre'].includes(kind) || !ref) return res.status(400).json({ error: 'Choose a product or centre to save.' });
  const exists = kind === 'product' ? M.getListingRow(ref) : db.prepare('SELECT 1 FROM centres WHERE id = ?').get(ref);
  if (!exists) return res.status(404).json({ error: 'That item is not available.' });
  const key = kind === 'product' ? exists.batch_code : ref;
  db.prepare('INSERT OR IGNORE INTO buyer_saved (user_id, kind, ref_id, created_at) VALUES (?, ?, ?, ?)').run(req.user.id, kind, key, now());
  res.status(201).json({ ok: true, saved: true });
});

router.delete('/my/saved/:kind/:ref', buyerOnly, (req, res) => {
  db.prepare('DELETE FROM buyer_saved WHERE user_id = ? AND kind = ? AND ref_id = ?').run(req.user.id, req.params.kind, req.params.ref);
  res.json({ ok: true, saved: false });
});

router.get('/my/viewed', buyerOnly, (req, res) => {
  const kind = req.query.kind === 'verify' ? 'verify' : 'product';
  const rows = db.prepare(`SELECT ref_id, outcome, MAX(viewed_at) AS viewed_at FROM buyer_viewed WHERE user_id = ? AND kind = ?
    GROUP BY ref_id, outcome ORDER BY viewed_at DESC LIMIT 40`).all(req.user.id, kind);
  if (kind === 'product') {
    const seen = new Set();
    const items = [];
    for (const r of rows) {
      if (seen.has(r.ref_id)) continue;
      seen.add(r.ref_id);
      const row = M.getListingRow(r.ref_id);
      if (row) items.push({ ...M.shapeCard(row), viewed_at: r.viewed_at });
      if (items.length >= 12) break;
    }
    return res.json({ items });
  }
  const items = rows.map((r) => {
    const b = db.prepare('SELECT b.batch_code, b.status, p.name AS product FROM batches b JOIN products p ON p.id = b.product_id WHERE b.batch_code = ?').get(r.ref_id);
    const live = b ? M.primaryStatus(b.status) : null;
    return { code: r.ref_id, product: b ? b.product : null, outcome: r.outcome, status_when_checked: M.primaryStatus(r.outcome).label, current_status: live, viewed_at: r.viewed_at, found: !!b };
  });
  res.json({ items });
});

/* ------------------------------------------------------------------ buyer: enquiries */

const ENQUIRY_KINDS = ['enquiry', 'bulk_enquiry', 'purchase_request'];

function shapeEnquiry(e, { withMessages = false, seller = false } = {}) {
  const out = {
    id: e.id,
    kind: e.kind,
    status: e.status,
    batch_code: e.batch_code,
    product: e.product_name,
    district: e.district_name || null,
    centre: e.centre_name || null,
    quantity: e.quantity,
    unit: e.unit || e.batch_unit,
    intended_use: e.intended_use,
    delivery_location: e.delivery_location,
    message: e.message,
    indicative_price: e.indicative_price,
    counter_price: e.counter_price,
    order_id: e.order_id,
    batch_status: e.batch_status ? M.primaryStatus(e.batch_status) : null,
    available_qty: e.batch_id ? availableQty(e.batch_id) : null,
    is_demo: !!e.is_demo,
    created_at: e.created_at,
    updated_at: e.updated_at || e.created_at,
    responded_at: e.responded_at,
  };
  if (seller) out.buyer = { name: e.buyer_org || e.buyer_name, organisation: e.buyer_org || null };
  if (withMessages) {
    out.messages = db.prepare('SELECT id, sender_role, kind, body, counter_price, created_at FROM enquiry_messages WHERE enquiry_id = ? ORDER BY created_at').all(e.id)
      .map((m) => ({ ...m, from: m.sender_role === 'buyer' ? 'Buyer' : m.sender_role === 'system' ? 'System' : 'Seller' }));
  }
  return out;
}

const ENQ_SELECT = `
  SELECT e.*, b.batch_code, b.unit AS batch_unit, b.status AS batch_status, b.collector_id, b.centre_id, b.is_demo AS batch_demo,
         p.name AS product_name, d.name AS district_name, c.name AS centre_name, u.name AS buyer_name, u.organisation AS buyer_org
  FROM enquiries e
  JOIN batches b ON b.id = e.batch_id JOIN products p ON p.id = b.product_id
  JOIN districts d ON d.id = b.district_id LEFT JOIN centres c ON c.id = b.centre_id
  JOIN users u ON u.id = e.buyer_user_id`;

router.post('/enquiries', buyerOnly, (req, res) => {
  const body = req.body || {};
  const code = text(body.batch_code || body.batch_id, 60);
  const row = M.getListingRow(code);
  if (!row) return res.status(404).json({ error: 'That batch is not available in the marketplace.' });
  if (M.BLOCKED_FOR_ENQUIRY.includes(row.status)) {
    return res.status(409).json({ error: `This batch is ${M.primaryStatus(row.status).label.toLowerCase()} and cannot receive enquiries.` });
  }
  const kind = ENQUIRY_KINDS.includes(body.kind) ? body.kind : 'enquiry';
  const quantity = body.quantity === undefined || body.quantity === '' || body.quantity === null ? null : Number(body.quantity);
  if (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0)) return res.status(400).json({ error: 'Enter a quantity greater than zero.' });
  const available = availableQty(row.id);
  if (available <= 0) return res.status(409).json({ error: 'This batch has no quantity left to enquire about.' });
  if (kind === 'purchase_request') {
    if (quantity === null) return res.status(400).json({ error: 'Enter the quantity you want to buy.' });
    if (quantity > available) return res.status(400).json({ error: `Only ${available} ${row.unit} is available.` });
    if (row.min_order_qty && quantity < row.min_order_qty) return res.status(400).json({ error: `Minimum order for this batch is ${row.min_order_qty} ${row.unit}.` });
  } else if (quantity !== null && quantity > row.quantity) {
    return res.status(400).json({ error: `This batch only holds ${row.quantity} ${row.unit}.` });
  }
  const intendedUse = text(body.intended_use, 200);
  const delivery = text(body.delivery_location, 200);
  const message = text(body.message, 2000);
  if (!intendedUse) return res.status(400).json({ error: 'Say what you intend to use the produce for.' });
  if (kind !== 'enquiry' && !delivery) return res.status(400).json({ error: 'Add a delivery location.' });
  if (kind === 'enquiry' && !message && quantity === null) return res.status(400).json({ error: 'Write a message or enter a quantity.' });
  const openCount = db.prepare("SELECT COUNT(*) AS c FROM enquiries WHERE buyer_user_id = ? AND batch_id = ? AND status IN ('open','negotiating')").get(req.user.id, row.id).c;
  if (openCount >= 3) return res.status(429).json({ error: 'You already have several open enquiries on this batch. Wait for a reply first.' });

  const id = nid('EN');
  const ts = now();
  const summary = message || `${kind === 'purchase_request' ? 'Purchase request' : 'Enquiry'} for ${quantity ?? 'unspecified'} ${row.unit}`;
  db.transaction(() => {
    db.prepare(`INSERT INTO enquiries (id, batch_id, buyer_user_id, message, kind, status, created_at, quantity, unit, intended_use, delivery_location, indicative_price, is_demo, updated_at)
      VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, row.id, req.user.id, summary, kind, ts, quantity, row.unit, intendedUse, delivery || null, row.indicative_price ?? null, req.user.is_demo ? 1 : 0, ts);
    db.prepare("INSERT INTO enquiry_messages (id, enquiry_id, sender_id, sender_role, kind, body, created_at) VALUES (?, ?, ?, 'buyer', 'message', ?, ?)")
      .run(nid('EM'), id, req.user.id, summary, ts);
  })();
  appendEvent({ batch_id: row.id, event_type: 'ENQUIRY_RECORDED', actor: req.user.id, payload: { kind, enquiry_id: id } });
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(row.id);
  notifySellers(batch, {
    kind: 'market_enquiry',
    title: `${kind === 'purchase_request' ? 'Purchase request' : 'New enquiry'} for ${row.batch_code}`,
    body: `${req.user.organisation || 'A buyer'} asked about ${quantity ?? 'this batch'}${quantity ? ` ${row.unit}` : ''}. Open Marketplace Desk to respond.`,
    link: '/marketplace',
  });
  const created = db.prepare(`${ENQ_SELECT} WHERE e.id = ?`).get(id);
  res.status(201).json({ enquiry: shapeEnquiry(created, { withMessages: true }), notice: 'Enquiry sent to the collection centre. This is not a completed sale and no payment has been taken.' });
});

router.get('/my/enquiries', buyerOnly, (req, res) => {
  const rows = db.prepare(`${ENQ_SELECT} WHERE e.buyer_user_id = ? ORDER BY e.created_at DESC`).all(req.user.id);
  res.json({ enquiries: rows.map((e) => shapeEnquiry(e)) });
});

router.get('/my/enquiries/:id', buyerOnly, (req, res) => {
  const e = db.prepare(`${ENQ_SELECT} WHERE e.id = ? AND e.buyer_user_id = ?`).get(req.params.id, req.user.id);
  if (!e) return res.status(404).json({ error: 'Enquiry not found.' });
  res.json({ enquiry: shapeEnquiry(e, { withMessages: true }) });
});

router.post('/my/enquiries/:id/messages', buyerOnly, (req, res) => {
  const e = db.prepare(`${ENQ_SELECT} WHERE e.id = ? AND e.buyer_user_id = ?`).get(req.params.id, req.user.id);
  if (!e) return res.status(404).json({ error: 'Enquiry not found.' });
  if (!['open', 'negotiating'].includes(e.status)) return res.status(409).json({ error: 'This enquiry is closed.' });
  const body = text(req.body && req.body.body, 2000);
  if (!body) return res.status(400).json({ error: 'Write a message first.' });
  const ts = now();
  db.prepare("INSERT INTO enquiry_messages (id, enquiry_id, sender_id, sender_role, kind, body, created_at) VALUES (?, ?, ?, 'buyer', 'message', ?, ?)").run(nid('EM'), e.id, req.user.id, body, ts);
  db.prepare('UPDATE enquiries SET updated_at = ? WHERE id = ?').run(ts, e.id);
  notifySellers({ id: e.batch_id, collector_id: e.collector_id, centre_id: e.centre_id }, { kind: 'market_message', title: `Buyer replied on ${e.batch_code}`, body: body.slice(0, 160), link: '/marketplace' });
  res.status(201).json({ enquiry: shapeEnquiry(db.prepare(`${ENQ_SELECT} WHERE e.id = ?`).get(e.id), { withMessages: true }) });
});

router.post('/my/enquiries/:id/cancel', buyerOnly, (req, res) => {
  const e = db.prepare(`${ENQ_SELECT} WHERE e.id = ? AND e.buyer_user_id = ?`).get(req.params.id, req.user.id);
  if (!e) return res.status(404).json({ error: 'Enquiry not found.' });
  if (!['open', 'negotiating'].includes(e.status)) return res.status(409).json({ error: 'Only open enquiries can be cancelled.' });
  const ts = now();
  db.prepare("UPDATE enquiries SET status = 'cancelled', updated_at = ? WHERE id = ?").run(ts, e.id);
  db.prepare("INSERT INTO enquiry_messages (id, enquiry_id, sender_id, sender_role, kind, body, created_at) VALUES (?, ?, ?, 'system', 'status', 'Buyer cancelled this enquiry.', ?)").run(nid('EM'), e.id, req.user.id, ts);
  res.json({ ok: true, status: 'cancelled' });
});

// Order creation is the only place stock is reserved, so the check and the insert share one write lock.
function createOrder(enquiry, price, actorId) {
  return db.transaction(() => {
    const avail = availableQty(enquiry.batch_id);
    if (enquiry.quantity > avail) {
      const err = new Error(`Only ${avail} ${enquiry.unit} remains on this batch.`);
      err.statusCode = 409;
      throw err;
    }
    const orderId = nid('OR');
    const ts = now();
    db.prepare(`INSERT INTO orders (id, offer_id, buyer_user_id, batch_id, quantity, unit, agreed_price, currency, price_unit, status, payment_status, delivery_status, is_demo, created_at, enquiry_id, updated_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, 'INR', ?, 'confirmed', 'not_recorded', 'pending', ?, ?, ?, ?)`)
      .run(orderId, enquiry.buyer_user_id, enquiry.batch_id, enquiry.quantity, enquiry.unit, price, enquiry.unit, enquiry.is_demo ? 1 : 0, ts, enquiry.id, ts);
    db.prepare("UPDATE enquiries SET status = 'accepted', order_id = ?, updated_at = ?, responded_at = ?, responded_by = ? WHERE id = ?").run(orderId, ts, ts, actorId, enquiry.id);
    return orderId;
  }, { immediate: true })();
}

router.post('/my/enquiries/:id/accept-counter', buyerOnly, (req, res) => {
  const e = db.prepare(`${ENQ_SELECT} WHERE e.id = ? AND e.buyer_user_id = ?`).get(req.params.id, req.user.id);
  if (!e) return res.status(404).json({ error: 'Enquiry not found.' });
  if (e.status !== 'negotiating' || e.counter_price == null || !e.quantity) return res.status(409).json({ error: 'There is no seller offer to accept on this enquiry.' });
  if (M.BLOCKED_FOR_ENQUIRY.includes(e.batch_status)) return res.status(409).json({ error: 'This batch is no longer available.' });
  try {
    const orderId = createOrder(e, e.counter_price, req.user.id);
    const ts = now();
    db.prepare("INSERT INTO enquiry_messages (id, enquiry_id, sender_id, sender_role, kind, body, created_at) VALUES (?, ?, ?, 'system', 'status', ?, ?)")
      .run(nid('EM'), e.id, req.user.id, `Buyer accepted the seller's terms. Order ${orderId} created.`, ts);
    appendEvent({ batch_id: e.batch_id, event_type: 'ORDER_CONFIRMED', actor: req.user.id, payload: { order_id: orderId, enquiry_id: e.id } });
    notifySellers({ id: e.batch_id, collector_id: e.collector_id, centre_id: e.centre_id }, { kind: 'market_order', title: `Order ${orderId} confirmed`, body: `Buyer accepted your terms on ${e.batch_code}.`, link: '/marketplace' });
    res.json({ ok: true, order_id: orderId });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    throw err;
  }
});

/* ------------------------------------------------------------------ buyer: orders */

const ORDER_SELECT = `
  SELECT o.*, b.batch_code, b.collector_id, b.centre_id, p.name AS product_name, d.name AS district_name, c.name AS centre_name,
         u.name AS buyer_name, u.organisation AS buyer_org
  FROM orders o JOIN batches b ON b.id = o.batch_id JOIN products p ON p.id = b.product_id
  JOIN districts d ON d.id = b.district_id LEFT JOIN centres c ON c.id = b.centre_id JOIN users u ON u.id = o.buyer_user_id`;

const shapeOrder = (o, seller = false) => ({
  id: o.id, batch_code: o.batch_code, product: o.product_name, district: o.district_name, centre: o.centre_name || null,
  quantity: o.quantity, unit: o.unit, agreed_price: o.agreed_price, currency: o.currency, price_unit: o.price_unit,
  total: Math.round(o.quantity * o.agreed_price * 100) / 100,
  status: o.status, payment_status: o.payment_status, delivery_status: o.delivery_status,
  enquiry_id: o.enquiry_id || null, is_demo: !!o.is_demo, created_at: o.created_at, updated_at: o.updated_at || o.created_at,
  ...(seller ? { buyer: o.buyer_org || o.buyer_name } : {}),
  payment_note: 'No payment is processed in this prototype. Payment status is recorded manually and never simulated.',
});

router.get('/my/orders', buyerOnly, (req, res) => {
  res.json({ orders: db.prepare(`${ORDER_SELECT} WHERE o.buyer_user_id = ? ORDER BY o.created_at DESC`).all(req.user.id).map((o) => shapeOrder(o)) });
});

router.post('/my/orders/:id/cancel', buyerOnly, (req, res) => {
  const o = db.prepare(`${ORDER_SELECT} WHERE o.id = ? AND o.buyer_user_id = ?`).get(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  if (o.status !== 'confirmed') return res.status(409).json({ error: 'Only a confirmed order that has not been packed can be cancelled.' });
  db.prepare("UPDATE orders SET status = 'cancelled', delivery_status = 'cancelled', updated_at = ? WHERE id = ?").run(now(), o.id);
  appendEvent({ batch_id: o.batch_id, event_type: 'ORDER_CANCELLED', actor: req.user.id, payload: { order_id: o.id } });
  notifySellers({ id: o.batch_id, collector_id: o.collector_id, centre_id: o.centre_id }, { kind: 'market_order', title: `Order ${o.id} cancelled`, body: `Buyer cancelled the order on ${o.batch_code}.`, link: '/marketplace' });
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ seller desk (collector / centre / admin) */

const sellerOnly = [requireAuth, requireRole('collector', 'centre', 'admin')];

function sellerWhere(user, alias = 'b') {
  if (user.role === 'admin') return { sql: '1 = 1', args: [] };
  if (user.role === 'centre') return { sql: `${alias}.centre_id = ?`, args: [user.centre_id || ''] };
  return { sql: `${alias}.collector_id = ?`, args: [user.id] };
}

router.get('/seller/enquiries', sellerOnly, (req, res) => {
  const w = sellerWhere(req.user);
  const rows = db.prepare(`${ENQ_SELECT} WHERE ${w.sql} ORDER BY (e.status IN ('open','negotiating')) DESC, e.created_at DESC`).all(...w.args);
  res.json({ enquiries: rows.map((e) => shapeEnquiry(e, { withMessages: true, seller: true })) });
});

router.post('/seller/enquiries/:id/respond', sellerOnly, (req, res) => {
  const e = db.prepare(`${ENQ_SELECT} WHERE e.id = ?`).get(req.params.id);
  if (!e || !isSellerOf(req.user, e)) return res.status(404).json({ error: 'Enquiry not found.' });
  if (!['open', 'negotiating'].includes(e.status)) return res.status(409).json({ error: 'This enquiry is already closed.' });
  const body = req.body || {};
  const action = body.action;
  const note = text(body.message, 2000);
  const ts = now();
  const batchInfo = { id: e.batch_id, collector_id: e.collector_id, centre_id: e.centre_id };

  if (action === 'reject') {
    if (note.length < 5) return res.status(400).json({ error: 'Give the buyer a short reason (at least 5 characters).' });
    db.prepare("UPDATE enquiries SET status = 'rejected', updated_at = ?, responded_at = ?, responded_by = ? WHERE id = ?").run(ts, ts, req.user.id, e.id);
    db.prepare("INSERT INTO enquiry_messages (id, enquiry_id, sender_id, sender_role, kind, body, created_at) VALUES (?, ?, ?, ?, 'reject', ?, ?)").run(nid('EM'), e.id, req.user.id, req.user.role, note, ts);
    notify(e.buyer_user_id, { kind: 'market_enquiry', title: `Enquiry ${e.id} declined`, body: note.slice(0, 180), batch_id: e.batch_id, link: '/market/account/enquiries' });
    return res.json({ ok: true, status: 'rejected' });
  }

  if (action === 'negotiate') {
    const counter = body.counter_price === undefined || body.counter_price === '' ? null : Number(body.counter_price);
    if (counter !== null && (!Number.isFinite(counter) || counter <= 0)) return res.status(400).json({ error: 'Enter a price greater than zero.' });
    if (!note && counter === null) return res.status(400).json({ error: 'Add a message or a counter price.' });
    db.prepare("UPDATE enquiries SET status = 'negotiating', counter_price = COALESCE(?, counter_price), updated_at = ?, responded_at = ?, responded_by = ? WHERE id = ?").run(counter, ts, ts, req.user.id, e.id);
    db.prepare("INSERT INTO enquiry_messages (id, enquiry_id, sender_id, sender_role, kind, body, counter_price, created_at) VALUES (?, ?, ?, ?, 'counter', ?, ?, ?)")
      .run(nid('EM'), e.id, req.user.id, req.user.role, note || 'Seller proposed new terms.', counter, ts);
    notify(e.buyer_user_id, { kind: 'market_enquiry', title: `Seller replied on ${e.batch_code}`, body: counter ? `Proposed ₹${counter} per ${e.unit || e.batch_unit}. ${note}`.slice(0, 180) : note.slice(0, 180), batch_id: e.batch_id, link: '/market/account/enquiries' });
    return res.json({ ok: true, status: 'negotiating' });
  }

  if (action === 'accept') {
    if (!e.quantity) return res.status(400).json({ error: 'This enquiry has no quantity, so it cannot become an order. Ask the buyer for a quantity first.' });
    if (M.BLOCKED_FOR_ENQUIRY.includes(e.batch_status)) return res.status(409).json({ error: 'This batch is no longer available for sale.' });
    const price = body.agreed_price !== undefined && body.agreed_price !== '' ? Number(body.agreed_price) : (e.counter_price ?? e.indicative_price);
    if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ error: 'Set an agreed price before accepting.' });
    try {
      const orderId = createOrder(e, price, req.user.id);
      db.prepare("INSERT INTO enquiry_messages (id, enquiry_id, sender_id, sender_role, kind, body, counter_price, created_at) VALUES (?, ?, ?, ?, 'accept', ?, ?, ?)")
        .run(nid('EM'), e.id, req.user.id, req.user.role, note || `Accepted at ₹${price} per ${e.unit || e.batch_unit}. Order ${orderId} created.`, price, ts);
      appendEvent({ batch_id: e.batch_id, event_type: 'ORDER_CONFIRMED', actor: req.user.id, payload: { order_id: orderId, enquiry_id: e.id } });
      notify(e.buyer_user_id, { kind: 'market_order', title: `Order ${orderId} confirmed`, body: `${e.batch_code}: ${e.quantity} ${e.unit} at ₹${price}.`, batch_id: e.batch_id, link: '/market/account/orders' });
      return res.json({ ok: true, status: 'accepted', order_id: orderId });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      throw err;
    }
  }
  return res.status(400).json({ error: 'Choose accept, reject or negotiate.' });
});

router.get('/seller/orders', sellerOnly, (req, res) => {
  const w = sellerWhere(req.user);
  res.json({ orders: db.prepare(`${ORDER_SELECT} WHERE ${w.sql} ORDER BY o.created_at DESC`).all(...w.args).map((o) => shapeOrder(o, true)) });
});

const ORDER_FLOW = { confirmed: ['packed', 'cancelled'], packed: ['dispatched', 'cancelled'], dispatched: ['delivered'], delivered: [], cancelled: [] };

router.patch('/seller/orders/:id', sellerOnly, (req, res) => {
  const o = db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(req.params.id);
  if (!o || !isSellerOf(req.user, o)) return res.status(404).json({ error: 'Order not found.' });
  const next = req.body && req.body.status;
  if (!(ORDER_FLOW[o.status] || []).includes(next)) {
    return res.status(409).json({ error: `An order that is ${o.status} cannot move to ${next || 'that status'}.` });
  }
  const delivery = next === 'delivered' ? 'delivered' : next === 'dispatched' ? 'dispatched' : next === 'cancelled' ? 'cancelled' : 'pending';
  db.prepare('UPDATE orders SET status = ?, delivery_status = ?, updated_at = ? WHERE id = ?').run(next, delivery, now(), o.id);
  appendEvent({ batch_id: o.batch_id, event_type: next === 'dispatched' ? 'DISPATCH_RECORDED' : 'ORDER_UPDATED', actor: req.user.id, payload: { order_id: o.id, status: next } });
  notify(o.buyer_user_id, { kind: 'market_order', title: `Order ${o.id} is ${next}`, body: `${o.product_name} (${o.batch_code}) status updated.`, batch_id: o.batch_id, link: '/market/account/orders' });
  res.json({ ok: true, status: next });
});

router.get('/seller/listings', sellerOnly, (req, res) => {
  const w = sellerWhere(req.user);
  const rows = db.prepare(`
    SELECT b.id, b.batch_code, b.status, b.quantity, b.unit, b.public_share, b.is_demo, p.name AS product_name, d.name AS district_name,
           l.batch_id IS NOT NULL AS has_listing, l.listed, l.indicative_price, l.price_unit, l.min_order_qty, l.packaging, l.description, l.price_updated_at,
           MAX(0, b.quantity - COALESCE((SELECT SUM(o.quantity) FROM orders o WHERE o.batch_id = b.id AND o.status != 'cancelled'), 0)) AS available_qty
    FROM batches b JOIN products p ON p.id = b.product_id JOIN districts d ON d.id = b.district_id
    LEFT JOIN market_listings l ON l.batch_id = b.id
    WHERE ${w.sql} AND b.status != 'draft' ORDER BY b.updated_at DESC`).all(...w.args);
  res.json({
    listings: rows.map((r) => ({
      batch_code: r.batch_code, product: r.product_name, district: r.district_name, quantity: r.quantity, unit: r.unit, available_qty: r.available_qty,
      status: M.primaryStatus(r.status), has_listing: !!r.has_listing, listed: !!r.listed && !!r.public_share, public_share: !!r.public_share,
      indicative_price: r.indicative_price, price_unit: r.price_unit, min_order_qty: r.min_order_qty, packaging: r.packaging, description: r.description,
      price_updated_at: r.price_updated_at, is_demo: !!r.is_demo,
    })),
  });
});

router.put('/seller/listings/:code', sellerOnly, (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE batch_code = ? OR id = ?').get(String(req.params.code).toUpperCase(), req.params.code);
  if (!batch || !isSellerOf(req.user, batch)) return res.status(404).json({ error: 'Batch not found.' });
  if (batch.status === 'draft') return res.status(409).json({ error: 'Submit the batch for review before listing it.' });
  const body = req.body || {};
  const listed = body.listed === false ? 0 : 1;
  let price = null;
  if (body.indicative_price !== undefined && body.indicative_price !== '' && body.indicative_price !== null) {
    price = Number(body.indicative_price);
    if (!Number.isFinite(price) || price <= 0 || price > 10000000) return res.status(400).json({ error: 'Enter a price between 0 and 1,00,00,000.' });
  }
  let minQty = null;
  if (body.min_order_qty !== undefined && body.min_order_qty !== '' && body.min_order_qty !== null) {
    minQty = Number(body.min_order_qty);
    if (!Number.isFinite(minQty) || minQty <= 0 || minQty > batch.quantity) return res.status(400).json({ error: `Minimum order must be between 0 and ${batch.quantity} ${batch.unit}.` });
  }
  const ts = now();
  const existing = db.prepare('SELECT * FROM market_listings WHERE batch_id = ?').get(batch.id);
  const priceChanged = price !== null && (!existing || existing.indicative_price !== price);
  db.transaction(() => {
    if (existing) {
      db.prepare(`UPDATE market_listings SET listed = ?, indicative_price = ?, price_unit = ?, price_updated_at = ?, min_order_qty = ?, packaging = ?, description = ?, updated_at = ?, updated_by = ? WHERE batch_id = ?`)
        .run(listed, price, price === null ? null : batch.unit, priceChanged ? ts : existing.price_updated_at, minQty, text(body.packaging, 200) || null, text(body.description, 1200) || null, ts, req.user.id, batch.id);
    } else {
      db.prepare(`INSERT INTO market_listings (batch_id, listed, indicative_price, price_unit, price_updated_at, min_order_qty, packaging, description, images_json, is_demo, created_at, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', 0, ?, ?, ?)`)
        .run(batch.id, listed, price, price === null ? null : batch.unit, price === null ? null : ts, minQty, text(body.packaging, 200) || null, text(body.description, 1200) || null, ts, ts, req.user.id);
    }
    // Listing a batch publicly means its passport must be publicly viewable too.
    if (listed && !batch.public_share) db.prepare('UPDATE batches SET public_share = 1, updated_at = ? WHERE id = ?').run(ts, batch.id);
  })();
  res.json({ ok: true, listed: !!listed });
});

module.exports = router;
