import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import Icon from '../components/ui/Icon';
import { Breadcrumbs, Button, Card, Chip, EmptyState, ErrorState, IconButton, Img, LoadingState, Notice, SectionHead, StatusBadge, Tabs } from '../components/ui/primitives';
import { Item, Stagger } from '../components/motion';
import { useUI } from '../context/UIContext';
import { useAddEvidence, useIntelligence, useLedgerVerify, usePassport, useUpdateBatch } from '../api/queries';
import { useDocTitle, useSelectedBatch } from '../hooks';
import { cap, describeEvent, fmtDate, fmtDateTime, productImage } from '../lib/format';
import { OUTCOME } from '../lib/format';
import { compressImage, dataUrlToBase64, validImage } from '../lib/image';
import { PageHeader } from '../components/layout/PageHero';

const TABS = [
  { key: 'ov', label: 'Overview', icon: 'file' }, { key: 'qd', label: 'Quality Details', icon: 'flask' }, { key: 'tr', label: 'Traceability', icon: 'hexa' },
  { key: 'pc', label: 'Price Comparison', icon: 'chart' }, { key: 'dp', label: 'Documents & Photos', icon: 'image' },
];

function qualityRows(p, intel) {
  const checks = intel?.quality?.checks || [];
  const rows = checks.map((c) => {
    const m = (p.measurements || []).filter((x) => x.parameter === c.parameter).at(-1);
    return { name: c.parameter, value: c.recorded_value, unit: c.unit, source: c.evidence_source, verified: c.verified, method: m?.method, notes: m?.notes, required: c.required };
  });
  (p.measurements || []).forEach((m) => {
    if (!rows.some((r) => r.name === m.parameter)) rows.push({ name: m.parameter, value: m.value ?? m.text_value, unit: m.unit, source: m.evidence_source, verified: m.verified, method: m.method, notes: m.notes });
  });
  return rows;
}
const ICONS = { moisture: ['drop', 'blue'], colour: ['palette', 'amber'], color: ['palette', 'amber'], purity: ['sparkle', 'amber'], 'foreign matter': ['leaf', ''], adulteration: ['flask', 'purple'] };
const rowIcon = (n) => ICONS[Object.keys(ICONS).find((k) => n.toLowerCase().includes(k))] || ['flask', 'purple'];
const rowTag = (r) => (r.value == null || r.value === '' ? ['Not Recorded', 'none'] : r.verified ? ['Verified', ''] : r.source === 'self_reported' ? ['Self-reported', 'pend'] : r.source === 'simulated' ? ['Simulated', 'pend'] : ['Measured', '']);

export default function Passport() {
  const sel = useSelectedBatch('/passport');
  const q = usePassport(sel.id);
  const intelQ = useIntelligence(sel.id);
  const verify = useLedgerVerify();
  const { toast, confirm } = useUI();
  const update = useUpdateBatch();
  const addEvidence = useAddEvidence();
  const [tab, setTab] = useState('ov');
  const fileRef = useRef(null);
  const p = q.data;
  useDocTitle(p ? `Passport ${p.batch_code}` : 'Quality Passport');
  const rows = useMemo(() => (p ? qualityRows(p, intelQ.data || p.intelligence) : []), [p, intelQ.data]);
  const publicUrl = p ? `${window.location.origin}/market/verify/${p.batch_code}` : '';

  if (sel.isLoading || q.isLoading) return <LoadingState rows={8} />;
  if (sel.error || q.error) return <ErrorState error={sel.error || q.error} onRetry={() => { sel.refetch(); q.refetch(); }} />;
  if (!sel.batch) return <Card><EmptyState icon="file" title="No batches yet" action={<Button to="/batches/new" variant="primary" icon="plus">Create a batch</Button>}>Create a batch to generate its quality passport.</EmptyState></Card>;
  if (!p) return null;

  const submitted = p.events.find((e) => e.event_type === 'ASSESSMENT_SUBMITTED');
  const photos = p.evidence.filter((e) => e.kind === 'photo' && e.download);
  const hero = photos[0]?.download;
  const copy = (txt, msg) => { navigator.clipboard?.writeText(txt); toast(msg); };

  const share = async () => {
    if (!p.public_share && !(p.status !== 'draft')) { toast('Submit the batch before sharing it.', 'err'); return; }
    // public passports are only reachable when the collector enabled sharing
    const batchMeta = sel.batch;
    if (!batchMeta.public_share) {
      if (!(await confirm({ title: 'Make this passport public?', text: 'Anyone with the link or QR code will see the basic passport. Your contact details and private notes stay hidden.', ok: 'Make public & share' }))) return;
      await update.mutateAsync({ id: p.id, public_share: true }).catch((e) => toast(e.message, 'err'));
    }
    try {
      if (navigator.share) await navigator.share({ title: `AranyaValue passport ${p.batch_code}`, url: publicUrl });
      else copy(publicUrl, 'Public verify link copied');
    } catch { /* cancelled */ }
  };

  const upload = async (files) => {
    for (const f of [...files]) {
      try {
        let mime = f.type; let data;
        if (f.type === 'application/pdf') {
          if (f.size > 1_100_000) { toast(`${f.name}: PDFs must be under 1.1 MB.`, 'err'); continue; }
          data = dataUrlToBase64(await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }));
        } else if (validImage(f)) { mime = 'image/jpeg'; data = dataUrlToBase64(await compressImage(f)); } else { toast(`${f.name}: unsupported file.`, 'err'); continue; }
        await addEvidence.mutateAsync({ id: p.id, kind: mime === 'application/pdf' ? 'document' : 'photo', label: f.name, filename: f.name, mime, data_base64: data, visibility: 'private' });
        toast(`${f.name} uploaded`);
      } catch (e) { toast(e.message, 'err'); }
    }
  };

  const timeline = [...p.events.map((e) => ({ title: describeEvent(e), time: fmtDateTime(e.timestamp), sub: e.actor_name ? `by ${e.actor_name}` : '', done: true })),
    ...(['verified', 'verified_with_limitations', 'dispatched', 'rejected'].includes(p.status) ? [] : [{ title: '-', sub: 'Price comparison pending' }])];
  const lastIdx = p.events.length - 1;

  return (
    <>
      <Breadcrumbs items={[{ label: 'My Batches', to: '/batches' }, { label: p.batch_code, to: `/passport/${p.id}` }, { label: 'Quality Passport' }]} />
      <PageHeader title="Quality Passport" sub="Complete information about this batch, including quality details, traceability and key events.">
        <Button icon="share" onClick={share}>Share Passport</Button>
        <Button icon="file" onClick={() => window.print()}>Download / Print</Button>
        <Button icon="clock" to="/audit">View Audit History</Button>
        <Button variant="primary" icon="pencil" to={`/batches/${p.id}/edit`}>Edit Batch</Button>
      </PageHeader>

      <Card className="pp-head" style={{ padding: 0, marginBottom: 12 }}>
        <div className="pic">{hero ? <img src={hero} alt={`${p.product} photo`} /> : <Img name={productImage(p.product)} alt={p.product} />}</div>
        <div style={{ padding: '10px 0' }}>
          <div className="row wrap"><h2>{p.product}</h2><span className="chip pill" style={{ background: '#fff', border: '1px solid var(--line2)' }}>{p.batch_code}</span>
            <IconButton icon="copy" label="Copy batch ID" style={{ border: 0, background: 'none', color: 'var(--g600)' }} onClick={() => copy(p.batch_code, `Batch ID ${p.batch_code} copied`)} /></div>
          <p style={{ marginTop: 6, fontSize: 15 }}>{p.quantity} {p.unit} &nbsp;•&nbsp; {p.local_name || p.product}</p>
          <div className="row wrap mt8"><StatusBadge status={p.status} icon="download" />{submitted && <Chip tone="blue" icon="download">Submitted on {fmtDate(submitted.timestamp)}</Chip>}{p.is_demo && <span className="demo-pill">Demonstration data</span>}</div>
        </div>
        <div className="grade-box"><div className="row between"><b style={{ fontWeight: 600 }}>Estimated Grade</b><Icon name="info" style={{ color: 'var(--muted)' }} /></div><b style={{ fontSize: 20, display: 'block', margin: '2px 0' }}>{p.grade_label || '-'}</b><span className="sub">{['verified', 'verified_with_limitations'].includes(p.status) ? 'Reviewed — see limitations below' : 'Awaiting quality assessment'}</span></div>
      </Card>

      <Tabs tabs={TABS} value={tab} onChange={setTab} id="pp" />

      {tab === 'ov' && (
        <Stagger className="pp-grid">
          <Item as="section" className="card">
            <SectionHead icon="leaf" title="Batch Overview" sub="Key information about this forest produce batch." />
            <div className="kv-2">
              <div>
                <KV icon="drop" tone="orange" t="Produce Type" v={p.product} />
                <KV icon="sun" tone="orange" t="Local/Common Name" v={p.local_name || '—'} />
                <KV icon="bag" tone="orange" t="Quantity" v={`${p.quantity} ${p.unit}`} />
                <KV icon="user" t="Collector / Group" v={p.collector?.name || p.collector?.public_label} s={p.centre ? `Via ${p.centre}` : 'Individual Collector'} />
                <KV icon="file" tone="blue" t="Source declaration" v={p.source_declaration || 'None recorded'} s="Declared; not independently verified" />
              </div>
              <div>
                <KV icon="calendar" tone="blue" t="Collection Date" v={fmtDate(p.collection_date)} />
                <KV icon="pin" tone="purple" t="Collection Location" v={`${p.district}, ${p.state}`} s={[p.block_name && `Block: ${p.block_name}`, p.collection_area && `Area: ${p.collection_area}`].filter(Boolean).join('  |  ')} />
                <KV icon="leaf" t="Collection Method" v={p.collection_method || '—'} />
                <KV icon="settings" tone="teal" t="Post-Harvest Handling" v={[...new Set(p.handling.map((h) => cap(h.kind)))].join(', ') || 'None recorded'} />
                <KV icon="package" tone="orange" t="Storage & Packaging" v={p.handling.filter((h) => ['storage', 'packaging'].includes(h.kind)).map((h) => h.method).filter(Boolean).join('; ') || 'None recorded'} />
              </div>
            </div>
          </Item>
          <Item as="section" className="card">
            <SectionHead icon="package" title="Traceability & QR Code" sub="Use this QR code to identify this batch." />
            <div className="row" style={{ gap: 12 }}>
              <div className="qr" role="img" aria-label={`QR code for ${p.batch_code}`}><QRCodeSVG value={publicUrl} size={96} level="M" /></div>
              <Card tone="tint" style={{ padding: '10px 12px', flex: 1 }}><small className="sub">Batch ID</small><div className="row between"><b style={{ fontSize: 17 }}>{p.batch_code}</b><IconButton icon="copy" label="Copy batch ID" style={{ border: 0, background: 'none' }} onClick={() => copy(p.batch_code, 'Batch ID copied')} /></div></Card>
            </div>
            <p className="sub mt8">Scan this QR code to view basic batch information.</p>
            <Link className="link" to={`/market/verify/${p.batch_code}`} style={{ display: 'inline-block', margin: '6px 0' }}>Open public verify page →</Link>
            <Notice tone="amber" small><span>QR verification is for information only. It does not guarantee quality, safety or price. {!sel.batch.public_share && 'This batch is not public yet, so the link works only after you share it.'}</span></Notice>
          </Item>
          <Item as="section" className="card">
            <div className="row between"><div className="row"><span className="sec-ic sm blue"><Icon name="clock" /></span><h2 style={{ fontSize: 16 }}>Batch Timeline</h2></div><Link className="link" to="/audit">View All</Link></div>
            <div className="timeline mt12">
              {timeline.slice(-6).map((t, i, arr) => (
                <div key={i} className={`tl ${t.done ? (i === arr.length - 1 && lastIdx >= 0 && !arr.some((x) => !x.done) ? 'now' : 'done') : ''}`}><i /><div><b>{t.title}</b>{t.time && <small>{t.time}</small>}<small>{t.sub}</small></div></div>
              ))}
            </div>
          </Item>
        </Stagger>
      )}

      {(tab === 'ov' || tab === 'qd') && (
        <div className={`pp-grid mt12 ${tab === 'ov' ? 'two-col' : 'one-col'}`}>
          <div className="grid">
            {tab === 'ov' ? (
              <Card>
                <div className="row between"><SectionHead icon="flask" tone="purple" title="Quality Information" sub="Recorded quality details for this batch." /><button type="button" className="link" onClick={() => setTab('qd')}>View Details</button></div>
                {rows.length === 0 ? <p className="sub">No quality parameters are configured or recorded for this product yet.</p> : (
                  <Stagger className="qgrid">{rows.map((r) => { const [ic, tone] = rowIcon(r.name); const [tag, tc] = rowTag(r); return (
                    <Item key={r.name} className="qitem"><span className={`sec-ic ${tone}`}><Icon name={ic} /></span><div style={{ minWidth: 0 }}><small style={{ color: 'var(--ink)' }}>{r.name}</small><b>{r.value == null || r.value === '' ? '-' : `${r.value}${r.unit && typeof r.value === 'number' ? ' ' + r.unit : ''}`}</b><small>{r.method || (r.value == null ? 'Awaiting assessment' : 'Recorded')}</small></div><span className={`tag ${tc}`}>{tag}</span></Item>); })}</Stagger>
                )}
              </Card>
            ) : (
              <Card>
                <SectionHead icon="flask" tone="purple" title="Quality Details" sub="Every parameter with its source and status." />
                <div className="tblwrap"><table className="tbl"><thead><tr><th>Parameter</th><th>Value</th><th>Source</th><th>Status</th><th>Notes</th></tr></thead><tbody>
                  {rows.map((r) => { const [tag] = rowTag(r); return <tr key={r.name}><td>{r.name}{r.required && <span className="hint"> · required</span>}</td><td>{r.value ?? '-'} {typeof r.value === 'number' ? r.unit : ''}</td><td>{r.method || '—'}</td><td><Chip tone={tag === 'Not Recorded' ? 'gray' : tag === 'Verified' ? 'done' : 'draft'}>{tag}</Chip></td><td style={{ fontSize: 12 }}>{r.notes || '—'}</td></tr>; })}
                </tbody></table></div>
                {p.verifications.length > 0 && <Notice tone="blue" small className="mt12"><span><b>Latest review:</b> {p.verifications.at(-1).summary} {p.verifications.at(-1).limitations && <>Limitations: {p.verifications.at(-1).limitations}</>}</span></Notice>}
              </Card>
            )}
            {tab === 'ov' && (
              <Card>
                <div className="sec-head" style={{ margin: '0 0 10px' }}><span className="sec-ic sm"><Icon name="image" /></span><div className="t"><b>Photos and Documents</b><span>Photos, documents and other evidence related to this batch.</span></div><button type="button" className="link" style={{ marginLeft: 'auto' }} onClick={() => setTab('dp')}>View All</button></div>
                <Docs p={p} onUpload={() => fileRef.current.click()} />
              </Card>
            )}
          </div>
          {tab === 'ov' && (
            <section className="what" style={{ alignSelf: 'start' }}>
              <div className="row" style={{ alignItems: 'flex-start' }}><Icon name="bulb" style={{ fontSize: 28, color: 'var(--amber)' }} /><div><h2 style={{ fontSize: 17 }}>What This Means</h2><p style={{ color: 'var(--ink2)', marginTop: 6, fontSize: 13 }}>This passport shows the information recorded for this batch. Buyers may look at these details to understand the quality and compare with their requirements.</p></div></div>
              <div className="inner"><ul className="list-check">
                <li><Icon name="cc" />This batch is currently {['pending_verification', 'submitted'].includes(p.status) ? 'under quality assessment' : `marked “${cap(p.status.replaceAll('_', ' '))}”`}.</li>
                <li><Icon name="cc" />{rows.filter((r) => r.value != null && r.value !== '').length} of {rows.length} quality parameters have been recorded.</li>
                <li><Icon name="cc" />Self-reported values are not treated as laboratory-verified.</li>
                <li><Icon name="cc" />Final grade and price comparison depend on assessment and buyer requirements.</li></ul></div>
            </section>
          )}
        </div>
      )}

      {tab === 'tr' && (
        <Card className="mt12">
          <div className="row between wrap"><SectionHead icon="hexa" title="Traceability" sub="Hash-linked events recorded for this batch." />
            {verify.data && <Chip tone={verify.data.valid ? 'green' : 'red'} icon={verify.data.valid ? 'shieldcheck' : 'alert'}>{verify.data.valid ? `Ledger intact · ${verify.data.total_events} events` : 'Ledger check failed'}</Chip>}</div>
          <div className="tblwrap"><table className="tbl"><thead><tr><th>#</th><th>Event</th><th>When</th><th>By</th><th>Hash</th></tr></thead><tbody>
            {p.events.map((e) => <tr key={e.id}><td>{e.seq}</td><td>{describeEvent(e)}</td><td>{fmtDateTime(e.timestamp)}</td><td>{e.actor_name}</td><td className="mono" title={e.hash}>{e.hash.slice(0, 10)}…</td></tr>)}
          </tbody></table></div>
          <p className="sub mt8">Each event stores the previous event's hash, so edits to older records become detectable. This is an internal log, not a public blockchain. See the <Link className="link" to="/audit">Audit Ledger</Link>.</p>
        </Card>
      )}

      {tab === 'pc' && (
        <Card className="mt12">
          <SectionHead icon="chart" tone="amber" title="Price Comparison" sub="Offers and reference prices recorded in this app." />
          <PriceTable intel={intelQ.data || p.intelligence} />
          <Button className="mt12" variant="primary" to={`/quality-price/${p.id}`} iconRight="arrow">See full quality-to-price analysis</Button>
        </Card>
      )}

      {tab === 'dp' && (
        <Card className="mt12">
          <SectionHead icon="image" title="Documents & Photos" sub="Evidence attached to this batch." />
          <Docs p={p} onUpload={() => fileRef.current.click()} />
        </Card>
      )}
      <input ref={fileRef} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
    </>
  );
}

function KV({ icon, tone = '', t, v, s }) {
  return <div className="kv"><span className={`sec-ic ${tone}`}><Icon name={icon} /></span><div><b>{t}</b><span>{v}</span>{s && <small>{s}</small>}</div></div>;
}

function Docs({ p, onUpload }) {
  return (
    <div className="docs">
      {p.evidence.map((e) => (e.download && e.mime?.startsWith('image/')
        ? <a key={e.id} className="doc" href={e.download} target="_blank" rel="noreferrer"><Img src={e.download} name="honey-1" alt={e.label || 'Photo'} /><div><b>{e.label || 'Photo'}</b><small>{fmtDate(e.created_at)} · {e.visibility}</small></div></a>
        : <a key={e.id} className="doc file" href={e.download || undefined} target="_blank" rel="noreferrer"><Icon name="file" /><b>{e.label || e.kind}</b><small>{cap(e.kind)} · {e.visibility}</small></a>))}
      <button type="button" className="doc up" onClick={onUpload}><span><Icon name="upload" /><br />Upload More<br />Photos / Documents</span></button>
    </div>
  );
}

export function PriceTable({ intel }) {
  const rows = intel?.buyer_matches || [];
  if (!rows.length) return <p className="sub">No buyer requirement or offer is stored for this product.</p>;
  return (
    <div className="tblwrap"><table className="tbl"><thead><tr><th>Buyer</th><th>Reference price</th><th>Match</th></tr></thead><tbody>
      {rows.map((m) => { const o = OUTCOME[m.match] || OUTCOME.insufficient_evidence; return (
        <tr key={m.requirement_id}><td>{m.organisation || m.buyer_name}</td><td>{m.reference_price ? `₹${m.reference_price.amount} / ${m.reference_price.unit}` : '-'}</td><td><Chip tone={o.tone === 'green' ? 'elig' : o.tone === 'amber' ? 'cond' : o.tone === 'red' ? 'rejected' : 'unk'}>● {o.label}</Chip></td></tr>); })}
    </tbody></table></div>
  );
}
