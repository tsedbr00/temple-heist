import * as THREE from 'three';
import { mats } from './materials';
import type { Player } from './Player';

export class Treasure {
  group = new THREE.Group();
  taken = false;
  private idol: THREE.Group;
  private glow: THREE.PointLight;
  position = new THREE.Vector3(0, 1.25, -40);

  constructor() {
    this.idol = new THREE.Group();

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 0.6, 8), mats.stoneAccent);
    pedestal.position.y = 0.3;
    this.idol.add(pedestal);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.4), mats.gold);
    body.position.y = 1.0;
    body.castShadow = true;
    this.idol.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mats.gold);
    head.position.y = 1.55;
    this.idol.add(head);

    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.35, 5), mats.gold);
    crown.position.y = 1.9;
    this.idol.add(crown);

    // Eyes
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x44ff88,
      emissive: 0x22aa44,
      emissiveIntensity: 0.8,
    });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), eyeMat);
    eyeL.position.set(-0.1, 1.58, 0.22);
    this.idol.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.1;
    this.idol.add(eyeR);

    this.glow = new THREE.PointLight(0xffd700, 2.2, 10, 2);
    this.glow.position.y = 1.5;
    this.idol.add(this.glow);

    this.group.add(this.idol);
    this.group.position.copy(this.position);
  }

  update(dt: number, player: Player): boolean {
    if (this.taken) return false;
    this.idol.rotation.y += dt * 0.8;
    this.idol.position.y = Math.sin(performance.now() * 0.003) * 0.08;
    this.glow.intensity = 1.8 + Math.sin(performance.now() * 0.005) * 0.5;

    const dist = player.position.distanceTo(this.position);
    if (dist < 1.6) {
      this.taken = true;
      this.group.visible = false;
      return true;
    }
    return false;
  }

  reset() {
    this.taken = false;
    this.group.visible = true;
  }
}
