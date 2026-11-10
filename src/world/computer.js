// The computer on the desk (opens Projects): screen, keyboard and mouse.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C } from '../config.js';
import { part, plane, canvasTex, textTextures } from '../core/build.js';
import { mat } from '../core/materials.js';
import { scene } from '../core/renderer.js';
import { makeInteractive } from '../systems/interactives.js';

export function buildComputer() {
  const computer = new THREE.Group();
  scene.add(computer);
  part(computer, C.cream, -1.83, -1.17, 0.88, 1.3, -2.37, -2.33, 0.012);
  part(computer, C.cream, -1.52, -1.48, 0.76, 0.9, -2.4, -2.36, 0.006);
  part(computer, C.cream, -1.62, -1.38, 0.76, 0.775, -2.44, -2.32, 0.006);
  // keyboard: a thin case tilted up at the back, with real keycap rows — one instanced mesh, so it stays light
  const kb = new THREE.Group();
  kb.position.set(-1.5, 0.763, -2.03);
  kb.rotation.x = 0.05;
  computer.add(kb);
  part(kb, C.cream, -0.155, 0.155, -0.003, 0.012, -0.066, 0.066, 0.006);
  const KP = 0.019;   // key pitch, as on a real board
  const rep = (n, w = 1) => Array(n).fill(w);
  const KROWS = [   // key widths in pitches, negative = gap
    [1, -1, ...rep(4), -0.5, ...rep(4), -0.5, ...rep(4)],
    [...rep(13), 2],
    [1.5, ...rep(12), 1.5],
    [1.75, ...rep(11), 2.25],
    [2.25, ...rep(10), 2.75],
    [...rep(3, 1.25), 6.25, ...rep(4, 1.25)],
  ];
  const keycaps = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 1, 0.2), mat(0xffffff, { roughness: 0.6 }),
    KROWS.flat().filter(w => w > 0).length);
  keycaps.castShadow = keycaps.receiveShadow = true;
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), keyWhite = new THREE.Color(C.white), accent = new THREE.Color(C.pink);
    let k = 0;
    KROWS.forEach((row, r) => {
      let x = -7.5 * KP;
      const z = -0.054 + r * KP + (r ? 0.005 : 0);   // a little gap under the function row
      row.forEach((w, i) => {
        if (w > 0) {
          m4.compose(new THREE.Vector3(x + w * KP / 2, 0.016, z), q, new THREE.Vector3(w * KP - 0.003, 0.008, KP - 0.003));
          keycaps.setMatrixAt(k, m4);
          keycaps.setColorAt(k++, (r === 0 && i === 0) || (r === 3 && i === row.length - 1) ? accent : keyWhite);   // Esc and Enter
        }
        x += Math.abs(w) * KP;
      });
    });
  }
  kb.add(keycaps);

  // mouse on a felt pad: an egg-shaped shell, narrower and lower toward the buttons, with a scroll wheel
  part(computer, C.blush, -1.19, -0.97, 0.76, 0.763, -2.13, -1.93, 0.002);
  const mouseGeo = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const mp = mouseGeo.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    const k = 1 + 0.14 * mp.getZ(i);   // -z is the front
    mp.setX(i, mp.getX(i) * k);
    mp.setY(i, mp.getY(i) * k);
  }
  mouseGeo.computeVertexNormals();
  const mouse = new THREE.Mesh(mouseGeo, mat(C.white, { roughness: 0.5 }));
  mouse.scale.set(0.031, 0.034, 0.056);
  mouse.position.set(-1.08, 0.763, -2.03);
  mouse.castShadow = mouse.receiveShadow = true;
  computer.add(mouse);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.005, 16), mat(0x8a8290, { roughness: 0.7 }));
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(-1.08, 0.763 + 0.026, -2.03 - 0.02);
  computer.add(wheel);
  const screenTex = canvasTex(640, 384, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#f6d7d2'); gr.addColorStop(1, '#cfe0ea');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3b3540'; g.font = '46px "DM Serif Display", Georgia, serif'; g.fillText('My Projects', 40, 88);
    g.fillStyle = '#7d7380'; g.font = '22px "DM Sans", sans-serif'; g.fillText('click to open', 42, 126);
    ['#eab8b2', '#b7cbb0', '#c2d6e2'].forEach((col, i) => {
      g.fillStyle = 'rgba(255, 255, 255, .8)'; g.beginPath(); g.roundRect(40 + i * 192, 168, 172, 172, 14); g.fill();
      g.fillStyle = col; g.beginPath(); g.roundRect(52 + i * 192, 180, 148, 92, 10); g.fill();
      g.fillStyle = 'rgba(59, 53, 64, .25)'; g.fillRect(52 + i * 192, 290, 110, 10); g.fillRect(52 + i * 192, 310, 70, 10);
    });
  });
  textTextures.push(screenTex);
  const screen = plane(0.6, 0.36, new THREE.MeshBasicMaterial({ map: screenTex }), -1.5, 1.09, -2.328);
  computer.add(screen);
  makeInteractive(computer, 'projects', 'Projects', [-1.5, 1.42, -2.3], [-1.5, -0.95, -1.5, 1.05, -2.33]);
}
