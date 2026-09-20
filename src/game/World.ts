import * as THREE from 'three';
import { mats } from './materials';

export type AABB = { minX: number; maxX: number; minZ: number; maxZ: number };

export class World {
  group = new THREE.Group();
  colliders: AABB[] = [];
  checkpoints: THREE.Vector3[] = [];
  templeZone: AABB = { minX: -10, maxX: 10, minZ: -42, maxZ: -18 };
  interactables: { pos: THREE.Vector3; radius: number; id: string; mesh?: THREE.Object3D }[] = [];
  private trees: THREE.Object3D[] = [];

  constructor() {
    this.buildGround();
    this.buildJungle();
    this.buildPath();
    this.buildTemple();
    this.checkpoints.push(new THREE.Vector3(0, 0, 28));
    this.checkpoints.push(new THREE.Vector3(0, 0, 2));
    this.checkpoints.push(new THREE.Vector3(0, 0, -20));
  }

  private addCollider(minX: number, maxX: number, minZ: number, maxZ: number) {
    this.colliders.push({ minX, maxX, minZ, maxZ });
  }

  private buildGround() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), mats.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Slight color variation patches
    for (let i = 0; i < 30; i++) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(1.5 + Math.random() * 3, 8),
        Math.random() > 0.5 ? mats.dirt : mats.moss,
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set((Math.random() - 0.5) * 80, 0.01, (Math.random() - 0.5) * 80);
      this.group.add(patch);
    }
  }

  private makeTree(scale = 1): THREE.Group {
    const g = new THREE.Group();
    const trunkH = 2.2 + Math.random() * 1.8;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * scale, 0.22 * scale, trunkH, 6),
      mats.trunk,
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    g.add(trunk);

    const leafMat = Math.random() > 0.4 ? mats.leaves : mats.leavesDark;
    const layers = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < layers; i++) {
      const r = (1.4 - i * 0.3) * scale * (0.9 + Math.random() * 0.3);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(r, 1.6 * scale, 7), leafMat);
      canopy.position.y = trunkH - 0.3 + i * 0.9 * scale;
      canopy.castShadow = true;
      g.add(canopy);
    }
    return g;
  }

  private makeBush(): THREE.Group {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(
        new THREE.SphereGeometry(0.35 + Math.random() * 0.25, 6, 5),
        mats.bush,
      );
      b.position.set((Math.random() - 0.5) * 0.5, 0.3, (Math.random() - 0.5) * 0.5);
      b.castShadow = true;
      g.add(b);
    }
    return g;
  }

  private buildJungle() {
    const rng = (s: number) => {
      const x = Math.sin(s * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };

    let n = 0;
    for (let i = 0; i < 220; i++) {
      const a = rng(i * 3.1) * Math.PI * 2;
      const r = 8 + rng(i * 7.7) * 42;
      let x = Math.cos(a) * r + (rng(i * 1.3) - 0.5) * 20;
      let z = Math.sin(a) * r * 0.85 + (rng(i * 2.1) - 0.5) * 10;
      // Bias jungle around path corridor but leave path clear
      z = THREE.MathUtils.lerp(z, (rng(i) - 0.55) * 55, 0.3);

      // Keep path clear (along X≈0, Z from 30 to -18)
      if (Math.abs(x) < 3.2 && z > -18 && z < 32) continue;
      // Keep temple interior clear
      if (Math.abs(x) < 9 && z < -18 && z > -42) continue;
      // Keep start clearing
      if (Math.hypot(x, z - 28) < 5) continue;

      const tree = this.makeTree(0.85 + rng(i * 9) * 0.5);
      tree.position.set(x, 0, z);
      tree.rotation.y = rng(i) * Math.PI;
      this.group.add(tree);
      this.trees.push(tree);
      this.addCollider(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
      n++;
    }

    for (let i = 0; i < 80; i++) {
      const x = (rng(i * 11.1) - 0.5) * 70;
      const z = (rng(i * 13.3) - 0.5) * 70;
      if (Math.abs(x) < 2.5 && z > -18 && z < 32) continue;
      if (Math.abs(x) < 9 && z < -18 && z > -42) continue;
      const bush = this.makeBush();
      bush.position.set(x, 0, z);
      this.group.add(bush);
    }

    // World bounds soft walls via colliders
    this.addCollider(-50, 50, 38, 42);
    this.addCollider(-50, 50, -55, -50);
    this.addCollider(-52, -48, -55, 42);
    this.addCollider(48, 52, -55, 42);
  }

  private buildPath() {
    // Winding dirt path from south to temple
    const points = [
      [0, 30],
      [0, 22],
      [2, 14],
      [-1, 6],
      [1, -2],
      [0, -10],
      [0, -18],
    ];
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, z0] = points[i];
      const [x1, z1] = points[i + 1];
      const segs = 6;
      for (let s = 0; s < segs; s++) {
        const t = s / segs;
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        const slab = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.2), mats.path);
        slab.rotation.x = -Math.PI / 2;
        slab.position.set(x, 0.02, z);
        this.group.add(slab);
      }
    }

    // Start camp marker
    const camp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 6), mats.trunk);
    camp.position.set(-2.5, 0.4, 29);
    this.group.add(camp);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), mats.gold);
    flag.position.set(-2.2, 0.9, 29);
    this.group.add(flag);
  }

  private buildTemple() {
    const baseZ = -28;
    const stone = mats.stone;
    const dark = mats.stoneDark;

    // Platform
    const platform = new THREE.Mesh(new THREE.BoxGeometry(18, 1.2, 22), stone);
    platform.position.set(0, 0.6, baseZ);
    platform.receiveShadow = true;
    platform.castShadow = true;
    this.group.add(platform);
    this.addCollider(-9, 9, baseZ - 11, baseZ - 10.2); // back wall base

    // Steps
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(8 - i * 0.4, 0.35, 1.2), mats.stoneAccent);
      step.position.set(0, 0.15 + i * 0.32, -17.5 - i * 0.9);
      step.castShadow = true;
      this.group.add(step);
    }

    // Outer walls of temple hall
    const wallH = 5;
    const wallY = 1.2 + wallH / 2;

    const makeWall = (w: number, h: number, d: number, x: number, y: number, z: number, mat = stone) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
      const hx = w / 2;
      const hz = d / 2;
      this.addCollider(x - hx, x + hx, z - hz, z + hz);
      return m;
    };

    // Left / right long walls
    makeWall(1.2, wallH, 18, -6.5, wallY, baseZ, dark);
    makeWall(1.2, wallH, 18, 6.5, wallY, baseZ, dark);
    // Back wall
    makeWall(14, wallH, 1.2, 0, wallY, baseZ - 10, dark);
    // Front pillars / entrance
    makeWall(2, wallH + 1, 2, -4, wallY + 0.5, -19, stone);
    makeWall(2, wallH + 1, 2, 4, wallY + 0.5, -19, stone);

    // Lintel
    makeWall(10, 1.2, 1.5, 0, 1.2 + wallH + 0.2, -19, mats.stoneAccent);

    // Roof slabs
    const roof = new THREE.Mesh(new THREE.BoxGeometry(15, 0.6, 20), dark);
    roof.position.set(0, 1.2 + wallH + 0.5, baseZ);
    this.group.add(roof);

    // Pyramid top accent
    const pyramid = new THREE.Mesh(new THREE.ConeGeometry(5, 3.5, 4), mats.stoneAccent);
    pyramid.position.set(0, 1.2 + wallH + 2.5, baseZ - 2);
    pyramid.rotation.y = Math.PI / 4;
    this.group.add(pyramid);

    // Interior columns
    for (const x of [-3.5, 3.5]) {
      for (const z of [-24, -30, -34]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 4.5, 8), stone);
        col.position.set(x, 1.2 + 2.25, z);
        col.castShadow = true;
        this.group.add(col);
        this.addCollider(x - 0.45, x + 0.45, z - 0.45, z + 0.45);
      }
    }

    // Moss accents on walls
    for (let i = 0; i < 12; i++) {
      const moss = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.15), mats.moss);
      moss.position.set(
        (i % 2 === 0 ? -6 : 6) * 0.95,
        2 + (i % 4),
        -20 - (i % 6) * 2.5,
      );
      this.group.add(moss);
    }

    // Carved reliefs (gold trim)
    const relief = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 0.2), mats.gold);
    relief.position.set(0, 3.5, -18.3);
    this.group.add(relief);

    // Floor inside temple (slightly raised stone)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.15, 16), mats.stoneAccent);
    floor.position.set(0, 1.15, baseZ);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Ambient temple lights
    const tLight = new THREE.PointLight(0xffcc88, 1.2, 16, 2);
    tLight.position.set(0, 4.5, -28);
    this.group.add(tLight);

    const tLight2 = new THREE.PointLight(0xffaa66, 0.8, 12, 2);
    tLight2.position.set(0, 4, -36);
    this.group.add(tLight2);
  }

  /** Resolve horizontal collision against AABB colliders */
  collide(pos: THREE.Vector3, radius: number): THREE.Vector3 {
    const out = pos.clone();
    for (const c of this.colliders) {
      const nearestX = THREE.MathUtils.clamp(out.x, c.minX, c.maxX);
      const nearestZ = THREE.MathUtils.clamp(out.z, c.minZ, c.maxZ);
      const dx = out.x - nearestX;
      const dz = out.z - nearestZ;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        // If center inside AABB, push out via min penetration
        if (d2 < 1e-8) {
          const left = Math.abs(out.x - c.minX);
          const right = Math.abs(c.maxX - out.x);
          const top = Math.abs(out.z - c.minZ);
          const bot = Math.abs(c.maxZ - out.z);
          const m = Math.min(left, right, top, bot);
          if (m === left) out.x = c.minX - radius;
          else if (m === right) out.x = c.maxX + radius;
          else if (m === top) out.z = c.minZ - radius;
          else out.z = c.maxZ + radius;
        } else {
          const d = Math.sqrt(d2);
          const push = (radius - d) / d;
          out.x += dx * push;
          out.z += dz * push;
        }
      }
    }
    // Clamp world
    out.x = THREE.MathUtils.clamp(out.x, -48, 48);
    out.z = THREE.MathUtils.clamp(out.z, -48, 40);
    return out;
  }

  isInTemple(pos: THREE.Vector3): boolean {
    return (
      pos.x > this.templeZone.minX &&
      pos.x < this.templeZone.maxX &&
      pos.z > this.templeZone.minZ &&
      pos.z < this.templeZone.maxZ
    );
  }

  nearestCheckpoint(pos: THREE.Vector3): THREE.Vector3 {
    let best = this.checkpoints[0];
    let bestD = Infinity;
    for (const c of this.checkpoints) {
      // Only checkpoints the player has roughly reached (z <= checkpoint.z + 4 means further north / progressed)
      if (pos.z > c.z + 6) continue;
      const d = pos.distanceTo(c);
      // Prefer latest checkpoint behind player
      if (c.z <= pos.z + 2 && c.z < best.z + 100) {
        if (pos.z <= c.z + 8 || d < bestD) {
          best = c;
          bestD = d;
        }
      }
    }
    // Better: pick furthest checkpoint the player has passed
    let chosen = this.checkpoints[0].clone();
    for (const c of this.checkpoints) {
      if (pos.z <= c.z + 5) chosen = c.clone();
    }
    return chosen;
  }
}
