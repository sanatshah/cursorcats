'use strict';

const fs = require('fs');
const path = require('path');

/** Markers so we can replace the same block on future saves. */
const CURSORCATS_SHELL_KEY_BEGIN = '# >>> cursorcats CURSOR_API_KEY >>>';
const CURSORCATS_SHELL_KEY_END = '# <<< cursorcats CURSOR_API_KEY <<<';

/**
 * @param {string | null | undefined} value
 */
function normalizeCursorApiKeyInput(value) {
  let s = String(value || '').trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

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
 * Parse `export CURSOR_API_KEY='…'` from a POSIX single-quoted rhs.
 * @param {string} raw
 */
function parseShellSingleQuotedExport(raw) {
  const s = String(raw || '').trim();
  if (!s.startsWith("'") || !s.endsWith("'") || s.length < 2) return s;
  return s.slice(1, -1).replace(/'\\''/g, "'");
}

/**
 * Read `CURSOR_API_KEY` from the cursorcats-managed block in a shell rc file.
 * @param {string | null} rcPath
 * @returns {string | null}
 */
function readShellRcCursorApiKey(rcPath) {
  if (!rcPath || !fs.existsSync(rcPath)) return null;
  const raw = fs.readFileSync(rcPath, 'utf8');
  const start = raw.indexOf(CURSORCATS_SHELL_KEY_BEGIN);
  if (start === -1) return null;
  const end = raw.indexOf(CURSORCATS_SHELL_KEY_END, start + CURSORCATS_SHELL_KEY_BEGIN.length);
  if (end === -1) return null;
  const block = raw.slice(start, end);
  const match = block.match(/^\s*export\s+CURSOR_API_KEY=(.+)$/m);
  if (!match) return null;
  const value = parseShellSingleQuotedExport(match[1]);
  return value.trim() || null;
}

/**
 * @param {string | null} rcPath
 */
function hasCursorApiKeyInShellRc(rcPath) {
  const v = readShellRcCursorApiKey(rcPath);
  return typeof v === 'string' && v.length > 0;
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
 * Load `CURSOR_API_KEY` from the shell rc managed block into `process.env`.
 */
function loadCursorApiKeyIntoProcess() {
  const fromShell = readShellRcCursorApiKey(getShellRcPath());
  if (fromShell) {
    process.env.CURSOR_API_KEY = fromShell;
  }
}

/** True when the key is saved in the cursorcats-managed shell rc block. */
function cursorApiKeyConfigured() {
  return hasCursorApiKeyInShellRc(getShellRcPath());
}

/**
 * @param {string} apiKey
 * @returns {{ shellRcPath: string }}
 */
function setCursorApiKey(apiKey) {
  const trimmed = normalizeCursorApiKeyInput(apiKey);
  if (!trimmed) {
    throw new Error('API key is empty');
  }
  const rcPath = getShellRcPath();
  if (!rcPath) {
    throw new Error('HOME was not set; cannot save API key to shell config.');
  }
  upsertShellRcCursorApiKey(rcPath, trimmed);
  process.env.CURSOR_API_KEY = trimmed;
  return { shellRcPath: rcPath };
}

/**
 * @returns {{ configured: boolean, shellRcPath: string | null }}
 */
function getCursorApiKeyStatus() {
  const shellRcPath = getShellRcPath();
  return {
    configured: hasCursorApiKeyInShellRc(shellRcPath),
    shellRcPath,
  };
}

module.exports = {
  getShellRcPath,
  loadCursorApiKeyIntoProcess,
  hasCursorApiKeyInShellRc,
  readShellRcCursorApiKey,
  normalizeCursorApiKeyInput,
  setCursorApiKey,
  cursorApiKeyConfigured,
  getCursorApiKeyStatus,
};
