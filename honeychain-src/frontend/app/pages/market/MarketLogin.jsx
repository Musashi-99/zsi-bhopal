import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useMarket } from '../../context/MarketContext';
import { useDocTitle } from '../../hooks';
import { homeFor } from '../../lib/roles';

export default function MarketLogin() {
  useDocTitle('Buyer sign in');
  const { user, login } = useAuth();
  const { isBuyer, demoLogin } = useMarket();
  const { toast } = useUI();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get('next') || '/market/account';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const go = (path) => navigate(path.startsWith('/market') ? path : '/market', { replace: true });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const u = await login(email.trim(), password, 'buyer');
      toast(`Signed in as ${u.name}.`);
      go(u.role === 'buyer' ? next : homeFor(u));
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  const demo = async (creds) => {
    setErr('');
    setBusy(true);
    try { await demoLogin(creds); go(next); } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  if (isBuyer) {
    return (
      <div className="wrap"><div className="mk-authbox">
        <h1>You’re signed in</h1>
        <p className="muted">{user.name}{user.is_demo ? ' · Demo Buyer' : ''}</p>
        <Link className="btn gold block mt16" to="/market/account">Go to my account</Link>
      </div></div>
    );
  }

  return (
    <div className="wrap">
      <div className="mk-authbox">
        <h1>Buyer sign in</h1>
        <p className="muted">Browsing and QR checks stay open without an account. Sign in only to enquire, order or save.</p>
        <form className="stack mt16" onSubmit={submit} noValidate>
          <div className="field"><label htmlFor="be">Email</label><input id="be" className="inp" type="text" autoComplete="off" placeholder="Anything" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label htmlFor="bp">Password</label><input id="bp" className="inp" type="text" autoComplete="off" placeholder="Anything" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {err && <div className="mk-alert danger" role="alert"><Icon name="alert" /><div>{err}</div></div>}
          <button className="btn green block" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="sm mt12">New buyer? <Link className="linkbtn" to="/register?role=buyer">Create an account</Link></p>

        <div className="mk-demo-cta mt24">
          <b>Demo Buyer access</b>
          <p className="sm mt8">Any email and password signs in as the Demo Buyer.</p>
          <button type="button" className="btn gold block mt12" disabled={busy} onClick={() => demo()}><Icon name="sparkle" /> Continue as Demo Buyer</button>
        </div>
        <p className="xs muted mt16"><Link className="linkbtn" to="/">All portals</Link> · <Link className="linkbtn" to="/login?portal=collector">Producer sign in</Link> · <Link className="linkbtn" to="/login?portal=officer">Officer sign in</Link></p>
      </div>
    </div>
  );
}
