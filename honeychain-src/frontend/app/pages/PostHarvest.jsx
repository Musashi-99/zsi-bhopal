import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../components/ui/Icon';
import PageHero from '../components/layout/PageHero';
import BatchPicker from '../components/BatchPicker';
import PhotoUploader from '../components/PhotoUploader';
import { Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, Notice, SectionHead, Textarea } from '../components/ui/primitives';
import { GrowBar, Stagger, Item } from '../components/motion';
import { useUI } from '../context/UIContext';
import { useAddEvidence, useAddHandling, usePassport } from '../api/queries';
import { useDocTitle, useSelectedBatch } from '../hooks';
import { STAGES } from '../lib/guidance';
import { fmtDate } from '../lib/format';
import { dataUrlToBase64 } from '../lib/image';
import { scaleIn } from '../lib/motion';

const today = () => new Date().toISOString().slice(0, 10);

export default function PostHarvest() {
  useDocTitle('Post-Harvest Assistant');
  const sel = useSelectedBatch('/post-harvest');
  const q = usePassport(sel.id);
  const add = useAddHandling();
  const addEvidence = useAddEvidence();
  const { toast } = useUI();
  const [cur, setCur] = useState(0);
  const [dlg, setDlg] = useState(null); // { kind, method, notes, start_date, end_date }
  const [photos, setPhotos] = useState([]);
  const p = q.data;
  const stage = STAGES[cur];

  const byKind = useMemo(() => {
    const m = {};
    (p?.handling || []).forEach((h) => { (m[h.kind] ||= []).push(h); });
    return m;
  }, [p]);

  if (sel.isLoading || q.isLoading) return <LoadingState rows={8} />;
  if (sel.error || q.error) return <ErrorState error={sel.error || q.error} onRetry={q.refetch} />;
  if (!sel.batch) return <><PageHero title="Post-Harvest Assistant" sub="Record handling practices and review practical guidance for your produce." /><Card><EmptyState icon="leaf" title="No batches yet">Create a batch first, then record how it was handled.</EmptyState></Card></>;

  const doneTask = (kind, title) => (byKind[kind] || []).find((h) => h.method === title);
  const stageDone = (s) => s.tasks.filter(([t]) => doneTask(s.kind, t)).length;
  const status = (s) => { const d = stageDone(s); const extra = (byKind[s.kind] || []).length; return d === s.tasks.length ? ['Completed', 'green'] : d > 0 || extra ? ['In Progress', 'blue'] : ['Not Started', 'gray']; };
  const locked = ['verified', 'verified_with_limitations', 'dispatched'].includes(p.status);

  const record = async (body, msg = 'Recorded') => {
    try { await add.mutateAsync({ id: p.id, ...body }); toast(msg); } catch (e) { toast(e.message, 'err'); }
  };
  const tick = (title) => record({ kind: stage.kind, method: title, start_date: today() }, `“${title}” recorded`);
  const saveDialog = async (e) => {
    e.preventDefault();
    if (dlg.end_date && dlg.start_date && dlg.end_date < dlg.start_date) { toast('End date cannot be before the start date.', 'err'); return; }
    if (dlg.start_date && dlg.start_date < p.collection_date) { toast(`Start date cannot be before the collection date (${fmtDate(p.collection_date)}).`, 'err'); return; }
    await record({ kind: dlg.kind, method: dlg.method || null, notes: dlg.notes || null, start_date: dlg.start_date || null, end_date: dlg.end_date || null }, 'Details saved');
    setDlg(null);
  };
  const uploadPhotos = async (list) => {
    const fresh = list.filter((x) => !photos.some((o) => o.id === x.id));
    setPhotos(list);
    for (const ph of fresh) {
      try { await addEvidence.mutateAsync({ id: p.id, kind: 'photo', label: `Post-harvest: ${stage.title}`, filename: ph.name, mime: 'image/jpeg', data_base64: dataUrlToBase64(ph.url), visibility: 'private' }); toast('Photo stored as evidence'); } catch (e) { toast(e.message, 'err'); }
    }
  };
  const asst = p.intelligence?.assistant;
  const doneCount = stageDone(stage);

  return (
    <>
      <PageHero title="Post-Harvest Assistant" sub="Record handling practices and review practical guidance for your produce." />
      <div className="ph-top">
        <Card><BatchPicker batches={sel.batches} batch={sel.batch} onSelect={sel.select} /></Card>
        <Card tone="tint" className="row" style={{ gap: 18, padding: '18px 24px' }}><Icon name="leaf" style={{ fontSize: 44, color: 'var(--g600)' }} /><p style={{ fontSize: 14.5 }}>Follow good post-harvest practices to maintain quality, meet buyer requirements and improve the value of your produce.</p></Card>
      </div>

      <div className="ph-main">
        <div>
          <div className="ph-stages" role="tablist" aria-label="Post-harvest stages">
            {STAGES.map((s, i) => (
              <button key={s.kind} type="button" role="tab" aria-selected={i === cur} className={`stage ${i === cur ? 'active' : ''}`} onClick={() => setCur(i)}>
                <span className={`sec-ic ${s.tone}`}><Icon name={s.icon} /></span><div><b>{i + 1} &nbsp;{s.title}</b><small>{s.short}</small></div>
              </button>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px', alignItems: 'start' }}>
            <AnimatePresence mode="wait">
              <motion.section key={stage.kind} className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
                <div className="row between"><SectionHead icon={stage.icon} tone={stage.tone} title={`${cur + 1}. ${stage.title}`} sub={stage.sub} />
                  <div style={{ width: 140, fontSize: 12, textAlign: 'right' }}>{doneCount} of {stage.tasks.length} completed<GrowBar pct={(doneCount / stage.tasks.length) * 100} color="var(--g600)" /></div></div>
                <div className="mt12">
                  {stage.tasks.map(([title, desc]) => { const rec = doneTask(stage.kind, title); return (
                    <div className="task" key={title}>
                      <input type="checkbox" className="check" id={`t-${title}`} checked={!!rec} disabled={!!rec || add.isPending || locked} onChange={() => tick(title)} />
                      <label className="t" htmlFor={`t-${title}`}><b>{title}</b><small>{desc}</small>{rec?.notes && <small style={{ display: 'block', color: 'var(--g700)' }}>Note: {rec.notes}</small>}</label>
                      <div className="r"><span className={`mini ${rec ? 'green' : 'amber'}`}>{rec ? 'Completed' : 'Not Done'}</span>{rec ? <span>{fmtDate(rec.start_date || rec.created_at)}</span> : <Button size="xs" disabled={locked} onClick={() => setDlg({ kind: stage.kind, method: title, notes: '', start_date: today(), end_date: '' })}>Add Notes</Button>}</div>
                      <IconBtn label={`Add details for ${title}`} disabled={locked} onClick={() => setDlg({ kind: stage.kind, method: title, notes: '', start_date: today(), end_date: '' })} />
                    </div>); })}
                </div>
                <p className="hint mt8">Handling records are append-only: a completed step stays in the batch history.{locked && ' This batch is reviewed, so new handling records are disabled.'}</p>
              </motion.section>
            </AnimatePresence>
            <div className="ph-side">
              <Card tone="amber"><div className="row" style={{ alignItems: 'flex-start' }}><Icon name="bulb" style={{ fontSize: 26, color: 'var(--amber)' }} /><div><h3>Why it matters?</h3><p style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 6 }}>{stage.why}</p></div></div></Card>
              <Card tone="tint"><div className="row"><Icon name="leaf" style={{ color: 'var(--g600)', fontSize: 22 }} /><h3>Good practices for {sel.batch.product.toLowerCase()}</h3></div><ul className="list-check mt8" style={{ fontSize: 12.5 }}>{stage.good.map((g) => <li key={g}><Icon name="cc" />{g}</li>)}</ul></Card>
              <Card tone="red"><div className="row"><Icon name="alert" style={{ color: 'var(--red)', fontSize: 22 }} /><h3>Common issues to avoid</h3></div><ul className="list-check x mt8" style={{ fontSize: 12.5 }}>{stage.bad.map((g) => <li key={g}><Icon name="xc" />{g}</li>)}</ul></Card>
            </div>
          </div>

          {asst && (
            <Card className="mt12">
              <SectionHead icon="sparkle" tone="purple" title="Checks for this batch" sub={asst.mode} />
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
                {asst.missing?.length > 0 && <Notice tone="amber" small><span><b>Missing records:</b> {asst.missing.map((m) => m.item).join(', ')}</span></Notice>}
                {asst.inconsistencies?.map((t) => <Notice key={t} tone="blue" small icon="alert"><span>{t}</span></Notice>)}
                <Notice small icon="check"><span><b>Next:</b> {asst.next_steps?.[0]}</span></Notice>
              </div>
              <div className="row wrap mt8">{asst.future_batch_checklist?.map((c) => <span key={c.item} className={`mini ${c.state === 'recorded' ? 'green' : c.state === 'missing' ? 'amber' : 'gray'}`} style={{ textTransform: 'capitalize' }}>{c.item}: {c.state}</span>)}</div>
            </Card>
          )}

          <div className="grid mt12" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', alignItems: 'start' }}>
            <Card>
              <SectionHead icon="file" size="sm" title="Your Recorded Practices for This Batch" sub="This shows what you have recorded for each stage." />
              <div className="tblwrap"><table className="tbl"><thead><tr><th>Stage</th><th>Key Details</th><th>Status</th><th>Last Updated</th><th>Actions</th></tr></thead><tbody>
                {STAGES.map((s, i) => { const recs = byKind[s.kind] || []; const last = recs.at(-1); const [st, tone] = status(s); return (
                  <tr key={s.kind}><td><b>{s.title}</b></td><td style={{ fontSize: 12 }}>{last ? (last.method || last.notes || 'Recorded') : 'Not recorded yet'}</td><td><span className={`mini ${tone}`}>{st}</span></td><td>{last ? fmtDate(last.created_at) : '-'}</td>
                    <td><Button size="xs" iconRight="arrow" onClick={() => { setCur(i); window.scrollTo({ top: 200, behavior: 'smooth' }); }}>{recs.length ? 'View / Edit' : 'Add Details'}</Button></td></tr>); })}
              </tbody></table></div>
            </Card>
            <Card>
              <SectionHead icon="image" size="sm" title={<>Photos <span style={{ fontWeight: 400 }}>(Optional)</span></>} sub={`Add photos of your ${stage.title.toLowerCase()} process. They are stored as evidence.`} />
              <PhotoUploader compact photos={photos} onChange={uploadPhotos} />
              {(p.evidence || []).filter((e) => e.label?.startsWith('Post-harvest')).length > 0 && <p className="hint mt8">{p.evidence.filter((e) => e.label?.startsWith('Post-harvest')).length} post-harvest photo(s) already stored.</p>}
            </Card>
          </div>
        </div>

        <aside className="ph-side">
          <Card>
            <SectionHead icon="book" size="sm" title={`Guidance for ${sel.batch.product}`} sub="General best practices based on commonly accepted post-harvest guidelines." />
            <Stagger>{STAGES.map((s, i) => <Item key={s.kind}><button type="button" className="gside" style={{ width: '100%', background: 'none', border: 0, borderTop: i ? '1px solid var(--line)' : 0, textAlign: 'left' }} onClick={() => setCur(i)}><span className={`sec-ic ${s.tone}`} style={{ width: 40, height: 40 }}><Icon name={s.icon} /></span><div><b>{s.title}</b><small>{s.short}</small></div></button></Item>)}</Stagger>
            <Button variant="primary" block className="mt12" icon="file" iconRight="arrow" onClick={() => window.print()}>Download Guidance (PDF)</Button>
          </Card>
          <Card tone="amber"><div className="row" style={{ alignItems: 'flex-start' }}><Icon name="info" style={{ fontSize: 24, color: 'var(--blue)' }} /><div><h3>Important Note</h3><ul className="bullets mt8" style={{ color: 'var(--ink)' }}><li>This guidance is for general information only.</li><li>Follow local regulations and buyer requirements.</li><li>Practices may vary based on your region and produce type.</li><li>This does not guarantee a specific price or quality grade.</li></ul></div></div></Card>
          <Card tone="tint"><div className="row" style={{ alignItems: 'flex-start' }}><Icon name="leaf" style={{ fontSize: 28, color: 'var(--g600)' }} /><div><h3>Need more help?</h3><p className="sub" style={{ color: 'var(--ink2)', marginTop: 4 }}>Contact your local cooperative, forest department extension service or trusted experts for on-site guidance.</p></div></div></Card>
        </aside>
      </div>

      <AnimatePresence>
        {dlg && (
          <motion.div className="modal-bg open" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && setDlg(null)}>
            <motion.form className="modal" variants={scaleIn} initial="hidden" animate="show" exit="exit" onSubmit={saveDialog} role="dialog" aria-modal="true" aria-label="Add handling details" style={{ maxWidth: 520 }}>
              <h3 style={{ textTransform: 'capitalize' }}>{dlg.kind} details</h3>
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginTop: 12 }}>
                <Field className="c2" label="Practice / method" htmlFor="dm" style={{ gridColumn: 'span 2' }}><Input id="dm" value={dlg.method} onChange={(e) => setDlg({ ...dlg, method: e.target.value })} /></Field>
                <Field label="Start date" htmlFor="ds"><Input id="ds" type="date" value={dlg.start_date} onChange={(e) => setDlg({ ...dlg, start_date: e.target.value })} /></Field>
                <Field label="End date" optional htmlFor="de"><Input id="de" type="date" value={dlg.end_date} onChange={(e) => setDlg({ ...dlg, end_date: e.target.value })} /></Field>
                <Field label="Notes" optional htmlFor="dn" style={{ gridColumn: 'span 2' }}><Textarea id="dn" rows={3} value={dlg.notes} onChange={(e) => setDlg({ ...dlg, notes: e.target.value })} /></Field>
              </div>
              <div className="acts"><Button onClick={() => setDlg(null)}>Cancel</Button><Button type="submit" variant="primary" disabled={add.isPending}>Save</Button></div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function IconBtn({ label, ...rest }) {
  return <button type="button" className="iconbtn" aria-label={label} title={label} {...rest}><Icon name="pencil" /></button>;
}
