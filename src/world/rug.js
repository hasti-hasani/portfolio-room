// The Persian rug: a photographed Kashan carpet, or a drawn one when there are no photo textures.
import * as THREE from 'three';
import { C, HQ, RES, isTouch } from '../config.js';
import { canvasTex } from '../core/build.js';
import { mat } from '../core/materials.js';
import { tex } from '../core/loaders.js';
import { scene } from '../core/renderer.js';

export const RUG = { x: 1.25, z: 0.2, w: 2.8, d: 2.0 };   // the edge near the couch runs just under its front legs
export const onRug = p => Math.abs(p.x - RUG.x) < RUG.d / 2 && Math.abs(p.z - RUG.z) < RUG.w / 2;

export function buildRug() {
  // drawn only when there are no photo textures
  const drawRug = (g, w, h) => {
    const navy = '#3f4d72', cream = '#f5e8d6', field = '#c66a5f', teal = '#6fb3ad', pink = '#efc2b6', gold = '#dcb36f';
    const rosette = (x, y, r, petal, center) => {
      g.fillStyle = petal;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.42, r * 0.2, a, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = center; g.beginPath(); g.arc(x, y, r * 0.3, 0, Math.PI * 2); g.fill();
    };
    const star = (x, y, ro, ri, n, color, sx = 1) => {
      g.fillStyle = color; g.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = i * Math.PI / n - Math.PI / 2, r = i % 2 ? ri : ro;
        g.lineTo(x + Math.cos(a) * r * sx, y + Math.sin(a) * r);
      }
      g.closePath(); g.fill();
    };
    // borders
    g.fillStyle = navy; g.fillRect(0, 0, w, h);
    g.fillStyle = cream; g.fillRect(14, 14, w - 28, h - 28);
    g.fillStyle = navy; g.fillRect(24, 24, w - 48, h - 48);
    const b = 74;
    for (let x = 24 + b / 2; x < w - 24; x += 62) { rosette(x, 24 + b / 2, 22, pink, gold); rosette(x, h - 24 - b / 2, 22, pink, gold); }
    for (let y = 24 + b / 2 + 62; y < h - 24 - b / 2; y += 62) { rosette(24 + b / 2, y, 22, pink, gold); rosette(w - 24 - b / 2, y, 22, pink, gold); }
    g.fillStyle = cream; g.fillRect(24 + b, 24 + b, w - 48 - 2 * b, h - 48 - 2 * b);
    const fx = 24 + b + 8, fy = 24 + b + 8, fw = w - 2 * fx, fh = h - 2 * fy;
    g.fillStyle = field; g.fillRect(fx, fy, fw, fh);
    // field motifs
    g.save(); g.beginPath(); g.rect(fx, fy, fw, fh); g.clip();
    for (let y = fy + 30; y < fy + fh; y += 58) {
      for (let x = fx + 30 + ((y / 58) % 2) * 29; x < fx + fw; x += 58) {
        g.fillStyle = 'rgba(245, 232, 214, .35)';
        g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 7, y); g.lineTo(x, y + 9); g.lineTo(x - 7, y); g.fill();
      }
    }
    // corner quarter-medallions
    for (const [cx, cy] of [[fx, fy], [fx + fw, fy], [fx, fy + fh], [fx + fw, fy + fh]]) {
      star(cx, cy, 110, 80, 12, navy); star(cx, cy, 84, 62, 12, teal); star(cx, cy, 52, 38, 8, cream);
    }
    g.restore();
    // central medallion
    const cx = w / 2, cy = h / 2;
    star(cx, cy, 170, 130, 16, navy, 1.35);
    star(cx, cy, 140, 108, 16, cream, 1.35);
    star(cx, cy, 112, 84, 16, teal, 1.35);
    star(cx, cy, 78, 58, 12, pink, 1.3);
    rosette(cx, cy, 44, field, gold);
    // pendants above and below the medallion
    for (const dy of [-1, 1]) { star(cx, cy + dy * 200, 30, 20, 8, navy); rosette(cx, cy + dy * 200, 16, cream, gold); }
  };
  // A 16th-century silk Kashan carpet photographed by The Met (public domain), with a woven-pile bump on top
  const rugMat = HQ
    ? mat(0xfff6ee, { map: tex(`rug/silk_kashan_carpet_met${isTouch ? '_1024' : ''}.webp`, null, true), normalMap: tex(`textures/rough_linen/rough_linen_nor_gl_${RES}.webp`, [5, 3.5]), roughness: 1 })
    : mat(0xffffff, { map: canvasTex(1024, 700, drawRug), roughness: 1 });
  // The rug lies with its long side running toward the door (RUG.w is along z)
  const rugGroup = new THREE.Group();
  rugGroup.position.set(RUG.x, 0, RUG.z);
  rugGroup.rotation.y = Math.PI / 2;
  scene.add(rugGroup);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(RUG.w, RUG.d), rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.006;
  rug.receiveShadow = true;
  rug.userData.walkable = true;
  rugGroup.add(rug);
  for (const s of [-1, 1]) {
    const fringe = new THREE.Mesh(new THREE.PlaneGeometry(0.07, RUG.d - 0.1), mat(C.cream, { roughness: 1 }));
    fringe.rotation.x = -Math.PI / 2;
    fringe.position.set(s * (RUG.w / 2 + 0.035), 0.005, 0);
    fringe.receiveShadow = true;
    fringe.userData.walkable = true;
    rugGroup.add(fringe);
  }
}
