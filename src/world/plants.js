// Plants: the big one by the window, a small one on the sill, a snake plant on the bookshelf and a hanging pothos.
import * as THREE from 'three';
import { C, H, Z, WIN, HQ, isTouch } from '../config.js';
import { rnd } from '../util.js';
import { addCollider } from '../core/build.js';
import { mat, brass, envIntensity } from '../core/materials.js';
import { lateManager } from '../core/loaders.js';
import { shadows, invalidate } from '../core/frame.js';
import { scene } from '../core/renderer.js';

export function buildPlants() {
  function plant(x, y, z, scale = 1, potColor = C.blush) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(scale);
    scene.add(g);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 20), mat(potColor));
    pot.position.y = 0.15;
    pot.castShadow = pot.receiveShadow = true;
    g.add(pot);
    const leafMats = [mat(C.leaf1, { flatShading: true }), mat(C.leaf2, { flatShading: true })];
    const stemMat = mat(0x7d9873);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + rnd();
      const r = 0.08 + rnd() * 0.14, top = 0.55 + rnd() * 0.5;
      const tip = new THREE.Vector3(Math.cos(a) * r, top, Math.sin(a) * r);
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1 + rnd() * 0.05, 0), leafMats[i % 2]);
      leaf.position.copy(tip);
      leaf.scale.set(1.5, 0.45, 0.9);
      leaf.rotation.set(rnd() * 0.5, -a, 0.3 + rnd() * 0.4);
      leaf.castShadow = true;
      const base = new THREE.Vector3(0, 0.28, 0), dir = tip.clone().sub(base);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, dir.length(), 5), stemMat);
      stem.position.copy(base).addScaledVector(dir, 0.5);
      stem.quaternion.setFromUnitVectors(up, dir.normalize());
      g.add(leaf, stem);
    }
    return g;
  }

  // Photo-scanned models from Poly Haven, packed into one compressed .glb (meshopt); each spot falls back to the
  // drawn version if it can't load. The loader is fetched only here, as its own small file.
  function model(id, spots) {
    if (!HQ) { spots.forEach(s => s.fallback()); return; }
    const fail = () => spots.forEach(s => s.fallback());
    lateManager.itemStart(id);   // counts as loading from now, while the loader code is still on its way
    Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')])
      .then(([{ GLTFLoader }, { MeshoptDecoder }]) => new GLTFLoader(lateManager).setMeshoptDecoder(MeshoptDecoder)
        .loadAsync(`assets/models/${id}/${id}.glb`))
      .then(gltf => spots.forEach(s => place(gltf.scene, s)), fail)
      .finally(() => lateManager.itemEnd(id));
  }
  // Stand a copy of the model on (x, y, z), scaled to `height` and centred on that point
  function place(src, { x, y = 0, z, height, rotY = 0, tweak }) {
    const obj = src.clone();
    obj.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      o.raycast = () => {};   // not clickable, and testing the mouse against thousands of scanned triangles is slow
      o.material.envMapIntensity = envIntensity();
      tweak?.(o.material);
    });
    obj.scale.setScalar(height / new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()).y);
    const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3());
    obj.position.set(-c.x, -b.min.y, -c.z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.add(obj);
    scene.add(g);
    shadows.dirty = true;   // it casts a shadow: redraw the sun's shadow map once
    invalidate();
  }

  // the big one by the window: the scanned model on computers; phones get the drawn one (about 1 MB less to download)
  if (isTouch) plant(2.45, 0, -2.05, 1.5, C.cream);
  else model('potted_plant_02', [
    { x: 2.45, z: -2.05, height: 1.15, fallback: () => plant(2.45, 0, -2.05, 1.5, C.cream) },
  ]);
  // the small one on the window sill is drawn
  plant(1.6, WIN.y0, -Z - 0.02, 0.5, C.blue);

  // A snake plant on top of the bookshelf: stiff upright blades with pale yellow edges, in a ribbed cream pot
  {
    const g = new THREE.Group();
    g.position.set(-2.8, 1.89, -0.4);
    scene.add(g);
    const r = (s => () => (s = s * 16807 % 2147483647) / 2147483647)(53);
    const potPts = [[0, 0], [0.07, 0], [0.08, 0.01], [0.085, 0.13], [0.093, 0.135], [0.093, 0.15], [0.08, 0.15], [0.078, 0.04], [0, 0.04]];
    const potMat = mat(C.cream), ribGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 5);
    const pot = new THREE.Mesh(new THREE.LatheGeometry(potPts.map(([x, y]) => new THREE.Vector2(x, y)), 24), potMat);
    for (let i = 0; i < 12; i++) {   // ribs down the outside
      const a = i / 12 * Math.PI * 2;
      const rib = new THREE.Mesh(ribGeo, potMat);
      rib.position.set(Math.cos(a) * 0.083, 0.07, Math.sin(a) * 0.083);
      pot.add(rib);
    }
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), mat(0x5a4636, { roughness: 1 }));
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = 0.135;
    pot.castShadow = pot.receiveShadow = true;
    g.add(pot, soil);

    // one blade: a strip that is narrow at the base, widest a third of the way up and pointed at the tip,
    // cupped across its width; vertex colours make the edges yellow and the middle dark green
    const ROWS = 10, COLS = [-1, -0.75, 0, 0.75, 1];
    const pos = [], col = [], idx = [];
    const edge = new THREE.Color(0xd9d08c), mid = new THREE.Color(0x5d8a58);
    for (let j = 0; j <= ROWS; j++) {
      const t = j / ROWS, w = 0.5 * (t < 0.35 ? 0.6 + 0.4 * t / 0.35 : (1 - t) / 0.65);
      for (const c of COLS) {
        pos.push(c * w, t, 0.18 * (c * w) ** 2 * 4);
        const k = Math.abs(c) > 0.9 ? edge : mid;
        col.push(k.r, k.g, k.b);
      }
    }
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS.length - 1; i++) {
      const a = j * COLS.length + i, b = a + COLS.length;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const blade = new THREE.BufferGeometry();
    blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    blade.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    blade.setIndex(idx);
    blade.computeVertexNormals();
    const bladeMat = mat(0xffffff, { vertexColors: true, side: THREE.DoubleSide, roughness: 0.55 });
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + r() * 0.6, rad = i < 3 ? 0.01 : 0.035 + r() * 0.02;
      const leaf = new THREE.Mesh(blade, bladeMat);
      leaf.position.set(Math.cos(a) * rad, 0.13, Math.sin(a) * rad);
      leaf.scale.set(0.05 + r() * 0.015, (i < 3 ? 0.36 : 0.22) + r() * 0.1, 0.05);
      leaf.rotation.set(0, -a + Math.PI / 2 + (r() - 0.5) * 0.8, 0, 'YXZ');
      leaf.rotateX(i < 3 ? 0.05 : 0.15 + r() * 0.15);   // the outer blades lean out a little
      leaf.castShadow = true;
      g.add(leaf);
    }
  }
  addCollider(2.15, 2.75, -2.35, -1.75);

  // Hanging pothos in the corner by the desk: a pot on three cords from the ceiling, vines trailing over the rim.
  // All leaves are instances of one mesh, so the whole plant is only a handful of draw calls.
  {
    const HX = -2.62, HZ = -2.1, RIM = 1.98;   // where it hangs, and the height of the pot's rim
    const r = (s => () => (s = s * 16807 % 2147483647) / 2147483647)(29);   // its own seed, so the books keep their look
    const hang = new THREE.Group();
    hang.position.set(HX, 0, HZ);
    scene.add(hang);
    const up = new THREE.Vector3(0, 1, 0);

    // ceiling hook, and three cords from it down to the rim
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 16), brass());
    hook.position.y = H - 0.025;
    hang.add(hook);
    const cordMat = mat(C.cream, { roughness: 1 }), knot = new THREE.Vector3(0, H - 0.04, 0);
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + 0.5;
      const end = new THREE.Vector3(Math.cos(a) * 0.13, RIM - 0.01, Math.sin(a) * 0.13), dir = knot.clone().sub(end);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, dir.length(), 4), cordMat);
      cord.position.copy(end).addScaledVector(dir, 0.5);
      cord.quaternion.setFromUnitVectors(up, dir.normalize());
      hang.add(cord);
    }

    // the pot, with soil just below the rim
    const potPts = [[0, 0], [0.085, 0], [0.1, 0.02], [0.125, 0.14], [0.135, 0.15], [0.135, 0.16], [0.12, 0.16], [0.11, 0.05], [0, 0.05]];
    const pot = new THREE.Mesh(new THREE.LatheGeometry(potPts.map(([x, y]) => new THREE.Vector2(x, y)), 28), mat(C.blush));
    pot.position.y = RIM - 0.16;
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.118, 20), mat(0x5a4636, { roughness: 1 }));
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = RIM - 0.02;
    pot.castShadow = pot.receiveShadow = true;
    hang.add(pot, soil);

    // a heart-shaped leaf, folded a little along its midrib (base at the origin, tip at +y)
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.65, 0.12, 0.5, 0.75, 0, 1);
    shape.bezierCurveTo(-0.5, 0.75, -0.65, 0.12, 0, 0);
    const leafGeo = new THREE.ShapeGeometry(shape, 6);
    const lp = leafGeo.attributes.position;
    for (let i = 0; i < lp.count; i++) lp.setZ(i, 0.25 * lp.getX(i) ** 2);
    leafGeo.computeVertexNormals();

    const leaves = [], greens = [C.leaf1, C.leaf2, 0x6f9a68].map(c => new THREE.Color(c));
    const tip = new THREE.Vector3(), side = new THREE.Vector3(), normal = new THREE.Vector3(), xAxis = new THREE.Vector3();
    const addLeaf = (pos, out, lean, size) => {   // `out` points away from the pot; `lean` is how the tip points
      tip.copy(lean).normalize();
      normal.copy(out).addScaledVector(tip, -out.dot(tip)).normalize();
      xAxis.crossVectors(tip, normal);
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, tip, normal));
      leaves.push([new THREE.Matrix4().compose(pos, q, new THREE.Vector3().setScalar(size)), greens[Math.floor(r() * 3)]]);
    };

    // a crown of leaves standing up out of the soil
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2, rad = 0.02 + r() * 0.09;
      const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      addLeaf(new THREE.Vector3(out.x * rad, RIM - 0.01 + r() * 0.03, out.z * rad), out,
        new THREE.Vector3(out.x * 0.8, 0.5 + r() * 0.6, out.z * 0.8), 0.055 + r() * 0.025);
    }

    // vines over the rim, each a thin stem with leaves along it, alternating sides and smaller toward the end
    const stemMat = mat(0x6f8f5f, { roughness: 0.8 });
    for (let v = 0; v < 8; v++) {
      const a = v / 8 * Math.PI * 2 + r() * 0.5, len = 0.25 + r() * 0.5;
      const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      side.crossVectors(up, out);
      const wob = (r() - 0.5) * 0.12;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(out.x * 0.1, RIM, out.z * 0.1),
        new THREE.Vector3(out.x * 0.16, RIM + 0.02, out.z * 0.16),
        new THREE.Vector3(out.x * 0.18, RIM - 0.08, out.z * 0.18),
        new THREE.Vector3(out.x * 0.2 + side.x * wob, RIM - len * 0.55, out.z * 0.2 + side.z * wob),
        new THREE.Vector3(out.x * 0.19 - side.x * wob, RIM - len, out.z * 0.19 - side.z * wob),
      ]);
      const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0025, 4), stemMat);
      hang.add(stem);
      const n = Math.round(len / 0.045);
      for (let k = 1; k <= n; k++) {
        const t = k / n, p = curve.getPointAt(t), o = new THREE.Vector3(p.x, 0, p.z).normalize(), alt = k % 2 ? 1 : -1;
        const lean = new THREE.Vector3(0, -0.6, 0).addScaledVector(side, alt * 0.6).addScaledVector(o, 0.35);
        addLeaf(p, o, lean, 0.065 * (1 - 0.4 * t) * (0.85 + r() * 0.3));
      }
    }

    const leafMesh = new THREE.InstancedMesh(leafGeo, mat(0xffffff, { side: THREE.DoubleSide, roughness: 0.6 }), leaves.length);
    leaves.forEach(([m, c], i) => { leafMesh.setMatrixAt(i, m); leafMesh.setColorAt(i, c); });
    leafMesh.castShadow = leafMesh.receiveShadow = true;
    hang.add(leafMesh);
    addCollider(HX - 0.25, HX + 0.25, HZ - 0.25, HZ + 0.25, { hanging: true });   // the vines hang to eye level: don't walk into them
  }
}
