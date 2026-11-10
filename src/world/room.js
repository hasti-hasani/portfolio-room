// The room itself: floor, walls with the window and door openings, ceiling and baseboards.
import * as THREE from 'three';
import { C, X, Z, H, T, WIN, DOOR, HQ } from '../config.js';
import { rnd } from '../util.js';
import { canvasTex, part } from '../core/build.js';
import { mat, PLASTER } from '../core/materials.js';
import { pbr } from '../core/loaders.js';
import { scene } from '../core/renderer.js';

export let ceilingMat;

// Drawn planks, for when there are no photo textures
function drawFloor(g, w, h) {
  const plank = 64;
  for (let y = 0; y < h; y += plank) {
    let x = -rnd() * 300;
    while (x < w) {
      const len = 260 + rnd() * 240;
      g.fillStyle = `hsl(31, 36%, ${77 + rnd() * 6}%)`;
      g.fillRect(x, y, len, plank);
      g.fillStyle = 'rgba(120, 85, 55, .18)';
      g.fillRect(x, y, 2, plank);
      x += len;
    }
    g.fillStyle = 'rgba(120, 85, 55, .2)';
    g.fillRect(0, y, w, 2);
  }
}

export function buildRoom() {
  // The planks take their random numbers first; with photo textures they are laid out but not painted,
  // so everything built after them still gets the same numbers (and the same look)
  const floorMat = HQ
    ? (drawFloor({ fillRect() {} }, 1024, 1024), mat(0xfff8f0, pbr('laminate_floor_02', [3, 2.5])))
    : mat(0xffffff, { map: canvasTex(1024, 1024, drawFloor, [3, 3]), roughness: 0.75 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * X, 2 * Z), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.walkable = true;
  scene.add(floor);

  // walls & ceiling
  const wallMat = mat(HQ ? 0xf0ddd2 : C.wall, { roughness: 0.95, ...PLASTER });   // a touch deeper, so the blush survives the brighter HDRI light
  const TOP = H + T;
  const wall = (x0, x1, y0, y1, z0, z1) => part(scene, wallMat, x0, x1, y0, y1, z0, z1, 0);
  // north, with the window opening
  wall(-X - T, WIN.x0, 0, TOP, -Z - T, -Z);
  wall(WIN.x1, X + T, 0, TOP, -Z - T, -Z);
  wall(WIN.x0, WIN.x1, 0, WIN.y0, -Z - T, -Z);
  wall(WIN.x0, WIN.x1, WIN.y1, TOP, -Z - T, -Z);
  // south, with the door opening
  wall(-X - T, DOOR.x0, 0, TOP, Z, Z + T);
  wall(DOOR.x1, X + T, 0, TOP, Z, Z + T);
  wall(DOOR.x0, DOOR.x1, DOOR.h, TOP, Z, Z + T);
  // east, west, ceiling
  wall(X, X + T, 0, TOP, -Z, Z);
  wall(-X - T, -X, 0, TOP, -Z, Z);
  ceilingMat = mat(C.ceiling, { emissive: C.ceiling, emissiveIntensity: 0.35 });
  part(scene, ceilingMat, -X - T, X + T, H, TOP, -Z - T, Z + T, 0);

  // baseboards
  part(scene, C.trim, -X, X, 0, 0.08, -Z, -Z + 0.015, 0);
  part(scene, C.trim, -X, DOOR.x0 - 0.06, 0, 0.08, Z - 0.015, Z, 0);
  part(scene, C.trim, DOOR.x1 + 0.06, X, 0, 0.08, Z - 0.015, Z, 0);
  part(scene, C.trim, X - 0.015, X, 0, 0.08, -Z, Z, 0);
  part(scene, C.trim, -X, -X + 0.015, 0, 0.08, -Z, Z, 0);
}
