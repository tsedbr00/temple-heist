# Temple Heist

A browser-playable 3D jungle adventure. Explore a foggy jungle, scare off jaguars (no combat), survive temple traps, and steal the golden idol.

Built with **Vite + TypeScript + Three.js**.

## Play online

**Live:** [https://tsedbr00.github.io/temple-heist/](https://tsedbr00.github.io/temple-heist/)

Works on desktop and mobile browsers (touch controls appear automatically on phones/tablets).

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

Deploy to GitHub Pages (publishes `dist` to the `gh-pages` branch):

```bash
npm run deploy
```

Pushing to `main` also triggers the GitHub Actions Pages workflow (`.github/workflows/deploy-pages.yml`). Enable **Settings → Pages → Source: GitHub Actions** (or the `gh-pages` branch) once.

## Controls

### Desktop

| Input | Action |
|-------|--------|
| **WASD** / Arrows | Move |
| **Mouse** | Look / orbit (click canvas to lock pointer) |
| **Shift** | Sprint |
| **Ctrl** | Hide / crouch (harder for jaguars to spot) |
| **E** | Interact (treasure) |
| **1** | Select torch |
| **2** | Select noisemaker |
| **Click** / **F** / **Space** | Use selected tool |

### Mobile / touch

| Control | Action |
|---------|--------|
| **Left stick** | Move |
| **Right look pad** | Drag to look / orbit |
| **Sprint** / **Hide** | Hold buttons |
| **🔦 / 🔔** | Select torch or noisemaker |
| **Use** | Wave torch / fire noisemaker |
| **Grab** | Interact with the idol |

Pointer lock is not required on mobile.

## Goal

1. Leave camp and follow the dirt path north.
2. Watch the fog-of-war minimap fill in as you explore.
3. Scare jaguars with a torch wave or noisemaker (or hide) — watch for glowing eyes and alert rings.
4. Enter the stone temple: **red = danger**, gold/glowing pads = puzzle solution.
5. Grab the golden idol to win.

## Features

- Atmospheric jungle fog, lighting, foliage, and weathered temple materials
- Hybrid third-person camera (pulls in near temple / jaguars)
- Jaguar stalk/chase telegraphs + scare-off feedback (no combat)
- Temple traps: pressure spikes, dart corridor, timed light-beam pad puzzle, pit
- Fog-of-war exploration minimap (path / temple / jaguar blips)
- Desktop + mobile touch UI
- Light Web Audio SFX (torch, noise, alerts, win/lose)
- Checkpoints with cheeky death / respawn lines

## Known limitations

- Collision is simple AABB (no slopes beyond temple steps)
- Jaguar AI is lightweight patrol / stalk / chase / flee
- World is intentionally compact for a complete playable loop
- Best on a mid-range phone or desktop; shadows may cost FPS on low-end devices

## License

MIT — go steal that idol.
