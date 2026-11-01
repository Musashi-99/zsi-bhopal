import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../ui/Icon';
import { useMarket } from '../../context/MarketContext';
import { useUI } from '../../context/UIContext';
import { post, useStoreMutation } from '../../api/market';
import { inr, qty } from '../../lib/market';
import { cx, Pill } from './parts';

const KINDS = [
  ['enquiry', 'Question', 'Ask about quality, packing or price'],
  ['bulk_enquiry', 'Bulk enquiry', 'Ongoing or large supply'],
  ['purchase_request', 'Purchase request', 'Ask to buy a quantity now'],
];

export default function EnquiryModal() {
  const { enquiry, closeEnquiry, removeFromBasket } = useMarket();
  return (
    <AnimatePresence>
      {enquiry && <Form key={enquiry.card.code} item={enquiry} onClose={closeEnquiry} onSent={() => { if (enquiry.fromBasket) removeFromBasket(enquiry.card.code); }} />}
    </AnimatePresence>
  );
}

function Form({ item, onClose, onSent }) {
  const { card } = item;
  const { toast } = useUI();
  const navigate = useNavigate();
  const first = useRef(null);
  const [kind, setKind] = useState(item.kind || 'enquiry');
  const [f, setF] = useState({ quantity: item.quantity ?? card.min_order_qty ?? '', intended_use: '', delivery_location: '', message: '' });
  const [err, setErr] = useState({});
  const send = useStoreMutation((body) => post('/enquiries', body));

  useEffect(() => {
    first.current?.focus();
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const q = f.quantity === '' ? null : Number(f.quantity);
  const total = q && card.price ? q * card.price.amount : null;

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (kind === 'purchase_request') {
      if (!q || q <= 0) next.quantity = 'Enter the quantity you want to buy.';
      else if (q > card.available_qty) next.quantity = `Only ${qty(card.available_qty)} ${card.unit} is available.`;
      else if (card.min_order_qty && q < card.min_order_qty) next.quantity = `Minimum order is ${qty(card.min_order_qty)} ${card.unit}.`;
    } else if (q !== null && (Number.isNaN(q) || q <= 0)) next.quantity = 'Enter a quantity greater than zero.';
    if (!f.intended_use.trim()) next.intended_use = 'Tell the seller what you will use it for.';
    if (kind !== 'enquiry' && !f.delivery_location.trim()) next.delivery_location = 'Add a delivery location.';
    if (kind === 'enquiry' && !f.message.trim() && q === null) next.message = 'Write a message or enter a quantity.';
    setErr(next);
    if (Object.keys(next).length) return;
    try {
      await send.mutateAsync({ batch_code: card.code, kind, quantity: q, intended_use: f.intended_use, delivery_location: f.delivery_location, message: f.message });
      toast('Enquiry sent to the collection centre.');
      onSent();
      onClose();
      navigate('/market/account/enquiries');
    } catch (ex) { setErr({ form: ex.message }); }
  };

  return (
    <motion.div className="mk-modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.form className="mk-modal" role="dialog" aria-modal="true" aria-labelledby="enq-t" onSubmit={submit} noValidate
        initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.25 }}>
        <header>
          <div><h2 id="enq-t">Send enquiry</h2><div className="muted sm">{card.title} · <code>{card.code}</code> · {card.district?.name || card.district || ''}</div></div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        <div className="bd">
          <div className="mk-seg" role="radiogroup" aria-label="Enquiry type">
            {KINDS.map(([id, label, sub]) => <button key={id} type="button" role="radio" aria-checked={kind === id} className={cx(kind === id && 'on')} onClick={() => setKind(id)}>{label}<small>{sub}</small></button>)}
          </div>
          <div className="grid2">
            <div className="field"><label htmlFor="e-q">Quantity ({card.unit}){kind === 'purchase_request' ? ' *' : ''}</label>
              <input ref={first} id="e-q" className="inp" inputMode="decimal" value={f.quantity} onChange={set('quantity')} placeholder={`Up to ${qty(card.available_qty)}`} />
              {err.quantity ? <span className="err" role="alert">{err.quantity}</span> : <span className="hint">{qty(card.available_qty)} {card.unit} available{card.min_order_qty ? ` · min ${qty(card.min_order_qty)}` : ''}</span>}</div>
            <div className="field"><label htmlFor="e-u">Intended use *</label>
              <input id="e-u" className="inp" value={f.intended_use} onChange={set('intended_use')} placeholder="e.g. Value-added processing" maxLength={200} />
              {err.intended_use && <span className="err" role="alert">{err.intended_use}</span>}</div>
          </div>
          <div className="field"><label htmlFor="e-d">Delivery location{kind !== 'enquiry' ? ' *' : ''}</label>
            <input id="e-d" className="inp" value={f.delivery_location} onChange={set('delivery_location')} placeholder="Town / district, or “collect from centre”" maxLength={200} />
            {err.delivery_location && <span className="err" role="alert">{err.delivery_location}</span>}</div>
          <div className="field"><label htmlFor="e-m">Message to the seller</label>
            <textarea id="e-m" className="txa" value={f.message} onChange={set('message')} maxLength={2000} placeholder="Packing needs, documents, quality limits, delivery date…" />
            {err.message && <span className="err" role="alert">{err.message}</span>}</div>
          {total != null && (
            <div className="mk-alert info"><Icon name="tag" /><div><b>Indicative value: {inr(total)}</b>Based on {inr(card.price.amount)} / {card.price.unit}. {card.price.illustrative ? 'This is an illustrative demo figure. ' : ''}The seller may accept, decline or counter. This is not a final price and no payment is taken.</div></div>
          )}
          {err.form && <div className="mk-alert danger" role="alert"><Icon name="alert" /><div>{err.form}</div></div>}
        </div>
        <footer>
          <Pill tone="gray" icon="lock">No payment is processed in this prototype</Pill>
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn gold" disabled={send.isPending}>{send.isPending ? 'Sending…' : kind === 'purchase_request' ? 'Send purchase request' : 'Send enquiry'}</button>
        </footer>
      </motion.form>
    </motion.div>
  );
}
