import * as THREE from 'three';
import { mats } from './materials';
import type { Input, ToolId } from './Input';

export class Player {
  group = new THREE.Group();
  position = new THREE.Vector3(0, 0, 28);
  yaw = Math.PI; // face toward temple (north / -Z)
  pitch = 0.15;
  velocity = new THREE.Vector3();
  height = 1.7;
  radius = 0.35;
  onGround = true;
  alive = true;
  torchActive = false;
  torchWaveT = 0;
  noiseActive = false;
  noiseT = 0;
  hiding = false;
  sprinting = false;
  /** Fired when torch/noise is used (for SFX). */
  onToolUse?: (tool: ToolId) => void;
  private torchMesh: THREE.Group;
  private flameLight: THREE.PointLight;
  private bodyGroup: THREE.Group;
  private torchArm: THREE.Group;

  constructor() {
    this.bodyGroup = this.buildBody();
    this.group.add(this.bodyGroup);

    this.torchArm = new THREE.Group();
    this.torchArm.position.set(0.35, 1.1, 0.15);
    this.torchMesh = this.buildTorch();
    this.torchArm.add(this.torchMesh);
    this.group.add(this.torchArm);

    this.flameLight = new THREE.PointLight(0xff9944, 0, 10, 2);
    this.flameLight.position.set(0, 0.55, 0);
    this.torchMesh.add(this.flameLight);

    this.group.position.copy(this.position);
  }

  private buildBody(): THREE.Group {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.55, 4, 8), mats.playerBody);
    torso.position.y = 1.05;
    torso.castShadow = true;
    g.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mats.playerSkin);
    head.position.y = 1.65;
    head.castShadow = true;
    g.add(head);

    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.18, 10), mats.playerHat);
    hat.position.y = 1.82;
    g.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 12), mats.playerHat);
    brim.position.y = 1.74;
    g.add(brim);

    const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.4, 3, 6), mats.playerBody);
    legL.position.set(-0.12, 0.4, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.12;
    g.add(legR);

    return g;
  }

  private buildTorch(): THREE.Group {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.7, 6), mats.trunk);
    stick.position.y = 0.2;
    g.add(stick);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mats.flame);
    head.position.y = 0.55;
    head.name = 'flame';
    g.add(head);
    return g;
  }

  update(
    dt: number,
    input: Input,
    collide: (pos: THREE.Vector3, radius: number) => THREE.Vector3,
    inTightSpace: boolean,
  ) {
    if (!this.alive) return;

    const { dx, dy } = input.consumeMouse();
    this.yaw -= dx * 0.0035;
    this.pitch -= dy * 0.003;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -0.4, 0.55);

    const move = input.moveVector();
    this.hiding = input.isHiding();
    this.sprinting = move.sprint && !this.hiding;
    const speed = this.hiding ? 2.5 : this.sprinting ? 11 : 6.5;

    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const wish = new THREE.Vector3()
      .addScaledVector(right, move.x)
      .addScaledVector(forward, -move.z);

    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(speed * Math.min(1, Math.hypot(move.x, move.z) || 1));
      // For analog stick, re-apply magnitude
      const mag = Math.min(1, Math.hypot(move.x, move.z));
      if (mag > 0 && mag < 0.99) {
        wish.normalize().multiplyScalar(speed * mag);
      }
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, wish.x, 18, dt);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, wish.z, 18, dt);
    } else {
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, 14, dt);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, 14, dt);
    }

    const next = this.position.clone();
    next.x += this.velocity.x * dt;
    next.z += this.velocity.z * dt;
    const resolved = collide(next, this.radius);
    this.position.x = resolved.x;
    this.position.z = resolved.z;
    this.position.y = 0;

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;

    this.torchMesh.visible = true;

    if (input.consumeUse()) {
      if (input.tool === 'torch') {
        this.torchWaveT = 0.85;
        this.torchActive = true;
        this.onToolUse?.('torch');
      } else {
        this.noiseT = 1.2;
        this.noiseActive = true;
        this.onToolUse?.('noise');
      }
    }

    if (this.torchWaveT > 0) {
      this.torchWaveT -= dt;
      this.torchArm.rotation.z = Math.sin(this.torchWaveT * 22) * 0.55;
      this.torchArm.rotation.x = Math.sin(this.torchWaveT * 18) * 0.35;
      this.flameLight.intensity = 3.5 + Math.sin(performance.now() * 0.02) * 0.8;
      const flame = this.torchMesh.getObjectByName('flame') as THREE.Mesh;
      if (flame) flame.scale.setScalar(1.2 + Math.sin(performance.now() * 0.03) * 0.2);
    } else {
      this.torchActive = false;
      this.torchArm.rotation.z = THREE.MathUtils.damp(this.torchArm.rotation.z, 0.15, 8, dt);
      this.torchArm.rotation.x = THREE.MathUtils.damp(this.torchArm.rotation.x, 0, 8, dt);
      this.flameLight.intensity = inTightSpace ? 2.4 : 1.5;
      const flame = this.torchMesh.getObjectByName('flame') as THREE.Mesh;
      if (flame) {
        const s = 0.9 + Math.sin(performance.now() * 0.012) * 0.08;
        flame.scale.setScalar(s);
      }
    }

    if (this.noiseT > 0) {
      this.noiseT -= dt;
      this.noiseActive = true;
    } else {
      this.noiseActive = false;
    }

    const moving = wish.lengthSq() > 0.01;
    if (moving) {
      const bob = Math.sin(performance.now() * 0.012 * (this.sprinting ? 1.5 : 1)) * 0.04;
      this.bodyGroup.position.y = bob;
    } else {
      this.bodyGroup.position.y = THREE.MathUtils.damp(this.bodyGroup.position.y, 0, 8, dt);
    }

    if (this.hiding) {
      this.bodyGroup.scale.y = THREE.MathUtils.damp(this.bodyGroup.scale.y, 0.65, 10, dt);
    } else {
      this.bodyGroup.scale.y = THREE.MathUtils.damp(this.bodyGroup.scale.y, 1, 10, dt);
    }
  }

  scareRadius(): number {
    if (this.torchWaveT > 0) return 9;
    if (this.noiseT > 0) return 14;
    if (this.hiding) return 0;
    return 0;
  }

  isScaring(): boolean {
    return this.torchWaveT > 0 || this.noiseT > 0;
  }

  reset(pos: THREE.Vector3, yaw?: number) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.alive = true;
    this.torchWaveT = 0;
    this.noiseT = 0;
    if (yaw !== undefined) this.yaw = yaw;
    this.group.position.copy(this.position);
  }
}
