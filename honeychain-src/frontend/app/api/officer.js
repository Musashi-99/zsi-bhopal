import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '../lib/api';

const BASE = '/api/officer';

export const useO = (path, opts = {}) => useQuery({
  queryKey: ['officer', path],
  queryFn: () => api(`${BASE}${path}`),
  ...opts,
});

export const useOfficerOverview = () => useO('/overview', { refetchInterval: 60_000 });
export const useOfficerMeta = () => useO('/meta', { staleTime: 10 * 60_000 });

/** Returns a function that sends a write and refreshes every officer query + the main-portal caches. */
export function useOWrite() {
  const qc = useQueryClient();
  return async (path, body, method = 'POST') => {
    const out = await api(`${BASE}${path}`, { method, body });
    await qc.invalidateQueries({ queryKey: ['officer'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['store'] });
    qc.invalidateQueries({ queryKey: ['batches'] });
    return out;
  };
}

export const oqs = qs;
export const reportUrl = (id, params = {}) => `${BASE}/reports/${id}${qs({ ...params, format: 'csv' })}`;
