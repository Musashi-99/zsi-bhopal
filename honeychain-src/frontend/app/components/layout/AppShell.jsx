import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import gsap from 'gsap';
import Icon from '../ui/Icon';
import NotificationBell from './NotificationBell';
import { Img, Logo } from '../ui/primitives';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../api/queries';
import { cleanName } from '../../lib/format';
import { pageVariants } from '../../lib/motion';

const COLLECTOR_NAV = [
  ['/dashboard', 'Dashboard', 'home'],
  ['/batches', 'My Batches', 'package'],
  ['/batches/new', 'Create Batch', 'plus'],
  ['/passport', 'Quality Passport', 'file'],
  ['/quality-price', 'Quality to Price', 'chart'],
  ['/buyers', 'Buyers', 'users'],
  ['/marketplace', 'Marketplace Desk', 'store'],
  ['/post-harvest', 'Post-Harvest Assistant', 'leaf'],
  ['/rejections', 'Rejection & Recovery', 'alert'],
  ['/audit', 'Audit Ledger', 'hexa'],
  ['/schemes', 'Government Schemes', 'settings'],
  ['/profile', 'Profile & Settings', 'settings'],
];
const OTHER_NAV = [
  ['/dashboard', 'Dashboard', 'home'],
  ['/buyers', 'Buyer Requirements', 'users'],
  ['/marketplace', 'Marketplace Desk', 'store'],
  ['/schemes', 'Government Schemes', 'settings'],
  ['/profile', 'Profile & Settings', 'settings'],
];

function useOutside(ref, onOut) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOut();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOut]);
}

function Menu({ open, children, className = '' }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className={`menu open ${className}`} initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TopBar({ onMenu, navOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const dash = useDashboard();
  const [bell, setBell] = useState(false);
  const [usr, setUsr] = useState(false);
  const bellRef = useRef(null);
  const usrRef = useRef(null);
  useOutside(bellRef, () => setBell(false));
  useOutside(usrRef, () => setUsr(false));
  const alerts = dash.data?.alerts || [];

  return (
    <header className="topbar">
      <button type="button" className="burger" aria-label="Open menu" aria-expanded={navOpen} onClick={onMenu}><Icon name="menu" /></button>
      <Link className="brand" to="/dashboard" aria-label="AranyaValue home">
        <Logo />
      </Link>
      <div className="top-right">
        <NotificationBell extra={alerts.slice(0, 3).map((a) => ({ to: `/passport/${a.batch_id}`, text: a.text, hint: `Batch ${a.batch_code}` }))} />
        <div ref={usrRef} style={{ position: 'relative' }}>
          <button type="button" className="userbtn" aria-haspopup="true" aria-label="Account menu" onClick={() => { setUsr((v) => !v); }}>
            <Img name="avatar" alt={cleanName(user.name)} />
            <div><b>{cleanName(user.name)}</b><small style={{ textTransform: 'capitalize' }}>{user.role}</small></div>
            <Icon name="down" />
          </button>
          <Menu open={usr}>
            <Link to="/profile" onClick={() => setUsr(false)}><Icon name="user" /> Profile & Settings</Link>
            <Link to="/verify" onClick={() => setUsr(false)}><Icon name="qr" /> Verify a batch</Link>
            <Link to="/market" onClick={() => setUsr(false)}><Icon name="store" /> Marketplace</Link>
            <button type="button" onClick={async () => { await logout(); navigate('/'); }}><Icon name="lock" /> Sign out</button>
          </Menu>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const nav = useRef(null);
  const items = user.role === 'collector' ? COLLECTOR_NAV : OTHER_NAV;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const tween = gsap.fromTo(nav.current.querySelectorAll('a'), { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.45, stagger: 0.04, ease: 'power3.out', delay: 0.1 });
    return () => tween.kill();
  }, [user.role]);

  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`} id="sidebar">
        <nav ref={nav} aria-label="Main">
          {items.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/batches' || to === '/dashboard'} onClick={onClose} className={({ isActive }) => (isActive ? 'active' : '')}>
              {({ isActive }) => (<>{isActive && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}<Icon name={icon} /><span>{label}</span></>)}
            </NavLink>
          ))}
        </nav>
        <div className="side-art" />
        <div className="side-tag"><Icon name="leaf" />Better Quality<br />Better Opportunities<br />Greener Tomorrow</div>
      </aside>
      <AnimatePresence>
        {open && <motion.div className="scrim on" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />}
      </AnimatePresence>
    </>
  );
}

export default function AppShell() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const main = useRef(null);
  const outlet = useOutlet();

  useEffect(() => { setOpen(false); window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [pathname]);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // route key: group detail pages with their list so sibling navigation animates correctly
  const key = pathname;
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <TopBar onMenu={() => setOpen((v) => !v)} navOpen={open} />
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <main id="main" ref={main} className="main" tabIndex={-1}>
        <AnimatePresence initial={false}>
          <motion.div key={key} className="page-pane" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  );
}
