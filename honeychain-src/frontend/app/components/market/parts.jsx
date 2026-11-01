import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon';
import { useMarket } from '../../context/MarketContext';
import { inr, qty, TILE } from '../../lib/market';

export const cx = (...a) => a.filter(Boolean).join(' ');

/** Photo with a tasteful tile when the file is missing. */
export function MImg({ src, alt = '', slug, className, style }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const [emoji, color] = TILE[slug] || ['🌿', '#e2eddc'];
  if (!src || failed) return <span className={cx('ph', className)} style={{ ...style, '--c': color }} role="img" aria-label={alt}>{emoji}</span>;
  return <img className={className} style={style} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

export const Pill = ({ tone = 'gray', icon, children, className }) => <span className={cx('pill', tone, className)}>{icon && <Icon name={icon} />}{children}</span>;
export const DemoTag = () => null;

const BADGE_ICON = { verified: 'shieldcheck', pending_review: 'clock', under_review: 'info', rejected: 'xc', suspended: 'ban', submitted: 'file', centre_checked: 'building', lab_tested: 'flask', dispatched: 'truck' };

/** Distinct verification attributes. Centre check, lab test and officer verification are never merged. */
export function Badges({ badges = [] }) {
  return (
    <div className="mk-badges">
      {badges.map((b) => <Pill key={b.key} tone={b.tone} icon={BADGE_ICON[b.key]}>{b.label}{b.note ? ` · ${b.note.toLowerCase()}` : ''}</Pill>)}
    </div>
  );
}

export function CentreMark({ centre }) {
  if (!centre) return <span className="muted sm">Direct from collector</span>;
  const a = centre.accreditation;
  return (
    <span className="row sm" style={{ gap: 6, flexWrap: 'wrap' }}>
      <Icon name="building" /> <Link to={`/market/centres/${centre.id}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 600 }}>{centre.name}</Link>
      {centre.verified_centre
        ? <Pill tone="green" icon="award">Accredited</Pill>
        : a.key === 'suspended' ? <Pill tone="red" icon="ban">Accreditation suspended</Pill> : a.key === 'expired' ? <Pill tone="amber">Accreditation expired</Pill> : <Pill tone="gray">Not accredited</Pill>}
    </span>
  );
}

export function PriceTag({ price, unit }) {
  if (!price) return <div className="mk-price"><b style={{ fontSize: 16 }}>Price on request</b></div>;
  return (
    <div className="mk-price" title={price.label}>
      <b>{inr(price.amount)}</b><small>/ {price.unit || unit}</small>
      {price.illustrative && <span className="ill">ILLUSTRATIVE</span>}
    </div>
  );
}

export function SaveButton({ kind, refId, className }) {
  const { savedKeys, toggleSave } = useMarket();
  const on = savedKeys.has(`${kind}:${refId}`);
  return (
    <button type="button" className={cx('iconbtn', on && 'on', className)} aria-pressed={on} aria-label={on ? 'Remove from saved' : 'Save'} title={on ? 'Saved' : 'Save for later'}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave(kind, refId); }}>
      <Icon name="heart" style={on ? { fill: 'currentColor' } : undefined} />
    </button>
  );
}

export function ProductCard({ l }) {
  const { openEnquiry } = useMarket();
  const unavailable = !l.can_enquire;
  return (
    <article className="mk-card">
      <Link className="img" to={`/market/p/${l.code}`} aria-label={`View ${l.title}`}>
        <MImg src={l.image} alt={l.title} slug={l.product.market_category?.slug} />
        <div className="tags" />
      </Link>
      <SaveButton kind="product" refId={l.code} className="save" />
      <div className="body">
        <div className="cat">{l.product.market_category?.name || l.product.category}</div>
        <h3><Link to={`/market/p/${l.code}`}>{l.title}{l.grade_label ? <span className="muted" style={{ fontWeight: 500 }}> · {l.grade_label}</span> : null}</Link></h3>
        <div className="loc"><Icon name="pin" /><span>{l.district.name}, {l.state.name}</span></div>
        <CentreMark centre={l.centre} />
        <PriceTag price={l.price} unit={l.unit} />
        <div className="meta"><span><b>{qty(l.available_qty)}</b> {l.unit} available</span>{l.min_order_qty ? <span className="muted">Min {qty(l.min_order_qty)} {l.unit}</span> : null}</div>
        <Badges badges={l.badges} />
        <div className="bid"><span>Batch <code>{l.code}</code></span><Link className="linkbtn xs" to={`/market/verify/${l.code}`}><Icon name="qr" /> Verify QR</Link></div>
        <div className="acts">
          <Link className="btn sm" to={`/market/p/${l.code}`}>View details</Link>
          <button type="button" className="btn gold sm" disabled={unavailable} onClick={() => openEnquiry(l)} title={unavailable ? 'This batch cannot receive enquiries right now' : ''}>
            {unavailable ? 'Unavailable' : 'Send enquiry'}
          </button>
        </div>
      </div>
    </article>
  );
}

export function CardSkeletons({ n = 8, cols }) {
  return (
    <div className={cx('mk-grid', cols === 3 && 'three')} aria-busy="true" aria-live="polite">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="mk-card skel"><div className="img mk-skel" style={{ borderRadius: 0 }} />
          <div className="body"><span className="mk-skel" style={{ height: 12, width: '40%' }} /><span className="mk-skel" style={{ height: 18, width: '85%' }} /><span className="mk-skel" style={{ height: 12, width: '60%' }} /><span className="mk-skel" style={{ height: 24, width: '45%' }} /><span className="mk-skel" style={{ height: 36, width: '100%', marginTop: 8 }} /></div></div>
      ))}
    </div>
  );
}

export function Empty({ icon = 'search', title, children, action }) {
  return <div className="mk-empty"><Icon name={icon} /><h3>{title}</h3><div className="muted">{children}</div>{action && <div className="mt16">{action}</div>}</div>;
}

export function ErrorBox({ error, onRetry }) {
  return <Empty icon="alert" title="We couldn't load this" action={onRetry && <button type="button" className="btn" onClick={onRetry}><Icon name="refresh" /> Try again</button>}>{error?.message || 'Please check your connection and try again.'}</Empty>;
}

export function Alert({ tone = 'info', icon, title, children }) {
  return <div className={cx('mk-alert', tone)} role={tone === 'danger' ? 'alert' : undefined}><Icon name={icon || (tone === 'danger' ? 'ban' : tone === 'warning' ? 'alert' : tone === 'ok' ? 'shieldcheck' : 'info')} /><div>{title && <b>{title}</b>}{children}</div></div>;
}

export function Pager({ page, pages, onChange }) {
  if (pages <= 1) return null;
  const nums = [];
  for (let i = 1; i <= pages; i += 1) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
  return (
    <nav className="mk-pager" aria-label="Pagination">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><Icon name="left" /></button>
      {nums.map((n, i) => <span key={n} style={{ display: 'contents' }}>{i > 0 && n - nums[i - 1] > 1 && <span style={{ alignSelf: 'center' }}>…</span>}<button type="button" className={n === page ? 'on' : ''} aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)}>{n}</button></span>)}
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><Icon name="right" /></button>
    </nav>
  );
}

export function Crumbs({ items }) {
  return (
    <nav className="mk-crumbs" aria-label="Breadcrumb">
      {items.map((it, i) => <span key={i} className="row" style={{ gap: 8 }}>{i > 0 && <Icon name="right" />}{it.to ? <Link to={it.to}>{it.label}</Link> : <b>{it.label}</b>}</span>)}
    </nav>
  );
}

/** Scroll-reveal wrapper using IntersectionObserver (cheap, no animation library needed). */
export function Reveal({ children, className, as: Tag = 'div', ...rest }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setOn(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: '0px 0px -60px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={cx('mk-reveal', on && 'in', className)} {...rest}>{children}</Tag>;
}
