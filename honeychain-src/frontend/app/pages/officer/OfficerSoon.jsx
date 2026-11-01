import { useLocation } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { Card, EmptyState } from '../../components/ui/primitives';
import { OFFICER_NAV } from '../../components/layout/OfficerShell';
import { useDocTitle } from '../../hooks';

const PHASE = {
  verification: 'Phase 2 · approve, reject with reason, request correction',
  quality: 'Phase 3 · measurements by evidence source, versioned records',
  centres: 'Phase 4 · centre status, operators, inventory',
  collectors: 'Phase 4 · collector activity, duplicate and suspicious-submission flags',
  market: 'Phase 4 · buyers, enquiries, offers, transactions',
  schemes: 'Phase 5 · publish, expire and edit schemes shown in the main portal',
  reports: 'Phase 5 · CSV exports from real records',
  audit: 'Phase 5 · hash-chain events and chain integrity check',
  officers: 'Phase 5 · administrator-created officer accounts',
  settings: 'Phase 5 · jurisdiction and notification settings',
};

export default function OfficerSoon() {
  const { pathname } = useLocation();
  const key = pathname.split('/')[2];
  const item = OFFICER_NAV.find(([to]) => to.endsWith(`/${key}`));
  useDocTitle(item ? item[1] : 'Officer portal');
  return (
    <>
      <div className="pagehead"><div><h1>{item ? item[1] : 'Officer portal'}</h1><p>This module is planned and not yet available.</p></div></div>
      <Card>
        <EmptyState icon={item ? item[2] : 'info'} title="Not built yet">
          <span>{PHASE[key] || 'See docs/officer-portal-plan.md'}</span>
        </EmptyState>
        <p className="sub" style={{ textAlign: 'center' }}><Icon name="info" /> Nothing on this page is mock data. The full plan is in <code>docs/officer-portal-plan.md</code>.</p>
      </Card>
    </>
  );
}
