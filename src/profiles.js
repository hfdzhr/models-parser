import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const OPTIONAL_FIELDS = ['providerId', 'baseUrl', 'api', 'apiKey'];

/**
 * Returns default path to ~/.config/config-models-parser/profiles.json
 */
export function getProfilesPath() {
  const baseDir = process.env.VERCEL ? os.tmpdir() : os.homedir();
  return path.join(baseDir, '.config', 'config-models-parser', 'profiles.json');
}

/**
 * Sort a profile array by name without mutating the source array
 */
function sortByName(profiles) {
  return [...profiles].sort((a, b) => {
    const an = String(a?.name ?? '');
    const bn = String(b?.name ?? '');
    if (an < bn) return -1;
    if (an > bn) return 1;
    return 0;
  });
}

/**
 * Read the profiles file, returning profiles sorted by name.
 * Missing file yields an empty array; unreadable or malformed file
 * throws an error whose message starts with "Failed to read profiles".
 */
export async function loadProfiles(profilesPath = getProfilesPath()) {
  let raw;
  try {
    raw = await fs.readFile(profilesPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw new Error(`Failed to read profiles at ${profilesPath}: ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to read profiles at ${profilesPath}: ${err.message}`);
  }

  // Tolerate a bare array for hand-edited files; canonical shape is { profiles: [...] }.
  if (Array.isArray(parsed)) {
    parsed = { profiles: parsed };
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.profiles)) {
    throw new Error(`Failed to read profiles at ${profilesPath}: expected { profiles: [...] }`);
  }

  return sortByName(parsed.profiles);
}

/**
 * Insert or update a profile keyed by name. Name is required and trimmed;
 * optional fields (providerId, baseUrl, api, apiKey) are trimmed strings
 * defaulting to ''. The directory is created recursively and profiles.json
 * is written as { profiles: [...] } pretty printed with 2 spaces plus a
 * trailing newline. Returns the saved profile as refetched from the file.
 */
export async function upsertProfile(profile, profilesPath = getProfilesPath()) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error('Profile must be an object');
  }

  if (typeof profile.name !== 'string' || profile.name.trim() === '') {
    throw new Error('Profile name must be a non-empty string');
  }

  const normalized = { name: profile.name.trim() };
  for (const field of OPTIONAL_FIELDS) {
    const value = profile[field];
    if (value === undefined || value === null) {
      normalized[field] = '';
    } else if (typeof value === 'string') {
      normalized[field] = value.trim();
    } else {
      throw new Error(`Profile ${field} must be a string`);
    }
  }
  normalized.savedAt = new Date().toISOString();

  const existing = await loadProfiles(profilesPath);
  const profiles = [...existing];
  const index = profiles.findIndex((p) => p?.name === normalized.name);
  if (index === -1) {
    profiles.push(normalized);
  } else {
    profiles[index] = normalized;
  }

  await writeProfilesFile(profilesPath, profiles);

  const refetched = await loadProfiles(profilesPath);
  return refetched.find((p) => p?.name === normalized.name) ?? normalized;
}

/**
 * Write a profiles array as { profiles: [...] } pretty printed with two
 * spaces plus a trailing newline, creating the parent directory first.
 */
export async function writeProfilesFile(profilesPath, profiles) {
  await fs.mkdir(path.dirname(profilesPath), { recursive: true });
  await fs.writeFile(profilesPath, JSON.stringify({ profiles }, null, 2) + '\n', 'utf8');
}

/**
 * Derive seed profiles from a parsed Pi config: one profile per provider
 * entry in piConfig.providers
 */
export function seedProfilesFromPiConfig(piConfig) {
  const providers = piConfig && typeof piConfig === 'object' ? piConfig.providers : null;
  if (!providers || typeof providers !== 'object') {
    return [];
  }

  const now = new Date().toISOString();
  return Object.entries(providers).map(([providerId, entry]) => ({
    name: providerId,
    providerId,
    baseUrl: entry?.baseUrl ?? '',
    api: entry?.api ?? 'openai-completions',
    apiKey: entry?.apiKey ?? '',
    savedAt: now
  }));
}

/**
 * Derive seed profiles from a parsed OpenCode config: one profile per
 * provider entry, reading options.baseURL and options.apiKey
 */
export function seedProfilesFromOpenCodeConfig(opencodeConfig) {
  const providers = opencodeConfig && typeof opencodeConfig === 'object' ? opencodeConfig.provider : null;
  if (!providers || typeof providers !== 'object') {
    return [];
  }

  const now = new Date().toISOString();
  return Object.entries(providers).map(([providerId, entry]) => ({
    name: providerId,
    providerId,
    baseUrl: entry?.options?.baseURL ?? '',
    apiKey: entry?.options?.apiKey ?? '',
    api: 'openai-completions',
    savedAt: now
  }));
}

/**
 * Merge seed profiles into existing profiles: entries are deduped by name,
 * existing entries win untouched, and non-duplicate incoming seeds are
 * appended after them with their own savedAt. Inputs are never mutated.
 */
export function mergeProfiles(existingProfiles, incomingSeeds) {
  const existing = Array.isArray(existingProfiles) ? existingProfiles : [];
  const incoming = Array.isArray(incomingSeeds) ? incomingSeeds : [];

  const seen = new Set(existing.map((p) => p?.name));
  const merged = existing.map((p) => ({ ...p }));
  for (const seed of incoming) {
    if (seen.has(seed?.name)) {
      continue;
    }
    seen.add(seed?.name);
    merged.push({ ...seed });
  }
  return merged;
}
