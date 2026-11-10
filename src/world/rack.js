// The open clothing rack on the west wall (opens CLO3D Garments), with garments that swing when picked.
import * as THREE from 'three';
import P from '../content.js';
import { C, HQ } from '../config.js';
import { rnd } from '../util.js';
import { part, rod3, addCollider } from '../core/build.js';
import { mat, brass, LINEN } from '../core/materials.js';
import { scene } from '../core/renderer.js';
import { makeInteractive } from '../systems/interactives.js';

export const hangers = [];
export const rackSway = { t: 99 };   // seconds since the garments were last touched

// A simple dress shape, also the stand-in in the 3D viewer until a CLO3D model is added
export function dressGeometry(height = 1.1) {
  const pts = [[0.3, 0], [0.26, 0.18], [0.2, 0.42], [0.13, 0.58], [0.115, 0.64], [0.14, 0.74], [0.15, 0.84], [0.12, 0.92], [0.07, 0.97], [0.0, 0.98]]
    .map(([r, y]) => new THREE.Vector2(r * height, y * height));
  const geo = new THREE.LatheGeometry(pts, 32);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {   // soft pleats toward the hem
    const x = pos.getX(i), y = pos.getY(i), zz = pos.getZ(i);
    const k = 1 + 0.07 * Math.sin(Math.atan2(zz, x) * 7) * Math.pow(1 - y / height, 2);
    pos.setX(i, x * k); pos.setZ(i, zz * k);
  }
  geo.computeVertexNormals();
  return geo;
}

// The garments swing a little on their hangers when picked, then settle
export function updateRack(dt) {
  rackSway.t += dt;
  hangers.forEach((hg, i) => { hg.rotation.z = 0.05 * Math.sin(rackSway.t * 4.2 + i * 0.9) * Math.exp(-rackSway.t * 1.2); });
}
export const rackMoving = () => Math.exp(-rackSway.t * 1.2) > 0.01;

export function buildRack() {
  const rack = new THREE.Group();
  scene.add(rack);
  const RZ0 = 0.9, RZ1 = 2.2, RX = -2.62, RAIL_Y = 1.7;
  const rackBrass = brass(), hangerWood = mat(C.wood, { roughness: HQ ? 0.44 : 0.6 });   // with the oak: its roughness × 0.6, as when it had a map
  for (const z of [RZ0 + 0.03, RZ1 - 0.03]) {
    part(rack, C.woodLight, RX - 0.22, RX + 0.22, 0, 0.04, z - 0.025, z + 0.025, 0.01);
    rod3([RX, 0.04, z], [RX, RAIL_Y, z], 0.012, rackBrass, rack);
  }
  rod3([RX, RAIL_Y, RZ0 + 0.01], [RX, RAIL_Y, RZ1 - 0.01], 0.011, rackBrass, rack);
  part(rack, C.woodLight, RX - 0.19, RX + 0.19, 0.18, 0.21, RZ0 + 0.06, RZ1 - 0.06, 0.008);
  // folded fabric on the shelf
  [[1.13, C.blue], [1.13, C.cream], [1.47, C.sage], [1.85, C.blush], [1.85, C.pink], [1.85, C.cream]].reduce((y, [z, col], i, a) => {
    const y0 = i && a[i - 1][0] === z ? y : 0.21;
    part(rack, mat(col, LINEN), RX - 0.15, RX + 0.15, y0, y0 + 0.045, z - 0.13, z + 0.13, 0.015);
    return y0 + 0.045;
  }, 0.21);
  // A garment hanging from its shoulders: a soft, flattened tube, pinched to a seam where the hanger holds it,
  // with sloping shoulders, folds that deepen toward the hem and a slightly uneven hem. `widths` is [t, half-width] down its length.
  function hangingGarment(len, widths, depth, ph) {
    const geo = new THREE.CylinderGeometry(1, 1, len, 40, 30, true);
    geo.translate(0, -len / 2, 0);   // top edge at y = 0
    const width = t => {
      for (let i = 1; i < widths.length; i++) if (t <= widths[i][0]) {
        const [t0, w0] = widths[i - 1], [t1, w1] = widths[i];
        return w0 + (w1 - w0) * (t - t0) / (t1 - t0);
      }
      return widths.at(-1)[1];
    };
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      // clamped: the top row can come out a hair above 0 after translate(), and t ** 1.3 of a negative t is NaN
      const t = Math.max(0, -pos.getY(i) / len), a = Math.atan2(pos.getZ(i), pos.getX(i));
      const w = width(t), d = depth * Math.min(1, 0.3 + t * 5);
      const x = Math.cos(a) * w;
      let z = Math.sin(a) * d;
      z += Math.sign(z) * 0.012 * t ** 1.3 * (1 + Math.sin(x * 38 + ph));   // folds, always bulging outward
      const y = -t * len - 0.035 * (x / w) ** 2 * Math.max(0, 1 - t * 4) + 0.008 * t * t * Math.sin(a * 6 + ph);
      pos.setXYZ(i, x * (1 + 0.04 * t * Math.sin(a * 3 + ph)), y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }
  const DRESS = [[0, 0.17], [0.15, 0.17], [0.38, 0.14], [1, 0.25]];
  const SHIRT = [[0, 0.19], [0.2, 0.19], [1, 0.18]];
  const COAT = [[0, 0.2], [0.2, 0.21], [1, 0.23]];
  const gColor = i => P.garments?.[i]?.color || ['#e8b9b5', '#b7cbb0', '#c2d6e2'][i];
  // side by side as on a real rail, each turned a touch differently; the first three take their colours from content.js
  const GARMENTS = [
    { len: 1.0, w: DRESS, d: 0.05, col: gColor(0) },
    { len: 0.68, w: SHIRT, d: 0.045, sleeve: 0.56, col: '#f6efe4' },
    { len: 0.82, w: COAT, d: 0.07, sleeve: 0.6, col: '#cdb79e' },
    { len: 0.9, w: DRESS, d: 0.045, col: gColor(1) },
    { len: 0.64, w: SHIRT, d: 0.04, sleeve: 0.22, col: '#ffffff' },
    { len: 1.05, w: COAT, d: 0.075, sleeve: 0.64, col: '#8692ad' },
    { len: 0.7, w: SHIRT, d: 0.045, sleeve: 0.55, col: gColor(2) },
  ];
  GARMENTS.forEach((g, i) => {
    const hg = new THREE.Group();   // pivots on the rail, so it can swing
    hg.position.set(RX + (rnd() - 0.5) * 0.03, RAIL_Y, RZ0 + 0.13 + i * (RZ1 - RZ0 - 0.26) / (GARMENTS.length - 1));
    hg.rotation.y = (rnd() - 0.5) * 0.14;
    rack.add(hg);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.003, 6, 20, Math.PI + 0.5), rackBrass);
    hook.rotation.z = -0.5;
    rod3([-0.02, -0.09, 0], [-0.02, 0, 0], 0.003, rackBrass, hg);
    hg.add(hook);
    for (const s of [-1, 1]) rod3([0, -0.09, 0], [s * 0.12, -0.13, 0], 0.007, hangerWood, hg);
    const cloth = mat(new THREE.Color(g.col), { ...LINEN, side: THREE.DoubleSide });
    const body = new THREE.Mesh(hangingGarment(g.len, g.w, g.d, rnd() * 6), cloth);
    body.position.y = -0.085;
    hg.add(body);
    if (g.sleeve) for (const s of [-1, 1]) {   // sleeves hang loose down the sides
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, g.sleeve, 14, 1, true), cloth);
      sl.position.set(s * (g.w[0][1] - 0.012), -0.12 - g.sleeve / 2, 0);
      sl.rotation.z = s * 0.05;
      sl.scale.z = 0.8;
      hg.add(sl);
    }
    hg.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    hangers.push(hg);
  });
  addCollider(-3, -2.36, RZ0 - 0.05, RZ1 + 0.05);
  makeInteractive(rack, 'garments', 'CLO3D Garments', [RX, 2.0, 1.55], [-0.95, 1.55, RX, 1.15, 1.55]);
}
