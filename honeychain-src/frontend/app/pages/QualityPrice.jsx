import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon';
import PageHero from '../components/layout/PageHero';
import BatchPicker from '../components/BatchPicker';
import { Button, Card, Chip, EmptyState, ErrorState, FilterSelect, Img, LoadingState, Notice, SectionHead, StatusBadge } from '../components/ui/primitives';
import { GrowBar, Item, Stagger } from '../components/motion';
import { useIntelligence, usePassport, useRequirements } from '../api/queries';
import { useDocTitle, useSelectedBatch } from '../hooks';
import { OUTCOME, fmtDate, productImage } from '../lib/format';

export const specText = (spec) => {
  if (!spec) return '—';
  const u = spec.unit ? ` ${spec.unit}` : '';
  if (spec.text_expect) return spec.text_expect;
  if (spec.min != null && spec.max != null) return `${spec.min}–${spec.max}${u}`;
  if (spec.max != null) return `≤ ${spec.max}${u}`;
  if (spec.min != null) return `≥ ${spec.min}${u}`;
  return spec.required === false ? 'Optional' : 'Required';
};

const tone = (o) => (OUTCOME[o]?.tone === 'green' ? 'green' : OUTCOME[o]?.tone === 'red' ? 'red' : OUTCOME[o]?.tone === 'amber' ? 'amber' : 'gray');
const matchChip = (m) => (m === 'eligible' ? 'elig' : m === 'conditional' ? 'cond' : m === 'not_eligible' ? 'rejected' : 'unk');

export default function QualityPrice() {
  useDocTitle('Quality to Price');
  const sel = useSelectedBatch('/quality-price');
  const passport = usePassport(sel.id);
  const intelQ = useIntelligence(sel.id);
  const reqs = useRequirements();
  const [buyer, setBuyer] = useState('All Buyers');

  const intel = intelQ.data;
  const matches = intel?.buyer_matches || [];
  const specsById = useMemo(() => Object.fromEntries((reqs.data || []).map((r) => [r.id, r.specifications || []])), [reqs.data]);
  const shown = matches.filter((m) => buyer === 'All Buyers' || (m.organisation || m.buyer_name) === buyer);
  const params = useMemo(() => {
    const names = [];
    shown.forEach((m) => m.checks.forEach((c) => !names.includes(c.parameter) && names.push(c.parameter)));
    return names;
  }, [shown]);

  if (sel.isLoading) return <LoadingState rows={6} />;
  if (sel.error) return <ErrorState error={sel.error} onRetry={sel.refetch} />;
  if (!sel.batch) return <><PageHero title="Quality to Price" sub="Understand buyer requirements, compare offers and see what may improve your batch's value." /><Card><EmptyState icon="chart" title="No batches yet" action={<Button to="/batches/new" variant="primary" icon="plus">Create a batch</Button>}>Create a batch to compare it with buyer requirements.</EmptyState></Card></>;

  const b = sel.batch;
  const p = passport.data;
  const meets = matches.filter((m) => m.match === 'eligible').map((m) => m.organisation || m.buyer_name);
  const unmet = matches.flatMap((m) => m.checks.filter((c) => c.outcome === 'does_not_meet').map((c) => `${m.organisation || m.buyer_name} (${c.parameter})`));
  const missing = [...new Set(matches.flatMap((m) => m.checks.filter((c) => c.outcome === 'needs_additional_evidence').map((c) => c.parameter)))];

  return (
    <>
      <PageHero title="Quality to Price" sub="Understand buyer requirements, compare offers and see what may improve your batch's value." />

      <div className="qp-top">
        <Card><BatchPicker batches={sel.batches} batch={b} onSelect={sel.select} sub="Choose a batch to compare with buyer requirements and offers." /></Card>
        <Card>
          <h3>Batch Summary</h3>
          <div className="row mt8" style={{ gap: 14, alignItems: 'flex-start' }}>
            <Img name={productImage(b.product)} alt="" style={{ width: 74, height: 64, borderRadius: 8, objectFit: 'cover' }} />
            <div style={{ flex: 1 }}><b style={{ fontSize: 17 }}>{b.batch_code}</b><div style={{ color: 'var(--ink2)' }}>{p?.local_name || b.product}</div>
              <div className="row wrap mt8" style={{ gap: 14, fontSize: 12, color: 'var(--ink2)' }}>
                <span className="row" style={{ gap: 5 }}><Icon name="package" />{b.quantity} {b.unit}</span><span className="row" style={{ gap: 5 }}><Icon name="calendar" />{fmtDate(b.collection_date)}</span><span className="row" style={{ gap: 5 }}><Icon name="pin" />{b.district}, {b.state}</span></div></div>
            <div><small className="sub">Current Status</small><div><StatusBadge status={b.status} icon="download" /></div></div>
          </div>
        </Card>
      </div>

      {intelQ.isLoading ? <LoadingState rows={6} /> : intelQ.error ? <ErrorState error={intelQ.error} onRetry={intelQ.refetch} /> : (
        <div className="qp-grid">
          <div className="grid" style={{ alignContent: 'start' }}>
            <Card>
              <div className="row between wrap">
                <SectionHead icon="scan" title="Buyer Requirements Comparison" sub="See how your batch's recorded quality parameters compare with each buyer's requirements." />
                <FilterSelect label="Select Buyer" value={buyer} onChange={setBuyer} options={['All Buyers', ...matches.map((m) => m.organisation || m.buyer_name)]} />
              </div>
              {matches.length === 0 ? <EmptyState icon="users" title="No buyer requirement for this product">Buyers have not stored a specification for {b.product} yet.</EmptyState> : (
                <div className="tblwrap mt12"><table className="tbl cmp">
                  <thead><tr><th>Parameter</th><th>Your Batch ({b.batch_code.replace('AV-WB-', '')})</th>{shown.map((m) => <th key={m.requirement_id}>{m.organisation || m.buyer_name}<br />Requirement</th>)}</tr></thead>
                  <tbody>{params.map((name) => {
                    const mine = (p?.measurements || []).filter((x) => x.parameter === name).at(-1);
                    return (
                      <tr key={name}><td><b>{name}</b></td>
                        <td>{mine ? `${mine.value ?? mine.text_value}${mine.unit ? ' ' + mine.unit : ''}` : 'Not recorded'} {mine && <Chip tone="amber" style={{ marginLeft: 8 }}>{mine.evidence_source === 'self_reported' ? 'Self-reported' : 'Measured'}</Chip>}</td>
                        {shown.map((m) => { const c = m.checks.find((x) => x.parameter === name); if (!c) return <td key={m.requirement_id}>—</td>; const o = OUTCOME[c.outcome] || OUTCOME.cannot_be_assessed;
                          const spec = (specsById[m.requirement_id] || []).find((s) => s.parameter === name);
                          return <td key={m.requirement_id} title={c.reason}>{specText(spec)}<br /><Chip tone={tone(c.outcome)} icon={o.icon}>{o.label}</Chip></td>; })}
                      </tr>);
                  })}</tbody></table></div>
              )}
            </Card>

            <Card>
              <div className="row between wrap"><SectionHead icon="handshake" title="Buyer Offers & Reference Prices" sub="Figures come from buyer records stored in this app. They are not guaranteed prices." /><Chip tone="blue" pill>● {matches.some((m) => m.is_demo) ? 'Demonstration data' : 'Recorded data'}</Chip></div>
              <div className="tblwrap mt12"><table className="tbl"><thead><tr><th>Buyer</th><th>Price</th><th>Requirement Match</th><th>Status</th><th>Notes</th><th>Action</th></tr></thead>
                <tbody>{matches.length === 0 && <tr><td colSpan={6} className="sub">No buyer data for this product.</td></tr>}
                  {matches.map((m) => { const o = OUTCOME[m.match] || OUTCOME.insufficient_evidence; const f = m.scorecard?.fraction; const pct = f ? (f.numerator / f.denominator) * 100 : 0;
                    return (
                      <tr key={m.requirement_id}><td><span className="row"><Icon name="leaf" className="up" />{m.organisation || m.buyer_name}</span></td>
                        <td><b>{m.reference_price ? `₹${m.reference_price.amount}` : '-'}</b>{m.reference_price && <div className="sub">per {m.reference_price.unit} · {m.reference_price.kind_label}</div>}</td>
                        <td>{f ? <>{f.label}<GrowBar className="offer-bar" pct={pct} color={pct >= 75 ? '#22a05a' : '#f5a623'} /></> : <span className="sub">No decided requirement</span>}</td>
                        <td><Chip tone={matchChip(m.match)}>● {o.label}</Chip></td>
                        <td style={{ fontSize: 12.5, maxWidth: 220 }}>{m.limitations?.[0] || m.scorecard?.missing_data_note}</td>
                        <td><Button size="xs" to={`/buyers?buyer=${m.buyer_user_id}`} iconRight="arrow">View Details</Button></td></tr>); })}</tbody></table></div>
              {(intel?.offer_explanations || []).length > 0 && (
                <Notice tone="blue" small className="mt12"><span>{intel.offer_explanations.map((n) => n.text).join(' ')}</span></Notice>
              )}
            </Card>

            <Card>
              <SectionHead icon="chart" title="How Price Differences Happen" />
              <div className="flow">
                <div style={{ background: '#e8f4e5' }}><span className="sec-ic sm"><Icon name="file" /></span><div><b>Different Quality Standards</b>Buyers have different requirements for moisture, purity, color, origin etc.</div></div><Icon name="arrow" />
                <div style={{ background: '#e4eefc' }}><span className="sec-ic sm blue"><Icon name="settings" /></span><div><b>Different End Uses</b>Some buyers supply retail markets, others to processing or export, which affects price.</div></div><Icon name="arrow" />
                <div style={{ background: '#efe8fb' }}><span className="sec-ic sm purple"><Icon name="chart" /></span><div><b>Different Costs &amp; Margins</b>Processing, packaging, testing and transport costs vary across buyers, leading to different offers.</div></div>
              </div>
            </Card>
          </div>

          <aside className="grid" style={{ alignContent: 'start' }}>
            <Card tone="amber">
              <div className="row" style={{ alignItems: 'flex-start' }}><Icon name="bulb" style={{ fontSize: 34, color: 'var(--amber)' }} /><div><h2 style={{ fontSize: 20 }}>What This Means</h2>
                <p style={{ marginTop: 8, color: 'var(--ink2)', fontSize: 13.5 }}>
                  {matches.length === 0 ? 'There is nothing to compare yet because no buyer specification is stored for this product.' : <>
                    {meets.length ? `Your batch meets the recorded requirements of ${meets.join(' and ')}. ` : 'No buyer is fully matched by the recorded evidence yet. '}
                    {unmet.length > 0 && `It does not meet: ${unmet.join('; ')}. `}
                    {missing.length > 0 && `Some key information is still missing (${missing.join(', ')}).`}</>}</p></div></div>
              <Notice tone="amber" small className="mt12"><span>{intel?.disclaimer || 'Buyers may offer different prices based on their quality requirements, target markets and processing needs.'}</span></Notice>
            </Card>
            <Card tone="amber">
              <SectionHead icon="leaf" title="Potential Improvements" sub="Based on your current batch information, you may consider:" />
              <Stagger style={{ background: '#fff', borderRadius: 10, padding: '2px 12px' }}>
                {(intel?.recommendations || []).length === 0 && <p className="sub" style={{ padding: 12 }}>No further record is flagged by the configured checklist.</p>}
                {(intel?.recommendations || []).slice(0, 5).map((r, i) => (
                  <Item key={i}><Link className="imp" to={`/post-harvest/${b.id}`}><span className="n">{i + 1}</span><div style={{ flex: 1 }}><b>{r.action.split('.')[0]}</b><small>{r.observed_gap}</small>{r.expected_benefit && <small>{r.expected_benefit}</small>}</div><Icon name="right" /></Link></Item>))}
              </Stagger>
            </Card>
            <Card tone="amber"><div className="row" style={{ alignItems: 'flex-start' }}><Icon name="info" style={{ fontSize: 22, color: 'var(--blue)' }} /><div><h3>Note</h3>
              <ul className="bullets mt8" style={{ color: 'var(--ink)' }}><li>Offers and prices shown here come from records stored in this application{matches.some((m) => m.is_demo) ? ' and include demonstration data' : ''}.</li><li>They are not guaranteed prices and may change based on final quality assessment, quantity, location and market conditions.</li><li>Please verify the latest requirements and offers directly with buyers.</li></ul></div></div></Card>
          </aside>
        </div>
      )}
    </>
  );
}
