import { formatModelName, formatProviderName } from './formatter.js';

/**
 * Extract raw array of model objects from various API response shapes
 */
export function extractModelsList(response) {
  if (!response) return [];

  let data = response;
  if (typeof response === 'string') {
    try {
      data = JSON.parse(response);
    } catch (e) {
      throw new Error(`Failed to parse response JSON: ${e.message}`);
    }
  }

  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.data)) {
    return data.data;
  }

  if (data && Array.isArray(data.models)) {
    return data.models;
  }

  if (data && Array.isArray(data.items)) {
    return data.items;
  }

  return [];
}

/**
 * Normalize and parse a single model into a unified structure
 */
export function parseModel(rawModel, options = {}) {
  const { providerApi = 'openai-completions' } = options;
  if (!rawModel) return null;

  const id = rawModel.id || rawModel.name || '';
  const name = formatModelName(id, rawModel.name);

  // Context window calculation
  const contextWindow =
    rawModel.context_length ||
    rawModel.context_window ||
    rawModel.max_context_length ||
    rawModel.limit?.context ||
    1048576;

  // Max output tokens
  const maxTokens =
    rawModel.max_output_tokens ||
    rawModel.max_tokens ||
    rawModel.limit?.output ||
    null;

  // Input modalities
  let input = ['text'];
  if (Array.isArray(rawModel.input_modalities)) {
    input = rawModel.input_modalities.map((m) => m.toLowerCase());
  } else if (rawModel.modalities?.input && Array.isArray(rawModel.modalities.input)) {
    input = rawModel.modalities.input.map((m) => m.toLowerCase());
  } else if (rawModel.capabilities?.vision) {
    input = ['text', 'image'];
  }

  // Ensure unique elements in input
  input = Array.from(new Set(input));

  // Reasoning detection
  let reasoning = false;
  if (typeof rawModel.capabilities?.reasoning === 'boolean') {
    reasoning = rawModel.capabilities.reasoning;
  } else if (typeof rawModel.reasoning === 'boolean') {
    reasoning = rawModel.reasoning;
  } else if (id.toLowerCase().includes('reasoning') || id.toLowerCase().includes('thinking')) {
    reasoning = true;
  }

  // Tool calling detection
  let toolCalling = false;
  if (typeof rawModel.capabilities?.tool_calling === 'boolean') {
    toolCalling = rawModel.capabilities.tool_calling;
  } else if (typeof rawModel.capabilities?.tools === 'boolean') {
    toolCalling = rawModel.capabilities.tools;
  } else if (typeof rawModel.tool_call === 'boolean') {
    toolCalling = rawModel.tool_call;
  }

  const model = {
    id,
    name,
    api: providerApi,
    input,
    contextWindow,
    reasoning
  };

  if (maxTokens) {
    model.maxTokens = maxTokens;
  }

  // Keep additional capabilities metadata if useful
  model._capabilities = {
    vision: input.includes('image'),
    tool_calling: toolCalling,
    reasoning
  };

  return model;
}

/**
 * Transform models into Pi configuration format (~/.pi/agent/models.json)
 */
export function toPiConfig({
  providerId,
  baseUrl,
  api = 'openai-completions',
  apiKey,
  models = [],
  selectedModelIds = null
}) {
  const rawList = extractModelsList(models);
  const selectedSet = selectedModelIds ? new Set(selectedModelIds) : null;

  const parsedModels = rawList
    .filter((m) => {
      const id = m.id || m.name;
      return !selectedSet || selectedSet.has(id);
    })
    .map((m) => {
      const parsed = parseModel(m, { providerApi: api });
      // Pi model object cleans up private properties
      const piModel = {
        id: parsed.id,
        name: parsed.name,
        api: parsed.api,
        input: parsed.input,
        contextWindow: parsed.contextWindow,
        reasoning: parsed.reasoning
      };
      if (parsed.maxTokens) {
        piModel.maxTokens = parsed.maxTokens;
      }
      return piModel;
    });

  return {
    providers: {
      [providerId]: {
        baseUrl,
        api,
        apiKey,
        models: parsedModels
      }
    }
  };
}

/**
 * Transform models into OpenCode configuration format (~/.config/opencode/opencode.json)
 */
export function toOpenCodeConfig({
  providerId,
  providerName = null,
  baseUrl,
  apiKey,
  models = [],
  selectedModelIds = null
}) {
  const rawList = extractModelsList(models);
  const selectedSet = selectedModelIds ? new Set(selectedModelIds) : null;
  const name = providerName || formatProviderName(providerId);

  const modelsMap = {};

  for (const raw of rawList) {
    const id = raw.id || raw.name;
    if (selectedSet && !selectedSet.has(id)) {
      continue;
    }

    const parsed = parseModel(raw);
    const context = parsed.contextWindow || 1048576;
    const output = parsed.maxTokens || 65536;

    let outputModalities = ['text'];
    if (Array.isArray(raw.output_modalities)) {
      outputModalities = raw.output_modalities.map((m) => m.toLowerCase());
    }

    const modelObj = {
      name: parsed.name,
      limit: {
        context,
        output
      },
      modalities: {
        input: parsed.input,
        output: outputModalities
      }
    };

    if (parsed.reasoning) {
      modelObj.reasoning = true;
    }
    if (parsed._capabilities?.tool_calling) {
      modelObj.tool_call = true;
    }

    modelsMap[id] = modelObj;
  }

  return {
    provider: {
      [providerId]: {
        name,
        options: {
          baseURL: baseUrl,
          apiKey: apiKey
        },
        models: modelsMap
      }
    }
  };
}

/**
 * Filter list of models based on search term or regex
 */
export function filterModels(models, { search = '', filterRegex = null } = {}) {
  const list = extractModelsList(models);

  let regex = null;
  if (filterRegex) {
    regex = typeof filterRegex === 'string' ? new RegExp(filterRegex, 'i') : filterRegex;
  }

  const s = (search || '').toLowerCase().trim();

  return list.filter((m) => {
    const id = (m.id || '').toLowerCase();
    const name = (m.name || '').toLowerCase();

    if (s && !id.includes(s) && !name.includes(s)) {
      return false;
    }

    if (regex && !regex.test(m.id || '') && !regex.test(m.name || '')) {
      return false;
    }

    return true;
  });
}
