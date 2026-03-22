import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InteractionTemplate } from "../../../../../Flowti CLI/src/domain/interactions/interaction-types.js";
import { createDirectorIntentResolver } from "../../../../src/game/systems/interaction/director-intent-resolver.js";
import type { DirectorResolverConfig } from "../../../../src/game/systems/interaction/director-intent-resolver.js";

// ── Helpers ─────────────────────────────────────────────────────────

function makeTemplate(overrides: Partial<InteractionTemplate> = {}): InteractionTemplate {
	return {
		id: "tpl-director-meeting",
		category: "directive",
		action: "team-meeting",
		cardinality: "one-to-many",
		initiatorTypes: ["director"],
		targetTypes: ["agent"],
		prerequisites: [],
		weight: 100,
		tags: ["meeting"],
		priority: 95,
		cooldownMs: 60000,
		duration: 10000,
		effects: [
			{ type: "need-change", target: "targets", need: "social", amount: 15 },
		],
		...overrides,
	};
}

function makeConfig(overrides: Partial<DirectorResolverConfig> = {}): DirectorResolverConfig {
	const templates = [makeTemplate()];
	return {
		templates: {
			getAll: () => templates,
			getById: (id: string) => templates.find((t) => t.id === id),
		},
		...overrides,
	};
}

// ── Tests ───────────────────────────────────────────────────────────

describe("createDirectorIntentResolver", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe("resolve()", () => {
		it("returns empty array (director is event-driven, not tick-driven)", () => {
			const { resolver } = createDirectorIntentResolver(makeConfig());

			const result = resolver.resolve();
			expect(result).toEqual([]);
		});

		it("sets entityType to director", () => {
			const { resolver } = createDirectorIntentResolver(makeConfig());
			expect(resolver.entityType).toBe("director");
		});
	});

	describe("createDirectorInteraction()", () => {
		it("builds correct interaction from template", () => {
			const { createDirectorInteraction } = createDirectorIntentResolver(makeConfig());
			const targets = [
				{ id: "agent-alpha", entityType: "agent" as const },
				{ id: "agent-beta", entityType: "agent" as const },
			];

			const interaction = createDirectorInteraction("tpl-director-meeting", targets);
			expect(interaction).not.toBeNull();
			expect(interaction!.action).toBe("team-meeting");
			expect(interaction!.category).toBe("directive");
			expect(interaction!.cardinality).toBe("one-to-many");
			expect(interaction!.priority).toBe(95);
			expect(interaction!.cooldownMs).toBe(60000);
			expect(interaction!.duration).toBe(10000);
			expect(interaction!.effects).toEqual([
				{ type: "need-change", target: "targets", need: "social", amount: 15 },
			]);
		});

		it("uses director as initiator", () => {
			const { createDirectorInteraction } = createDirectorIntentResolver(makeConfig());
			const targets = [{ id: "agent-alpha", entityType: "agent" as const }];

			const interaction = createDirectorInteraction("tpl-director-meeting", targets);
			expect(interaction).not.toBeNull();
			expect(interaction!.initiator).toEqual({ id: "director", entityType: "director" });
		});

		it("sets targets from parameter", () => {
			const { createDirectorInteraction } = createDirectorIntentResolver(makeConfig());
			const targets = [
				{ id: "agent-alpha", entityType: "agent" as const },
				{ id: "agent-beta", entityType: "agent" as const },
				{ id: "agent-gamma", entityType: "agent" as const },
			];

			const interaction = createDirectorInteraction("tpl-director-meeting", targets);
			expect(interaction).not.toBeNull();
			expect(interaction!.targets).toEqual(targets);
		});

		it("id starts with director-", () => {
			const { createDirectorInteraction } = createDirectorIntentResolver(makeConfig());
			const targets = [{ id: "agent-alpha", entityType: "agent" as const }];

			const interaction = createDirectorInteraction("tpl-director-meeting", targets);
			expect(interaction).not.toBeNull();
			expect(interaction!.id).toMatch(/^director-\d+$/);
		});

		it("returns null when template not found", () => {
			const { createDirectorInteraction } = createDirectorIntentResolver(makeConfig());
			const targets = [{ id: "agent-alpha", entityType: "agent" as const }];

			const interaction = createDirectorInteraction("nonexistent-template", targets);
			expect(interaction).toBeNull();
		});

		it("copies template context with templateId", () => {
			const { createDirectorInteraction } = createDirectorIntentResolver(makeConfig());
			const targets = [{ id: "agent-alpha", entityType: "agent" as const }];

			const interaction = createDirectorInteraction("tpl-director-meeting", targets);
			expect(interaction).not.toBeNull();
			expect(interaction!.context.templateId).toBe("tpl-director-meeting");
		});
	});
});
