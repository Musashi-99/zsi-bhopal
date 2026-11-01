import { forwardRef, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from './Icon';
import { statusClass, statusLabel } from '../../lib/format';
import { fadeUp, hoverLift, tap } from '../../lib/motion';

const cx = (...a) => a.filter(Boolean).join(' ');
export { cx };

/* ---------- Image with graceful emoji fallback ---------- */
const FALLBACK = {
  honey: ['🍯', '#f7e2a8'], mahua: ['🌸', '#f8d6e4'], medicinal: ['🌿', '#d6edd1'], seeds: ['🌰', '#ead7bf'], ntfp: ['🍃', '#dfe9c9'],
  avatar: ['🧑🏽‍🌾', '#d9efd9'], 'honey-1': ['🍯', '#f7e2a8'], 'honey-2': ['🐝', '#f6d98d'], 'honey-3': ['🍯', '#e9c07a'],
  flower: ['🌼', '#f1eed2'], forest: ['🌳', '#cfe5cf'], drying: ['☀️', '#f4e4b8'], packaging: ['📦', '#efe0c3'],
};

export function Img({ name, alt = '', className = '', style, src }) {
  const [failed, setFailed] = useState(false);
  const base = String(name || '').replace(/-\d+$/, '');
  const [emoji, color] = FALLBACK[name] || FALLBACK[base] || (String(name).startsWith('scheme') ? ['🌲', '#d7e9d3'] : ['🌿', '#e2eddc']);
  if (failed || (!name && !src)) {
    return (
      <span className={cx(className, 'ph')} style={{ ...style, '--c': color }} role="img" aria-label={alt || name}>
        {emoji}
      </span>
    );
  }
  return <img className={className} style={style} src={src || `/img/${name}.jpg`} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

/* ---------- Brand logo ---------- */
export function Logo({ className = 'logo' }) {
  return <img className={className} src="/img/logo.png" alt="AranyaValue" />;
}

/* ---------- Buttons ---------- */
const MotionLink = motion.create(Link);

export const Button = forwardRef(function Button({ variant, size, block, icon, iconRight, to, href, children, className, ...rest }, ref) {
  const cls = cx('btn', variant, size, block && 'block', className);
  const inner = (<>{icon && <Icon name={icon} />}{children}{iconRight && <Icon name={iconRight} />}</>);
  if (to) return <MotionLink ref={ref} to={to} className={cls} whileTap={tap} {...rest}>{inner}</MotionLink>;
  if (href) return <motion.a ref={ref} href={href} className={cls} whileTap={tap} target="_blank" rel="noopener noreferrer" {...rest}>{inner}</motion.a>;
  return <motion.button ref={ref} type="button" className={cls} whileTap={tap} {...rest}>{inner}</motion.button>;
});

export const IconButton = forwardRef(function IconButton({ icon, label, className, ...rest }, ref) {
  return <motion.button ref={ref} type="button" className={cx('iconbtn', className)} aria-label={label} title={label} whileTap={tap} {...rest}><Icon name={icon} /></motion.button>;
});

/* ---------- Cards ---------- */
export const Card = forwardRef(function Card({ tone, className, children, hover, as = 'section', ...rest }, ref) {
  const Tag = motion[as] || motion.section;
  return <Tag ref={ref} className={cx('card', tone, className)} whileHover={hover ? hoverLift : undefined} {...rest}>{children}</Tag>;
});

export function SectionHead({ icon, tone, title, sub, children, size = '' }) {
  return (
    <div className="sec-head">
      {icon && <span className={cx('sec-ic', tone, size)}><Icon name={icon} /></span>}
      <div className="t"><b>{title}</b>{sub && <span>{sub}</span>}</div>
      {children}
    </div>
  );
}

/* ---------- Chips ---------- */
export function Chip({ tone = 'gray', icon, pill, children, className, ...rest }) {
  return <span className={cx('chip', tone, pill && 'pill', className)} {...rest}>{icon && <Icon name={icon} />}{children}</span>;
}

export const StatusBadge = ({ status, icon }) => <Chip tone={statusClass(status)} icon={icon}>{statusLabel(status)}</Chip>;

/* ---------- Form fields ---------- */
export function Field({ label, required, optional, hint, error, className, htmlFor, style, children }) {
  return (
    <div className={cx('field', error && 'bad', className)} style={style}>
      {label && <label htmlFor={htmlFor}>{label}{required && <> <i>*</i></>}{optional && <small> (Optional)</small>}</label>}
      {children}
      {error && <span className="errmsg" role="alert">{error}</span>}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, ...p }, ref) { return <input ref={ref} className={cx('inp', className)} {...p} />; });
export const Select = forwardRef(function Select({ className, children, ...p }, ref) { return <select ref={ref} className={cx('sel', className)} {...p}>{children}</select>; });
export const Textarea = forwardRef(function Textarea({ className, ...p }, ref) { return <textarea ref={ref} className={cx('txa', className)} {...p} />; });

export function SearchInput({ value, onChange, placeholder, label = 'Search', className, style }) {
  const id = useId();
  return (
    <div className={cx('searchbox', className)} style={style}>
      <Icon name="search" />
      <label className="sr" htmlFor={id}>{label}</label>
      <input id={id} className="inp" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options, className }) {
  const id = useId();
  return (
    <label className={cx('fgroup', className)} htmlFor={id}>
      <span>{label}</span>
      <select id={id} className="sel" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </label>
  );
}

export function Switch({ checked, onChange, label }) {
  return <label className="switch"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} /><i /></label>;
}

/* ---------- Tabs with a shared animated indicator ---------- */
export function Tabs({ tabs, value, onChange, variant = 'pill', id = 'tabs', className }) {
  return (
    <div className={cx('tabs', variant === 'line' && 'line', className)} role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" type="button" aria-selected={value === t.key} className={cx('tab', value === t.key && 'active')} onClick={() => onChange(t.key)}>
          {value === t.key && <motion.span layoutId={`${id}-ind`} className={cx('tab-ind', variant)} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          <span className="tab-label">{t.icon && <Icon name={t.icon} />}{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({ page, pages, onChange }) {
  return (
    <div className="pager">
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}><Icon name="left" /></button>
      {Array.from({ length: pages }, (_, i) => (
        <button key={i} type="button" className={page === i + 1 ? 'on' : ''} aria-current={page === i + 1 ? 'page' : undefined} onClick={() => onChange(i + 1)}>{i + 1}</button>
      ))}
      <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)}><Icon name="right" /></button>
    </div>
  );
}

/* ---------- Page states ---------- */
export function EmptyState({ icon = 'package', title, children, action }) {
  return (
    <motion.div className="empty" variants={fadeUp} initial="hidden" animate="show">
      <Icon name={icon} /><b>{title}</b>{children}{action && <div className="mt12">{action}</div>}
    </motion.div>
  );
}

export function Skeleton({ h = 16, w = '100%', r = 8, className, style }) {
  return <span className={cx('skel', className)} style={{ height: h, width: w, borderRadius: r, ...style }} aria-hidden="true" />;
}

export function LoadingState({ rows = 3, label = 'Loading' }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="sr">{label}…</span>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} h={i === 0 ? 22 : 14} w={`${100 - i * 12}%`} />)}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="empty" role="alert">
      <Icon name="alert" /><b>Something went wrong</b>
      {error?.message || 'Could not load this section.'}
      {onRetry && <div className="mt12"><Button size="sm" onClick={onRetry} icon="refresh">Try again</Button></div>}
    </div>
  );
}

/** Renders loading / error / content for a react-query result. */
export function Query({ q, rows, children, empty }) {
  if (q.isLoading) return <LoadingState rows={rows} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (empty && (!q.data || q.data.length === 0)) return empty;
  return children(q.data);
}

export function Breadcrumbs({ items }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((it, i) => (
        <span key={i} className="row" style={{ gap: 10 }}>
          {i > 0 && <Icon name="right" />}
          {it.to ? <Link to={it.to}>{it.label}</Link> : <b>{it.label}</b>}
        </span>
      ))}
    </nav>
  );
}

export function Notice({ tone, icon = 'info', small, children, className }) {
  return <div className={cx('notice', tone, small && 'sm', className)}><Icon name={icon} /><div>{children}</div></div>;
}
