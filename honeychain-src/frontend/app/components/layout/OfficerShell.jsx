import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon';
import NotificationBell from './NotificationBell';
import { Logo } from '../ui/primitives';
import { useAuth } from '../../context/AuthContext';
import { useOfficerOverview } from '../../api/officer';
import { cleanName } from '../../lib/format';

// [path, label, icon, built]. `built:false` routes show an honest "planned" page.
export const OFFICER_NAV = [
  ['/officer/overview', 'Forest Inspector', 'globe', true],
  ['/officer/verification', 'Batch Verification', 'shieldcheck', true],
  ['/officer/quality', 'Quality Inspection', 'flask', true],
  ['/officer/centres', 'Collection Centres', 'building', true],
  ['/officer/collectors', 'Collector Management', 'users', true],
  ['/officer/market', 'Buyer & Market', 'handshake', true],
  ['/officer/schemes', 'Government Schemes', 'book', true],
  ['/officer/reports', 'Reports & Analytics', 'chart', true],
  ['/officer/audit', 'Audit Logs', 'hexa', true],
  ['/officer/officers', 'Officer Management', 'key', true],
  ['/officer/settings', 'Settings', 'settings', true],
];

function useOutside(ref, onOut) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOut();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOut]);
}

export default function OfficerShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);
  const overview = useOfficerOverview();
  const pending = overview.data?.totals.pending || 0;
  useOutside(ref, () => setMenu(false));

  useEffect(() => { setOpen(false); window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [pathname]);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  return (
    <div className="officer-mode">
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <button type="button" className="burger" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}><Icon name="menu" /></button>
        <Link className="brand" to="/officer/overview" aria-label="Officer portal home">
          <Logo />
          <small>Government Officer Portal</small>
        </Link>
        <div className="top-right">
          <NotificationBell />
          <div ref={ref} style={{ position: 'relative' }}>
            <button type="button" className="userbtn" aria-haspopup="true" onClick={() => setMenu((v) => !v)}>
              <span className="off-avatar" aria-hidden="true">{cleanName(user.name).slice(0, 1).toUpperCase()}</span>
              <div><b>{cleanName(user.name)}</b><small>{user.role === 'admin' ? 'Administrator' : 'Government Officer'}</small></div>
              <Icon name="down" />
            </button>
            <div className={`menu ${menu ? 'open' : ''}`}>
              <Link to="/market/verify" onClick={() => setMenu(false)}><Icon name="qr" /> Verify a batch</Link>
              <Link to="/market" onClick={() => setMenu(false)}><Icon name="store" /> Marketplace</Link>
              <Link to="/" onClick={() => setMenu(false)}><Icon name="globe" /> All portals</Link>
              <button type="button" onClick={async () => { await logout(); navigate('/'); }}><Icon name="lock" /> Sign out</button>
            </div>
          </div>
        </div>
      </header>

      <aside className={`sidebar ${open ? 'open' : ''}`} id="sidebar">
        <nav aria-label="Officer navigation">
          {OFFICER_NAV.map(([to, label, icon, built]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setOpen(false)}>
              <Icon name={icon} /><span>{label}</span>{to === '/officer/verification' && pending > 0 && <em className="nav-count">{pending}</em>}
            </NavLink>
          ))}
        </nav>
        <div className="side-art" />
        <div className="side-tag off-tag"><Icon name="shield" />Review. Verify.<br />Protect forest livelihoods.</div>
      </aside>
      {open && <div className="scrim on" onClick={() => setOpen(false)} />}

      <main id="main" className={`main${pathname === '/officer/overview' ? ' fi-bleed' : ''}`} tabIndex={-1}><div className="off-frame"><Outlet /></div></main>
    </div>
  );
}
