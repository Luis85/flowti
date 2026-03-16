import { describe, it, expect } from "vitest";
import { createStateStore } from "../../src/data/state-store.js";
import type { WorldState, WorldEntity } from "../../src/data/types.js";

const entity = (id: string, components: Record<string, unknown> = {}): WorldEntity => ({
	id, type: "agent", components,
});

const state = (entities: Record<string, WorldEntity> = {}): WorldState => ({
	version: 1, updatedAt: "", entities, permissions: {}, activityLog: [],
});

describe("StateStore", () => {
	it("detects new entity", () => {
		const store = createStateStore();
		store.setState(state({}));
		const diff = store.applyState(state({ Bob: entity("Bob") }));
		expect(diff.added).toEqual(["Bob"]);
		expect(diff.removed).toEqual([]);
	});
	it("detects removed entity", () => {
		const store = createStateStore();
		store.setState(state({ Bob: entity("Bob") }));
		const diff = store.applyState(state({}));
		expect(diff.removed).toEqual(["Bob"]);
	});
	it("detects changed component", () => {
		const store = createStateStore();
		store.setState(state({ Bob: entity("Bob", { status: { state: "idle" } }) }));
		const diff = store.applyState(state({ Bob: entity("Bob", { status: { state: "busy" } }) }));
		expect(diff.changed).toEqual(["Bob"]);
	});
	it("identical state returns empty diff", () => {
		const store = createStateStore();
		const s = state({ Bob: entity("Bob") });
		store.setState(s);
		const diff = store.applyState(s);
		expect(diff.added).toEqual([]);
		expect(diff.removed).toEqual([]);
		expect(diff.changed).toEqual([]);
	});
});
