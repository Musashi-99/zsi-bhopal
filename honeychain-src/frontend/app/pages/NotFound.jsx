import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon';
import { useDocTitle } from '../hooks';

export default function NotFound() {
  useDocTitle('Page not found');
  return (
    <div className="boot" style={{ textAlign: 'center', paddingTop: 96 }}>
      <Icon name="search" style={{ fontSize: 44, color: 'var(--g500)' }} />
      <h1 style={{ fontSize: 28, margin: '12px 0 6px' }}>Page not found</h1>
      <p className="sub" style={{ fontSize: 15 }}>The page you are looking for does not exist or has moved.</p>
      <Link className="btn primary" style={{ marginTop: 20 }} to="/">All portals</Link>
    </div>
  );
}
