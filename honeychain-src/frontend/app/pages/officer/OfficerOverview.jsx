import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useO, useOfficerOverview } from '../../api/officer';
import { useDocTitle } from '../../hooks';
import { cleanName, eventMeta, timeAgo } from '../../lib/format';
import { OStatus } from './common';
import TerrainMap from './TerrainMap';
import { MAP_MODES, PLATE_BY_ID, PLATE_BY_NAME, SHEETS, SHEET_OF } from './forestGeo';

const nf = new Intl.NumberFormat('en-IN');
const PENDING = new Set(['pending_verification', 'submitted']);
const ACC = { active: 'Accredited', suspended: 'Suspended', expired: 'Expired', none: 'Not accredited' };

const rank = {
  pending_verification: 0,
  submitted: 0,
  needs_info: 1,
  suspended: 2,
  verified: 3,
  verified_with_limitations: 3,
  rejected: 4,
  failed_checks: 4,
};

export default function OfficerOverview() {
  useDocTitle('Forest inspector');
  const overview = useOfficerOverview();
  const centresQ = useO('/centres');
  const batchesQ = useO('/batches?limit=100');
  const [sheetId, setSheetId] = useState('jangal');
  const [mode, setMode] = useState('imagery');
  const [selectedId, setSelectedId] = useState(null);
  const [point, setPoint] = useState(null);

  const sheet = SHEETS.find((s) => s.id === sheetId) || SHEETS[0];
  const batches = batchesQ.data?.batches || [];
  const centres = centresQ.data?.centres || [];
  const loadedAll = !batchesQ.data || batchesQ.data.total <= batches.length;

  const points = useMemo(() => {
    const rows = [];
    for (const centre of centres) {
      if (!SHEET_OF[centre.district_id]) continue;
      rows.push({
        id: centre.id,
        plateId: centre.district_id,
        kind: 'centre',
        title: centre.name,
        accent: centre.accreditation_status || 'none',
        href: `/officer/centres/${centre.id}`,
      });
    }
    for (const batch of batches) {
      const plate = PLATE_BY_NAME[String(batch.district_name || '').toLowerCase()];
      if (!plate) continue;
      rows.push({
        id: batch.id,
        plateId: plate.id,
        kind: 'batch',
        title: batch.batch_code,
        status: batch.status,
        href: `/officer/verification/${batch.id}`,
        product: batch.product_name,
        collector: batch.collector_name,
        qty: batch.quantity,
        unit: batch.unit,
        block: batch.block_name,
        demo: !!batch.is_demo,
      });
    }
    return rows;
  }, [batches, centres]);

  const stats = useMemo(() => {
    const out = {};
    for (const plate of sheet.plates) {
      const listed = overview.data?.by_district?.find((row) => row.label === plate.name);
      const rows = batches.filter((batch) => batch.district_name === plate.name);
      out[plate.id] = {
        batches: listed ? listed.batches : rows.length,
        pending: rows.filter((batch) => PENDING.has(batch.status)).length,
        centres: centres.filter((centre) => centre.district_id === plate.id).length,
      };
    }
    return out;
  }, [sheet, overview.data, batches, centres]);

  const selected = selectedId ? PLATE_BY_ID[selectedId] : null;
  const plateCentres = selected ? centres.filter((centre) => centre.district_id === selected.id) : [];
  const plateBatches = selected
    ? batches.filter((batch) => batch.district_name === selected.name).slice().sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9))
    : [];
  const units = new Map();
  for (const batch of plateBatches) {
    const unit = batch.unit || '—';
    const rec = units.get(unit) || 0;
    units.set(unit, rec + (Number(batch.quantity) || 0));
  }
  const outside = (overview.data?.by_district || []).filter((row) => !PLATE_BY_NAME[row.label.toLowerCase()]);
  const fetching = overview.isFetching || centresQ.isFetching || batchesQ.isFetching;
  const demo = overview.data?.demo;
  const modeMeta = MAP_MODES.find((item) => item.id === mode);

  function pickSheet(id) {
    setSheetId(id);
    setSelectedId(null);
    setPoint(null);
  }

  function refresh() {
    overview.refetch();
    centresQ.refetch();
    batchesQ.refetch();
  }

  return (
    <div className="fi">
      <header className="fi-top">
        <div className="fi-title">
          <h1>Forest inspector</h1>
          <p>{sheet.title} sheet {sheet.index}</p>
        </div>
        <div className="fi-sheets" role="tablist" aria-label="Map sheet">
          {SHEETS.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={item.id === sheet.id} className={item.id === sheet.id ? 'on' : ''} onClick={() => pickSheet(item.id)}>{item.title}</button>
          ))}
        </div>
        <div className="fi-modes" role="tablist" aria-label="Map type">
          {MAP_MODES.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={item.id === mode} className={item.id === mode ? 'on' : ''} onClick={() => setMode(item.id)}>{item.label}</button>
          ))}
        </div>
        {overview.data && <span className="fi-wait">{nf.format(overview.data.totals.pending)} pending</span>}
        <button type="button" className="fi-refresh" onClick={refresh} disabled={fetching}>
          <Icon name="refresh" />
          <span>{fetching ? 'Refreshing' : 'Refresh'}</span>
        </button>
      </header>

      <div className="fi-body">
        <TerrainMap
          sheet={sheet}
          mode={mode}
          stats={stats}
          points={points.filter((row) => SHEET_OF[row.plateId] === sheet.id)}
          selectedId={selected && selected.sheet === sheet.id ? selected.id : null}
          activePointId={point?.id || null}
          onSelect={setSelectedId}
          onPoint={setPoint}
        />

        <aside className="fi-dossier" aria-live="polite">
          {demo && (demo.batches + demo.users + demo.centres) > 0 && (
            <p className="fi-demo">Demonstration records. Not a government register. {demo.batches} demo batches, {demo.centres} demo centres.</p>
          )}

          {!selected && (
            <>
              <h2>{sheet.title}</h2>
              <p className="fi-lead">Select a district. That plate lifts off the sheet. Amber hatch on the survey sheet marks a district with a batch still waiting.</p>
              <ul className="fi-plates">
                {sheet.plates.map((plate) => {
                  const row = stats[plate.id];
                  return (
                    <li key={plate.id}>
                      <button type="button" onClick={() => { setSelectedId(plate.id); setPoint(null); }}>
                        <b>{plate.name}</b>
                        <span>{nf.format(row.batches)} {row.batches === 1 ? 'batch' : 'batches'}</span>
                        <span>{row.pending ? `${nf.format(row.pending)} pending` : 'None pending'}</span>
                        <span>{nf.format(row.centres)} {row.centres === 1 ? 'centre' : 'centres'}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {selected && (
            <>
              <button type="button" className="fi-back" onClick={() => { setSelectedId(null); setPoint(null); }}>All districts</button>
              <h2>{selected.name}</h2>
              <p className="fi-lead">West Bengal. Counts are from the shared batch records.</p>
              <dl className="fi-metrics">
                <div><dt>Batches</dt><dd>{nf.format(stats[selected.id]?.batches || 0)}</dd></div>
                <div><dt>Pending</dt><dd>{nf.format(stats[selected.id]?.pending || 0)}</dd></div>
                <div><dt>Centres</dt><dd>{nf.format(stats[selected.id]?.centres || 0)}</dd></div>
              </dl>
              {units.size > 0 && (
                <p className="fi-qty">{[...units.entries()].map(([unit, total]) => `${nf.format(Math.round(total * 100) / 100)} ${unit}`).join(' · ')}{loadedAll ? '' : ' in the loaded rows'}</p>
              )}

              {point && (
                <div className="fi-focus">
                  <b>{point.kind === 'centre' ? point.title : point.title}</b>
                  <span>{point.kind === 'centre' ? (ACC[point.accent] || point.accent) : point.product}</span>
                  <Link to={point.href}>Open record</Link>
                </div>
              )}

              <h3>Centres</h3>
              {plateCentres.length === 0 ? <p className="fi-empty">No collection centre on this district.</p> : (
                <ul className="fi-rows">
                  {plateCentres.map((centre) => (
                    <li key={centre.id} className={point?.id === centre.id ? 'on' : ''}>
                      <Link to={`/officer/centres/${centre.id}`}>
                        <b>{centre.name}</b>
                        <span>{ACC[centre.accreditation_status] || '—'}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="fi-fine">AranyaValue accreditation is a programme mark. It is not a government licence.</p>

              <h3>Batches</h3>
              {!loadedAll && <p className="fi-fine">Pins and this list show the first {batches.length} of {batchesQ.data.total} submitted batches.</p>}
              {plateBatches.length === 0 ? <p className="fi-empty">No submitted batch on this district in the loaded rows.</p> : (
                <ul className="fi-rows">
                  {plateBatches.map((batch) => (
                    <li key={batch.id} className={point?.id === batch.id ? 'on' : ''}>
                      <Link to={`/officer/verification/${batch.id}`}>
                        <b>{batch.batch_code}</b>
                        <span>{batch.product_name}{batch.block_name ? ` · ${batch.block_name}` : ''}</span>
                        <span>{cleanName(batch.collector_name || '')}</span>
                        <OStatus status={batch.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {(centresQ.error || batchesQ.error) && <p className="fi-empty">{(centresQ.error || batchesQ.error).message}</p>}

          {!selected && overview.data?.queue?.length > 0 && (
            <>
              <h3>Oldest pending</h3>
              <ul className="fi-rows">
                {overview.data.queue.map((batch) => {
                  const plate = PLATE_BY_NAME[String(batch.district_name || '').toLowerCase()];
                  return (
                    <li key={batch.id}>
                      <Link to={`/officer/verification/${batch.id}`} onClick={() => plate && setSheetId(plate.sheet)}>
                        <b>{batch.batch_code}</b>
                        <span>{batch.product_name} · {batch.district_name}</span>
                        <span>{timeAgo(batch.updated_at)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {!selected && outside.length > 0 && (
            <>
              <h3>Outside these sheets</h3>
              <ul className="fi-rows">
                {outside.map((row) => (
                  <li key={row.label}><span className="fi-static"><b>{row.label}</b><span>{row.state} · {nf.format(row.batches)} batches</span></span></li>
                ))}
              </ul>
            </>
          )}

          {!selected && overview.data?.recent_activity?.length > 0 && (
            <>
              <h3>Recent record events</h3>
              <ul className="fi-feed">
                {overview.data.recent_activity.slice(0, 5).map((event) => {
                  const [label] = eventMeta(event.event_type);
                  return (
                    <li key={event.seq}>
                      <b>{label}</b>
                      <span>{event.batch_code} · {event.actor_name ? cleanName(event.actor_name) : 'System'}</span>
                      <span>{timeAgo(event.timestamp)}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <p className="fi-fine">Outlines are simplified so a district can be lifted off the sheet. They are not a cadastral boundary. Pins sit on the plate because these records have no GPS coordinate. {modeMeta?.attr}.</p>
          {overview.data?.chain && <p className="fi-fine">Audit chain {overview.data.chain.valid ? 'intact' : 'mismatch'} · {nf.format(overview.data.chain.total_events)} events. An approval here is an in-app review, not a statutory certificate.</p>}
          <p className="fi-fine"><Link to="/officer/verification">Open the verification queue</Link></p>
        </aside>
      </div>
    </div>
  );
}
