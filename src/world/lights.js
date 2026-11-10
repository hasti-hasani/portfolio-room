// Daylight: sky fill, the sun through the window (the only shadow caster), a soft window bounce, and the HDRI.
// These are the daytime values; systems/mood.js blends them toward night.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { HQ, isTouch } from '../config.js';
import { manager } from '../core/loaders.js';
import { scene } from '../core/renderer.js';

export let hemi, sun, bounce;

export function buildLights() {
  hemi = new THREE.HemisphereLight(0xfff8f2, 0xf0e0d4, HQ ? 0.7 : 1.9);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff0d6, 1.9);   // gentle daylight: brighter washed the pastels out
  sun.position.set(2.5, 4.6, -6.5);
  sun.target.position.set(0.8, 0, 0.3);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(isTouch ? 512 : 2048);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  bounce = new THREE.PointLight(0xfff1e6, 2.0, 7, 1.5);   // soft window bounce
  bounce.position.set(1, 1.9, -1.6);
  scene.add(bounce);

  if (HQ) new RGBELoader(manager).load(`assets/hdri/lythwood_room_${isTouch ? 256 : 512}.hdr`, t => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = t;
  });
}
