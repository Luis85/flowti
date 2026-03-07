/**
 * state.ts — Persistent CLI state (survives across runs).
 *
 * Stores lightweight runtime state in configs/.flowti-state.json.
 */

import { paths } from "./paths.js";
import { CLI_PROJECT } from "./config.js";
import { disk } from "./filesystem.js";
import type { CliState, ProjectSource, IFileSystem } from "../types.js";

const STATE_PATH = paths.join(CLI_PROJECT, "configs", ".flowti-state.json");

export function loadState(fs: IFileSystem = disk): CliState {
	try {
		return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8")) as CliState;
	} catch {
		return {};
	}
}

export function saveState(state: Partial<CliState>, fs: IFileSystem = disk): void {
	const merged = { ...loadState(fs), ...state };
	fs.writeFileSync(STATE_PATH, JSON.stringify(merged, null, "\t"), "utf-8");
}

export function getSelectedProject(): string | null {
	return loadState().selectedProject ?? null;
}

export function getProjectSource(): ProjectSource {
	return loadState().projectSource ?? "projects";
}

export function setSelectedProject(name: string, source: ProjectSource = "projects"): void {
	saveState({ selectedProject: name, projectSource: source });
}

export function clearSelectedProject(): void {
	saveState({ selectedProject: undefined, projectSource: undefined });
}
