// Room size, palette and device facts shared by every part of the studio.

export const isTouch = matchMedia('(pointer: coarse)').matches;
// Photo textures, the HDRI and the models need a web server; opened as a plain file, the room keeps its drawn look
export const HQ = location.protocol !== 'file:';
export const RES = isTouch ? '512' : '1k';   // phones get half-size texture sets: as sharp on a small screen, a quarter of the download
export const ENV = 0.9;                      // how strongly the HDRI lights the room

export const C = {
  wall: 0xf3e5dc, trim: 0xfaf3ec, ceiling: 0xfbf4ee, wood: 0xc9a27e, woodLight: 0xe8d4b8,
  pink: 0xeab8b2, blush: 0xf3d6cf, sage: 0xb7cbb0, blue: 0xc2d6e2, cream: 0xfbf3e8,
  navy: 0x3f4d72, teal: 0x6fb3ad, gold: 0xcfae72, leaf1: 0x8fb08a, leaf2: 0xa9c4a0, white: 0xfffaf4,
};

export const X = 3, Z = 2.5, H = 2.8, T = 0.2;          // half-width, half-depth, height, wall thickness
export const EYE = 1.55, RADIUS = 0.28, SPEED = 1.7;
export const WIN = { x0: 0.0, x1: 1.95, y0: 0.45, y1: 2.5 };   // a tall studio window in the north wall
export const DOOR = { x0: 0.35, x1: 1.25, h: 2.1 };            // door in the south wall
export const START = { x: 0.8, z: 1.6, yaw: 0.15 };
