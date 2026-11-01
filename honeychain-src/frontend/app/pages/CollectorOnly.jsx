import { Link } from 'react-router-dom';
import PageHero from '../components/layout/PageHero';
import { Card, EmptyState } from '../components/ui/primitives';
import { useAuth } from '../context/AuthContext';

export default function CollectorOnly() {
  const { user } = useAuth();
  return (
    <>
      <PageHero title="Collector workspace" sub="This section is built for forest-produce collectors." />
      <Card>
        <EmptyState icon="lock" title="Not available for your role">
          You are signed in as a {user.role}. Batches, passports and recovery tools belong to collector accounts.
          <div className="mt12"><Link className="btn primary" to="/dashboard">Go to dashboard</Link></div>
        </EmptyState>
      </Card>
    </>
  );
}
