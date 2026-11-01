import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { Button, Card, Chip, EmptyState, ErrorState, Field, Input, LoadingState, Notice, Select, Textarea } from '../../components/ui/primitives';
import { useO, useOWrite, useOfficerMeta } from '../../api/officer';
import { useUI } from '../../context/UIContext';
import { useDocTitle } from '../../hooks';
import { fmtDate } from '../../lib/format';
import { Modal, PageHead, label, useForm } from './common';

const BLANK = { name: '', department: '', level: 'central', state_id: '', category: '', beneficiaries: '', benefits: '', eligibility: '', documents: '', application_steps: '', official_url: '', source_url: '', publish_at: '', expires_at: '', status: 'draft', districts: '', reason: '' };

export default function OfficerSchemes() {
  useDocTitle('Government schemes');
  const { toast } = useUI();
  const write = useOWrite();
  const meta = useOfficerMeta().data;
  const q = useO('/schemes');
  const [editing, setEditing] = useState(null); // null | 'new' | scheme
  const [form, bind, setForm] = useForm(BLANK);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const openNew = () => { setForm(BLANK); setErr(''); setEditing('new'); };
  const openEdit = (s) => {
    setForm({ ...BLANK, ...s, state_id: s.state_id || '', documents: s.documents.join('\n'), districts: s.districts.join('\n'), publish_at: s.publish_at || '', expires_at: s.expires_at || '', reason: '' });
    setErr(''); setEditing(s);
  };
  async function save(e, status) {
    e.preventDefault(); setBusy(true); setErr('');
    const body = { ...form, state_id: form.state_id || null };
    if (status) body.status = status;
    try {
      if (editing === 'new') await write('/schemes', body); else await write(`/schemes/${editing.id}`, body, 'PATCH');
      toast(body.status === 'published' ? 'Scheme published. It now appears in the main portal.' : 'Scheme saved.');
      setEditing(null);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }
  const setStatus = async (s, status) => {
    try { await write(`/schemes/${s.id}`, { status, reason: `Status changed to ${status}` }, 'PATCH'); toast(`Scheme ${status === 'published' ? 'published' : status === 'inactive' ? 'deactivated' : 'moved to draft'}.`); } catch (ex) { toast(ex.message, 'err'); }
  };
  const tone = (s) => (s.live ? 'green' : s.status === 'published' ? 'amber' : s.status === 'draft' ? 'gray' : 'red');
  const statusText = (s) => (s.live ? 'Live' : s.status === 'published' ? 'Scheduled / expired' : label(s.status));
  const districts = (meta?.districts || []).filter((d) => !form.state_id || d.state_id === form.state_id);

  return (
    <>
      <PageHead title="Government Schemes" sub="Scheme changes published here appear in the main portal’s Government Schemes page.">
        <Button variant="primary" icon="plus" onClick={openNew}>Add scheme</Button>
      </PageHead>
      <Notice tone="amber" icon="info" small className="mb12">Enter only information taken from an official government source. Always include the official application link and source link. Nothing here is invented or pre-filled.</Notice>
      {q.isLoading ? <LoadingState rows={4} /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : q.data.schemes.length === 0 ? (
        <Card><EmptyState icon="book" title="No schemes yet" action={<Button variant="primary" icon="plus" onClick={openNew}>Add scheme</Button>} /></Card>
      ) : (
        <Card>
          <div className="tblwrap"><table className="tbl"><thead><tr><th>Scheme</th><th>Level / area</th><th>Window</th><th>Engagement</th><th>Status</th><th>Last updated</th><th /></tr></thead><tbody>
            {q.data.schemes.map((s) => (
              <tr key={s.id}>
                <td><b>{s.name}</b><div className="sub">{s.department}</div>{s.summary_is_illustrative && <Chip tone="amber">Illustrative summary</Chip>}</td>
                <td>{label(s.level)}<div className="sub">{s.state || 'All states'}</div></td>
                <td className="sub">{s.publish_at ? fmtDate(s.publish_at) : 'Immediate'} → {s.expires_at ? fmtDate(s.expires_at) : 'No expiry'}</td>
                <td className="num">{s.saved} saved · {s.applied} applied</td>
                <td><Chip tone={tone(s)}>{statusText(s)}</Chip></td>
                <td className="sub">{s.last_verified ? fmtDate(s.last_verified) : '—'}</td>
                <td className="o-rowacts">
                  <button type="button" className="link" onClick={() => openEdit(s)}>Edit</button>
                  {s.status !== 'published' ? <button type="button" className="link" onClick={() => setStatus(s, 'published')}>Publish</button> : <button type="button" className="link" onClick={() => setStatus(s, 'inactive')}>Deactivate</button>}
                  {s.live && <Link className="link" to="/schemes">View live</Link>}
                </td>
              </tr>
            ))}
          </tbody></table></div>
        </Card>
      )}

      <Modal open={!!editing} wide title={editing === 'new' ? 'Add scheme' : 'Edit scheme'} onClose={() => setEditing(null)}>
        <form className="o-form" onSubmit={(e) => save(e)}>
          <div className="o-grid2">
            <Field label="Scheme name" required><Input {...bind('name')} /></Field>
            <Field label="Department / issuing authority" required><Input {...bind('department')} /></Field>
            <Field label="Level"><Select {...bind('level')}><option value="central">Central</option><option value="state">State</option><option value="district">District</option></Select></Field>
            <Field label="Applicable state" optional><Select {...bind('state_id')}><option value="">All states</option>{(meta?.states || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
            <Field label="Category" optional><Input {...bind('category')} placeholder="e.g. Livelihood, Credit" /></Field>
            <Field label="Beneficiaries" optional><Input {...bind('beneficiaries')} /></Field>
          </div>
          <Field label="Applicable districts" optional hint="One per line. Leave empty for all districts in the state.">
            <Textarea {...bind('districts')} placeholder={districts.slice(0, 3).map((d) => d.name).join('\n')} />
          </Field>
          <Field label="Eligibility criteria" optional><Textarea {...bind('eligibility')} /></Field>
          <Field label="Benefits" optional><Textarea {...bind('benefits')} /></Field>
          <Field label="Required documents" optional hint="One per line."><Textarea {...bind('documents')} /></Field>
          <Field label="Application instructions" optional><Textarea {...bind('application_steps')} /></Field>
          <div className="o-grid2">
            <Field label="Official application link" required><Input type="url" {...bind('official_url')} placeholder="https://…" /></Field>
            <Field label="Official source (where you read this)" required><Input type="url" {...bind('source_url')} placeholder="https://…" /></Field>
            <Field label="Publish from" optional><Input type="date" {...bind('publish_at')} /></Field>
            <Field label="Expires on" optional><Input type="date" {...bind('expires_at')} /></Field>
          </div>
          {editing !== 'new' && editing?.status === 'published' && <Field label="Reason for change" required hint="This scheme is live. The reason is saved in the audit log."><Input {...bind('reason')} /></Field>}
          {err && <div className="alert-red" role="alert">{err}</div>}
          <div className="acts">
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            {(editing === 'new' || editing?.status !== 'published') && <Button type="submit" disabled={busy} onClick={(e) => save(e, 'draft')}>Save as draft</Button>}
            <Button variant="primary" type="submit" disabled={busy} onClick={(e) => save(e, editing === 'new' || editing?.status !== 'published' ? 'published' : undefined)}>{editing === 'new' || editing?.status !== 'published' ? 'Publish' : 'Save changes'}</Button>
          </div>
          <p className="sub"><Icon name="info" /> Publishing sets “last updated” to today and shows the source link to everyone.</p>
        </form>
      </Modal>
    </>
  );
}
