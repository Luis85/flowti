import type { TreeRef } from './bt-tree-loader.js';

/**
 * Persisted view state (survives Obsidian restart).
 * If `agentId` is set, restores to live-agent detail mode.
 * If `staticRef` + `staticLabel` are set, restores to static-tree detail mode.
 * Otherwise, the index is shown.
 */
export interface BTInspectorState {
	agentId?: string;
	staticRef?: TreeRef;
	staticLabel?: string;
}

/**
 * Type guard — verifies an unknown value matches the TreeRef discriminated union.
 * Exported so both the view and its tests can use it.
 */
export function isTreeRef(value: unknown): value is TreeRef {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	if (v['kind'] === 'base') {
		return typeof v['path'] === 'string';
	}
	if (v['kind'] === 'job') {
		return typeof v['branchPath'] === 'string' && typeof v['basePath'] === 'string';
	}
	return false;
}

/**
 * Defensively coerce arbitrary persisted state into our shape.
 * Obsidian treats view state as opaque JSON, so anything could land here —
 * including stale keys from a previous version, partially-written data, or
 * user-hand-edited workspace files.
 */
export function parseState(raw: unknown): BTInspectorState {
	if (typeof raw !== 'object' || raw === null) return {};
	const obj = raw as Record<string, unknown>;
	const result: BTInspectorState = {};
	if (typeof obj['agentId'] === 'string') {
		result.agentId = obj['agentId'];
	}
	if (isTreeRef(obj['staticRef']) && typeof obj['staticLabel'] === 'string') {
		result.staticRef = obj['staticRef'];
		result.staticLabel = obj['staticLabel'];
	}
	return result;
}
