const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cursorcats', {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getFrontmostWindowBounds: () => ipcRenderer.invoke('get-frontmost-window-bounds'),
  getFrontmostWindowInfo: () => ipcRenderer.invoke('get-frontmost-window-info'),
  readTextFile: (relPath) => ipcRenderer.invoke('read-text-file', relPath),
  getAssetFileUrl: (relPath) => ipcRenderer.invoke('get-asset-file-url', relPath),
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),
  getRecentFolders: () => ipcRenderer.invoke('get-recent-folders'),
  addRecentFolder: (folder) => ipcRenderer.invoke('add-recent-folder', folder),
  removeRecentFolder: (folder) => ipcRenderer.invoke('remove-recent-folder', folder),
  hasCursorApiKey: () => ipcRenderer.invoke('has-cursor-api-key'),
  saveCursorApiKey: (apiKey) => ipcRenderer.invoke('save-cursor-api-key', apiKey),
  listModels: () => ipcRenderer.invoke('list-models'),
  listSkills: (folder) => ipcRenderer.invoke('list-skills', folder),
  getSelectedModel: () => ipcRenderer.invoke('get-selected-model'),
  setSelectedModel: (modelId) => ipcRenderer.invoke('set-selected-model', modelId),
  listCloudRepositories: () => ipcRenderer.invoke('list-cloud-repositories'),
  getSelectedRuntime: () => ipcRenderer.invoke('get-selected-runtime'),
  setSelectedRuntime: (runtime) => ipcRenderer.invoke('set-selected-runtime', runtime),
  getSelectedCloudRepository: () => ipcRenderer.invoke('get-selected-cloud-repository'),
  setSelectedCloudRepository: (repo) => ipcRenderer.invoke('set-selected-cloud-repository', repo),
  submitNewCat: (payload) => ipcRenderer.send('new-cat-submit', payload),
  cancelNewCat: () => ipcRenderer.send('new-cat-cancel'),
  resizeModal: (height) => ipcRenderer.send('resize-modal', { height }),
  overlayReady: () => ipcRenderer.send('overlay-ready'),
  onSpawnCat: (callback) => {
    const listener = (_event, payload) => {
      try {
        callback(payload);
      } catch {
        // ignore
      }
    };
    ipcRenderer.on('spawn-cat', listener);
    return () => ipcRenderer.removeListener('spawn-cat', listener);
  },
  onAgentFinished: (callback) => {
    const listener = (_event, payload) => {
      try {
        callback(payload);
      } catch {
        // ignore
      }
    };
    ipcRenderer.on('agent-finished', listener);
    return () => ipcRenderer.removeListener('agent-finished', listener);
  },
  onAgentStreamBubble: (callback) => {
    const listener = (_event, payload) => {
      try {
        callback(payload);
      } catch {
        // ignore
      }
    };
    ipcRenderer.on('agent-stream-bubble', listener);
    return () => ipcRenderer.removeListener('agent-stream-bubble', listener);
  },
  postCatScreenRects: (rects) => {
    ipcRenderer.send('cat-screen-rects', rects);
  },
  openCatConversation: (catId) => {
    ipcRenderer.send('open-cat-conversation', { catId });
  },
  getAgentConversation: (catId) => ipcRenderer.invoke('get-agent-conversation', catId),
  revertCat: (catId) => ipcRenderer.invoke('revert-cat-changes', { catId }),
  commitPushCat: (catId) => ipcRenderer.invoke('commit-push-cat-changes', { catId }),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  onConversationUpdated: (callback) => {
    const listener = (_event, payload) => {
      try {
        callback(payload);
      } catch {
        // ignore
      }
    };
    ipcRenderer.on('conversation-updated', listener);
    return () => ipcRenderer.removeListener('conversation-updated', listener);
  },
  closeConversationWindow: () => {
    ipcRenderer.send('close-conversation-window');
  },
  dismissCat: (catId) => {
    ipcRenderer.send('dismiss-cat', { catId });
  },
  sendFollowup: (catId, text) => {
    ipcRenderer.send('agent-followup', { catId, text });
  },
  onAgentRestarted: (callback) => {
    const listener = (_event, payload) => {
      try {
        callback(payload);
      } catch {
        // ignore
      }
    };
    ipcRenderer.on('agent-restarted', listener);
    return () => ipcRenderer.removeListener('agent-restarted', listener);
  },
  onRemoveCat: (callback) => {
    const listener = (_event, payload) => {
      try {
        callback(payload);
      } catch {
        // ignore
      }
    };
    ipcRenderer.on('remove-cat', listener);
    return () => ipcRenderer.removeListener('remove-cat', listener);
  },
  reportCatCounts: (counts) => {
    ipcRenderer.send('cat-counts', counts);
  },
  listCatAgents: () => ipcRenderer.invoke('cat-agent:list'),
  deleteCatAgent: (agentId) => ipcRenderer.invoke('cat-agent:delete', agentId),
  setCatAgentEnabled: (agentId, enabled) =>
    ipcRenderer.invoke('cat-agent:set-enabled', { agentId, enabled }),
  runCatAgentNow: (agentId) => ipcRenderer.invoke('cat-agent:run-now', agentId),
  updateCatAgent: (payload) => ipcRenderer.invoke('cat-agent:update', payload),
  onCatAgentsChanged: (callback) => {
    const listener = (_event, payload) => {
      try {
        callback(payload);
      } catch {
        /* ignore */
      }
    };
    ipcRenderer.on('cat-agents-changed', listener);
    return () => ipcRenderer.removeListener('cat-agents-changed', listener);
  },
  onClearFinishedCats: (callback) => {
    const listener = () => {
      try {
        callback();
      } catch {
        // ignore
      }
    };
    ipcRenderer.on('clear-finished-cats', listener);
    return () => ipcRenderer.removeListener('clear-finished-cats', listener);
  },
});
