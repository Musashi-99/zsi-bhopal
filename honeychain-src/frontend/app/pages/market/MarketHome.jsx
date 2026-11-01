import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useDocTitle } from '../../hooks';
import { useStoreHome } from '../../api/market';
import { CardSkeletons, Empty, ErrorBox, MImg, ProductCard, Reveal, Pill } from '../../components/market/parts';
import { CentreCard } from './Centres';

export default function MarketHome() {
  useDocTitle('Marketplace');
  const q = useStoreHome();
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const d = q.data;

  return (
    <>
      <section className="mk-hero" style={{ '--hero': 'url(/img/market/buyer-hero.png)' }}>
        <div className="bg" />
        <div className="wrap">
          <div className="eyebrow"><Icon name="leaf" /> West Bengal forest produce · traceable by batch</div>
          <h1>Discover the Value of <em>India’s Forest Produce.</em></h1>
          <p className="lead">Explore responsibly sourced forest products, inspect quality information and connect with verified collection centres through one transparent marketplace.</p>
          <div className="ctas">
            <Link className="btn gold lg" to="/market/products">Explore Forest Produce <Icon name="arrow" /></Link>
            <Link className="btn ghost lg" to="/market/verify"><Icon name="qr" /> Verify a Batch</Link>
          </div>
          <div className="trust">
            <span><Icon name="qr" /> QR-linked batch records</span>
            <span><Icon name="flask" /> Quality evidence, labelled by source</span>
            <span><Icon name="building" /> Named collection centres</span>
            <span><Icon name="shieldcheck" /> Live officer verification status</span>
          </div>
        </div>
      </section>

      <div className="wrap mk-statbar">
        <div className="box" aria-label="Marketplace at a glance">
          {[['listings', 'Batches listed'], ['centres', 'Collection centres'], ['districts', 'Districts with batches'], ['verified', 'Officer-verified batches']].map(([k, label]) => (
            <div className="s" key={k}><b>{d ? d.stats[k] : '–'}</b><span>{label}</span></div>
          ))}
        </div>
      </div>

      <div className="wrap">
        <section className="mk-sec" aria-labelledby="cats">
          <div className="hd"><div><h2 id="cats">Shop by category</h2><p>Ten forest produce families. Counts show batches currently listed, not a claim about total supply.</p></div><Link className="btn sm" to="/market/categories">All categories <Icon name="arrow" /></Link></div>
          {q.isLoading ? <div className="mk-cats">{Array.from({ length: 10 }, (_, i) => <div key={i} className="mk-cat mk-skel" />)}</div>
            : q.error ? <ErrorBox error={q.error} onRetry={q.refetch} />
              : <div className="mk-cats">{d.categories.map((c) => <CategoryCard key={c.id} c={c} />)}</div>}
        </section>

        <section className="mk-sec" aria-labelledby="feat">
          <div className="hd"><div><h2 id="feat">Featured batches</h2><p>Verified and recently checked batches with quantity available. Prices are illustrative demo figures.</p></div><Link className="btn sm" to="/market/products?sort=verified">See more <Icon name="arrow" /></Link></div>
          {q.isLoading ? <CardSkeletons n={4} />
            : d?.featured.length ? <div className="mk-grid">{d.featured.slice(0, 8).map((l) => <ProductCard key={l.code} l={l} />)}</div>
              : <Empty icon="package" title="No featured batches yet">Listings appear here once collectors price their batches.</Empty>}
        </section>

        <Reveal className="mk-band" as="section">
          <div><h2>Scanned a QR code on a pack?</h2><p>Enter the batch ID to see the live record — centre, quality checks, officer decision and history.</p></div>
          <form className="row wrap" onSubmit={(e) => { e.preventDefault(); if (code.trim()) nav(`/market/verify/${encodeURIComponent(code.trim().toUpperCase())}`); }} style={{ gap: 10 }}>
            <label className="sr" htmlFor="home-code">Batch ID</label>
            <input id="home-code" className="inp" style={{ width: 260, borderRadius: 999, border: 0, textTransform: 'uppercase' }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. AV-WB-HON-0015" />
            <button className="btn gold" type="submit">Verify <Icon name="arrow" /></button>
            <Link className="btn ghost" to="/market/verify?scan=1"><Icon name="camera" /> Scan</Link>
          </form>
        </Reveal>

        <WestBengal data={d} loading={q.isLoading} />

        <Reveal as="section" className="mk-sec" aria-labelledby="cen">
          <div className="hd"><div><h2 id="cen">Collection centres</h2><p>Every batch is handled by a named centre. Accreditation, government registration and product permissions are shown separately.</p></div><Link className="btn sm" to="/market/centres">All centres <Icon name="arrow" /></Link></div>
          {d ? <div className="mk-grid">{d.centres.map((c) => <CentreCard key={c.id} c={c} />)}</div> : <CardSkeletons n={4} />}
        </Reveal>

        <Reveal as="section" className="mk-sec" aria-labelledby="why">
          <div className="hd"><div><h2 id="why">What you can know before you buy</h2><p>The marketplace is a window on the same batch records the producer and officer portals use.</p></div></div>
          <div className="mk-feat">
            {[['qr', 'Scan to the live record', 'Every QR code resolves to a real batch record. Status is read from the database at the moment you look.'],
              ['flask', 'Evidence, labelled by source', 'Producer-reported, centre-checked, instrument, laboratory and officer evidence are never blended into one badge.'],
              ['building', 'Centres, not anonymous sellers', 'See who handled the batch, their equipment, their history and how their accreditation stands today.'],
              ['ban', 'Honest about problems', 'Suspended or rejected batches show a clear warning and cannot receive purchase requests.']].map(([ic, h, p]) => (
              <div key={h}><div className="ic"><Icon name={ic} /></div><h3>{h}</h3><p>{p}</p></div>))}
          </div>
        </Reveal>

        <Reveal as="section" className="mk-band">
          <div><h2>Are you a collector, centre or officer?</h2><p>Producers list batches and answer enquiries from the Producer Portal. Authorised officers review and verify from the Officer Portal.</p></div>
          <div className="row wrap"><Link className="btn ghost" to="/login"><Icon name="leaf" /> Producer portal</Link><Link className="btn ghost" to="/login?portal=officer"><Icon name="shield" /> Officer portal</Link></div>
        </Reveal>
      </div>
    </>
  );
}

export function CategoryCard({ c }) {
  return (
    <Link className="mk-cat" to={`/market/products?category=${c.slug}`} aria-label={`${c.name}, ${c.listings} batches`}>
      <MImg src={c.image} alt="" slug={c.slug} />
      <div className="t"><h3>{c.name}</h3><p>{c.description}</p><span className="n">{Number(c.listings)} {Number(c.listings) === 1 ? 'batch' : 'batches'}</span></div>
    </Link>
  );
}

function WestBengal({ data, loading }) {
  const rows = (data?.districts || []).slice().sort((a, b) => b.listings - a.listings || a.name.localeCompare(b.name));
  const featured = ['Purulia', 'Bankura', 'Jhargram', 'Paschim Medinipur', 'Birbhum', 'Jalpaiguri', 'Alipurduar'];
  const shown = rows.filter((r) => featured.includes(r.name)).concat(rows.filter((r) => !featured.includes(r.name)));
  return (
    <Reveal as="section" className="mk-wb" aria-labelledby="wb">
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Pill tone="gold" icon="pin">West Bengal</Pill>
        <h2 id="wb" style={{ marginTop: 14 }}>Forest produce from West Bengal’s forest districts</h2>
        <p>From the Jangalmahal districts to the Dooars. Each district lists only the produce for which a batch is actually recorded there — we don’t imply every product comes from every district.</p>
        <Link className="btn gold mt16" to="/market/products">Browse all West Bengal batches <Icon name="arrow" /></Link>
      </div>
      <div className="mk-districts">
        {loading ? Array.from({ length: 8 }, (_, i) => <div key={i} className="mk-district mk-skel" style={{ height: 76 }} />)
          : shown.map((r) => (
            <Link key={r.id} className="mk-district" to={`/market/products?district=${r.id}`}>
              <b>{r.name}<span>{r.listings}</span></b>
              <small>{r.products.length ? r.products.map((p) => p.name).join(' · ') : 'No batches recorded yet'}</small>
            </Link>
          ))}
      </div>
    </Reveal>
  );
}
