// The visitor: walking in through the door, walking (keys or click-to-walk), easing to an object, and the camera.
import * as THREE from 'three';
import { X, Z, EYE, RADIUS, SPEED, START } from '../config.js';
import { clamp01, ease } from '../util.js';
import { state } from '../core/state.js';
import { camera, scene } from '../core/renderer.js';
import { colliders } from '../core/build.js';
import { door } from '../world/door.js';
import { onRug } from '../world/rug.js';
import { sound, playSfx, playStep } from './audio.js';
import { showHint, hideHint } from './hint.js';

export const player = { x: START.x, z: 3.9, yaw: 0, pitch: -0.02 };
export const keys = {};
const stride = { x: player.x, z: player.z, d: 0 };   // distance walked since the last footstep

// Keep a point inside the room and out of the furniture
export function resolve(p) {
  p.x = THREE.MathUtils.clamp(p.x, -X + RADIUS, X - RADIUS);
  p.z = THREE.MathUtils.clamp(p.z, -Z + RADIUS, Z - RADIUS);
  for (const c of colliders) {
    const x0 = c.x0 - RADIUS, x1 = c.x1 + RADIUS, z0 = c.z0 - RADIUS, z1 = c.z1 + RADIUS;
    if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) {
      const dl = p.x - x0, dr = x1 - p.x, dn = p.z - z0, ds = z1 - p.z, m = Math.min(dl, dr, dn, ds);
      if (m === dl) p.x = x0; else if (m === dr) p.x = x1; else if (m === dn) p.z = z0; else p.z = z1;
    }
  }
}

// Close-up on a painting: the camera zooms until it fills most of the screen and, on wide screens,
// shifts it left so the side panel doesn't cover it. Everything else eases back to the normal view.
export const closeUp = { k: 1, ox: 0, tk: 1, tox: 0 };
function frameFor(view) {
  if (!view.frame) return { k: 1, ox: 0 };
  const side = innerWidth > 640 ? Math.min(500, innerWidth - 24) + 12 : 0;   // the panel's width (it slides up from the bottom on phones)
  const vh = 2 * view.dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), vw = vh * camera.aspect;   // metres in view at that distance
  const k = Math.min(vh * 0.8 / view.frame.h, vw * (1 - side / innerWidth) * 0.88 / view.frame.w);
  return { k: Math.max(1, k), ox: side / 2 };
}
export function goTo(view, done) {
  state.walk = null;
  const f = frameFor(view);
  closeUp.tk = f.k; closeUp.tox = f.ox;
  const from = { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch };
  const dyaw = Math.atan2(Math.sin(view.yaw - from.yaw), Math.cos(view.yaw - from.yaw));
  const dist = Math.hypot(view.x - from.x, view.z - from.z);
  state.tween = {
    from, to: { x: view.x, z: view.z, yaw: from.yaw + dyaw, pitch: view.pitch }, t: 0,
    dur: THREE.MathUtils.clamp(dist / 1.6 + Math.abs(dyaw) * 0.25, 0.5, 1.8), done,
  };
}

// The ring on the floor where a click-to-walk is heading
export let marker;
export function buildMarker() {
  marker = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.15, 36), new THREE.MeshBasicMaterial({ color: 0x4f9ea0, transparent: true, opacity: 0 }));
  marker.rotation.x = -Math.PI / 2;
  marker.userData.noPick = true;
  scene.add(marker);
}
export function walkTo(point) {
  state.tween = null;
  const target = { x: point.x, z: point.z };
  resolve(target);
  state.walk = target;
  marker.position.set(target.x, 0.012, target.z);
  marker.material.opacity = 0.9;
  hideHint();
}

export function updatePlayer(dt) {
  if (state.mode === 'intro') {
    // hold at the closed door until its sounds are decoded (at most 1.5 s), so they are never skipped
    const waiting = sound.on && !(sound.sfx.door_latch && sound.sfx.door_open) && (state.introWait += dt) < 1.5;
    const t0 = state.introT, t = (state.introT += waiting ? 0 : dt);
    const crossed = at => t0 < at && t >= at;
    if (crossed(0.2)) { playSfx('door_latch'); playSfx('door_open', { delay: 0.1, rate: 0.92 }); }   // handle, then the heavy door swings
    if (crossed(3.1)) playSfx('door_close');                                                         // shuts behind you
    const open = t < 2.6 ? ease(clamp01(t / 1.1)) : 1 - ease(clamp01((t - 2.6) / 0.9));
    door.rotation.y = open * 1.45;
    const k = ease(clamp01((t - 0.55) / 1.9));
    player.z = 3.9 + (START.z - 3.9) * k;
    player.yaw = START.yaw * k;
    if (t > 3.5) { state.mode = 'play'; showHint(); }
  } else if (state.tween) {
    const tw = state.tween;
    tw.t += dt / tw.dur;
    const k = ease(clamp01(tw.t));
    for (const p of ['x', 'z', 'yaw', 'pitch']) player[p] = tw.from[p] + (tw.to[p] - tw.from[p]) * k;
    if (tw.t >= 1) { state.tween = null; tw.done?.(); }
  } else if (state.mode === 'play' && !state.panel && !state.simple) {
    let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    let s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    player.yaw += ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * 1.8 * dt;
    if (f || s) {
      state.walk = null;
      const len = Math.hypot(f, s); f /= len; s /= len;
      const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
      player.x += (-sin * f + cos * s) * SPEED * dt;
      player.z += (-cos * f - sin * s) * SPEED * dt;
      resolve(player);
      hideHint();
    } else if (state.walk) {
      const dx = state.walk.x - player.x, dz = state.walk.z - player.z, d = Math.hypot(dx, dz);
      if (d < 0.04) state.walk = null;
      else {
        const step = Math.min(d, SPEED * dt), px = player.x, pz = player.z;
        player.x += dx / d * step;
        player.z += dz / d * step;
        resolve(player);
        if (Math.hypot(player.x - px, player.z - pz) < step * 0.3) state.walk = null;   // blocked by furniture
      }
    }
  }

  stride.d += Math.hypot(player.x - stride.x, player.z - stride.z);
  stride.x = player.x; stride.z = player.z;
  if (stride.d > 0.62) { stride.d = 0; playStep(onRug(player)); }

  camera.position.set(player.x, EYE, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  const ck = Math.min(1, dt * 3);
  closeUp.k = Math.abs(closeUp.tk - closeUp.k) < 1e-3 ? closeUp.tk : closeUp.k + (closeUp.tk - closeUp.k) * ck;
  closeUp.ox += (closeUp.tox - closeUp.ox) * ck;
  if (Math.abs(closeUp.k - camera.zoom) > 1e-4 || closeUp.ox > 0.5 || camera.view?.enabled) {
    camera.zoom = closeUp.k;
    if (closeUp.ox > 0.5) camera.setViewOffset(innerWidth, innerHeight, closeUp.ox, 0, innerWidth, innerHeight);
    else camera.clearViewOffset();   // also updates the projection
    camera.updateProjectionMatrix();
  }

  marker.material.opacity = Math.max(0, marker.material.opacity - dt * (state.walk ? 0.3 : 2));
}
