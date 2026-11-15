import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

// A tuxedo cat that wanders a floor area by itself: it idles, looks around,
// stretches now and then, walks to a free spot, and hops when clicked, then
// looks at the viewer. Plain three.js, no framework needed.
//
//   const cat = await TuxedoCat.load({ url: "/models/tuxedo-cat.glb" });
//   scene.add(cat.object);
//   cat.attachPointer(renderer.domElement, camera); // click -> hop
//   // every frame:
//   cat.update(deltaSeconds, camera);
//
// The GLB is meshopt-compressed with a WebP texture (~190 KB): one skinned
// mesh, one draw call, four clips (Idle, Walk, Stretch, React).
//
// Motion: the head leads (it looks where it's going, then the body follows),
// the body walks curves with a minimum turning radius and an eased turn rate,
// so it never spins on the spot, and planted paws are locked to the floor.
// Cost: one AnimationMixer (paused while the cat is off-screen), clicks hit
// an invisible box instead of the skinned mesh, and a blob instead of a real
// shadow.
//
// Everything below is tuned in "cat metres": the cat at scale 0.5 (~0.44 m to
// the ear tips, 1 unit = 1 m). The `scale` option resizes the cat and every
// distance and speed with it, so it also works in scenes with other units.

const SCALE = 0.5;

// Walk clip: a planted paw moves back at 0.42 model units/s (measured), so
// ground speed = 0.42 * SCALE * timeScale keeps the paws from sliding.
const WALK_RATE = 1.4;
const STRIDE_SPEED = 0.42 * SCALE; // m/s at timeScale 1
const WALK_SPEED = STRIDE_SPEED * WALK_RATE;
const TURN_RADIUS = 0.32; // m, tightest curve it walks
const BODY_R = 0.26; // clearance around the cat's center (covers nose/tail)
const PATH_MARGIN = 0.12; // extra room on planned lines: curves bulge out
const HEAD_MAX = 0.75; // rad the head turns off the body
const HEAD_W = 4.5; // head spring stiffness (rad/s): settles in ~0.9s
const HEAD_SPEED = 2.2; // rad/s, fastest head turn
// How lifted a front paw is (0 planted .. 1 highest) over the Walk cycle, 20
// steps (measured from the clip). A turning cat swings round while a paw is
// in the air and holds while both are down, so the turn is weighted by this.
const FRONT_LIFT = [
  0.91, 0.93, 0.99, 0.91, 0.71, 0.29, 0.06, 0, 0.09, 0.52,
  0.81, 0.97, 1, 0.84, 0.55, 0.12, 0.03, 0.01, 0.23, 0.65,
];
const liftAt = (phase) => {
  const f = (phase - Math.floor(phase)) * FRONT_LIFT.length;
  const i = Math.floor(f);
  const a = FRONT_LIFT[i];
  const b = FRONT_LIFT[(i + 1) % FRONT_LIFT.length];
  return a + (b - a) * (f - i);
};
const TURN_MAX = 1.25; // rad/s
const MIN_RADIUS = 0.14; // m: no turning faster than the speed allows
const TURN_SPEED = 0.17; // m/s, slowest walk while turning
const turnLimit = (speed) => Math.min(TURN_MAX, speed / MIN_RADIUS);
const PIVOT_BACK = 0.12; // m from the cat's middle back to its hind legs
const BEND_GAIN = 0.2; // spine bend (rad) per rad/s of turning
const BEND_MAX = 0.25;
// Past this angle (rad) a target is "right behind": keep turning the way it
// already was instead of flipping sides as the angle crosses 180°.
const STICKY = 2.6;
const stickySide = (a, side) =>
  Math.abs(a) > STICKY && side !== 0 && Math.sign(a) !== side
    ? a + side * Math.PI * 2
    : a;
// React clip: crouch 0-0.24s, hop peaks ~0.54s, lands ~0.72s. Starting
// mid-crouch and playing it faster puts the hop right on the click.
const REACT_START = 0.12;
const REACT_RATE = 1.4;
// Stretch clip: full stretch ~1.0s, holds to ~2.3s, recovers by 3.1s. It
// plays slower overall and much slower through the hold.
const STRETCH_BONES = /^(spine|chest|neck|head|tail[0-9])$/;
const STRETCH_BOOST = 0.5; // extra share of the body pose added on top
// Procedural life on top of the clips: a tail swish that ripples from the
// base to the tip, and now and then a quick ear twitch.
const TAIL_AMP = [0.06, 0.1, 0.14, 0.18]; // rad per tail bone, base -> tip
const TAIL_LAG = 0.7;
const EAR_TWITCH = 0.22; // s
const EAR_ANGLE = 0.55; // rad
const HOME_CHANCE = 0.8;
const PLANT_EPS = 0.006; // model units above rest height still count as down
const LOCK_MAX = 0.45; // rad, largest leg correction
const BLOB_Y = 0.0068;
// studio change: nearest it walks up to the player (m from the player's middle: about their body plus a little).
// It can't turn on the spot, so a player standing right in front must let it swing round close by.
const CLOSE_MIN = 0.34;
const ESCAPE = 0.45; // studio change: see pathClear
const GRID = 0.1; // route-finding cell (cat metres)
const TIGHT_COST = 6;
const TURN_IN_PLACE = 0.9; // rad/s: a cautious shuffle round, slow enough that the paws barely skate // a step close to furniture costs this many open steps

const IDLE = 0;
const STRETCH = 1;
const WALK = 2;
const REACT = 3;
const TURN = 4; // studio change: a slow turn on the spot, only when it's boxed in (see unstick)

const LOOK_AHEAD = 0;
const LOOK_CAMERA = 1;
const LOOK_GLANCE = 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const stretchRate = (t) => {
  const hold = smoothstep(0.8, 1.1, t) * (1 - smoothstep(2.15, 2.45, t));
  return 0.85 + (0.3 - 0.85) * hold;
};
const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
// frame-rate independent exponential approach
const approach = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));

// scratch objects, shared: nothing is allocated per frame
const _sphere = new THREE.Sphere();
const _frustum = new THREE.Frustum();
const _projScreen = new THREE.Matrix4();
const _qParent = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _qInv = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _fp = new THREE.Vector3();
const _sp = new THREE.Vector3();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qId = new THREE.Quaternion();
const _ndc = new THREE.Vector2();
const _ray = new THREE.Raycaster();
const _hits = [];

// turns a bone about the world up axis by `angle`, on top of its clip pose
const addWorldYaw = (bone, angle) => {
  bone.parent.getWorldQuaternion(_qParent);
  _qInv.copy(_qParent).invert();
  _qYaw.setFromAxisAngle(_up, angle);
  _qYaw.premultiply(_qInv).multiply(_qParent);
  bone.quaternion.premultiply(_qYaw);
};

let blobMaterial = null;
const getBlobMaterial = () => {
  if (blobMaterial) return blobMaterial;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(0,0,0,0.75)");
  g.addColorStop(0.55, "rgba(0,0,0,0.35)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  blobMaterial = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthWrite: false,
    opacity: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  return blobMaterial;
};

const noRaycast = () => {};
// swaps two [cost, cell] entries of the flat route-finding heap
const swap = (h, a, b) => {
  let t = h[a * 2];
  h[a * 2] = h[b * 2];
  h[b * 2] = t;
  t = h[a * 2 + 1];
  h[a * 2 + 1] = h[b * 2 + 1];
  h[b * 2 + 1] = t;
};

export class TuxedoCat {
  /**
   * Loads the model and returns a ready cat. All positions are world space.
   * @param {object} [options]
   * @param {string} [options.url="/models/tuxedo-cat.glb"]
   * @param {number} [options.scale=0.5] 0.5 = a real-size cat when 1 unit = 1 m
   * @param {number} [options.floorY=0] height of the floor it walks on
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} [options.area]
   *   rectangle it never leaves (default: 6 x 6 around the origin)
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} [options.home]
   *   favourite part of the area: most walks end here (default: the area)
   * @param {Array<{minX:number,maxX:number,minZ:number,maxZ:number}>} [options.obstacles]
   *   boxes on the floor it walks around (furniture)
   * @param {(x:number, z:number, radius:number) => boolean} [options.isBlocked]
   *   extra test for places it can't stand
   * @param {THREE.Vector3 | (() => THREE.Vector3 | null)} [options.avoid]
   *   something it keeps away from (a player character)
   * @param {{x:number, z:number, yaw?:number}} [options.start]
   * @param {boolean} [options.shadow=true] soft blob under the cat
   * @param {boolean} [options.unlit=false] ignore scene lights
   * @param {number} [options.animationFps=0] cap for the skeleton update
   *   (e.g. 30 on weak devices); 0 = every frame
   * @param {THREE.LoadingManager} [options.manager]
   */
  static async load(options = {}) {
    const loader = new GLTFLoader(options.manager);
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(options.url ?? "/models/tuxedo-cat.glb");
    return new TuxedoCat(gltf, options);
  }

  constructor(gltf, options = {}) {
    const scene = gltf.scene;
    this.model = scene;
    // world units per "cat metre"
    const k = (options.scale ?? SCALE) / SCALE;
    this.k = k;
    this.floorY = options.floorY ?? 0;
    this.animStep = options.animationFps > 0 ? 1 / options.animationFps : 0;
    this.avoid = options.avoid ?? null;
    this.customBlocked = options.isBlocked ?? null;

    const toRect = (r) => [r.minX / k, r.maxX / k, r.minZ / k, r.maxZ / k];
    this.area = toRect(options.area ?? { minX: -3, maxX: 3, minZ: -3, maxZ: 3 });
    this.home = options.home ? toRect(options.home) : this.area;
    this.obstacles = (options.obstacles ?? []).map(toRect);
    this.grid = null; // floor grid for route finding, built on the first walk that needs it

    // ---- rig
    const mixer = new THREE.AnimationMixer(scene);
    const clip = (name) => {
      const c = gltf.animations.find((a) => a.name === name);
      return c ? mixer.clipAction(c) : null;
    };
    const actions = {
      idle: clip("Idle"),
      walk: clip("Walk"),
      stretch: clip("Stretch"),
      react: clip("React"),
    };
    // deeper stretch: the spine/neck/head/tail part of the clip again, added
    // on top. Hips and legs stay as authored so the paws stay on the floor.
    if (actions.stretch) {
      const sub = actions.stretch.getClip().clone();
      sub.tracks = sub.tracks.filter((t) => STRETCH_BONES.test(t.name.split(".")[0]));
      THREE.AnimationUtils.makeClipAdditive(sub, 0);
      actions.stretchBoost = mixer.clipAction(sub);
      actions.stretchBoost.blendMode = THREE.AdditiveAnimationBlendMode;
    }
    [actions.stretch, actions.stretchBoost, actions.react].forEach((a) => {
      if (!a) return;
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    });

    this.ownedMaterials = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      // clicks go to the hit box, never the skinned mesh (three raycasts a
      // SkinnedMesh by skinning every vertex on the CPU)
      o.raycast = noRaycast;
      if (options.unlit && o.material?.map) {
        const lit = o.material;
        o.material = new THREE.MeshBasicMaterial({ map: lit.map, side: lit.side });
        lit.dispose();
      }
      this.ownedMaterials.push(o.material);
    });
    // three strips the dots from bone names ("ear.L" -> "earL")
    const bone = (n) => scene.getObjectByName(n);
    const neck = bone("neck");
    const head = bone("head");
    const spine = bone("spine");
    const chest = bone("chest");
    // legs for foot locking: upper bone (aimed) + paw bone (end), rest height
    // of the paw bone when planted (model units, measured from the clips)
    const legs = [
      ["upperarmL", "fpawL", 0.053],
      ["upperarmR", "fpawR", 0.053],
      ["thighL", "toeL", 0.023],
      ["thighR", "toeR", 0.023],
    ]
      .map(([u, e, rest]) => ({
        upper: bone(u),
        end: bone(e),
        rest,
        locked: false,
        tx: 0,
        tz: 0,
        w: 0,
      }))
      .filter((l) => l.upper && l.end);
    const tail = ["tail1", "tail2", "tail3", "tail4"].map(bone);
    const ears = [bone("earL"), bone("earR")];
    // clean clip pose of the bones turned on top of the animation. The mixer
    // only writes a bone when its animated value changed, so without
    // restoring this first the extra turn would pile up frame after frame
    const posed = [spine, chest, neck, head, ...legs.map((l) => l.upper), ...tail, ...ears]
      .filter(Boolean)
      .map((b) => ({ bone: b, q: b.quaternion.clone() }));
    this.rig = { mixer, actions, neck, head, spine, chest, legs, posed, tail, ears };

    // ---- scene objects
    const start = options.start ?? {
      x: ((this.home[0] + this.home[1]) / 2) * k,
      z: ((this.home[2] + this.home[3]) / 2) * k,
    };
    this.object = new THREE.Group();
    this.object.name = "TuxedoCat";
    this.object.scale.setScalar(k);
    scene.scale.setScalar(SCALE);
    this.object.add(scene);

    this.blobGeo = null;
    if (options.shadow !== false) {
      this.blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      const blob = new THREE.Mesh(this.blobGeo, getBlobMaterial());
      blob.position.set(0, BLOB_Y, -0.02);
      blob.scale.set(0.26, 1, 0.58);
      blob.raycast = noRaycast;
      this.object.add(blob);
    }
    // hit box: generous so the cat is easy to tap on a phone
    this.hitGeo = new THREE.BoxGeometry(0.34, 0.42, 0.7);
    this.hitMat = new THREE.MeshBasicMaterial();
    this.hitBox = new THREE.Mesh(this.hitGeo, this.hitMat);
    this.hitBox.position.set(0, 0.2, -0.02);
    this.hitBox.visible = false;
    this.object.add(this.hitBox);

    // all behavior state, in cat metres
    this.s = {
      state: IDLE,
      timer: rand(3, 6),
      current: null,
      x: start.x / k,
      z: start.z / k,
      yaw: start.yaw ?? 0, // 0 faces +Z
      turnVel: 0,
      speed: 0,
      // route: corner points then the target, flat [x, z, x, z, ...]
      route: [],
      routeLen: 0,
      routeIdx: 0,
      look: LOOK_AHEAD,
      calm: 0, // > 0: the player being close doesn't hurry it off (just failed to get away)
      stuck: 0, // failed walks in a row (studio change: see unstick)
      turnTo: 0, // heading a TURN aims for
      lookTimer: 0,
      glance: 0,
      headYaw: 0,
      headVel: 0,
      attend: false,
      shuffling: false,
      turnSign: 0,
      lookSign: 0,
      bend: 0,
      legRate: 0.3,
      stretchT: 0,
      animAcc: 0,
      tailT: rand(0, 6),
      earTimer: rand(2, 6),
      earT: -1, // < 0: no twitch running
      earSide: 0,
    };
    this.object.position.set(start.x, this.floorY, start.z);
    this.object.rotation.y = this.s.yaw;
    this.fadeTo(actions.idle, 0);
    mixer.update(0);
  }

  // ---- public

  /** World position of the cat (same object every call). */
  get position() {
    return this.object.position;
  }

  /** The hop + "look at you" the click plays. */
  react() {
    const react = this.rig.actions.react;
    if (!react) return;
    const st = this.s;
    const total = (react.getClip().duration - REACT_START) / REACT_RATE;
    // a second click mid-hop doesn't restart it
    if (st.state === REACT && st.timer > total * 0.35) return;
    st.state = REACT;
    st.timer = total;
    st.speed = 0;
    st.attend = false;
    st.look = LOOK_AHEAD; // hop first, look at you after landing
    if (st.current === react) st.current = null; // allow replay
    this.fadeTo(react, 0.05);
    react.time = REACT_START;
    react.setEffectiveTimeScale(REACT_RATE);
    // show the first frame of the hop on this very click
    st.animAcc = Math.max(st.animAcc, 1 / 30);
  }

  /** True when the raycaster's ray hits the cat. */
  hitTest(raycaster) {
    _hits.length = 0;
    this.object.updateWorldMatrix(true, true);
    raycaster.intersectObject(this.hitBox, false, _hits);
    return _hits.length > 0;
  }

  /**
   * Click/tap -> react(), and a pointer cursor over the cat. A press that
   * moved (a camera drag) doesn't count. Returns a function that detaches.
   */
  attachPointer(domElement, camera) {
    let downX = 0;
    let downY = 0;
    let hovering = false;
    const over = (e) => {
      const r = domElement.getBoundingClientRect();
      _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      _ray.setFromCamera(_ndc, camera);
      return this.hitTest(_ray);
    };
    const onDown = (e) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onUp = (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      if (over(e)) this.react();
    };
    const onMove = (e) => {
      if (e.pointerType !== "mouse" || e.buttons) return;
      const h = over(e);
      if (h === hovering) return;
      hovering = h;
      domElement.style.cursor = h ? "pointer" : "";
    };
    domElement.addEventListener("pointerdown", onDown);
    domElement.addEventListener("pointerup", onUp);
    domElement.addEventListener("pointermove", onMove);
    return () => {
      domElement.removeEventListener("pointerdown", onDown);
      domElement.removeEventListener("pointerup", onUp);
      domElement.removeEventListener("pointermove", onMove);
      if (hovering) domElement.style.cursor = "";
    };
  }

  dispose() {
    this.rig.mixer.stopAllAction();
    this.rig.mixer.uncacheRoot(this.model);
    this.object.removeFromParent();
    this.model.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
      if (o.isSkinnedMesh) o.skeleton.dispose();
    });
    this.ownedMaterials.forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
    this.blobGeo?.dispose();
    this.hitGeo.dispose();
    this.hitMat.dispose();
  }

  // ---- world queries (cat metres in, world units asked of the options)

  playerNear(x, z, r) {
    const p = typeof this.avoid === "function" ? this.avoid() : this.avoid;
    if (!p) return false;
    const dx = x - p.x / this.k;
    const dz = z - p.z / this.k;
    return dx * dx + dz * dz < r * r;
  }

  // a step that ends within r of the player AND closer than before: walking away from someone close is always allowed
  // (studio change: the kit stopped any step ending within 0.6 m, so a cat already that close stopped on every step,
  // and flickered between walking and standing)
  closingIn(x0, z0, x1, z1, r) {
    const p = typeof this.avoid === "function" ? this.avoid() : this.avoid;
    if (!p) return false;
    const px = p.x / this.k, pz = p.z / this.k;
    const d1 = Math.hypot(x1 - px, z1 - pz);
    return d1 < r && d1 < Math.hypot(x0 - px, z0 - pz);
  }

  // couldn't get away from the player: sit a moment and watch them instead of retrying at once
  settle() {
    const st = this.s;
    this.startIdle(1.5, 3);
    st.calm = rand(2.5, 4.5);
    st.look = LOOK_CAMERA;
  }

  blocked(x, z, r = BODY_R) {
    const a = this.area;
    if (x < a[0] + r || x > a[1] - r || z < a[2] + r || z > a[3] - r) return true;
    for (let i = 0; i < this.obstacles.length; i += 1) {
      const o = this.obstacles[i];
      if (x > o[0] - r && x < o[1] + r && z > o[2] - r && z < o[3] + r) return true;
    }
    const k = this.k;
    return this.customBlocked ? this.customBlocked(x * k, z * k, r * k) : false;
  }

  // Studio change: a line that starts too close to furniture (where a walk can end: curves cut corners) is judged
  // with the bare body clearance for its first ESCAPE metres, so the cat can always walk away from where it stands.
  // In the kit the first step already failed there, and the cat was stuck for good.
  pathClear(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(2, Math.ceil(len / 0.12));
    const tight = this.blocked(x0, z0, BODY_R + PATH_MARGIN);
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const r = tight && t * len < ESCAPE ? BODY_R : BODY_R + PATH_MARGIN;
      if (this.blocked(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, r)) return false;
    }
    return true;
  }

  // ---- route finding (studio change: the kit tried a straight line or one waypoint, so routes needing two turns,
  // like round the coffee table, were never taken). The floor is a grid of GRID-metre cells: "open" cells keep the
  // full planning clearance, "tight" ones only the body's (passable, but costly, so routes keep their distance).
  // One search from where the cat stands answers every candidate target of that decision.

  buildGrid() {
    const a = this.area;
    const nx = Math.ceil((a[1] - a[0]) / GRID);
    const nz = Math.ceil((a[3] - a[2]) / GRID);
    const cell = new Uint8Array(nx * nz); // 0 blocked, 1 tight, 2 open
    for (let j = 0; j < nz; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const x = a[0] + (i + 0.5) * GRID;
        const z = a[2] + (j + 0.5) * GRID;
        cell[j * nx + i] = this.blocked(x, z) ? 0 : this.blocked(x, z, BODY_R + PATH_MARGIN) ? 1 : 2;
      }
    }
    this.grid = { nx, nz, cell, cost: new Float64Array(nx * nz), from: new Int32Array(nx * nz), heap: [], at: [NaN, NaN] };
  }

  cellOf(x, z) {
    const g = this.grid;
    const i = clamp(Math.floor((x - this.area[0]) / GRID), 0, g.nx - 1);
    const j = clamp(Math.floor((z - this.area[2]) / GRID), 0, g.nz - 1);
    return j * g.nx + i;
  }

  // cheapest cost to every cell from (x, z) (Dijkstra, 8 neighbours, no cutting past a blocked corner)
  flood(x, z) {
    if (!this.grid) this.buildGrid();
    const g = this.grid;
    if (g.at[0] === x && g.at[1] === z) return;
    g.at[0] = x;
    g.at[1] = z;
    const { nx, nz, cell, cost, from, heap } = g;
    cost.fill(Infinity);
    from.fill(-1);
    heap.length = 0;
    const start = this.cellOf(x, z);
    cost[start] = 0;
    const push = (c, n) => {
      heap.push(c, n);
      let i = heap.length / 2 - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p * 2] <= heap[i * 2]) break;
        swap(heap, p, i);
        i = p;
      }
    };
    const pop = () => {
      const n = heap[1];
      const lc = heap.pop();
      const lv = heap.pop();
      if (heap.length) {
        heap[0] = lv;
        heap[1] = lc;
        let i = 0;
        const len = heap.length / 2;
        for (;;) {
          const l = i * 2 + 1;
          const rr = l + 1;
          let m = i;
          if (l < len && heap[l * 2] < heap[m * 2]) m = l;
          if (rr < len && heap[rr * 2] < heap[m * 2]) m = rr;
          if (m === i) break;
          swap(heap, m, i);
          i = m;
        }
      }
      return n;
    };
    push(0, start);
    while (heap.length) {
      const c = heap[0];
      const n = pop();
      if (c > cost[n]) continue;
      const i = n % nx;
      const j = (n - i) / nx;
      for (let dj = -1; dj <= 1; dj += 1) {
        for (let di = -1; di <= 1; di += 1) {
          if (!di && !dj) continue;
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
          const m = jj * nx + ii;
          if (!cell[m]) continue;
          if (di && dj && (!cell[j * nx + ii] || !cell[jj * nx + i])) continue;
          const step = (di && dj ? Math.SQRT2 : 1) * (cell[m] === 1 ? TIGHT_COST : 1);
          if (c + step < cost[m]) {
            cost[m] = c + step;
            from[m] = n;
            push(c + step, m);
          }
        }
      }
    }
  }

  // straight there when the line is clear; otherwise the grid route, pulled tight into a few corner points
  routeTo(x, z) {
    const st = this.s;
    const route = st.route;
    route.length = 0;
    st.routeIdx = 0;
    st.routeLen = 0;
    if (this.pathClear(st.x, st.z, x, z)) {
      route.push(x, z);
      st.routeLen = 1;
      return true;
    }
    this.flood(st.x, st.z);
    const g = this.grid;
    const goal = this.cellOf(x, z);
    if (g.cost[goal] === Infinity) return false;
    // cells from the cat to the goal, as points (the goal cell is the exact target)
    const pts = [];
    for (let n = goal; n !== -1; n = g.from[n]) {
      const i = n % g.nx;
      pts.push(this.area[0] + (i + 0.5) * GRID, this.area[2] + ((n - i) / g.nx + 0.5) * GRID);
    }
    pts[0] = x;
    pts[1] = z;
    // string pulling: from each corner, jump to the furthest point still in plain sight
    let ax = st.x;
    let az = st.z;
    let k = pts.length / 2 - 2; // index (from the end of pts) of the point after the start cell
    while (k >= 0) {
      let far = k;
      for (let m = 0; m < k; m += 1) {
        if (this.pathClear(ax, az, pts[m * 2], pts[m * 2 + 1])) {
          far = m;
          break;
        }
      }
      ax = pts[far * 2];
      az = pts[far * 2 + 1];
      route.push(ax, az);
      k = far - 1;
    }
    if (!route.length) route.push(x, z);
    st.routeLen = route.length / 2;
    return true;
  }

  // ---- behavior

  fadeTo(action, fade = 0.35) {
    const st = this.s;
    const { actions } = this.rig;
    if (!action || st.current === action) return;
    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
    if (st.current) st.current.fadeOut(fade);
    // the stretch boost plays in lockstep with the stretch
    const boost = actions.stretchBoost;
    if (boost) {
      if (action === actions.stretch) {
        boost.reset().setEffectiveTimeScale(1).setEffectiveWeight(STRETCH_BOOST).fadeIn(fade).play();
      } else if (st.current === actions.stretch) {
        boost.fadeOut(fade);
      }
    }
    st.current = action;
  }

  // picks where to go next: mostly a spot in its home area, preferring spots
  // roughly ahead (big U-turns look mechanical); away from the `avoid`
  // position when that is close
  pickTarget() {
    const st = this.s;
    const fleeing = this.playerNear(st.x, st.z, 1.0);
    const home = !fleeing && Math.random() < HOME_CHANCE;
    const avoid = fleeing ? (typeof this.avoid === "function" ? this.avoid() : this.avoid) : null;
    let best = -Infinity;
    let bx = 0;
    let bz = 0;
    for (let i = 0; i < 14; i += 1) {
      let x;
      let z;
      if (home) {
        x = rand(this.home[0], this.home[1]);
        z = rand(this.home[2], this.home[3]);
      } else {
        const a = st.yaw + rand(-1.6, 1.6);
        const d = rand(1.0, 3.0);
        x = st.x + Math.sin(a) * d;
        z = st.z + Math.cos(a) * d;
      }
      const dist = Math.hypot(x - st.x, z - st.z);
      if (dist < 0.8) continue;
      if (this.blocked(x, z, BODY_R + PATH_MARGIN) || this.playerNear(x, z, 0.9)) continue;
      const signedTurn = wrapAngle(Math.atan2(x - st.x, z - st.z) - st.yaw);
      const turn = Math.abs(signedTurn);
      // a big turn is walked as a small loop that bulges ~0.35m to that side
      if (turn > 1.2) {
        const side = st.yaw + Math.sign(signedTurn) * (Math.PI / 2);
        const lx = st.x + Math.sin(side) * 0.35 + Math.sin(st.yaw) * 0.15;
        const lz = st.z + Math.cos(side) * 0.35 + Math.cos(st.yaw) * 0.15;
        if (this.blocked(lx, lz)) continue;
      }
      let score = Math.random() - turn * 0.5;
      if (avoid) score += Math.hypot(x - avoid.x / this.k, z - avoid.z / this.k);
      if (score > best) {
        // check reachability only for candidates that would win
        if (!this.routeTo(x, z)) continue;
        best = score;
        bx = x;
        bz = z;
      }
    }
    if (best === -Infinity) return false;
    return this.routeTo(bx, bz);
  }

  startIdle(min, max) {
    const st = this.s;
    st.state = IDLE;
    st.timer = rand(min, max);
    st.attend = false;
    const r = Math.random();
    st.look = r < 0.35 ? LOOK_CAMERA : r < 0.7 ? LOOK_GLANCE : LOOK_AHEAD;
    st.lookTimer = rand(0.8, 2.5);
    st.glance = rand(-HEAD_MAX, HEAD_MAX);
    this.fadeTo(this.rig.actions.idle, 0.45);
  }

  // Studio change. The kit's cat never turns on the spot, so facing into a corner (or nosing a table corner) every
  // walk it could plan either needed a turn there was no room for or bumped the same thing again, and it stood there
  // for good. After two failures in a row it shuffles round on the spot to face the most open floor, then walks.
  unstick() {
    const st = this.s;
    st.stuck += 1;
    if (st.stuck < 2) return false;
    let best = -Infinity;
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      let d = 0;
      while (d < 2.5 && !this.blocked(st.x + Math.sin(a) * (d + 0.1), st.z + Math.cos(a) * (d + 0.1))) d += 0.1;
      const score = d - Math.abs(wrapAngle(a - st.yaw)) * 0.15 + Math.random() * 0.2; // open, and not needlessly far round
      if (score > best) {
        best = score;
        st.turnTo = a;
      }
    }
    st.state = TURN;
    st.stuck = 0;
    st.speed = 0;
    st.look = LOOK_AHEAD;
    this.fadeTo(this.rig.actions.walk, 0.35);
    return true;
  }

  startWalk() {
    const st = this.s;
    if (!this.pickTarget()) {
      if (this.playerNear(st.x, st.z, 0.9)) this.settle();
      else if (!this.unstick()) this.startIdle(1.5, 3);
      return;
    }
    st.state = WALK;
    st.speed = 0;
    st.look = LOOK_AHEAD;
    this.fadeTo(this.rig.actions.walk, 0.35);
  }

  decideNext() {
    const st = this.s;
    const r = Math.random();
    if (r < 0.2 && this.rig.actions.stretch) {
      st.state = STRETCH;
      st.stretchT = 0;
      st.timer = Infinity; // ends when the clip time runs out (see update)
      st.look = LOOK_AHEAD;
      this.fadeTo(this.rig.actions.stretch, 0.4);
    } else if (r < 0.75) {
      this.startWalk();
    } else {
      this.startIdle(3, 7);
    }
  }

  // Foot locking. The clip's legs only know walking straight, so when the
  // body turns, planted paws would skate. A paw that touches down while
  // walking remembers its floor spot, and while it stays down its leg is
  // aimed from the shoulder/hip back at that spot (capped, so a leg never
  // bends wildly). Lifting fades it out fast.
  lockFeet(dt) {
    const rig = this.rig;
    const unit = SCALE * this.k; // world units per model unit
    const walkW = rig.actions.walk ? rig.actions.walk.getEffectiveWeight() : 0;
    for (let i = 0; i < rig.legs.length; i += 1) {
      const leg = rig.legs[i];
      if (walkW < 0.01) {
        leg.locked = false;
        leg.w = 0;
        continue;
      }
      leg.end.getWorldPosition(_fp);
      const planted = (_fp.y - this.floorY) / unit < leg.rest + PLANT_EPS;
      if (planted) {
        if (!leg.locked) {
          leg.locked = true;
          leg.tx = _fp.x;
          leg.tz = _fp.z;
        }
        leg.w = 1;
      } else {
        leg.locked = false;
        leg.w = approach(leg.w, 0, 18, dt);
      }
      const w = leg.w * walkW;
      if (w < 0.01) continue;

      leg.upper.getWorldPosition(_sp);
      _v1.subVectors(_fp, _sp);
      _v2.set(leg.tx - _sp.x, _fp.y - _sp.y, leg.tz - _sp.z);
      if (_v1.lengthSq() < 1e-12 || _v2.lengthSq() < 1e-12) continue;
      _qa.setFromUnitVectors(_v1.normalize(), _v2.normalize());
      const angle = 2 * Math.acos(Math.min(1, Math.abs(_qa.w)));
      const amount = angle > LOCK_MAX ? (w * LOCK_MAX) / angle : w;
      _qb.copy(_qId).slerp(_qa, amount);
      // world-space rotation -> the bone's parent space, on top of its pose
      leg.upper.parent.getWorldQuaternion(_qParent);
      _qInv.copy(_qParent).invert();
      _qb.premultiply(_qInv).multiply(_qParent);
      leg.upper.quaternion.premultiply(_qb);
    }
  }

  /**
   * Call once per frame.
   * @param {number} delta seconds since the last frame
   * @param {THREE.Camera} [camera] lets it look at the viewer and skip the
   *   skeleton update while off-screen
   */
  update(delta, camera) {
    const st = this.s;
    const rig = this.rig;
    const k = this.k;
    // long frames (tab refocus) must not teleport the cat through things
    const dt = Math.min(delta, 0.1);

    st.timer -= dt;
    st.calm -= dt;
    let wantTurn = 0; // desired body turn rate (rad/s)
    let walkErr = 0; // body heading error while walking (rad)

    if (st.state === IDLE) {
      // something walking up to it makes it move off after a short beat
      const near = this.playerNear(st.x, st.z, 0.9);
      if (near && st.timer > 0.3 && st.calm <= 0) st.timer = 0.3;
      if (st.timer <= 0) {
        if (near) this.startWalk();
        else this.decideNext();
      }
    } else if (st.state === STRETCH) {
      const rate = stretchRate(st.stretchT);
      st.stretchT += dt * rate;
      rig.actions.stretch.setEffectiveTimeScale(rate);
      rig.actions.stretchBoost?.setEffectiveTimeScale(rate);
      if (st.stretchT >= rig.actions.stretch.getClip().duration) st.timer = 0;
      else if (this.playerNear(st.x, st.z, 0.75) && st.calm <= 0) this.startWalk();
    }
    if (st.state === STRETCH || st.state === REACT) {
      if (st.timer <= 0) {
        if (st.state === REACT) {
          // landed: now it looks at you for a few seconds
          this.startIdle(2.5, 4);
          st.look = LOOK_CAMERA;
          st.attend = true;
        } else {
          this.startIdle(3, 6);
        }
      }
    }

    if (st.state === WALK) {
      const i = st.routeIdx * 2;
      const last = st.routeIdx === st.routeLen - 1;
      const dx = st.route[i] - st.x;
      const dz = st.route[i + 1] - st.z;
      const dist = Math.hypot(dx, dz);
      const err = stickySide(wrapAngle(Math.atan2(dx, dz) - st.yaw), st.turnSign);
      if (Math.abs(err) < STICKY) st.turnSign = Math.sign(err);
      walkErr = err;
      const absErr = Math.abs(err);

      // corners are rounded: it heads for the next point before reaching one;
      // a target it would only circle (inside its turning radius) counts as
      // reached
      // (studio change: corners were rounded from 0.45 m off, which cut them into the furniture; 0.2 keeps clear)
      const reached = last
        ? dist < 0.1 || (dist < TURN_RADIUS * 1.6 && absErr > 1.4)
        : dist < 0.2 || (dist < TURN_RADIUS * 1.6 && absErr > 1.4);
      if (reached) {
        if (last) {
          st.stuck = 0;
          this.decideNext();
        } else st.routeIdx += 1;
      } else {
        // It only turns while walking: the clip is a straight walk, so a turn
        // on the spot makes planted paws skate. Slows into turns but never
        // below a slow walk; eases in at the start and slows to arrive.
        const align = 0.6 + 0.4 * Math.max(0, Math.cos(Math.min(absErr, Math.PI / 2)));
        const arrive = last ? clamp(dist / 0.4, 0.3, 1) : 1;
        let want = WALK_SPEED * align * arrive;
        if (absErr > 0.25) want = Math.max(want, TURN_SPEED);
        st.speed = approach(st.speed, want, 3.5, dt);
        wantTurn = clamp(err * 2.4, -turnLimit(st.speed), turnLimit(st.speed));

        const step = st.speed * dt;
        const nx = st.x + Math.sin(st.yaw) * step;
        const nz = st.z + Math.cos(st.yaw) * step;
        if (this.blocked(nx, nz)) {
          if (!this.unstick()) this.startIdle(1, 2.5);
        } else if (this.closingIn(st.x, st.z, nx, nz, CLOSE_MIN)) {
          this.settle();
        } else {
          st.x = nx;
          st.z = nz;
        }
      }
    }

    if (st.state === TURN) {
      walkErr = wrapAngle(st.turnTo - st.yaw);
      wantTurn = clamp(walkErr * 2.4, -TURN_IN_PLACE, TURN_IN_PLACE);
      if (Math.abs(walkErr) < 0.15) this.startWalk();
    }

    // where the head wants to look, relative to the body
    let lookTarget = 0;
    if (st.state === TURN) {
      lookTarget = walkErr; // the head leads round
    } else if (st.state === WALK) {
      // same angle the body steers by, so head and body always agree
      lookTarget = walkErr;
      // close to where it stops the direction swings fast: the head settles
      // forward instead of whipping after it
      if (st.routeIdx === st.routeLen - 1) {
        const i = st.routeIdx * 2;
        const d = Math.hypot(st.route[i] - st.x, st.route[i + 1] - st.z);
        lookTarget *= clamp((d - 0.15) / 0.45, 0, 1);
      }
    } else if (st.look === LOOK_CAMERA && camera) {
      lookTarget = stickySide(
        wrapAngle(
          Math.atan2(camera.position.x - st.x * k, camera.position.z - st.z * k) - st.yaw,
        ),
        st.lookSign,
      );
      if (Math.abs(lookTarget) < STICKY) st.lookSign = Math.sign(lookTarget);
    } else if (st.look === LOOK_GLANCE) {
      st.lookTimer -= dt;
      if (st.lookTimer <= 0) {
        st.lookTimer = rand(1.2, 3.5);
        st.glance = Math.random() < 0.3 ? 0 : rand(-HEAD_MAX, HEAD_MAX);
      }
      lookTarget = st.glance;
    }
    // looking at you after a click: within reach of the neck it only turns
    // its head; from further round it walks a small U-turn (no spinning on
    // the spot) and stops while still looking over its shoulder a little,
    // the way a cat does, instead of squaring up
    if (st.attend && st.state === IDLE) {
      const need = Math.abs(lookTarget) - 0.5;
      if (!st.shuffling && need > 0.5) {
        st.shuffling = true;
        this.fadeTo(rig.actions.walk, 0.35);
      } else if (st.shuffling && need < 0.05) {
        st.shuffling = false;
        this.fadeTo(rig.actions.idle, 0.45);
      }
      if (st.shuffling) {
        st.speed = approach(st.speed, TURN_SPEED, 3.5, dt);
        const nx = st.x + Math.sin(st.yaw) * st.speed * dt;
        const nz = st.z + Math.cos(st.yaw) * st.speed * dt;
        if (this.blocked(nx, nz) || this.closingIn(st.x, st.z, nx, nz, CLOSE_MIN)) {
          // no room to walk round: it just looks over its shoulder
          st.shuffling = false;
          st.attend = false;
          this.fadeTo(rig.actions.idle, 0.45);
        } else {
          st.x = nx;
          st.z = nz;
          wantTurn = Math.sign(lookTarget) * Math.min(need * 2.4, turnLimit(st.speed));
        }
      }
    } else if (st.shuffling) {
      st.shuffling = false;
    }
    if (!st.shuffling && st.state !== WALK) st.speed = 0;

    // eased turn rate: no instant starts or stops
    st.turnVel = approach(st.turnVel, wantTurn, 5, dt);
    let dYaw = st.turnVel * dt;
    // turn in step with the paws (only while the walk clip carries it)
    if (st.current === rig.actions.walk) {
      const walk = rig.actions.walk;
      const lift = liftAt(walk.time / walk.getClip().duration);
      dYaw *= 0.6 + 0.7 * lift; // averages 1; the foot lock does the rest
    }
    // turns pivot on the back legs: the front swings round, the hind end
    // stays put (the cat's position is its middle, PIVOT_BACK ahead of them)
    const px = st.x + PIVOT_BACK * (Math.sin(st.yaw + dYaw) - Math.sin(st.yaw));
    const pz = st.z + PIVOT_BACK * (Math.cos(st.yaw + dYaw) - Math.cos(st.yaw));
    if (!this.blocked(px, pz)) {
      st.x = px;
      st.z = pz;
    }
    st.yaw = wrapAngle(st.yaw + dYaw);
    // body bends into the turn instead of turning as one rigid block
    st.bend = approach(st.bend, clamp(st.turnVel * BEND_GAIN, -BEND_MAX, BEND_MAX), 5, dt);

    // legs step at the ground speed so planted paws move with the floor
    if (st.current === rig.actions.walk) {
      st.legRate = approach(st.legRate, clamp(st.speed / STRIDE_SPEED, 0.3, 1.6), 4, dt);
      rig.actions.walk.setEffectiveTimeScale(st.legRate);
    } else {
      st.legRate = 0.3;
    }

    // head leads the body. A critically damped spring: it eases in and out
    // of every turn and never overshoots; speed capped so it can't snap
    const headErr = clamp(lookTarget, -HEAD_MAX, HEAD_MAX) - st.headYaw;
    st.headVel += (HEAD_W * HEAD_W * headErr - 2 * HEAD_W * st.headVel) * dt;
    st.headVel = clamp(st.headVel, -HEAD_SPEED, HEAD_SPEED);
    st.headYaw = clamp(st.headYaw + st.headVel * dt, -HEAD_MAX, HEAD_MAX);

    this.object.position.set(st.x * k, this.floorY, st.z * k);
    this.object.rotation.y = st.yaw;

    // tail swish clock and ear twitch timing (cheap scalars every frame;
    // the bones are only touched below, when the cat is on screen)
    st.tailT += dt * (st.state === WALK ? 2.6 : 1.2);
    if (st.earT >= 0) {
      st.earT += dt;
      if (st.earT > EAR_TWITCH) st.earT = -1;
    } else {
      st.earTimer -= dt;
      if (st.earTimer <= 0) {
        st.earT = 0;
        st.earSide = Math.random() < 0.5 ? 0 : 1;
        st.earTimer = rand(2.5, 8);
      }
    }

    // animate only when visible, and no faster than animationFps
    st.animAcc += dt;
    if (this.animStep && st.animAcc < this.animStep) return;
    let visible = true;
    if (camera) {
      _sphere.center.set(st.x * k, this.floorY + 0.22 * k, st.z * k);
      _sphere.radius = 0.5 * k;
      _projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_projScreen);
      visible = _frustum.intersectsSphere(_sphere);
    }
    if (visible) {
      const posed = rig.posed;
      for (let i = 0; i < posed.length; i += 1) posed[i].bone.quaternion.copy(posed[i].q);
      rig.mixer.update(st.animAcc);
      for (let i = 0; i < posed.length; i += 1) posed[i].q.copy(posed[i].bone.quaternion);
      // offsets go on top of the clean pose saved above (restored next time)
      if (rig.spine && rig.chest && Math.abs(st.bend) > 0.001) {
        addWorldYaw(rig.spine, st.bend * 0.45);
        addWorldYaw(rig.chest, st.bend * 0.55);
      }
      // the bend already turned the head with the chest
      const headOff = st.headYaw - st.bend;
      if (rig.neck && rig.head && Math.abs(headOff) > 0.001) {
        addWorldYaw(rig.neck, headOff * 0.4);
        addWorldYaw(rig.head, headOff * 0.6);
      }
      // tail swish: a wave running down the tail
      const swish = st.state === WALK ? 0.6 : 1;
      for (let i = 0; i < rig.tail.length; i += 1) {
        const b = rig.tail[i];
        if (b) addWorldYaw(b, Math.sin(st.tailT - i * TAIL_LAG) * TAIL_AMP[i] * swish);
      }
      // ear twitch: a quick flick out and back
      if (st.earT >= 0) {
        const ear = rig.ears[st.earSide];
        const u = st.earT / EAR_TWITCH;
        if (ear) addWorldYaw(ear, Math.sin(u * Math.PI) * EAR_ANGLE * (st.earSide ? -1 : 1));
      }
      this.lockFeet(st.animAcc);
    }
    st.animAcc = 0;
  }
}

export default TuxedoCat;
