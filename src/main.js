// Entry point: builds the studio in a fixed order, then starts the loop.
import P from './content.js';
import { HQ } from './config.js';
import { $ } from './util.js';
import { state } from './core/state.js';
import { invalidate, shadows } from './core/frame.js';
import { renderer, scene, camera, createRenderer } from './core/renderer.js';
import { manager, lateManager } from './core/loaders.js';
import { textTextures } from './core/build.js';

import { buildLights } from './world/lights.js';
import { buildRoom } from './world/room.js';
import { buildWindow } from './world/window.js';
import { buildDoor, door } from './world/door.js';
import { buildRug } from './world/rug.js';
import { buildPlants } from './world/plants.js';
import { buildDesk } from './world/desk.js';
import { buildComputer } from './world/computer.js';
import { buildCertificates } from './world/certificates.js';
import { buildBookshelf } from './world/bookshelf.js';
import { buildRack, hangers } from './world/rack.js';
import { buildWhiteboard } from './world/whiteboard.js';
import { buildSpeaker, speakerIt, woofer, tweeter, led } from './world/speaker.js';
import { buildLounge } from './world/lounge.js';
import { buildPaintings } from './world/paintings.js';

import { makeInteractive } from './systems/interactives.js';
import { buildMarker, marker } from './systems/player.js';
import { initInput } from './systems/interaction.js';
import { initMood } from './systems/mood.js';
import { toggleMusic } from './systems/music.js';
import { sound, startAudio, playClick, preloadSounds, initSoundButton } from './systems/audio.js';
import { mergeStatic, addContactShadows, MAP_KEYS } from './systems/optimize.js';
import { initQuality } from './systems/quality.js';
import { startLoop } from './systems/loop.js';
import { closePanel } from './ui/panels.js';
import { openSimple } from './ui/simple.js';

document.title = P.owner && P.owner !== 'Your Name' ? `${P.owner} — Studio` : 'My Studio';
$('#intro-tagline').textContent = P.tagline || '';
$('#panel-close').addEventListener('click', closePanel);

try {
  createRenderer($('#scene'));
} catch (err) {
  // No WebGL: show everything as a plain page instead
  $('#intro').classList.add('hidden');
  openSimple(false);
  throw err;
}

// ---------- build the room ----------
// The order matters: pieces that use the shared random sequence (floor, curtains, plants, books, garments)
// must take their numbers in the same order every time, or they would look different.
buildLights();
buildRoom();
buildWindow();
buildDoor();
buildRug();
buildPlants();
buildDesk();
buildComputer();
buildCertificates();
buildBookshelf();
buildRack();
buildWhiteboard();
makeInteractive(door, 'exit', 'Exit', [0.8, 2.32, 2.45], [0.8, 1.15, 0.8, 1.25, 2.5]);   // door → back to the personal site
buildSpeaker();
speakerIt.action = toggleMusic;   // the speaker plays in place, no walking
buildLounge();
buildPaintings();
buildMarker();

// Redraw the painted textures with text once the web fonts arrive
Promise.all([
  document.fonts.load('46px "DM Serif Display"'),
  document.fonts.load('22px "DM Sans"'),
]).catch(() => {}).finally(() => { textTextures.forEach(t => t.redraw()); invalidate(); });

// ---------- make it cheap to draw ----------
// Things that move cast no shadow (they would force the shadow map to be redrawn) and are never merged
const KEEP_APART = new Set([door, ...hangers, woofer, tweeter, led, marker]);
for (const o of KEEP_APART) o.traverse(m => { m.castShadow = false; });
addContactShadows();
scene.updateMatrixWorld(true);
mergeStatic(scene, KEEP_APART);

initMood();
initQuality();
initInput();
initSoundButton($('#sound-btn'));
startLoop();

// ---------- intro: "Step inside", then walk in through the door ----------
const enter = $('#enter');
enter.addEventListener('click', () => {
  $('#intro').classList.add('hidden');
  if (sound.on) startAudio();   // this click is the user gesture browsers require before playing sound
  playClick();
  state.mode = 'intro';
  state.introT = state.introWait = 0;
});

// Before the visitor steps in, every shader is built and every texture is sent to the graphics card — otherwise
// each happens the first time a thing comes into view, and the first turns of the head stutter.
function ready() {
  enter.textContent = 'Almost ready…';
  preloadSounds();   // now that the studio is in, the door and footstep sounds can download
  scene.traverse(o => [o.material].flat().forEach(m => m && MAP_KEYS.concat('envMap').forEach(k => m[k]?.isTexture && renderer.initTexture(m[k]))));
  renderer.compileAsync(scene, camera).catch(() => {}).finally(() => { enter.disabled = false; enter.textContent = 'Step inside'; });
}

lateManager.onProgress = invalidate;   // a painting came in
if (HQ) {
  manager.onProgress = (url, done, total) => {
    shadows.dirty = true;
    invalidate();
    if (enter.disabled) enter.textContent = `Preparing the studio… ${Math.round(done / total * 100)}%`;
  };
  manager.onLoad = ready;
} else ready();
