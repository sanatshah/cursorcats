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
 * @returns {string} path to `.env`
 */
function setCursorApiKey(packageRoot, apiKey) {
  const trimmed = String(apiKey || '').trim();
  if (!trimmed) {
    throw new Error('API key is empty');
  }
  const envPath = getEnvFilePath(packageRoot);
  upsertEnvFileKey(envPath, 'CURSOR_API_KEY', trimmed);
  process.env.CURSOR_API_KEY = trimmed;
  return envPath;
}

module.exports = {
  getEnvFilePath,
  loadEnvFileIntoProcess,
  hasCursorApiKeyInEnvFile,
  setCursorApiKey,
  cursorApiKeyConfigured,
};
