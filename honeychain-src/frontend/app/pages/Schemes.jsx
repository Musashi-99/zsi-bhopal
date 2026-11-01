import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../components/ui/Icon';
import PageHero from '../components/layout/PageHero';
import { Button, Card, EmptyState, FilterSelect, IconButton, Img, Notice, Query, SearchInput } from '../components/ui/primitives';
import { Item, Stagger } from '../components/motion';
import { useUI } from '../context/UIContext';
import { useMeta, useSavedSchemes, useSaveScheme, useSchemes } from '../api/queries';
import { useDebounced, useDocTitle } from '../hooks';
import { cap, fmtDate } from '../lib/format';

const CAT_TONE = { livelihood: 'a', price_support: 'b', value_addition: 'g', conservation: 'g' };
const level = (s) => (s.level === 'central' ? 'Central Government' : 'State Government');

export default function Schemes() {
  useDocTitle('Government Schemes');
  const meta = useMeta();
  const { toast } = useUI();
  const [text, setText] = useState('');
  const [state, setState] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('Relevance');
  const [sel, setSel] = useState(null);
  const dq = useDebounced(text);
  const q = useSchemes({ q: dq, state, category });
  const all = useSchemes({});
  const saved = useSavedSchemes();
  const save = useSaveScheme();
  const savedIds = new Set((saved.data || []).map((s) => s.id));

  const categories = useMemo(() => [{ value: '', label: 'All' }, ...[...new Set((all.data || []).map((s) => s.category))].map((c) => ({ value: c, label: cap(c.replaceAll('_', ' ')) }))], [all.data]);
  const list = useMemo(() => {
    const l = [...(q.data || [])];
    return sort.startsWith('Name') ? l.sort((a, b) => a.name.localeCompare(b.name)) : l;
  }, [q.data, sort]);
  const current = sel === '__none' ? null : (list.find((s) => s.id === sel) || list[0]);

  const toggle = async (s) => {
    try {
      await save.mutateAsync({ id: s.id, status: 'saved' });
      toast('Scheme saved to your list');
    } catch (e) { toast(e.message, 'err'); }
  };
  const clear = () => { setText(''); setState(''); setCategory(''); setSort('Relevance'); };

  return (
    <>
      <PageHero title="Government Schemes" sub="Explore support programs that may be relevant to forest-produce collectors." />
      <Notice className="mb12" icon="shieldcheck"><span>This page provides information from official government sources to help you find relevant schemes. Please check the official website for complete and updated details. AranyaValue is not affiliated with any government department.</span></Notice>

      <div className="row wrap mb12" style={{ alignItems: 'flex-end' }}>
        <SearchInput value={text} onChange={setText} placeholder="Search schemes by name, keyword or department…" label="Search schemes" style={{ flex: 1.6 }} />
        <FilterSelect label="State" value={state} onChange={setState} options={[{ value: '', label: 'All States' }, ...(meta.data?.states || []).map((s) => ({ value: s.id, label: s.name }))]} />
        <FilterSelect label="Topic" value={category} onChange={setCategory} options={categories} />
        <Button style={{ height: 44, padding: '0 24px' }} onClick={clear}>Clear Filters</Button>
      </div>

      <div className="sc-grid">
        <Card style={{ padding: 12 }}>
          <div className="row between mb12"><span style={{ fontSize: 13 }}>Showing {list.length} scheme{list.length === 1 ? '' : 's'}</span>
            <label className="row" style={{ fontSize: 12.5 }}>Sort by <select className="sel" style={{ width: 140, height: 36 }} value={sort} onChange={(e) => setSort(e.target.value)}><option>Relevance</option><option>Name (A–Z)</option></select></label></div>
          <Query q={q} rows={5} empty={<EmptyState icon="search" title="No schemes found" action={<Button onClick={clear}>Clear Filters</Button>}>Try clearing the filters.</EmptyState>}>
            {() => (
              <Stagger key={list.map((s) => s.id).join()}>
                {list.map((s) => (
                  <Item key={s.id}>
                    <motion.article className={`scard ${current?.id === s.id ? 'picked' : ''}`} whileHover={{ y: -2 }} tabIndex={0} role="button" aria-label={s.name} onClick={() => setSel(s.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSel(s.id))}>
                      <Img name={`scheme-${s.id.replace('SC-', '').toLowerCase()}`} alt="" />
                      <div style={{ flex: 1, minWidth: 0 }}><h3>{s.name}</h3><div className="sub" style={{ color: 'var(--ink2)', fontSize: 12.5, marginTop: 2 }}>{s.department}</div>
                        <div className="row wrap mt8" style={{ gap: 6 }}><span className={`stag ${CAT_TONE[s.category] || 'g'}`}>{cap(s.category.replaceAll('_', ' '))}</span>{s.summary_is_illustrative && <span className="stag gray">Illustrative summary</span>}</div>
                        <p>{s.benefits}</p></div>
                      <div className="r"><span className="stag cg">{level(s)}</span><span className="row" style={{ gap: 6 }}><Icon name="calendar" /><span>Last verified<br /><b style={{ fontWeight: 500 }}>{fmtDate(s.last_verified)}</b></span></span>
                        <Button size="sm" variant="primary" block iconRight="arrow" style={{ marginTop: 'auto' }} onClick={(e) => { e.stopPropagation(); setSel(s.id); }}>View Details</Button></div>
                    </motion.article>
                  </Item>
                ))}
              </Stagger>
            )}
          </Query>
        </Card>

        <Card style={{ position: 'sticky', top: 78 }}>
          <AnimatePresence mode="wait">
            {!current ? <EmptyState key="n" icon="file" title="Select a scheme" /> : (
              <motion.div key={current.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
                <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
                  <Img name={`scheme-${current.id.replace('SC-', '').toLowerCase()}`} alt="" style={{ width: 100, height: 90, borderRadius: 8, objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}><div className="row between" style={{ alignItems: 'flex-start' }}><h2 style={{ fontSize: 17 }}>{current.name}</h2><IconButton icon="x" label="Close details" style={{ border: 0 }} onClick={() => setSel('__none')} /></div>
                    <div className="sub" style={{ color: 'var(--ink2)' }}>{current.department}</div><div className="row wrap mt8" style={{ gap: 6 }}><span className="stag cg">{level(current)}</span><span className={`stag ${CAT_TONE[current.category] || 'g'}`}>{cap(current.category.replaceAll('_', ' '))}</span></div></div>
                </div>
                <Card className="mt12" style={{ padding: 12 }}><div className="row"><span style={{ color: 'var(--g600)' }}><Icon name="file" /></span><b>Overview</b></div><p style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 6 }}>{current.benefits}</p></Card>
                <Card className="mt12" style={{ padding: 12 }}><div className="row"><span style={{ color: 'var(--g600)' }}><Icon name="file" /></span><b>Key Information</b></div>
                  <div className="mt8">
                    <div className="kvs"><Icon name="building" /><b>Administering Department</b><span>{current.department}</span></div>
                    <div className="kvs"><Icon name="users" /><b>Intended Beneficiaries</b><span>{current.beneficiaries}</span></div>
                    <div className="kvs"><Icon name="cc" /><b>Eligibility</b><span>{current.eligibility}</span></div>
                    <div className="kvs"><Icon name="file" /><b>Process</b><span>{current.process}</span></div>
                    <div className="kvs"><Icon name="shieldcheck" /><b>Official Source</b><a className="link" href={current.source_url || current.official_url} target="_blank" rel="noopener noreferrer">{new URL(current.source_url || current.official_url).hostname} <Icon name="ext" /></a></div>
                    <div className="kvs"><Icon name="clock" /><b>Last Verified</b><span>{fmtDate(current.last_verified)}</span></div>
                  </div></Card>
                {current.summary_is_illustrative && <Notice tone="amber" small className="mt12"><span>This summary is illustrative and does not restate official benefit amounts or eligibility rules.</span></Notice>}
                <Notice tone="blue" small className="mt12"><span>Please check the official website for complete and updated details, including eligibility criteria, application process and contact information.</span></Notice>
                <Button variant="primary" block className="mt12" style={{ height: 46 }} href={current.official_url} icon="ext" iconRight="arrow">Check on Official Portal</Button>
                <Button block className="mt8" style={{ height: 46 }} icon="bookmark" disabled={savedIds.has(current.id) || save.isPending} onClick={() => toggle(current)}>{savedIds.has(current.id) ? 'Saved' : 'Save Scheme'}</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </>
  );
}
