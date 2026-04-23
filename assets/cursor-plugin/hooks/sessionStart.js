#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { notify } = require('./notify.js');

let raw = '';
try {
  raw = fs.readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let data;
try {
  data = JSON.parse(raw || '{}');
} catch {
  process.exit(0);
}

if (data.is_background_agent === true) {
  process.exit(0);
}

const sessionId = data.session_id != null ? String(data.session_id) : data.conversation_id != null ? String(data.conversation_id) : '';
if (!sessionId) {
  process.exit(0);
}

const workspace_roots = Array.isArray(data.workspace_roots) ? data.workspace_roots : [];
notify('ide-session-start', {
  session_id: sessionId,
  conversation_id: data.conversation_id != null ? String(data.conversation_id) : sessionId,
  workspace_roots,
  composer_mode: data.composer_mode,
  cursor_version: data.cursor_version,
  user_email: data.user_email,
});

process.exit(0);
