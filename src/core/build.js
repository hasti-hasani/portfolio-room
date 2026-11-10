// Building blocks for the furniture: boxes, planes, rods, canvas-painted textures, and the floor plan for walking.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ANISO } from '../config.js';
import { scene } from './renderer.js';
import { mat } from './materials.js';

export function box(w, h, d, color, x, y, z, parent = scene, r = 0.015) {
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const geo = rr > 0.002 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, color.isMaterial ? color : mat(color));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

// A box given by its min/max corners — easier for laying out furniture
export const part = (parent, color, x0, x1, y0, y1, z0, z1, r = 0.012) =>
  box(x1 - x0, y1 - y0, z1 - z0, color, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, parent, r);

export function plane(w, h, material, x, y, z, ry = 0, parent = scene) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// A round rod or leg from point a to point b
export function rod3(a, b, r, material, parent) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 10), material);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

// A texture painted in code; `redraw()` paints it again (e.g. once the web fonts have arrived)
export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.redraw = () => { g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; };
  return t;
}

// Footprints the visitor can't walk through. hanging: nothing stands on the floor there (no contact shadow)
export const colliders = [];
export const addCollider = (x0, x1, z0, z1, { hanging = false } = {}) => colliders.push({ x0, x1, z0, z1, hanging });

// Every canvas texture that has text on it, redrawn once the web fonts are in
export const textTextures = [];
