// The lounge corner: couch and cushions, glass coffee table, side table with a book, and the standing lamp.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { C } from '../config.js';
import { part, canvasTex, addCollider, textTextures } from '../core/build.js';
import { mat, brass, velvet, LINEN } from '../core/materials.js';
import { scene } from '../core/renderer.js';
import { RUG } from './rug.js';

export let floorShade, floorLight;

export function buildLounge() {
  function pillow(w, h, d, material, x, y, z, rz = 0, ry = 0) {
    const sq = (c, e) => Math.sign(c) * Math.abs(c) ** e;
    const outline = a => {   // a smooth rounded rectangle (superellipse), point at angle a
      const c = Math.cos(a), s = Math.sin(a), k = (c ** 4 + s ** 4) ** -0.25;
      return [w / 2 * c * k, d / 2 * s * k];
    };
    // start from a subdivided cube rounded into a sphere: unlike a UV sphere it has no pole to pinch in the middle
    let geo = new THREE.BoxGeometry(2, 2, 2, 28, 28, 28);
    geo.deleteAttribute('normal');
    geo.deleteAttribute('uv');
    geo = mergeVertices(geo);
    const pos = geo.attributes.position, uv = new Float32Array(pos.count * 2), n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      n.fromBufferAttribute(pos, i).normalize();
      const lat = Math.asin(n.y), lon = Math.atan2(n.z, n.x);
      const ring = Math.abs(Math.cos(lat)) ** 1.4;
      const [ox, oz] = outline(lon), px = ox * ring, pz = oz * ring;
      const r2 = (px / (w / 2)) ** 2 + (pz / (d / 2)) ** 2;
      const py = h / 2 * sq(Math.sin(lat), 1.4) * (1 - 0.22 * Math.exp(-r2 / 0.12));
      pos.setXYZ(i, px, py, pz);
      uv[i * 2] = px * 2; uv[i * 2 + 1] = pz * 2;   // fabric weave projected from above
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const pts = [];
    for (let i = 0; i < 120; i++) { const [ox, oz] = outline(i / 120 * Math.PI * 2); pts.push(new THREE.Vector3(ox, 0, oz)); }
    const piping = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 200, 0.006, 6, true);
    const g = new THREE.Group();
    for (const m of [new THREE.Mesh(geo, material), new THREE.Mesh(piping, material)]) { m.castShadow = m.receiveShadow = true; g.add(m); }
    g.position.set(x, y, z);
    g.rotation.set(0, ry, rz);
    scene.add(g);
    return g;
  }
  // A three-seat couch against the east wall, under the still life, facing the room: rose linen on short oak legs
  const couchMat = mat(0xe7c2ba, LINEN);
  const CZ0 = -0.9, CZ1 = 1.3, ARM = 0.18, SEAT = (CZ1 - CZ0 - 2 * ARM) / 3;   // ends, arm width, width of one seat
  for (const lx of [2.17, 2.92]) for (const lz of [CZ0 + 0.05, (CZ0 + CZ1) / 2, CZ1 - 0.05]) part(scene, C.wood, lx - 0.025, lx + 0.025, 0, 0.1, lz - 0.025, lz + 0.025, 0.008);
  part(scene, couchMat, 2.12, 2.97, 0.1, 0.3, CZ0, CZ1, 0.04);                    // base
  part(scene, couchMat, 2.74, 2.97, 0.28, 0.86, CZ0, CZ1, 0.07);                  // back
  for (const [z0, z1] of [[CZ0, CZ0 + ARM], [CZ1 - ARM, CZ1]]) part(scene, couchMat, 2.12, 2.97, 0.28, 0.62, z0, z1, 0.06);   // arms
  for (let i = 0; i < 3; i++) {
    const z0 = CZ0 + ARM + i * SEAT;
    part(scene, couchMat, 2.14, 2.76, 0.3, 0.45, z0 + 0.005, z0 + SEAT - 0.005, 0.05);   // seat cushion
    pillow(0.5, 0.17, SEAT - 0.04, couchMat, 2.65, 0.69, z0 + SEAT / 2, 1.32, (i - 1) * 0.03);   // back cushion, leaning on the back
  }
  pillow(0.36, 0.13, 0.36, velvet(C.teal), 2.52, 0.64, CZ1 - ARM - 0.2, 1.1, 0.25);   // velvet cushion
  pillow(0.3, 0.12, 0.34, mat(C.cream, LINEN), 2.53, 0.62, CZ0 + ARM + 0.19, 1.05, -0.2);   // small cream cushion
  addCollider(2.05, 3, CZ0 - 0.05, CZ1 + 0.05);

  // Coffee table in front of the couch: a rounded glass top on an oak frame, with a lower oak shelf for magazines.
  // The glass is only lightly tinted, so the rug shows through it.
  const CT = { x: RUG.x, z: RUG.z, w: 0.55, l: 1.1, h: 0.42 };   // centre, width (x), length (along the couch), height
  {
    const ix = CT.w / 2 - 0.05, iz = CT.l / 2 - 0.05;   // the frame sits a little inside the glass
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(scene, C.wood, CT.x + sx * ix - 0.02, CT.x + sx * ix + 0.02, 0, CT.h - 0.014, CT.z + sz * iz - 0.02, CT.z + sz * iz + 0.02, 0.006);
    for (const sx of [-1, 1]) part(scene, C.wood, CT.x + sx * ix - 0.015, CT.x + sx * ix + 0.015, CT.h - 0.06, CT.h - 0.014, CT.z - iz, CT.z + iz, 0.004);   // rails under the glass
    for (const sz of [-1, 1]) part(scene, C.wood, CT.x - ix, CT.x + ix, CT.h - 0.06, CT.h - 0.014, CT.z + sz * iz - 0.015, CT.z + sz * iz + 0.015, 0.004);
    part(scene, C.woodLight, CT.x - ix, CT.x + ix, 0.11, 0.13, CT.z - iz, CT.z + iz, 0.006);   // lower shelf
    const shape = new THREE.Shape(), rw = CT.w / 2, rl = CT.l / 2, rr = 0.09;
    shape.moveTo(-rw + rr, -rl);
    shape.lineTo(rw - rr, -rl); shape.quadraticCurveTo(rw, -rl, rw, -rl + rr);
    shape.lineTo(rw, rl - rr); shape.quadraticCurveTo(rw, rl, rw - rr, rl);
    shape.lineTo(-rw + rr, rl); shape.quadraticCurveTo(-rw, rl, -rw, rl - rr);
    shape.lineTo(-rw, -rl + rr); shape.quadraticCurveTo(-rw, -rl, -rw + rr, -rl);
    const glassTop = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 12 }),
      // plain standard material: a clearcoat layer is invisible on glass this faint and costs a second lighting pass
      new THREE.MeshStandardMaterial({ color: 0xe4f2ef, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    glassTop.rotation.x = -Math.PI / 2;   // the shape's y becomes −z, its depth rises up
    glassTop.position.set(CT.x, CT.h - 0.009, CT.z);   // rests 3 mm above the rails: level with them, their tops flickered through the glass
    glassTop.renderOrder = 1;
    scene.add(glassTop);
  }
  addCollider(CT.x - CT.w / 2, CT.x + CT.w / 2, CT.z - CT.l / 2, CT.z + CT.l / 2);
  // magazines on the shelf, a mug on the glass
  [[0x2f3b5c, 0.2], [0xf3d6cf, -0.08], [0xb7cbb0, 0.12]].forEach(([col, ry], i) =>
    part(scene, mat(col, { roughness: 0.6 }), CT.x - 0.15, CT.x + 0.13, 0.13 + i * 0.008, 0.138 + i * 0.008, CT.z - 0.32, CT.z - 0.1, 0.002).rotation.y = ry);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 24, 1, true), mat(C.white, { roughness: 0.35, side: THREE.DoubleSide }));
  mug.position.set(CT.x + 0.05, CT.h + 0.048, CT.z - 0.3);
  const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 8, 16, Math.PI), mug.material);
  mugHandle.rotation.set(0, -Math.PI / 2, -Math.PI / 2);
  mugHandle.position.set(mug.position.x, mug.position.y, mug.position.z + 0.04);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.037, 24), mat(0x5a3a28, { roughness: 0.3 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.set(mug.position.x, CT.h + 0.078, mug.position.z);
  for (const m of [mug, mugHandle, coffee]) { m.castShadow = true; scene.add(m); }

  part(scene, C.woodLight, 2.58, 2.98, 0, 0.48, -1.4, -1.0, 0.02);
  part(scene, C.wood, 2.575, 2.58, 0.28, 0.42, -1.35, -1.05, 0);
  addCollider(2.55, 3, -1.4, -1.0);

  // "Don't Make Me Think" (Steve Krug) lying on the side table, cover up and readable from the room
  const coverTex = canvasTex(360, 460, (g, w, h) => {
    g.fillStyle = '#f7f4ec'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8362d'; g.fillRect(0, 0, w, 16);
    g.fillStyle = '#26232a'; g.font = 'bold 46px "DM Sans", sans-serif';
    g.fillText('Don’t Make', 28, 96); g.fillText('Me Think', 28, 148);
    g.fillStyle = '#c8362d'; g.font = 'italic 30px "DM Serif Display", Georgia, serif'; g.fillText('Revisited', 30, 192);
    g.fillStyle = '#857b86'; g.font = '17px "DM Sans", sans-serif';
    g.fillText('A Common Sense Approach', 30, 236); g.fillText('to Web Usability', 30, 258);
    g.fillStyle = '#26232a'; g.font = '24px "DM Sans", sans-serif'; g.fillText('Steve Krug', 28, h - 36);
  });
  textTextures.push(coverTex);
  const pages = mat(C.cream, { roughness: 1 }), bookCover = mat(0xf7f4ec, { roughness: 0.7 });
  const nightBook = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.014, 0.23),
    [pages, bookCover, mat(0xffffff, { map: coverTex, roughness: 0.7 }), bookCover, pages, pages]);   // +x, −x (spine), top, bottom, ±z
  nightBook.position.set(2.77, 0.487, -1.2);
  nightBook.rotation.y = -Math.PI / 2 + 0.25;   // the cover's top edge points away from the room
  nightBook.castShadow = nightBook.receiveShadow = true;
  scene.add(nightBook);

  // Standing lamp on the right of the couch — the warm light of the night mood
  const FL = { x: 2.6, z: 1.6 };
  const flBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.025, 32), brass());
  flBase.position.set(FL.x, 0.0125, FL.z);
  const flStem = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1.42, 10), brass());
  flStem.position.set(FL.x, 0.72, FL.z);
  floorShade = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 0.28, 40, 1, true),
    mat(C.cream, { ...LINEN, side: THREE.DoubleSide, emissive: 0xffc890, emissiveIntensity: 0 }));
  floorShade.position.set(FL.x, 1.5, FL.z);
  [flBase, flStem, floorShade].forEach(m => { m.castShadow = m.receiveShadow = true; scene.add(m); });
  floorLight = new THREE.PointLight(0xffbf80, 0, 6, 2);   // off by day; no shadows, so it stays cheap
  floorLight.position.set(FL.x, 1.45, FL.z);
  scene.add(floorLight);
  addCollider(FL.x - 0.16, FL.x + 0.16, FL.z - 0.16, FL.z + 0.16);
}
