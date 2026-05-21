'use strict';

const fs = require('fs');
const path = require('path');

function getEnvFilePath(packageRoot) {
  return path.join(packageRoot, '.env');
}

/**
 * @param {string} line
 * @returns {{ key: string, value: string } | null}
 */
function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) return null;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

/**
 * @param {string} envPath
 * @returns {Record<string, string>}
 */
function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const text = fs.readFileSync(envPath, 'utf8');
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (parsed) out[parsed.key] = parsed.value;
  }
  return out;
}

/**
 * @param {string} value
 */
function formatEnvValue(value) {
  const s = String(value ?? '');
  if (/^[A-Za-z0-9_./+-]+$/.test(s)) return s;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

/** Markers so we can replace the same block on future saves. */
const CURSORCATS_SHELL_KEY_BEGIN = '# >>> cursorcats CURSOR_API_KEY >>>';
const CURSORCATS_SHELL_KEY_END = '# <<< cursorcats CURSOR_API_KEY <<<';

/**
 * Quote a value for POSIX `export VAR='…'` (bash/zsh).
 * @param {string} value
 */
function shellSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * Pick ~/.zshrc vs ~/.bashrc using SHELL, then common fallbacks (GUI apps often lack SHELL).
 * @returns {string | null} absolute path, or null if no home directory
 */
function getShellRcPath() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) return null;
  const shell = (process.env.SHELL || '').trim();
  const zshRc = path.join(home, '.zshrc');
  const bashRc = path.join(home, '.bashrc');
  if (shell.endsWith('/zsh') || shell === 'zsh') return zshRc;
  if (shell.endsWith('/bash') || shell === 'bash') return bashRc;
  if (fs.existsSync(zshRc)) return zshRc;
  if (fs.existsSync(bashRc)) return bashRc;
  if (process.platform === 'darwin') return zshRc;
  return bashRc;
}

/**
 * Insert or replace a marked `export CURSOR_API_KEY=…` block in a shell rc file.
 * @param {string} rcPath
 * @param {string} apiKey
 */
function upsertShellRcCursorApiKey(rcPath, apiKey) {
  const exportLine = `export CURSOR_API_KEY=${shellSingleQuote(apiKey)}`;
  const block = `${CURSORCATS_SHELL_KEY_BEGIN}\n${exportLine}\n${CURSORCATS_SHELL_KEY_END}`;
  const raw = fs.existsSync(rcPath) ? fs.readFileSync(rcPath, 'utf8') : '';
  const start = raw.indexOf(CURSORCATS_SHELL_KEY_BEGIN);
  const end =
    start === -1 ? -1 : raw.indexOf(CURSORCATS_SHELL_KEY_END, start + CURSORCATS_SHELL_KEY_BEGIN.length);
  let next;
  if (start !== -1 && end !== -1) {
    const before = raw.slice(0, start);
    const after = raw.slice(end + CURSORCATS_SHELL_KEY_END.length);
    next = `${before}${block}${after}`;
  } else {
    const pad = raw.length && !raw.endsWith('\n') ? '\n' : '';
    const spacer = raw.length ? '\n' : '';
    next = `${raw}${pad}${spacer}${block}\n`;
  }
  if (!next.endsWith('\n')) next += '\n';
  fs.writeFileSync(rcPath, next, 'utf8');
}

/**
 * @param {string} envPath
 * @param {string} key
 * @param {string} value
 */
function upsertEnvFileKey(envPath, key, value) {
  const lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : [];
  let found = false;
  const next = lines.map((line) => {
    const parsed = parseEnvLine(line);
    if (parsed && parsed.key === key) {
      found = true;
      return `${key}=${formatEnvValue(value)}`;
    }
    return line;
  });
  if (!found) {
    if (next.length && next[next.length - 1] !== '') next.push('');
    next.push(`${key}=${formatEnvValue(value)}`);
  }
  const content = next.join('\n');
  fs.writeFileSync(envPath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

/**
 * Merge package `.env` into `process.env` (does not override existing non-empty vars).
 * @param {string} packageRoot
 */
function loadEnvFileIntoProcess(packageRoot) {
  const envPath = getEnvFilePath(packageRoot);
  const vars = readEnvFile(envPath);
  for (const [k, v] of Object.entries(vars)) {
    if (process.env[k] === undefined || process.env[k] === '') {
      process.env[k] = v;
    }
  }
}

/**
 * @param {string} packageRoot
 */
function hasCursorApiKeyInEnvFile(packageRoot) {
  const vars = readEnvFile(getEnvFilePath(packageRoot));
  const v = vars.CURSOR_API_KEY;
  return typeof v === 'string' && v.trim().length > 0;
}

function cursorApiKeyConfigured() {
  const v = process.env.CURSOR_API_KEY;
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * @param {string} packageRoot
 * @param {string} apiKey
 * @returns {{ envPath: string, shellRc: { path: string | null, error: string | null } }}
 */
function setCursorApiKey(packageRoot, apiKey) {
  const trimmed = String(apiKey || '').trim();
  if (!trimmed) {
    throw new Error('API key is empty');
  }
  const envPath = getEnvFilePath(packageRoot);
  upsertEnvFileKey(envPath, 'CURSOR_API_KEY', trimmed);
  process.env.CURSOR_API_KEY = trimmed;

  /** @type {{ path: string | null, error: string | null }} */
  const shellRc = { path: null, error: null };
  const rcPath = getShellRcPath();
  if (!rcPath) {
    shellRc.error = 'HOME was not set; skipped updating shell rc.';
  } else {
    try {
      upsertShellRcCursorApiKey(rcPath, trimmed);
      shellRc.path = rcPath;
    } catch (e) {
      shellRc.error = (e && e.message) || String(e);
    }
  }
  return { envPath, shellRc };
}

module.exports = {
  getEnvFilePath,
  getShellRcPath,
  loadEnvFileIntoProcess,
  hasCursorApiKeyInEnvFile,
  setCursorApiKey,
  cursorApiKeyConfigured,
};
