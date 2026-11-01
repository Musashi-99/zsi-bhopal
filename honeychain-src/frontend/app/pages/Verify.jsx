import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../components/ui/Icon';
import { Button, Card, Chip, ErrorState, Img, LoadingState, Logo, Notice, SectionHead, Textarea, Field, Input } from '../components/ui/primitives';
import { Item, Stagger } from '../components/motion';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useLedgerVerify, usePublicPassport } from '../api/queries';
import { api } from '../lib/api';
import { useDocTitle } from '../hooks';
import { cap, describeEvent, eventMeta, fmtDate } from '../lib/format';

export default function Verify() {
  const { code } = useParams();
  useDocTitle(code ? `Verify ${code}` : 'Batch Passport Verification');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useUI();
  const [value, setValue] = useState(code || '');
  const [report, setReport] = useState(false);
  const [msg, setMsg] = useState({ name: '', email: '', message: '' });
  const q = usePublicPassport(code);
  const chain = useLedgerVerify();
  const p = q.data?.passport;

  const lookup = (e) => { e.preventDefault(); const v = value.trim(); if (v) navigate(`/verify/${encodeURIComponent(v.toUpperCase())}`); };
  const send = async (e) => {
    e.preventDefault();
    try { await api('/api/contact', { method: 'POST', body: { ...msg, message: `[Batch ${code}] ${msg.message}` } }); toast('Thanks — your report was stored.'); setReport(false); setMsg({ name: '', email: '', message: '' }); } catch (ex) { toast(ex.message, 'err'); }
  };

  const tone = { 0: '', 1: 'blue', 2: 'blue', 3: 'orange' };

  return (
    <div className="pub">
      <header className="pub-hero">
        <nav className="pub-nav" aria-label="Public">
          <Link className="brand" to="/login" aria-label="AranyaValue"><Logo /></Link>
          <div className="links"><Link to="/login">About</Link><Link to="/login">Our Mission</Link><Link to="/login">For Buyers</Link>{!user && <Link to="/login">Sign In</Link>}<Button variant="primary" to={user ? '/dashboard' : '/login'} iconRight="arrow">Go to Platform</Button></div>
        </nav>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>Batch Passport Verification</motion.h1>
        <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>Scan. Verify. Know the Story.</motion.h2>
        <p>This page shows publicly available information about a forest produce batch recorded on AranyaValue.</p>
        <form className="row mt16" style={{ maxWidth: 480 }} onSubmit={lookup}><label className="sr" htmlFor="bid">Batch ID</label>
          <input className="inp" id="bid" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Enter a batch code, e.g. AV-WB-HON-0004" style={{ background: '#fff' }} /><Button type="submit" variant="primary">Verify</Button></form>
      </header>

      {!code && <div className="pub-wrap" style={{ gridTemplateColumns: '1fr', maxWidth: 720 }}><Card><div className="empty"><Icon name="qr" /><b>Enter a batch code</b>Scan a batch QR code or type its code above to see the public passport.</div></Card></div>}
      {code && q.isLoading && <div className="pub-wrap" style={{ gridTemplateColumns: '1fr' }}><Card><LoadingState rows={6} /></Card></div>}
      {code && q.error && (q.error.status === 404
        ? <div className="pub-wrap" style={{ gridTemplateColumns: '1fr', maxWidth: 720 }}><Card><div className="empty"><Icon name="search" /><b>Batch not found</b>The batch code <b style={{ display: 'inline' }}>{code}</b> may be incorrect or not available publicly.</div></Card></div>
        : <div className="pub-wrap" style={{ gridTemplateColumns: '1fr' }}><Card><ErrorState error={q.error} onRetry={q.refetch} /></Card></div>)}

      {p && (
        <Stagger className="pub-wrap" delay={0.08}>
          <div className="pub-col">
            <Item as="section" className="card">
              <div className="prod-top"><Img name={p.category?.toLowerCase().includes('honey') ? 'honey' : p.category?.toLowerCase().includes('flower') ? 'mahua' : p.category?.toLowerCase().includes('medic') ? 'medicinal' : 'seeds'} alt={p.product} />
                <div style={{ flex: 1 }}><Chip tone="amber">🌿 Forest Produce</Chip><h2>{p.local_name && p.local_name !== p.product ? `${p.product} (${p.local_name})` : p.product}</h2><small className="sub">Batch ID</small>
                  <div className="row"><b style={{ fontSize: 22 }}>{p.batch_code}</b><button type="button" className="iconbtn" style={{ border: 0, background: 'none' }} aria-label="Copy batch ID" onClick={() => { navigator.clipboard?.writeText(p.batch_code); toast('Batch ID copied'); }}><Icon name="copy" /></button></div>
                  <div className="row wrap mt8"><Chip tone="green" pill icon="cc">Record Found</Chip><Chip tone="green" pill icon="cc">Basic Information Available</Chip>{p.is_demo && <Chip tone="blue" pill>Demonstration data</Chip>}</div></div>
                <Notice small icon="leaf" className="" ><span>This is a publicly viewable summary of the batch passport. Some details are hidden to protect collector privacy.</span></Notice></div>
              <div className="mini-stats">
                <div><Icon name="package" /><div>Quantity<b>{p.quantity} {p.unit}</b></div></div><div><Icon name="calendar" /><div>Collection Date<b>{fmtDate(p.collection_date)}</b></div></div>
                <div><Icon name="leaf" /><div>Produce Type<b>{p.product}</b><small>(Non-Timber Forest Produce)</small></div></div>
                <div><Icon name="shieldcheck" /><div>Status<br /><Chip tone="green">{cap(p.status.replaceAll('_', ' '))}</Chip></div></div>
              </div>
            </Item>

            <Item as="section" className="card">
              <SectionHead icon="file" title="About This Batch" sub="Key information from the batch passport." />
              <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', alignItems: 'start' }}>
                <div className="tblwrap"><table className="tbl"><tbody>
                  {[['Produce Name', p.product], ['Collected From', `${p.district}, ${p.state}`], ['Collection Method', p.collection_method || '—'], ['Initial Processing', [...new Set(p.handling.map((h) => cap(h.kind)))].join(', ') || '—'], ['Storage', p.handling.filter((h) => h.kind === 'storage').map((h) => h.method).filter(Boolean).join('; ') || '—']].map(([k, v]) => <tr key={k}><td style={{ background: '#f6f9f4', width: '36%', fontSize: 12.5, color: 'var(--ink2)' }}>{k}</td><td>{v}</td></tr>)}
                </tbody></table></div>
                <Card tone="tint" style={{ padding: 12 }}><div className="row" style={{ alignItems: 'flex-start' }}><Icon name="shieldcheck" style={{ color: 'var(--g600)', fontSize: 22 }} /><div><b>What is this?</b><p className="sub" style={{ color: 'var(--ink2)', marginTop: 4 }}>This information was recorded by the collector or group on AranyaValue. It describes how the produce was collected and handled.</p></div></div></Card>
              </div>
            </Item>

            {p.evidence.filter((e) => e.download && e.mime?.startsWith('image/')).length > 0 && (
              <Item as="section" className="card"><SectionHead icon="image" title="Photos" sub="Images from the batch record (publicly shared)." />
                <div className="gal">{p.evidence.filter((e) => e.download && e.mime?.startsWith('image/')).slice(0, 4).map((e) => <Img key={e.id} src={e.download} name="honey-1" alt={e.label || 'Batch photo'} />)}</div></Item>
            )}

            <Item as="section" className="card">
              <SectionHead icon="flask" title="Quality Information" sub="Available quality details from the batch record." />
              <div className="tblwrap"><table className="tbl pub"><thead><tr><th>Parameter</th><th>Value</th><th>Source</th><th>Status</th></tr></thead><tbody>
                {p.measurements.length === 0 && <tr><td colSpan={4} className="sub">No measurements are publicly recorded for this batch.</td></tr>}
                {p.measurements.map((m) => <tr key={m.id}><td>{m.parameter}</td><td>{m.value ?? m.text_value ?? 'Not recorded'}{m.unit && m.value != null ? ` ${m.unit}` : ''}</td><td>{cap((m.evidence_source || '').replaceAll('_', '-'))}</td>
                  <td><Chip tone={m.verified ? 'green' : m.evidence_source === 'self_reported' ? 'blue' : 'gray'} icon={m.verified ? 'cc' : 'info'}>{m.verified ? 'Verified' : m.evidence_source === 'self_reported' ? 'Self-reported' : 'Recorded'}</Chip></td></tr>)}
              </tbody></table></div>
              <p className="hint mt8">{p.limitations?.[0]}</p>
            </Item>
          </div>

          <div className="pub-col">
            <Item as="section" className="card">
              <SectionHead icon="clock" title="Traceability Timeline" sub="Key events recorded for this batch." />
              {p.events.map((e, i) => { const [label, , ic] = eventMeta(e.event_type); return (
                <div className="ttl" key={e.id}><span className="d">{fmtDate(e.timestamp)}</span><span className={`sec-ic ${tone[i % 4]}`}><Icon name={ic} /></span><div><b>{label}</b><small>{describeEvent({ ...e, payload: {} })} · {e.actor_role}</small></div></div>); })}
            </Item>
            <Item as="section" className="card amber">
              <SectionHead icon="shieldcheck" tone="amber" title="Verification Information" sub="What does this mean?" />
              <div className="vrow"><i>✓</i><b>Record Found</b><span>This batch ID exists in the AranyaValue database.</span></div>
              <div className="vrow"><i>✓</i><b>Information Shown</b><span>Basic batch details and quality information are available.</span></div>
              <div className="vrow"><i className={chain.data?.valid === false ? '' : ''} style={chain.data?.valid === false ? { background: '#dc2626' } : undefined}>{chain.data?.valid === false ? '!' : '✓'}</i><b>Event log</b><span>{chain.data ? (chain.data.valid ? `The hash-linked event log is intact (${chain.data.total_events} events).` : 'The event log failed its integrity check.') : 'Checking the event log…'}</span></div>
              <div className="vrow"><i className="b">i</i><b>Not a Guarantee</b><span>This page shows recorded information only. It does not guarantee quality, safety, or a specific price. {q.data?.chain_note}</span></div>
            </Item>
            <Item as="section" className="card blue"><div className="row"><Icon name="eyeoff" style={{ fontSize: 26, color: 'var(--blue)' }} /><h3 style={{ fontSize: 17 }}>What is Not Publicly Shown?</h3></div>
              <ul className="bullets mt8" style={{ color: 'var(--ink)', fontSize: 13.5 }}><li>Collector or group contact details</li><li>Internal notes or documents</li><li>Detailed buyer communications</li><li>Any sensitive or private information</li></ul></Item>
            <Item as="section" className="card tint"><div className="row" style={{ alignItems: 'flex-start' }}><Icon name="leaf" style={{ fontSize: 28, color: 'var(--g600)' }} /><div><h3 style={{ fontSize: 17 }}>Want to know more?</h3><p className="sub" style={{ color: 'var(--ink2)', marginTop: 4 }}>Sign in to AranyaValue to access the full batch passport, view buyer offers and connect with verified buyers (if available).</p></div></div>
              <div className="row mt12"><Button variant="primary" to="/login" iconRight="arrow">Sign In to AranyaValue</Button><Button to="/login">Learn More</Button></div></Item>
            <Item as="section" className="card">
              <div className="row between wrap"><div className="row" style={{ alignItems: 'flex-start', gap: 12 }}><Icon name="alert" style={{ fontSize: 28, color: 'var(--red)' }} /><div><b style={{ fontSize: 15 }}>Can't find this batch?</b><div className="sub" style={{ color: 'var(--ink2)' }}>The batch ID may be incorrect or not available publicly.</div></div></div><Button size="sm" onClick={() => setReport((v) => !v)}>Report an Issue</Button></div>
              {report && (
                <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} onSubmit={send} className="grid mt12">
                  <Field label="Your name" required htmlFor="rn"><Input id="rn" required value={msg.name} onChange={(e) => setMsg({ ...msg, name: e.target.value })} /></Field>
                  <Field label="Email" optional htmlFor="re"><Input id="re" type="email" value={msg.email} onChange={(e) => setMsg({ ...msg, email: e.target.value })} /></Field>
                  <Field label="What is wrong?" required htmlFor="rm"><Textarea id="rm" required rows={3} value={msg.message} onChange={(e) => setMsg({ ...msg, message: e.target.value })} /></Field>
                  <Button type="submit" variant="primary">Send report</Button>
                </motion.form>
              )}
            </Item>
          </div>
        </Stagger>
      )}
    </div>
  );
}
