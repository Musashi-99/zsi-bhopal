import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import Icon from '../../components/ui/Icon';
import { Button, Card, Chip, EmptyState, ErrorState, Field, Input, LoadingState, Notice, Select, Tabs, Textarea } from '../../components/ui/primitives';
import { useO, useOWrite, useOfficerMeta } from '../../api/officer';
import { useUI } from '../../context/UIContext';
import { useDocTitle } from '../../hooks';
import { eventMeta, fmtDate, fmtDateTime } from '../../lib/format';
import { Kv, Modal, OStatus, PageHead, fmtQty, label, useForm } from './common';

const LAYERS = [
  ['self_reported', 'Self-reported by collector', 'gray'],
  ['ai_assisted', 'AI-assisted assessment (not a decision)', 'purple'],
  ['instrument', 'Instrument measurement (officer-recorded)', 'blue'],
  ['laboratory', 'Laboratory result (officer-recorded)', 'green'],
  ['officer_review', 'Officer review decisions', 'amber'],
];

export default function OfficerBatchDetail() {
  const { id } = useParams();
  const { toast } = useUI();
  const write = useOWrite();
  const meta = useOfficerMeta().data;
  const q = useO(`/batches/${id}`);
  const [tab, setTab] = useState('overview');
  const [dlg, setDlg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [form, bind, setForm] = useForm({});
  useDocTitle(q.data ? q.data.batch.batch_code : 'Batch');

  if (q.isLoading) return <LoadingState rows={6} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const d = q.data;
  const b = d.batch;
  const open = (kind) => { setDlg(kind); setErr(''); setForm(kind === 'reject' ? { category: 'evidence_insufficient' } : {}); };

  async function submit(kind) {
    setBusy(true); setErr('');
    try {
      let body;
      let path;
      if (kind === 'approve') { path = 'approve'; body = { summary: form.summary, limitations: form.limitations }; }
      if (kind === 'reject') { path = 'reject'; body = { category: form.category, explanation: form.explanation, remarks: form.remarks }; }
      if (kind === 'correct') { path = 'request-correction'; body = { items: String(form.items || '').split('\n'), message: form.message }; }
      if (kind === 'suspend') { path = 'suspend'; body = { reason: form.reason }; }
      if (kind === 'reinstate') { path = 'reinstate'; body = { reason: form.reason }; }
      await write(`/batches/${id}/${path}`, body);
      toast({
        approve: 'Batch approved. The marketplace reads this status immediately.',
        reject: 'Rejection recorded. The marketplace now shows this batch as rejected.',
        correct: 'Correction request sent to the collector.',
        suspend: 'Batch suspended. Buyers will see the warning on the next view.',
        reinstate: 'Suspension lifted. The batch is back in the review queue.',
      }[kind]);
      setDlg(null);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'file' },
    { key: 'evidence', label: `Evidence (${d.evidence.length})`, icon: 'image' },
    { key: 'quality', label: 'Quality layers', icon: 'flask' },
    { key: 'history', label: `History (${d.revisions.length + d.events.length})`, icon: 'clock' },
  ];
  const verifyUrl = `${window.location.origin}${d.qr.verify_path}`;

  return (
    <>
      <nav className="crumbs"><Link to="/officer/verification">Batch Verification</Link><Icon name="right" /><b>{b.batch_code}</b></nav>
      <PageHead title={b.batch_code} sub={`${b.product_name} · ${fmtQty(b.quantity, b.unit)} · ${b.district_name}, ${b.state_name}`}>
        <OStatus status={b.status} />
        {b.is_demo && <Chip tone="blue">Demonstration data</Chip>}
      </PageHead>

      <div className="o-split">
        <div className="o-main">
          <Tabs tabs={tabs} value={tab} onChange={setTab} id="obt" />
          {tab === 'overview' && (
            <div className="o-stack mt12">
              <Card>
                <h3>Batch details</h3>
                <Kv rows={[
                  ['Product', b.product_name], ['Local name', b.local_name], ['Variety', b.variety], ['Grade (declared)', b.grade_label],
                  ['Quantity', fmtQty(b.quantity, b.unit)], ['Collection date', fmtDate(b.collection_date)], ['Collection area', b.collection_area],
                  ['Block', b.block_name], ['District', b.district_name], ['State', b.state_name], ['Collection centre', b.centre_name || 'Direct from collector'],
                  ['Method', b.collection_method], ['Source declaration', b.source_declaration], ['Source note', b.source_note],
                ]} />
                <p className="sub mt8">All fields above are declared by the collector. They are not independently verified unless an officer decision below says so.</p>
              </Card>
              <Card>
                <h3>Collector</h3>
                <Kv rows={[['Name', d.collector.name], ['Organisation', d.collector.organisation], ['Phone', d.collector.phone], ['Email', d.collector.email], ['Member since', fmtDate(d.collector.member_since)]]} />
                <div className="row mt8"><Link className="link" to={`/officer/collectors/${d.collector.id}`}>View collector record</Link></div>
              </Card>
              <Card>
                <h3>Buyer requirements for this product</h3>
                {d.requirements.length === 0 ? <p className="sub">No active buyer requirements recorded.</p> : (
                  <div className="tblwrap"><table className="tbl"><thead><tr><th>Buyer</th><th>Grade</th><th>Quantity</th><th>Specifications</th></tr></thead><tbody>
                    {d.requirements.map((r) => (
                      <tr key={r.id}><td>{r.buyer}</td><td>{r.grade_label || '—'}</td><td className="num">{r.min_qty ?? '—'}–{r.max_qty ?? '—'} {r.unit}</td>
                        <td>{r.specs.length ? r.specs.map((s) => `${s.name || s.parameter} ${s.max != null ? `≤ ${s.max}` : ''}${s.min != null ? `≥ ${s.min}` : ''}`).join('; ') : '—'}</td></tr>
                    ))}
                  </tbody></table></div>
                )}
              </Card>
            </div>
          )}

          {tab === 'evidence' && (
            <Card className="mt12">
              <h3>Photographs and supporting documents</h3>
              {d.evidence.length === 0 ? <EmptyState icon="image" title="No evidence uploaded">Consider requesting a correction that asks for a photograph.</EmptyState> : (
                <div className="o-evidence">
                  {d.evidence.map((e) => (
                    <figure key={e.id}>
                      {e.url && e.mime && e.mime.startsWith('image/') ? <a href={e.url} target="_blank" rel="noreferrer"><img src={e.url} alt={e.label || e.filename || 'Evidence'} loading="lazy" /></a>
                        : <a className="o-doc" href={e.url || undefined} target="_blank" rel="noreferrer"><Icon name="file" />{e.url ? 'Open document' : 'No file stored'}</a>}
                      <figcaption><b>{e.label || label(e.kind)}</b><span className="sub">{e.filename || 'Note only'} · {fmtDate(e.created_at)}</span>{e.note && <span className="sub">{e.note}</span>}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
              <h3 className="mt16">Handling records</h3>
              {d.handling.length === 0 ? <p className="sub">None recorded.</p> : (
                <ul className="o-list">{d.handling.map((h) => <li key={h.id}><b>{label(h.kind)}</b> {h.method && `· ${h.method}`}{h.start_date && ` · ${fmtDate(h.start_date)}`}{h.notes && <div className="sub">{h.notes}</div>}</li>)}</ul>
              )}
            </Card>
          )}

          {tab === 'quality' && (
            <div className="o-stack mt12">
              <Notice tone="blue" icon="info" small>Five layers are kept apart. AI assistance and self-reported values never become an officer-reviewed status on their own.</Notice>
              {LAYERS.map(([key, title, tone]) => {
                const v = d.layers[key];
                return (
                  <Card key={key}>
                    <div className="row between"><h3>{title}</h3><Chip tone={tone}>{key === 'ai_assisted' ? `${v.checks.length} checks` : v.length}</Chip></div>
                    {key === 'ai_assisted' ? (
                      <>
                        <p className="sub">{v.note}</p>
                        <ul className="o-list">{v.checks.map((c) => <li key={c.parameter}><b>{c.parameter}</b> — {label(c.outcome)}{c.reason && <div className="sub">{c.reason}</div>}</li>)}</ul>
                      </>
                    ) : v.length === 0 ? <p className="sub">Nothing recorded in this layer.</p> : key === 'officer_review' ? (
                      <ul className="o-list">{v.map((x) => <li key={x.id}><OStatus status={x.status} /> <span className="sub">{x.officer} · {fmtDateTime(x.created_at)}</span>{x.summary && <div>{x.summary}</div>}{x.limitations && <div className="sub">Limitations: {x.limitations}</div>}</li>)}</ul>
                    ) : (
                      <div className="tblwrap"><table className="tbl"><thead><tr><th>Parameter</th><th>Value</th><th>Method</th><th>{key === 'self_reported' ? 'Recorded' : 'Tested'}</th>{key !== 'self_reported' && <th>Standard / report</th>}</tr></thead><tbody>
                        {v.map((m) => (
                          <tr key={m.id} className={m.superseded ? 'o-superseded' : ''}>
                            <td>{m.parameter_name}{m.version > 1 && <span className="sub"> v{m.version}</span>}{m.superseded && <Chip tone="gray">replaced</Chip>}</td>
                            <td className="num">{m.value ?? m.text_value ?? '—'} {m.unit || ''}</td><td>{m.method || '—'}</td>
                            <td>{fmtDate(m.tested_on || m.measured_at)}</td>
                            {key !== 'self_reported' && <td>{[m.reference_standard, m.lab_report_ref].filter(Boolean).join(' · ') || '—'}</td>}
                          </tr>
                        ))}
                      </tbody></table></div>
                    )}
                  </Card>
                );
              })}
              <Button to={`/officer/quality/${b.id}`} icon="flask" variant="primary">Record an inspection result</Button>
            </div>
          )}

          {tab === 'history' && (
            <div className="o-stack mt12">
              <Card>
                <h3>Submission revisions</h3>
                {d.revisions.length === 0 ? <p className="sub">No revision snapshots yet. A snapshot is stored every time the collector submits or resubmits.</p> : (
                  <ul className="o-list">{d.revisions.map((r) => (
                    <li key={r.id}><b>Revision {r.revision}</b> <span className="sub">{fmtDateTime(r.created_at)} · {r.submitted_by}{r.note && ` · ${r.note}`}</span>
                      <div className="sub">Declared {fmtQty(r.snapshot.quantity, r.snapshot.unit)}, collected {fmtDate(r.snapshot.collection_date)}, {r.snapshot.evidence_count} evidence file(s), {r.snapshot.measurements?.length || 0} measurement(s)</div></li>
                  ))}</ul>
                )}
                {d.corrections.length > 0 && <>
                  <h3 className="mt16">Correction requests</h3>
                  <ul className="o-list">{d.corrections.map((c) => <li key={c.id}><Chip tone={c.status === 'open' ? 'amber' : 'green'}>{c.status}</Chip> <span className="sub">{c.officer_name} · {fmtDateTime(c.created_at)}</span><div>{c.items.join('; ')}</div><div className="sub">{c.message}</div></li>)}</ul>
                </>}
                {d.rejections.length > 0 && <>
                  <h3 className="mt16">Rejections</h3>
                  <ul className="o-list">{d.rejections.map((r) => <li key={r.id}><Chip tone="red">{label(r.category)}</Chip> <span className="sub">{r.actor_name} · {fmtDateTime(r.created_at)}</span><div>{r.explanation}</div></li>)}</ul>
                </>}
              </Card>
              <Card>
                <h3>Tamper-evident event log</h3>
                <ul className="o-list">{d.events.slice().reverse().map((e) => { const [l] = eventMeta(e.event_type); return <li key={e.seq}><b>{l}</b> <span className="sub">{e.actor_name}{e.actor_role ? ` (${e.actor_role})` : ''} · {fmtDateTime(e.timestamp)} · #{e.seq}</span></li>; })}</ul>
              </Card>
            </div>
          )}
        </div>

        <aside className="o-side">
          <Card className="o-decide">
            <h3>Officer decision</h3>
            {d.can_decide ? (
              <div className="o-actions">
                <Button variant="primary" icon="check" block onClick={() => open('approve')}>Approve</Button>
                <Button icon="pencil" block onClick={() => open('correct')}>Request correction</Button>
                <Button variant="danger" icon="xc" block onClick={() => open('reject')}>Reject</Button>
              </div>
            ) : (
              <p className="sub">{b.status === 'suspended' ? <>This batch is <b>suspended</b>. Reinstate it to put it back in the review queue. The marketplace already shows the suspension.</> : <>This batch is <b>{label(b.status)}</b>, so no decision is open. It returns to the queue when the collector resubmits.</>}</p>
            )}
            {d.can_suspend && <Button variant="danger" icon="ban" block className="mt8" onClick={() => open('suspend')}>Suspend batch</Button>}
            {d.can_reinstate && <Button variant="primary" icon="refresh" block onClick={() => open('reinstate')}>Reinstate for review</Button>}
            <p className="sub mt8">An approval is an in-app officer review. It is not a statutory certificate. Suspension shows on the marketplace at once.</p>
          </Card>
          <Card>
            <h3>QR passport</h3>
            <div className="o-qr"><QRCodeSVG value={verifyUrl} size={132} /></div>
            <p className="sub" style={{ textAlign: 'center' }}>Opens the public record showing the current status.</p>
            <Button to={d.qr.verify_path} size="sm" icon="qr" block>Open verify page</Button>
          </Card>
        </aside>
      </div>

      <Modal open={dlg === 'approve'} title="Approve batch" onClose={() => setDlg(null)}>
        <p className="sub">Confirms you reviewed the submitted evidence. Missing required measurements need a stated limitation.</p>
        <div className="o-form">
          <Field label="Review summary" optional><Textarea {...bind('summary')} placeholder="What you checked" /></Field>
          <Field label="Limitations" optional hint="If filled, the batch is approved with limitations."><Textarea {...bind('limitations')} placeholder="e.g. Moisture is self-reported only" /></Field>
          {err && <div className="alert-red" role="alert">{err}</div>}
          <div className="acts"><Button onClick={() => setDlg(null)}>Cancel</Button><Button variant="primary" disabled={busy} onClick={() => submit('approve')}>{busy ? 'Saving…' : 'Approve batch'}</Button></div>
        </div>
      </Modal>
      <Modal open={dlg === 'reject'} title="Reject batch" onClose={() => setDlg(null)}>
        <p className="sub">The collector is notified with your reason. The submission and history are kept.</p>
        <div className="o-form">
          <Field label="Reason" required><Select {...bind('category')}>{(meta?.reject_categories || []).map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select></Field>
          <Field label="Explanation" required hint="At least 10 characters. The collector will read this."><Textarea {...bind('explanation')} /></Field>
          <Field label="Suggested next step" optional><Input {...bind('remarks')} /></Field>
          {err && <div className="alert-red" role="alert">{err}</div>}
          <div className="acts"><Button onClick={() => setDlg(null)}>Cancel</Button><Button variant="primary danger" disabled={busy} onClick={() => submit('reject')}>{busy ? 'Saving…' : 'Reject batch'}</Button></div>
        </div>
      </Modal>
      <Modal open={dlg === 'correct'} title="Request correction" onClose={() => setDlg(null)}>
        <p className="sub">The collector can fix the items and resubmit. Earlier revisions are preserved.</p>
        <div className="o-form">
          <Field label="Missing documents or incorrect information" required hint="One item per line."><Textarea {...bind('items')} placeholder={'Photograph of produce\nExact collection area'} /></Field>
          <Field label="Message to collector" required><Textarea {...bind('message')} /></Field>
          {err && <div className="alert-red" role="alert">{err}</div>}
          <div className="acts"><Button onClick={() => setDlg(null)}>Cancel</Button><Button variant="primary" disabled={busy} onClick={() => submit('correct')}>{busy ? 'Sending…' : 'Send request'}</Button></div>
        </div>
      </Modal>
      <Modal open={dlg === 'suspend' || dlg === 'reinstate'} title={dlg === 'reinstate' ? 'Reinstate batch' : 'Suspend batch'} onClose={() => setDlg(null)}>
        <p className="sub">{dlg === 'reinstate' ? 'The batch returns to officer review. Buyers can see it again, still without an approval.' : 'Buyers see a warning immediately and cannot send a purchase request until you reinstate it.'}</p>
        <div className="o-form">
          <Field label="Reason" required hint="At least 10 characters. Kept in the audit trail."><Textarea {...bind('reason')} /></Field>
          {err && <div className="alert-red" role="alert">{err}</div>}
          <div className="acts"><Button onClick={() => setDlg(null)}>Cancel</Button><Button variant={dlg === 'suspend' ? 'danger' : 'primary'} disabled={busy} onClick={() => submit(dlg)}>{busy ? 'Saving…' : dlg === 'reinstate' ? 'Reinstate' : 'Suspend batch'}</Button></div>
        </div>
      </Modal>
    </>
  );
}
