import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '../lib/api';

/* ---------- reference data ---------- */
export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => api('/api/meta'), staleTime: 10 * 60_000 });
export const useProducts = () => useQuery({ queryKey: ['products'], queryFn: () => api('/api/products').then((d) => d.products), staleTime: 10 * 60_000 });

/* ---------- dashboard ---------- */
export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: () => api('/api/dashboard') });

/* ---------- batches ---------- */
export const useBatches = (filters = {}) => useQuery({
  queryKey: ['batches', filters],
  queryFn: () => api(`/api/batches${qs(filters)}`).then((d) => d.batches),
});

export const usePassport = (id) => useQuery({
  queryKey: ['passport', id],
  queryFn: () => api(`/api/batches/${id}`).then((d) => d.passport),
  enabled: !!id,
});

export const useIntelligence = (id) => useQuery({
  queryKey: ['intelligence', id],
  queryFn: () => api(`/api/batches/${id}/intelligence`),
  enabled: !!id,
});

/** Full passport for every batch in a list (small data set: used for audit, rejections, activity). */
export function useAllPassports() {
  const list = useBatches();
  const results = useQueries({
    queries: (list.data || []).map((b) => ({
      queryKey: ['passport', b.id],
      queryFn: () => api(`/api/batches/${b.id}`).then((d) => d.passport),
    })),
  });
  const passports = results.map((r) => r.data).filter(Boolean);
  return {
    passports,
    isLoading: list.isLoading || results.some((r) => r.isLoading),
    error: list.error || results.find((r) => r.error)?.error,
    refetch: () => { list.refetch(); results.forEach((r) => r.refetch()); },
  };
}

function useBatchMutation(fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['passport'] });
      qc.invalidateQueries({ queryKey: ['intelligence'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      if (data?.passport) qc.setQueryData(['passport', data.passport.id], data.passport);
    },
  });
}

export const useCreateBatch = () => useBatchMutation((body) => api('/api/batches', { method: 'POST', body }));
export const useUpdateBatch = () => useBatchMutation(({ id, ...body }) => api(`/api/batches/${id}`, { method: 'PATCH', body }));
export const useSubmitBatch = () => useBatchMutation(({ id, ...body }) => api(`/api/batches/${id}/submit`, { method: 'POST', body }));
export const useAddHandling = () => useBatchMutation(({ id, ...body }) => api(`/api/batches/${id}/handling`, { method: 'POST', body }));
export const useAddMeasurement = () => useBatchMutation(({ id, ...body }) => api(`/api/batches/${id}/measurements`, { method: 'POST', body }));
export const useAddEvidence = () => useBatchMutation(({ id, ...body }) => api(`/api/batches/${id}/evidence`, { method: 'POST', body }));
export const useGeneratePassport = () => useBatchMutation(({ id }) => api(`/api/batches/${id}/passport`, { method: 'POST' }));

/* ---------- market ---------- */
export const useRequirements = () => useQuery({
  queryKey: ['requirements'],
  queryFn: () => api('/api/buyer-requirements').then((d) => d.requirements),
});

/* ---------- schemes ---------- */
export const useSchemes = (filters = {}) => useQuery({
  queryKey: ['schemes', filters],
  queryFn: () => api(`/api/schemes${qs(filters)}`).then((d) => d.schemes),
});
export const useSavedSchemes = () => useQuery({ queryKey: ['schemes-saved'], queryFn: () => api('/api/schemes-saved').then((d) => d.schemes) });
export function useSaveScheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => api(`/api/schemes/${id}/save`, { method: 'POST', body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schemes-saved'] }),
  });
}

/* ---------- ledger / public ---------- */
export const useLedgerVerify = () => useQuery({ queryKey: ['ledger', 'verify'], queryFn: () => api('/api/ledger/verify'), staleTime: 30_000 });
export const usePublicPassport = (code) => useQuery({
  queryKey: ['public-passport', code],
  queryFn: () => api(`/api/passport/${encodeURIComponent(code)}`),
  enabled: !!code,
  retry: false,
});

/* ---------- profile ---------- */
export function useUpdateProfile(onUser) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api('/api/auth/me', { method: 'PATCH', body }),
    onSuccess: (data) => { onUser?.(data.user); qc.invalidateQueries({ queryKey: ['me'] }); },
  });
}
