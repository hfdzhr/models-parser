<template>
  <div class="app-wrapper">
    <!-- Header -->
    <header class="app-header">
      <div class="header-left">
        <div class="logo-icon">C</div>
        <div>
          <h1>Config Models Parser</h1>
          <p class="subtitle">Fetch, parse, and generate configs for Pi Coding Agent and OpenCode</p>
        </div>
      </div>
      <div class="header-right" id="system-status">
        <div class="status-badge" :class="{ active: piStatusActive }" :title="piStatusTitle">
          <span class="dot" />
          Pi: <span class="status-text">{{ piStatusText }}</span>
        </div>
        <div class="status-badge" :class="{ active: opencodeStatusActive }" :title="opencodeStatusTitle">
          <span class="dot" />
          OpenCode: <span class="status-text">{{ opencodeStatusText }}</span>
        </div>
      </div>
    </header>

    <main class="container">
      <!-- Command Strip -->
      <section class="command-strip">
        <form id="fetch-form" autocomplete="off" spellcheck="false" @submit.prevent="handleFetchModels">
          <span class="cmd-prompt" aria-hidden="true">$</span>

          <span class="cmd-field">
            <label for="profile-select">profile</label>
            <select id="profile-select" v-model="selectedProfileName" class="btn-ghost" @change="applySelectedProfile">
              <option value="">none</option>
              <option v-for="p in profiles" :key="p.name" :value="p.name">{{ p.name }}</option>
            </select>
          </span>

          <span class="cmd-field">
            <label for="provider-id">provider</label>
            <input id="provider-id" v-model="form.providerId" type="text" placeholder="e.g. sabah-ai" required @input="debouncedReparse">
          </span>

          <span class="cmd-field">
            <label for="api-type">api</label>
            <select id="api-type" v-model="form.apiType" @change="onApiTypeChange">
              <option value="openai-completions">openai-completions</option>
              <option value="anthropic-messages">anthropic-messages</option>
              <option value="google-generative-ai">google-generative-ai</option>
              <option value="custom">Custom...</option>
            </select>
          </span>

          <span v-if="form.apiType === 'custom'" class="cmd-field">
            <label for="custom-api">custom</label>
            <input id="custom-api" v-model="form.customApi" type="text" placeholder="custom api identifier" @input="debouncedReparse">
          </span>

          <span class="cmd-field grow">
            <label for="base-url">base-url</label>
            <input id="base-url" v-model="form.baseUrl" type="url" placeholder="https://host/v1" required title="/models will automatically be queried" @input="debouncedReparse">
          </span>

          <span class="cmd-field">
            <label for="api-key">key</label>
            <span class="password-wrap">
              <input id="api-key" v-model="form.apiKey" :type="showApiKey ? 'text' : 'password'" placeholder="sk-..." @input="debouncedReparse">
              <button type="button" class="btn-ghost btn-xs" @click="showApiKey = !showApiKey">
                {{ showApiKey ? 'Hide' : 'Show' }}
              </button>
            </span>
          </span>

          <button type="submit" class="cmd-run" :disabled="fetching">
            {{ fetching ? 'Fetching...' : 'Fetch Models' }}
          </button>
          <button type="button" class="btn-ghost btn-xs" @click="pasteModalOpen = true">Paste JSON</button>
          <button type="button" class="btn-ghost btn-xs" @click="loadSampleData">Load Example</button>

          <span class="cmd-count">{{ rawModels.length }} models · {{ selectedModelIds.size }} selected</span>
        </form>
      </section>

      <div class="deck">
        <!-- Models Panel -->
        <section class="panel models-panel" id="models-card">
          <div class="panel-header models-header">
            <h3 class="panel-title">Models</h3>
            <span class="badge" id="models-count-badge">{{ rawModels.length }} models</span>
            <input v-model="searchQuery" type="search" id="model-search" placeholder="search name or id..." aria-label="Filter models by name or id">
            <div class="selection-controls">
              <button type="button" class="btn-ghost btn-xs" @click="selectAll">Select All</button>
              <button type="button" class="btn-ghost btn-xs" @click="deselectAll">Clear</button>
            </div>
          </div>
          <div class="models-list" id="models-list-container">
            <div v-if="rawModels.length === 0" class="models-hint">// no models yet — Fetch, Paste JSON, or Load Example</div>
            <div
              v-for="m in filteredModels"
              :key="m.id || m.name"
              class="model-item"
              :class="{ selected: selectedModelIds.has(m.id || m.name) }"
              @click="toggleModel(m)"
            >
              <input
                type="checkbox"
                class="model-checkbox"
                :checked="selectedModelIds.has(m.id || m.name)"
                @click.stop
                @change="toggleModel(m)"
              >
              <div class="model-info">
                <span class="model-name">{{ m.name || m.id }}</span>
                <span class="model-id">{{ m.id }}</span>
              </div>
              <div class="model-tags">
                <span class="tag tag-cw">{{ formatCtx(m) }}</span>
                <span v-if="hasVision(m)" class="tag tag-vision">Vision</span>
                <span v-if="hasReasoning(m)" class="tag tag-reasoning">Reasoning</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Editor Panel -->
        <section class="panel editor-panel">
          <div class="panel-header editor-header">
            <div class="tabs">
              <button
                v-for="tab in tabs"
                :key="tab.key"
                class="tab-btn"
                :class="{ active: activeTab === tab.key }"
                @click="activeTab = tab.key; renderJson()"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>

          <div class="editor-container">
            <pre><code id="json-output">{{ jsonOutput }}</code></pre>
          </div>

          <div class="editor-foot">
            <span class="editor-stats">{{ selectedModelIds.size }} SELECTED · {{ rawModels.length }} MODELS</span>
            <div class="editor-actions">
              <button class="btn-ghost btn-xs" @click="copyJson">Copy</button>
              <button class="btn-ghost btn-xs" @click="downloadJson">Download</button>
              <button class="btn-acid" title="Merge into ~/.pi/agent/models.json" @click="saveConfig('pi')">Save → Pi</button>
              <button class="btn-acid" title="Merge into ~/.config/opencode/opencode.json" @click="saveConfig('opencode')">Save → OpenCode</button>
            </div>
          </div>
        </section>
      </div>
    </main>

    <!-- Paste JSON Modal -->
    <div v-if="pasteModalOpen" class="modal-backdrop" @click.self="pasteModalOpen = false">
      <div class="modal-box">
        <div class="modal-header">
          <h3>Paste Raw Models Response JSON</h3>
          <button class="btn-close" @click="pasteModalOpen = false">&times;</button>
        </div>
        <div class="modal-body">
          <textarea v-model="pasteRawJson" placeholder='Paste {"object":"list","data":[...]} here...' rows="14" />
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="pasteModalOpen = false">Cancel</button>
          <button class="btn-acid" @click="applyPastedJson">Parse Models</button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div class="toast" :class="{ show: toastVisible }">{{ toastMessage }}</div>
  </div>
</template>

<script setup>
// ─── Sample data ──────────────────────────────────────────────────────────────
const SAMPLE_RESPONSE = {
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
}

const BUILTIN_API_TYPES = ['openai-completions', 'anthropic-messages', 'google-generative-ai']

// ─── State ────────────────────────────────────────────────────────────────────
const rawModels = ref([])
const selectedModelIds = ref(new Set())
const activeTab = ref('pi')
const generatedConfigs = ref({ pi: null, opencode: null })
const profiles = ref([])
const systemStatus = ref({ cloud: false, pi: null, opencode: null })

const form = reactive({
  providerId: 'sabah-ai',
  baseUrl: 'https://vibing.softyan.net/v1',
  apiKey: '',
  apiType: 'openai-completions',
  customApi: ''
})

const showApiKey = ref(false)
const fetching = ref(false)
const searchQuery = ref('')
const pasteModalOpen = ref(false)
const pasteRawJson = ref('')
const selectedProfileName = ref('')
const jsonOutput = ref('// Configure provider settings and click "Fetch Models" or "Load Example" to generate config')

const tabs = [
  { key: 'pi', label: 'models.json' },
  { key: 'opencode', label: 'opencode.json' },
  { key: 'both', label: 'both' }
]

// ─── Toast ────────────────────────────────────────────────────────────────────
const toastMessage = ref('')
const toastVisible = ref(false)
let toastTimer = null

function showToast(msg) {
  toastMessage.value = msg
  toastVisible.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastVisible.value = false }, 3200)
}

// ─── System status ─────────────────────────────────────────────────────────── 
const piStatusActive = computed(() => systemStatus.value.cloud || systemStatus.value.pi?.exists)
const piStatusText = computed(() => {
  if (systemStatus.value.cloud) return 'Cloud'
  if (systemStatus.value.pi?.exists) return 'Detected'
  return 'Not found'
})
const piStatusTitle = computed(() => systemStatus.value.cloud ? 'Running on Vercel: use Copy or Download to save configs' : (systemStatus.value.pi?.path ?? ''))

const opencodeStatusActive = computed(() => systemStatus.value.cloud || systemStatus.value.opencode?.exists)
const opencodeStatusText = computed(() => {
  if (systemStatus.value.cloud) return 'Cloud'
  if (systemStatus.value.opencode?.exists) return 'Detected'
  return 'Not found'
})
const opencodeStatusTitle = computed(() => systemStatus.value.cloud ? 'Running on Vercel: use Copy or Download to save configs' : (systemStatus.value.opencode?.path ?? ''))

async function fetchSystemStatus() {
  try {
    const data = await $fetch('/api/status')
    systemStatus.value = data
  } catch (e) {
    console.warn('Could not query system status:', e)
  }
}

// ─── Profiles ─────────────────────────────────────────────────────────────────
async function fetchProfiles(selectName = null) {
  try {
    const data = await $fetch('/api/profiles')
    profiles.value = Array.isArray(data.profiles) ? data.profiles : []
    if (selectName && profiles.value.some(p => p.name === selectName)) {
      selectedProfileName.value = selectName
    }
  } catch (e) {
    console.warn('Could not load profiles:', e)
  }
}

function applySelectedProfile() {
  const profile = profiles.value.find(p => p.name === selectedProfileName.value)
  if (!profile) return
  form.providerId = profile.providerId || profile.name
  form.baseUrl = profile.baseUrl || ''
  form.apiKey = profile.apiKey || ''
  if (BUILTIN_API_TYPES.includes(profile.api)) {
    form.apiType = profile.api
  } else {
    form.apiType = 'custom'
    form.customApi = profile.api || ''
  }
  if (rawModels.value.length > 0) reparseAndRender()
}

// ─── Models helpers ───────────────────────────────────────────────────────────
const filteredModels = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return rawModels.value
  return rawModels.value.filter(m => {
    const id = (m.id || '').toLowerCase()
    const name = (m.name || '').toLowerCase()
    return id.includes(q) || name.includes(q)
  })
})

function hasVision(m) {
  return m.capabilities?.vision || (m.input_modalities && m.input_modalities.includes('image'))
}

function hasReasoning(m) {
  const id = m.id || ''
  return m.capabilities?.reasoning || id.includes('reasoning') || id.includes('thinking')
}

function formatCtx(m) {
  const cw = m.context_length || m.context_window || 1048576
  return cw >= 1000000 ? `${(cw / 1000000).toFixed(1)}M ctx` : `${Math.round(cw / 1000)}k ctx`
}

function toggleModel(m) {
  const id = m.id || m.name
  const set = new Set(selectedModelIds.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  selectedModelIds.value = set
  reparseAndRender()
}

function selectAll() {
  selectedModelIds.value = new Set(rawModels.value.map(m => m.id || m.name))
  reparseAndRender()
}

function deselectAll() {
  selectedModelIds.value = new Set()
  reparseAndRender()
}

function loadModelsIntoState(list) {
  rawModels.value = list
  selectedModelIds.value = new Set(list.map(m => m.id || m.name))
  reparseAndRender()
}

// ─── API Type change ──────────────────────────────────────────────────────────
function onApiTypeChange() {
  if (rawModels.value.length > 0) reparseAndRender()
}

// ─── Fetch models ─────────────────────────────────────────────────────────────
async function handleFetchModels() {
  fetching.value = true
  try {
    const data = await $fetch('/api/fetch', {
      method: 'POST',
      body: { baseUrl: form.baseUrl, apiKey: form.apiKey }
    })
    loadModelsIntoState(data.models)
    showToast(`Fetched ${data.count} models from ${data.url}!`)
  } catch (err) {
    alert(`Failed to fetch models:\n${err.data?.statusMessage || err.message}`)
  } finally {
    fetching.value = false
  }
}

// ─── Load example data ────────────────────────────────────────────────────────
function loadSampleData() {
  form.providerId = 'sabah-ai'
  form.baseUrl = 'https://vibing.softyan.net/v1'
  form.apiKey = 'sk-6b8d16c81d863312-d37acc-47f9ce40'
  form.apiType = 'openai-completions'
  loadModelsIntoState(SAMPLE_RESPONSE.data)
  showToast('Loaded Sabah-AI example data!')
}

// ─── Parse & render JSON ──────────────────────────────────────────────────────
let reparseTimer = null
function debouncedReparse() {
  clearTimeout(reparseTimer)
  reparseTimer = setTimeout(() => reparseAndRender(), 300)
}

async function reparseAndRender() {
  if (rawModels.value.length === 0) return
  const api = form.apiType === 'custom' ? (form.customApi || 'openai-completions') : form.apiType
  try {
    const data = await $fetch('/api/parse', {
      method: 'POST',
      body: {
        providerId: form.providerId || 'custom-provider',
        baseUrl: form.baseUrl,
        api,
        apiKey: form.apiKey,
        models: rawModels.value,
        selectedModelIds: Array.from(selectedModelIds.value)
      }
    })
    if (data.ok) {
      generatedConfigs.value = { pi: data.piConfig, opencode: data.opencodeConfig }
      renderJson()
    }
  } catch (e) {
    console.error('Reparse error:', e)
  }
}

function renderJson() {
  const { pi, opencode } = generatedConfigs.value
  if (!pi && !opencode) {
    jsonOutput.value = '// No config generated yet'
    return
  }
  if (activeTab.value === 'pi') jsonOutput.value = JSON.stringify(pi, null, 2)
  else if (activeTab.value === 'opencode') jsonOutput.value = JSON.stringify(opencode, null, 2)
  else jsonOutput.value = JSON.stringify({ pi, opencode }, null, 2)
}

// ─── Copy / Download ──────────────────────────────────────────────────────────
function copyJson() {
  navigator.clipboard.writeText(jsonOutput.value).then(() => showToast('JSON copied to clipboard!'))
}

function downloadJson() {
  const filename = activeTab.value === 'opencode' ? 'opencode.json' : 'models.json'
  const blob = new Blob([jsonOutput.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
  showToast(`Downloaded ${filename}!`)
}

// ─── Save config ──────────────────────────────────────────────────────────────
function deriveSavedProfileName(config) {
  if (config?.providers && typeof config.providers === 'object') {
    const keys = Object.keys(config.providers)
    if (keys.length > 0) return keys[0]
  }
  if (config?.provider && typeof config.provider === 'object') {
    const keys = Object.keys(config.provider)
    if (keys.length > 0) return keys[0]
  }
  return null
}

async function saveConfig(key) {
  const config = generatedConfigs.value[key]
  if (!config) { showToast(`No ${key === 'pi' ? 'Pi' : 'OpenCode'} config generated yet.`); return }
  const body = key === 'pi'
    ? { piConfig: config, savePi: true }
    : { opencodeConfig: config, saveOpenCode: true }
  try {
    const data = await $fetch('/api/save', { method: 'POST', body })
    if (data.ok) {
      const savedPath = data.piSavedPath || data.opencodeSavedPath
      showToast(`Saved to ${key === 'pi' ? 'Pi' : 'OpenCode'} config (${savedPath})`)
      await fetchSystemStatus()
      await fetchProfiles(deriveSavedProfileName(config))
    }
  } catch (err) {
    alert(`Error saving: ${err.data?.statusMessage || err.message}`)
  }
}

// ─── Paste JSON modal ─────────────────────────────────────────────────────────
function applyPastedJson() {
  const val = pasteRawJson.value.trim()
  if (!val) { alert('Please paste JSON content first.'); return }
  try {
    const parsed = JSON.parse(val)
    const list = Array.isArray(parsed) ? parsed : (parsed.data || parsed.models || [])
    if (list.length === 0) { alert('Could not find models array in pasted JSON.'); return }
    loadModelsIntoState(list)
    pasteModalOpen.value = false
    pasteRawJson.value = ''
    showToast(`Parsed ${list.length} models successfully!`)
  } catch (err) {
    alert(`Invalid JSON: ${err.message}`)
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await fetchSystemStatus()
  await fetchProfiles()
})
</script>
