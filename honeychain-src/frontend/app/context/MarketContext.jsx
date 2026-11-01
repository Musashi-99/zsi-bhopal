import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { api } from '../lib/api';
import { del, post, useMySaved } from '../api/market';

const MarketContext = createContext(null);
const KEY = 'av-market-basket';

function readBasket() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function MarketProvider({ children }) {
  const { user, setUser } = useAuth();
  const { toast } = useUI();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const loc = useLocation();
  const isBuyer = user?.role === 'buyer';
  const [basket, setBasket] = useState(readBasket);
  const [enquiry, setEnquiry] = useState(null);
  const saved = useMySaved(isBuyer);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(basket)); } catch { /* storage may be blocked */ } }, [basket]);

  const savedKeys = useMemo(() => new Set(saved.data?.keys || []), [saved.data]);

  const goLogin = useCallback((message) => {
    toast(message || 'Sign in as a buyer to continue. Demo Buyer access is one click.', 'ok');
    navigate(`/market/login?next=${encodeURIComponent(loc.pathname + loc.search)}`);
  }, [navigate, loc, toast]);

  const requireBuyer = useCallback((message) => {
    if (isBuyer) return true;
    if (user) toast('You are signed in to another portal. Sign in as a buyer to use the marketplace desk.', 'err');
    goLogin(user ? 'Switch to a buyer account to continue.' : message);
    return false;
  }, [isBuyer, user, goLogin, toast]);

  const addToBasket = useCallback((card, quantity) => {
    setBasket((cur) => {
      const q = Number(quantity) || card.min_order_qty || 1;
      const found = cur.find((i) => i.code === card.code);
      if (found) return cur.map((i) => (i.code === card.code ? { ...i, quantity: q } : i));
      return [...cur, {
        code: card.code, title: card.title, image: card.image, unit: card.unit, price: card.price || null,
        min_order_qty: card.min_order_qty, available_qty: card.available_qty, district: card.district, centre: card.centre,
        slug: card.product?.market_category?.slug, quantity: q,
      }];
    });
    toast(`${card.title} added to your enquiry basket.`);
  }, [toast]);
  const removeFromBasket = useCallback((code) => setBasket((cur) => cur.filter((i) => i.code !== code)), []);
  const setBasketQty = useCallback((code, quantity) => setBasket((cur) => cur.map((i) => (i.code === code ? { ...i, quantity } : i))), []);
  const clearBasket = useCallback(() => setBasket([]), []);

  const toggleSave = useCallback(async (kind, ref) => {
    if (!requireBuyer('Sign in as a buyer to save items.')) return;
    const key = `${kind}:${ref}`;
    try {
      if (savedKeys.has(key)) { await del(`/my/saved/${kind}/${encodeURIComponent(ref)}`); toast('Removed from saved.'); } else { await post('/my/saved', { kind, ref_id: ref }); toast('Saved to your account.'); }
      qc.invalidateQueries({ queryKey: ['store'] });
    } catch (e) { toast(e.message, 'err'); }
  }, [requireBuyer, savedKeys, qc, toast]);

  // Any non-empty credentials (or none, for one-click) sign in as the predefined Demo Buyer. It never creates an account.
  const demoLogin = useCallback(async (creds) => {
    const d = await api('/api/store/demo-login', { method: 'POST', body: creds || {} });
    qc.clear();
    const me = await api('/api/auth/me');
    setUser(me.user);
    toast('Signed in as the Demo Buyer. Records on this account are sample data.');
    return d;
  }, [qc, setUser, toast]);

  const openEnquiry = useCallback((card, opts = {}) => {
    if (!requireBuyer('Sign in as a buyer to send an enquiry. Demo Buyer access is one click.')) return;
    setEnquiry({ card, ...opts });
  }, [requireBuyer]);

  const value = useMemo(() => ({
    isBuyer, basket, addToBasket, removeFromBasket, setBasketQty, clearBasket, savedKeys, toggleSave, demoLogin,
    enquiry, openEnquiry, closeEnquiry: () => setEnquiry(null), requireBuyer,
  }), [isBuyer, basket, addToBasket, removeFromBasket, setBasketQty, clearBasket, savedKeys, toggleSave, demoLogin, enquiry, openEnquiry, requireBuyer]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export const useMarket = () => useContext(MarketContext);
