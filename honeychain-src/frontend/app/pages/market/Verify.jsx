import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useDocTitle } from '../../hooks';
import { useVerifyBatch } from '../../api/market';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { qty } from '../../lib/market';
import { Alert, Badges, DemoTag, MImg, Pill, PriceTag } from '../../components/market/parts';
import { Conditions, Documents, History, OfficerBlock, QualityTable } from '../../components/market/evidence';
import { useMarket } from '../../context/MarketContext';
import { useUI } from '../../context/UIContext';

const VERDICT = {
  verified: ['green', 'shieldcheck', 'Record found — verified by an officer'],
  pending_review: ['amber', 'clock', 'Record found — awaiting officer review'],
  under_review: ['amber', 'info', 'Record found — under review'],
  submitted: ['blue', 'file', 'Record found — submitted'],
  rejected: ['red', 'xc', 'Record found — REJECTED'],
  suspended: ['red', 'ban', 'Record found — SUSPENDED'],
  dispatched: ['blue', 'truck', 'Record found — dispatched'],
};

/** Pull a batch code out of whatever a QR contains (full URL or a bare ID). */
export function codeFromScan(raw = '') {
  const s = String(raw).trim();
  try { const u = new URL(s); return decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || ''); } catch { return s; }
}

export default function Verify() {
  const { code } = useParams();
  const [sp] = useSearchParams();
  useDocTitle(code ? `Verify ${code}` : 'Verify a batch');
  const nav = useNavigate();
  const [value, setValue] = useState(code || '');
  const [scan, setScan] = useState(sp.get('scan') === '1');
  const q = useVerifyBatch(code);
  const go = (c) => { const v = codeFromScan(c).trim().toUpperCase(); if (v) nav(`/market/verify/${encodeURIComponent(v)}`); };
  useEffect(() => setValue(code || ''), [code]);

  return (
    <>
      <section className="mk-vhero"><div className="wrap">
        <Pill tone="gold" icon="qr">Public batch verification · no account needed</Pill>
        <h1 style={{ marginTop: 14 }}>Scan. Verify. Know the story.</h1>
        <p>Enter a batch ID or scan its QR code. We read the live batch record — never just the QR image — and show exactly which checks exist, and which don’t.</p>
        <form className="mk-vform" onSubmit={(e) => { e.preventDefault(); go(value); }}>
          <label className="sr" htmlFor="vc">Batch ID</label>
          <input id="vc" className="inp" value={value} onChange={(e) => setValue(e.target.value)} placeholder="AV-WB-HON-0015" autoComplete="off" spellCheck={false} />
          <button type="submit" className="btn gold lg">Verify</button>
          <button type="button" className="btn ghost lg" onClick={() => setScan(true)}><Icon name="camera" /> Scan QR</button>
        </form>
      </div></section>
      {scan && <Scanner onClose={() => setScan(false)} onCode={(c) => { setScan(false); setValue(codeFromScan(c)); go(c); }} />}

      <div className="wrap mk-vres" aria-live="polite">
        {!code && <div className="mk-panel"><h3>How verification works</h3>
          <div className="mk-steps" style={{ marginTop: 26 }}>
            {[['Find the ID', 'Look for the batch ID printed under the QR code on the pack or passport.'], ['We check the record', 'The ID is looked up in the shared batch database. Unknown or invalid IDs are flagged.'], ['Read the evidence', 'See status, quality evidence by source, officer decision and history.']].map(([h, p]) => <div className="mk-step" key={h}><h3>{h}</h3><p className="muted sm">{p}</p></div>)}
          </div>
          <p className="sm muted mt24">Try a demo batch: {['AV-WB-HON-0015', 'AV-WB-MAH-0011', 'AV-WB-TAM-0026'].map((c) => <button key={c} type="button" className="linkbtn" style={{ marginRight: 12 }} onClick={() => go(c)}>{c}</button>)}</p>
        </div>}
        {code && q.isLoading && <div className="mk-panel"><div className="stack"><span className="mk-skel" style={{ height: 30, width: '50%' }} /><span className="mk-skel" style={{ height: 18 }} /><span className="mk-skel" style={{ height: 120 }} /></div></div>}
        {code && q.error && <NotFound error={q.error} code={code} />}
        {q.data && <Result d={q.data} />}
      </div>
    </>
  );
}

function NotFound({ error, code }) {
  const invalid = error.status === 400;
  return (
    <div className="mk-verdict red mk-shake" role="alert">
      <div className="ic"><Icon name={invalid ? 'alert' : 'xc'} /></div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <h2>{invalid ? 'That is not a valid batch ID' : 'No batch record found'}</h2>
        <p className="muted">{error.status === 0 || error.status >= 500 ? error.message : error.message}</p>
        <p className="sm mt8"><b>ID checked:</b> <span className="code">{code}</span></p>
        <p className="sm muted mt8">A QR code that doesn’t resolve to a record may be copied, damaged or fake. Don’t rely on the pack — ask the seller for the batch ID and check it again.</p>
      </div>
      <Link className="btn" to="/market/verify">Try another ID</Link>
    </div>
  );
}

function Result({ d }) {
  const { isBuyer } = useMarket();
  if (!d.public_record) {
    return (
      <div className="mk-verdict amber mk-verify-pop"><div className="ic"><Icon name="lock" /></div>
        <div style={{ flex: 1, minWidth: 220 }}><h2>Record exists — not shared publicly</h2><p className="muted">{d.message}</p>
          <div className="row wrap mt8"><span className="code">{d.code}</span><Pill tone={d.status.tone}>{d.status.label}</Pill></div>
          {d.warning && <div className="mt12"><Alert tone={d.warning.level} title={d.warning.title}>{d.warning.text}</Alert></div>}</div></div>
    );
  }
  const [tone, icon, headline] = VERDICT[d.status.key] || ['blue', 'info', 'Record found'];
  const b = d.batch;
  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className={`mk-verdict ${tone} mk-verify-pop`}>
        <div className="ic"><Icon name={icon} /></div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="row wrap"><span className="code">{d.code}</span>{d.is_demo && <DemoTag />}</div>
          <h2 style={{ marginTop: 8 }}>{headline}</h2>
          <div className="mt8"><Badges badges={d.badges} /></div>
          <p className="xs muted mt8">Status read live from the batch record · {fmtDateTime(d.retrieved_at)}</p>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end' }}>
          {d.listing && <Link className="btn gold" to={`/market/p/${d.code}`}><Icon name="bag" /> View listing</Link>}
          <Link className="btn sm" to="/market/verify"><Icon name="refresh" /> Verify another</Link>
        </div>
      </div>

      {d.warning && <Alert tone={d.warning.level} title={d.warning.title}>{d.warning.text}</Alert>}

      <div className="mk-split">
        <div className="stack" style={{ gap: 18 }}>
          <section className="mk-panel">
            <h3>Batch details</h3>
            <div className="row" style={{ alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
              {d.listing?.image && <div style={{ width: 150, height: 150, borderRadius: 14, overflow: 'hidden', flex: 'none' }}><MImg src={d.listing.image} alt={b.product} slug={d.listing.product.market_category?.slug} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
              <dl className="mk-facts" style={{ flex: 1, minWidth: 240 }}>
                <dt>Product</dt><dd><b>{b.product}</b>{b.local_name && b.local_name !== b.product ? ` (${b.local_name})` : ''}{b.scientific_name ? <i className="muted"> · {b.scientific_name}</i> : null}</dd>
                <dt>Grade / form</dt><dd>{b.grade_label || '—'}</dd>
                <dt>Quantity</dt><dd>{qty(b.quantity)} {b.unit}</dd>
                <dt>Collected on</dt><dd>{fmtDate(b.collection_date)}</dd>
                <dt>Location</dt><dd>{[b.collection_area, b.block, b.district].filter(Boolean).join(', ')}, {b.state}</dd>
                <dt>Method</dt><dd>{b.collection_method || '—'}</dd>
                {d.listing && <><dt>Indicative price</dt><dd><PriceTag price={d.listing.price} unit={d.listing.unit} /></dd></>}
              </dl>
            </div>
            <p className="xs muted mt12"><Icon name="info" /> {b.source_statement}</p>
          </section>
          <section className="mk-panel"><h3>Quality-check details</h3><p className="sub">Each reading shows who recorded it and how. Missing evidence is never filled in.</p><QualityTable rows={d.quality} /></section>
          <section className="mk-panel"><h3>Condition & handling</h3><Conditions items={d.conditions} /></section>
          <section className="mk-panel"><h3>Photographs & laboratory reports</h3>
            {d.photos.length > 0 && <div className="row wrap" style={{ marginBottom: 14 }}>{d.photos.map((p) => <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer"><img src={p.url} alt={p.label} style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 10 }} /></a>)}</div>}
            {d.photos.length === 0 && <p className="muted sm" style={{ marginBottom: 12 }}>No public photographs are attached to this batch.</p>}
            <Documents docs={d.documents} label="documents and lab reports" />
            {!d.flags.lab_tested && <p className="xs muted mt12">No laboratory result is on file, so no “Lab tested” mark is shown.</p>}
          </section>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <section className="mk-panel"><h3>Officer verification</h3><OfficerBlock officer={d.officer} status={d.status.key} />
            <div className="mk-legend"><Pill tone={d.flags.centre_checked ? 'sage' : 'gray'} icon="building">{d.flags.centre_checked ? 'Centre checked' : 'No centre check on file'}</Pill><Pill tone={d.flags.lab_tested ? 'blue' : 'gray'} icon="flask">{d.flags.lab_tested ? 'Lab tested' : 'No lab result on file'}</Pill><Pill tone={d.flags.officer_verified ? 'green' : 'gray'} icon="shieldcheck">{d.flags.officer_verified ? 'Officer verified' : 'Not officer verified'}</Pill></div></section>
          <section className="mk-panel"><h3>Collection centre</h3>
            {d.centre ? <div className="stack"><Link to={`/market/centres/${d.centre.id}`} style={{ fontWeight: 700, color: 'var(--mk-green)' }}><Icon name="building" /> {d.centre.name}</Link><div className="row wrap">{d.centre.verified_centre ? <Pill tone="green" icon="award">AranyaValue accredited</Pill> : <Pill tone={d.centre.accreditation.tone}>{d.centre.accreditation.label}</Pill>}</div>
              <p className="xs muted">{d.centre.accreditation.note || 'AranyaValue accreditation is a private programme, not a government licence.'}</p></div>
              : <p className="muted">Sold directly by the collector — no collection centre is attached.</p>}</section>
          <section className="mk-panel"><h3>Verification history</h3><History items={d.history} /></section>
          <section className="mk-panel"><h3>Record integrity</h3>
            <div className="row"><Pill tone={d.integrity.valid ? 'green' : 'red'} icon={d.integrity.valid ? 'shieldcheck' : 'alert'}>{d.integrity.valid ? `Event log intact (${d.integrity.total_events} events)` : 'Event log failed its integrity check'}</Pill></div>
            <p className="xs muted mt8">{d.integrity.note}</p></section>
          <section className="mk-panel"><h3>What is not shown</h3><ul className="sm muted" style={{ margin: 0, paddingLeft: 18 }}>{d.not_shown.map((x) => <li key={x}>{x}</li>)}</ul>
            {!isBuyer && <p className="xs mt12">Want to buy? <Link className="linkbtn" to="/market/login">Sign in as a buyer</Link> or use Demo Buyer access.</p>}</section>
          <Alert tone="info" title="Read this">{d.limitations.map((x) => <span key={x} style={{ display: 'block', marginTop: 4 }}>{x}</span>)}</Alert>
        </div>
      </div>
    </div>
  );
}

/** Camera QR reader using the browser BarcodeDetector API, with a typed-ID fallback. */
function Scanner({ onClose, onCode }) {
  const video = useRef(null);
  const [err, setErr] = useState('');
  const { toast } = useUI();
  useEffect(() => {
    let stream; let raf; let stop = false;
    (async () => {
      if (!('BarcodeDetector' in window)) { setErr('Camera scanning isn’t supported in this browser. Type the batch ID instead.'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
        video.current.srcObject = stream;
        await video.current.play();
        const det = new window.BarcodeDetector({ formats: ['qr_code'] });
        const tick = async () => {
          if (stop) return;
          try { const r = await det.detect(video.current); if (r[0]?.rawValue) { onCode(r[0].rawValue); return; } } catch { /* keep scanning */ }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch { setErr('Camera access was blocked or no camera was found. Type the batch ID instead.'); toast('Camera unavailable', 'err'); }
    })();
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onCode, toast]);
  return (
    <div className="mk-scan" role="dialog" aria-modal="true" aria-label="Scan QR code" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="box">
        <div className="row between" style={{ marginBottom: 12 }}><h3 style={{ color: 'var(--mk-green)' }}>Scan a batch QR code</h3><button type="button" className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        {err ? <Alert tone="warning" title="Scanner unavailable">{err}</Alert> : <video ref={video} muted playsInline aria-label="Camera preview" />}
        <p className="xs muted mt12">Point the camera at the QR code. Nothing is uploaded — scanning happens on your device.</p>
      </div>
    </div>
  );
}
