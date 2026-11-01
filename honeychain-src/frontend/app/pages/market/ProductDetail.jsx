import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import Icon from '../../components/ui/Icon';
import { useDocTitle } from '../../hooks';
import { useListing } from '../../api/market';
import { useMarket } from '../../context/MarketContext';
import { useUI } from '../../context/UIContext';
import { fmtDate } from '../../lib/format';
import { inr, qty } from '../../lib/market';
import { Alert, Badges, CentreMark, Crumbs, DemoTag, Empty, ErrorBox, MImg, Pill, PriceTag, ProductCard, SaveButton, cx } from '../../components/market/parts';
import { Conditions, Documents, History, OfficerBlock, QualityTable } from '../../components/market/evidence';
import { CentreCard } from './Centres';

export default function ProductDetail() {
  const { code } = useParams();
  const q = useListing(code);
  const d = q.data;
  useDocTitle(d ? d.listing.title : 'Product');

  if (q.isLoading) return <div className="wrap" style={{ padding: '34px 20px' }}><div className="mk-pd"><div className="mk-skel" style={{ aspectRatio: '1', borderRadius: 14 }} /><div className="stack"><span className="mk-skel" style={{ height: 34, width: '70%' }} /><span className="mk-skel" style={{ height: 18 }} /><span className="mk-skel" style={{ height: 160 }} /></div><div className="mk-skel" style={{ height: 300, borderRadius: 14 }} /></div></div>;
  if (q.error) {
    return <div className="wrap" style={{ padding: '40px 20px' }}>{q.error.status === 404
      ? <Empty icon="search" title="This listing isn’t available" action={<div className="row" style={{ justifyContent: 'center' }}><Link className="btn gold" to="/market/products">Browse products</Link><Link className="btn" to={`/market/verify/${code}`}>Check batch {code}</Link></div>}>The batch may not be listed, may be private, or the ID may be wrong. You can still check whether the batch ID exists.</Empty>
      : <ErrorBox error={q.error} onRetry={q.refetch} />}</div>;
  }
  return <Detail d={d} />;
}

function Detail({ d }) {
  const { listing: l, detail, centre, related } = d;
  const { openEnquiry, addToBasket } = useMarket();
  const { toast } = useUI();
  const [img, setImg] = useState(0);
  const [tab, setTab] = useState('quality');
  const [n, setN] = useState(l.min_order_qty || 1);
  const [zoom, setZoom] = useState({});
  const images = l.images.length ? l.images : [null];
  const verifyUrl = `${window.location.origin}/market/verify/${l.code}`;
  const names = detail.local_names || {};
  const stockTone = l.available_qty <= 0 ? 'none' : l.available_qty < (l.quantity * 0.25) ? 'low' : '';
  const nn = Number(n);
  const nBad = !nn || nn <= 0 || nn > l.available_qty || (l.min_order_qty && nn < l.min_order_qty);
  const slug = l.product.market_category?.slug;

  const copy = async () => { try { await navigator.clipboard.writeText(verifyUrl); toast('Verification link copied.'); } catch { toast(verifyUrl); } };

  return (
    <div className="wrap">
      <Crumbs items={[{ label: 'Marketplace', to: '/market' }, { label: l.product.market_category?.name || 'Products', to: `/market/products${slug ? `?category=${slug}` : ''}` }, { label: l.title }]} />
      {detail.warning && <div style={{ marginBottom: 18 }}><Alert tone={detail.warning.level} title={detail.warning.title}>{detail.warning.text} <Link className="linkbtn" to={`/market/verify/${l.code}`}>Open verification record</Link></Alert></div>}

      <div className="mk-pd">
        <div className="mk-gal">
          <div className="stage" onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setZoom({ '--zx': `${((e.clientX - r.left) / r.width) * 100}%`, '--zy': `${((e.clientY - r.top) / r.height) * 100}%` }); }} style={zoom}>
            <MImg src={images[img]} alt={`${l.title} photo ${img + 1}`} slug={slug} />
            {l.is_demo && <span style={{ position: 'absolute', left: 12, top: 12 }}><DemoTag /></span>}
          </div>
          {images.length > 1 && <div className="thumbs">{images.map((s, i) => <button key={s} type="button" className={cx(i === img && 'on')} onClick={() => setImg(i)} aria-label={`Show photo ${i + 1}`}><MImg src={s} alt="" slug={slug} /></button>)}</div>}
        </div>

        <div className="mk-info">
          <div className="row wrap" style={{ gap: 8 }}><Pill tone="sage">{l.product.market_category?.name || l.product.category}</Pill>{l.is_demo && <DemoTag />}</div>
          <h1 style={{ marginTop: 10 }}>{l.title}{l.grade_label ? <span className="muted" style={{ fontWeight: 500 }}> — {l.grade_label}</span> : null}</h1>
          {detail.scientific_name && <div className="sci">{detail.scientific_name}</div>}
          <div className="names">
            {names.bn && <Pill tone="gray">বাংলা: {names.bn}</Pill>}
            {names.hi && <Pill tone="gray">हिन्दी: {names.hi}</Pill>}
            {l.local_name && l.local_name !== l.title && <Pill tone="gray">Local: {l.local_name}</Pill>}
          </div>
          <div className="mt16"><Badges badges={l.badges} /></div>
          <hr />
          <PriceTag price={l.price} unit={l.unit} />
          {l.price && <p className="xs muted mt8"><Icon name="info" /> {l.price.label}. Last updated {fmtDate(l.price.updated_at)}. Never a guaranteed final price.</p>}
          <hr />
          <dl className="mk-facts">
            <dt>Batch ID</dt><dd><code>{l.code}</code></dd>
            <dt>Origin</dt><dd>{detail.collection.area ? `${detail.collection.area}, ` : ''}{l.district.name}, {l.state.name}</dd>
            <dt>Collection centre</dt><dd><CentreMark centre={l.centre} /></dd>
            <dt>Collected on</dt><dd>{fmtDate(l.collection_date)}</dd>
            <dt>Season</dt><dd>{detail.season || <span className="muted">Not stated in the catalogue</span>}</dd>
            <dt>Packaging</dt><dd>{detail.packaging || <span className="muted">Not recorded</span>}</dd>
            <dt>Batch size</dt><dd>{qty(l.quantity)} {l.unit}</dd>
          </dl>
          {detail.description && <p className="mt16">{detail.description}</p>}
        </div>

        <aside className="mk-buy" aria-label="Buying options">
          <div><div className="p">{l.price ? inr(l.price.amount) : 'Price on request'} {l.price && <small>/ {l.price.unit}</small>}</div>
            {l.price?.illustrative && <Pill tone="gold">Illustrative demo price</Pill>}</div>
          <div className={cx('stock', stockTone)}>{l.available_qty <= 0 ? 'Fully reserved' : `${qty(l.available_qty)} ${l.unit} available`}</div>
          <div className="sm muted">{l.min_order_qty ? `Minimum order ${qty(l.min_order_qty)} ${l.unit}. ` : ''}Bulk enquiries welcome.</div>
          {l.can_enquire ? (
            <>
              <div className="field"><label htmlFor="pd-q">Quantity</label>
                <div className="mk-qty"><button type="button" aria-label="Decrease" onClick={() => setN(Math.max(l.min_order_qty || 1, nn - (l.min_order_qty || 1)))}>−</button>
                  <input id="pd-q" inputMode="decimal" value={n} onChange={(e) => setN(e.target.value.replace(/[^\d.]/g, ''))} /><span>{l.unit}</span>
                  <button type="button" aria-label="Increase" onClick={() => setN(Math.min(l.available_qty, nn + (l.min_order_qty || 1)))}>+</button></div>
                {nBad && <span className="err">{nn > l.available_qty ? `Only ${qty(l.available_qty)} ${l.unit} available.` : `Minimum is ${qty(l.min_order_qty || 0)} ${l.unit}.`}</span>}
                {!nBad && l.price && <span className="hint">Indicative value {inr(nn * l.price.amount)}</span>}</div>
              <button type="button" className="btn gold block lg" disabled={nBad} onClick={() => openEnquiry(l, { kind: 'purchase_request', quantity: n })}><Icon name="handshake" /> Request to buy</button>
              <button type="button" className="btn block" onClick={() => openEnquiry(l, { kind: 'enquiry', quantity: n })}><Icon name="msg" /> Send enquiry / bulk enquiry</button>
              <button type="button" className="btn block" disabled={nBad} onClick={() => addToBasket(l, nn)}><Icon name="cart" /> Add to enquiry basket</button>
            </>
          ) : <Alert tone={detail.warning?.level || 'info'} title="Not open for enquiries">{detail.warning ? 'This batch’s current status blocks new requests.' : 'There is no quantity left on this batch.'}</Alert>}
          <div className="row between"><SaveButton kind="product" refId={l.code} /><Link className="btn sm" to={`/market/verify/${l.code}`}><Icon name="qr" /> Verify batch</Link></div>
          <p className="xs muted"><Icon name="lock" /> No payment is taken here. The seller replies to your request and the order is tracked in your account.</p>
        </aside>
      </div>

      <div className="mk-tabs" role="tablist">
        {[['quality', 'Quality information'], ['batch', 'Batch & verification'], ['centre', 'Collection centre'], ['info', 'Product & permissions']].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={cx(tab === k && 'on')} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'quality' && (
        <>
          <section className="mk-panel"><h3>Quality parameters</h3><p className="sub">Only readings that exist in the batch record are shown. Each carries its evidence type, method, date and who recorded it.</p>
            <QualityTable rows={detail.quality} expected={detail.expected_parameters} /></section>
          <section className="mk-panel"><h3>Condition & handling</h3><p className="sub">Storage, packaging and appearance as recorded for this batch.</p><Conditions items={detail.conditions} /></section>
        </>
      )}

      {tab === 'batch' && (
        <div className="mk-split">
          <div>
            <section className="mk-panel"><h3>Officer verification</h3><p className="sub">Read live from the batch record.</p><OfficerBlock officer={detail.officer} status={l.status.key} /></section>
            <section className="mk-panel"><h3>Verification history</h3><p className="sub">Public events recorded for this batch, newest first.</p><History items={detail.history} /></section>
            <section className="mk-panel"><h3>Supporting documents</h3><Documents docs={detail.documents} /></section>
          </div>
          <div>
            <section className="mk-panel"><h3>Batch QR</h3><p className="sub">Scanning opens the live verification page.</p>
              <div className="mk-qrbox"><div className="qr"><QRCodeSVG value={verifyUrl} size={132} level="M" /></div>
                <div className="stack"><code>{l.code}</code><Link className="btn sm" to={`/market/verify/${l.code}`}><Icon name="shieldcheck" /> Open verification</Link><button className="btn sm" type="button" onClick={copy}><Icon name="copy" /> Copy link</button></div></div></section>
            <section className="mk-panel"><h3>Collection</h3>
              <dl className="mk-facts"><dt>Date</dt><dd>{fmtDate(detail.collection.date)}</dd><dt>Location</dt><dd>{[detail.collection.area, detail.collection.block, detail.collection.district].filter(Boolean).join(', ')}</dd>
                <dt>Method</dt><dd>{detail.collection.method || '—'}</dd><dt>Quantity</dt><dd>{qty(l.quantity)} {l.unit}</dd><dt>Status</dt><dd><Badges badges={l.badges} /></dd></dl>
              <p className="xs muted mt12"><Icon name="info" /> {detail.collection.source_statement}</p></section>
          </div>
        </div>
      )}

      {tab === 'centre' && (centre ? <div style={{ maxWidth: 560 }}><CentreCard c={centre} /></div> : <Empty icon="building" title="No collection centre">This batch is sold directly by the collector.</Empty>)}

      {tab === 'info' && (
        <div className="mk-split">
          <section className="mk-panel"><h3>About this product</h3><p>{detail.product_description || 'No catalogue description.'}</p>
            <dl className="mk-facts mt16"><dt>Scientific name</dt><dd>{detail.scientific_name ? <i>{detail.scientific_name}</i> : <span className="muted">Not established for this entry</span>}</dd>
              <dt>Category</dt><dd>{l.product.market_category?.name}</dd><dt>Typical season</dt><dd>{detail.season || <span className="muted">Not stated</span>}</dd>
              <dt>Expected handling</dt><dd>{detail.handling_expected.length ? detail.handling_expected.join(', ') : '—'}</dd></dl>
            <Link className="btn sm mt16" to={`/market/catalogue/${l.product.id}`}><Icon name="book" /> View in catalogue</Link></section>
          <section className="mk-panel"><h3>Permissions & restrictions</h3>
            <Alert tone="warning" title="Check before you trade">{detail.permissions_note || 'No product-specific permission is recorded in this catalogue. Confirm requirements with the local forest authority.'}</Alert>
            <p className="xs muted mt12">AranyaValue does not grant or certify any permit. Not every forest product is legally unrestricted.</p></section>
        </div>
      )}

      {related.length > 0 && (
        <section className="mk-sec"><div className="hd"><h2>More from this category</h2></div><div className="mk-grid">{related.map((r) => <ProductCard key={r.code} l={r} />)}</div></section>
      )}
    </div>
  );
}
