import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../components/ui/Icon';
import PageHero from '../components/layout/PageHero';
import { Button, Card, Chip, EmptyState, Img, Query, Select, StatusBadge } from '../components/ui/primitives';
import { CountUp, Item, Stagger } from '../components/motion';
import { useAuth } from '../context/AuthContext';
import { useAllPassports, useBatches, useDashboard, useIntelligence } from '../api/queries';
import { useDocTitle } from '../hooks';
import { OUTCOME, STATUS_GROUPS, describeEvent, eventMeta, firstName, productImage, timeAgo } from '../lib/format';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
};

const sameMonth = (iso, offset = 0) => {
  const d = new Date(iso); const n = new Date();
  n.setMonth(n.getMonth() - offset);
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
};

export default function Dashboard() {
  useDocTitle('Dashboard');
  const { user } = useAuth();
  return user.role === 'collector' ? <CollectorDashboard /> : <GenericDashboard />;
}

function GenericDashboard() {
  const { user } = useAuth();
  const dash = useDashboard();
  return (
    <>
      <PageHero title={`${greeting()}, ${firstName(user.name)}`} sub={`Signed in as ${user.role}.`} tall />
      <Query q={dash} rows={4}>
        {(d) => (
          <Stagger className="stat-row" style={{ gridTemplateColumns: `repeat(${Math.min(d.cards?.length || 1, 5)},1fr)` }}>
            {(d.cards || []).map((c) => (
              <Item key={c.label} className="card stat"><div><small>{c.label}</small><CountUp value={c.value} /><span className="muted">{c.hint}</span></div></Item>
            ))}
          </Stagger>
        )}
      </Query>
      <Card><p className="sub" style={{ fontSize: 14 }}>The full collector workspace (batches, passports, price comparison) is available to collector accounts. Use the sidebar to browse buyer requirements and government schemes.</p></Card>
    </>
  );
}

function CollectorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dash = useDashboard();
  const batchesQ = useBatches();
  const batches = batchesQ.data || [];
  const [period, setPeriod] = useState('This Month');

  const stats = useMemo(() => {
    const by = (...s) => batches.filter((b) => s.includes(b.status)).length;
    const offers = dash.data?.cards?.find((c) => c.label === 'Open offers')?.value ?? 0;
    return [
      { icon: 'package', tone: '', label: 'Total Batches', value: batches.length, hint: `${batches.filter((b) => sameMonth(b.updated_at)).length} updated this month`, cls: 'up', to: '/batches', up: true },
      { icon: 'file', tone: 'amber', label: 'Draft Batches', value: by('draft'), hint: 'Need your attention', cls: 'warn', to: '/batches?status=draft' },
      { icon: 'clock', tone: 'blue', label: 'Awaiting Assessment', value: by('pending_verification', 'submitted', 'needs_info'), hint: 'Quality review pending', cls: 'muted', to: '/batches?status=pending_verification' },
      { icon: 'shield', tone: 'purple', label: 'Completed Passports', value: by('verified', 'verified_with_limitations', 'dispatched'), hint: 'Ready for sharing', cls: 'muted', to: '/batches?status=verified' },
      { icon: 'handshake', tone: '', label: 'Offers Received', value: offers, hint: 'Recorded in this app', cls: 'up', to: '/quality-price' },
    ];
  }, [batches, dash.data]);

  const byProduct = useMemo(() => {
    const inPeriod = batches.filter((b) => period === 'All Time' || sameMonth(b.collection_date || b.updated_at, period === 'Last Month' ? 1 : 0));
    const map = new Map();
    inPeriod.forEach((b) => map.set(b.product, (map.get(b.product) || 0) + 1));
    const colors = ['#5ea04f', '#f5a623', '#a78bfa', '#3b82f6', '#14b8a6', '#ef4444'];
    return [...map.entries()].map(([name, n], i) => ({ name, n, color: colors[i % colors.length] }));
  }, [batches, period]);

  const groups = STATUS_GROUPS.map((g) => ({ ...g, n: batches.filter((b) => g.match.includes(b.status)).length })).filter((g) => g.n > 0);
  const total = batches.length || 1;
  let acc = 0;
  const donut = groups.length ? `conic-gradient(${groups.map((g) => { const a = (acc / total) * 100; acc += g.n; return `${g.color} ${a}% ${(acc / total) * 100}%`; }).join(',')})` : '#e3e9df';

  const attention = batches.filter((b) => ['draft', 'needs_info', 'rejected', 'failed_checks', 'pending_verification'].includes(b.status)).slice(0, 4);
  const maxBar = Math.max(4, ...byProduct.map((p) => p.n));

  const focus = batches.find((b) => b.status !== 'draft') || batches[0];
  const intel = useIntelligence(focus?.id);
  const all = useAllPassports();
  const activity = useMemo(() => all.passports
    .flatMap((p) => (p.events || []).map((e) => ({ ...e, batch_code: p.batch_code, batch_id: p.id, product: p.product })))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, 5), [all.passports]);

  return (
    <>
      <PageHero title={`${greeting()}, ${firstName(user.name)} 👋`} sub="Track your forest produce, complete quality passports, compare buyer requirements and get better value for your produce." tall>
        <Button to="/batches/new" variant="primary" icon="plus" className="hero-cta" style={{ height: 46, padding: '0 24px' }}>Create New Batch</Button>
      </PageHero>

      <Stagger className="stat-row">
        {stats.map((s) => (
          <Item key={s.label}>
            <Link to={s.to} className="card stat">
              <span className={`sec-ic ${s.tone}`}><Icon name={s.icon} /></span>
              <div><small>{s.label}</small><CountUp value={s.value} /><span className={s.cls}>{s.up && <Icon name="arrowup" />} {s.hint}</span></div>
            </Link>
          </Item>
        ))}
      </Stagger>

      <div className="dash-grid">
        <div className="dash-left">
          <div className="two">
            <Card>
              <div className="row between"><div><h2>Batch Overview</h2><p className="sub">Your batches by product type</p></div>
                <Select style={{ width: 140, height: 36 }} aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)}><option>This Month</option><option>Last Month</option><option>All Time</option></Select></div>
              {byProduct.length === 0 ? <EmptyState icon="chart" title="No batches in this period" /> : (
                <>
                  <div className="bars" aria-label="Batches by product type">
                    {byProduct.map((p, i) => (
                      <div className="b" key={p.name}><em>{p.n}</em>
                        <motion.i style={{ background: p.color }} initial={{ height: 0 }} animate={{ height: `${(p.n / maxBar) * 92}%` }} transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }} /></div>
                    ))}
                  </div>
                  <div className="bar-labels">{byProduct.map((p) => <span key={p.name}>{p.name}</span>)}</div>
                </>
              )}
            </Card>
            <Card>
              <h2>Batch Status</h2>
              <div className="row mt16" style={{ gap: 22 }}>
                <motion.div className="donut" role="img" aria-label="Batch status distribution" style={{ background: donut }} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
                  <div><span><CountUp value={batches.length} /><small>Total Batches</small></span></div>
                </motion.div>
                <div className="legend">{groups.map((g) => <div key={g.key}><span className="dot" style={{ background: g.color }} />{g.key}<b>{g.n}</b></div>)}</div>
              </div>
            </Card>
          </div>

          <Card>
            <div className="row between"><div className="row"><span className="sec-ic sm red"><Icon name="bell" /></span><h2 style={{ fontSize: 16 }}>Batches Needing Your Attention</h2></div><Link className="link" to="/batches">View All</Link></div>
            <Query q={batchesQ} rows={3} empty={<EmptyState icon="check" title="No batches yet">Create your first batch to get started.</EmptyState>}>
              {() => attention.length === 0 ? <EmptyState icon="check" title="You are all caught up" /> : (
                <Stagger className="mt8">
                  {attention.map((b) => {
                    const rejected = ['rejected', 'failed_checks'].includes(b.status);
                    const note = b.status === 'draft' ? 'Complete collection details' : rejected ? 'Review rejection reason' : b.status === 'needs_info' ? 'More information requested' : 'Quality assessment pending';
                    const to = b.status === 'draft' ? `/batches/${b.id}/edit` : rejected ? `/rejections/${b.id}` : `/passport/${b.id}`;
                    return (
                      <Item key={b.id} className="att-row">
                        <Img name={productImage(b.product)} className="thumb" alt="" />
                        <span title={b.batch_code}>{b.batch_code.replace('AV-WB-', '')}</span><span>{b.product}</span><StatusBadge status={b.status} /><span>{note}</span>
                        <Button size="sm" variant="outline-g" to={to}>{b.status === 'draft' ? 'Continue' : 'View'}</Button><Icon name="right" />
                      </Item>
                    );
                  })}
                </Stagger>
              )}
            </Query>
          </Card>

          <div className="grid dash-pair">
            <Card>
              <div className="row between"><h2 style={{ fontSize: 16 }}>Recently Updated Batches</h2><Link className="link" to="/batches">View All</Link></div>
              <div className="tblwrap mt12">
                <table className="tbl rows"><thead><tr><th>Batch ID</th><th>Product</th><th>Quantity</th><th>Status</th><th>Last Updated</th><th /></tr></thead>
                  <tbody>
                    {batches.slice(0, 5).map((b) => (
                      <tr key={b.id} tabIndex={0} onClick={() => navigate(`/passport/${b.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/passport/${b.id}`)}>
                        <td style={{ whiteSpace: 'nowrap' }}>{b.batch_code.replace('AV-WB-', '')}</td><td><span className="row"><Img name={productImage(b.product)} className="thumb" alt="" />{b.product}</span></td>
                        <td>{b.quantity} {b.unit}</td><td><StatusBadge status={b.status} /></td><td style={{ whiteSpace: 'nowrap' }}>{timeAgo(b.updated_at)}</td><td><Icon name="right" /></td>
                      </tr>
                    ))}
                  </tbody></table>
              </div>
            </Card>

            <Card>
              <div className="row between"><div className="row"><span className="sec-ic sm"><Icon name="bulb" /></span><h2 style={{ fontSize: 16 }}>Quality-to-Price Insight</h2></div><Link className="link" to={focus ? `/quality-price/${focus.id}` : '/quality-price'}>View Details</Link></div>
              {!focus ? <EmptyState icon="chart" title="No batch to compare yet" /> : (
                <>
                  <div className="row mt12" style={{ gap: 12 }}><Img name={productImage(focus.product)} alt={focus.product} style={{ width: 82, height: 64, borderRadius: 8, objectFit: 'cover' }} />
                    <div><b style={{ fontSize: 15 }}>{focus.product} ({focus.batch_code.replace('AV-WB-', '')})</b><div className="sub" style={{ color: 'var(--ink2)', marginTop: 3 }}>Quantity: {focus.quantity} {focus.unit}</div></div></div>
                  <Query q={intel} rows={3}>
                    {(d) => {
                      const rows = d.buyer_matches || [];
                      return rows.length === 0 ? <p className="sub mt12">No buyer requirement is stored for this product yet.</p> : (
                        <div className="tblwrap mt12"><table className="tbl"><thead><tr><th>Buyer</th><th>Reference (₹/{rows[0].reference_price?.unit || 'unit'})</th><th>Status</th></tr></thead>
                          <tbody>{rows.slice(0, 4).map((m) => { const o = OUTCOME[m.match] || OUTCOME.insufficient_evidence; return (
                            <tr key={m.requirement_id}><td><span className="row"><Icon name="leaf" className="up" />{m.organisation || m.buyer_name}</span></td><td>{m.reference_price?.amount ?? '-'}</td><td><Chip tone={m.match === 'eligible' ? 'elig' : m.match === 'conditional' ? 'cond' : m.match === 'not_eligible' ? 'rejected' : 'unk'}>● {o.label}</Chip></td></tr>); })}</tbody></table></div>
                      );
                    }}
                  </Query>
                  <div className="notice blue sm mt12"><Icon name="bulb" style={{ color: 'var(--amber)' }} /><span>Differences come from each buyer's own requirements. {focus.is_demo ? 'These figures are demonstration data, not real offers.' : ''} <Link className="link" to={`/quality-price/${focus.id}`}>View full analysis →</Link></span></div>
                </>
              )}
            </Card>
          </div>
        </div>

        <aside className="dash-left" style={{ alignContent: 'start' }}>
          <Card className="promo">
            <div className="img" />
            <div className="body"><h3>Forest Produce<br />Quality-to-Price Passport</h3>
              <p style={{ margin: '10px 0', color: 'var(--ink2)' }}>Document your produce journey, compare buyer requirements and make informed decisions.</p>
              <Button to="/batches/new" variant="primary" block icon="plus" iconRight="arrow">Create New Batch</Button></div>
          </Card>
          <Card>
            <div className="row between"><h2 style={{ fontSize: 16 }}>Recent Activity</h2><Link className="link" to="/audit">View All</Link></div>
            <div className="mt8">
              {activity.length === 0 && <p className="sub">No recorded events yet.</p>}
              {activity.map((e) => { const [, tone, icon] = eventMeta(e.event_type); return (
                <div className="act" key={e.id}><span className={`sec-ic ${tone === 'green' ? '' : tone === 'red' ? 'red' : 'blue'}`}><Icon name={icon} /></span><div>{describeEvent(e)} · {e.batch_code.replace('AV-WB-', '')}<small>{timeAgo(e.timestamp)}</small></div></div>); })}
            </div>
          </Card>
          <div>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Quick Links</h2>
            <div className="quick">
              {[['/batches/new', 'plus', '', 'Create Batch', 'Record a new collection'], ['/batches', 'package', '', 'My Batches', 'View and manage'], ['/passport', 'file', '', 'Quality Passport', 'View and share passport'], ['/post-harvest', 'leaf', '', 'Post-Harvest Assistant', 'Get handling guidance'], ['/rejections', 'alert', 'red', 'Rejection & Recovery', 'Track rejections and next steps'], ['/verify', 'qr', '', 'QR Verify', 'Scan and verify batch ID']].map(([to, icon, tone, t, s]) => (
                <Link key={to} to={to}><span className={`sec-ic sm ${tone}`}><Icon name={icon} /></span><div><b>{t}</b><small>{s}</small></div></Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
