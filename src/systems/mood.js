// Day & night. mood.n runs from 0 (day) to 1 (night); every light and glow is blended between its two values.
import * as THREE from 'three';
import { $ } from '../util.js';
import { invalidate, shadows } from '../core/frame.js';
import { env } from '../core/materials.js';
import { ENV, HQ } from '../config.js';
import { renderer, scene, NIGHT_EXPOSURE } from '../core/renderer.js';
import { hemi, sun, bounce } from '../world/lights.js';
import { ceilingMat } from '../world/room.js';
import { sky, nightSky, tulleMat } from '../world/window.js';
import { lampLight, shade } from '../world/desk.js';
import { floorShade, floorLight } from '../world/lounge.js';

const hour = new Date().getHours();
export const mood = { n: hour < 7 || hour >= 19 ? 1 : 0 };   // starts from the visitor's own clock
mood.target = mood.n;

let MOOD, MOOD_COLORS;
// Call once the room is built: it reads the daytime values as they are
export function initMood() {
  MOOD = [
    [hemi, 'intensity', hemi.intensity, HQ ? 0.126 : hemi.intensity * 0.18],   // night kept as it was before the day was toned down
    [sun, 'intensity', sun.intensity, 0],
    [bounce, 'intensity', bounce.intensity, 0.7],                  // window light → cool moonlight
    [lampLight, 'intensity', lampLight.intensity, 3.2],
    [floorLight, 'intensity', 0, 4],
    [shade.material, 'emissiveIntensity', 0.35, 0.9],
    [floorShade.material, 'emissiveIntensity', 0, 0.85],
    [ceilingMat, 'emissiveIntensity', 0.15, 0.03],   // by day: was 0.35, which bleached the ceiling white
    [tulleMat, 'emissiveIntensity', 0.12, 0],
    [nightSky.material, 'opacity', 0, 1],
    [renderer, 'toneMappingExposure', renderer.toneMappingExposure, HQ ? NIGHT_EXPOSURE : renderer.toneMappingExposure * 0.95],
  ];
  MOOD_COLORS = [[hemi.color, 0xfff8f2, 0x8090c0], [bounce.color, 0xfff1e6, 0x9fb4e8]];

  const btn = $('#mood-btn');
  const label = () => {
    btn.textContent = mood.target ? '☾ Night' : '☀ Day';
    btn.setAttribute('aria-label', mood.target ? 'Night — switch to day' : 'Day — switch to night');
  };
  btn.addEventListener('click', () => { mood.target = 1 - mood.target; label(); });
  label();
  applyMood();
}

const night = new THREE.Color();
export function applyMood() {
  const n = mood.n;
  for (const [o, k, day, nightValue] of MOOD) o[k] = day + (nightValue - day) * n;
  for (const [c, day, nightHex] of MOOD_COLORS) c.setHex(day).lerp(night.setHex(nightHex), n);
  env.k = 1 - 0.85 * n;
  scene.traverse(o => [].concat(o.material || []).forEach(m => { if (m.isMeshStandardMaterial) m.envMapIntensity = ENV * env.k; }));
  // A light at zero still costs every surface its shading, and the sun its shadow pass: switch them off instead
  floorLight.visible = floorLight.intensity > 0;
  if (sun.visible !== sun.intensity > 0) { sun.visible = sun.intensity > 0; shadows.dirty = true; }
  // Only draw the view that can be seen: the night one is see-through by day, and covers the day one at night
  nightSky.visible = n > 0;
  sky.visible = n < 1;
  invalidate();
}

// Switching mood changes which lights are on (the sun, the floor lamp), and every surface's shader depends on that:
// the first switch would rebuild them all at once and the studio would freeze for a moment, on phones for a second
// or more. So the shaders for the other light setups are built ahead, in the background: the lights are set the
// way each stage of the switch has them, compiled, and put back in the same instant, before any frame is drawn.
// Stages: day (sun, no floor lamp) · in between (both) · night (floor lamp, no sun).
export function warmMoods(camera) {
  const was = [sun.visible, floorLight.visible, sky.visible, nightSky.visible];
  const set = ([s, f, d, ni]) => { sun.visible = s; floorLight.visible = f; sky.visible = d; nightSky.visible = ni; };
  const waits = [[true, false, true, false], [true, true, true, true], [false, true, false, true]].map(stage => {
    set(stage);
    try { return renderer.compileAsync(scene, camera); } finally { set(was); }
  });
  return Promise.all(waits).catch(() => {});
}

export function updateMood(dt) {
  if (mood.n === mood.target) return;
  mood.n = mood.target > mood.n ? Math.min(mood.target, mood.n + dt / 2.5) : Math.max(mood.target, mood.n - dt / 2.5);
  applyMood();
}
export const moodChanging = () => mood.n !== mood.target;
