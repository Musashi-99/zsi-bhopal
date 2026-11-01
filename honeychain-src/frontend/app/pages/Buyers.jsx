import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../components/ui/Icon';
import PageHero from '../components/layout/PageHero';
import { Button, Card, Chip, EmptyState, FilterSelect, Img, Notice, Query, SearchInput, Tabs } from '../components/ui/primitives';
import { Item, Stagger } from '../components/motion';
import { useRequirements } from '../api/queries';
import { useDocTitle } from '../hooks';
import { fmtDate, productImage } from '../lib/format';
import { specText } from './QualityPrice';

const TAG = ['h', 'm', 's', 'f', 'n', 'r', 'e'];

/** Group raw requirement rows into one profile per buyer. */
function groupBuyers(rows = []) {
  const map = new Map();
  rows.forEach((r) => {
    const g = map.get(r.buyer_user_id) || { id: r.buyer_user_id, name: r.organisation || r.buyer_name, demo: false, reqs: [], updated: r.created_at };
    g.reqs.push(r);
    g.demo = g.demo || !!r.is_demo;
    if (r.created_at > g.updated) g.updated = r.created_at;
    map.set(r.buyer_user_id, g);
  });
  return [...map.values()].map((g) => ({ ...g, produce: [...new Set(g.reqs.map((r) => r.product_name))] }));
}

const reqSummary = (r) => (r.specifications.length
  ? r.specifications.map((s) => `${s.parameter} ${specText(s)}`).join(', ')
  : 'No numeric limits stated') + (r.packaging ? `. Packaging: ${r.packaging}` : '');

export default function Buyers() {
  useDocTitle('Buyers');
  const q = useRequirements();
  const [params] = useSearchParams();
  const [text, setText] = useState('');
  const [cat, setCat] = useState('All Categories');
  const [state, setState] = useState('All');
  const [kind, setKind] = useState('All');
  const [sel, setSel] = useState(params.get('buyer'));
  const [tab, setTab] = useState('ov');

  const buyers = useMemo(() => groupBuyers(q.data), [q.data]);
  const cats = useMemo(() => ['All Categories', ...new Set(buyers.flatMap((b) => b.produce))], [buyers]);
  const list = buyers.filter((b) => (!text || (b.name + b.produce.join()).toLowerCase().includes(text.toLowerCase()))
    && (cat === 'All Categories' || b.produce.includes(cat))
    && (state === 'All' || b.reqs.some((r) => (state === 'Active' ? !r.expired : r.expired)))
    && (kind === 'All' || (kind === 'Demonstration' ? b.demo : !b.demo)));
  const current = list.find((b) => b.id === sel) || list[0];
  useEffect(() => { setTab('ov'); }, [current?.id]);
  const clear = () => { setText(''); setCat('All Categories'); setState('All'); setKind('All'); };

  return (
    <>
      <PageHero title="Buyers" sub="Explore buyer requirements and find potential matches for your produce." />
      <div className="row wrap mb12" style={{ alignItems: 'flex-end' }}>
        <SearchInput value={text} onChange={setText} placeholder="Search by buyer name or produce type…" label="Search buyers" style={{ flex: 2 }} />
        <FilterSelect label="Produce Category" value={cat} onChange={setCat} options={cats} />
        <FilterSelect label="Requirement status" value={state} onChange={setState} options={['All', 'Active', 'Expired']} />
        <FilterSelect label="Data type" value={kind} onChange={setKind} options={['All', 'Demonstration', 'Recorded']} />
        <Button onClick={clear} style={{ height: 44, padding: '0 24px' }}>Clear Filters</Button>
      </div>

      <Query q={q} rows={6}>
        {() => (
          <div className="buy-grid">
            <div>
              <Notice className="mb12" icon="leaf"><b>Showing buyer requirement data stored in this app</b>Some entries are demonstration data. Please verify the latest information and requirements directly with buyers.</Notice>
              {list.length === 0 ? <Card><EmptyState icon="users" title="No buyers match your filters" action={<Button onClick={clear}>Clear Filters</Button>} /></Card> : (
                <Stagger className="bcards" key={list.map((b) => b.id).join()}>
                  {list.map((b) => (
                    <Item key={b.id}>
                      <motion.article className={`bcard ${current?.id === b.id ? 'picked' : ''}`} whileHover={{ y: -2 }} tabIndex={0} role="button" aria-label={b.name}
                        onClick={() => setSel(b.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSel(b.id))}>
                        <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
                          <span className="blogo"><Icon name="leaf" /></span>
                          <div><h3>{b.name}</h3> {b.demo && <Chip tone="gray" style={{ marginLeft: 4, fontSize: 11.5 }}>Demonstration</Chip>}
                            <div className="meta"><Icon name="building" />{b.reqs.length} requirement{b.reqs.length > 1 ? 's' : ''}</div><div className="meta"><Icon name="clock" />Updated {fmtDate(b.updated)}</div></div>
                        </div>
                        <div className="mt8"><b style={{ fontSize: 13 }}>Produces</b><div className="row wrap mt8" style={{ gap: 6 }}>{b.produce.map((x, i) => <span key={x} className={`tag ${TAG[i % TAG.length]}`}>{x}</span>)}</div></div>
                        <div className="mt8"><b style={{ fontSize: 13 }}>Key Requirements</b><div className="keyreq">{reqSummary(b.reqs[0])}</div></div>
                        <div style={{ textAlign: 'right', marginTop: 8 }}><Button size="sm" iconRight="arrow" onClick={(e) => { e.stopPropagation(); setSel(b.id); }}>View Details</Button></div>
                      </motion.article>
                    </Item>
                  ))}
                </Stagger>
              )}
            </div>

            <Card style={{ position: 'sticky', top: 78 }}>
              <AnimatePresence mode="wait">
                {current ? (
                  <motion.div key={current.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }}>
                    <div className="det-head"><span className="blogo" style={{ width: 64, height: 64 }}><Icon name="leaf" /></span>
                      <div><h2 style={{ fontSize: 20, display: 'inline' }}>{current.name}</h2> {current.demo && <Chip tone="gray">Demonstration</Chip>}
                        <p style={{ marginTop: 8, color: 'var(--ink2)', fontSize: 13 }}>Stores {current.reqs.length} requirement{current.reqs.length > 1 ? 's' : ''} for {current.produce.join(', ')}.</p></div></div>
                    <Tabs variant="line" id="buyer-detail" value={tab} onChange={setTab} className="mt12" tabs={[{ key: 'ov', label: 'Overview', icon: 'file' }, { key: 'rq', label: 'Requirements', icon: 'file' }, { key: 'sp', label: 'Supported Produce', icon: 'package' }, { key: 'ct', label: 'Contact', icon: 'mail' }]} />
                    <div className="mt12">
                      {tab === 'ov' && (
                        <>
                          <div className="sec-head"><span className="sec-ic sm"><Icon name="file" /></span><b>Key Information</b></div>
                          <div className="kvt">
                            <Icon name="package" /><span className="k">Products</span><span>{current.produce.join(', ')}</span>
                            <Icon name="shield" /><span className="k">Data type</span><span>{current.demo ? 'Demonstration data' : 'Recorded in this app'}</span>
                            <Icon name="file" /><span className="k">Information Source</span><span>{current.reqs[0].source_label || 'Buyer-stated specification'}</span>
                            <Icon name="clock" /><span className="k">Last Updated</span><span>{fmtDate(current.updated)}</span>
                          </div>
                          <Card tone="tint" className="mt12"><div className="sec-head" style={{ marginBottom: 10 }}><span className="sec-ic sm"><Icon name="package" /></span><b>Supported Produce</b></div><Produce list={current.produce} /></Card>
                          <div className="sec-head mt16"><span className="sec-ic sm"><Icon name="file" /></span><b>Quick Facts</b></div>
                          <div className="kvt">
                            <Icon name="package" /><span className="k">Typical order size</span><span>{orderSize(current.reqs[0])}</span>
                            <Icon name="bag" /><span className="k">Packaging preference</span><span>{current.reqs[0].packaging || 'Not stated'}</span>
                            <Icon name="truck" /><span className="k">Delivery</span><span>{current.reqs[0].delivery || 'Not stated'}</span>
                          </div>
                        </>
                      )}
                      {tab === 'rq' && current.reqs.map((r) => (
                        <div key={r.id} className="mb12"><b>{r.product_name}{r.grade_label ? ` · ${r.grade_label}` : ''}</b> {r.expired && <Chip tone="red">Expired</Chip>}
                          <div className="tblwrap mt8"><table className="tbl"><thead><tr><th>Parameter</th><th>Limit</th><th>Required</th></tr></thead><tbody>
                            {r.specifications.length === 0 && <tr><td colSpan={3} className="sub">No numeric limits stated.</td></tr>}
                            {r.specifications.map((s, i) => <tr key={i}><td>{s.parameter}</td><td>{specText(s)}</td><td>{s.required === false ? 'No' : 'Yes'}</td></tr>)}</tbody></table></div>
                          {r.reference_price != null && <p className="sub mt8">Reference price: ₹{r.reference_price} per {r.price_unit} ({r.offer_kind?.replaceAll('_', ' ')})</p>}</div>))}
                      {tab === 'sp' && <Produce list={current.produce} />}
                      {tab === 'ct' && <><p style={{ color: 'var(--ink2)', fontSize: 13.5 }}>Direct contact details are not shown in this app. Verify requirements with the buyer through your cooperative or the channels they publish.</p></>}
                    </div>
                    <Notice tone="amber" small className="mt12"><span>Please contact the buyer directly to confirm the latest requirements, pricing and procurement process. AranyaValue does not guarantee any offers or partnerships.</span></Notice>
                  </motion.div>
                ) : <EmptyState icon="users" title="Select a buyer" />}
              </AnimatePresence>
            </Card>
          </div>
        )}
      </Query>
    </>
  );
}

const orderSize = (r) => (r.min_qty != null || r.max_qty != null ? `${r.min_qty ?? '—'} – ${r.max_qty ?? 'any'} ${r.unit}` : 'Not stated');

function Produce({ list }) {
  return <div className="supp">{list.slice(0, 4).map((x) => <div key={x}><Img name={productImage(x)} alt={x} /><div style={{ marginTop: 4 }}>{x}</div></div>)}</div>;
}
