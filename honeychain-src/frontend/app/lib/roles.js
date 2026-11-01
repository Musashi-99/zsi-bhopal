// Role → home route. The role always comes from the server session, never from a UI choice.
export const PORTALS = {
  collector: { label: 'Collector / Producer', roles: ['collector', 'centre'] },
  buyer: { label: 'Buyer', roles: ['buyer'] },
  officer: { label: 'Government Officer', roles: ['inspector', 'admin'] },
};

export const homeFor = (u) => {
  if (!u) return '/';
  if (u.role === 'buyer') return '/market';
  if (u.role === 'inspector' || u.role === 'admin') return '/officer/overview';
  return '/dashboard';
};
export const isOfficer = (u) => !!u && (u.role === 'inspector' || u.role === 'admin');
export const isSeller = (u) => !!u && (u.role === 'collector' || u.role === 'centre' || u.role === 'admin');
