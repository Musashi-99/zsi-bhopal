const test = require('node:test');
const assert = require('node:assert');
const { convert, convertPrice, evaluateProfile, evaluateSpecs, readinessScorecard } = require('../services/qualityEngine');
const { matchRequirement, explainOffers } = require('../services/priceEngine');

test('converts mass and refuses unlike units', () => {
  const kg = convert(500, 'g', 'kg');
  assert.equal(kg.ok, true);
  assert.equal(kg.value, 0.5);
  const nope = convert(1, 'kg', 'L');
  assert.equal(nope.ok, false);
  const price = convertPrice(500, 'quintal', 'kg');
  assert.equal(price.ok, true);
  assert.equal(price.value, 5);
});

test('missing required evidence is not a pass or a fail', () => {
  const profile = evaluateProfile([
    { name: 'Moisture', unit: '%', required: 1, min_value: null, max_value: null, data_type: 'number', source_name: 'profile' },
  ], []);
  assert.equal(profile.checks[0].outcome, 'needs_additional_evidence');
  const specs = evaluateSpecs([
    { parameter: 'Moisture', unit: '%', max: 12, required: true },
  ], [{ parameter_name: 'Moisture', value: 10, unit: '%', evidence_source: 'self_reported', verified: 0 }]);
  assert.equal(specs.checks[0].outcome, 'meets_recorded_specification');
  const over = evaluateSpecs([
    { parameter: 'Moisture', unit: '%', max: 12, required: true },
  ], [{ parameter_name: 'Moisture', value: 16, unit: '%', evidence_source: 'self_reported', verified: 0 }]);
  assert.equal(over.checks[0].outcome, 'does_not_meet');
  const open = evaluateSpecs([
    { parameter: 'Moisture', unit: '%', required: true },
  ], [{ parameter_name: 'Moisture', value: 16, unit: '%', evidence_source: 'measured', verified: 0 }]);
  assert.equal(open.checks[0].outcome, 'specification_unavailable');
});

test('simulated values cannot satisfy a buyer and missing data stays out of the fraction', () => {
  const simulated = evaluateSpecs([
    { parameter: 'Moisture', unit: '%', max: 20, required: true },
  ], [{ parameter_name: 'Moisture', value: 18, unit: '%', evidence_source: 'simulated', verified: 0 }]);
  assert.equal(simulated.checks[0].outcome, 'needs_additional_evidence');
  const card = readinessScorecard([
    { parameter: 'Moisture', required: true, outcome: 'meets_recorded_specification' },
    { parameter: 'Foreign matter', required: true, outcome: 'needs_additional_evidence' },
    { parameter: 'Grade', required: false, outcome: 'optional_missing' },
  ]);
  assert.deepEqual(card.fraction, { numerator: 1, denominator: 1, label: '1 of 1 decided requirements met' });
  assert.match(card.missing_data_note, /not counted as a pass or a fail/);
});

test('buyer match explains quantity and does not treat a self-report as fully eligible', () => {
  const batch = { id: 'B', batch_code: 'AV', product_id: 'P', quantity: 80, unit: 'kg', grade_label: 'Dried flowers' };
  const requirement = {
    id: 'R', buyer_user_id: 'U', buyer_name: 'Buyer', organisation: 'Demo buyer', product_id: 'P',
    grade_label: 'Dried flowers', min_qty: 200, unit: 'kg', specs_json: JSON.stringify([{ parameter: 'Moisture', unit: '%', max: 12, required: true }]),
    documents_json: '[]', reference_price: 100, price_unit: 'kg', currency: 'INR', offer_kind: 'demonstration',
    source_label: 'demo', status: 'active', valid_until: '2099-01-01',
  };
  const result = matchRequirement(batch, requirement, [
    { parameter_name: 'Moisture', value: 9, unit: '%', evidence_source: 'self_reported', verified: 0 },
  ], []);
  assert.equal(result.match, 'not_eligible');
  assert.match(result.quantity.reason, /200/);
  const smallReq = { ...requirement, min_qty: 50 };
  const conditional = matchRequirement(batch, smallReq, [
    { parameter_name: 'Moisture', value: 9, unit: '%', evidence_source: 'self_reported', verified: 0 },
  ], []);
  assert.equal(conditional.match, 'conditional');
});

test('offer explanation does not invent a cause when the records do not show one', () => {
  const notes = explainOffers([
    { id: 'A', amount: 10, currency: 'INR', price_unit: 'kg', grade_label: 'A', offer_kind: 'demonstration', min_quantity: 1, terms: '', delivery_terms: '', valid_until: '2099-01-01', buyer_user_id: '1' },
    { id: 'B', amount: 12, currency: 'INR', price_unit: 'kg', grade_label: 'A', offer_kind: 'demonstration', min_quantity: 1, terms: '', delivery_terms: '', valid_until: '2099-01-01', buyer_user_id: '1' },
  ], { batch_code: 'AV' }, []);
  assert.match(notes[0].reasons.join(' '), /insufficient/i);
});
