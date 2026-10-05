import { PANEL_SIZE, PANEL_LOGO, PANEL_GANGS } from './panels.js';

/* Hit zones: each gang owns the whole cell around its icon (not just the 10px glyph),
   so a thumb anywhere in that third/quarter of the glass registers. */
export function zoneOf(model, u, v) {
  // u,v in panel units (0..243.78, y down). Nearest gang centre wins.
  const g = PANEL_GANGS[model];
  let best = 0, bd = Infinity;
  g.forEach((c, i) => { const d = (c.x - u) ** 2 + (c.y - v) ** 2; if (d < bd) { bd = d; best = i; } });
  return best;
}

export function zoneRects(model) {
  const S = PANEL_SIZE, n = PANEL_GANGS[model].length;
  if (n === 1) return [[0, 0, S, S]];
  if (n === 4) return [[0, 0, S / 2, S / 2], [S / 2, 0, S / 2, S / 2], [0, S / 2, S / 2, S / 2], [S / 2, S / 2, S / 2, S / 2]];
  if (n === 2) return [[0, 0, S / 2, S], [S / 2, 0, S / 2, S]];
  // 3 gangs: icons at 62 / 122 / 181 -> split at midpoints
  return [[0, 0, 92, S], [92, 0, 59.5, S], [151.5, 0, S - 151.5, S]];
}

export function faceSVG(model, states = [], { zones = false, labels = [] } = {}) {
  const S = PANEL_SIZE;
  const gangs = PANEL_GANGS[model].map((g, i) => {
    const on = !!states[i];
    return `<g class="slp-ic${on ? ' is-on' : ''}" data-i="${i}" style="transform-origin:${g.x}px ${g.y}px">
      <circle class="slp-ic__halo" cx="${g.x}" cy="${g.y}" r="22"/>
      ${g.fill ? `<path class="slp-ic__f" d="${g.fill}"/>` : ''}
      ${g.stroke ? `<path class="slp-ic__s" d="${g.stroke}"/>` : ''}
    </g>`;
  }).join('');
  const zoneBtns = zones ? zoneRects(model).map((r, i) =>
    `<button type="button" class="slp-zone" data-i="${i}" aria-pressed="${!!states[i]}" aria-label="${labels[i] || 'پل ' + (i + 1)}"
      style="left:${(r[0] / S) * 100}%;top:${(r[1] / S) * 100}%;width:${(r[2] / S) * 100}%;height:${(r[3] / S) * 100}%"></button>`).join('') : '';
  return `<svg class="slp-face" viewBox="0 0 ${S} ${S}" aria-hidden="true" focusable="false">
      <path class="slp-face__logo" d="${PANEL_LOGO}"/>${gangs}</svg>${zoneBtns}<span class="slp-glass__sheen" aria-hidden="true"></span>`;
}

/* Canvas version for the WebGL texture (map + emissiveMap). */
const cache = new Map();
const p2d = d => { if (!cache.has(d)) cache.set(d, new Path2D(d)); return cache.get(d); };

/* layer 'map' = what the glass looks like; layer 'emit' = only the light it gives off.
   Black glass: both are the same picture (black emits nothing). White glass: the white
   surface must not glow, so only lit icons go into the emissive layer. */
export function drawFace(ctx, size, model, states = [], pulse = [], finish = 'black', layer = 'map') {
  const k = size / PANEL_SIZE, white = finish === 'white', emitOnly = white && layer === 'emit';
  ctx.save();
  if (white && !emitOnly) {
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#fbfcfc'); g.addColorStop(1, '#e3e8ea');
    ctx.fillStyle = g;
  } else ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.scale(k, k);
  if (!emitOnly) { ctx.fillStyle = white ? 'rgba(55,64,68,.62)' : 'rgba(235,245,248,.55)'; ctx.fill(p2d(PANEL_LOGO)); }
  PANEL_GANGS[model].forEach((g, i) => {
    const on = !!states[i];
    const pz = pulse[i] || 0;
    if (emitOnly && !on && pz <= 0) return;
    if (on || pz > 0) {
      const r = 26 + pz * 30;
      const grd = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, r);
      grd.addColorStop(0, white ? `rgba(0,150,185,${(emitOnly ? 0.45 : 0.2) * (on ? 1 : pz)})` : `rgba(60,200,230,${0.32 * (on ? 1 : pz)})`);
      grd.addColorStop(1, 'rgba(60,200,230,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(g.x, g.y, r, 0, Math.PI * 2); ctx.fill();
    }
    if (emitOnly && !on) return;
    ctx.shadowColor = on ? (white ? 'rgba(0,170,205,.9)' : 'rgba(90,220,245,.95)') : 'transparent';
    ctx.shadowBlur = on ? 6 * k : 0;
    const col = on ? (white ? (emitOnly ? '#6fe0f5' : '#0098b8') : '#d9fbff') : (white ? 'rgba(62,72,77,.72)' : 'rgba(200,214,218,.62)');
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1;
    if (g.fill) ctx.fill(p2d(g.fill));
    if (g.stroke) ctx.stroke(p2d(g.stroke));
    ctx.shadowBlur = 0;
  });
  ctx.restore();
}
