const SPECIAL_CASINGS = {
  gpt: 'GPT',
  ai: 'AI',
  llm: 'LLM',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  gemini: 'Gemini',
  claude: 'Claude',
  llama: 'Llama',
  mistral: 'Mistral',
  mixtral: 'Mixtral',
  codestral: 'Codestral',
  openai: 'OpenAI',
  anthropic: 'Anthropic'
};

/**
 * Format a raw model id or name into a human-readable model name
 * e.g.:
 * "gs/ag/gemini-3.8-flash-high" -> "Ag/Gemini 3.8 Flash High"
 * "9dak/cc/claude-haiku-4-5-20251001" -> "Cc/Claude Haiku 4.5"
 */
export function formatModelName(id, rawName) {
  if (!id && !rawName) return 'Unknown Model';

  let sourceStr = rawName || id;
  let prefix = '';

  // If id has a pattern like gs/ag/model-name or 9dak/cc/model-name
  const idParts = (id || '').split('/');
  const nameParts = sourceStr.split('/');

  if (idParts.length >= 3) {
    const tag = idParts[1];
    prefix = tag.charAt(0).toUpperCase() + tag.slice(1) + '/';
    sourceStr = idParts[idParts.length - 1];
  } else if (nameParts.length === 2 && nameParts[0].length <= 4) {
    const tag = nameParts[0];
    prefix = tag.charAt(0).toUpperCase() + tag.slice(1) + '/';
    sourceStr = nameParts[1];
  } else if (idParts.length === 2 && idParts[0].length <= 4) {
    const tag = idParts[0];
    prefix = tag.charAt(0).toUpperCase() + tag.slice(1) + '/';
    sourceStr = idParts[1];
  } else if (nameParts.length > 1) {
    sourceStr = nameParts[nameParts.length - 1];
  }

  // Remove date stamps like -20251001 or _20240307
  let cleaned = sourceStr.replace(/[-_]20\d{6}$/, '');

  // Convert digit-hyphen-digit (e.g. 4-5) to 4.5
  cleaned = cleaned.replace(/(\d+)-(\d+)/g, '$1.$2');

  // Split into tokens by hyphens, underscores, or spaces
  const tokens = cleaned.split(/[-_\s]+/).filter(Boolean);

  const formattedTokens = tokens.map((token) => {
    const lower = token.toLowerCase();
    if (SPECIAL_CASINGS[lower]) {
      return SPECIAL_CASINGS[lower];
    }
    // Check version like r1, v1, v2
    if (/^[rv]\d+$/i.test(token)) {
      return token.toUpperCase();
    }
    // Title case
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  });

  return prefix + formattedTokens.join(' ');
}

/**
 * Format provider identifier into readable name
 * e.g. "sabah-ai" -> "Sabah AI"
 */
export function formatProviderName(providerId) {
  if (!providerId) return '';
  const tokens = providerId.split(/[-_\s]+/).filter(Boolean);
  return tokens
    .map((token) => {
      const lower = token.toLowerCase();
      if (SPECIAL_CASINGS[lower]) return SPECIAL_CASINGS[lower];
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(' ');
}
