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

const sessionId = data.session_id != null ? String(data.session_id) : '';
if (!sessionId) {
  process.exit(0);
}
if (data.is_background_agent === true) {
  process.exit(0);
}

notify('ide-session-end', {
  session_id: sessionId,
  reason: data.reason,
  duration_ms: data.duration_ms,
  is_background_agent: data.is_background_agent,
  final_status: data.final_status,
  error_message: data.error_message,
});

process.exit(0);
