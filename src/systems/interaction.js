// Pointer and keyboard: drag to look, click the floor to walk, click an object to go to it and open its panel.
import * as THREE from 'three';
import { isTouch } from '../config.js';
import { state } from '../core/state.js';
import { invalidate } from '../core/frame.js';
import { scene, camera, canvas } from '../core/renderer.js';
import { keys, goTo, walkTo, addLook } from './player.js';
import { playClick } from './audio.js';
import { hideHint } from './hint.js';
import { rackSway } from '../world/rack.js';
import { catAt, petCat } from '../world/cat.js';
import { openPanel, closePanel } from '../ui/panels.js';
import { closeSimple } from '../ui/simple.js';

// The hovered object glows a little
function glow(it, on) {
  const seen = new Set();   // books share materials, so remember each material's colour once, on the material
  it.group.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m.emissive || seen.has(m)) continue;
      seen.add(m);
      if (on) {
        m.userData.e = m.emissive.getHex();
        m.userData.ei = m.emissiveIntensity;
        m.emissive.setHex(0xffe2c6);
        m.emissiveIntensity = 0.22;
      } else if (m.userData.e !== undefined) {
        m.emissive.setHex(m.userData.e);
        m.emissiveIntensity = m.userData.ei;
      }
    }
  });
}
export function setHover(it) {
  if (state.hover === it) return;
  if (state.hover) { glow(state.hover, false); state.hover.el?.classList.remove('active'); }
  state.hover = it;
  if (it) { glow(it, true); it.el?.classList.add('active'); }
  canvas.classList.toggle('hovering', !!it);
  invalidate();
}
export function select(it) {
  if (state.mode !== 'play' || state.simple) return;
  playClick();
  setHover(null);
  if (it.action) { it.action(); return; }
  if (state.panel) closePanel();
  if (it.key === 'garments') rackSway.t = 0;
  goTo(it.view, () => openPanel(it.key));
}

const raycaster = new THREE.Raycaster();
raycaster.firstHitOnly = true;   // per mesh: only the nearest hit is needed (see systems/picking.js)
const ndc = new THREE.Vector2();
function pick(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(scene.children, true).find(h => !h.object.userData.noPick && h.object.visible);
  if (!hit) return {};
  let o = hit.object;
  while (o && !o.userData.interactive) o = o.parent;
  return { hit, it: o?.userData.interactive };
}

const ptr = { down: false, x: 0, y: 0, sx: 0, sy: 0, dragged: false };
let hoverAt = null;   // the last mouse position not yet tested for hover

// Hover is tested once per frame in the main loop, not on every mouse event
export function updateHover() {
  if (!hoverAt) return;
  if (state.mode === 'play' && !ptr.down && !state.tween) {
    const it = pick(hoverAt).it || null;
    setHover(it);
    if (!it) canvas.classList.toggle('hovering', catAt(hoverAt));   // a pointer over the cat too
  }
  hoverAt = null;
}

export function initInput() {
  canvas.addEventListener('pointerdown', e => {
    if (state.mode !== 'play') return;
    Object.assign(ptr, { down: true, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, dragged: false });
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (state.mode !== 'play') return;
    if (ptr.down) {
      if (!ptr.dragged && Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) > (isTouch ? 9 : 5)) {
        ptr.dragged = true;
        canvas.classList.add('dragging');
        setHover(null);
      }
      if (ptr.dragged) {
        const k = isTouch ? 0.005 : 0.0035;
        addLook((e.clientX - ptr.x) * k, (e.clientY - ptr.y) * k);
        state.tween = null;
        hideHint();
      }
      ptr.x = e.clientX; ptr.y = e.clientY;
    } else if (!state.tween && e.pointerType === 'mouse') {
      hoverAt = { clientX: e.clientX, clientY: e.clientY };
    }
  });
  canvas.addEventListener('pointerup', e => {
    if (!ptr.down) return;
    ptr.down = false;
    canvas.classList.remove('dragging');
    if (ptr.dragged) return;
    if (state.panel) { closePanel(); return; }
    if (petCat(e)) return;   // the cat hops instead of you walking to the floor behind it
    const { hit, it } = pick(e);
    if (it) { select(it); return; }
    if (hit?.object.userData.walkable) walkTo(hit.point);
  });
  canvas.addEventListener('pointercancel', () => { ptr.down = false; canvas.classList.remove('dragging'); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (state.simple) closeSimple(); else if (state.panel) closePanel(); return; }
    if (e.target.closest?.('input, textarea')) return;
    keys[e.code] = true;
    if (e.code.startsWith('Arrow') && state.mode === 'play' && !state.simple) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
}
