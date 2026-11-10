// Paintings (photos, so only when served) and the woven label on the rug; each opens its story from content.js.
import * as THREE from 'three';
import P from '../content.js';
import { C, X, Z, HQ, RES } from '../config.js';
import { part, plane, canvasTex, addCollider, textTextures } from '../core/build.js';
import { mat } from '../core/materials.js';
import { tex } from '../core/loaders.js';
import { scene } from '../core/renderer.js';
import { makeInteractive } from '../systems/interactives.js';
import { RUG } from './rug.js';

export function buildPaintings() {
  function painting(file, w, h, x, y, z, ry, parent) {
    const m = mat(0xffffff, { normalMap: tex(`textures/rough_linen/rough_linen_nor_gl_${RES}.webp`, [3, 2]),
      normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.7, visible: false });
    m.map = tex(`art/${file}`, null, true, () => { m.visible = true; });
    return plane(w, h, m, x, y, z, ry, parent);
  }
  // Clicking a painting (or the rug's label) walks to it and opens its description from content.js — no floating label.
  // `frame` (w × h in metres) makes the camera zoom in on it until it fills the screen beside the panel.
  const artInfo = (group, key, view, frame) => {
    if (!P.artworks?.[key]) return;
    const it = makeInteractive(group, `art-${key}`, '', [0, 0, 0], view, { hotspot: false });
    it.view.frame = frame;
  };
  if (HQ) {
    // still life above the couch (Bahman Mohassess), in a slim wooden frame
    const stillLife = new THREE.Group();
    scene.add(stillLife);
    const PW = 1.45, PH = PW * 760 / 1200;
    part(stillLife, C.wood, X - 0.045, X, 1.68 - PH / 2 - 0.035, 1.68 + PH / 2 + 0.035, 0.2 - PW / 2 - 0.035, 0.2 + PW / 2 + 0.035, 0.008);
    painting('still-life-fish.webp', PW, PH, X - 0.047, 1.68, 0.2, -Math.PI / 2, stillLife);
    artInfo(stillLife, 'stillLife', [0.6, 0.2, X, 1.68, 0.2], { w: PW + 0.07, h: PH + 0.07 });   // as close as the couch allows

    // the mask (Mansour Ghandriz), large, on the wall between the rack and the door: oak frame around a cream mount
    const mask = new THREE.Group();
    scene.add(mask);
    const MH = 1.15, MW = MH * 557 / 760, MX = -1.1, MY = 1.45, MAT = 0.07, F = 0.05;
    part(mask, C.cream, MX - MW / 2 - MAT, MX + MW / 2 + MAT, MY - MH / 2 - MAT, MY + MH / 2 + MAT, Z - 0.025, Z, 0.004);
    const ox = MW / 2 + MAT, oy = MH / 2 + MAT;
    part(mask, C.woodLight, MX - ox - F, MX + ox + F, MY + oy, MY + oy + F, Z - 0.055, Z, 0.006);   // top
    part(mask, C.woodLight, MX - ox - F, MX + ox + F, MY - oy - F, MY - oy, Z - 0.055, Z, 0.006);   // bottom
    part(mask, C.woodLight, MX - ox - F, MX - ox, MY - oy, MY + oy, Z - 0.055, Z, 0.006);           // left
    part(mask, C.woodLight, MX + ox, MX + ox + F, MY - oy, MY + oy, Z - 0.055, Z, 0.006);           // right
    painting('mask.webp', MW, MH, MX, MY, Z - 0.027, Math.PI, mask);
    artInfo(mask, 'mask', [MX, 1.3, MX, MY, Z], { w: 2 * (ox + F), h: 2 * (oy + F) });

    // Ali Akbar Sadeghi: a big painting in a deep oak frame, standing on the floor and leaning on the wall right of the door
    const lean = new THREE.Group();
    scene.add(lean);
    const LW = 0.7, LH = LW * 760 / 522, LF = 0.06, LD = 0.045, TILT = 0.17;   // picture, frame width and depth, lean angle
    const LFH = LH + 2 * LF;
    // the group's origin is the back bottom edge on the floor; its top leans back onto the wall
    lean.position.set(1.85, 0, Z - 0.005 - LFH * Math.sin(TILT));
    lean.rotation.x = TILT;
    const lox = LW / 2 + LF;
    part(lean, C.wood, -lox, lox, LFH - LF, LFH, -LD, 0, 0.008);   // top
    part(lean, C.wood, -lox, lox, 0, LF, -LD, 0, 0.008);           // bottom
    part(lean, C.wood, -lox, -lox + LF, LF, LFH - LF, -LD, 0, 0.008);   // left
    part(lean, C.wood, lox - LF, lox, LF, LFH - LF, -LD, 0, 0.008);     // right
    part(lean, C.wood, -lox + LF, lox - LF, LF, LFH - LF, -0.012, -0.004, 0);   // backing board
    painting('sadeghi.webp', LW, LH, 0, LF + LH / 2, -0.014, Math.PI, lean);
    addCollider(1.85 - lox, 1.85 + lox, Z - 0.3, Z);
    artInfo(lean, 'sadeghi', [1.85, 1.0, 1.85, 0.65, Z], { w: 2 * lox, h: LFH });

    // A woven label on the rug's corner, like the tags on real carpets: clicking it tells the rug's story.
    // (The rug itself stays a floor to walk on.)
    const tagTex = canvasTex(256, 168, (g, w, h) => {
      g.fillStyle = '#fbf3e8'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#c66a5f'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
      g.textAlign = 'center'; g.fillStyle = '#3f4d72';
      g.font = '40px "DM Serif Display", Georgia, serif'; g.fillText('Kashan', w / 2, 82);
      g.fillStyle = '#857b86'; g.font = '22px "DM Sans", sans-serif'; g.fillText('silk · Iran', w / 2, 122);
    });
    textTextures.push(tagTex);
    const rugTag = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), mat(0xffffff, { map: tagTex, roughness: 1 }));
    rugTag.rotation.set(-Math.PI / 2, 0, 0.12);
    rugTag.position.set(RUG.x + RUG.d / 2 - 0.16, 0.009, RUG.z + RUG.w / 2 - 0.12);
    rugTag.receiveShadow = true;
    scene.add(rugTag);
    artInfo(rugTag, 'rug', [0.9, 2.0, RUG.x, 0, RUG.z]);
  }
}
