import { faceSVG } from './face.js';
import {
  MODELS, SCENES, LIGHT_NAMES, state, subscribe, setModel, pressGang, gangStates, gangLegend,
  setLight, setCurtain, setCooler, applyScene, tickCurtain, fa,
} from './store.js';

const root = document.getElementById('slp');

/* Tabler Icons (MIT) outline paths */
const IC = {
  bulb: 'M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7 M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3 M9.7 17l4.6 0',
  wind: 'M5 8h8.5a2.5 2.5 0 1 0 -2.34 -3.24 M3 12h15.5a2.5 2.5 0 1 1 -2.34 3.24 M4 16h5.5a2.5 2.5 0 1 1 -2.34 3.24',
  drop: 'M7.502 19.423c2.602 2.105 6.395 2.105 8.996 0c2.602 -2.105 3.262 -5.708 1.566 -8.546l-4.89 -7.26c-.42 -.625 -1.287 -.803 -1.936 -.397a1.376 1.376 0 0 0 -.41 .397l-4.893 7.26c-1.695 2.838 -1.035 6.441 1.567 8.546',
  home: 'M5 12l-2 0l9 -9l9 9l-2 0 M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7 M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6',
  clock: 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0 M12 7v5l3 3',
  user: 'M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0 M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2',
  wand: 'M6 21l15 -15l-3 -3l-15 15l3 3 M15 6l3 3 M9 3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2 M19 13a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2',
  wifi: 'M12 18l.01 0 M9.172 15.172a4 4 0 0 1 5.656 0 M6.343 12.343a8 8 0 0 1 11.314 0 M3.515 9.515c4.686 -4.687 12.284 -4.687 17 0',
  window: 'M12 3c-3.866 0 -7 3.272 -7 7v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1 -1v-10c0 -3.728 -3.134 -7 -7 -7 M5 13l14 0 M12 3l0 18',
  open: 'M7 8l-4 4l4 4 M17 8l4 4l-4 4 M3 12l18 0',
  pause: 'M6 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12 M14 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12',
  close: 'M11 16h10 M11 16l4 4 M11 16l4 -4 M13 8h-10 M13 8l-4 4 M13 8l-4 -4',
};
const icon = (n, cls = '') => `<svg class="slp-i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[n]}"/></svg>`;

function boot() {
  const $ = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => [...el.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- static faces (poster, specs) ---------- */
  $$('[data-panel-face]').forEach(el => (el.innerHTML = faceSVG(el.dataset.panelFace, el.dataset.panelFace === 'g1' ? [true] : [false, true, false])));

  /* ---------- toast ---------- */
  const toastEl = $('[data-toast]'); let toastT;
  const toast = msg => { toastEl.textContent = msg; toastEl.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2200); };

  /* ---------- demo panel (DOM, never moves while you tap) ---------- */
  const panelEl = $('[data-demo-panel]'), legendEl = $('[data-demo-legend]');
  let builtModel = null;
  function buildPanel() {
    builtModel = state.model;
    const labels = gangLegend(state.model);
    panelEl.dataset.model = state.model;
    panelEl.innerHTML = faceSVG(state.model, gangStates(), { zones: true, labels });
    legendEl.innerHTML = labels.map((l, i) => `<li data-i="${i}"><span class="slp-legend__n">${fa(i + 1)}</span>${l}</li>`).join('');
    legendEl.dataset.n = labels.length;
  }
  function syncPanel() {
    if (builtModel !== state.model) buildPanel();
    const st = gangStates();
    $$('.slp-ic', panelEl).forEach((g, i) => g.classList.toggle('is-on', !!st[i]));
    $$('.slp-zone', panelEl).forEach((b, i) => b.setAttribute('aria-pressed', !!st[i]));
    $$('li', legendEl).forEach((li, i) => li.classList.toggle('is-on', !!st[i]));
  }
  panelEl.addEventListener('pointerdown', e => {
    const z = e.target.closest('.slp-zone'); if (!z) return;
    // instant capacitive-style ripple at the exact touch point
    const r = panelEl.getBoundingClientRect(), rip = document.createElement('span');
    rip.className = 'slp-ripple'; rip.style.left = `${e.clientX - r.left}px`; rip.style.top = `${e.clientY - r.top}px`;
    panelEl.appendChild(rip); setTimeout(() => rip.remove(), 650);
    const ic = panelEl.querySelector(`.slp-ic[data-i="${z.dataset.i}"]`);
    ic && (ic.classList.remove('is-tap'), void ic.getBBox(), ic.classList.add('is-tap'));
  });
  panelEl.addEventListener('click', e => {
    const z = e.target.closest('.slp-zone'); if (!z) return;
    pressGang(state.model, +z.dataset.i, 'panel');
    if (navigator.vibrate) navigator.vibrate(10);
  });

  /* ---------- model selectors (hero chips + demo tabs) ---------- */
  const tabSets = [$('[data-hero-models]'), $('[data-demo-tabs]')];
  tabSets.forEach(set => set.addEventListener('click', e => {
    const b = e.target.closest('[data-model]'); if (!b) return;
    setModel(b.dataset.model, set.dataset.heroModels !== undefined ? 'hero' : 'tabs');
  }));
  const sameModel = (a, b) => a === b || (MODELS[a].kind === 'curtain' && MODELS[b].kind === 'curtain');
  function syncTabs() {
    tabSets[0].querySelectorAll('[data-model]').forEach(b => b.setAttribute('aria-checked', sameModel(b.dataset.model, state.model)));
    tabSets[1].querySelectorAll('[data-model]').forEach(b => b.setAttribute('aria-selected', sameModel(b.dataset.model, state.model)));
  }

  /* ---------- room status (text twin of the 3D room) ---------- */
  const statusEl = $('[data-room-status]');
  function syncStatus() {
    const lit = state.lights.filter(Boolean).length, c = state.curtain, co = state.cooler;
    const moving = Math.abs(c.target - c.pos) > 0.002;
    const cur = moving ? (c.target < c.pos ? 'در حال باز شدن' : 'در حال بسته شدن') : c.pos < 0.02 ? 'باز' : c.pos > 0.98 ? 'بسته' : `${fa(Math.round((1 - c.pos) * 100))}٪ باز`;
    const cool = co.speed ? (co.speed === 2 ? 'دور تند' : 'دور کند') + (co.pump ? ' + پمپ' : '') : co.pump ? 'فقط پمپ' : 'خاموش';
    statusEl.innerHTML = `<li class="${lit ? 'is-on' : ''}">${icon('bulb')}<span>چراغ‌ها</span><b>${lit ? fa(lit) + ' روشن' : 'خاموش'}</b></li>
      <li class="${moving || c.pos < 0.98 ? 'is-on' : ''}">${icon('window')}<span>پرده</span><b>${cur}</b></li>
      <li class="${co.speed || co.pump ? 'is-on' : ''}">${icon('wind')}<span>کولر</span><b>${cool}</b></li>`;
  }

  /* ---------- wiring diagram bulbs follow the 3 lights ---------- */
  const bulbs = $$('[data-wiring] .w-bulb');
  const syncWiring = () => bulbs.forEach((b, i) => b.classList.toggle('is-on', !!state.lights[2 - i]));

  /* ---------- global ambience: page warms up as lights turn on ---------- */
  const syncAmbient = () => root.style.setProperty('--lit', (state.lights.filter(Boolean).length / 4).toFixed(2));

  /* ---------- live app ---------- */
  const appEl = $('[data-app]');
  function renderApp() {
    const c = state.curtain, co = state.cooler, moving = Math.abs(c.target - c.pos) > 0.002;
    const openPct = Math.round((1 - c.pos) * 100);
    appEl.innerHTML = `
      <div class="app-top"><div><small>سلام، عصر بخیر</small><b>خانهٔ من</b></div><span class="app-online">${icon('wifi')}آنلاین</span></div>
      <div class="app-scenes" role="group" aria-label="سناریوها">${SCENES.map((s, i) => `<button type="button" data-scene="${i}" class="${state.scene === i ? 'is-on' : ''}">${icon('wand')}${s.name}</button>`).join('')}</div>
      <p class="app-room">پذیرایی</p>
      <div class="app-grid">
        ${LIGHT_NAMES.map((n, i) => `<button type="button" class="app-tile ${state.lights[i] ? 'is-on' : ''}" data-light="${i}" aria-pressed="${state.lights[i]}">
          ${icon('bulb')}<b>${n}</b><small>${state.lights[i] ? 'روشن' : 'خاموش'}</small><i class="app-sw"></i></button>`).join('')}
        <div class="app-tile app-tile--wide ${moving || c.pos < 0.98 ? 'is-on' : ''}">
          ${icon('window')}<b>پردهٔ برقی</b><small>${moving ? 'در حرکت' : fa(openPct) + '٪ باز'}</small>
          <div class="app-bar"><i style="transform:scaleX(${(1 - c.pos).toFixed(3)})"></i></div>
          <div class="app-seg"><button type="button" data-curtain="0" aria-label="باز کردن">${icon('open')}</button><button type="button" data-curtain="stop" aria-label="توقف">${icon('pause')}</button><button type="button" data-curtain="1" aria-label="بستن">${icon('close')}</button></div>
        </div>
        <div class="app-tile app-tile--wide ${co.speed || co.pump ? 'is-on' : ''}">
          ${icon('wind')}<b>کولر آبی</b><small>${co.speed ? (co.speed === 2 ? 'تند' : 'کند') : 'خاموش'}${co.pump ? '، پمپ روشن' : ''}</small>
          <div class="app-seg app-seg--txt">${['خاموش', 'کند', 'تند'].map((t, i) => `<button type="button" data-speed="${i}" class="${co.speed === i ? 'is-on' : ''}">${t}</button>`).join('')}<button type="button" data-pump class="${co.pump ? 'is-on' : ''}" aria-label="پمپ آب">${icon('drop')}</button></div>
        </div>
      </div>
      <nav class="app-nav" aria-hidden="true"><span class="is-on">${icon('home')}</span><span>${icon('wand')}</span><span>${icon('clock')}</span><span>${icon('user')}</span></nav>`;
  }
  appEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.light) setLight(+b.dataset.light, !state.lights[+b.dataset.light]);
    else if (b.dataset.scene) { applyScene(+b.dataset.scene, 'app'); toast(`سناریوی «${SCENES[+b.dataset.scene].name}» اجرا شد`); }
    else if (b.dataset.curtain) setCurtain(b.dataset.curtain === 'stop' ? state.curtain.pos : +b.dataset.curtain);
    else if (b.dataset.speed) setCooler({ speed: +b.dataset.speed });
    else if (b.dataset.pump !== undefined) setCooler({ pump: !state.cooler.pump });
  });

  /* ---------- curtain motor (RAF only while moving) ---------- */
  let motorRaf = 0, motorLast = 0;
  function motor(now) {
    const dt = Math.min(0.05, (now - motorLast) / 1000); motorLast = now;
    const moving = tickCurtain(reduced ? 10 : dt);
    // light-weight updates while moving
    const bar = appEl.querySelector('.app-bar i'); if (bar) bar.style.transform = `scaleX(${(1 - state.curtain.pos).toFixed(3)})`;
    if (moving) motorRaf = requestAnimationFrame(motor); else { motorRaf = 0; syncAll(); }
  }
  const ensureMotor = () => { if (!motorRaf && Math.abs(state.curtain.target - state.curtain.pos) > 0.002) { motorLast = performance.now(); motorRaf = requestAnimationFrame(motor); } };

  function syncAll() { syncPanel(); syncTabs(); syncStatus(); syncWiring(); syncAmbient(); renderApp(); }
  subscribe((s, src) => {
    syncAll(); ensureMotor();
    if (src === 'scene' || (src === 'panel' && MODELS[s.model].kind === 'scene')) toast(`سناریوی «${SCENES[s.scene]?.name}» اجرا شد`);
  });
  syncAll();

  /* ---------- product rail ---------- */
  const rail = $('[data-rail]');
  const railModels = ['g1', 'g2', 'g3', 'g4', 'curtainA', 'cooler', 'scene'];
  rail.insertAdjacentHTML('beforeend', `<ul class="slp-rail__list">${railModels.map(m => {
    const M = MODELS[m];
    const demoStates = m === 'g1' ? [true] : m === 'g4' ? [true, false, false, true] : m === 'cooler' ? [true, false, true] : [false, true, false];
    return `<li class="slp-card" data-reveal>
      <button type="button" class="slp-card__btn" data-try="${m}" aria-label="امتحان ${M.name} در دمو">
        <div class="slp-card__stage"><div class="slp-glass slp-glass--card">${faceSVG(m, demoStates)}</div></div>
        <div class="slp-card__meta"><b>${M.name}</b><span dir="ltr">${M.code}</span></div>
        <div class="slp-card__terms" dir="ltr">${M.terms.map(t => `<i>${t}</i>`).join('')}</div>
        <span class="slp-card__try">امتحان در دمو</span>
      </button></li>`;
  }).join('')}</ul>`);
  rail.addEventListener('click', e => {
    const b = e.target.closest('[data-try]'); if (!b) return;
    setModel(b.dataset.try, 'rail');
    $('#slp-demo').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  });
  const railStep = dir => rail.scrollBy({ left: dir * Math.min(360, rail.clientWidth * 0.8), behavior: reduced ? 'auto' : 'smooth' });
  $('[data-rail-prev]').addEventListener('click', () => railStep(1));
  $('[data-rail-next]').addEventListener('click', () => railStep(-1));
  // desktop tilt on cards (pointer: fine only)
  if (matchMedia('(pointer: fine)').matches && !reduced) {
    rail.addEventListener('pointermove', e => {
      const card = e.target.closest('.slp-card__stage'); if (!card) return;
      const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--rx', `${(-y * 14).toFixed(2)}deg`); card.style.setProperty('--ry', `${(x * 18).toFixed(2)}deg`);
    });
    rail.addEventListener('pointerout', e => { const c = e.target.closest('.slp-card__stage'); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); } });
  }

  /* ---------- reveal on scroll ---------- */
  const rio = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); rio.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  $$('[data-reveal]').forEach((el, i) => { el.style.setProperty('--d', `${(i % 4) * 70}ms`); rio.observe(el); });

  /* story cards light up when their step is centred */
  const sio = new IntersectionObserver(es => es.forEach(en => en.target.classList.toggle('is-active', en.isIntersecting)), { rootMargin: '-35% 0px -35% 0px' });
  $$('.slp-step').forEach(el => sio.observe(el));

  /* ---------- nav state ---------- */
  const nav = $('[data-nav]');
  new IntersectionObserver(([en]) => nav.classList.toggle('is-solid', !en.isIntersecting), { rootMargin: '-80px 0px 0px 0px' }).observe($('.slp-hero__copy'));

  /* ---------- WebGL (lazy) ---------- */
  const glOK = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  const stage = $('[data-stage]');
  if (glOK) {
    const loadHero = () => import('./hero3d.js').then(m => {
      m.initHero({
        canvas: $('[data-hero-canvas]'), stage, scrolly: $('[data-scrolly]'), labelsEl: $('[data-layer-labels]'),
        hintEl: $('[data-hint]'), storyModelEl: $('[data-story-model]'), reduced,
        onFirstFrame: () => stage.classList.add('is-3d'),
      });
    }).catch(err => { console.warn('[sarodi] hero 3D disabled', err); stage.classList.add('is-static'); });
    ('requestIdleCallback' in window) ? requestIdleCallback(loadHero, { timeout: 600 }) : setTimeout(loadHero, 120);

    const roomCanvas = $('[data-room-canvas]');
    const rIO = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return; rIO.disconnect();
      import('./room3d.js').then(m => { if (!m.initRoom({ canvas: roomCanvas, reduced })) throw new Error('no gl'); })
        .catch(() => { $('[data-room-fallback]').hidden = false; roomCanvas.hidden = true; });
    }, { rootMargin: '600px 0px' });
    rIO.observe(roomCanvas);
  } else {
    stage.classList.add('is-static');
    $('[data-room-fallback]').hidden = false; $('[data-room-canvas]').hidden = true;
  }

  /* ---------- CTA tracking hook (GA4 / GTM if present) ---------- */
  $$('[data-cta]').forEach(a => a.addEventListener('click', () => { (window.dataLayer = window.dataLayer || []).push({ event: 'sarodi_cta', cta_location: a.closest('section,header')?.id || 'nav' }); }));
}

if (root && !root.dataset.ready) {
  root.dataset.ready = '1';
  boot();
}
