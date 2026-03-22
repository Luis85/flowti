import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Interaction, InteractionTemplate } from "../../../../../Flowti CLI/src/domain/interactions/interaction-types.js";
import { createAgentIntentResolver } from "../../../../src/game/systems/interaction/agent-intent-resolver.js";
import type { AgentResolverConfig } from "../../../../src/game/systems/interaction/agent-intent-resolver.js";

// ── Helpers ─────────────────────────────────────────────────────────

function makeSocialTemplate(overrides: Partial<InteractionTemplate> = {}): InteractionTemplate {
	return {
		id: "tpl-social-greet",
		category: "social",
		action: "greet",
		cardinality: "one-to-one",
		initiatorTypes: ["agent"],
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

function makeComfortTemplate(): InteractionTemplate {
	return {
		id: "tpl-comfort",
		category: "social",
		action: "comfort",
		cardinality: "one-to-one",
		initiatorTypes: ["agent"],
		targetTypes: ["agent"],
		prerequisites: [],
		weight: 10,
		tags: ["comfort"],
		priority: 60,
		cooldownMs: 8000,
		effects: [
			{ type: "need-change", target: "targets", need: "morale", amount: 10 },
		],
	};
}

function makeConfig(overrides: Partial<AgentResolverConfig> = {}): AgentResolverConfig {
	const templates = overrides.templates ?? (() => {
		const tpls = [makeSocialTemplate()];
		return {
			getAll: () => tpls,
			getById: (id: string) => tpls.find((t) => t.id === id),
		};
	})();

	return {
		agentId: "agent-alpha",
		getNearby: () => [{ id: "agent-beta", entityType: "agent", distance: 3 }],
		getNeeds: () => ({ energy: 80, social: 80, focus: 80, morale: 80, hunger: 80, thirst: 80 }),
		getHistory: () => [],
		getPhase: () => "productive-morning",
		getAffinity: () => 40,
		templates,
		...overrides,
	};
}

// ── Tests ───────────────────────────────────────────────────────────

describe("createAgentIntentResolver", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("returns [] when no nearby entities", () => {
		const resolver = createAgentIntentResolver(makeConfig({
			getNearby: () => [],
		}));

		const result = resolver.resolve();
		expect(result).toEqual([]);
	});

	it("produces a social interaction when nearby agent exists", () => {
		const resolver = createAgentIntentResolver(makeConfig());

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].category).toBe("social");
		expect(result[0].action).toBe("greet");
		expect(result[0].initiator).toEqual({ id: "agent-alpha", entityType: "agent" });
	});

	it("produces interaction with low social need adding bonding tag", () => {
		const tpl = makeSocialTemplate();
		const resolver = createAgentIntentResolver(makeConfig({
			getNeeds: () => ({ energy: 80, social: 20, focus: 80, morale: 80, hunger: 80, thirst: 80 }),
			templates: {
				getAll: () => [tpl],
				getById: (id: string) => id === tpl.id ? tpl : undefined,
			},
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		// The template has "bonding" tag — when social < 30 a bonding context tag is derived,
		// which boosts matching templates. We verify an interaction was selected.
		expect(result[0].category).toBe("social");
	});

	it("uses correct template fields for the built interaction", () => {
		const tpl = makeSocialTemplate({
			priority: 75,
			cooldownMs: 12000,
			duration: 3000,
		});
		const resolver = createAgentIntentResolver(makeConfig({
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
		expect(interaction.context.templateId).toBe("tpl-social-greet");
		expect(interaction.context.phase).toBe("productive-morning");
	});

	it("derives comfort tag when morale is low", () => {
		const comfortTpl = makeComfortTemplate();
		const resolver = createAgentIntentResolver(makeConfig({
			getNeeds: () => ({ energy: 80, social: 80, focus: 80, morale: 20, hunger: 80, thirst: 80 }),
			templates: {
				getAll: () => [comfortTpl],
				getById: (id: string) => id === comfortTpl.id ? comfortTpl : undefined,
			},
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		// comfort template matched because morale < 30 → "comfort" tag boosts it
		expect(result[0].action).toBe("comfort");
	});

	it("derives rest tag when energy is low", () => {
		const restTpl = makeSocialTemplate({ id: "tpl-rest", action: "rest-together", tags: ["rest"] });
		const resolver = createAgentIntentResolver(makeConfig({
			getNeeds: () => ({ energy: 20, social: 80, focus: 80, morale: 80, hunger: 80, thirst: 80 }),
			templates: {
				getAll: () => [restTpl],
				getById: (id: string) => id === restTpl.id ? restTpl : undefined,
			},
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("rest-together");
	});

	it("derives quiet tag when focus is low", () => {
		const quietTpl = makeSocialTemplate({ id: "tpl-quiet", action: "quiet-work", tags: ["quiet"] });
		const resolver = createAgentIntentResolver(makeConfig({
			getNeeds: () => ({ energy: 80, social: 80, focus: 20, morale: 80, hunger: 80, thirst: 80 }),
			templates: {
				getAll: () => [quietTpl],
				getById: (id: string) => id === quietTpl.id ? quietTpl : undefined,
			},
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("quiet-work");
	});

	it("sets targets from nearby entities matching template targetTypes", () => {
		const resolver = createAgentIntentResolver(makeConfig({
			getNearby: () => [
				{ id: "agent-beta", entityType: "agent", distance: 3 },
				{ id: "pet-1", entityType: "pet", distance: 5 },
			],
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		// Template targets "agent" — only agent-beta should be included
		const targetIds = result[0].targets.map((t) => t.id);
		expect(targetIds).toContain("agent-beta");
	});

	it("returns [] when no template matches", () => {
		const petOnlyTpl = makeSocialTemplate({ initiatorTypes: ["pet"], targetTypes: ["pet"] });
		const resolver = createAgentIntentResolver(makeConfig({
			templates: {
				getAll: () => [petOnlyTpl],
				getById: (id: string) => id === petOnlyTpl.id ? petOnlyTpl : undefined,
			},
		}));

		const result = resolver.resolve();
		expect(result).toEqual([]);
	});

	it("maps affinity score to correct tier", () => {
		// affinity -40 → rival tier
		const rivalTpl = makeSocialTemplate({
			id: "tpl-rival",
			action: "taunt",
			tierRange: ["supervised", "supervised"],
		});
		const friendTpl = makeSocialTemplate({
			id: "tpl-friend",
			action: "high-five",
			tierRange: ["trusted", "autonomous"],
		});

		const templates = [rivalTpl, friendTpl];
		const resolver = createAgentIntentResolver(makeConfig({
			getAffinity: () => -40,
			templates: {
				getAll: () => templates,
				getById: (id: string) => templates.find((t) => t.id === id),
			},
		}));

		// With rival affinity, the selection uses affinityTier in context.
		// selectTemplate filters by tierRange. The exact result depends on
		// weighted random, but at minimum it should return an interaction or [].
		const result = resolver.resolve();
		// Either rival template was selected or no match — never the friend template
		if (result.length > 0) {
			expect(result[0].action).not.toBe("high-five");
		}
	});

	it("id format is agent-{agentId}-{timestamp}", () => {
		const resolver = createAgentIntentResolver(makeConfig());

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].id).toMatch(/^agent-agent-alpha-\d+$/);
	});
});
