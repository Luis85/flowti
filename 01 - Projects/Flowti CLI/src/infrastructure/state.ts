/**
 * state.ts — Persistent CLI state (survives across runs).
 *
 * Stores lightweight runtime state in .flowti/var/state.json.
 */

import { paths } from "./paths.js";
import { VAULT_ROOT, CLI_PROJECT } from "./config.js";
import { disk } from "./filesystem.js";
import type { CliState, IFileSystem } from "./types.js";

const STATE_DIR = paths.join(VAULT_ROOT, ".flowti", "var");
const STATE_PATH = paths.join(STATE_DIR, "state.json");

/** Migrate state from legacy location on first access. */
function migrateStateIfNeeded(fs: IFileSystem): void {
	if (fs.existsSync(STATE_PATH)) return;
	const oldPath = paths.join(CLI_PROJECT, "configs", ".flowti-state.json");
	if (!fs.existsSync(oldPath)) return;

	if (!fs.existsSync(STATE_DIR)) {
		fs.mkdirSync(STATE_DIR, { recursive: true });
	}
	const data = fs.readFileSync(oldPath, "utf-8");
	fs.writeFileSync(STATE_PATH, data, "utf-8");
}

export function loadState(fs: IFileSystem = disk): CliState {
	migrateStateIfNeeded(fs);
	try {
		return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8")) as CliState;
	} catch {
		return {};
	}
}

export function saveState(state: Partial<CliState>, fs: IFileSystem = disk): void {
	if (!fs.existsSync(STATE_DIR)) {
		fs.mkdirSync(STATE_DIR, { recursive: true });
	}
	const merged = { ...loadState(fs), ...state };
	fs.writeFileSync(STATE_PATH, JSON.stringify(merged, null, "\t"), "utf-8");
}

export function getSelectedProject(): string | null {
	return loadState().selectedProject ?? null;
}

export function setSelectedProject(name: string): void {
	saveState({ selectedProject: name });
}

export function clearSelectedProject(): void {
	saveState({ selectedProject: undefined });
}
