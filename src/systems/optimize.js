// Making the finished room cheap to draw: merging static meshes, and soft contact shadows painted once.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene } from '../core/renderer.js';
import { colliders, canvasTex } from '../core/build.js';

export const MAP_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'alphaMap'];

// ---------- merge static pieces ----------
// The room is built from hundreds of small meshes (leaves, stems, books, frame parts), and each one is a separate
// draw call — that, not the triangle count, is what slows phones down. Once everything is built, sibling meshes
// that look the same (same material settings, same shadows) are welded into one. Nothing changes on screen.
// Left alone: whatever is in `keepApart` (things that move), clickable or walkable meshes (they have userData),
// see-through and glowing materials (the day/night mood and the music light change those), and paintings still loading.
function materialKey(m) {
  if (!m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.transparent || !m.visible || m.emissive.getHex() !== 0) return null;
  return [m.color.getHexString(), m.roughness, m.metalness, m.side, m.flatShading, m.alphaTest, m.envMapIntensity,
    m.normalScale.x, m.normalScale.y, ...MAP_KEYS.map(k => m[k]?.uuid)].join('|');
}
function geometryKey(geo) {
  if (geo.drawRange.count !== Infinity || Object.keys(geo.morphAttributes).length) return null;
  return (geo.index ? 'i' : 'n') + Object.keys(geo.attributes).sort()
    .map(n => `${n}${geo.attributes[n].itemSize}${geo.attributes[n].array.constructor.name}${geo.attributes[n].normalized}`).join(',');
}
// A mesh with several materials (books: spine, pages, covers) is split into one piece per material
function pieces(o) {
  if (!Array.isArray(o.material)) return [[o.geometry, o.material]];
  const geo = o.geometry;
  if (!geo.index || geo.attributes.position.count > 2000) return null;
  return geo.groups.map(gr => {
    const part = new THREE.BufferGeometry();
    for (const [n, a] of Object.entries(geo.attributes)) part.setAttribute(n, a);
    part.setIndex(new THREE.BufferAttribute(geo.index.array.slice(gr.start, gr.start + gr.count), 1));
    return [part, o.material[gr.materialIndex]];
  });
}
export function mergeStatic(parent, keepApart) {
  const bins = new Map();
  for (const o of [...parent.children]) {
    if (keepApart.has(o)) continue;
    if (o.children.length) { mergeStatic(o, keepApart); continue; }
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.visible || o.renderOrder || Object.keys(o.userData).length
      || o.matrix.determinant() < 0) continue;   // a mirrored mesh would turn inside out once baked
    const parts = pieces(o);
    if (!parts) continue;
    const keyed = parts.map(([g, m]) => [g, m, materialKey(m), geometryKey(g)]);
    if (keyed.some(([, , mk, gk]) => mk === null || gk === null)) continue;
    for (const [g, m, mk, gk] of keyed) {
      const key = `${mk}#${gk}#${o.castShadow}${o.receiveShadow}`;
      if (!bins.has(key)) bins.set(key, { material: m, cast: o.castShadow, receive: o.receiveShadow, items: [] });
      bins.get(key).items.push({ o, g });
    }
  }
  // A lone single-material mesh stays as it is; pieces of a split multi-material mesh are always rebuilt,
  // since the mesh they came from is removed
  const welded = new Set();
  for (const bin of bins.values()) {
    if (bin.items.length < 2 && !Array.isArray(bin.items[0].o.material)) continue;
    const merged = mergeGeometries(bin.items.map(({ o, g }) => g.clone().applyMatrix4(o.matrix)), false);
    const m = new THREE.Mesh(merged, bin.material);
    m.castShadow = bin.cast; m.receiveShadow = bin.receive;
    parent.add(m);
    bin.items.forEach(({ o }) => welded.add(o));
  }
  for (const o of welded) parent.remove(o);
}

// ---------- baked soft shadows ----------
// The soft darkness under furniture, painted once into a small canvas texture instead of computed every frame:
// a blurred patch on the floor under everything that stands there, all in one draw call.
export function addContactShadows() {
  const blobTex = canvasTex(128, 128, (g, w, h) => {
    g.shadowColor = '#000'; g.shadowBlur = 22; g.shadowOffsetX = 1000;   // only the blurred shadow lands on the canvas
    g.fillRect(30 - 1000, 30, w - 60, h - 60);
  });
  const PAD = 0.14, FY = 0.009;   // just above the rug
  const pos = [], uv = [], index = [];
  for (const c of colliders) {
    if (c.hanging) continue;
    const x0 = c.x0 - PAD, x1 = c.x1 + PAD, z0 = c.z0 - PAD, z1 = c.z1 + PAD, n = pos.length / 3;
    pos.push(x0, FY, z0, x1, FY, z0, x1, FY, z1, x0, FY, z1);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    index.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x2e2420, map: blobTex, transparent: true,
    opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  m.userData.noPick = true;
  m.raycast = () => {};
  m.renderOrder = -1;   // before the other see-through things (tulle, glass), which would otherwise get shaded too
  scene.add(m);
}
