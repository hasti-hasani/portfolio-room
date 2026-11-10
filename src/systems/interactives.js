// Clickable objects and their floating labels ("hotspots").
import * as THREE from 'three';
import { EYE } from '../config.js';
import { $ } from '../util.js';
import { state } from '../core/state.js';
import { camera } from '../core/renderer.js';
import { select, setHover } from './interaction.js';

export const interactives = [];

// A standing spot (x, z) looking at a target point
export function viewFrom(x, z, tx, ty, tz) {
  const dx = tx - x, dz = tz - z;
  return { x, z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(ty - EYE, Math.hypot(dx, dz)), dist: Math.hypot(dx, dz, ty - EYE) };
}

// hotspot: false leaves out the floating label — the object still glows on hover and opens on click
export function makeInteractive(group, key, label, anchor, view, { hotspot = true } = {}) {
  const it = { group, key, label, anchor: new THREE.Vector3(...anchor), view: viewFrom(...view) };
  group.userData.interactive = it;
  interactives.push(it);
  if (!hotspot) return it;
  it.el = document.createElement('button');
  it.el.className = 'hotspot';
  it.el.innerHTML = '<span class="dot"></span>';
  it.el.append(label);
  it.el.addEventListener('click', () => select(it));
  it.el.addEventListener('mouseenter', () => setHover(it));
  it.el.addEventListener('mouseleave', () => setHover(null));
  $('#hotspots').append(it.el);
  return it;
}

const tmp = new THREE.Vector3();
export function updateHotspots() {
  const hidden = state.mode !== 'play' || !!state.panel || state.simple;
  for (const it of interactives) {
    if (!it.el) continue;
    tmp.copy(it.anchor).project(camera);
    const off = hidden || tmp.z > 1 || Math.abs(tmp.x) > 1.05 || Math.abs(tmp.y) > 1.05;
    // only touch the page when something changed: style writes every frame make the browser redo its layout work
    if (it.off !== off) {
      it.off = off;
      it.el.style.opacity = off ? 0 : 1;
      it.el.style.pointerEvents = off ? 'none' : 'auto';
    }
    if (off) continue;
    const tf = `translate(${Math.round((tmp.x + 1) / 2 * innerWidth)}px, ${Math.round((1 - tmp.y) / 2 * innerHeight)}px) translate(-50%, -50%)`;
    if (it.tf !== tf) { it.tf = tf; it.el.style.transform = tf; }
  }
}
