const express = require('express');
const db = require('../../db/db');
const { APPROVED, REJECTED, PENDING, marks, scope, toCsv } = require('./helpers');

const router = express.Router();

// Each report is computed from stored records. Filters: from, to (submission date), state, district.
function filters(req, alias = 'b') {
  const sc = scope(req, { state: `${alias}.state_id`, district: `${alias}.district_id` });
  let sql = sc.sql;
  const args = [...sc.args];
  const { from, to, state, district } = req.query;
  if (state) { sql += ` AND ${alias}.state_id = ?`; args.push(state); }
  if (district) { sql += ` AND ${alias}.district_id = ?`; args.push(district); }
  if (from) { sql += ` AND date(${alias}.created_at) >= date(?)`; args.push(from); }
  if (to) { sql += ` AND date(${alias}.created_at) <= date(?)`; args.push(to); }
  return { sql, args };
}

const REPORTS = {
  district_collection: {
    title: 'District-wise NTFP collection',
    columns: ['state', 'district', 'batches', 'quantity', 'unit'],
    run: (req) => {
      const f = filters(req);
      return db.prepare(`SELECT s.name AS state, d.name AS district, COUNT(*) AS batches, ROUND(SUM(b.quantity), 2) AS quantity, b.unit
        FROM batches b JOIN districts d ON d.id = b.district_id JOIN states s ON s.id = b.state_id
        WHERE b.status != 'draft' ${f.sql} GROUP BY b.district_id, b.unit ORDER BY s.name, d.name`).all(...f.args);
    },
  },
  product_quantities: {
    title: 'Product-wise quantities',
    columns: ['product', 'batches', 'quantity', 'unit'],
    run: (req) => {
      const f = filters(req);
      return db.prepare(`SELECT p.name AS product, COUNT(*) AS batches, ROUND(SUM(b.quantity), 2) AS quantity, b.unit
        FROM batches b JOIN products p ON p.id = b.product_id WHERE b.status != 'draft' ${f.sql} GROUP BY b.product_id, b.unit ORDER BY p.name`).all(...f.args);
    },
  },
  verification_performance: {
    title: 'Batch verification performance',
    columns: ['officer', 'decisions', 'approved', 'rejected', 'correction_requested', 'avg_hours_to_decision'],
    run: (req) => {
      const f = filters(req);
      return db.prepare(`SELECT u.name AS officer, COUNT(*) AS decisions,
          SUM(CASE WHEN v.status IN ('verified','verified_with_limitations') THEN 1 ELSE 0 END) AS approved,
          SUM(CASE WHEN v.status IN ('rejected','failed_checks') THEN 1 ELSE 0 END) AS rejected,
          SUM(CASE WHEN v.status = 'needs_info' THEN 1 ELSE 0 END) AS correction_requested,
          ROUND(AVG((julianday(v.created_at) - julianday(b.created_at)) * 24), 1) AS avg_hours_to_decision
        FROM verifications v JOIN batches b ON b.id = v.batch_id JOIN users u ON u.id = v.inspector_id
        WHERE v.status != 'pending_verification' ${f.sql} GROUP BY v.inspector_id ORDER BY decisions DESC`).all(...f.args);
    },
  },
  pending_workload: {
    title: 'Pending verification workload',
    columns: ['district', 'product', 'batch_code', 'quantity', 'unit', 'days_waiting'],
    run: (req) => {
      const f = filters(req);
      return db.prepare(`SELECT d.name AS district, p.name AS product, b.batch_code, b.quantity, b.unit,
          CAST(julianday('now') - julianday(b.updated_at) AS INTEGER) AS days_waiting
        FROM batches b JOIN districts d ON d.id = b.district_id JOIN products p ON p.id = b.product_id
        WHERE b.status IN (${marks(PENDING)}) ${f.sql} ORDER BY days_waiting DESC`).all(...PENDING, ...f.args);
    },
  },
  centre_performance: {
    title: 'Collection-centre performance',
    columns: ['centre', 'district', 'batches', 'approved', 'rejected', 'pending'],
    run: (req) => {
      const sc = scope(req, { state: 'c.state_id', district: 'c.district_id' });
      return db.prepare(`SELECT c.name AS centre, d.name AS district,
          COUNT(b.id) AS batches,
          SUM(CASE WHEN b.status IN (${marks(APPROVED)}) THEN 1 ELSE 0 END) AS approved,
          SUM(CASE WHEN b.status IN (${marks(REJECTED)}) THEN 1 ELSE 0 END) AS rejected,
          SUM(CASE WHEN b.status IN (${marks(PENDING)}) THEN 1 ELSE 0 END) AS pending
        FROM centres c JOIN districts d ON d.id = c.district_id LEFT JOIN batches b ON b.centre_id = c.id AND b.status != 'draft'
        WHERE 1 = 1 ${sc.sql} GROUP BY c.id ORDER BY batches DESC`).all(...APPROVED, ...REJECTED, ...PENDING, ...sc.args);
    },
  },
  buyer_demand: {
    title: 'Buyer demand and transaction trends',
    columns: ['month', 'offers', 'orders', 'enquiries'],
    run: () => db.prepare(`
      WITH m AS (SELECT strftime('%Y-%m', created_at) AS month FROM offers UNION SELECT strftime('%Y-%m', created_at) FROM orders UNION SELECT strftime('%Y-%m', created_at) FROM enquiries)
      SELECT m.month,
        (SELECT COUNT(*) FROM offers o WHERE strftime('%Y-%m', o.created_at) = m.month) AS offers,
        (SELECT COUNT(*) FROM orders o WHERE strftime('%Y-%m', o.created_at) = m.month) AS orders,
        (SELECT COUNT(*) FROM enquiries q WHERE strftime('%Y-%m', q.created_at) = m.month) AS enquiries
      FROM m ORDER BY m.month`).all(),
  },
  rejection_reasons: {
    title: 'Quality rejection reasons',
    columns: ['reason', 'count'],
    run: (req) => {
      const f = filters(req);
      return db.prepare(`SELECT REPLACE(r.category, '_', ' ') AS reason, COUNT(*) AS count FROM rejections r JOIN batches b ON b.id = r.batch_id
        WHERE 1 = 1 ${f.sql} GROUP BY r.category ORDER BY count DESC`).all(...f.args);
    },
  },
  scheme_engagement: {
    title: 'Government scheme engagement',
    columns: ['scheme', 'status', 'saved', 'applied'],
    run: () => db.prepare(`SELECT s.name AS scheme, s.status,
        SUM(CASE WHEN a.status = 'saved' THEN 1 ELSE 0 END) AS saved, SUM(CASE WHEN a.status = 'applied' THEN 1 ELSE 0 END) AS applied
      FROM schemes s LEFT JOIN scheme_actions a ON a.scheme_id = s.id GROUP BY s.id ORDER BY applied DESC, saved DESC`).all(),
  },
};

router.get('/reports', (req, res) => {
  res.json({ reports: Object.entries(REPORTS).map(([id, r]) => ({ id, title: r.title })) });
});

router.get('/reports/:id', (req, res) => {
  const r = REPORTS[req.params.id];
  if (!r) return res.status(404).json({ error: 'Unknown report.' });
  const rows = r.run(req);
  const demo = {
    batches: db.prepare('SELECT COUNT(*) AS c FROM batches WHERE is_demo = 1').get().c,
    offers: db.prepare('SELECT COUNT(*) AS c FROM offers WHERE is_demo = 1').get().c,
  };
  if (req.query.format === 'csv') {
    const note = demo.batches || demo.offers ? `# Includes demonstration data (${demo.batches} demo batches, ${demo.offers} demo offers). Not real government statistics.\n` : '';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.csv"`);
    return res.send(`${note}# ${r.title}. Generated ${new Date().toISOString()} by ${req.user.name}\n${toCsv(r.columns, rows)}\n`);
  }
  res.json({ id: req.params.id, title: r.title, columns: r.columns, rows, demo, generated_at: new Date().toISOString() });
});

module.exports = router;
