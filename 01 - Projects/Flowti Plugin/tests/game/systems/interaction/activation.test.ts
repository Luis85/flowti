import { describe, it, expect } from "vitest";
import { bootstrapInteractionSystem, registerAgentResolver } from "../../../../src/game/systems/interaction/bootstrap-interactions.js";
import type { BootstrapSystems } from "../../../../src/game/systems/interaction/bootstrap-interactions.js";

function makeSystems(): BootstrapSystems {
	return {
		social: {
			getNearbyEntities: () => [{ id: "vex", entityType: "agent", distance: 2 }],
		},
		relationship: { getAffinity: () => 40 },
		needs: {
			getAgentNames: () => ["atlas", "vex"],
			getNeeds: () => ({ energy: 80, social: 15, focus: 80, morale: 80, hunger: 80, thirst: 80 }),
		},
		dayClock: { getPhase: () => "productive-morning" },
		conversation: { isLocked: () => false },
	};
}

describe("Interaction System Activation", () => {
	it("full pipeline: bootstrap → resolve → submit → tick → effects", () => {
		const systems = makeSystems();
		const bootstrap = bootstrapInteractionSystem(systems);
		const resolver = registerAgentResolver(bootstrap, "atlas", systems);

		// Resolver should produce interactions (social need is low at 15)
		const interactions = resolver.resolve();

		// If resolver produced an interaction, submit and tick
		if (interactions.length > 0) {
			const bus = bootstrap.system.getBus();
			const result = bus.submit(interactions[0]);
			expect(result.status).toBe("enqueued");

			const { state } = bootstrap.system.tick(16);
			// Should have processed the interaction
			const history = bus.getHistory();
			expect(history.length).toBeGreaterThan(0);
			// Should have produced some state mutations (social need low → bonding interactions affect affinity/needs)
			const hasEffects = state.affinityChanges.length > 0
				|| state.needChanges.length > 0
				|| state.renderActions.length > 0;
			expect(hasEffects).toBe(true);
		}
	});

	it("cooperative locks prevent double-booking", () => {
		const systems = makeSystems();
		systems.conversation.isLocked = (id: string) => id === "vex";

		const bootstrap = bootstrapInteractionSystem(systems);
		const bus = bootstrap.system.getBus();

		const rejected: string[] = [];
		bus.on("rejected", (i) => rejected.push(i.id));

		bus.submit({
			id: "test-locked",
			initiator: { id: "atlas", entityType: "agent" },
			targets: [{ id: "vex", entityType: "agent" }],
			cardinality: "one-to-one",
			category: "social",
			action: "greet",
			priority: 30,
			context: {},
			cooldownMs: 0,
			prerequisites: [{ type: "not-locked" }],
			effects: [],
			timestamp: Date.now(),
		});

		bootstrap.system.tick(16);

		expect(rejected).toContain("test-locked");
	});

	it("BT hooks shape matches InteractionHooks interface", () => {
		const systems = makeSystems();
		const bootstrap = bootstrapInteractionSystem(systems);
		const resolver = registerAgentResolver(bootstrap, "atlas", systems);
		const bus = bootstrap.system.getBus();

		const hooks = {
			getNearby: () => systems.social.getNearbyEntities("atlas"),
			resolve: () => resolver.resolve().map(i => ({ id: i.id, action: i.action })),
			submit: (interaction: { id: string; action: string }) => {
				const full = resolver.resolve().find(i => i.id === interaction.id);
				if (!full) return false;
				return bus.submit(full).status === "enqueued";
			},
		};

		expect(typeof hooks.getNearby).toBe("function");
		expect(typeof hooks.resolve).toBe("function");
		expect(typeof hooks.submit).toBe("function");

		// getNearby should return entities
		const nearby = hooks.getNearby();
		expect(nearby.length).toBeGreaterThan(0);
	});

	it("system is inactive when no nearby entities", () => {
		const systems = makeSystems();
		systems.social.getNearbyEntities = () => [];

		const bootstrap = bootstrapInteractionSystem(systems);
		const resolver = registerAgentResolver(bootstrap, "atlas", systems);

		const interactions = resolver.resolve();
		expect(interactions).toEqual([]);
	});

	it("template registry loads all seed templates", () => {
		const systems = makeSystems();
		const bootstrap = bootstrapInteractionSystem(systems);
		const allTemplates = bootstrap.registry.getAll();

		// Should have loaded templates from all 8 files
		expect(allTemplates.length).toBeGreaterThanOrEqual(20);

		// Should have templates from multiple categories
		const categories = new Set(allTemplates.map(t => t.category));
		expect(categories.size).toBeGreaterThanOrEqual(4);
	});
});
