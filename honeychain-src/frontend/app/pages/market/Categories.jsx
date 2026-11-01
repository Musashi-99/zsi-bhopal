import { useDocTitle } from '../../hooks';
import { useStoreMeta } from '../../api/market';
import { Crumbs, ErrorBox } from '../../components/market/parts';
import { CategoryCard } from './MarketHome';

export default function Categories() {
  useDocTitle('Categories');
  const q = useStoreMeta();
  return (
    <>
      <div className="mk-pagehead"><div className="wrap">
        <Crumbs items={[{ label: 'Marketplace', to: '/market' }, { label: 'Categories' }]} />
        <h1>Forest produce categories</h1>
        <p>Ten product families used across the catalogue. Counts show batches currently listed; a category with none yet is waiting for collectors to list a batch.</p>
      </div></div>
      <div className="wrap" style={{ paddingTop: 28 }}>
        {q.isLoading ? <div className="mk-cats">{Array.from({ length: 10 }, (_, i) => <div key={i} className="mk-cat mk-skel" />)}</div>
          : q.error ? <ErrorBox error={q.error} onRetry={q.refetch} />
            : <div className="mk-cats">{q.data.categories.map((c) => <CategoryCard key={c.id} c={c} />)}</div>}
      </div>
    </>
  );
}
