import * as THREE from 'three';
import { mats } from './materials';
import type { Player } from './Player';

export type TrapEvent = { type: 'damage' | 'tip' | 'solved'; message?: string };

export class TrapSystem {
  group = new THREE.Group();
  private traps: Trap[] = [];
  private onEvent?: (e: TrapEvent) => void;

  constructor(onEvent?: (e: TrapEvent) => void) {
    this.onEvent = onEvent;
    this.buildAll();
  }

  private buildAll() {
    // 1) Pressure plate → spikes in hallway entrance
    this.traps.push(new PressureSpikeTrap(this.group, new THREE.Vector3(0, 1.25, -22)));

    // 2) Dart corridor
    this.traps.push(new DartTrap(this.group, new THREE.Vector3(0, 1.25, -27)));

    // 3) Timed light beam puzzle (must step on pads in order while beam cycles)
    this.traps.push(new LightBeamPuzzle(this.group, new THREE.Vector3(0, 1.25, -33), this.onEvent));

    // Optional switch near treasure as 4th encounter flavor — pit before treasure
    this.traps.push(new PitTrap(this.group, new THREE.Vector3(0, 1.25, -37)));
  }

  update(dt: number, player: Player) {
    if (!player.alive) return;
    for (const t of this.traps) {
      const hit = t.update(dt, player);
      if (hit === 'fatal') {
        this.onEvent?.({ type: 'damage', message: t.deathMessage });
      } else if (hit === 'tip' && t.tipMessage) {
        this.onEvent?.({ type: 'tip', message: t.tipMessage });
        t.tipMessage = undefined;
      } else if (hit === 'solved') {
        this.onEvent?.({ type: 'solved', message: t.tipMessage });
      }
    }
  }

  reset() {
    for (const t of this.traps) t.reset();
  }
}

abstract class Trap {
  deathMessage = 'A temple trap got you. Classic.';
  tipMessage?: string;
  abstract update(dt: number, player: Player): 'fatal' | 'tip' | 'solved' | null;
  abstract reset(): void;
}

class PressureSpikeTrap extends Trap {
  private plate: THREE.Mesh;
  private spikes: THREE.Group;
  private armed = true;
  private cooldown = 0;
  private pos: THREE.Vector3;
  private triggered = false;
  private tipSent = false;

  constructor(parent: THREE.Group, pos: THREE.Vector3) {
    super();
    this.pos = pos.clone();
    this.deathMessage = 'Spikes! You discovered why Indiana Jones stretches first.';

    this.plate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.8), mats.plate);
    this.plate.position.copy(pos);
    parent.add(this.plate);

    this.spikes = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 5), mats.spike);
      spike.position.set(((i % 3) - 1) * 0.45, -0.4, (Math.floor(i / 3) - 1) * 0.45);
      this.spikes.add(spike);
    }
    this.spikes.position.set(pos.x, pos.y, pos.z - 1.8);
    parent.add(this.spikes);
  }

  update(dt: number, player: Player): 'fatal' | 'tip' | 'solved' | null {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const dist = Math.hypot(player.position.x - this.pos.x, player.position.z - this.pos.z);

    if (!this.tipSent && dist < 5 && player.position.z < -18) {
      this.tipSent = true;
      this.tipMessage = 'Pressure plate ahead — sprint across or edge around it!';
      return 'tip';
    }

    if (this.armed && dist < 1.0) {
      this.triggered = true;
      this.armed = false;
      this.cooldown = 2.2;
      this.plate.material = mats.plateActive;
      this.plate.position.y = this.pos.y - 0.08;
    }

    if (this.triggered) {
      this.spikes.position.y = THREE.MathUtils.damp(this.spikes.position.y, this.pos.y + 0.35, 14, dt);
      const sd = Math.hypot(player.position.x - this.spikes.position.x, player.position.z - this.spikes.position.z);
      if (sd < 1.1 && this.spikes.position.y > this.pos.y + 0.1) {
        return 'fatal';
      }
      if (this.cooldown <= 0) {
        this.triggered = false;
        this.armed = true;
        this.plate.material = mats.plate;
        this.plate.position.y = this.pos.y;
      }
    } else {
      this.spikes.position.y = THREE.MathUtils.damp(this.spikes.position.y, this.pos.y - 0.5, 6, dt);
    }
    return null;
  }

  reset() {
    this.armed = true;
    this.triggered = false;
    this.cooldown = 0;
    this.plate.material = mats.plate;
    this.plate.position.y = this.pos.y;
  }
}

class DartTrap extends Trap {
  private emitters: THREE.Mesh[] = [];
  private darts: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  private timer = 0;
  private zoneZ: number;
  private tipSent = false;
  private parent: THREE.Group;

  constructor(parent: THREE.Group, pos: THREE.Vector3) {
    super();
    this.parent = parent;
    this.zoneZ = pos.z;
    this.deathMessage = 'Poison dart! You briefly joined the wall décor.';

    for (const x of [-5.5, 5.5]) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8), mats.stoneDark);
      hole.rotation.z = Math.PI / 2;
      hole.position.set(x, pos.y + 1.2, pos.z);
      parent.add(hole);
      this.emitters.push(hole);
    }
  }

  update(dt: number, player: Player): 'fatal' | 'tip' | 'solved' | null {
    const inZone =
      Math.abs(player.position.z - this.zoneZ) < 2.5 &&
      Math.abs(player.position.x) < 5.5 &&
      player.position.z < -18;

    if (!this.tipSent && Math.abs(player.position.z - this.zoneZ) < 4 && player.position.z < -20) {
      this.tipSent = true;
      this.tipMessage = 'Dart holes in the walls — keep moving, don\'t linger!';
      return 'tip';
    }

    this.timer -= dt;
    if (inZone && this.timer <= 0) {
      this.timer = 0.7;
      const fromLeft = Math.random() > 0.5;
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.45, 5), mats.dart);
      mesh.rotation.z = Math.PI / 2;
      const y = 1.25 + 1.0 + Math.random() * 0.8;
      mesh.position.set(fromLeft ? -5.2 : 5.2, y, this.zoneZ + (Math.random() - 0.5));
      this.parent.add(mesh);
      this.darts.push({
        mesh,
        vel: new THREE.Vector3(fromLeft ? 14 : -14, 0, 0),
        life: 1.2,
      });
    }

    for (let i = this.darts.length - 1; i >= 0; i--) {
      const d = this.darts[i];
      d.mesh.position.addScaledVector(d.vel, dt);
      d.life -= dt;
      const dist = d.mesh.position.distanceTo(
        new THREE.Vector3(player.position.x, 1.4, player.position.z),
      );
      if (dist < 0.55) {
        this.clearDarts();
        return 'fatal';
      }
      if (d.life <= 0 || Math.abs(d.mesh.position.x) > 6) {
        this.parent.remove(d.mesh);
        this.darts.splice(i, 1);
      }
    }
    return null;
  }

  private clearDarts() {
    for (const d of this.darts) this.parent.remove(d.mesh);
    this.darts.length = 0;
  }

  reset() {
    this.clearDarts();
    this.timer = 0;
  }
}

class LightBeamPuzzle extends Trap {
  private beams: THREE.Mesh[] = [];
  private pads: THREE.Mesh[] = [];
  private sequence = [0, 2, 1];
  private progress = 0;
  private solved = false;
  private beamAngle = 0;
  private gate: THREE.Mesh;
  private tipSent = false;
  private pos: THREE.Vector3;

  constructor(parent: THREE.Group, pos: THREE.Vector3, _onEvent?: (e: TrapEvent) => void) {
    super();
    this.pos = pos.clone();
    this.deathMessage = 'The light beam tagged you. Photogenic, but fatal.';

    // Three floor pads
    for (let i = 0; i < 3; i++) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 12), mats.plate);
      pad.position.set(-2.5 + i * 2.5, pos.y, pos.z);
      parent.add(pad);
      this.pads.push(pad);
    }

    // Rotating beam source
    const source = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), mats.gold);
    source.position.set(0, pos.y + 2.8, pos.z + 2.5);
    parent.add(source);

    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 7), mats.beam);
    beam.position.set(0, pos.y + 1.5, pos.z);
    parent.add(beam);
    this.beams.push(beam);

    // Gate blocking treasure approach
    this.gate = new THREE.Mesh(new THREE.BoxGeometry(8, 3.5, 0.4), mats.stoneDark);
    this.gate.position.set(0, pos.y + 1.7, pos.z - 2.8);
    parent.add(this.gate);
  }

  update(dt: number, player: Player): 'fatal' | 'tip' | 'solved' | null {
    if (this.solved) return null;

    if (!this.tipSent && Math.abs(player.position.z - this.pos.z) < 5 && player.position.z < -28) {
      this.tipSent = true;
      this.tipMessage = 'Puzzle: step the glowing pads in order LEFT → RIGHT → MIDDLE while avoiding the beam!';
      return 'tip';
    }

    this.beamAngle += dt * 1.1;
    const beam = this.beams[0];
    const bx = Math.sin(this.beamAngle) * 3.5;
    beam.position.x = bx;
    beam.rotation.y = 0;

    // Beam collision (vertical slab)
    if (
      Math.abs(player.position.x - bx) < 0.55 &&
      Math.abs(player.position.z - this.pos.z) < 3.2 &&
      player.position.z < this.pos.z + 2.5
    ) {
      return 'fatal';
    }

    // Pad stepping
    for (let i = 0; i < this.pads.length; i++) {
      const pad = this.pads[i];
      const d = Math.hypot(player.position.x - pad.position.x, player.position.z - pad.position.z);
      if (d < 0.7) {
        if (this.sequence[this.progress] === i) {
          pad.material = mats.gold;
          this.progress++;
          if (this.progress >= this.sequence.length) {
            this.solved = true;
            this.gate.position.y = -5;
            this.tipMessage = 'Gate opens! The idol awaits.';
            return 'solved';
          }
        } else if (pad.material !== mats.gold) {
          // wrong pad resets
          this.progress = 0;
          for (const p of this.pads) p.material = mats.plate;
        }
      }
    }

    // Highlight next pad softly
    if (!this.solved) {
      const next = this.sequence[this.progress];
      for (let i = 0; i < this.pads.length; i++) {
        if (this.pads[i].material === mats.gold) continue;
        this.pads[i].material = i === next ? mats.plateActive : mats.plate;
      }
    }

    // Gate collision — block player via hard position clamp (handled visually; Game can check)
    if (!this.solved) {
      if (
        player.position.z < this.gate.position.z + 0.5 &&
        player.position.z > this.gate.position.z - 0.5 &&
        Math.abs(player.position.x) < 4
      ) {
        player.position.z = this.gate.position.z + 0.55;
      }
    }

    return null;
  }

  reset() {
    this.progress = 0;
    this.solved = false;
    for (const p of this.pads) p.material = mats.plate;
    this.gate.position.set(0, this.pos.y + 1.7, this.pos.z - 2.8);
  }
}

class PitTrap extends Trap {
  private cover: THREE.Mesh;
  private pit: THREE.Mesh;
  private open = false;
  private pos: THREE.Vector3;
  private tipSent = false;
  private timer = 0;

  constructor(parent: THREE.Group, pos: THREE.Vector3) {
    super();
    this.pos = pos.clone();
    this.deathMessage = 'You fell in a pit. The idol heard the echo and laughed.';

    this.pit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 2.4), mats.stoneDark);
    this.pit.position.set(pos.x, pos.y - 1.2, pos.z);
    parent.add(this.pit);

    this.cover = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.15, 2.5), mats.plate);
    this.cover.position.copy(pos);
    parent.add(this.cover);
  }

  update(dt: number, player: Player): 'fatal' | 'tip' | 'solved' | null {
    if (!this.tipSent && Math.abs(player.position.z - this.pos.z) < 4 && player.position.z < -34) {
      this.tipSent = true;
      this.tipMessage = 'Unstable floor — cross quickly before it drops!';
      return 'tip';
    }

    const dist = Math.hypot(player.position.x - this.pos.x, player.position.z - this.pos.z);
    if (dist < 1.4 && !this.open) {
      this.timer += dt;
      if (this.timer > 0.45) {
        this.open = true;
        this.cover.position.y = -2;
      }
    } else if (dist >= 1.4) {
      this.timer = 0;
    }

    if (this.open && dist < 1.0) {
      return 'fatal';
    }
    return null;
  }

  reset() {
    this.open = false;
    this.timer = 0;
    this.cover.position.copy(this.pos);
  }
}
