import * as THREE from '../vendor/three.module.min.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { PANEL_SIZE, PANEL_LOGO, PANEL_GANGS } from './panels.js';
import { drawFace, zoneOf } from './face.js';
import { state, subscribe, gangStates, pressGang, MODELS } from './store.js';

const MM = 0.01;               // 1 scene unit = 100 mm, panel = 0.86
const PANEL = 86;
const STORY_MODELS = ['g1', 'g2', 'g3', 'g4', 'curtainB', 'cooler', 'scene'];

const ease = t => t * t * (3 - 2 * t);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
/* extruded rounded slab, front face at z = 0, extending backwards */
function slab(w, h, r, depth, bevel, mats, hole) {
  const sh = rrShape(w * MM, h * MM, r * MM);
  if (hole) sh.holes.push(rrShape(hole[0] * MM, hole[1] * MM, hole[2] * MM));
  const geo = new THREE.ExtrudeGeometry(sh, {
    depth: depth * MM, bevelEnabled: bevel > 0, bevelThickness: bevel * MM, bevelSize: bevel * MM,
    bevelSegments: 4, curveSegments: 12,
  });
  geo.translate(0, 0, -(depth + bevel) * MM);
  return new THREE.Mesh(geo, mats);
}
const gangMM = g => [(g.x / PANEL_SIZE - 0.5) * PANEL, -(g.y / PANEL_SIZE - 0.5) * PANEL];

export function initHero({ canvas, stage, scrolly, labelsEl, hintEl, storyModelEl, poster, reduced, onFirstFrame, getProgress }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  const coarse = matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.6 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0, 4.2);

  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x3cc8e6, 2.4); rim.position.set(3, -1, -2); scene.add(rim);
  const warm = new THREE.PointLight(0xffb37a, 0, 6); warm.position.set(0, 1.2, 1.4); scene.add(warm);

  /* ---------- face texture ---------- */
  const TEX = coarse ? 768 : 1024;
  const faceCanvas = document.createElement('canvas'); faceCanvas.width = faceCanvas.height = TEX;
  const fctx = faceCanvas.getContext('2d');
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  faceTex.repeat.set(1 / (PANEL * MM), 1 / (PANEL * MM));
  faceTex.offset.set(0.5, 0.5);
  const emitCanvas = document.createElement('canvas'); emitCanvas.width = emitCanvas.height = TEX;
  const ectx = emitCanvas.getContext('2d');
  const emitTex = new THREE.CanvasTexture(emitCanvas);
  emitTex.colorSpace = THREE.SRGBColorSpace;
  emitTex.repeat.copy(faceTex.repeat); emitTex.offset.copy(faceTex.offset);

  let shownModel = state.model, shownFinish = state.finish;
  const pulse = [0, 0, 0, 0];
  const redraw = () => {
    const st = gangStates(shownModel);
    drawFace(fctx, TEX, shownModel, st, pulse, shownFinish, 'map'); faceTex.needsUpdate = true;
    drawFace(ectx, TEX, shownModel, st, pulse, shownFinish, 'emit'); emitTex.needsUpdate = true;
  };

  /* ---------- product layers ---------- */
  const product = new THREE.Group(); scene.add(product);

  const glassFace = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: faceTex, emissive: 0xffffff, emissiveMap: emitTex, emissiveIntensity: 1.15,
    roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, ior: 1.52, reflectivity: 0.7,
  });
  const glassEdge = new THREE.MeshPhysicalMaterial({ color: 0x0c1215, roughness: 0.05, metalness: 0.1, clearcoat: 1, transmission: 0.25, thickness: 0.02 });
  const glass = slab(PANEL, PANEL, 6, 3, 0.9, [glassFace, glassEdge]);

  const touch = new THREE.Group();
  const touchBoard = slab(80, 80, 4, 1.2, 0, new THREE.MeshStandardMaterial({ color: 0x0b2229, roughness: 0.55, metalness: 0.2 }));
  touch.add(touchBoard);
  const padGroup = new THREE.Group(); touch.add(padGroup);
  const copper = new THREE.MeshStandardMaterial({ color: 0xd7a35a, metalness: 1, roughness: 0.28 });
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x9be9f7, emissive: 0x3cc8e6, emissiveIntensity: 0.4 });

  const relay = new THREE.Group();
  relay.add(slab(64, 64, 3, 1.6, 0, new THREE.MeshStandardMaterial({ color: 0x0d3d38, roughness: 0.5, metalness: 0.15 })));
  const relayMat = new THREE.MeshStandardMaterial({ color: 0x1d4fa3, roughness: 0.45 });
  const chipMat = new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.4 });
  const shieldMat = new THREE.MeshStandardMaterial({ color: 0xc9d1d6, metalness: 1, roughness: 0.25 });
  [[-18, 12], [0, 12], [18, 12]].forEach(([x, y]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(14 * MM, 18 * MM, 12 * MM), relayMat); b.position.set(x * MM, y * MM, 6 * MM); relay.add(b);
  });
  const wifi = new THREE.Mesh(new THREE.BoxGeometry(24 * MM, 16 * MM, 3 * MM), shieldMat); wifi.position.set(-14 * MM, -16 * MM, 1.5 * MM); relay.add(wifi);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(8 * MM, 8 * MM, 1.5 * MM), chipMat); chip.position.set(12 * MM, -14 * MM, 0.8 * MM); relay.add(chip);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(4 * MM, 4 * MM, 10 * MM, 20), new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.35 }));
  cap.rotation.x = Math.PI / 2; cap.position.set(24 * MM, -20 * MM, 5 * MM); relay.add(cap);

  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x15191b, roughness: 0.32, metalness: 0.75 });
  const bezel = slab(86, 86, 6, 4, 0.4, bezelMat, [72, 72, 4]);
  function applyFinish(f) {
    const w = f === 'white';
    glassEdge.color.set(w ? 0xdfe5e7 : 0x0c1215);
    glassEdge.transmission = w ? 0 : 0.25;
    glassFace.roughness = w ? 0.14 : 0.08;
    glassFace.emissiveIntensity = w ? 1.4 : 1.15;
    bezelMat.color.set(w ? 0xe4e8e9 : 0x15191b); bezelMat.metalness = w ? 0.1 : 0.75; bezelMat.roughness = w ? 0.45 : 0.32;
  }
  applyFinish(shownFinish);

  const housing = new THREE.Group();
  housing.add(slab(64, 64, 6, 24, 1, new THREE.MeshStandardMaterial({ color: 0xe3e7e9, roughness: 0.55 })));
  const labelCanvas = document.createElement('canvas'); labelCanvas.width = 640; labelCanvas.height = 560;
  const labelTex = new THREE.CanvasTexture(labelCanvas); labelTex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(56 * MM, 49 * MM), new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.7 }));
  label.rotation.y = Math.PI; label.position.z = -26.1 * MM; housing.add(label);

  const layers = [
    { obj: glass,   z: 0,    ex: 19 },
    { obj: touch,   z: -4.3, ex: 11 },
    { obj: relay,   z: -24,  ex: 4 },
    { obj: bezel,   z: -3.9, ex: 4 },
    { obj: housing, z: -8.6, ex: -15 },
  ];
  layers.forEach(l => { l.obj.position.z = l.z * MM; product.add(l.obj); });
  const labelLayers = [0, 1, 2, 4]; // which layer each DOM label points to

  function buildPads(model) {
    padGroup.clear();
    PANEL_GANGS[model].forEach(g => {
      const [x, y] = gangMM(g);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(7 * MM, 1.1 * MM, 8, 40), copper);
      ring.position.set(x * MM, y * MM, 0.2 * MM); padGroup.add(ring);
      const led = new THREE.Mesh(new THREE.BoxGeometry(2 * MM, 1.2 * MM, 0.8 * MM), ledMat);
      led.position.set(x * MM, (y - 11) * MM, 0.3 * MM); padGroup.add(led);
    });
  }

  function drawLabel(model) {
    const c = labelCanvas.getContext('2d'), W = labelCanvas.width, H = labelCanvas.height, m = MODELS[model];
    c.fillStyle = '#f7f8f8'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#111'; c.fillStyle = '#111'; c.lineWidth = 3;
    const terms = m.terms.length >= 6 ? m.terms : [...Array(6 - m.terms.length).fill(''), ...m.terms];
    const cw = (W - 40) / 6;
    c.strokeRect(20, 20, W - 40, 70);
    terms.forEach((t, i) => {
      if (i) { c.beginPath(); c.moveTo(20 + cw * i, 20); c.lineTo(20 + cw * i, 90); c.stroke(); }
      c.font = (t.length > 2 ? '600 22px' : '500 40px') + ' Vazirmatn, sans-serif'; c.textAlign = 'center';
      c.fillText(t, 20 + cw * (i + 0.5), t.length > 2 ? 64 : 70);
    });
    c.textAlign = 'left'; c.font = '19px sans-serif';
    const rows = [['Spot Smart Switch', model === 'scene' ? 'LXSW103' : m.code], ['Input', '220V 50Hz'], ['Output', '220V 50Hz 2200W/gang'], ['WiFi', 'IEEE 802.11b/g/n 2.4Ghz'], ['Working Temp', '0 ~ 40 °C']];
    rows.forEach(([a, b], i) => {
      const y = 124 + i * 27; c.fillText(a, 28, y); c.textAlign = 'right'; c.fillText(b, W - 28, y); c.textAlign = 'left';
      c.setLineDash([2, 4]); c.beginPath(); c.moveTo(40 + c.measureText(a).width, y - 6); c.lineTo(W - 36 - c.measureText(b).width, y - 6); c.stroke(); c.setLineDash([]);
    });
    // horizontal sarodi wordmark from the panel's vertical logo vector
    c.save(); c.translate(36, 330); c.scale(6.2, 6.2); c.rotate(Math.PI / 2); c.translate(-223.8, -232.3);
    c.fill(new Path2D(PANEL_LOGO)); c.restore();
    // QR-like code block (decorative stand-in for the real device QR)
    const qx = W - 200, qy = 270, q = 8; let seed = model.length * 97 + 13;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let yy = 0; yy < 21; yy++) for (let xx = 0; xx < 21; xx++) if (rnd() > 0.52) c.fillRect(qx + xx * q, qy + yy * q, q, q);
    [[0, 0], [14, 0], [0, 14]].forEach(([fx, fy]) => {
      c.clearRect(qx + fx * q, qy + fy * q, 7 * q, 7 * q); c.fillStyle = '#f7f8f8'; c.fillRect(qx + fx * q, qy + fy * q, 7 * q, 7 * q); c.fillStyle = '#111';
      c.lineWidth = q; c.strokeRect(qx + (fx + 0.5) * q, qy + (fy + 0.5) * q, 6 * q, 6 * q); c.fillRect(qx + (fx + 2) * q, qy + (fy + 2) * q, 3 * q, 3 * q);
    });
    c.lineWidth = 3; c.beginPath(); c.roundRect(28, 470, 230, 58, 8); c.stroke();
    c.font = '24px sans-serif'; c.fillText('ID:', 42, 507);
    c.font = '17px sans-serif'; c.fillText('Wi Fi   Made in Iran', W - 210, 520);
    labelTex.needsUpdate = true;
  }

  buildPads(shownModel); drawLabel(shownModel); redraw();

  /* ---------- layout / poses ---------- */
  let W = 1, H = 1, mobile = false;
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    mobile = W < 900;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = mobile ? (W / H < 0.6 ? 38 : 32) : 28;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  /* Keyframes on the story's scroll progress q (0 = hero, 1 = last step).
     at: where the pose is reached. Layers open only around 0.52 and are already back
     together by 0.62 (while the panel keeps turning), so the parts never drift far apart. */
  const K = () => mobile ? [
    { at: 0,    x: 0, y: 0.4,  rx: 0.12, ry: 0.5,  e: 0, s: 0.78 },
    { at: 0.36, x: 0, y: 0.3,  rx: 0.04, ry: -0.12, e: 0, s: 1.0 },
    { at: 0.66, x: 0, y: 0.28, rx: 0.36, ry: -0.75, e: 1, s: 0.86 },
    { at: 0.75, x: 0, y: 0.3,  rx: 0.24, ry: 0.6,  e: 0, s: 0.92 },
    { at: 0.87, x: 0, y: 0.3,  rx: 0.08, ry: Math.PI - 0.3, e: 0, s: 0.95 },
    { at: 1,    x: 0, y: 0.3,  rx: 0.06, ry: Math.PI * 2 - 0.22, e: 0, s: 1.0 },
  ] : [
    { at: 0,    x: -0.66, y: -0.02, rx: 0.12, ry: 0.55, e: 0, s: 1.05 },
    { at: 0.36, x: -0.55, y: 0,    rx: 0.04, ry: -0.14, e: 0, s: 1.18 },
    { at: 0.66, x: -0.52, y: 0.02, rx: 0.34, ry: -0.78, e: 1, s: 1.04 },
    { at: 0.75, x: -0.54, y: 0,    rx: 0.22, ry: 0.55, e: 0, s: 1.08 },
    { at: 0.87, x: -0.55, y: 0,    rx: 0.08, ry: Math.PI - 0.32, e: 0, s: 1.12 },
    { at: 1,    x: -0.55, y: 0,    rx: 0.06, ry: Math.PI * 2 - 0.24, e: 0, s: 1.15 },
  ];
  function poseAt(q) {
    const k = K(); q = clamp(q);
    let i = 0; while (i < k.length - 2 && q > k[i + 1].at) i++;
    const a = k[i], b = k[i + 1], t = ease(clamp((q - a.at) / (b.at - a.at))), o = {};
    for (const key in a) if (key !== 'at') o[key] = lerp(a[key], b[key], t);
    // closing is quicker than opening: once past the peak, layers snap home on a steep curve
    if (a.e > b.e) o.e = a.e * Math.pow(1 - t, 2.2);
    return o;
  }

  /* ---------- interaction (touch-safe) ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let holdUntil = 0, pointer = { x: 0, y: 0, tx: 0, ty: 0 }, down = null, interacted = false;
  function hitGang(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(glass, false)[0];
    if (!hit || !hit.face || hit.face.normal.z < 0.8 || !hit.uv) return -1;
    const u = (hit.uv.x / (PANEL * MM) + 0.5) * PANEL_SIZE, v = (0.5 - hit.uv.y / (PANEL * MM)) * PANEL_SIZE;
    return zoneOf(shownModel, u, v);
  }
  canvas.addEventListener('pointerdown', e => {
    // pose is captured at touch-down: the target is resolved before anything can move
    holdUntil = performance.now() + (e.pointerType === 'mouse' ? 1500 : 5000);
    const g = flipping ? -1 : hitGang(e.clientX, e.clientY);
    down = { x: e.clientX, y: e.clientY, t: performance.now(), g };
    if (g >= 0) { pulse[g] = 1; redraw(); }
  });
  canvas.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (down.g >= 0 && moved < 14 && performance.now() - down.t < 900) {
      pressGang(shownModel, down.g, 'hero');
      if (navigator.vibrate) navigator.vibrate(12);
      if (!interacted) { interacted = true; hintEl && hintEl.classList.add('is-gone'); }
    }
    down = null;
  });
  canvas.addEventListener('pointercancel', () => (down = null));
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1; pointer.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    canvas.style.cursor = hitGang(e.clientX, e.clientY) >= 0 ? 'pointer' : '';
  });
  canvas.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; });

  /* ---------- model flip ---------- */
  let flipping = false, flipT = 0, pendingModel = null, pendingFinish = null, flipFrom = 0;
  function swapNow() {
    if (pendingModel) { shownModel = pendingModel; buildPads(shownModel); drawLabel(shownModel); if (storyModelEl) storyModelEl.textContent = MODELS[shownModel].name; }
    if (pendingFinish) { shownFinish = pendingFinish; applyFinish(shownFinish); }
    pendingModel = pendingFinish = null; redraw();
  }
  function showModel(m, f = shownFinish) {
    if (m === shownModel && f === shownFinish && !pendingModel && !pendingFinish) return;
    if (m !== shownModel) pendingModel = m;
    if (f !== shownFinish) pendingFinish = f;
    if (reduced) { swapNow(); return; }
    if (!flipping) { flipping = true; flipT = 0; }
  }

  let storyAuto = false, storyIdx = 2, storyClock = 0, lastQ = 0;
  subscribe((s, src) => {
    if (s.finish !== shownFinish && s.finish !== pendingFinish) showModel(storyAuto ? (pendingModel || shownModel) : s.model, s.finish);
    else if (s.model !== shownModel && !storyAuto) showModel(s.model);
    if (src !== 'motor' || MODELS[shownModel].kind === 'curtain') redraw();
  });

  /* ---------- loop ---------- */
  let running = false, raf = 0, last = performance.now(), idleT = 0, first = true;
  const v3 = new THREE.Vector3();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let q;
    if (getProgress) q = clamp(getProgress());
    else { const sr = scrolly.getBoundingClientRect(); q = clamp(-sr.top / Math.max(1, sr.height - innerHeight)); }
    lastQ = q;
    const held = now < holdUntil;
    if (!held && !reduced) idleT += dt;

    // story step 4: auto-cycle the family
    const inFamily = q > 0.95;
    if (inFamily !== storyAuto) { storyAuto = inFamily; storyClock = 1.2; if (!inFamily) showModel(state.model); }
    if (storyAuto && !reduced) {
      storyClock += dt;
      if (storyClock > 1.9) { storyClock = 0; storyIdx = (storyIdx + 1) % STORY_MODELS.length; showModel(STORY_MODELS[storyIdx]); }
    }

    const p = poseAt(q);
    pointer.x = lerp(pointer.x, held ? pointer.x : pointer.tx, 0.06); pointer.y = lerp(pointer.y, held ? pointer.y : pointer.ty, 0.06);
    const idleAmp = reduced ? 0 : 1 - clamp(q * 3) * 0.6;
    let ry = p.ry + Math.sin(idleT * 0.55) * 0.16 * idleAmp + pointer.x * 0.28;
    let rx = p.rx + Math.sin(idleT * 0.42) * 0.05 * idleAmp + pointer.y * 0.14;
    product.position.set(p.x, p.y + Math.sin(idleT * 0.9) * 0.015 * idleAmp, 0);

    if (flipping) {
      flipT = Math.min(1, flipT + dt / 0.75);
      const fe = flipT < 0.5 ? 2 * flipT * flipT : 1 - Math.pow(-2 * flipT + 2, 2) / 2;
      flipFrom = fe * Math.PI * 2;
      if ((pendingModel || pendingFinish) && fe >= 0.25 && fe < 0.75) swapNow();
      if (flipT >= 1) { flipping = false; flipFrom = 0; if (pendingModel || pendingFinish) { flipping = true; flipT = 0; } }
    }
    product.rotation.set(rx, ry + flipFrom, 0);
    product.scale.setScalar(p.s);
    layers.forEach(l => (l.obj.position.z = (l.z + l.ex * p.e) * MM));

    // decay tap pulses
    let pz = false;
    for (let i = 0; i < 4; i++) if (pulse[i] > 0) { pulse[i] = Math.max(0, pulse[i] - dt * 2.4); pz = true; }
    if (pz) redraw();

    const lit = state.lights.filter(Boolean).length / 4;
    warm.intensity = lerp(warm.intensity, lit * 3, 0.08);

    // layer callouts
    product.updateMatrixWorld(true);
    const la = clamp((p.e - 0.55) * 3);
    labelsEl.style.opacity = la;
    if (la > 0) {
      labelsEl.querySelectorAll('span').forEach((el, i) => {
        const L = layers[labelLayers[i]];
        v3.set(43 * MM, [40, 22, 4, -14][i] * MM, 0); L.obj.localToWorld(v3); v3.project(camera);
        const sx = (v3.x * 0.5 + 0.5) * W, left = sx > W * (mobile ? 0.55 : 0.75);
        el.classList.toggle('is-left', left);
        el.style.transform = `translate(${sx}px, ${(-v3.y * 0.5 + 0.5) * H}px)${left ? ' translateX(-100%)' : ''}`;
      });
    }
    if (hintEl) hintEl.style.opacity = interacted ? 0 : clamp(1 - q * 8);

    renderer.render(scene, camera);
    if (first) { first = false; onFirstFrame && onFirstFrame(); }
  }
  function start() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }
  const io = new IntersectionObserver(([en]) => (en.isIntersecting && !document.hidden ? start() : stop()), { rootMargin: '100px' });
  io.observe(scrolly);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : scrolly.getBoundingClientRect().bottom > 0 && start()));

  return { showModel, getQ: () => lastQ };
}
