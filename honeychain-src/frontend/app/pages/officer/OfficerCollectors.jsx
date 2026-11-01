import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { Card, Chip, EmptyState, ErrorState, LoadingState, Notice, SearchInput } from '../../components/ui/primitives';
import { useO } from '../../api/officer';
import { useDocTitle } from '../../hooks';
import { eventMeta, fmtDate, timeAgo } from '../../lib/format';
import { Kv, OStatus, PageHead, fmtQty } from './common';

export function OfficerCollectors() {
  useDocTitle('Collector management');
  const nav = useNavigate();
  const q = useO('/collectors');
  const [s, setS] = useState('');
  const [flagged, setFlagged] = useState(false);
  const rows = useMemo(() => (q.data?.collectors || []).filter((c) => (!flagged || c.flags > 0) && (!s || `${c.name} ${c.district_name || ''}`.toLowerCase().includes(s.toLowerCase()))), [q.data, s, flagged]);
  return (
    <>
      <PageHead title="Collector Management" sub="Registered collectors and producers, their activity and records worth a second look." />
      {q.data && (
        <div className="stat-row four">
          <div className="card stat"><span className="sec-ic"><Icon name="users" /></span><div><small>Collectors</small><b>{q.data.totals.collectors}</b></div></div>
          <div className="card stat"><span className="sec-ic amber"><Icon name="alert" /></span><div><small>With flagged records</small><b>{q.data.totals.flagged}</b></div></div>
        </div>
      )}
      <Card>
        <div className="row wrap mb12"><SearchInput value={s} onChange={setS} placeholder="Search collector or district" style={{ flex: 1, minWidth: 220 }} />
          <label className="check-row"><input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} /> Flagged only</label></div>
        {q.isLoading ? <LoadingState rows={5} /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : rows.length === 0 ? <EmptyState icon="users" title="No collectors match" /> : (
          <div className="tblwrap"><table className="tbl rows"><thead><tr><th>Collector</th><th>District</th><th>Centres</th><th>Batches</th><th>Approved</th><th>Rejected</th><th>Flags</th><th>Account</th></tr></thead><tbody>
            {rows.map((c) => (
              <tr key={c.id} tabIndex={0} onClick={() => nav(`/officer/collectors/${c.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/officer/collectors/${c.id}`)}>
                <td><b>{c.name}</b>{c.organisation && <div className="sub">{c.organisation}</div>}</td><td>{c.district_name || '—'}</td><td>{c.centres.join(', ') || <span className="sub">direct</span>}</td>
                <td className="num">{c.batches}</td><td className="num">{c.approved}</td><td className="num">{c.rejected}</td>
                <td>{c.flags ? <Chip tone="amber">{c.flags}</Chip> : <span className="sub">0</span>}</td>
                <td>{c.active ? <Chip tone="green">Active</Chip> : <Chip tone="gray">Deactivated</Chip>}{c.is_demo && <Chip tone="blue">demo</Chip>}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </Card>
    </>
  );
}

export function OfficerCollectorDetail() {
  const { id } = useParams();
  const q = useO(`/collectors/${id}`);
  useDocTitle(q.data ? q.data.collector.name : 'Collector');
  if (q.isLoading) return <LoadingState rows={5} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const { collector: c, batches, activity, privacy_note: note } = q.data;
  const flagged = batches.filter((b) => b.flags.length);
  return (
    <>
      <nav className="crumbs"><Link to="/officer/collectors">Collector Management</Link><Icon name="right" /><b>{c.name}</b></nav>
      <PageHead title={c.name} sub={c.organisation || 'Collector'}>{c.active ? <Chip tone="green">Active account</Chip> : <Chip tone="gray">Deactivated</Chip>}{c.is_demo && <Chip tone="blue">Demonstration data</Chip>}</PageHead>
      {note && <Notice tone="blue" icon="lock" small className="mb12">{note}</Notice>}
      <div className="o-split">
        <div className="o-main o-stack">
          {flagged.length > 0 && (
            <Card tone="amber">
              <h3>Records worth reviewing</h3>
              <p className="sub">Automatic checks only. A flag is a prompt to look, not a finding of wrongdoing.</p>
              <ul className="o-list">{flagged.map((b) => <li key={b.id}><Link className="link" to={`/officer/verification/${b.id}`}>{b.batch_code}</Link>{b.flags.map((f) => <div className="sub" key={f.text}>{f.text}</div>)}</li>)}</ul>
            </Card>
          )}
          <Card>
            <h3>Submitted batches</h3>
            {batches.length === 0 ? <p className="sub">No submitted batches.</p> : (
              <div className="tblwrap"><table className="tbl"><thead><tr><th>Batch</th><th>Product</th><th>Qty</th><th>Collected</th><th>Centre</th><th>Status</th></tr></thead><tbody>
                {batches.map((b) => <tr key={b.id}><td className="num"><Link className="link" to={`/officer/verification/${b.id}`}>{b.batch_code}</Link></td><td>{b.product_name}</td><td className="num">{fmtQty(b.quantity, b.unit)}</td><td>{fmtDate(b.collection_date)}</td><td>{b.centre_name || '—'}</td><td><OStatus status={b.status} /></td></tr>)}
              </tbody></table></div>
            )}
          </Card>
        </div>
        <aside className="o-side">
          <Card><h3>Account</h3><Kv rows={[['Status', c.account_status], ['Member since', fmtDate(c.member_since)], ['Phone', c.phone], ['Email', c.email]]} /></Card>
          <Card><h3>Participation history</h3>{activity.length === 0 ? <p className="sub">No recorded actions.</p> : <ul className="feed">{activity.map((e) => { const [l, , ic] = eventMeta(e.event_type); return <li key={e.seq}><span className="sec-ic sm"><Icon name={ic} /></span><div><b>{l}</b><div className="sub">{e.batch_code}</div></div><span className="sub">{timeAgo(e.timestamp)}</span></li>; })}</ul>}</Card>
        </aside>
      </div>
    </>
  );
}
