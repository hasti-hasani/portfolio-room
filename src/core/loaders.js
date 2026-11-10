import * as THREE from 'three';
import { RES, ANISO } from '../config.js';

// Everything on `manager` must be in before "Step inside" is enabled.
// `lateManager` loads on the side (paintings, the big plant): those appear when ready.
export const manager = new THREE.LoadingManager();
export const lateManager = new THREE.LoadingManager();

// Pictures are decoded off the main thread (ImageBitmap) where the browser does that reliably, so a painting
// arriving while you walk doesn't stall a frame. Safari and old Firefox get plain <img> decoding (same rule as three's GLTFLoader).
const ua = navigator.userAgent;
const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
const firefox = /firefox\/(\d+)/i.exec(ua);
const useBitmaps = typeof createImageBitmap !== 'undefined' && !isSafari && !(firefox && +firefox[1] < 98);

// One download, one decode and one upload to the graphics card per file, however many textures use it
// (the linen weave, for example, is the couch fabric, the rug's pile and the paintings' canvas)
const images = new Map();
function image(url, late) {
  let e = images.get(url);
  if (e) return e;
  e = { source: new THREE.Source(null), users: [], then: [], done: false };
  images.set(url, e);
  const loaded = img => {
    e.source.data = img;
    e.done = true;
    for (const t of e.users) t.needsUpdate = true;
    for (const f of e.then) f();
    e.users = e.then = null;
  };
  const m = late ? lateManager : manager;
  if (useBitmaps) new THREE.ImageBitmapLoader(m).setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' }).load(url, loaded);
  else new THREE.ImageLoader(m).load(url, loaded);
  return e;
}

// A texture from assets/. `onLate`: load it on the side (see lateManager) and call this once the picture is in
export function tex(path, repeat, color = false, onLate) {
  const e = image(`assets/${path}`, !!onLate);
  const t = new THREE.Texture();
  t.source = e.source;
  if (useBitmaps) t.flipY = false;   // the bitmap is already flipped
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(...repeat);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  if (e.done) { t.needsUpdate = true; onLate?.(t); }
  else { e.users.push(t); if (onLate) e.then.push(() => onLate(t)); }
  return t;
}

// A Poly Haven texture set; `maps` picks diffuse (d), normal (n) and roughness (r).
// Without 'r', `roughness` stands in for the map: for a set whose roughness barely varies, one number looks the same
// and saves every pixel of that surface a texture read (and the graphics card a few megabytes).
export function pbr(id, repeat, maps = 'dnr', normalScale = 1, roughness = 1) {
  const p = `textures/${id}/${id}_`, o = { roughness: maps.includes('r') ? 1 : roughness };
  if (maps.includes('d')) o.map = tex(`${p}diff_${RES}.webp`, repeat, true);
  if (maps.includes('n')) { o.normalMap = tex(`${p}nor_gl_${RES}.webp`, repeat); o.normalScale = new THREE.Vector2(normalScale, normalScale); }
  if (maps.includes('r')) o.roughnessMap = tex(`${p}rough_${RES}.webp`, repeat);
  return o;
}
