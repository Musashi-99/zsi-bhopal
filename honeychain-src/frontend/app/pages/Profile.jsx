import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../components/ui/Icon';
import PageHero from '../components/layout/PageHero';
import { Button, Card, Chip, Field, Img, Input, Notice, Select, SectionHead, Switch, Tabs } from '../components/ui/primitives';
import { CountUp, Stagger, Item } from '../components/motion';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useMeta, useUpdateProfile } from '../api/queries';
import { useDocTitle } from '../hooks';
import { cleanName, fmtDate } from '../lib/format';

const SECTIONS = [
  { key: 'profile', label: 'Profile', icon: 'user' }, { key: 'organization', label: 'Organization', icon: 'building' }, { key: 'location', label: 'Location', icon: 'pin' },
  { key: 'preferences', label: 'Preferences', icon: 'settings' }, { key: 'notifications', label: 'Notifications', icon: 'bell' }, { key: 'account', label: 'Account', icon: 'settings' },
];
const AVATAR_KEY = 'aranya_avatar';

export default function Profile() {
  useDocTitle('Profile & Settings');
  const { user, setUser } = useAuth();
  const { toast, confirm } = useUI();
  const meta = useMeta();
  const mutate = useUpdateProfile(setUser);
  const refs = { profile: useRef(), organization: useRef(), location: useRef(), preferences: useRef(), notifications: useRef(), account: useRef() };
  const [tab, setTab] = useState('profile');
  const [errors, setErrors] = useState({});

  const initial = useMemo(() => ({
    name: cleanName(user.name) === user.name ? user.name : user.name, phone: user.phone || '', organisation: user.organisation || '',
    state_id: user.state_id || '', district_id: user.district_id || '',
    group_type: user.profile?.group_type || 'Collector Group', contact_person: user.profile?.contact_person || '', group_size: user.profile?.group_size ?? '',
    block: user.profile?.block || '', village: user.profile?.village || '', pin: user.profile?.pin || '',
    notify_batch: user.profile?.notify_batch ?? true, notify_offers: user.profile?.notify_offers ?? true, notify_news: user.profile?.notify_news ?? false,
    language: user.preferred_language || 'en',
  }), [user]);
  const [f, setF] = useState(initial);
  const [photo, setPhoto] = useState(() => { try { return localStorage.getItem(AVATAR_KEY); } catch { return null; } });
  useEffect(() => setF(initial), [initial]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);

  const districts = (meta.data?.districts || []).filter((d) => !f.state_id || d.state_id === f.state_id);
  const checklist = [['Full name', f.name], ['Phone', f.phone], ['Organization', f.organisation], ['Contact person', f.contact_person], ['Group size', f.group_size], ['State', f.state_id], ['District', f.district_id], ['Village', f.village], ['PIN code', f.pin], ['Photo', photo]];
  const pct = Math.round((checklist.filter(([, v]) => String(v ?? '').trim()).length / checklist.length) * 100);

  const jump = (key) => {
    setTab(key);
    const el = refs[key === 'preferences' ? 'preferences' : key].current;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el?.animate([{ boxShadow: '0 0 0 2px var(--g500)' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1400 });
  };

  const onPhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > 2 * 1048576) { toast('Use a JPG or PNG up to 2 MB.', 'err'); return; }
    const r = new FileReader();
    r.onload = () => { setPhoto(r.result); try { localStorage.setItem(AVATAR_KEY, r.result); } catch { /* storage full */ } toast('Photo updated on this device'); };
    r.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!f.name.trim()) err.name = 'Name is required.';
    if (f.phone && !/^(\+91[\s-]?)?\d{5}[\s-]?\d{5}$/.test(f.phone.trim())) err.phone = 'Enter a valid 10-digit phone number.';
    if (f.pin && !/^\d{6}$/.test(f.pin)) err.pin = 'PIN code must be 6 digits.';
    setErrors(err);
    if (Object.keys(err).length) { toast('Please fix the highlighted fields.', 'err'); return; }
    try {
      await mutate.mutateAsync({
        name: f.name.trim(), phone: f.phone.trim() || undefined, organisation: f.organisation || undefined, state_id: f.state_id || undefined, district_id: f.district_id || undefined, preferred_language: f.language,
        profile: { group_type: f.group_type, contact_person: f.contact_person, group_size: f.group_size === '' ? null : Number(f.group_size), block: f.block, village: f.village, pin: f.pin, notify_batch: f.notify_batch, notify_offers: f.notify_offers, notify_news: f.notify_news },
      });
      toast('Profile changes saved');
    } catch (ex) { toast(ex.message, 'err'); }
  };
  const cancel = async () => { if (!dirty || await confirm({ title: 'Discard changes?', text: 'Unsaved changes will be reset.', ok: 'Discard', cancel: 'Keep editing', danger: true })) { setF(initial); setErrors({}); } };

  return (
    <>
      <PageHero title="Profile & Settings" sub="Manage your account, preferences and organization details." />
      <Tabs variant="line" id="profile-tabs" tabs={SECTIONS} value={tab} onChange={jump} />

      <form onSubmit={submit} noValidate>
        <div className="pf-grid">
          <Stagger className="grid" delay={0.07}>
            <Item as="section" className="card" ref={refs.profile}>
              <div className="row between wrap"><SectionHead icon="user" title="Profile Information" sub="Your basic information and contact details." />
                <Notice tone="blue" small className="" ><span>Keep your information up to date so buyers and cooperatives can contact you when needed.</span></Notice></div>
              <div className="row mt16" style={{ alignItems: 'flex-start', gap: 26, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink2)' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    {photo ? <img className="avatar-big" src={photo} alt="Your profile" /> : <Img name="avatar" className="avatar-big" alt="Your profile" />}
                    <label className="iconbtn" style={{ position: 'absolute', right: -2, bottom: 0, borderRadius: '50%', width: 26, height: 26, background: '#0f2a1d', color: '#fff', border: '2px solid #fff', cursor: 'pointer' }} aria-label="Change photo"><Icon name="camera" /><input type="file" accept="image/png,image/jpeg" hidden onChange={onPhoto} /></label>
                  </div>
                  <div style={{ marginTop: 6, color: 'var(--ink)' }}>Upload Photo</div><small className="sub">JPG, PNG (Max 2 MB)</small>
                </div>
                <div className="form-grid" style={{ flex: 1, minWidth: 260, gridTemplateColumns: 'repeat(2,1fr)' }}>
                  <Field label="Full Name" required error={errors.name} htmlFor="fn"><Input id="fn" value={f.name} onChange={set('name')} /></Field>
                  <Field label="Role" htmlFor="role"><Input id="role" value={user.role[0].toUpperCase() + user.role.slice(1)} readOnly /></Field>
                  <Field label="Phone Number" error={errors.phone} htmlFor="ph"><Input id="ph" value={f.phone} onChange={set('phone')} inputMode="tel" /></Field>
                  <Field label="Email Address" htmlFor="em"><Input id="em" value={user.email} readOnly /></Field>
                </div>
              </div>
            </Item>

            <Item as="section" className="card" ref={refs.organization}>
              <SectionHead icon="users" title="Organization / Collector Group" sub="Information about your collector group or organization (if applicable)." />
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
                <Field label="Group / Organization Name" htmlFor="gn"><Input id="gn" value={f.organisation} onChange={set('organisation')} /></Field>
                <Field label="Group Type" htmlFor="gt"><Select id="gt" value={f.group_type} onChange={set('group_type')}>{['Collector Group', 'Cooperative', 'Self-Help Group', 'Individual'].map((o) => <option key={o}>{o}</option>)}</Select></Field>
                <Field label="Contact Person" htmlFor="cp"><Input id="cp" value={f.contact_person} onChange={set('contact_person')} /></Field>
                <Field label="Group Size (Members)" htmlFor="gs"><Input id="gs" type="number" min="1" value={f.group_size} onChange={set('group_size')} /></Field>
              </div>
            </Item>

            <Item as="section" className="card" ref={refs.location}>
              <SectionHead icon="pin" title="Location Details" sub="Your primary location for collection activities." />
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
                <Field label="State" required htmlFor="st"><Select id="st" value={f.state_id} onChange={(e) => setF((s) => ({ ...s, state_id: e.target.value, district_id: '' }))}><option value="">Select</option>{(meta.data?.states || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
                <Field label="District" required htmlFor="di"><Select id="di" value={f.district_id} onChange={set('district_id')}><option value="">Select</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
                <Field label="Block" htmlFor="bl"><Input id="bl" value={f.block} onChange={set('block')} /></Field>
                <Field label="Village" htmlFor="vi"><Input id="vi" value={f.village} onChange={set('village')} /></Field>
                <Field label="PIN Code" error={errors.pin} htmlFor="pin" style={{ gridColumn: 'span 2' }}><Input id="pin" value={f.pin} onChange={set('pin')} inputMode="numeric" maxLength={6} /></Field>
              </div>
            </Item>

            <Item as="section" className="card" ref={refs.notifications}>
              <div className="row between wrap"><SectionHead icon="bell" title="Notification Preferences" sub="Choose which notifications you want to receive." />
                <Notice tone="blue" small><span>You will only receive notifications for features that are available in this version of the platform.</span></Notice></div>
              <div className="mt8">
                {[['notify_batch', 'package', 'Batch Updates', 'Get notified about status changes to your batches (e.g., assessment results, buyer offers).'], ['notify_offers', 'handshake', 'New Buyer Offers', 'Get notified when buyers show interest or make offers for your produce.'], ['notify_news', 'bell', 'Important Announcements', 'Receive important updates about the platform and new features.']].map(([k, ic, t, d]) => (
                  <div className="pref" key={k}><span className="sec-ic sm"><Icon name={ic} /></span><b>{t}</b><span>{d}</span><Switch checked={f[k]} onChange={(v) => setF((s) => ({ ...s, [k]: v }))} label={t} /></div>
                ))}
              </div>
            </Item>
          </Stagger>

          <aside className="grid" style={{ alignContent: 'start' }}>
            <Card tone="tint" ref={refs.account}>
              <div className="row" style={{ gap: 14 }}><Icon name="shieldcheck" style={{ fontSize: 36, color: 'var(--g600)' }} /><div><div className="row"><h2 style={{ fontSize: 18 }}>Account Status</h2><Chip tone="green">● Active</Chip></div><p className="sub" style={{ color: 'var(--ink2)' }}>Your account is active and in good standing.</p></div></div>
              <div className="mt12" style={{ fontSize: 13 }}>
                <div className="dl"><Icon name="user" /><span>Role</span><span style={{ textTransform: 'capitalize' }}>{user.role}</span></div>
                <div className="dl"><Icon name="calendar" /><span>Member Since</span><span>{fmtDate(user.created_at)}</span></div>
                <div className="dl"><Icon name="mail" /><span>Email</span><span style={{ wordBreak: 'break-all' }}>{user.email}</span></div>
              </div>
              {user.is_demo && <Notice tone="amber" small className="mt8"><span>This is a demonstration account.</span></Notice>}
            </Card>
            <Card tone="amber">
              <div className="row" style={{ gap: 16 }}>
                <motion.div className="ring" style={{ '--p': pct }} key={pct} initial={{ scale: 0.85 }} animate={{ scale: 1 }}><b><CountUp value={pct} suffix="%" /></b></motion.div>
                <div style={{ flex: 1 }}><h2 style={{ fontSize: 17 }}>Profile Completion</h2>
                  <p style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 4 }}>{pct >= 100 ? 'Your profile is complete.' : `Your profile is ${pct}% complete. Add the missing details to improve it.`}</p>
                  <Button size="sm" className="mt8" iconRight="arrow" onClick={() => toast(checklist.filter(([, v]) => !String(v ?? '').trim()).map(([k]) => k).join(', ') || 'Everything is filled in.')}>View Checklist</Button></div>
              </div>
            </Card>
            <Card ref={refs.preferences}>
              <SectionHead icon="lang" title="Language Preference" sub="Choose your preferred language for the platform." />
              <Field label="Language" htmlFor="lg" hint="More language options may be added in future updates.">
                <Select id="lg" value={f.language} onChange={set('language')}>{(meta.data?.languages || [{ id: 'en', label: 'English' }]).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select>
              </Field>
            </Card>
            <Card>
              <SectionHead icon="lock" title="Account & Security" sub="Manage your account settings." />
              <Notice tone="blue" icon="info"><span>Password and other security settings are managed through your existing authentication system. If you need to change your password, please use the standard account recovery option provided at login.</span></Notice>
            </Card>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 12 }}>
              <Button style={{ height: 46, padding: '0 34px' }} onClick={cancel}>Cancel</Button>
              <Button type="submit" variant="primary" style={{ height: 46, padding: '0 30px' }} disabled={mutate.isPending}>{mutate.isPending ? 'Saving…' : 'Save Changes'}</Button>
            </div>
          </aside>
        </div>
      </form>
    </>
  );
}
