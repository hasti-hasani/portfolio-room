// The desk speaker plays a lofi track (CC BY 3.0: the credit is shown on screen while it plays — keep it)
import * as THREE from 'three';
import { invalidate } from '../core/frame.js';
import { showHint } from './hint.js';
import { speakerIt, ledMat, woofer } from '../world/speaker.js';

const MUSIC = { src: 'assets/music/moonwalk-late-night-cafe.mp3', title: '“Late Night Cafe” — Moonwalk',
  credit: '♪ “Late Night Cafe” by Moonwalk · CC BY 3.0 · via Jamendo' };
// The fade runs on a Web Audio gain: iPhones ignore an audio element's volume, so it would never fade out and pause
export const music = { el: null, ctx: null, gain: null, on: false };

export function toggleMusic() {
  music.on = !music.on;
  invalidate();   // the speaker's light and cone change
  if (!music.el) {   // downloaded only the first time someone turns the speaker on
    music.el = new Audio(MUSIC.src);
    music.el.loop = true;
    const ctx = music.ctx = new (window.AudioContext || window.webkitAudioContext)();
    music.gain = ctx.createGain();
    music.gain.gain.value = 0;
    ctx.createMediaElementSource(music.el).connect(music.gain).connect(ctx.destination);
  }
  music.ctx.resume();
  if (music.on) {
    music.el.play().catch(() => { music.on = false; });
    showHint(MUSIC.credit);
  }
  speakerIt.el.lastChild.textContent = music.on ? `♪ ${MUSIC.title}` : 'Music';
}

export function updateMusic(dt, time) {
  if (music.el) {   // fade in and out, then pause once silent
    const v = THREE.MathUtils.clamp(music.gain.gain.value + (music.on ? dt : -dt) * 0.6, 0, 0.55);
    music.gain.gain.value = v;
    if (!music.on && v === 0 && !music.el.paused) music.el.pause();
  }
  ledMat.emissiveIntensity = music.on ? 1.6 : 0;
  woofer.scale.y = music.on ? 1 + 1.5 * Math.max(0, Math.sin(time * Math.PI * 2 * 85 / 60)) ** 8 : 1;   // pumps at 85 bpm
}
