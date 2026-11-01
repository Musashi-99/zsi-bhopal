const MASS = { mg: 1e-6, g: 0.001, kg: 1, quintal: 100, tonne: 1000 };
const VOLUME = { ml: 0.001, l: 1, litre: 1, liter: 1 };
const COUNT = { piece: 'piece', pieces: 'piece', bundle: 'bundle', bundles: 'bundle' };

function cleanUnit(unit) {
  return String(unit || '')
    .trim()
    .toLowerCase()
    .replace(/^per\s+/, '')
    .replace(/^₹\s*\/\s*/, '')
    .replace(/^rs\.?\s*\/\s*/, '');
}

function unitInfo(unit) {
  const u = cleanUnit(unit);
  if (u === '%' || u === 'percent') return { dim: 'percent', base: '%', factor: 1, label: u };
  if (Object.prototype.hasOwnProperty.call(MASS, u)) return { dim: 'mass', base: 'kg', factor: MASS[u], label: u };
  if (Object.prototype.hasOwnProperty.call(VOLUME, u)) return { dim: 'volume', base: 'L', factor: VOLUME[u], label: u };
  if (Object.prototype.hasOwnProperty.call(COUNT, u)) return { dim: 'count', base: COUNT[u], factor: 1, label: u };
  return { dim: 'other', base: u, factor: 1, label: u };
}

function round(n) {
  return Math.round(n * 10000) / 10000;
}

function convert(value, from, to) {
  const a = unitInfo(from);
  const b = unitInfo(to);
  if (!a.label || !b.label) return { ok: false, reason: 'A unit is missing, so no conversion was made.' };
  if (a.dim !== b.dim) {
    return { ok: false, reason: `Cannot convert ${from} to ${to}. They measure different things.` };
  }
  if (a.dim === 'count' && a.base !== b.base) {
    return { ok: false, reason: `${from} and ${to} are both counts, but they are not the same unit and were not converted.` };
  }
  if (a.dim === 'other' && a.base !== b.base) {
    return { ok: false, reason: `No conversion is configured from ${from} to ${to}.` };
  }
  const out = round((Number(value) * a.factor) / b.factor);
  const same = a.label === b.label;
  return {
    ok: true,
    value: out,
    note: same
      ? 'Same unit. No conversion applied.'
      : `Converted using metric factors: ${value} ${from} = ${out} ${to}. This is a unit conversion, not a quality judgement.`,
  };
}

function convertPrice(amount, priceUnit, targetUnit) {
  const factor = convert(1, targetUnit, priceUnit);
  if (!factor.ok) return factor;
  const value = round(Number(amount) * factor.value);
  return {
    ok: true,
    value,
    note: factor.note.startsWith('Same unit')
      ? 'Same price unit. No conversion applied.'
      : `1 ${targetUnit} contains ${factor.value} ${priceUnit}. ${amount} per ${priceUnit} is ${value} per ${targetUnit}.`,
  };
}

function findMeasurement(measurements, name) {
  const want = String(name || '').trim().toLowerCase();
  return (measurements || []).find((m) => String(m.parameter_name || m.parameter || '').trim().toLowerCase() === want) || null;
}

function thresholdConfigured(rule) {
  if (!rule) return false;
  if (rule.data_type === 'text') return Boolean(rule.text_expect);
  return rule.min_value != null || rule.max_value != null || rule.min != null || rule.max != null;
}

function compareNumber(value, rule) {
  const min = rule.min_value != null ? rule.min_value : rule.min;
  const max = rule.max_value != null ? rule.max_value : rule.max;
  if (min == null && max == null) {
    return { outcome: 'specification_unavailable', reason: 'A value is recorded, but no minimum or maximum is configured for this requirement. It is not marked pass or fail.' };
  }
  if (min != null && value < min) {
    return { outcome: 'does_not_meet', reason: `Recorded value ${value} is below the configured minimum of ${min}.` };
  }
  if (max != null && value > max) {
    return { outcome: 'does_not_meet', reason: `Recorded value ${value} is above the configured maximum of ${max}.` };
  }
  return { outcome: 'meets_recorded_specification', reason: `Recorded value ${value} is inside the configured range${min != null ? ` (min ${min})` : ''}${max != null ? ` (max ${max})` : ''}.` };
}

function assessCheck({ name, required, rule, measurement, sourceLabel }) {
  const base = {
    parameter: name,
    required: !!required,
    unit: (measurement && measurement.unit) || (rule && (rule.unit || null)) || null,
    recorded_value: measurement ? (measurement.value != null ? measurement.value : measurement.text_value) : null,
    evidence_source: measurement ? measurement.evidence_source : null,
    verified: measurement ? !!measurement.verified : false,
    threshold_configured: thresholdConfigured(rule),
    source: sourceLabel || (rule && rule.source_name) || null,
  };

  if (!measurement || measurement.evidence_source === 'unavailable' || (measurement.value == null && !measurement.text_value)) {
    return {
      ...base,
      outcome: required ? 'needs_additional_evidence' : 'optional_missing',
      reason: required
        ? `No usable ${name} record is stored. This required item cannot be judged yet.`
        : `No ${name} record is stored. It is optional, so it is not treated as a pass or a fail.`,
    };
  }

  if (measurement.evidence_source === 'simulated') {
    return {
      ...base,
      outcome: 'needs_additional_evidence',
      reason: 'This value is marked simulated for the demonstration. A simulated value cannot meet a requirement.',
    };
  }

  if (rule && rule.unit && measurement.unit) {
    const conv = convert(measurement.value, measurement.unit, rule.unit);
    if (!conv.ok) {
      return { ...base, outcome: 'cannot_be_assessed', reason: conv.reason };
    }
    if (measurement.value != null && rule.data_type !== 'text') {
      const judged = compareNumber(conv.value, rule);
      const extra = measurement.evidence_source === 'self_reported'
        ? ' The value is self-reported, not laboratory-verified.'
        : measurement.verified
          ? ' The record is marked verified by an authorised reviewer.'
          : ' The record is not marked verified.';
      return {
        ...base,
        recorded_value: measurement.value,
        compared_value: conv.value,
        compared_unit: rule.unit,
        conversion: conv.note,
        outcome: judged.outcome,
        reason: judged.reason + extra,
      };
    }
  }

  if (rule && rule.data_type === 'text') {
    if (!rule.text_expect) {
      return { ...base, outcome: 'specification_unavailable', reason: 'A text value is recorded, but no expected text is configured.' };
    }
    const same = String(measurement.text_value || '').trim().toLowerCase() === String(rule.text_expect).trim().toLowerCase();
    return {
      ...base,
      outcome: same ? 'meets_recorded_specification' : 'does_not_meet',
      reason: same
        ? `Recorded text matches the configured expectation "${rule.text_expect}".`
        : `Recorded text does not match the configured expectation "${rule.text_expect}".`,
    };
  }

  if (!thresholdConfigured(rule)) {
    return {
      ...base,
      outcome: 'specification_unavailable',
      reason: 'A measurement is recorded, but no limit is configured. Not configured — the batch is not marked pass or fail for this item.',
    };
  }

  return { ...base, outcome: 'cannot_be_assessed', reason: 'The record could not be compared with the configured rule.' };
}

function evaluateProfile(parameters, measurements) {
  const checks = (parameters || []).map((p) => assessCheck({
    name: p.name,
    required: !!p.required,
    rule: p,
    measurement: findMeasurement(measurements, p.name),
    sourceLabel: p.source_name || 'Quality profile',
  }));
  return { checks, counts: countOutcomes(checks) };
}

function evaluateSpecs(specs, measurements) {
  const checks = (specs || []).map((spec) => assessCheck({
    name: spec.parameter,
    required: spec.required !== false,
    rule: spec,
    measurement: findMeasurement(measurements, spec.parameter),
    sourceLabel: spec.source || 'Buyer-stated specification',
  }));
  return { checks, counts: countOutcomes(checks) };
}

function countOutcomes(checks) {
  const tally = { meets: 0, unmet: 0, needs_evidence: 0, unavailable: 0, cannot_assess: 0, optional_missing: 0 };
  for (const c of checks) {
    if (c.outcome === 'meets_recorded_specification') tally.meets += 1;
    else if (c.outcome === 'does_not_meet') tally.unmet += 1;
    else if (c.outcome === 'needs_additional_evidence') tally.needs_evidence += 1;
    else if (c.outcome === 'specification_unavailable') tally.unavailable += 1;
    else if (c.outcome === 'cannot_be_assessed') tally.cannot_assess += 1;
    else if (c.outcome === 'optional_missing') tally.optional_missing += 1;
  }
  return tally;
}

function readinessScorecard(checks) {
  const required = (checks || []).filter((c) => c.required);
  const met = required.filter((c) => c.outcome === 'meets_recorded_specification');
  const unmet = required.filter((c) => c.outcome === 'does_not_meet');
  const awaiting = required.filter((c) => c.outcome === 'needs_additional_evidence' || c.outcome === 'cannot_be_assessed' || c.outcome === 'specification_unavailable');
  const optional = (checks || []).filter((c) => !c.required);
  const decided = met.length + unmet.length;
  return {
    title: 'Buyer readiness',
    meaning: 'This checklist summarises evidence against one buyer specification. It is not a scientific quality score and it does not certify the product.',
    met: met.map((c) => c.parameter),
    not_met: unmet.map((c) => c.parameter),
    awaiting: awaiting.map((c) => c.parameter),
    optional: optional.map((c) => c.parameter),
    fraction: decided > 0 ? { numerator: met.length, denominator: decided, label: `${met.length} of ${decided} decided requirements met` } : null,
    missing_data_note: awaiting.length
      ? `${awaiting.length} required item(s) are left out of the fraction because evidence is missing, not comparable, or the limit is not configured. Missing data is not counted as a pass or a fail.`
      : 'Every required item in this specification had a decided comparison.',
    calculation: decided > 0
      ? 'Numerator = required items that meet the recorded specification. Denominator = required items with a pass or fail comparison. Items awaiting evidence are excluded.'
      : 'No numerical fraction is shown because no required item could be decided.',
  };
}

module.exports = {
  cleanUnit,
  convert,
  convertPrice,
  evaluateProfile,
  evaluateSpecs,
  readinessScorecard,
  findMeasurement,
};
