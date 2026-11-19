// Onion · site: a cebola 3D da mesa do Onion (mesmo desenho do app, web/onion3d.js), com o som no núcleo.
// Uma casca por stem, de fora pra dentro; cortada ao meio pra ver as camadas em volta do núcleo.
// Sem áudio no site: os níveis seguem um padrão de 120 BPM (bumbo, baixo no contratempo, voz em frases).
// Botões [data-stem]: clique isola a camada (as outras descascam); clique de novo volta tudo.
import * as THREE from './vendor/three.module.js';

const STEMS = [['vocals', '#B07CFF'], ['drums', '#FF5B00'], ['bass', '#1FB5A8'], ['guitar', '#FF4D8D'], ['piano', '#4DA3FF'], ['other', '#FFD12E']];
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

function levels(t) {
  const beat = (t * 2) % 1, bar = (t / 2) % 1;          // 120 BPM: batida a cada 0,5 s, compasso a cada 2 s
  const kick = Math.exp(-beat * 9);
  const off = Math.exp(-((beat + .5) % 1) * 7);
  const phrase = Math.max(0, Math.sin(t * 0.8)) * (0.6 + 0.4 * Math.sin(t * 5.3));
  return [phrase, kick, off * .9, .35 + .3 * Math.sin(t * 3.1), .3 + .25 * Math.sin(t * 1.7 + 1), .25 + .2 * Math.sin(bar * 6.28)];
}

export function cebola(host) {
  const W = () => host.clientWidth || 400;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio));
  r.setSize(W(), W());
  r.localClippingEnabled = true;
  host.appendChild(r.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(2.2, 1.5, 6.4); cam.lookAt(0, 0.12, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a6a80, 1.8));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.8); fill.position.set(-4, 1, 2); scene.add(fill);
  const root = new THREE.Group(); scene.add(root);
  const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const n = STEMS.length, shells = [];
  STEMS.forEach(([, c], i) => {
    const rad = 1.5 - (i / n) * 1.05;
    const geo = new THREE.SphereGeometry(rad, 72, 48);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k), t = y / rad;
      const pinch = t > 0 ? 1 - Math.pow(t, 2.2) * 0.62 : 1 - Math.pow(-t, 3) * 0.08;
      pos.setX(k, pos.getX(k) * pinch); pos.setZ(k, pos.getZ(k) * pinch);
      if (t > 0.6) pos.setY(k, y + Math.pow((t - 0.6) / 0.4, 2) * rad * 0.35);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.42, metalness: 0, emissive: c, emissiveIntensity: 0.12,
      side: THREE.DoubleSide, transparent: true, opacity: 1, clippingPlanes: [cut] });
    const m = new THREE.Mesh(geo, mat);
    root.add(m);
    shells.push({ m, mat, s: 1, o: 1 });
  });
  // o núcleo: o som
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 48, 32), coreMat);
  core.position.y = -0.05;
  root.add(core);
  const glow = new THREE.PointLight(0xffffff, 3, 3.5); core.add(glow);

  let solo = -1, on = true, t0 = performance.now(), last = t0;
  function frame(now) {
    if (!on) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const size = W(); if (r.domElement.width !== Math.round(size * r.getPixelRatio())) r.setSize(size, size);
    const t = still ? 0 : (now - t0) / 1000;
    root.rotation.y = -0.25 + Math.sin(t * 0.4) * 0.3;
    const lv = levels(t);
    shells.forEach((sh, i) => {
      const heard = solo < 0 || solo === i;
      const tgtS = heard ? 1 + lv[i] * 0.08 : 0.25, tgtO = heard ? 1 : 0;
      sh.s += (tgtS - sh.s) * Math.min(1, dt * (tgtS > sh.s ? 16 : 5));
      sh.o += (tgtO - sh.o) * Math.min(1, dt * 7);
      sh.m.scale.setScalar(sh.s);
      sh.mat.opacity = sh.o; sh.mat.depthWrite = sh.o > 0.95;
      sh.mat.emissiveIntensity = 0.1 + lv[i] * 0.45;
      sh.m.visible = sh.o > 0.01;
    });
    const pulse = 1 + lv[1] * 0.35;
    core.scale.setScalar(pulse); glow.intensity = 2 + lv[1] * 4;
    r.render(scene, cam);
    if (!still) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  new IntersectionObserver(es => es.forEach(e => { const was = on; on = e.isIntersecting; if (on && !was) { last = performance.now(); requestAnimationFrame(frame); } })).observe(host);
  return {
    solo(i) { solo = solo === i ? -1 : i; if (still) requestAnimationFrame(frame); return solo; },
  };
}

const host = document.querySelector('[data-cebola]');
if (host) {
  try {
    const c = cebola(host);
    document.querySelectorAll('[data-stem]').forEach(b => b.addEventListener('click', () => {
      const s = c.solo(+b.dataset.stem);
      document.querySelectorAll('[data-stem]').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.stem === s)));
    }));
  } catch (e) { host.classList.add('sem-3d'); }
}
