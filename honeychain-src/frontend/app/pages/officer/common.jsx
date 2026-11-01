import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../../components/ui/Icon';
import { Chip } from '../../components/ui/primitives';

const STATUS = {
  pending_verification: ['Pending verification', 'assess'],
  submitted: ['Pending verification', 'assess'],
  needs_info: ['Correction requested', 'blue'],
  verified: ['Approved', 'done'],
  verified_with_limitations: ['Approved with limits', 'cond'],
  rejected: ['Rejected', 'rejected'],
  failed_checks: ['Rejected', 'rejected'],
  dispatched: ['Dispatched', 'done'],
  suspended: ['Suspended', 'rejected'],
  draft: ['Draft', 'draft'],
};
export const officerStatus = (s) => (STATUS[s] || [String(s || '').replaceAll('_', ' '), 'gray']);
export const OStatus = ({ status }) => { const [l, t] = officerStatus(status); return <Chip tone={t}>{l}</Chip>; };

export function PageHead({ title, sub, children }) {
  return (
    <div className="pagehead">
      <div><div className="eyebrow"><Icon name="shield" /> Government Officer Portal</div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}

export function Kv({ rows }) {
  return (
    <dl className="o-kv">
      {rows.filter(([, v]) => v !== undefined).map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v === null || v === '' ? '—' : v}</dd></div>
      ))}
    </dl>
  );
}

/** Accessible modal used for decisions and edit forms. */
export function Modal({ open, title, onClose, children, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-bg open" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div className={`modal o-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="row between"><h3>{title}</h3><button type="button" className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="xc" /></button></div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export const fmtQty = (q, u) => `${Number(q).toLocaleString('en-IN')} ${u || ''}`.trim();
export const label = (s) => String(s || '').replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());

/** Small form helper: returns [values, bind, set]. */
export function useForm(initial) {
  const [v, setV] = useState(initial);
  const bind = (k) => ({ value: v[k] ?? '', onChange: (e) => setV((s) => ({ ...s, [k]: e.target.value })) });
  return [v, bind, setV];
}
