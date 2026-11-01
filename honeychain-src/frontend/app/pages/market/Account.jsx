import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useMarket } from '../../context/MarketContext';
import { useDocTitle } from '../../hooks';
import { api } from '../../lib/api';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { ENQ_STATUS, KIND_LABEL, ORDER_LABEL, ORDER_STEPS, inr, qty } from '../../lib/market';
import { post, useMyEnquiries, useMyEnquiry, useMyOrders, useMyOverview, useMySaved, useMyViewed, useStoreMeta, useStoreMutation } from '../../api/market';
import { Alert, Crumbs, DemoTag, Empty, ErrorBox, Pill, ProductCard } from '../../components/market/parts';
import { CentreCard } from './Centres';

const LINKS = [
  ['/market/account', 'Overview', 'home', null],
  ['/market/account/enquiries', 'My enquiries', 'msg', 'open_enquiries'],
  ['/market/account/orders', 'My orders', 'package', 'active_orders'],
  ['/market/account/saved', 'Saved', 'heart', null],
  ['/market/account/viewed', 'Recently viewed', 'clock', null],
  ['/market/account/verifications', 'Verification history', 'qr', null],
  ['/market/account/profile', 'Account details', 'user', null],
];

export function AccountLayout() {
  const { user, ready } = useAuth();
  const { demoLogin } = useMarket();
  const ov = useMyOverview(user?.role === 'buyer');
  if (!ready) return <div className="wrap" style={{ padding: 40 }}><span className="mk-skel" style={{ height: 180, display: 'block' }} /></div>;
  if (user?.role !== 'buyer') {
    return (
      <div className="wrap" style={{ padding: '40px 0' }}>
        <Empty icon="user" title="Buyer account" action={<div className="row" style={{ justifyContent: 'center' }}><button type="button" className="btn gold" onClick={() => demoLogin()}>Demo Buyer — one click</button><Link className="btn" to="/market/login">Sign in</Link></div>}>
          Sign in as a buyer to see enquiries, orders and saved batches. Looking and scanning a QR code do not need an account.
        </Empty>
      </div>
    );
  }
  return (
    <div className="wrap">
      <Crumbs items={[{ label: 'Marketplace', to: '/market' }, { label: 'Account' }]} />
      <div className="mk-acct">
        <nav className="mk-side" aria-label="Account">
          {user.is_demo && <div style={{ padding: '8px 14px' }}><DemoTag /></div>}
          {LINKS.map(([to, label, icon, count]) => (
            <NavLink key={to} to={to} end={to === '/market/account'}>
              <Icon name={icon} /> {label}
              {count && ov.data?.[count] > 0 ? <span className="n">{ov.data[count]}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div><Outlet /></div>
      </div>
    </div>
  );
}

export function AccountHome() {
  useDocTitle('My account');
  const { user } = useAuth();
  const q = useMyOverview();
  const d = q.data;
  const cards = d ? [
    ['/market/account/enquiries', d.enquiries, 'Enquiries', `${d.open_enquiries} open`],
    ['/market/account/orders', d.orders, 'Orders', `${d.active_orders} active`],
    ['/market/account/saved', d.saved_products + d.saved_centres, 'Saved', `${d.saved_products} products`],
    ['/market/account/verifications', d.verifications, 'Batch checks', 'IDs you looked up'],
  ] : [];
  return (
    <>
      <h1 style={{ fontSize: 28 }}>Hello, {String(user.name).replace(/\s*\(.*?\)/, '').split(' ')[0]}</h1>
      <p className="muted">Enquiries and orders on this account.</p>
      {q.isLoading ? <div className="mk-kpis mt16">{Array.from({ length: 4 }, (_, i) => <div key={i} className="mk-kpi mk-skel" style={{ height: 96 }} />)}</div>
        : q.error ? <ErrorBox error={q.error} onRetry={q.refetch} />
          : <div className="mk-kpis mt16">{cards.map(([to, n, label, hint]) => <Link key={label} className="mk-kpi" to={to}><b>{n}</b><span>{label}</span><div className="xs muted">{hint}</div></Link>)}</div>}
      {d?.awaiting_reply > 0 && <div className="mt16"><Alert tone="warning" title={`${d.awaiting_reply} seller reply waiting`}><Link className="linkbtn" to="/market/account/enquiries">Open enquiries</Link></Alert></div>}
    </>
  );
}

function StatusPill({ map, value }) {
  const s = map[value] || { label: value, tone: 'gray' };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function Enquiries() {
  useDocTitle('My enquiries');
  const q = useMyEnquiries();
  const [id, setId] = useState(null);
  const rows = q.data?.enquiries || [];
  const open = id || rows[0]?.id;
  return (
    <>
      <h1 style={{ fontSize: 26 }}>My enquiries</h1>
      <p className="muted">A request is not a sale. The collection centre accepts, declines or counters.</p>
      {q.isLoading ? <div className="mk-skel mt16" style={{ height: 180 }} /> : q.error ? <ErrorBox error={q.error} onRetry={q.refetch} /> : rows.length === 0
        ? <Empty icon="msg" title="No enquiries yet" action={<Link className="btn gold" to="/market/products">Find a batch</Link>}>Open a product and send an enquiry or a purchase request.</Empty>
        : <div className="mk-split mt16">
          <div className="mk-list">{rows.map((e) => (
            <button key={e.id} type="button" className="mk-item" onClick={() => setId(e.id)} style={{ textAlign: 'left', cursor: 'pointer', borderColor: e.id === open ? 'var(--mk-green3)' : undefined }}>
              <div className="h"><div><b>{e.product}</b><div className="xs muted">{e.id} · {KIND_LABEL[e.kind] || e.kind}</div></div><StatusPill map={ENQ_STATUS} value={e.status} /></div>
              <div className="sm">{e.quantity ? `${qty(e.quantity)} ${e.unit}` : 'Quantity not set'} · {e.batch_code}</div>
              {e.is_demo && <DemoTag />}
            </button>
          ))}</div>
          {open && <EnquiryThread id={open} />}
        </div>}
    </>
  );
}

function EnquiryThread({ id }) {
  const q = useMyEnquiry(id);
  const { toast } = useUI();
  const send = useStoreMutation((body) => post(`/my/enquiries/${id}/messages`, body));
  const act = useStoreMutation((path) => post(path));
  const [text, setText] = useState('');
  const e = q.data?.enquiry;
  if (q.isLoading) return <div className="mk-skel" style={{ height: 240 }} />;
  if (q.error) return <ErrorBox error={q.error} onRetry={q.refetch} />;
  const live = ['open', 'negotiating'].includes(e.status);
  const run = async (path, ok) => {
    try { await act.mutateAsync(path); toast(ok); } catch (err) { toast(err.message, 'err'); }
  };
  return (
    <section className="mk-panel">
      <div className="row between wrap"><h3 style={{ margin: 0 }}>{e.product}</h3>{e.is_demo && <DemoTag />}</div>
      <p className="sub"><Link to={`/market/p/${e.batch_code}`}>{e.batch_code}</Link> · {e.centre || e.district} · {fmtDateTime(e.created_at)}</p>
      <div className="row wrap">{e.quantity != null && <Pill>{qty(e.quantity)} {e.unit}</Pill>}{e.intended_use && <Pill tone="gray">{e.intended_use}</Pill>}{e.delivery_location && <Pill tone="gray">{e.delivery_location}</Pill>}</div>
      {e.counter_price != null && <div className="mt12"><Alert tone="warning" title={`Seller proposed ${inr(e.counter_price)} / ${e.unit}`}>Indicative list price was {e.indicative_price != null ? inr(e.indicative_price) : 'not set'}. Accepting creates an order. No payment is taken.</Alert></div>}
      <div className="mk-msgs mt12">
        {(e.messages || []).map((m) => (
          <div key={m.id} className={`mk-msg ${m.sender_role === 'buyer' ? 'buyer' : ''}`}><div>{m.body}</div>{m.counter_price != null && <b>{inr(m.counter_price)} / {e.unit}</b>}<small>{m.from} · {fmtDateTime(m.created_at)}</small></div>
        ))}
      </div>
      {e.status === 'negotiating' && e.counter_price != null && e.quantity && (
        <button type="button" className="btn gold mt12" disabled={act.isPending} onClick={() => run(`/my/enquiries/${e.id}/accept-counter`, 'Order created from the seller’s terms.')}>Accept {inr(e.counter_price)} / {e.unit}</button>
      )}
      {e.order_id && <p className="mt12"><Link className="btn sm" to="/market/account/orders">Order {e.order_id}</Link></p>}
      {live && (
        <form className="stack mt12" onSubmit={async (ev) => { ev.preventDefault(); if (!text.trim()) return; try { await send.mutateAsync({ body: text }); setText(''); } catch (err) { toast(err.message, 'err'); } }}>
          <textarea className="txa" value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Reply to the seller" />
          <div className="row"><button className="btn green sm" type="submit" disabled={send.isPending}>Send reply</button><button type="button" className="btn danger sm" onClick={() => run(`/my/enquiries/${e.id}/cancel`, 'Enquiry cancelled.')}>Cancel enquiry</button></div>
        </form>
      )}
    </section>
  );
}

export function Orders() {
  useDocTitle('My orders');
  const q = useMyOrders();
  const { toast } = useUI();
  const cancel = useStoreMutation((id) => post(`/my/orders/${id}/cancel`));
  const rows = q.data?.orders || [];
  return (
    <>
      <h1 style={{ fontSize: 26 }}>My orders</h1>
      <p className="muted">An order exists only after a seller accepts a quantity and a price. Payment status stays “not recorded” — this prototype does not take payment.</p>
      {q.isLoading ? <div className="mk-skel mt16" style={{ height: 160 }} /> : q.error ? <ErrorBox error={q.error} onRetry={q.refetch} /> : rows.length === 0
        ? <Empty icon="package" title="No orders yet" action={<Link className="btn gold" to="/market/products">Browse batches</Link>}>Send a purchase request. It becomes an order when the centre accepts.</Empty>
        : <div className="mk-list mt16">{rows.map((o) => {
          const step = ORDER_STEPS.indexOf(o.status);
          return (
            <article key={o.id} className="mk-item">
              <div className="h"><div><b>{o.product}</b><div className="xs muted">{o.id} · <Link to={`/market/verify/${o.batch_code}`}>{o.batch_code}</Link> · {o.centre || o.district}</div></div><div className="row">{o.is_demo && <DemoTag />}<Pill tone={o.status === 'cancelled' ? 'red' : o.status === 'delivered' ? 'green' : 'blue'}>{ORDER_LABEL[o.status] || o.status}</Pill></div></div>
              <div className="sm">{qty(o.quantity)} {o.unit} · agreed {inr(o.agreed_price)} / {o.price_unit} · indicative total {inr(o.total)}</div>
              {o.status !== 'cancelled' && <div className="mk-progress" aria-hidden="true">{ORDER_STEPS.map((s, i) => <i key={s} className={i <= step ? 'on' : ''} />)}</div>}
              {o.status !== 'cancelled' && <div className="mk-prow">{ORDER_STEPS.map((s) => <span key={s}>{ORDER_LABEL[s]}</span>)}</div>}
              <div className="row between wrap"><span className="xs muted">Payment: {o.payment_status.replaceAll('_', ' ')}. {o.payment_note}</span>
                {o.status === 'confirmed' && <button type="button" className="btn danger sm" disabled={cancel.isPending} onClick={async () => { try { await cancel.mutateAsync(o.id); toast('Order cancelled. The quantity is available again.'); } catch (err) { toast(err.message, 'err'); } }}>Cancel order</button>}
              </div>
            </article>
          );
        })}</div>}
    </>
  );
}

export function Saved() {
  useDocTitle('Saved');
  const q = useMySaved();
  const d = q.data;
  return (
    <>
      <h1 style={{ fontSize: 26 }}>Saved</h1>
      {q.isLoading ? <div className="mk-skel mt16" style={{ height: 160 }} /> : q.error ? <ErrorBox error={q.error} onRetry={q.refetch} /> : (
        <>
          <h2 className="mt16" style={{ fontSize: 18 }}>Products</h2>
          {d.products.length ? <div className="mk-grid mt12">{d.products.map((l) => <ProductCard key={l.code} l={l} />)}</div> : <p className="muted">No saved products. Use the heart on a batch.</p>}
          <h2 className="mt24" style={{ fontSize: 18 }}>Collection centres</h2>
          {d.centres.length ? <div className="mk-grid mt12">{d.centres.map((c) => <CentreCard key={c.id} c={c} />)}</div> : <p className="muted">No saved centres.</p>}
        </>
      )}
    </>
  );
}

export function Viewed() {
  useDocTitle('Recently viewed');
  const q = useMyViewed('product');
  const items = q.data?.items || [];
  return (
    <>
      <h1 style={{ fontSize: 26 }}>Recently viewed</h1>
      {q.isLoading ? <div className="mk-skel mt16" style={{ height: 140 }} /> : q.error ? <ErrorBox error={q.error} onRetry={q.refetch} /> : items.length === 0
        ? <Empty icon="clock" title="Nothing viewed yet">Open a product while signed in and it will show up here.</Empty>
        : <div className="mk-grid mt16">{items.map((l) => <ProductCard key={l.code} l={l} />)}</div>}
    </>
  );
}

export function Verifications() {
  useDocTitle('Verification history');
  const q = useMyViewed('verify');
  const items = q.data?.items || [];
  return (
    <>
      <h1 style={{ fontSize: 26 }}>Batch checks</h1>
      <p className="muted">IDs you looked up, and the status of that batch right now.</p>
      {q.isLoading ? <div className="mk-skel mt16" style={{ height: 140 }} /> : q.error ? <ErrorBox error={q.error} onRetry={q.refetch} /> : items.length === 0
        ? <Empty icon="qr" title="No checks yet" action={<Link className="btn gold" to="/market/verify">Verify a batch</Link>}>Scan or type a batch ID while signed in.</Empty>
        : <div className="mk-tablewrap mt16"><table className="mk-table"><thead><tr><th>Batch</th><th>Product</th><th>When you checked</th><th>Status now</th></tr></thead><tbody>
          {items.map((r) => <tr key={r.code + r.viewed_at}><td>{r.found ? <Link to={`/market/verify/${r.code}`}><code>{r.code}</code></Link> : <code>{r.code}</code>}</td><td>{r.product || (r.found ? '—' : 'No record')}</td><td className="muted">{fmtDateTime(r.viewed_at)}</td><td>{r.current_status ? <Pill tone={r.current_status.tone}>{r.current_status.label}</Pill> : <Pill tone="red">Not found</Pill>}</td></tr>)}
        </tbody></table></div>}
    </>
  );
}

export function AccountProfile() {
  useDocTitle('Account details');
  const { user, setUser } = useAuth();
  const { toast } = useUI();
  const meta = useStoreMeta();
  const [f, setF] = useState({ name: user.name, phone: user.phone || '', organisation: user.organisation || '', preferred_language: user.preferred_language || 'en', state_id: user.state_id || '', district_id: user.district_id || '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const districts = (meta.data?.districts || []).filter((d) => !f.state_id || d.state_id === f.state_id);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await api('/api/auth/me', { method: 'PATCH', body: f });
      setUser(d.user);
      toast('Account details saved.');
    } catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <>
      <h1 style={{ fontSize: 26 }}>Account details</h1>
      {user.is_demo && <div className="mt12"><Alert tone="demo" icon="info" title="Demo Buyer">This is the shared demonstration account. Changes here are visible to anyone else using Demo Buyer on this server.</Alert></div>}
      <form className="mk-panel mt16 stack" onSubmit={save}>
        <div className="grid2">
          <div className="field"><label htmlFor="an">Name</label><input id="an" className="inp" value={f.name} onChange={set('name')} /></div>
          <div className="field"><label htmlFor="ap">Phone</label><input id="ap" className="inp" value={f.phone} onChange={set('phone')} /></div>
          <div className="field"><label htmlFor="ao">Organisation</label><input id="ao" className="inp" value={f.organisation} onChange={set('organisation')} /></div>
          <div className="field"><label htmlFor="al">Language</label>
            <select id="al" className="sel" value={f.preferred_language} onChange={set('preferred_language')}><option value="en">English</option><option value="bn">বাংলা</option><option value="hi">हिन्दी</option></select></div>
          <div className="field"><label htmlFor="as">State</label>
            <select id="as" className="sel" value={f.state_id} onChange={(e) => setF((s) => ({ ...s, state_id: e.target.value, district_id: '' }))}><option value="">Not set</option>{(meta.data?.states || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="field"><label htmlFor="ad">District</label>
            <select id="ad" className="sel" value={f.district_id} onChange={set('district_id')}><option value="">Not set</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        </div>
        <p className="xs muted">Email {user.email} · role buyer · joined {fmtDate(user.created_at)}</p>
        <button className="btn green" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save details'}</button>
      </form>
    </>
  );
}
