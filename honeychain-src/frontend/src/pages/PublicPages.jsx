import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, homeFor } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n';
import { Empty, LangState, Loading, Stamp, outcomeLabel, statusTone } from '../components/ui';

export function Landing() {
  const { t, stateId } = useLang();
  const [sample, setSample] = useState(null);
  useEffect(() => {
    api(`/api/marketplace?state=${stateId}`).then((d) => setSample(d.batches?.[0] || null)).catch(() => setSample(null));
  }, [stateId]);
  return (
    <div className="stack">
      <section className="hero">
        <div>
          <p className="eyebrow">West Bengal pilot illustration · not an operating deployment</p>
          <h1>{t('heroTitle')}</h1>
          <p className="lede">{t('heroText')}</p>
          <p className="muted">{t('tagline')}</p>
          <div className="cta-row">
            <Link className="btn clay" to="/register">{t('ctaPassport')}</Link>
            <Link className="btn ghost" to="/marketplace">{t('ctaMarket')}</Link>
          </div>
        </div>
        <article className="ticket">
          <p className="eyebrow">Quality passport</p>
          <p className="serial">{sample ? sample.batch_code : 'AV-WB-SAMPLE'}</p>
          <h2>{sample ? sample.product : 'Mahua flowers'}</h2>
          <div className="kvs">
            <div><span>Quantity</span><b>{sample ? `${sample.quantity} ${sample.unit}` : '—'}</b></div>
            <div><span>Place</span><b>{sample ? `${sample.district}, ${sample.state}` : 'Purulia'}</b></div>
            <div><span>Status</span><Stamp tone={statusTone(sample?.status)}>{outcomeLabel(sample?.status || 'draft')}</Stamp></div>
          </div>
          <p className="small muted">This card reads a shared demonstration batch when one exists. It is not a live price or a certificate.</p>
        </article>
      </section>
      <section className="grid-2">
        <div className="panel">
          <h3>What collectors run into</h3>
          <ul>
            <li>Quality notes that never get written down.</li>
            <li>Drying and storage steps with no dates.</li>
            <li>Buyer specifications they cannot see.</li>
            <li>Two offers with no explanation of the difference.</li>
            <li>A rejection with no recovery path.</li>
          </ul>
        </div>
        <div className="panel">
          <h3>What this site connects</h3>
          <ol>
            <li>Quality passport</li>
            <li>Quality-to-price explanation</li>
            <li>Buyer discovery</li>
            <li>Government scheme links</li>
          </ol>
        </div>
      </section>
      <HowBody />
    </div>
  );
}

function HowBody() {
  const steps = [
    ['Register the batch', 'Product, quantity, place, and a declared source. A declaration is not a legal certificate.'],
    ['Record handling and evidence', 'Drying, storage, packaging, and any measurement you actually have. Missing stays missing.'],
    ['Compare configured rules', 'Buyer specifications are applied only where a limit is stored, with its source.'],
    ['Read the offers', 'Each figure keeps its unit, date, and whether it is a demonstration sample.'],
    ['Keep the history', 'A later review is added. The earlier one is not rewritten.'],
  ];
  return (
    <section>
      <h2>Five steps</h2>
      <div className="steps">
        {steps.map(([title, text], i) => (
          <div className="step" key={title}>
            <b>{i + 1}</b>
            <div><strong>{title}</strong><p className="muted">{text}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function How() { return <div><h1>How it works</h1><HowBody /></div>; }

export function About() {
  return (
    <div className="stack">
      <h1>About AranyaValue</h1>
      <p className="lede">A forest-produce quality-to-price record for collectors, collection centres, reviewers, and buyers. The first geography in this demo is West Bengal. Other states can be configured without a second codebase.</p>
      <p>The site does not certify purity, guarantee a price, or prove where a batch was collected. Reviewer-verified fields, self-reported fields, imported notes, simulated demo values, and blank gaps stay distinct.</p>
    </div>
  );
}

export function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      const res = await api('/api/contact', { method: 'POST', body: form });
      setNote(res.notice);
      setForm({ name: '', email: '', message: '' });
    } catch (error) { setErr(error.message); }
  }
  return (
    <form className="stack panel" onSubmit={submit}>
      <h1>Contact</h1>
      <label className="field"><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
      <label className="field"><span>Email</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label className="field"><span>Message</span><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required /></label>
      {err && <p className="err">{err}</p>}
      {note && <p className="oknote">{note}</p>}
      <button className="btn forest" type="submit">Send</button>
    </form>
  );
}

export function Privacy() {
  return (
    <div className="stack">
      <h1>Privacy</h1>
      <p>Public passport pages omit phone numbers, email addresses, private files, and other buyers’ offers. Collectors choose which files are public. This demo stores data in a local database on the machine running the server.</p>
    </div>
  );
}

export function Terms() {
  return (
    <div className="stack">
      <h1>Terms</h1>
      <p>Records in the seeded demo are illustrative. An offer recorded here is not a completed sale and not a published market price. Scheme pages link to official sources; the short summaries are for navigation and can go out of date.</p>
    </div>
  );
}

export function Products() {
  const { stateId } = useLang();
  const [rows, setRows] = useState(null);
  useEffect(() => { api(`/api/products?state=${stateId}`).then((d) => setRows(d.products)).catch(() => setRows([])); }, [stateId]);
  if (!rows) return <Loading />;
  return (
    <div className="stack">
      <h1>NTFP catalogue</h1>
      <LangState />
      <p className="muted">The list follows the selected state. Adding a state is catalogue configuration, not a claim that collection is underway there.</p>
      {!rows.length && <Empty title="No products for this state" body="An administrator can link products to the state." />}
      <div className="list">
        {rows.map((p) => (
          <Link className="card" key={p.id} to={`/products/${p.id}`}>
            <h3>{p.name}</h3>
            <p className="muted">{p.category} · {p.local_names?.bn || p.local_names?.hi || ''}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ProductDetail() {
  const { productId } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api(`/api/products/${productId}`).then(setData).catch((e) => setErr(e.message)); }, [productId]);
  if (err) return <p className="err">{err}</p>;
  if (!data) return <Loading />;
  const { product, parameters, states } = data;
  return (
    <div className="stack">
      <p className="eyebrow">{product.category}</p>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <p className="muted">Units: {(product.units || []).join(', ')}. States: {states.map((s) => s.name).join(', ') || 'None linked'}.</p>
      <h2>Attributes</h2>
      {!parameters.length && <Empty title="No attribute list yet" />}
      {parameters.map((p) => (
        <div className="card" key={p.id}>
          <strong>{p.name}</strong> {p.unit && <span className="muted">({p.unit})</span>}
          <p className="small">{p.min_value == null && p.max_value == null ? 'Limit: not configured. This attribute is not marked pass or fail.' : `Configured range ${p.min_value ?? '—'} to ${p.max_value ?? '—'}.`}</p>
          <p className="small muted">{p.source_name}</p>
        </div>
      ))}
    </div>
  );
}

export function Schemes() {
  const { stateId } = useLang();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [rows, setRows] = useState(null);
  useEffect(() => {
    const params = new URLSearchParams({ state: stateId });
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    api(`/api/schemes?${params}`).then((d) => setRows(d.schemes)).catch(() => setRows([]));
  }, [stateId, q, category]);
  return (
    <div className="stack">
      <h1>Government schemes</h1>
      <LangState />
      <p className="muted">Summaries are written for this demo. Eligibility is not decided here. Open the official page.</p>
      <label className="field"><span>Search</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, department, eligibility" /></label>
      <div className="chips">
        {['', 'livelihood', 'marketing', 'rights'].map((c) => (
          <button key={c || 'all'} className={`btn ${category === c ? 'forest' : 'ghost'}`} onClick={() => setCategory(c)}>{c || 'All'}</button>
        ))}
      </div>
      {!rows && <Loading />}
      {rows && !rows.length && <Empty title="No schemes match" />}
      <div className="list">
        {(rows || []).map((s) => (
          <Link className="card" key={s.id} to={`/schemes/${s.id}`}>
            <h3>{s.name}</h3>
            <p className="small muted">{s.department} · {s.level}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SchemeDetail() {
  const { schemeId } = useParams();
  const { user } = useAuth();
  const [scheme, setScheme] = useState(null);
  const [note, setNote] = useState('');
  useEffect(() => { api(`/api/schemes/${schemeId}`).then((d) => setScheme(d.scheme)); }, [schemeId]);
  if (!scheme) return <Loading />;
  async function mark(status) {
    try {
      await api(`/api/schemes/${scheme.id}/save`, { method: 'POST', body: { status } });
      setNote(status === 'applied' ? 'Marked as applied in your account. This is not an official application.' : 'Saved to your account.');
    } catch (err) { setNote(err.message); }
  }
  return (
    <article className="stack">
      <p className="eyebrow">{scheme.level} · {scheme.category}</p>
      <h1>{scheme.name}</h1>
      {scheme.summary_is_illustrative && <Stamp tone="wait">Summary written for this demo</Stamp>}
      <p><b>Department.</b> {scheme.department}</p>
      <p><b>Who it is for, as summarised here.</b> {scheme.beneficiaries}</p>
      <p><b>Benefits.</b> {scheme.benefits}</p>
      <p><b>Eligibility.</b> {scheme.eligibility}</p>
      <p><b>Process.</b> {scheme.process}</p>
      <p className="small">Documents noted here: {(scheme.documents || []).join('; ')}</p>
      <p className="small muted">Last checked for this demo: {scheme.last_verified}</p>
      <div className="row">
        <a className="btn clay" href={scheme.official_url} target="_blank" rel="noreferrer">Official page</a>
        {user && <button className="btn ghost" onClick={() => mark('saved')}>Save</button>}
        {user && <button className="btn ghost" onClick={() => mark('applied')}>Mark applied</button>}
        {!user && <Link to="/login">Log in to save</Link>}
      </div>
      {note && <p className="oknote">{note}</p>}
    </article>
  );
}

export function Marketplace() {
  const { stateId } = useLang();
  const [meta, setMeta] = useState({ products: [], districts: [] });
  const [filters, setFilters] = useState({ product: '', district: '', status: '', q: '' });
  const [sheet, setSheet] = useState(false);
  const [rows, setRows] = useState(null);
  const [notice, setNotice] = useState('');
  useEffect(() => { api('/api/meta').then(setMeta).catch(() => {}); }, []);
  useEffect(() => {
    const params = new URLSearchParams({ state: stateId });
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    api(`/api/marketplace?${params}`).then((d) => { setRows(d.batches); setNotice(d.notice); }).catch(() => setRows([]));
  }, [stateId, filters]);
  const districts = meta.districts.filter((d) => d.state_id === stateId);
  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ flex: 1 }}>Marketplace</h1>
        <button className="btn ghost" onClick={() => setSheet(true)}>Filter</button>
      </div>
      <p className="small muted">{notice}</p>
      <label className="field"><span>Search</span><input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></label>
      {!rows && <Loading />}
      {rows && !rows.length && <Empty title="No shared batches" body="Drafts stay private. A collector can share a batch after saving it." />}
      <div className="list">
        {(rows || []).map((b) => (
          <Link className="card" key={b.id} to={`/marketplace/${b.batch_code}`}>
            <div className="row"><strong>{b.product}</strong><Stamp tone={statusTone(b.status)}>{outcomeLabel(b.status)}</Stamp></div>
            <p className="serial">{b.batch_code}</p>
            <p className="muted">{b.quantity} {b.unit} · {b.district} · {b.collection_date}</p>
            {b.is_demo && <p className="small">Demonstration record</p>}
          </Link>
        ))}
      </div>
      {sheet && (
        <>
          <div className="sheet-back" onClick={() => setSheet(false)} />
          <div className="sheet">
            <div className="handle" />
            <h2>Filters</h2>
            <label className="field"><span>Product</span>
              <select value={filters.product} onChange={(e) => setFilters({ ...filters, product: e.target.value })}>
                <option value="">Any</option>
                {meta.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="field"><span>District</span>
              <select value={filters.district} onChange={(e) => setFilters({ ...filters, district: e.target.value })}>
                <option value="">Any</option>
                {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Status</span>
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">Any</option>
                {['pending_verification', 'verified', 'verified_with_limitations', 'needs_info', 'rejected'].map((s) => <option key={s} value={s}>{outcomeLabel(s)}</option>)}
              </select>
            </label>
            <button className="btn forest full" onClick={() => setSheet(false)}>Show batches</button>
          </div>
        </>
      )}
    </div>
  );
}

export function PublicBatch() {
  const { batchId } = useParams();
  return <Passport code={batchId} />;
}

export function PublicPassport() {
  const { batchId } = useParams();
  return <Passport code={batchId} publicView />;
}

function Passport({ code }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [chain, setChain] = useState(null);
  useEffect(() => {
    api(`/api/passport/${code}`).then(setData).catch((e) => setErr(e.message));
  }, [code]);
  if (err) return <p className="err">{err}</p>;
  if (!data) return <Loading />;
  const p = data.passport;
  const url = `${window.location.origin}/passport/${p.batch_code}`;
  return (
    <article className="stack">
      <div className="ticket">
        <p className="eyebrow">Quality passport {p.is_demo ? '· demonstration' : ''}</p>
        <p className="serial">{p.batch_code}</p>
        <h2>{p.product}</h2>
        <p>{p.local_name} {p.variety && `· ${p.variety}`}</p>
        <div className="kvs">
          <div><span>Quantity</span><b>{p.quantity} {p.unit}</b></div>
          <div><span>Collected</span><b>{p.collection_date}</b></div>
          <div><span>Place</span><b>{p.district}, {p.state}</b></div>
          <div><span>Area</span><b>{p.collection_area || 'Not recorded'}</b></div>
          <div><span>Method</span><b>{p.collection_method || 'Not recorded'}</b></div>
          <div><span>Collector</span><b>{p.collector?.name || p.collector?.public_label}</b></div>
          <div><span>Status</span><Stamp tone={statusTone(p.status)}>{outcomeLabel(p.status)}</Stamp></div>
        </div>
        <p className="small"><Stamp tone="wait">{p.source_statement}</Stamp></p>
        <div className="row" style={{ marginTop: 12 }}>
          <QRCodeSVG value={url} size={112} />
          <p className="small muted">The code opens this page. It does not prove authenticity or origin.</p>
        </div>
      </div>
      <section>
        <h3>Measurements</h3>
        {!p.measurements.length && <Empty title="No measurements stored" body="Nothing was invented to fill this gap." />}
        {p.measurements.map((m) => (
          <div className="card" key={m.id}>
            <div className="row"><strong>{m.parameter}</strong><Stamp tone={m.evidence_source === 'simulated' ? 'sim' : statusTone(m.evidence_source)}>{outcomeLabel(m.evidence_source)}</Stamp>{m.verified && <Stamp tone="ok">Reviewer verified</Stamp>}</div>
            <p>{m.value ?? m.text_value} {m.unit} · {m.measured_at}</p>
            <p className="small muted">{m.method} {m.notes}</p>
          </div>
        ))}
      </section>
      <section>
        <h3>Handling</h3>
        {!p.handling.length && <p className="muted">No handling record.</p>}
        {p.handling.map((h) => (
          <p key={h.id}><b>{h.kind}.</b> {h.method} {h.location && `· ${h.location}`} {h.start_date && `· ${h.start_date}${h.end_date ? ` to ${h.end_date}` : ''}`}</p>
        ))}
      </section>
      <section>
        <h3>Evidence</h3>
        {p.private_evidence_count > 0 && <p className="small">{p.private_evidence_count} private file(s) are not shown here.</p>}
        {!p.evidence.length && <p className="muted">No public evidence file.</p>}
        {p.evidence.map((e) => <p key={e.id}>{e.label || e.kind}. {e.note} {e.download && <a href={e.download}>Open</a>}</p>)}
      </section>
      {!!p.limitations?.length && <p className="small muted">{p.limitations.join(' ')}</p>}
      <button className="btn ghost no-print" onClick={async () => setChain(await api('/api/ledger/verify'))}>Check local record integrity</button>
      {chain && (
        <div className="panel">
          <Stamp tone={chain.valid ? 'ok' : 'no'}>{chain.valid ? 'Hash chain matches' : 'Hash chain broken'}</Stamp>
          <p>{chain.proves}</p>
          <p className="muted">{chain.does_not_prove}</p>
          <p className="small">{data.chain_note}</p>
        </div>
      )}
      <p className="small muted">Events: {p.events.map((e) => e.event_type.replaceAll('_', ' ')).join(' · ') || 'None'}</p>
    </article>
  );
}

const DEMOS = [
  ['mina@aranya.demo', 'collector123', 'Collector'],
  ['centre.purulia@aranya.demo', 'centre12345', 'Centre'],
  ['buyer.haat@aranya.demo', 'buyer12345', 'Buyer'],
  ['inspector@aranya.demo', 'inspector123', 'Reviewer'],
  ['admin@aranya.demo', 'admin12345', 'Admin'],
];

export function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      const user = await login(email, password);
      nav(homeFor(user.role));
    } catch (error) { setErr(error.message); }
  }
  return (
    <form className="stack panel" onSubmit={submit}>
      <h1>{t('login')}</h1>
      <p className="small muted">{t('demoNote')}</p>
      <div className="chips">
        {DEMOS.map(([em, pw, label]) => (
          <button type="button" className="btn ghost" key={em} onClick={() => { setEmail(em); setPassword(pw); }}>{label}</button>
        ))}
      </div>
      <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /></label>
      <label className="field"><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
      {err && <p className="err">{err}</p>}
      <button className="btn clay" type="submit">{t('login')}</button>
      <Link to="/register">{t('start')}</Link>
    </form>
  );
}

export function Register() {
  const nav = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'collector', phone: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    try {
      const user = await register(form);
      nav(homeFor(user.role));
    } catch (error) { setErr(error.message); }
  }
  return (
    <form className="stack panel" onSubmit={submit}>
      <h1>Create an account</h1>
      <p className="small muted">Collectors and buyers can register. Centre, reviewer, and admin accounts are created by an administrator.</p>
      <label className="field"><span>Name</span><input value={form.name} onChange={set('name')} required /></label>
      <label className="field"><span>Email</span><input type="email" value={form.email} onChange={set('email')} required /></label>
      <label className="field"><span>Phone</span><input value={form.phone} onChange={set('phone')} /></label>
      <label className="field"><span>Password</span><input type="password" value={form.password} onChange={set('password')} required minLength={8} /></label>
      <label className="field"><span>Role</span>
        <select value={form.role} onChange={set('role')}>
          <option value="collector">Collector</option>
          <option value="buyer">Buyer</option>
        </select>
      </label>
      {err && <p className="err">{err}</p>}
      <button className="btn clay" type="submit">Create account</button>
    </form>
  );
}
