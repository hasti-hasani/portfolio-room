// Three framed certificates on the wall above the desk (opens Certificates).
import P from '../content.js';
import { C, Z } from '../config.js';
import { part, plane, canvasTex, textTextures } from '../core/build.js';
import { mat } from '../core/materials.js';
import { scene } from '../core/renderer.js';
import * as THREE from 'three';
import { makeInteractive } from '../systems/interactives.js';

export function buildCertificates() {
  const certs = new THREE.Group();
  scene.add(certs);
  [-2.15, -1.5, -0.85].forEach((cx, i) => {
    part(certs, C.gold, cx - 0.23, cx + 0.23, 1.65, 1.99, -Z, -Z + 0.03, 0.008);
    const title = P.certificates?.[i]?.title || 'Certificate';
    const tex = canvasTex(512, 360, (g, w, h) => {
      g.fillStyle = '#fffdf8'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#dcc7a0'; g.lineWidth = 8; g.strokeRect(16, 16, w - 32, h - 32);
      g.textAlign = 'center'; g.fillStyle = '#3b3540';
      g.font = '34px "DM Serif Display", Georgia, serif'; g.fillText('Certificate', w / 2, 100);
      g.fillStyle = '#857b86'; g.font = '22px "DM Sans", sans-serif'; g.fillText(title.slice(0, 32), w / 2, 150);
      g.fillStyle = 'rgba(59, 53, 64, .15)'; g.fillRect(w / 2 - 120, 190, 240, 6); g.fillRect(w / 2 - 80, 210, 160, 6);
      g.fillStyle = ['#eab8b2', '#b7cbb0', '#c2d6e2'][i]; g.beginPath(); g.arc(w / 2, 275, 34, 0, Math.PI * 2); g.fill();
    });
    textTextures.push(tex);
    certs.add(plane(0.4, 0.28, mat(0xffffff, { map: tex }), cx, 1.82, -Z + 0.032));
  });
  makeInteractive(certs, 'certificates', 'Certificates', [-1.5, 2.13, -2.45], [-1.5, -0.55, -1.5, 1.8, -2.5]);
}
