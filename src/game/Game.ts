import * as THREE from 'three';
import { Input } from './Input';
import { Player } from './Player';
import { CameraController } from './CameraController';
import { World } from './World';
import { Jaguar } from './Jaguar';
import { TrapSystem } from './Traps';
import { FogOfWar } from './FogOfWar';
import { Treasure } from './Treasure';
import { GameAudio } from './Audio';

const ONBOARDING = [
  'Follow the dirt path north. Fill the map. Steal the idol.',
  'Tip: Click/tap the canvas to look around. WASD or left stick to move.',
  'Tip: Press 1 for torch, 2 for noisemaker — scare jaguars, don\'t fight them.',
  'Tip: Hold Ctrl / Hide to crouch. Jaguars struggle to spot you.',
];

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cameraCtrl: CameraController;
  private input: Input;
  private player: Player;
  private world: World;
  private jaguars: Jaguar[] = [];
  private traps: TrapSystem;
  private fogMap: FogOfWar;
  private treasure: Treasure;
  private audio = new GameAudio();
  private clock = new THREE.Clock();
  private running = false;
  private animId = 0;
  private tipTimer = 0;
  private checkpointIndex = 0;
  private onboardIdx = 0;
  private onboardTimer = 0;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private jaguarBanner: HTMLElement | null = null;

  private el = {
    title: document.getElementById('title-screen')!,
    hud: document.getElementById('hud')!,
    death: document.getElementById('death-screen')!,
    win: document.getElementById('win-screen')!,
    tip: document.getElementById('tip')!,
    prompt: document.getElementById('interact-prompt')!,
    status: document.getElementById('status')!,
    deathTitle: document.getElementById('death-title')!,
    deathMsg: document.getElementById('death-msg')!,
    slotTorch: document.getElementById('slot-torch')!,
    slotNoise: document.getElementById('slot-noise')!,
    mobile: document.getElementById('mobile-controls')!,
    alertBanner: document.getElementById('jaguar-alert')!,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.cameraCtrl = new CameraController(window.innerWidth / window.innerHeight);
    this.input = new Input(canvas);

    // Richer jungle atmosphere
    this.scene.background = new THREE.Color(0x6a8560);
    this.scene.fog = new THREE.FogExp2(0x5a7450, 0.032);

    this.hemi = new THREE.HemisphereLight(0xc8e0a0, 0x3a2810, 0.48);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffe2b0, 1.25);
    this.sun.position.set(28, 48, 18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 5;
    this.sun.shadow.camera.far = 120;
    this.sun.shadow.camera.left = -40;
    this.sun.shadow.camera.right = 40;
    this.sun.shadow.camera.top = 40;
    this.sun.shadow.camera.bottom = -40;
    this.sun.shadow.bias = -0.0003;
    this.scene.add(this.sun);

    this.fill = new THREE.DirectionalLight(0x88aa99, 0.28);
    this.fill.position.set(-20, 20, -10);
    this.scene.add(this.fill);

    const amb = new THREE.AmbientLight(0x354830, 0.22);
    this.scene.add(amb);

    this.world = new World();
    this.scene.add(this.world.group);

    this.player = new Player();
    this.player.onToolUse = (tool) => {
      if (tool === 'torch') this.audio.torchWave();
      else this.audio.noisemaker();
    };
    this.scene.add(this.player.group);

    this.spawnJaguars();

    this.traps = new TrapSystem((e) => {
      if (e.type === 'damage') this.killPlayer('trap', e.message);
      else if (e.type === 'tip' || e.type === 'solved') {
        if (e.message) this.showTip(e.message);
        if (e.type === 'solved') this.audio.puzzleSolved();
        else this.audio.tip();
      } else if (e.type === 'sfx') {
        if (e.sfx === 'pad') this.audio.padStep();
        else if (e.sfx === 'trap') this.audio.trapWarn();
      }
    });
    this.scene.add(this.traps.group);

    this.treasure = new Treasure();
    this.scene.add(this.treasure.group);

    const minimap = document.getElementById('minimap') as HTMLCanvasElement;
    this.fogMap = new FogOfWar(minimap);

    this.jaguarBanner = this.el.alertBanner;

    this.setupMobileUI();

    window.addEventListener('resize', () => this.onResize());

    document.getElementById('play-btn')!.addEventListener('click', () => {
      this.audio.unlock();
      this.start();
    });
    document.getElementById('respawn-btn')!.addEventListener('click', () => this.respawn());
    document.getElementById('replay-btn')!.addEventListener('click', () => this.restart());

    this.el.slotTorch.addEventListener('click', () => {
      this.input.tool = 'torch';
    });
    this.el.slotNoise.addEventListener('click', () => {
      this.input.tool = 'noise';
    });

    this.player.position.set(0, 0, 28);
    this.cameraCtrl.update(0.016, this.player, false);
    this.renderer.render(this.scene, this.cameraCtrl.camera);
  }

  private spawnJaguars() {
    for (const j of this.jaguars) this.scene.remove(j.group);
    this.jaguars = [];
    const j1 = new Jaguar(-5, 12, 5);
    const j2 = new Jaguar(6, -6, 4.5);
    for (const j of [j1, j2]) {
      j.onTip = (m) => this.showTip(m);
      j.onCatch = () => this.killPlayer('jaguar');
      j.onStateChange = (s) => {
        if (s === 'stalk') {
          this.audio.jaguarStalk();
          this.showJaguarAlert('STALKING', 'warn');
        } else if (s === 'chase') {
          this.audio.jaguarChase();
          this.showJaguarAlert('CHASE!', 'danger');
        } else if (s === 'flee' || s === 'gone') {
          this.audio.jaguarFlee();
          this.hideJaguarAlert();
        }
      };
      this.jaguars.push(j);
      this.scene.add(j.group);
    }
  }

  private showJaguarAlert(text: string, kind: 'warn' | 'danger') {
    if (!this.jaguarBanner) return;
    this.jaguarBanner.textContent = text;
    this.jaguarBanner.classList.remove('hidden', 'warn', 'danger');
    this.jaguarBanner.classList.add(kind);
  }

  private hideJaguarAlert() {
    this.jaguarBanner?.classList.add('hidden');
  }

  private setupMobileUI() {
    if (!this.input.isTouch) {
      this.el.mobile.classList.add('hidden');
      document.body.classList.remove('touch-mode');
      return;
    }
    document.body.classList.add('touch-mode');
    this.el.mobile.classList.remove('hidden');

    const joyZone = document.getElementById('joy-zone')!;
    const joyKnob = document.getElementById('joy-knob')!;
    const lookPad = document.getElementById('look-pad')!;
    this.input.bindJoystick(joyZone, joyKnob);
    this.input.bindLookPad(lookPad);

    const hold = (id: string, setter: (v: boolean) => void) => {
      const el = document.getElementById(id)!;
      const on = (e: Event) => {
        e.preventDefault();
        setter(true);
        el.classList.add('pressed');
      };
      const off = (e: Event) => {
        e.preventDefault();
        setter(false);
        el.classList.remove('pressed');
      };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointerleave', off);
      el.addEventListener('pointercancel', off);
    };

    hold('btn-sprint', (v) => {
      this.input.touchSprint = v;
    });
    hold('btn-hide', (v) => {
      this.input.touchHide = v;
    });

    document.getElementById('btn-use')!.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.usePressed = true;
    });
    document.getElementById('btn-interact')!.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.interactPressed = true;
    });
    document.getElementById('btn-torch')!.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.tool = 'torch';
    });
    document.getElementById('btn-noise')!.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.tool = 'noise';
    });
  }

  start() {
    this.el.title.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
    this.el.win.classList.add('hidden');
    this.el.death.classList.add('hidden');
    this.running = true;
    this.clock.start();
    this.onboardIdx = 0;
    this.onboardTimer = 0.3;
    this.showTip(ONBOARDING[0]);
    this.loop();
  }

  private restart() {
    this.fogMap.reset();
    this.traps.reset();
    this.treasure.reset();
    this.spawnJaguars();
    this.hideJaguarAlert();
    this.player.reset(new THREE.Vector3(0, 0, 28), Math.PI);
    this.checkpointIndex = 0;
    this.el.win.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
    this.scene.fog = new THREE.FogExp2(0x5a7450, 0.032);
    this.scene.background = new THREE.Color(0x6a8560);
    this.running = true;
    this.clock.start();
    this.showTip('Again? Bold. The jaguars missed you.');
    this.audio.unlock();
    cancelAnimationFrame(this.animId);
    this.loop();
  }

  private showTip(msg: string) {
    this.el.tip.textContent = msg;
    this.el.tip.classList.remove('hidden');
    this.tipTimer = 5.5;
  }

  private killPlayer(reason: 'jaguar' | 'trap', custom?: string) {
    if (!this.player.alive) return;
    this.player.alive = false;
    this.cameraCtrl.setShake(0.4);
    this.audio.death();
    this.hideJaguarAlert();
    this.el.death.classList.remove('hidden');
    if (reason === 'jaguar') {
      this.el.deathTitle.textContent = 'Cat Food.';
      this.el.deathMsg.textContent =
        custom ??
        'A jaguar decided you were a crunchy protein bar. Checkpoint it is — dignity not included.';
    } else {
      this.el.deathTitle.textContent = 'Temple 1, You 0';
      this.el.deathMsg.textContent =
        custom ?? 'The temple keeps score. Spoiler: you\'re losing. Try again from the checkpoint.';
    }
  }

  private respawn() {
    this.el.death.classList.add('hidden');
    const cp = this.world.nearestCheckpoint(this.player.position);
    this.player.reset(cp);
    this.traps.reset();
    for (const j of this.jaguars) {
      if (j.state === 'gone') continue;
      if (j.position.distanceTo(cp) < 12) j.calm(cp, 14);
    }
    this.hideJaguarAlert();
    this.running = true;
    this.showTip('Back at a checkpoint. Dignity optional. Torch recommended.');
  }

  private updateHotbar() {
    this.el.slotTorch.classList.toggle('selected', this.input.tool === 'torch');
    this.el.slotNoise.classList.toggle('selected', this.input.tool === 'noise');
    document.getElementById('btn-torch')?.classList.toggle('selected', this.input.tool === 'torch');
    document.getElementById('btn-noise')?.classList.toggle('selected', this.input.tool === 'noise');
    if (this.player.torchWaveT > 0.7) this.el.slotTorch.classList.add('active-use');
    else this.el.slotTorch.classList.remove('active-use');
    if (this.player.noiseT > 0.9) this.el.slotNoise.classList.add('active-use');
    else this.el.slotNoise.classList.remove('active-use');
  }

  private loop = () => {
    this.animId = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.tipTimer > 0) {
      this.tipTimer -= dt;
      if (this.tipTimer <= 0) this.el.tip.classList.add('hidden');
    }

    // Sequential onboarding tips early in the run
    if (this.running && this.player.alive && this.onboardIdx < ONBOARDING.length) {
      this.onboardTimer -= dt;
      if (this.onboardTimer <= 0 && this.tipTimer <= 0) {
        this.onboardIdx++;
        if (this.onboardIdx < ONBOARDING.length) {
          this.showTip(ONBOARDING[this.onboardIdx]);
          this.onboardTimer = 7;
        }
      }
    }

    if (!this.running) {
      this.renderer.render(this.scene, this.cameraCtrl.camera);
      return;
    }

    if (!this.player.alive) {
      this.cameraCtrl.update(dt, this.player, true);
      this.renderer.render(this.scene, this.cameraCtrl.camera);
      return;
    }

    const inTemple = this.world.isInTemple(this.player.position);
    if (inTemple || this.player.position.z < -17) {
      if (this.player.position.z < -17 && this.player.position.z > -20) {
        const t = (-17 - this.player.position.z) / 3;
        this.player.position.y = t * 1.25;
      } else if (this.player.position.z <= -20) {
        this.player.position.y = 1.25;
      } else {
        this.player.position.y = 0;
      }
    } else {
      this.player.position.y = 0;
    }

    const jaguarNear = this.jaguars.some(
      (j) => j.state !== 'gone' && j.position.distanceTo(this.player.position) < 10,
    );
    const preferClose = inTemple || jaguarNear || this.player.isScaring();

    this.player.update(dt, this.input, (p, r) => this.world.collide(p, r), inTemple);
    this.player.group.position.y = this.player.position.y;

    for (const j of this.jaguars) j.update(dt, this.player);
    this.traps.update(dt, this.player);

    const tDist = this.player.position.distanceTo(this.treasure.position);
    if (!this.treasure.taken && tDist < 2.5) {
      this.el.prompt.classList.remove('hidden');
      this.el.prompt.innerHTML = this.input.isTouch
        ? 'Tap <b>Grab</b> or walk into the idol!'
        : 'Press <kbd>E</kbd> or walk into the idol!';
      if (this.input.consumeInteract() || tDist < 1.6) {
        if (this.treasure.update(0, this.player) || tDist < 1.6) {
          this.treasure.taken = true;
          this.treasure.group.visible = false;
          this.win();
        }
      }
    } else {
      this.el.prompt.classList.add('hidden');
      this.input.consumeInteract();
      if (!this.treasure.taken) this.treasure.update(dt, this.player);
    }

    if (this.player.position.z < 5 && this.checkpointIndex < 1) {
      this.checkpointIndex = 1;
      this.showTip('Checkpoint! Temple entrance is ahead. Watch for glowing eyes…');
    }
    if (this.player.position.z < -18 && this.checkpointIndex < 2) {
      this.checkpointIndex = 2;
      this.showTip('Inside the temple. Red = danger. Gold pads = puzzle. Good luck.');
      (this.scene.fog as THREE.FogExp2).color.setHex(0x1a1810);
      (this.scene.fog as THREE.FogExp2).density = 0.048;
      this.scene.background = new THREE.Color(0x12100c);
      this.renderer.toneMappingExposure = 0.95;
    }
    if (!inTemple && this.player.position.z > -16) {
      (this.scene.fog as THREE.FogExp2).color.setHex(0x5a7450);
      (this.scene.fog as THREE.FogExp2).density = 0.032;
      this.scene.background = new THREE.Color(0x6a8560);
      this.renderer.toneMappingExposure = 1.12;
    }

    // Clear chase banner if no jaguar chasing
    if (!this.jaguars.some((j) => j.state === 'chase' || j.state === 'stalk')) {
      this.hideJaguarAlert();
    }

    this.fogMap.update(this.player, this.jaguars);
    this.cameraCtrl.update(dt, this.player, preferClose);
    this.updateHotbar();

    const tool = this.input.tool === 'torch' ? 'Torch' : 'Noisemaker';
    const hide = this.player.hiding ? ' · Hiding' : '';
    this.el.status.textContent = this.input.isTouch
      ? `${tool}${hide}`
      : `${tool}${hide} · Click/F use · Ctrl hide`;

    this.renderer.render(this.scene, this.cameraCtrl.camera);
  };

  private win() {
    this.running = false;
    this.audio.win();
    this.hideJaguarAlert();
    this.el.hud.classList.add('hidden');
    this.el.win.classList.remove('hidden');
    document.exitPointerLock?.();
  }

  private onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.cameraCtrl.resize(window.innerWidth, window.innerHeight);
  }
}
