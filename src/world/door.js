// The entrance door (it swings open in the intro) and the short corridor behind it.
import * as THREE from 'three';
import { C, Z, T, DOOR } from '../config.js';
import { part } from '../core/build.js';
import { brass } from '../core/materials.js';
import { scene } from '../core/renderer.js';

export let door;

export function buildDoor() {
  part(scene, C.trim, DOOR.x0 - 0.06, DOOR.x0, 0, DOOR.h + 0.06, Z - 0.03, Z + 0.01);
  part(scene, C.trim, DOOR.x1, DOOR.x1 + 0.06, 0, DOOR.h + 0.06, Z - 0.03, Z + 0.01);
  part(scene, C.trim, DOOR.x0 - 0.06, DOOR.x1 + 0.06, DOOR.h, DOOR.h + 0.06, Z - 0.03, Z + 0.01);
  door = new THREE.Group();
  door.position.set(DOOR.x0 + 0.01, 0, Z + 0.05);
  scene.add(door);
  part(door, C.sage, 0, 0.88, 0, 2.09, -0.022, 0.022);
  part(door, C.white, 0.08, 0.8, 1.2, 1.95, -0.03, -0.022, 0.006);
  part(door, C.white, 0.08, 0.8, 0.15, 1.05, -0.03, -0.022, 0.006);
  for (const kz of [-0.045, 0.045]) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), brass());
    knob.position.set(0.79, 1.0, kz);
    door.add(knob);
  }
  const corridorMats = [C.blush, C.blush, C.ceiling, C.woodLight, C.cream, C.blush]
    .map(c => new THREE.MeshStandardMaterial({ color: c, side: THREE.BackSide, roughness: 1 }));
  corridorMats[5].visible = false;   // the face toward the room stays open
  const corridor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 2.5), corridorMats);
  corridor.position.set(0.8, 1.3, Z + T + 1.25);
  scene.add(corridor);
}
