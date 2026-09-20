# Temple Heist

A browser-playable 3D jungle adventure. Explore a foggy jungle, scare off jaguars (no combat), survive temple traps, and steal the golden idol.

Built with **Vite + TypeScript + Three.js**.

## Run

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

## Controls

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

## Goal

1. Leave camp and follow the dirt path north.
2. Watch the fog-of-war minimap fill in as you explore.
3. Scare jaguars with a torch wave or noisemaker (or hide).
4. Enter the stone temple and survive traps / puzzles.
5. Grab the golden idol to win.

## Features

- Atmospheric jungle with fog, lighting, trees, and paths
- Hybrid third-person camera (pulls in near temple / jaguars)
- Two jaguar encounters (scare / hide / run — no combat)
- Temple traps: pressure spikes, dart corridor, timed light-beam pad puzzle, pit
- Fog-of-war exploration minimap HUD
- Hotbar for torch + noisemaker
- Checkpoints with funny death / respawn lines
- Title screen and win screen

## Known limitations

- Collision is simple AABB (no slopes beyond temple steps)
- No audio (visual feedback only)
- Jaguar AI is lightweight patrol / stalk / chase / flee
- World is intentionally compact for a complete playable loop

## License

MIT — go steal that idol.
