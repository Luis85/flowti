/**
 * resolver-wiring.test.ts — Layer 1 integration tests verifying that
 * pet, NPC, and room resolvers produce correct Interactions when
 * wired through their factory/bootstrap APIs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InteractionTemplate } from "../../../../../Flowti CLI/src/domain/interactions/interaction-types.js";
import type { NPCInteractionRule, RoomInteractionRule, EnvironmentCondition } from "../../../../../Flowti CLI/src/domain/interactions/intent-resolver-types.js";
import { registerPetResolver } from "../../../../src/game/systems/interaction/bootstrap-interactions.js";
import type { BootstrapSystems, InteractionBootstrap } from "../../../../src/game/systems/interaction/bootstrap-interactions.js";
import { createNPCIntentResolver } from "../../../../src/game/systems/interaction/npc-intent-resolver.js";
import type { NPCResolverConfig } from "../../../../src/game/systems/interaction/npc-intent-resolver.js";
import { createRoomIntentResolver } from "../../../../src/game/systems/interaction/room-intent-resolver.js";
import type { RoomResolverConfig } from "../../../../src/game/systems/interaction/room-intent-resolver.js";

// ── Shared Helpers ──────────────────────────────────────────────────

function makeCareTemplate(): InteractionTemplate {
	return {
		id: "tpl-care-beg-food",
		category: "care",
		action: "beg-food",
		cardinality: "one-to-one",
		initiatorTypes: ["pet"],
		targetTypes: ["agent"],
		prerequisites: [],
		weight: 10,
		tags: ["care"],
		priority: 60,
		cooldownMs: 8000,
		effects: [
			{ type: "need-change", target: "initiator", need: "hunger", amount: 20 },
		],
	};
}

function makeBootstrapStub(): BootstrapSystems {
	return {
		social: {
			getNearbyEntities: () => [{ id: "agent-alpha", entityType: "agent", distance: 2 }],
		},
		relationship: {
			getAffinity: () => 50,
		},
		needs: {
			getAgentNames: () => ["agent-alpha"],
			getNeeds: () => ({ energy: 60, social: 50, focus: 50, morale: 50, hunger: 50, thirst: 50 }),
		},
		dayClock: {
			getPhase: () => "productive-morning",
		},
		conversation: {
			isLocked: () => false,
		},
	};
}

function makeBootstrapResult(templates: InteractionTemplate[]): InteractionBootstrap {
	const registry = {
		getAll: () => templates,
		getById: (id: string) => templates.find((t) => t.id === id),
	};
	return {
		system: {
			getBus: () => ({
				getHistory: () => [],
			}),
		},
		registry,
		resolvers: {
			entities: new Map(),
			director: { resolve: () => [] },
		},
		renderActions: () => [],
	} as unknown as InteractionBootstrap;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("resolver wiring integration", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("pet resolver produces interactions when nearby agent and hunger low", () => {
		const careTpl = makeCareTemplate();
		const bootstrap = makeBootstrapResult([careTpl]);
		const systems = makeBootstrapStub();

		const petState = {
			hunger: 20,
			thirst: 70,
			energy: 50,
			affinity: new Map<string, number>([["agent-alpha", 60]]),
		};

		const resolver = registerPetResolver(
			bootstrap,
			"pet-fluffy",
			systems,
			() => petState,
		);

		const result = resolver.resolve();

		expect(result).toHaveLength(1);
		expect(result[0].initiator).toEqual({ id: "pet-fluffy", entityType: "pet" });
		expect(result[0].category).toBe("care");
		expect(result[0].action).toBe("beg-food");
		expect(result[0].targets[0].id).toBe("agent-alpha");

		// Verify the resolver was registered in the bootstrap map
		expect(bootstrap.resolvers.entities.has("pet-fluffy")).toBe(true);
	});

	it("NPC resolver fires proximity rule when agent nearby", () => {
		const proximityRule: NPCInteractionRule = {
			npcRole: "merchant",
			trigger: "proximity",
			conditions: [],
			interaction: {
				category: "commerce",
				action: "offer-trade",
				cardinality: "one-to-one",
				effects: [{ type: "economy-transaction", target: "initiator", currency: "coin", amount: 5 }],
				cooldownMs: 10000,
			},
			weight: 50,
			cooldownMs: 10000,
		};

		const config: NPCResolverConfig = {
			npcId: "npc-merchant-01",
			npcRole: "merchant",
			rules: [proximityRule],
			getNearby: () => [{ id: "agent-alpha", entityType: "agent", distance: 3 }],
			getCooldown: () => 0,
			now: () => 1000,
		};

		const resolver = createNPCIntentResolver(config);
		const result = resolver.resolve();

		expect(result).toHaveLength(1);
		expect(result[0].initiator).toEqual({ id: "npc-merchant-01", entityType: "npc" });
		expect(result[0].action).toBe("offer-trade");
		expect(result[0].category).toBe("commerce");
		expect(result[0].targets).toEqual([{ id: "agent-alpha", entityType: "agent" }]);
		expect(result[0].id).toBe("npc-npc-merchant-01-1000");
	});

	it("room resolver fires reactive rule when occupancy condition met", () => {
		const occupancyCondition: EnvironmentCondition = {
			type: "occupancy",
			op: ">",
			value: 2,
		};

		const reactiveRule: RoomInteractionRule = {
			roomType: "break-room",
			layer: "reactive",
			conditions: [occupancyCondition],
			interaction: {
				category: "environmental",
				action: "ambient-chatter",
				cardinality: "one-to-many",
				effects: [{ type: "room-mood-shift", mood: "relaxed", amount: 5 }],
				cooldownMs: 15000,
			},
			cooldownMs: 15000,
		};

		const config: RoomResolverConfig = {
			roomId: "room-break-01",
			roomType: "break-room",
			rules: [reactiveRule],
			getOccupancy: () => 4,
			getOccupantIds: () => ["agent-alpha", "agent-beta", "agent-gamma", "agent-delta"],
			getCollectiveMood: () => ({ mood: "relaxed", intensity: 60 }),
			getPhase: () => "productive-morning",
		};

		const resolver = createRoomIntentResolver(config);
		const result = resolver.resolve();

		expect(result).toHaveLength(1);
		expect(result[0].initiator).toEqual({ id: "room-break-01", entityType: "room" });
		expect(result[0].action).toBe("ambient-chatter");
		expect(result[0].category).toBe("environmental");
		expect(result[0].targets).toHaveLength(4);
		expect(result[0].targets.map((t) => t.id)).toEqual([
			"agent-alpha", "agent-beta", "agent-gamma", "agent-delta",
		]);
		expect(result[0].cardinality).toBe("one-to-many");
		expect(result[0].effects).toEqual([{ type: "room-mood-shift", mood: "relaxed", amount: 5 }]);
	});
});
