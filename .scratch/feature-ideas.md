# Feature Ideas — config-models-parser

Goal: fewer steps to a working Pi/OpenCode config, less re-typing, more trust in what gets written, easier recovery. Read-only survey of README/GLOSSARY/source; nothing implemented.

## 1. One-keystroke provider profiles
- Problem: every run re-asks provider ID, base URL, and API key; wizard defaults hard-code one example (`sabah-ai`), so any second provider means retyping everything.
- Fit: cli.js prefills wizard defaults and a `--use <profile>` flag from a profiles file (`~/.config/config-models-parser/profiles.json` via config-writer read/write helpers); server.js adds `/api/profiles` for the web dropdown; profiles are seeded by importing providers already present in the target config.
- Size: M
- Risk if skipped: retyping stays slow and error-prone; a typo'd baseUrl is written silently into config and only surfaces when the agent fails at launch.

## 2. Rolling timestamped backups + restore
- Problem: `writeJsonFile` overwrites the single `.bak` on every save — the snapshot from before your first change is destroyed by the second save, exactly when you need it; there is no restore path today.
- Fit: config-writer keeps the last N backups as `models.json.bak-<timestamp>` and exposes `restoreBackup(path, n)`; cli gains a `restore` command (lists backups, rewrites chosen one, keeping a fresh backup); web adds a small "Restore" action next to Save.
- Size: S
- Risk if skipped: recovery from a bad merge is impossible after two saves; users must hoard manual copies of a secret-bearing file.

## 3. Pre-save diff / dry-run
- Problem: Save silently merges; you learn what changed (or got replaced) only by reopening the config, so trusting one-click save — especially for an already-existing providerId — is hard.
- Fit: config-writer's mergePiConfig/mergeOpenCodeConfig already compute the final object; return it plus a small structured diff (added/updated provider, model count delta); cli prints it before `--save` confirmation; server exposes `/api/preview`; web renders the diff panel before Save.
- Size: M
- Risk if skipped: "what will it write?" stays a black box; users fall back to export-file plus hand-editing, voiding the safe-merge promise.

## 4. Auto-saved raw fetch snapshots (one-keypress offline retry)
- Problem: after a failed or offline fetch you must paste raw JSON by hand every time; the response you fetched minutes ago is gone.
- Fit: fetcher writes each successful (and error-body) response to `~/.config/config-models-parser/last-fetch/<host>.json` and returns the path; cli's "Load from local JSON file" defaults to that snapshot; server /api/fetch returns the snapshot path for web display.
- Size: S
- Risk if skipped: the manual paste/file fallback remains the only recovery, repeating the same drudgery every outage.

## 5. `list` command: see what's configured, keys redacted
- Problem: verifying a save means opening `models.json`/`opencode.json` by hand, exposing API keys and inviting accidental edits.
- Fit: config-writer readJsonFile already loads both configs; cli adds `list` (per provider: baseUrl, api, model count, key shown as `sk-…ast4`); server /api/status extends to the same summary for the web "Saved providers" panel.
- Size: S
- Risk if skipped: users can't confirm writes without opening secret files, so trust in the tool stays low even though the merge itself is correct.

## 6. `remove <providerId>` command with backup
- Problem: merging can add or refresh a provider forever but never retire one; stale providers linger until hand surgery in a key-filled file.
- Fit: config-writer gains `removeProvider(config, target)` reusing writeJsonFile's backup path; cli adds `remove` with confirmation for pi/opencode/both (choosing "both" skips none); web adds a per-provider delete next to Save.
- Size: M
- Risk if skipped: configs grow stale; people quietly abandon the tool the first time it adds something they cannot undo.

## Top 2

1. **#1 One-keystroke provider profiles** — attacks the biggest recurring cost (re-entering URL and key) for CLI and web alike, and seeding profiles from providers already in the config means zero setup upfront. Every feature on this list gets more useful once a run starts for free.
2. **#2 Rolling timestamped backups + restore** — a tiny flaw (single `.bak` overwritten each save) sits in the exact recovery path README promises; the fix is config-writer-only in its core, and it converts save from "hope it worked" into a real, trusted undo.
