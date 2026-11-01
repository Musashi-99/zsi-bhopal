import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { Button, Card, EmptyState, ErrorState, FilterSelect, LoadingState, Pagination, SearchInput } from '../../components/ui/primitives';
import { useO, useOfficerMeta, oqs } from '../../api/officer';
import { useDocTitle } from '../../hooks';
import { fmtDate, timeAgo } from '../../lib/format';
import { OStatus, PageHead, fmtQty, useDebounced } from './common';

const PAGE = 15;
const STATUS_OPTS = [
  { value: '', label: 'All statuses' }, { value: 'pending', label: 'Pending verification' }, { value: 'correction', label: 'Correction requested' },
  { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' },
];

export default function OfficerVerification() {
  useDocTitle('Batch verification');
  const nav = useNavigate();
  const meta = useOfficerMeta().data;
  const [f, setF] = useState({ status: 'pending', state: '', district: '', block: '', centre: '', product: '', from: '', to: '', q: '' });
  const [page, setPage] = useState(1);
  const set = (k) => (v) => { setF((s) => ({ ...s, [k]: v, ...(k === 'state' ? { district: '', centre: '' } : {}), ...(k === 'district' ? { centre: '' } : {}) })); setPage(1); };
  const q = useDebounced(f.q);
  const block = useDebounced(f.block);
  const params = { ...f, q, block, limit: PAGE, offset: (page - 1) * PAGE };
  const res = useO(`/batches${oqs(params)}`, { placeholderData: (p) => p });

  const districts = (meta?.districts || []).filter((d) => !f.state || d.state_id === f.state);
  const centres = (meta?.centres || []).filter((c) => !f.district || c.district_id === f.district);
  const opt = (list, all) => [{ value: '', label: all }, ...list.map((x) => ({ value: x.id, label: x.name }))];
  const pages = Math.max(1, Math.ceil((res.data?.total || 0) / PAGE));
  const active = Object.entries(f).some(([k, v]) => v && !(k === 'status' && v === 'pending'));

  return (
    <>
      <PageHead title="Batch Verification" sub="Review submitted batches, inspect evidence, then approve, reject or request a correction." />
      <Card className="o-filters">
        <SearchInput value={f.q} onChange={set('q')} placeholder="Search batch ID, product or collector" />
        <div className="o-filter-grid">
          <FilterSelect label="Status" value={f.status} onChange={set('status')} options={STATUS_OPTS} />
          <FilterSelect label="State" value={f.state} onChange={set('state')} options={opt(meta?.states || [], 'All states')} />
          <FilterSelect label="District" value={f.district} onChange={set('district')} options={opt(districts, 'All districts')} />
          <label className="fgroup"><span>Block</span><input className="inp" value={f.block} onChange={(e) => set('block')(e.target.value)} placeholder="Any block" /></label>
          <FilterSelect label="Collection centre" value={f.centre} onChange={set('centre')} options={opt(centres, 'All centres')} />
          <FilterSelect label="Product" value={f.product} onChange={set('product')} options={opt(meta?.products || [], 'All products')} />
          <label className="fgroup"><span>Submitted from</span><input className="inp" type="date" value={f.from} onChange={(e) => set('from')(e.target.value)} /></label>
          <label className="fgroup"><span>Submitted to</span><input className="inp" type="date" value={f.to} onChange={(e) => set('to')(e.target.value)} /></label>
        </div>
        {active && <div><Button size="sm" icon="refresh" onClick={() => { setF({ status: 'pending', state: '', district: '', block: '', centre: '', product: '', from: '', to: '', q: '' }); setPage(1); }}>Reset filters</Button></div>}
      </Card>

      <Card className="mt12">
        {res.isLoading ? <LoadingState rows={5} /> : res.error ? <ErrorState error={res.error} onRetry={res.refetch} /> : res.data.batches.length === 0 ? (
          <EmptyState icon="shieldcheck" title="No batches match these filters">Try clearing a filter or switching the status.</EmptyState>
        ) : (
          <>
            <div className="row between mb12"><b>{res.data.total} batch{res.data.total === 1 ? '' : 'es'}</b><span className="sub">Oldest pending first</span></div>
            <div className="tblwrap">
              <table className="tbl rows">
                <thead><tr><th>Batch ID</th><th>Product</th><th>Collector</th><th>Location</th><th>Qty</th><th>Submitted</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {res.data.batches.map((b) => (
                    <tr key={b.id} tabIndex={0} onClick={() => nav(`/officer/verification/${b.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/officer/verification/${b.id}`)}>
                      <td className="num"><b>{b.batch_code}</b>{b.is_demo ? <div className="demo-pill-sm">demo</div> : null}</td>
                      <td>{b.product_name}<div className="sub">{b.centre_name || 'Direct collector'}</div></td>
                      <td>{b.collector_name}{b.revisions > 1 && <div className="sub">Revision {b.revisions}</div>}</td>
                      <td>{b.district_name}<div className="sub">{b.block_name ? `${b.block_name}, ` : ''}{b.state_name}</div></td>
                      <td className="num">{fmtQty(b.quantity, b.unit)}</td>
                      <td title={fmtDate(b.submitted_at)}>{timeAgo(b.submitted_at)}</td>
                      <td><OStatus status={b.status} /></td>
                      <td><Icon name="right" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && <Pagination page={page} pages={pages} onChange={setPage} />}
          </>
        )}
      </Card>
    </>
  );
}
