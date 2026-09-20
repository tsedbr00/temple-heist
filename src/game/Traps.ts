import * as THREE from 'three';
import { mats } from './materials';
import type { Player } from './Player';

export type TrapEvent = { type: 'damage' | 'tip' | 'solved' | 'sfx'; message?: string; sfx?: string };

export class TrapSystem {
  group = new THREE.Group();
  private traps: Trap[] = [];
  private onEvent?: (e: TrapEvent) => void;

  constructor(onEvent?: (e: TrapEvent) => void) {
    this.onEvent = onEvent;
    this.buildAll();
  }

  private buildAll() {
    this.traps.push(new PressureSpikeTrap(this.group, new THREE.Vector3(0, 1.25, -22)));
    this.traps.push(new DartTrap(this.group, new THREE.Vector3(0, 1.25, -27)));
    this.traps.push(new LightBeamPuzzle(this.group, new THREE.Vector3(0, 1.25, -33), this.onEvent));
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
      } else if (hit === 'sfx') {
        this.onEvent?.({ type: 'sfx', sfx: t.sfxId });
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
  sfxId?: string;
  abstract update(dt: number, player: Player): 'fatal' | 'tip' | 'solved' | 'sfx' | null;
  abstract reset(): void;
}

class PressureSpikeTrap extends Trap {
  private plate: THREE.Mesh;
  private warnRing: THREE.Mesh;
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

    this.plate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.8), mats.plateDanger);
    this.plate.position.copy(pos);
    parent.add(this.plate);

    // Danger telegraph ring
    this.warnRing = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.25, 24), mats.dangerRing);
    this.warnRing.rotation.x = -Math.PI / 2;
    this.warnRing.position.set(pos.x, pos.y + 0.08, pos.z);
    parent.add(this.warnRing);

    // Spike zone marker (subtle red floor tint)
    const dangerFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshStandardMaterial({
        color: 0x662222,
        emissive: 0x331010,
        emissiveIntensity: 0.25,
        transparent: true,
        opacity: 0.55,
      }),
    );
    dangerFloor.rotation.x = -Math.PI / 2;
    dangerFloor.position.set(pos.x, pos.y + 0.02, pos.z - 1.8);
    parent.add(dangerFloor);

    this.spikes = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 5), mats.spike);
      spike.position.set(((i % 3) - 1) * 0.45, -0.4, (Math.floor(i / 3) - 1) * 0.45);
      this.spikes.add(spike);
    }
    this.spikes.position.set(pos.x, pos.y, pos.z - 1.8);
    parent.add(this.spikes);
  }

  update(dt: number, player: Player): 'fatal' | 'tip' | 'solved' | 'sfx' | null {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const dist = Math.hypot(player.position.x - this.pos.x, player.position.z - this.pos.z);

    // Pulse warn ring when nearby
    const near = dist < 6;
    this.warnRing.visible = this.armed && near;
    if (this.warnRing.visible) {
      (this.warnRing.material as THREE.MeshStandardMaterial).opacity =
        0.25 + Math.sin(performance.now() * 0.01) * 0.15;
    }

    if (!this.tipSent && dist < 5 && player.position.z < -18) {
      this.tipSent = true;
      this.tipMessage = '⚠ Red plate + red floor = spikes. Sprint across or edge around!';
      return 'tip';
    }

    if (this.armed && dist < 1.0) {
      this.triggered = true;
      this.armed = false;
      this.cooldown = 2.2;
      this.plate.material = mats.plateActive;
      this.plate.position.y = this.pos.y - 0.08;
      this.sfxId = 'trap';
      return 'sfx';
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
        this.plate.material = mats.plateDanger;
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
    this.plate.material = mats.plateDanger;
    this.plate.position.y = this.pos.y;
  }
}

class DartTrap extends Trap {
  private emitters: THREE.Mesh[] = [];
  private warnLights: THREE.PointLight[] = [];
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
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.45, 8), mats.stoneDark);
      hole.rotation.z = Math.PI / 2;
      hole.position.set(x, pos.y + 1.2, pos.z);
      parent.add(hole);
      this.emitters.push(hole);

      // Red warning gem above hole
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mats.plateActive);
      gem.position.set(x > 0 ? 5.3 : -5.3, pos.y + 1.7, pos.z);
      parent.add(gem);
      const pl = new THREE.PointLight(0xff4422, 0.4, 4, 2);
      pl.position.copy(gem.position);
      parent.add(pl);
      this.warnLights.push(pl);
    }

    // Floor hazard stripe
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 0.35),
      new THREE.MeshStandardMaterial({
        color: 0xaa4422,
        emissive: 0x661100,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.5,
      }),
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, pos.y + 0.03, pos.z);
    parent.add(stripe);
  }

  update(dt: number, player: Player): 'fatal' | 'tip' | 'solved' | 'sfx' | null {
    const inZone =
      Math.abs(player.position.z - this.zoneZ) < 2.5 &&
      Math.abs(player.position.x) < 5.5 &&
      player.position.z < -18;

    for (const pl of this.warnLights) {
      pl.intensity = inZone ? 0.9 + Math.sin(performance.now() * 0.02) * 0.3 : 0.35;
    }

    if (!this.tipSent && Math.abs(player.position.z - this.zoneZ) < 4 && player.position.z < -20) {
      this.tipSent = true;
      this.tipMessage = '⚠ Red wall gems = dart corridor. Keep moving — don\'t linger!';
      return 'tip';
    }

    this.timer -= dt;
    if (inZone && this.timer <= 0) {
      this.timer = 0.65;
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
  private padLabels: THREE.Mesh[] = [];
  private sequence = [0, 2, 1];
  private progress = 0;
  private solved = false;
  private beamAngle = 0;
  private gate: THREE.Mesh;
  private tipSent = false;
  private pos: THREE.Vector3;
  private lastPad = -1;

  constructor(parent: THREE.Group, pos: THREE.Vector3, _onEvent?: (e: TrapEvent) => void) {
    super();
    this.pos = pos.clone();
    this.deathMessage = 'The light beam tagged you. Photogenic, but fatal.';

    const labelColors = [0x4488ff, 0x44cc66, 0xffcc44];
    for (let i = 0; i < 3; i++) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 12), mats.plate);
      pad.position.set(-2.5 + i * 2.5, pos.y, pos.z);
      parent.add(pad);
      this.pads.push(pad);

      // Number disc on pad (readability)
      const label = new THREE.Mesh(
        new THREE.CircleGeometry(0.22, 12),
        new THREE.MeshStandardMaterial({
          color: labelColors[i],
          emissive: labelColors[i],
          emissiveIntensity: 0.5,
        }),
      );
      label.rotation.x = -Math.PI / 2;
      label.position.set(pad.position.x, pos.y + 0.08, pad.position.z);
      parent.add(label);
      this.padLabels.push(label);
    }

    // Sequence hint glyphs on wall (L → R → M visual)
    const hint = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.55),
      new THREE.MeshStandardMaterial({
        color: 0x2a2a20,
        emissive: 0x886622,
        emissiveIntensity: 0.35,
      }),
    );
    hint.position.set(0, pos.y + 2.4, pos.z + 2.2);
    parent.add(hint);

    const source = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), mats.gold);
    source.position.set(0, pos.y + 2.8, pos.z + 2.5);
    parent.add(source);

    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 7), mats.beam);
    beam.position.set(0, pos.y + 1.5, pos.z);
    parent.add(beam);
    this.beams.push(beam);

    // Beam danger floor track
    const track = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 5.5),
      new THREE.MeshStandardMaterial({
        color: 0x3a3020,
        emissive: 0x332208,
        emissiveIntensity: 0.15,
        transparent: true,
        opacity: 0.4,
      }),
    );
    track.rotation.x = -Math.PI / 2;
    track.position.set(0, pos.y + 0.02, pos.z);
    parent.add(track);

    this.gate = new THREE.Mesh(new THREE.BoxGeometry(8, 3.5, 0.4), mats.stoneDark);
    this.gate.position.set(0, pos.y + 1.7, pos.z - 2.8);
    parent.add(this.gate);

    // Gate "locked" glow strip
    const lockStrip = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 0.15, 0.15),
      mats.plateActive,
    );
    lockStrip.position.set(0, pos.y + 3.2, pos.z - 2.55);
    lockStrip.name = 'lockStrip';
    this.gate.add(lockStrip);
    lockStrip.position.set(0, 1.5, 0.15);
  }

  update(dt: number, player: Player): 'fatal' | 'tip' | 'solved' | 'sfx' | null {
    if (this.solved) return null;

    if (!this.tipSent && Math.abs(player.position.z - this.pos.z) < 5 && player.position.z < -28) {
      this.tipSent = true;
      this.tipMessage =
        'Puzzle: step glowing pads LEFT → RIGHT → MIDDLE (blue→green→gold order). Avoid the sweeping beam!';
      return 'tip';
    }

    this.beamAngle += dt * 1.05;
    const beam = this.beams[0];
    const bx = Math.sin(this.beamAngle) * 3.5;
    beam.position.x = bx;

    if (
      Math.abs(player.position.x - bx) < 0.55 &&
      Math.abs(player.position.z - this.pos.z) < 3.2 &&
      player.position.z < this.pos.z + 2.5
    ) {
      return 'fatal';
    }

    let result: 'fatal' | 'tip' | 'solved' | 'sfx' | null = null;

    for (let i = 0; i < this.pads.length; i++) {
      const pad = this.pads[i];
      const d = Math.hypot(player.position.x - pad.position.x, player.position.z - pad.position.z);
      if (d < 0.7) {
        if (this.lastPad === i) continue;
        this.lastPad = i;
        if (this.sequence[this.progress] === i) {
          pad.material = mats.gold;
          this.progress++;
          this.sfxId = 'pad';
          result = 'sfx';
          if (this.progress >= this.sequence.length) {
            this.solved = true;
            this.gate.position.y = -5;
            this.tipMessage = 'Gate unlocks with a satisfying grind. The idol awaits!';
            return 'solved';
          }
        } else if (pad.material !== mats.gold) {
          this.progress = 0;
          for (const p of this.pads) {
            if (p.material !== mats.gold) p.material = mats.plate;
          }
          // Reset completed pads too on wrong step
          for (const p of this.pads) p.material = mats.plate;
        }
      }
    }
    // Clear lastPad when off all pads
    let onAny = false;
    for (const pad of this.pads) {
      if (Math.hypot(player.position.x - pad.position.x, player.position.z - pad.position.z) < 0.7) {
        onAny = true;
        break;
      }
    }
    if (!onAny) this.lastPad = -1;

    if (!this.solved) {
      const next = this.sequence[this.progress];
      for (let i = 0; i < this.pads.length; i++) {
        if (this.pads[i].material === mats.gold) continue;
        this.pads[i].material = i === next ? mats.plateNext : mats.plate;
      }
    }

    if (!this.solved) {
      if (
        player.position.z < this.gate.position.z + 0.5 &&
        player.position.z > this.gate.position.z - 0.5 &&
        Math.abs(player.position.x) < 4
      ) {
        player.position.z = this.gate.position.z + 0.55;
      }
    }

    return result;
  }

  reset() {
    this.progress = 0;
    this.solved = false;
    this.lastPad = -1;
    for (const p of this.pads) p.material = mats.plate;
    this.gate.position.set(0, this.pos.y + 1.7, this.pos.z - 2.8);
  }
}

class PitTrap extends Trap {
  private cover: THREE.Mesh;
  private crack: THREE.Mesh;
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

    this.cover = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.15, 2.5), mats.plateDanger);
    this.cover.position.copy(pos);
    parent.add(this.cover);

    // Cracks telegraph
    this.crack = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 1.15, 16),
      new THREE.MeshStandardMaterial({
        color: 0x221810,
        emissive: 0x441808,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.7,
      }),
    );
    this.crack.rotation.x = -Math.PI / 2;
    this.crack.position.set(pos.x, pos.y + 0.1, pos.z);
    parent.add(this.crack);
  }

  update(dt: number, player: Player): 'fatal' | 'tip' | 'solved' | 'sfx' | null {
    if (!this.tipSent && Math.abs(player.position.z - this.pos.z) < 4 && player.position.z < -34) {
      this.tipSent = true;
      this.tipMessage = '⚠ Cracked red floor — sprint across before it drops!';
      return 'tip';
    }

    const dist = Math.hypot(player.position.x - this.pos.x, player.position.z - this.pos.z);
    if (dist < 1.4 && !this.open) {
      this.timer += dt;
      // Shake cover as warning
      this.cover.position.x = this.pos.x + Math.sin(this.timer * 40) * 0.03 * this.timer;
      (this.crack.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + this.timer * 1.2;
      if (this.timer > 0.45) {
        this.open = true;
        this.cover.position.y = -2;
        this.crack.visible = false;
        this.sfxId = 'trap';
        return 'sfx';
      }
    } else if (dist >= 1.4) {
      this.timer = 0;
      this.cover.position.x = this.pos.x;
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
    this.crack.visible = true;
    (this.crack.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
  }
}
