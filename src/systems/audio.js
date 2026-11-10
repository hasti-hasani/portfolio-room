// Sound: footsteps, the entrance door and the click (no background sounds).
// Recordings from Kenney's CC0 "RPG Audio" pack in assets/sounds; without them the steps are synthesised.
const STEP_FILES = {
  wood: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `assets/sounds/footstep_0${i}.ogg`),
  rug: [],   // no carpet recordings: on the rug the wood steps are muffled instead
};
const SFX_FILES = ['door_latch', 'door_open', 'door_close'];
export const sound = { ctx: null, master: null, on: true, steps: { wood: [], rug: [] }, sfx: {} };   // on by default, starts on "Step inside"

// The files are downloaded once the studio itself has loaded (so they don't hold it up), while the intro card is
// still up; they are decoded once the "Step inside" click has created the audio context.
const fetchAudio = url => fetch(url).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
let audioData = null;
export function preloadSounds() {
  audioData ||= {
    steps: Object.fromEntries(Object.entries(STEP_FILES).map(([kind, files]) => [kind, files.map(fetchAudio)])),
    sfx: Object.fromEntries(SFX_FILES.map(name => [name, fetchAudio(`assets/sounds/${name}.ogg`)])),
  };
}
const decodeAudio = data => data.then(b => b ? sound.ctx.decodeAudioData(b) : Promise.reject());

export function startAudio() {
  if (!sound.ctx) {
    preloadSounds();
    const ctx = sound.ctx = new (window.AudioContext || window.webkitAudioContext)();
    sound.master = ctx.createGain();
    sound.master.gain.value = 0;
    sound.master.connect(ctx.destination);
    for (const [kind, files] of Object.entries(audioData.steps)) {
      files.forEach(f => decodeAudio(f).then(buf => sound.steps[kind].push(buf)).catch(() => {}));   // missing files just mean fewer variations
    }
    for (const [name, data] of Object.entries(audioData.sfx)) decodeAudio(data).then(buf => { sound.sfx[name] = buf; }).catch(() => {});
  }
  sound.ctx.resume();
  sound.master.gain.setTargetAtTime(0.8, sound.ctx.currentTime, 0.1);
}
export function stopAudio() {
  if (sound.ctx) sound.master.gain.setTargetAtTime(0, sound.ctx.currentTime, 0.1);
}

function tone(freq, freq2, dur, vol, t0) {
  const ctx = sound.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(freq2, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(sound.master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
export function playClick() { if (sound.on && sound.ctx) tone(700, 420, 0.09, 0.12, sound.ctx.currentTime); }

// One recorded effect, optionally later, faster/slower (pitch) and quieter
export function playSfx(name, { delay = 0, rate = 1, gain = 1 } = {}) {
  if (!sound.on || !sound.sfx[name]) return;
  const src = sound.ctx.createBufferSource(), g = sound.ctx.createGain();
  src.buffer = sound.sfx[name];
  src.playbackRate.value = rate;
  g.gain.value = gain;
  src.connect(g).connect(sound.master);
  src.start(sound.ctx.currentTime + delay);
}

let lastStep = -1;
export function playStep(soft) {
  if (!sound.on || !sound.ctx) return;
  const ctx = sound.ctx;
  // a recording: never the same one twice in a row, with a slight pitch and level variation
  const set = sound.steps[soft ? 'rug' : 'wood'].length ? sound.steps[soft ? 'rug' : 'wood'] : sound.steps.wood;
  if (set.length) {
    let i = Math.floor(Math.random() * set.length);
    if (set.length > 1 && i === lastStep) i = (i + 1) % set.length;
    lastStep = i;
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = set[i];
    src.playbackRate.value = 0.94 + Math.random() * 0.12;
    f.type = 'lowpass';
    f.frequency.value = soft && !sound.steps.rug.length ? 900 : 20000;   // muffle wood steps on the rug if there's no carpet recording
    g.gain.value = 0.75 + Math.random() * 0.25;
    src.connect(f).connect(g).connect(sound.master);
    src.start();
    return;
  }
  synthStep(soft);
}

// Fallback footstep: heel then toe; each is a tiny click that rings two "wood" resonances (a low board thump and a
// higher knock), with a short echo off the walls. On the rug only a soft, low brush.
function synthStep(soft) {
  const ctx = sound.ctx, t0 = ctx.currentTime;
  if (!sound.noise) {
    sound.noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = sound.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const vary = 0.9 + Math.random() * 0.2;
  const out = ctx.createGain();
  out.connect(sound.master);
  if (!soft) {   // a short early reflection gives the hard little room
    const echo = ctx.createDelay(), eg = ctx.createGain();
    echo.delayTime.value = 0.018;
    eg.gain.value = 0.25;
    out.connect(echo).connect(eg).connect(sound.master);
  }
  [[0, 1], [0.07, 0.5]].forEach(([delay, part]) => {   // heel, then a lighter toe
    const t = t0 + delay * vary;
    const src = ctx.createBufferSource(), env = ctx.createGain();
    src.buffer = sound.noise;
    env.gain.setValueAtTime(part, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + (soft ? 0.06 : 0.008));
    src.connect(env);
    const bands = soft ? [['lowpass', 500, 0.7, 0.9]] : [['bandpass', 190 * vary, 6, 9], ['bandpass', 1150 * vary, 5, 4], ['highpass', 3000, 0.7, 0.5]];
    for (const [type, freq, q, gain] of bands) {
      const f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
      env.connect(f).connect(g).connect(out);
    }
    src.start(t);
    src.stop(t + 0.2);
  });
}

export function initSoundButton(btn) {
  btn.addEventListener('click', () => {
    sound.on = !sound.on;
    btn.setAttribute('aria-pressed', sound.on);
    btn.textContent = sound.on ? 'Sound on' : 'Sound off';
    sound.on ? startAudio() : stopAudio();
  });
}
