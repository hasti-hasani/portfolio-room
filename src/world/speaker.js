// The desk speaker: clicking it plays music (see systems/music.js).
import * as THREE from 'three';
import { C } from '../config.js';
import { part } from '../core/build.js';
import { mat } from '../core/materials.js';
import { scene } from '../core/renderer.js';
import { makeInteractive } from '../systems/interactives.js';

export let woofer, tweeter, led, ledMat, speakerIt;

export function buildSpeaker() {
  const speaker = new THREE.Group();
  speaker.position.set(-0.98, 0.76, -2.32);
  speaker.rotation.y = -0.35;   // turned a little toward the room
  scene.add(speaker);
  part(speaker, C.sage, -0.06, 0.06, 0, 0.17, -0.055, 0.055, 0.015);
  const coneMat = mat(0x4a4450, { roughness: 0.6 });
  woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.012, 28), coneMat);
  woofer.rotation.x = Math.PI / 2;
  woofer.position.set(0, 0.062, 0.056);
  tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.01, 20), coneMat);
  tweeter.rotation.x = Math.PI / 2;
  tweeter.position.set(0, 0.128, 0.056);
  ledMat = mat(0x9fe3cc, { emissive: 0x5fe0b0, emissiveIntensity: 0 });
  led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 8), ledMat);
  led.position.set(0.04, 0.155, 0.056);
  speaker.add(woofer, tweeter, led);
  [woofer, tweeter].forEach(m => { m.castShadow = true; });
  speakerIt = makeInteractive(speaker, 'music', 'Music', [-0.98, 1.05, -2.3], [-0.98, -1.4, -0.98, 0.85, -2.3]);
}
