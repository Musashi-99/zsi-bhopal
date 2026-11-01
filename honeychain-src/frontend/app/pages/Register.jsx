import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../components/ui/Icon';
import { Field, Input, Logo, Select } from '../components/ui/primitives';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useMeta } from '../api/queries';
import { useDocTitle } from '../hooks';
import { homeFor } from '../lib/roles';

export default function Register() {
  useDocTitle('Create account');
  const { register } = useAuth();
  const { toast } = useUI();
  const navigate = useNavigate();
  const meta = useMeta();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', role: sp.get('role') === 'buyer' ? 'buyer' : 'collector', state_id: '', district_id: '', organisation: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value, ...(k === 'state_id' ? { district_id: '' } : {}) }));
  const districts = (meta.data?.districts || []).filter((d) => !f.state_id || d.state_id === f.state_id);

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!f.name.trim()) err.name = 'Enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) err.email = 'Enter a valid email address.';
    if (f.password.length < 8) err.password = 'Password must be at least 8 characters.';
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      const u = await register({ ...f, state_id: f.state_id || undefined, district_id: f.district_id || undefined });
      toast('Account created. Welcome to AranyaValue!');
      navigate(homeFor(u), { replace: true });
    } catch (ex) {
      setErrors({ form: ex.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page" style={{ gridTemplateColumns: '1fr' }}>
      <div className="login-bg" />
      <section className="login-right" style={{ justifyContent: 'center', padding: '40px 16px' }}>
        <motion.form className="login-card" style={{ maxWidth: 620 }} onSubmit={submit} noValidate initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="brand" style={{ marginBottom: 12 }}><Logo /></div>
          <h2 style={{ fontSize: 30 }}>Create your account</h2>
          <p className="lead" style={{ fontSize: 16, marginBottom: 20 }}>Collectors and buyers can register here.</p>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
            <Field label="Full name" required error={errors.name} htmlFor="rn"><Input id="rn" value={f.name} onChange={set('name')} autoComplete="name" /></Field>
            <Field label="I am a" htmlFor="rr"><Select id="rr" value={f.role} onChange={set('role')}><option value="collector">Collector</option><option value="buyer">Buyer</option></Select></Field>
            <Field label="Email" required error={errors.email} htmlFor="re"><Input id="re" type="email" value={f.email} onChange={set('email')} autoComplete="email" /></Field>
            <Field label="Phone" optional htmlFor="rp"><Input id="rp" value={f.phone} onChange={set('phone')} inputMode="tel" /></Field>
            <Field label="Password" required error={errors.password} hint="At least 8 characters" htmlFor="rw"><Input id="rw" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
            <Field label="Organisation" optional htmlFor="ro"><Input id="ro" value={f.organisation} onChange={set('organisation')} /></Field>
            <Field label="State" optional htmlFor="rs"><Select id="rs" value={f.state_id} onChange={set('state_id')}><option value="">Select state</option>{(meta.data?.states || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
            <Field label="District" optional htmlFor="rd"><Select id="rd" value={f.district_id} onChange={set('district_id')}><option value="">Select district</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          </div>
          {errors.form && <div className="alert-red" role="alert" style={{ margin: '14px 0' }}>{errors.form}</div>}
          <button className="btn primary block" type="submit" disabled={busy} style={{ marginTop: 20 }}><Icon name="check" /> {busy ? 'Creating…' : 'Create account'}</button>
          <p className="hint" style={{ marginTop: 14, position: 'relative', zIndex: 2 }}>Already registered? <Link className="link" to="/login">Sign in</Link></p>
        </motion.form>
      </section>
    </div>
  );
}
