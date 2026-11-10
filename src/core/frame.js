// Render on demand: anything that changes the picture calls invalidate(), and the loop draws one new frame.
// `hold`: nothing is drawn while the studio loads (see main.js). Every frame drawn then built the shaders it needed
// one at a time, blocking the page — on Intel graphics in Chrome that added up to 20 seconds and more — and the
// lighting picture (HDRI) arriving midway made most of them build twice.
export const frame = { dirty: true, idle: 0, marker: 0, hold: true };
export function invalidate() { frame.dirty = true; }

// Frame pacing: at most `fps` frames a second. 60 on fast screens too (120 Hz phones would otherwise draw twice as much);
// 30 when the device can't keep 60, because an even 30 looks smoother than a frame rate wobbling between 40 and 50.
export const pace = { fps: 60 };

// Nothing that moves casts a shadow, so the sun's shadow map is drawn once and kept;
// set `dirty` when something that casts shadows appears or the sun switches on or off.
export const shadows = { dirty: true };
