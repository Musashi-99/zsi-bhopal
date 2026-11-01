import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useDocTitle, useDebounced } from '../../hooks';
import { useCatalogue, useCatalogueItem, useStoreMeta } from '../../api/market';
import { Alert, CardSkeletons, Crumbs, DemoTag, Empty, ErrorBox, MImg, Pill, ProductCard } from '../../components/market/parts';

const LANGS = [['en', 'English'], ['bn', 'বাংলা'], ['hi', 'हिन्दी']];

export function Catalogue() {
  useDocTitle('NTFP catalogue');
  const meta = useStoreMeta();
  const [text, setText] = useState('');
  const [cat, setCat] = useState('');
  const [lang, setLang] = useState('en');
  const dq = useDebounced(text.trim(), 250);
  const q = useCatalogue({ q: dq, category: cat });
  return (
    <>
      <div className="mk-pagehead"><div className="wrap">
        <Crumbs items={[{ label: 'Marketplace', to: '/market' }, { label: 'NTFP catalogue' }]} />
        <h1>West Bengal forest produce catalogue</h1>
        <p>A structured list of non-timber forest products with English, Bengali and Hindi names, scientific names where reliably established, seasons and handling guidance. Permissions are noted, never assumed.</p>
      </div></div>
      <div className="wrap" style={{ paddingTop: 24 }}>
        <div className="mk-bar" role="search">
          <div className="row grow wrap">
            <div className="field grow" style={{ minWidth: 240 }}><label className="sr" htmlFor="ctq">Search the catalogue</label><input id="ctq" className="inp" placeholder="Search by name, local name, scientific name or category" value={text} onChange={(e) => setText(e.target.value)} /></div>
            <select className="sel" style={{ width: 'auto' }} aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{(meta.data?.categories || []).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select>
          </div>
          <div className="toggle" role="group" aria-label="Display language">{LANGS.map(([k, l]) => <button key={k} type="button" className={lang === k ? 'on' : ''} aria-pressed={lang === k} onClick={() => setLang(k)}>{l}</button>)}</div>
        </div>
        {q.isLoading ? <CardSkeletons n={6} cols={3} /> : q.error ? <ErrorBox error={q.error} onRetry={q.refetch} />
          : q.data.products.length === 0 ? <Empty icon="book" title="No catalogue entries match">Try a different spelling or another language.</Empty>
            : <div className="mk-grid three">{q.data.products.map((p) => <ProductTile key={p.id} p={p} lang={lang} />)}</div>}
        <p className="xs muted mt24"><Icon name="info" /> Names and scientific names are curated by AranyaValue administrators and can be corrected. If you see a mistake, tell the team through the officer portal.</p>
      </div>
    </>
  );
}

const nameOf = (p, lang) => (lang === 'en' ? p.name : p.names[lang] || `${p.name}`);

function ProductTile({ p, lang }) {
  return (
    <article className="mk-card">
      <Link className="img" to={`/market/catalogue/${p.id}`} aria-label={p.name}><MImg src={p.image} alt={p.name} slug={p.market_category?.slug} />{p.is_demo && <div className="tags"><DemoTag /></div>}</Link>
      <div className="body">
        <div className="cat">{p.market_category?.name || p.category}</div>
        <h3><Link to={`/market/catalogue/${p.id}`}>{nameOf(p, lang)}</Link></h3>
        {lang !== 'en' && <div className="sm muted">{p.name}</div>}
        {p.scientific_name ? <div className="sm muted"><i>{p.scientific_name}</i></div> : <div className="sm muted">Scientific name: not established</div>}
        <div className="row wrap" style={{ gap: 6 }}>{p.names.bn && lang !== 'bn' && <Pill>{p.names.bn}</Pill>}{p.names.hi && lang !== 'hi' && <Pill>{p.names.hi}</Pill>}</div>
        <div className="meta sm"><span>{p.season || <span className="muted">Season not stated</span>}</span></div>
        <div className="acts"><Link className="btn sm" to={`/market/catalogue/${p.id}`}>Details</Link><Link className="btn gold sm" to={`/market/products?q=${encodeURIComponent(p.name)}`}>{p.listing_count} listed</Link></div>
      </div>
    </article>
  );
}

export function CatalogueDetail() {
  const { id } = useParams();
  const q = useCatalogueItem(id);
  const d = q.data;
  useDocTitle(d ? d.product.name : 'Catalogue');
  if (q.isLoading) return <div className="wrap" style={{ padding: 30 }}><span className="mk-skel" style={{ height: 300, display: 'block' }} /></div>;
  if (q.error) return <div className="wrap" style={{ padding: 30 }}>{q.error.status === 404 ? <Empty icon="book" title="Catalogue entry not found" action={<Link className="btn gold" to="/market/catalogue">Back to catalogue</Link>}>This entry may have been removed.</Empty> : <ErrorBox error={q.error} onRetry={q.refetch} />}</div>;
  const p = d.product;
  return (
    <>
      <div className="mk-pagehead"><div className="wrap">
        <Crumbs items={[{ label: 'Marketplace', to: '/market' }, { label: 'Catalogue', to: '/market/catalogue' }, { label: p.name }]} />
        <h1>{p.name}</h1>
        <p>{p.scientific_name ? <i>{p.scientific_name}</i> : 'Scientific name not established for this entry'} · {p.market_category?.name || p.category}</p>
      </div></div>
      <div className="wrap" style={{ paddingTop: 26 }}>
        <div className="mk-split">
          <div className="stack" style={{ gap: 18 }}>
            <section className="mk-panel"><h3>About</h3><p>{p.description || 'No description yet.'}</p>
              <dl className="mk-facts mt16">
                <dt>English</dt><dd>{p.names.en}</dd><dt>বাংলা</dt><dd>{p.names.bn || <span className="muted">Not added</span>}</dd><dt>हिन्दी</dt><dd>{p.names.hi || <span className="muted">Not added</span>}</dd>
                {p.names.local.length > 0 && <><dt>Local names</dt><dd>{p.names.local.join(', ')}</dd></>}
                <dt>Typical season</dt><dd>{p.season || <span className="muted">Not stated</span>}</dd>
                <dt>Units</dt><dd>{p.units.join(', ')}</dd>
                <dt>Expected handling</dt><dd>{p.handling_expected.join(', ') || '—'}{p.handling_required.length ? <span className="muted"> (required: {p.handling_required.join(', ')})</span> : null}</dd>
                <dt>Batches recorded in</dt><dd>{p.districts_with_batches.join(', ') || <span className="muted">No district yet</span>}</dd>
              </dl></section>
            <section className="mk-panel"><h3>Quality parameters</h3><p className="sub">Parameters the catalogue tracks for this product. A blank limit means no verified limit is stored — it is not an implied pass.</p>
              {d.parameters.length === 0 ? <p className="muted">No parameters configured.</p> : (
                <div className="mk-tablewrap"><table className="mk-table"><thead><tr><th>Parameter</th><th>Unit</th><th>Limit</th><th>Standard / reference</th></tr></thead>
                  <tbody>{d.parameters.map((x) => <tr key={x.name}><td><b>{x.name}</b>{x.required && <> <Pill tone="amber">required</Pill></>}</td><td>{x.unit || '—'}</td><td>{x.min != null || x.max != null ? `${x.min ?? ''}${x.min != null && x.max != null ? ' – ' : ''}${x.max != null ? `≤ ${x.max}` : ''}` : <span className="muted">Not configured</span>}</td><td className="sm">{x.standard || <span className="muted">None referenced</span>}</td></tr>)}</tbody></table></div>)}</section>
          </div>
          <div className="stack" style={{ gap: 18 }}>
            <section className="mk-panel"><h3>Permissions & restrictions</h3><Alert tone="warning" title="Do not assume it is unrestricted">{p.permissions_note || 'No product-specific permission is recorded. Confirm with the local forest authority.'}</Alert></section>
            <section className="mk-panel"><h3>Available states</h3>{d.states.length ? <div className="mk-chipset">{d.states.map((s) => <span key={s.id}>{s.name}</span>)}</div> : <p className="muted sm">Not linked to a state yet.</p>}<p className="xs muted mt8">The catalogue is state-aware so more states can be added without code changes.</p></section>
          </div>
        </div>
        <section className="mk-sec"><div className="hd"><div><h2>Batches of {p.name.toLowerCase()}</h2><p>Currently listed batches for this product.</p></div></div>
          {d.listings.length ? <div className="mk-grid">{d.listings.map((l) => <ProductCard key={l.code} l={l} />)}</div> : <Empty icon="package" title="No batches listed yet">When a collector lists a batch of this product it appears here.</Empty>}</section>
      </div>
    </>
  );
}
