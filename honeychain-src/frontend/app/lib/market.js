export const inr = (n, max = 2) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: max })}`);
export const qty = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }));

// Image fallback tiles keyed by category slug, used whenever a photo file is missing.
export const TILE = {
  'mahua-flowers': ['🌼', '#f6e7c1'], 'sal-leaves': ['🍃', '#d5e6c4'], 'kendu-leaves': ['🌿', '#cfdcbd'], 'forest-honey': ['🍯', '#f4dfa0'],
  'lac-resins': ['🪵', '#f1cfc0'], 'sabai-grass': ['🌾', '#ece0b0'], 'medicinal-aromatic': ['🌱', '#d3e8d0'], 'seeds-nuts': ['🌰', '#ead7bf'],
  'natural-fibres': ['🧵', '#e8dcc2'], 'other-ntfps': ['🎋', '#dce8c9'],
};

export const TONE = { green: 'green', amber: 'amber', red: 'red', blue: 'blue', sage: 'sage', gray: 'gray' };

export const ENQ_STATUS = {
  open: { label: 'Awaiting seller', tone: 'blue' },
  negotiating: { label: 'Seller replied', tone: 'amber' },
  accepted: { label: 'Accepted', tone: 'green' },
  rejected: { label: 'Declined', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
};
export const ORDER_STEPS = ['confirmed', 'packed', 'dispatched', 'delivered'];
export const ORDER_LABEL = { confirmed: 'Confirmed', packed: 'Packed', dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled' };
export const KIND_LABEL = { enquiry: 'Enquiry', bulk_enquiry: 'Bulk enquiry', purchase_request: 'Purchase request' };

export const SOURCE_TONE = {
  producer_reported: 'gray', centre_checked: 'sage', instrument_measured: 'blue', laboratory_tested: 'blue', officer_verified: 'green', imported: 'gray', simulated: 'amber',
};
export const SOURCE_LEGEND = [
  ['producer_reported', 'Producer-reported', 'Entered by the collector. Not independently checked.'],
  ['centre_checked', 'Collection-centre checked', 'Measured or inspected by the collection centre.'],
  ['instrument_measured', 'Instrument-measured', 'Taken with an instrument and recorded with the method.'],
  ['laboratory_tested', 'Laboratory-tested', 'Backed by a laboratory report reference.'],
  ['officer_verified', 'Government officer verified', 'Recorded or confirmed by an authorised officer.'],
];
