/* global cursorcats */

const params = new URLSearchParams(window.location.search);
const catId = params.get('catId');
const logEl = document.getElementById('log');
const metaEl = document.getElementById('meta');
const closeBtn = document.getElementById('btn-close');
const dismissBtn = document.getElementById('btn-dismiss');
const followupInput = document.getElementById('followup-input');
const sendBtn = document.getElementById('btn-send');

let unsubUpdated = null;
/** @type {{ runStatus?: string } | null} */
let lastData = null;

function escapeText(s) {
  const t = String(s);
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function kindToLabel(k) {
  return (
    {
      user: 'You',
      assistant: 'Cat',
      thinking: 'Thinking',
      tool: 'Tool',
      task: 'Task',
      system: 'System',
      error: 'Error',
    }[k] || k
  );
}

function kindClass(k) {
  const safe = String(k).replace(/[^a-z0-9-]/gi, '') || 'item';
  return `line--${safe}`;
}

function updateComposerFromData(data) {
  if (!followupInput || !sendBtn) return;
  const running = data && String(data.runStatus || '').toLowerCase() === 'running';
  const ok = data && data.found;
  followupInput.disabled = !ok;
  sendBtn.disabled = !ok || running;
}

async function render() {
  if (!window.cursorcats?.getAgentConversation || !catId) {
    logEl.textContent = 'No conversation to show.';
    updateComposerFromData(null);
    return;
  }
  const data = await window.cursorcats.getAgentConversation(catId);
  lastData = data;
  if (!data || !data.found) {
    logEl.textContent = 'This conversation is not available yet, or the agent was not started.';
    updateComposerFromData(null);
    return;
  }

  if (data.folder) {
    metaEl.hidden = false;
    metaEl.textContent = data.prompt ? `${data.folder} — “${data.prompt}”` : data.folder;
  } else {
    metaEl.hidden = true;
  }

  logEl.innerHTML = (data.items || [])
    .filter((item) => item.kind !== 'status')
    .map(
      (item) => `
  <div class="line ${kindClass(item.kind)}">
    <span class="line-label">${escapeText(kindToLabel(item.kind))}</span>
    <div class="line-text">${escapeText(item.text).replace(/\n/g, '<br>')}</div>
  </div>
`
    )
    .join('');
  logEl.scrollTop = logEl.scrollHeight;
  updateComposerFromData(data);
}

function sendFollowup() {
  if (!catId || !followupInput) return;
  const text = followupInput.value.trim();
  if (!text) return;
  if (lastData && String(lastData.runStatus || '').toLowerCase() === 'running') return;
  if (typeof window.cursorcats.sendFollowup !== 'function') return;
  followupInput.value = '';
  void window.cursorcats.sendFollowup(catId, text);
  void render();
}

if (catId) {
  void render();
  if (typeof window.cursorcats.onConversationUpdated === 'function') {
    unsubUpdated = window.cursorcats.onConversationUpdated((ev) => {
      if (ev && String(ev.catId) === String(catId)) {
        void render();
      }
    });
  }
} else {
  logEl.textContent = 'Missing cat id.';
}

function close() {
  if (typeof window.cursorcats.closeConversationWindow === 'function') {
    window.cursorcats.closeConversationWindow();
  }
}

function dismiss() {
  if (!catId) return;
  if (typeof window.cursorcats.dismissCat === 'function') {
    window.cursorcats.dismissCat(catId);
  }
}

closeBtn.addEventListener('click', () => {
  close();
});

if (dismissBtn) {
  dismissBtn.addEventListener('click', () => {
    dismiss();
  });
}

if (sendBtn) {
  sendBtn.addEventListener('click', () => {
    sendFollowup();
  });
}

if (followupInput) {
  followupInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    sendFollowup();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
  }
});

window.addEventListener('beforeunload', () => {
  if (unsubUpdated) {
    try {
      unsubUpdated();
    } catch {
      // ignore
    }
  }
});
