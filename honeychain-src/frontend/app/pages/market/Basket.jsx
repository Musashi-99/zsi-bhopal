import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useDocTitle } from '../../hooks';
import { useMarket } from '../../context/MarketContext';
import { inr, qty } from '../../lib/market';
import { Crumbs, Empty, MImg } from '../../components/market/parts';

export default function Basket() {
  useDocTitle('Enquiry basket');
  const { basket, setBasketQty, removeFromBasket, openEnquiry, clearBasket } = useMarket();
  const [use, setUse] = useState('');
  const [place, setPlace] = useState('');

  const indicative = basket.reduce((s, i) => s + (i.price?.amount ? i.price.amount * Number(i.quantity || 0) : 0), 0);

  return (
    <>
      <div className="mk-pagehead"><div className="wrap">
        <Crumbs items={[{ label: 'Marketplace', to: '/market' }, { label: 'Enquiry basket' }]} />
        <h1>Enquiry basket</h1>
        <p>This holds batches you want to ask about. Sending a request does not reserve stock and does not take payment. Stock is reserved only when a seller accepts.</p>
      </div></div>
      <div className="wrap" style={{ paddingTop: 24 }}>
        {basket.length === 0 ? (
          <Empty icon="cart" title="Your basket is empty" action={<Link className="btn gold" to="/market/products">Browse forest produce</Link>}>Add a batch from its product page, then send one enquiry or several.</Empty>
        ) : (
          <div className="mk-split">
            <div className="stack">
              {basket.map((i) => (
                <article key={i.code} className="mk-item" style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                  <Link to={`/market/p/${i.code}`} style={{ width: 96, height: 96, borderRadius: 12, overflow: 'hidden', flex: 'none' }}><MImg src={i.image} alt="" slug={i.slug} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></Link>
                  <div className="grow">
                    <b>{i.title}</b>
                    <div className="sm muted">{i.code} · {i.district?.name}{i.centre?.name ? ` · ${i.centre.name}` : ''}</div>
                    <div className="row mt8">
                      <div className="mk-qty" style={{ maxWidth: 180 }}>
                        <button type="button" aria-label="Decrease" onClick={() => setBasketQty(i.code, Math.max(1, Number(i.quantity) - 1))}>−</button>
                        <input aria-label="Quantity" value={i.quantity} onChange={(e) => setBasketQty(i.code, e.target.value.replace(/[^\d.]/g, ''))} />
                        <span>{i.unit}</span>
                      </div>
                      <span className="sm">{i.price ? `${inr(i.price.amount)} / ${i.price.unit}` : 'Price on request'}{i.price?.illustrative ? ' · illustrative' : ''}</span>
                    </div>
                  </div>
                  <div className="stack" style={{ alignItems: 'flex-end' }}>
                    <button type="button" className="btn gold sm" onClick={() => openEnquiry({ ...i, min_order_qty: i.min_order_qty, available_qty: i.available_qty }, { kind: 'purchase_request', quantity: i.quantity, fromBasket: true })}>Request this</button>
                    <button type="button" className="linkbtn xs" onClick={() => removeFromBasket(i.code)}>Remove</button>
                  </div>
                </article>
              ))}
            </div>
            <aside className="mk-buy">
              <h2 style={{ fontSize: 20 }}>Send them one by one</h2>
              <p className="sm muted">Each batch is a separate enquiry to its collection centre. Use the button on a row, and the quantity in the basket is filled in for you.</p>
              <div className="field"><label htmlFor="bu">Intended use you can paste</label><input id="bu" className="inp" value={use} onChange={(e) => setUse(e.target.value)} placeholder="e.g. Leaf-plate unit" onFocus={(e) => e.target.select()} /></div>
              <div className="field"><label htmlFor="bd">Delivery location</label><input id="bd" className="inp" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Town or “collect from centre”" /></div>
              <p className="xs muted">Copy these into the enquiry form. They are not sent until you confirm each request.</p>
              {indicative > 0 && <div className="mk-alert info"><Icon name="tag" /><div><b>Indicative total {inr(indicative)}</b>Illustrative where marked. Not a bill, and not payable here.</div></div>}
              <button type="button" className="btn block" onClick={clearBasket}>Clear basket</button>
              <Link className="btn block" to="/market/products">Add more batches</Link>
            </aside>
          </div>
        )}
        {basket.length > 0 && <p className="xs muted mt16">{qty(basket.length)} {basket.length === 1 ? 'batch' : 'batches'} saved on this device until you send or remove them.</p>}
      </div>
    </>
  );
}
