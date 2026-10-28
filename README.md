# MAGNE Quantum Kiosk

Interactive touchscreen kiosk for the Microsoft Quantum "Magne" event. Electron app with a Vite-built renderer, Three.js for 3D scenes, GSAP for animation, and Hammer.js for touch gestures.

## Requirements

- Node.js 20+
- Windows 10/11 for packaged builds

## Getting Started

```bash
npm install
npm run dev
```

`npm run dev` starts the Vite dev server and opens Electron in a 9:16 window with DevTools and hot reload.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server + Electron in windowed dev mode |
| `npm run build:renderer` | Build the renderer into `dist/` |
| `npm start` | Run Electron in kiosk mode against `dist/` (build the renderer first) |
| `npm run build:kiosk` | Build renderer and package a Windows x64 zip into `build/` |
| `npm run build:test` | Package a windowed test build (cursor visible, closable) and bump the patch version |
| `npm run build` | Build renderer and an unpacked Electron app |

## Modes

- **Dev** (`--dev`): windowed 9:16, loads `http://localhost:5173?dev=1`, DevTools open, cursor visible.
- **Test** (`isTest = true` in `main.js`, toggled automatically by `build:test`): windowed 9:16, loads `dist/`, cursor visible.
- **Kiosk** (default): fullscreen 2160×3840 on the largest external display, frameless, close disabled, cursor hidden. Right-click, text selection and drag are disabled; 60s idle returns to attract mode.

## Project Structure

```
.
├── main.js                 # Electron main process (display selection, window, hot reload)
├── preload.js
├── vite.config.js          # Vite root is src/, output to dist/
└── src/
    ├── index.html
    ├── styles/             # variables.css (palette), base, layout, per-tab styles
    ├── js/
    │   ├── main.js         # Renderer entry
    │   ├── app.js          # App orchestration
    │   ├── attract.js      # Attract mode
    │   ├── interactive.js  # Interactive mode and tab navigation
    │   ├── tabs/           # Connect / Compute / Control logic
    │   ├── templates/      # Tab markup
    │   ├── scenes/         # Three.js scenes and helpers
    │   └── utils/
    └── public/assets/      # Fonts, images, Lottie animations (served as-is)
```

## Hardware Target

- 55" 4K PCAP touchscreen, portrait (2160×3840), 40-point multitouch
- SFF PC, RTX 4070, 32GB RAM, Windows 11 Pro
