# CursorCats

A frameless, transparent **Electron** desktop pet: a cat sprite roams the primary display. The window is **click-through** and **always on top** so only the cat is visible over your work.

## Setup

```bash
cd cursorcats
npm install
npm start
```

## Add your cat art

1. Place a horizontal strip / grid **PNG** under `assets/cats/` (e.g. `assets/cats/my-cat.png`).
2. Copy and edit `assets/cats/sprite.json` so `image`, `frameWidth`, `frameHeight`, `scale`, and `animations` match your sheet. See [assets/cats/README.md](assets/cats/README.md) for the full format.
3. Restart the app.

Until `sprite.json` points to a real image that loads, the window stays empty (fully transparent).

## Controls

- **Menu bar (macOS) / tray (all platforms)**: right-click the tray icon → **Quit** (if the tray image is a tiny placeholder, the menu still works).
- **Keyboard**: **Cmd+Q** (macOS) or **Ctrl+Q** (Windows/Linux) to quit.

On macOS the Dock icon is hidden; use the tray or the shortcut to exit.

## Development

- `main.js` — transparent full work-area window, click-through, IPC for assets, tray, global quit shortcut, `app.dock.hide()` on macOS.
- `preload.js` — exposes `readTextFile` / `getAssetFileUrl` to the renderer.
- `renderer/` — canvas sprite animation and roam logic.

## License

ISC (same as `package.json` — adjust as you like).
