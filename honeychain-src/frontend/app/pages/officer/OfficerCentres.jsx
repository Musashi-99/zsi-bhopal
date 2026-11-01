import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { Button, Card, Chip, EmptyState, ErrorState, Field, Input, LoadingState, Select, Textarea } from '../../components/ui/primitives';
import { useO, useOWrite } from '../../api/officer';
import { useUI } from '../../context/UIContext';
import { useDocTitle } from '../../hooks';
import { eventMeta, fmtDateTime, timeAgo } from '../../lib/format';
import { Kv, Modal, OStatus, PageHead, fmtQty, label, useForm } from './common';

const TONE = { active: 'green', inactive: 'gray', under_review: 'amber' };

export function OfficerCentres() {
  useDocTitle('Collection centres');
  const nav = useNavigate();
  const q = useO('/centres');
  return (
    <>
      <PageHead title="Collection Centres" sub="Operational status, workload and activity of registered collection centres." />
      {q.isLoading ? <LoadingState rows={4} /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : q.data.centres.length === 0 ? (
        <Card><EmptyState icon="building" title="No collection centres registered" /></Card>
      ) : (
        <div className="o-cards">
          {q.data.centres.map((c) => (
            <Card key={c.id} className="o-centre" onClick={() => nav(`/officer/centres/${c.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && nav(`/officer/centres/${c.id}`)} role="link">
              <div className="row between"><h3>{c.name}</h3><Chip tone={TONE[c.status] || 'gray'}>{label(c.status)}</Chip></div>
              <p className="sub">{c.district_name}, {c.state_name}{c.block_name ? ` · ${c.block_name}` : ''}</p>
              <div className="o-mini">
                <div><b className="num">{c.batches}</b><span>Batches</span></div>
                <div><b className="num">{c.pending}</b><span>Pending</span></div>
                <div><b className="num">{c.collectors}</b><span>Collectors</span></div>
                <div><b className="num">{c.inventory_qty ?? 0}</b><span>In stock</span></div>
              </div>
              <p className="sub">Operator: {c.operator_name || 'not assigned'} · {c.last_activity ? `active ${timeAgo(c.last_activity)}` : 'no activity yet'}</p>
              {c.is_demo && <Chip tone="blue">Demonstration data</Chip>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export function OfficerCentreDetail() {
  const { id } = useParams();
  const { toast } = useUI();
  const write = useOWrite();
  const q = useO(`/centres/${id}`);
  const [edit, setEdit] = useState(false);
  const [form, bind, setForm] = useForm({});
  const [err, setErr] = useState('');
  useDocTitle(q.data ? q.data.centre.name : 'Centre');
  if (q.isLoading) return <LoadingState rows={5} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const { centre: c, operators, collectors, by_status: bs, by_product: bp, inventory, batches, activity, edits } = q.data;

  const startEdit = () => { setForm({ name: c.name, address: c.address || '', block_name: c.block_name || '', status: c.status, linked_groups: c.linked_groups.join('\n'), accreditation_status: c.accreditation_status || 'none', accreditation_note: c.accreditation_note || '', reason: '' }); setErr(''); setEdit(true); };
  async function save(e) {
    e.preventDefault(); setErr('');
    try { await write(`/centres/${id}`, form, 'PATCH'); toast('Centre updated and logged.'); setEdit(false); } catch (ex) { setErr(ex.message); }
  }
  const count = (s) => bs.filter((x) => s.includes(x.status)).reduce((n, x) => n + x.n, 0);

  return (
    <>
      <nav className="crumbs"><Link to="/officer/centres">Collection Centres</Link><Icon name="right" /><b>{c.name}</b></nav>
      <PageHead title={c.name} sub={`${c.district_name}, ${c.state_name}`}><Chip tone={TONE[c.status] || 'gray'}>{label(c.status)}</Chip><Button icon="pencil" onClick={startEdit}>Edit details</Button></PageHead>
      <div className="stat-row four">
        {[['package', 'Submitted batches', bs.filter((x) => x.status !== 'draft').reduce((n, x) => n + x.n, 0), ''], ['clock', 'Pending inspections', count(['pending_verification', 'submitted']), 'amber'],
          ['check', 'Approved', count(['verified', 'verified_with_limitations']), ''], ['xc', 'Rejected', count(['rejected', 'failed_checks']), 'red']].map(([i, l, v, t]) => (
          <div className="card stat" key={l}><span className={`sec-ic ${t}`}><Icon name={i} /></span><div><small>{l}</small><b>{v}</b></div></div>
        ))}
      </div>
      <div className="o-split">
        <div className="o-main o-stack">
          <Card>
            <h3>Recent batches</h3>
            {batches.length === 0 ? <p className="sub">No submitted batches.</p> : (
              <div className="tblwrap"><table className="tbl rows"><thead><tr><th>Batch</th><th>Product</th><th>Qty</th><th>Status</th><th>Updated</th></tr></thead><tbody>
                {batches.map((b) => <tr key={b.id}><td className="num"><Link className="link" to={`/officer/verification/${b.id}`}>{b.batch_code}</Link></td><td>{b.product_name}</td><td className="num">{fmtQty(b.quantity, b.unit)}</td><td><OStatus status={b.status} /></td><td>{timeAgo(b.updated_at)}</td></tr>)}
              </tbody></table></div>
            )}
          </Card>
          <div className="two">
            <Card><h3>Collection by product</h3>{bp.length === 0 ? <p className="sub">None.</p> : <ul className="o-list">{bp.map((p) => <li key={p.label + p.unit}><b>{p.label}</b> <span className="sub">{fmtQty(p.qty, p.unit)} · {p.batches} batch{p.batches > 1 ? 'es' : ''}</span></li>)}</ul>}</Card>
            <Card><h3>Inventory</h3>{inventory.length === 0 ? <p className="sub">No inventory lots.</p> : <ul className="o-list">{inventory.map((i) => <li key={i.status + i.unit}><b>{label(i.status)}</b> <span className="sub">{fmtQty(i.qty, i.unit)} · {i.lots} lot{i.lots > 1 ? 's' : ''}</span></li>)}</ul>}</Card>
          </div>
          <Card>
            <h3>Activity history</h3>
            {activity.length === 0 ? <p className="sub">No activity yet.</p> : <ul className="feed">{activity.map((e) => { const [l, , ic] = eventMeta(e.event_type); return <li key={e.seq}><span className="sec-ic sm"><Icon name={ic} /></span><div><b>{l}</b><div className="sub">{e.batch_code} · {e.actor_name || 'System'}</div></div><span className="sub">{timeAgo(e.timestamp)}</span></li>; })}</ul>}
            {edits.length > 0 && <><h3 className="mt16">Record changes</h3><ul className="o-list">{edits.map((x) => <li key={x.id}><b>{label(x.action)}</b> <span className="sub">{fmtDateTime(x.created_at)}</span><div className="sub">Reason: {x.reason}</div></li>)}</ul></>}
          </Card>
        </div>
        <aside className="o-side">
          <Card><h3>Details</h3><Kv rows={[['Address', c.address], ['Block', c.block_name], ['District', c.district_name], ['State', c.state_name], ['Status', label(c.status)], ['AranyaValue accreditation', label(c.accreditation_status || 'none')], ['Government registration', c.govt_registration || 'None recorded']]} />{c.accreditation_note && <p className="sub mt8">{c.accreditation_note}</p>}<p className="sub mt8">AranyaValue accreditation is a private programme. It is not a government licence.</p>{c.coverage_note && <p className="sub mt8">{c.coverage_note}</p>}</Card>
          <Card><h3>Centre operators</h3>{operators.length === 0 ? <p className="sub">None assigned.</p> : <ul className="o-list">{operators.map((o) => <li key={o.id}><b>{o.name}</b> <span className="sub">{o.phone || ''}{!o.active && ' · inactive'}</span></li>)}</ul>}</Card>
          <Card><h3>Associated SHGs / VDVKs</h3>{c.linked_groups.length === 0 ? <p className="sub">None recorded. Add them with “Edit details”.</p> : <ul className="o-list">{c.linked_groups.map((g) => <li key={g}>{g}</li>)}</ul>}</Card>
          <Card><h3>Collectors supplying</h3>{collectors.length === 0 ? <p className="sub">None yet.</p> : <ul className="o-list">{collectors.map((u) => <li key={u.id}><Link className="link" to={`/officer/collectors/${u.id}`}>{u.name}</Link> <span className="sub">{u.batches} batch{u.batches > 1 ? 'es' : ''}</span></li>)}</ul>}</Card>
        </aside>
      </div>

      <Modal open={edit} title="Edit centre details" onClose={() => setEdit(false)}>
        <form className="o-form" onSubmit={save}>
          <Field label="Centre name" required><Input {...bind('name')} /></Field>
          <div className="o-grid2">
            <Field label="Status"><Select {...bind('status')}><option value="active">Active</option><option value="under_review">Under review</option><option value="inactive">Inactive</option></Select></Field>
            <Field label="Block" optional><Input {...bind('block_name')} /></Field>
          </div>
          <Field label="Address" optional><Input {...bind('address')} /></Field>
          <Field label="AranyaValue accreditation" hint="Private programme only. Suspending it removes the accredited mark from the marketplace."><Select {...bind('accreditation_status')}><option value="none">Not accredited</option><option value="active">Accredited</option><option value="suspended">Suspended</option><option value="expired">Expired</option></Select></Field>
          <Field label="Accreditation note" optional><Textarea {...bind('accreditation_note')} /></Field>
          <Field label="Associated SHGs / VDVKs" optional hint="One per line."><Textarea {...bind('linked_groups')} /></Field>
          <Field label="Reason for change" required hint="Saved with the before and after values in the audit log."><Input {...bind('reason')} /></Field>
          {err && <div className="alert-red" role="alert">{err}</div>}
          <div className="acts"><Button onClick={() => setEdit(false)}>Cancel</Button><Button variant="primary" type="submit">Save changes</Button></div>
        </form>
      </Modal>
    </>
  );
}
