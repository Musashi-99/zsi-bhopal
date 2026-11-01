import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../components/ui/Icon';
import PageHero from '../components/layout/PageHero';
import { Button, Card, Chip, EmptyState, ErrorState, FilterSelect, IconButton, Img, LoadingState, Notice, Pagination, SearchInput } from '../components/ui/primitives';
import { useUI } from '../context/UIContext';
import { useAllPassports, useLedgerVerify } from '../api/queries';
import { useDocTitle } from '../hooks';
import { cleanName, describeEvent, eventMeta, fmtDate, fmtDateTime, fmtTime } from '../lib/format';

const TONE = { blue: ['#dce9fb', '#2563eb'], green: ['#d9f0dd', '#166534'], purple: ['#e6dcfa', '#6d28d9'], red: ['#fde0e0', '#b91c1c'], gray: ['#e8ece8', '#55645b'] };
const iso = (d) => (d || '').slice(0, 10);

export default function Audit() {
  useDocTitle('Audit Ledger');
  const all = useAllPassports();
  const verify = useLedgerVerify();
  const { toast, confirm } = useUI();
  const [text, setText] = useState('');
  const [type, setType] = useState('All Event Types');
  const [batch, setBatch] = useState('All Batches');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [desc, setDesc] = useState(true);
  const [rows, setRows] = useState(10);
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState(null);
  const [tech, setTech] = useState(true);

  const events = useMemo(() => all.passports.flatMap((p) => (p.events || []).map((e) => ({ ...e, batch_code: p.batch_code, product: p.product }))), [all.passports]);
  const types = useMemo(() => ['All Event Types', ...new Set(events.map((e) => eventMeta(e.event_type)[0]))], [events]);
  const codes = useMemo(() => ['All Batches', ...all.passports.map((p) => p.batch_code)], [all.passports]);

  const list = useMemo(() => events
    .filter((e) => (!text || (e.batch_code + describeEvent(e) + e.actor_name + eventMeta(e.event_type)[0]).toLowerCase().includes(text.toLowerCase()))
      && (type === 'All Event Types' || eventMeta(e.event_type)[0] === type) && (batch === 'All Batches' || e.batch_code === batch)
      && (!from || iso(e.timestamp) >= from) && (!to || iso(e.timestamp) <= to))
    .sort((a, b) => (desc ? 1 : -1) * (a.timestamp < b.timestamp ? 1 : -1)), [events, text, type, batch, from, to, desc]);
  const pages = Math.max(1, Math.ceil(list.length / rows));
  const view = list.slice((Math.min(page, pages) - 1) * rows, Math.min(page, pages) * rows);
  const current = list.find((e) => e.id === sel);
  const reset = () => { setText(''); setType('All Event Types'); setBatch('All Batches'); setFrom(''); setTo(''); setPage(1); };
  const touch = (fn) => (v) => { fn(v); setPage(1); };

  return (
    <>
      <PageHero title="Audit Ledger" sub="Review recorded events and changes for your batches." />
      <Notice className="mb12" icon="shieldcheck">
        <div className="row between wrap">
          <span><b>This is a hash-linked, tamper-evident event history maintained within AranyaValue.</b> It helps track changes to batch information. It is not a public blockchain.
            {verify.data && <> &nbsp;<Chip tone={verify.data.valid ? 'green' : 'red'} icon={verify.data.valid ? 'check' : 'alert'}>{verify.data.valid ? `Chain verified · ${verify.data.total_events} events` : 'Chain check failed'}</Chip></>}</span>
          <Button size="sm" icon="info" onClick={() => confirm({ title: 'About this ledger', text: verify.data ? `${verify.data.proves} ${verify.data.does_not_prove}` : 'Each event stores a hash of its content plus the previous event hash, so edits to older records become detectable.', ok: 'Got it', cancel: 'Close' })}>Learn More</Button>
        </div>
      </Notice>

      <div className="row wrap mb12">
        <SearchInput value={text} onChange={touch(setText)} placeholder="Search by batch ID, event or keyword…" style={{ flex: 1.6 }} />
        <FilterSelect label="Event type" value={type} onChange={touch(setType)} options={types} className="fg-grow" />
        <FilterSelect label="Batch" value={batch} onChange={touch(setBatch)} options={codes} className="fg-grow" />
        <div className="row" style={{ border: '1px solid var(--line2)', borderRadius: 8, background: '#fff', padding: '0 10px', height: 44, flex: 1.3 }}>
          <Icon name="calendar" /><label className="sr" htmlFor="d1">From</label><input id="d1" type="date" value={from} onChange={(e) => touch(setFrom)(e.target.value)} style={{ border: 0, fontSize: 13, background: 'none', flex: 1, minWidth: 0 }} />
          <span>–</span><label className="sr" htmlFor="d2">To</label><input id="d2" type="date" value={to} onChange={(e) => touch(setTo)(e.target.value)} style={{ border: 0, fontSize: 13, background: 'none', flex: 1, minWidth: 0 }} />
        </div>
        <Button style={{ height: 44 }} onClick={reset}>Clear Filters</Button>
      </div>

      {all.isLoading ? <LoadingState rows={8} /> : all.error ? <ErrorState error={all.error} onRetry={all.refetch} /> : (
        <div className="au-grid">
          <Card style={{ padding: 0 }}>
            <div style={{ padding: '16px 16px 8px' }}><h2 style={{ fontSize: 19 }}>Event History</h2><p className="sub" style={{ fontSize: 13 }}>{list.length ? `Showing ${(Math.min(page, pages) - 1) * rows + 1}–${(Math.min(page, pages) - 1) * rows + view.length} of ${list.length} events` : 'Showing 0 events'}</p></div>
            <div className="tblwrap" style={{ border: 0, borderRadius: 0 }}>
              <table className="tbl"><thead><tr><th><button type="button" className="link-btn" style={{ color: 'var(--ink)', fontSize: 12 }} onClick={() => setDesc((v) => !v)}>Date &amp; Time {desc ? '↓' : '↑'}</button></th><th>Batch ID</th><th>Event Type</th><th>Details</th><th>Actor / Role</th><th /></tr></thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {view.map((e, i) => { const [label, tone, icon] = eventMeta(e.event_type); const [bg, fg] = TONE[tone] || TONE.gray; return (
                      <motion.tr key={e.id} className={`evrow ${sel === e.id ? 'picked' : ''}`} tabIndex={0} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.02 }}
                        onClick={() => setSel(e.id)} onKeyDown={(k) => k.key === 'Enter' && setSel(e.id)}>
                        <td><span className="row"><span className="evic" style={{ background: bg, color: fg }}><Icon name={icon} /></span><span>{fmtDate(e.timestamp)},<br />{fmtTime(e.timestamp)}</span></span></td>
                        <td>{e.batch_code.replace('AV-WB-', '')}</td>
                        <td><span className="chip" style={{ background: bg, color: fg }}><Icon name={icon} />{label}</span></td>
                        <td style={{ fontSize: 12.5, minWidth: 150 }}>{describeEvent(e)}</td>
                        <td style={{ fontSize: 12.5 }}>{cleanName(e.actor_name)}<br /><span className="sub" style={{ textTransform: 'capitalize' }}>{e.actor_role}</span></td><td><Icon name="right" /></td>
                      </motion.tr>); })}
                  </AnimatePresence>
                </tbody></table>
            </div>
            {list.length === 0 && <EmptyState icon="hexa" title="No events found">Try changing your filters or date range.</EmptyState>}
            <div className="row between wrap" style={{ padding: '14px 16px' }}>
              <label className="row sub" style={{ fontSize: 12.5 }}>Rows per page <select className="sel" style={{ width: 80, height: 36 }} value={rows} onChange={(e) => { setRows(+e.target.value); setPage(1); }}><option>5</option><option>10</option><option>20</option></select></label>
              <Pagination page={Math.min(page, pages)} pages={Math.min(pages, 5)} onChange={setPage} />
            </div>
          </Card>

          <Card style={{ padding: 0 }}>
            <AnimatePresence mode="wait">
              {!current ? <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><EmptyState icon="hexa" title="Select an event">Choose a row to see its recorded data and integrity details.</EmptyState></motion.div> : (
                <motion.div key={current.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
                  <div className="row between" style={{ padding: '16px 16px 0' }}><h2 style={{ fontSize: 19 }}>Event Details</h2><IconButton icon="x" label="Close details" style={{ border: 0 }} onClick={() => setSel(null)} /></div>
                  <div className="row" style={{ padding: '14px 16px', gap: 12, alignItems: 'flex-start' }}>
                    <span className="evic" style={{ background: TONE[eventMeta(current.event_type)[1]]?.[0], color: TONE[eventMeta(current.event_type)[1]]?.[1], width: 42, height: 42 }}><Icon name={eventMeta(current.event_type)[2]} /></span>
                    <div style={{ flex: 1 }}><b style={{ fontSize: 16 }}>{eventMeta(current.event_type)[0]}</b><div className="sub" style={{ color: 'var(--ink2)' }}>{describeEvent(current)}</div></div>
                    <div style={{ textAlign: 'right', fontSize: 12.5, color: 'var(--ink2)' }}>{fmtDate(current.timestamp)}<br />{fmtTime(current.timestamp)}</div>
                  </div>
                  <div style={{ padding: '0 16px' }}>
                    <div className="dl"><b style={{ gridColumn: '1/3', fontSize: 13 }}>Batch ID</b><span className="card tint" style={{ padding: '6px 12px' }}>{current.batch_code}</span></div>
                    <div className="dl"><b style={{ gridColumn: '1/3', fontSize: 13 }}>Actor</b><span className="row" style={{ background: '#f4f8f2', borderRadius: 8, padding: '5px 10px' }}><Img name="avatar" className="thumb" alt="" style={{ borderRadius: '50%' }} />{cleanName(current.actor_name)} <Chip tone="gray" style={{ marginLeft: 6, textTransform: 'capitalize' }}>{current.actor_role}</Chip></span></div>
                  </div>
                  <div style={{ padding: '8px 16px' }}>
                    <div className="row"><span className="sec-ic sm"><Icon name="file" /></span><b>Recorded Data</b></div>
                    <div className="tblwrap mt8"><table className="tbl"><thead><tr><th>Field</th><th>Value (After)</th></tr></thead><tbody>
                      {Object.entries(current.payload || {}).length === 0 && <tr><td colSpan={2} className="sub">No additional data.</td></tr>}
                      {Object.entries(current.payload || {}).map(([k, v]) => <tr key={k}><td><b>{k.replaceAll('_', ' ')}</b></td><td>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td></tr>)}
                    </tbody></table></div>
                  </div>
                  <div style={{ padding: '8px 16px 16px' }}>
                    <button type="button" className="row between" aria-expanded={tech} style={{ width: '100%', background: 'none', border: 0, padding: '6px 0' }} onClick={() => setTech((v) => !v)}><span className="row"><span className="sec-ic sm"><Icon name="hexa" /></span><b>Technical Information</b></span><Icon name={tech ? 'up2' : 'down'} /></button>
                    <AnimatePresence initial={false}>
                      {tech && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                          <div className="dl" style={{ gridTemplateColumns: '110px 1fr' }}><span>Sequence</span><span className="mono">#{current.seq}</span></div>
                          <div className="dl" style={{ gridTemplateColumns: '110px 1fr' }}><span>Event ID</span><span className="row mono" style={{ wordBreak: 'break-all' }}>{current.id.slice(0, 18)}… <IconButton icon="copy" label="Copy event ID" style={{ border: 0, width: 24, height: 24 }} onClick={() => { navigator.clipboard?.writeText(current.id); toast('Event ID copied'); }} /></span></div>
                          <div className="dl" style={{ gridTemplateColumns: '110px 1fr' }}><span>Recorded At</span><span>{fmtDateTime(current.timestamp)}</span></div>
                          <div className="dl" style={{ gridTemplateColumns: '110px 1fr' }}><span>Hash</span><span className="mono" style={{ wordBreak: 'break-all', fontSize: 11 }}>{current.hash}</span></div>
                          <div className="dl" style={{ gridTemplateColumns: '110px 1fr' }}><span>Previous hash</span><span className="mono" style={{ wordBreak: 'break-all', fontSize: 11 }}>{current.prev_hash}</span></div>
                          <div className="dl" style={{ gridTemplateColumns: '110px 1fr' }}><span>Data Integrity</span><span>{verify.data ? (verify.data.valid ? 'Included in internal hash-linked audit trail — chain verified' : 'Chain verification failed') : 'Checking…'}</span></div>
                          <Notice tone="blue" small className="mt8"><span>This is a tamper-evident record maintained within AranyaValue. It is not a public blockchain.</span></Notice>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
