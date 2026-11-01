import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '../ui/Icon';
import { api } from '../../lib/api';
import { timeAgo } from '../../lib/format';

const ICON = {
  new_batch: ['package', 'blue'], batch_resubmitted: ['refresh', 'amber'], batch_submitted: ['clock', 'blue'], batch_approved: ['check', ''],
  batch_rejected: ['alert', 'red'], correction_requested: ['pencil', 'amber'],
};

/** In-app notifications for any role. Reads only the signed-in user's own rows. */
export default function NotificationBell({ extra = [] }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api('/api/notifications'), refetchInterval: 30_000 });
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const items = q.data?.notifications || [];
  const unread = (q.data?.unread || 0) + extra.length;

  const go = async (n) => {
    setOpen(false);
    if (!n.is_read) { await api(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {}); qc.invalidateQueries({ queryKey: ['notifications'] }); }
    if (n.link) nav(n.link);
  };
  const readAll = async () => { await api('/api/notifications/read-all', { method: 'POST' }).catch(() => {}); qc.invalidateQueries({ queryKey: ['notifications'] }); };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="bell" aria-label={`Notifications (${unread} unread)`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="bell" />{unread > 0 && <em>{unread > 9 ? '9+' : unread}</em>}
      </button>
      <div className={`menu notif ${open ? 'open' : ''}`}>
        <h4 className="row between">Notifications {items.some((n) => !n.is_read) && <button type="button" className="link" onClick={readAll}>Mark all read</button>}</h4>
        {extra.map((a, i) => (
          <Link key={`x${i}`} to={a.to} className="n" onClick={() => setOpen(false)}><span className="sec-ic sm amber"><Icon name="alert" /></span><div>{a.text}<small>{a.hint}</small></div></Link>
        ))}
        {items.length === 0 && extra.length === 0 && <div className="n"><div>You are all caught up.</div></div>}
        {items.slice(0, 8).map((n) => {
          const [ic, tone] = ICON[n.kind] || ['bell', ''];
          return (
            <button key={n.id} type="button" className={`n ${n.is_read ? '' : 'unread'}`} onClick={() => go(n)} style={{ width: '100%', textAlign: 'left', border: 0, background: 'none' }}>
              <span className={`sec-ic sm ${tone}`}><Icon name={ic} /></span>
              <div><b>{n.title}</b>{n.body && <div className="sub">{n.body}</div>}<small>{timeAgo(n.created_at)}</small></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
