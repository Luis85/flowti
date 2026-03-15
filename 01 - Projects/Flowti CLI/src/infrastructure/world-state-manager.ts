/**
 * world-state-manager.ts — In-memory world state with debounced persistence.
 */

import type { IFileSystem } from "./types.js";
import type { IPaths } from "./types.js";
import type { IClock } from "./types.js";
import type { WorldState, WorldEntity, WorldEntityType, AgentAction, ActivityEntry, IWorldStateManager } from "../domain/agents/world-state-types.js";

export type WorldStateDeps = { readonly disk: IFileSystem; readonly paths: IPaths; readonly clock: IClock };

const ACTIVITY_LOG_CAP = 100;
const DEBOUNCE_MS = 1_000;

function emptyState(timestamp: string): WorldState {
	return { version: 1, updatedAt: timestamp, entities: {}, permissions: {}, activityLog: [] };
}

function deriveStatusFromAction(action: AgentAction): Record<string, unknown> {
	switch (action.type) {
		case "thinking": return { state: "busy", currentAction: "thinking" };
		case "speaking": return { state: "busy", currentAction: "speaking" };
		case "asking": return { state: "waiting", currentAction: "asking", question: action.data.question };
		case "using-tool": return { state: "busy", currentAction: "using-tool", toolName: action.data.tool };
		case "tool-complete": return { state: "busy", currentAction: "working" };
		case "requesting-permission": return { state: "waiting", currentAction: "requesting-permission", tool: action.data.tool };
		case "permission-granted": return { state: "busy", currentAction: "working" };
		case "permission-denied": return { state: "waiting", currentAction: "permission-denied" };
		case "task-started": return { state: "busy", currentAction: "task-started", task: action.data.task };
		case "task-completed": return { state: "idle", currentAction: "idle" };
		case "idle": return { state: "idle", currentAction: "idle" };
		case "error": return { state: "error", currentAction: "error", message: action.data.message };
		default: return {};
	}
}

function toActivityEntry(action: AgentAction): ActivityEntry {
	const summaryParts: string[] = [action.type];
	if (action.data.tool) summaryParts.push(String(action.data.tool));
	if (action.data.task) summaryParts.push(String(action.data.task));
	if (action.data.text) summaryParts.push(String(action.data.text).slice(0, 60));
	return { id: action.id, agentName: action.agentName, timestamp: action.timestamp, type: action.type, summary: summaryParts.join(" ") };
}

export function createWorldStateManager(deps: WorldStateDeps, vaultRoot: string): IWorldStateManager {
	const filePath = deps.paths.join(vaultRoot, ".flowti", "var", "world-state.json");
	let state = loadOrCreate(deps, filePath);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let dirty = false;
	let actionCallback: ((action: AgentAction) => void) | null = null;

	function scheduleWrite(): void {
		dirty = true;
		if (debounceTimer) return;
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			if (dirty) writeToDisk();
		}, DEBOUNCE_MS);
	}

	function writeToDisk(): void {
		dirty = false;
		state = { ...state, updatedAt: deps.clock.iso() };
		const dir = deps.paths.join(vaultRoot, ".flowti", "var");
		if (!deps.disk.existsSync(dir)) deps.disk.mkdirSync(dir, { recursive: true });
		deps.disk.writeFileSync(filePath, JSON.stringify(state, null, "\t"), "utf-8");
	}

	return {
		emitAction(action: AgentAction): void {
			const entity = state.entities[action.agentName];
			if (entity) {
				const status = deriveStatusFromAction(action);
				const updated: WorldEntity = { ...entity, components: { ...entity.components, status } };
				state = { ...state, entities: { ...state.entities, [action.agentName]: updated } };
			}
			const entry = toActivityEntry(action);
			const log = [...state.activityLog, entry];
			if (log.length > ACTIVITY_LOG_CAP) log.splice(0, log.length - ACTIVITY_LOG_CAP);
			state = { ...state, activityLog: log };
			scheduleWrite();
			if (actionCallback) actionCallback(action);
		},

		updateEntity(id: string, type: WorldEntityType, components: Record<string, unknown>): void {
			const existing = state.entities[id];
			const merged = existing ? { ...existing.components, ...components } : components;
			state = { ...state, entities: { ...state.entities, [id]: { id, type, components: merged } } };
			scheduleWrite();
		},

		getState(): WorldState { return state; },

		getEntity(id: string): WorldEntity | null { return state.entities[id] ?? null; },

		flush(): void {
			if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
			writeToDisk();
		},

		setActionCallback(callback: (action: AgentAction) => void): void {
			actionCallback = callback;
		},
	};
}

function loadOrCreate(deps: WorldStateDeps, filePath: string): WorldState {
	if (deps.disk.existsSync(filePath)) {
		try {
			const raw = JSON.parse(deps.disk.readFileSync(filePath, "utf-8")) as WorldState;
			if (raw.version === 1) return raw;
		} catch { /* corrupt file — recreate */ }
	}
	return emptyState(deps.clock.iso());
}
