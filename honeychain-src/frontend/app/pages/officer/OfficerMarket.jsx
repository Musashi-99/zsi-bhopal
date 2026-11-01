import { useState } from 'react';
import Icon from '../../components/ui/Icon';
import { Button, Card, Chip, EmptyState, ErrorState, LoadingState, Notice, Tabs } from '../../components/ui/primitives';
import { useO } from '../../api/officer';
import { useDocTitle } from '../../hooks';
import { fmtDate } from '../../lib/format';
import { PageHead, label } from './common';

const money = (a, c, u) => `${c === 'INR' ? '₹' : `${c} `}${Number(a).toLocaleString('en-IN')}${u ? ` / ${u}` : ''}`;

function Table({ cols, rows, empty }) {
  if (!rows.length) return <EmptyState icon="handshake" title={empty} />;
  return (
    <div className="tblwrap"><table className="tbl"><thead><tr>{cols.map((c) => <th key={c[0]}>{c[0]}</th>)}</tr></thead><tbody>
      {rows.map((r, i) => <tr key={r.id || i}>{cols.map((c) => <td key={c[0]} className={c[2] || ''}>{c[1](r)}</td>)}</tr>)}
    </tbody></table></div>
  );
}

export default function OfficerMarket() {
  useDocTitle('Buyer and market monitoring');
  const q = useO('/market');
  const [tab, setTab] = useState('buyers');
  if (q.isLoading) return <><PageHead title="Buyer & Market Monitoring" /><LoadingState rows={5} /></>;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const d = q.data;
  const tabs = [['buyers', 'Buyers', d.buyers.length], ['offers', 'Offers', d.offers.length], ['orders', 'Transactions', d.orders.length], ['enquiries', 'Enquiries', d.enquiries.length], ['demand', 'Demand', d.demand.length], ['districts', 'District activity', d.district_activity.length]]
    .map(([key, l, n]) => ({ key, label: `${l} (${n})` }));
  const maxD = Math.max(1, ...d.district_activity.map((x) => x.offers + x.enquiries + x.orders));
  return (
    <>
      <PageHead title="Buyer & Market Monitoring" sub="Read-only view of buyer activity. Prices appear with their own unit and context."><Button to="/market" icon="store">Open marketplace</Button></PageHead>
      <Notice tone="blue" icon="info" small className="mb12">{d.notes.join(' ')}</Notice>
      <Tabs tabs={tabs} value={tab} onChange={setTab} id="om" />
      <Card className="mt12">
        {tab === 'buyers' && <Table empty="No buyers registered" rows={d.buyers} cols={[['Buyer', (r) => <><b>{r.name}</b>{r.organisation && <div className="sub">{r.organisation}</div>}</>], ['Contact', (r) => r.email], ['Requirements', (r) => r.requirements, 'num'], ['Offers', (r) => r.offers, 'num'], ['Orders', (r) => r.orders, 'num'], ['Account', (r) => <>{r.active ? <Chip tone="green">Active</Chip> : <Chip tone="gray">Inactive</Chip>}{r.is_demo && <Chip tone="blue">demo</Chip>}</>]]} />}
        {tab === 'offers' && <Table empty="No offers recorded" rows={d.offers} cols={[['Batch', (r) => <b>{r.batch_code}</b>, 'num'], ['Product', (r) => <>{r.product_name}<div className="sub">{r.district_name}</div></>], ['Buyer', (r) => r.buyer_name], ['Offer', (r) => money(r.amount, r.currency, r.price_unit), 'num'], ['Quantity', (r) => (r.quantity ? `${r.quantity} ${r.batch_unit}` : '—'), 'num'], ['Grade', (r) => r.grade_label || '—'], ['Kind', (r) => <Chip tone={r.offer_kind === 'demonstration' ? 'blue' : 'gray'}>{label(r.offer_kind)}</Chip>], ['Status', (r) => label(r.status)], ['Date', (r) => fmtDate(r.created_at)]]} />}
        {tab === 'orders' && <Table empty="No transactions recorded" rows={d.orders} cols={[['Batch', (r) => <b>{r.batch_code}</b>, 'num'], ['Product', (r) => <>{r.product_name}<div className="sub">{r.district_name}</div></>], ['Buyer', (r) => r.buyer_name], ['Quantity', (r) => `${r.quantity} ${r.unit}`, 'num'], ['Agreed price', (r) => money(r.agreed_price, r.currency, r.price_unit), 'num'], ['Status', (r) => label(r.status)], ['Payment', (r) => label(r.payment_status)], ['Delivery', (r) => label(r.delivery_status)]]} />}
        {tab === 'enquiries' && <Table empty="No enquiries yet" rows={d.enquiries} cols={[['Batch', (r) => <b>{r.batch_code}</b>, 'num'], ['Product', (r) => r.product_name], ['Buyer', (r) => r.buyer_name], ['Message', (r) => r.message], ['Status', (r) => label(r.status)], ['Date', (r) => fmtDate(r.created_at)]]} />}
        {tab === 'demand' && <Table empty="No active buyer requirements" rows={d.demand} cols={[['Product', (r) => <b>{r.product_name}</b>], ['Active requirements', (r) => r.requirements, 'num'], ['Minimum quantity asked', (r) => `${r.min_qty_total} ${r.unit}`, 'num']]} />}
        {tab === 'districts' && (d.district_activity.length === 0 ? <EmptyState icon="chart" title="No market activity yet" /> : (
          <ul className="hbars">{d.district_activity.map((x) => (
            <li key={x.district_name}><span className="lbl">{x.district_name}</span><span className="track"><i style={{ width: `${((x.offers + x.enquiries + x.orders) / maxD) * 100}%` }} /></span><b className="num" title={`${x.offers} offers, ${x.enquiries} enquiries, ${x.orders} orders`}>{x.offers + x.enquiries + x.orders}</b></li>
          ))}</ul>
        ))}
      </Card>
      <p className="sub off-foot"><Icon name="lock" /> Buyer email addresses are masked unless you are an administrator.</p>
    </>
  );
}
