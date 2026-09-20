import * as THREE from 'three';
import type { Player } from './Player';

export class CameraController {
  camera: THREE.PerspectiveCamera;
  // idealDist via currentDist
  private idealHeight = 2.8;
  private currentDist = 6.5;
  private shake = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 200);
  }

  setShake(amount: number) {
    this.shake = Math.max(this.shake, amount);
  }

  update(dt: number, player: Player, preferClose: boolean) {
    const targetDist = preferClose ? 3.2 : 6.5;
    const targetHeight = preferClose ? 2.1 : 2.8;
    this.currentDist = THREE.MathUtils.damp(this.currentDist, targetDist, 5, dt);
    this.idealHeight = THREE.MathUtils.damp(this.idealHeight, targetHeight, 5, dt);

    const yaw = player.yaw;
    const pitch = player.pitch;
    const dist = this.currentDist;

    const offset = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch) * dist,
      this.idealHeight + Math.sin(pitch) * dist * 0.5,
      Math.cos(yaw) * Math.cos(pitch) * dist,
    );

    const desired = player.position.clone().add(offset);
    desired.y = Math.max(desired.y, 1.2);

    this.camera.position.lerp(desired, 1 - Math.exp(-8 * dt));

    const lookAt = player.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    // Look slightly ahead
    lookAt.x += Math.sin(yaw) * 1.5;
    lookAt.z += Math.cos(yaw) * 1.5;
    this.camera.lookAt(lookAt);

    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.6;
      this.shake = THREE.MathUtils.damp(this.shake, 0, 8, dt);
    }
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
