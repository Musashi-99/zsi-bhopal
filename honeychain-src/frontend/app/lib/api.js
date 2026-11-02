export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** Thin fetch wrapper: JSON in/out, cookie auth, friendly errors. */
export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'include',
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 403 && /needs one of these roles/.test(data.error || '')) window.dispatchEvent(new Event('aranya:session-stale'));
    throw new ApiError(data.error || 'Request failed', res.status);
  }
  return data;
}

export const qs = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v != null && v !== '' && q.set(k, v));
  const s = q.toString();
  return s ? `?${s}` : '';
};
