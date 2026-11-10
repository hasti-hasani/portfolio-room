// The whiteboard with HCI and ML sticky notes (titles from content.js) and marker sketches. Decorative.
import * as THREE from 'three';
import P from '../content.js';
import { C, X, HQ } from '../config.js';
import { part, plane, rod3, canvasTex, textTextures } from '../core/build.js';
import { mat } from '../core/materials.js';
import { scene } from '../core/renderer.js';

export function buildWhiteboard() {
  const board = new THREE.Group();
  scene.add(board);
  const BD = { z0: -1.78, z1: -0.72, y0: 0.95, y1: 1.75 };   // board size
  const alu = mat(0xd9dadc, { metalness: HQ ? 0.85 : 0.4, roughness: 0.3 });
  for (const [y0, y1, z0, z1] of [[BD.y1, BD.y1 + 0.025, BD.z0 - 0.025, BD.z1 + 0.025], [BD.y0 - 0.025, BD.y0, BD.z0 - 0.025, BD.z1 + 0.025],
    [BD.y0, BD.y1, BD.z0 - 0.025, BD.z0], [BD.y0, BD.y1, BD.z1, BD.z1 + 0.025]]) part(board, alu, -X, -X + 0.03, y0, y1, z0, z1, 0.005);
  part(board, alu, -X, -X + 0.075, BD.y0 - 0.045, BD.y0 - 0.025, BD.z0 + 0.1, BD.z1 - 0.1, 0.004);   // marker tray
  part(board, alu, -X + 0.068, -X + 0.075, BD.y0 - 0.045, BD.y0 - 0.01, BD.z0 + 0.1, BD.z1 - 0.1, 0.002);   // its lip
  // markers lying in the tray, and an eraser
  [['#3f4d72', -1.45], ['#c8362d', -1.3], ['#4f9ea0', -1.16]].forEach(([col, z]) => {
    rod3([-X + 0.045, BD.y0 - 0.016, z], [-X + 0.045, BD.y0 - 0.016, z + 0.12], 0.009, mat(C.white, { roughness: 0.4 }), board);
    rod3([-X + 0.045, BD.y0 - 0.016, z + 0.12], [-X + 0.045, BD.y0 - 0.016, z + 0.14], 0.0095, mat(new THREE.Color(col), { roughness: 0.4 }), board);
  });
  part(board, mat(0x3b3540, { roughness: 0.8 }), -X + 0.022, -X + 0.066, BD.y0 - 0.025, BD.y0 + 0.005, -1.0, -0.88, 0.006);   // eraser: felt below,
  part(board, mat(C.blush, { roughness: 0.5 }), -X + 0.024, -X + 0.064, BD.y0 + 0.005, BD.y0 + 0.02, -0.995, -0.885, 0.006);   // a handle on top
  // note slots on the canvas: [x, y, tilt]
  const HCI_NOTES = [[50, 45, -0.04], [255, 70, 0.03], [55, 270, 0.02]];
  const ML_NOTES = [[630, 45, 0.03], [840, 65, -0.04], [845, 290, -0.03]];
  const NOTE = 170;
  function wrapText(g, text, x, y, maxW, lh, maxLines) {
    const words = text.split(' ');
    let line = '', n = 0;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (g.measureText(test).width > maxW && line) {
        g.fillText(line, x, y + n * lh);
        if (++n >= maxLines) return;
        line = w;
      } else line = test;
    }
    if (line) g.fillText(line, x, y + n * lh);
  }
  const boardTex = canvasTex(1060, 800, (g, w, hh) => {
    const r = (seed => () => (seed = seed * 16807 % 2147483647) / 2147483647)(7);
    g.fillStyle = '#fbfbfa'; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 7; i++) {   // faint grey ghosts of older, wiped-off sketches
      g.fillStyle = 'rgba(120, 125, 140, .05)';
      g.beginPath(); g.ellipse(r() * w, r() * hh, 60 + r() * 120, 20 + r() * 40, r() * 3, 0, Math.PI * 2); g.fill();
    }
    const ink = '#3b3540', navy = '#3f4d72', red = '#c8362d', teal = '#3f8f8c';
    // marker strokes: round ends, a slight wobble like a hand-drawn line
    const pen = (col, lw = 4) => { g.strokeStyle = col; g.fillStyle = col; g.lineWidth = lw; g.lineCap = g.lineJoin = 'round'; };
    const scrawl = pts => {
      g.beginPath();
      pts.forEach(([x, y], i) => { const jx = x + (r() - 0.5) * 2.5, jy = y + (r() - 0.5) * 2.5; i ? g.lineTo(jx, jy) : g.moveTo(jx, jy); });
      g.stroke();
    };
    const line = (x0, y0, x1, y1, steps = 8) => scrawl(Array.from({ length: steps + 1 }, (_, i) => [x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps]));
    const box = (x, y, bw, bh) => { line(x, y, x + bw, y); line(x + bw, y, x + bw, y + bh); line(x + bw, y + bh, x, y + bh); line(x, y + bh, x, y); };
    const arrow = (x0, y0, x1, y1) => {
      line(x0, y0, x1, y1);
      const a = Math.atan2(y1 - y0, x1 - x0);
      for (const s of [-1, 1]) line(x1, y1, x1 - 16 * Math.cos(a + s * 0.5), y1 - 16 * Math.sin(a + s * 0.5), 2);
    };
    // sticky notes
    const note = (x, y, tilt, fill, title) => {
      g.save(); g.translate(x + NOTE / 2, y + NOTE / 2); g.rotate(tilt);
      g.shadowColor = 'rgba(40, 35, 50, .18)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
      g.fillStyle = fill; g.fillRect(-NOTE / 2, -NOTE / 2, NOTE, NOTE);
      g.shadowColor = 'transparent';
      g.fillStyle = 'rgba(0, 0, 0, .05)'; g.fillRect(-NOTE / 2, -NOTE / 2, NOTE, 22);   // the sticky strip
      g.fillStyle = ink; g.font = '500 25px "DM Sans", sans-serif';
      wrapText(g, title, -NOTE / 2 + 16, -NOTE / 2 + 56, NOTE - 32, 31, 4);
      g.restore();
    };
    const notes = (slots, items, colors) => slots.forEach(([x, y, tilt], i) => note(x, y, tilt, colors[i % colors.length], items[i]?.title || 'Add a note in content.js'));
    notes(HCI_NOTES, P.board?.hci || [], ['#f6c9c2', '#fbe7a6', '#f3d6cf']);
    notes(ML_NOTES, P.board?.ml || [], ['#c2d6e2', '#cfe3c6', '#d9d0ec']);
    // a phone wireframe in navy marker: header, image, text lines and a button
    pen(navy, 4);
    g.beginPath(); g.roundRect(285, 290, 130, 250, 18); g.stroke();
    box(300, 318, 100, 18);
    box(300, 350, 100, 70); line(300, 350, 400, 420); line(400, 350, 300, 420);
    pen(navy, 3); for (const [y, x1] of [[440, 400], [456, 400], [472, 360]]) line(300, y, x1, y, 4);
    pen('#e79a92', 14); line(318, 505, 382, 505, 3);
    // a small neural network in teal marker
    const layers = [[330, 400, 470], [310, 370, 430, 490], [370, 430]].map((ys, li) => ys.map(y => [570 + li * 85, y]));
    pen('rgba(63, 143, 140, .55)', 2.5);
    for (let li = 0; li < 2; li++) for (const [ax, ay] of layers[li]) for (const [bx, by] of layers[li + 1]) line(ax, ay, bx, by, 4);
    pen(teal, 4);
    layers.flat().forEach(([x, y]) => { g.fillStyle = '#fbfbfa'; g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.fill(); g.stroke(); });
    // a red arrow from the interface to the model: where the two meet
    pen(red, 5); arrow(440, 400, 535, 400);
    // bottom left: a little user flow, three steps
    pen(navy, 4);
    [[45, 640], [195, 640], [345, 640]].forEach(([x, y], i) => { box(x, y, 105, 62); if (i) arrow(x - 42, y + 31, x - 6, y + 31); });
    // bottom right: a loss curve falling and levelling off
    pen(ink, 3.5); arrow(640, 750, 640, 590); arrow(640, 750, 960, 750);
    pen(red, 4); scrawl(Array.from({ length: 25 }, (_, i) => { const t = i / 24; return [655 + t * 280, 600 + 130 * (1 - Math.exp(-t * 4))]; }));
    // a tick and a circled question mark beside two notes, as if someone has been working through them
    pen(teal, 5); scrawl([[1020, 260], [1030, 272], [1048, 240]]);
    pen(red, 4); g.beginPath(); g.arc(240, 270, 18, 0, Math.PI * 2); g.stroke();
    g.font = '700 24px "DM Sans", sans-serif'; g.fillText('?', 233, 279);
  });
  textTextures.push(boardTex);
  plane(BD.z1 - BD.z0, BD.y1 - BD.y0, mat(0xffffff, { map: boardTex, roughness: 0.25 }), -X + 0.031, (BD.y0 + BD.y1) / 2, (BD.z0 + BD.z1) / 2, Math.PI / 2, board);
}
