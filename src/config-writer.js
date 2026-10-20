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

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns next available backup path <file>.bak-<timestamp>, appending
 * -2, -3, ... on collision with an existing sibling backup.
 */
async function nextBackupPath(filePath) {
  const base = `${filePath}.bak-${Date.now()}`;
  let candidate = base;
  for (let n = 1; await pathExists(candidate); n++) {
    candidate = `${base}-${n}`;
  }
  return candidate;
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy existing file to a timestamped backup and prune older siblings.
 * Non-ENOENT copy failures throw; each unlink failure during pruning is
 * non-fatal.
 */
async function createRollingBackup(filePath, maxBackups) {
  let backupPath;
  try {
    backupPath = await nextBackupPath(filePath);
    await fs.copyFile(filePath, backupPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return; // source file does not exist yet — nothing to back up
    }
    throw new Error(`Failed to create backup at ${backupPath}: ${err.message}`);
  }

  await pruneRollingBackups(filePath, maxBackups);
}

/**
 * Prune sibling backups matching <basename>.bak-<ts>[-<n>] down to the
 * newest `maxBackups` by embedded timestamp. Legacy plain <file>.bak is
 * never matched, touched, or counted.
 */
async function pruneRollingBackups(filePath, maxBackups) {
  const dir = path.dirname(filePath);
  const pattern = new RegExp(
    `^${escapeRegExp(path.basename(filePath))}\\.bak-\\d+(-\\d+)?$`
  );

  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch {
    return; // non-fatal
  }

  const backups = entries
    .filter((entry) => pattern.test(entry))
    .map((entry) => {
      const ts = Number(entry.match(/\.bak-(\d+)/)?.[1]);
      const suffix = Number(entry.match(/\.bak-\d+(?:-(\d+))?$/)?.[1] || 0);
      return { entry, ts: Number.isFinite(ts) ? ts : 0, suffix };
    })
    .sort((a, b) => (b.ts - a.ts) || (b.suffix - a.suffix));

  for (const { entry } of backups.slice(Math.max(0, maxBackups))) {
    try {
      await fs.unlink(path.join(dir, entry));
    } catch {
      // non-fatal: keep pruning the rest
    }
  }
}

/**
 * Save data as JSON to file with optional rolling timestamped backups.
 * Backups are stored as <file>.bak-<timestamp> (collision suffix -2, -3, ...)
 * and pruned to the newest `maxBackups`; legacy plain <file>.bak is left
 * untouched and never counted.
 */
export async function writeJsonFile(filePath, data, { createBackup = true, maxBackups = 5 } = {}) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  if (createBackup) {
    await createRollingBackup(filePath, maxBackups);
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

