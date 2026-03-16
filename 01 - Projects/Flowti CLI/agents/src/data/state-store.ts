import type { WorldState } from "./types.js";

export interface StateDiff {
	readonly added: string[];
	readonly removed: string[];
	readonly changed: string[];
}

export interface StateStore {
	getState(): WorldState | null;
	setState(state: WorldState): void;
	applyState(next: WorldState): StateDiff;
	getEntity(id: string): WorldState["entities"][string] | undefined;
}

export function createStateStore(): StateStore {
	let current: WorldState | null = null;

	return {
		getState: () => current,
		setState: (s) => { current = s; },
		getEntity: (id) => current?.entities[id],
		applyState(next) {
			const prev = current;
			current = next;
			if (!prev) return { added: Object.keys(next.entities), removed: [], changed: [] };
			const prevIds = new Set(Object.keys(prev.entities));
			const nextIds = new Set(Object.keys(next.entities));
			const added = [...nextIds].filter((id) => !prevIds.has(id));
			const removed = [...prevIds].filter((id) => !nextIds.has(id));
			const changed = [...nextIds].filter((id) =>
				prevIds.has(id) && JSON.stringify(prev.entities[id]) !== JSON.stringify(next.entities[id]),
			);
			return { added, removed, changed };
		},
	};
}
