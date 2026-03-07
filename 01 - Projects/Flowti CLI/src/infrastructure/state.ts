/**
 * state.ts — Persistent CLI state (survives across runs).
 *
 * Stores lightweight runtime state in configs/.flowti-state.json.
 */

import fs from "node:fs";
import path from "node:path";
import { CLI_PROJECT } from "./config.js";
import type { CliState, ProjectSource } from "../types.js";

const STATE_PATH = path.join(CLI_PROJECT, "configs", ".flowti-state.json");

export function loadState(): CliState {
	try {
		return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8")) as CliState;
	} catch {
		return {};
	}
}

export function saveState(state: Partial<CliState>): void {
	const merged = { ...loadState(), ...state };
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
