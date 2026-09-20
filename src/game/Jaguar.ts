import * as THREE from 'three';
import { mats } from './materials';
import type { Player } from './Player';

export type JaguarState = 'patrol' | 'stalk' | 'chase' | 'flee' | 'gone';

export class Jaguar {
  group = new THREE.Group();
  position = new THREE.Vector3();
  state: JaguarState = 'patrol';
  private yaw = 0;
  private patrolCenter: THREE.Vector3;
  private patrolRadius: number;
  private patrolAngle = 0;
  private fleeTimer = 0;
  private alert = 0;
  private tipShown = false;
  onTip?: (msg: string) => void;
  onCatch?: () => void;

  constructor(x: number, z: number, patrolRadius = 6) {
    this.patrolCenter = new THREE.Vector3(x, 0, z);
    this.position.set(x, 0, z);
    this.patrolRadius = patrolRadius;
    this.group.add(this.buildMesh());
    this.group.position.copy(this.position);
  }

  private buildMesh(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 8), mats.jaguarBody);
    body.rotation.z = Math.PI / 2;
    body.position.set(0, 0.55, 0);
    body.castShadow = true;
    g.add(body);

    // Spots
    for (let i = 0; i < 8; i++) {
      const spot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mats.jaguarSpot);
      spot.position.set((Math.random() - 0.5) * 0.5, 0.65 + Math.random() * 0.15, (Math.random() - 0.5) * 0.9);
      g.add(spot);
    }

    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.5, 3, 6), mats.jaguarBelly);
    belly.rotation.z = Math.PI / 2;
    belly.position.set(0, 0.38, 0);
    g.add(belly);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mats.jaguarBody);
    head.position.set(0, 0.62, 0.55);
    head.castShadow = true;
    g.add(head);

    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mats.jaguarBelly);
    snout.position.set(0, 0.55, 0.72);
    g.add(snout);

    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 5), mats.jaguarSpot);
    earL.position.set(-0.12, 0.82, 0.5);
    g.add(earL);
    const earR = earL.clone();
    earR.position.x = 0.12;
    g.add(earR);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.4, 5);
    const offsets: [number, number][] = [
      [-0.18, 0.28],
      [0.18, 0.28],
      [-0.18, -0.32],
      [0.18, -0.32],
    ];
    for (const [lx, lz] of offsets) {
      const leg = new THREE.Mesh(legGeo, mats.jaguarSpot);
      leg.position.set(lx, 0.2, lz);
      g.add(leg);
    }

    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.7, 5), mats.jaguarBody);
    tail.position.set(0, 0.7, -0.7);
    tail.rotation.x = 0.6;
    g.add(tail);

    g.scale.setScalar(1.15);
    return g;
  }

  calm(awayFrom?: THREE.Vector3, dist = 14) {
    this.alert = 0;
    this.state = 'patrol';
    if (awayFrom) {
      const away = this.position.clone().sub(awayFrom);
      if (away.lengthSq() < 1e-4) away.set(1, 0, 0);
      away.normalize();
      this.position.copy(awayFrom).addScaledVector(away, dist);
      this.group.position.copy(this.position);
    }
  }

  update(dt: number, player: Player) {
    if (this.state === 'gone') {
      this.group.visible = false;
      return;
    }

    const toPlayer = player.position.clone().sub(this.position);
    const dist = toPlayer.length();
    const scareR = player.scareRadius();

    // Scare check
    if (scareR > 0 && dist < scareR && player.isScaring()) {
      this.state = 'flee';
      this.fleeTimer = 3.5;
      if (!this.tipShown) {
        this.tipShown = true;
        this.onTip?.('The jaguar bolts! Torch waves and noise really work.');
      }
    }

    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      const away = this.position.clone().sub(player.position).normalize();
      this.position.addScaledVector(away, 11 * dt);
      this.yaw = Math.atan2(away.x, away.z);
      if (this.fleeTimer <= 0 || this.position.distanceTo(this.patrolCenter) > 40) {
        this.state = 'gone';
        this.onTip?.('One less spotted problem. Keep moving toward the temple.');
      }
    } else if (this.state === 'patrol' || this.state === 'stalk' || this.state === 'chase') {
      // Detection
      const detectRange = player.hiding ? 4.5 : player.sprinting ? 18 : 12;
      if (dist < detectRange) {
        this.alert = Math.min(1, this.alert + dt * (player.hiding ? 0.15 : 0.5));
      } else {
        this.alert = Math.max(0, this.alert - dt * 0.25);
      }

      if (this.alert > 0.7) {
        this.state = 'chase';
      } else if (this.alert > 0.25) {
        this.state = 'stalk';
      } else {
        this.state = 'patrol';
      }

      if (this.state === 'patrol') {
        this.patrolAngle += dt * 0.55;
        const tx = this.patrolCenter.x + Math.cos(this.patrolAngle) * this.patrolRadius;
        const tz = this.patrolCenter.z + Math.sin(this.patrolAngle) * this.patrolRadius;
        const dir = new THREE.Vector3(tx - this.position.x, 0, tz - this.position.z);
        if (dir.length() > 0.1) {
          dir.normalize();
          this.position.addScaledVector(dir, 2.2 * dt);
          this.yaw = Math.atan2(dir.x, dir.z);
        }
      } else if (this.state === 'stalk') {
        const dir = toPlayer.clone().normalize();
        this.position.addScaledVector(dir, 2.8 * dt);
        this.yaw = Math.atan2(dir.x, dir.z);
        if (!this.tipShown && dist < 14) {
          this.tipShown = true;
          this.onTip?.('Jaguar nearby! Wave torch (click / F) or noisemaker (2 then click). Or hold Ctrl to hide.');
        }
      } else if (this.state === 'chase') {
        const dir = toPlayer.clone().normalize();
        this.position.addScaledVector(dir, 6.5 * dt);
        this.yaw = Math.atan2(dir.x, dir.z);
        if (dist < 1.4 && !player.isScaring()) {
          this.onCatch?.();
        }
      }
    }

    this.group.position.copy(this.position);
    this.group.position.y = Math.sin(performance.now() * 0.01) * 0.03;
    this.group.rotation.y = this.yaw;
  }
}
