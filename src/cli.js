import { Command } from 'commander';
import pc from 'picocolors';
import { input, password, select, checkbox, confirm } from '@inquirer/prompts';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  fetchModels,
  extractModelsList,
  toPiConfig,
  toOpenCodeConfig,
  filterModels,
  applyToPiConfig,
  applyToOpenCodeConfig,
  getPiConfigPath,
  getOpenCodeConfigPath,
  writeJsonFile,
  readJsonFile
} from './index.js';
import {
  getProfilesPath,
  loadProfiles,
  upsertProfile,
  seedProfilesFromPiConfig,
  seedProfilesFromOpenCodeConfig,
  mergeProfiles
} from './profiles.js';

const BUILTIN_API_TYPES = ['openai-completions', 'anthropic-messages', 'google-generative-ai'];

export function createCli() {
  const program = new Command();

  program
    .name('config-models-parser')
    .description('Fetch and parse AI models for Pi, OpenCode, and more')
    .version('1.0.0')
    .option('-p, --provider <id>', 'Provider ID (e.g. sabah-ai)')
    .option('-u, --url <url>', 'Base URL (e.g. https://vibing.softyan.net/v1)')
    .option('-k, --key <key>', 'API Key (e.g. sk-...)')
    .option('-a, --api <type>', 'API type for Pi (default: openai-completions or the profile api)')
    .option('--use <name>', 'Use a saved provider profile (name is case-sensitive)')
    .option('-t, --target <target>', 'Target format: pi, opencode, or both', 'pi')
    .option('-f, --file <path>', 'Load raw models response from a local JSON file')
    .option('--filter <query>', 'Filter models by ID or keyword')
    .option('-s, --save', 'Save/merge directly to system config files (~/.pi/agent/models.json / ~/.config/opencode/opencode.json)')
    .option('-o, --out <path>', 'Save generated JSON to a custom file path')
    .option('-i, --interactive', 'Run interactive prompt wizard')
    .action(async (options) => {
      const isInteractive = options.interactive || (!options.provider && !options.url && !options.file);

      const profile = await resolveUseProfile(options);

      if (isInteractive) {
        await runInteractiveWizard(options, profile);
      } else {
        await runNonInteractive(options, profile);
      }
    });

  program
    .command('web')
    .description('Start the Web UI server')
    .option('-p, --port <port>', 'Port number to listen on', 3000)
    .action(async (cmdOptions) => {
      const { startServer } = await import('./server.js');
      const port = parseInt(cmdOptions.port, 10) || 3000;
      await startServer(port);
    });

  return program;
}

/**
 * Seed known profiles from the system config files and resolve --use.
 * Seeding only ever ADDS profiles (existing entries win untouched) and
 * the profiles file is only rewritten when at least one new seed was
 * imported. Returns the resolved profile for --use, or null.
 */
async function resolveUseProfile(options) {
  const profiles = await refreshKnownProfiles();

  if (!options.use) {
    return null;
  }

  // Profile names are matched case-sensitively.
  const found = profiles.find((p) => p?.name === options.use);
  if (!found) {
    console.error(pc.red(`Error: Unknown profile "${options.use}".`));
    const names = profiles.map((p) => p?.name).filter((n) => typeof n === 'string' && n.length > 0);
    if (names.length > 0) {
      console.error(pc.gray(`Known profiles: ${names.join(', ')}`));
    } else {
      console.error(pc.gray('No profiles are saved yet.'));
    }
    process.exit(1);
  }
  return found;
}

async function refreshKnownProfiles() {
  const piConfig = await safeReadJson(getPiConfigPath(), 'Pi config');
  const opencodeConfig = await safeReadJson(getOpenCodeConfigPath(), 'OpenCode config');

  let existing = [];
  let existingReadable = true;
  try {
    existing = await loadProfiles();
  } catch (err) {
    existingReadable = false;
    console.warn(pc.yellow(`Could not load saved provider profiles: ${err.message}`));
  }

  const merged = mergeProfiles(existing, [
    ...seedProfilesFromPiConfig(piConfig),
    ...seedProfilesFromOpenCodeConfig(opencodeConfig)
  ]);

  // Write back only when at least one new seed was imported. Never rewrite
  // when the existing file was unreadable, so a corrupt file is not clobbered.
  if (existingReadable && merged.length > existing.length) {
    try {
      const profilesPath = getProfilesPath();
      await fs.mkdir(path.dirname(profilesPath), { recursive: true });
      await fs.writeFile(profilesPath, JSON.stringify({ profiles: merged }, null, 2) + '\n', 'utf8');
    } catch (err) {
      console.warn(pc.yellow(`Could not save refreshed provider profiles: ${err.message}`));
    }
  }

  return merged;
}

async function safeReadJson(filePath, label) {
  try {
    return await readJsonFile(filePath);
  } catch (err) {
    console.warn(pc.yellow(`Skipping profile seed from ${label} (${filePath}): ${err.message}`));
    return null;
  }
}

/**
 * Remember the just-saved provider as a profile named after the providerId.
 * A profiles failure must not spoil an already successful save.
 */
async function upsertSavedProfile(providerId, baseUrl, api, apiKey) {
  try {
    await upsertProfile({
      name: providerId,
      providerId,
      baseUrl,
      api,
      apiKey
    });
  } catch (err) {
    console.warn(pc.yellow(`Could not update provider profile "${providerId}": ${err.message}`));
  }
}

async function runInteractiveWizard(initialOptions = {}, profile = null) {
  console.log();
  console.log(pc.bold(pc.cyan('╔══════════════════════════════════════════════════════════╗')));
  console.log(pc.bold(pc.cyan('║              Config Models Parser (Pi & OpenCode)        ║')));
  console.log(pc.bold(pc.cyan('╚══════════════════════════════════════════════════════════╝')));
  console.log();

  const providerId = await input({
    message: 'Enter Provider ID / Name (e.g. sabah-ai):',
    default: profile?.providerId || initialOptions.provider || 'sabah-ai',
    validate: (val) => (val && val.trim().length > 0 ? true : 'Provider ID cannot be empty')
  });

  // A profile api outside the three builtins preselects "custom".
  const profileApi = (profile?.api || '').trim();
  const preselectedApiType = BUILTIN_API_TYPES.includes(profileApi)
    ? profileApi
    : (profileApi ? 'custom' : (initialOptions.api || 'openai-completions'));

  const apiType = await select({
    message: 'Select API Type (for Pi):',
    default: preselectedApiType,
    choices: [
      { name: 'openai-completions (OpenAI Compatible, vLLM, Ollama, Proxies)', value: 'openai-completions' },
      { name: 'anthropic-messages (Claude API Compatible)', value: 'anthropic-messages' },
      { name: 'google-generative-ai (Gemini API)', value: 'google-generative-ai' },
      { name: 'custom (Enter custom string)', value: 'custom' }
    ]
  });

  let finalApiType = apiType;
  if (apiType === 'custom') {
    finalApiType = await input({
      message: 'Enter custom API type:',
      default: profileApi || initialOptions.api || 'openai-completions'
    });
  }

  const baseUrl = await input({
    message: 'Enter Base URL (e.g. https://vibing.softyan.net/v1):',
    default: profile?.baseUrl || initialOptions.url || 'https://vibing.softyan.net/v1',
    validate: (val) => (val && val.trim().length > 0 ? true : 'Base URL cannot be empty')
  });

  const savedKey = (profile?.apiKey || '').trim();
  const typedKey = await password({
    message: savedKey ? 'Enter API Key (press Enter to keep the saved key):' : 'Enter API Key (sk-...):',
    mask: '*'
  });
  // An empty entry keeps the saved key from the profile.
  const apiKey = typedKey.trim() === '' ? savedKey : typedKey.trim();

  const sourceChoice = await select({
    message: 'Choose model data source:',
    choices: [
      { name: `Fetch live from ${baseUrl}`, value: 'fetch' },
      { name: 'Load from local JSON file', value: 'file' },
      { name: 'Paste raw JSON response', value: 'paste' }
    ]
  });

  let rawModels = [];

  if (sourceChoice === 'fetch') {
    console.log();
    console.log(pc.yellow(`Fetching models from ${baseUrl}...`));
    try {
      const result = await fetchModels({
        baseUrl,
        apiKey: apiKey.trim()
      });
      rawModels = result.models;
      console.log(pc.green(`Successfully fetched ${rawModels.length} models from ${result.url}`));
    } catch (err) {
      console.log(pc.red(`Failed to fetch models: ${err.message}`));
      const retryChoice = await select({
        message: 'What would you like to do?',
        choices: [
          { name: 'Paste raw JSON response manually', value: 'paste' },
          { name: 'Load from local JSON file', value: 'file' },
          { name: 'Exit', value: 'exit' }
        ]
      });

      if (retryChoice === 'exit') {
        process.exit(1);
      } else if (retryChoice === 'file') {
        rawModels = await promptLoadFile();
      } else {
        rawModels = await promptPasteJson();
      }
    }
  } else if (sourceChoice === 'file') {
    rawModels = await promptLoadFile();
  } else {
    rawModels = await promptPasteJson();
  }

  if (!rawModels || rawModels.length === 0) {
    console.log(pc.red('No models found to process. Exiting.'));
    return;
  }

  // Model selection
  const selectionMode = await select({
    message: `How would you like to select models? (${rawModels.length} available)`,
    choices: [
      { name: `Include ALL ${rawModels.length} models`, value: 'all' },
      { name: 'Select individual models with checkboxes', value: 'manual' },
      { name: 'Filter models by keyword / regex', value: 'filter' }
    ]
  });

  let selectedIds = null;

  if (selectionMode === 'manual') {
    selectedIds = await checkbox({
      message: 'Select models to include (Space to select, Enter to finish):',
      choices: rawModels.map((m) => ({
        name: `${m.name || m.id} (${m.id})`,
        value: m.id || m.name,
        checked: true
      }))
    });
  } else if (selectionMode === 'filter') {
    const filterQuery = await input({
      message: 'Enter keyword or regex to filter model IDs (e.g. gemini|claude):',
      default: ''
    });
    const filtered = filterModels(rawModels, { search: filterQuery });
    console.log(pc.green(`Matched ${filtered.length} models with filter "${filterQuery}"`));
    selectedIds = filtered.map((m) => m.id || m.name);
  }

  // Target config selection
  const targetFormat = await select({
    message: 'Select target configuration format:',
    choices: [
      { name: 'Pi Coding Agent (~/.pi/agent/models.json)', value: 'pi' },
      { name: 'OpenCode (~/.config/opencode/opencode.json)', value: 'opencode' },
      { name: 'Both (Pi & OpenCode)', value: 'both' }
    ]
  });

  // Generate configs
  const piConfig = (targetFormat === 'pi' || targetFormat === 'both')
    ? toPiConfig({
        providerId,
        baseUrl,
        api: finalApiType,
        apiKey: apiKey.trim(),
        models: rawModels,
        selectedModelIds: selectedIds
      })
    : null;

  const opencodeConfig = (targetFormat === 'opencode' || targetFormat === 'both')
    ? toOpenCodeConfig({
        providerId,
        baseUrl,
        apiKey: apiKey.trim(),
        models: rawModels,
        selectedModelIds: selectedIds
      })
    : null;

  // Actions
  const actionChoices = [];
  if (piConfig) {
    actionChoices.push({
      name: `Save directly to ~/.pi/agent/models.json (safe merge + backup)`,
      value: 'save-pi'
    });
  }
  if (opencodeConfig) {
    actionChoices.push({
      name: `Save directly to ~/.config/opencode/opencode.json (safe merge + backup)`,
      value: 'save-opencode'
    });
  }
  if (piConfig && opencodeConfig) {
    actionChoices.push({
      name: `Save BOTH directly to their respective config files`,
      value: 'save-both'
    });
  }
  actionChoices.push({ name: 'Export to local file (.json)', value: 'export-file' });
  actionChoices.push({ name: 'Print JSON to terminal', value: 'print' });

  const chosenAction = await select({
    message: 'What would you like to do with the generated configuration?',
    choices: actionChoices
  });

  if (chosenAction === 'save-pi' || chosenAction === 'save-both') {
    const savedPath = await applyToPiConfig(piConfig);
    console.log(pc.green(`Successfully saved/merged into Pi config: ${pc.bold(savedPath)}`));
    console.log(pc.gray(`  (Rolling backups kept as ${savedPath}.bak-<timestamp>, newest five)`));
  }

  if (chosenAction === 'save-opencode' || chosenAction === 'save-both') {
    const savedPath = await applyToOpenCodeConfig(opencodeConfig);
    console.log(pc.green(`Successfully saved/merged into OpenCode config: ${pc.bold(savedPath)}`));
    console.log(pc.gray(`  (Rolling backups kept as ${savedPath}.bak-<timestamp>, newest five)`));
  }

  if (chosenAction === 'save-pi' || chosenAction === 'save-opencode' || chosenAction === 'save-both') {
    await upsertSavedProfile(providerId, baseUrl, finalApiType, apiKey);
  }

  if (chosenAction === 'export-file') {
    const defaultOut = targetFormat === 'opencode' ? 'opencode.json' : 'models.json';
    const outPath = await input({
      message: 'Enter output file path:',
      default: path.join(process.cwd(), defaultOut)
    });
    const outputData = targetFormat === 'both' ? { pi: piConfig, opencode: opencodeConfig } : (piConfig || opencodeConfig);
    await writeJsonFile(outPath, outputData, { createBackup: false });
    console.log(pc.green(`Successfully exported to ${outPath}`));
  }

  if (chosenAction === 'print') {
    console.log();
    if (piConfig) {
      console.log(pc.bold(pc.cyan('--- Pi Configuration (models.json) ---')));
      console.log(JSON.stringify(piConfig, null, 2));
    }
    if (opencodeConfig) {
      console.log(pc.bold(pc.magenta('--- OpenCode Configuration (opencode.json) ---')));
      console.log(JSON.stringify(opencodeConfig, null, 2));
    }
  }

  console.log();
  console.log(pc.bold(pc.green('Done!')));
}

async function promptLoadFile() {
  const filePath = await input({
    message: 'Enter path to JSON file:',
    validate: async (val) => {
      try {
        await fs.access(val);
        return true;
      } catch {
        return `File does not exist: ${val}`;
      }
    }
  });

  const content = await fs.readFile(filePath, 'utf8');
  return extractModelsList(content);
}

async function promptPasteJson() {
  const rawJson = await input({
    message: 'Paste JSON content (single line or JSON string):',
    validate: (val) => {
      try {
        JSON.parse(val);
        return true;
      } catch (err) {
        return `Invalid JSON: ${err.message}`;
      }
    }
  });

  return extractModelsList(rawJson);
}

async function runNonInteractive(options, profile = null) {
  // Explicit --provider/--url/--key/--api flags win; the --use profile
  // (if any) only fills gaps.
  const providerId = options.provider || profile?.providerId || 'custom-provider';
  const baseUrl = options.url || profile?.baseUrl || null;
  const apiKey = options.key || profile?.apiKey || '';
  const apiType = options.api || profile?.api || 'openai-completions';
  const target = options.target || 'pi';

  let rawModels = [];

  if (options.file) {
    const content = await fs.readFile(options.file, 'utf8');
    rawModels = extractModelsList(content);
  } else if (baseUrl) {
    console.log(pc.yellow(`Fetching models from ${baseUrl}...`));
    const res = await fetchModels({ baseUrl, apiKey });
    rawModels = res.models;
    console.log(pc.green(`Fetched ${rawModels.length} models.`));
  } else {
    console.error(pc.red('Error: Either --url or --file must be specified.'));
    process.exit(1);
  }

  let selectedIds = null;
  if (options.filter) {
    const filtered = filterModels(rawModels, { filterRegex: options.filter });
    selectedIds = filtered.map((m) => m.id || m.name);
    console.log(pc.cyan(`Filtered down to ${selectedIds.length} models using "${options.filter}".`));
  }

  const piConfig = (target === 'pi' || target === 'both')
    ? toPiConfig({
        providerId,
        baseUrl: baseUrl || 'http://localhost',
        api: apiType,
        apiKey,
        models: rawModels,
        selectedModelIds: selectedIds
      })
    : null;

  const opencodeConfig = (target === 'opencode' || target === 'both')
    ? toOpenCodeConfig({
        providerId,
        baseUrl: baseUrl || 'http://localhost',
        apiKey,
        models: rawModels,
        selectedModelIds: selectedIds
      })
    : null;

  const finalOutput = target === 'both' ? { pi: piConfig, opencode: opencodeConfig } : (piConfig || opencodeConfig);

  if (options.save) {
    let savedAny = false;
    if (piConfig) {
      const p = await applyToPiConfig(piConfig);
      console.log(pc.green(`Saved to Pi config: ${p}`));
      savedAny = true;
    }
    if (opencodeConfig) {
      const p = await applyToOpenCodeConfig(opencodeConfig);
      console.log(pc.green(`Saved to OpenCode config: ${p}`));
      savedAny = true;
    }
    if (savedAny) {
      await upsertSavedProfile(providerId, baseUrl, apiType, apiKey);
    }
  }

  if (options.out) {
    await writeJsonFile(options.out, finalOutput, { createBackup: false });
    console.log(pc.green(`Wrote output to ${options.out}`));
  }

  if (!options.save && !options.out) {
    console.log(JSON.stringify(finalOutput, null, 2));
  }
}
