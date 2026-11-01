import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../ui/Icon';
import { Logo } from '../ui/primitives';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { MarketProvider, useMarket } from '../../context/MarketContext';
import { useListings, useMyOverview, useStoreMeta } from '../../api/market';
import { useDebounced } from '../../hooks';
import { homeFor } from '../../lib/roles';
import { inr } from '../../lib/market';
import EnquiryModal from './EnquiryModal';
import { MImg } from './parts';

const NAV = [
  ['/market', 'Home', 'home', true],
  ['/market/products', 'All Products', 'grid'],
  ['/market/categories', 'Categories', 'tag'],
  ['/market/centres', 'Collection Centres', 'building'],
  ['/market/catalogue', 'NTFP Catalogue', 'book'],
  ['/market/how-it-works', 'How It Works', 'help'],
  ['/market/about', 'About AranyaValue', 'leaf'],
];

function useOutside(ref, fn) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && fn();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, fn]);
}

function SearchBar({ onDone }) {
  const nav = useNavigate();
  const meta = useStoreMeta();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const box = useRef(null);
  const dq = useDebounced(q.trim(), 200);
  const sug = useListings(dq.length >= 2 ? { q: dq, category: cat, limit: 5 } : { limit: 1, q: '__none__' });
  useOutside(box, () => setOpen(false));
  const items = dq.length >= 2 ? sug.data?.listings || [] : [];

  const go = (e) => {
    e?.preventDefault();
    setOpen(false);
    onDone?.();
    nav(`/market/products?${new URLSearchParams({ ...(q.trim() ? { q: q.trim() } : {}), ...(cat ? { category: cat } : {}) })}`);
  };
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, -1)); }
    else if (e.key === 'Enter' && hi >= 0 && items[hi]) { e.preventDefault(); setOpen(false); onDone?.(); nav(`/market/p/${items[hi].code}`); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <form className="mk-search" role="search" onSubmit={go} ref={box}>
      <label className="sr" htmlFor="mk-cat">Category</label>
      <select id="mk-cat" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Search category">
        <option value="">All</option>
        {(meta.data?.categories || []).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
      </select>
      <label className="sr" htmlFor="mk-q">Search forest produce, batch IDs, centres or districts</label>
      <input id="mk-q" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(-1); }} onFocus={() => setOpen(true)} onKeyDown={key}
        placeholder="Search produce, local names, batch ID, centre or district" autoComplete="off" role="combobox" aria-expanded={open && items.length > 0} aria-controls="mk-sug" />
      <button type="submit" aria-label="Search"><Icon name="search" /></button>
      {open && dq.length >= 2 && (
        <div className="mk-suggest" id="mk-sug" role="listbox">
          {items.map((l, i) => (
            <Link key={l.code} to={`/market/p/${l.code}`} role="option" aria-selected={hi === i} className={hi === i ? 'on' : ''} onClick={() => { setOpen(false); onDone?.(); }}>
              <MImg src={l.image} alt="" slug={l.product.market_category?.slug} />
              <span style={{ minWidth: 0 }}><b style={{ display: 'block' }}>{l.title}</b><small className="muted">{l.district.name} · {l.code}{l.price ? ` · ${inr(l.price.amount)}/${l.price.unit}` : ''}</small></span>
            </Link>
          ))}
          {!sug.isFetching && items.length === 0 && <div style={{ padding: '14px', fontSize: 14 }} className="muted">No match for “{dq}”. Press Enter to search the full catalogue.</div>}
          <Link to={`/market/products?q=${encodeURIComponent(dq)}`} style={{ borderTop: '1px solid var(--mk-line)', fontWeight: 600, color: 'var(--mk-green3)' }} onClick={() => { setOpen(false); onDone?.(); }}><Icon name="search" /> See all results for “{dq}”</Link>
        </div>
      )}
    </form>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const { isBuyer, demoLogin } = useMarket();
  const { toast } = useUI();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  const ov = useMyOverview(isBuyer);
  const first = user ? String(user.name).replace(/\s*\(.*?\)\s*/g, '').replace(/^Demo\s+(buyer\s*[—-]\s*)?/i, '').split(' ')[0] : null;
  const out = async () => { setOpen(false); await logout(); nav('/login'); };
  const demo = async () => { try { await demoLogin(); setOpen(false); } catch (e) { toast(e.message, 'err'); } };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="mk-act" onClick={() => setOpen((v) => !v)} aria-haspopup="true" aria-expanded={open}>
        <Icon name="user" /><span><small>{user ? `Hello, ${first || 'there'}` : 'Hello, buyer'}</small><b>{isBuyer ? 'Account & orders' : user ? 'Account' : 'Sign in'}</b></span>
        {ov.data?.unread_notifications > 0 && <span className="count">{ov.data.unread_notifications}</span>}
      </button>
      {open && (
        <div className="mk-menu" role="menu">
          {isBuyer ? (
            <>
              <div className="who"><b>{user.name.replace(/\s*\(.*?\)/, '')}</b><span className="muted">{user.organisation || user.email}</span>{user.is_demo && <div className="mt8"><span className="pill demo">DEMO BUYER</span></div>}</div>
              <hr />
              <Link to="/market/account" onClick={() => setOpen(false)}><Icon name="home" /> Overview</Link>
              <Link to="/market/account/enquiries" onClick={() => setOpen(false)}><Icon name="msg" /> My enquiries</Link>
              <Link to="/market/account/orders" onClick={() => setOpen(false)}><Icon name="package" /> My orders</Link>
              <Link to="/market/account/saved" onClick={() => setOpen(false)}><Icon name="heart" /> Saved items</Link>
              <hr />
              <button type="button" onClick={out}><Icon name="lock" /> Log out</button>
            </>
          ) : user ? (
            <>
              <div className="who"><b>{user.name.replace(/\s*\(.*?\)/, '')}</b><span className="muted" style={{ textTransform: 'capitalize' }}>Signed in to the {user.role === 'inspector' || user.role === 'admin' ? 'Officer' : 'Producer'} portal</span></div>
              <hr />
              <Link to={homeFor(user)} onClick={() => setOpen(false)}><Icon name="leaf" /> Back to my portal</Link>
              <button type="button" onClick={demo}><Icon name="handshake" /> Switch to Demo Buyer</button>
              <button type="button" onClick={out}><Icon name="lock" /> Log out</button>
            </>
          ) : (
            <>
              <div style={{ padding: 8 }}>
                <button type="button" className="btn gold block" onClick={demo}><Icon name="sparkle" /> Demo Buyer — one click</button>
                <Link className="btn block mt8" to="/market/login" onClick={() => setOpen(false)}>Sign in / Create account</Link>
                <p className="xs muted mt8">Browsing and QR verification never need an account.</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Header({ onMenu }) {
  const { basket } = useMarket();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const out = async () => { await logout(); nav('/login'); };
  return (
    <>
      <div className="mk-strip"><div className="wrap">
        <div>West Bengal forest produce · batch records, quality evidence and collection centres</div>
        <div><Link to="/login">Producer portal</Link><Link to="/login?portal=officer">Officer portal</Link><Link to="/">All portals</Link></div>
      </div></div>
      <header className="mk-head">
        <div className="wrap">
          <button type="button" className="mk-burger" aria-label="Open menu" onClick={onMenu}><Icon name="menu" /></button>
          <Link to="/market" className="mk-logo" aria-label="AranyaValue Marketplace home"><Logo /><span><small>Marketplace</small></span></Link>
          <SearchBar />
          <div className="mk-actions">
            <Link className="mk-act" to="/market/verify" title="Verify a batch"><Icon name="qr" /><span><small>Scan or enter</small><b>Verify batch</b></span></Link>
            <AccountMenu />
            <Link className="mk-act" to="/market/basket" aria-label={`Enquiry basket, ${basket.length} items`}><Icon name="cart" /><span><small>Enquiry</small><b>Basket</b></span>{basket.length > 0 && <span className="count">{basket.length}</span>}</Link>
          </div>
        </div>
      </header>
      <nav className="mk-nav" aria-label="Marketplace">
        <div className="wrap">
          {user && <button type="button" className="mk-out" onClick={out}><Icon name="lock" /> Log out</button>}
          {NAV.map(([to, label, , end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>)}
          <span className="sp" />
          <NavLink to="/market/verify" className="verify-link"><Icon name="shieldcheck" /> Verify Batch</NavLink>
        </div>
      </nav>
    </>
  );
}

function Drawer({ open, onClose }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const out = async () => { onClose(); await logout(); nav('/login'); };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="mk-drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside className="mk-drawer" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: 0.25 }} aria-label="Menu">
            <header><span>AranyaValue Marketplace</span><button type="button" className="iconbtn" onClick={onClose} aria-label="Close menu"><Icon name="x" /></button></header>
            <nav>
              <h5>Shop</h5>
              {NAV.map(([to, label, icon, end]) => <NavLink key={to} to={to} end={end} onClick={onClose} className={({ isActive }) => (isActive ? 'active' : '')}><Icon name={icon} /> {label}</NavLink>)}
              <NavLink to="/market/verify" onClick={onClose}><Icon name="qr" /> Verify Batch</NavLink>
              <h5>Your account</h5>
              <NavLink to="/market/account" onClick={onClose}><Icon name="user" /> {user?.role === 'buyer' ? 'My account' : 'Sign in'}</NavLink>
              <NavLink to="/market/basket" onClick={onClose}><Icon name="cart" /> Enquiry basket</NavLink>
              <h5>Other portals</h5>
              <Link to="/login" onClick={onClose}><Icon name="leaf" /> Producer / Collection Centre</Link>
              <Link to="/login?portal=officer" onClick={onClose}><Icon name="shield" /> Government Officer</Link>
              <Link to="/" onClick={onClose}><Icon name="globe" /> All portals</Link>
              {user && <button type="button" onClick={out}><Icon name="lock" /> Log out</button>}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Footer() {
  return (
    <footer className="mk-foot">
      <div className="top"><Link to="/market/verify">Scanned a QR code? Verify the batch →</Link></div>
      <div className="wrap cols">
        <div>
          <div className="mk-logo" style={{ marginBottom: 12 }}><Logo /></div>
          <p style={{ fontSize: 14, maxWidth: 320 }}>Know exactly what you are buying: where the batch came from, which centre handled it, what was checked and what evidence exists.</p>
        </div>
        <div><h4>Shop</h4><Link to="/market/products">All products</Link><Link to="/market/categories">Categories</Link><Link to="/market/catalogue">NTFP catalogue</Link><Link to="/market/centres">Collection centres</Link></div>
        <div><h4>Trust</h4><Link to="/market/verify">Verify a batch</Link><Link to="/market/how-it-works">How it works</Link><Link to="/market/about">About AranyaValue</Link><Link to="/market/account">Buyer account</Link></div>
        <div><h4>Portals</h4><Link to="/login">Producer / Collection Centre</Link><Link to="/login?portal=officer">Government Officer</Link><Link to="/">Portal home</Link></div>
      </div>
      <div className="wrap fine">
        Prices are indicative and set by sellers; they are not final purchase prices or market rates. A QR code only opens a record — it does not prove authenticity by itself. AranyaValue accreditation is a private programme and is not a government licence.
      </div>
    </footer>
  );
}

export default function MarketShell() {
  return (
    <MarketProvider>
      <Frame />
    </MarketProvider>
  );
}

function Frame() {
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); setDrawer(false); }, [pathname]);
  useEffect(() => { document.documentElement.style.scrollBehavior = 'auto'; return () => { document.documentElement.style.scrollBehavior = ''; }; }, []);
  return (
    <div className="mk">
      <a className="skip" href="#mk-main" style={{ position: 'absolute', left: -9999 }}>Skip to content</a>
      <Header onMenu={() => setDrawer(true)} />
      <Drawer open={drawer} onClose={() => setDrawer(false)} />
      <main id="mk-main" className="mk-main" tabIndex={-1}>
        <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
          <Outlet />
        </motion.div>
      </main>
      <Footer />
      <EnquiryModal />
    </div>
  );
}
