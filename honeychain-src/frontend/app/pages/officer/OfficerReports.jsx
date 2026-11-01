import { useState } from 'react';
import { Button, Card, EmptyState, ErrorState, FilterSelect, LoadingState, Notice } from '../../components/ui/primitives';
import { useO, useOfficerMeta, oqs, reportUrl } from '../../api/officer';
import { useDocTitle } from '../../hooks';
import { PageHead, label } from './common';

const NO_LOC = ['buyer_demand', 'scheme_engagement'];

export default function OfficerReports() {
  useDocTitle('Reports and analytics');
  const meta = useOfficerMeta().data;
  const list = useO('/reports');
  const [id, setId] = useState('district_collection');
  const [f, setF] = useState({ from: '', to: '', state: '', district: '' });
  const params = NO_LOC.includes(id) ? {} : f;
  const rep = useO(`/reports/${id}${oqs(params)}`);
  const districts = (meta?.districts || []).filter((d) => !f.state || d.state_id === f.state);
  const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('en-IN') : v ?? '—');
  const maxFirstNum = rep.data ? Math.max(1, ...rep.data.rows.map((r) => Number(r[rep.data.columns.find((c) => typeof r[c] === 'number')]) || 0)) : 1;
  const numCol = rep.data?.columns.find((c) => rep.data.rows.some((r) => typeof r[c] === 'number'));
  const demo = rep.data && (rep.data.demo.batches || rep.data.demo.offers);

  return (
    <>
      <PageHead title="Reports & Analytics" sub="Computed from stored records. Download any report as CSV." />
      <div className="o-split o-reports">
        <aside className="o-side">
          <Card>
            <h3>Reports</h3>
            <ul className="o-reportlist">
              {(list.data?.reports || []).map((r) => <li key={r.id}><button type="button" className={id === r.id ? 'on' : ''} onClick={() => setId(r.id)}>{r.title}</button></li>)}
            </ul>
          </Card>
          <Card>
            <h3>Filters</h3>
            {NO_LOC.includes(id) ? <p className="sub">This report does not use date or location filters.</p> : (
              <div className="o-form">
                <label className="fgroup"><span>From</span><input className="inp" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
                <label className="fgroup"><span>To</span><input className="inp" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
                <FilterSelect label="State" value={f.state} onChange={(v) => setF({ ...f, state: v, district: '' })} options={[{ value: '', label: 'All states' }, ...(meta?.states || []).map((s) => ({ value: s.id, label: s.name }))]} />
                <FilterSelect label="District" value={f.district} onChange={(v) => setF({ ...f, district: v })} options={[{ value: '', label: 'All districts' }, ...districts.map((s) => ({ value: s.id, label: s.name }))]} />
              </div>
            )}
          </Card>
        </aside>
        <div className="o-main">
          <Card>
            <div className="row between wrap mb12">
              <div><h2>{rep.data?.title || 'Report'}</h2>{rep.data && <p className="sub">{rep.data.rows.length} row{rep.data.rows.length === 1 ? '' : 's'} · generated {new Date(rep.data.generated_at).toLocaleString('en-IN')}</p>}</div>
              <Button variant="primary" icon="download" href={reportUrl(id, params)} download>Download CSV</Button>
            </div>
            {demo ? <Notice tone="blue" icon="info" small className="mb12">This report includes demonstration data ({rep.data.demo.batches} demo batches, {rep.data.demo.offers} demo offers). It is not a real government statistic.</Notice> : null}
            {rep.isLoading ? <LoadingState rows={5} /> : rep.error ? <ErrorState error={rep.error} onRetry={rep.refetch} /> : rep.data.rows.length === 0 ? <EmptyState icon="chart" title="No records for these filters" /> : (
              <div className="tblwrap"><table className="tbl"><thead><tr>{rep.data.columns.map((c) => <th key={c}>{label(c)}</th>)}{numCol && <th aria-label="Share" style={{ width: 120 }} />}</tr></thead><tbody>
                {rep.data.rows.map((r, i) => (
                  <tr key={i}>{rep.data.columns.map((c) => <td key={c} className={typeof r[c] === 'number' ? 'num' : ''}>{fmt(r[c])}</td>)}
                    {numCol && <td><span className="o-spark"><i style={{ width: `${((Number(r[numCol]) || 0) / maxFirstNum) * 100}%` }} /></span></td>}</tr>
                ))}
              </tbody></table></div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
