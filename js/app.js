/* AranyaValue — shared shell, icons, helpers, sample data */
(function () {
  const P = {
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    chart: '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    shieldcheck: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    hexa: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    down: '<path d="m6 9 6 6 6-6"/>', up2: '<path d="m18 15-6-6-6 6"/>', right: '<path d="m9 18 6-6-6-6"/>', left: '<path d="m15 18-6-6 6-6"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', arrowup: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    pencil: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.8-1.7 1.7-1.7H16c3.1 0 5.5-2.4 5.5-5.5C21.5 6 17.5 2 12 2z"/>',
    sparkle: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
    flask: '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    handshake: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
    sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    xc: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    cc: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    minus: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
    tree: '<path d="M12 2 5 12h3l-4 6h6v4h4v-4h6l-4-6h3z"/>',
    lang: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
    sort: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    box2: '<path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    log: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/>'
  };
  const ic = (n, extra) => `<svg class="i ${extra || ''}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
  const hydrate = (root) => (root || document).querySelectorAll('i[data-i]').forEach((el) => {
    el.outerHTML = ic(el.dataset.i, el.className);
  });

  // images: fall back to a labelled emoji tile until the real photo is supplied
  const FB = {
    honey: ['🍯', '#f7e2a8'], mahua: ['🌸', '#f8d6e4'], medicinal: ['🌿', '#d6edd1'], seeds: ['🌰', '#ead7bf'], ntfp: ['🍃', '#dfe9c9'],
    avatar: ['🧑🏽‍🌾', '#d9efd9'], 'honey-1': ['🍯', '#f7e2a8'], 'honey-2': ['🐝', '#f6d98d'], 'honey-3': ['🍯', '#e9c07a'], flower: ['🌼', '#f1eed2'], forest: ['🌳', '#cfe5cf'],
    drying: ['☀️', '#f4e4b8'], packaging: ['📦', '#efe0c3'], note: ['📄', '#eef1ee']
  };
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (!t || t.tagName !== 'IMG' || t.dataset.fb) return;
    t.dataset.fb = 1;
    const key = (t.getAttribute('src') || '').split('/').pop().replace(/\.\w+$/, '');
    const base = key.replace(/-\d+$/, '');
    const [emoji, color] = FB[key] || FB[base] || (/scheme|sc-/.test(key) ? ['🌲', '#d7e9d3'] : ['🌿', '#e2eddc']);
    const s = document.createElement('span');
    s.className = (t.className + ' ph').trim();
    s.style.cssText = (t.getAttribute('style') || '') + `;--c:${color}`;
    s.textContent = emoji; s.setAttribute('role', 'img'); s.setAttribute('aria-label', t.alt || key); s.title = 'Placeholder – add assets/img/' + key + '.jpg';
    t.replaceWith(s);
  }, true);
  const img = (n, cls, alt) => `<img class="${cls || ''}" src="assets/img/${n}.jpg" alt="${alt || ''}" loading="lazy">`;

  let logoN = 0;
  const logoSvg = () => {
    const id = 'avgrad' + (++logoN);
    return `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="${id}" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#34b45a"/><stop offset="1" stop-color="#0f6b34"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="url(#${id})" stroke="#e9f6e4" stroke-width="2"/><path d="M32 10c6 4 10 9 6 15-4-1-7-3-8-7-1-3 0-6 2-8Z" fill="#fff"/><path d="M32 24c-6-5-13-4-15 1 2 4 8 5 15 2Z" fill="#fff"/><path d="M32 24c6-5 13-4 15 1-2 4-8 5-15 2Z" fill="#fff"/><circle cx="23" cy="43" r="8.5" fill="#f59e0b"/><circle cx="41" cy="43" r="8.5" fill="#f59e0b"/><path d="M18 43h10M36 43h10M23 38v10M41 38v10" stroke="#b45309" stroke-width="1.5" opacity=".6"/></svg>`;
  };

  const NAV = [
    ['dashboard', 'Dashboard', 'home', 'dashboard.html'],
    ['my-batches', 'My Batches', 'package', 'my-batches.html'],
    ['create-batch', 'Create Batch', 'plus', 'create-batch.html'],
    ['passport', 'Quality Passport', 'file', 'passport.html'],
    ['quality-price', 'Quality to Price', 'chart', 'quality-price.html'],
    ['buyers', 'Buyers', 'users', 'buyers.html'],
    ['post-harvest', 'Post-Harvest Assistant', 'leaf', 'post-harvest.html'],
    ['rejection', 'Rejection & Recovery', 'alert', 'rejection.html'],
    ['audit', 'Audit Ledger', 'hexa', 'audit.html'],
    ['schemes', 'Government Schemes', 'settings', 'schemes.html'],
    ['profile', 'Profile & Settings', 'settings', 'profile.html']
  ];

  function shell() {
    const page = document.body.dataset.page;
    if (!page || document.body.dataset.noshell) return;
    const main = document.querySelector('main');
    main.classList.add('main');
    const top = document.createElement('header');
    top.className = 'topbar';
    top.innerHTML = `<button class="burger" aria-label="Open menu" aria-expanded="false">${ic('menu')}</button>
      <a class="brand" href="dashboard.html" aria-label="AranyaValue home">${logoSvg()}<div><b>Aranya<span>Value</span></b><small>Forest Produce Quality-to-Price Intelligence Platform</small></div></a>
      <div class="top-right">
        <div style="position:relative"><button class="bell" aria-label="Notifications (3 unread)" aria-haspopup="true">${ic('bell')}<em>3</em></button>
          <div class="menu notif" id="notif"><h4>Notifications</h4>
            <div class="n"><span class="sec-ic sm">${ic('file')}</span><div>Batch HV-001 submitted for quality assessment<small>2 hours ago</small></div></div>
            <div class="n"><span class="sec-ic sm blue">${ic('handshake')}</span><div>New offer received from GreenLife Buyers (sample)<small>4 hours ago</small></div></div>
            <div class="n"><span class="sec-ic sm red">${ic('alert')}</span><div>Rejection recorded for batch HP-002<small>1 day ago</small></div></div>
          </div></div>
        <div style="position:relative"><button class="userbtn" aria-haspopup="true" aria-label="Account menu">${img('avatar', '', 'Ramesh Tudu')}<div><b>Ramesh Tudu</b><small>Collector</small></div>${ic('down')}</button>
          <div class="menu" id="umenu"><a href="profile.html">${ic('user')} Profile & Settings</a><a href="verify.html?batch=HV-001">${ic('qr')} Public verify page</a><a href="login.html">${ic('lock')} Sign out</a></div></div>
      </div>`;
    const side = document.createElement('aside');
    side.className = 'sidebar'; side.id = 'sidebar';
    side.innerHTML = `<nav aria-label="Main">${NAV.map(([k, l, i, h]) => `<a href="${h}" class="${k === page ? 'active' : ''}" ${k === page ? 'aria-current="page"' : ''}>${ic(i)}${l}</a>`).join('')}</nav>
      <div class="side-art"></div><div class="side-tag">${ic('leaf')}Better Quality<br>Better Opportunities<br>Greener Tomorrow</div>`;
    const scrim = document.createElement('div'); scrim.className = 'scrim';
    document.body.prepend(top, side, scrim);
    const tg = (b, m) => b.addEventListener('click', (e) => { e.stopPropagation(); document.querySelectorAll('.menu.open').forEach((x) => x !== m && x.classList.remove('open')); m.classList.toggle('open'); });
    tg(top.querySelector('.bell'), top.querySelector('#notif')); tg(top.querySelector('.userbtn'), top.querySelector('#umenu'));
    document.addEventListener('click', () => document.querySelectorAll('.menu.open').forEach((x) => x.classList.remove('open')));
    const bg = top.querySelector('.burger');
    const navMq = matchMedia('(max-width:900px)');
    const setNav = (o) => {
      const open = !!o && navMq.matches;
      side.classList.toggle('open', open);
      scrim.classList.toggle('on', open);
      bg.setAttribute('aria-expanded', String(open));
      const trap = navMq.matches && !open;
      try { side.inert = trap; } catch (err) {}
      side.toggleAttribute('aria-hidden', trap);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    bg.addEventListener('click', () => setNav(!side.classList.contains('open')));
    scrim.addEventListener('click', () => setNav(false));
    side.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setNav(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });
    navMq.addEventListener('change', () => setNav(false));
    setNav(false);
    const closeMenus = () => document.querySelectorAll('.menu.open').forEach((x) => x.classList.remove('open'));
    window.addEventListener('resize', closeMenus);
    window.addEventListener('scroll', (e) => { if (e.target.closest && e.target.closest('.menu')) return; closeMenus(); }, true);
  }

  // toasts + confirm
  function toast(msg, type) {
    let w = document.querySelector('.toasts');
    if (!w) { w = document.createElement('div'); w.className = 'toasts'; w.setAttribute('role', 'status'); w.setAttribute('aria-live', 'polite'); document.body.append(w); }
    const t = document.createElement('div'); t.className = 'toast ' + (type || '');
    t.innerHTML = ic(type === 'err' ? 'alert' : 'cc') + '<span></span>'; t.lastChild.textContent = msg; w.append(t);
    setTimeout(() => t.remove(), 3600);
  }
  function confirmBox({ title, text, ok = 'Confirm', cancel = 'Cancel', danger }) {
    return new Promise((res) => {
      const bg = document.createElement('div'); bg.className = 'modal-bg open';
      bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3></h3><p></p><div class="acts"><button class="btn" data-x="0"></button><button class="btn primary ${danger ? 'danger' : ''}" data-x="1"></button></div></div>`;
      bg.querySelector('.modal').setAttribute('aria-label', title);
      bg.querySelector('h3').textContent = title; bg.querySelector('p').textContent = text;
      const [c, o] = bg.querySelectorAll('button'); c.textContent = cancel; o.textContent = ok;
      const done = (v) => { bg.remove(); res(v); };
      c.onclick = () => done(false); o.onclick = () => done(true); bg.onclick = (e) => e.target === bg && done(false);
      bg.addEventListener('keydown', (e) => e.key === 'Escape' && done(false));
      document.body.append(bg); o.focus();
    });
  }
  function tabs(root, onChange) {
    const ts = [...root.querySelectorAll('[role=tab]')];
    ts.forEach((t) => t.addEventListener('click', () => {
      ts.forEach((x) => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', x === t); });
      document.querySelectorAll('[data-panel]').forEach((p) => { if (p.dataset.group === (root.dataset.group || '')) p.hidden = p.dataset.panel !== t.dataset.tab; });
      onChange && onChange(t.dataset.tab);
      const sc = t.closest('.tabs');
      if (sc && sc.scrollWidth > sc.clientWidth + 4) t.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }));
  }
  function installSheets() {
    const detail = document.getElementById('detail');
    if (!detail || !detail.closest('.buy-grid,.au-grid,.sc-grid,.rj-grid')) return;
    const mq = matchMedia('(max-width:900px)');
    const open = () => {
      if (!mq.matches) return;
      document.body.classList.add('sheet-on');
      if (!history.state || !history.state.sheet) history.pushState({ sheet: 1 }, '');
    };
    const close = () => document.body.classList.remove('sheet-on');
    new MutationObserver(() => {
      if (detail.querySelector(':scope > .sheet-x')) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn sheet-x';
      b.innerHTML = ic('left') + ' Back';
      b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        close();
        if (history.state && history.state.sheet) history.back();
      });
      detail.prepend(b);
    }).observe(detail, { childList: true });
    document.addEventListener('click', (e) => {
      if (e.target.closest('.bcard,.rcard,.scard,tr.evrow')) open();
      if (e.target.closest('#cl,#x')) close();
    });
    window.addEventListener('popstate', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    mq.addEventListener('change', () => { if (!mq.matches) close(); });
    if (mq.matches && /[?&](id|buyer)=/.test(location.search)) open();
  }
  const pager = (el, total, cur, cb) => {
    el.innerHTML = `<button aria-label="Previous page" ${cur === 1 ? 'disabled' : ''} data-p="${cur - 1}">${ic('left')}</button>` +
      Array.from({ length: total }, (_, i) => `<button class="${i + 1 === cur ? 'on' : ''}" data-p="${i + 1}" ${i + 1 === cur ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('') +
      `<button aria-label="Next page" ${cur === total ? 'disabled' : ''} data-p="${cur + 1}">${ic('right')}</button>`;
    el.querySelectorAll('button').forEach((b) => b.onclick = () => cb(+b.dataset.p));
  };
  const fmt = (n) => '₹' + n;
  const chipFor = { Draft: 'draft', Submitted: 'submitted', 'In Assessment': 'assess', Completed: 'done', Rejected: 'rejected', Conditional: 'cond' };
  const chip = (s, icon) => `<span class="chip ${chipFor[s] || 'gray'}">${icon ? ic(icon) : ''}${s}</span>`;

  // Shared sample/demo batches (same IDs on every page)
  const batches = [
    { id: 'HV-001', name: 'Honey', local: 'Wild Honey', qty: 10, unit: 'kg', status: 'In Assessment', upd: '2 hours ago', img: 'honey', date: '10 Oct 2026', loc: 'Jhargram, West Bengal' },
    { id: 'MA-003', name: 'Mahua Flowers', local: 'Dried Mahua', qty: 25, unit: 'kg', status: 'Submitted', upd: '5 hours ago', img: 'mahua', date: '10 Oct 2026', loc: 'Jhargram, West Bengal' },
    { id: 'MP-005', name: 'Medicinal Plants', local: 'Ashwagandha', qty: 5, unit: 'kg', status: 'Draft', upd: '1 day ago', img: 'medicinal', date: '8 Oct 2026', loc: 'Jhargram, West Bengal' },
    { id: 'SS-007', name: 'Seeds & Nuts', local: 'Sal Seeds', qty: 15, unit: 'kg', status: 'Completed', upd: '1 day ago', img: 'seeds', date: '9 Oct 2026', loc: 'Jhargram, West Bengal' },
    { id: 'HP-002', name: 'Honey', local: 'Multi-floral Honey', qty: 8, unit: 'kg', status: 'Rejected', upd: '2 days ago', img: 'honey', date: '3 Oct 2026', loc: 'Jhargram, West Bengal' },
    { id: 'HV-004', name: 'Honey', local: 'Forest Honey', qty: 12, unit: 'kg', status: 'Draft', upd: '3 days ago', img: 'honey', date: '1 Oct 2026', loc: 'Jhargram, West Bengal' },
    { id: 'OT-006', name: 'Other NTFP', local: 'Sal Resin', qty: 20, unit: 'kg', status: 'Completed', upd: '4 days ago', img: 'ntfp', date: '28 Sep 2026', loc: 'Jhargram, West Bengal' },
    { id: 'MA-008', name: 'Mahua Flowers', local: 'Dried Mahua', qty: 18, unit: 'kg', status: 'Completed', upd: '5 days ago', img: 'mahua', date: '25 Sep 2026', loc: 'Jhargram, West Bengal' }
  ];

  window.AV = { ic, img, get logo() { return logoSvg(); }, toast, confirmBox, tabs, pager, chip, fmt, batches, hydrate, params: new URLSearchParams(location.search) };
  function installPageTransitions() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      let url;
      try { url = new URL(a.getAttribute('href'), location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (document.body.classList.contains('is-leaving')) { e.preventDefault(); return; }
      e.preventDefault();
      document.body.classList.add('is-leaving');
      setTimeout(() => { location.href = url.href; }, 230);
    });
  }
  const init = () => {
    shell();
    installSheets();
    installPageTransitions();
    hydrate();
    document.addEventListener('click', (e) => {
      const el = e.target.closest('.tab,.step,.stage');
      if (!el) return;
      const sc = el.closest('.tabs,.stepper,.ph-stages');
      if (sc && sc.scrollWidth > sc.clientWidth + 4) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    });
    document.dispatchEvent(new Event('av:ready'));
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
