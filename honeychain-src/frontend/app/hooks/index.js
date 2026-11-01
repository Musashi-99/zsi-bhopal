import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBatches } from '../api/queries';

export function useDocTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} – AranyaValue` : 'AranyaValue';
  }, [title]);
}

/**
 * Batch picker state backed by the URL (/base/:id). Falls back to the first batch.
 * Returns { batches, id, batch, select, isLoading }.
 */
export function useSelectedBatch(base) {
  const { id: param } = useParams();
  const navigate = useNavigate();
  const list = useBatches();
  const batches = useMemo(() => list.data || [], [list.data]);
  const batch = useMemo(
    () => batches.find((b) => b.id === param || b.batch_code === param) || batches[0] || null,
    [batches, param],
  );
  return {
    batches,
    batch,
    id: batch?.id,
    select: (id) => navigate(`${base}/${id}`),
    isLoading: list.isLoading,
    error: list.error,
    refetch: list.refetch,
  };
}

/** Find a measurement (case-insensitive) in a passport. */
export const findMeasurement = (passport, name) =>
  (passport?.measurements || []).filter((m) => m.parameter?.toLowerCase() === name.toLowerCase()).at(-1);

export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms, setV]);
  return v;
}
