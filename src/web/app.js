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
  }
};

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

function initFormEvents() {
  const apiTypeSelect = document.getElementById('api-type');
  const customApiGroup = document.getElementById('custom-api-group');
  apiTypeSelect.addEventListener('change', () => {
    customApiGroup.style.display = apiTypeSelect.value === 'custom' ? 'block' : 'none';
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

  // Save to Pi button
  document.getElementById('save-pi-btn').addEventListener('click', async () => {
    if (!state.generatedConfigs.pi) {
      showToast('No Pi configuration generated yet.');
      return;
    }
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          piConfig: state.generatedConfigs.pi,
          savePi: true
        })
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Saved to Pi config (${data.piSavedPath})`);
        initSystemStatus();
      } else {
        alert(`Error saving to Pi: ${data.error}`);
      }
    } catch (err) {
      alert(`Error saving to Pi: ${err.message}`);
    }
  });

  // Save to OpenCode button
  document.getElementById('save-opencode-btn').addEventListener('click', async () => {
    if (!state.generatedConfigs.opencode) {
      showToast('No OpenCode configuration generated yet.');
      return;
    }
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opencodeConfig: state.generatedConfigs.opencode,
          saveOpenCode: true
        })
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Saved to OpenCode config (${data.opencodeSavedPath})`);
        initSystemStatus();
      } else {
        alert(`Error saving to OpenCode: ${data.error}`);
      }
    } catch (err) {
      alert(`Error saving to OpenCode: ${err.message}`);
    }
  });
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
  document.getElementById('models-count-badge').textContent = `${modelsList.length} models`;

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
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.selectedModelIds.add(id);
      } else {
        state.selectedModelIds.delete(id);
      }
      reparseAndRenderOutput();
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

async function reparseAndRenderOutput() {
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
