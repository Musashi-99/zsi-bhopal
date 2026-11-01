import { useEffect, useRef, useState } from 'react';
import {
  cachedTile,
  cameraView,
  fmtCoord,
  fromScreen,
  inside,
  makeView,
  projectRing,
  requestTiles,
  scaleFor,
  slot,
  tileSummary,
  tilesFor,
  toScreen,
  watchTiles,
} from './forestGeo';

const POINT_COLOR = {
  pending_verification: '#e6a317',
  submitted: '#e6a317',
  needs_info: '#3b82f6',
  verified: '#3d9a5b',
  verified_with_limitations: '#3d9a5b',
  rejected: '#d4534a',
  failed_checks: '#d4534a',
  suspended: '#9b2c2c',
  dispatched: '#8d887c',
};

const CENTRE_COLOR = { active: '#e2c57a', suspended: '#e15b4c', expired: '#e6a317', none: '#f4efe4' };

let grain;
function grainTile() {
  if (grain) return grain;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  let s = 1337;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const v = 70 + (s % 90);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v - 10;
    img.data[i + 3] = 32;
  }
  g.putImageData(img, 0, 0);
  grain = c;
  return c;
}

function trace(ctx, ring, lift = 0) {
  ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - lift) : ctx.moveTo(x, y - lift)));
  ctx.closePath();
}

function halo(ctx, text, x, y) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(8,14,10,0.78)';
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function drawSurvey(ctx, v, plates, stats) {
  const { ox, oy, mapW, mapH } = v;
  ctx.fillStyle = '#cfc6b0';
  ctx.fillRect(ox, oy, mapW, mapH);
  const wash = ctx.createLinearGradient(ox, oy, ox, oy + mapH);
  wash.addColorStop(0, 'rgba(86, 122, 78, 0.28)');
  wash.addColorStop(0.55, 'rgba(196, 176, 120, 0.18)');
  wash.addColorStop(1, 'rgba(92, 108, 64, 0.22)');
  ctx.fillStyle = wash;
  ctx.fillRect(ox, oy, mapW, mapH);
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.drawImage(grainTile(), ox, oy, mapW, mapH);
  ctx.restore();
  const max = Math.max(1, ...plates.map((p) => stats[p.id]?.batches || 0));
  for (const plate of plates) {
    const n = stats[plate.id]?.batches || 0;
    const t = n / max;
    ctx.beginPath();
    trace(ctx, plate.screen);
    ctx.fillStyle = `rgba(20, 92, 48, ${0.16 + t * 0.62})`;
    ctx.fill();
    if ((stats[plate.id]?.pending || 0) > 0) {
      ctx.save();
      ctx.beginPath();
      trace(ctx, plate.screen);
      ctx.clip();
      const ys = plate.screen.map((p) => p[1]);
      const xs = plate.screen.map((p) => p[0]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      ctx.strokeStyle = 'rgba(120, 72, 18, 0.45)';
      ctx.lineWidth = 1;
      for (let x = minX - (maxY - minY); x < maxX; x += 7) {
        ctx.beginPath();
        ctx.moveTo(x, minY);
        ctx.lineTo(x + (maxY - minY), maxY);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawTiles(ctx, v, urls, mode) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.ox, v.oy, v.mapW, v.mapH);
  ctx.clip();
  ctx.fillStyle = mode === 'relief' ? '#9aa394' : '#1a2820';
  ctx.fillRect(v.ox, v.oy, v.mapW, v.mapH);
  if (mode === 'imagery') ctx.filter = 'saturate(1.15) contrast(1.06)';
  if (mode === 'relief') ctx.filter = 'contrast(1.08)';
  for (const tile of urls) {
    const img = cachedTile(tile.url);
    if (!img) continue;
    const [x0, y0] = toScreen(tile.west, tile.north, v);
    const [x1, y1] = toScreen(tile.east, tile.south, v);
    ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0);
  }
  ctx.filter = 'none';
  ctx.restore();
}

function drawGraticule(ctx, v, light, labels, drawLines = true) {
  const { bbox } = v;
  if (!drawLines && !labels) return;
  const span = bbox.east - bbox.west;
  const step = span > 2.2 ? 0.5 : 0.25;
  const ticks = (min, max) => {
    const out = [];
    let value = Math.ceil((min + 1e-6) / step) * step;
    for (; value < max - 1e-6; value += step) out.push(Math.round(value * 1000) / 1000);
    return out;
  };
  if (drawLines) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.ox, v.oy, v.mapW, v.mapH);
    ctx.clip();
    ctx.lineWidth = 1;
    ctx.strokeStyle = light ? 'rgba(255,255,255,0.28)' : 'rgba(42, 38, 28, 0.28)';
    ctx.beginPath();
    for (const lng of ticks(bbox.west, bbox.east)) {
      const [x, y0] = toScreen(lng, bbox.north, v);
      const [, y1] = toScreen(lng, bbox.south, v);
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
    }
    for (const lat of ticks(bbox.south, bbox.north)) {
      const [x0, y] = toScreen(bbox.west, lat, v);
      const [x1] = toScreen(bbox.east, lat, v);
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();
    ctx.restore();
  }
  if (!labels) return;
  ctx.font = '11px ui-monospace, "Segoe UI Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = light ? '#f4efe4' : '#2a261c';
  const mark = (v) => {
    const d = Math.floor(Math.abs(v));
    const m = Math.round((Math.abs(v) - d) * 60);
    return m ? `${d}°${String(m).padStart(2, '0')}′` : `${d}°`;
  };
  for (const lat of ticks(bbox.south, bbox.north)) {
    const [x, y] = toScreen(bbox.west, lat, v);
    if (y < v.oy + 12 || y > v.oy + v.mapH - 12) continue;
    halo(ctx, mark(lat), x + 6, y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const lng of ticks(bbox.west, bbox.east)) {
    const [x, y] = toScreen(lng, bbox.north, v);
    if (x < v.ox + 28 || x > v.ox + v.mapW - 28) continue;
    halo(ctx, mark(lng), x, y + 5);
  }
}

function edgeLight(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return Math.max(0, Math.min(1, 0.32 + (-dx / len) * 0.45));
}

function drawPlate(ctx, base, plate, lift, mode, w, h) {
  const lightFace = mode === 'survey' || mode === 'topo';
  if (lift > 3) {
    ctx.save();
    ctx.beginPath();
    trace(ctx, plate.screen, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 16 + lift * 0.2;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fill();
    ctx.restore();
    const ring = plate.screen;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const t = edgeLight(a, b);
      const g = lightFace ? Math.round(92 + t * 78) : Math.round(14 + t * 40);
      ctx.fillStyle = lightFace ? `rgb(${g}, ${g - 10}, ${g - 28})` : `rgb(${g}, ${g + 8}, ${g + 4})`;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(b[0], b[1] - lift);
      ctx.lineTo(a[0], a[1] - lift);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.save();
  ctx.beginPath();
  trace(ctx, plate.screen, lift);
  ctx.clip();
  ctx.drawImage(base, 0, 0, base.width, base.height, 0, -lift, w, h);
  ctx.restore();
  ctx.beginPath();
  trace(ctx, plate.screen, lift);
  ctx.lineWidth = lift > 3 ? 2 : 1.25;
  ctx.strokeStyle = lift > 3 ? '#f0d48a' : (lightFace ? 'rgba(28, 42, 32, 0.85)' : 'rgba(244, 239, 228, 0.9)');
  ctx.stroke();
}

function diamond(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.86, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.86, y);
  ctx.closePath();
}

export default function TerrainMap({
  sheet,
  mode,
  stats,
  points,
  selectedId,
  activePointId,
  onSelect,
  onPoint,
}) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const baseRef = useRef(null);
  const drawRef = useRef(() => false);
  const lifts = useRef(new Map());
  const hoverRef = useRef(null);
  const pointHover = useRef(null);
  const live = useRef({});
  const coordRef = useRef(null);
  const noteRef = useRef('');
  const camRef = useRef({ zoom: 1, x: 0, y: 0 });
  const zoomAtRef = useRef(() => {});
  const dragRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tick, setTick] = useState(0);
  const [scale, setScale] = useState(null);
  const [hot, setHot] = useState(false);
  const [drag, setDrag] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [note, setNote] = useState('');
  const [, setNudge] = useState(0);

  live.current = { sheet, mode, stats, points, selectedId, activePointId, size };

  const urls = size.w ? tilesFor(mode, sheet.bbox, size.w * zoom) : [];
  const tiles = tileSummary(urls);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(0, Math.round(r.width)), h: Math.max(0, Math.round(r.height)) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => watchTiles(() => setTick((n) => n + 1)), []);

  useEffect(() => {
    if (mode === 'survey' || !urls.length) return undefined;
    requestTiles(urls);
    return undefined;
  }, [mode, sheet.id, urls.map((u) => u.url).join('|')]);

  useEffect(() => {
    camRef.current = { zoom: 1, x: 0, y: 0 };
    setZoom(1);
  }, [sheet.id]);

  useEffect(() => {
    if (!size.w) return;
    setScale(scaleFor(cameraView(makeView(sheet.bbox, size.w, size.h), camRef.current)));
  }, [size.w, size.h, sheet, zoom]);

  drawRef.current = () => {
    const canvas = canvasRef.current;
    const { w, h } = live.current.size;
    if (!canvas || w < 8 || h < 8) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const view = cameraView(makeView(live.current.sheet.bbox, w, h), camRef.current);
    const plates = live.current.sheet.plates.map((p) => ({ ...p, screen: projectRing(p.ring, view) }));
    const liftMax = Math.min(56, Math.max(26, h * 0.09));
    let moving = false;
    for (const plate of plates) {
      const goal = plate.id === live.current.selectedId ? liftMax : plate.id === hoverRef.current ? Math.min(18, liftMax * 0.38) : 0;
      let value = lifts.current.get(plate.id) || 0;
      if (reduce) value = goal;
      else value += (goal - value) * 0.2;
      if (Math.abs(goal - value) < 0.4) value = goal;
      else moving = true;
      lifts.current.set(plate.id, value);
    }
    if (!baseRef.current) baseRef.current = document.createElement('canvas');
    const base = baseRef.current;
    base.width = Math.round(w * dpr);
    base.height = Math.round(h * dpr);
    const bctx = base.getContext('2d');
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, w, h);
    bctx.fillStyle = '#101612';
    bctx.fillRect(0, 0, w, h);
    const useSurvey = live.current.mode === 'survey' || (live.current.mode !== 'survey' && tiles.failed);
    if (useSurvey) drawSurvey(bctx, view, plates, live.current.stats);
    else drawTiles(bctx, view, urls, live.current.mode);
    const lightMap = !useSurvey && (live.current.mode === 'imagery' || live.current.mode === 'relief');
    drawGraticule(bctx, view, lightMap, false);

    canvas.width = base.width;
    canvas.height = base.height;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(base, 0, 0, base.width, base.height, 0, 0, w, h);
    if (live.current.mode === 'imagery' || live.current.mode === 'relief') {
      const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.62);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
    }
    if (live.current.selectedId) {
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.fillRect(0, 0, w, h);
    }
    const raised = plates
      .map((p) => ({ ...p, lift: lifts.current.get(p.id) || 0 }))
      .filter((p) => p.lift > 0.5)
      .sort((a, b) => a.lift - b.lift);
    for (const plate of raised) drawPlate(ctx, base, plate, plate.lift, live.current.mode, w, h);
    const lightFace = useSurvey || live.current.mode === 'topo';
    for (const plate of plates) {
      if ((lifts.current.get(plate.id) || 0) > 0.5) continue;
      ctx.beginPath();
      trace(ctx, plate.screen, 0);
      ctx.lineWidth = plate.id === hoverRef.current ? 2 : 1.15;
      ctx.strokeStyle = lightFace ? 'rgba(28, 42, 32, 0.88)' : 'rgba(244, 239, 228, 0.92)';
      ctx.stroke();
    }
    const layoutPoints = [];
    for (const point of live.current.points) {
      const plate = plates.find((p) => p.id === point.plateId);
      if (!plate) continue;
      const [lng, lat] = slot(point.id, plate.ring);
      const [x, y0] = toScreen(lng, lat, view);
      const y = y0 - (lifts.current.get(plate.id) || 0);
      layoutPoints.push({ ...point, x, y });
      ctx.save();
      ctx.translate(x, y);
      if (point.kind === 'centre') {
        ctx.fillStyle = CENTRE_COLOR[point.accent] || '#f4efe4';
        ctx.strokeStyle = '#142018';
        ctx.lineWidth = 1.4;
        diamond(ctx, 0, 0, point.id === live.current.activePointId ? 8 : 6);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = POINT_COLOR[point.status] || '#f4efe4';
        ctx.strokeStyle = '#142018';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, point.id === live.current.activePointId ? 6.5 : 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      const batchCount = live.current.points.filter((row) => row.plateId === point.plateId && row.kind === 'batch').length;
      const show = point.id === live.current.activePointId || point.id === pointHover.current || (point.plateId === live.current.selectedId && point.kind === 'batch' && batchCount <= 6);
      if (show) {
        ctx.font = '11px ui-monospace, "Segoe UI Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#f6f1e4';
        halo(ctx, point.kind === 'centre' ? 'Centre' : point.title, x + 8, y - 6);
      }
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 13px Poppins, Inter, sans-serif';
    for (const plate of plates) {
      const lift = lifts.current.get(plate.id) || 0;
      const xs = plate.screen.map((p) => p[0]);
      const ys = plate.screen.map((p) => p[1]);
      const x = (Math.min(...xs) + Math.max(...xs)) / 2;
      const y = Math.min(...ys) + 16 - lift;
      const count = live.current.stats[plate.id]?.batches || 0;
      const label = count ? `${plate.name}  ${count}` : plate.name;
      const width = ctx.measureText(label).width;
      ctx.fillStyle = lightFace ? 'rgba(244,239,226,0.88)' : 'rgba(8,14,10,0.62)';
      ctx.fillRect(x - width / 2 - 5, y - 9, width + 10, 18);
      ctx.fillStyle = lightFace ? '#1c2418' : '#f6f1e4';
      ctx.fillText(label, x, y);
    }
    canvas._hit = { plates, points: layoutPoints, view };
    drawGraticule(ctx, view, lightMap, true, false);
    ctx.strokeStyle = lightFace ? 'rgba(42, 36, 24, 0.75)' : 'rgba(226, 197, 122, 0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(view.ox, view.oy, view.mapW, view.mapH);
    ctx.strokeRect(view.ox + 3, view.oy + 3, view.mapW - 6, view.mapH - 6);
    ctx.font = '11px ui-monospace, "Segoe UI Mono", monospace';
    ctx.fillStyle = lightFace ? '#2a261c' : '#f0d48a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(live.current.sheet.index, view.ox + 8, view.oy + 8);
    const nextNote = live.current.mode === 'survey' ? '' : tiles.failed ? 'Tiles did not load. This sheet is the local survey drawing.' : tiles.pending ? 'Loading map tiles' : '';
    if (nextNote !== noteRef.current) {
      noteRef.current = nextNote;
      setNote(nextNote);
    }
    return moving;
  };

  useEffect(() => {
    let stop = false;
    let raf = 0;
    const loop = () => {
      if (stop) return;
      const moving = drawRef.current();
      if (moving) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
    };
  });

  function placeCamera(base, cam, w, h) {
    const z = cam.zoom <= 1.02 ? 1 : cam.zoom;
    const mapW = base.mapW * z;
    const mapH = base.mapH * z;
    const cx = base.ox + base.mapW / 2;
    const cy = base.oy + base.mapH / 2;
    let x = z === 1 || mapW <= w ? 0 : cam.x;
    let y = z === 1 || mapH <= h ? 0 : cam.y;
    if (mapW > w) {
      const ox = Math.min(0, Math.max(w - mapW, cx - mapW / 2 + x));
      x = ox - (cx - mapW / 2);
    }
    if (mapH > h) {
      const oy = Math.min(0, Math.max(h - mapH, cy - mapH / 2 + y));
      y = oy - (cy - mapH / 2);
    }
    return { zoom: z, x, y };
  }

  function zoomAt(mx, my, factor) {
    const { w, h } = live.current.size;
    const liveSheet = live.current.sheet;
    if (!w || !h || !liveSheet) return;
    const cam = camRef.current;
    const next = Math.min(8, Math.max(1, cam.zoom * factor));
    if (Math.abs(next - cam.zoom) < 0.01) return;
    const base = makeView(liveSheet.bbox, w, h);
    if (next <= 1.02) {
      camRef.current = { zoom: 1, x: 0, y: 0 };
    } else {
      const before = cameraView(base, cam);
      const [lng, lat] = fromScreen(mx, my, before);
      const mid = cameraView(base, { zoom: next, x: cam.x, y: cam.y });
      const [sx, sy] = toScreen(lng, lat, mid);
      camRef.current = placeCamera(base, { zoom: next, x: cam.x + mx - sx, y: cam.y + my - sy }, w, h);
    }
    setZoom(camRef.current.zoom);
  }
  zoomAtRef.current = zoomAt;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const { w, h } = live.current.size;
      const mx = ((e.clientX - rect.left) / rect.width) * w;
      const my = ((e.clientY - rect.top) / rect.height) * h;
      zoomAtRef.current(mx, my, e.deltaY < 0 ? 1.16 : 1 / 1.16);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function pointer(e) {
    const canvas = canvasRef.current;
    const hit = canvas?._hit;
    if (!canvas || !hit) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * live.current.size.w;
    const y = ((e.clientY - rect.top) / rect.height) * live.current.size.h;
    return { x, y, hit };
  }

  function onDown(e) {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onMove(e) {
    const dragState = dragRef.current;
    if (dragState) {
      const dx = e.clientX - dragState.x;
      const dy = e.clientY - dragState.y;
      if (!dragState.moved && Math.hypot(dx, dy) > 4) dragState.moved = true;
      if (dragState.moved) {
        const { w, h } = live.current.size;
        const base = makeView(live.current.sheet.bbox, w, h);
        camRef.current = placeCamera(base, { ...camRef.current, x: camRef.current.x + dx, y: camRef.current.y + dy }, w, h);
        dragState.x = e.clientX;
        dragState.y = e.clientY;
        if (!drag) setDrag(true);
        setNudge((n) => n + 1);
        return;
      }
    }
    const p = pointer(e);
    if (!p) return;
    const { x, y, hit } = p;
    const { view } = hit;
    if (x >= view.ox && x <= view.ox + view.mapW && y >= view.oy && y <= view.oy + view.mapH) {
      const [lng, lat] = fromScreen(x, y, view);
      if (coordRef.current) coordRef.current.textContent = fmtCoord(lng, lat);
    }
    let nextPoint = null;
    for (let i = hit.points.length - 1; i >= 0; i--) {
      const pt = hit.points[i];
      if (Math.hypot(pt.x - x, pt.y - y) <= 11) {
        nextPoint = pt.id;
        break;
      }
    }
    let nextPlate = null;
    if (!nextPoint) {
      for (let i = hit.plates.length - 1; i >= 0; i--) {
        const plate = hit.plates[i];
        const lift = lifts.current.get(plate.id) || 0;
        if (inside(plate.screen, x, y + lift) || (lift > 6 && inside(plate.screen, x, y))) {
          nextPlate = plate.id;
          break;
        }
      }
    } else {
      nextPlate = hit.points.find((pt) => pt.id === nextPoint)?.plateId || null;
    }
    const hotNow = !!(nextPoint || nextPlate);
    const hoverPlate = nextPoint ? hit.points.find((pt) => pt.id === nextPoint)?.plateId || null : nextPlate;
    if (nextPoint !== pointHover.current || hoverPlate !== hoverRef.current || hotNow !== hot) {
      pointHover.current = nextPoint;
      hoverRef.current = hoverPlate;
      if (hotNow !== hot) setHot(hotNow);
      setNudge((n) => n + 1);
    }
  }

  function onUp(e) {
    const moved = dragRef.current?.moved;
    dragRef.current = null;
    if (drag) setDrag(false);
    if (moved) return;
    const p = pointer(e);
    if (!p) return;
    const { x, y, hit } = p;
    for (let i = hit.points.length - 1; i >= 0; i--) {
      const pt = hit.points[i];
      if (Math.hypot(pt.x - x, pt.y - y) <= 11) {
        onSelect(pt.plateId);
        onPoint(pt);
        return;
      }
    }
    for (let i = hit.plates.length - 1; i >= 0; i--) {
      const plate = hit.plates[i];
      const lift = lifts.current.get(plate.id) || 0;
      if (inside(plate.screen, x, y + lift) || (lift > 6 && inside(plate.screen, x, y))) {
        onPoint(null);
        onSelect(selectedId === plate.id ? null : plate.id);
        return;
      }
    }
    onPoint(null);
    onSelect(null);
  }

  function onKey(e) {
    const plates = sheet.plates;
    const index = plates.findIndex((p) => p.id === selectedId);
    if (e.key === 'Escape') {
      onPoint(null);
      onSelect(null);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      onPoint(null);
      onSelect(plates[(index + 1) % plates.length].id);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      onPoint(null);
      onSelect(plates[(index - 1 + plates.length) % plates.length].id);
    }
  }

  return (
    <div ref={stageRef} className="fi-stage">
      <canvas
        ref={canvasRef}
        className={drag ? 'fi-canvas is-drag' : hot ? 'fi-canvas is-hot' : 'fi-canvas'}
        role="application"
        aria-label={`${sheet.title} sheet. Scroll to zoom. Drag to move the sheet. Arrow keys move between districts.`}
        tabIndex={0}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onWheel={(e) => {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const { w, h } = live.current.size;
          if (!w || !h) return;
          const mx = ((e.clientX - rect.left) / rect.width) * w;
          const my = ((e.clientY - rect.top) / rect.height) * h;
          zoomAt(mx, my, e.deltaY < 0 ? 1.16 : 1 / 1.16);
        }}
        onPointerLeave={() => {
          hoverRef.current = null;
          pointHover.current = null;
          setHot(false);
        }}
        onKeyDown={onKey}
      />
      <div className="fi-zoom">
        <button type="button" aria-label="Zoom in" onClick={() => zoomAt(size.w / 2, size.h / 2, 1.3)} disabled={zoom >= 8}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / 1.3)} disabled={zoom <= 1}>−</button>
      </div>
      <div className="fi-north" aria-hidden="true"><b>N</b><i /></div>
      {note && <p className="fi-loading">{note}</p>}
      <div className="fi-hud">
        <span ref={coordRef} className="fi-coord">{fmtCoord((sheet.bbox.west + sheet.bbox.east) / 2, (sheet.bbox.south + sheet.bbox.north) / 2)}</span>
        <span className="fi-legend">
          <i className="dot wait" /> Pending
          <i className="dot ok" /> Approved
          <i className="dot fix" /> Correction
          <i className="dot bad" /> Rejected
          <i className="dia" /> Centre
        </span>
        <span className="fi-scale">{scale && <i style={{ width: `${Math.round(scale.px)}px` }} />}<b>{scale ? scale.label : ''}</b></span>
      </div>
    </div>
  );
}
