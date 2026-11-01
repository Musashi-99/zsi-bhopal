import Icon from './ui/Icon';
import { Img, StatusBadge } from './ui/primitives';
import { fmtDate, productImage } from '../lib/format';

/** "Select Batch" dropdown card used by Quality to Price and Post-Harvest. */
export default function BatchPicker({ batches, batch, onSelect, title = 'Select Batch', sub }) {
  if (!batch) return null;
  return (
    <>
      <h3>{title}</h3>
      {sub && <p className="sub">{sub}</p>}
      <div className="sel-batch">
        <Img name={productImage(batch.product)} alt={batch.product} />
        <div style={{ flex: 1 }}>
          <b style={{ fontSize: 15 }}>{batch.batch_code} &nbsp;|&nbsp; {batch.product}</b>
          <div className="sub" style={{ color: 'var(--ink2)', marginTop: 3 }}>{batch.quantity} {batch.unit} • Collected on {fmtDate(batch.collection_date)}</div>
        </div>
        <StatusBadge status={batch.status} icon="download" />
        <Icon name="down" />
        <select aria-label="Select batch" value={batch.id} onChange={(e) => onSelect(e.target.value)}>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.batch_code} | {b.product}</option>)}
        </select>
      </div>
    </>
  );
}
