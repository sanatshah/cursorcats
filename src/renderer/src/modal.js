/* global cursorcats */

import catSpriteUrl from '../../../assets/cats/cat.png';
import { insertNewlineAtCursor } from './insert-newline-at-cursor.js';

const promptEl = document.getElementById('prompt');
const headerAppIcon = document.getElementById('header-app-icon');
if (headerAppIcon) {
  headerAppIcon.style.backgroundImage = `url("${catSpriteUrl}")`;
}
const errorEl = document.getElementById('error');
const hintEl = document.getElementById('spawn-hint');

const isApple =
  /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.userAgentData?.platform || '').toLowerCase().includes('mac');

if (hintEl) {
  if (isApple) {
    hintEl.innerHTML = '<kbd>⌘</kbd>+<kbd>O</kbd> folder · <kbd>Esc</kbd> cancel';
  } else {
    hintEl.innerHTML = '<kbd>Ctrl</kbd>+<kbd>O</kbd> folder · <kbd>Esc</kbd> cancel';
  }
}
const btnChoose = document.getElementById('btn-choose-folder');
const recentFoldersContainer = document.getElementById('recent-folders-container');
const recentFoldersList = document.getElementById('recent-folders-list');
const modelPicker = document.getElementById('model-picker');
const modelChipLabel = document.getElementById('model-chip-label');
const modelMenu = document.getElementById('model-menu');
const skillMenu = document.getElementById('skill-menu');
const btnCreateCat = document.getElementById('btn-create-cat');
const runtimeLocalBtn = document.getElementById('runtime-local');
const runtimeCloudBtn = document.getElementById('runtime-cloud');
const runtimeAgentsBtn = document.getElementById('runtime-agents');
const createCatAgentToggle = document.getElementById('create-cat-agent-toggle');
const catAgentNameRow = document.getElementById('cat-agent-name-row');
const catAgentNameInput = document.getElementById('cat-agent-name');
const projectSectionTitle = document.getElementById('project-section-title');
const localProjectSection = document.getElementById('local-project-section');
const cloudProjectSection = document.getElementById('cloud-project-section');
const agentsListSection = document.getElementById('agents-list-section');
const catAgentsList = document.getElementById('cat-agents-list');
const cloudReposList = document.getElementById('cloud-repos-list');
const cloudStartingRefInput = document.getElementById('cloud-starting-ref');
const cloudRepoSearchInput = document.getElementById('cloud-repo-search');
const apiKeySection = document.getElementById('api-key-section');
const apiKeyHint = document.getElementById('api-key-hint');
const apiKeyInput = document.getElementById('api-key-input');

let needsApiKey = false;

const DEFAULT_MODEL_ID = 'composer-2';

/**
 * @typedef {{ id: string, value: string }} ModelParameterValue
 * @typedef {{ id: string, displayName?: string, values: Array<{ value: string, displayName?: string }> }} ModelParameterDefinition
 * @typedef {{ params: ModelParameterValue[], displayName: string, description?: string, isDefault?: boolean }} ModelVariant
 * @typedef {{ id: string, displayName: string, description?: string, parameters?: ModelParameterDefinition[], variants?: ModelVariant[] }} SdkModelListItem
 */

/** @type {SdkModelListItem[]} */
let modelsList = [];
let selectedModelId = DEFAULT_MODEL_ID;
let modelMenuOpen = false;

let selectedFolder = '';
/** @type {'local' | 'cloud' | 'agents'} */
let selectedRuntime = 'local';
let createCatAgentMode = false;
/** @type {string | null} */
let editingAgentId = null;
/** @type {Array<{ id: string, name: string, purpose: string, intervalMs: number, enabled: boolean, lastRunAt?: number, lastRunStatus?: string, workdir?: string }>} */
let catAgentsData = [];
/** @type {Array<{ url: string }>} */
let cloudReposListData = [];
let selectedCloudRepoUrl = '';
let cloudReposLoaded = false;
let cloudReposLoadingPromise = null;

/** @type {Array<{ id: string, name: string, description: string, source: string }>} */
let skillsList = [];
/** @type {Array<{ id: string, name: string, description: string, source: string }>} */
let selectedSkills = [];
let skillMenuOpen = false;
let skillHighlightIndex = 0;
let skillsCacheKey = '';
let skillsLoadingPromise = null;

function skillsFolderForListing() {
  return selectedRuntime === 'local' ? selectedFolder : '';
}

function invalidateSkillsCache() {
  skillsCacheKey = '';
  skillsList = [];
}

async function loadSkills() {
  if (!window.cursorcats?.listSkills) {
    skillsList = [];
    skillsCacheKey = skillsFolderForListing();
    return;
  }
  const folder = skillsFolderForListing();
  try {
    const list = await window.cursorcats.listSkills(folder);
    skillsList = Array.isArray(list)
      ? list.filter((s) => s && typeof s.name === 'string' && s.name.trim())
      : [];
  } catch {
    skillsList = [];
  }
  skillsCacheKey = folder;
}

async function ensureSkillsLoaded() {
  const key = skillsFolderForListing();
  if (skillsCacheKey === key) return;
  if (skillsLoadingPromise) return skillsLoadingPromise;
  skillsLoadingPromise = loadSkills().finally(() => {
    skillsLoadingPromise = null;
  });
  return skillsLoadingPromise;
}

/**
 * @param {string} text
 * @param {number} cursorPos
 */
function getSlashToken(text, cursorPos) {
  const before = String(text || '').slice(0, cursorPos);
  const m = before.match(/(?:^|\s)(\/[^\s]*)$/);
  if (!m) return null;
  const full = m[1];
  const query = full.slice(1);
  const start = cursorPos - full.length;
  return { start, end: cursorPos, query, full };
}

/**
 * @param {string} text
 * @param {number} cursorPos
 * @param {string} replacement
 */
function replaceSlashToken(text, cursorPos, replacement) {
  const token = getSlashToken(text, cursorPos);
  if (!token) return { text, cursorPos };
  const nextText = text.slice(0, token.start) + replacement + text.slice(cursorPos);
  return { text: nextText, cursorPos: token.start + replacement.length };
}

function filteredSkills(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return skillsList;
  return skillsList.filter((skill) => {
    const name = String(skill.name || '').toLowerCase();
    const desc = String(skill.description || '').toLowerCase();
    return name.includes(q) || desc.includes(q);
  });
}

function closeSkillMenu() {
  if (!skillMenu) return;
  skillMenuOpen = false;
  skillHighlightIndex = 0;
  skillMenu.hidden = true;
  skillMenu.innerHTML = '';
}

function renderSkillMenu(items) {
  if (!skillMenu) return;
  skillMenu.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'skill-menu-empty';
    empty.textContent = skillsList.length ? 'No matching skills' : 'No skills found';
    skillMenu.appendChild(empty);
    return;
  }
  items.forEach((skill, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'skill-menu-item';
    btn.setAttribute('role', 'option');
    btn.dataset.skillId = skill.id;
    btn.setAttribute('aria-selected', idx === skillHighlightIndex ? 'true' : 'false');

    const nameRow = document.createElement('div');
    nameRow.className = 'skill-menu-item-name';
    const code = document.createElement('code');
    code.textContent = `/${skill.name}`;
    nameRow.appendChild(code);
    const source = document.createElement('span');
    source.className = 'skill-menu-item-source';
    source.textContent = skill.source || 'skill';
    nameRow.appendChild(source);
    btn.appendChild(nameRow);

    if (skill.description && skill.description.trim()) {
      const desc = document.createElement('span');
      desc.className = 'skill-menu-item-desc';
      desc.textContent = skill.description.trim();
      btn.appendChild(desc);
    }

    btn.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
    });
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      selectSkill(skill);
    });
    skillMenu.appendChild(btn);
  });
}

function openSkillMenu(items) {
  if (!skillMenu) return;
  closeModelMenu();
  skillMenuOpen = true;
  skillHighlightIndex = 0;
  skillMenu.hidden = false;
  renderSkillMenu(items);
}

function updateSkillMenuFromPrompt() {
  if (!promptEl) return;
  const cursorPos = promptEl.selectionStart ?? promptEl.value.length;
  const token = getSlashToken(promptEl.value, cursorPos);
  if (!token) {
    closeSkillMenu();
    return;
  }
  void ensureSkillsLoaded().then(() => {
    const items = filteredSkills(token.query);
    if (!skillMenuOpen) {
      openSkillMenu(items);
    } else {
      skillHighlightIndex = Math.min(skillHighlightIndex, Math.max(0, items.length - 1));
      renderSkillMenu(items);
    }
  });
}

function selectSkill(skill) {
  if (!promptEl || !skill) return;
  const cursorPos = promptEl.selectionStart ?? promptEl.value.length;
  const marker = `/${skill.name} `;
  const { text, cursorPos: nextCursor } = replaceSlashToken(promptEl.value, cursorPos, marker);
  promptEl.value = text;
  promptEl.setSelectionRange(nextCursor, nextCursor);
  if (!selectedSkills.some((s) => s.name === skill.name)) {
    selectedSkills.push({
      id: skill.id,
      name: skill.name,
      description: skill.description || '',
      source: skill.source || '',
    });
  }
  closeSkillMenu();
  syncPromptHeight();
  promptEl.focus();
}

function resolveSkillsForSubmit(promptText) {
  /** @type {Map<string, { id: string, name: string, description: string, source: string }>} */
  const byName = new Map();
  for (const skill of selectedSkills) {
    if (skill && skill.name) byName.set(skill.name, skill);
  }
  const re = /(?:^|\s)\/([a-z0-9-]+)/gi;
  let m;
  while ((m = re.exec(promptText)) !== null) {
    const name = m[1];
    const found = skillsList.find((s) => s.name === name);
    if (found) byName.set(found.name, found);
  }
  return Array.from(byName.values());
}

function setError(msg) {
  if (!msg) {
    errorEl.hidden = true;
    errorEl.textContent = '';
    return;
  }
  errorEl.hidden = false;
  errorEl.textContent = msg;
}

function syncFolderDisplay() {
  document.querySelectorAll('.recent-folder-item').forEach(el => {
    if (el.dataset.folder === selectedFolder) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });
}

function syncCloudRepoDisplay() {
  document.querySelectorAll('.cloud-repo-item').forEach(el => {
    if (el.dataset.repoUrl === selectedCloudRepoUrl) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });
}

function addFolderToList(folder, isSelected, append = false) {
  // Don't add duplicate
  const existing = document.querySelector(`.recent-folder-item[data-folder="${folder.replace(/"/g, '\\"')}"]`);
  if (existing) {
    if (isSelected) {
      selectedFolder = folder;
      syncFolderDisplay();
    }
    return;
  }

  const item = document.createElement('div');
  item.className = 'list-item recent-folder-item';
  if (isSelected) item.classList.add('selected');
  item.dataset.folder = folder;
  
  const iconDiv = document.createElement('div');
  iconDiv.className = 'item-icon';
  iconDiv.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
  `;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'item-content';
  
  const titleDiv = document.createElement('div');
  titleDiv.className = 'item-title';
  titleDiv.textContent = folder.split(/[/\\]/).pop() || folder;
  
  const subtitleDiv = document.createElement('div');
  subtitleDiv.className = 'item-subtitle';
  subtitleDiv.textContent = folder;
  
  contentDiv.appendChild(titleDiv);
  contentDiv.appendChild(subtitleDiv);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'recent-folder-remove';
  removeBtn.setAttribute('aria-label', `Remove ${folder.split(/[/\\]/).pop() || folder} from recent projects`);
  removeBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
  `;
  removeBtn.addEventListener('click', async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (!window.cursorcats?.removeRecentFolder) return;
    let ok = false;
    try {
      ok = await window.cursorcats.removeRecentFolder(folder);
    } catch {
      ok = false;
    }
    if (!ok) return;
    item.remove();
    if (selectedFolder === folder) {
      const remaining = recentFoldersList
        ? Array.from(recentFoldersList.querySelectorAll('.recent-folder-item')).map((el) => el.dataset.folder)
        : [];
      selectedFolder = remaining[0] || '';
    }
    if (recentFoldersList && recentFoldersList.querySelectorAll('.recent-folder-item').length === 0) {
      recentFoldersContainer.hidden = true;
    }
    syncFolderDisplay();
    invalidateSkillsCache();
    syncPromptHeight();
    promptEl.focus();
  });

  item.appendChild(iconDiv);
  item.appendChild(contentDiv);
  item.appendChild(removeBtn);

  item.addEventListener('click', () => {
    selectedFolder = folder;
    syncFolderDisplay();
    invalidateSkillsCache();
    promptEl.focus();
  });
  
  if (append) {
    recentFoldersList.appendChild(item);
  } else {
    recentFoldersList.prepend(item);
  }
  
  recentFoldersContainer.hidden = false;
}

function repoDisplayName(url) {
  const u = String(url || '').replace(/\/$/, '');
  const parts = u.split('/');
  const name = parts.slice(-2).join('/');
  return name || u;
}

function addCloudRepoToList(repo, isSelected) {
  if (!cloudReposList || !repo || !repo.url) return;
  const item = document.createElement('div');
  item.className = 'list-item cloud-repo-item';
  if (isSelected) item.classList.add('selected');
  item.dataset.repoUrl = repo.url;

  const iconDiv = document.createElement('div');
  iconDiv.className = 'item-icon';
  iconDiv.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <path d="M8 13h8"></path>
    </svg>
  `;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'item-content';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'item-title';
  titleDiv.textContent = repoDisplayName(repo.url);

  const subtitleDiv = document.createElement('div');
  subtitleDiv.className = 'item-subtitle';
  subtitleDiv.textContent = repo.url;

  contentDiv.appendChild(titleDiv);
  contentDiv.appendChild(subtitleDiv);
  item.appendChild(iconDiv);
  item.appendChild(contentDiv);

  item.addEventListener('click', () => {
    selectedCloudRepoUrl = repo.url;
    syncCloudRepoDisplay();
    promptEl.focus();
  });

  cloudReposList.appendChild(item);
}

function filteredCloudRepositories() {
  const q = cloudRepoSearchInput ? cloudRepoSearchInput.value.trim().toLowerCase() : '';
  if (!q) return cloudReposListData;
  return cloudReposListData.filter((repo) => {
    const url = String(repo.url || '').toLowerCase();
    const name = repoDisplayName(repo.url).toLowerCase();
    return url.includes(q) || name.includes(q);
  });
}

function renderCloudRepositories() {
  if (!cloudReposList) return;
  cloudReposList.innerHTML = '';
  const visibleRepos = filteredCloudRepositories();

  if (cloudReposListData.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'list-item';
    empty.innerHTML = `
      <div class="item-content">
        <div class="item-title">No connected repositories</div>
        <div class="item-subtitle">Connect GitHub repositories in Cursor to use cloud cats.</div>
      </div>
    `;
    cloudReposList.appendChild(empty);
  } else if (visibleRepos.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'list-item';
    empty.innerHTML = `
      <div class="item-content">
        <div class="item-title">No matching repositories</div>
        <div class="item-subtitle">Try a different owner, repo name, or URL.</div>
      </div>
    `;
    cloudReposList.appendChild(empty);
  } else {
    visibleRepos.forEach((repo) => {
      addCloudRepoToList(repo, repo.url === selectedCloudRepoUrl);
    });
  }
  syncCloudRepoDisplay();
  syncPromptHeight();
}

async function loadRecentFolders() {
  if (!window.cursorcats?.getRecentFolders) return;
  try {
    const folders = await window.cursorcats.getRecentFolders();
    const list = Array.isArray(folders) ? folders : [];
    recentFoldersList.innerHTML = '';
    if (list.length === 0) {
      recentFoldersContainer.hidden = true;
      syncPromptHeight();
      return;
    }
    if (!selectedFolder || !list.includes(selectedFolder)) {
      selectedFolder = list[0];
    }
    recentFoldersContainer.hidden = false;
    list.forEach((folder) => {
      addFolderToList(folder, folder === selectedFolder, true);
    });
  } catch (e) {
    // ignore
  }
  syncPromptHeight();
}

async function loadCloudRepositories() {
  if (!cloudReposList) return;
  cloudReposList.innerHTML = '';
  cloudReposList.textContent = 'Loading repositories...';
  if (!window.cursorcats?.listCloudRepositories) {
    cloudReposList.textContent = 'Cloud repositories are unavailable.';
    return;
  }
  try {
    const repos = await window.cursorcats.listCloudRepositories();
    cloudReposListData = Array.isArray(repos) ? repos.filter((r) => r && r.url) : [];
  } catch {
    cloudReposListData = [];
  }

  let saved = null;
  if (window.cursorcats?.getSelectedCloudRepository) {
    try {
      saved = await window.cursorcats.getSelectedCloudRepository();
    } catch {
      saved = null;
    }
  }
  const savedUrl = saved && saved.url ? String(saved.url).trim() : '';
  if (saved && cloudStartingRefInput && typeof saved.startingRef === 'string') {
    cloudStartingRefInput.value = saved.startingRef;
  }
  if (savedUrl && cloudReposListData.some((r) => r.url === savedUrl)) {
    selectedCloudRepoUrl = savedUrl;
  } else if (!selectedCloudRepoUrl && cloudReposListData.length > 0) {
    selectedCloudRepoUrl = cloudReposListData[0].url;
  }

  renderCloudRepositories();
}

function ensureCloudRepositoriesLoaded() {
  if (cloudReposLoaded) return Promise.resolve();
  if (cloudReposLoadingPromise) return cloudReposLoadingPromise;
  cloudReposLoadingPromise = loadCloudRepositories()
    .then(() => {
      cloudReposLoaded = true;
    })
    .finally(() => {
      cloudReposLoadingPromise = null;
    });
  return cloudReposLoadingPromise;
}

function normalizeRuntime(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'cloud') return 'cloud';
  if (v === 'agents' || v === 'local agents' || v === 'local-agents' || v === 'cats') return 'agents';
  return 'local';
}

function runtimeForOneShot() {
  return selectedRuntime === 'cloud' ? 'cloud' : 'local';
}

function formatRelativeTime(ts) {
  if (!ts || !Number.isFinite(ts)) return 'never';
  const delta = Math.max(0, Date.now() - ts);
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncateText(text, max = 120) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function syncPrimaryAction() {
  if (!btnCreateCat) return;
  if (selectedRuntime === 'agents') {
    btnCreateCat.hidden = true;
    return;
  }
  btnCreateCat.hidden = false;
  if (selectedRuntime === 'local' && createCatAgentMode) {
    btnCreateCat.textContent = editingAgentId ? 'Save agent' : 'Create agent';
  } else {
    btnCreateCat.textContent = 'Spawn';
  }
}

function syncCatAgentControls() {
  const showAgentControls = selectedRuntime === 'local';
  const showNameField = showAgentControls && createCatAgentMode;
  if (createCatAgentToggle) {
    createCatAgentToggle.hidden = !showAgentControls;
    createCatAgentToggle.setAttribute('aria-pressed', createCatAgentMode ? 'true' : 'false');
    createCatAgentToggle.classList.toggle('selected', createCatAgentMode);
  }
  if (catAgentNameRow) catAgentNameRow.hidden = !showNameField;
  if (promptEl) {
    promptEl.placeholder = showNameField
      ? 'What should this agent do on each heartbeat?'
      : 'Meow, what should I work on?';
  }
  syncPrimaryAction();
}

function syncRuntimeDisplay() {
  selectedRuntime = normalizeRuntime(selectedRuntime);
  const cloud = selectedRuntime === 'cloud';
  const agents = selectedRuntime === 'agents';
  if (runtimeLocalBtn) {
    runtimeLocalBtn.classList.toggle('selected', !cloud && !agents);
    runtimeLocalBtn.setAttribute('aria-checked', !cloud && !agents ? 'true' : 'false');
  }
  if (runtimeCloudBtn) {
    runtimeCloudBtn.classList.toggle('selected', cloud);
    runtimeCloudBtn.setAttribute('aria-checked', cloud ? 'true' : 'false');
  }
  if (runtimeAgentsBtn) {
    runtimeAgentsBtn.classList.toggle('selected', agents);
    runtimeAgentsBtn.setAttribute('aria-checked', agents ? 'true' : 'false');
  }
  if (localProjectSection) localProjectSection.hidden = cloud || agents;
  if (cloudProjectSection) cloudProjectSection.hidden = !cloud;
  if (agentsListSection) agentsListSection.hidden = !agents;
  if (projectSectionTitle) {
    projectSectionTitle.textContent = agents
      ? 'Cats'
      : cloud
        ? 'Cloud Repositories'
        : 'Projects';
  }
  if (hintEl) {
    if (agents) {
      hintEl.innerHTML = '<kbd>Esc</kbd> cancel';
    } else if (cloud) {
      hintEl.innerHTML = '<kbd>Esc</kbd> cancel';
    } else if (isApple) {
      hintEl.innerHTML = '<kbd>⌘</kbd>+<kbd>O</kbd> folder · <kbd>Esc</kbd> cancel';
    } else {
      hintEl.innerHTML = '<kbd>Ctrl</kbd>+<kbd>O</kbd> folder · <kbd>Esc</kbd> cancel';
    }
  }
  syncCatAgentControls();
  syncPromptHeight();
}

async function loadCatAgents() {
  if (!window.cursorcats?.listCatAgents || !catAgentsList) return;
  try {
    const list = await window.cursorcats.listCatAgents();
    catAgentsData = Array.isArray(list) ? list : [];
  } catch {
    catAgentsData = [];
  }
  renderCatAgentsList();
}

function renderCatAgentsList() {
  if (!catAgentsList) return;
  catAgentsList.innerHTML = '';
  if (!catAgentsData.length) {
    const empty = document.createElement('div');
    empty.className = 'cat-agents-empty';
    empty.textContent =
      'No local cat agents yet. Switch to Local, toggle Create cat agent, name it, and save a purpose.';
    catAgentsList.appendChild(empty);
    syncPromptHeight();
    return;
  }

  for (const agent of catAgentsData) {
    const item = document.createElement('div');
    item.className = 'cat-agent-item';
    item.dataset.agentId = agent.id;

    const head = document.createElement('div');
    head.className = 'cat-agent-item-head';

    const textCol = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'cat-agent-item-title';
    title.textContent = agent.name || 'Cat agent';
    const purpose = document.createElement('div');
    purpose.className = 'cat-agent-item-purpose';
    purpose.textContent = truncateText(agent.purpose, 160);
    textCol.appendChild(title);
    textCol.appendChild(purpose);

    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'cat-agent-enabled';
    const enabledInput = document.createElement('input');
    enabledInput.type = 'checkbox';
    enabledInput.checked = agent.enabled !== false;
    enabledInput.addEventListener('change', async () => {
      if (!window.cursorcats?.setCatAgentEnabled) return;
      await window.cursorcats.setCatAgentEnabled(agent.id, enabledInput.checked);
      await loadCatAgents();
    });
    enabledLabel.appendChild(enabledInput);
    enabledLabel.appendChild(document.createTextNode('Enabled'));

    head.appendChild(textCol);
    head.appendChild(enabledLabel);

    const meta = document.createElement('div');
    meta.className = 'cat-agent-item-meta';
    const intervalMin = Math.max(1, Math.round((agent.intervalMs || 900000) / 60000));
    meta.appendChild(document.createTextNode(`Every ${intervalMin} min`));
    const badge = document.createElement('span');
    const status = String(agent.lastRunStatus || '').toLowerCase();
    badge.className = `cat-agent-badge${status === 'error' ? ' error' : status ? ' ok' : ''}`;
    badge.textContent = agent.lastRunAt
      ? `ran ${formatRelativeTime(agent.lastRunAt)}${status ? ` — ${status}` : ''}`
      : 'never ran';
    meta.appendChild(badge);

    const actions = document.createElement('div');
    actions.className = 'cat-agent-item-actions';

    const runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = 'cat-agent-action';
    runBtn.textContent = 'Run now';
    runBtn.addEventListener('click', async () => {
      if (!window.cursorcats?.runCatAgentNow) return;
      setError('');
      const result = await window.cursorcats.runCatAgentNow(agent.id);
      if (result && result.ok === false && result.error) {
        setError(result.error);
      }
      await loadCatAgents();
    });

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'cat-agent-action';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      editingAgentId = agent.id;
      createCatAgentMode = true;
      if (catAgentNameInput) catAgentNameInput.value = agent.name || '';
      if (promptEl) promptEl.value = agent.purpose || '';
      if (agent.workdir) {
        selectedFolder = agent.workdir;
        addFolderToList(agent.workdir, true, false);
        syncFolderDisplay();
      }
      void selectRuntime('local');
      syncPromptHeight();
      promptEl?.focus();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'cat-agent-action danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      if (!window.cursorcats?.deleteCatAgent) return;
      const result = await window.cursorcats.deleteCatAgent(agent.id);
      if (result && result.ok === false && result.error) {
        setError(result.error);
        return;
      }
      if (editingAgentId === agent.id) editingAgentId = null;
      await loadCatAgents();
    });

    actions.appendChild(runBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(head);
    item.appendChild(meta);
    item.appendChild(actions);
    catAgentsList.appendChild(item);
  }
  syncPromptHeight();
}

async function selectRuntime(runtime) {
  selectedRuntime = normalizeRuntime(runtime);
  syncRuntimeDisplay();
  invalidateSkillsCache();
  if (selectedRuntime === 'cloud') {
    void ensureCloudRepositoriesLoaded();
  } else if (selectedRuntime === 'agents') {
    await loadCatAgents();
  }
  if (selectedRuntime !== 'local') {
    createCatAgentMode = false;
    editingAgentId = null;
    if (catAgentNameInput) catAgentNameInput.value = '';
    syncCatAgentControls();
  }
  if (window.cursorcats?.setSelectedRuntime && selectedRuntime !== 'agents') {
    try {
      await window.cursorcats.setSelectedRuntime(runtimeForOneShot());
    } catch {
      /* ignore */
    }
  }
  promptEl.focus();
}

async function onChooseFolder() {
  if (!window.cursorcats?.chooseFolder) return;
  setError('');
  try {
    const picked = await window.cursorcats.chooseFolder();
    if (picked) {
      selectedFolder = picked;
      addFolderToList(picked, true, false);
      syncFolderDisplay();
      invalidateSkillsCache();
      promptEl.focus();
    }
  } catch {
    setError('Could not open folder picker.');
  }
}

async function ensureApiKeySaved() {
  if (!needsApiKey) return true;
  const key = apiKeyInput ? apiKeyInput.value.trim() : '';
  if (!key) {
    setError('Enter your Cursor API key.');
    apiKeyInput?.focus();
    return false;
  }
  if (!window.cursorcats?.saveCursorApiKey) {
    setError('Could not save API key. Try reopening CursorCats.');
    return false;
  }
  try {
    const result = await window.cursorcats.saveCursorApiKey(key);
    if (!result || !result.ok) {
      setError(result?.error || 'Could not save API key to shell config.');
      return false;
    }
    needsApiKey = false;
    if (apiKeySection) apiKeySection.hidden = true;
    if (apiKeyInput) apiKeyInput.value = '';
    return true;
  } catch {
    setError('Could not save API key to shell config.');
    return false;
  }
}

async function submit() {
  setError('');
  closeSkillMenu();
  if (selectedRuntime === 'agents') return;
  if (!(await ensureApiKeySaved())) return;
  const prompt = (promptEl.value || '').trim();
  const runtime = runtimeForOneShot();
  if (runtime === 'local') {
    if (createCatAgentMode) {
      const agentName = catAgentNameInput ? catAgentNameInput.value.trim() : '';
      if (!agentName) {
        setError('Enter a name for the cat agent.');
        catAgentNameInput?.focus();
        return;
      }
      if (!prompt) {
        setError('Enter a purpose for the cat agent.');
        return;
      }
      if (window.cursorcats?.submitNewCat) {
        window.cursorcats.submitNewCat({
          folder: selectedFolder.trim() || '',
          prompt,
          model: selectedModelId,
          runtime: 'local',
          skills: [],
          createCatAgent: true,
          editingAgentId,
          agentName,
        });
      } else {
        setError('Could not reach the app. Try reopening CursorCats.');
      }
      return;
    }
    if (!selectedFolder.trim()) {
      setError('Choose a folder.');
      return;
    }
  } else {
    if (!selectedCloudRepoUrl.trim()) {
      setError('Choose a cloud repository.');
      return;
    }
  }
  if (!prompt) {
    setError('Enter a prompt.');
    return;
  }
  const skills = resolveSkillsForSubmit(prompt);
  if (runtime === 'local' && window.cursorcats?.addRecentFolder) {
    window.cursorcats.addRecentFolder(selectedFolder);
  }
  const startingRef = cloudStartingRefInput ? cloudStartingRefInput.value.trim() : '';
  if (runtime === 'cloud' && window.cursorcats?.setSelectedCloudRepository) {
    window.cursorcats.setSelectedCloudRepository({
      url: selectedCloudRepoUrl,
      startingRef,
    });
  }
  if (window.cursorcats?.submitNewCat) {
    window.cursorcats.submitNewCat({
      folder: runtime === 'local' ? selectedFolder : '',
      prompt,
      model: selectedModelId,
      runtime,
      skills,
      cloudRepo:
        runtime === 'cloud'
          ? {
              url: selectedCloudRepoUrl,
              startingRef,
            }
          : null,
    });
  } else {
    setError('Could not reach the app. Try reopening CursorCats.');
  }
}

function cancel() {
  if (window.cursorcats?.cancelNewCat) {
    window.cursorcats.cancelNewCat();
  }
}

function updateModelChipLabel() {
  if (!modelChipLabel) return;
  const m = modelsList.find((x) => x.id === selectedModelId);
  modelChipLabel.textContent = m ? m.displayName || m.id : selectedModelId;
}

function renderModelMenu() {
  if (!modelMenu) return;
  modelMenu.innerHTML = '';
  for (const m of modelsList) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'model-menu-item';
    btn.setAttribute('role', 'option');
    btn.dataset.modelId = m.id;
    btn.setAttribute('aria-selected', m.id === selectedModelId ? 'true' : 'false');
    const title = document.createElement('span');
    title.textContent = m.displayName || m.id;
    btn.appendChild(title);
    if (m.description && m.description.trim()) {
      const desc = document.createElement('span');
      desc.className = 'model-menu-item-desc';
      desc.textContent = m.description.trim();
      btn.appendChild(desc);
    }
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      void selectModel(m.id);
      closeModelMenu();
      promptEl.focus();
    });
    modelMenu.appendChild(btn);
  }
}

function syncModelMenuWrapPadding() {
  const w = document.querySelector('.wrap');
  if (!w) return;
  if (!modelMenuOpen || !modelMenu || modelMenu.hidden) {
    w.style.paddingBottom = '';
    pushContentHeight();
    return;
  }
  const h = Math.min(modelMenu.scrollHeight, 220) + 14;
  w.style.paddingBottom = `${h}px`;
  pushContentHeight();
}

function openModelMenu() {
  if (!modelMenu || !modelPicker) return;
  closeSkillMenu();
  modelMenuOpen = true;
  modelMenu.hidden = false;
  modelPicker.setAttribute('aria-expanded', 'true');
  renderModelMenu();
  syncModelMenuWrapPadding();
}

function closeModelMenu() {
  if (!modelMenu || !modelPicker) return;
  modelMenuOpen = false;
  modelMenu.hidden = true;
  modelPicker.setAttribute('aria-expanded', 'false');
  syncModelMenuWrapPadding();
}

async function selectModel(id) {
  const next = String(id || '').trim() || DEFAULT_MODEL_ID;
  selectedModelId = next;
  if (window.cursorcats?.setSelectedModel) {
    try {
      await window.cursorcats.setSelectedModel(next);
    } catch {
      /* ignore */
    }
  }
  updateModelChipLabel();
}

/** @returns {SdkModelListItem} */
function fallbackModelListItem() {
  return { id: DEFAULT_MODEL_ID, displayName: 'Composer 2', description: '' };
}

async function initModels() {
  if (!window.cursorcats?.listModels) {
    modelsList = [fallbackModelListItem()];
    selectedModelId = DEFAULT_MODEL_ID;
    updateModelChipLabel();
    return;
  }
  try {
    const list = await window.cursorcats.listModels();
    if (Array.isArray(list) && list.length > 0) {
      modelsList = list;
    } else {
      modelsList = [fallbackModelListItem()];
    }
  } catch {
    modelsList = [fallbackModelListItem()];
  }
  let saved = null;
  if (window.cursorcats?.getSelectedModel) {
    try {
      saved = await window.cursorcats.getSelectedModel();
    } catch {
      saved = null;
    }
  }
  const savedId = saved && saved.id ? String(saved.id).trim() : '';
  if (savedId && modelsList.some((m) => m.id === savedId)) {
    selectedModelId = savedId;
  } else {
    selectedModelId = modelsList[0].id;
  }
  updateModelChipLabel();
  syncPromptHeight();
}

if (modelPicker) {
  modelPicker.addEventListener('click', (e) => {
    e.stopPropagation();
    if (modelMenuOpen) {
      closeModelMenu();
    } else {
      openModelMenu();
    }
  });
}

if (runtimeLocalBtn) {
  runtimeLocalBtn.addEventListener('click', () => {
    void selectRuntime('local');
  });
}

if (runtimeCloudBtn) {
  runtimeCloudBtn.addEventListener('click', () => {
    void selectRuntime('cloud');
  });
}

if (runtimeAgentsBtn) {
  runtimeAgentsBtn.addEventListener('click', () => {
    void selectRuntime('agents');
  });
}

if (createCatAgentToggle) {
  createCatAgentToggle.addEventListener('click', () => {
    if (selectedRuntime !== 'local') return;
    createCatAgentMode = !createCatAgentMode;
    if (!createCatAgentMode) {
      editingAgentId = null;
      if (catAgentNameInput) catAgentNameInput.value = '';
    }
    syncCatAgentControls();
    syncPromptHeight();
    (createCatAgentMode && catAgentNameInput ? catAgentNameInput : promptEl)?.focus();
  });
}

if (catAgentNameInput) {
  catAgentNameInput.addEventListener('input', () => {
    syncPromptHeight();
  });
  catAgentNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      promptEl?.focus();
    }
  });
}

if (cloudStartingRefInput) {
  cloudStartingRefInput.addEventListener('input', () => {
    syncPromptHeight();
  });
  cloudStartingRefInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
}

if (cloudRepoSearchInput) {
  cloudRepoSearchInput.addEventListener('input', () => {
    renderCloudRepositories();
  });
  cloudRepoSearchInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const first = filteredCloudRepositories()[0];
    if (first && first.url) {
      selectedCloudRepoUrl = first.url;
      syncCloudRepoDisplay();
      promptEl.focus();
    }
  });
}

if (apiKeyInput) {
  apiKeyInput.addEventListener('input', () => {
    syncPromptHeight();
  });
  apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  });
}

const apiKeyDashboardLink = document.getElementById('api-key-dashboard-link');
if (apiKeyDashboardLink) {
  apiKeyDashboardLink.addEventListener('click', () => {
    void window.cursorcats?.openExternalUrl?.('https://cursor.com/dashboard');
  });
}

function showApiKeySection() {
  if (!apiKeySection) return;
  apiKeySection.hidden = false;
  syncPromptHeight();
}

async function initApiKeySection() {
  if (!window.cursorcats?.hasCursorApiKey) {
    needsApiKey = true;
    showApiKeySection();
    return;
  }
  try {
    const status = await window.cursorcats.hasCursorApiKey();
    needsApiKey = !(status && status.configured);
    if (needsApiKey) {
      showApiKeySection();
    }
  } catch {
    needsApiKey = true;
    showApiKeySection();
  }
}

document.addEventListener(
  'mousedown',
  (e) => {
    const t = e.target;
    if (skillMenuOpen && skillMenu && promptEl && !promptEl.contains(t) && !skillMenu.contains(t)) {
      closeSkillMenu();
    }
    if (!modelMenuOpen || !modelPicker || !modelMenu) return;
    if (modelPicker.contains(t)) return;
    if (modelMenu.contains(t)) return;
    closeModelMenu();
  },
  true
);

btnChoose.addEventListener('click', () => {
  onChooseFolder();
});

if (btnCreateCat) {
  btnCreateCat.addEventListener('click', () => {
    submit();
  });
}

function syncPromptHeight() {
  if (!promptEl) return;
  promptEl.style.height = '1px';
  const sh = promptEl.scrollHeight;
  promptEl.style.height = `${sh}px`;
  pushContentHeight();
}

promptEl.addEventListener('input', () => {
  syncPromptHeight();
  updateSkillMenuFromPrompt();
});

promptEl.addEventListener('click', () => {
  updateSkillMenuFromPrompt();
});

promptEl.addEventListener('keyup', () => {
  updateSkillMenuFromPrompt();
});

window.addEventListener('resize', () => {
  syncPromptHeight();
});

promptEl.addEventListener('keydown', (e) => {
  if (skillMenuOpen && skillMenu) {
    const cursorPos = promptEl.selectionStart ?? promptEl.value.length;
    const token = getSlashToken(promptEl.value, cursorPos);
    const items = token ? filteredSkills(token.query) : [];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!items.length) return;
      skillHighlightIndex = (skillHighlightIndex + 1) % items.length;
      renderSkillMenu(items);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      skillHighlightIndex = (skillHighlightIndex - 1 + items.length) % items.length;
      renderSkillMenu(items);
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (items.length) {
        e.preventDefault();
        selectSkill(items[skillHighlightIndex] || items[0]);
        return;
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSkillMenu();
      return;
    }
  }

  if (e.key !== 'Enter') return;
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    insertNewlineAtCursor(promptEl);
    syncPromptHeight();
    updateSkillMenuFromPrompt();
    return;
  }
  e.preventDefault();
  submit();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (skillMenuOpen) {
      e.preventDefault();
      closeSkillMenu();
      return;
    }
    if (modelMenuOpen) {
      e.preventDefault();
      closeModelMenu();
      return;
    }
    e.preventDefault();
    cancel();
  } else if (e.key === 'o' && (e.metaKey || e.ctrlKey)) {
    if (selectedRuntime !== 'local') return;
    e.preventDefault();
    onChooseFolder();
  }
});

if (window.cursorcats?.onCatAgentsChanged) {
  window.cursorcats.onCatAgentsChanged(() => {
    if (selectedRuntime === 'agents') {
      void loadCatAgents();
    }
  });
}

const wrap = document.querySelector('.wrap');
const header = document.querySelector('.header');
const sectionTitle = document.querySelector('.section-title');
const listEls = Array.from(document.querySelectorAll('.list'));
const footer = document.querySelector('.footer');

function pushContentHeight() {
  // No-op: modal is now a static 500px height
}

if (typeof ResizeObserver !== 'undefined') {
  if (modelMenu) {
    const rom = new ResizeObserver(() => {
      if (modelMenuOpen) syncModelMenuWrapPadding();
    });
    rom.observe(modelMenu);
  }
}
window.addEventListener('load', () => {
  syncPromptHeight();
});

void (async () => {
  syncRuntimeDisplay();
  await Promise.all([loadRecentFolders(), initModels(), ensureSkillsLoaded(), initApiKeySection()]);
  if (window.cursorcats?.getSelectedRuntime) {
    try {
      const saved = await window.cursorcats.getSelectedRuntime();
      if (saved && saved.runtime) {
        selectedRuntime = normalizeRuntime(saved.runtime);
        syncRuntimeDisplay();
      }
    } catch {
      /* ignore */
    }
  }
  if (needsApiKey && apiKeyInput) {
    apiKeyInput.focus();
  } else {
    promptEl.focus();
  }
  syncPromptHeight();
})();
