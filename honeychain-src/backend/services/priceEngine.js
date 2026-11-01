const { convert, convertPrice, evaluateSpecs, readinessScorecard } = require('./qualityEngine');

function isExpired(dateStr, now = new Date()) {
  if (!dateStr) return false;
  const end = new Date(dateStr);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() < now.getTime();
}

function quantityFit(batch, rule) {
  const conv = convert(batch.quantity, batch.unit, rule.unit || batch.unit);
  if (!conv.ok) {
    return { ok: false, comparable: false, reason: `Quantity could not be compared. ${conv.reason}` };
  }
  if (rule.min_qty != null && conv.value < rule.min_qty) {
    return { ok: false, comparable: true, quantity: conv.value, reason: `Batch quantity converts to ${conv.value} ${rule.unit}. The requirement asks for at least ${rule.min_qty} ${rule.unit}.` };
  }
  if (rule.max_qty != null && conv.value > rule.max_qty) {
    return { ok: false, comparable: true, quantity: conv.value, reason: `Batch quantity converts to ${conv.value} ${rule.unit}, above the stated maximum of ${rule.max_qty} ${rule.unit}.` };
  }
  return { ok: true, comparable: true, quantity: conv.value, reason: `Quantity is compatible with the stated range. ${conv.note}` };
}

function documentFit(documents, evidence) {
  const docs = documents || [];
  return docs.map((doc) => {
    const needle = String(doc).trim().toLowerCase();
    const hit = (evidence || []).find((e) => {
      const hay = `${e.kind || ''} ${e.label || ''} ${e.note || ''}`.toLowerCase();
      return hay.includes(needle);
    });
    return {
      document: doc,
      present: !!hit,
      outcome: hit ? 'meets_recorded_specification' : 'needs_additional_evidence',
      reason: hit ? `A record labelled for "${doc}" is attached.` : `No record matching "${doc}" was found.`,
    };
  });
}

function matchStatus({ specResult, docs, qty, expired, selfReported }) {
  if (expired) return 'not_eligible';
  if (!qty.ok && qty.comparable) return 'not_eligible';
  if (!qty.comparable) return 'insufficient_evidence';
  const checks = specResult.checks || [];
  if (checks.some((c) => c.required && c.outcome === 'does_not_meet')) return 'not_eligible';
  if (docs.some((d) => d.outcome === 'needs_additional_evidence')) return 'insufficient_evidence';
  if (checks.some((c) => c.required && (c.outcome === 'needs_additional_evidence' || c.outcome === 'cannot_be_assessed' || c.outcome === 'specification_unavailable'))) {
    return 'insufficient_evidence';
  }
  if (selfReported) return 'conditional';
  if (checks.length === 0 && docs.length === 0) return 'insufficient_evidence';
  return 'eligible';
}

function priceView(record, targetUnit) {
  if (record.reference_price == null && record.amount == null) return null;
  const amount = record.amount != null ? record.amount : record.reference_price;
  const unit = record.price_unit || record.unit;
  const kind = record.offer_kind || 'demonstration';
  const view = {
    amount,
    currency: record.currency || 'INR',
    unit,
    kind,
    kind_label: kindLabel(kind),
    source: record.source_label || 'No source recorded',
    valid_until: record.valid_until || null,
    expired: isExpired(record.valid_until),
    status: record.status || null,
    normalized: null,
  };
  if (targetUnit && unit) {
    const norm = convertPrice(amount, unit, targetUnit);
    view.normalized = norm.ok
      ? { amount: norm.value, unit: targetUnit, note: norm.note, comparable: true }
      : { comparable: false, note: norm.reason };
  }
  return view;
}

function kindLabel(kind) {
  return {
    actual: 'Recorded offer',
    recorded_offer: 'Offer recorded in this application',
    historical: 'Historical transaction',
    published: 'Published reference',
    benchmark: 'Administrator-entered benchmark',
    demonstration: 'Demonstration sample — not a live market price',
  }[kind] || kind;
}

function matchRequirement(batch, requirement, measurements, evidence, now) {
  const specs = parseJson(requirement.specs_json, []);
  const documents = parseJson(requirement.documents_json, []);
  const specResult = evaluateSpecs(specs, measurements);
  const docs = documentFit(documents, evidence);
  const qty = quantityFit(batch, requirement);
  const expired = isExpired(requirement.valid_until, now) || requirement.status === 'expired';
  const selfReported = (measurements || []).some((m) => m.evidence_source === 'self_reported');
  const gradeMismatch = requirement.grade_label && batch.grade_label
    && requirement.grade_label.trim().toLowerCase() !== batch.grade_label.trim().toLowerCase();
  let status = matchStatus({ specResult, docs, qty, expired, selfReported });
  if (gradeMismatch && status === 'eligible') status = 'conditional';
  const limitations = [];
  if (selfReported) limitations.push('At least one measurement is self-reported. A self-reported value is not treated as laboratory verification.');
  if (gradeMismatch) limitations.push(`Grade or specification labels differ ("${batch.grade_label}" and "${requirement.grade_label}"). They are not treated as equivalent.`);
  if (expired) limitations.push('The requirement or its reference price is past the recorded end date.');
  if ((measurements || []).some((m) => m.evidence_source === 'simulated')) {
    limitations.push('A simulated demonstration value is present and cannot satisfy a requirement.');
  }
  return {
    requirement_id: requirement.id,
    buyer_user_id: requirement.buyer_user_id,
    buyer_name: requirement.buyer_name || null,
    organisation: requirement.organisation || null,
    product_id: requirement.product_id,
    grade_label: requirement.grade_label,
    match: status,
    checks: specResult.checks,
    documents: docs,
    quantity: qty,
    limitations,
    scorecard: readinessScorecard([
      ...specResult.checks,
      ...docs.map((d) => ({ parameter: d.document, required: true, outcome: d.outcome })),
    ]),
    reference_price: priceView(requirement, requirement.price_unit),
    packaging: requirement.packaging || null,
    delivery: requirement.delivery || null,
    source_label: requirement.source_label,
    offer_kind: requirement.offer_kind,
    is_demo: !!requirement.is_demo,
  };
}

function explainOffers(offers, batch, matches) {
  const notes = [];
  const list = offers || [];
  if (list.length < 2) {
    notes.push({
      topic: 'Offer comparison',
      text: list.length === 0
        ? 'No offer is recorded against this batch, so there is no price difference to explain.'
        : 'Only one offer is recorded. A difference between offers cannot be explained until another comparable offer exists.',
    });
    return notes;
  }
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      notes.push(explainPair(list[i], list[j], batch, matches));
    }
  }
  return notes;
}

function explainPair(a, b, batch, matches) {
  const reasons = [];
  if ((a.grade_label || '') !== (b.grade_label || '')) {
    reasons.push(`The offers name different grades or specifications (${a.grade_label || 'unspecified'} and ${b.grade_label || 'unspecified'}). They are not treated as the same product grade.`);
  }
  const unitA = a.price_unit;
  const unitB = b.price_unit;
  const norm = unitA && unitB ? convertPrice(a.amount, unitA, unitB) : { ok: false, reason: 'A price unit is missing.' };
  if (!norm.ok) reasons.push(`Prices were not normalised. ${norm.reason}`);
  if (isExpired(a.valid_until) || isExpired(b.valid_until)) {
    reasons.push('At least one offer is past its recorded end date, so it is not an open offer.');
  }
  if ((a.min_quantity || 0) !== (b.min_quantity || 0)) {
    reasons.push(`Minimum quantities differ (${a.min_quantity ?? 'not set'} and ${b.min_quantity ?? 'not set'}).`);
  }
  if ((a.delivery_terms || '') !== (b.delivery_terms || '')) {
    reasons.push('Delivery or transport terms are not the same.');
  }
  const ma = (matches || []).find((m) => m.buyer_user_id === a.buyer_user_id);
  const mb = (matches || []).find((m) => m.buyer_user_id === b.buyer_user_id);
  if (ma && mb && ma.match !== mb.match) {
    reasons.push(`Buyer readiness is not the same (${ma.match.replaceAll('_', ' ')} versus ${mb.match.replaceAll('_', ' ')}). That explains eligibility. It is not, by itself, proof that a quality attribute caused the price figures to differ.`);
  }
  if ((a.terms || '') !== (b.terms || '') && (a.terms || b.terms)) {
    reasons.push('The written terms differ. Read those terms before treating the two amounts as comparable.');
  }
  if (!reasons.length) {
    reasons.push('The recorded fields do not show a specific quality attribute that accounts for the price difference. The evidence is insufficient to say why the amounts differ.');
  }
  return {
    offers: [a.id, b.id],
    original: [
      { id: a.id, amount: a.amount, currency: a.currency, unit: a.price_unit, kind: kindLabel(a.offer_kind) },
      { id: b.id, amount: b.amount, currency: b.currency, unit: b.price_unit, kind: kindLabel(b.offer_kind) },
    ],
    normalized: norm.ok ? { left_in_right_unit: norm.value, unit: unitB, note: norm.note } : null,
    reasons,
    batch: batch.batch_code,
  };
}

function recommendationsFrom(matches, profileChecks) {
  const recs = [];
  const seen = new Set();
  const push = (rec) => {
    const key = rec.observed_gap + rec.action;
    if (seen.has(key)) return;
    seen.add(key);
    recs.push(rec);
  };
  for (const check of profileChecks || []) {
    if (check.outcome === 'specification_unavailable') {
      push({
        observed_gap: `${check.parameter} has no configured limit.`,
        supporting_record: check.recorded_value == null ? 'No measurement stored.' : `Recorded value: ${check.recorded_value} ${check.unit || ''}`.trim(),
        rule: check.reason,
        action: 'Leave this item as not configured until an authorised person stores a sourced limit. Do not describe the batch as passing it.',
        measure_success: 'A later profile version shows a source, a unit, and a minimum or maximum.',
        effort: null,
        expected_benefit: 'A sourced limit would let a later comparison say whether the recorded value meets that limit. This is not a promise of a higher price.',
        confidence: 'Configured-rule gap',
        evidence_status: 'No threshold is stored',
        source: check.source || 'Quality profile',
      });
    }
  }
  for (const match of matches || []) {
    for (const check of match.checks || []) {
      if (check.outcome === 'needs_additional_evidence') {
        push({
          observed_gap: `${match.organisation || 'A buyer'} asks for ${check.parameter}, and this batch does not have a usable record.`,
          supporting_record: 'No usable measurement is stored for this parameter.',
          rule: check.reason,
          action: `Obtain a ${check.parameter} measurement in ${check.unit || 'the buyer\'s unit'} and record the method, date, and evidence source before claiming the batch meets this specification.`,
          measure_success: 'A new measurement is saved with a unit, a date, a method, and an evidence source other than simulated.',
          effort: null,
          expected_benefit: 'The result may show whether the batch meets this buyer\'s stated specification. It does not guarantee a different offer.',
          confidence: 'Buyer requirement',
          evidence_status: check.evidence_source || 'missing',
          source: check.source || match.source_label || 'Buyer specification',
        });
      }
      if (check.outcome === 'does_not_meet') {
        push({
          observed_gap: `${check.parameter} does not meet ${match.organisation || 'the buyer'}'s recorded limit.`,
          supporting_record: `Recorded value ${check.recorded_value} ${check.unit || ''} (${check.evidence_source || 'source not set'}).`,
          rule: check.reason,
          action: 'Correct the handling issue if the record is reliable, then add a new measurement. The earlier result stays in the history.',
          measure_success: 'A later measurement is inside the buyer\'s stated range and its evidence source is recorded.',
          effort: null,
          expected_benefit: 'A new result may make the batch eligible for reassessment against this specification. A higher price is not promised.',
          confidence: 'Recorded comparison',
          evidence_status: check.evidence_source || 'recorded',
          source: check.source || 'Buyer specification',
        });
      }
    }
    if (match.quantity && !match.quantity.ok) {
      push({
        observed_gap: 'The batch quantity does not fit this buyer\'s stated quantity range.',
        supporting_record: match.quantity.reason,
        rule: 'Buyer minimum or maximum quantity',
        action: 'Offer a quantity that meets the range, or look for a buyer whose range fits this batch. Do not combine batches in the record unless that aggregation actually happened.',
        measure_success: 'The offered quantity falls inside the buyer\'s recorded minimum and maximum.',
        effort: null,
        expected_benefit: 'Quantity fit is separate from quality. Meeting it may allow an offer to be considered. It does not set the price.',
        confidence: 'Recorded quantity',
        evidence_status: 'declared quantity',
        source: match.source_label || 'Buyer requirement',
      });
    }
  }
  return recs;
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

module.exports = {
  isExpired,
  matchRequirement,
  explainOffers,
  recommendationsFrom,
  priceView,
  kindLabel,
  parseJson,
};
