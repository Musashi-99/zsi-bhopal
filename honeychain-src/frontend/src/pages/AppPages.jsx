import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, readDrafts, writeDrafts } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n';
import { Empty, Loading, Stamp, outcomeLabel, statusTone } from '../components/ui';

function useFetch(path) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setErr('');
    api(path).then((d) => { if (live) setData(d); }).catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [path, tick]);
  return { data, err, reload: () => setTick((n) => n + 1) };
}

export function Dashboard() {
  const { t } = useLang();
  const { data, err, reload } = useFetch('/api/dashboard');
  const drafts = readDrafts();
  if (err) return <p className="err">{err}</p>;
  if (!data) return <Loading />;
  const max = Math.max(1, ...(data.batches_by_status || data.inventory_by_status || []).map((r) => r.count));
  return (
    <div className="stack">
      <div className="row"><h1 style={{ flex: 1 }}>{t('home')}</h1><button className="btn ghost" onClick={reload}>{t('refresh')}</button></div>
      {!!drafts.length && <DraftSync onDone={reload} />}
      <div className="cards">
        {(data.cards || []).map((c) => (
          <article className="card" key={c.label}><p className="muted small">{c.label}</p><h2>{c.value}</h2><p className="small">{c.hint}</p></article>
        ))}
      </div>
      {!!data.alerts?.length && (
        <section className="stack">
          <h3>Record alerts</h3>
          {data.alerts.map((a) => <Link key={a.batch_code + a.text} className="card" to={`/collector/batches/${a.batch_id}`}>{a.batch_code}: {a.text}</Link>)}
        </section>
      )}
      {!!data.batches?.length && (
        <section className="list">
          {data.batches.map((b) => <BatchCard key={b.id} batch={b} />)}
        </section>
      )}
      {!!data.queue?.length && (
        <section className="list">
          {data.queue.map((b) => (
            <Link className="card" key={b.id} to={`/inspector/batches/${b.id}`}>
              <strong>{b.batch_code}</strong>
              <p className="muted">{b.product_name} · {b.district_name}</p>
              <Stamp tone={statusTone(b.status)}>{outcomeLabel(b.status)}</Stamp>
            </Link>
          ))}
        </section>
      )}
      {(data.batches_by_status || data.inventory_by_status) && (
        <div className="bars">
          {(data.batches_by_status || data.inventory_by_status).map((r) => (
            <div className="bar" key={r.status}><span>{outcomeLabel(r.status)}</span><i style={{ width: `${(r.count / max) * 100}%` }} /><b>{r.count}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}

function BatchCard({ batch, href }) {
  const id = batch.batch_code || batch.id;
  const product = batch.product || batch.product_name;
  return (
    <Link className="card" to={href || `/collector/batches/${id}`}>
      <div className="row"><strong>{product}</strong><Stamp tone={statusTone(batch.status)}>{outcomeLabel(batch.status)}</Stamp></div>
      <p className="serial">{batch.batch_code}</p>
      <p className="muted">{batch.quantity} {batch.unit} · {batch.district || batch.district_name || ''} · {batch.collection_date}</p>
    </Link>
  );
}

function DraftSync({ onDone }) {
  const [note, setNote] = useState('');
  async function sync() {
    const left = [];
    for (const draft of readDrafts()) {
      try {
        await api('/api/batches', { method: 'POST', body: draft.body });
      } catch (err) {
        if (err.status === 0) left.push(draft);
        else left.push({ ...draft, sync: 'failed', error: err.message });
      }
    }
    writeDrafts(left.filter((d) => d.sync === 'failed' || d.sync === 'pending' && false));
    const failed = left.filter((d) => d.error);
    writeDrafts(failed);
    setNote(failed.length ? 'Some drafts still need a correction.' : 'Phone drafts synced.');
    onDone?.();
  }
  return (
    <div className="panel">
      <strong>{readDrafts().length} draft(s) on this phone</strong>
      <p className="small muted">Pending synchronisation. They are not on the server until this succeeds.</p>
      <button className="btn forest" onClick={sync}>Sync now</button>
      {note && <p>{note}</p>}
    </div>
  );
}

export function BatchList({ base = '/collector/batches' }) {
  const { t } = useLang();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  const { data, err } = useFetch(`/api/batches?${params}`);
  return (
    <div className="stack">
      <div className="row"><h1 style={{ flex: 1 }}>{t('batches')}</h1>{(user?.role === 'collector' || user?.role === 'centre') && <Link className="btn clay" to={user.role === 'centre' ? '/centre/batches/new' : '/collector/batches/new'}>{t('newBatch')}</Link>}</div>
      <label className="field"><span>{t('search')}</span><input value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <label className="field"><span>Status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any</option>
          {['draft', 'pending_verification', 'needs_info', 'verified', 'verified_with_limitations', 'rejected', 'dispatched'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      {err && <p className="err">{err}</p>}
      {!data && !err && <Loading />}
      {data && !data.batches.length && <Empty title="No batches" body="Create one, or change the filter." />}
      <div className="list">{data?.batches.map((b) => <BatchCard key={b.id} batch={b} href={`${base}/${b.batch_code}`} />)}</div>
    </div>
  );
}

export function NewBatch() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { t, stateId } = useLang();
  const [step, setStep] = useState(0);
  const [meta, setMeta] = useState(null);
  const [product, setProduct] = useState(null);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    product_id: '', local_name: '', variety: '', grade_label: '', quantity: '', unit: 'kg',
    collection_date: '', state_id: stateId, district_id: '', collection_area: '', block_name: '',
    collection_method: '', centre_id: '', source_type: 'community forest', source_declaration: '',
    handling: [{ kind: 'drying', method: '', location: '', start_date: '', end_date: '' }],
    measurements: [],
  });
  useEffect(() => {
    Promise.all([api('/api/meta'), api('/api/centres')])
      .then(([metaData, centres]) => setMeta({ ...metaData, centres: centres.centres || [] }))
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(() => {
    if (!form.product_id) return;
    api(`/api/products/${form.product_id}`).then((d) => {
      setProduct(d);
      setForm((f) => ({
        ...f,
        unit: d.product.default_unit,
        measurements: (d.parameters || []).map((p) => ({ parameter: p.name, unit: p.unit || '', value: '', method: '', evidence_source: 'self_reported', measured_at: f.collection_date })),
      }));
    });
  }, [form.product_id]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const districts = (meta?.districts || []).filter((d) => d.state_id === form.state_id);
  async function save(submit) {
    setErr('');
    const body = {
      ...form,
      quantity: Number(form.quantity),
      submit,
      public_share: true,
      handling: form.handling.filter((h) => h.method || h.kind),
      measurements: form.measurements.filter((m) => m.value !== ''),
    };
    try {
      const res = await api('/api/batches', { method: 'POST', body });
      const root = user?.role === 'centre' ? '/centre/batches' : '/collector/batches';
      nav(`${root}/${res.passport.batch_code}`);
    } catch (error) {
      if (error.status === 0) {
        writeDrafts([...readDrafts(), { sync: 'pending', body, at: new Date().toISOString() }]);
        setErr('Saved on this phone. Open Home and sync when the server is reachable.');
      } else setErr(error.message);
    }
  }
  if (!meta) return <Loading />;
  const titles = ['Product', 'Source', 'Handling', 'Measurements', 'Review'];
  return (
    <div className="stack">
      <p className="eyebrow">Step {step + 1} of {titles.length}</p>
      <h1>{titles[step]}</h1>
      {step === 0 && (
        <>
          <label className="field"><span>Product</span>
            <select value={form.product_id} onChange={(e) => set('product_id', e.target.value)} required>
              <option value="">Choose</option>
              {meta.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Local name</span><input value={form.local_name} onChange={(e) => set('local_name', e.target.value)} /></label>
          <label className="field"><span>Variety or species</span><input value={form.variety} onChange={(e) => set('variety', e.target.value)} /></label>
          <label className="field"><span>Grade label</span><input value={form.grade_label} onChange={(e) => set('grade_label', e.target.value)} /></label>
          <label className="field"><span>Quantity</span><input inputMode="decimal" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} /></label>
          <label className="field"><span>Unit</span>
            <select value={form.unit} onChange={(e) => set('unit', e.target.value)}>
              {(product?.product.units || [form.unit]).map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>
          <label className="field"><span>Collection date</span><input type="date" value={form.collection_date} onChange={(e) => set('collection_date', e.target.value)} /></label>
          <label className="field"><span>State</span>
            <select value={form.state_id} onChange={(e) => set('state_id', e.target.value)}>
              {meta.states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field"><span>District</span>
            <select value={form.district_id} onChange={(e) => set('district_id', e.target.value)}>
              <option value="">Choose</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Collection area</span><input value={form.collection_area} onChange={(e) => set('collection_area', e.target.value)} /></label>
          <label className="field"><span>Block</span><input value={form.block_name} onChange={(e) => set('block_name', e.target.value)} /></label>
          <label className="field"><span>Collection method</span><input value={form.collection_method} onChange={(e) => set('collection_method', e.target.value)} /></label>
          <label className="field"><span>Collection centre</span>
            <select value={form.centre_id} onChange={(e) => set('centre_id', e.target.value)}>
              <option value="">None</option>
              {(meta.centres || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </>
      )}
      {step === 1 && (
        <>
          <label className="field"><span>Source type</span><input value={form.source_type} onChange={(e) => set('source_type', e.target.value)} /></label>
          <label className="field"><span>Source declaration</span><textarea value={form.source_declaration} onChange={(e) => set('source_declaration', e.target.value)} /></label>
          <p className="small muted">A declaration does not certify legal origin. The passport will say independent verification is unavailable.</p>
        </>
      )}
      {step === 2 && form.handling.map((row, i) => (
        <div className="card stack" key={i}>
          <label className="field"><span>Kind</span>
            <select value={row.kind} onChange={(e) => set('handling', form.handling.map((h, idx) => idx === i ? { ...h, kind: e.target.value } : h))}>
              {['drying', 'storage', 'packaging', 'transport'].map((k) => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label className="field"><span>Method</span><input value={row.method} onChange={(e) => set('handling', form.handling.map((h, idx) => idx === i ? { ...h, method: e.target.value } : h))} /></label>
          <label className="field"><span>Location</span><input value={row.location} onChange={(e) => set('handling', form.handling.map((h, idx) => idx === i ? { ...h, location: e.target.value } : h))} /></label>
          <label className="field"><span>Start</span><input type="date" value={row.start_date} onChange={(e) => set('handling', form.handling.map((h, idx) => idx === i ? { ...h, start_date: e.target.value } : h))} /></label>
          <label className="field"><span>End</span><input type="date" value={row.end_date} onChange={(e) => set('handling', form.handling.map((h, idx) => idx === i ? { ...h, end_date: e.target.value } : h))} /></label>
        </div>
      ))}
      {step === 2 && <button className="btn ghost" type="button" onClick={() => set('handling', [...form.handling, { kind: 'storage', method: '', location: '', start_date: '', end_date: '' }])}>Add handling row</button>}
      {step === 3 && (
        form.measurements.length ? form.measurements.map((m, i) => (
          <div className="card stack" key={m.parameter}>
            <strong>{m.parameter}</strong>
            <label className="field"><span>Value ({m.unit || 'unit'})</span><input inputMode="decimal" value={m.value} onChange={(e) => set('measurements', form.measurements.map((row, idx) => idx === i ? { ...row, value: e.target.value } : row))} /></label>
            <p className="small">Left blank means the measurement is missing. It will not be filled in for you. A collector entry is stored as self-reported.</p>
          </div>
        )) : <Empty title="No attributes configured" body="You can still submit the batch. The gap stays visible." />
      )}
      {step === 4 && (
        <div className="panel">
          <p><b>{product?.product.name}</b> · {form.quantity} {form.unit} · {form.collection_date}</p>
          <p>{form.measurements.filter((m) => m.value !== '').length} measurement(s) entered. {form.measurements.filter((m) => m.value === '').length} left blank.</p>
          <p className="small muted">Files can be added on the batch page after saving. This step does not invent a laboratory report.</p>
        </div>
      )}
      {err && <p className="err">{err}</p>}
      <div className="wizard-bar">
        {step > 0 && <button className="btn ghost" type="button" onClick={() => setStep(step - 1)}>{t('back')}</button>}
        {step < 4 && <button className="btn forest" type="button" onClick={() => setStep(step + 1)} disabled={step === 0 && (!form.product_id || !form.quantity || !form.collection_date || !form.district_id)}>{t('next')}</button>}
        {step === 4 && <button className="btn ghost" type="button" onClick={() => save(false)}>{t('draft')}</button>}
        {step === 4 && <button className="btn clay" type="button" onClick={() => save(true)}>{t('submit')}</button>}
      </div>
    </div>
  );
}

export function BatchDesk({ roleBase = '/collector/batches' }) {
  const { batchId } = useParams();
  const { user } = useAuth();
  const { t } = useLang();
  const [passport, setPassport] = useState(null);
  const [intel, setIntel] = useState(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  async function load() {
    try {
      const d = await api(`/api/batches/${batchId}`);
      setPassport(d.passport);
      const i = await api(`/api/batches/${d.passport.id}/intelligence`);
      setIntel(i);
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, [batchId]);
  if (err) return <p className="err">{err}</p>;
  if (!passport) return <Loading />;
  const url = `${window.location.origin}/passport/${passport.batch_code}`;
  return (
    <div className="stack">
      <div className="row">
        <div style={{ flex: 1 }}>
          <p className="serial">{passport.batch_code}</p>
          <h1>{passport.product}</h1>
        </div>
        <Stamp tone={statusTone(passport.status)}>{outcomeLabel(passport.status)}</Stamp>
      </div>
      {passport.is_demo && <p className="small">Demonstration batch. Figures below are sample records unless a signed-in user added them.</p>}
      <div className="kvs">
        <div><span>Quantity</span><b>{passport.quantity} {passport.unit}</b></div>
        <div><span>Collected</span><b>{passport.collection_date}</b></div>
        <div><span>Place</span><b>{passport.district}, {passport.state}</b></div>
        <div><span>Source</span><b>{passport.source_statement}</b></div>
      </div>
      <div className="row no-print">
        <Link className="btn ghost" to={`/passport/${passport.batch_code}`}>Public page</Link>
        <button className="btn ghost" onClick={() => window.print()}>{t('print')}</button>
        {user?.role === 'collector' && ['draft', 'needs_info', 'rejected', 'failed_checks'].includes(passport.status) && (
          <button className="btn forest" onClick={async () => { await api(`/api/batches/${passport.id}/submit`, { method: 'POST', body: {} }); load(); }}>Submit</button>
        )}
      </div>
      <QRCodeSVG value={url} size={120} />
      <h2>Evidence</h2>
      {passport.measurements.map((m) => (
        <div className="card" key={m.id}>
          <div className="row"><b>{m.parameter}</b><Stamp tone={m.evidence_source === 'simulated' ? 'sim' : 'wait'}>{outcomeLabel(m.evidence_source)}</Stamp></div>
          <p>{m.value ?? m.text_value ?? '—'} {m.unit}</p>
        </div>
      ))}
      {!passport.measurements.length && <Empty title="No measurements" body="Missing evidence stays blank." />}
      {intel && <Intelligence intel={intel} />}
      {!!passport.rejections?.length && (
        <section>
          <h2>Recovery</h2>
          {passport.rejections.map((r) => (
            <article className="card" key={r.id || r.category}>
              <Stamp tone="no">{r.category}</Stamp>
              <p>{r.explanation}</p>
              <p><b>Next action.</b> {r.corrective_action}</p>
              {r.resolved_by_verification_id && <p className="small">A later review is linked. The original rejection is still here.</p>}
            </article>
          ))}
        </section>
      )}
      <MeasureForm batchId={passport.id} role={user?.role} onDone={load} />
      <EvidenceForm batchId={passport.id} onDone={load} />
      {user?.role === 'inspector' && <ReviewForm batchId={passport.id} rejections={passport.rejections} onDone={load} />}
      {user?.role === 'buyer' && <OfferForm batchId={passport.id} onDone={(msg) => { setNote(msg); load(); }} />}
      {note && <p className="oknote">{note}</p>}
      <p className="small"><Link to={roleBase}>Back to list</Link></p>
    </div>
  );
}

function Intelligence({ intel }) {
  return (
    <section className="stack">
      <h2>Quality-to-price</h2>
      <p className="small">{intel.disclaimer}</p>
      <h3>Recorded checks</h3>
      {(intel.quality?.checks || []).map((c) => (
        <div className="card" key={c.parameter}>
          <div className="row"><b>{c.parameter}</b><Stamp tone={statusTone(c.outcome)}>{outcomeLabel(c.outcome)}</Stamp></div>
          <p className="small">{c.reason}</p>
        </div>
      ))}
      <h3>Buyer fit</h3>
      {!intel.buyer_matches?.length && <p className="muted">No buyer specification is stored for this product.</p>}
      {intel.buyer_matches?.map((m) => (
        <article className="card stack" key={m.requirement_id}>
          <div className="row"><b>{m.organisation || m.buyer_name}</b><Stamp tone={statusTone(m.match)}>{outcomeLabel(m.match)}</Stamp></div>
          <p className="small">{m.quantity?.reason}</p>
          {m.scorecard && (
            <p className="small">
              {m.scorecard.fraction ? m.scorecard.fraction.label : 'No numerical fraction.'}
              {' '}{m.scorecard.missing_data_note}
            </p>
          )}
          {m.reference_price && (
            <p className="small">Reference {m.reference_price.amount} {m.reference_price.currency} / {m.reference_price.unit}. {m.reference_price.kind_label}. {m.reference_price.source}</p>
          )}
          {m.limitations?.map((line) => <p className="small muted" key={line}>{line}</p>)}
        </article>
      ))}
      <h3>Offers on this batch</h3>
      {!intel.offers?.length && <p className="muted">No offer is recorded, so no price difference is explained.</p>}
      {intel.offers?.map((o) => (
        <article className="card" key={o.id}>
          <div className="row"><b>{o.amount} {o.currency} / {o.price_unit}</b><Stamp tone={o.expired ? 'no' : 'wait'}>{o.expired ? 'Expired' : outcomeLabel(o.offer_kind)}</Stamp></div>
          <p className="small">{o.organisation || o.buyer_name} · {o.status} · min {o.min_quantity ?? '—'} · until {o.valid_until || 'no date'}</p>
          <p className="small">{o.terms}</p>
          <p className="small muted">{o.source_label}</p>
        </article>
      ))}
      {intel.offer_explanations?.map((ex, i) => (
        <div className="panel" key={i}>
          {ex.reasons?.map((r) => <p key={r}>{r}</p>)}
          {ex.text && <p>{ex.text}</p>}
          {ex.normalized && <p className="small muted">{ex.normalized.note}</p>}
        </div>
      ))}
      <h3>What could be recorded next</h3>
      {(intel.recommendations || []).slice(0, 6).map((r) => (
        <article className="card" key={r.observed_gap}>
          <p><b>{r.observed_gap}</b></p>
          <p>{r.action}</p>
          <p className="small muted">{r.expected_benefit} Source: {r.source}. Effort or cost is not estimated because no cost record is stored.</p>
        </article>
      ))}
      {intel.assistant && (
        <div className="panel">
          <h3>{intel.assistant.title}</h3>
          <p className="small">{intel.assistant.mode}</p>
          {intel.assistant.inconsistencies?.map((line) => <p key={line}>{line}</p>)}
          {intel.assistant.next_steps?.map((line) => <p key={line}>{line}</p>)}
          <div className="row">{intel.assistant.future_batch_checklist?.map((c) => <Stamp key={c.item} tone={c.state === 'recorded' ? 'ok' : 'wait'}>{c.item}: {c.state}</Stamp>)}</div>
        </div>
      )}
    </section>
  );
}

function MeasureForm({ batchId, role, onDone }) {
  const [form, setForm] = useState({ parameter: 'Moisture', value: '', unit: '%', method: '', notes: '', evidence_source: role === 'inspector' ? 'measured' : 'self_reported' });
  const [err, setErr] = useState('');
  if (role === 'buyer') return null;
  async function submit(e) {
    e.preventDefault();
    try {
      await api(`/api/batches/${batchId}/measurements`, { method: 'POST', body: form });
      setForm({ ...form, value: '' });
      onDone();
    } catch (error) { setErr(error.message); }
  }
  return (
    <form className="panel stack" onSubmit={submit}>
      <h3>Add a measurement</h3>
      <label className="field"><span>Parameter</span><input value={form.parameter} onChange={(e) => setForm({ ...form, parameter: e.target.value })} /></label>
      <label className="field"><span>Value</span><input inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required /></label>
      <label className="field"><span>Unit</span><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label>
      <label className="field"><span>Method</span><input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} /></label>
      {(role === 'inspector' || role === 'admin') && (
        <label className="check"><input type="checkbox" checked={!!form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} /> Mark verified by reviewer</label>
      )}
      {err && <p className="err">{err}</p>}
      <button className="btn forest" type="submit">Save measurement</button>
    </form>
  );
}

function EvidenceForm({ batchId, onDone }) {
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const bytes = new Uint8Array(data);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    try {
      await api(`/api/batches/${batchId}/evidence`, {
        method: 'POST',
        body: { kind: 'file', label: file.name, filename: file.name, mime: file.type, data_base64: btoa(binary), visibility: 'private', note },
      });
      onDone();
    } catch (error) { setErr(error.message); }
  }
  return (
    <form className="panel stack" onSubmit={async (e) => {
      e.preventDefault();
      try {
        await api(`/api/batches/${batchId}/evidence`, { method: 'POST', body: { kind: 'note', label: 'Note', note, visibility: 'private' } });
        setNote('');
        onDone();
      } catch (error) { setErr(error.message); }
    }}>
      <h3>Evidence</h3>
      <label className="field"><span>Note</span><textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <label className="field"><span>Photo or PDF, private, under 1.2 MB</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onFile} /></label>
      {err && <p className="err">{err}</p>}
      <button className="btn ghost" type="submit">Save note</button>
    </form>
  );
}

function ReviewForm({ batchId, rejections, onDone }) {
  const [status, setStatus] = useState('needs_info');
  const [summary, setSummary] = useState('');
  const [err, setErr] = useState('');
  const [rej, setRej] = useState({ category: 'missing_record', explanation: '', corrective_action: '' });
  return (
    <div className="stack">
      <form className="panel stack" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api(`/api/batches/${batchId}/verification`, { method: 'POST', body: { status, summary, resolves_rejection_id: rejections?.[0]?.id } });
          onDone();
        } catch (error) { setErr(error.message); }
      }}>
        <h3>Review</h3>
        <label className="field"><span>Decision</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {['verified', 'verified_with_limitations', 'needs_info', 'failed_checks', 'rejected'].map((s) => <option key={s} value={s}>{outcomeLabel(s)}</option>)}
          </select>
        </label>
        <label className="field"><span>Summary</span><textarea value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn forest" type="submit">Save review</button>
      </form>
      <form className="panel stack" onSubmit={async (e) => {
        e.preventDefault();
        await api(`/api/batches/${batchId}/rejections`, { method: 'POST', body: rej });
        onDone();
      }}>
        <h3>Rejection and recovery</h3>
        <label className="field"><span>Category</span><input value={rej.category} onChange={(e) => setRej({ ...rej, category: e.target.value })} /></label>
        <label className="field"><span>Explanation</span><textarea value={rej.explanation} onChange={(e) => setRej({ ...rej, explanation: e.target.value })} required /></label>
        <label className="field"><span>Corrective action</span><textarea value={rej.corrective_action} onChange={(e) => setRej({ ...rej, corrective_action: e.target.value })} /></label>
        <button className="btn ghost" type="submit">Record rejection</button>
      </form>
    </div>
  );
}

function OfferForm({ batchId, onDone }) {
  const [form, setForm] = useState({ amount: '', price_unit: 'kg', min_quantity: '', valid_until: '', terms: '', grade_label: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  return (
    <div className="stack">
      <form className="panel stack" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api('/api/offers', { method: 'POST', body: { ...form, batch_id: batchId, amount: Number(form.amount), min_quantity: form.min_quantity ? Number(form.min_quantity) : null } });
          onDone('Offer recorded in this application. It is not a completed sale.');
        } catch (error) { setErr(error.message); }
      }}>
        <h3>Make an offer</h3>
        <label className="field"><span>Amount (INR)</span><input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></label>
        <label className="field"><span>Per unit</span><input value={form.price_unit} onChange={(e) => setForm({ ...form, price_unit: e.target.value })} /></label>
        <label className="field"><span>Minimum quantity</span><input inputMode="decimal" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: e.target.value })} /></label>
        <label className="field"><span>Valid until</span><input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></label>
        <label className="field"><span>Grade</span><input value={form.grade_label} onChange={(e) => setForm({ ...form, grade_label: e.target.value })} /></label>
        <label className="field"><span>Terms</span><textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn clay" type="submit">Submit offer</button>
      </form>
      <form className="panel stack" onSubmit={async (e) => {
        e.preventDefault();
        await api('/api/enquiries', { method: 'POST', body: { batch_id: batchId, message: msg, kind: 'enquiry' } });
        setMsg('');
        onDone('Enquiry stored. It is not a sale.');
      }}>
        <label className="field"><span>Ask for more evidence</span><textarea value={msg} onChange={(e) => setMsg(e.target.value)} required /></label>
        <button className="btn ghost" type="submit">Send enquiry</button>
      </form>
    </div>
  );
}

export function OffersPage() {
  const { user } = useAuth();
  const { data, err, reload } = useFetch('/api/offers');
  if (err) return <p className="err">{err}</p>;
  if (!data) return <Loading />;
  async function setStatus(id, status) {
    await api(`/api/offers/${id}`, { method: 'PATCH', body: { status } });
    reload();
  }
  return (
    <div className="stack">
      <h1>Offers</h1>
      {!data.offers.length && <Empty title="No offers" />}
      {data.offers.map((o) => (
        <article className="card stack" key={o.id}>
          <div className="row"><b>{o.amount} {o.currency}/{o.price_unit}</b><Stamp tone={o.expired ? 'no' : statusTone(o.status)}>{o.expired ? 'Expired' : o.status}</Stamp></div>
          <p className="small">{o.batch_code} · {o.product_name} · {o.organisation || o.buyer_name}</p>
          <p className="small muted">{o.source_label || outcomeLabel(o.offer_kind)}</p>
          <div className="row">
            {user?.role === 'collector' && o.status === 'submitted' && !o.expired && <button className="btn forest" onClick={() => setStatus(o.id, 'accepted')}>Accept</button>}
            {user?.role === 'collector' && o.status === 'submitted' && <button className="btn ghost" onClick={() => setStatus(o.id, 'declined')}>Decline</button>}
            {user?.role === 'buyer' && o.status === 'submitted' && <button className="btn ghost" onClick={() => setStatus(o.id, 'withdrawn')}>Withdraw</button>}
          </div>
        </article>
      ))}
    </div>
  );
}

export function BuyersPage() {
  const { user } = useAuth();
  const { data, err } = useFetch('/api/buyer-requirements');
  if (err) return <p className="err">{err}</p>;
  if (!data) return <Loading />;
  return (
    <div className="stack">
      <div className="row"><h1 style={{ flex: 1 }}>Buyer specifications</h1>{user?.role === 'buyer' && <Link className="btn clay" to="/buyer/requirements/new">New</Link>}</div>
      {!data.requirements.length && <Empty title="None stored" />}
      {data.requirements.map((r) => (
        <article className="card" key={r.id}>
          <div className="row"><b>{r.organisation || r.buyer_name}</b><Stamp>{outcomeLabel(r.offer_kind)}</Stamp></div>
          <p>{r.product_name} · {r.grade_label} · min {r.min_qty ?? '—'} {r.unit}</p>
          {r.reference_price != null && <p className="small">{r.reference_price} {r.currency}/{r.price_unit}. {r.source_label}</p>}
          <Link to={`${user?.role === 'buyer' ? '/buyer/requirements' : '/collector/buyers'}/${r.id}`}>Open matches</Link>
        </article>
      ))}
    </div>
  );
}

export function RequirementForm() {
  const nav = useNavigate();
  const [products, setProducts] = useState([]);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ product_id: '', unit: 'kg', grade_label: '', min_qty: '', reference_price: '', price_unit: 'kg', valid_until: '', parameter: 'Moisture', max: '', specifications: [] });
  useEffect(() => { api('/api/products').then((d) => setProducts(d.products)); }, []);
  return (
    <form className="stack panel" onSubmit={async (e) => {
      e.preventDefault();
      const specifications = form.max ? [{ parameter: form.parameter, unit: '%', max: Number(form.max), required: true, source: 'Entered by the buyer in this application' }] : [];
      try {
        await api('/api/buyer-requirements', { method: 'POST', body: { ...form, min_qty: form.min_qty ? Number(form.min_qty) : null, reference_price: form.reference_price ? Number(form.reference_price) : null, specifications, offer_kind: 'recorded_offer' } });
        nav('/buyer/requirements');
      } catch (error) { setErr(error.message); }
    }}>
      <h1>Buyer requirement</h1>
      <label className="field"><span>Product</span>
        <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required>
          <option value="">Choose</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="field"><span>Grade</span><input value={form.grade_label} onChange={(e) => setForm({ ...form, grade_label: e.target.value })} /></label>
      <label className="field"><span>Minimum quantity</span><input inputMode="decimal" value={form.min_qty} onChange={(e) => setForm({ ...form, min_qty: e.target.value })} /></label>
      <label className="field"><span>Unit</span><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label>
      <label className="field"><span>Parameter</span><input value={form.parameter} onChange={(e) => setForm({ ...form, parameter: e.target.value })} /></label>
      <label className="field"><span>Maximum, if you want one</span><input inputMode="decimal" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} /></label>
      <label className="field"><span>Reference price, optional</span><input inputMode="decimal" value={form.reference_price} onChange={(e) => setForm({ ...form, reference_price: e.target.value })} /></label>
      <label className="field"><span>Valid until</span><input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></label>
      <p className="small muted">Leave the maximum empty if you do not want a limit. An empty limit is not treated as a pass.</p>
      {err && <p className="err">{err}</p>}
      <button className="btn clay" type="submit">Save requirement</button>
    </form>
  );
}

export function RequirementMatches() {
  const { id } = useParams();
  const { data, err } = useFetch(`/api/buyer-requirements/${id}/matches`);
  if (err) return <p className="err">{err}</p>;
  if (!data) return <Loading />;
  return (
    <div className="stack">
      <h1>Matches</h1>
      {!data.matches.length && <Empty title="No shared batches for this product" />}
      {data.matches.map((m) => (
        <Link className="card" key={m.batch_id} to={`/buyer/marketplace/${m.batch_code}`}>
          <div className="row"><b>{m.batch_code}</b><Stamp tone={statusTone(m.match)}>{outcomeLabel(m.match)}</Stamp></div>
          <p className="small">{m.quantity} {m.unit}. {m.quantity_fit?.reason}</p>
          <p className="small muted">{m.scorecard?.fraction?.label || m.scorecard?.missing_data_note}</p>
        </Link>
      ))}
    </div>
  );
}

export function OrdersPage() {
  const { data, err } = useFetch('/api/orders');
  if (err) return <p className="err">{err}</p>;
  if (!data) return <Loading />;
  return (
    <div className="stack">
      <h1>Orders</h1>
      <p className="small muted">An accepted offer becomes an order. Payment status stays “not recorded” until someone updates it. That is not proof of payment.</p>
      {!data.orders.length && <Empty title="No orders" />}
      {data.orders.map((o) => (
        <article className="card" key={o.id}>
          <b>{o.batch_code}</b>
          <p>{o.product_name} · {o.quantity} {o.unit} · {o.agreed_price} {o.currency}/{o.price_unit}</p>
          <p className="small">{o.status} · delivery {o.delivery_status} · payment {o.payment_status}</p>
        </article>
      ))}
    </div>
  );
}

export function AssistantPage() {
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState('');
  const [question, setQuestion] = useState('What is missing?');
  const [answer, setAnswer] = useState(null);
  useEffect(() => { api('/api/batches').then((d) => setBatches(d.batches || [])); }, []);
  return (
    <div className="stack">
      <h1>Record guide</h1>
      <p className="small muted">Answers come from stored records and configured checklists. No external model is called.</p>
      <label className="field"><span>Batch</span>
        <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
          <option value="">None</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.batch_code} · {b.product}</option>)}
        </select>
      </label>
      <label className="field"><span>Question</span><textarea value={question} onChange={(e) => setQuestion(e.target.value)} /></label>
      <button className="btn forest" onClick={async () => setAnswer(await api('/api/ai/assistant', { method: 'POST', body: { batch_id: batchId, question, task: 'navigate' } }))}>Ask</button>
      {answer && (
        <div className="panel">
          <p className="small">{answer.mode}</p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{answer.answer}</p>
        </div>
      )}
    </div>
  );
}

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState(null);
  const [note, setNote] = useState('');
  useEffect(() => { if (user) setForm({ name: user.name, phone: user.phone || '', organisation: user.organisation || '', preferred_language: user.preferred_language || 'en' }); }, [user]);
  if (!form) return <Loading />;
  return (
    <form className="stack panel" onSubmit={async (e) => {
      e.preventDefault();
      await api('/api/auth/me', { method: 'PATCH', body: form });
      await refresh();
      setNote('Saved.');
    }}>
      <h1>Profile</h1>
      <label className="field"><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label className="field"><span>Phone</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
      <label className="field"><span>Organisation</span><input value={form.organisation} onChange={(e) => setForm({ ...form, organisation: e.target.value })} /></label>
      <label className="field"><span>Language</span>
        <select value={form.preferred_language} onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}>
          <option value="en">English</option>
          <option value="bn">বাংলা</option>
          <option value="hi">हिन्दी</option>
        </select>
      </label>
      {note && <p className="oknote">{note}</p>}
      <button className="btn forest" type="submit">Save</button>
    </form>
  );
}

export function CentreArea() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const view = pathname.split('/')[2] || 'dashboard';
  const centreId = user?.centre_id;
  if (view === 'dashboard') return <Dashboard />;
  if (!centreId) return <Empty title="No centre linked" body="An administrator must link this account to a centre." />;
  if (view === 'inventory') return <Inventory centreId={centreId} />;
  if (view === 'batches' || view === 'quality-checks') return <BatchList base="/centre/batches" />;
  if (view === 'collectors') return <CentreCollectors centreId={centreId} />;
  if (view === 'processing') return <CentreProcess centreId={centreId} />;
  if (view === 'orders') return <CentreDispatch centreId={centreId} />;
  if (view === 'analytics') return <CentreAnalytics centreId={centreId} />;
  return <ProfilePage />;
}

function Inventory({ centreId }) {
  const { data, err } = useFetch(`/api/centres/${centreId}/inventory`);
  if (err) return <p className="err">{err}</p>;
  if (!data) return <Loading />;
  return (
    <div className="stack">
      <h1>Inventory</h1>
      {!data.inventory.length && <Empty title="Nothing stored at the centre" />}
      {data.inventory.map((i) => (
        <article className="card" key={i.id}>
          <div className="row"><b>{i.product_name}</b><Stamp tone={statusTone(i.status)}>{i.status}</Stamp></div>
          <p className="serial">{i.batch_code}</p>
          <p>{i.quantity} {i.unit} · {i.location}</p>
        </article>
      ))}
    </div>
  );
}

function CentreCollectors({ centreId }) {
  const { data, reload, err } = useFetch(`/api/centres/${centreId}/collectors`);
  const [form, setForm] = useState({ name: '', email: '', password: 'collector123' });
  const [note, setNote] = useState('');
  if (err) return <p className="err">{err}</p>;
  return (
    <div className="stack">
      <h1>Collectors</h1>
      {data?.collectors.map((c) => <p key={c.id}>{c.name} {c.phone}</p>)}
      <form className="panel stack" onSubmit={async (e) => {
        e.preventDefault();
        const res = await api(`/api/centres/${centreId}/collectors`, { method: 'POST', body: form });
        setNote(res.notice);
        reload();
      }}>
        <h3>Register a collector</h3>
        <label className="field"><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label className="field"><span>Email</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label className="field"><span>Temporary password</span><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        {note && <p className="small">{note}</p>}
        <button className="btn forest" type="submit">Create</button>
      </form>
    </div>
  );
}

function CentreProcess({ centreId }) {
  const { data } = useFetch(`/api/centres/${centreId}/inventory`);
  const [form, setForm] = useState({ batch_id: '', method: '', output_qty: '' });
  const [note, setNote] = useState('');
  return (
    <form className="stack panel" onSubmit={async (e) => {
      e.preventDefault();
      await api(`/api/centres/${centreId}/processing`, { method: 'POST', body: { ...form, output_qty: form.output_qty ? Number(form.output_qty) : null } });
      setNote('Processing recorded. Earlier batch history is unchanged.');
    }}>
      <h1>Processing</h1>
      <label className="field"><span>Batch</span>
        <select value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })} required>
          <option value="">Choose</option>
          {data?.inventory.map((i) => <option key={i.batch_id} value={i.batch_id}>{i.batch_code}</option>)}
        </select>
      </label>
      <label className="field"><span>Method</span><input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} required /></label>
      <label className="field"><span>Output quantity</span><input inputMode="decimal" value={form.output_qty} onChange={(e) => setForm({ ...form, output_qty: e.target.value })} /></label>
      {note && <p className="oknote">{note}</p>}
      <button className="btn forest" type="submit">Record</button>
    </form>
  );
}

function CentreDispatch({ centreId }) {
  const { data } = useFetch(`/api/centres/${centreId}/inventory`);
  const [form, setForm] = useState({ batch_id: '', quantity: '', dispatch_date: '' });
  const [note, setNote] = useState('');
  return (
    <form className="stack panel" onSubmit={async (e) => {
      e.preventDefault();
      await api(`/api/centres/${centreId}/dispatch`, { method: 'POST', body: { ...form, quantity: Number(form.quantity) } });
      setNote('Dispatch recorded.');
    }}>
      <h1>Dispatch</h1>
      <label className="field"><span>Batch</span>
        <select value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })} required>
          <option value="">Choose</option>
          {data?.inventory.map((i) => <option key={i.batch_id} value={i.batch_id}>{i.batch_code} ({i.quantity} {i.unit})</option>)}
        </select>
      </label>
      <label className="field"><span>Quantity</span><input inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></label>
      <label className="field"><span>Date</span><input type="date" value={form.dispatch_date} onChange={(e) => setForm({ ...form, dispatch_date: e.target.value })} /></label>
      {note && <p className="oknote">{note}</p>}
      <button className="btn forest" type="submit">Dispatch</button>
    </form>
  );
}

function CentreAnalytics({ centreId }) {
  const { data, err } = useFetch(`/api/centres/${centreId}/analytics`);
  if (err) return <p className="err">{err}</p>;
  if (!data) return <Loading />;
  const max = Math.max(1, ...data.inventory_by_status.map((r) => r.count));
  return (
    <div className="stack">
      <h1>Centre counts</h1>
      <p className="small muted">{data.note}</p>
      <div className="cards">
        <article className="card"><p>Incoming</p><h2>{data.incoming}</h2></article>
        <article className="card"><p>Pending checks</p><h2>{data.pending_quality}</h2></article>
        <article className="card"><p>Orders linked</p><h2>{data.sales_recorded}</h2></article>
      </div>
      <div className="bars">
        {data.inventory_by_status.map((r) => (
          <div className="bar" key={r.status}><span>{r.status}</span><i style={{ width: `${(r.count / max) * 100}%` }} /><b>{r.count}</b></div>
        ))}
      </div>
    </div>
  );
}

export function AdminArea() {
  const { pathname } = useLocation();
  const view = pathname.split('/')[2] || 'dashboard';
  if (view === 'dashboard') return <Dashboard />;
  if (view === 'users') return <AdminUsers />;
  if (view === 'products' || view === 'quality-profiles') return <AdminProducts />;
  if (view === 'states' || view === 'districts') return <AdminPlaces />;
  if (view === 'audit-logs') return <AdminAudit />;
  if (view === 'schemes') return <AdminSchemes />;
  if (view === 'centres' || view === 'buyers' || view === 'settings') return <AdminSettings />;
  return <Dashboard />;
}

function AdminUsers() {
  const { data, reload, err } = useFetch('/api/admin/users');
  if (err) return <p className="err">{err}</p>;
  if (!data) return <Loading />;
  return (
    <div className="stack">
      <h1>Users</h1>
      {data.users.map((u) => (
        <article className="card row" key={u.id}>
          <div style={{ flex: 1 }}><b>{u.name}</b><p className="small muted">{u.email} · {u.role} {u.is_demo ? '· demo' : ''}</p></div>
          <button className="btn ghost" onClick={async () => { await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } }); reload(); }}>{u.active ? 'Deactivate' : 'Activate'}</button>
        </article>
      ))}
    </div>
  );
}

function AdminProducts() {
  const { data } = useFetch('/api/products');
  const [pick, setPick] = useState(null);
  const [detail, setDetail] = useState(null);
  useEffect(() => { if (pick) api(`/api/products/${pick}`).then(setDetail); }, [pick]);
  return (
    <div className="stack">
      <h1>Catalogue and limits</h1>
      <p className="small muted">Clearing a limit marks that attribute “not configured”. It does not invent a statutory threshold.</p>
      {(data?.products || []).map((p) => <button key={p.id} className="btn ghost" onClick={() => setPick(p.id)}>{p.name}</button>)}
      {detail?.parameters.map((p) => (
        <LimitEditor key={p.id} parameter={p} onSaved={() => api(`/api/products/${pick}`).then(setDetail)} />
      ))}
    </div>
  );
}

function LimitEditor({ parameter, onSaved }) {
  const [max, setMax] = useState(parameter.max_value ?? '');
  const [source, setSource] = useState(parameter.source_name || '');
  return (
    <form className="card stack" onSubmit={async (e) => {
      e.preventDefault();
      await api(`/api/admin/quality-parameters/${parameter.id}`, { method: 'PATCH', body: { max_value: max === '' ? null : Number(max), source_name: source, clear_limits: max === '' } });
      onSaved();
    }}>
      <b>{parameter.name}</b>
      <label className="field"><span>Maximum, blank = not configured</span><input value={max} onChange={(e) => setMax(e.target.value)} /></label>
      <label className="field"><span>Source</span><input value={source} onChange={(e) => setSource(e.target.value)} /></label>
      <button className="btn forest" type="submit">Save limit</button>
    </form>
  );
}

function AdminPlaces() {
  const [form, setForm] = useState({ name: '', code: '', coverage_note: 'Configured location. Not an operating claim.' });
  const [note, setNote] = useState('');
  return (
    <form className="stack panel" onSubmit={async (e) => {
      e.preventDefault();
      const res = await api('/api/admin/states', { method: 'POST', body: { ...form, languages: ['en'] } });
      setNote(`State ${res.id} added. Link products to it from the catalogue when you are ready.`);
    }}>
      <h1>Add a state</h1>
      <label className="field"><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
      <label className="field"><span>Code</span><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></label>
      {note && <p className="oknote">{note}</p>}
      <button className="btn forest" type="submit">Add</button>
    </form>
  );
}

function AdminAudit() {
  const { data, err } = useFetch('/api/admin/audit');
  if (err) return <p className="err">{err}</p>;
  if (!data) return <Loading />;
  return (
    <div className="stack">
      <h1>Audit</h1>
      <Stamp tone={data.chain.valid ? 'ok' : 'no'}>{data.chain.valid ? 'Local hash chain matches' : 'Chain broken'}</Stamp>
      <p className="small muted">This is an append-only log in this database, not a public blockchain.</p>
      {data.events.slice(0, 40).map((e) => (
        <p className="small" key={e.id}><b>{e.seq}.</b> {e.event_type} · {e.timestamp}</p>
      ))}
    </div>
  );
}

function AdminSchemes() {
  return (
    <div className="stack">
      <h1>Schemes</h1>
      <p className="small">Use the public directory to open official links. New scheme records require an official URL.</p>
      <Link className="btn forest" to="/schemes">Open directory</Link>
    </div>
  );
}

function AdminSettings() {
  const [banner, setBanner] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { api('/api/meta').then((d) => setBanner(d.banner || '')); }, []);
  return (
    <form className="stack panel" onSubmit={async (e) => {
      e.preventDefault();
      await api('/api/admin/settings', { method: 'PUT', body: { settings: { banner } } });
      setNote('Banner saved.');
    }}>
      <h1>Settings</h1>
      <label className="field"><span>Banner</span><textarea value={banner} onChange={(e) => setBanner(e.target.value)} /></label>
      {note && <p className="oknote">{note}</p>}
      <button className="btn forest" type="submit">Save</button>
    </form>
  );
}

export function BuyerMarket() {
  return <BatchList base="/buyer/marketplace" />;
}
