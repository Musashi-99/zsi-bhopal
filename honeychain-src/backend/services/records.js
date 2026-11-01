const db = require('../db/db');
const { getEventsForBatch } = require('./ledger');
const { buildIntelligence } = require('./intelligence');

function parse(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function loadBatchRow(idOrCode) {
  return db.prepare(`
    SELECT b.*, p.name AS product_name, p.category, p.local_names, p.species_name, p.description AS product_description,
           p.default_unit, p.units_json, p.handling_json, p.is_active AS product_active,
           s.name AS state_name, s.code AS state_code, d.name AS district_name,
           c.name AS centre_name, u.name AS collector_name, u.email AS collector_email, u.phone AS collector_phone
    FROM batches b
    JOIN products p ON p.id = b.product_id
    JOIN states s ON s.id = b.state_id
    JOIN districts d ON d.id = b.district_id
    JOIN users u ON u.id = b.collector_id
    LEFT JOIN centres c ON c.id = b.centre_id
    WHERE b.id = ? OR b.batch_code = ?
  `).get(idOrCode, idOrCode);
}

function loadContext(idOrCode) {
  const batch = loadBatchRow(idOrCode);
  if (!batch) return null;
  const product = {
    id: batch.product_id,
    name: batch.product_name,
    category: batch.category,
    local_names: parse(batch.local_names, {}),
    handling_json: batch.handling_json,
    description: batch.product_description,
    species_name: batch.species_name,
  };
  const parameters = db.prepare(`
    SELECT qp.*, prof.name AS profile_name, prof.version AS profile_version, prof.source_name AS profile_source,
           prof.source_url AS profile_source_url, prof.notes AS profile_notes, prof.illustrative AS profile_illustrative,
           prof.effective_date
    FROM quality_parameters qp
    JOIN quality_profiles prof ON prof.id = qp.profile_id
    WHERE prof.product_id = ?
    ORDER BY qp.sort_order, qp.name
  `).all(batch.product_id);
  const measurements = db.prepare('SELECT * FROM measurements WHERE batch_id = ? ORDER BY created_at').all(batch.id);
  const handling = db.prepare('SELECT * FROM handling_records WHERE batch_id = ? ORDER BY created_at').all(batch.id);
  const evidence = db.prepare('SELECT * FROM evidence WHERE batch_id = ? ORDER BY created_at').all(batch.id);
  const verifications = db.prepare(`
    SELECT v.*, u.name AS inspector_name FROM verifications v
    LEFT JOIN users u ON u.id = v.inspector_id
    WHERE v.batch_id = ? ORDER BY v.created_at
  `).all(batch.id);
  const rejections = db.prepare(`
    SELECT r.*, u.name AS actor_name, u.role AS actor_role
    FROM rejections r JOIN users u ON u.id = r.actor_id
    WHERE r.batch_id = ? ORDER BY r.created_at
  `).all(batch.id);
  const requirements = db.prepare(`
    SELECT br.*, u.name AS buyer_name, u.organisation
    FROM buyer_requirements br JOIN users u ON u.id = br.buyer_user_id
    WHERE br.product_id = ?
  `).all(batch.product_id);
  const offers = db.prepare(`
    SELECT o.*, u.name AS buyer_name, u.organisation
    FROM offers o JOIN users u ON u.id = o.buyer_user_id
    WHERE o.batch_id = ? ORDER BY o.created_at
  `).all(batch.id);
  const events = getEventsForBatch(batch.id);
  const intelligence = buildIntelligence({ batch, product, parameters, measurements, requirements, offers, handling, evidence });
  return { batch, product, parameters, measurements, handling, evidence, verifications, rejections, requirements, offers, events, intelligence };
}

function canRead(user, batch) {
  if (!batch) return false;
  if (!user) return !!batch.public_share && batch.status !== 'draft';
  if (user.role === 'admin') return true;
  if (user.role === 'inspector') return batch.status !== 'draft';
  if (user.role === 'collector') return batch.collector_id === user.id;
  if (user.role === 'centre') return batch.centre_id && batch.centre_id === user.centre_id;
  if (user.role === 'buyer') return !!batch.public_share && batch.status !== 'draft';
  return false;
}

function actorRole(actorId) {
  if (!actorId) return 'system';
  const row = db.prepare('SELECT role FROM users WHERE id = ?').get(actorId);
  return row ? row.role : 'recorded user';
}

function actorName(actorId) {
  if (!actorId) return 'System';
  const row = db.prepare('SELECT name, role FROM users WHERE id = ?').get(actorId);
  return row ? row.name : 'Recorded user';
}

function publicEvents(events) {
  return events.map((event) => ({
    id: event.id,
    seq: event.seq,
    event_type: event.event_type,
    timestamp: event.timestamp,
    actor_role: actorRole(event.actor),
    hash: event.hash,
    prev_hash: event.prev_hash,
  }));
}

function shapePassport(ctx, viewer) {
  const { batch } = ctx;
  const owner = viewer && (
    viewer.role === 'admin'
    || viewer.role === 'inspector'
    || (viewer.role === 'collector' && viewer.id === batch.collector_id)
    || (viewer.role === 'centre' && viewer.centre_id === batch.centre_id)
  );
  const buyer = viewer && viewer.role === 'buyer';
  const evidence = ctx.evidence
    .filter((item) => owner || item.visibility === 'public')
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      label: item.label,
      filename: item.visibility === 'public' || owner ? item.filename : null,
      mime: item.mime,
      visibility: item.visibility,
      note: item.visibility === 'public' || owner ? item.note : null,
      created_at: item.created_at,
      download: item.stored_name && (item.visibility === 'public' || owner) ? `/api/evidence/${item.id}` : null,
    }));
  const privateCount = ctx.evidence.filter((item) => item.visibility !== 'public').length;
  let offers = [];
  if (owner) offers = ctx.offers;
  else if (buyer) offers = ctx.offers.filter((offer) => offer.buyer_user_id === viewer.id);

  return {
    batch_code: batch.batch_code,
    id: batch.id,
    product_id: batch.product_id,
    product: batch.product_name,
    category: batch.category,
    local_names: ctx.product.local_names,
    local_name: batch.local_name,
    variety: batch.variety,
    grade_label: batch.grade_label,
    quantity: batch.quantity,
    unit: batch.unit,
    collection_date: batch.collection_date,
    collection_area: batch.collection_area,
    block_name: batch.block_name,
    district: batch.district_name,
    state: batch.state_name,
    collection_method: batch.collection_method,
    source_type: batch.source_type,
    source_statement: 'Source declared; independent verification unavailable.',
    source_declaration: owner || buyer ? batch.source_declaration : null,
    collector: owner
      ? { name: batch.collector_name, email: batch.collector_email, phone: batch.collector_phone }
      : buyer
        ? { name: batch.collector_name, district: batch.district_name }
        : { name: null, public_label: `A registered collector in ${batch.district_name}` },
    centre: batch.centre_name || null,
    status: batch.status,
    is_demo: !!batch.is_demo,
    handling: ctx.handling,
    measurements: ctx.measurements.map((m) => ({
      id: m.id,
      parameter: m.parameter_name,
      value: m.value,
      text_value: m.text_value,
      unit: m.unit,
      measured_at: m.measured_at,
      method: m.method,
      evidence_source: m.evidence_source,
      verified: !!m.verified,
      notes: owner ? m.notes : (m.evidence_source === 'self_reported' ? m.notes : m.notes),
    })),
    verifications: ctx.verifications.map((v) => ({
      id: v.id,
      status: v.status,
      summary: v.summary,
      limitations: v.limitations,
      inspector: owner ? v.inspector_name : (v.inspector_id ? 'Authorised reviewer' : null),
      created_at: v.created_at,
    })),
    rejections: (owner || buyer) ? ctx.rejections.map((r) => ({
      id: r.id,
      category: r.category,
      explanation: r.explanation,
      measurement_ref: r.measurement_ref,
      corrective_action: r.corrective_action,
      reassessment_needed: !!r.reassessment_needed,
      resolved_by_verification_id: r.resolved_by_verification_id,
      created_at: r.created_at,
      actor: owner ? r.actor_name : r.actor_role,
    })) : ctx.rejections.map((r) => ({
      category: r.category,
      corrective_action: r.corrective_action,
      created_at: r.created_at,
      resolved: !!r.resolved_by_verification_id,
    })),
    evidence,
    private_evidence_count: owner ? 0 : privateCount,
    internal_notes: owner ? batch.internal_notes : null,
    offers: offers.map(publicOffer),
    intelligence: owner || buyer ? ctx.intelligence : {
      disclaimer: ctx.intelligence.disclaimer,
      quality: ctx.intelligence.quality,
      recommendations: [],
      assistant: null,
      buyer_matches: [],
      offers: [],
      offer_explanations: [],
    },
    events: owner || buyer ? ctx.events.map((e) => ({ ...e, actor_name: actorName(e.actor), actor_role: actorRole(e.actor) })) : publicEvents(ctx.events),
    passport_path: `/passport/${batch.batch_code}`,
    generated_at: new Date().toISOString(),
    limitations: [
      'A QR code opens this record. It does not by itself prove authenticity, origin, or laboratory certification.',
      batch.source_declaration ? 'Source declared; independent verification unavailable.' : 'No source declaration is stored.',
    ],
  };
}

function publicOffer(offer) {
  return {
    id: offer.id,
    buyer: offer.organisation || offer.buyer_name,
    amount: offer.amount,
    currency: offer.currency,
    price_unit: offer.price_unit,
    quantity: offer.quantity,
    min_quantity: offer.min_quantity,
    grade_label: offer.grade_label,
    terms: offer.terms,
    delivery_terms: offer.delivery_terms,
    offer_kind: offer.offer_kind,
    source_label: offer.source_label,
    status: offer.status,
    valid_until: offer.valid_until,
    is_demo: !!offer.is_demo,
    created_at: offer.created_at,
  };
}

function listCard(row) {
  return {
    id: row.id,
    batch_code: row.batch_code,
    product: row.product_name,
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    collection_date: row.collection_date,
    district: row.district_name,
    state: row.state_name,
    state_id: row.state_id,
    district_id: row.district_id,
    status: row.status,
    grade_label: row.grade_label,
    centre: row.centre_name,
    is_demo: !!row.is_demo,
    updated_at: row.updated_at,
    public_share: !!row.public_share,
  };
}

module.exports = { loadContext, loadBatchRow, canRead, shapePassport, listCard, publicOffer, parse };
