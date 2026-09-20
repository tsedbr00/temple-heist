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
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100, 8, 8), mats.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    for (let i = 0; i < 40; i++) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(1.2 + Math.random() * 3.5, 7),
        Math.random() > 0.55 ? mats.dirt : Math.random() > 0.4 ? mats.moss : mats.grassDeep,
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set((Math.random() - 0.5) * 80, 0.012, (Math.random() - 0.5) * 80);
      this.group.add(patch);
    }
  }

  private makeTree(scale = 1, seed = 0): THREE.Group {
    const g = new THREE.Group();
    const trunkH = 2.2 + (seed % 10) * 0.18;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11 * scale, 0.24 * scale, trunkH, 7),
      seed % 3 === 0 ? mats.trunkMossy : mats.trunk,
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    g.add(trunk);

    // Clustered foliage (less toy-like than single cones)
    const leafMats = [mats.leaves, mats.leavesDark, mats.leavesBright];
    const clusters = 4 + (seed % 3);
    for (let i = 0; i < clusters; i++) {
      const leafMat = leafMats[i % leafMats.length];
      const r = (0.7 + (i % 3) * 0.25) * scale;
      const canopy = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, 0),
        leafMat,
      );
      const ang = (i / clusters) * Math.PI * 2;
      canopy.position.set(
        Math.cos(ang) * 0.35 * scale,
        trunkH - 0.2 + (i % 3) * 0.55 * scale,
        Math.sin(ang) * 0.35 * scale,
      );
      canopy.scale.y = 0.75 + (i % 2) * 0.15;
      canopy.castShadow = true;
      g.add(canopy);
    }
    // Top cap
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 * scale, 0), mats.leavesDark);
    top.position.y = trunkH + 0.85 * scale;
    top.castShadow = true;
    g.add(top);

    return g;
  }

  private makeBush(): THREE.Group {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.3 + Math.random() * 0.28, 0),
        Math.random() > 0.5 ? mats.bush : mats.leaves,
      );
      b.position.set((Math.random() - 0.5) * 0.55, 0.28, (Math.random() - 0.5) * 0.55);
      b.castShadow = true;
      g.add(b);
    }
    return g;
  }

  private makeFern(): THREE.Mesh {
    const fern = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 5, 1, true), mats.fern);
    fern.position.y = 0.35;
    fern.rotation.y = Math.random() * Math.PI;
    return fern;
  }

  private buildJungle() {
    const rng = (s: number) => {
      const x = Math.sin(s * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };

    for (let i = 0; i < 200; i++) {
      const a = rng(i * 3.1) * Math.PI * 2;
      const r = 8 + rng(i * 7.7) * 42;
      let x = Math.cos(a) * r + (rng(i * 1.3) - 0.5) * 20;
      let z = Math.sin(a) * r * 0.85 + (rng(i * 2.1) - 0.5) * 10;
      z = THREE.MathUtils.lerp(z, (rng(i) - 0.55) * 55, 0.3);

      if (Math.abs(x) < 3.2 && z > -18 && z < 32) continue;
      if (Math.abs(x) < 9 && z < -18 && z > -42) continue;
      if (Math.hypot(x, z - 28) < 5) continue;

      const tree = this.makeTree(0.85 + rng(i * 9) * 0.55, i);
      tree.position.set(x, 0, z);
      tree.rotation.y = rng(i) * Math.PI;
      this.group.add(tree);
      this.trees.push(tree);
      this.addCollider(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
    }

    for (let i = 0; i < 90; i++) {
      const x = (rng(i * 11.1) - 0.5) * 70;
      const z = (rng(i * 13.3) - 0.5) * 70;
      if (Math.abs(x) < 2.5 && z > -18 && z < 32) continue;
      if (Math.abs(x) < 9 && z < -18 && z > -42) continue;
      const bush = this.makeBush();
      bush.position.set(x, 0, z);
      this.group.add(bush);
    }

    for (let i = 0; i < 60; i++) {
      const x = (rng(i * 17.7) - 0.5) * 65;
      const z = (rng(i * 19.3) - 0.5) * 65;
      if (Math.abs(x) < 2.8 && z > -18 && z < 32) continue;
      if (Math.abs(x) < 9 && z < -18 && z > -42) continue;
      const fern = this.makeFern();
      fern.position.set(x, 0, z);
      this.group.add(fern);
    }

    this.addCollider(-50, 50, 38, 42);
    this.addCollider(-50, 50, -55, -50);
    this.addCollider(-52, -48, -55, 42);
    this.addCollider(48, 52, -55, 42);
  }

  private buildPath() {
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
        const slab = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.3), mats.path);
        slab.rotation.x = -Math.PI / 2;
        slab.position.set(x, 0.02, z);
        this.group.add(slab);
      }
    }

    const camp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 6), mats.trunk);
    camp.position.set(-2.5, 0.4, 29);
    this.group.add(camp);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), mats.gold);
    flag.position.set(-2.2, 0.9, 29);
    this.group.add(flag);

    // Campfire glow
    const fire = new THREE.PointLight(0xff8844, 1.4, 8, 2);
    fire.position.set(-1.5, 0.8, 28.5);
    this.group.add(fire);
    const fireMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), mats.flame);
    fireMesh.position.copy(fire.position);
    this.group.add(fireMesh);
  }

  private buildTemple() {
    const baseZ = -28;
    const stone = mats.stone;
    const dark = mats.stoneDark;

    const platform = new THREE.Mesh(new THREE.BoxGeometry(18, 1.2, 22), mats.stoneWeathered);
    platform.position.set(0, 0.6, baseZ);
    platform.receiveShadow = true;
    platform.castShadow = true;
    this.group.add(platform);
    this.addCollider(-9, 9, baseZ - 11, baseZ - 10.2);

    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(8 - i * 0.4, 0.35, 1.2), mats.stoneAccent);
      step.position.set(0, 0.15 + i * 0.32, -17.5 - i * 0.9);
      step.castShadow = true;
      step.receiveShadow = true;
      this.group.add(step);
    }

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

    makeWall(1.2, wallH, 18, -6.5, wallY, baseZ, dark);
    makeWall(1.2, wallH, 18, 6.5, wallY, baseZ, dark);
    makeWall(14, wallH, 1.2, 0, wallY, baseZ - 10, dark);
    makeWall(2, wallH + 1, 2, -4, wallY + 0.5, -19, stone);
    makeWall(2, wallH + 1, 2, 4, wallY + 0.5, -19, stone);
    makeWall(10, 1.2, 1.5, 0, 1.2 + wallH + 0.2, -19, mats.stoneAccent);

    // Block accents on walls (weathered masonry feel)
    for (let i = 0; i < 8; i++) {
      const brick = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.55, 0.2),
        i % 2 === 0 ? mats.stoneAccent : mats.stoneWeathered,
      );
      brick.position.set(-5.85, 2.2 + (i % 4) * 0.9, -21 - Math.floor(i / 4) * 5);
      this.group.add(brick);
      const brickR = brick.clone();
      brickR.position.x = 5.85;
      this.group.add(brickR);
    }

    const roof = new THREE.Mesh(new THREE.BoxGeometry(15, 0.6, 20), dark);
    roof.position.set(0, 1.2 + wallH + 0.5, baseZ);
    this.group.add(roof);

    const pyramid = new THREE.Mesh(new THREE.ConeGeometry(5, 3.5, 4), mats.stoneAccent);
    pyramid.position.set(0, 1.2 + wallH + 2.5, baseZ - 2);
    pyramid.rotation.y = Math.PI / 4;
    this.group.add(pyramid);

    for (const x of [-3.5, 3.5]) {
      for (const z of [-24, -30, -34]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 4.5, 8), stone);
        col.position.set(x, 1.2 + 2.25, z);
        col.castShadow = true;
        this.group.add(col);
        // Capital
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.9), mats.stoneAccent);
        cap.position.set(x, 1.2 + 4.5, z);
        this.group.add(cap);
        this.addCollider(x - 0.45, x + 0.45, z - 0.45, z + 0.45);
      }
    }

    for (let i = 0; i < 14; i++) {
      const moss = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.14), mats.moss);
      moss.position.set(
        (i % 2 === 0 ? -6 : 6) * 0.95,
        2 + (i % 4) * 0.7,
        -20 - (i % 7) * 2.2,
      );
      this.group.add(moss);
    }

    // Vines draping entrance
    for (const x of [-3.2, -2.2, 2.2, 3.2]) {
      const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 2.8, 5), mats.vine);
      vine.position.set(x, 4.2, -18.5);
      this.group.add(vine);
    }

    const relief = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 0.22), mats.gold);
    relief.position.set(0, 3.5, -18.3);
    this.group.add(relief);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.15, 16), mats.stoneAccent);
    floor.position.set(0, 1.15, baseZ);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Wall-mounted temple torches
    for (const [tx, tz] of [
      [-5.5, -23],
      [5.5, -23],
      [-5.5, -31],
      [5.5, -31],
    ] as [number, number][]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.15), mats.torchMetal);
      bracket.position.set(tx, 3.2, tz);
      this.group.add(bracket);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), mats.flame);
      flame.position.set(tx, 3.5, tz);
      this.group.add(flame);
      const pl = new THREE.PointLight(0xff9944, 0.85, 9, 2);
      pl.position.set(tx, 3.5, tz);
      this.group.add(pl);
    }

    const tLight = new THREE.PointLight(0xffcc88, 1.0, 14, 2);
    tLight.position.set(0, 4.5, -28);
    this.group.add(tLight);

    const tLight2 = new THREE.PointLight(0xffaa66, 0.7, 11, 2);
    tLight2.position.set(0, 4, -36);
    this.group.add(tLight2);
  }

  collide(pos: THREE.Vector3, radius: number): THREE.Vector3 {
    const out = pos.clone();
    for (const c of this.colliders) {
      const nearestX = THREE.MathUtils.clamp(out.x, c.minX, c.maxX);
      const nearestZ = THREE.MathUtils.clamp(out.z, c.minZ, c.maxZ);
      const dx = out.x - nearestX;
      const dz = out.z - nearestZ;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
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
    let chosen = this.checkpoints[0].clone();
    for (const c of this.checkpoints) {
      if (pos.z <= c.z + 5) chosen = c.clone();
    }
    return chosen;
  }
}
