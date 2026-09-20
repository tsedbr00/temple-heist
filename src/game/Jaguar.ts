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
  private chaseTipShown = false;
  private eyes: THREE.Mesh[] = [];
  private alertRing: THREE.Mesh;
  private bodyRoot: THREE.Group;
  private scareBurst: THREE.Points | null = null;
  private scareBurstT = 0;
  onTip?: (msg: string) => void;
  onCatch?: () => void;
  onStateChange?: (state: JaguarState) => void;

  constructor(x: number, z: number, patrolRadius = 6) {
    this.patrolCenter = new THREE.Vector3(x, 0, z);
    this.position.set(x, 0, z);
    this.patrolRadius = patrolRadius;
    this.bodyRoot = this.buildMesh();
    this.group.add(this.bodyRoot);

    // Ground telegraph ring (visible when alert rises)
    const ringGeo = new THREE.RingGeometry(0.9, 1.15, 24);
    this.alertRing = new THREE.Mesh(ringGeo, mats.dangerRing.clone());
    this.alertRing.rotation.x = -Math.PI / 2;
    this.alertRing.position.y = 0.08;
    this.alertRing.visible = false;
    (this.alertRing.material as THREE.MeshStandardMaterial).opacity = 0.35;
    this.group.add(this.alertRing);

    this.group.position.copy(this.position);
  }

  private buildMesh(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 8), mats.jaguarBody);
    body.rotation.z = Math.PI / 2;
    body.position.set(0, 0.55, 0);
    body.castShadow = true;
    g.add(body);

    for (let i = 0; i < 10; i++) {
      const spot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), mats.jaguarSpot);
      spot.position.set(
        (Math.random() - 0.5) * 0.5,
        0.62 + Math.random() * 0.18,
        (Math.random() - 0.5) * 0.95,
      );
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

    // Glowing eyes for telegraph
    for (const ox of [-0.08, 0.08]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), mats.jaguarEye.clone());
      eye.position.set(ox, 0.68, 0.72);
      g.add(eye);
      this.eyes.push(eye);
    }

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

  private setEyeMat(mat: THREE.Material) {
    for (const e of this.eyes) e.material = mat;
  }

  private spawnScareBurst() {
    const count = 18;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 1] = 0.4 + Math.random() * 0.6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffcc66,
      size: 0.18,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    if (this.scareBurst) this.group.remove(this.scareBurst);
    this.scareBurst = new THREE.Points(geo, mat);
    this.group.add(this.scareBurst);
    this.scareBurstT = 0.55;
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

    if (scareR > 0 && dist < scareR && player.isScaring()) {
      if (this.state !== 'flee') {
        this.spawnScareBurst();
        this.onTip?.(
          player.torchWaveT > 0
            ? 'Torch flare! The jaguar yelps and bolts into the brush.'
            : 'Noisemaker chaos! Spotted menace: exiting stage left.',
        );
        this.onStateChange?.('flee');
      }
      this.state = 'flee';
      this.fleeTimer = 3.5;
      this.tipShown = true;
    }

    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      const away = this.position.clone().sub(player.position).normalize();
      this.position.addScaledVector(away, 11 * dt);
      this.yaw = Math.atan2(away.x, away.z);
      this.bodyRoot.scale.setScalar(1.15);
      this.setEyeMat(mats.jaguarEye);
      this.alertRing.visible = false;
      if (this.fleeTimer <= 0 || this.position.distanceTo(this.patrolCenter) > 40) {
        this.state = 'gone';
        this.onTip?.('One less spotted problem. Keep moving toward the temple.');
        this.onStateChange?.('gone');
      }
    } else if (this.state === 'patrol' || this.state === 'stalk' || this.state === 'chase') {
      const detectRange = player.hiding ? 4.5 : player.sprinting ? 18 : 12;
      if (dist < detectRange) {
        this.alert = Math.min(1, this.alert + dt * (player.hiding ? 0.15 : 0.5));
      } else {
        this.alert = Math.max(0, this.alert - dt * 0.25);
      }

      let next: JaguarState = 'patrol';
      if (this.alert > 0.7) next = 'chase';
      else if (this.alert > 0.25) next = 'stalk';

      if (next !== this.state) {
        if (next === 'stalk' && this.state === 'patrol') {
          this.onStateChange?.('stalk');
          if (!this.tipShown && dist < 16) {
            this.tipShown = true;
            this.onTip?.(
              'Jaguar stalking… eyes glowing. Wave torch / noisemaker, or hold Hide!',
            );
          }
        }
        if (next === 'chase') {
          this.onStateChange?.('chase');
          if (!this.chaseTipShown) {
            this.chaseTipShown = true;
            this.onTip?.('CHASE! Scare it NOW (torch or noise) or sprint for cover!');
          }
        }
        this.state = next;
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
        this.setEyeMat(mats.jaguarEye);
        this.alertRing.visible = false;
        this.bodyRoot.scale.set(1.15, 1.15, 1.15);
      } else if (this.state === 'stalk') {
        const dir = toPlayer.clone().normalize();
        this.position.addScaledVector(dir, 2.8 * dt);
        this.yaw = Math.atan2(dir.x, dir.z);
        this.setEyeMat(mats.jaguarEyeAlert);
        this.alertRing.visible = true;
        (this.alertRing.material as THREE.MeshStandardMaterial).color.setHex(0xffaa22);
        (this.alertRing.material as THREE.MeshStandardMaterial).emissive.setHex(0xff8800);
        const pulse = 0.3 + Math.sin(performance.now() * 0.008) * 0.12;
        (this.alertRing.material as THREE.MeshStandardMaterial).opacity = pulse;
        // Crouch telegraph
        this.bodyRoot.scale.set(1.15, 0.95, 1.2);
      } else if (this.state === 'chase') {
        const dir = toPlayer.clone().normalize();
        this.position.addScaledVector(dir, 6.5 * dt);
        this.yaw = Math.atan2(dir.x, dir.z);
        this.setEyeMat(mats.jaguarEyeChase);
        this.alertRing.visible = true;
        (this.alertRing.material as THREE.MeshStandardMaterial).color.setHex(0xff3322);
        (this.alertRing.material as THREE.MeshStandardMaterial).emissive.setHex(0xff1100);
        (this.alertRing.material as THREE.MeshStandardMaterial).opacity =
          0.45 + Math.sin(performance.now() * 0.02) * 0.2;
        this.bodyRoot.scale.set(1.2, 1.15, 1.25);
        if (dist < 1.4 && !player.isScaring()) {
          this.onCatch?.();
        }
      }
    }

    // Scare particles
    if (this.scareBurst && this.scareBurstT > 0) {
      this.scareBurstT -= dt;
      const pos = this.scareBurst.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, pos.getY(i) + dt * 2.5);
        pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * dt * 2);
        pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * dt * 2);
      }
      pos.needsUpdate = true;
      (this.scareBurst.material as THREE.PointsMaterial).opacity = Math.max(0, this.scareBurstT / 0.55);
      if (this.scareBurstT <= 0) {
        this.group.remove(this.scareBurst);
        this.scareBurst = null;
      }
    }

    this.group.position.copy(this.position);
    const bob =
      this.state === 'chase'
        ? Math.sin(performance.now() * 0.02) * 0.05
        : Math.sin(performance.now() * 0.01) * 0.03;
    this.group.position.y = bob;
    this.group.rotation.y = this.yaw;
  }
}
