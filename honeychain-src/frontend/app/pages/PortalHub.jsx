import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Icon from '../components/ui/Icon';
import { Logo } from '../components/ui/primitives';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useDocTitle } from '../hooks';
import { api } from '../lib/api';
import { homeFor, isOfficer } from '../lib/roles';

const CARDS = [
  {
    key: 'producer',
    icon: 'leaf',
    title: 'Producer / Collection Centre',
    text: 'Collectors and collection centres record batches, quality checks, passports and inventory.',
    points: ['Create and submit batches', 'Quality passport and QR', 'Answer buyer enquiries'],
    go: 'Open producer portal',
  },
  {
    key: 'officer',
    icon: 'shield',
    title: 'Government Officer',
    text: 'Authorised officers review batches, record inspections and watch compliance.',
    points: ['Verify or reject a batch', 'Suspend a batch immediately', 'Centre accreditation'],
    go: 'Open officer portal',
  },
  {
    key: 'market',
    market: true,
    icon: 'store',
    title: 'Marketplace',
    text: 'Buyers browse forest produce, read batch evidence and send enquiries. No account is needed to look or to scan a QR code.',
    points: ['Browse without signing in', 'Live batch verification', 'Enquiries and orders'],
    go: 'Enter marketplace',
    tag: 'Buyers',
  },
];

export default function PortalHub() {
  useDocTitle('Portals');
  const { user, ready, logout, setUser } = useAuth();
  const { toast } = useUI();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const dest = {
    producer: user && (user.role === 'collector' || user.role === 'centre') ? '/dashboard' : '/login?portal=collector',
    officer: isOfficer(user) ? '/officer/overview' : '/login?portal=officer',
    market: '/market',
  };

  const demo = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api('/api/store/demo-login', { method: 'POST', body: {} });
      qc.clear();
      const me = await api('/api/auth/me');
      setUser(me.user);
      toast('Signed in as the Demo Buyer.');
      navigate('/market/account');
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  return (
    <div className="hub">
      <div className="bg" />
      <header className="hub-top">
        <Link to="/" className="mk-logo" style={{ textDecoration: 'none' }} aria-label="AranyaValue"><Logo /></Link>
        <div className="row" style={{ gap: 10 }}>
          <Link className="btn ghost sm" to="/market/verify"><Icon name="qr" /> Verify a batch</Link>
          {!user && <Link className="btn gold sm" to="/login">Sign in</Link>}
        </div>
      </header>
      <main className="hub-main">
        <div className="eyebrow" style={{ color: '#C69A45', letterSpacing: '.16em', fontWeight: 700, fontSize: 12 }}>FOREST PRODUCE · WEST BENGAL</div>
        <h1>One batch record.<br /><em>Three ways in.</em></h1>
        <p className="sub">Producers record it. Officers review it. Buyers read the same status, quality evidence and collection centre.</p>
        {ready && user && (
          <div className="hub-session">
            <span>Signed in as <b>{user.name.replace(/\s*\(.*?\)/, '')}</b></span>
            <Link to={homeFor(user)}>Continue</Link>
            <button type="button" onClick={() => logout()}>Sign out</button>
          </div>
        )}
        <div className="hub-cards">
          {CARDS.map((c) => (
            <Link key={c.key} className={`hub-card${c.market ? ' market' : ''}`} to={dest[c.key]}>
              {c.tag && <span className="tag">{c.tag}</span>}
              <div className="ic"><Icon name={c.icon} /></div>
              <h2>{c.title}</h2>
              <p>{c.text}</p>
              <ul>{c.points.map((p) => <li key={p}><Icon name="check" />{p}</li>)}</ul>
              <span className="go">{c.go} <Icon name="arrow" /></span>
              {c.market && (
                <button type="button" className="btn gold sm" onClick={demo} style={{ alignSelf: 'flex-start' }}>
                  <Icon name="sparkle" /> Demo Buyer — one click
                </button>
              )}
            </Link>
          ))}
        </div>
      </main>
      <footer className="hub-foot">One batch record shared by producers, officers and buyers.</footer>
    </div>
  );
}
