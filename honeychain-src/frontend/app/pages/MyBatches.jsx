import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageHero from '../components/layout/PageHero';
import { Button, Card, EmptyState, FilterSelect, Img, Pagination, Query, SearchInput, StatusBadge } from '../components/ui/primitives';
import { useBatches } from '../api/queries';
import { useDebounced, useDocTitle } from '../hooks';
import { fmtDate, productImage, timeAgo } from '../lib/format';

const STATUSES = [
  { value: '', label: 'All' }, { value: 'draft', label: 'Draft' }, { value: 'pending_verification', label: 'In Assessment' },
  { value: 'needs_info', label: 'Needs Info' }, { value: 'verified', label: 'Completed' }, { value: 'verified_with_limitations', label: 'Conditional' }, { value: 'rejected', label: 'Rejected' },
];
const PAGE = 8;

export default function MyBatches() {
  useDocTitle('My Batches');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const status = params.get('status') || '';
  const product = params.get('product') || '';
  const dq = useDebounced(q);
  const query = useBatches({ q: dq, status });

  const setFilter = (k, v) => { const n = new URLSearchParams(params); v ? n.set(k, v) : n.delete(k); setParams(n, { replace: true }); setPage(1); };
  const products = useMemo(() => ['', ...new Set((query.data || []).map((b) => b.product))], [query.data]);
  const rows = useMemo(() => (query.data || []).filter((b) => !product || b.product === product), [query.data, product]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice((page - 1) * PAGE, page * PAGE);
  const clear = () => { setQ(''); setParams({}, { replace: true }); setPage(1); };

  return (
    <>
      <PageHero title="My Batches" sub="View, search and manage every forest produce batch you have recorded.">
        <Button to="/batches/new" variant="primary" icon="plus" className="hero-cta">Create New Batch</Button>
      </PageHero>
      <div className="row wrap mb12" style={{ alignItems: 'flex-end' }}>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search by batch code, product or district…" label="Search batches" />
        <FilterSelect label="Status" value={status} onChange={(v) => setFilter('status', v)} options={STATUSES} />
        <FilterSelect label="Produce" value={product} onChange={(v) => setFilter('product', v)} options={products.map((p) => ({ value: p, label: p || 'All' }))} />
        <Button onClick={clear} style={{ height: 44 }}>Clear Filters</Button>
      </div>
      <Card>
        <Query q={query} rows={5} empty={null}>
          {() => (
            <>
              <div className="row between mb12"><b>Showing {view.length} of {rows.length} batches</b></div>
              {rows.length === 0 ? (
                <EmptyState icon="package" title="No batches match your filters" action={<Button onClick={clear}>Clear Filters</Button>}>Try a different search, or create a new batch.</EmptyState>
              ) : (
                <div className="tblwrap">
                  <table className="tbl rows">
                    <thead><tr><th>Batch</th><th>Product</th><th>Quantity</th><th>Collected</th><th>Status</th><th>Updated</th><th style={{ width: 200 }}>Actions</th></tr></thead>
                    <motion.tbody layout>
                      <AnimatePresence initial={false}>
                        {view.map((b, i) => {
                          const rejected = ['rejected', 'failed_checks'].includes(b.status);
                          return (
                            <motion.tr key={b.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}
                              onClick={() => navigate(`/passport/${b.id}`)}>
                              <td><b>{b.batch_code}</b>{b.is_demo && <div className="demo-pill" style={{ marginTop: 2 }}>demo data</div>}</td>
                              <td><span className="row"><Img name={productImage(b.product)} className="thumb" alt="" />{b.product}</span></td>
                              <td>{b.quantity} {b.unit}</td><td>{fmtDate(b.collection_date)}</td>
                              <td><StatusBadge status={b.status} /></td><td>{timeAgo(b.updated_at)}</td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <span className="row">
                                  {b.status === 'draft' ? <Button size="xs" variant="outline-g" to={`/batches/${b.id}/edit`}>Continue</Button>
                                    : rejected ? <Button size="xs" variant="outline-g" to={`/rejections/${b.id}`}>Recovery</Button>
                                      : <Button size="xs" variant="outline-g" to={`/passport/${b.id}`}>Passport</Button>}
                                  <Button size="xs" to={`/quality-price/${b.id}`}>Price</Button>
                                </span>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </motion.tbody>
                  </table>
                </div>
              )}
              {pages > 1 && <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}><Pagination page={page} pages={pages} onChange={setPage} /></div>}
            </>
          )}
        </Query>
      </Card>
    </>
  );
}
