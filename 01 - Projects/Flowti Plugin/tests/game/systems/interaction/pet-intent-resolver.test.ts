import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Interaction, InteractionTemplate } from "../../../../../Flowti CLI/src/domain/interactions/interaction-types.js";
import { createPetIntentResolver } from "../../../../src/game/systems/interaction/pet-intent-resolver.js";
import type { PetResolverConfig } from "../../../../src/game/systems/interaction/pet-intent-resolver.js";

// ── Helpers ─────────────────────────────────────────────────────────

function makePlayfulTemplate(overrides: Partial<InteractionTemplate> = {}): InteractionTemplate {
	return {
		id: "tpl-playful-zoomies",
		category: "playful",
		action: "zoomies",
		cardinality: "one-to-one",
		initiatorTypes: ["pet"],
		targetTypes: ["agent"],
		prerequisites: [],
		weight: 10,
		tags: ["playful"],
		priority: 40,
		cooldownMs: 5000,
		effects: [
			{ type: "affinity-change", target: "initiator", amount: 3 },
		],
		...overrides,
	};
}

function makeCareTemplate(overrides: Partial<InteractionTemplate> = {}): InteractionTemplate {
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
		...overrides,
	};
}

function makeWorkTemplate(): InteractionTemplate {
	return {
		id: "tpl-work-code-review",
		category: "work",
		action: "code-review",
		cardinality: "one-to-one",
		initiatorTypes: ["agent", "pet"],
		targetTypes: ["agent"],
		prerequisites: [],
		weight: 10,
		tags: [],
		priority: 50,
		cooldownMs: 10000,
		effects: [],
	};
}

function makeCommerceTemplate(): InteractionTemplate {
	return {
		id: "tpl-commerce-buy",
		category: "commerce",
		action: "buy-item",
		cardinality: "one-to-one",
		initiatorTypes: ["agent", "pet"],
		targetTypes: ["npc"],
		prerequisites: [],
		weight: 10,
		tags: [],
		priority: 50,
		cooldownMs: 10000,
		effects: [],
	};
}

function makeSocialTemplate(overrides: Partial<InteractionTemplate> = {}): InteractionTemplate {
	return {
		id: "tpl-social-nuzzle",
		category: "social",
		action: "nuzzle",
		cardinality: "one-to-one",
		initiatorTypes: ["pet"],
		targetTypes: ["agent"],
		prerequisites: [],
		weight: 10,
		tags: ["bonding"],
		priority: 50,
		cooldownMs: 5000,
		effects: [
			{ type: "affinity-change", target: "initiator", amount: 2 },
		],
		...overrides,
	};
}

function makeConfig(overrides: Partial<PetResolverConfig> = {}): PetResolverConfig {
	const templates = overrides.templates ?? (() => {
		const tpls = [makePlayfulTemplate(), makeCareTemplate(), makeSocialTemplate()];
		return {
			getAll: () => tpls,
			getById: (id: string) => tpls.find((t) => t.id === id),
		};
	})();

	return {
		petId: "pet-fluffy",
		getNearby: () => [{ id: "agent-alpha", entityType: "agent", distance: 2 }],
		getPetState: () => ({
			hunger: 70,
			thirst: 70,
			energy: 60,
			affinity: new Map<string, number>([["agent-alpha", 50]]),
		}),
		getHistory: () => [],
		templates,
		...overrides,
	};
}

// ── Tests ───────────────────────────────────────────────────────────

describe("createPetIntentResolver", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("filters out work and commerce categories", () => {
		const workTpl = makeWorkTemplate();
		const commerceTpl = makeCommerceTemplate();
		const socialTpl = makeSocialTemplate();

		const allTemplates = [workTpl, commerceTpl, socialTpl];
		const resolver = createPetIntentResolver(makeConfig({
			templates: {
				getAll: () => allTemplates,
				getById: (id: string) => allTemplates.find((t) => t.id === id),
			},
		}));

		// Run multiple times to verify work/commerce never appear
		for (let i = 0; i < 20; i++) {
			const result = resolver.resolve();
			if (result.length > 0) {
				expect(result[0].category).not.toBe("work");
				expect(result[0].category).not.toBe("commerce");
				expect(["social", "care", "playful", "reactive"]).toContain(result[0].category);
			}
		}
	});

	it("produces zoomies interaction when energy high (>80) and playful template available", () => {
		const playfulTpl = makePlayfulTemplate();
		const resolver = createPetIntentResolver(makeConfig({
			getPetState: () => ({
				hunger: 70,
				thirst: 70,
				energy: 90,
				affinity: new Map<string, number>(),
			}),
			templates: {
				getAll: () => [playfulTpl],
				getById: (id: string) => id === playfulTpl.id ? playfulTpl : undefined,
			},
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].category).toBe("playful");
		expect(result[0].action).toBe("zoomies");
	});

	it("produces care interaction (beg-food) when hunger low (<30)", () => {
		const careTpl = makeCareTemplate();
		const resolver = createPetIntentResolver(makeConfig({
			getPetState: () => ({
				hunger: 20,
				thirst: 70,
				energy: 50,
				affinity: new Map<string, number>(),
			}),
			templates: {
				getAll: () => [careTpl],
				getById: (id: string) => id === careTpl.id ? careTpl : undefined,
			},
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].category).toBe("care");
		expect(result[0].action).toBe("beg-food");
	});

	it("returns empty when no nearby entities", () => {
		const resolver = createPetIntentResolver(makeConfig({
			getNearby: () => [],
		}));

		const result = resolver.resolve();
		expect(result).toEqual([]);
	});

	it("sets entityType to pet on initiator", () => {
		const resolver = createPetIntentResolver(makeConfig());

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].initiator.entityType).toBe("pet");
		expect(result[0].initiator.id).toBe("pet-fluffy");
	});

	it("id format is pet-{petId}-{timestamp}", () => {
		const resolver = createPetIntentResolver(makeConfig());

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].id).toMatch(/^pet-pet-fluffy-\d+$/);
	});

	it("uses correct template fields for the built interaction", () => {
		const tpl = makePlayfulTemplate({
			priority: 75,
			cooldownMs: 12000,
			duration: 3000,
		});
		const resolver = createPetIntentResolver(makeConfig({
			getPetState: () => ({
				hunger: 70,
				thirst: 70,
				energy: 90,
				affinity: new Map<string, number>(),
			}),
			templates: {
				getAll: () => [tpl],
				getById: (id: string) => id === tpl.id ? tpl : undefined,
			},
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);

		const interaction = result[0];
		expect(interaction.priority).toBe(75);
		expect(interaction.cooldownMs).toBe(12000);
		expect(interaction.duration).toBe(3000);
		expect(interaction.cardinality).toBe("one-to-one");
		expect(interaction.effects).toEqual(tpl.effects);
		expect(interaction.context.templateId).toBe("tpl-playful-zoomies");
	});

	it("returns [] when no template matches pet initiatorType", () => {
		const agentOnlyTpl = makeSocialTemplate({
			initiatorTypes: ["agent"],
			targetTypes: ["agent"],
		});
		const resolver = createPetIntentResolver(makeConfig({
			templates: {
				getAll: () => [agentOnlyTpl],
				getById: (id: string) => id === agentOnlyTpl.id ? agentOnlyTpl : undefined,
			},
		}));

		const result = resolver.resolve();
		expect(result).toEqual([]);
	});

	it("includes reactive category templates", () => {
		const reactiveTpl: InteractionTemplate = {
			id: "tpl-reactive-startle",
			category: "reactive",
			action: "startle",
			cardinality: "one-to-one",
			initiatorTypes: ["pet"],
			targetTypes: ["agent"],
			prerequisites: [],
			weight: 10,
			tags: [],
			priority: 70,
			cooldownMs: 3000,
			effects: [],
		};

		const resolver = createPetIntentResolver(makeConfig({
			templates: {
				getAll: () => [reactiveTpl],
				getById: (id: string) => id === reactiveTpl.id ? reactiveTpl : undefined,
			},
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].category).toBe("reactive");
		expect(result[0].action).toBe("startle");
	});
});
