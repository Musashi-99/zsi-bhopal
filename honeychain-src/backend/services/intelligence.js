const { evaluateProfile } = require('./qualityEngine');
const { matchRequirement, explainOffers, recommendationsFrom, priceView, parseJson } = require('./priceEngine');
const { buildAssistant } = require('./assistant');

const DISCLAIMER = 'This comparison uses recorded evidence and configured rules. It does not certify purity, origin, or a fair price, and it does not promise that a change in handling will change an offer.';

function buildIntelligence({ batch, product, parameters, measurements, requirements, offers, handling, evidence }) {
  const profile = evaluateProfile(parameters || [], measurements || []);
  const matches = (requirements || [])
    .filter((r) => r.product_id === batch.product_id && r.status !== 'withdrawn')
    .map((r) => matchRequirement(batch, r, measurements, evidence));
  const offerViews = (offers || []).map((offer) => ({
    ...offer,
    price: priceView(offer, offer.price_unit),
    expired: priceView(offer, offer.price_unit)?.expired || false,
  }));
  const recs = [
    ...recommendationsFrom(matches, profile.checks),
    ...assistantRecs(buildAssistant(batch, product, handling, profile.checks)),
  ];
  return {
    disclaimer: DISCLAIMER,
    quality: {
      profile_name: parameters && parameters[0] ? parameters[0].profile_name : null,
      checks: profile.checks,
      counts: profile.counts,
      evidence_note: evidenceNote(measurements),
    },
    buyer_matches: matches,
    offers: offerViews,
    offer_explanations: explainOffers(offers || [], batch, matches),
    recommendations: recs,
    assistant: buildAssistant(batch, product, handling, profile.checks),
  };
}

function assistantRecs(assistant) {
  return (assistant.missing || []).map((item) => ({
    observed_gap: item.detail,
    supporting_record: 'Handling history',
    rule: 'Product handling checklist',
    action: `Add a ${item.item} record if that step happened, or leave it missing if it did not. Do not invent a step.`,
    measure_success: `A ${item.item} record with a method and a date is stored, or the checklist is edited by an administrator.`,
    effort: null,
    expected_benefit: 'A complete checklist can answer a buyer who asks how the batch was handled. It is not proof of a better price.',
    confidence: 'Checklist',
    evidence_status: 'missing record',
    source: assistant.source,
  })).concat((assistant.inconsistencies || []).map((text) => ({
    observed_gap: text,
    supporting_record: 'Dates on the batch',
    rule: 'A later handling date should not fall before collection or before its own start.',
    action: 'Correct the date if it was entered wrong, and keep the earlier entry in the history if it was already submitted.',
    measure_success: 'The stored dates are in a possible order.',
    effort: null,
    expected_benefit: 'Consistent dates make the record easier to trust. They do not certify quality.',
    confidence: 'Date check',
    evidence_status: 'inconsistent dates',
    source: 'Application date rule',
  })));
}

function evidenceNote(measurements) {
  const counts = {};
  for (const m of measurements || []) {
    counts[m.evidence_source] = (counts[m.evidence_source] || 0) + 1;
  }
  if (!Object.keys(counts).length) return 'No measurements are stored. Nothing here was inferred to fill the gap.';
  return counts;
}

function parseSpecs(row) {
  return { ...row, specs: parseJson(row.specs_json, []), documents: parseJson(row.documents_json, []) };
}

module.exports = { buildIntelligence, DISCLAIMER, parseSpecs };
