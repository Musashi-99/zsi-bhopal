export const DEMO_ACCOUNTS = {
  collector: [
    { id: 'collector', label: 'Collector', name: 'Mina Mahato', email: 'mina@aranya.demo', password: 'collector123' },
    { id: 'centre', label: 'Collection centre', name: 'Purulia centre', email: 'centre.purulia@aranya.demo', password: 'centre12345' },
  ],
  buyer: [
    { id: 'buyer', label: 'Buyer', name: 'Demo Buyer', email: 'buyer.haat@aranya.demo', password: 'buyer12345' },
  ],
  officer: [
    { id: 'officer', label: 'Government officer', name: 'Forest inspector', email: 'inspector@aranya.demo', password: 'inspector123' },
    { id: 'admin', label: 'Administrator', name: 'Demo administrator', email: 'admin@aranya.demo', password: 'admin12345' },
  ],
};

export const accountFor = (portal) => DEMO_ACCOUNTS[portal]?.[0] || DEMO_ACCOUNTS.collector[0];
