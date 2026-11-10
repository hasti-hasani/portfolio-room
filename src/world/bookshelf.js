// The bookshelf (opens Articles): books with titles from content.js, all spines painted into one texture.
import * as THREE from 'three';
import P from '../content.js';
import { C, isTouch } from '../config.js';
import { rnd } from '../util.js';
import { part, canvasTex, addCollider, textTextures } from '../core/build.js';
import { mat } from '../core/materials.js';
import { scene } from '../core/renderer.js';
import { makeInteractive } from '../systems/interactives.js';

export function buildBookshelf() {
  const shelf = new THREE.Group();
  shelf.position.z = 0.35;   // built at z −1.0…0.2, moved over to leave room for the pin board
  scene.add(shelf);
  part(shelf, C.woodLight, -2.98, -2.64, 0, 1.9, -1.0, -0.97);
  part(shelf, C.woodLight, -2.98, -2.64, 0, 1.9, 0.17, 0.2);
  part(shelf, C.blush, -3.0, -2.98, 0, 1.9, -1.0, 0.2, 0);
  for (const y of [0.035, 0.485, 0.935, 1.385, 1.875]) part(shelf, C.woodLight, -2.98, -2.64, y - 0.015, y + 0.015, -0.97, 0.17, 0.006);
  // Books: titles from content.js, one subject per shelf (top to bottom); upright, leaning, or in a short flat stack
  const SPINE = [   // [cloth colour, lettering colour]
    ['#2f3b5c', '#e9d9b0'], ['#7a2e33', '#f1e3c8'], ['#3e5a48', '#efe6cf'], ['#c9a24f', '#2b2b2b'], ['#efe6d6', '#3b3540'],
    ['#2b2b2e', '#e8e2d6'], ['#d9a7a0', '#3b3540'], ['#a9c0a6', '#2f3a36'], ['#c26a4a', '#f6ead8'], ['#fbf8f2', '#7a2e33'],
    ['#b9cfe0', '#24324a'], ['#5d4a6e', '#f0e6f2'],
  ];
  const books = [];
  [1.4, 0.95, 0.5, 0.05].forEach((sy, si) => {
    const titles = (P.shelfBooks?.[si] || []).map(s => s.split('|').map(t => t.trim())).sort(() => rnd() - 0.5);
    const big = si === 3 ? 0.05 : 0;   // the fashion books run large
    let z = -0.955, n = 0, prevUpright = false;
    const book = o => {
      const [title, author] = titles[n++] || [];
      return { title, author, col: SPINE[Math.floor(rnd() * SPINE.length)], serif: rnd() < 0.5,
        h: 0.21 + rnd() * 0.09 + big, t: 0.022 + rnd() * 0.04, d: 0.16 + rnd() * 0.07 + big * 0.6, ...o };
    };
    const front = d => -2.66 - d / 2 - rnd() * 0.015;   // spines roughly, not perfectly, flush with the shelf edge
    while (z < 0.15) {
      const r = rnd();
      if (r < 0.1 && z < -0.2) {   // a flat stack, spines out
        const len = 0.24 + rnd() * 0.05 + big;
        let y = sy;
        for (let k = 2 + Math.floor(rnd() * 2); k > 0; k--) {
          const b = book({ flat: true });
          b.h = len - rnd() * 0.03;
          Object.assign(b, { x: front(b.d), y: y + b.t / 2, z: z + len / 2 + (rnd() - 0.5) * 0.015 });
          y += b.t;
          books.push(b);
        }
        z += len + 0.02;
        prevUpright = false;
      } else if (r < 0.17) {   // a gap
        z += 0.04 + rnd() * 0.05;
        prevUpright = false;
      } else if (r < 0.25 && prevUpright) {   // leaning back against the previous book
        const b = book({}), a = -(0.12 + rnd() * 0.15);
        const W = b.t * Math.cos(a) + b.h * Math.sin(-a);
        if (z + W > 0.16) break;
        Object.assign(b, { lean: a, x: front(b.d), y: sy + (b.h * Math.cos(a) + b.t * Math.sin(-a)) / 2, z: z + W / 2 });
        books.push(b);
        z += W + 0.03;
        prevUpright = false;
      } else {
        const b = book({});
        if (z + b.t > 0.16) break;
        Object.assign(b, { x: front(b.d), y: sy + b.h / 2, z: z + b.t / 2 });
        books.push(b);
        z += b.t + 0.002;
        prevUpright = true;
      }
    }
  });

  // All spines are painted into one texture atlas: pack the rectangles, then point each spine face at its own
  const ATLAS = isTouch ? 1024 : 2048;   // 16 MB of graphics memory on desktop, 4 MB on phones
  const spineSize = (b, k) => [Math.ceil((b.flat ? b.h : b.t) * k), Math.ceil((b.flat ? b.t : b.h) * k)];
  function packSpines(k) {
    let x = 0, y = 0, rowH = 0;
    for (const b of [...books].sort((a, c) => spineSize(c, 1)[1] - spineSize(a, 1)[1])) {
      const [w, h] = spineSize(b, k);
      if (x + w > ATLAS) { x = 0; y += rowH + 4; rowH = 0; }
      if (y + h > ATLAS) return false;
      b.rect = [x, y, w, h];
      x += w + 4;
      rowH = Math.max(rowH, h);
    }
    return true;
  }
  for (let k = 1500; !packSpines(k); k *= 0.9);

  // The largest font size, up to `start`, at which `text` fits in `max` pixels (never below `min`), set on `g`.
  // Text width grows in step with the size, so one measurement gives it: shrinking step by step and measuring
  // each time took seconds for a full shelf on slower laptops.
  function fit(g, text, max, start, min, font) {
    g.font = font(start);
    const w = g.measureText(text).width;
    if (w <= max) return start;
    const size = Math.max(min, start * max / w * 0.98);
    g.font = font(size);
    return size;
  }
  function drawSpine(g, b) {
    const [x, y, w, h] = b.rect;
    g.fillStyle = b.col[0]; g.fillRect(x, y, w, h);
    g.save();
    g.translate(x + w / 2, y + h / 2);
    if (!b.flat) g.rotate(Math.PI / 2);   // upright spines read top to bottom
    const len = b.flat ? w : h, thick = b.flat ? h : w;
    g.fillStyle = b.col[1];
    g.globalAlpha = 0.75;
    for (const s of [-1, 1]) g.fillRect(s * len * 0.44 - thick * 0.03, -thick * 0.36, thick * 0.06, thick * 0.72);   // bands near each end
    g.globalAlpha = 1;
    if (b.title) {
      const family = b.serif ? '"DM Serif Display", Georgia, serif' : '"DM Sans", system-ui, sans-serif', weight = b.serif ? '' : '500 ';
      const fs = fit(g, b.title, len * 0.54, thick * 0.42, 6, size => `${weight}${size}px ${family}`);
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      g.fillText(b.title, -len * 0.38, 0);
      if (b.author) {
        const name = b.author.split(',')[0];
        fit(g, name, len * 0.2, Math.min(fs * 0.75, thick * 0.3), 5, size => `${size}px "DM Sans", system-ui, sans-serif`);
        g.textAlign = 'right';
        g.globalAlpha = 0.85;
        g.fillText(name, len * 0.38, 0);
        g.globalAlpha = 1;
      }
    }
    g.restore();
  }
  const spineTex = canvasTex(ATLAS, ATLAS, g => books.forEach(b => drawSpine(g, b)));
  textTextures.push(spineTex);
  const spineMat = mat(0xffffff, { map: spineTex, roughness: 0.8 });
  const pagesMat = mat(0xf3ead8, { roughness: 0.95 });
  const coverMats = {};
  const cover = hex => coverMats[hex] ||= mat(new THREE.Color(hex), { roughness: 0.75 });
  for (const b of books) {
    const geo = b.flat ? new THREE.BoxGeometry(b.d, b.t, b.h) : new THREE.BoxGeometry(b.d, b.h, b.t);
    const uv = geo.attributes.uv, [x, y, w, h] = b.rect;
    for (let i = 0; i < 4; i++) uv.setXY(i, (uv.getX(i) ? x + w : x) / ATLAS, 1 - (uv.getY(i) ? y : y + h) / ATLAS);   // +x face = spine
    const c = cover(b.col[0]);
    // box faces: +x spine, −x fore-edge, ±y, ±z — covers are ±z when upright, ±y when lying flat
    const m = new THREE.Mesh(geo, b.flat ? [spineMat, pagesMat, c, c, pagesMat, pagesMat] : [spineMat, pagesMat, pagesMat, pagesMat, c, c]);
    m.position.set(b.x, b.y, b.z);
    m.rotation.x = b.lean || 0;
    m.castShadow = m.receiveShadow = true;
    shelf.add(m);
  }
  addCollider(-3, -2.6, -0.65, 0.55);
  makeInteractive(shelf, 'articles', 'Articles', [-2.8, 2.1, -0.05], [-1.3, -0.05, -2.82, 1.0, -0.05]);
}
