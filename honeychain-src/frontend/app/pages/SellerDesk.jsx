import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon';
import { Button, Card, Chip, EmptyState, ErrorState, Field, Input, LoadingState, Textarea } from '../components/ui/primitives';
import { useUI } from '../context/UIContext';
import { useDocTitle } from '../hooks';
import { fmtDateTime } from '../lib/format';
import { inr, qty } from '../lib/market';
import { patch, post, put, useSellerEnquiries, useSellerListings, useSellerOrders, useStoreMutation } from '../api/market';

const TABS = [['enquiries', 'Enquiries'], ['orders', 'Orders'], ['listings', 'My listings']];
const NEXT = {
  confirmed: [['packed', 'Mark packed'], ['cancelled', 'Cancel order']],
  packed: [['dispatched', 'Mark dispatched'], ['cancelled', 'Cancel order']],
  dispatched: [['delivered', 'Mark delivered']],
};

export default function SellerDesk() {
  useDocTitle('Marketplace desk');
  const [tab, setTab] = useState('enquiries');
  return (
    <>
      <div className="pagehead">
        <div>
          <div className="eyebrow"><Icon name="store" /> Producer portal</div>
          <h1>Marketplace desk</h1>
          <p>Enquiries from buyers land here. Accepting one creates an order on the shared batch. Prices you set are indicative, not a completed sale.</p>
        </div>
        <div className="actions"><Button to="/market" icon="ext">View marketplace</Button></div>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} type="button" className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div className="mt16">{tab === 'enquiries' ? <Enquiries /> : tab === 'orders' ? <Orders /> : <Listings />}</div>
    </>
  );
}

function Enquiries() {
  const q = useSellerEnquiries();
  const { toast } = useUI();
  const respond = useStoreMutation(({ id, body }) => post(`/seller/enquiries/${id}/respond`, body));
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({ action: 'negotiate', message: '', counter_price: '', agreed_price: '' });
  if (q.isLoading) return <LoadingState rows={4} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const rows = q.data.enquiries;
  if (!rows.length) return <Card><EmptyState icon="msg" title="No enquiries yet" /></Card>;
  const send = async (e, id) => {
    e.preventDefault();
    const body = { action: form.action, message: form.message };
    if (form.action === 'negotiate' && form.counter_price !== '') body.counter_price = Number(form.counter_price);
    if (form.action === 'accept' && form.agreed_price !== '') body.agreed_price = Number(form.agreed_price);
    try {
      const out = await respond.mutateAsync({ id, body });
      toast(out.order_id ? `Order ${out.order_id} created.` : 'Reply sent to the buyer.');
      setOpen(null);
    } catch (err) { toast(err.message, 'err'); }
  };
  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((e) => (
        <Card key={e.id}>
          <div className="row between wrap">
            <div><b>{e.product}</b> <span className="sub">{e.batch_code} · {e.centre || e.district}</span>
              <div className="sub">{e.buyer?.name} · {KIND_LABEL(e.kind)} · {e.quantity ? `${qty(e.quantity)} ${e.unit}` : 'no quantity'} · {fmtDateTime(e.created_at)}</div>
            </div>
            <div className="row"><Chip tone={e.status === 'open' ? 'blue' : e.status === 'negotiating' ? 'amber' : e.status === 'accepted' ? 'green' : 'gray'}>{e.status}</Chip></div>
          </div>
          {e.intended_use && <p className="sub mt8">Use: {e.intended_use}{e.delivery_location ? ` · Deliver to ${e.delivery_location}` : ''}</p>}
          <ul className="sub" style={{ margin: '8px 0 0', paddingLeft: 18 }}>{(e.messages || []).slice(-3).map((m) => <li key={m.id}><b>{m.from}:</b> {m.body}{m.counter_price != null ? ` (${inr(m.counter_price)})` : ''}</li>)}</ul>
          {e.batch_status && <p className="sub mt8">Batch now: {e.batch_status.label}. Available {e.available_qty} {e.unit}. <Link className="link" to={`/market/verify/${e.batch_code}`}>Public record</Link></p>}
          {['open', 'negotiating'].includes(e.status) && (
            open === e.id ? (
              <form className="mt12" onSubmit={(ev) => send(ev, e.id)} style={{ display: 'grid', gap: 10 }}>
                <div className="row wrap">
                  {[['negotiate', 'Reply / counter'], ['accept', 'Accept as order'], ['reject', 'Decline']].map(([k, l]) => (
                    <button key={k} type="button" className={`btn sm ${form.action === k ? 'primary' : ''}`} onClick={() => setForm((s) => ({ ...s, action: k }))}>{l}</button>
                  ))}
                </div>
                {form.action === 'negotiate' && <Field label="Counter price (₹ per unit)" optional><Input inputMode="decimal" value={form.counter_price} onChange={(ev) => setForm((s) => ({ ...s, counter_price: ev.target.value }))} /></Field>}
                {form.action === 'accept' && <Field label="Agreed price (₹ per unit)" hint={e.indicative_price ? `Listed indicative price is ${inr(e.indicative_price)}` : 'No indicative price is listed.'}><Input inputMode="decimal" value={form.agreed_price} onChange={(ev) => setForm((s) => ({ ...s, agreed_price: ev.target.value }))} placeholder={e.counter_price || e.indicative_price || ''} /></Field>}
                <Field label={form.action === 'reject' ? 'Reason for the buyer' : 'Message'}><Textarea value={form.message} onChange={(ev) => setForm((s) => ({ ...s, message: ev.target.value }))} /></Field>
                <div className="row"><Button variant="primary" type="submit" disabled={respond.isPending}>{respond.isPending ? 'Sending…' : 'Send'}</Button><Button type="button" onClick={() => setOpen(null)}>Close</Button></div>
              </form>
            ) : <Button className="mt12" icon="msg" onClick={() => { setOpen(e.id); setForm({ action: e.quantity ? 'accept' : 'negotiate', message: '', counter_price: '', agreed_price: e.indicative_price || '' }); }}>Respond</Button>
          )}
          {e.order_id && <p className="mt8"><Chip tone="green">Order {e.order_id}</Chip></p>}
        </Card>
      ))}
    </div>
  );
}

const KIND_LABEL = (k) => ({ enquiry: 'Enquiry', bulk_enquiry: 'Bulk enquiry', purchase_request: 'Purchase request' }[k] || k);

function Orders() {
  const q = useSellerOrders();
  const { toast } = useUI();
  const move = useStoreMutation(({ id, status }) => patch(`/seller/orders/${id}`, { status }));
  if (q.isLoading) return <LoadingState rows={3} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data.orders.length) return <Card><EmptyState icon="package" title="No orders yet" /></Card>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {q.data.orders.map((o) => (
        <Card key={o.id}>
          <div className="row between wrap">
            <div><b>{o.id}</b> · {o.product} · {o.batch_code}<div className="sub">{o.buyer} · {qty(o.quantity)} {o.unit} at {inr(o.agreed_price)} / {o.price_unit}</div></div>
            <Chip tone={o.status === 'cancelled' ? 'red' : 'green'}>{o.status}</Chip>
          </div>
          <p className="sub mt8">{o.payment_note}</p>
          <div className="row wrap mt8">
            {(NEXT[o.status] || []).map(([status, label]) => (
              <Button key={status} size="sm" variant={status === 'cancelled' ? 'danger' : 'primary'} disabled={move.isPending} onClick={async () => { try { await move.mutateAsync({ id: o.id, status }); toast(`Order is now ${status}.`); } catch (err) { toast(err.message, 'err'); } }}>{label}</Button>
            ))}
            <Button size="sm" to={`/market/verify/${o.batch_code}`} icon="qr">Batch record</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Listings() {
  const q = useSellerListings();
  const { toast } = useUI();
  const save = useStoreMutation(({ code, body }) => put(`/seller/listings/${code}`, body));
  const [edit, setEdit] = useState(null);
  if (q.isLoading) return <LoadingState rows={4} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data.listings.length) return <Card><EmptyState icon="package" title="No submitted batches" action={<Button to="/batches/new" variant="primary">Create a batch</Button>} /></Card>;
  const on = q.data.listings.find((l) => l.batch_code === edit);
  return (
    <div className="two" style={{ alignItems: 'start' }}>
      <Card>
        <div className="tblwrap"><table className="tbl rows"><thead><tr><th>Batch</th><th>Product</th><th>Available</th><th>Indicative price</th><th>Listed</th><th></th></tr></thead><tbody>
          {q.data.listings.map((l) => (
            <tr key={l.batch_code}>
              <td className="num">{l.batch_code}</td>
              <td>{l.product}<div className="sub">{l.district} · {l.status.label}</div></td>
              <td className="num">{qty(l.available_qty)} {l.unit}</td>
              <td className="num">{l.indicative_price != null ? `${inr(l.indicative_price)} / ${l.price_unit}` : '—'}</td>
              <td>{l.listed ? <Chip tone="green">Listed</Chip> : <Chip>Hidden</Chip>}</td>
              <td><button type="button" className="link" onClick={() => setEdit(l.batch_code)}>Price</button></td>
            </tr>
          ))}
        </tbody></table></div>
      </Card>
      {on && <PriceForm key={on.batch_code} row={on} busy={save.isPending} onSave={async (body) => { try { await save.mutateAsync({ code: on.batch_code, body }); toast(body.listed === false ? 'Hidden from the marketplace.' : 'Listing updated.'); } catch (err) { toast(err.message, 'err'); } }} />}
    </div>
  );
}

function PriceForm({ row, busy, onSave }) {
  const [f, setF] = useState({ indicative_price: row.indicative_price ?? '', min_order_qty: row.min_order_qty ?? '', packaging: row.packaging || '', description: row.description || '', listed: row.listed });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Card>
      <h3>Price {row.batch_code}</h3>
      <p className="sub">Buyers see this as an indicative price, not a final price. Listing the batch also makes its public passport visible.</p>
      <form className="stack mt12" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={(e) => { e.preventDefault(); onSave({ ...f, listed: f.listed }); }}>
        <Field label={`Indicative price (₹ / ${row.unit})`}><Input inputMode="decimal" value={f.indicative_price} onChange={set('indicative_price')} /></Field>
        <Field label="Minimum order"><Input inputMode="decimal" value={f.min_order_qty} onChange={set('min_order_qty')} /></Field>
        <Field label="Packaging" optional><Input value={f.packaging} onChange={set('packaging')} /></Field>
        <Field label="Note for buyers" optional><Textarea value={f.description} onChange={set('description')} /></Field>
        <label className="row"><input type="checkbox" checked={!!f.listed} onChange={(e) => setF((s) => ({ ...s, listed: e.target.checked }))} /> Show on the marketplace</label>
        <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save listing'}</Button>
      </form>
    </Card>
  );
}
