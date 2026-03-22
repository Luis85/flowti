import { describe, it, expect, beforeEach } from "vitest";
import { InteractionSystem } from "../../../../src/game/systems/interaction/interaction-system.js";

function makeInteraction(overrides: Record<string, unknown> = {}) {
	return {
		id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
		initiator: { id: "agent-1", entityType: "agent" as const },
		targets: [{ id: "agent-2", entityType: "agent" as const }],
		cardinality: "one-to-one" as const,
		category: "social" as const,
		action: "greet",
		priority: 50,
		context: { topic: "hello" },
		cooldownMs: 5000,
		effects: [
			{ type: "affinity-change" as const, target: "initiator" as const, amount: 1 },
		],
		timestamp: Date.now(),
		...overrides,
	};
}

describe("InteractionSystem", () => {
	let system: InteractionSystem;

	beforeEach(() => {
		system = new InteractionSystem();
	});

	describe("constructor", () => {
		it("creates an InteractionSystem instance", () => {
			expect(system).toBeInstanceOf(InteractionSystem);
		});
	});

	describe("getBus()", () => {
		it("returns the underlying interaction bus", () => {
			const bus = system.getBus();
			expect(bus).toBeDefined();
			expect(typeof bus.submit).toBe("function");
			expect(typeof bus.tick).toBe("function");
		});
	});

	describe("tick()", () => {
		it("returns actions and state from a tick with no submissions", () => {
			const result = system.tick(16);
			expect(result.actions).toEqual([]);
			expect(result.state).toBeDefined();
			expect(result.state.affinityChanges).toEqual([]);
		});

		it("processes submitted interactions on tick", () => {
			const bus = system.getBus();
			const interaction = makeInteraction();
			const submitResult = bus.submit(interaction);
			expect(submitResult.status).toBe("enqueued");

			const result = system.tick(0);
			expect(result.actions.length).toBeGreaterThan(0);
			expect(result.actions[0].interactionId).toBe(interaction.id);
			expect(result.state.affinityChanges.length).toBeGreaterThan(0);
		});
	});

	describe("isEntityLocked()", () => {
		it("returns false when entity is not locked", () => {
			expect(system.isEntityLocked("agent-1")).toBe(false);
		});

		it("returns true when entity is locked by active interaction", () => {
			const bus = system.getBus();
			const interaction = makeInteraction({ duration: 3000 });
			bus.submit(interaction);
			system.tick(0);

			expect(system.isEntityLocked("agent-1")).toBe(true);
			expect(system.isEntityLocked("agent-2")).toBe(true);
		});

		it("returns false after lock expires", () => {
			const bus = system.getBus();
			const interaction = makeInteraction({ duration: 1000 });
			bus.submit(interaction);
			system.tick(0);

			expect(system.isEntityLocked("agent-1")).toBe(true);

			system.tick(1000);
			expect(system.isEntityLocked("agent-1")).toBe(false);
		});
	});

	describe("full lifecycle", () => {
		it("submits, ticks, and returns effects from an interaction", () => {
			const bus = system.getBus();
			const interaction = makeInteraction({
				effects: [
					{ type: "need-change", target: "initiator", need: "social", amount: 10 },
				],
			});
			bus.submit(interaction);

			const result = system.tick(16);
			expect(result.state.needChanges.length).toBe(1);
			expect(result.state.needChanges[0].need).toBe("social");
			expect(result.state.needChanges[0].amount).toBe(10);
		});
	});

	describe("options forwarding", () => {
		it("accepts checkPrerequisite option", () => {
			const checker = () => false;
			const systemWithChecker = new InteractionSystem({ checkPrerequisite: checker });
			const bus = systemWithChecker.getBus();

			const interaction = makeInteraction({
				prerequisites: [{ type: "proximity", maxDistance: 5 }],
			});
			bus.submit(interaction);
			const result = systemWithChecker.tick(0);

			// Interaction should be rejected because checker returns false
			expect(result.actions.length).toBe(0);
		});
	});
});
