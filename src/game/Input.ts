export type ToolId = 'torch' | 'noise';

export class Input {
  readonly keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  pointerLocked = false;
  tool: ToolId = 'torch';
  usePressed = false;
  interactPressed = false;
  

  constructor(canvas: HTMLCanvasElement) {
    

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Digit1' || e.code === 'Numpad1') this.tool = 'torch';
      if (e.code === 'Digit2' || e.code === 'Numpad2') this.tool = 'noise';
      if (e.code === 'KeyE') this.interactPressed = true;
      if (e.code === 'KeyF' || e.code === 'Space') this.usePressed = true;
      // Also use left click for tool use when locked
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    canvas.addEventListener('click', () => {
      if (!this.pointerLocked) {
        canvas.requestPointerLock();
      } else {
        this.usePressed = true;
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
  }

  consumeMouse(): { dx: number; dy: number } {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  consumeUse(): boolean {
    if (!this.usePressed) return false;
    this.usePressed = false;
    return true;
  }

  consumeInteract(): boolean {
    if (!this.interactPressed) return false;
    this.interactPressed = false;
    return true;
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  moveVector(): { x: number; z: number; sprint: boolean } {
    let x = 0;
    let z = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) z -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) z += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    const len = Math.hypot(x, z);
    if (len > 0) {
      x /= len;
      z /= len;
    }
    return { x, z, sprint: this.isDown('ShiftLeft') || this.isDown('ShiftRight') };
  }
}
