// Render on demand: anything that changes the picture calls invalidate(), and the loop draws one new frame.
export const frame = { dirty: true, idle: 0, marker: 0 };
export function invalidate() { frame.dirty = true; }

// Frame pacing: at most `fps` frames a second. 60 on fast screens too (120 Hz phones would otherwise draw twice as much);
// 30 when the device can't keep 60, because an even 30 looks smoother than a frame rate wobbling between 40 and 50.
export const pace = { fps: 60 };

// Nothing that moves casts a shadow, so the sun's shadow map is drawn once and kept;
// set `dirty` when something that casts shadows appears or the sun switches on or off.
export const shadows = { dirty: true };
