import Icon from '../ui/Icon';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { SOURCE_LEGEND, SOURCE_TONE } from '../../lib/market';
import { Alert, Pill } from './parts';

export function Legend() {
  return (
    <div className="mk-legend" aria-label="Evidence types">
      {SOURCE_LEGEND.map(([k, label, tip]) => <Pill key={k} tone={SOURCE_TONE[k]} className="" icon={k === 'laboratory_tested' ? 'flask' : k === 'officer_verified' ? 'shieldcheck' : k === 'centre_checked' ? 'building' : k === 'instrument_measured' ? 'sliders' : 'user'}><span title={tip}>{label}</span></Pill>)}
    </div>
  );
}

export function QualityTable({ rows, expected = [] }) {
  const recorded = new Set(rows.map((r) => String(r.parameter).toLowerCase()));
  const missing = expected.filter((e) => !recorded.has(String(e.name).toLowerCase()));
  return (
    <>
      {rows.length === 0
        ? <Alert tone="info" title="No quality readings are recorded for this batch yet">Do not assume a quality level. Ask the collection centre what has been checked.</Alert>
        : (
          <div className="mk-tablewrap"><table className="mk-table">
            <thead><tr><th>Parameter</th><th>Measured value</th><th>Evidence type</th><th>Method</th><th>Date</th><th>Verified by</th><th>Reference</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.parameter}</b></td>
                  <td>{r.value != null ? <b>{r.value} {r.unit || ''}</b> : r.text_value || '—'}</td>
                  <td><Pill tone={SOURCE_TONE[r.source_type]} icon={r.source_type === 'laboratory_tested' ? 'flask' : r.source_type === 'officer_verified' ? 'shieldcheck' : r.source_type === 'centre_checked' ? 'building' : undefined}>{r.source_label}</Pill>{r.officer_confirmed && r.source_type !== 'officer_verified' && <div className="xs muted mt8">Confirmed by an officer</div>}</td>
                  <td>{r.method || <span className="muted">Not recorded</span>}</td>
                  <td className="muted">{fmtDate(r.date)}</td>
                  <td>{r.verifier}</td>
                  <td className="sm">{r.standard || <span className="muted">No standard referenced</span>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      {missing.length > 0 && <p className="sm muted mt12"><b>Not recorded for this batch:</b> {missing.map((m) => m.name).join(', ')}.</p>}
      <Legend />
    </>
  );
}

export function Conditions({ items }) {
  return (
    <dl className="mk-facts">
      {items.map((c) => (
        <div key={c.label} style={{ display: 'contents' }}>
          <dt>{c.label}</dt>
          <dd>{c.value ? <>{c.value} <span className="xs muted">· {c.source_label}{c.date ? ` · ${fmtDate(c.date)}` : ''}</span></> : <span className="muted">Not recorded</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function History({ items }) {
  if (!items.length) return <p className="muted">No history is recorded yet.</p>;
  return (
    <ol className="mk-time">
      {items.map((h, i) => <li key={`${h.seq}-${i}`} className={h.tone}><b>{h.label}</b><small>{fmtDateTime(h.at)} · {h.actor}</small></li>)}
    </ol>
  );
}

export function OfficerBlock({ officer, status }) {
  if (!officer) {
    return <Alert tone="info" title="No officer decision yet">{status === 'pending_review' ? 'This batch is waiting in the officer review queue.' : 'An authorised officer has not reviewed this batch.'}</Alert>;
  }
  return (
    <div className="stack">
      <div className="row wrap"><Pill tone={officer.status.tone} icon="shieldcheck">{officer.status.label}{officer.status.note ? ` · ${officer.status.note.toLowerCase()}` : ''}</Pill><span className="sm muted">{fmtDateTime(officer.decided_at)} · {officer.by}</span></div>
      {officer.summary && <p>{officer.summary}</p>}
      {officer.limitations && <Alert tone="warning" title="Limitations recorded by the officer">{officer.limitations}</Alert>}
    </div>
  );
}

export function Documents({ docs, label = 'Supporting documents' }) {
  if (!docs.length) return <p className="muted sm">No publicly shareable {label.toLowerCase()} are attached to this batch. Private documents are never shown here.</p>;
  return (
    <div className="stack">
      {docs.map((d) => (
        <a key={d.id} className="btn" href={d.url} target="_blank" rel="noopener noreferrer" style={{ justifyContent: 'flex-start' }}>
          <Icon name={d.is_lab_report ? 'flask' : 'file'} /> {d.label}<span className="grow" /><Icon name="ext" />
        </a>
      ))}
    </div>
  );
}
