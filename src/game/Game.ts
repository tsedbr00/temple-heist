import * as THREE from 'three';
import { Input } from './Input';
import { Player } from './Player';
import { CameraController } from './CameraController';
import { World } from './World';
import { Jaguar } from './Jaguar';
import { TrapSystem } from './Traps';
import { FogOfWar } from './FogOfWar';
import { Treasure } from './Treasure';

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
  private clock = new THREE.Clock();
  private running = false;
  private animId = 0;
  private tipTimer = 0;
  private checkpointIndex = 0;

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
  };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.cameraCtrl = new CameraController(window.innerWidth / window.innerHeight);
    this.input = new Input(canvas);

    this.scene.background = new THREE.Color(0x87a878);
    this.scene.fog = new THREE.FogExp2(0x6a8a5a, 0.028);

    // Lighting
    const hemi = new THREE.HemisphereLight(0xb8d890, 0x3a2a18, 0.55);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe6b0, 1.15);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    this.scene.add(sun);
    const amb = new THREE.AmbientLight(0x406040, 0.25);
    this.scene.add(amb);

    this.world = new World();
    this.scene.add(this.world.group);

    this.player = new Player();
    this.scene.add(this.player.group);

    // Jaguars along the path
    const j1 = new Jaguar(-5, 12, 5);
    const j2 = new Jaguar(6, -6, 4.5);
    j1.onTip = (m) => this.showTip(m);
    j2.onTip = (m) => this.showTip(m);
    j1.onCatch = () => this.killPlayer('jaguar');
    j2.onCatch = () => this.killPlayer('jaguar');
    this.jaguars.push(j1, j2);
    for (const j of this.jaguars) this.scene.add(j.group);

    this.traps = new TrapSystem((e) => {
      if (e.type === 'damage') this.killPlayer('trap', e.message);
      else if (e.type === 'tip' || e.type === 'solved') {
        if (e.message) this.showTip(e.message);
      }
    });
    // Raise trap visuals onto temple floor (y already set in traps ~1.25)
    this.scene.add(this.traps.group);

    this.treasure = new Treasure();
    this.scene.add(this.treasure.group);

    const minimap = document.getElementById('minimap') as HTMLCanvasElement;
    this.fogMap = new FogOfWar(minimap);

    window.addEventListener('resize', () => this.onResize());

    document.getElementById('play-btn')!.addEventListener('click', () => this.start());
    document.getElementById('respawn-btn')!.addEventListener('click', () => this.respawn());
    document.getElementById('replay-btn')!.addEventListener('click', () => this.restart());

    this.el.slotTorch.addEventListener('click', () => {
      this.input.tool = 'torch';
    });
    this.el.slotNoise.addEventListener('click', () => {
      this.input.tool = 'noise';
    });

    // Initial render of title backdrop
    this.player.position.set(0, 0, 28);
    this.cameraCtrl.update(0.016, this.player, false);
    this.renderer.render(this.scene, this.cameraCtrl.camera);
  }

  start() {
    this.el.title.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
    this.el.win.classList.add('hidden');
    this.el.death.classList.add('hidden');
    this.running = true;
    this.clock.start();
    this.showTip('Follow the dirt path north. Fill the map. Steal the idol. Try not to become lunch.');
    this.loop();
  }

  private restart() {
    this.fogMap.reset();
    this.traps.reset();
    this.treasure.reset();
    // Reset jaguars
    for (const j of this.jaguars) this.scene.remove(j.group);
    this.jaguars = [];
    const j1 = new Jaguar(-5, 12, 5);
    const j2 = new Jaguar(6, -6, 4.5);
    j1.onTip = (m) => this.showTip(m);
    j2.onTip = (m) => this.showTip(m);
    j1.onCatch = () => this.killPlayer('jaguar');
    j2.onCatch = () => this.killPlayer('jaguar');
    this.jaguars.push(j1, j2);
    for (const j of this.jaguars) this.scene.add(j.group);

    this.player.reset(new THREE.Vector3(0, 0, 28), Math.PI);
    this.checkpointIndex = 0;
    this.el.win.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
    this.running = true;
    this.clock.start();
    this.showTip('Again? Bold. The jaguars missed you.');
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
    this.cameraCtrl.setShake(0.35);
    this.el.death.classList.remove('hidden');
    if (reason === 'jaguar') {
      this.el.deathTitle.textContent = 'Caught!';
      this.el.deathMsg.textContent =
        custom ?? 'A jaguar decided you were a crunchy snack. Checkpoint it is.';
    } else {
      this.el.deathTitle.textContent = 'Trap\'d!';
      this.el.deathMsg.textContent = custom ?? 'The temple keeps score. You\'re losing.';
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
    this.running = true;
    this.showTip('Back at a checkpoint. Dignity optional.');
  }

  private updateHotbar() {
    this.el.slotTorch.classList.toggle('selected', this.input.tool === 'torch');
    this.el.slotNoise.classList.toggle('selected', this.input.tool === 'noise');
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
    // Raise player onto temple platform
    if (inTemple || this.player.position.z < -17) {
      // Steps approximation
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

    // Sync group Y after temple height
    this.player.group.position.y = this.player.position.y;

    for (const j of this.jaguars) j.update(dt, this.player);
    this.traps.update(dt, this.player);

    // Interact with treasure prompt
    const tDist = this.player.position.distanceTo(this.treasure.position);
    if (!this.treasure.taken && tDist < 2.5) {
      this.el.prompt.classList.remove('hidden');
      this.el.prompt.innerHTML = 'Press <kbd>E</kbd> or walk into the idol!';
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

    // Checkpoint progress status
    if (this.player.position.z < 5 && this.checkpointIndex < 1) {
      this.checkpointIndex = 1;
      this.showTip('Checkpoint! Temple entrance is ahead.');
    }
    if (this.player.position.z < -18 && this.checkpointIndex < 2) {
      this.checkpointIndex = 2;
      this.showTip('Inside the temple. Watch the floor. And the walls. And the light.');
      // Darker fog inside
      (this.scene.fog as THREE.FogExp2).density = 0.045;
      this.scene.background = new THREE.Color(0x1a1810);
    }
    if (!inTemple && this.player.position.z > -16) {
      (this.scene.fog as THREE.FogExp2).density = 0.028;
      this.scene.background = new THREE.Color(0x87a878);
    }

    this.fogMap.update(this.player);
    this.cameraCtrl.update(dt, this.player, preferClose);
    this.updateHotbar();

    const tool = this.input.tool === 'torch' ? 'Torch' : 'Noisemaker';
    const hide = this.player.hiding ? ' · Hiding' : '';
    this.el.status.textContent = `${tool}${hide} · Click/F to use · Ctrl hide`;

    this.renderer.render(this.scene, this.cameraCtrl.camera);
  };

  private win() {
    this.running = false;
    this.el.hud.classList.add('hidden');
    this.el.win.classList.remove('hidden');
    document.exitPointerLock?.();
  }

  private onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.cameraCtrl.resize(window.innerWidth, window.innerHeight);
  }
}
