'use strict';

/** @typedef {{ catId: string, workspaceRoots: string[], startedAt: number }} SessionRec */

/** @type {Map<string, SessionRec>} */
const bySession = new Map();

/**
 * @param {object} payload
 * @param {() => import('electron').BrowserWindow | null} getMainWindow
 */
function handleIdeSessionStart(payload, { getMainWindow, log = console } = {}) {
  const sessionId = payload && (payload.session_id != null ? String(payload.session_id) : null);
  if (!sessionId) {
    return;
  }
  if (bySession.has(sessionId)) {
    return;
  }
  const catId = `ide:${sessionId}`;
  const wr = Array.isArray(payload.workspace_roots) ? payload.workspace_roots.map((x) => String(x)) : [];
  bySession.set(sessionId, { catId, workspaceRoots: wr, startedAt: Date.now() });
  const win = getMainWindow && getMainWindow();
  if (win && !win.isDestroyed()) {
    try {
      win.webContents.send('spawn-cat', {
        catId,
        kind: 'ide',
        sessionId,
        folder: wr[0] || '',
        workspace: wr[0] || '',
        prompt: '',
      });
    } catch (e) {
      log.warn('[cursorcats] spawn-cat (ide) failed', e);
    }
  }
}

/**
 * @param {object} payload
 * @param {() => import('electron').BrowserWindow | null} getMainWindow
 */
function handleIdeSessionEnd(payload, { getMainWindow, log = console } = {}) {
  const sessionId = payload && (payload.session_id != null ? String(payload.session_id) : null);
  if (!sessionId) {
    return;
  }
  const rec = bySession.get(sessionId);
  if (!rec) {
    return;
  }
  bySession.delete(sessionId);
  const win = getMainWindow && getMainWindow();
  if (win && !win.isDestroyed()) {
    try {
      win.webContents.send('remove-cat', { catId: rec.catId });
    } catch (e) {
      log.warn('[cursorcats] remove-cat (ide) failed', e);
    }
  }
}

/**
 * @param {string} catId
 * @returns {string | null}
 */
function getWorkspaceForIdeCatId(catId) {
  if (!catId || !String(catId).startsWith('ide:')) {
    return null;
  }
  const sessionId = String(catId).slice(4);
  const rec = bySession.get(sessionId);
  if (!rec || !rec.workspaceRoots || !rec.workspaceRoots.length) {
    return null;
  }
  return rec.workspaceRoots[0];
}

/**
 * @param {string} catId
 * @returns {string | null}
 */
function getSessionIdForCatId(catId) {
  if (!catId || !String(catId).startsWith('ide:')) {
    return null;
  }
  return String(catId).slice(4);
}

/**
 * Remove an IDE cat from tracking and overlay (e.g. user dismissed from UI).
 * @param {string} catId
 * @param {() => import('electron').BrowserWindow | null} getMainWindow
 */
function removeIdeCatIfPresent(catId, { getMainWindow, log = console } = {}) {
  const sessionId = getSessionIdForCatId(catId);
  if (!sessionId) {
    return false;
  }
  if (!bySession.has(sessionId)) {
    return false;
  }
  bySession.delete(sessionId);
  const win = getMainWindow && getMainWindow();
  if (win && !win.isDestroyed()) {
    try {
      win.webContents.send('remove-cat', { catId: String(catId) });
    } catch (e) {
      log.warn('[cursorcats] remove-cat (ide manual) failed', e);
    }
  }
  return true;
}

module.exports = {
  handleIdeSessionStart,
  handleIdeSessionEnd,
  getWorkspaceForIdeCatId,
  getSessionIdForCatId,
  removeIdeCatIfPresent,
};
