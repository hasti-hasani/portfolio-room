import * as THREE from 'three';
import { isTouch, HQ } from '../config.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf6e7df);

export const camera = new THREE.PerspectiveCamera(isTouch ? 75 : 68, innerWidth / innerHeight, 0.05, 60);
camera.rotation.order = 'YXZ';

// Phones too: below their dense screens' resolution everything looks soft, and the extra pixels stand in for edge smoothing.
// Sharp enough on high-DPI screens, at about half the pixels of 2×.
export const START_DPR = Math.min(devicePixelRatio, 1.5);

export let renderer, canvas;
// Daylight exposure; the night mood has its own (systems/mood.js). 1.05 washed the pastels out to white.
export const DAY_EXPOSURE = 0.85, NIGHT_EXPOSURE = 1.0;

// Throws when the browser has no WebGL; the caller then shows the plain 2D page instead
export function createRenderer(container) {
  renderer = new THREE.WebGLRenderer({ antialias: !isTouch });   // edge smoothing is hardly visible on a small, dense phone screen
  renderer.setPixelRatio(START_DPR);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;   // lighter than PCFSoft; sunlight has fairly crisp edges anyway
  renderer.shadowMap.autoUpdate = false;          // redrawn only when `shadows.dirty` (see core/frame.js)
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = HQ ? DAY_EXPOSURE : 1.15;
  canvas = renderer.domElement;
  container.append(canvas);
}

export function setPixelRatio(r) {
  renderer.setPixelRatio(r);
  renderer.setSize(innerWidth, innerHeight);
}
