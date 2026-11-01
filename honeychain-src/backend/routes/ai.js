const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { loadContext, canRead } = require('../services/records');

const router = express.Router();

function reply(req, res) {
  const body = req.body || {};
  const task = body.task || 'navigate';
  if (!body.batch_id) {
    return res.json({
      mode: 'Application-generated guidance. No external model is configured.',
      answer: answerWithoutBatch(task, body.question),
    });
  }
  const ctx = loadContext(body.batch_id);
  if (!ctx || !canRead(req.user, ctx.batch)) return res.status(404).json({ error: 'Batch not available.' });
  const intel = ctx.intelligence;
  let answer = '';
  if (task === 'quality' || /measur|quality|moisture/i.test(body.question || '')) {
    answer = intel.quality.checks.map((c) => `${c.parameter}: ${c.outcome.replaceAll('_', ' ')}. ${c.reason}`).join('\n')
      || 'No quality checks are configured for this product.';
  } else if (task === 'buyers' || /buyer|price|offer/i.test(body.question || '')) {
    answer = intel.buyer_matches.map((m) => `${m.organisation || m.buyer_name}: ${m.match.replaceAll('_', ' ')}. ${(m.limitations || []).join(' ')}`).join('\n')
      || 'No buyer specification is stored for this product.';
  } else if (task === 'schemes') {
    answer = answerWithoutBatch('schemes');
  } else if (task === 'status') {
    answer = `Status is ${ctx.batch.status}. ${intel.disclaimer}`;
  } else {
    const gap = intel.recommendations[0];
    answer = gap ? `${gap.observed_gap} Next action: ${gap.action} ${gap.expected_benefit}` : intel.assistant.next_steps.join(' ');
  }
  res.json({
    mode: 'Application-generated guidance from stored records and configured rules. Not a live model response.',
    disclaimer: intel.disclaimer,
    answer,
    recommendations: intel.recommendations.slice(0, 4),
    assistant: intel.assistant,
  });
}

function answerWithoutBatch(task, question) {
  if (task === 'schemes' || /scheme/i.test(question || '')) {
    const schemes = db.prepare('SELECT name, official_url FROM schemes').all();
    return `Eligibility is not decided in this application. Official pages:\n${schemes.map((s) => `${s.name}: ${s.official_url}`).join('\n')}`;
  }
  return 'Choose a batch to explain its recorded measurements, buyer fit, and missing records. This assistant does not invent laboratory results or prices.';
}

router.post('/assistant', requireAuth, reply);
router.post('/quality-explanation', requireAuth, (req, res) => { req.body = { ...(req.body || {}), task: 'quality' }; reply(req, res); });
router.post('/buyer-match-explanation', requireAuth, (req, res) => { req.body = { ...(req.body || {}), task: 'buyers' }; reply(req, res); });
router.post('/quality-guidance', requireAuth, (req, res) => { req.body = { ...(req.body || {}), task: 'navigate' }; reply(req, res); });

module.exports = router;
