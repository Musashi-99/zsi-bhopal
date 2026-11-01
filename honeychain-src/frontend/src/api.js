export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network unavailable. The draft can stay on this phone.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Request failed', res.status);
  return data;
}

export function homeFor(role) {
  return {
    collector: '/collector/dashboard',
    centre: '/centre/dashboard',
    buyer: '/buyer/dashboard',
    inspector: '/inspector/dashboard',
    admin: '/admin/dashboard',
  }[role] || '/';
}

export const DRAFT_KEY = 'aranya_drafts';

export function readDrafts() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]'); } catch { return []; }
}

export function writeDrafts(rows) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(rows));
}
