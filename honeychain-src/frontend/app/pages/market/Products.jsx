import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useDocTitle } from '../../hooks';
import { useListings, useStoreMeta } from '../../api/market';
import { CardSkeletons, Crumbs, Empty, ErrorBox, Pager, ProductCard, cx } from '../../components/market/parts';

const SORTS = [['recent', 'Recently added'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['quantity', 'Quantity available'], ['verified', 'Recently verified']];
const ACC = [['', 'Any'], ['active', 'AranyaValue accredited'], ['suspended', 'Accreditation suspended'], ['expired', 'Accreditation expired'], ['none', 'Not accredited']];
const KEYS = ['q', 'category', 'district', 'centre', 'min_price', 'max_price', 'min_qty', 'accreditation', 'status', 'lab', 'officer', 'sort', 'page'];

export default function Products() {
  useDocTitle('All products');
  const [sp, setSp] = useSearchParams();
  const meta = useStoreMeta();
  const [open, setOpen] = useState(false);
  const params = useMemo(() => Object.fromEntries(KEYS.map((k) => [k, sp.get(k) || '']).filter(([, v]) => v)), [sp]);
  const q = useListings({ limit: 12, ...params });
  const set = (patch) => {
    const next = new URLSearchParams(sp);
    Object.entries({ page: '', ...patch }).forEach(([k, v]) => (v === '' || v == null || v === false ? next.delete(k) : next.set(k, v === true ? '1' : v)));
    setSp(next, { replace: true });
  };
  const cats = meta.data?.categories || [];
  const districts = (meta.data?.districts || []).filter((d) => d.state_id === 'ST-WB');
  const centres = meta.data?.centres || [];
  const statuses = meta.data?.statuses || [];

  const chips = [];
  if (params.q) chips.push(['q', `“${params.q}”`]);
  if (params.category) chips.push(['category', cats.find((c) => c.slug === params.category)?.name || params.category]);
  if (params.district) chips.push(['district', districts.find((d) => d.id === params.district)?.name || params.district]);
  if (params.centre) chips.push(['centre', centres.find((c) => c.id === params.centre)?.name || params.centre]);
  if (params.min_price || params.max_price) chips.push(['price', `₹${params.min_price || 0} – ${params.max_price ? `₹${params.max_price}` : 'any'}`]);
  if (params.min_qty) chips.push(['min_qty', `≥ ${params.min_qty} available`]);
  if (params.accreditation) chips.push(['accreditation', ACC.find((a) => a[0] === params.accreditation)?.[1]]);
  if (params.status) chips.push(['status', statuses.find((s) => s.key === params.status)?.label || params.status]);
  if (params.lab) chips.push(['lab', 'Lab tested']);
  if (params.officer) chips.push(['officer', 'Officer verified']);
  const clear = (k) => (k === 'price' ? set({ min_price: '', max_price: '' }) : set({ [k]: '' }));

  const catName = cats.find((c) => c.slug === params.category)?.name;
  const data = q.data;

  return (
    <>
      <div className="mk-pagehead"><div className="wrap">
        <Crumbs items={[{ label: 'Marketplace', to: '/market' }, { label: catName || 'All products' }]} />
        <h1>{catName || 'All forest produce'}</h1>
        <p>{catName ? cats.find((c) => c.slug === params.category)?.description : 'Every listed batch links back to a live batch record. Filter by evidence, centre, district and price.'}</p>
      </div></div>

      <div className="wrap mk-shop" style={{ paddingTop: 22 }}>
        <aside className={cx('mk-filters', open && 'open')} aria-label="Filters">
          <div className="row between" style={{ paddingTop: 14 }}><h2 style={{ fontSize: 18 }}>Filters</h2><button type="button" className="iconbtn mk-filterbtn" onClick={() => setOpen(false)} aria-label="Close filters"><Icon name="x" /></button></div>

          <h3>Category</h3>
          <label className="opt"><input type="radio" name="cat" checked={!params.category} onChange={() => set({ category: '' })} /> All categories</label>
          {cats.map((c) => <label key={c.id} className="opt"><input type="radio" name="cat" checked={params.category === c.slug} onChange={() => set({ category: c.slug })} />{c.name}<span className="c">{c.listings}</span></label>)}

          <h3>District</h3>
          <select className="sel" aria-label="District" value={params.district || ''} onChange={(e) => set({ district: e.target.value })}>
            <option value="">All districts</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.listings})</option>)}
          </select>

          <h3>Collection centre</h3>
          <select className="sel" aria-label="Collection centre" value={params.centre || ''} onChange={(e) => set({ centre: e.target.value })}>
            <option value="">All centres</option>
            {centres.map((c) => <option key={c.id} value={c.id}>{c.name.replace(' demo collection centre', '')}</option>)}
          </select>

          <h3>Indicative price (₹)</h3>
          <RangeInputs a={params.min_price || ''} b={params.max_price || ''} onCommit={(a, b) => set({ min_price: a, max_price: b })} />

          <h3>Minimum available quantity</h3>
          <Debounced value={params.min_qty || ''} onCommit={(v) => set({ min_qty: v })} placeholder="e.g. 100" label="Minimum quantity available" />

          <h3>Centre accreditation</h3>
          <select className="sel" aria-label="Centre accreditation" value={params.accreditation || ''} onChange={(e) => set({ accreditation: e.target.value })}>
            {ACC.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>

          <h3>Verification status</h3>
          <select className="sel" aria-label="Verification status" value={params.status || ''} onChange={(e) => set({ status: e.target.value })}>
            <option value="">Browsable batches</option>
            {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <label className="opt" style={{ marginTop: 8 }}><input type="checkbox" checked={!!params.lab} onChange={(e) => set({ lab: e.target.checked })} /> Lab tested only</label>
          <label className="opt"><input type="checkbox" checked={!!params.officer} onChange={(e) => set({ officer: e.target.checked })} /> Officer verified only</label>

          {chips.length > 0 && <button type="button" className="btn block reset" onClick={() => setSp({}, { replace: true })}>Clear all filters</button>}
          <button type="button" className="btn green block mt12 mk-filterbtn" onClick={() => setOpen(false)}>Show {data?.total ?? ''} results</button>
        </aside>
        {open && <div className="mk-drawer-scrim" style={{ zIndex: 110 }} onClick={() => setOpen(false)} />}

        <section aria-live="polite">
          <div className="mk-bar">
            <div className="row">
              <button type="button" className="btn sm mk-filterbtn" onClick={() => setOpen(true)}><Icon name="sliders" /> Filters{chips.length ? ` (${chips.length})` : ''}</button>
              <span className="sm"><b>{data ? data.total : '…'}</b> {data?.total === 1 ? 'batch' : 'batches'}{params.q ? <> for <b>“{params.q}”</b></> : null}</span>
            </div>
            <label className="row sm" htmlFor="sort"><Icon name="sort" /> Sort by
              <select id="sort" className="sel" style={{ width: 'auto', padding: '7px 10px' }} value={params.sort || 'recent'} onChange={(e) => set({ sort: e.target.value === 'recent' ? '' : e.target.value })}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          {chips.length > 0 && <div className="mk-chips">{chips.map(([k, l]) => <button key={k} type="button" className="mk-chip" onClick={() => clear(k)} aria-label={`Remove filter ${l}`}>{l} <Icon name="x" /></button>)}</div>}

          {q.isLoading ? <CardSkeletons n={6} cols={3} />
            : q.error ? <ErrorBox error={q.error} onRetry={q.refetch} />
              : data.listings.length === 0
                ? <Empty icon="search" title="No batches match these filters" action={<button type="button" className="btn gold" onClick={() => setSp({}, { replace: true })}>Clear filters</button>}>Try a different district or remove the price range. Rejected and suspended batches are hidden unless you choose that status.</Empty>
                : <div className="mk-grid three" style={{ opacity: q.isFetching ? 0.65 : 1, transition: 'opacity .2s' }}>{data.listings.map((l) => <ProductCard key={l.code} l={l} />)}</div>}
          {data && <Pager page={data.page} pages={data.pages} onChange={(p) => { set({ page: p > 1 ? String(p) : '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
        </section>
      </div>
    </>
  );
}

function Debounced({ value, onCommit, placeholder, label }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  useEffect(() => { if (v === value) return undefined; const t = setTimeout(() => onCommit(v), 450); return () => clearTimeout(t); }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return <input className="inp" inputMode="decimal" aria-label={label} value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} placeholder={placeholder} />;
}

function RangeInputs({ a, b, onCommit }) {
  const [x, setX] = useState(a);
  const [y, setY] = useState(b);
  useEffect(() => { setX(a); setY(b); }, [a, b]);
  useEffect(() => { if (x === a && y === b) return undefined; const t = setTimeout(() => onCommit(x, y), 450); return () => clearTimeout(t); }, [x, y]); // eslint-disable-line react-hooks/exhaustive-deps
  const clean = (v) => v.replace(/[^\d.]/g, '');
  return (
    <div className="row">
      <input className="inp" inputMode="decimal" aria-label="Minimum price" placeholder="Min" value={x} onChange={(e) => setX(clean(e.target.value))} />
      <span>–</span>
      <input className="inp" inputMode="decimal" aria-label="Maximum price" placeholder="Max" value={y} onChange={(e) => setY(clean(e.target.value))} />
    </div>
  );
}
