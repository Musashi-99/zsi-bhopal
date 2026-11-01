/** Simplified district plates for the officer map. Outlines are desk geometry, not a cadastral survey. */

export const SHEETS = [
  {
    id: 'jangal',
    title: 'Jangalmahal',
    index: 'WB–SW',
    bbox: { west: 85.45, south: 21.7, east: 88.55, north: 24.85 },
    plates: [
      {
        id: 'DT-PUR',
        name: 'Purulia',
        ring: [[85.78, 23.42], [85.84, 22.86], [86.22, 22.52], [86.78, 22.58], [86.98, 23.02], [86.74, 23.52], [86.18, 23.74], [85.82, 23.62]],
      },
      {
        id: 'DT-BAN',
        name: 'Bankura',
        ring: [[86.74, 23.52], [86.98, 23.02], [87.08, 22.78], [87.58, 22.86], [87.74, 23.28], [87.42, 23.66], [86.92, 23.74]],
      },
      {
        id: 'DT-BIR',
        name: 'Birbhum',
        ring: [[86.92, 23.74], [87.42, 23.66], [87.74, 23.28], [88.08, 23.42], [88.28, 23.92], [88.12, 24.48], [87.42, 24.58], [87.02, 24.18], [86.86, 23.86]],
      },
      {
        id: 'DT-JHA',
        name: 'Jhargram',
        ring: [[86.22, 22.52], [86.78, 22.58], [86.98, 23.02], [87.08, 22.78], [87.22, 22.28], [86.72, 21.98], [86.28, 22.12]],
      },
      {
        id: 'DT-PME',
        name: 'Paschim Medinipur',
        ring: [[87.08, 22.78], [87.22, 22.28], [87.62, 22.08], [88.12, 22.18], [88.22, 22.62], [87.78, 22.98], [87.58, 22.86]],
      },
    ],
  },
  {
    id: 'dooars',
    title: 'Dooars',
    index: 'WB–N',
    bbox: { west: 88.05, south: 26.05, east: 90.15, north: 27.2 },
    plates: [
      {
        id: 'DT-JAL',
        name: 'Jalpaiguri',
        ring: [[88.32, 26.92], [88.42, 26.38], [88.92, 26.24], [89.28, 26.36], [89.36, 26.78], [88.98, 27.02], [88.48, 26.98]],
      },
      {
        id: 'DT-ALI',
        name: 'Alipurduar',
        ring: [[89.28, 26.36], [89.62, 26.28], [89.92, 26.46], [89.98, 26.88], [89.58, 27.02], [89.36, 26.78]],
      },
    ],
  },
];

export const PLATES = SHEETS.flatMap((s) => s.plates.map((p) => ({ ...p, sheet: s.id })));
export const SHEET_OF = Object.fromEntries(PLATES.map((p) => [p.id, p.sheet]));
export const PLATE_BY_ID = Object.fromEntries(PLATES.map((p) => [p.id, p]));
export const PLATE_BY_NAME = Object.fromEntries(PLATES.map((p) => [p.name.toLowerCase(), p]));

export const MAP_MODES = [
  { id: 'imagery', label: 'Imagery', attr: 'Esri, Maxar, Earthstar Geographics' },
  { id: 'topo', label: 'Topo', attr: 'Esri, HERE, Garmin, USGS, NOAA' },
  { id: 'relief', label: 'Relief', attr: 'Esri, USGS, NOAA' },
  { id: 'survey', label: 'Survey', attr: 'AranyaValue schematic sheet' },
];

const TEMPLATES = {
  imagery: (z, x, y) => `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  topo: (z, x, y) => `https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`,
  relief: (z, x, y) => `https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/${z}/${y}/${x}`,
};

export function mercY(lat) {
  const φ = (lat * Math.PI) / 180;
  const s = Math.sin(φ);
  return (1 - Math.log((1 + s) / (1 - s)) / (2 * Math.PI)) / 2;
}

export function invMerc(ny) {
  return (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - 2 * ny)));
}

export function inside(ring, x, y) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi) hit = !hit;
  }
  return hit;
}

export function centroid(ring) {
  let x = 0;
  let y = 0;
  for (const [lng, lat] of ring) {
    x += lng;
    y += lat;
  }
  return [x / ring.length, y / ring.length];
}

export function slot(id, ring) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  for (let i = 0; i < 18; i++) {
    h = Math.imul(h, 1664525) + 1013904223;
    const u = ((h >>> 0) % 10000) / 10000;
    h = Math.imul(h, 1664525) + 1013904223;
    const v = ((h >>> 0) % 10000) / 10000;
    const lng = minX + (maxX - minX) * (0.16 + u * 0.68);
    const lat = minY + (maxY - minY) * (0.16 + v * 0.68);
    if (inside(ring, lng, lat)) return [lng, lat];
  }
  return centroid(ring);
}

export function makeView(bbox, w, h) {
  const padX = 16;
  const padTop = 14;
  const padBottom = 44;
  const nx0 = (bbox.west + 180) / 360;
  const nx1 = (bbox.east + 180) / 360;
  const ny0 = mercY(bbox.north);
  const ny1 = mercY(bbox.south);
  const bw = nx1 - nx0;
  const bh = ny1 - ny0;
  const innerW = Math.max(1, w - padX * 2);
  const innerH = Math.max(1, h - padTop - padBottom);
  const scale = Math.min(innerW / bw, innerH / bh);
  const usedW = bw * scale;
  const usedH = bh * scale;
  return {
    nx0,
    ny0,
    scale,
    ox: padX + (innerW - usedW) / 2,
    oy: padTop + (innerH - usedH) / 2,
    mapW: usedW,
    mapH: usedH,
    w,
    h,
    bbox,
  };
}

export function cameraView(base, cam) {
  const z = cam?.zoom > 0 ? cam.zoom : 1;
  const cx = base.ox + base.mapW / 2;
  const cy = base.oy + base.mapH / 2;
  return {
    ...base,
    scale: base.scale * z,
    mapW: base.mapW * z,
    mapH: base.mapH * z,
    ox: cx - (base.mapW * z) / 2 + (cam?.x || 0),
    oy: cy - (base.mapH * z) / 2 + (cam?.y || 0),
  };
}

export function toScreen(lng, lat, v) {
  const nx = (lng + 180) / 360;
  const ny = mercY(lat);
  return [v.ox + (nx - v.nx0) * v.scale, v.oy + (ny - v.ny0) * v.scale];
}

export function fromScreen(x, y, v) {
  const nx = v.nx0 + (x - v.ox) / v.scale;
  const ny = v.ny0 + (y - v.oy) / v.scale;
  return [nx * 360 - 180, invMerc(ny)];
}

export function projectRing(ring, v) {
  return ring.map(([lng, lat]) => toScreen(lng, lat, v));
}

function chooseZ(bbox, cssW) {
  const span = bbox.east - bbox.west;
  let z = 6;
  for (let k = 6; k <= 12; k++) {
    const n = 2 ** k;
    const tilesX = Math.floor(((bbox.east + 180) / 360) * n) - Math.floor(((bbox.west + 180) / 360) * n) + 1;
    const tilesY = Math.floor(mercY(bbox.south) * n) - Math.floor(mercY(bbox.north) * n) + 1;
    if (tilesX * tilesY > 36) break;
    z = k;
    const px = (span / 360) * n * 256;
    if (px >= Math.max(640, cssW) * 1.35) break;
  }
  return z;
}

export function tilesFor(mode, bbox, cssW) {
  if (mode === 'survey' || !TEMPLATES[mode]) return [];
  const z = chooseZ(bbox, cssW || 900);
  const n = 2 ** z;
  const x0 = Math.floor(((bbox.west + 180) / 360) * n);
  const x1 = Math.floor(((bbox.east + 180) / 360) * n);
  const y0 = Math.floor(mercY(bbox.north) * n);
  const y1 = Math.floor(mercY(bbox.south) * n);
  const urls = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const west = (x / n) * 360 - 180;
      const east = ((x + 1) / n) * 360 - 180;
      const north = invMerc(y / n);
      const south = invMerc((y + 1) / n);
      urls.push({ url: TEMPLATES[mode](z, x, y), west, east, north, south });
    }
  }
  return urls;
}

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dφ = ((lat2 - lat1) * Math.PI) / 180;
  const dλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function scaleFor(v) {
  const [lngA, latA] = fromScreen(v.ox, v.oy + v.mapH / 2, v);
  const [lngB, latB] = fromScreen(v.ox + 120, v.oy + v.mapH / 2, v);
  const km120 = haversine(latA, lngA, latB, lngB) || 1;
  const choices = [1, 2, 5, 10, 20, 25, 50, 100, 200];
  let best = choices[0];
  for (const c of choices) {
    if ((120 * c) / km120 < 168) best = c;
  }
  return { label: `${best} km`, px: (120 * best) / km120 };
}

export function fmtCoord(lng, lat) {
  const part = (v, pos, neg) => {
    const hemi = v < 0 ? neg : pos;
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = (a - d) * 60;
    return `${d}°${m.toFixed(1).padStart(4, '0')}′${hemi}`;
  };
  return `${part(lat, 'N', 'S')}  ${part(lng, 'E', 'W')}`;
}

const tileCache = new Map();
const tileWait = new Map();
const tileListeners = new Set();

export function cachedTile(url) {
  return tileCache.has(url) ? tileCache.get(url) : undefined;
}

export function requestTiles(urls) {
  for (const { url } of urls) {
    if (tileCache.has(url) || tileWait.has(url)) continue;
    const job = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        tileCache.set(url, img);
        resolve();
      };
      img.onerror = () => {
        tileCache.set(url, null);
        resolve();
      };
      img.src = url;
    }).then(() => {
      tileWait.delete(url);
      tileListeners.forEach((fn) => fn());
    });
    tileWait.set(url, job);
  }
}

export function watchTiles(fn) {
  tileListeners.add(fn);
  return () => tileListeners.delete(fn);
}

export function tileSummary(urls) {
  if (!urls.length) return { ready: true, failed: false, pending: false };
  let ok = 0;
  let bad = 0;
  for (const { url } of urls) {
    if (!tileCache.has(url)) continue;
    if (tileCache.get(url)) ok += 1;
    else bad += 1;
  }
  const settled = ok + bad === urls.length;
  return { ready: ok > 0, failed: settled && ok === 0, pending: !settled && ok === 0 };
}
