import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../components/ui/Icon';
import PageHero from '../components/layout/PageHero';
import PhotoUploader from '../components/PhotoUploader';
import { Button, Card, Field, Img, Input, LoadingState, Select, SectionHead, Textarea } from '../components/ui/primitives';
import { useUI } from '../context/UIContext';
import { useCreateBatch, useMeta, usePassport, useProducts, useSubmitBatch, useUpdateBatch } from '../api/queries';
import { api } from '../lib/api';
import { dataUrlToBase64 } from '../lib/image';
import { useDocTitle } from '../hooks';
import { fmtDate, productImage } from '../lib/format';

const STEPS = [
  ['Produce & Quantity', 'What are you collecting?'],
  ['Collection Details', 'When and where?'],
  ['Handling & Storage', 'How was it processed?'],
  ['Review & Save', 'Check and submit'],
];
const HANDLING = ['drying', 'sorting', 'storage', 'packaging', 'transport'];
const METHODS = ['Traditional (Wild Collection)', 'Hand picked', 'Managed / Cultivated', 'Group Collection'];
const GRADES = ['Grade A', 'Grade B', 'Grade C', 'Raw / Ungraded'];
const today = () => new Date().toISOString().slice(0, 10);

const slide = {
  enter: (d) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: (d) => ({ opacity: 0, x: d > 0 ? -40 : 40, transition: { duration: 0.18 } }),
};

const empty = {
  product_id: '', local_name: '', quantity: '', unit: '', grade_label: '', source_note: '',
  collection_date: today(), collection_method: METHODS[0], state_id: '', district_id: '', block_name: '', collection_area: '', source_declaration: '',
  handling: [], moisture: '', foreign: '', colour: '', public_share: false,
};

export default function CreateBatch() {
  const { id } = useParams();
  const editing = !!id;
  useDocTitle(editing ? 'Edit Batch' : 'Create Batch');
  const navigate = useNavigate();
  const { toast, confirm } = useUI();
  const products = useProducts();
  const meta = useMeta();
  const existing = usePassport(id);
  const create = useCreateBatch();
  const update = useUpdateBatch();
  const submit = useSubmitBatch();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [f, setF] = useState(empty);
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const product = (products.data || []).find((p) => p.id === f.product_id);
  const districts = useMemo(() => (meta.data?.districts || []).filter((d) => !f.state_id || d.state_id === f.state_id), [meta.data, f.state_id]);

  // defaults once reference data is in
  useEffect(() => {
    if (editing || !products.data || !meta.data) return;
    setF((s) => {
      if (s.product_id) return s;
      const p = products.data[0];
      const st = meta.data.states.find((x) => x.id === 'ST-WB') || meta.data.states[0];
      return { ...s, product_id: p.id, unit: p.default_unit || p.units?.[0] || 'kg', state_id: st?.id || '', district_id: meta.data.districts.find((d) => d.state_id === st?.id)?.id || '' };
    });
  }, [editing, products.data, meta.data]);

  // populate when editing
  useEffect(() => {
    const p = existing.data;
    if (!editing || !p) return;
    setF((s) => ({
      ...s, product_id: p.product_id, local_name: p.local_name || '', quantity: p.quantity, unit: p.unit, grade_label: p.grade_label || '', source_note: '',
      collection_date: p.collection_date || today(), collection_method: p.collection_method || METHODS[0],
      state_id: meta.data?.states.find((x) => x.name === p.state)?.id || '', district_id: meta.data?.districts.find((d) => d.name === p.district)?.id || '',
      block_name: p.block_name || '', collection_area: p.collection_area || '', source_declaration: p.source_declaration || '',
    }));
  }, [editing, existing.data, meta.data]);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const onProduct = (e) => {
    const p = (products.data || []).find((x) => x.id === e.target.value);
    setF((s) => ({ ...s, product_id: p.id, unit: p.default_unit || p.units?.[0] || s.unit }));
  };
  const toggleHandling = (kind) => setF((s) => ({
    ...s, handling: s.handling.some((h) => h.kind === kind) ? s.handling.filter((h) => h.kind !== kind) : [...s.handling, { kind, method: '' }],
  }));
  const setMethod = (kind, method) => setF((s) => ({ ...s, handling: s.handling.map((h) => (h.kind === kind ? { ...h, method } : h)) }));

  const validate = (n) => {
    const e = {};
    if (n === 0) {
      if (!f.product_id) e.product_id = 'Choose a produce type.';
      if (!(Number(f.quantity) > 0)) e.quantity = 'Enter a quantity greater than 0.';
      if (!f.unit) e.unit = 'Choose a unit.';
    }
    if (n === 1) {
      if (!f.collection_date) e.collection_date = 'Choose the collection date.';
      else if (f.collection_date > today()) e.collection_date = 'Collection date cannot be in the future.';
      if (!f.district_id) e.district_id = 'Choose a district.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const go = (n) => { setDir(n > step ? 1 : -1); setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const next = () => { if (validate(step)) go(step + 1); };
  const jump = (n) => { if (n < step) go(n); else if (n === step + 1) next(); else if (n > step) toast('Complete the current step first.', 'err'); };

  const body = () => ({
    product_id: f.product_id, quantity: Number(f.quantity), unit: f.unit, local_name: f.local_name || null, grade_label: f.grade_label || null,
    collection_date: f.collection_date, collection_method: f.collection_method, state_id: f.state_id, district_id: f.district_id,
    block_name: f.block_name || null, collection_area: f.collection_area || null, source_declaration: f.source_declaration || null,
    source_note: f.source_note || null, public_share: f.public_share,
    handling: f.handling.map((h) => ({ kind: h.kind, method: h.method || null, start_date: f.collection_date })),
    measurements: [
      f.moisture !== '' && { parameter_name: 'Moisture', value: Number(f.moisture), unit: '%', evidence_source: 'self_reported', method: 'Collector reading', notes: 'Entered by the collector while creating the batch.' },
      f.foreign !== '' && { parameter_name: 'Foreign matter', value: Number(f.foreign), unit: '%', evidence_source: 'self_reported', method: 'Collector reading', notes: 'Entered by the collector while creating the batch.' },
      f.colour && { parameter_name: 'Colour', text_value: f.colour, evidence_source: 'self_reported', method: 'Visual assessment', notes: 'Entered by the collector while creating the batch.' },
    ].filter(Boolean),
  });

  const uploadPhotos = async (batchId) => {
    for (const p of photos) {
      await api(`/api/batches/${batchId}/evidence`, {
        method: 'POST',
        body: { kind: 'photo', label: p.name, filename: p.name, mime: 'image/jpeg', data_base64: dataUrlToBase64(p.url), visibility: f.public_share ? 'public' : 'private' },
      });
    }
  };

  const save = async (andSubmit) => {
    if (!validate(0) || !validate(1)) { toast('Please complete the required fields first.', 'err'); return; }
    setBusy(true);
    try {
      let batchId = id;
      if (editing) {
        const patch = body();
        delete patch.handling; delete patch.measurements; delete patch.product_id;
        const locked = ['verified', 'verified_with_limitations', 'dispatched'].includes(existing.data?.status);
        await update.mutateAsync({ id, ...patch, ...(locked ? {} : { quantity: patch.quantity }) });
        if (andSubmit) await submit.mutateAsync({ id, public_share: f.public_share });
      } else {
        const res = await create.mutateAsync({ ...body(), submit: andSubmit });
        batchId = res.passport.id;
      }
      if (photos.length) await uploadPhotos(batchId);
      toast(andSubmit ? 'Batch submitted for assessment.' : 'Draft saved.');
      navigate(andSubmit ? `/passport/${batchId}` : '/batches');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (await confirm({ title: 'Discard this batch?', text: 'Anything you entered on this form will be lost.', ok: 'Discard', cancel: 'Keep editing', danger: true })) navigate('/batches');
  };

  if (editing && existing.isLoading) return <LoadingState rows={6} />;
  if (editing && existing.error) return <Card><p className="alert-red">{existing.error.message}</p></Card>;

  const common = (products.data || []).slice(0, 5);
  const stateName = meta.data?.states.find((s) => s.id === f.state_id)?.name;
  const districtName = meta.data?.districts.find((d) => d.id === f.district_id)?.name;

  return (
    <>
      <PageHero icon="leaf" title={editing ? 'Edit Batch' : 'Create New Batch'} sub="Record your forest produce batch with key information. This helps buyers understand your quality and compare prices." />

      <nav className="stepper" aria-label="Progress">
        {STEPS.map(([t, s], i) => (
          <button key={t} type="button" className={`step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} onClick={() => jump(i)} aria-current={i === step ? 'step' : undefined}>
            <motion.i animate={{ scale: i === step ? 1.08 : 1 }}>{i < step ? <Icon name="check" /> : i + 1}</motion.i>
            <div><b>{t}</b><small>{s}</small></div>
          </button>
        ))}
      </nav>

      <form onSubmit={(e) => { e.preventDefault(); step < 3 ? next() : save(true); }} noValidate>
        <div className="cb-grid">
          <div style={{ minWidth: 0 }}>
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div key={step} custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
                {step === 0 && (
                  <Card>
                    <SectionHead icon="package" title="1. Produce and Quantity" sub="Tell us what you have collected and how much." />
                    <div className="form-grid">
                      <Field className="c3" label="Produce Type" required error={errors.product_id} htmlFor="ptype">
                        <Select id="ptype" value={f.product_id} onChange={onProduct} disabled={editing && ['verified', 'verified_with_limitations', 'dispatched'].includes(existing.data?.status)}>
                          {(products.data || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                      </Field>
                      <Field className="c3" label="Local/Common Name" optional htmlFor="lname" hint="Name used in your local area (e.g., Mahua, Sal Seed, Tendu Leaf)"><Input id="lname" value={f.local_name} onChange={set('local_name')} /></Field>
                      <Field className="c2" label="Quantity" required error={errors.quantity} htmlFor="qty"><Input id="qty" type="number" min="0" step="any" value={f.quantity} onChange={set('quantity')} /></Field>
                      <Field className="c2" label="Unit" required error={errors.unit} htmlFor="unit">
                        <Select id="unit" value={f.unit} onChange={set('unit')}>{(product?.units?.length ? product.units : ['kg']).map((u) => <option key={u}>{u}</option>)}</Select>
                      </Field>
                      <Field className="c2" label="Estimated Grade" optional htmlFor="grade" hint="If you are not sure, you can keep this empty.">
                        <Select id="grade" value={f.grade_label} onChange={set('grade_label')}><option value="">Select grade</option>{GRADES.map((g) => <option key={g}>{g}</option>)}</Select>
                      </Field>
                      <Field className="c6" label="Description" optional htmlFor="desc">
                        <Textarea id="desc" rows={4} maxLength={500} value={f.source_note} onChange={set('source_note')} placeholder="Add any additional details about your produce (e.g., flower source, type, special characteristics)…" />
                        <span className="hint" style={{ textAlign: 'right' }}>{f.source_note.length}/500</span>
                      </Field>
                      <div className="field c6"><label>Photos <small>(Optional)</small></label>
                        <span className="hint">Add photos of your produce, packaging or collection process. They are stored as evidence on this batch.</span>
                        <PhotoUploader photos={photos} onChange={setPhotos} />
                      </div>
                    </div>
                  </Card>
                )}

                {step === 1 && (
                  <Card>
                    <SectionHead icon="pin" tone="blue" title="2. Collection Details" sub="When, where and how was it collected?" />
                    <div className="form-grid">
                      <Field className="c3" label="Collection Date" required error={errors.collection_date} htmlFor="cdate"><Input id="cdate" type="date" max={today()} value={f.collection_date} onChange={set('collection_date')} /></Field>
                      <Field className="c3" label="Collection Method" htmlFor="method"><Select id="method" value={f.collection_method} onChange={set('collection_method')}>{METHODS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
                      <Field className="c2" label="State" required htmlFor="state">
                        <Select id="state" value={f.state_id} onChange={(e) => setF((s) => ({ ...s, state_id: e.target.value, district_id: '' }))}>{(meta.data?.states || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
                      </Field>
                      <Field className="c2" label="District" required error={errors.district_id} htmlFor="dist">
                        <Select id="dist" value={f.district_id} onChange={set('district_id')}><option value="">Select district</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
                      </Field>
                      <Field className="c2" label="Block" optional htmlFor="block"><Input id="block" value={f.block_name} onChange={set('block_name')} /></Field>
                      <Field className="c6" label="Village / Collection area" optional htmlFor="area"><Input id="area" value={f.collection_area} onChange={set('collection_area')} /></Field>
                      <Field className="c6" label="Collection notes / source declaration" optional htmlFor="decl" hint="Described as declared by you. It is not independently verified.">
                        <Textarea id="decl" rows={3} value={f.source_declaration} onChange={set('source_declaration')} placeholder="e.g. Collected from natural hives in Sal forest area." />
                      </Field>
                    </div>
                  </Card>
                )}

                {step === 2 && (
                  <Card>
                    <SectionHead icon="leaf" tone="amber" title="3. Handling and Storage" sub="How was the produce handled after collection?" />
                    {editing ? (
                      <p className="sub" style={{ fontSize: 14 }}>Handling records are append-only. Add or review them in the <Button size="xs" to={`/post-harvest/${id}`}>Post-Harvest Assistant</Button>.</p>
                    ) : (
                      <div className="form-grid">
                        <div className="field c6"><label>Post-harvest handling <small>(select all that apply)</small></label>
                          <div className="chipsel">{HANDLING.map((k) => (
                            <label key={k}><input type="checkbox" checked={f.handling.some((h) => h.kind === k)} onChange={() => toggleHandling(k)} /><span style={{ textTransform: 'capitalize' }}>{k}</span></label>
                          ))}</div></div>
                        <AnimatePresence>
                          {f.handling.map((h) => (
                            <motion.div key={h.kind} className="field c3" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                              <label htmlFor={`m-${h.kind}`} style={{ textTransform: 'capitalize' }}>{h.kind} method</label>
                              <Input id={`m-${h.kind}`} value={h.method} onChange={(e) => setMethod(h.kind, e.target.value)} placeholder="e.g. Sun drying on a raised mat" />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        <Field className="c2" label="Moisture %" optional htmlFor="moist" hint="Only if you measured it"><Input id="moist" type="number" min="0" max="100" step="0.1" value={f.moisture} onChange={set('moisture')} /></Field>
                        <Field className="c2" label="Foreign matter %" optional htmlFor="fm"><Input id="fm" type="number" min="0" max="100" step="0.1" value={f.foreign} onChange={set('foreign')} /></Field>
                        <Field className="c2" label="Colour" optional htmlFor="col" hint="Visual assessment"><Input id="col" value={f.colour} onChange={set('colour')} placeholder="e.g. Dark Amber" /></Field>
                        <p className="hint c6">Values you enter are stored as <b>self-reported</b>. They are not treated as laboratory-verified.</p>
                      </div>
                    )}
                  </Card>
                )}

                {step === 3 && (
                  <Card>
                    <SectionHead icon="check" title="4. Review and Save" sub="Check everything before saving or submitting for assessment." />
                    {[
                      ['Produce type', product?.name], ['Local name', f.local_name || '—'], ['Quantity', `${f.quantity} ${f.unit}`], ['Estimated grade', f.grade_label || 'Not provided'],
                      ['Collection date', fmtDate(f.collection_date)], ['Location', [f.block_name, districtName, stateName].filter(Boolean).join(', ')], ['Method', f.collection_method],
                      ['Handling', f.handling.map((h) => h.kind).join(', ') || (editing ? 'Unchanged' : '—')], ['Photos', `${photos.length} attached`],
                    ].map(([k, v]) => <div className="sumline" key={k}><span>{k}</span><b>{v}</b></div>)}
                    <label className="row mt12" style={{ gap: 10, cursor: 'pointer' }}>
                      <input type="checkbox" className="check" checked={f.public_share} onChange={(e) => setF((s) => ({ ...s, public_share: e.target.checked }))} />
                      <span><b>Share this batch publicly</b><br /><span className="sub">Allows the QR verify page and buyers to see the basic passport. Your contact details stay hidden.</span></span>
                    </label>
                    <div className="notice amber sm mt12"><Icon name="info" /><span>Submitting sends this batch for quality assessment. It does not guarantee any grade, buyer offer or price.</span></div>
                  </Card>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <aside className="grid" style={{ alignContent: 'start' }}>
            <Card tone="tint"><div className="row" style={{ alignItems: 'flex-start' }}><Icon name="bulb" style={{ fontSize: 30, color: 'var(--amber)' }} /><div><h3>Why this information matters?</h3><p className="sub" style={{ color: 'var(--ink2)', marginTop: 8, fontSize: 13 }}>Buyers look at the type of produce, quantity and basic details to understand the quality and compare with their requirements.</p></div></div></Card>
            <Card tone="amber"><div className="row" style={{ alignItems: 'flex-start' }}><Icon name="leaf" style={{ fontSize: 28, color: 'var(--g600)' }} /><div><h3>Tips for better value</h3>
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--ink2)', display: 'flex', flexDirection: 'column', gap: 6 }}><li>Use the correct produce type and local name.</li><li>Add clear photos of your produce.</li><li>If you know the grade or type, it can help buyers give better offers.</li></ul></div></div></Card>
            <Card tone="tint"><div className="row"><Icon name="package" style={{ fontSize: 26, color: 'var(--g600)' }} /><h3>Common produce types</h3></div>
              <div className="mt8">{common.map((p) => <div className="ptype" key={p.id}><Img name={productImage(p.name)} alt="" /><div><b>{p.name}</b><span>{(p.description || '').split('.')[0]}</span></div></div>)}</div></Card>
          </aside>
        </div>

        <div className="formbar">
          <Button onClick={cancel}>Cancel</Button>
          <div className="row wrap">
            {step > 0 && <Button icon="left" onClick={() => go(step - 1)}>Back</Button>}
            <Button icon="save" onClick={() => save(false)} disabled={busy}>Save as Draft</Button>
            <Button type="submit" variant="primary" iconRight={step === 3 ? undefined : 'arrow'} icon={step === 3 ? 'check' : undefined} disabled={busy}>{step === 3 ? (busy ? 'Submitting…' : 'Submit for Assessment') : 'Continue'}</Button>
          </div>
        </div>
      </form>
    </>
  );
}
