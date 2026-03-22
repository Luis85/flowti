import { describe, it, expect } from "vitest";
import {
	createTemplateRegistry,
	selectTemplate,
	type SelectionContext,
} from "../../../src/domain/interactions/interaction-templates.js";
import type {
	InteractionTemplate,
	InteractionEntityType,
	Interaction,
} from "../../../src/domain/interactions/interaction-types.js";

// ── Helper ──────────────────────────────────────────────────────────

function makeTemplate(overrides: Partial<InteractionTemplate> = {}): InteractionTemplate {
	return {
		id: "tpl-default",
		category: "social",
		action: "chat",
		cardinality: "one-to-one",
		initiatorTypes: ["agent"],
		targetTypes: ["agent"],
		prerequisites: [],
		weight: 10,
		tags: [],
		priority: 5,
		cooldownMs: 3000,
		effects: [],
		...overrides,
	};
}

function makeInteraction(templateId: string): Interaction {
	return {
		id: `int-${templateId}`,
		initiator: { id: "a1", entityType: "agent" },
		targets: [{ id: "a2", entityType: "agent" }],
		cardinality: "one-to-one",
		category: "social",
		action: "chat",
		priority: 5,
		context: { templateId },
		cooldownMs: 3000,
		effects: [],
		timestamp: Date.now(),
	};
}

function baseContext(overrides: Partial<SelectionContext> = {}): SelectionContext {
	return {
		initiatorType: "agent",
		targetTypes: ["agent"],
		history: [],
		...overrides,
	};
}

// ── createTemplateRegistry ──────────────────────────────────────────

describe("createTemplateRegistry", () => {
	it("returns all registered templates via getAll", () => {
		const t1 = makeTemplate({ id: "tpl-1" });
		const t2 = makeTemplate({ id: "tpl-2" });
		const registry = createTemplateRegistry([t1, t2]);

		expect(registry.getAll()).toHaveLength(2);
	});

	it("retrieves a template by id", () => {
		const t1 = makeTemplate({ id: "tpl-1", action: "wave" });
		const registry = createTemplateRegistry([t1]);

		expect(registry.getById("tpl-1")).toEqual(t1);
	});

	it("returns undefined for unknown id", () => {
		const registry = createTemplateRegistry([makeTemplate({ id: "tpl-1" })]);

		expect(registry.getById("unknown")).toBeUndefined();
	});

	it("handles empty template list", () => {
		const registry = createTemplateRegistry([]);

		expect(registry.getAll()).toHaveLength(0);
		expect(registry.getById("any")).toBeUndefined();
	});
});

// ── selectTemplate — filtering ──────────────────────────────────────

describe("selectTemplate — filtering", () => {
	it("filters by initiator type", () => {
		const t1 = makeTemplate({ id: "tpl-agent", initiatorTypes: ["agent"] });
		const t2 = makeTemplate({ id: "tpl-pet", initiatorTypes: ["pet"] });
		const registry = createTemplateRegistry([t1, t2]);

		const results = new Set<string>();
		for (let i = 0; i < 50; i++) {
			const selected = selectTemplate(registry, baseContext({ initiatorType: "pet" }));
			if (selected) results.add(selected.id);
		}

		expect(results.has("tpl-pet")).toBe(true);
		expect(results.has("tpl-agent")).toBe(false);
	});

	it("filters by target type overlap", () => {
		const t1 = makeTemplate({ id: "tpl-targets-agent", targetTypes: ["agent"] });
		const t2 = makeTemplate({ id: "tpl-targets-npc", targetTypes: ["npc"] });
		const registry = createTemplateRegistry([t1, t2]);

		const results = new Set<string>();
		for (let i = 0; i < 50; i++) {
			const selected = selectTemplate(registry, baseContext({ targetTypes: ["npc"] }));
			if (selected) results.add(selected.id);
		}

		expect(results.has("tpl-targets-npc")).toBe(true);
		expect(results.has("tpl-targets-agent")).toBe(false);
	});

	it("returns null when no templates match", () => {
		const t1 = makeTemplate({ id: "tpl-1", initiatorTypes: ["npc"] });
		const registry = createTemplateRegistry([t1]);

		const result = selectTemplate(registry, baseContext({ initiatorType: "agent" }));
		expect(result).toBeNull();
	});

	it("returns null for empty registry", () => {
		const registry = createTemplateRegistry([]);
		const result = selectTemplate(registry, baseContext());
		expect(result).toBeNull();
	});
});

// ── selectTemplate — phase filter ───────────────────────────────────

describe("selectTemplate — phase filter", () => {
	it("excludes templates with non-matching phase", () => {
		const t1 = makeTemplate({ id: "tpl-morning", phaseFilter: ["morning-arrival"] });
		const registry = createTemplateRegistry([t1]);

		const result = selectTemplate(registry, baseContext({ currentPhase: "lunch" }));
		expect(result).toBeNull();
	});

	it("includes templates with matching phase", () => {
		const t1 = makeTemplate({ id: "tpl-morning", phaseFilter: ["morning-arrival", "lunch"] });
		const registry = createTemplateRegistry([t1]);

		const result = selectTemplate(registry, baseContext({ currentPhase: "lunch" }));
		expect(result).not.toBeNull();
		expect(result?.id).toBe("tpl-morning");
	});

	it("includes templates with no phaseFilter when currentPhase is set", () => {
		const t1 = makeTemplate({ id: "tpl-any" });
		const registry = createTemplateRegistry([t1]);

		const result = selectTemplate(registry, baseContext({ currentPhase: "lunch" }));
		expect(result).not.toBeNull();
	});

	it("includes templates with phaseFilter when currentPhase is not set", () => {
		const t1 = makeTemplate({ id: "tpl-morning", phaseFilter: ["morning-arrival"] });
		const registry = createTemplateRegistry([t1]);

		const result = selectTemplate(registry, baseContext());
		expect(result).not.toBeNull();
	});
});

// ── selectTemplate — tier range filter ──────────────────────────────

describe("selectTemplate — tier range filter", () => {
	it("excludes templates outside tier range", () => {
		const t1 = makeTemplate({ id: "tpl-friend", tierRange: ["friend", "best-friend"] });
		const registry = createTemplateRegistry([t1]);

		const result = selectTemplate(registry, baseContext({ affinityTier: "acquaintance" }));
		expect(result).toBeNull();
	});

	it("includes templates within tier range", () => {
		const t1 = makeTemplate({ id: "tpl-social", tierRange: ["acquaintance", "best-friend"] });
		const registry = createTemplateRegistry([t1]);

		const result = selectTemplate(registry, baseContext({ affinityTier: "colleague" }));
		expect(result).not.toBeNull();
		expect(result?.id).toBe("tpl-social");
	});

	it("includes templates with no tierRange when affinityTier is set", () => {
		const t1 = makeTemplate({ id: "tpl-any" });
		const registry = createTemplateRegistry([t1]);

		const result = selectTemplate(registry, baseContext({ affinityTier: "colleague" }));
		expect(result).not.toBeNull();
	});

	it("includes templates with tierRange when affinityTier is not set", () => {
		const t1 = makeTemplate({ id: "tpl-friend", tierRange: ["friend", "best-friend"] });
		const registry = createTemplateRegistry([t1]);

		const result = selectTemplate(registry, baseContext());
		expect(result).not.toBeNull();
	});
});

// ── selectTemplate — recency penalty ────────────────────────────────

describe("selectTemplate — recency penalty", () => {
	it("recently used templates are selected less often", () => {
		const fresh = makeTemplate({ id: "tpl-fresh", weight: 10 });
		const recent = makeTemplate({ id: "tpl-recent", weight: 10 });
		const registry = createTemplateRegistry([fresh, recent]);

		const history = Array.from({ length: 5 }, () => makeInteraction("tpl-recent"));

		const counts = { fresh: 0, recent: 0 };
		for (let i = 0; i < 200; i++) {
			const selected = selectTemplate(registry, baseContext({ history }));
			if (selected?.id === "tpl-fresh") counts.fresh++;
			if (selected?.id === "tpl-recent") counts.recent++;
		}

		expect(counts.fresh).toBeGreaterThan(counts.recent * 1.3);
	});

	it("only checks last 10 history entries", () => {
		const t1 = makeTemplate({ id: "tpl-old", weight: 10 });
		const t2 = makeTemplate({ id: "tpl-other", weight: 10 });
		const registry = createTemplateRegistry([t1, t2]);

		// tpl-old appeared 5 times but all beyond the last 10 entries
		const oldHistory = Array.from({ length: 5 }, () => makeInteraction("tpl-old"));
		const recentHistory = Array.from({ length: 10 }, () => makeInteraction("tpl-other"));
		const history = [...oldHistory, ...recentHistory];

		const counts = { old: 0, other: 0 };
		for (let i = 0; i < 200; i++) {
			const selected = selectTemplate(registry, baseContext({ history }));
			if (selected?.id === "tpl-old") counts.old++;
			if (selected?.id === "tpl-other") counts.other++;
		}

		// tpl-old should NOT be penalized (outside last 10), so expect roughly equal or old > other*1.3
		// Actually tpl-other IS in the last 10 so it gets the penalty
		expect(counts.old).toBeGreaterThan(counts.other * 1.3);
	});
});

// ── selectTemplate — tag boost ──────────────────────────────────────

describe("selectTemplate — tag boost", () => {
	it("templates with matching tags are selected more often", () => {
		const tagged = makeTemplate({ id: "tpl-tagged", weight: 10, tags: ["morning", "social"] });
		const untagged = makeTemplate({ id: "tpl-untagged", weight: 10, tags: ["evening"] });
		const registry = createTemplateRegistry([tagged, untagged]);

		const counts = { tagged: 0, untagged: 0 };
		for (let i = 0; i < 200; i++) {
			const selected = selectTemplate(registry, baseContext({ contextTags: ["morning"] }));
			if (selected?.id === "tpl-tagged") counts.tagged++;
			if (selected?.id === "tpl-untagged") counts.untagged++;
		}

		expect(counts.tagged).toBeGreaterThan(counts.untagged * 1.3);
	});

	it("no boost when contextTags is not provided", () => {
		const tagged = makeTemplate({ id: "tpl-tagged", weight: 10, tags: ["morning"] });
		const untagged = makeTemplate({ id: "tpl-untagged", weight: 10, tags: [] });
		const registry = createTemplateRegistry([tagged, untagged]);

		const counts = { tagged: 0, untagged: 0 };
		for (let i = 0; i < 200; i++) {
			const selected = selectTemplate(registry, baseContext());
			if (selected?.id === "tpl-tagged") counts.tagged++;
			if (selected?.id === "tpl-untagged") counts.untagged++;
		}

		// Should be roughly equal — neither should dominate by 2x
		const ratio = counts.tagged / (counts.untagged || 1);
		expect(ratio).toBeGreaterThan(0.5);
		expect(ratio).toBeLessThan(2.0);
	});
});
