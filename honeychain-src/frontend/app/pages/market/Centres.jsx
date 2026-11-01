import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useDocTitle, useDebounced } from '../../hooks';
import { useCentre, useCentres, useStoreMeta } from '../../api/market';
import { fmtDate } from '../../lib/format';
import { qty } from '../../lib/market';
import { Alert, Badges, CardSkeletons, Crumbs, DemoTag, Empty, ErrorBox, Pill, ProductCard, SaveButton } from '../../components/market/parts';

export function CentreCard({ c }) {
  const a = c.accreditation;
  return (
    <article className="mk-card mk-centre">
      <div className="top">
        <div className="logo-ph"><Icon name="building" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3><Link to={`/market/centres/${c.id}`}>{c.name}</Link></h3>
          <div className="sm muted"><Icon name="pin" /> {c.district.name}{c.block ? ` · ${c.block}` : ''}</div>
          <div className="xs muted">Centre ID <code>{c.id}</code></div>
        </div>
        <SaveButton kind="centre" refId={c.id} />
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {c.verified_centre ? <Pill tone="green" icon="award">AranyaValue accredited</Pill> : <Pill tone={a.tone} icon={a.key === 'suspended' ? 'ban' : undefined}>{a.label}</Pill>}
        {c.status !== 'active' && <Pill tone="amber">Centre {c.status.replace('_', ' ')}</Pill>}
        {c.is_demo && <DemoTag />}
      </div>
      <div className="sm"><b>Handles:</b> {c.products.length ? c.products.join(', ') : <span className="muted">no public batches yet</span>}</div>
      <div className="meta sm"><span><b>{c.available_batches}</b> batches available</span><span className="muted">{c.total_batches} on record</span></div>
      {c.contact ? <div className="sm muted"><Icon name="phone" /> {c.contact.phone || c.contact.email}</div> : <div className="xs muted"><Icon name="lock" /> Contact details are not public. Use the enquiry form.</div>}
      <Link className="btn sm block" to={`/market/centres/${c.id}`} style={{ marginTop: 'auto' }}>View centre <Icon name="arrow" /></Link>
    </article>
  );
}

export function Centres() {
  useDocTitle('Collection centres');
  const [sp, setSp] = useSearchParams();
  const meta = useStoreMeta();
  const [text, setText] = useState(sp.get('q') || '');
  const dq = useDebounced(text, 300);
  const params = { q: dq, district: sp.get('district') || '', accreditation: sp.get('accreditation') || '', product: sp.get('product') || '' };
  const q = useCentres(params);
  useEffect(() => { /* keep URL as the source for dropdown filters only */ }, []);
  const set = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };
  const districts = (meta.data?.districts || []).filter((d) => d.state_id === 'ST-WB');

  return (
    <>
      <div className="mk-pagehead"><div className="wrap">
        <Crumbs items={[{ label: 'Marketplace', to: '/market' }, { label: 'Collection centres' }]} />
        <h1>Collection centres across West Bengal</h1>
        <p>Centres receive, dry, check, store and dispatch the produce. Each shows its AranyaValue accreditation separately from any government registration.</p>
      </div></div>
      <div className="wrap" style={{ paddingTop: 24 }}>
        <div className="mk-bar" role="search">
          <div className="row grow wrap">
            <div className="field grow" style={{ minWidth: 220 }}><label className="sr" htmlFor="cq">Search centres</label><input id="cq" className="inp" placeholder="Search by centre, ID, district or product" value={text} onChange={(e) => setText(e.target.value)} /></div>
            <select className="sel" style={{ width: 'auto' }} aria-label="District" value={params.district} onChange={(e) => set('district', e.target.value)}><option value="">All districts</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <select className="sel" style={{ width: 'auto' }} aria-label="Accreditation" value={params.accreditation} onChange={(e) => set('accreditation', e.target.value)}>
              <option value="">Any accreditation</option><option value="active">Accredited</option><option value="suspended">Suspended</option><option value="expired">Expired</option><option value="none">Not accredited</option></select>
          </div>
          <span className="sm"><b>{q.data ? q.data.centres.length : '…'}</b> centres</span>
        </div>
        {q.isLoading ? <CardSkeletons n={6} cols={3} /> : q.error ? <ErrorBox error={q.error} onRetry={q.refetch} />
          : q.data.centres.length === 0 ? <Empty icon="building" title="No centres match" action={<button type="button" className="btn gold" onClick={() => { setText(''); setSp({}, { replace: true }); }}>Clear filters</button>}>Try a different district or accreditation filter.</Empty>
            : <div className="mk-grid three">{q.data.centres.map((c) => <CentreCard key={c.id} c={c} />)}</div>}
      </div>
    </>
  );
}

export function CentreDetail() {
  const { id } = useParams();
  const q = useCentre(id);
  const d = q.data;
  useDocTitle(d ? d.centre.name : 'Collection centre');
  if (q.isLoading) return <div className="wrap" style={{ padding: 30 }}><div className="stack"><span className="mk-skel" style={{ height: 40, width: '50%' }} /><span className="mk-skel" style={{ height: 240 }} /></div></div>;
  if (q.error) return <div className="wrap" style={{ padding: 30 }}>{q.error.status === 404 ? <Empty icon="building" title="Centre not found" action={<Link className="btn gold" to="/market/centres">All centres</Link>}>No collection centre has this ID.</Empty> : <ErrorBox error={q.error} onRetry={q.refetch} />}</div>;
  const c = d.centre;
  const cr = d.credentials;
  const p = d.performance;
  return (
    <>
      <div className="mk-pagehead"><div className="wrap">
        <Crumbs items={[{ label: 'Marketplace', to: '/market' }, { label: 'Collection centres', to: '/market/centres' }, { label: c.name }]} />
        <div className="row wrap between">
          <div><h1>{c.name}</h1><p style={{ marginTop: 6 }}><Icon name="pin" /> {c.location || `${c.district.name}, ${c.state.name}`}{c.block ? ` · ${c.block}` : ''} &nbsp;·&nbsp; Centre ID <code style={{ background: 'rgba(255,255,255,.14)', padding: '1px 7px', borderRadius: 6 }}>{c.id}</code></p></div>
          <div className="row wrap">{c.is_demo && <DemoTag />}<SaveButton kind="centre" refId={c.id} /></div>
        </div>
      </div></div>

      <div className="wrap" style={{ paddingTop: 26 }}>
        {c.accreditation.key === 'suspended' && <div style={{ marginBottom: 18 }}><Alert tone="danger" title="This centre’s AranyaValue accreditation is suspended">{c.accreditation.note || 'It cannot display an accredited mark until the suspension is lifted.'} Review batch evidence carefully before buying.</Alert></div>}
        {c.status !== 'active' && <div style={{ marginBottom: 18 }}><Alert tone="warning" title={`This centre is marked ${c.status.replace('_', ' ')}`}>Check with the centre before sending a purchase request.</Alert></div>}

        <div className="mk-split">
          <div className="stack" style={{ gap: 18 }}>
            <section className="mk-panel">
              <h3>Credentials — four different things</h3>
              <p className="sub">These are shown separately on purpose. A private accreditation is not a government licence.</p>
              <div className="mk-credgrid">
                <div className="mk-cred"><h4><Icon name="shield" /> {cr.government.label}</h4>{cr.government.recorded ? <p className="sm">{cr.government.detail}</p> : <p className="sm muted">{cr.government.detail}</p>}</div>
                <div className="mk-cred"><h4><Icon name="award" /> {cr.aranyavalue.label}</h4><Pill tone={cr.aranyavalue.tone}>{cr.aranyavalue.label}</Pill>{cr.aranyavalue.note && <p className="sm muted mt8">{cr.aranyavalue.note}</p>}{cr.aranyavalue.updated_at && <p className="xs muted">Updated {fmtDate(cr.aranyavalue.updated_at)}</p>}</div>
                <div className="mk-cred"><h4><Icon name="file" /> Product-specific permissions</h4>{cr.product_permissions.length ? cr.product_permissions.map((x) => <p key={x.product} className="sm" style={{ marginTop: 6 }}><b>{x.product}:</b> <span className="muted">{x.note}</span></p>) : <p className="sm muted">No products handled yet.</p>}</div>
                <div className="mk-cred"><h4><Icon name="users" /> Buyer-specific quality requirements</h4>{cr.buyer_requirements.length ? cr.buyer_requirements.slice(0, 4).map((x, i) => <p key={i} className="sm" style={{ marginTop: 6 }}><b>{x.product}</b> · {x.specs.map((s) => `${s.parameter} ${s.max != null ? `≤ ${s.max}` : s.min != null ? `≥ ${s.min}` : ''}${s.unit || ''}`).join(', ')} <span className="muted">({x.buyer})</span></p>) : <p className="sm muted">No active buyer requirements for products handled here.</p>}</div>
              </div>
            </section>
            <section className="mk-panel">
              <h3>Public record outcomes</h3><p className="sub">{p.note}</p>
              <div className="mk-perf">{[['total', 'Batches on record'], ['verified', 'Officer verified'], ['pending', 'In review'], ['rejected', 'Rejected']].map(([k, l]) => <div key={k}><b>{p[k]}</b><span>{l}</span></div>)}</div>
              {p.suspended > 0 && <p className="sm mt12" style={{ color: 'var(--mk-red)' }}><Icon name="ban" /> {p.suspended} suspended batch{p.suspended > 1 ? 'es' : ''} on record.</p>}
            </section>
            <section className="mk-panel">
              <h3>Batch history</h3><p className="sub">Latest public batches handled by this centre, with their current status.</p>
              {d.history.length === 0 ? <p className="muted">No public batches yet.</p> : (
                <div className="mk-tablewrap"><table className="mk-table"><thead><tr><th>Batch</th><th>Product</th><th>Quantity</th><th>Collected</th><th>Status</th></tr></thead>
                  <tbody>{d.history.map((h) => <tr key={h.code}><td><Link to={`/market/verify/${h.code}`}><code>{h.code}</code></Link>{h.is_demo && <> <DemoTag /></>}</td><td>{h.product}</td><td>{qty(h.quantity)} {h.unit}</td><td className="muted">{fmtDate(h.collection_date)}</td><td><Badges badges={[h.status]} /></td></tr>)}</tbody></table></div>)}
            </section>
          </div>
          <div className="stack" style={{ gap: 18 }}>
            <section className="mk-panel"><h3>Centre profile</h3>
              <dl className="mk-facts"><dt>District</dt><dd>{c.district.name}</dd><dt>Products</dt><dd>{c.products.join(', ') || '—'}</dd><dt>Available now</dt><dd>{c.available_batches} batches</dd>
                <dt>Contact</dt><dd>{c.contact ? [c.contact.phone, c.contact.email].filter(Boolean).join(' · ') : <span className="muted">Not public — use an enquiry</span>}</dd></dl></section>
            <section className="mk-panel"><h3>Quality-check equipment</h3>{d.equipment.length ? <div className="mk-chipset">{d.equipment.map((x) => <span key={x}>{x}</span>)}</div> : <p className="muted sm">No equipment recorded.</p>}
              <h3 style={{ marginTop: 18 }}>Facilities</h3>{d.facilities.length ? <div className="mk-chipset">{d.facilities.map((x) => <span key={x}>{x}</span>)}</div> : <p className="muted sm">No facilities recorded.</p>}</section>
            <section className="mk-panel"><h3>Authorised operators</h3>{d.operators.length ? d.operators.map((o) => <p key={o.display_name} className="sm"><Icon name="user" /> {o.display_name} · <span className="muted">{o.role}</span></p>) : <p className="muted sm">None listed.</p>}
              <p className="xs muted mt8"><Icon name="lock" /> Names are shortened and no personal contact details are shown, to protect privacy.</p></section>
          </div>
        </div>

        <section className="mk-sec"><div className="hd"><div><h2>Available inventory</h2><p>Batches this centre holds that are open for enquiries.</p></div></div>
          {d.inventory.length ? <div className="mk-grid">{d.inventory.map((l) => <ProductCard key={l.code} l={l} />)}</div> : <Empty icon="package" title="No batches available right now">This centre has nothing listed. Check back later or browse other centres.</Empty>}</section>
      </div>
    </>
  );
}
