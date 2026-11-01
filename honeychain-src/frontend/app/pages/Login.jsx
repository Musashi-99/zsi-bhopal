import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import Icon from '../components/ui/Icon';
import { Logo } from '../components/ui/primitives';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useDocTitle } from '../hooks';

import { homeFor, isOfficer } from '../lib/roles';

// The portal tab is a hint only. The server checks the account's real role and the app redirects by it.
const TABS = [
  { id: 'collector', label: 'Collector / Producer', icon: 'leaf', does: 'Record a harvest, attach quality readings, and issue a quality passport. A collection centre checks stock here and replies to buyers.' },
  { id: 'buyer', label: 'Buyer', icon: 'handshake', does: 'Look through listed batches, send an enquiry, and follow the order. Browsing the market stays open without an account.' },
  { id: 'officer', label: 'Government Officer', icon: 'shield', does: 'Review a batch, record an inspection, and suspend or reinstate it. An administrator creates this account.' },
];
const DEMO = {
  collector: { email: 'mina@aranya.demo', password: 'collector123' },
  buyer: { email: 'buyer.haat@aranya.demo', password: 'buyer12345' },
  officer: { email: 'inspector@aranya.demo', password: 'inspector123' },
};

export default function Login() {
  useDocTitle('Sign in');
  const { login } = useAuth();
  const { toast } = useUI();
  const navigate = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const portalFrom = (search) => {
    const p = new URLSearchParams(search).get('portal');
    return ['collector', 'buyer', 'officer'].includes(p) ? p : 'collector';
  };
  const [portal, setPortal] = useState(() => portalFrom(loc.search));
  useEffect(() => setPortal(portalFrom(loc.search)), [loc.search]);
  const left = useRef(null);
  const bg = useRef(null);

  // GSAP entrance timeline + slow background drift
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.login-left .brand', { y: -20, opacity: 0, duration: 0.6 })
        .from('.login-left h1', { y: 30, opacity: 0, duration: 0.7 }, '-=0.3')
        .from('.login-left .tag-line', { y: 20, opacity: 0, duration: 0.5 }, '-=0.4')
        .from('.feat', { y: 18, opacity: 0, stagger: 0.1, duration: 0.45 }, '-=0.3')
        .from('.login-foot div', { y: 16, opacity: 0, stagger: 0.1, duration: 0.45 }, '-=0.3');
      gsap.to(bg.current, { scale: 1.06, duration: 22, ease: 'sine.inOut', repeat: -1, yoyo: true });
    }, left);
    return () => ctx.revert();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const u = await login(email.trim(), password, portal);
      const home = portal === 'officer' && isOfficer(u) ? '/officer/overview' : homeFor(u);
      navigate(home === '/dashboard' ? (loc.state?.from || home) : home, { replace: true });
    } catch (err) {
      setErrors({ form: err.message });
      toast(err.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page" ref={left}>
      <div className="login-bg" ref={bg} />
      <section className="login-left">
        <div className="brand"><Logo /></div>
        <div className="login-copy">
          <h1>Forest Produce<br />Quality-to-Price<br />Intelligence</h1>
          <p className="tag-line">Know your quality. Understand your price.<br />Improve your value.</p>
          <div className="feats">
            <div className="feat"><span className="sec-ic"><Icon name="leaf" /></span>Better<br />Quality</div>
            <div className="feat"><span className="sec-ic"><Icon name="chart" /></span>Better<br />Opportunities</div>
            <div className="feat"><span className="sec-ic"><Icon name="users" /></span>Greener<br />Tomorrow</div>
          </div>
        </div>
        <div className="login-foot">
          <div><Icon name="tree" />Forest<br />Communities</div>
          <div><Icon name="leaf" />Sustainable<br />Value Chains</div>
          <div><Icon name="users" />Stronger<br />Livelihoods</div>
        </div>
      </section>

      <section className="login-right">
        <div className="lang"><Icon name="globe" /><label className="sr" htmlFor="lang">Language</label>
          <select className="sel" id="lang" defaultValue="en"><option value="en">English</option><option disabled>हिन्दी (coming soon)</option><option disabled>বাংলা (coming soon)</option></select></div>
        <motion.form className="login-card" onSubmit={submit} noValidate initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}>
          <h2>Welcome back!</h2>
          <p className="lead">Sign in to continue to AranyaValue</p>

          <div className="portal-tabs" role="tablist" aria-label="Sign in as">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={portal === t.id} className={portal === t.id ? 'on' : ''} onClick={() => { setPortal(t.id); setErrors({}); }}>
                <Icon name={t.icon} />{t.label}
              </button>
            ))}
          </div>
          <p className="portal-does" key={portal}>{TABS.find((t) => t.id === portal).does}</p>

          <div className={`field ${errors.email ? 'bad' : ''}`}>
            <label htmlFor="email">Email Address</label>
            <div className="inp-ic"><Icon name="mail" /><input className="inp" id="email" type="email" autoComplete="email" placeholder="Enter your email address" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            {errors.email && <span className="errmsg" role="alert">{errors.email}</span>}
          </div>
          <div className={`field ${errors.password ? 'bad' : ''}`}>
            <label htmlFor="pw">Password</label>
            <div className="inp-ic"><Icon name="lock" />
              <input className="inp" id="pw" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" style={{ paddingRight: 48 }} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="tog" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)}><Icon name={show ? 'eyeoff' : 'eye'} /></button></div>
            {errors.password && <span className="errmsg" role="alert">{errors.password}</span>}
          </div>
          <div style={{ textAlign: 'right', margin: '-8px 0 22px' }}>
            <button type="button" className="link" style={{ fontSize: 14 }} onClick={() => toast('Password recovery is handled by your administrator in this build.')}>Forgot password?</button>
          </div>
          {errors.form && <div className="alert-red" role="alert" style={{ marginBottom: 14 }}>{errors.form}</div>}
          <motion.button className="btn primary block" type="submit" disabled={busy} whileTap={{ scale: 0.98 }}>
            <Icon name="lock" /> {busy ? 'Signing in…' : 'Sign In'}
          </motion.button>
          <div className="or">or</div>
          <div className="secure"><Icon name="shieldcheck" /><div><b>Secure Access</b><span>Your information is protected and used only for authenticated access to AranyaValue.</span></div></div>

          <div className="demo-row">
            <span>Demo accounts:</span>
            <button type="button" className="link" onClick={() => { setEmail(DEMO[portal].email); setPassword(DEMO[portal].password); setErrors({}); }}>
              {TABS.find((t) => t.id === portal).label}
            </button>
            <span className="grow" />
            {portal !== 'officer' && <Link className="link" to="/register">Create account</Link>}
            <Link className="link" to="/verify">Verify a batch</Link>
          </div>
        </motion.form>
      </section>
    </div>
  );
}
