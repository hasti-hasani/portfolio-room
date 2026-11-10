// The window: a painted view of Tehran outside, a steel frame, glass, and tulle curtains.
import * as THREE from 'three';
import { C, Z, T, WIN, isTouch } from '../config.js';
import { rnd } from '../util.js';
import { canvasTex, plane, part } from '../core/build.js';
import { mat, brass } from '../core/materials.js';
import { scene } from '../core/renderer.js';

export let sky, nightSky, tulleMat;

export function buildWindow() {
  const VIEW = { w: 6, h: 4.5, x: 1, y: 1.55 };                      // painted area and its centre, in metres on the plane
  const VIEW_PLANE = { w: 16, h: 12, x: 1, y: 1.55, z: -4.5 };
  const VIEW_PX = isTouch ? 1024 : 2048;
  function drawView(night) {
    return (g, w, h) => {
      const s = w / VIEW.w;
      const px = x => (x - VIEW.x + VIEW.w / 2) * s, py = y => (VIEW.y + VIEW.h / 2 - y) * s;
      const seeded = seed => () => (seed = seed * 16807 % 2147483647) / 2147483647;
      const poly = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y]) => g.lineTo(px(x), py(y))); g.fill(); };
      const shadeRight = (pts, cx, alpha) => {   // darken the right half of a shape, for a little roundness
        g.save(); g.beginPath(); pts.forEach(([x, y]) => g.lineTo(px(x), py(y))); g.clip();
        g.fillStyle = `rgba(0, 0, 0, ${alpha})`; g.fillRect(px(cx), 0, w, h); g.restore();
      };
      const HORIZON = 1.3, LEFT = VIEW.x - VIEW.w / 2, RIGHT = VIEW.x + VIEW.w / 2;

      // sky
      const air = g.createLinearGradient(0, 0, 0, py(HORIZON));
      air.addColorStop(0, night ? '#0b1230' : '#8fbfe0'); air.addColorStop(1, night ? '#2d3763' : '#e8edef');
      g.fillStyle = air; g.fillRect(0, 0, w, h);
      if (night) {
        const r = seeded(11);
        for (let i = 0; i < 220; i++) {
          g.fillStyle = `rgba(255, 250, 235, ${0.3 + r() * 0.6})`;
          g.beginPath(); g.arc(px(LEFT + 0.1 + r() * (VIEW.w - 0.2)), py(1.85 + r() * 1.8), (0.4 + r()) * s / 340, 0, Math.PI * 2); g.fill();
        }
        const glow = g.createRadialGradient(px(0.85), py(2.35), 0, px(0.85), py(2.35), 0.25 * s);
        glow.addColorStop(0, 'rgba(255, 244, 214, .4)'); glow.addColorStop(1, 'rgba(255, 244, 214, 0)');
        g.fillStyle = glow; g.fillRect(0, 0, w, h);
        g.fillStyle = '#fbf1d8'; g.beginPath(); g.arc(px(0.85), py(2.35), 0.055 * s, 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = 'rgba(255, 255, 255, .75)';
        for (const [x, y, rw] of [[-0.1, 2.6, 0.32], [0.15, 2.64, 0.2], [1.95, 2.75, 0.28], [2.6, 2.4, 0.2]]) {
          g.beginPath(); g.ellipse(px(x), py(y), rw * s, rw * 0.28 * s, 0, 0, Math.PI * 2); g.fill();
        }
      }

      // the Alborz ridge behind the city, all the way across
      const ridge = [];
      for (let x = LEFT; x <= RIGHT + 0.01; x += 0.02) ridge.push([x, HORIZON + 0.13 + 0.05 * Math.sin(x * 2.1) + 0.025 * Math.sin(x * 5.3 + 1)]);
      poly([...ridge, [RIGHT, HORIZON - 1], [LEFT, HORIZON - 1]], night ? '#232c52' : '#a9b9cc');

      // Damavand: a lone snow-capped cone, slightly rounded at the top
      const DX = 0.3, PEAK = 2.0, BASE = HORIZON + 0.05, HW = 0.95;
      const height = x => { const t = Math.max(0, Math.abs(x - DX) / HW - 0.03) / 0.97; return BASE + (PEAK - BASE) * Math.pow(Math.max(0, 1 - t), 1.7); };
      const cone = [];
      for (let x = DX - HW; x <= DX + HW + 0.001; x += 0.01) cone.push([x, height(x)]);
      poly(cone, night ? '#3d4a7c' : '#8ea3bb');
      const snow = [[DX - 0.5, PEAK + 0.1], [DX + 0.5, PEAK + 0.1]];   // everything above a ragged snow line, clipped to the cone
      for (let x = DX + 0.5; x >= DX - 0.5; x -= 0.015) snow.push([x, PEAK - 0.3 + 0.1 * Math.abs(x - DX) + 0.03 * Math.sin(x * 47) + 0.02 * Math.sin(x * 91)]);
      g.save(); g.beginPath(); cone.forEach(([x, y]) => g.lineTo(px(x), py(y))); g.clip();
      poly(snow, night ? '#a9b3d3' : '#f6f8fa');
      g.restore();
      shadeRight(cone, DX, night ? 0.18 : 0.08);

      // haze where the mountains meet the city (warm city glow at night)
      const haze = g.createLinearGradient(0, py(HORIZON + 0.25), 0, py(HORIZON));
      haze.addColorStop(0, 'rgba(0, 0, 0, 0)'); haze.addColorStop(1, night ? 'rgba(255, 190, 120, .22)' : 'rgba(240, 236, 230, .6)');
      g.fillStyle = haze; g.fillRect(0, py(HORIZON + 0.25), w, py(HORIZON) - py(HORIZON + 0.25));

      // the city: three rows of blocks, far to near; Milad Tower rises from behind the middle row
      g.fillStyle = night ? '#1d2443' : '#d9d1c6';
      g.fillRect(0, py(HORIZON), w, h);
      const r = seeded(5);
      const blocks = (base, minH, maxH, minW, maxW, day, dark, winSize, winTo = base - 0.05) => {
        for (let x = LEFT + 0.25 + r() * 0.1; x < RIGHT - 0.25 - maxW; ) {
          const bw = minW + r() * (maxW - minW), bh = minH + r() * (maxH - minH), top = base + bh;
          const shade = r();
          g.fillStyle = night ? dark : day[Math.floor(shade * day.length)];
          g.fillRect(px(x), py(top), bw * s, h);
          for (let wy = top - winSize * 2; wy > winTo; wy -= winSize * 2.2) {   // windows: lit at night, faint by day
            for (let wx = x + winSize; wx < x + bw - winSize * 1.5; wx += winSize * 2.2) {
              const lit = r() < 0.45, warm = r() < 0.8;   // drawn either way, so day and night stay in step
              if (night && !lit) continue;
              g.fillStyle = night ? (warm ? '#ffd79a' : '#fff1d0') : 'rgba(90, 96, 110, .18)';
              g.fillRect(px(wx), py(wy), winSize * s, winSize * 1.2 * s);
            }
          }
          x += bw + r() * 0.03;
        }
      };
      blocks(HORIZON - 0.08, 0.04, 0.12, 0.05, 0.12, ['#d4ccc1', '#cdc4b8', '#dcd5cb'], '#20284a', 0.008);

      // Milad Tower: tapered shaft, the stacked pod about two-thirds up, then the long mast
      const TX = 1.55, TB = 0.85;
      const shaft = [[TX - 0.04, TB], [TX + 0.04, TB], [TX + 0.024, TB + 0.9], [TX - 0.024, TB + 0.9]];
      const towerCol = night ? '#2a3152' : '#d6cfc6';
      poly(shaft, towerCol);
      if (night) poly([[TX - 0.008, TB], [TX + 0.008, TB], [TX + 0.005, TB + 0.9], [TX - 0.005, TB + 0.9]], 'rgba(240, 205, 140, .55)');
      shadeRight(shaft, TX + 0.006, night ? 0.25 : 0.1);
      const pod = [[TX - 0.026, TB + 0.9], [TX + 0.026, TB + 0.9], [TX + 0.12, TB + 0.98], [TX + 0.12, TB + 1.04], [TX + 0.06, TB + 1.08],
        [TX + 0.045, TB + 1.1], [TX - 0.045, TB + 1.1], [TX - 0.06, TB + 1.08], [TX - 0.12, TB + 1.04], [TX - 0.12, TB + 0.98]];
      poly(pod, night ? '#262d4c' : '#cbc4ba');
      for (const [y0, y1, hw] of [[TB + 0.99, TB + 1.005, 0.118], [TB + 1.017, TB + 1.03, 0.118], [TB + 1.05, TB + 1.06, 0.085]]) {
        poly([[TX - hw, y0], [TX + hw, y0], [TX + hw, y1], [TX - hw, y1]], night ? '#ffd99c' : '#6b7280');
      }
      shadeRight(pod, TX + 0.01, night ? 0.2 : 0.1);
      poly([[TX - 0.014, TB + 1.1], [TX + 0.014, TB + 1.1], [TX + 0.002, TB + 1.6], [TX - 0.002, TB + 1.6]], towerCol);
      for (const y of [TB + 1.22, TB + 1.34]) poly([[TX - 0.02, y], [TX + 0.02, y], [TX + 0.017, y + 0.014], [TX - 0.017, y + 0.014]], night ? '#3a4266' : '#c3bbb0');
      if (night) {
        const tip = g.createRadialGradient(px(TX), py(TB + 1.6), 0, px(TX), py(TB + 1.6), 0.03 * s);
        tip.addColorStop(0, 'rgba(255, 90, 74, .9)'); tip.addColorStop(1, 'rgba(255, 90, 74, 0)');
        g.fillStyle = tip; g.fillRect(px(TX - 0.03), py(TB + 1.63), 0.06 * s, 0.06 * s);
      }

      blocks(HORIZON - 0.3, 0.1, 0.3, 0.08, 0.18, ['#cbc1b4', '#c3b8aa', '#d2c9bd'], '#1a2140', 0.012);
      blocks(HORIZON - 0.85, 0.15, 0.4, 0.12, 0.26, ['#c2b6a7', '#b9ad9e', '#c9beb0'], '#141a33', 0.016, VIEW.y - VIEW.h / 2 + 0.1);
    };
  }
  function viewTex(night) {
    const t = canvasTex(VIEW_PX, VIEW_PX * VIEW.h / VIEW.w, drawView(night));   // clamped at the edges by default
    t.repeat.set(VIEW_PLANE.w / VIEW.w, VIEW_PLANE.h / VIEW.h);
    t.offset.set(0.5 - (VIEW.x - VIEW_PLANE.x + VIEW_PLANE.w / 2) / VIEW.w, 0.5 - (VIEW.y - VIEW_PLANE.y + VIEW_PLANE.h / 2) / VIEW.h);
    return t;
  }
  sky = plane(VIEW_PLANE.w, VIEW_PLANE.h, new THREE.MeshBasicMaterial({ map: viewTex(false) }), VIEW_PLANE.x, VIEW_PLANE.y, VIEW_PLANE.z);
  sky.receiveShadow = false;
  // The night view sits just in front and fades in over the day one
  nightSky = plane(VIEW_PLANE.w, VIEW_PLANE.h, new THREE.MeshBasicMaterial({ map: viewTex(true), transparent: true, opacity: 0 }),
    VIEW_PLANE.x, VIEW_PLANE.y, VIEW_PLANE.z + 0.05);
  nightSky.receiveShadow = false;
  // always drawn before the window glass: sorting by centre depth goes wrong for this big plane when the window is seen at an angle (e.g. from the desk)
  nightSky.renderOrder = -1;

  const wz0 = -Z - T / 2 - 0.03, wz1 = -Z - T / 2 + 0.03;
  // a slim white steel frame with a grid of panes, like an old workshop window: 3 across, 4 high
  const steel = mat(C.trim, { roughness: 0.4 });   // painted white, like the trim
  const PANES = { cols: 3, rows: 4 }, BAR = 0.022, EDGE = 0.045;
  part(scene, steel, WIN.x0, WIN.x0 + EDGE, WIN.y0, WIN.y1, wz0, wz1, 0.004);
  part(scene, steel, WIN.x1 - EDGE, WIN.x1, WIN.y0, WIN.y1, wz0, wz1, 0.004);
  part(scene, steel, WIN.x0, WIN.x1, WIN.y1 - EDGE, WIN.y1, wz0, wz1, 0.004);
  part(scene, steel, WIN.x0, WIN.x1, WIN.y0, WIN.y0 + EDGE, wz0, wz1, 0.004);
  for (let i = 1; i < PANES.cols; i++) {
    const x = WIN.x0 + (WIN.x1 - WIN.x0) * i / PANES.cols;
    part(scene, steel, x - BAR / 2, x + BAR / 2, WIN.y0, WIN.y1, wz0 + 0.01, wz1 - 0.01, 0.003);
  }
  for (let i = 1; i < PANES.rows; i++) {
    const y = WIN.y0 + (WIN.y1 - WIN.y0) * i / PANES.rows;
    part(scene, steel, WIN.x0, WIN.x1, y - BAR / 2, y + BAR / 2, wz0 + 0.01, wz1 - 0.01, 0.003);
  }
  part(scene, C.trim, WIN.x0 - 0.06, WIN.x1 + 0.06, WIN.y0 - 0.04, WIN.y0 + 0.003, -Z - 0.12, -Z + 0.12);   // sill, its top 3 mm above the wall under the window so the two don't flicker
  const glass = plane(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false }), (WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, -Z - T / 2);
  glass.userData.noPick = true;

  // tulle curtains
  const ROD_Y = 2.64, CURTAIN_H = ROD_Y - 0.015;   // the curtains fall all the way to the floor
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, WIN.x1 - WIN.x0 + 0.6, 12), brass());
  rod.rotation.z = Math.PI / 2;
  rod.position.set((WIN.x0 + WIN.x1) / 2, ROD_Y, -Z + 0.16);   // far enough out that the curtains clear the window sill
  scene.add(rod);
  // Sheer tulle: a fine diagonal net with uneven slub threads
  const tulleTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = 'rgba(255, 255, 255, .3)'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255, 255, 255, .9)'; g.lineWidth = 1.2;
    for (let i = -h; i < w + h; i += 8) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
      g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke();
    }
    for (let x = 0; x < w; x += 3 + ((x * 7) % 9)) { g.fillStyle = `rgba(255, 255, 255, ${0.2 + ((x * 13) % 10) / 25})`; g.fillRect(x, 0, 1.5, h); }
  }, [6, 14]);
  for (let i = 0; i < 64 * 64; i++) rnd();   // keeps the seeded sequence of the old curtain-shadow texture, so the folds, plants and garments below stay as they were
  tulleMat = mat(0xffffff, { map: tulleTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1, emissive: 0xfff4e6, emissiveIntensity: 0.12 });

  // Uneven folds that deepen and fan out toward the hem; the top edge is at y = 0, so it sways from the rod
  function curtainGeometry(w, h) {
    const geo = new THREE.PlaneGeometry(w, h, 72, 30);
    geo.translate(0, -h / 2, 0);
    const pos = geo.attributes.position, ph = [rnd() * 6, rnd() * 6, rnd() * 6];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), down = -y / h;
      const fold = 0.55 * Math.sin(x * 29 + ph[0]) + 0.3 * Math.sin(x * 61 + ph[1] + down * 2) + 0.4 * Math.sin(x * 13 + ph[2]);
      pos.setXYZ(i,
        x * (1 + 0.14 * down) + 0.006 * Math.sin(y * 4 + x * 9),
        y + (down > 0.99 ? 0.012 * Math.sin(x * 37 + ph[1]) : 0),   // a slightly uneven hem
        fold * (0.01 + 0.022 * down));
    }
    geo.computeVertexNormals();
    return geo;
  }
  for (const cx of [WIN.x0 - 0.04, WIN.x1 + 0.04]) {
    const c = new THREE.Mesh(curtainGeometry(0.58, CURTAIN_H), tulleMat);
    c.position.set(cx, ROD_Y, -Z + 0.17);
    c.userData.noPick = true;   // casts no shadow: sheer tulle barely would, and its folds are thousands of triangles
    scene.add(c);
  }
}
