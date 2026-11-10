// Fast mouse picking. Hover tests the mouse against the room on every frame the mouse moves, and merging
// (systems/optimize.js) turned the room into a few big meshes that each span it, so their bounding spheres
// rule nothing out and every triangle was tested. A bounding-volume tree per mesh finds the hit by testing
// only the few triangles near the ray: same results, a small fraction of the work.
import * as THREE from 'three';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { scene } from '../core/renderer.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;   // meshes without a tree yet fall back to the plain test

const skip = () => {};

// Run once the room is built and merged. The trees are built a few meshes at a time when the browser is idle,
// so the first frames aren't held up; picking works meanwhile, only slower.
export function initPicking() {
  const todo = [];
  scene.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.raycast === skip) return;
    // never pickable: don't test it at all (the tulle alone is thousands of triangles)
    if (o.userData.noPick) { o.raycast = skip; return; }
    if (!o.geometry.boundsTree && o.geometry.attributes.position.count > 64) todo.push(o.geometry);
  });
  const idle = window.requestIdleCallback || (f => setTimeout(() => f({ timeRemaining: () => 8 }), 50));
  const work = deadline => {
    while (todo.length && deadline.timeRemaining() > 2) {
      const g = todo.pop();
      if (!g.boundsTree) g.computeBoundsTree();
    }
    if (todo.length) idle(work);
  };
  idle(work);
}
