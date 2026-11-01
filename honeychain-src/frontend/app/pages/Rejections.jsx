import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../components/ui/Icon';
import PageHero from '../components/layout/PageHero';
import { Button, Card, Chip, EmptyState, ErrorState, Field, Img, Input, LoadingState, Notice, SearchInput, Select, StatusBadge, Textarea } from '../components/ui/primitives';
import { Item, Stagger } from '../components/motion';
import { useUI } from '../context/UIContext';
import { useAddHandling, useAllPassports, useRequirements } from '../api/queries';
import { useDocTitle } from '../hooks';
import { OUTCOME, cap, fmtDate, productImage } from '../lib/format';
import { specText } from './QualityPrice';

const ACTIONS = ['Re-drying / Further drying', 'Sorting / Grading', 'Re-cleaning', 'Re-packaging', 'Lab test', 'Contact buyer', 'Try other buyers'];
const STATUS = ['Not Started', 'In Progress', 'Completed'];
const today = () => new Date().toISOString().slice(0, 10);

/** Turn a passport into a rejection/conditional row (or null when nothing needs recovery). */
function toRow(p) {
  const rej = p.rejections?.at(-1);
  const ver = p.verifications?.at(-1);
  const isRej = ['rejected', 'failed_checks'].includes(p.status);
  const isCond = p.status === 'verified_with_limitations' || p.status === 'needs_info';
  if (!rej && !isRej && !isCond) return null;
  const actions = (p.handling || []).filter((h) => h.kind === 'recovery');
  const last = actions.at(-1);
  const m = last?.notes?.match(/^\[(.*?)\]\s*(.*)$/s);
  const unresolved = rej && !rej.resolved_by_verification_id && rej.reassessment_needed;
  return {
    p, id: p.id, code: p.batch_code, kind: isRej || (rej && !isCond) ? 'Rejected' : 'Conditional',
    reason: rej?.explanation || ver?.summary || (p.status === 'needs_info' ? 'More information was requested.' : 'Reason not provided.'),
    source: rej ? `${cap(rej.actor)} · ${(rej.category || '').replaceAll('_', ' ')}` : ver ? 'Reviewer summary' : 'Status',
    date: rej?.created_at || ver?.created_at || p.generated_at,
    corrective: rej?.corrective_action,
    needsAction: !!unresolved || p.status === 'needs_info' || (isRej && !actions.length),
    last: last && { action: last.method, status: m?.[1] || 'Not Started', note: m?.[2] || '', follow: last.start_date },
  };
}

export default function Rejections() {
  useDocTitle('Rejection & Recovery');
  const { id } = useParams();
  const navigate = useNavigate();
  const all = useAllPassports();
  const add = useAddHandling();
  const reqs = useRequirements();
  const specsById = useMemo(() => Object.fromEntries((reqs.data || []).map((r) => [r.id, r.specifications || []])), [reqs.data]);
  const { toast } = useUI();
  const [filter, setFilter] = useState('All');
  const [text, setText] = useState('');
  const [prod, setProd] = useState('All Produce');
  const [latest, setLatest] = useState(true);

  const rows = useMemo(() => all.passports.map(toRow).filter(Boolean), [all.passports]);
  const counts = { All: rows.length, Rejected: rows.filter((r) => r.kind === 'Rejected').length, Conditional: rows.filter((r) => r.kind === 'Conditional').length, 'Action Needed': rows.filter((r) => r.needsAction).length };
  const list = rows
    .filter((r) => (filter === 'All' || (filter === 'Action Needed' ? r.needsAction : r.kind === filter))
      && (!text || (r.code + r.p.product + r.reason).toLowerCase().includes(text.toLowerCase())) && (prod === 'All Produce' || r.p.product === prod))
    .sort((a, b) => (latest ? 1 : -1) * (a.date < b.date ? 1 : -1));
  const current = list.find((r) => r.id === id) || list[0];
  const products = ['All Produce', ...new Set(rows.map((r) => r.p.product))];

  // detail form
  const [form, setForm] = useState({ action: ACTIONS[0], note: '', status: STATUS[0], follow: '' });
  const [err, setErr] = useState('');
  useEffect(() => {
    setForm({ action: current?.last?.action || ACTIONS[0], note: current?.last?.note || '', status: current?.last?.status || STATUS[0], follow: current?.last?.follow || '' });
    setErr('');
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault();
    if (form.follow && form.follow < today()) { setErr("Follow-up date can't be in the past."); return; }
    setErr('');
    try {
      await add.mutateAsync({ id: current.id, kind: 'recovery', method: form.action, notes: `[${form.status}] ${form.note}`.trim(), start_date: form.follow || today() });
      toast(`Recovery action saved for ${current.code}`);
    } catch (ex) { toast(ex.message, 'err'); }
  };

  const pills = [['All', 'all', 'cc'], ['Rejected', 'rej', 'xc'], ['Conditional', 'con', 'alert'], ['Action Needed', 'act', 'info']];
  const intel = current?.p.intelligence;
  const matches = intel?.buyer_matches || [];
  const focus = matches.find((m) => m.checks.some((c) => c.outcome === 'does_not_meet')) || matches[0];

  return (
    <>
      <PageHero title="Rejection & Recovery" sub="Understand rejection reasons and record your next steps." />
      {all.isLoading ? <LoadingState rows={6} /> : all.error ? <ErrorState error={all.error} onRetry={all.refetch} /> : (
        <div className="rj-grid">
          <div>
            <Notice className="mb12" icon="bulb"><span>A batch may be rejected or marked conditional if it does not fully meet a reviewer's or buyer's requirements. Review the reason, compare with your batch details and take practical steps to improve or try other buyers.</span></Notice>
            <div className="row wrap mb12" style={{ gap: 12 }}>
              {pills.map(([k, c, ic]) => <button key={k} type="button" aria-pressed={filter === k} className={`rpill ${c} ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}><Icon name={ic} />{k} ({counts[k]})</button>)}
            </div>
            <div className="row mb12" style={{ flexWrap: 'wrap' }}>
              <SearchInput value={text} onChange={setText} placeholder="Search by batch, produce, reason…" style={{ flex: 1.4, minWidth: 150 }} />
              <Select aria-label="Produce" style={{ width: 150, height: 44 }} value={prod} onChange={(e) => setProd(e.target.value)}>{products.map((x) => <option key={x}>{x}</option>)}</Select>
              <Button style={{ height: 44 }} icon="sort" onClick={() => setLatest((v) => !v)}>{latest ? 'Latest First' : 'Oldest First'}</Button>
            </div>
            {list.length === 0 ? <Card><EmptyState icon="check" title={rows.length ? 'No matching batches' : 'Nothing to recover'}>{rows.length ? 'Nothing to show for these filters.' : 'None of your batches has been rejected or marked conditional.'}</EmptyState></Card> : (
              <Stagger key={filter + prod + text + latest}>
                {list.map((r) => (
                  <Item key={r.id}>
                    <motion.article layout className={`rcard ${current?.id === r.id ? 'picked' : ''}`} tabIndex={0} role="button" aria-label={`${r.code} ${r.kind}`} whileHover={{ x: 3 }}
                      onClick={() => navigate(`/rejections/${r.id}`)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), navigate(`/rejections/${r.id}`))}>
                      <Img name={productImage(r.p.product)} alt="" />
                      <div className="l"><b>{r.code.replace('AV-WB-', '')}</b><Chip tone={r.kind === 'Rejected' ? 'rejected' : 'cond'} icon="plus">{r.kind}</Chip><div style={{ marginTop: 3 }}>{r.p.product} &nbsp;•&nbsp; {r.p.quantity} {r.p.unit}</div><div style={{ color: 'var(--muted)' }}>{fmtDate(r.date)}</div></div>
                      <div className="r"><b>Reason</b>{r.reason}<small>Source: {r.source}</small></div><Icon name="right" />
                    </motion.article>
                  </Item>
                ))}
              </Stagger>
            )}
          </div>

          <Card style={{ padding: 0, minHeight: 200 }}>
            <AnimatePresence mode="wait">
              {!current ? <EmptyState key="none" icon="alert" title="Select a batch" /> : (
                <motion.div key={current.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}>
                  <div style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
                    <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <Img name={productImage(current.p.product)} alt="" style={{ width: 78, height: 78, borderRadius: 8, objectFit: 'cover' }} />
                      <div style={{ flex: 1 }}><div className="row"><b style={{ fontSize: 19 }}>{current.code}</b><Chip tone={current.kind === 'Rejected' ? 'rejected' : 'cond'} icon="plus">{current.kind}</Chip></div>
                        <div style={{ color: 'var(--ink2)', marginTop: 2 }}>{current.p.product} • {current.p.quantity} {current.p.unit}</div>
                        <div className="sub">Status: <StatusBadge status={current.p.status} /> &nbsp;|&nbsp; Reviewed on {fmtDate(current.date)}</div></div>
                      <Button size="sm" to={`/passport/${current.id}`} icon="ext">View Quality Passport</Button>
                    </div>
                  </div>
                  <div style={{ padding: 16 }}>
                    <div className="row"><span className="sec-ic sm red"><Icon name="alert" /></span><h2 style={{ fontSize: 17 }}>{current.kind === 'Rejected' ? 'Rejection' : 'Conditional'} Details</h2></div>
                    <div className="alert-red mt8" style={current.kind === 'Conditional' ? { background: '#fdf0d4', borderColor: '#f3dba5', color: '#b45309' } : undefined}>{current.reason}<small>Source: {current.source}</small></div>

                    {focus && (
                      <>
                        <div className="row mt16"><span className="sec-ic sm"><Icon name="file" /></span><b style={{ fontSize: 15 }}>Requirement vs Your Batch</b></div>
                        <div className="tblwrap mt8"><table className="tbl"><thead><tr><th>Parameter</th><th>Buyer Requirement<br />({focus.organisation || focus.buyer_name})</th><th>Your Batch</th><th>Result</th></tr></thead><tbody>
                          {focus.checks.map((c) => { const o = OUTCOME[c.outcome] || OUTCOME.cannot_be_assessed; return (
                            <tr key={c.parameter}><td>{c.parameter}</td><td>{specText((specsById[focus.requirement_id] || []).find((x) => x.parameter === c.parameter))}</td><td style={c.outcome === 'does_not_meet' ? { color: 'var(--red-ink)' } : undefined}>{c.recorded_value == null ? 'Not recorded' : `${c.recorded_value}${c.unit && typeof c.recorded_value === 'number' ? ' ' + c.unit : ''}`}</td><td><Chip tone={o.tone} icon={o.icon}>{o.label}</Chip></td></tr>); })}
                        </tbody></table></div>
                      </>
                    )}

                    <div className="grid mt16" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
                      <Card tone="amber" style={{ padding: 12 }}><div className="row"><span style={{ color: 'var(--amber)' }}><Icon name="bulb" /></span><b>Why This May Have Happened</b></div>
                        <ul className="bullets mt8">{(() => { const w = focus?.checks.filter((c) => c.outcome !== 'meets_recorded_specification').slice(0, 3).map((c) => c.reason) || []; return (w.length ? w : [current.reason]).map((t, i) => <li key={i}>{t}</li>); })()}</ul></Card>
                      <Card tone="tint" style={{ padding: 12 }}><div className="row"><span style={{ color: 'var(--g600)' }}><Icon name="leaf" /></span><b>Possible Next Steps</b></div>
                        <div className="steps-n mt8">{[current.corrective, ...(intel?.recommendations || []).map((r) => r.action), 'Try other buyers whose requirements match your recorded evidence.'].filter(Boolean).slice(0, 4).map((t, i) => <div key={i}><i>{i + 1}</i>{t}</div>)}</div>
                        <p className="hint mt8" style={{ display: 'flex', gap: 6 }}><Icon name="info" />These are general suggestions and do not guarantee acceptance or a higher price.</p></Card>
                    </div>

                    <div className="row mt16"><span className="sec-ic sm"><Icon name="file" /></span><b style={{ fontSize: 15 }}>Record Your Action</b></div>
                    <form className="grid mt8" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', alignItems: 'start' }} onSubmit={save} noValidate>
                      <Field label="Action Taken" required htmlFor="ac"><Select id="ac" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>{ACTIONS.map((a) => <option key={a}>{a}</option>)}</Select></Field>
                      <Field label="Notes" optional htmlFor="nt"><Textarea id="nt" maxLength={500} style={{ minHeight: 58 }} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /><span className="hint" style={{ textAlign: 'right' }}>{form.note.length}/500</span></Field>
                      <Field label="Status" htmlFor="ss"><Select id="ss" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS.map((a) => <option key={a}>{a}</option>)}</Select></Field>
                      <Field label="Follow-up Date" optional error={err} htmlFor="fu"><Input id="fu" type="date" value={form.follow} onChange={(e) => setForm({ ...form, follow: e.target.value })} /></Field>
                      <div style={{ alignSelf: 'end' }}><Button type="submit" variant="primary" block style={{ height: 48 }} disabled={add.isPending}>{add.isPending ? 'Saving…' : 'Save Update'}</Button></div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>
      )}
    </>
  );
}
