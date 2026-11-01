import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { Button, Card, Chip, EmptyState, ErrorState, Field, Input, LoadingState, Notice, Select, Tabs, Textarea } from '../../components/ui/primitives';
import { useO, useOWrite } from '../../api/officer';
import { useUI } from '../../context/UIContext';
import { useDocTitle } from '../../hooks';
import { fmtDate } from '../../lib/format';
import { OStatus, PageHead, fmtQty, label, useForm } from './common';

const SOURCE = {
  instrument: ['Instrument measurement', 'blue'],
  laboratory: ['Laboratory result', 'green'],
  officer_observation: ['Officer observation', 'amber'],
};

export function OfficerQualityHome() {
  useDocTitle('Quality inspection');
  const nav = useNavigate();
  const [tab, setTab] = useState('queue');
  const queue = useO('/quality/queue');
  const std = useO('/quality/standards');
  return (
    <>
      <PageHead title="Quality Inspection" sub="Record instrument and laboratory results against product-specific standards." />
      <Tabs tabs={[{ key: 'queue', label: 'Inspection queue', icon: 'flask' }, { key: 'standards', label: 'Quality standards', icon: 'book' }]} value={tab} onChange={setTab} id="oq" />
      {tab === 'queue' && (
        <div className="o-split mt12">
          <Card className="o-main">
            <h3>Batches</h3>
            {queue.isLoading ? <LoadingState rows={4} /> : queue.error ? <ErrorState error={queue.error} onRetry={queue.refetch} /> : queue.data.batches.length === 0 ? <EmptyState icon="flask" title="No batches to inspect" /> : (
              <div className="tblwrap"><table className="tbl rows"><thead><tr><th>Batch</th><th>Product</th><th>District</th><th>Self-reported</th><th>Officer results</th><th>Status</th></tr></thead><tbody>
                {queue.data.batches.map((b) => (
                  <tr key={b.id} tabIndex={0} onClick={() => nav(`/officer/quality/${b.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/officer/quality/${b.id}`)}>
                    <td className="num"><b>{b.batch_code}</b></td><td>{b.product_name}<div className="sub">{fmtQty(b.quantity, b.unit)}</div></td><td>{b.district_name}</td>
                    <td className="num">{b.self_reported}</td><td className="num">{b.inspections || <span className="sub">none</span>}</td><td><OStatus status={b.status} /></td>
                  </tr>
                ))}
              </tbody></table></div>
            )}
          </Card>
          <aside className="o-side">
            <Card>
              <h3>Recent results</h3>
              {(queue.data?.recent || []).length === 0 ? <p className="sub">No officer-recorded results yet.</p> : (
                <ul className="feed">{queue.data.recent.map((r) => (
                  <li key={r.id}><span className="sec-ic sm blue"><Icon name="flask" /></span>
                    <div><b>{r.parameter_name}: {r.value ?? r.text_value} {r.unit || ''}</b><div className="sub">{r.batch_code} · {SOURCE[r.evidence_source][0]} · v{r.version}</div></div></li>
                ))}</ul>
              )}
            </Card>
          </aside>
        </div>
      )}
      {tab === 'standards' && (
        <div className="o-stack mt12">
          <Notice tone="blue" icon="info" small>{std.data?.note || 'Standards are configured per product.'} Administrators maintain limits; officers apply them.</Notice>
          {std.isLoading ? <LoadingState rows={4} /> : std.error ? <ErrorState error={std.error} onRetry={std.refetch} /> : std.data.standards.map((p) => (
            <Card key={p.id}>
              <h3>{p.name}</h3>
              {p.profiles.length === 0 ? <p className="sub">No quality profile configured for this product. Results can still be recorded; nothing is compared.</p> : p.profiles.map((q) => (
                <div key={q.id} className="mt8">
                  <div className="row wrap"><b>{q.name}</b><span className="sub">v{q.version} · {q.source_name || 'Source not stated'}</span>{q.illustrative && <Chip tone="amber">Illustrative thresholds</Chip>}</div>
                  <div className="tblwrap mt8"><table className="tbl"><thead><tr><th>Parameter</th><th>Min</th><th>Max</th><th>Unit</th><th>Required</th><th>Method</th></tr></thead><tbody>
                    {q.parameters.map((x) => <tr key={x.id}><td>{x.name}</td><td className="num">{x.min_value ?? <span className="sub">not set</span>}</td><td className="num">{x.max_value ?? <span className="sub">not set</span>}</td><td>{x.unit || '—'}</td><td>{x.required ? 'Yes' : 'No'}</td><td>{x.method || '—'}</td></tr>)}
                  </tbody></table></div>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export function OfficerQualityBatch() {
  const { id } = useParams();
  const { toast } = useUI();
  const write = useOWrite();
  const q = useO(`/batches/${id}/quality`);
  const [form, bind, setForm] = useForm({ evidence_source: 'instrument', tested_on: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useDocTitle(q.data ? `Inspect ${q.data.batch.batch_code}` : 'Inspection');
  if (q.isLoading) return <LoadingState rows={5} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const d = q.data;
  const replacing = form.supersedes_id ? d.records.find((r) => r.id === form.supersedes_id) : null;

  const startVersion = (r) => setForm({ ...form, parameter_name: r.parameter_name, evidence_source: r.evidence_source, unit: r.unit || '', method: r.method || '', reference_standard: r.reference_standard || '', supersedes_id: r.id });

  async function save(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const body = { ...form };
      if (body.value === '') delete body.value;
      const out = await write(`/batches/${id}/inspections`, body);
      toast(`Result saved as version ${out.version}.`);
      setForm({ evidence_source: form.evidence_source, tested_on: form.tested_on });
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }

  return (
    <>
      <nav className="crumbs"><Link to="/officer/quality">Quality Inspection</Link><Icon name="right" /><b>{d.batch.batch_code}</b></nav>
      <PageHead title={`Inspect ${d.batch.batch_code}`} sub={d.batch.product_name}><OStatus status={d.batch.status} /><Button to={`/officer/verification/${id}`} icon="shieldcheck">Open verification</Button></PageHead>
      {d.locked && <Notice tone="blue" icon="lock" small className="mb12">This batch is already approved. Recorded results are never edited; adding a result creates a new version and the earlier one stays visible.</Notice>}
      <div className="o-split">
        <div className="o-main o-stack">
          <Card>
            <h3>{replacing ? `New version of “${replacing.parameter_name}”` : 'Record a result'}</h3>
            <form className="o-form" onSubmit={save}>
              <div className="o-grid2">
                <Field label="Parameter" required><Input list="params" {...bind('parameter_name')} placeholder="e.g. Moisture" readOnly={!!replacing} /><datalist id="params">{d.parameters.map((p) => <option key={p.name} value={p.name} />)}</datalist></Field>
                <Field label="Evidence source" required><Select {...bind('evidence_source')} disabled={!!replacing}>{Object.entries(SOURCE).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
                <Field label="Measured value" hint="Leave blank for a text result"><Input type="number" step="any" {...bind('value')} /></Field>
                <Field label="Unit"><Input {...bind('unit')} placeholder="%, mg/kg, …" /></Field>
                <Field label="Text result" optional><Input {...bind('text_value')} placeholder="e.g. Free of visible mould" /></Field>
                <Field label="Testing method" required><Input {...bind('method')} placeholder="e.g. Oven drying" /></Field>
                <Field label="Testing date" required><Input type="date" {...bind('tested_on')} max={new Date().toISOString().slice(0, 10)} /></Field>
                <Field label="Reference standard" optional><Input {...bind('reference_standard')} placeholder="Standard or protocol name" /></Field>
                {form.evidence_source === 'laboratory' && <Field label="Laboratory report reference" required><Input {...bind('lab_report_ref')} /></Field>}
                <Field label="Evidence attachment" optional><Select {...bind('evidence_id')}><option value="">None</option>{d.evidence.map((e) => <option key={e.id} value={e.id}>{e.label || e.filename || e.kind}</option>)}</Select></Field>
              </div>
              <Field label="Inspector remarks" optional><Textarea {...bind('remarks')} /></Field>
              {replacing && <Field label="Reason for the new version" required><Input {...bind('change_reason')} /></Field>}
              {err && <div className="alert-red" role="alert">{err}</div>}
              <div className="acts">{replacing && <Button onClick={() => setForm({ evidence_source: 'instrument', tested_on: form.tested_on })}>Cancel version</Button>}<Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save result'}</Button></div>
            </form>
            <p className="sub">Recorded by you as the inspector and time-stamped. Results are stored as instrument, laboratory or officer-observation evidence, separate from what the collector reported.</p>
          </Card>

          <Card>
            <h3>Recorded results</h3>
            {d.records.length === 0 ? <p className="sub">No officer results yet.</p> : (
              <div className="tblwrap"><table className="tbl"><thead><tr><th>Parameter</th><th>Result</th><th>Source</th><th>Method / standard</th><th>Tested</th><th>Inspector</th><th /></tr></thead><tbody>
                {d.records.map((r) => (
                  <tr key={r.id} className={r.superseded ? 'o-superseded' : ''}>
                    <td><b>{r.parameter_name}</b> <span className="sub">v{r.version}</span>{r.superseded && <Chip tone="gray">replaced</Chip>}{r.change_reason && <div className="sub">Reason: {r.change_reason}</div>}</td>
                    <td className="num">{r.value ?? r.text_value} {r.unit || ''}</td><td><Chip tone={SOURCE[r.evidence_source][1]}>{SOURCE[r.evidence_source][0]}</Chip></td>
                    <td>{r.method}<div className="sub">{[r.reference_standard, r.lab_report_ref].filter(Boolean).join(' · ')}</div></td>
                    <td>{fmtDate(r.tested_on)}</td><td>{r.inspector_name}</td>
                    <td>{!r.superseded && <button type="button" className="link" onClick={() => startVersion(r)}>New version</button>}</td>
                  </tr>
                ))}
              </tbody></table></div>
            )}
          </Card>
        </div>
        <aside className="o-side">
          <Card>
            <h3>Applicable standard</h3>
            {d.parameters.length === 0 ? <p className="sub">No quality profile is configured for {d.batch.product_name}. Nothing will be compared.</p> : (
              <ul className="o-list">{d.parameters.map((p) => <li key={p.name}><b>{p.name}</b>{p.required && <Chip tone="amber">required</Chip>}<div className="sub">{p.min_value != null && `min ${p.min_value} `}{p.max_value != null && `max ${p.max_value} `}{p.unit} {p.min_value == null && p.max_value == null && 'limit not configured'}</div>{p.source && <div className="sub">{p.source}{p.illustrative ? ' (illustrative)' : ''}</div>}</li>)}</ul>
            )}
          </Card>
          <Card>
            <h3>Self-reported by collector</h3>
            {d.self_reported.length === 0 ? <p className="sub">None.</p> : <ul className="o-list">{d.self_reported.map((m) => <li key={m.id}><b>{m.parameter_name}</b> {m.value ?? m.text_value} {m.unit}<div className="sub">Not verified</div></li>)}</ul>}
          </Card>
          {d.requirements.length > 0 && (
            <Card><h3>Buyer requirements</h3><ul className="o-list">{d.requirements.map((r, i) => <li key={i}><b>{r.buyer}</b>{r.grade_label && <span className="sub"> · {r.grade_label}</span>}</li>)}</ul></Card>
          )}
        </aside>
      </div>
    </>
  );
}
