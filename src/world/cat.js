// The studio cat (a tuxedo, see TuxedoCat.js) and its bed beside the work desk.
// The cat wanders the free floor by itself, keeps out of the visitor's way, and hops and looks at you when clicked.
// It loads on the side (lateManager), so "Step inside" never waits for it.
import * as THREE from 'three';
import { C, X, Z, HQ } from '../config.js';
import { addCollider, colliders } from '../core/build.js';
import { mat, envIntensity, LINEN } from '../core/materials.js';
import { lateManager } from '../core/loaders.js';
import { frame, invalidate } from '../core/frame.js';
import { renderer, scene, camera } from '../core/renderer.js';

export const BED = { x: -2.58, z: -2.18, r: 0.28 };   // in the corner between the work desk and the west wall
const ANIM_FPS = 30;   // the cat alone is drawn at 30 frames a second: smooth enough for a cat, half the work

let cat = null, due = 0, wantFrame = false;
const sphere = new THREE.Sphere(), frustum = new THREE.Frustum(), proj = new THREE.Matrix4();
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), visitor = new THREE.Vector3();

// A round donut bed tucked in the corner beside the desk: a plump quilted bolster in blush, lower at the front where
// the cat steps in, round a cream cushion with a hollow in the middle. Both matte: no shine, only the fabric weave.
const FELT = () => ({ roughness: 1, ...(LINEN.normalMap ? { normalMap: LINEN.normalMap, normalScale: new THREE.Vector2(0.45, 0.45) } : {}) });
function buildBed() {
  const g = new THREE.Group();
  g.position.set(BED.x, 0, BED.z);
  const FRONT = Math.atan2(0.4, 1);   // the low side faces the room (east, a little south)
  const RING = BED.r - 0.075, TUBE = 0.068, v = new THREE.Vector3();

  // bolster: a torus laid flat, then shaped. Eight puffs with creases between them, a flat underside on the floor,
  // a fuller outer side, and the height falling away toward the front opening.
  const bolster = new THREE.TorusGeometry(RING, TUBE, 20, 96).rotateX(-Math.PI / 2);
  const pos = bolster.attributes.position, uv = bolster.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const th = Math.atan2(v.z, v.x), cx = Math.cos(th), cz = Math.sin(th);
    let r = v.x * cx + v.z * cz - RING, y = v.y;            // offset from the tube's centre line: out from the ring, up
    const front = (1 + Math.cos(th - FRONT)) / 2;            // 1 at the opening, 0 at the back
    const puff = 1 + 0.07 * Math.cos(th * 8) ** 2 - 0.035;   // soft bulges, creased where the stitching is
    y *= (1.25 - 0.5 * front ** 2) * puff;
    if (y < 0) y *= 0.35;                                    // it sits on the floor, it doesn't roll on it
    r *= puff * (r > 0 ? 1.12 : 0.95);
    pos.setXYZ(i, cx * (RING + r), y, cz * (RING + r));
    uv.setXY(i, uv.getX(i) * 9, uv.getY(i) * 2);             // the weave the right size all round
  }
  bolster.computeBoundingBox();
  bolster.translate(0, -bolster.boundingBox.min.y, 0);
  bolster.computeVertexNormals();
  const rim = new THREE.Mesh(bolster, mat(C.blush, FELT()));

  // cushion: a flattened ball tucked under the bolster, flat below, with the hollow a cat leaves on top
  const cushionGeo = new THREE.SphereGeometry(RING - 0.01, 48, 18);
  const cp = cushionGeo.attributes.position, cu = cushionGeo.attributes.uv;
  for (let i = 0; i < cp.count; i++) {
    v.fromBufferAttribute(cp, i);
    const k = Math.min(1, Math.hypot(v.x, v.z) / (RING - 0.01));
    v.y *= v.y > 0 ? 0.24 * (0.45 + 0.55 * k * k) : 0.06;
    cp.setXYZ(i, v.x, v.y, v.z);
    cu.setXY(i, cu.getX(i) * 4, cu.getY(i) * 2);
  }
  cushionGeo.computeVertexNormals();
  const cushion = new THREE.Mesh(cushionGeo, mat(C.cream, FELT()));
  cushion.position.y = 0.012;

  for (const m of [rim, cushion]) { m.castShadow = m.receiveShadow = true; g.add(m); }
  scene.add(g);
  addCollider(BED.x - BED.r, BED.x + BED.r, BED.z - BED.r, BED.z + BED.r);   // the visitor walks round it; gives it a soft floor shadow
}

export function buildCat() {
  buildBed();
  if (!HQ) return;   // as a plain file (file://) the model can't load
  const rect = c => ({ minX: c.x0, maxX: c.x1, minZ: c.z0, maxZ: c.z1 });
  const obstacles = colliders.filter(c => !c.hanging).map(rect);   // furniture, the bed included
  lateManager.itemStart('cat');
  import('./TuxedoCat.js')
    .then(({ TuxedoCat }) => TuxedoCat.load({
      url: 'assets/models/tuxedo-cat/tuxedo-cat.glb',
      manager: lateManager,
      scale: 0.5,                                        // real size: the room is in metres
      area: { minX: -X, maxX: X, minZ: -Z, maxZ: Z },
      home: { minX: -1.2, maxX: 1.9, minZ: -1.75, maxZ: 1.9 },   // the open floor around the rug, mostly in view
      obstacles,
      avoid: () => visitor.set(camera.position.x, 0, camera.position.z),   // it steps out of the visitor's way
      start: { x: -0.6, z: -1.2, yaw: 0.2 },   // on the open floor in front of the desk, facing the door you come in by
      animationFps: ANIM_FPS,
    }))
    .then(c => {
      cat = c;
      c.object.traverse(o => {
        o.userData.noPick = true;   // the room's picking skips it; clicks on it are tested in petCat()
        if (o.material?.isMeshStandardMaterial) o.material.envMapIntensity = envIntensity();
        o.castShadow = false;       // it moves: the baked sun shadows must not include it (it has its own soft blob)
      });
      scene.add(c.object);
      // still loading: the studio's own shader pass (main.js ready()) includes it. Already open: build its shaders first,
      // off the main thread where the browser can, so it doesn't stutter into view
      if (frame.hold) return;
      c.object.visible = false;
      return renderer.compileAsync(c.object, camera, scene).catch(() => {}).finally(() => { c.object.visible = true; invalidate(); });
    })
    .catch(err => console.warn('cat did not load', err))
    .finally(() => lateManager.itemEnd('cat'));
}

// Every frame: the cat thinks and walks even off screen (cheap); it asks for a new picture only while you can see it
export function updateCat(dt) {
  wantFrame = false;
  if (!cat || !cat.object.visible) return;
  cat.update(dt, camera);
  sphere.center.set(cat.position.x, 0.22, cat.position.z);
  sphere.radius = 0.5;
  proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(proj);
  if (!frustum.intersectsSphere(sphere)) { due = 0; return; }
  due += dt;
  if (due >= 1 / ANIM_FPS - 1e-3) { due = 0; wantFrame = true; }
}
export const catWantsFrame = () => wantFrame;

// Is the cat under this pointer position? (window coordinates, like the rest of the picking)
export function catAt(e) {
  if (!cat || !cat.object.visible) return false;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return cat.hitTest(ray);
}
// Clicked or tapped: a little hop, then it looks at you
export function petCat(e) {
  if (!catAt(e)) return false;
  cat.react();
  invalidate();
  return true;
}
