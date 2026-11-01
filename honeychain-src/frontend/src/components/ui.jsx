import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, homeFor } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n';

export function Leaf() {
  return (
    <i aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5c1.2 3 4.8 4.2 4.8 7.6A4.8 4.8 0 1 1 3.2 9.1C3.2 5.7 6.8 4.5 8 1.5Z" fill="#F4F0E6" />
      </svg>
    </i>
  );
}

export function Loading() {
  const { t } = useLang();
  return <p className="muted" role="status">{t('loading')}…</p>;
}

export function Empty({ title, body, action }) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      {body && <p className="muted">{body}</p>}
      {action}
    </div>
  );
}

export function Stamp({ tone, children }) {
  return <span className={`stamp ${tone || 'wait'}`}>{children}</span>;
}

export function statusTone(status) {
  if (['verified', 'eligible', 'accepted', 'ready'].includes(status)) return 'ok';
  if (['rejected', 'failed_checks', 'not_eligible', 'does_not_meet'].includes(status)) return 'no';
  if (status === 'simulated') return 'sim';
  return 'wait';
}

export function outcomeLabel(outcome) {
  return {
    meets_recorded_specification: 'Meets recorded spec',
    does_not_meet: 'Does not meet',
    needs_additional_evidence: 'Needs evidence',
    cannot_be_assessed: 'Cannot assess',
    specification_unavailable: 'Not configured',
    optional_missing: 'Optional, missing',
    eligible: 'Eligible',
    conditional: 'Conditional',
    not_eligible: 'Not eligible',
    insufficient_evidence: 'Insufficient evidence',
    self_reported: 'Self-reported',
    measured: 'Measured',
    imported: 'Imported',
    simulated: 'Simulated',
    unavailable: 'Unavailable',
    verified: 'Verified',
    verified_with_limitations: 'Verified with limits',
    pending_verification: 'Pending review',
    needs_info: 'Needs information',
    failed_checks: 'Failed checks',
    rejected: 'Rejected',
    draft: 'Draft',
    dispatched: 'Dispatched',
    demonstration: 'Demonstration sample',
    recorded_offer: 'Recorded in this app',
  }[outcome] || String(outcome || '').replaceAll('_', ' ');
}

export function Banner() {
  const [text, setText] = useState('');
  const [hide, setHide] = useState(sessionStorage.getItem('aranya_banner_hide') === '1');
  useEffect(() => {
    api('/api/meta').then((d) => setText(d.banner || '')).catch(() => {});
  }, []);
  if (!text || hide) return null;
  return (
    <div className="banner">
      {text}{' '}
      <button className="icon-btn" style={{ width: 'auto', padding: '0 10px' }} onClick={() => { sessionStorage.setItem('aranya_banner_hide', '1'); setHide(true); }}>OK</button>
    </div>
  );
}

export function LangState() {
  const { lang, setLang, stateId, setStateId, t } = useLang();
  const [states, setStates] = useState([]);
  useEffect(() => { api('/api/meta').then((d) => setStates(d.states || [])).catch(() => {}); }, []);
  return (
    <div className="row">
      <label className="field" style={{ minWidth: 120 }}>
        <span className="small">{t('language')}</span>
        <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('language')}>
          <option value="en">English</option>
          <option value="bn">বাংলা</option>
          <option value="hi">हिन्दी</option>
        </select>
      </label>
      <label className="field" style={{ minWidth: 150 }}>
        <span className="small">{t('state')}</span>
        <select value={stateId} onChange={(e) => setStateId(e.target.value)} aria-label={t('state')}>
          {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
    </div>
  );
}

const PUBLIC = [
  ['/', 'home'],
  ['/how-it-works', 'how'],
  ['/marketplace', 'market'],
  ['/schemes', 'schemes'],
  ['/products', 'products'],
  ['/about', 'about'],
];

export function PublicLayout() {
  const { t } = useLang();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Banner />
      <header className="pub-top">
        <Link className="brand" to="/"><Leaf /> {t('brand')}</Link>
        <nav className="nav-links grow">
          {PUBLIC.slice(1).map(([to, key]) => <NavLink key={to} to={to}>{t(key)}</NavLink>)}
        </nav>
        <div className="grow" />
        {user ? <Link className="btn forest" to={homeFor(user.role)}>{t('home')}</Link> : <Link className="btn ghost" to="/login">{t('login')}</Link>}
        <button className="icon-btn menu-btn" aria-label={t('menu')} onClick={() => setOpen(true)}>☰</button>
      </header>
      {open && (
        <div className="menu-panel">
          <button className="icon-btn" style={{ alignSelf: 'flex-end' }} onClick={() => setOpen(false)} aria-label={t('close')}>✕</button>
          {PUBLIC.map(([to, key]) => <Link key={to} to={to}>{t(key)}</Link>)}
          <Link to="/contact">{t('contact')}</Link>
          <LangState />
          {user ? <Link to={homeFor(user.role)}>{t('home')}</Link> : <Link to="/register">{t('start')}</Link>}
        </div>
      )}
      <main id="main" className="page"><Outlet /></main>
      <footer className="page small muted">
        <div className="row">
          <Link to="/about">{t('about')}</Link>
          <Link to="/contact">{t('contact')}</Link>
          <Link to="/privacy">{t('privacy')}</Link>
          <Link to="/terms">{t('terms')}</Link>
          <a href="https://trifed.tribal.gov.in/pmvdy">TRIFED Van Dhan</a>
          <a href="https://tribal.nic.in/FRA.aspx">FRA, Ministry of Tribal Affairs</a>
        </div>
        <p>A QR code opens a record. It does not prove origin or certification. Source declared on a passport means independent verification is unavailable unless a reviewer recorded otherwise.</p>
      </footer>
    </>
  );
}

const TABS = {
  collector: [
    ['/collector/dashboard', 'home'],
    ['/collector/batches', 'batches'],
    ['/collector/batches/new', 'newBatch'],
    ['/collector/offers', 'offers'],
  ],
  buyer: [
    ['/buyer/dashboard', 'home'],
    ['/buyer/marketplace', 'market'],
    ['/buyer/requirements', 'requirements'],
    ['/buyer/offers', 'offers'],
  ],
  inspector: [
    ['/inspector/dashboard', 'queue'],
    ['/inspector/history', 'history'],
    ['/schemes', 'schemes'],
    ['/inspector/queue', 'batches'],
  ],
  centre: [
    ['/centre/dashboard', 'home'],
    ['/centre/inventory', 'inventory'],
    ['/centre/batches', 'batches'],
    ['/centre/orders', 'dispatch'],
  ],
  admin: [
    ['/admin/dashboard', 'home'],
    ['/admin/users', 'users'],
    ['/admin/products', 'products'],
    ['/admin/audit-logs', 'audit'],
  ],
};

const MORE = {
  collector: [
    ['/collector/passports', 'passports'],
    ['/collector/buyers', 'buyers'],
    ['/collector/schemes', 'schemes'],
    ['/collector/assistant', 'guide'],
    ['/collector/profile', 'profile'],
  ],
  buyer: [
    ['/buyer/orders', 'orders'],
    ['/buyer/requirements/new', 'requirements'],
    ['/buyer/profile', 'profile'],
    ['/schemes', 'schemes'],
  ],
  inspector: [
    ['/inspector/queue', 'queue'],
    ['/products', 'products'],
  ],
  centre: [
    ['/centre/collectors', 'collectors'],
    ['/centre/quality-checks', 'queue'],
    ['/centre/processing', 'processing'],
    ['/centre/analytics', 'analytics'],
    ['/centre/settings', 'settings'],
  ],
  admin: [
    ['/admin/quality-profiles', 'guide'],
    ['/admin/states', 'state'],
    ['/admin/districts', 'state'],
    ['/admin/centres', 'centres'],
    ['/admin/schemes', 'schemes'],
    ['/admin/settings', 'settings'],
  ],
};

export function AppLayout() {
  const { t } = useLang();
  const { user, logout } = useAuth();
  const [more, setMore] = useState(false);
  const nav = useNavigate();
  const role = user?.role || 'collector';
  const tabs = TABS[role] || TABS.collector;
  const extra = MORE[role] || [];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to={homeFor(role)} style={{ color: 'inherit', margin: '4px 8px 16px' }}><Leaf /> {t('brand')}</Link>
        {[...tabs, ...extra].map(([to, key]) => <NavLink key={to} to={to}>{t(key)}</NavLink>)}
        <div className="grow" />
        <button onClick={() => logout().then(() => nav('/'))}>{t('logout')}</button>
      </aside>
      <header className="app-top">
        <Link className="brand" to={homeFor(role)}><Leaf /> {t('brand')}</Link>
        <div className="grow" />
        <span className="small">{user?.name?.split(' ')[0]}</span>
      </header>
      <main id="main" className="app-main"><Outlet /></main>
      <nav className="tabbar" aria-label="Primary">
        {tabs.map(([to, key]) => <NavLink key={to} to={to}>{t(key)}</NavLink>)}
        <button type="button" onClick={() => setMore(true)}>{t('more')}</button>
      </nav>
      {more && (
        <>
          <div className="sheet-back" onClick={() => setMore(false)} />
          <div className="sheet" role="dialog" aria-label={t('more')}>
            <div className="handle" />
            <div className="stack">
              {extra.map(([to, key]) => <Link key={to} className="btn ghost" to={to} onClick={() => setMore(false)}>{t(key)}</Link>)}
              <LangState />
              <button className="btn ghost" onClick={() => logout().then(() => nav('/'))}>{t('logout')}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Guard({ roles }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}
