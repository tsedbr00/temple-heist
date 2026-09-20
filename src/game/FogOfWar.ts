import type { Player } from './Player';
import type { Jaguar } from './Jaguar';

const MAP_SIZE = 180;
const WORLD_HALF = 50;

export class FogOfWar {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private revealed: Uint8Array;
  private res = 72;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.revealed = new Uint8Array(this.res * this.res);
  }

  private worldToCell(x: number, z: number): { cx: number; cz: number } {
    const cx = Math.floor(((x + WORLD_HALF) / (WORLD_HALF * 2)) * this.res);
    const cz = Math.floor(((z + WORLD_HALF) / (WORLD_HALF * 2)) * this.res);
    return {
      cx: Math.max(0, Math.min(this.res - 1, cx)),
      cz: Math.max(0, Math.min(this.res - 1, cz)),
    };
  }

  private worldToPx(x: number, z: number): { px: number; pz: number } {
    const px = ((x + WORLD_HALF) / (WORLD_HALF * 2)) * MAP_SIZE;
    const pz = ((z + WORLD_HALF) / (WORLD_HALF * 2)) * MAP_SIZE;
    return { px, pz };
  }

  revealAround(x: number, z: number, radiusWorld = 6) {
    const { cx, cz } = this.worldToCell(x, z);
    const r = Math.ceil((radiusWorld / (WORLD_HALF * 2)) * this.res);
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz > r * r) continue;
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= this.res || nz >= this.res) continue;
        this.revealed[nz * this.res + nx] = 1;
      }
    }
  }

  update(player: Player, jaguars?: Jaguar[]) {
    this.revealAround(player.position.x, player.position.z, player.sprinting ? 7.5 : 5.5);
    this.draw(player, jaguars);
  }

  private draw(player: Player, jaguars?: Jaguar[]) {
    const ctx = this.ctx;
    const s = MAP_SIZE;
    ctx.clearRect(0, 0, s, s);

    ctx.fillStyle = '#040806';
    ctx.fillRect(0, 0, s, s);

    const cell = s / this.res;
    for (let z = 0; z < this.res; z++) {
      for (let x = 0; x < this.res; x++) {
        if (!this.revealed[z * this.res + x]) continue;
        const wx = (x / this.res) * WORLD_HALF * 2 - WORLD_HALF;
        const wz = (z / this.res) * WORLD_HALF * 2 - WORLD_HALF;
        if (wz < -18 && Math.abs(wx) < 10) {
          ctx.fillStyle = '#7a7464';
        } else if (Math.abs(wx) < 3.2 && wz > -18 && wz < 32) {
          ctx.fillStyle = '#6a5530';
        } else {
          ctx.fillStyle = '#1a4a24';
        }
        ctx.fillRect(x * cell, z * cell, cell + 0.6, cell + 0.6);
      }
    }

    // Soft fog edge over unrevealed (already dark)

    // Temple marker
    const templeCell = this.worldToCell(0, -28);
    if (this.revealed[templeCell.cz * this.res + templeCell.cx]) {
      ctx.fillStyle = '#e8c56a';
      ctx.strokeStyle = '#fff2b0';
      ctx.lineWidth = 1;
      const tx = templeCell.cx * cell;
      const tz = templeCell.cz * cell;
      ctx.beginPath();
      ctx.moveTo(tx + cell / 2, tz - 2);
      ctx.lineTo(tx + cell + 2, tz + cell + 2);
      ctx.lineTo(tx - 2, tz + cell + 2);
      ctx.closePath();
      ctx.fill();
    }

    // Camp marker
    const camp = this.worldToCell(0, 28);
    if (this.revealed[camp.cz * this.res + camp.cx]) {
      ctx.fillStyle = '#88ccff';
      ctx.fillRect(camp.cx * cell, camp.cz * cell, 4, 4);
    }

    // Jaguar blips when nearby / revealed
    if (jaguars) {
      for (const j of jaguars) {
        if (j.state === 'gone') continue;
        const jc = this.worldToCell(j.position.x, j.position.z);
        if (!this.revealed[jc.cz * this.res + jc.cx]) continue;
        const { px, pz } = this.worldToPx(j.position.x, j.position.z);
        ctx.fillStyle = j.state === 'chase' ? '#ff4422' : j.state === 'stalk' ? '#ffaa22' : '#cc8844';
        ctx.beginPath();
        ctx.arc(px, pz, j.state === 'chase' ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player arrow
    const { px, pz } = this.worldToPx(player.position.x, player.position.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-player.yaw);
    ctx.fillStyle = '#ffe8a0';
    ctx.strokeStyle = '#1a1208';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Compass + label
    ctx.fillStyle = 'rgba(220,190,100,0.85)';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('MAP', 8, 14);
    ctx.font = '9px sans-serif';
    ctx.fillStyle = 'rgba(180,200,160,0.7)';
    ctx.fillText('N', s / 2 - 3, 12);
  }

  reset() {
    this.revealed.fill(0);
  }
}
