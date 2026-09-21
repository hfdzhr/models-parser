import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/**
 * Returns default path to ~/.pi/agent/models.json
 */
export function getPiConfigPath() {
  return path.join(os.homedir(), '.pi', 'agent', 'models.json');
}

/**
 * Returns default path to ~/.config/opencode/opencode.json
 */
export function getOpenCodeConfigPath() {
  return path.join(os.homedir(), '.config', 'opencode', 'opencode.json');
}

/**
 * Merge new provider configuration into Pi's config object
 */
export function mergePiConfig(existingConfig, newConfig) {
  const result = existingConfig && typeof existingConfig === 'object' ? { ...existingConfig } : {};
  result.providers = result.providers && typeof result.providers === 'object' ? { ...result.providers } : {};

  if (newConfig && newConfig.providers) {
    for (const [providerId, providerData] of Object.entries(newConfig.providers)) {
      result.providers[providerId] = providerData;
    }
  }

  return result;
}

/**
 * Merge new provider configuration into OpenCode's config object
 */
export function mergeOpenCodeConfig(existingConfig, newConfig) {
  const result = existingConfig && typeof existingConfig === 'object' ? { ...existingConfig } : {};
  result.provider = result.provider && typeof result.provider === 'object' ? { ...result.provider } : {};

  if (newConfig && newConfig.provider) {
    for (const [providerId, providerData] of Object.entries(newConfig.provider)) {
      result.provider[providerId] = providerData;
    }
  }

  return result;
}

/**
 * Read and parse JSON file, returns null if file not found
 */
export async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw new Error(`Failed to read ${filePath}: ${err.message}`);
  }
}

/**
 * Save data as JSON to file with optional backup
 */
export async function writeJsonFile(filePath, data, { createBackup = true } = {}) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  if (createBackup) {
    try {
      await fs.copyFile(filePath, `${filePath}.bak`);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw new Error(`Failed to create backup at ${filePath}.bak: ${err.message}`);
      }
    }
  }

  const jsonStr = JSON.stringify(data, null, 2) + '\n';
  await fs.writeFile(filePath, jsonStr, 'utf8');
  return filePath;
}

/**
 * Safely merge and write Pi configuration to default path
 */
export async function applyToPiConfig(piConfig, customPath = null) {
  const targetPath = customPath || getPiConfigPath();
  const existing = await readJsonFile(targetPath);
  const merged = mergePiConfig(existing, piConfig);
  await writeJsonFile(targetPath, merged, { createBackup: true });
  return targetPath;
}

/**
 * Safely merge and write OpenCode configuration to default path
 */
export async function applyToOpenCodeConfig(opencodeConfig, customPath = null) {
  const targetPath = customPath || getOpenCodeConfigPath();
  const existing = await readJsonFile(targetPath);
  const merged = mergeOpenCodeConfig(existing, opencodeConfig);
  await writeJsonFile(targetPath, merged, { createBackup: true });
  return targetPath;
}

