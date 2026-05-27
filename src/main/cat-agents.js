'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;

/** @typedef {{ id: string, name: string, purpose: string, intervalMs: number, runtime: 'local', model?: string, workdir?: string, enabled: boolean, version: number, createdAt: number, updatedAt: number, lastRunAt?: number, lastRunStatus?: string, lastCatId?: string }} CatAgentDoc */

function agentsRootDir() {
  return path.join(os.homedir(), '.cursorcats', 'agents');
}

function agentDir(agentId) {
  return path.join(agentsRootDir(), String(agentId));
}

function agentDocPath(agentId) {
  return path.join(agentDir(agentId), 'agent.json');
}

function heartbeatsDir(agentId) {
  return path.join(agentDir(agentId), 'heartbeats');
}

function nowMs() {
  return Date.now();
}

function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  const fd = fs.openSync(tmp, 'r');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, filePath);
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} raw
 * @returns {CatAgentDoc | null}
 */
function normalizeAgentDoc(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const purpose = typeof raw.purpose === 'string' ? raw.purpose.trim() : '';
  const intervalMs =
    typeof raw.intervalMs === 'number' && raw.intervalMs >= MIN_INTERVAL_MS
      ? Math.floor(raw.intervalMs)
      : DEFAULT_INTERVAL_MS;
  const model = typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : undefined;
  const workdir = typeof raw.workdir === 'string' && raw.workdir.trim() ? raw.workdir.trim() : undefined;
  const enabled = raw.enabled !== false;
  const version = typeof raw.version === 'number' && raw.version > 0 ? raw.version : 1;
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : nowMs();
  const updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : createdAt;
  /** @type {CatAgentDoc} */
  const doc = {
    id,
    name: name || purpose.slice(0, 48) || 'Cat agent',
    purpose,
    intervalMs,
    runtime: 'local',
    enabled,
    version,
    createdAt,
    updatedAt,
  };
  if (model) doc.model = model;
  if (workdir) doc.workdir = workdir;
  if (typeof raw.lastRunAt === 'number') doc.lastRunAt = raw.lastRunAt;
  if (typeof raw.lastRunStatus === 'string') doc.lastRunStatus = raw.lastRunStatus;
  if (typeof raw.lastCatId === 'string') doc.lastCatId = raw.lastCatId;
  return doc;
}

function readAgentDoc(agentId) {
  return normalizeAgentDoc(readJsonSafe(agentDocPath(agentId)));
}

function writeAgentDoc(doc) {
  const normalized = normalizeAgentDoc(doc);
  if (!normalized) throw new Error('Invalid agent document');
  writeFileAtomic(agentDocPath(normalized.id), `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

function ensureAgentScaffold(agentId) {
  const dir = agentDir(agentId);
  fs.mkdirSync(path.join(dir, 'workspace'), { recursive: true });
  fs.mkdirSync(heartbeatsDir(agentId), { recursive: true });
  const statePath = path.join(dir, 'state.json');
  if (!fs.existsSync(statePath)) {
    writeFileAtomic(statePath, '{}\n');
  }
  const notesPath = path.join(dir, 'notes.md');
  if (!fs.existsSync(notesPath)) {
    writeFileAtomic(notesPath, '');
  }
}

function deriveAgentName(purpose, explicitName) {
  const explicit = String(explicitName || '').trim();
  if (explicit) return explicit.slice(0, 120);
  const firstLine = String(purpose || '')
    .trim()
    .split('\n')[0]
    .trim();
  if (firstLine.length > 0) {
    return firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine;
  }
  return 'Cat agent';
}

function listAgentIds() {
  const root = agentsRootDir();
  if (!fs.existsSync(root)) return [];
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function listCatAgents() {
  const out = [];
  for (const id of listAgentIds()) {
    const doc = readAgentDoc(id);
    if (doc) out.push(doc);
  }
  out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return out;
}

/**
 * @param {{ name?: string, purpose: string, intervalMs?: number, workdir?: string, model?: string, enabled?: boolean }} params
 */
function createCatAgent(params) {
  const purpose = String(params.purpose || '').trim();
  if (!purpose) throw new Error('Purpose is required.');
  const intervalMs =
    typeof params.intervalMs === 'number' && params.intervalMs >= MIN_INTERVAL_MS
      ? Math.floor(params.intervalMs)
      : DEFAULT_INTERVAL_MS;
  const id = randomUUID();
  const ts = nowMs();
  const workdirInput = String(params.workdir || '').trim();
  ensureAgentScaffold(id);
  const defaultWorkdir = path.join(agentDir(id), 'workspace');
  const workdir = workdirInput || defaultWorkdir;
  fs.mkdirSync(workdir, { recursive: true });

  const doc = writeAgentDoc({
    id,
    name: deriveAgentName(purpose, params.name),
    purpose,
    intervalMs,
    runtime: 'local',
    model: params.model ? String(params.model).trim() : undefined,
    workdir,
    enabled: params.enabled !== false,
    version: 1,
    createdAt: ts,
    updatedAt: ts,
  });
  return doc;
}

/**
 * @param {string} agentId
 * @param {{ name?: string, purpose?: string, intervalMs?: number, workdir?: string, model?: string, enabled?: boolean }} patch
 */
function updateCatAgent(agentId, patch) {
  const existing = readAgentDoc(agentId);
  if (!existing) throw new Error('Agent not found.');
  const purpose =
    patch.purpose !== undefined ? String(patch.purpose || '').trim() : existing.purpose;
  if (!purpose) throw new Error('Purpose is required.');
  const intervalMs =
    patch.intervalMs !== undefined
      ? patch.intervalMs >= MIN_INTERVAL_MS
        ? Math.floor(patch.intervalMs)
        : DEFAULT_INTERVAL_MS
      : existing.intervalMs;
  const workdir =
    patch.workdir !== undefined
      ? String(patch.workdir || '').trim() || path.join(agentDir(agentId), 'workspace')
      : existing.workdir;
  if (workdir) fs.mkdirSync(workdir, { recursive: true });

  const doc = writeAgentDoc({
    ...existing,
    name:
      patch.name !== undefined
        ? deriveAgentName(purpose, patch.name)
        : deriveAgentName(purpose, existing.name),
    purpose,
    intervalMs,
    model:
      patch.model !== undefined
        ? String(patch.model || '').trim() || undefined
        : existing.model,
    workdir,
    enabled: patch.enabled !== undefined ? patch.enabled !== false : existing.enabled,
    version: existing.version + 1,
    updatedAt: nowMs(),
  });
  return doc;
}

function deleteCatAgent(agentId) {
  const id = String(agentId);
  const dir = agentDir(id);
  if (!fs.existsSync(dir)) throw new Error('Agent not found.');
  fs.rmSync(dir, { recursive: true, force: true });
}

function setCatAgentEnabled(agentId, enabled) {
  return updateCatAgent(agentId, { enabled: !!enabled });
}

/**
 * @param {string} agentId
 * @param {{ runId: string, status?: string, finishBubbleLine?: string, durationMs?: number }} record
 */
function writeHeartbeatRecord(agentId, record) {
  const id = String(agentId);
  const runId = String(record.runId || '').trim();
  if (!runId) return;
  fs.mkdirSync(heartbeatsDir(id), { recursive: true });
  const payload = {
    runId,
    status: record.status != null ? String(record.status) : 'finished',
    finishBubbleLine:
      record.finishBubbleLine != null ? String(record.finishBubbleLine) : undefined,
    durationMs: typeof record.durationMs === 'number' ? record.durationMs : undefined,
    at: nowMs(),
  };
  writeFileAtomic(
    path.join(heartbeatsDir(id), `${runId}.json`),
    `${JSON.stringify(payload, null, 2)}\n`
  );
}

/**
 * @param {string} agentId
 * @param {Partial<Pick<CatAgentDoc, 'lastRunAt' | 'lastRunStatus' | 'lastCatId'>>} patch
 */
function patchAgentRunMeta(agentId, patch) {
  const existing = readAgentDoc(agentId);
  if (!existing) return null;
  return writeAgentDoc({
    ...existing,
    lastRunAt: patch.lastRunAt != null ? patch.lastRunAt : existing.lastRunAt,
    lastRunStatus:
      patch.lastRunStatus != null ? String(patch.lastRunStatus) : existing.lastRunStatus,
    lastCatId: patch.lastCatId != null ? String(patch.lastCatId) : existing.lastCatId,
    version: existing.version + 1,
    updatedAt: nowMs(),
  });
}

/** @type {Map<string, ReturnType<typeof setInterval>>} */
const timers = new Map();
/** @type {Set<string>} */
const busy = new Set();
/** @type {Map<string, string>} agentId -> current catId */
const activeCatByAgent = new Map();

/** @type {{ startAgentForCat?: Function, sendSpawnCatToOverlay?: Function, reactivateCatOnOverlay?: Function, hasConversation?: (catId: string) => boolean, getMainWindow?: Function, onAgentsChanged?: Function, log?: Console }} */
let runtimeHooks = {};

function setCatAgentRuntimeHooks(hooks) {
  runtimeHooks = hooks && typeof hooks === 'object' ? hooks : {};
}

function clearTimer(agentId) {
  const t = timers.get(agentId);
  if (t) {
    clearInterval(t);
    timers.delete(agentId);
  }
}

function scheduleAgentTimer(agentId, intervalMs) {
  clearTimer(agentId);
  const ms = Math.max(MIN_INTERVAL_MS, intervalMs || DEFAULT_INTERVAL_MS);
  const timer = setInterval(() => {
    void tick(agentId);
  }, ms);
  timers.set(agentId, timer);
}

async function tick(agentId) {
  const id = String(agentId);
  const doc = readAgentDoc(id);
  if (!doc || !doc.enabled) return;
  if (busy.has(id)) return;

  const {
    startAgentForCat,
    sendSpawnCatToOverlay,
    reactivateCatOnOverlay,
    hasConversation,
    getMainWindow,
    log = console,
  } = runtimeHooks;
  if (typeof startAgentForCat !== 'function' || typeof sendSpawnCatToOverlay !== 'function') {
    log.warn('[cat-agents] tick: runtime hooks not configured');
    return;
  }

  busy.add(id);
  const priorCatId =
    typeof doc.lastCatId === 'string' && doc.lastCatId.trim() ? doc.lastCatId.trim() : '';
  const reuseCat =
    priorCatId &&
    (typeof hasConversation === 'function' ? hasConversation(priorCatId) : false);
  const catId = reuseCat ? priorCatId : randomUUID();
  activeCatByAgent.set(id, catId);
  const dataDir = agentDir(id);
  const workdir = doc.workdir || path.join(dataDir, 'workspace');
  try {
    fs.mkdirSync(workdir, { recursive: true });
    patchAgentRunMeta(id, { lastCatId: catId });
    if (!reuseCat) {
      sendSpawnCatToOverlay({
        catId,
        folder: workdir,
        prompt: doc.purpose,
        catAgentId: id,
      });
    } else if (typeof reactivateCatOnOverlay === 'function') {
      reactivateCatOnOverlay(catId);
    }
    startAgentForCat(
      {
        catId,
        folder: workdir,
        prompt: doc.purpose,
        model: doc.model,
        runtime: 'local',
        catAgent: { id, name: doc.name, intervalMs: doc.intervalMs, dataDir },
      },
      { getMainWindow, log }
    );
  } catch (e) {
    busy.delete(id);
    activeCatByAgent.delete(id);
    log.warn('[cat-agents] tick failed', e);
  }
}

function reload(agentId) {
  if (agentId) {
    const doc = readAgentDoc(agentId);
    clearTimer(agentId);
    if (doc && doc.enabled) scheduleAgentTimer(agentId, doc.intervalMs);
    return;
  }
  stop();
  for (const id of listAgentIds()) {
    const doc = readAgentDoc(id);
    if (doc && doc.enabled) scheduleAgentTimer(id, doc.intervalMs);
  }
}

function start() {
  reload();
}

function stop() {
  for (const id of Array.from(timers.keys())) {
    clearTimer(id);
  }
}

function runNow(agentId) {
  return tick(agentId);
}

function markAgentRunFinished(agentId, catId) {
  const id = String(agentId);
  if (activeCatByAgent.get(id) === String(catId)) {
    busy.delete(id);
    activeCatByAgent.delete(id);
  }
}

function isAgentBusy(agentId) {
  return busy.has(String(agentId));
}

module.exports = {
  MIN_INTERVAL_MS,
  DEFAULT_INTERVAL_MS,
  agentsRootDir,
  agentDir,
  listCatAgents,
  readAgentDoc,
  createCatAgent,
  updateCatAgent,
  deleteCatAgent,
  setCatAgentEnabled,
  writeHeartbeatRecord,
  patchAgentRunMeta,
  setCatAgentRuntimeHooks,
  start,
  stop,
  reload,
  tick,
  runNow,
  markAgentRunFinished,
  isAgentBusy,
};
