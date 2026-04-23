<p align="center">
  <img src="assets/repo-banner.png" alt="Cursor Cats" width="100%" />
</p>

# Cursor Cats

A frameless, transparent **Electron** desktop pet: a cat sprite roams the primary display. The window is **click-through** and **always on top** so only the cat is visible over your work.

## Cursor Cats CLI

The published command is **`cursorcats`** (see `bin` in `package.json`). It starts Electron with the built main process from `out/main/index.js`. The first install runs **`prepare`**, which runs `electron-vite build`.

### Install

**Run once without installing** (downloads the repo, runs `prepare`, then launches):

```bash
npx github:fieldsphere/cursor-cats
```

**Install globally** so `cursorcats` is on your `PATH`:

```bash
npm install -g github:fieldsphere/cursor-cats
cursorcats
```

**From a local clone** (after `npm install`, which also builds via `prepare`):

```bash
npm install
npx cursorcats
# or
node bin/cursorcats.js
```

If you see *Missing built main process*, run `npm run build` in the package root (or reinstall so `prepare` can run).

### Usage

- **Launch**: `cursorcats` (or `npx github:fieldsphere/cursor-cats`).
- **Cursor API key** (for **New Cursor Cat** agent runs): set before starting:

```bash
export CURSOR_API_KEY=your_key
cursorcats
```

Without `CURSOR_API_KEY`, the app still runs; the CLI prints a warning and **New Cursor Cat** agents will not run.

Extra arguments are passed through to Electron (see `bin/cursorcats.js`).

### Quit

- **Menu bar (macOS) / tray**: right-click the tray icon → **Quit** (if the tray image looks like a tiny placeholder, the menu still works).
- **Keyboard**: **Cmd+Q** (macOS) or **Ctrl+Q** (Windows/Linux).

On macOS the Dock icon is hidden; use the tray or the shortcut to exit.

## Setup (clone for development)

```bash
cd cursorcats
npm install
npm run dev
```

For a production build and local run:

```bash
npm run build
npm start
```

Or launch the built app without Vite preview (from the repo root):

```bash
npm run build
node bin/cursorcats.js
```

## Cursor agents

Each **New Cursor Cat** starts a local Cursor SDK agent (`@cursor/february`) in the folder you pick. Set **`CURSOR_API_KEY`** in the environment before launching the app; without it, new cats disappear immediately (no agent run).

```bash
export CURSOR_API_KEY=your_key
npm run dev
```

When the agent run finishes, that cat is removed from the overlay.

### Cursor IDE / Agent window cats (hooks plugin)

Cursor Cats can mirror **interactive** Agent Chat sessions in the Cursor IDE (not background/cloud agents): when you start a composer session, a cat appears; when the session ends, it disappears. **`CURSOR_API_KEY` is not required** for this—only for **New Cursor Cat** SDK runs above.

On startup, the app installs a **local Cursor plugin** from bundled assets into `~/.cursor/plugins/local/cursorcats` (in dev it symlinks the repo’s `assets/cursor-plugin`; in production it copies). Hook scripts notify the running Cursor Cats app over `127.0.0.1` using `~/.cursorcats/ipc.json` (port + auth token).

**First time (or after plugin updates):** reload Cursor so hooks load — Command Palette → **Developer: Reload Window** (or restart Cursor). See also [Test plugins locally](https://cursor.com/docs/plugins#test-plugins-locally).

Clicking one of these cats **activates the Cursor app** (brings it to the front). It does not open Cursor Cats’ conversation window.

## Add your cat art

1. Place a horizontal strip / grid **PNG** under `assets/cats/` (e.g. `assets/cats/my-cat.png`).
2. Copy and edit `assets/cats/sprite.json` so `image`, `frameWidth`, `frameHeight`, `scale`, and `animations` match your sheet. See [assets/cats/README.md](assets/cats/README.md) for the full format.
3. Optional: list extra sprite manifests in `assets/cats/cats.json` (`manifests` array). The app picks a random manifest when you create a new cat.
4. Save files — in dev (`npm run dev`) the renderer hot-reloads; restart the app if you only changed assets and HMR did not pick them up.

Until `sprite.json` points to a real image that loads, the window stays empty (fully transparent).

## Development

- **electron-vite**: `npm run dev` — Vite HMR for the renderer; main/preload changes restart Electron.
- `src/main/index.js` — transparent full work-area window, click-through, IPC for assets, tray, global quit shortcut, `app.dock.hide()` on macOS; local Cursor plugin install, hook HTTP server, IDE session cats.
- `src/main/plugin-installer.js`, `src/main/hook-server.js`, `src/main/ide-sessions.js` — plugin sync to `~/.cursor/plugins/local/cursorcats`, hook bridge, per-session IDE cat state.
- `assets/cursor-plugin/` — plugin manifest, `hooks.json`, and `sessionStart` / `sessionEnd` hook scripts.
- `src/preload/index.js` — exposes `readTextFile` / `getAssetFileUrl` to the renderer.
- `src/renderer/` — canvas sprite animation and roam logic (`index.html`, `src/renderer.js`, `src/styles.css`).
- Built output lives in `out/` (`npm run build`).

## License

ISC (same as `package.json` — adjust as you like).
