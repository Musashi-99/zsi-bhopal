import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '../lib/api';

const S = '/api/store';

/* ---------- public ---------- */
export const useStoreMeta = () => useQuery({ queryKey: ['store', 'meta'], queryFn: () => api(`${S}/meta`), staleTime: 120_000 });
export const useStoreHome = () => useQuery({ queryKey: ['store', 'home'], queryFn: () => api(`${S}/home`) });
export const useListings = (params) => useQuery({ queryKey: ['store', 'listings', params], queryFn: () => api(`${S}/listings${qs(params)}`), placeholderData: keepPreviousData });
export const useListing = (code) => useQuery({ queryKey: ['store', 'listing', code], queryFn: () => api(`${S}/listings/${encodeURIComponent(code)}`), enabled: !!code, retry: false });
export const useVerifyBatch = (code) => useQuery({ queryKey: ['store', 'verify', code], queryFn: () => api(`${S}/verify/${encodeURIComponent(code)}`), enabled: !!code, retry: false, staleTime: 0, gcTime: 0 });
export const useCatalogue = (params) => useQuery({ queryKey: ['store', 'catalogue', params], queryFn: () => api(`${S}/catalogue${qs(params)}`), placeholderData: keepPreviousData });
export const useCatalogueItem = (id) => useQuery({ queryKey: ['store', 'catalogue', id], queryFn: () => api(`${S}/catalogue/${id}`), enabled: !!id, retry: false });
export const useCentres = (params) => useQuery({ queryKey: ['store', 'centres', params], queryFn: () => api(`${S}/centres${qs(params)}`), placeholderData: keepPreviousData });
export const useCentre = (id) => useQuery({ queryKey: ['store', 'centre', id], queryFn: () => api(`${S}/centres/${id}`), enabled: !!id, retry: false });

/* ---------- buyer ---------- */
const buyer = (key, path, enabled) => ({ queryKey: ['store', 'my', ...key], queryFn: () => api(`${S}/my/${path}`), enabled });
export const useMyOverview = (on = true) => useQuery({ ...buyer(['overview'], 'overview', on) });
export const useMyEnquiries = (on = true) => useQuery({ ...buyer(['enquiries'], 'enquiries', on) });
export const useMyEnquiry = (id, on = true) => useQuery({ queryKey: ['store', 'my', 'enquiry', id], queryFn: () => api(`${S}/my/enquiries/${encodeURIComponent(id)}`), enabled: on && !!id });
export const useMyOrders = (on = true) => useQuery({ ...buyer(['orders'], 'orders', on) });
export const useMySaved = (on = true) => useQuery({ ...buyer(['saved'], 'saved', on) });
export const useMyViewed = (kind, on = true) => useQuery({ queryKey: ['store', 'my', 'viewed', kind], queryFn: () => api(`${S}/my/viewed?kind=${kind}`), enabled: on });

/* ---------- seller desk ---------- */
export const useSellerEnquiries = (on = true) => useQuery({ queryKey: ['store', 'seller', 'enquiries'], queryFn: () => api(`${S}/seller/enquiries`), enabled: on });
export const useSellerOrders = (on = true) => useQuery({ queryKey: ['store', 'seller', 'orders'], queryFn: () => api(`${S}/seller/orders`), enabled: on });
export const useSellerListings = (on = true) => useQuery({ queryKey: ['store', 'seller', 'listings'], queryFn: () => api(`${S}/seller/listings`), enabled: on });

/** Generic mutation that refreshes every marketplace query afterwards. */
export function useStoreMutation(fn) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['store'] }) });
}

export const post = (path, body) => api(`${S}${path}`, { method: 'POST', body: body || {} });
export const put = (path, body) => api(`${S}${path}`, { method: 'PUT', body });
export const patch = (path, body) => api(`${S}${path}`, { method: 'PATCH', body });
export const del = (path) => api(`${S}${path}`, { method: 'DELETE' });
