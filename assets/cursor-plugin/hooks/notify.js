/**
 * Fire-and-forget: POSTs to the cursorcats hook server. Always exits 0; never blocks Cursor.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

function getIpcPath() {
  return path.join(os.homedir(), '.cursorcats', 'ipc.json');
}

/**
 * @param {string} event
 * @param {Record<string, unknown>} [payload]
 */
function notify(event, payload) {
  let ipc;
  try {
    ipc = JSON.parse(fs.readFileSync(getIpcPath(), 'utf8'));
  } catch {
    return;
  }
  if (!ipc || !ipc.port || !ipc.token) {
    return;
  }
  const data = JSON.stringify({ event, token: ipc.token, payload: payload || {} });
  const req = http.request(
    {
      hostname: '127.0.0.1',
      port: Number(ipc.port),
      path: '/event',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    },
    (res) => {
      try {
        res.resume();
      } catch {
        // ignore
      }
    }
  );
  req.on('error', () => {
    // ignore: cursorcats may be off; hooks must not fail-open into blocking
  });
  req.setTimeout(1000, () => {
    try {
      req.destroy();
    } catch {
      // ignore
    }
  });
  req.write(data);
  req.end();
}

module.exports = { notify, getIpcPath };
