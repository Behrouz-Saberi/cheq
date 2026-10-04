import * as THREE from '../vendor/three.module.min.js';
import { drawFace } from './face.js';
import { state, subscribe, gangStates } from './store.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function initRoom({ canvas, reduced }) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { return null; }
  const coarse = matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x05080a, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x05080a, 7, 14);
  const camera = new THREE.PerspectiveCamera(42, 16 / 10, 0.1, 30);
  const camBase = new THREE.Vector3(0.15, 1.45, 4.3), look = new THREE.Vector3(-0.1, 1.25, -0.6);

  const std = (color, rough = 0.8, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); scene.add(m); return m; };

  /* ---------- shell ---------- */
  const floor = add(new THREE.PlaneGeometry(9, 7), std(0x2a211b, 0.62), 0, 0, 0.5); floor.rotation.x = -Math.PI / 2;
  const wallMat = std(0x252d31, 0.92);
  add(new THREE.PlaneGeometry(9, 3.1), wallMat, 0, 1.55, -2);
  const lw = add(new THREE.PlaneGeometry(7, 3.1), wallMat, -3.3, 1.55, 1.2); lw.rotation.y = Math.PI / 2;
  const ceil = add(new THREE.PlaneGeometry(9, 7), std(0x1b2124, 1), 0, 3.1, 0.5); ceil.rotation.x = Math.PI / 2;
  const rug = add(new THREE.CircleGeometry(1.3, 48), std(0x33403f, 1), -0.45, 0.005, -0.35); rug.rotation.x = -Math.PI / 2; rug.scale.set(1.35, 1, 1);

  /* window + night sky */
  const sky = document.createElement('canvas'); sky.width = 256; sky.height = 256;
  { const c = sky.getContext('2d'); const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#071b2b'); g.addColorStop(1, '#0e3646'); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    c.fillStyle = 'rgba(235,245,255,.95)'; c.beginPath(); c.arc(184, 62, 18, 0, 7); c.fill();
    for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,${190 + (i % 50)},120,${0.3 + (i % 7) / 10})`; c.fillRect((i * 53) % 256, 200 + ((i * 29) % 52), 2, 2); }
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect((i * 97) % 256, (i * 37) % 150, 1, 1); } }
  const skyTex = new THREE.CanvasTexture(sky); skyTex.colorSpace = THREE.SRGBColorSpace;
  add(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: skyTex }), 1.6, 1.6, -1.99);
  const frameMat = std(0x101416, 0.4, 0.6);
  [[1.6, 2.62, 2.1, 0.05], [1.6, 0.58, 2.1, 0.05], [0.58, 1.6, 0.05, 2.1], [2.62, 1.6, 0.05, 2.1], [1.6, 1.6, 0.03, 2.0]].forEach(([x, y, w, h]) => add(new THREE.BoxGeometry(w, h, 0.06), frameMat, x, y, -1.96));
  const moon = new THREE.DirectionalLight(0x7fb2d6, 0.5); moon.position.set(2.5, 2.5, -4); moon.target.position.set(-1, 0, 1); scene.add(moon, moon.target);

  /* curtains: pleated cloth anchored at outer edges */
  const rod = add(new THREE.CylinderGeometry(0.012, 0.012, 2.6, 8), std(0x9aa3a6, 0.3, 0.9), 1.6, 2.78, -1.86); rod.rotation.z = Math.PI / 2;
  function cloth(dir) {
    const w = 1.12, g = new THREE.PlaneGeometry(w, 2.38, 64, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin((x / w) * Math.PI * 14) * 0.035); }
    g.translate(dir * w / 2, 0, 0); g.computeVertexNormals();
    const m = add(g, std(0xc9cfcf, 0.95, 0, { side: THREE.DoubleSide }), dir > 0 ? 0.48 : 2.72, 1.58, -1.84);
    return m;
  }
  const curL = cloth(1), curR = cloth(-1);

  /* furniture */
  const fab = std(0x34474d, 0.95), wood = std(0x5b4433, 0.6);
  add(new THREE.BoxGeometry(2.3, 0.4, 0.95), fab, -0.7, 0.24, -1.35);
  add(new THREE.BoxGeometry(2.3, 0.55, 0.22), fab, -0.7, 0.62, -1.72);
  add(new THREE.BoxGeometry(0.22, 0.55, 0.95), fab, -1.9, 0.33, -1.35);
  add(new THREE.BoxGeometry(0.22, 0.55, 0.95), fab, 0.5, 0.33, -1.35);
  [-1.25, -0.15].forEach(x => add(new THREE.BoxGeometry(1.0, 0.14, 0.8), std(0x3d535a, 1), x, 0.5, -1.28));
  add(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 40), wood, -0.55, 0.42, -0.15);
  add(new THREE.CylinderGeometry(0.05, 0.08, 0.4, 16), std(0x111416, 0.4, 0.7), -0.55, 0.2, -0.15);
  add(new THREE.CylinderGeometry(0.16, 0.12, 0.38, 20), std(0xd8d2c8, 0.7), 2.75, 0.19, -1.4);
  for (let i = 0; i < 9; i++) add(new THREE.SphereGeometry(0.16 + (i % 3) * 0.03, 12, 10), std(0x2f5a3c, 0.9), 2.75 + Math.sin(i * 2.1) * 0.16, 0.55 + i * 0.09, -1.4 + Math.cos(i * 2.1) * 0.14);

  /* ---------- lights: 3 pendants + cove ---------- */
  const WARM = new THREE.Color(0xffb47a);
  const pendants = [-1.45, -0.55, 0.35].map((x, i) => {
    const y = 2.2, z = -0.5;
    add(new THREE.CylinderGeometry(0.004, 0.004, 3.1 - y, 6), std(0x111111), x, (3.1 + y) / 2, z);
    const shade = add(new THREE.CylinderGeometry(0.03, 0.17, 0.24, 32, 1, true), std(0x15191b, 0.35, 0.8, { side: THREE.DoubleSide }), x, y, z);
    const inner = add(new THREE.CylinderGeometry(0.028, 0.165, 0.235, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, side: THREE.BackSide }), x, y, z);
    const bulb = add(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: 0x333333 }), x, y - 0.11, z);
    const cone = add(new THREE.ConeGeometry(0.85, 2.0, 40, 1, true), new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), x, y - 1.12, z);
    const light = new THREE.PointLight(WARM, 0, 0, 2); light.position.set(x, y - 0.16, z); scene.add(light);
    return { inner, bulb, cone, light, v: 0, shade };
  });
  const coveColor = new THREE.Color(0x5fd4ea);
  const cove = add(new THREE.BoxGeometry(8.6, 0.025, 0.03), new THREE.MeshBasicMaterial({ color: 0x1a2226 }), 0, 3.02, -1.97);
  const coveGlow = add(new THREE.PlaneGeometry(8.6, 1.1), new THREE.MeshBasicMaterial({ color: coveColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 2.55, -1.985);
  coveGlow.material.map = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 4, 128); const t = new THREE.CanvasTexture(c); return t; })();
  const coveLights = [-2.5, 0, 2.5].map(x => { const l = new THREE.PointLight(coveColor, 0, 0, 2); l.position.set(x, 2.9, -1.7); scene.add(l); return l; });
  const coveState = { v: 0 };

  const hemi = new THREE.HemisphereLight(0x35505c, 0x0a0c0d, 0.55); scene.add(hemi);

  /* ---------- evaporative cooler grille + airflow ---------- */
  const grille = new THREE.Group(); grille.position.set(-3.27, 2.55, -0.6); grille.rotation.y = Math.PI / 2; scene.add(grille);
  const gm = std(0xcfd5d7, 0.6);
  grille.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.36, 0.03), std(0x0b0e10, 0.8)));
  for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.02, 0.05), gm); s.position.set(0, -0.15 + i * 0.06, 0.03); s.rotation.x = -0.5; grille.add(s); }
  const frameG = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.42, 0.02), gm); frameG.position.z = -0.005; grille.add(frameG);
  const N = coarse ? 260 : 520;
  const pg = new THREE.BufferGeometry(), pp = new Float32Array(N * 3), seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) { seeds[i] = Math.random(); pp[i * 3] = -3.2; pp[i * 3 + 1] = 2.55; pp[i * 3 + 2] = -0.6; }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const pmat = new THREE.PointsMaterial({ size: 0.06, map: dot, color: 0xdfe9ec, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(pg, pmat));
  const air = { flow: 0, life: new Float32Array(N).map(() => Math.random()) };

  /* ---------- the Sarodi panel on the wall (live) ---------- */
  const wc = document.createElement('canvas'); wc.width = wc.height = 256;
  const wtex = new THREE.CanvasTexture(wc); wtex.colorSpace = THREE.SRGBColorSpace;
  const wall = add(new THREE.BoxGeometry(0.28, 0.28, 0.014), [std(0x0b0f11, 0.1), std(0x0b0f11, 0.1), std(0x0b0f11, 0.1), std(0x0b0f11, 0.1),
    new THREE.MeshStandardMaterial({ map: wtex, emissive: 0xffffff, emissiveMap: wtex, emissiveIntensity: 1.3, roughness: 0.1 }), std(0x0b0f11)], -2.45, 1.3, -1.985);
  const redrawWall = () => { drawFace(wc.getContext('2d'), 256, state.model, gangStates()); wtex.needsUpdate = true; };
  redrawWall();
  subscribe(redrawWall);

  /* ---------- loop ---------- */
  let W = 1, H = 1;
  const resize = () => { const r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); renderer.setSize(W, H, false); camera.aspect = W / H; camera.fov = W / H < 1.2 ? 52 : 42; camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(canvas); resize();

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const r = canvas.getBoundingClientRect(); mouse.tx = (e.clientX - r.left) / r.width - 0.5; mouse.ty = (e.clientY - r.top) / r.height - 0.5; });
  canvas.addEventListener('pointerleave', () => { mouse.tx = mouse.ty = 0; });

  let running = false, raf = 0, last = performance.now(), t = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const k = reduced ? 1 : 1 - Math.pow(0.0015, dt); // frame-rate independent smoothing

    pendants.forEach((p, i) => {
      p.v = lerp(p.v, state.lights[i] ? 1 : 0, k);
      p.light.intensity = p.v * 5.5;
      p.bulb.material.color.setRGB(0.2 + p.v * 1.0, 0.2 + p.v * 0.75, 0.2 + p.v * 0.5);
      p.inner.material.color.setRGB(0.1 + p.v * 0.9, 0.1 + p.v * 0.6, 0.1 + p.v * 0.35);
      p.cone.material.opacity = p.v * 0.07;
    });
    coveState.v = lerp(coveState.v, state.lights[3] ? 1 : 0, k);
    coveGlow.material.opacity = coveState.v * 0.55;
    cove.material.color.setRGB(0.1 + coveState.v * 0.55, 0.13 + coveState.v * 0.8, 0.15 + coveState.v * 0.9);
    coveLights.forEach(l => (l.intensity = coveState.v * 2.2));

    const open = 1 - state.curtain.pos; // 0 closed .. 1 open
    const sx = 1 - open * 0.78;
    curL.scale.x = sx; curR.scale.x = sx;
    moon.intensity = 0.25 + open * 0.75;

    const co = state.cooler, targetFlow = co.speed === 2 ? 1 : co.speed === 1 ? 0.45 : 0;
    air.flow = lerp(air.flow, targetFlow, k * 0.6);
    pmat.opacity = Math.min(0.55, air.flow * 0.9 + (co.pump ? 0.08 : 0));
    pmat.color.set(co.pump ? 0x8fdcff : 0xdfe9ec);
    if (pmat.opacity > 0.01 && !reduced) {
      const pos = pg.attributes.position.array, spd = 0.25 + air.flow * 1.4;
      for (let i = 0; i < N; i++) {
        air.life[i] += dt * spd * (0.6 + seeds[i] * 0.8) * 0.35;
        if (air.life[i] > 1) air.life[i] -= 1;
        const L = air.life[i], s = seeds[i];
        pos[i * 3] = -3.2 + L * (2.6 + air.flow * 1.8);
        pos[i * 3 + 1] = 2.5 + (s - 0.5) * 0.3 - L * L * 1.2 + Math.sin(t * 2 + s * 20) * 0.05 * L;
        pos[i * 3 + 2] = -0.6 + (s - 0.5) * 0.7 * (0.4 + L * 2.2);
      }
      pg.attributes.position.needsUpdate = true;
    }

    mouse.x = lerp(mouse.x, mouse.tx, 0.05); mouse.y = lerp(mouse.y, mouse.ty, 0.05);
    const drift = reduced ? 0 : Math.sin(t * 0.18) * 0.18;
    camera.position.set(camBase.x + mouse.x * 0.6 + drift, camBase.y - mouse.y * 0.25, camBase.z);
    camera.lookAt(look);
    renderer.render(scene, camera);
  }
  const start = () => { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  new IntersectionObserver(([en]) => (en.isIntersecting && !document.hidden ? start() : stop()), { rootMargin: '80px' }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else { const r = canvas.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) start(); } });
  return { start, stop };
}
