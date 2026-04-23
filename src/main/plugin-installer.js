'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

const PLUGIN_NAME = 'cursorcats';

/**
 * @param {string} src
 * @param {string} dest
 */
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    const st = fs.statSync(s);
    if (st.isDirectory()) {
      copyDirSync(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

/**
 * @param {string} p
 * @returns {string}
 */
function fileSignature(p) {
  try {
    const st = fs.statSync(p);
    return `${st.mtimeMs}`;
  } catch {
    return '0';
  }
}

/**
 * Read symlink target (to compare with desired source), or null.
 * @param {string} p
 * @returns {string | null}
 */
function readLinkTarget(p) {
  try {
    return fs.readlinkSync(p);
  } catch {
    return null;
  }
}

/**
 * @param {{ log?: { info?: Function, warn?: Function } }} [opts]
 * @returns {{ installed: boolean, changed: boolean, destPath: string, mode: 'symlink' | 'copy' | 'none' }}
 */
function ensureCursorPluginInstalled(opts = {}) {
  const { log = console } = opts;
  const appPath = app.getAppPath();
  const sourceRoot = path.join(appPath, 'assets', 'cursor-plugin');
  const destRoot = path.join(os.homedir(), '.cursor', 'plugins', 'local', PLUGIN_NAME);
  // Sidecar (not inside dest): in dev, dest is a symlink to the repo; avoid writing into the app tree.
  const localPluginsDir = path.join(os.homedir(), '.cursor', 'plugins', 'local');
  const installRecordPath = path.join(localPluginsDir, `${PLUGIN_NAME}.install.json`);
  const isDev = !!process.env.ELECTRON_RENDERER_URL;
  if (!fs.existsSync(localPluginsDir)) {
    try {
      fs.mkdirSync(localPluginsDir, { recursive: true });
    } catch (e) {
      log.warn && log.warn('[cursorcats] could not create', localPluginsDir, e);
    }
  }
  const manifestPath = path.join(sourceRoot, '.cursor-plugin', 'plugin.json');
  const sig = `${app.getVersion()}:${fileSignature(manifestPath)}`;

  let mode = 'none';
  let changed = false;

  if (!fs.existsSync(sourceRoot)) {
    log.warn && log.warn('[cursorcats] Plugin source not found at', sourceRoot);
    return { installed: false, changed: false, destPath: destRoot, mode };
  }

  let existing = null;
  try {
    if (fs.existsSync(installRecordPath)) {
      existing = JSON.parse(fs.readFileSync(installRecordPath, 'utf8'));
    }
  } catch {
    existing = null;
  }

  if (isDev) {
    const target = readLinkTarget(destRoot);
    const wantTarget = path.resolve(sourceRoot);
    if (fs.existsSync(destRoot)) {
      if (target) {
        const cur = path.resolve(path.dirname(destRoot), target);
        if (cur === wantTarget) {
          try {
            fs.writeFileSync(
              installRecordPath,
              JSON.stringify(
                { version: app.getVersion(), sourceSignature: sig, mode: 'symlink', updated: new Date().toISOString() },
                null,
                2
              ),
              'utf8'
            );
          } catch {
            // ignore
          }
          return { installed: true, changed: false, destPath: destRoot, mode: 'symlink' };
        }
      }
    }
    try {
      if (fs.existsSync(destRoot)) {
        const st = fs.lstatSync(destRoot);
        if (st.isSymbolicLink() || st.isFile()) {
          fs.rmSync(destRoot, { recursive: true, force: true });
        } else {
          fs.rmSync(destRoot, { recursive: true, force: true });
        }
      }
      fs.symlinkSync(wantTarget, destRoot, 'dir');
      mode = 'symlink';
      changed = !existing || existing.sourceSignature !== sig || existing.mode !== 'symlink';
    } catch (e) {
      log.warn && log.warn('[cursorcats] Symlink install failed, copying plugin:', (e && e.message) || e);
      if (fs.existsSync(destRoot)) {
        fs.rmSync(destRoot, { recursive: true, force: true });
      }
      copyDirSync(sourceRoot, destRoot);
      mode = 'copy';
      changed = true;
    }
  } else {
    const upToDate = existing && existing.sourceSignature === sig && existing.mode === 'copy' && fs.existsSync(destRoot);
    if (upToDate) {
      return { installed: true, changed: false, destPath: destRoot, mode: 'copy' };
    }
    if (fs.existsSync(destRoot)) {
      fs.rmSync(destRoot, { recursive: true, force: true });
    }
    copyDirSync(sourceRoot, destRoot);
    mode = 'copy';
    changed = true;
  }

  try {
    fs.writeFileSync(
      installRecordPath,
      JSON.stringify(
        { version: app.getVersion(), sourceSignature: sig, mode, updated: new Date().toISOString() },
        null,
        2
      ),
      'utf8'
    );
  } catch (e) {
    log.warn && log.warn('[cursorcats] Could not write install record:', (e && e.message) || e);
  }

  if (changed) {
    // eslint-disable-next-line no-console
    log.info &&
      log.info(
        '[cursorcats] Cursor plugin installed/updated at ~/.cursor/plugins/local/cursorcats. Reload the Cursor window (Command Palette: Developer: Reload Window) to load hooks.'
      );
  }

  return { installed: true, changed, destPath: destRoot, mode };
}

module.exports = { ensureCursorPluginInstalled, PLUGIN_NAME };
