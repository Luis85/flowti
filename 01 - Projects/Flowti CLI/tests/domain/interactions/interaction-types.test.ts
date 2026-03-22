import { describe, it, expect } from "vitest";
import {
	createEntityRef,
	isValidEntityRef,
	isValidInteraction,
	MAX_LOCK_DURATION,
	MAX_CHAIN_DEPTH,
	HISTORY_BUFFER_SIZE,
} from "../../../src/domain/interactions/interaction-types.js";
import type {
	EntityRef,
	Interaction,
	InteractionContext,
	InteractionEffect,
} from "../../../src/domain/interactions/interaction-types.js";

function makeInteraction(overrides: Partial<Interaction> = {}): Interaction {
	const initiator: EntityRef = { id: "agent-1", entityType: "agent" };
	const target: EntityRef = { id: "agent-2", entityType: "agent" };
	const context: InteractionContext = { topic: "greeting" };
	const effects: readonly InteractionEffect[] = [
		{ type: "affinity-change", target: "initiator", amount: 1 },
	];
	return {
		id: "int-001",
		initiator,
		targets: [target],
		cardinality: "one-to-one",
		category: "social",
		action: "greet",
		priority: 50,
		context,
		cooldownMs: 5000,
		effects,
		timestamp: Date.now(),
		...overrides,
	};
}

describe("createEntityRef", () => {
	it("creates an agent ref", () => {
		const ref = createEntityRef("agent-1", "agent");
		expect(ref.id).toBe("agent-1");
		expect(ref.entityType).toBe("agent");
	});

	it("creates a director ref with fixed id", () => {
		const ref = createEntityRef("anything", "director");
		expect(ref.id).toBe("director");
		expect(ref.entityType).toBe("director");
	});

	it("creates a room ref", () => {
		const ref = createEntityRef("lobby", "room");
		expect(ref.id).toBe("lobby");
		expect(ref.entityType).toBe("room");
	});
});

describe("isValidEntityRef", () => {
	it("returns true for a valid agent ref", () => {
		const ref: EntityRef = { id: "agent-1", entityType: "agent" };
		expect(isValidEntityRef(ref)).toBe(true);
	});

	it("returns false for empty id", () => {
		expect(isValidEntityRef({ id: "", entityType: "agent" })).toBe(false);
	});

	it("returns false for unknown entity type", () => {
		expect(isValidEntityRef({ id: "x", entityType: "alien" })).toBe(false);
	});

	it("returns false for null", () => {
		expect(isValidEntityRef(null)).toBe(false);
	});

	it("returns false for non-object", () => {
		expect(isValidEntityRef("not-a-ref")).toBe(false);
	});
});

describe("isValidInteraction", () => {
	it("returns false when targets is empty", () => {
		const interaction = makeInteraction({ targets: [] });
		expect(isValidInteraction(interaction)).toBe(false);
	});

	it("returns false when priority > 100", () => {
		const interaction = makeInteraction({ priority: 101 });
		expect(isValidInteraction(interaction)).toBe(false);
	});

	it("returns false when priority < 0", () => {
		const interaction = makeInteraction({ priority: -1 });
		expect(isValidInteraction(interaction)).toBe(false);
	});

	it("returns false when cooldownMs is negative", () => {
		const interaction = makeInteraction({ cooldownMs: -100 });
		expect(isValidInteraction(interaction)).toBe(false);
	});

	it("returns true for a valid interaction", () => {
		const interaction = makeInteraction();
		expect(isValidInteraction(interaction)).toBe(true);
	});

	it("returns false for null", () => {
		expect(isValidInteraction(null)).toBe(false);
	});
});

describe("constants", () => {
	it("MAX_LOCK_DURATION is 15000", () => {
		expect(MAX_LOCK_DURATION).toBe(15000);
	});

	it("MAX_CHAIN_DEPTH is 3", () => {
		expect(MAX_CHAIN_DEPTH).toBe(3);
	});

	it("HISTORY_BUFFER_SIZE is 200", () => {
		expect(HISTORY_BUFFER_SIZE).toBe(200);
	});
});
