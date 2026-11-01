// "Urząd ChatGPT": voxel 3-D satire for FB groups. A newcomer queues in an office to learn AI and every
// person ahead of him hands him their problem. Pure function of time: seek(t) rebuilds every transform.
import * as M from './lib/motion.js';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
// The original end card (the studio's own logo) was removed from this recipe; the film ends on ink.

const W = 1080, H = 1920, PI = Math.PI;
const { clamp, lerp, E } = M;
const Q = Number(new URLSearchParams(location.search).get('q') || window.PREVIEW_Q || 1);           // preview quality (mock-up page)

// ============================================================ timeline
// lines: [who, text, opts]; durations from length so the eye has time to read on a phone
const rd = (s) => Math.max(1.15, 0.45 + 0.03 * s.length);
const SC = {};                  // scene name -> {t0, t1}
const LINES = [];               // {t0, t1, who, text, side, dx, dy, scene}
const EVENTS = {};              // named moments
let T = 0;
function scene(name, fn) { const t0 = T; fn(); SC[name] = { t0, t1: T }; }
function say(who, text, o = {}) { const d = o.d ?? rd(text); LINES.push({ t0: T, t1: T + d, who, text, ...o }); T += d + (o.gap ?? 0.08); }
const wait = (d) => { T += d; };
const mark = (n) => { EVENTS[n] = T; };

scene('ext', () => wait(2.6));
scene('ticket', () => { mark('ticketOut'); wait(1.0); mark('insert'); wait(1.4); });
scene('babcia', () => {
  mark('babIn'); wait(0.55);
  say('hero', 'Przepraszam, to tu jest kolejka na kurs?');
  say('babcia', 'Kurs to nie wiem, ja w sprawie dziadka.');
  say('babcia', 'Wnuczek mówi, że teraz to AI go nawet ożywi. Żeby chociaż mrugnął.', { d: 2.6 });
  mark('wink'); wait(0.7);
  say('hero', 'Ale ja tu tylko na…');
  say('babcia', 'To potrzymaj, kochaneczku, bo mi ręce latają.');
  mark('photoGive'); wait(1.5);
});
scene('taczka', () => {
  wait(0.35);
  say('pan', 'Młody, ty się na tym znasz?');
  say('hero', 'No… dopiero się uczę.');
  say('pan', 'Piszę mu: ładny ogród, nic wielkiego. A on mi daje Wersal.', { d: 2.3 });
  say('pan', 'Tu masz ziemię, żeby wiedział, jaka gleba. Popilnuj, skoczę na papierosa.', { d: 2.7 });
  mark('panLeaves'); wait(0.7);
});
scene('sedes', () => {
  wait(0.3);
  say('sed', 'Pan tu pracuje?');
  say('hero', 'Nie, ja tylko…');
  say('sed', 'Bo mam łazienkę pięciokątną, a on mi w kółko robi kwadratową.', { d: 2.3 });
  say('sed', 'Wziąłem sedes, niech zobaczy, z czym ma do czynienia.', { d: 2.0 });
  mark('sedesDrop'); wait(0.9);
});
scene('menu', () => {
  wait(0.3);
  say('rest', 'Pan by mi takie menu zrobił? Tylko po niemiecku.', { noLinger: true });
  mark('menuZoom');
  say('hero', 'Ta pani ma sześć palców.', { d: 1.4, fixed: [70, 300] });
  say('rest', 'A panie, kto by na takie rzeczy zwracał uwagę.');
  mark('menuLean'); wait(0.8);
});
scene('krzyk', () => { say('caps', 'A KTÓRY PŁATNY JEST NAJLEPSZY?', { d: 1.5, gap: 0 }); mark('led'); wait(1.1); });
scene('okienko', () => {
  wait(1.2); mark('atWindow');
  say('robot', 'Następny! Pan z tym wszystkim do nas?');
  say('hero', 'Ja w sumie chciałem się czegoś nauczyć o AI… Chyba grupy pomyliłem.', { d: 2.7, fixed: [44, 1030] });
  say('robot', 'Nie, grupa dobra. Tylko ludzie różni.', { d: 2.0 });
  wait(0.2);
});
scene('witamy', () => wait(1.9));
const END_T = T;
// a bubble lingers while the other person answers, so the exchange reads like a comic strip
LINES.forEach((l, i) => { const n = LINES[i + 1]; l.end = l.t1; if (!l.noLinger && n && n.who !== l.who && n.t0 - l.t1 < 0.3) { const sc = Object.values(SC).find((q) => l.t0 >= q.t0 && l.t0 < q.t1); l.end = Math.min(n.t0 + 1.0, sc ? sc.t1 : n.t0 + 1.0); } });
const DUR = END_T + 1.0;
window.FILM_TIMELINE = { SC, LINES, EVENTS, END_T, DUR };

const inSc = (t, n) => t >= SC[n].t0 && t < SC[n].t1;
const sl = (t, n) => t - SC[n].t0;                  // seconds into scene
const lineOf = (t, who) => LINES.find((l) => l.who === who && t >= l.t0 && t < l.t1);

// ============================================================ voxel builder
const unit = new RoundedBoxGeometry(1, 1, 1, 2, 0.09);
const MAT = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0 });
let seedV = 7; const rnd = () => { seedV = (seedV * 16807) % 2147483647; return (seedV - 1) / 2147483646; };
function jit(col, a = 0.035) { const c = new THREE.Color(col); const h = {}; c.getHSL(h); c.setHSL(h.h, h.s, clamp(h.l + (rnd() - 0.5) * a)); return c; }
let stack = [new THREE.Matrix4()], boxes = [], planes = [];
const top = () => stack[stack.length - 1];
const push = (m) => stack.push(top().clone().multiply(m));
const pop = () => stack.pop();
const Tm = (x, y, z, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
function B(x, y, z, w, h, d, col, a) { boxes.push({ m: top().clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d))), c: jit(col, a) }); }
function plane(x, y, z, w, h, tex, { emissive = false, ry = 0 } = {}) {
  const m = emissive ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
  const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  me.applyMatrix4(top().clone().multiply(Tm(x, y, z, ry)));
  me.receiveShadow = !emissive; me.castShadow = !emissive;
  planes.push(me); return me;
}
function build(fn) {
  const sb = boxes, sp = planes, ss = stack;
  boxes = []; planes = []; stack = [new THREE.Matrix4()];
  fn();
  const g = new THREE.Group();
  if (boxes.length) {
    const im = new THREE.InstancedMesh(unit, MAT, boxes.length);
    boxes.forEach((b, i) => { im.setMatrixAt(i, b.m); im.setColorAt(i, b.c); });
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    g.add(im);
  }
  planes.forEach((p) => g.add(p));
  boxes = sb; planes = sp; stack = ss;
  return g;
}
// a group whose origin sits at pivot p (root coordinates); fn draws in root coordinates
function part(p, fn) {
  const g = build(() => { push(Tm(-p[0], -p[1], -p[2])); fn(); pop(); });
  const o = new THREE.Group(); o.add(g); o.userData.pivot = new THREE.Vector3(...p); o.position.set(...p);
  return o;
}
function addTo(parent, child) { parent.add(child); if (parent.userData.pivot) child.position.sub(parent.userData.pivot); return child; }

// ============================================================ textures
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function signTex(lines, { bg = '#1C3B33', fg = '#F5E9C8', w = 1024, h = 256, size = 110, border = null } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (border) { g.strokeStyle = border; g.lineWidth = 14; g.strokeRect(14, 14, w - 28, h - 28); }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => {
      const s = Array.isArray(l) ? l[0] : l; let fs = Array.isArray(l) ? l[1] : size;
      g.font = `700 ${fs}px Display`; const mw = w * (border ? 0.8 : 0.86);
      while (g.measureText(s).width > mw && fs > 10) { fs -= 2; g.font = `700 ${fs}px Display`; }
      g.fillText(s, w / 2, h * (i + 0.5) / lines.length + 4);
    });
  });
}
function ledTex(txt) {
  return canvasTex(1024, 300, (g) => {
    g.fillStyle = '#0d0f0e'; g.fillRect(0, 0, 1024, 300);
    g.fillStyle = '#FF3B2A'; g.shadowColor = '#ff3b2a'; g.shadowBlur = 24; g.textAlign = 'center';
    g.font = '700 64px Display'; g.fillText('OBSŁUGUJEMY NR', 512, 92);
    let fs = 150; g.font = `700 ${fs}px Display`; while (g.measureText(txt).width > 900) { fs -= 4; g.font = `700 ${fs}px Display`; }
    g.fillText(txt, 512, 240);
  });
}
function photoTex(wink) {
  return canvasTex(256, 320, (g) => {
    let s = 11; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    g.fillStyle = '#E9DCC0'; g.fillRect(0, 0, 256, 320); g.fillStyle = '#CDB48C'; g.fillRect(18, 18, 220, 284);
    const px = (x, y, c, z = 12) => { g.fillStyle = c; g.fillRect(x, y, z, z); };
    const sep = ['#5a4430', '#7a5f43', '#a3855f', '#3a2c20'];
    for (let y = 0; y < 10; y++) for (let x = 0; x < 8; x++) px(80 + x * 12, 70 + y * 12, '#b8986c');
    for (let x = 0; x < 9; x++) px(74 + x * 12, 58, sep[3]); for (let x = 0; x < 9; x++) px(74 + x * 12, 46, sep[3]);
    px(98, 106, sep[3]);
    if (wink) { px(128, 112, sep[3]); px(140, 112, sep[3]); px(152, 108, sep[3], 6); } else px(134, 106, sep[3]);
    for (let x = 0; x < 6; x++) px(86 + x * 12, 142, sep[0]); px(80, 154, sep[0]); px(158, 154, sep[0]);
    if (wink) { px(86, 142, '#b8986c'); px(146, 142, sep[0]); px(158, 142, sep[0]); }
    for (let y = 0; y < 6; y++) for (let x = 0; x < 14; x++) px(44 + x * 12, 196 + y * 12, y < 1 && x > 5 && x < 8 ? '#e8dcc0' : sep[1]);
    g.globalAlpha = 0.25; for (let i = 0; i < 400; i++) { g.fillStyle = r() < 0.5 ? '#fff' : '#5a4430'; g.fillRect(r() * 256, r() * 320, 2, 2); }
  });
}
function slopTex() {
  return canvasTex(512, 720, (g) => {
    let s = 5; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const gr = g.createLinearGradient(0, 0, 512, 720); gr.addColorStop(0, '#ff3cac'); gr.addColorStop(0.5, '#784ba0'); gr.addColorStop(1, '#2b86c5'); g.fillStyle = gr; g.fillRect(0, 0, 512, 720);
    g.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(r() * 512, r() * 720, r() * 5 + 1, 0, 7); g.fill(); }
    g.textAlign = 'center';
    g.fillStyle = '#ffe14d'; g.font = '700 86px Display'; g.fillText('SPEISEKARTE', 256, 110);
    g.fillStyle = '#00ffd5'; g.font = '700 40px Display'; g.fillText('✦ AUTHENTIK ✦', 256, 175);
    g.fillStyle = '#c98b3b'; g.beginPath(); g.ellipse(256, 330, 170, 95, -0.2, 0, 7); g.fill(); g.fillStyle = '#e9b25e'; g.beginPath(); g.ellipse(250, 320, 140, 72, -0.2, 0, 7); g.fill();
    // a hand presenting the dish, six fingers, counted plainly
    g.fillStyle = '#f3c7a5'; g.fillRect(146, 520, 220, 110);
    for (let i = 0; i < 6; i++) { g.fillRect(150 + i * 36, 440, 26, 90); g.fillStyle = '#e0a985'; g.fillRect(150 + i * 36, 440, 26, 10); g.fillStyle = '#f3c7a5'; }
    g.fillRect(366, 560, 58, 36);
    g.fillStyle = '#fff'; g.font = '700 44px Display'; g.fillText('Pork Kotlet Freude', 256, 690);
  });
}
function faceTex(kind) {
  return canvasTex(256, 180, (g) => {
    g.fillStyle = '#0e1a1c'; g.fillRect(0, 0, 256, 180); g.fillStyle = '#7CF5E0'; g.shadowColor = '#7CF5E0'; g.shadowBlur = 14;
    if (kind === 'happy') { g.fillRect(52, 58, 40, 40); g.fillRect(164, 58, 40, 40); g.fillRect(70, 130, 116, 12); g.fillRect(58, 122, 14, 12); g.fillRect(186, 122, 14, 12); }
    else if (kind === 'blink') { g.fillRect(52, 86, 44, 6); g.fillRect(160, 86, 44, 6); g.fillRect(96, 132, 64, 8); }
    else if (kind === 'talk') { g.fillRect(52, 58, 40, 40); g.fillRect(164, 58, 40, 40); g.fillRect(100, 118, 56, 30); }
    else { g.fillRect(52, 82, 44, 10); g.fillRect(160, 82, 44, 10); g.fillRect(96, 132, 64, 8); }
  });
}
function ticketTex() {
  return canvasTex(300, 420, (g) => {
    g.fillStyle = '#FBF8EF'; g.fillRect(0, 0, 300, 420);
    g.fillStyle = '#2a2a2a'; g.textAlign = 'center';
    g.font = '700 30px Display'; g.fillText('URZĄD CHATGPT', 150, 62);
    g.fillRect(40, 84, 220, 4);
    g.font = '700 34px Display'; g.fillText('TWÓJ NUMER', 150, 150);
    g.font = '700 64px Display'; g.fillText('1 200 001', 150, 232);
    g.font = '700 26px Display'; g.fillText('PRZED TOBĄ:', 150, 300); g.fillText('1 199 988 OSÓB', 150, 338);
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(i * 23 + 6, 420, 8, 0, 7); g.fillStyle = '#ddd'; g.fill(); }
  });
}

// ============================================================ palettes
const P = { mint: '#93C7AE', cream: '#EEE3C8', stripe: '#3F6B5C', skirt: '#5C4A3A', wood: '#9A6638', woodD: '#7A4E2A', tileA: '#C9C2B4', tileB: '#B9B1A2', chair: '#E2752F', skin: '#F1C29C', skin2: '#E4AE86' };

// ============================================================ characters
// spec: legH, torsoH, head, shirt, sleeve, pants, shoes, skirt, legs, belly, cheeks, hair(hy,hs), face(hy,hs), body(ty,th)
function eyesOf(hy, hs) { B(-0.42, hy + hs * 0.55, hs * 0.475, 0.28, 0.34, 0.08, '#2a211b', 0); B(0.42, hy + hs * 0.55, hs * 0.475, 0.28, 0.34, 0.08, '#2a211b', 0); }
function character(o) {
  const lh = o.legH || 2.0, th = o.torsoH || 2.5, ty = lh, ny = ty + th, hs = o.head || 2.4, hy = ny + 0.25, sk = o.skin || P.skin;
  const sleeve = o.sleeve || o.shirt;
  const root = new THREE.Group(); root.userData.pivot = new THREE.Vector3();
  const leg = (sx) => part([sx * 0.5, lh, 0], () => {
    if (o.skirt) B(sx * 0.45, 0.35, 0, 0.6, 0.5, 0.6, o.legs || sk); else B(sx * 0.5, 0.35, 0, 0.85, lh - 0.35, 1.0, o.pants);
    B(sx * 0.5, 0, 0.12, 0.95, 0.42, 1.35, o.shoes);
  });
  const legL = addTo(root, leg(-1)), legR = addTo(root, leg(1));
  const body = addTo(root, part([0, lh, 0], () => {
    if (o.skirt) B(0, 0.5, 0, 1.9, lh - 0.4, 1.3, o.pants);
    B(0, ty, 0, 2.3, th, 1.45, o.shirt);
    if (o.belly) B(0, ty + 0.4, 0.6, 1.9, 1.3, 0.45, o.shirt);
    B(0, ny, 0, 0.9, 0.3, 0.8, sk);
    o.body && o.body(ty, th);
  }));
  const head = addTo(body, part([0, ny + 0.1, 0], () => {
    B(0, hy, 0, hs, hs, hs * 0.95, sk);
    B(0, hy + hs * 0.42, hs * 0.47, 0.42, 0.42, 0.25, o.skin2 || P.skin2, 0);
    if (o.cheeks) { B(-0.75, hy + hs * 0.33, hs * 0.47, 0.4, 0.22, 0.06, '#E99A8F', 0); B(0.75, hy + hs * 0.33, hs * 0.47, 0.4, 0.22, 0.06, '#E99A8F', 0); }
    o.hair && o.hair(hy, hs);
    o.face && o.face(hy, hs);
  }));
  const eyes = addTo(head, part([0, hy + hs * 0.55 + 0.17, hs * 0.475], () => eyesOf(hy, hs)));
  // arm poses: each is its own group under body; one is visible at a time
  const ax = 1.48, k = 0.62;
  const arms = {};
  arms.down = addTo(body, part([0, lh, 0], () => { for (const sx of [-1, 1]) { B(sx * ax, ty + 0.55, 0, 0.68, th - 0.35, 0.75, sleeve); B(sx * ax, ty + 0.15, 0, 0.6, 0.45, 0.65, sk); } }));
  // hold: upper arm to the elbow, forearm forward to the object's side edges (half width hw) at z
  const holdPose = (hw, z = 1.55, drop = 1.3) => part([0, lh, 0], () => {
    for (const sx of [-1, 1]) {
      const e = ny - drop;
      B(sx * ax, e, 0, k, drop, k, sleeve);
      const hx = sx * (hw + 0.2), dx = hx - sx * ax, dz = z - 0.05, len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
      push(Tm(sx * ax, e, 0, ang)); B(0, 0, len / 2 - k / 4, k, k, len + k / 2, sleeve); B(0, 0.04, len, 0.54, 0.54, 0.5, sk); pop();
    }
  });
  if (o.hold) arms.hold = addTo(body, holdPose(o.hold));
  // push: straight arms reaching down and forward to wheelbarrow handles
  arms.push = addTo(body, part([0, lh, 0], () => {
    for (const sx of [-1, 1]) { push(Tm(sx * 1.4, ny - 0.15, 0, 0, -0.42)); B(0, -2.35, 0, 0.62, 2.35, 0.7, sleeve); B(0, -2.8, 0, 0.54, 0.5, 0.6, sk); pop(); }
  }));
  Object.values(arms).forEach((a) => { a.visible = false; });
  arms.down.visible = true;
  const anchor = new THREE.Group(); body.add(anchor); anchor.position.set(0, ty + 0.15 - lh, 1.55);   // held object, bottom centre
  return { root, body, head, eyes, legL, legR, arms, anchor, lh, ty, th, hy, hs, top: hy + hs, o };
}
const SPEC = {
  hero: { shirt: '#3E63B8', pants: '#2E3A55', shoes: '#F2F2EE', hold: 0.95,
    hair: (hy, hs) => { const c = '#4A3424'; B(0, hy + hs - 0.1, 0, hs + 0.12, 0.6, hs * 0.98, c); B(0, hy + hs * 0.55, -hs * 0.43, hs + 0.12, hs * 0.5, 0.3, c); B(-hs * 0.5, hy + hs * 0.6, 0, 0.25, hs * 0.45, hs * 0.9, c); B(hs * 0.5, hy + hs * 0.6, 0, 0.25, hs * 0.45, hs * 0.9, c); B(0.4, hy + hs + 0.4, 0.6, 1, 0.35, 0.7, c); },
    body: (ty, th) => { B(0, ty + 0.4, -1.05, 2, 2.2, 0.8, '#FF5A1F', 0.03); B(0, ty + 2.6, -1.05, 1.6, 0.3, 0.7, '#D9481A', 0); B(-0.7, ty + th - 0.1, -0.2, 0.25, 0.2, 1.6, '#D9481A', 0); B(0.7, ty + th - 0.1, -0.2, 0.25, 0.2, 1.6, '#D9481A', 0); B(0, ty + th - 0.75, 0.75, 1.4, 0.2, 0.1, '#2F4F96', 0); } },
  babcia: { shirt: '#8A5C8F', pants: '#6B4B3A', skirt: true, legs: '#D8B9A0', shoes: '#3A2A22', cheeks: true, torsoH: 2.3, legH: 1.9, hold: 0.95,
    hair: (hy, hs) => { const c = '#D9D6D0'; B(0, hy + hs - 0.15, 0, hs + 0.12, 0.55, hs * 0.98, c); B(0, hy + hs * 0.5, -hs * 0.44, hs + 0.12, hs * 0.6, 0.3, c); B(-hs * 0.5, hy + hs * 0.45, 0, 0.25, hs * 0.6, hs * 0.9, c); B(hs * 0.5, hy + hs * 0.45, 0, 0.25, hs * 0.6, hs * 0.9, c); B(0, hy + hs + 0.2, -0.4, 1.2, 0.9, 1.1, '#CFCBC4'); },
    face: (hy, hs) => { B(-0.5, hy + hs * 0.48, hs * 0.5, 0.75, 0.6, 0.08, '#2a2a2a', 0); B(0.5, hy + hs * 0.48, hs * 0.5, 0.75, 0.6, 0.08, '#2a2a2a', 0); B(-0.5, hy + hs * 0.52, hs * 0.52, 0.5, 0.4, 0.05, '#cfe5ea', 0); B(0.5, hy + hs * 0.52, hs * 0.52, 0.5, 0.4, 0.05, '#cfe5ea', 0); },
    body: (ty, th) => { B(-0.5, ty + th - 0.6, 0.74, 0.3, 0.3, 0.1, '#E8C35A', 0); } },
  pan: { shirt: '#B7352C', pants: '#4C5B3A', shoes: '#3F2E22', belly: true, head: 2.5,
    hair: (hy, hs) => { B(0, hy + hs - 0.05, 0, hs + 0.2, 0.55, hs + 0.1, '#2F5130'); B(0, hy + hs - 0.05, hs * 0.55, hs * 0.8, 0.18, 0.9, '#2F5130'); B(0, hy + hs * 0.28, hs * 0.48, 1.3, 0.32, 0.12, '#5A3E2B', 0); },
    body: (ty) => { for (let i = 0; i < 4; i++) B(0, ty + 0.3 + i * 0.6, 0.74, 2.32, 0.12, 0.02, '#7B1F19', 0); } },
  sed: { shirt: '#5F6670', pants: '#4A5059', shoes: '#1f1f1f',
    hair: (hy, hs) => { B(0, hy + hs - 0.1, 0, hs + 0.1, 0.4, hs * 0.96, '#2B2B2B'); B(-hs * 0.5, hy + hs * 0.55, 0, 0.2, hs * 0.4, hs * 0.8, '#2B2B2B'); B(hs * 0.5, hy + hs * 0.55, 0, 0.2, hs * 0.4, hs * 0.8, '#2B2B2B'); },
    body: (ty, th) => { B(0, ty + th - 1.6, 0.74, 0.35, 1.5, 0.08, '#B03030', 0); B(0, ty + th - 0.3, 0.74, 1, 0.3, 0.1, '#F2F2F2', 0); } },
  rest: { shirt: '#F3F1EA', pants: '#2E2E2E', shoes: '#1f1f1f', cheeks: true, hold: 0.72,
    hair: (hy, hs) => { const c = '#B5452A'; B(0, hy + hs - 0.15, 0, hs + 0.14, 0.6, hs * 0.98, c); B(0, hy + hs * 0.1, -hs * 0.46, hs + 0.14, hs * 0.95, 0.4, c); B(-hs * 0.52, hy + hs * 0.15, 0, 0.3, hs * 0.85, hs * 0.9, c); B(hs * 0.52, hy + hs * 0.15, 0, 0.3, hs * 0.85, hs * 0.9, c); },
    body: (ty, th) => { B(0, ty - 0.3, 0.75, 1.9, 2.4, 0.08, '#2D5B8C', 0); for (let i = 0; i < 2; i++) B(0.5, ty + th - 1 - 0.7 * i, 0.75, 0.18, 0.18, 0.08, '#1f1f1f', 0); } },
  caps: { shirt: '#D9A23A', pants: '#3C4B63', shoes: '#eee', hold: 0.12,
    hair: (hy, hs) => { B(0, hy + hs - 0.1, 0, hs + 0.1, 0.5, hs, '#1d1d1d'); } },
};

// ============================================================ props
function photoProp() {
  return build(() => { B(0, 0, 0, 1.9, 1.42, 0.12, '#5B3B22', 0); plane(0, 0.71, 0.065, 1.7, 1.24, signTex([''], { bg: '#E9DCC0' })); });
}
function taczkaProp() {
  return build(() => {
    B(0, 1, 0, 2.8, 1.4, 3.6, '#3F7A55', 0.03); B(0, 2.4, 0, 3.2, 0.2, 4, '#336548', 0);
    B(0, 0.1, 2.2, 0.4, 1, 1, '#2b2b2b'); B(-1, 0, -1.5, 0.3, 1, 0.3, '#336548'); B(1, 0, -1.5, 0.3, 1, 0.3, '#336548');
    B(-1.2, 1.6, -3.2, 0.25, 0.25, 2.5, '#7A5235'); B(1.2, 1.6, -3.2, 0.25, 0.25, 2.5, '#7A5235');
    for (let i = 0; i < 70; i++) { const a = rnd() * 6.28, r = rnd() * 1.3; B(Math.sin(a) * r, 2.4 + rnd() * (1.3 - r) * 0.9, Math.cos(a) * r * 1.3, 0.6, 0.5, 0.6, ['#5B3B24', '#4A2F1C', '#6B4629'][i % 3], 0.04); }
    B(0, 3.6, 0, 0.12, 1.3, 0.12, '#4E8A3E', 0); B(0.25, 4.1, 0, 0.5, 0.12, 0.2, '#5E9C4D', 0);
    for (let i = 0; i < 8; i++) { push(Tm(0, 4.9, 0, 0, 0, i * 0.785)); B(0, 0, 0, 0.22, 0.6, 0.12, '#FFFFFF', 0); pop(); } B(0, 4.75, 0.05, 0.35, 0.35, 0.2, '#F3C432', 0);
  });
}
function sedesProp() {
  return build(() => { B(0, 0, 0, 1, 1.3, 1.4, '#F4F4F0', 0); B(0, 1.3, 0.3, 1.7, 0.4, 2.1, '#F4F4F0', 0); B(0, 1.7, 0.3, 1.75, 0.15, 2.15, '#E9E9E3', 0); B(0, 1.3, -1, 1.6, 1.9, 0.7, '#F4F4F0', 0); B(0, 3.2, -1, 1.7, 0.2, 0.8, '#E9E9E3', 0); B(0.6, 3.4, -1, 0.3, 0.15, 0.15, '#C9C9C3', 0); });
}
function menuProp() {
  return build(() => { B(0, 0, 0, 1.45, 0.08, 0.2, '#d8d0c0', 0); plane(0, 1.0, 0.1, 1.4, 1.97, slopTex()); });
}
function capsSign() {
  return build(() => { B(0, 0, 0, 0.2, 2.6, 0.2, '#8C6A44', 0); B(0, 2.6, 0, 0.2, 2.4, 0.2, '#8C6A44', 0); plane(0, 5.6, 0.15, 4.4, 2.2, signTex([['KTÓRY PŁATNY', 78], ['AI NAJLEPSZY???', 78]], { bg: '#C9A57A', fg: '#1b1b1b', w: 760, h: 380 })); });
}

// ============================================================ sets
function interiorStatic() {
  return build(() => {
    for (let x = -16; x < 16; x += 2) for (let z = -14; z < 18; z += 2) B(x + 1, -0.3, z + 1, 1.94, 0.3, 1.94, ((x + z) / 2) % 2 ? P.tileA : P.tileB, 0.05);
    for (let i = 0; i < 2600; i++) B(-16 + rnd() * 32, -0.02, -14 + rnd() * 32, 0.12 + rnd() * 0.1, 0.04, 0.12 + rnd() * 0.1, ['#7d766a', '#e9e3d6', '#a07e5b', '#5e5a54'][i % 4], 0);
    for (let x = -16; x < 16; x += 1) { B(x + 0.5, 0, -14.5, 1, 0.6, 1, P.skirt); B(x + 0.5, 0.6, -14.5, 1, 6.4, 1, P.mint, 0.03); B(x + 0.5, 7, -14.5, 1, 0.35, 1.05, P.stripe, 0); B(x + 0.5, 7.35, -14.5, 1, 16, 1, P.cream, 0.02); }
    for (const wx of [-16.5, 16.5]) for (let z = -14; z < 18; z += 1) { B(wx, 0, z + 0.5, 1, 0.6, 1, P.skirt); B(wx, 0.6, z + 0.5, 1, 6.4, 1, P.mint, 0.03); B(wx, 7, z + 0.5, 1.05, 0.35, 1, P.stripe, 0); B(wx, 7.35, z + 0.5, 1, 16, 1, P.cream, 0.02); }
    B(-16.2, 8.2, -2, 0.5, 5.2, 6.4, '#F7F3E6', 0); B(-16.05, 8.6, -2, 0.4, 4.4, 5.6, '#CFE6F2', 0); B(-15.95, 8.6, -2, 0.3, 4.4, 0.25, '#F7F3E6', 0); B(-15.95, 10.7, -2, 0.3, 0.25, 5.6, '#F7F3E6', 0);
    B(7, 0, -12.2, 10.5, 3.6, 3.2, P.wood, 0.04); B(7, 3.6, -12.2, 10.9, 0.35, 3.6, P.woodD, 0.02);
    for (let x = 2.2; x < 12; x += 1.6) B(x, 0.5, -10.55, 1.2, 2.6, 0.1, P.woodD, 0.02);
    B(1.8, 3.95, -11.2, 0.35, 5.4, 0.35, '#B9BDB8', 0); B(12.2, 3.95, -11.2, 0.35, 5.4, 0.35, '#B9BDB8', 0); B(7, 9.2, -11.2, 10.8, 0.35, 0.35, '#B9BDB8', 0);
    push(Tm(8.6, 11.3, -13.9)); plane(0, 0, 0, 7.6, 1.76, signTex(['OKIENKO 1 · PORADY AI'], { w: 1600, h: 370, size: 170, bg: '#173A31', fg: '#FFF1C9', border: '#E8C35A' })); pop();
    push(Tm(-2.6, 12.4, -13.9)); B(0, -1.9, -0.1, 6.6, 3.8, 0.4, '#202322', 0); pop();
    push(Tm(-12.5, 8.4, -13.95)); plane(0, 0, 0, 3.6, 2.6, signTex([['PRZERWA', 86], ['12:00–12:15', 86]], { bg: '#F4EFE2', fg: '#2a2a2a', w: 600, h: 430, border: '#2a2a2a' })); pop();
    push(Tm(13.2, 8.6, -13.95)); plane(0, 0, 0, 4.4, 2.6, signTex([['NIE ODPOWIADAMY', 54], ['NA PYTANIE,', 54], ['KTÓRY AI', 54], ['JEST NAJLEPSZY', 54]], { bg: '#F4EFE2', fg: '#B02E22', w: 640, h: 380, border: '#B02E22' })); pop();
    B(-8, 11.5, -13.9, 1.8, 1.8, 0.3, '#F4EFE2', 0); B(-8, 12.3, -13.7, 0.15, 0.75, 0.1, '#222', 0); B(-7.75, 12.35, -13.7, 0.6, 0.15, 0.1, '#222', 0);
    // ticket machine by the entrance, slot facing the hall
    B(-12, 0, 8, 1.8, 4.2, 1.4, '#C8372D', 0.03); B(-12, 3.2, 8.72, 1.2, 0.6, 0.1, '#1d1d1d', 0); B(-12, 2.4, 8.72, 0.9, 0.15, 0.1, '#f1f1f1', 0); B(-12, 4.2, 8, 2, 0.3, 1.6, '#9E2A22', 0);
    for (let z = -8; z < 4; z += 2.2) { B(-14.6, 0, z, 0.25, 1.6, 0.25, '#5d5d5d', 0); B(-13.2, 0, z, 0.25, 1.6, 0.25, '#5d5d5d', 0); B(-13.9, 1.6, z, 1.9, 0.3, 1.8, P.chair, 0.04); B(-14.75, 1.9, z, 0.3, 1.9, 1.8, P.chair, 0.04); }
    B(14, 0, -12, 1.6, 1.6, 1.6, '#B5653B', 0.03); for (let i = 0; i < 14; i++) { push(Tm(14, 1.5, -12, i * 0.45, 0.35 + rnd() * 0.5)); B(0, 0, 0.9, 0.35, 0.25, 1.8, i % 2 ? '#4F8A4A' : '#3D7139', 0.05); B(0, 0.2, 1.9, 0.3, 0.2, 0.9, '#5E9C55', 0.05); pop(); }
    // counter details
    push(Tm(10.2, 3.95, -11)); plane(0, 0.5, 0, 2.6, 0.9, signTex(['Dobra dusza'], { bg: '#F4EFE2', fg: '#1C3B33', w: 640, h: 220, size: 110, border: '#1C3B33' })); B(0, -0.05, -0.1, 2.7, 0.25, 0.6, '#7A4E2A', 0); pop();
    B(3.8, 3.95, -12, 0.9, 1, 0.9, '#F4F1EA', 0);
  });
}
function robotSet() {
  return build(() => {
    push(Tm(7, 0, -13.4));
    B(0, 3.95, 0, 3.2, 2.6, 1.8, '#9AA7AD', 0.03); B(-1.15, 4.6, 0.6, 0.55, 0.9, 0.6, '#E7D27A', 0); B(1.15, 4.6, 0.6, 0.55, 0.9, 0.6, '#E7D27A', 0);
    B(-2, 4.2, 0.1, 0.7, 2, 0.8, '#8E9BA1'); B(2, 4.2, 0.2, 0.7, 1.4, 0.8, '#8E9BA1');
    B(0, 6.55, 0, 0.8, 0.3, 0.7, '#6E7B81'); B(0, 6.85, 0, 3, 2.4, 2.2, '#AEBBC1', 0.03);
    B(0, 9.25, 0, 0.18, 0.9, 0.18, '#6E7B81'); B(-1.62, 7.5, 0, 0.25, 0.9, 0.9, '#6E7B81'); B(1.62, 7.5, 0, 0.25, 0.9, 0.9, '#6E7B81');
    pop();
  });
}
function exteriorStatic() {
  return build(() => {
    for (let x = -20; x < 20; x += 1.6) for (let z = -4; z < 30; z += 1.6) B(x + 0.8, -0.3, z + 0.8, 1.5, 0.3, 1.5, ['#A9A39A', '#9C968C', '#B4AEA4'][Math.floor(rnd() * 3)], 0.05);
    const fac = '#C2BBAE', stone = '#DAD3C4', plinth = '#7A746B';
    for (let y = 0; y < 3; y++) for (let x = -16; x < 16; x++) B(x + 0.5, y, -6.3, 1, 1, 1.4, plinth, 0.05);
    for (let y = 3; y < 44; y++) for (let x = -16; x < 16; x++) B(x + 0.5, y, -6.5, 1, 1, 1, fac, 0.035);
    [-15.5, -4.2, 4.2, 15.5].forEach((px) => { for (let y = 3; y < 43; y++) B(px, y, -6.1, 1.2, 1, 0.8, stone, 0.03); });
    for (let x = -16.5; x < 16.5; x++) { B(x + 0.5, 15, -6, 1, 0.8, 1.2, stone, 0.02); B(x + 0.5, 43, -5.9, 1, 1.2, 1.6, stone, 0.02); }
    const win = (x, y, big) => { const w = big ? 4.2 : 3.6, h = big ? 5.4 : 4.8; B(x, y - 0.4, -5.5, w + 0.8, 0.4, 1.4, stone, 0); B(x, y, -5.9, w + 0.3, h + 0.3, 0.4, '#EDE7DA', 0); B(x, y + 0.15, -5.75, w - 0.3, h - 0.3, 0.3, '#5F8392', 0); B(x, y + 0.15, -5.55, 0.22, h - 0.3, 0.15, '#EDE7DA', 0); B(x, y + h * 0.62, -5.55, w - 0.3, 0.22, 0.15, '#EDE7DA', 0); B(x, y + h + 0.3, -5.6, w + 0.8, 0.5, 1, stone, 0); };
    win(-10, 5, true); win(10, 5, true);
    for (let fy = 0; fy < 3; fy++) for (let fx = 0; fx < 5; fx++) win(-13 + fx * 6.5, 17 + fy * 8.6, false);
    B(0, 0, -5.4, 8.4, 9, 1.4, stone, 0.02); B(0, 0, -5.0, 6.4, 8.2, 0.6, '#2F4A42', 0);
    for (const dx of [-1.55, 1.55]) { B(dx, 0.3, -4.6, 2.8, 6, 0.25, '#3A5A50', 0); B(dx, 0.8, -4.45, 2.1, 5, 0.15, '#9DB8C0', 0); B(dx, 3.2, -4.4, 2.1, 0.18, 0.1, '#3A5A50', 0); }
    B(-0.35, 2.9, -4.3, 0.18, 1.2, 0.25, '#C9B37A', 0); B(0.35, 2.9, -4.3, 0.18, 1.2, 0.25, '#C9B37A', 0);
    B(0, 6.5, -4.6, 6, 1.5, 0.25, '#3A5A50', 0); B(0, 6.7, -4.45, 5.4, 1.1, 0.15, '#9DB8C0', 0);
    for (let i = 0; i < 3; i++) B(0, i * 0.45, -3.6 + (2 - i) * 1.1, 10 - i * 0.9, 0.45, 3.3 - i * 1.1, '#CFC9BE', 0.02);
    B(-4.6, 0, -2.5, 0.25, 2.6, 0.25, '#5a5a5a', 0); B(4.6, 0, -2.5, 0.25, 2.6, 0.25, '#5a5a5a', 0);
    B(0, 9, -3.3, 11, 0.5, 4.4, '#4E4942', 0); B(0, 8.6, -1.1, 11, 0.9, 0.25, '#F3EEE2', 0);
    push(Tm(0, 9.05, -0.95)); plane(0, 0, 0, 10.6, 0.85, canvasTex(1600, 128, (g, w, h) => { g.fillStyle = '#F3EEE2'; g.fillRect(0, 0, w, h); g.fillStyle = '#3A5A50'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 84px Display'; g.fillText('PROMPTY · PORADY · TRIKI', w / 2, h / 2 + 5); })); pop();
    push(Tm(0, 12.1, -5.85)); B(0, -1.6, -0.15, 17.2, 3.2, 0.55, '#1E1E1E', 0); pop();
    push(Tm(5.8, 4.6, -5.75)); plane(0, 0, 0, 2.4, 1.8, signTex([['GODZINY PRZYJĘĆ', 30], ['pon–pt 8:00–15:00', 30], ['przerwa 12:00–12:15', 30]], { bg: '#F4EFE2', fg: '#2a2a2a', w: 420, h: 300, border: '#2a2a2a' })); pop();
    push(Tm(-5.8, 4.6, -5.75)); plane(0, 0, 0, 1.8, 1.4, signTex([['URZĄD', 56], ['CHATGPT', 56]], { bg: '#B01F2B', fg: '#F5E9C8', w: 300, h: 230 })); pop();
    B(-9, 0, 6, 0.5, 9, 0.5, '#3a3a3a', 0); B(-9, 9, 6, 1.4, 0.8, 1.4, '#2a2a2a', 0); B(-9, 8.6, 6, 1, 0.5, 1, '#FFE4A0', 0);
    B(9.5, 0, 4, 4.4, 0.3, 1.4, '#7A5235'); B(9.5, 1.2, 4, 4.4, 0.3, 1.4, '#8A5E3C'); B(9.5, 2, 3.4, 4.4, 1.2, 0.25, '#8A5E3C'); B(7.6, 0, 4, 0.3, 1.2, 1.2, '#333'); B(11.4, 0, 4, 0.3, 1.2, 1.2, '#333');
    B(12.8, 0, 7, 1.3, 1.9, 1.3, '#3D5C47', 0.03);
    [[-14, 4], [14, 10]].forEach(([x, z]) => { B(x, 0, z, 2.4, 1.4, 2.4, '#8C877E'); B(x, 1.4, z, 0.6, 4, 0.6, '#5A3E2B'); for (let i = 0; i < 40; i++) B(x + (rnd() - 0.5) * 4, 5 + rnd() * 3.5, z + (rnd() - 0.5) * 4, 1.1, 1.1, 1.1, ['#4E8A4A', '#3E7A3E', '#679E57', '#C98E3B'][i % 4], 0.05); });
  });
}
function neonTex(on) {
  return canvasTex(2048, 346, (g, w, h) => {
    g.fillStyle = '#151515'; g.fillRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
    const t = 'URZĄD CHATGPT'; let fs = 230; g.font = `700 ${fs}px Display`; while (g.measureText(t).width > w * 0.9) { fs -= 4; g.font = `700 ${fs}px Display`; }
    if (on) { g.shadowColor = '#FFC94D'; g.shadowBlur = 46; g.fillStyle = '#FFE29A'; g.fillText(t, w / 2, h / 2 + 6); g.shadowBlur = 14; g.fillStyle = '#FFF6DA'; g.fillText(t, w / 2, h / 2 + 6); }
    else { g.fillStyle = '#3a352b'; g.fillText(t, w / 2, h / 2 + 6); }
  });
}

// ============================================================ build
let R, composer, renderPass, gtao, bokeh, bloom, cam;
const SET = {};
function init3D() {
  const cv = document.createElement('canvas'); cv.width = Math.round(W * Q); cv.height = Math.round(H * Q);
  R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  R.setPixelRatio(1); R.setSize(cv.width, cv.height, false);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.outputColorSpace = THREE.SRGBColorSpace;
  cam = new THREE.PerspectiveCamera(28, W / H, 0.5, 400);

  const mk = (bg) => { const s = new THREE.Scene(); s.background = new THREE.Color(bg); return s; };
  SET.inS = mk('#EEE3C8'); SET.outS = mk('#BFDCE8');
  const lights = (s, sunPos, fill) => {
    s.add(new THREE.HemisphereLight('#FFF4E0', '#8C7A62', 1.15));
    const sun = new THREE.DirectionalLight('#FFE2B8', 2.6); sun.castShadow = true; sun.shadow.mapSize.set(4096 * Q > 1024 ? 4096 : 1024, 4096 * Q > 1024 ? 4096 : 1024);
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
    sun.position.set(...sunPos); s.add(sun); s.add(sun.target);
    if (fill) { const f = new THREE.PointLight('#FFF1D2', 60, 40, 1.6); f.position.set(4, 14, 4); s.add(f); }
  };
  lights(SET.inS, [-30, 34, 14], true); lights(SET.outS, [-25, 40, 30], false);
  SET.inS.add(interiorStatic()); SET.inS.add(robotSet());
  SET.outS.add(exteriorStatic());
  // live planes
  SET.led = { n12: ledTex('12'), big: ledTex('1 200 001') };
  SET.ledMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.8), new THREE.MeshBasicMaterial({ map: SET.led.n12, toneMapped: false }));
  SET.ledMesh.position.set(-2.6, 12.4, -13.9 + 0.12); SET.inS.add(SET.ledMesh);
  SET.face = { idle: faceTex('idle'), blink: faceTex('blink'), talk: faceTex('talk'), happy: faceTex('happy') };
  SET.faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.7), new THREE.MeshBasicMaterial({ map: SET.face.idle, toneMapped: false }));
  SET.faceMesh.position.set(7, 8.05, -13.4 + 1.12); SET.inS.add(SET.faceMesh);
  SET.lamp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), new THREE.MeshBasicMaterial({ color: '#FF5A1F', toneMapped: false }));
  SET.lamp.position.set(7, 10.1 + 0.225, -13.4); SET.inS.add(SET.lamp);
  SET.neon = { on: neonTex(true), off: neonTex(false) };
  SET.neonMesh = new THREE.Mesh(new THREE.PlaneGeometry(16.6, 2.8), new THREE.MeshBasicMaterial({ map: SET.neon.on, toneMapped: false }));
  SET.neonMesh.position.set(0, 12.1, -5.85 + 0.15); SET.outS.add(SET.neonMesh);

  // cast
  SET.C = {};
  for (const n of Object.keys(SPEC)) SET.C[n] = character(SPEC[n]);
  SET.C.extra1 = character({ ...SPEC.sed, shirt: '#6E8B5A', pants: '#3B3B3B', hair: (hy, hs) => { B(0, hy + hs - 0.1, 0, hs + 0.1, 0.45, hs, '#8A8A8A'); } });
  SET.photo = photoProp(); SET.photoTex = { a: photoTex(false), b: photoTex(true) };
  SET.photoPic = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.15), new THREE.MeshStandardMaterial({ map: SET.photoTex.a, roughness: 0.8 }));
  SET.photoPic.position.set(0, 0.71, 0.075); SET.photo.add(SET.photoPic);
  SET.taczka = taczkaProp(); SET.sedes = sedesProp(); SET.menu = menuProp(); SET.sign = capsSign();
  SET.ticket = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.05), new THREE.MeshStandardMaterial({ map: ticketTex(), roughness: 0.7, side: THREE.DoubleSide }));
  SET.ticket.castShadow = true;
  SET.ticketHand = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.2), new THREE.MeshStandardMaterial({ color: P.skin, roughness: 0.7 }));
  SET.ticketHand.position.set(0.12, -0.5, -0.08); SET.ticket.add(SET.ticketHand);

  composer = new EffectComposer(R);
  renderPass = new RenderPass(SET.inS, cam); composer.addPass(renderPass);
  gtao = new GTAOPass(SET.inS, cam, cv.width, cv.height); gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = 0.85; composer.addPass(gtao);
  bokeh = new BokehPass(SET.inS, cam, { focus: 40, aperture: 0.0022, maxblur: 0.007 }); composer.addPass(bokeh);
  bloom = new UnrealBloomPass(new THREE.Vector2(cv.width, cv.height), 0.35, 0.6, 0.92); composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

// ============================================================ animation helpers
const mj = (x) => { x = clamp(x); return x * x * x * (10 - 15 * x + 6 * x * x); };   // minimum-jerk
// keyed track: keys [t, x, z, ry]; returns {x, z, ry, dist} with walking distance travelled
function track(t, keys) {
  let dist = 0;
  if (t <= keys[0][0]) return { x: keys[0][1], z: keys[0][2], ry: keys[0][3], dist: 0, moving: 0 };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i], L = Math.hypot(b[1] - a[1], b[2] - a[2]);
    if (t < b[0]) {
      const f = (t - a[0]) / (b[0] - a[0]), e = E.inOutSine(f);
      return { x: lerp(a[1], b[1], e), z: lerp(a[2], b[2], e), ry: lerpAng(a[3], b[3], mj(f * 1.6)), dist: dist + L * e, moving: L > 0.05 ? Math.sin(PI * f) : 0 };
    }
    dist += L;
  }
  const z = keys[keys.length - 1]; return { x: z[1], z: z[2], ry: z[3], dist, moving: 0 };
}
const lerpAng = (a, b, f) => { let d = ((b - a + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI; return a + d * f; };
const face = (x0, z0, x1, z1) => Math.atan2(x1 - x0, z1 - z0);
function blinkAmt(t, seed) {
  const per = 3.1 + seed * 0.37, ph = ((t + seed * 1.13) % per) / per * per;
  return ph < 0.14 ? 1 - Math.sin(PI * ph / 0.14) * 0.88 : 1;
}
function pose(c, t, st, { arms = 'down', seed = 1, talk = 0 } = {}) {
  c.root.position.set(st.x, 0, st.z); c.root.rotation.y = st.ry;
  const ph = st.dist * 1.25;
  const sw = Math.sin(ph) * 0.6 * clamp(st.moving * 3);
  c.legL.rotation.x = sw; c.legR.rotation.x = -sw;
  const bob = Math.abs(Math.cos(ph)) * 0.16 * clamp(st.moving * 3);
  const breathe = Math.sin(t * 2.1 + seed) * 0.03;
  const tk = talk ? (Math.sin(t * 17 + seed) * 0.5 + 0.5) : 0;
  c.body.position.y = c.body.userData.pivot.y + bob + breathe * 0.5;
  c.body.rotation.z = Math.sin(ph) * 0.04 * clamp(st.moving * 3);
  c.body.rotation.x = (st.lean || 0);
  c.head.rotation.x = -0.06 * tk + Math.sin(t * 1.3 + seed) * 0.02 + (st.nod || 0);
  c.head.rotation.y = (st.look || 0);
  c.head.rotation.z = Math.sin(t * 0.9 + seed * 2) * 0.03;
  c.head.position.y = c.head.userData.pivot.y - c.body.userData.pivot.y + tk * 0.08;
  c.eyes.scale.y = blinkAmt(t, seed);
  for (const [k, g] of Object.entries(c.arms)) g.visible = k === arms;
}
const talking = (t, who) => { const l = lineOf(t, who); return l && t < l.t0 + Math.min(l.t1 - l.t0, 0.5 + l.text.length * 0.03) ? 1 : 0; };
function worldOf(obj) { obj.updateWorldMatrix(true, false); return obj.matrixWorld.clone(); }
function placeAt(prop, m) { prop.matrixAutoUpdate = false; prop.matrix.copy(m); prop.matrixWorldNeedsUpdate = true; }
function lerpMat(a, b, f, lift = 0) {
  const pa = new THREE.Vector3(), qa = new THREE.Quaternion(), sa = new THREE.Vector3(), pb = new THREE.Vector3(), qb = new THREE.Quaternion(), sb = new THREE.Vector3();
  a.decompose(pa, qa, sa); b.decompose(pb, qb, sb);
  const p = pa.lerp(pb, f); p.y += lift * Math.sin(PI * f);
  return new THREE.Matrix4().compose(p, qa.slerp(qb, f), sa.lerp(sb, f));
}
const MAT_ = (x, y, z, ry = 0, rx = 0, rz = 0) => Tm(x, y, z, ry, rx, rz);

// ============================================================ staging
// The line, front to back: restauratorka, pan z sedesem, pan z taczką (barrow ahead of him, wheel to the
// window), babcia, hero. Everyone who is done waits by the chairs on the left wall.
const POS = {
  hero0: [-6.6, 5.6, 1.15], hero1: [-0.6, 2.8], hero2: [0.6, 1.8],
  bab: [-1.6, 3.6, -0.7], panQ: [3.4, -0.2, PI], tacz: [3.4, -5.4, PI],
  sedQ: [5.2, -7.6, PI + 0.3], sedTalk: [6.2, -4.2], restQ: [8.6, -8.0, PI - 0.2], restTalk: [6.6, -2.4],
  seat: { babcia: [-12, -2, 0.9], sed: [-13, -7, 0.8], rest: [-10, -9, 0.6], caps: [-8.4, -12.2, 0.55], extra1: [-13.4, 2.6, 1.3] },
  ticket: [-9.9, 10.9, -2.36],
};
const still = (x, z, ry) => ({ x, z, ry, dist: 0, moving: 0 });
function stage(t) {
  const C = SET.C, inS = SET.inS;
  for (const c of Object.values(C)) { inS.add(c.root); c.root.visible = true; }
  for (const p of [SET.photo, SET.taczka, SET.sedes, SET.menu, SET.sign, SET.ticket]) { inS.add(p); p.visible = true; }
  SET.photoPic.material.map = SET.photoTex.a;
  SET.ledMesh.material.map = t >= EVENTS.led + 0.25 ? SET.led.big : SET.led.n12;
  let rf = 'idle';
  if (lineOf(t, 'robot')) rf = talking(t, 'robot') && Math.sin(t * 17) > 0 ? 'talk' : 'happy';
  else if (t > SC.okienko.t1 - 0.01) rf = 'happy';
  else if ((t % 4.2) < 0.13) rf = 'blink';
  SET.faceMesh.material.map = SET.face[rf];
  SET.lamp.material.color.set(t > EVENTS.led && t < EVENTS.led + 1.2 && Math.floor((t - EVENTS.led) * 6) % 2 === 0 ? '#FFD34D' : '#FF5A1F');
  const sB = SC.babcia, sT = SC.taczka, sS = SC.sedes, sM = SC.menu, sO = SC.okienko, seat = POS.seat;
  const [h1x, h1z] = POS.hero1, [h2x, h2z] = POS.hero2, [px, pz] = POS.panQ, [sx2, sz2] = POS.sedTalk, [rx2, rz2] = POS.restTalk;

  // ---- hero
  const Hc = C.hero;
  let hs = still(...POS.hero0), harms = 'down';
  if (t < SC.ticket.t0) {
    hs = track(t, [[0, 3.2, 17, PI], [2.6, 1.6, 6.0, PI + 0.1]]);
  } else if (t < sB.t0) {
    hs = still(...POS.ticket);
    if (t >= EVENTS.insert) Hc.root.visible = false;            // the insert is his point of view
  } else if (t < sT.t0) {
    const [x, z, r] = POS.hero0;
    hs = track(t, [[sB.t0 - 0.3, x - 3.6, z + 1.4, r], [sB.t0 + 0.7, x, z, r]]);
    if (t > EVENTS.photoGive + 0.25) harms = 'hold';
  } else if (t < sS.t0) {
    hs = still(h1x, h1z, face(h1x, h1z, px - 0.3, pz + 0.6)); harms = 'hold';
  } else if (t < sO.t0) {
    const who = t < sM.t0 ? [sx2, sz2] : [rx2, rz2];
    hs = still(h2x, h2z, face(h2x, h2z, ...who)); harms = 'hold';
    if (t >= sM.t0 && t > EVENTS.menuLean + 0.75) harms = 'down';
  } else {
    const a = sO.t0;
    hs = track(t, [[a, 3.4, -0.1, PI], [a + 1.0, 6.4, -0.3, PI], [a + 1.6, 9.0, -1.6, PI - 0.5]]);
    harms = t < a + 1.05 ? 'push' : 'down';
  }
  pose(Hc, t, hs, { arms: harms, seed: 1, talk: talking(t, 'hero') });
  if (t < SC.ticket.t0) SET.outS.add(Hc.root);

  // ---- babcia: holds the photo up, hands it over, goes to wait by the chairs
  const Bc = C.babcia;
  let bs = still(...POS.bab), barms = 'hold';
  if (t >= EVENTS.photoGive + 0.3) {
    barms = 'down';
    const g0 = EVENTS.photoGive + 0.7, [x, z, r] = POS.bab, [sx, sz, sr] = seat.babcia;
    bs = track(t, [[g0, x, z, r], [g0 + 0.35, x, z, -1.2], [g0 + 2.4, x - 5.5, z + 2.8, -1.4], [g0 + 6.0, sx, sz, sr]]);
  }
  pose(Bc, t, bs, { arms: barms, seed: 2, talk: talking(t, 'babcia') });

  // ---- pan z taczką: behind the barrow handles, turns round to talk, then out for a smoke
  const Pn = C.pan;
  let ps = still(...POS.panQ), parms = 'push';
  if (t >= sT.t0 && t < sS.t0) {
    const r1 = face(px - 0.3, pz + 0.6, h1x, h1z);
    ps = track(t, [[sT.t0 + 0.05, px, pz, PI], [sT.t0 + 0.55, px - 0.3, pz + 0.6, r1]]);
    parms = t > sT.t0 + 0.12 ? 'down' : 'push';
    if (t > EVENTS.panLeaves) ps = track(t, [[EVENTS.panLeaves, px - 0.3, pz + 0.6, r1], [EVENTS.panLeaves + 0.4, px - 0.3, pz + 0.6, 0.1], [EVENTS.panLeaves + 2.4, px - 1.2, pz + 6.6, -0.4], [EVENTS.panLeaves + 7, -14, 12, -1.2]]);
  } else if (t >= sS.t0) Pn.root.visible = false;
  pose(Pn, t, ps, { arms: parms, seed: 3, talk: talking(t, 'pan') });

  // ---- pan z sedesem: comes back down the line, drops the bowl into the barrow, waits by the wall
  const Sd = C.sed;
  let ss = still(...POS.sedQ);
  if (t >= sS.t0) {
    const rT = face(sx2, sz2, h2x, h2z);
    ss = track(t, [[sS.t0 - 0.6, sx2 + 1.4, sz2 - 2.4, PI + 0.3], [sS.t0 + 0.5, sx2, sz2, rT]]);
    if (t > EVENTS.sedesDrop + 0.7) { const [ex, ez, er] = seat.sed; ss = track(t, [[EVENTS.sedesDrop + 0.7, sx2, sz2, rT], [EVENTS.sedesDrop + 1.1, sx2, sz2, PI], [EVENTS.sedesDrop + 2.8, 5.4, -9.0, -PI / 2], [EVENTS.sedesDrop + 8, ex, ez, er]]); }
    if (t >= sO.t0) ss = still(...seat.sed);
  }
  pose(Sd, t, ss, { arms: 'down', seed: 4, talk: talking(t, 'sed') });

  // ---- restauratorka
  const Rs = C.rest;
  let rs = still(...POS.restQ), rarms = 'hold';
  if (t >= sM.t0) {
    const rT = face(rx2, rz2, h2x, h2z);
    rs = track(t, [[sM.t0 - 0.6, rx2 - 0.4, rz2 - 3.0, PI], [sM.t0 + 0.4, rx2, rz2, rT]]);
    if (t > EVENTS.menuLean - 0.05) rarms = 'down';
    if (t > EVENTS.menuLean - 0.5 && t <= EVENTS.menuLean + 0.6) rs.ry = lerpAng(rT, face(rx2, rz2, 3.4, -5.4), mj((t - EVENTS.menuLean + 0.5) / 0.4));
    if (t > EVENTS.menuLean + 0.6) { const [ex, ez, er] = seat.rest; rs = track(t, [[EVENTS.menuLean + 0.6, rx2, rz2, face(rx2, rz2, 3.4, -5.4)], [EVENTS.menuLean + 1.0, rx2, rz2, PI], [EVENTS.menuLean + 3.0, 6.8, -9.0, -PI / 2], [EVENTS.menuLean + 8, ex, ez, er]]); }
  }
  if (t >= sO.t0) { rs = still(...seat.rest); rarms = 'down'; }
  pose(Rs, t, rs, { arms: rarms, seed: 5, talk: talking(t, 'rest') });

  // ---- the shouter and a waiting extra
  const Cp = C.caps, X1 = C.extra1, shout = lineOf(t, 'caps');
  pose(Cp, t, { ...still(...seat.caps), nod: shout ? -0.1 : 0 }, { arms: 'hold', seed: 6, talk: talking(t, 'caps') });
  Cp.root.position.y = shout ? Math.abs(Math.sin((t - shout.t0) * 13)) * 0.22 : 0;
  pose(X1, t, still(...seat.extra1), { arms: 'down', seed: 7 });
  placeAt(SET.sign, worldOf(Cp.anchor).multiply(MAT_(0, 0.3, 0, 0, 0, -0.42 + (shout ? 0.12 * Math.sin((t - shout.t0) * 9) : 0))));

  // ---- wheelbarrow
  const [tx, tz, tr] = POS.tacz;
  let tm = MAT_(tx, 0, tz, tr);
  if (t >= sO.t0) {
    const f = mj((t - sO.t0) / 1.0);
    tm = MAT_(lerp(tx, 6.4, f), 0, lerp(tz, -5.6, f), PI).multiply(MAT_(0, 0, 0, 0, -0.06 * Math.sin(PI * f)));
  }
  placeAt(SET.taczka, tm);
  // sedes: carried on his left, then into the barrow
  const inBarrow = SET.taczka.matrix.clone().multiply(MAT_(0, 3.3, 0, -0.3 - PI));
  const carry = worldOf(Sd.body).multiply(MAT_(-1.95, Sd.ty + 0.25 - Sd.lh, 0.2, 0.25));
  if (t < sS.t0) placeAt(SET.sedes, carry);
  else if (t < sM.t0) { const f = clamp((t - EVENTS.sedesDrop) / 0.55); placeAt(SET.sedes, f <= 0 ? carry : lerpMat(carry, inBarrow, E.inOutCubic(f), 1.6)); }
  else placeAt(SET.sedes, inBarrow);
  // menu: in her hands, then leaned on the tank
  const menuHeld = worldOf(Rs.anchor).multiply(MAT_(0, -0.6, 0.02));
  const menuLeaned = SET.sedes.matrix.clone().multiply(MAT_(0, 1.85, -0.15, 0, -0.3));
  if (t >= sO.t0) placeAt(SET.menu, menuLeaned);
  else if (t < sM.t0 || t < EVENTS.menuLean - 0.4) placeAt(SET.menu, menuHeld);
  else placeAt(SET.menu, lerpMat(menuHeld, menuLeaned, E.inOutCubic(clamp((t - (EVENTS.menuLean - 0.4)) / 0.5)), 0.6));
  // photo: babcia -> hero -> leaned against the bowl
  const photoBab = worldOf(Bc.anchor), photoHero = worldOf(Hc.anchor);
  const photoLean = SET.sedes.matrix.clone().multiply(MAT_(-0.75, 0.05, 1.75, 0.25, -0.32));
  const g = EVENTS.photoGive;
  if (t >= sO.t0) placeAt(SET.photo, photoLean);
  else if (t < g) placeAt(SET.photo, photoBab);
  else if (t < sT.t0) placeAt(SET.photo, lerpMat(photoBab, photoHero, E.inOutCubic(clamp((t - g) / 0.45)), 0.25));
  else if (t < sM.t0 || t < EVENTS.menuLean + 0.2) placeAt(SET.photo, photoHero);
  else placeAt(SET.photo, lerpMat(photoHero, photoLean, E.inOutCubic(clamp((t - EVENTS.menuLean - 0.2) / 0.5)), 0.5));
  if (t > EVENTS.wink - 0.3 && t < EVENTS.wink + 0.12) SET.photoPic.material.map = SET.photoTex.b;
  // ticket: out of the slot, then held up against the display
  SET.ticket.matrixAutoUpdate = true;
  if (t >= SC.ticket.t0 && t < EVENTS.insert) {
    const k = E.outCubic(clamp((t - SC.ticket.t0 - 0.2) / 0.45));
    SET.ticket.position.set(-12, 3.05 - 0.45 * k, 8.78 + 0.5 * k); SET.ticket.rotation.set(-PI / 2 * (1 - k) - 0.2 * k, 0, 0);
    SET.ticketHand.visible = false;
  } else if (t >= EVENTS.insert && t < sB.t0) {
    const a = t - EVENTS.insert;
    SET.ticket.position.set(-10.4 + 0.03 * Math.sin(a * 2), 6.7 + 0.15 * E.outCubic(clamp(a / 0.5)), 10.0);
    SET.ticket.lookAt(cam.position); SET.ticket.rotateZ(0.06);
    SET.ticketHand.visible = true;
  } else SET.ticket.visible = false;
}

// ============================================================ cameras
const CAM = [];
const shot = (name, keys, o = {}) => CAM.push({ name, keys, ...o });
function camAt(t) {
  let c = CAM[0];
  for (const s of CAM) if (t >= s.t0) c = s;
  const k = c.keys, f = E.inOutSine(clamp((t - c.t0) / (c.t1 - c.t0)));
  const pos = new THREE.Vector3(...k[0].pos).lerp(new THREE.Vector3(...k[1].pos), f);
  const tgt = new THREE.Vector3(...k[0].tgt).lerp(new THREE.Vector3(...k[1].tgt), f);
  const focus = k[0].focus ? new THREE.Vector3(...k[0].focus).lerp(new THREE.Vector3(...(k[1].focus || k[0].focus)), f) : tgt;
  return { pos, tgt, focus, fov: lerp(k[0].fov || 28, k[1].fov || k[0].fov || 28, f), ap: c.ap ?? 0.0022, out: !!c.out };
}
function cameras() {
  const s = (n) => SC[n];
  shot('ext', [{ pos: [4, 8, 80], tgt: [0, 13.5, 0], focus: [3.2, 4, 12] }, { pos: [3.4, 8.4, 70], tgt: [0.2, 13.0, 0], focus: [1.6, 4, 6] }], { t0: 0, t1: s('ext').t1, ap: 0.0012, out: true });
  shot('machine', [{ pos: [-15.3, 6.9, 16.6], tgt: [-11.2, 3.9, 8.8], focus: [-11.6, 3.6, 9.4] }, { pos: [-15.3, 6.7, 15.6], tgt: [-11.2, 3.8, 8.8], focus: [-11.6, 3.6, 9.4] }], { t0: s('ticket').t0, t1: EVENTS.insert });
  shot('insert', [{ pos: [-11.0, 7.05, 12.4], tgt: [-4.6, 10.6, -13], focus: [-10.4, 6.8, 10.0] }, { pos: [-11.0, 7.0, 12.2], tgt: [-4.5, 10.8, -13], focus: [-10.4, 6.8, 10.0] }], { t0: EVENTS.insert, t1: s('ticket').t1, ap: 0.0045 });
  shot('babcia', [{ pos: [-9, 13, 40], tgt: [-2.8, 6.8, 0], focus: [-4, 5, 4.5] }, { pos: [-8.3, 12.5, 37], tgt: [-2.6, 6.6, 0], focus: [-4, 5, 4.5] }], { t0: s('babcia').t0, t1: s('babcia').t1 });
  shot('wink', [{ pos: [-4.7, 3.3, 7.4], tgt: [-2.6, 2.76, 4.8] }, { pos: [-4.4, 3.25, 7.0], tgt: [-2.6, 2.76, 4.8] }], { t0: EVENTS.wink - 0.75, t1: EVENTS.wink + 0.55, ap: 0.004 });
  shot('babcia2', [{ pos: [-8.3, 12.5, 37], tgt: [-2.6, 6.6, 0], focus: [-4, 5, 4.5] }, { pos: [-8.0, 12.3, 35.8], tgt: [-2.6, 6.6, 0], focus: [-4, 5, 4.5] }], { t0: EVENTS.wink + 0.55, t1: SC.babcia.t1 });
  shot('taczka', [{ pos: [9.5, 12.5, 29], tgt: [0.9, 5.6, -0.8], focus: [1.4, 4.5, 1.4] }, { pos: [8.8, 12.2, 27], tgt: [0.9, 5.6, -0.8], focus: [1.4, 4.5, 1.4] }], { t0: s('taczka').t0, t1: s('taczka').t1 });
  shot('sedes', [{ fov: 33, pos: [11.5, 13.2, 26], tgt: [3.5, 5.0, -1.6], focus: [3.4, 4.2, -1.2] }, { pos: [10.8, 12.9, 24.4], tgt: [3.5, 5.0, -1.6], focus: [3.4, 4.2, -1.2] }], { t0: s('sedes').t0, t1: s('sedes').t1 });
  shot('menu', [{ pos: [-8, 13.5, 26], tgt: [4.0, 5.4, -2.2], focus: [3.8, 4.2, -1.0] }, { pos: [-7.4, 13.2, 24.6], tgt: [4.0, 5.4, -2.2], focus: [3.8, 4.2, -1.0] }], { t0: s('menu').t0, t1: EVENTS.menuZoom });
  shot('menuZoom', [{ pos: [2.5, 4.6, 3.4], tgt: [5.1, 3.1, -1.4] }, { pos: [2.9, 4.4, 2.6], tgt: [5.1, 3.1, -1.4] }], { t0: EVENTS.menuZoom, t1: EVENTS.menuZoom + 1.6, ap: 0.003 });
  shot('menu2', [{ pos: [-7.4, 13.2, 24.6], tgt: [4.0, 5.4, -2.2], focus: [3.8, 4.2, -1.0] }, { pos: [-7.0, 13.0, 23.6], tgt: [4.0, 5.4, -2.4], focus: [3.8, 4.2, -1.0] }], { t0: EVENTS.menuZoom + 1.6, t1: s('menu').t1 });
  shot('krzyk', [{ pos: [-1.5, 8.6, 9.0], tgt: [-8.6, 7.6, -12.2] }, { pos: [-2.0, 8.5, 7.6], tgt: [-8.6, 7.7, -12.2] }], { t0: s('krzyk').t0, t1: EVENTS.led });
  shot('led', [{ pos: [-2.6, 11.4, 2.0], tgt: [-2.6, 12.2, -13.9] }, { pos: [-2.6, 11.6, -1.0], tgt: [-2.6, 12.2, -13.9] }], { t0: EVENTS.led, t1: s('krzyk').t1, ap: 0.001 });
  shot('okienko', [{ pos: [-2, 15.5, 31], tgt: [7.4, 7.0, -4.8], focus: [6, 5, -2] }, { pos: [-3, 15, 27], tgt: [7.9, 7.3, -6.6], focus: [7, 5, -4.5] }], { t0: s('okienko').t0, t1: s('okienko').t1 });
  shot('witamy', [{ pos: [-3, 15, 27], tgt: [7.9, 7.3, -6.6], focus: [7, 5, -4.5] }, { pos: [-9, 27, 44], tgt: [1, 5, -4], focus: [3, 4, -3] }], { t0: s('witamy').t0, t1: END_T });
}

// ============================================================ speech bubbles (2-D)
const BUB = { font: 44, lh: 52, pad: [30, 22], maxW: 640, r: 32 };
const SPK = {   // where each speaker's bubble sits by scene: side ('l' tail at left), dx, dy offsets from the head-top projection
  default: { side: 'l', dx: 0, dy: -60 },
};
function wrap(ctx, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function project(v) { const p = v.clone().project(cam); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H, p.z]; }
const ANCH_OFF = { hero: 0.4, babcia: 0.4, pan: 0.4, sed: 0.4, rest: 0.4, caps: 6.2, robot: 0 };
function speakerAnchor(who) {
  if (who === 'robot') return new THREE.Vector3(7, 12.7, -13.4);
  const c = SET.C[who]; const v = new THREE.Vector3(); c.root.getWorldPosition(v); v.y = c.top + ANCH_OFF[who]; return v;
}
// per-line placement overrides: index in LINES -> {side, dx, dy}
const PLACE = {};
function layoutBubble(ctx, l) {
  const shout = l.who === 'caps';
  const fs = shout ? 50 : BUB.font;
  ctx.font = `700 ${fs}px Display`;
  const lines = wrap(ctx, l.text, BUB.maxW - 2 * BUB.pad[0]);
  const tw = Math.max(...lines.map((s) => ctx.measureText(s).width));
  const bw = tw + 2 * BUB.pad[0], bh = lines.length * BUB.lh + 2 * BUB.pad[1] - 4;
  let [ax, ay] = project(speakerAnchor(l.who));
  const pl = { dx: 0, dy: 0, ...(l.place || {}) };
  if (l.fixed) { const [fx, fy] = l.fixed; const off = l.who === 'hero' && !inSc(T_NOW, 'okienko'); return { l, x: fx, y: fy, bw, bh, lines, ax: off ? fx + 20 : ax, ay: off ? fy + bh + 400 : ay, side: 'l', fs, shout }; }
  const side = pl.side || (ax < W / 2 ? 'l' : 'r');
  let x = side === 'l' ? ax - 90 + pl.dx : ax - bw + 90 + pl.dx;
  x = clamp(x, 44, W - 44 - bw);
  let y = clamp(ay - bh - 70 + pl.dy, 160, 1440 - bh);
  return { l, x, y, bw, bh, lines, ax, ay, side, fs, shout };
}
function drawBubble(ctx, b, t) {
  const { l, x, y, bw, bh, lines, ax, ay, side, fs, shout } = b;
  const age = t - l.t0, left = l.end - t;
  const pin = M.spring(age, { stiffness: 420, damping: 22 }), out = clamp(left / 0.16);
  // tail: from the bubble's bottom edge toward the speaker's head, 48 px long
  let bx = clamp(ax, x + 54, x + bw - 54), by = y + bh - 3;
  const sideTail = ay < y + bh * 0.5 && (ax > x + bw || ax < x);
  if (sideTail) { bx = ax > x + bw ? x + bw - 3 : x + 3; by = y + bh * 0.45; }
  let vx = ax - bx, vy = ay - by; const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
  if (!sideTail && vy < 0.35) { vy = 0.35; vx = Math.sign(vx) * Math.sqrt(1 - vy * vy); }
  const tipX = bx + vx * 50, tipY = by + vy * 50;
  const sc = (0.55 + 0.45 * pin) * (0.94 + 0.06 * out);
  ctx.save();
  ctx.globalAlpha = clamp(age / 0.08) * out;
  ctx.translate(bx, by); ctx.scale(sc, sc); ctx.translate(-bx, -by);
  if (shout) { const j = Math.sin(t * 60) * 3 * clamp(1 - age / 0.8); ctx.translate(j, -j); }
  const ink = '#1d1a17', paper = shout ? '#FFF3D6' : '#FFFDF6';
  const path = () => { ctx.beginPath(); ctx.roundRect(x, y, bw, bh, BUB.r); if (sideTail) { const ex = bx + (bx > x + bw / 2 ? -2 : 2); ctx.moveTo(ex, by - 20); ctx.lineTo(tipX, tipY); ctx.lineTo(ex, by + 20); } else { ctx.moveTo(bx - 20, y + bh - 2); ctx.lineTo(tipX, tipY); ctx.lineTo(bx + 20, y + bh - 2); } };
  ctx.fillStyle = 'rgba(29,26,23,.28)'; ctx.save(); ctx.translate(0, 10); path(); ctx.fill(); ctx.restore();
  ctx.lineWidth = 12; ctx.strokeStyle = shout ? '#B3262C' : ink; ctx.lineJoin = 'round'; path(); ctx.stroke();
  ctx.fillStyle = paper; path(); ctx.fill();
  ctx.font = `700 ${fs}px Display`;
  ctx.fillStyle = shout ? '#B3262C' : ink; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  lines.forEach((s, i) => ctx.fillText(s, x + BUB.pad[0], y + BUB.pad[1] + 38 + i * BUB.lh));
  ctx.restore();
}
let T_NOW = 0;
function bubbles(ctx, t) {
  T_NOW = t;
  const live = LINES.filter((l) => t >= l.t0 && t < l.end);
  const L = live.map((l) => layoutBubble(ctx, l));
  // older bubbles step up above newer ones they would overlap, like a comic strip read top-down
  for (let i = L.length - 2; i >= 0; i--) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j];
    const ox = a.x < b.x + b.bw + 16 && b.x < a.x + a.bw + 16, oy = a.y < b.y + b.bh + 70 && b.y < a.y + a.bh + 24;
    if (ox && oy) a.y = b.y - a.bh - 74;
  }
  L.forEach((b) => drawBubble(ctx, b, t));
}

// ============================================================ title card
function witamy(ctx, t) {
  const a = t - SC.witamy.t0; if (a < 0) return;
  const k = M.spring(a - 0.25, { stiffness: 260, damping: 20 });
  const y = 760;
  ctx.save();
  ctx.translate(0, (1 - k) * 260); ctx.globalAlpha = clamp((a - 0.25) / 0.12);
  ctx.fillStyle = '#173A31'; M.rrect(ctx, 90, y - 130, 900, 230, 26); ctx.fill();
  ctx.strokeStyle = '#E8C35A'; ctx.lineWidth = 10; M.rrect(ctx, 108, y - 112, 864, 194, 18); ctx.stroke();
  ctx.fillStyle = '#FFF1C9'; ctx.textAlign = 'center'; ctx.font = '700 104px Display'; ctx.fillText('Witamy w grupie.', 540, y + 20);
  ctx.restore();
}

// ============================================================ film
cameras();
let CTX2;
M.film({
  fonts: ['700 100px Display', '400 100px Script'],
  samples: 1,
  async init() {
    init3D();
  },
  draw(ctx, u, t) {
    if (t >= END_T) { M.fill(ctx, '#0B0B0C'); return; }   // end card removed
    const c = camAt(t);
    stage(t);
    // exterior neon flickers on as he walks up
    if (c.out) {
      const fl = t < 0.25 ? 0 : t < 0.7 ? (Math.floor(t * 23) % 3 === 0 ? 0 : 1) : 1;
      SET.neonMesh.material.map = fl ? SET.neon.on : SET.neon.off;
    }
    const scene = c.out ? SET.outS : SET.inS;
    cam.position.copy(c.pos); cam.fov = c.fov; cam.updateProjectionMatrix(); cam.lookAt(c.tgt);
    renderPass.scene = scene; gtao.scene = scene; bokeh.scene = scene;
    bokeh.uniforms.focus.value = cam.position.distanceTo(c.focus); bokeh.uniforms.aperture.value = c.ap;
    composer.render();
    ctx.drawImage(R.domElement, 0, 0, W, H);
    bubbles(ctx, t);
    witamy(ctx, t);
    // hand-over to the end card: quick dip to ink
    const d = clamp((t - (END_T - 0.3)) / 0.3);
    if (d > 0) { ctx.fillStyle = `rgba(11,11,12,${E.inCubic(d)})`; ctx.fillRect(0, 0, W, H); }
  },
});
