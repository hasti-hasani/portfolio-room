// Render on demand: anything that changes the picture calls invalidate(), and the loop draws one new frame.
export const frame = { dirty: true, idle: 0, marker: 0 };
export function invalidate() { frame.dirty = true; }

// Nothing that moves casts a shadow, so the sun's shadow map is drawn once and kept;
// set `dirty` when something that casts shadows appears or the sun switches on or off.
export const shadows = { dirty: true };
