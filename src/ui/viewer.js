// The 3D garment viewer inside the panel: a CLO3D .glb (or a stand-in dress) turning slowly, drag to rotate.
// Its code (orbit controls, glTF loader) is downloaded only the first time someone opens it.
import * as THREE from 'three';
import { h } from '../util.js';
import { dressGeometry } from '../world/rack.js';

let viewer = null;

function placeholderDress(color) {
  return new THREE.Mesh(dressGeometry(1.1), new THREE.MeshStandardMaterial({ color: new THREE.Color(color || '#e8b9b5'), roughness: 0.7, side: THREE.DoubleSide }));
}

export function openViewer(item, target) {
  if (!target || target.classList.contains('viewer')) return;
  disposeViewer();
  const msg = h('div', { class: 'msg' }, item.model ? 'Loading model…' : 'Placeholder dress — add a .glb from CLO3D in content.js');
  const el = h('div', { class: 'viewer' }, msg);
  target.replaceWith(el);
  const v = viewer = { el, restore: target, raf: 0 };

  Promise.all([import('three/addons/controls/OrbitControls.js'), import('three/addons/loaders/GLTFLoader.js')]).then(([{ OrbitControls }, { GLTFLoader }]) => {
    if (viewer !== v) return;   // closed while the code was loading
    const r = v.r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    el.prepend(r.domElement);
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight(0xffffff, 0xe8d5cc, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(2, 3, 2);
    s.add(key);
    const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    const controls = v.controls = new OrbitControls(cam, r.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;
    const show = obj => {
      const b = new THREE.Box3().setFromObject(obj);
      const size = b.getSize(new THREE.Vector3()), center = b.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      const dist = Math.max(size.x, size.y, size.z) * 2.1;
      cam.position.set(dist * 0.45, dist * 0.12, dist);
      cam.near = dist / 100; cam.far = dist * 10;
      cam.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      s.add(obj);
    };
    if (item.model) {
      new GLTFLoader().load(item.model,
        gltf => { show(gltf.scene); msg.remove(); },
        undefined,
        () => { msg.textContent = 'Could not load the model — showing a placeholder.'; show(placeholderDress(item.color)); });
    } else {
      show(placeholderDress(item.color));
    }
    v.ro = new ResizeObserver(() => {
      const w = el.clientWidth, hh = el.clientHeight;
      if (!w || !hh) return;
      r.setSize(w, hh);
      cam.aspect = w / hh;
      cam.updateProjectionMatrix();
    });
    v.ro.observe(el);
    const tick = () => { v.raf = requestAnimationFrame(tick); controls.update(); r.render(s, cam); };
    tick();
  }).catch(() => { msg.textContent = 'Could not load the 3D viewer — check your connection.'; });
}

export function disposeViewer() {
  if (!viewer) return;
  cancelAnimationFrame(viewer.raf);
  viewer.ro?.disconnect();
  viewer.controls?.dispose();
  viewer.r?.dispose();
  viewer.el.replaceWith(viewer.restore);
  viewer = null;
}
