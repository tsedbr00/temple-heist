import type { Player } from './Player';

const MAP_SIZE = 180;
const WORLD_HALF = 50; // world from -50..50 maps to canvas

export class FogOfWar {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private revealed: Uint8Array;
  private res = 64;

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

  update(player: Player) {
    this.revealAround(player.position.x, player.position.z, player.sprinting ? 7.5 : 5.5);
    this.draw(player);
  }

  private draw(player: Player) {
    const ctx = this.ctx;
    const s = MAP_SIZE;
    ctx.clearRect(0, 0, s, s);

    // Background fog
    ctx.fillStyle = '#050a04';
    ctx.fillRect(0, 0, s, s);

    const cell = s / this.res;
    for (let z = 0; z < this.res; z++) {
      for (let x = 0; x < this.res; x++) {
        if (!this.revealed[z * this.res + x]) continue;
        // Terrain tint by world region
        const wx = (x / this.res) * WORLD_HALF * 2 - WORLD_HALF;
        const wz = (z / this.res) * WORLD_HALF * 2 - WORLD_HALF;
        if (wz < -18 && Math.abs(wx) < 10) {
          ctx.fillStyle = '#6a6558'; // temple
        } else if (Math.abs(wx) < 3 && wz > -18 && wz < 32) {
          ctx.fillStyle = '#5a4a30'; // path
        } else {
          ctx.fillStyle = '#1e4a22'; // jungle
        }
        ctx.fillRect(x * cell, z * cell, cell + 0.5, cell + 0.5);
      }
    }

    // Temple marker (only if revealed nearby)
    const templeCell = this.worldToCell(0, -28);
    if (this.revealed[templeCell.cz * this.res + templeCell.cx]) {
      ctx.fillStyle = '#e8c56a';
      ctx.fillRect(templeCell.cx * cell - 2, templeCell.cz * cell - 2, 6, 6);
    }

    // Player arrow
    const pc = this.worldToCell(player.position.x, player.position.z);
    const px = pc.cx * cell + cell / 2;
    const pz = pc.cz * cell + cell / 2;
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-player.yaw); // map Y is -Z world; yaw 0 looks -Z
    ctx.fillStyle = '#ffe8a0';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 3);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Border vignette label
    ctx.fillStyle = 'rgba(200,180,100,0.7)';
    ctx.font = '10px sans-serif';
    ctx.fillText('MAP', 8, 14);
  }

  reset() {
    this.revealed.fill(0);
  }
}
