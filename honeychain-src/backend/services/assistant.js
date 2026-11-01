function buildAssistant(batch, product, handling, profileChecks) {
  const config = parse(product && product.handling_json, {});
  const required = new Set(config.required || []);
  const expected = new Set([...(config.expected || []), ...required]);
  const records = handling || [];
  const byKind = new Map();
  for (const row of records) {
    if (!byKind.has(row.kind)) byKind.set(row.kind, []);
    byKind.get(row.kind).push(row);
  }

  const missing = [];
  for (const kind of required) {
    if (!byKind.has(kind)) {
      missing.push({
        item: kind,
        detail: `The ${product.name} checklist marks ${kind} as a record to capture. None is stored. This is a missing record, not a failed test.`,
      });
    }
  }

  const inconsistencies = [];
  if (batch.collection_date) {
    for (const row of records) {
      if (row.start_date && row.start_date < batch.collection_date) {
        inconsistencies.push(`${row.kind} starts on ${row.start_date}, before the collection date ${batch.collection_date}.`);
      }
      if (row.start_date && row.end_date && row.end_date < row.start_date) {
        inconsistencies.push(`${row.kind} ends on ${row.end_date}, before it starts on ${row.start_date}.`);
      }
    }
  }

  const unexpected = [];
  for (const kind of byKind.keys()) {
    if (expected.size && !expected.has(kind) && kind !== 'processing' && kind !== 'transport') {
      unexpected.push(`${kind} is recorded, but it is not on the configured checklist for ${product.name}. It is kept as entered. No extra rule was applied.`);
    }
  }

  const next = [];
  for (const check of profileChecks || []) {
    if (check.outcome === 'needs_additional_evidence' || (check.required && check.recorded_value == null && check.outcome !== 'optional_missing')) {
      next.push(`Next useful record: ${check.parameter}${check.unit ? ` (${check.unit})` : ''}. ${check.reason}`);
    }
  }
  if (!next.length && missing.length) {
    next.push(`Next useful record: add the missing ${missing[0].item} entry, with dates if they are known.`);
  }
  if (!next.length) {
    next.push('No further required record is flagged by the configured checklist. That does not mean the batch is certified.');
  }

  const checklist = [...expected].map((kind) => ({
    item: kind,
    state: byKind.has(kind) ? 'recorded' : (required.has(kind) ? 'missing' : 'not recorded'),
  }));

  return {
    title: 'Post-harvest record assistant',
    mode: 'Application-generated guidance from configured checklists. Not a live model response and not handling or safety advice beyond the stored rules.',
    missing,
    inconsistencies,
    unexpected,
    next_steps: next,
    future_batch_checklist: checklist,
    confidence_note: 'Better records can make a buyer\'s comparison possible. They do not by themselves raise a price.',
    source: (product && product.name) ? `${product.name} handling checklist stored in the catalogue` : 'No product checklist',
  };
}

function parse(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

module.exports = { buildAssistant };
