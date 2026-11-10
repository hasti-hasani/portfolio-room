// Automatic quality: for the first seconds of walking around, measure the frame rate; if the device can't keep up,
// render at normal resolution instead of high-DPI. The label at the top left says which.
import { HQ } from '../config.js';
import { $ } from '../util.js';
import { state } from '../core/state.js';
import { invalidate, pace } from '../core/frame.js';
import { renderer, START_DPR, setPixelRatio } from '../core/renderer.js';

const perf = { t: 0, frames: 0, checks: 0, steps: 0, drew: false };

function lowerTo(r) {
  if (renderer.getPixelRatio() <= r) return false;
  setPixelRatio(r);
  invalidate();
  return true;
}
// One step at a time: 1.25 first (hardly softer than 1.5, about 30% fewer pixels), then 1. Never lower: below 1 the
// whole studio turns blurry. A step that changes nothing (the screen already starts lower) is skipped.
const degrade = [() => lowerTo(1.25), () => lowerTo(1)];

function showQuality() {
  const el = $('#quality');
  el.textContent = `Quality: ${HQ ? (perf.steps ? 'Medium' : 'High') : 'Basic'}`;
  el.title = !HQ ? 'Plain colours: open the page from a server to see the full textures'
    : `Rendering at ${Math.round(renderer.getPixelRatio() * 100)}% resolution, up to ${pace.fps} frames a second`
      + (perf.steps || pace.fps < 60 ? ' — lowered because this device ran slowly; click to go back up' : '');
}

export function initQuality() {
  showQuality();
  // Lowered and the visitor disagrees: back to the starting quality, and no more automatic changes
  $('#quality').addEventListener('click', () => {
    if (!perf.steps && pace.fps === 60) return;
    perf.steps = 0; perf.checks = 3;
    pace.fps = 60;
    setPixelRatio(START_DPR);
    invalidate();
    showQuality();
  });
}

export function checkPerf(raw, drawn) {
  const steady = drawn && perf.drew;   // only back-to-back drawn frames say how fast the device draws
  perf.drew = drawn;
  if (!steady || perf.checks >= 3 || state.mode !== 'play' || document.hidden) return;
  perf.t += raw; perf.frames++;
  if (perf.t < 2) return;
  const fps = perf.frames / perf.t;
  perf.t = perf.frames = 0;
  perf.checks++;
  // Can't keep 60: hold an even 30 instead (then measure once more)
  const held = pace.fps < 60;
  if (fps < 50 && !held) { pace.fps = 30; showQuality(); }
  // Below 27 fps only: laptops on battery are often held to 30 fps by the browser, which isn't the device being slow
  if (fps < 27) {   // apply the next step that changes anything
    while (degrade.length) if (degrade.shift()()) { perf.steps++; showQuality(); break; }
  } else if (fps >= 50 || held) perf.checks = 3;   // fast enough: stop measuring
}
