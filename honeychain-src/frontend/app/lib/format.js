const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${ap}`;
}

export const fmtDateTime = (v) => (v ? `${fmtDate(v)}, ${fmtTime(v)}` : '—');

export function timeAgo(value) {
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return '';
  const s = Math.max(1, Math.round((Date.now() - d) / 1000));
  const units = [[86400 * 30, 'month'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
  for (const [secs, name] of units) {
    if (s >= secs) {
      const n = Math.floor(s / secs);
      return `${n} ${name}${n > 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
}

/** Backend batch status -> [label, chip class]. */
const STATUS = {
  draft: ['Draft', 'draft'],
  submitted: ['Submitted', 'submitted'],
  pending_verification: ['In Assessment', 'assess'],
  needs_info: ['Needs Info', 'cond'],
  verified: ['Completed', 'done'],
  verified_with_limitations: ['Conditional', 'cond'],
  dispatched: ['Completed', 'done'],
  failed_checks: ['Rejected', 'rejected'],
  rejected: ['Rejected', 'rejected'],
};
export const statusLabel = (s) => (STATUS[s] || [String(s || '').replaceAll('_', ' '), 'gray'])[0];
export const statusClass = (s) => (STATUS[s] || [null, 'gray'])[1];

/** Dashboard donut groups. */
export const STATUS_GROUPS = [
  { key: 'Draft', color: '#f5a623', match: ['draft'] },
  { key: 'Submitted', color: '#3b82f6', match: ['submitted', 'needs_info'] },
  { key: 'In Assessment', color: '#8b5cf6', match: ['pending_verification'] },
  { key: 'Completed', color: '#22a05a', match: ['verified', 'verified_with_limitations', 'dispatched'] },
  { key: 'Rejected', color: '#ef4444', match: ['rejected', 'failed_checks'] },
];

export const OUTCOME = {
  meets_recorded_specification: { label: 'Meets', icon: 'check', tone: 'green' },
  does_not_meet: { label: 'Does not meet', icon: 'xc', tone: 'red' },
  needs_additional_evidence: { label: 'Unknown', icon: 'help', tone: 'gray' },
  cannot_be_assessed: { label: 'Cannot assess', icon: 'help', tone: 'gray' },
  specification_unavailable: { label: 'Not configured', icon: 'help', tone: 'gray' },
  optional_missing: { label: 'Optional', icon: 'minus', tone: 'gray' },
  eligible: { label: 'Eligible', icon: 'cc', tone: 'green' },
  conditional: { label: 'Conditional', icon: 'alert', tone: 'amber' },
  not_eligible: { label: 'Not Eligible', icon: 'xc', tone: 'red' },
  insufficient_evidence: { label: 'Unknown', icon: 'help', tone: 'gray' },
};

/** Ledger event type -> [design label, tone, icon]. */
const EVENT = {
  BATCH_CREATED: ['Batch Created', 'blue', 'plus'],
  COLLECTION_UPDATED: ['Batch Updated', 'green', 'pencil'],
  HANDLING_RECORDED: ['Batch Updated', 'green', 'pencil'],
  MEASUREMENT_RECORDED: ['Batch Updated', 'green', 'pencil'],
  EVIDENCE_ADDED: ['Batch Updated', 'green', 'pencil'],
  ASSESSMENT_SUBMITTED: ['Submitted for Assessment', 'purple', 'upload'],
  ASSESSMENT_REVIEWED: ['Assessment Result', 'red', 'alert'],
  REJECTION_RECORDED: ['Assessment Result', 'red', 'alert'],
  PASSPORT_GENERATED: ['Passport Generated', 'blue', 'file'],
};
export const eventMeta = (t) => EVENT[t] || [cap(String(t).replaceAll('_', ' ').toLowerCase()), 'gray', 'file'];

export function describeEvent(e) {
  const p = e.payload || {};
  switch (e.event_type) {
    case 'BATCH_CREATED': return 'Initial batch information recorded';
    case 'ASSESSMENT_SUBMITTED': return 'Batch submitted for quality assessment';
    case 'ASSESSMENT_REVIEWED': return p.status ? `Reviewed: ${String(p.status).replaceAll('_', ' ')}` : 'Assessment reviewed';
    case 'REJECTION_RECORDED': return `Rejection recorded${p.category ? ` (${String(p.category).replaceAll('_', ' ')})` : ''}`;
    case 'HANDLING_RECORDED': return `Added ${p.kind || 'handling'} details`;
    case 'MEASUREMENT_RECORDED': return p.parameter ? `Measurement recorded: ${p.parameter}` : 'Measurement recorded';
    case 'EVIDENCE_ADDED': return `Evidence added (${p.kind || 'note'})`;
    case 'COLLECTION_UPDATED': return 'Collection details updated';
    case 'PASSPORT_GENERATED': return 'Passport generated';
    default: return eventMeta(e.event_type)[0];
  }
}

export function cap(s) {
  return s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '';
}
export const cleanName = (n = '') => n.replace(/\s*\(.*\)\s*$/, '').replace(/^Demo\s+/i, '');
export const firstName = (n = '') => cleanName(n).split(/\s+/)[0] || 'there';
export const initials = (n = '') => cleanName(n).split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

/** Product category -> image key / emoji tile key. */
export function productImage(name = '') {
  const n = name.toLowerCase();
  if (n.includes('honey')) return 'honey';
  if (n.includes('mahua')) return 'mahua';
  if (n.includes('medicinal') || n.includes('plant')) return 'medicinal';
  if (n.includes('seed') || n.includes('nut') || n.includes('sal')) return 'seeds';
  return 'ntfp';
}
