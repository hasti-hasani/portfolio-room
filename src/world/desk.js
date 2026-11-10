// The desk, the ergonomic chair and the desk lamp.
import * as THREE from 'three';
import { C, HQ } from '../config.js';
import { part, rod3, canvasTex, addCollider } from '../core/build.js';
import { mat, brass, LINEN } from '../core/materials.js';
import { scene } from '../core/renderer.js';

export let lampLight, shade;

export function buildDesk() {
  part(scene, C.woodLight, -2.2, -0.8, 0.72, 0.76, -2.48, -1.82, 0.01);
  for (const [lx, lz] of [[-2.15, -2.43], [-0.85, -2.43], [-2.15, -1.87], [-0.85, -1.87]]) part(scene, C.wood, lx - 0.02, lx + 0.02, 0, 0.72, lz - 0.02, lz + 0.02, 0.008);
  addCollider(-2.2, -0.8, -2.5, -1.8);

  // An ergonomic desk chair: a curved mesh back with lumbar support and a headrest, padded seat, armrests,
  // a gas lift and a five-star base on castors. It faces the desk (−z), turned a touch toward the room.
  const deskChair = new THREE.Group();
  deskChair.position.set(-1.5, 0, -1.5);
  deskChair.rotation.y = 0.12;
  scene.add(deskChair);
  {
    const frameMat = mat(C.white, { roughness: 0.35 }), alu = mat(0xd8d6d4, { metalness: HQ ? 0.9 : 0.5, roughness: 0.25 });
    const darkMat = mat(0x4a4450, { roughness: 0.5 }), padMat = mat(0xecbcb8, { ...LINEN });
    const meshTex = canvasTex(64, 64, (g, w, h) => {   // a fine woven mesh
      g.fillStyle = '#ecbcb8'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(150, 80, 80, .3)';
      for (let i = 0; i < w; i += 4) { g.fillRect(i, 0, 1.5, h); g.fillRect(0, i, w, 1.5); }
    }, [10, 12]);
    const meshMat = mat(0xffffff, { map: meshTex, roughness: 0.8, side: THREE.DoubleSide });
    // base: five spokes with castors, then the gas lift
    for (let k = 0; k < 5; k++) {
      const a = k * Math.PI * 2 / 5, ex = Math.cos(a) * 0.3, ez = Math.sin(a) * 0.3;
      rod3([0, 0.1, 0], [ex, 0.075, ez], 0.018, alu, deskChair);
      const castor = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.024, 16), darkMat);
      castor.rotation.set(Math.PI / 2, -a, 0, 'YXZ');   // axle across the spoke
      castor.position.set(ex, 0.03, ez);
      castor.castShadow = true;
      deskChair.add(castor);
      rod3([ex, 0.075, ez], [ex, 0.045, ez], 0.008, darkMat, deskChair);
    }
    rod3([0, 0.08, 0], [0, 0.2, 0], 0.035, darkMat, deskChair);
    rod3([0, 0.2, 0], [0, 0.42, 0], 0.016, alu, deskChair);
    part(deskChair, darkMat, -0.12, 0.12, 0.41, 0.44, -0.12, 0.12, 0.01);   // tilt mechanism
    // seat: a padded cushion, softly rounded
    part(deskChair, frameMat, -0.25, 0.25, 0.44, 0.465, -0.24, 0.24, 0.012);
    part(deskChair, padMat, -0.245, 0.245, 0.46, 0.52, -0.235, 0.235, 0.03);
    // back: a panel curved round the sitter, bulging forward at the small of the back, leaning back a little
    const BW = 0.46, BH = 0.55, B0 = 0.6;   // width, height, bottom edge height — low enough not to hide the screen
    const backPoint = (u, v) => {   // u, v in −1…1 → point on the back
      const y = B0 + (v + 1) / 2 * BH;
      const z = 0.25 + 0.06 * u * u - 0.035 * Math.exp(-(((v + 0.45) / 0.35) ** 2)) + (y - B0) * 0.14;
      return new THREE.Vector3(u * BW / 2, y, z);
    };
    const panel = (fn, segs, material) => {
      const geo = new THREE.PlaneGeometry(2, 2, segs, segs), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, ...fn(pos.getX(i), pos.getY(i)).toArray());
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, material);
      m.castShadow = m.receiveShadow = true;
      deskChair.add(m);
    };
    const edge = (fn, r) => {   // a frame tube round a panel's border
      const pts = [];
      for (let i = 0; i < 64; i++) {
        const t = i / 64 * 4, s = t % 1 * 2 - 1;
        pts.push(fn(...[[s, -1], [1, s], [-s, 1], [-1, -s]][Math.floor(t)]));
      }
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 128, r, 8, true), frameMat);
      m.castShadow = true;
      deskChair.add(m);
    };
    panel(backPoint, 20, meshMat);
    edge(backPoint, 0.013);
    // lumbar pad across the lower back
    panel((u, v) => backPoint(u * 0.8, -0.45 + v * 0.12).add(new THREE.Vector3(0, 0, -0.012)), 12, frameMat);
    // headrest above the back
    const headPoint = (u, v) => {
      const y = B0 + BH + 0.08 + (v + 1) / 2 * 0.13;
      return new THREE.Vector3(u * 0.13, y, 0.25 + 0.03 * u * u + (y - B0) * 0.14);
    };
    panel(headPoint, 10, padMat);
    edge(headPoint, 0.01);
    rod3([0, B0 + BH - 0.02, 0.25 + BH * 0.14 + 0.012], [0, B0 + BH + 0.09, 0.25 + (BH + 0.09) * 0.14 + 0.012], 0.012, frameMat, deskChair);
    // the spine joining seat and back
    rod3([0, 0.44, 0.1], [0, 0.45, 0.27], 0.02, frameMat, deskChair);
    rod3([0, 0.45, 0.27], [0, B0 + 0.12, 0.27 + 0.018], 0.02, frameMat, deskChair);
    // armrests: a post from under the seat, a soft pad on top
    for (const sx of [-1, 1]) {
      rod3([sx * 0.2, 0.44, 0.05], [sx * 0.25, 0.47, 0.05], 0.014, frameMat, deskChair);
      rod3([sx * 0.25, 0.47, 0.05], [sx * 0.25, 0.67, 0.03], 0.014, frameMat, deskChair);
      part(deskChair, darkMat, sx * 0.25 - 0.04, sx * 0.25 + 0.04, 0.665, 0.69, -0.12, 0.12, 0.012);
    }
  }
  addCollider(-1.8, -1.2, -1.8, -1.2);

  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.025, 24), mat(C.cream));
  lampBase.position.set(-2.0, 0.772, -2.28);
  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.34, 8), brass());
  lampStem.position.set(-2.0, 0.95, -2.28);
  shade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.13, 0.15, 28, 1, true),
    mat(C.pink, { side: THREE.DoubleSide, emissive: 0xffd2b0, emissiveIntensity: 0.35 }));
  shade.position.set(-2.0, 1.12, -2.28);
  [lampBase, lampStem, shade].forEach(m => { m.castShadow = true; scene.add(m); });
  lampLight = new THREE.PointLight(0xffd6a8, 1.6, 3, 2);
  lampLight.position.set(-2.0, 1.05, -2.28);
  scene.add(lampLight);
}
