/* Shared smart-home state. Panel (DOM + 3D), room scene and app UI all read/write here,
   so a touch anywhere is reflected everywhere, like the real product. */

export const MODELS = {
  g1:       { name: 'کلید یک پل',    short: '۱ پل',  code: 'LXSW101', terms: ['L1', 'L', 'N'],                 kind: 'light' },
  g2:       { name: 'کلید دو پل',    short: '۲ پل',  code: 'LXSW102', terms: ['L2', 'L1', 'L', 'N'],           kind: 'light' },
  g3:       { name: 'کلید سه پل',    short: '۳ پل',  code: 'LXSW103', terms: ['L3', 'L2', 'L1', 'L', 'N'],     kind: 'light' },
  g4:       { name: 'کلید چهار پل',  short: '۴ پل',  code: 'LXSW104', terms: ['L3', 'L2', 'L1', 'L0', 'L', 'N'], kind: 'light' },
  scene:    { name: 'کلید سناریو',   short: 'سناریو', code: 'طرح سناریو', terms: ['L3', 'L2', 'L1', 'L', 'N'], kind: 'scene' },
  curtainA: { name: 'کلید پرده برقی', short: 'پرده', code: 'LXSW105', terms: ['Close', 'Open', 'L', 'N'],      kind: 'curtain' },
  curtainB: { name: 'کلید پرده برقی', short: 'پرده', code: 'LXSW105', terms: ['Close', 'Open', 'L', 'N'],      kind: 'curtain' },
  cooler:   { name: 'کلید کولر آبی', short: 'کولر', code: 'LXSW106', terms: ['تند', 'کند', 'پمپ', 'L', 'N'],  kind: 'cooler' },
};

/* Room has 4 light circuits: 3 pendants + 1 cove strip. Which circuits each gang drives
   (gang index = left-to-right / top-left first, matching the CDR layout). */
const LIGHT_MAP = {
  g1: [[0, 1, 2, 3]],
  g2: [[0, 1, 2], [3]],
  g3: [[0], [1], [2]],
  g4: [[0], [1], [2], [3]],
};
export const LIGHT_NAMES = ['آویز ۱', 'آویز ۲', 'آویز ۳', 'نور مخفی'];

export const SCENES = [
  { name: 'ورود به خانه', lights: [true, true, true, true],  curtain: 0, cooler: { pump: true,  speed: 1 } },
  { name: 'تماشای فیلم',  lights: [false, false, false, true], curtain: 1, cooler: { pump: false, speed: 1 } },
  { name: 'شب‌بخیر',      lights: [false, false, false, false], curtain: 1, cooler: { pump: false, speed: 0 } },
];

export function gangLegend(model) {
  const k = MODELS[model].kind;
  if (k === 'scene') return SCENES.map(s => s.name);
  if (k === 'curtain') return ['باز کردن پرده', 'توقف', 'بستن پرده'];
  if (k === 'cooler') return ['پمپ آب', 'دور کند', 'دور تند'];
  return LIGHT_MAP[model].map(ids => ids.length === 4 ? 'همهٔ چراغ‌ها' : ids.map(i => LIGHT_NAMES[i]).join(' + '));
}

const listeners = new Set();
export const state = {
  model: 'g3',
  lights: [false, false, false, false],
  curtain: { pos: 1, target: 1 },   // 0 = open, 1 = closed
  cooler: { pump: false, speed: 0 }, // speed: 0 off, 1 low, 2 high
  scene: -1,
  last: null,                        // {source, model, gang} of last action
};

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(source) { for (const fn of listeners) fn(state, source); }

export function setModel(model, source = 'ui') {
  if (!MODELS[model] || state.model === model) return;
  state.model = model;
  emit(source);
}

/* ON/OFF (lit icon) state for each gang of a model */
export function gangStates(model = state.model) {
  const k = MODELS[model].kind;
  if (k === 'light') return LIGHT_MAP[model].map(ids => ids.every(i => state.lights[i]));
  if (k === 'scene') return SCENES.map((_, i) => state.scene === i);
  if (k === 'curtain') {
    const c = state.curtain, moving = Math.abs(c.target - c.pos) > 0.002;
    return [moving && c.target < c.pos, !moving && c.pos > 0.02 && c.pos < 0.98, moving && c.target > c.pos];
  }
  const co = state.cooler;
  return [co.pump, co.speed === 1, co.speed === 2];
}

export function pressGang(model, i, source = 'panel') {
  const k = MODELS[model].kind;
  if (k === 'light') {
    const ids = LIGHT_MAP[model][i];
    const on = !ids.every(n => state.lights[n]);
    ids.forEach(n => (state.lights[n] = on));
    state.scene = -1;
  } else if (k === 'scene') {
    applyScene(i);
  } else if (k === 'curtain') {
    const c = state.curtain;
    if (i === 0) c.target = 0;
    else if (i === 2) c.target = 1;
    else c.target = c.pos; // stop
    state.scene = -1;
  } else {
    const co = state.cooler;
    if (i === 0) co.pump = !co.pump;
    else co.speed = co.speed === i ? 0 : i;
    state.scene = -1;
  }
  state.last = { source, model, gang: i };
  emit(source);
}

export function setLight(n, on, source = 'app') { state.lights[n] = on; state.scene = -1; state.last = { source }; emit(source); }
export function setCurtain(target, source = 'app') { state.curtain.target = target; state.scene = -1; state.last = { source }; emit(source); }
export function setCooler(patch, source = 'app') { Object.assign(state.cooler, patch); state.scene = -1; state.last = { source }; emit(source); }

export function applyScene(i, source = 'scene') {
  const s = SCENES[i];
  state.lights = [...s.lights];
  state.curtain.target = s.curtain;
  state.cooler = { ...s.cooler };
  state.scene = i;
  state.last = { source, scene: i };
  emit(source);
}

/* Curtain motor: ~4 s full travel. Called from a single RAF owner (main.js). */
let lastMoving = false;
export function tickCurtain(dt) {
  const c = state.curtain, d = c.target - c.pos;
  const moving = Math.abs(d) > 0.002;
  if (moving) c.pos += Math.sign(d) * Math.min(Math.abs(d), dt * 0.25);
  else c.pos = c.target;
  if (moving !== lastMoving) { lastMoving = moving; emit('motor'); }
  return moving;
}

export const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
