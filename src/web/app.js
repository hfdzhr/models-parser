const state = {
  rawModels: [],
  selectedModelIds: new Set(),
  activeTab: 'pi',
  generatedConfigs: {
    pi: null,
    opencode: null
  },
  systemStatus: {
    pi: false,
    opencode: false
  },
  profiles: []
};

const BUILTIN_API_TYPES = ['openai-completions', 'anthropic-messages', 'google-generative-ai'];

const SAMPLE_RESPONSE = {
  object: 'list',
  data: [
    { id: 'gs/ag/gemini-3.8-flash-high', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3.8-flash-high' },
    { id: 'gs/ag/gemini-3.8-flash-medium', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3.8-flash-medium' },
    { id: 'gs/ag/gemini-3.8-flash-low', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3.8-flash-low' },
    { id: 'gs/ag/gemini-3.8-flash', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3.8-flash' },
    { id: 'gs/ag/gemini-3.7-flash-high', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3.7-flash-high' },
    { id: 'gs/ag/gemini-3.7-flash-medium', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3.7-flash-medium' },
    { id: 'gs/ag/gemini-3.7-flash-low', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3.7-flash-low' },
    { id: 'gs/ag/gemini-3.6-flash-high', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3.6-flash-high' },
    { id: 'gs/ag/gemini-3.6-flash-medium', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3.6-flash-medium' },
    { id: 'gs/ag/gemini-3.6-flash-low', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3.6-flash-low' },
    { id: 'gs/ag/gemini-3.5-flash-high', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3.5-flash-high' },
    { id: 'gs/ag/gemini-3-flash-agent', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3-flash-agent' },
    { id: 'gs/ag/gemini-3.5-flash-low', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3.5-flash-low' },
    { id: 'gs/ag/gemini-3.5-flash-extra-low', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3.5-flash-extra-low' },
    { id: 'gs/ag/gemini-pro-agent', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-pro-agent' },
    { id: 'gs/ag/gemini-3.1-pro-low', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3.1-pro-low' },
    { id: 'gs/ag/gemini-3-flash', context_length: 1048576, capabilities: { vision: true, tool_calling: true, reasoning: true }, input_modalities: ['text', 'image'], name: 'ag/gemini-3-flash' }
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  initSystemStatus();
  initProfileSelect();
  initFormEvents();
  initModalEvents();
  initOutputEvents();
});

async function initSystemStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    const piBadge = document.getElementById('pi-status');
    const opencodeBadge = document.getElementById('opencode-status');

    if (data.pi?.exists) {
      piBadge.classList.add('active');
      piBadge.querySelector('.status-text').textContent = 'Detected';
      piBadge.title = data.pi.path;
    } else {
      piBadge.querySelector('.status-text').textContent = 'Not found';
    }

    if (data.opencode?.exists) {
      opencodeBadge.classList.add('active');
      opencodeBadge.querySelector('.status-text').textContent = 'Detected';
      opencodeBadge.title = data.opencode.path;
    } else {
      opencodeBadge.querySelector('.status-text').textContent = 'Not found';
    }
  } catch (err) {
    console.warn('Could not query system status:', err);
  }
}

async function refreshProfileSelect(selectedName = null) {
  try {
    const res = await fetch('/api/profiles');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    state.profiles = Array.isArray(data.profiles) ? data.profiles : [];
    populateProfileSelect(selectedName);
  } catch (err) {
    console.warn('Could not load provider profiles:', err);
  }
}

async function initProfileSelect() {
  await refreshProfileSelect();
}

function populateProfileSelect(selectedName = null) {
  const select = document.getElementById('profile-select');
  const keepValue = selectedName !== null ? selectedName : select.value;

  select.innerHTML = '';
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = 'none';
  select.appendChild(emptyOption);

  for (const profile of state.profiles) {
    if (!profile?.name) continue;
    const option = document.createElement('option');
    option.value = profile.name;
    option.textContent = profile.name;
    select.appendChild(option);
  }

  if (keepValue && state.profiles.some((p) => p?.name === keepValue)) {
    select.value = keepValue;
  }
}

function applySelectedProfile() {
  const select = document.getElementById('profile-select');
  if (!select.value) return;

  const profile = state.profiles.find((p) => p?.name === select.value);
  if (!profile) return;

  applyProfileToForm(profile);
}

function applyProfileToForm(profile) {
  document.getElementById('provider-id').value = profile.providerId || profile.name;

  const apiTypeSelect = document.getElementById('api-type');
  const customApiGroup = document.getElementById('custom-api-group');
  const customApiInput = document.getElementById('custom-api');
  if (BUILTIN_API_TYPES.includes(profile.api)) {
    apiTypeSelect.value = profile.api;
    customApiGroup.style.display = 'none';
  } else {
    apiTypeSelect.value = 'custom';
    customApiInput.value = profile.api || '';
    customApiGroup.style.display = '';
  }

  document.getElementById('base-url').value = profile.baseUrl || '';
  document.getElementById('api-key').value = profile.apiKey || '';

  if (state.rawModels.length > 0) reparseAndRenderOutput();
}

/**
 * Name of the profile a successful save will have upserted: the first
 * provider entry of the config being saved.
 *
 * NOTE: this mirrors the server-side deriveSavedProfile contract on
 * purpose — src/web/app.js runs as a classic browser script and cannot
 * import the node-side profiles helpers, so keep both in sync manually.
 */
function deriveSavedProfileName(config) {
  if (config?.providers && typeof config.providers === 'object') {
    const keys = Object.keys(config.providers);
    if (keys.length > 0) return keys[0];
  }
  if (config?.provider && typeof config.provider === 'object') {
    const keys = Object.keys(config.provider);
    if (keys.length > 0) return keys[0];
  }
  return null;
}

function initFormEvents() {
  const apiTypeSelect = document.getElementById('api-type');
  const customApiGroup = document.getElementById('custom-api-group');
  apiTypeSelect.addEventListener('change', () => {
    customApiGroup.style.display = apiTypeSelect.value === 'custom' ? '' : 'none';
    if (state.rawModels.length > 0) reparseAndRenderOutput();
  });

  const toggleKeyBtn = document.getElementById('toggle-key-btn');
  const apiKeyInput = document.getElementById('api-key');
  toggleKeyBtn.addEventListener('click', () => {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('provider-id').addEventListener('input', () => {
    if (state.rawModels.length > 0) reparseAndRenderOutput();
  });

  document.getElementById('base-url').addEventListener('input', () => {
    if (state.rawModels.length > 0) reparseAndRenderOutput();
  });

  document.getElementById('api-key').addEventListener('input', () => {
    if (state.rawModels.length > 0) reparseAndRenderOutput();
  });

  // Profile dropdown: prefill the provider fields from the saved profile.
  document.getElementById('profile-select').addEventListener('change', () => {
    applySelectedProfile();
  });

  // Fetch form submit
  document.getElementById('fetch-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleFetchModels();
  });

  // Load sample button
  document.getElementById('load-sample-btn').addEventListener('click', () => {
    document.getElementById('provider-id').value = 'sabah-ai';
    document.getElementById('base-url').value = 'https://vibing.softyan.net/v1';
    document.getElementById('api-key').value = 'sk-6b8d16c81d863312-d37acc-47f9ce40';
    document.getElementById('api-type').value = 'openai-completions';
    loadModelsIntoState(SAMPLE_RESPONSE.data);
    showToast('Loaded Sabah-AI example data!');
  });
}

function initModalEvents() {
  const pasteBtn = document.getElementById('paste-json-btn');
  const modal = document.getElementById('paste-modal');
  const closeBtn = document.getElementById('close-modal-btn');
  const cancelBtn = document.getElementById('cancel-modal-btn');
  const applyBtn = document.getElementById('apply-pasted-json-btn');
  const textarea = document.getElementById('raw-json-input');

  const openModal = () => {
    modal.style.display = 'flex';
    textarea.focus();
  };
  const closeModal = () => {
    modal.style.display = 'none';
  };

  pasteBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  applyBtn.addEventListener('click', () => {
    const val = textarea.value.trim();
    if (!val) {
      alert('Please paste JSON content first.');
      return;
    }
    try {
      const parsed = JSON.parse(val);
      const list = Array.isArray(parsed) ? parsed : (parsed.data || parsed.models || []);
      if (list.length === 0) {
        alert('Could not find models array in pasted JSON.');
        return;
      }
      loadModelsIntoState(list);
      closeModal();
      showToast(`Parsed ${list.length} models successfully!`);
    } catch (err) {
      alert(`Invalid JSON: ${err.message}`);
    }
  });
}

function initOutputEvents() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTab = btn.dataset.tab;
      renderActiveTabJson();
    });
  });

  // Model search filter
  document.getElementById('model-search').addEventListener('input', (e) => {
    filterModelsList(e.target.value);
  });

  // Select all / Deselect all
  document.getElementById('select-all-btn').addEventListener('click', () => {
    state.rawModels.forEach((m) => state.selectedModelIds.add(m.id || m.name));
    updateModelCheckboxes();
    reparseAndRenderOutput();
  });

  document.getElementById('deselect-all-btn').addEventListener('click', () => {
    state.selectedModelIds.clear();
    updateModelCheckboxes();
    reparseAndRenderOutput();
  });

  // Copy button
  document.getElementById('copy-btn').addEventListener('click', () => {
    const code = document.getElementById('json-output').textContent;
    navigator.clipboard.writeText(code).then(() => {
      showToast('JSON copied to clipboard!');
    });
  });

  // Download button
  document.getElementById('download-btn').addEventListener('click', () => {
    const code = document.getElementById('json-output').textContent;
    const filename = state.activeTab === 'opencode' ? 'opencode.json' : 'models.json';
    const blob = new Blob([code], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}!`);
  });

  // Save actions: both targets share one POST /api/save flow
  document.getElementById('save-pi-btn').addEventListener('click', () => {
    saveGeneratedConfig('pi', 'piSavedPath', 'Pi');
  });

  document.getElementById('save-opencode-btn').addEventListener('click', () => {
    saveGeneratedConfig('opencode', 'opencodeSavedPath', 'OpenCode');
  });
}

async function saveGeneratedConfig(configKey, savedPathKey, label) {
  const config = state.generatedConfigs[configKey];
  if (!config) {
    showToast(`No ${label} configuration generated yet.`);
    return;
  }

  const body = configKey === 'pi'
    ? { piConfig: config, savePi: true }
    : { opencodeConfig: config, saveOpenCode: true };

  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.ok) {
      showToast(`Saved to ${label} config (${data[savedPathKey]})`);
      initSystemStatus();
      // A successful save upserts a provider profile server-side; reload
      // the dropdown and preselect the entry this save produced.
      await refreshProfileSelect(deriveSavedProfileName(config));
    } else {
      alert(`Error saving to ${label}: ${data.error}`);
    }
  } catch (err) {
    alert(`Error saving to ${label}: ${err.message}`);
  }
}

async function handleFetchModels() {
  const baseUrl = document.getElementById('base-url').value.trim();
  const apiKey = document.getElementById('api-key').value.trim();
  const fetchBtn = document.getElementById('fetch-btn');

  fetchBtn.disabled = true;
  fetchBtn.innerHTML = 'Fetching...';

  try {
    const res = await fetch('/api/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl, apiKey })
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    loadModelsIntoState(data.models);
    showToast(`Fetched ${data.count} models from ${data.url}!`);
  } catch (err) {
    alert(`Failed to fetch models:\n${err.message}`);
  } finally {
    fetchBtn.disabled = false;
    fetchBtn.innerHTML = 'Fetch Models';
  }
}

function loadModelsIntoState(modelsList) {
  state.rawModels = modelsList;
  state.selectedModelIds = new Set(modelsList.map((m) => m.id || m.name));

  document.getElementById('models-card').style.display = 'flex';
  updateStats();

  renderModelsList(modelsList);
  reparseAndRenderOutput();
}

function renderModelsList(models) {
  const container = document.getElementById('models-list-container');
  container.innerHTML = '';

  models.forEach((m) => {
    const id = m.id || m.name;
    const isChecked = state.selectedModelIds.has(id);
    const item = document.createElement('div');
    item.className = 'model-item';
    item.dataset.id = id;

    const hasVision = m.capabilities?.vision || (m.input_modalities && m.input_modalities.includes('image'));
    const hasReasoning = m.capabilities?.reasoning || (id.includes('reasoning') || id.includes('thinking'));
    const cw = m.context_length || m.context_window || 1048576;
    const formattedCw = cw >= 1000000 ? `${(cw / 1000000).toFixed(1)}M` : `${Math.round(cw / 1000)}k`;

    item.innerHTML = `
      <input type="checkbox" class="model-checkbox" ${isChecked ? 'checked' : ''} data-id="${id}">
      <div class="model-info">
        <span class="model-name">${m.name || id}</span>
        <span class="model-id">${id}</span>
      </div>
      <div class="model-tags">
        <span class="tag tag-cw">${formattedCw} ctx</span>
        ${hasVision ? '<span class="tag tag-vision">Vision</span>' : ''}
        ${hasReasoning ? '<span class="tag tag-reasoning">Reasoning</span>' : ''}
      </div>
    `;

    const checkbox = item.querySelector('.model-checkbox');
    const toggleSelection = () => {
      if (checkbox.checked) {
        state.selectedModelIds.add(id);
      } else {
        state.selectedModelIds.delete(id);
      }
      reparseAndRenderOutput();
    };
    checkbox.addEventListener('change', toggleSelection);

    // Clicking anywhere on the row toggles its checkbox (command-deck rows are dense).
    item.addEventListener('click', (e) => {
      if (e.target === checkbox) return; // the checkbox toggles itself
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    });

    container.appendChild(item);
  });
}

function updateModelCheckboxes() {
  document.querySelectorAll('.model-checkbox').forEach((cb) => {
    cb.checked = state.selectedModelIds.has(cb.dataset.id);
  });
}

function filterModelsList(query) {
  const q = query.toLowerCase().trim();
  document.querySelectorAll('.model-item').forEach((el) => {
    const id = el.dataset.id.toLowerCase();
    const nameEl = el.querySelector('.model-name');
    const name = nameEl ? nameEl.textContent.toLowerCase() : '';
    if (!q || id.includes(q) || name.includes(q)) {
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  });
}

function updateStats() {
  const total = state.rawModels.length;
  const selected = state.selectedModelIds.size;
  const badge = document.getElementById('models-count-badge');
  const cmdCount = document.getElementById('cmd-count');
  const stats = document.getElementById('editor-stats');
  if (badge) badge.textContent = `${total} models`;
  if (cmdCount) cmdCount.textContent = `${total} models · ${selected} selected`;
  if (stats) stats.textContent = `${selected} SELECTED · ${total} MODELS`;
}

async function reparseAndRenderOutput() {
  updateStats();

  const providerId = document.getElementById('provider-id').value.trim() || 'custom-provider';
  const baseUrl = document.getElementById('base-url').value.trim();
  const apiKey = document.getElementById('api-key').value.trim();
  const apiTypeSelect = document.getElementById('api-type').value;
  const customApi = document.getElementById('custom-api').value.trim();
  const api = apiTypeSelect === 'custom' ? (customApi || 'openai-completions') : apiTypeSelect;

  try {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId,
        baseUrl,
        api,
        apiKey,
        models: state.rawModels,
        selectedModelIds: Array.from(state.selectedModelIds)
      })
    });

    const data = await res.json();
    if (data.ok) {
      state.generatedConfigs.pi = data.piConfig;
      state.generatedConfigs.opencode = data.opencodeConfig;
      renderActiveTabJson();
    }
  } catch (err) {
    console.error('Reparse error:', err);
  }
}

function renderActiveTabJson() {
  const pre = document.getElementById('json-output');
  let outputData = null;

  if (state.activeTab === 'pi') {
    outputData = state.generatedConfigs.pi;
  } else if (state.activeTab === 'opencode') {
    outputData = state.generatedConfigs.opencode;
  } else {
    outputData = {
      pi: state.generatedConfigs.pi,
      opencode: state.generatedConfigs.opencode
    };
  }

  if (outputData) {
    pre.textContent = JSON.stringify(outputData, null, 2);
  } else {
    pre.textContent = '// No config generated yet';
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}
