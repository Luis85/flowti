/**
 * workspace-registry.ts — In-memory workspace registry with flush-on-mutate persistence.
 *
 * Tracks all agent workspaces in a JSON file at the configured registry path.
 * Mutations (register, update, remove) flush to disk immediately so the
 * registry survives process restarts.
 */

import type { AgentWorkspace, WorkspaceState } from "../domain/agents/agent-workspace.js";
import type { IFileSystem } from "./types.js";

export interface RegistryDeps {
	readonly disk: Pick<IFileSystem, "existsSync" | "readFileSync" | "writeFileSync" | "mkdirSync">;
}

interface RegistryData {
	readonly workspaces: readonly AgentWorkspace[];
}

export interface IWorkspaceRegistry {
	list(): AgentWorkspace[];
	listByState(state: WorkspaceState): AgentWorkspace[];
	get(id: string): AgentWorkspace | null;
	register(ws: AgentWorkspace): void;
	update(ws: AgentWorkspace): void;
	remove(id: string): void;
	activeCount(): number;
}

const ACTIVE_STATES: ReadonlySet<WorkspaceState> = new Set(["provision", "ready", "active"]);

export function createWorkspaceRegistry(deps: RegistryDeps, registryPath: string): IWorkspaceRegistry {
	const workspaces = new Map<string, AgentWorkspace>();

	// Load from disk on construction
	if (deps.disk.existsSync(registryPath)) {
		try {
			const raw = deps.disk.readFileSync(registryPath, "utf-8");
			const data: RegistryData = JSON.parse(raw);
			for (const ws of data.workspaces) {
				workspaces.set(ws.id, ws);
			}
		} catch {
			/* corrupt file — start empty */
		}
	}

	function flush(): void {
		const data: RegistryData = { workspaces: [...workspaces.values()] };
		deps.disk.writeFileSync(registryPath, JSON.stringify(data, null, "\t"), "utf-8");
	}

	return {
		list: () => [...workspaces.values()],
		listByState: (state) => [...workspaces.values()].filter((ws) => ws.state === state),
		get: (id) => workspaces.get(id) ?? null,
		register(ws) { workspaces.set(ws.id, ws); flush(); },
		update(ws) { workspaces.set(ws.id, ws); flush(); },
		remove(id) { workspaces.delete(id); flush(); },
		activeCount: () => [...workspaces.values()].filter((ws) => ACTIVE_STATES.has(ws.state)).length,
	};
}
