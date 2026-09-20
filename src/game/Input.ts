export type ToolId = 'torch' | 'noise';

export class Input {
  readonly keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  pointerLocked = false;
  tool: ToolId = 'torch';
  usePressed = false;
  interactPressed = false;

  /** Virtual move stick (-1..1). */
  touchMoveX = 0;
  touchMoveZ = 0;
  touchSprint = false;
  touchHide = false;
  /** True when coarse pointer / touch device — show mobile UI. */
  isTouch = false;

  private lookTouchId: number | null = null;
  private moveTouchId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.isTouch =
      window.matchMedia('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Digit1' || e.code === 'Numpad1') this.tool = 'torch';
      if (e.code === 'Digit2' || e.code === 'Numpad2') this.tool = 'noise';
      if (e.code === 'KeyE') this.interactPressed = true;
      if (e.code === 'KeyF' || e.code === 'Space') this.usePressed = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    canvas.addEventListener('click', () => {
      if (this.isTouch) {
        this.usePressed = true;
        return;
      }
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

    // Right-half look / left-half move via canvas touches (fallback if joystick not used)
    canvas.addEventListener(
      'touchstart',
      (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          const mid = window.innerWidth * 0.45;
          if (t.clientX >= mid && this.lookTouchId === null) {
            this.lookTouchId = t.identifier;
            this.lastLookX = t.clientX;
            this.lastLookY = t.clientY;
          }
        }
      },
      { passive: true },
    );

    canvas.addEventListener(
      'touchmove',
      (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.lookTouchId) {
            this.mouseDX += (t.clientX - this.lastLookX) * 1.6;
            this.mouseDY += (t.clientY - this.lastLookY) * 1.6;
            this.lastLookX = t.clientX;
            this.lastLookY = t.clientY;
          }
        }
      },
      { passive: true },
    );

    const endLook = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.lookTouchId) this.lookTouchId = null;
        if (t.identifier === this.moveTouchId) {
          this.moveTouchId = null;
          this.touchMoveX = 0;
          this.touchMoveZ = 0;
        }
      }
    };
    canvas.addEventListener('touchend', endLook, { passive: true });
    canvas.addEventListener('touchcancel', endLook, { passive: true });
  }

  /** Wire virtual joystick DOM (left thumb). */
  bindJoystick(zone: HTMLElement, knob: HTMLElement) {
    const maxR = 48;
    const setKnob = (dx: number, dy: number) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const onStart = (e: PointerEvent) => {
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      this.moveTouchId = e.pointerId;
      onMove(e);
    };
    const onMove = (e: PointerEvent) => {
      if (this.moveTouchId !== e.pointerId) return;
      const rect = zone.getBoundingClientRect();
      let dx = e.clientX - (rect.left + rect.width / 2);
      let dy = e.clientY - (rect.top + rect.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > maxR) {
        dx = (dx / len) * maxR;
        dy = (dy / len) * maxR;
      }
      setKnob(dx, dy);
      this.touchMoveX = dx / maxR;
      this.touchMoveZ = dy / maxR; // +Z is down on screen → forward is -Z in game via moveVector
    };
    const onEnd = (e: PointerEvent) => {
      if (this.moveTouchId !== e.pointerId) return;
      this.moveTouchId = null;
      this.touchMoveX = 0;
      this.touchMoveZ = 0;
      setKnob(0, 0);
    };
    zone.addEventListener('pointerdown', onStart);
    zone.addEventListener('pointermove', onMove);
    zone.addEventListener('pointerup', onEnd);
    zone.addEventListener('pointercancel', onEnd);
  }

  /** Right-side look pad (drag to orbit). */
  bindLookPad(pad: HTMLElement) {
    let id: number | null = null;
    let lx = 0;
    let ly = 0;
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pad.setPointerCapture(e.pointerId);
      id = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
    });
    pad.addEventListener('pointermove', (e) => {
      if (id !== e.pointerId) return;
      this.mouseDX += (e.clientX - lx) * 1.8;
      this.mouseDY += (e.clientY - ly) * 1.8;
      lx = e.clientX;
      ly = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (id === e.pointerId) id = null;
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
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

    // Touch joystick overlays keyboard
    if (Math.abs(this.touchMoveX) > 0.08 || Math.abs(this.touchMoveZ) > 0.08) {
      x = this.touchMoveX;
      z = this.touchMoveZ;
    }

    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    } else if (len > 0 && len < 1 && (this.touchMoveX || this.touchMoveZ)) {
      // keep analog magnitude
    } else if (len > 0) {
      x /= len;
      z /= len;
    }
    const sprint =
      this.isDown('ShiftLeft') || this.isDown('ShiftRight') || this.touchSprint;
    return { x, z, sprint };
  }

  isHiding(): boolean {
    return (
      this.isDown('ControlLeft') ||
      this.isDown('ControlRight') ||
      this.touchHide
    );
  }
}
