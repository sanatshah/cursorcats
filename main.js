const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

function assertPathInsideApp(relPath) {
  const root = path.resolve(app.getAppPath());
  const full = path.resolve(path.join(root, relPath));
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error('Path escapes app root');
  }
  return full;
}

let mainWindow;
let tray;

if (process.platform === 'darwin') {
  app.dock.hide();
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const { x, y } = display.workArea;

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function createTray() {
  const p = path.join(__dirname, 'assets', 'tray.png');
  let image;
  if (fs.existsSync(p)) {
    image = nativeImage.createFromPath(p);
  } else {
    // 1×1 transparent PNG so Tray always has a valid image
    const onePx =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    image = nativeImage.createFromBuffer(Buffer.from(onePx, 'base64'));
  }
  tray = new Tray(image);
  tray.setToolTip('CursorCats');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Quit',
        click: () => {
          app.quit();
        },
      },
    ])
  );
}

ipcMain.handle('get-app-path', () => app.getAppPath());

ipcMain.handle('read-text-file', (_event, relPath) => {
  const full = assertPathInsideApp(relPath);
  return fs.readFileSync(full, 'utf8');
});

ipcMain.handle('get-asset-file-url', (_event, relPath) => {
  const full = assertPathInsideApp(relPath);
  return pathToFileURL(full).href;
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  const quit = () => {
    app.quit();
  };
  if (process.platform === 'darwin') {
    globalShortcut.register('Command+Q', quit);
  } else {
    globalShortcut.register('Control+Q', quit);
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Keep app running (tray) on non-mac, or we could quit; plan expects tray+shortcut
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
