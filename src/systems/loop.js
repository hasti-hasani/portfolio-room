// The main loop. Render on demand: a frame is drawn only when the camera moved or something on screen is changing
// (plus one a second as a safety net), so a visitor who stands still and looks costs almost nothing — phones stay cool.
// Nothing is drawn at all while nobody can see the studio: a background tab, or — embedded in another page —
// scrolled out of view. The loop stops completely and starts again when it comes back.
import * as THREE from 'three';
import { state } from '../core/state.js';
import { frame, invalidate, shadows, pace } from '../core/frame.js';
import { renderer, scene, camera, canvas } from '../core/renderer.js';
import { updatePlayer, marker } from './player.js';
import { updateHover } from './interaction.js';
import { updateHotspots } from './interactives.js';
import { updateMood, moodChanging } from './mood.js';
import { updateMusic } from './music.js';
import { updateRack, rackMoving } from '../world/rack.js';
import { updateCat, catWantsFrame } from '../world/cat.js';
import { checkPerf } from './quality.js';
import { statsOn, trackStats } from './stats.js';

const clock = new THREE.Clock();
const lastCam = new THREE.Matrix4(), lastProj = new THREE.Matrix4();

function needsRender(raw) {
  camera.updateMatrixWorld();
  const moved = !lastCam.equals(camera.matrixWorld) || !lastProj.equals(camera.projectionMatrix);
  const busy = state.mode === 'intro' || moodChanging() || rackMoving()
    || marker.material.opacity > 0 || frame.marker > 0   // incl. the frame the marker fades out
    || catWantsFrame();                                  // the cat is in view (30 frames a second)
  frame.marker = marker.material.opacity;
  if (!(moved || busy || frame.dirty || (frame.idle += raw) > 1)) return false;
  frame.dirty = false; frame.idle = 0;
  lastCam.copy(camera.matrixWorld); lastProj.copy(camera.projectionMatrix);
  return true;
}

let lastRun = -1e9;
function loop(now) {
  if (!visible()) { view.running = false; return; }
  requestAnimationFrame(loop);
  if (now - lastRun < 750 / pace.fps) return;   // too soon for the frame rate we keep (¾ of the interval: screens tick a little unevenly)
  lastRun = now;
  // capped at 0.1 s: a lower cap made walking and turning slow down on devices drawing under 20 frames a second
  const raw = clock.getDelta(), dt = Math.min(raw, 0.1);
  const t0 = performance.now(), shadowRedraw = shadows.dirty;

  updatePlayer(dt);
  updateMood(dt);
  updateMusic(dt, clock.elapsedTime);
  updateRack(dt);
  updateCat(dt);
  updateHover();
  updateHotspots();

  const drawn = needsRender(raw);
  checkPerf(raw, drawn);
  if (drawn && !frame.hold) {
    if (shadows.dirty) { shadows.dirty = false; renderer.shadowMap.needsUpdate = true; }
    renderer.render(scene, camera);
  }
  if (statsOn) trackStats(raw, drawn, performance.now() - t0, drawn && shadowRedraw);
}

const view = { onScreen: true, running: false };
const visible = () => !document.hidden && view.onScreen;
function resume() {
  if (view.running || !visible()) return;
  view.running = true;
  clock.getDelta();   // don't count the paused time as one long frame
  invalidate();
  requestAnimationFrame(loop);
}

export function startLoop() {
  document.addEventListener('visibilitychange', resume);
  new IntersectionObserver(([e]) => { view.onScreen = e.isIntersecting; resume(); }).observe(canvas);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    invalidate();
  });
  resume();
}
