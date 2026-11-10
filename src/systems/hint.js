// The short message at the bottom of the screen (how to move, the music credit)
import { isTouch } from '../config.js';
import { $ } from '../util.js';

const HINT = isTouch
  ? 'Drag to look around · Tap the floor to walk · Tap a label to open'
  : 'Drag to look around · Click the floor to walk · WASD to move, ← → to turn';
let timer;

export function showHint(text = HINT) {
  const hint = $('#hint');
  clearTimeout(timer);
  hint.textContent = text;
  hint.classList.add('show');
  timer = setTimeout(hideHint, 9000);
}
export function hideHint() {
  clearTimeout(timer);
  $('#hint').classList.remove('show');
}
