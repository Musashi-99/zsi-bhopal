import { useState } from 'react';
import Icon from '../../components/ui/Icon';
import { Button, Card, Chip, EmptyState, ErrorState, Field, Input, LoadingState, Notice, Select, Tabs } from '../../components/ui/primitives';
import { useO, useOWrite, useOfficerMeta } from '../../api/officer';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useDocTitle } from '../../hooks';
import { eventMeta, fmtDateTime, fmtDate } from '../../lib/format';
import { Kv, Modal, PageHead, label, useForm } from './common';

export function OfficerAudit() {
  useDocTitle('Audit logs');
  const [kind, setKind] = useState('');
  const [open, setOpen] = useState(null);
  const q = useO(`/audit${kind ? `?kind=${kind}` : ''}`);
  const tabs = [{ key: '', label: 'All events' }, { key: 'batch', label: 'Batch events' }, { key: 'admin', label: 'Changes & decisions' }];
  return (
    <>
      <PageHead title="Audit Logs" sub="Who did what, when, and to which record." />
      {q.data && (
        <Card tone={q.data.chain.valid ? 'tint' : 'red'} className="mb12">
          <div className="row"><span className={`sec-ic ${q.data.chain.valid ? '' : 'red'}`}><Icon name="hexa" /></span>
            <div><b>Hash-chain check: {q.data.chain.valid ? 'intact' : `${q.data.chain.broken.length} event(s) do not match`}</b>
              <div className="sub">{q.data.chain.total_events} batch events verified. {q.data.note}</div></div></div>
        </Card>
      )}
      <Tabs tabs={tabs} value={kind} onChange={setKind} id="oa" />
      <Card className="mt12">
        {q.isLoading ? <LoadingState rows={6} /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : q.data.events.length === 0 ? <EmptyState icon="log" title="No events recorded" /> : (
          <div className="tblwrap"><table className="tbl rows"><thead><tr><th>Event ID</th><th>Time</th><th>Action</th><th>Record</th><th>Actor</th><th /></tr></thead><tbody>
            {q.data.events.map((e) => {
              const [l] = eventMeta(e.action);
              const hasDetail = e.detail && (e.detail.reason || e.detail.before || e.detail.after);
              return (
                <tr key={e.event_id} tabIndex={0} onClick={() => setOpen(e)} onKeyDown={(k) => k.key === 'Enter' && setOpen(e)}>
                  <td className="num sub" title={e.event_id}>{e.source === 'batch_chain' ? `#${e.seq}` : e.event_id}</td>
                  <td title={fmtDateTime(e.timestamp)}>{fmtDateTime(e.timestamp)}</td>
                  <td><b>{e.source === 'batch_chain' ? l : label(e.action)}</b><div className="sub">{e.source === 'batch_chain' ? 'Hash-chained' : 'Audit log'}</div></td>
                  <td>{e.entity}</td><td>{e.actor_name}{e.actor_role && <div className="sub">{e.actor_role}</div>}</td>
                  <td>{hasDetail ? <Icon name="right" /> : null}</td>
                </tr>
              );
            })}
          </tbody></table></div>
        )}
      </Card>
      <Modal open={!!open} wide title="Event detail" onClose={() => setOpen(null)}>
        {open && (
          <>
            <Kv rows={[['Event ID', open.event_id], ['Actor', `${open.actor_name} (${open.actor_id || 'system'}, ${open.actor_role || 'n/a'})`], ['Timestamp', fmtDateTime(open.timestamp)], ['Affected record', open.entity], ['Reason', open.detail?.reason], ['Chain hash', open.hash]]} />
            {(open.detail?.before || open.detail?.after) && (
              <div className="o-diff"><div><h4>Previous</h4><pre>{JSON.stringify(open.detail.before, null, 2)}</pre></div><div><h4>Updated</h4><pre>{JSON.stringify(open.detail.after, null, 2)}</pre></div></div>
            )}
            {open.source === 'batch_chain' && <pre className="o-pre">{JSON.stringify(open.detail, null, 2)}</pre>}
          </>
        )}
      </Modal>
    </>
  );
}

export function OfficerOfficers() {
  useDocTitle('Officer management');
  const { user } = useAuth();
  const { toast } = useUI();
  const write = useOWrite();
  const meta = useOfficerMeta().data;
  const isAdmin = user.role === 'admin';
  const q = useO('/officers', { enabled: isAdmin });
  const [dlg, setDlg] = useState(null); // 'new' | officer
  const [form, bind, setForm] = useForm({});
  const [err, setErr] = useState('');

  if (!isAdmin) {
    return (
      <>
        <PageHead title="Officer Management" />
        <Card><EmptyState icon="lock" title="Administrators only">Officer accounts are created, approved and deactivated by an authorised administrator. Contact your administrator to change an account or jurisdiction.</EmptyState></Card>
      </>
    );
  }
  const openNew = () => { setForm({ level: 'district', state_id: 'ST-WB' }); setErr(''); setDlg('new'); };
  const openEdit = (o) => { setForm({ level: o.level || 'district', designation: o.designation || '', state_id: o.state_id || '', district_id: o.district_id || '', reason: '' }); setErr(''); setDlg(o); };
  const districts = (meta?.districts || []).filter((d) => !form.state_id || d.state_id === form.state_id);

  async function save(e) {
    e.preventDefault(); setErr('');
    try {
      if (dlg === 'new') await write('/officers', form); else await write(`/officers/${dlg.id}`, form, 'PATCH');
      toast(dlg === 'new' ? 'Officer account created.' : 'Officer updated and logged.'); setDlg(null);
    } catch (ex) { setErr(ex.message); }
  }
  const toggle = async (o) => {
    const reason = window.prompt(`Reason for ${o.active ? 'deactivating' : 'reactivating'} ${o.name}:`);
    if (!reason) return;
    try { await write(`/officers/${o.id}`, { active: !o.active, reason }, 'PATCH'); toast('Officer updated and logged.'); } catch (ex) { toast(ex.message, 'err'); }
  };

  return (
    <>
      <PageHead title="Officer Management" sub="Create and manage Government Officer accounts and their jurisdiction."><Button variant="primary" icon="plus" onClick={openNew}>Create officer</Button></PageHead>
      <Notice tone="blue" icon="info" small className="mb12">{q.data?.note} Every change is written to the audit log with the reason you give.</Notice>
      <Card>
        {q.isLoading ? <LoadingState rows={4} /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : (
          <div className="tblwrap"><table className="tbl"><thead><tr><th>Officer</th><th>Level</th><th>Jurisdiction</th><th>Decisions</th><th>Created</th><th>Status</th><th /></tr></thead><tbody>
            {q.data.officers.map((o) => (
              <tr key={o.id}><td><b>{o.name}</b><div className="sub">{o.email}</div>{o.designation && <div className="sub">{o.designation}</div>}</td>
                <td>{o.level ? label(o.level) : <span className="sub">no profile</span>}</td><td>{o.district_name || o.state_name || 'Unrestricted'}</td><td className="num">{o.decisions}</td><td>{fmtDate(o.created_at)}</td>
                <td>{o.active ? <Chip tone="green">Active</Chip> : <Chip tone="gray">Deactivated</Chip>}{o.is_demo && <Chip tone="blue">demo</Chip>}</td>
                <td className="o-rowacts"><button type="button" className="link" onClick={() => openEdit(o)}>Edit</button><button type="button" className="link" onClick={() => toggle(o)}>{o.active ? 'Deactivate' : 'Reactivate'}</button></td></tr>
            ))}
          </tbody></table></div>
        )}
      </Card>
      <Modal open={!!dlg} title={dlg === 'new' ? 'Create officer account' : 'Edit officer'} onClose={() => setDlg(null)}>
        <form className="o-form" onSubmit={save}>
          {dlg === 'new' && <>
            <Field label="Full name" required><Input {...bind('name')} /></Field>
            <Field label="Official email" required><Input type="email" {...bind('email')} autoComplete="off" /></Field>
            <Field label="Temporary password" required hint="At least 10 characters. Share it securely; the officer should change it in Settings."><Input type="password" {...bind('password')} autoComplete="new-password" /></Field>
          </>}
          <Field label="Designation" optional><Input {...bind('designation')} placeholder="e.g. District Forest Officer" /></Field>
          <div className="o-grid2">
            <Field label="Level"><Select {...bind('level')}><option value="district">District officer</option><option value="state">State officer</option></Select></Field>
            <Field label="State"><Select {...bind('state_id')}><option value="">Select</option>{(meta?.states || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          </div>
          {form.level === 'district' && <Field label="District" required><Select {...bind('district_id')}><option value="">Select</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>}
          <Field label="Reason" required={dlg !== 'new'} optional={dlg === 'new'}><Input {...bind('reason')} /></Field>
          {err && <div className="alert-red" role="alert">{err}</div>}
          <div className="acts"><Button onClick={() => setDlg(null)}>Cancel</Button><Button variant="primary" type="submit">{dlg === 'new' ? 'Create account' : 'Save'}</Button></div>
        </form>
      </Modal>
    </>
  );
}

export function OfficerSettings() {
  useDocTitle('Settings');
  const { toast } = useUI();
  const write = useOWrite();
  const q = useO('/settings');
  const [form, bind, setForm] = useForm({});
  const [err, setErr] = useState('');
  async function change(e) {
    e.preventDefault(); setErr('');
    try { await write('/settings/password', { current: form.current, next: form.next }); toast('Password changed.'); setForm({}); } catch (ex) { setErr(ex.message); }
  }
  if (q.isLoading) return <LoadingState rows={4} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const { account: a, jurisdiction: j, notifications: n } = q.data;
  return (
    <>
      <PageHead title="Settings" sub="Your account, jurisdiction and security." />
      <div className="two">
        <Card><h3>Account</h3><Kv rows={[['Name', a.name], ['Email', a.email], ['Role', a.role], ['Organisation', a.organisation]]} /></Card>
        <Card><h3>Jurisdiction</h3>
          <Kv rows={[['Level', label(j.level)], ['Designation', j.designation], ['State', j.state], ['District', j.district]]} />
          <p className="sub mt8">{j.level === 'unrestricted' || j.level === 'all' ? 'No jurisdiction limit is set, so you see all records.' : 'You only see batches, centres and collectors inside this area. An administrator can change it.'}</p></Card>
        <Card><h3>Notifications</h3><Kv rows={[['Unread', n.unread], ['Total received', n.total]]} /><p className="sub mt8">You are notified of new and resubmitted batches in your area.</p></Card>
        <Card>
          <h3>Change password</h3>
          <form className="o-form" onSubmit={change}>
            <Field label="Current password"><Input type="password" {...bind('current')} autoComplete="current-password" /></Field>
            <Field label="New password" hint="At least 10 characters."><Input type="password" {...bind('next')} autoComplete="new-password" /></Field>
            {err && <div className="alert-red" role="alert">{err}</div>}
            <div className="acts"><Button variant="primary" type="submit">Update password</Button></div>
          </form>
        </Card>
      </div>
    </>
  );
}
