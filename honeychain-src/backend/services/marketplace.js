/**
 * Marketplace read-model. The storefront never owns batch data: every status, quantity,
 * centre and verification attribute below is derived from the shared `batches`,
 * `verifications`, `measurements` and `inspection_records` tables, so an officer decision
 * is reflected on the very next request.
 */
const db = require('../db/db');

const parse = (value, fallback) => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

/* ------------------------------------------------------------------ status model */

// One primary status per batch (backend-authoritative) ...
const PRIMARY = {
  submitted: { key: 'submitted', label: 'Submitted', tone: 'blue' },
  pending_verification: { key: 'pending_review', label: 'Pending Officer Review', tone: 'amber' },
  needs_info: { key: 'under_review', label: 'Under Review', tone: 'amber' },
  verified: { key: 'verified', label: 'Verified by Officer', tone: 'green' },
  verified_with_limitations: { key: 'verified', label: 'Verified by Officer', tone: 'green', note: 'With limitations' },
  rejected: { key: 'rejected', label: 'Rejected', tone: 'red' },
  failed_checks: { key: 'rejected', label: 'Rejected', tone: 'red' },
  suspended: { key: 'suspended', label: 'Suspended', tone: 'red' },
  dispatched: { key: 'dispatched', label: 'Dispatched', tone: 'gray' },
};

// ... plus independent evidence attributes. Centre checks, lab tests and officer
// verification are never merged into one badge.
const FILTER_STATUSES = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'centre_checked', label: 'Centre Checked' },
  { key: 'pending_review', label: 'Pending Officer Review' },
  { key: 'verified', label: 'Verified by Officer' },
  { key: 'lab_tested', label: 'Lab Tested' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
];

const HIDDEN_BY_DEFAULT = ['rejected', 'failed_checks', 'suspended', 'dispatched'];
const BLOCKED_FOR_ENQUIRY = ['rejected', 'failed_checks', 'suspended', 'dispatched', 'draft'];

const ACCREDITATION = {
  active: { key: 'active', label: 'AranyaValue accredited', tone: 'green' },
  suspended: { key: 'suspended', label: 'Accreditation suspended', tone: 'red' },
  expired: { key: 'expired', label: 'Accreditation expired', tone: 'amber' },
  none: { key: 'none', label: 'Not accredited', tone: 'gray' },
};

function primaryStatus(status) {
  return PRIMARY[status] || { key: status, label: String(status || 'Unknown').replaceAll('_', ' '), tone: 'gray' };
}

function accreditation(row) {
  const base = ACCREDITATION[row.accreditation_status] || ACCREDITATION.none;
  return {
    ...base,
    note: row.accreditation_note || null,
    updated_at: row.accreditation_updated_at || null,
    // This is AranyaValue's own programme. It is never a government licence.
    issuer: 'AranyaValue (private programme)',
    is_government_licence: false,
  };
}

// A centre only earns a "verified centre" mark while the accreditation is active and the centre itself is active.
function isVerifiedCentre(row) {
  return row.accreditation_status === 'active' && (row.centre_status || row.status || 'active') === 'active';
}

function badgesFor(primary, flags) {
  const out = [];
  if (flags.centre_checked) out.push({ key: 'centre_checked', label: 'Centre Checked', tone: 'sage' });
  if (flags.lab_tested) out.push({ key: 'lab_tested', label: 'Lab Tested', tone: 'blue' });
  return [{ key: primary.key, label: primary.label, tone: primary.tone, note: primary.note || null }, ...out];
}

function warningFor(status) {
  if (status === 'suspended') {
    return { level: 'danger', title: 'This batch is suspended', text: 'An authorised officer has suspended this batch. Do not rely on earlier quality information or buy against it until it is reinstated.' };
  }
  if (status === 'rejected' || status === 'failed_checks') {
    return { level: 'danger', title: 'This batch was rejected', text: 'An authorised officer rejected this batch during review. It is not available for purchase.' };
  }
  if (status === 'needs_info') {
    return { level: 'warning', title: 'This batch is under review', text: 'The reviewing officer asked the collector for corrections. Quality information may change.' };
  }
  if (status === 'dispatched') {
    return { level: 'info', title: 'This batch has been dispatched', text: 'The batch is no longer held at the collection centre.' };
  }
  return null;
}

/* ------------------------------------------------------------------ listing queries */

const ATTR_SQL = `
  EXISTS(SELECT 1 FROM measurements m JOIN users mu ON mu.id = m.recorded_by
         WHERE m.batch_id = b.id AND m.evidence_source = 'measured' AND mu.role = 'centre') AS centre_checked,
  EXISTS(SELECT 1 FROM inspection_records i WHERE i.batch_id = b.id AND i.evidence_source = 'laboratory') AS lab_tested,
  (SELECT MAX(v.created_at) FROM verifications v WHERE v.batch_id = b.id AND v.status IN ('verified', 'verified_with_limitations')) AS last_verified_at
`;

const LISTING_SELECT = `
  SELECT b.id, b.batch_code, b.status, b.quantity, b.unit, b.collection_date, b.created_at, b.updated_at, b.is_demo,
         b.grade_label, b.local_name, b.collection_area, b.block_name, b.state_id, b.district_id,
         p.id AS product_id, p.name AS product_name, p.local_names, p.species_name, p.category AS product_category,
         p.image AS product_image, p.season, p.permissions_note,
         mc.id AS mc_id, mc.slug AS mc_slug, mc.name AS mc_name, mc.image AS mc_image,
         s.name AS state_name, d.name AS district_name,
         c.id AS centre_id, c.name AS centre_name, c.accreditation_status, c.accreditation_note, c.accreditation_updated_at,
         c.status AS centre_status, c.is_demo AS centre_demo,
         l.indicative_price, l.price_unit, l.price_updated_at, l.min_order_qty, l.packaging,
         l.images_json, l.description AS listing_description, l.is_demo AS listing_demo, l.created_at AS listed_at,
         MAX(0, b.quantity - COALESCE((SELECT SUM(o.quantity) FROM orders o WHERE o.batch_id = b.id AND o.status != 'cancelled'), 0)) AS available_qty,
         ${ATTR_SQL}
  FROM batches b
  JOIN market_listings l ON l.batch_id = b.id AND l.listed = 1
  JOIN products p ON p.id = b.product_id
  LEFT JOIN market_categories mc ON mc.id = p.market_category_id
  JOIN states s ON s.id = b.state_id
  JOIN districts d ON d.id = b.district_id
  LEFT JOIN centres c ON c.id = b.centre_id
`;

const PUBLIC_WHERE = "b.public_share = 1 AND b.status != 'draft'";

function resolveImages(row) {
  const one = row.product_image || parse(row.images_json, []).filter(Boolean)[0] || row.mc_image || null;
  return one ? [one] : [];
}

function priceBlock(row) {
  if (row.indicative_price == null) return null;
  const demo = !!(row.listing_demo || row.is_demo);
  return {
    amount: row.indicative_price,
    unit: row.price_unit || row.unit,
    currency: 'INR',
    updated_at: row.price_updated_at || null,
    illustrative: demo,
    label: demo
      ? 'Indicative price · illustrative demo figure, not a market rate'
      : 'Indicative price set by the seller · not a final purchase price',
  };
}

function shapeCard(row) {
  const primary = primaryStatus(row.status);
  const flags = {
    centre_checked: !!row.centre_checked,
    lab_tested: !!row.lab_tested,
    officer_verified: ['verified', 'verified_with_limitations'].includes(row.status),
  };
  const images = resolveImages(row);
  const available = Math.round((row.available_qty ?? row.quantity) * 100) / 100;
  const names = parse(row.local_names, {});
  return {
    id: row.id,
    code: row.batch_code,
    title: row.product_name,
    product: {
      id: row.product_id,
      name: row.product_name,
      local_names: names,
      scientific_name: row.species_name || null,
      category: row.product_category,
      market_category: row.mc_id ? { id: row.mc_id, slug: row.mc_slug, name: row.mc_name } : null,
      season: row.season || null,
    },
    local_name: row.local_name || null,
    grade_label: row.grade_label || null,
    image: images[0] || null,
    images,
    district: { id: row.district_id, name: row.district_name },
    state: { id: row.state_id, name: row.state_name },
    centre: row.centre_id
      ? { id: row.centre_id, name: row.centre_name, accreditation: accreditation(row), verified_centre: isVerifiedCentre(row), is_demo: !!row.centre_demo }
      : null,
    quantity: row.quantity,
    available_qty: available,
    unit: row.unit,
    price: priceBlock(row),
    min_order_qty: row.min_order_qty ?? null,
    packaging: row.packaging || null,
    status: { key: primary.key, label: primary.label, tone: primary.tone, note: primary.note || null, raw: row.status },
    badges: badgesFor(primary, flags),
    flags,
    last_verified_at: row.last_verified_at || null,
    collection_date: row.collection_date,
    listed_at: row.listed_at,
    is_demo: !!(row.is_demo || row.listing_demo),
    can_enquire: !BLOCKED_FOR_ENQUIRY.includes(row.status) && available > 0,
  };
}

const SORTS = {
  recent: 'l.created_at DESC, b.created_at DESC',
  price_asc: 'CASE WHEN l.indicative_price IS NULL THEN 1 ELSE 0 END, l.indicative_price ASC',
  price_desc: 'CASE WHEN l.indicative_price IS NULL THEN 1 ELSE 0 END, l.indicative_price DESC',
  quantity: 'available_qty DESC',
  verified: 'CASE WHEN last_verified_at IS NULL THEN 1 ELSE 0 END, last_verified_at DESC',
};

function num(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildFilters(query) {
  const where = [PUBLIC_WHERE];
  const args = [];
  const q = String(query.q || '').trim().slice(0, 80);
  if (q) {
    const like = `%${q}%`;
    const parts = [
      'b.batch_code LIKE ?', 'p.name LIKE ?', 'p.local_names LIKE ?', 'p.species_name LIKE ?', 'p.category LIKE ?',
      'mc.name LIKE ?', 'c.name LIKE ?', 'd.name LIKE ?', 'b.local_name LIKE ?',
    ];
    args.push(like, like, like, like, like, like, like, like, like);
    if (/^\d+(\.\d+)?$/.test(q)) {
      parts.push('(b.quantity - COALESCE((SELECT SUM(o.quantity) FROM orders o WHERE o.batch_id = b.id AND o.status != \'cancelled\'), 0)) >= ?');
      args.push(Number(q));
    }
    where.push(`(${parts.join(' OR ')})`);
  }
  if (query.category) { where.push('(mc.slug = ? OR mc.id = ?)'); args.push(query.category, query.category); }
  if (query.product) { where.push('p.id = ?'); args.push(query.product); }
  if (query.state) { where.push('b.state_id = ?'); args.push(query.state); }
  if (query.district) { where.push('(b.district_id = ? OR d.name = ?)'); args.push(query.district, query.district); }
  if (query.centre) { where.push('b.centre_id = ?'); args.push(query.centre); }
  const min = num(query.min_price);
  const max = num(query.max_price);
  if (min != null) { where.push('l.indicative_price >= ?'); args.push(min); }
  if (max != null) { where.push('l.indicative_price <= ?'); args.push(max); }
  const minQty = num(query.min_qty);
  if (minQty != null) {
    where.push('(b.quantity - COALESCE((SELECT SUM(o.quantity) FROM orders o WHERE o.batch_id = b.id AND o.status != \'cancelled\'), 0)) >= ?');
    args.push(minQty);
  }
  if (query.accreditation && ACCREDITATION[query.accreditation]) { where.push('COALESCE(c.accreditation_status, \'none\') = ?'); args.push(query.accreditation); }
  if (query.lab === '1' || query.lab === 'true') where.push("EXISTS(SELECT 1 FROM inspection_records i WHERE i.batch_id = b.id AND i.evidence_source = 'laboratory')");
  if (query.officer === '1' || query.officer === 'true') where.push("b.status IN ('verified', 'verified_with_limitations')");

  const status = String(query.status || '');
  if (status === 'centre_checked') where.push("EXISTS(SELECT 1 FROM measurements m JOIN users mu ON mu.id = m.recorded_by WHERE m.batch_id = b.id AND m.evidence_source = 'measured' AND mu.role = 'centre')");
  else if (status === 'lab_tested') where.push("EXISTS(SELECT 1 FROM inspection_records i WHERE i.batch_id = b.id AND i.evidence_source = 'laboratory')");
  else if (status) {
    const raw = Object.entries(PRIMARY).filter(([, v]) => v.key === status).map(([k]) => k);
    if (raw.length) { where.push(`b.status IN (${raw.map(() => '?').join(',')})`); args.push(...raw); }
    else where.push('1 = 0');
  } else {
    // Rejected / suspended / dispatched batches stay reachable by code or QR but are not browsable by default.
    where.push(`b.status NOT IN (${HIDDEN_BY_DEFAULT.map(() => '?').join(',')})`);
    args.push(...HIDDEN_BY_DEFAULT);
  }
  return { where: where.join(' AND '), args };
}

function searchListings(query) {
  const { where, args } = buildFilters(query);
  const sort = SORTS[query.sort] || SORTS.recent;
  const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 48);
  const page = Math.max(Number(query.page) || 1, 1);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM (${LISTING_SELECT} WHERE ${where})`).get(...args).c;
  const rows = db.prepare(`${LISTING_SELECT} WHERE ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`).all(...args, limit, (page - 1) * limit);
  return { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), listings: rows.map(shapeCard) };
}

function getListingRow(codeOrId) {
  return db.prepare(`${LISTING_SELECT} WHERE (b.batch_code = ? OR b.id = ?) AND ${PUBLIC_WHERE}`).get(String(codeOrId).toUpperCase(), codeOrId);
}

/* ------------------------------------------------------------------ quality parameters */

const SOURCE_TYPES = {
  producer_reported: { label: 'Producer-reported', rank: 1 },
  centre_checked: { label: 'Collection-centre checked', rank: 2 },
  instrument_measured: { label: 'Instrument-measured', rank: 3 },
  laboratory_tested: { label: 'Laboratory-tested', rank: 4 },
  officer_verified: { label: 'Government officer verified', rank: 5 },
  imported: { label: 'Imported record', rank: 0 },
  simulated: { label: 'Simulated demo value', rank: 0 },
};

const INSTRUMENT_WORDS = /meter|instrument|scale|refractometer|balance|probe|sensor/i;

function userRoles(ids) {
  const out = {};
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return out;
  const rows = db.prepare(`SELECT id, role, centre_id FROM users WHERE id IN (${unique.map(() => '?').join(',')})`).all(...unique);
  for (const r of rows) out[r.id] = r;
  return out;
}

function standardFor(param) {
  const src = param && param.source_name;
  if (!src || /^not configured/i.test(src)) return null;
  return src;
}

/**
 * Builds the quality table from real rows only. Producer-reported, centre-checked,
 * instrument, laboratory and officer evidence stay in separate categories; nothing is
 * promoted to a stronger category than the stored evidence_source supports.
 */
function buildQuality(ctx, centreName) {
  const roles = userRoles(ctx.measurements.map((m) => m.recorded_by));
  const paramByName = new Map(ctx.parameters.map((p) => [String(p.name).toLowerCase(), p]));
  const rows = [];

  for (const m of ctx.measurements) {
    if (m.evidence_source === 'unavailable') continue;
    const role = roles[m.recorded_by] ? roles[m.recorded_by].role : null;
    let type = 'producer_reported';
    let verifier = 'Collector (self-reported)';
    if (m.evidence_source === 'imported') { type = 'imported'; verifier = 'Imported record'; }
    else if (m.evidence_source === 'simulated') { type = 'simulated'; verifier = 'Not a real measurement'; }
    else if (m.evidence_source === 'measured') {
      if (role === 'centre') { type = 'centre_checked'; verifier = centreName ? `${centreName} (collection centre)` : 'Collection centre'; }
      else if (role === 'inspector' || role === 'admin') { type = 'officer_verified'; verifier = 'Authorised officer'; }
      else if (INSTRUMENT_WORDS.test(m.method || '') || INSTRUMENT_WORDS.test(m.notes || '')) { type = 'instrument_measured'; verifier = 'Collector with instrument'; }
      else { type = 'producer_reported'; verifier = 'Collector (self-reported)'; }
    }
    const param = paramByName.get(String(m.parameter_name).toLowerCase());
    rows.push({
      id: m.id,
      parameter: m.parameter_name,
      value: m.value,
      text_value: m.text_value,
      unit: m.unit,
      method: m.method || null,
      date: m.measured_at || m.created_at,
      source_type: type,
      source_label: SOURCE_TYPES[type].label,
      verifier,
      standard: standardFor(param),
      officer_confirmed: !!m.verified && (role === 'inspector' || role === 'admin'),
      note: m.notes || null,
    });
  }

  const inspections = ctx.inspections || [];
  const superseded = new Set(inspections.map((r) => r.supersedes_id).filter(Boolean));
  for (const r of inspections) {
    if (superseded.has(r.id)) continue;
    const type = r.evidence_source === 'laboratory' ? 'laboratory_tested' : r.evidence_source === 'instrument' ? 'instrument_measured' : 'officer_verified';
    rows.push({
      id: r.id,
      parameter: r.parameter_name,
      value: r.value,
      text_value: r.text_value,
      unit: r.unit,
      method: r.method || null,
      date: r.tested_on || r.created_at,
      source_type: type,
      source_label: SOURCE_TYPES[type].label,
      verifier: type === 'laboratory_tested'
        ? (r.lab_report_ref ? `Laboratory report ${r.lab_report_ref}` : 'Laboratory (report reference not recorded)')
        : 'Authorised officer',
      standard: r.reference_standard || standardFor(paramByName.get(String(r.parameter_name).toLowerCase())),
      officer_confirmed: type === 'officer_verified' || type === 'instrument_measured',
      lab_report_ref: r.lab_report_ref || null,
      note: r.remarks || null,
    });
  }
  return rows.sort((a, b) => String(a.parameter).localeCompare(String(b.parameter)) || SOURCE_TYPES[b.source_type].rank - SOURCE_TYPES[a.source_type].rank);
}

function buildConditions(ctx, centreName) {
  const roles = userRoles(ctx.handling.map((h) => h.recorded_by));
  const find = (kind) => ctx.handling.filter((h) => h.kind === kind).at(-1);
  const make = (label, h) => {
    if (!h) return { label, value: null, source_label: null };
    const role = roles[h.recorded_by] ? roles[h.recorded_by].role : null;
    const byCentre = role === 'centre';
    return {
      label,
      value: [h.method, h.location].filter(Boolean).join(' · ') || null,
      date: h.end_date || h.start_date || h.created_at,
      source_type: byCentre ? 'centre_checked' : 'producer_reported',
      source_label: byCentre ? SOURCE_TYPES.centre_checked.label : SOURCE_TYPES.producer_reported.label,
      verifier: byCentre ? (centreName || 'Collection centre') : 'Collector (self-reported)',
    };
  };
  const appearance = ctx.measurements.filter((m) => /appearance|colour|color/i.test(m.parameter_name) && m.text_value).at(-1);
  return [
    appearance
      ? { label: 'Appearance', value: appearance.text_value, date: appearance.measured_at, source_type: 'producer_reported', source_label: SOURCE_TYPES.producer_reported.label, verifier: 'Collector (self-reported)' }
      : { label: 'Appearance', value: null, source_label: null },
    make('Storage condition', find('storage')),
    make('Packaging condition', find('packaging')),
    make('Drying / processing', find('drying') || find('processing')),
  ];
}

/* ------------------------------------------------------------------ public history */

const PUBLIC_EVENTS = {
  BATCH_CREATED: 'Batch record created',
  ASSESSMENT_SUBMITTED: 'Submitted for officer review',
  HANDLING_RECORDED: 'Handling step recorded',
  MEASUREMENT_RECORDED: 'Quality reading recorded',
  PROCESSING_RECORDED: 'Processing recorded at centre',
  PASSPORT_GENERATED: 'Quality passport generated',
  REJECTION_RECORDED: 'Rejection recorded',
  DISPATCH_RECORDED: 'Dispatch recorded',
  BATCH_SUSPENDED: 'Batch suspended by an officer',
  BATCH_REINSTATED: 'Batch reinstated for review',
  INSPECTION_RECORDED: 'Officer quality inspection recorded',
};

function roleLabel(role) {
  if (role === 'inspector' || role === 'admin') return 'Authorised officer';
  if (role === 'centre') return 'Collection centre';
  if (role === 'collector') return 'Collector';
  if (role === 'buyer') return 'Buyer';
  return 'System';
}

function buildHistory(ctx) {
  const roles = userRoles(ctx.events.map((e) => e.actor));
  const out = [];
  for (const e of ctx.events) {
    const role = roles[e.actor] ? roles[e.actor].role : null;
    if (e.event_type === 'ASSESSMENT_REVIEWED') {
      const st = primaryStatus(e.payload && e.payload.status);
      out.push({ at: e.timestamp, type: 'officer_review', label: `Officer decision: ${st.label}`, tone: st.tone, actor: roleLabel(role), seq: e.seq });
    } else if (PUBLIC_EVENTS[e.event_type]) {
      const tone = /SUSPEND|REJECT/.test(e.event_type) ? 'red' : /VERIFIED|REINSTATED/.test(e.event_type) ? 'green' : 'gray';
      out.push({ at: e.timestamp, type: e.event_type.toLowerCase(), label: PUBLIC_EVENTS[e.event_type], tone, actor: roleLabel(role), seq: e.seq });
    }
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)) || b.seq - a.seq);
}

function publicDocuments(ctx) {
  return ctx.evidence
    .filter((e) => e.visibility === 'public' && e.stored_name)
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      label: e.label || e.filename || 'Document',
      mime: e.mime,
      is_image: !!(e.mime && e.mime.startsWith('image/')),
      is_lab_report: /lab/i.test(`${e.kind} ${e.label || ''}`),
      url: `/api/evidence/${e.id}`,
      created_at: e.created_at,
    }));
}

module.exports = {
  parse, FILTER_STATUSES, SOURCE_TYPES, PRIMARY, BLOCKED_FOR_ENQUIRY, HIDDEN_BY_DEFAULT,
  primaryStatus, accreditation, isVerifiedCentre, badgesFor, warningFor, priceBlock, resolveImages,
  LISTING_SELECT, PUBLIC_WHERE, shapeCard, searchListings, getListingRow,
  buildQuality, buildConditions, buildHistory, publicDocuments, userRoles, roleLabel,
};
