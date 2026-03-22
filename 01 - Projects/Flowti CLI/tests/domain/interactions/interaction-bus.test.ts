import { describe, it, expect, beforeEach, vi } from "vitest";
import { createInteractionBus } from "../../../src/domain/interactions/interaction-bus.js";
import {
	MAX_LOCK_DURATION,
	MAX_CHAIN_DEPTH,
	HISTORY_BUFFER_SIZE,
} from "../../../src/domain/interactions/interaction-types.js";
import type {
	Interaction,
	EntityRef,
	InteractionContext,
	InteractionEffect,
	InteractionTemplate,
	InteractionCategory,
} from "../../../src/domain/interactions/interaction-types.js";
import type { EffectState } from "../../../src/domain/interactions/interaction-bus.js";

function makeInteraction(overrides: Partial<Interaction> = {}): Interaction {
	const initiator: EntityRef = { id: "agent-1", entityType: "agent" };
	const target: EntityRef = { id: "agent-2", entityType: "agent" };
	const context: InteractionContext = { topic: "greeting" };
	const effects: readonly InteractionEffect[] = [
		{ type: "affinity-change", target: "initiator", amount: 1 },
	];
	return {
		id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

// ── submit ──────────────────────────────────────────────────────────

describe("submit", () => {
	let bus: ReturnType<typeof createInteractionBus>;

	beforeEach(() => {
		bus = createInteractionBus();
	});

	it("enqueues a valid interaction", () => {
		const interaction = makeInteraction();
		const result = bus.submit(interaction);
		expect(result.status).toBe("enqueued");
		if (result.status === "enqueued") {
			expect(result.interactionId).toBe(interaction.id);
		}
	});

	it("rejects an interaction with no targets", () => {
		const interaction = makeInteraction({ targets: [] });
		const result = bus.submit(interaction);
		expect(result.status).toBe("rejected");
	});

	it("rejects an interaction with priority > 100", () => {
		const interaction = makeInteraction({ priority: 101 });
		const result = bus.submit(interaction);
		expect(result.status).toBe("rejected");
	});

	it("rejects an interaction with priority < 0", () => {
		const interaction = makeInteraction({ priority: -1 });
		const result = bus.submit(interaction);
		expect(result.status).toBe("rejected");
	});

	it("rejects an interaction with negative cooldownMs", () => {
		const interaction = makeInteraction({ cooldownMs: -100 });
		const result = bus.submit(interaction);
		expect(result.status).toBe("rejected");
	});
});

// ── tick — locking ─────────────────────────────────────────────────

describe("tick — locking", () => {
	let bus: ReturnType<typeof createInteractionBus>;

	beforeEach(() => {
		bus = createInteractionBus();
	});

	it("locks participants during interaction", () => {
		const interaction = makeInteraction({ duration: 3000 });
		bus.submit(interaction);
		bus.tick(0);

		expect(bus.isEntityLocked("agent-1")).toBe(true);
		expect(bus.isEntityLocked("agent-2")).toBe(true);
	});

	it("rejects interaction when target is locked", () => {
		const first = makeInteraction({ id: "first", duration: 5000 });
		bus.submit(first);
		bus.tick(0);

		const second = makeInteraction({ id: "second", priority: 50, duration: 1000 });
		bus.submit(second);
		const result = bus.tick(0);

		// second should be rejected — target agent-2 is locked
		expect(result.actions.some(a => a.interactionId === "second")).toBe(false);
	});

	it("override priority (91+) preempts existing interaction", () => {
		const events: Array<{ event: string; id: string }> = [];
		const first = makeInteraction({ id: "first", duration: 5000, priority: 50 });
		bus.submit(first);
		bus.tick(0);

		bus.on("preempted", (i) => events.push({ event: "preempted", id: i.id }));
		bus.on("started", (i) => events.push({ event: "started", id: i.id }));

		const override = makeInteraction({ id: "override", priority: 91, duration: 2000 });
		bus.submit(override);
		bus.tick(0);

		expect(events.some(e => e.event === "preempted" && e.id === "first")).toBe(true);
		expect(events.some(e => e.event === "started" && e.id === "override")).toBe(true);
	});

	it("expires lock after duration elapses", () => {
		const interaction = makeInteraction({ duration: 2000 });
		bus.submit(interaction);
		bus.tick(0);

		expect(bus.isEntityLocked("agent-1")).toBe(true);

		bus.tick(2000);

		expect(bus.isEntityLocked("agent-1")).toBe(false);
		expect(bus.isEntityLocked("agent-2")).toBe(false);
	});

	it("watchdog releases lock at MAX_LOCK_DURATION", () => {
		const interaction = makeInteraction({ duration: MAX_LOCK_DURATION + 5000 });
		bus.submit(interaction);
		bus.tick(0);

		expect(bus.isEntityLocked("agent-1")).toBe(true);

		bus.tick(MAX_LOCK_DURATION);

		expect(bus.isEntityLocked("agent-1")).toBe(false);
	});

	it("does not lock participants when duration is 0", () => {
		const interaction = makeInteraction({ duration: 0 });
		bus.submit(interaction);
		bus.tick(0);

		expect(bus.isEntityLocked("agent-1")).toBe(false);
		expect(bus.isEntityLocked("agent-2")).toBe(false);
	});

	it("does not lock participants when duration is undefined", () => {
		const interaction = makeInteraction();
		bus.submit(interaction);
		bus.tick(0);

		expect(bus.isEntityLocked("agent-1")).toBe(false);
	});
});

// ── tick — prerequisite validation ─────────────────────────────────

describe("tick — prerequisite validation", () => {
	it("rejects interaction when cooldown is active", () => {
		const bus = createInteractionBus();
		const first = makeInteraction({ id: "first", cooldownMs: 5000 });
		bus.submit(first);
		bus.tick(0);

		// Submit same action from same initiator before cooldown clears
		const second = makeInteraction({
			id: "second",
			cooldownMs: 5000,
			prerequisites: [{ type: "cooldown-clear" }],
		});
		bus.submit(second);
		const result = bus.tick(0);

		expect(result.actions.some(a => a.interactionId === "second")).toBe(false);
	});

	it("allows interaction after cooldown expires", () => {
		const bus = createInteractionBus();
		const first = makeInteraction({ id: "first", cooldownMs: 1000 });
		bus.submit(first);
		bus.tick(0);

		// Advance time past cooldown
		bus.tick(1001);

		const second = makeInteraction({
			id: "second",
			cooldownMs: 1000,
			prerequisites: [{ type: "cooldown-clear" }],
		});
		bus.submit(second);
		const result = bus.tick(0);

		expect(result.actions.some(a => a.interactionId === "second")).toBe(true);
	});

	it("delegates external prereqs to checker callback", () => {
		const checker = vi.fn().mockReturnValue(true);
		const bus = createInteractionBus({ checkPrerequisite: checker });
		const interaction = makeInteraction({
			prerequisites: [{ type: "proximity", maxDistance: 5 }],
		});
		bus.submit(interaction);
		bus.tick(0);

		expect(checker).toHaveBeenCalledWith(
			{ type: "proximity", maxDistance: 5 },
			expect.objectContaining({ id: interaction.id }),
		);
	});

	it("rejects when external prereq checker returns false", () => {
		const checker = vi.fn().mockReturnValue(false);
		const bus = createInteractionBus({ checkPrerequisite: checker });
		const interaction = makeInteraction({
			prerequisites: [{ type: "proximity", maxDistance: 5 }],
		});
		bus.submit(interaction);
		const result = bus.tick(0);

		expect(result.actions.some(a => a.interactionId === interaction.id)).toBe(false);
	});

	it("passes when all prerequisites are met", () => {
		const checker = vi.fn().mockReturnValue(true);
		const bus = createInteractionBus({ checkPrerequisite: checker });
		const interaction = makeInteraction({
			prerequisites: [
				{ type: "proximity", maxDistance: 10 },
				{ type: "affinity-range", min: 0, max: 100 },
			],
		});
		bus.submit(interaction);
		const result = bus.tick(0);

		expect(result.actions.some(a => a.interactionId === interaction.id)).toBe(true);
	});

	it("rejects when not-locked prereq fails because entity is locked", () => {
		const bus = createInteractionBus();
		const first = makeInteraction({ id: "locker", duration: 5000 });
		bus.submit(first);
		bus.tick(0);

		const second = makeInteraction({
			id: "blocked",
			initiator: { id: "agent-3", entityType: "agent" },
			targets: [{ id: "agent-2", entityType: "agent" }],
			prerequisites: [{ type: "not-locked" }],
		});
		bus.submit(second);
		const result = bus.tick(0);

		expect(result.actions.some(a => a.interactionId === "blocked")).toBe(false);
	});
});

// ── tick — spawn-interaction chains ────────────────────────────────

describe("tick — spawn-interaction chains", () => {
	function makeTemplate(overrides: Partial<InteractionTemplate> = {}): InteractionTemplate {
		return {
			id: "template-chain",
			category: "social",
			action: "follow-up",
			cardinality: "one-to-one",
			initiatorTypes: ["agent"],
			targetTypes: ["agent"],
			prerequisites: [],
			weight: 1,
			tags: [],
			priority: 50,
			cooldownMs: 0,
			effects: [{ type: "affinity-change", target: "initiator", amount: 2 }],
			...overrides,
		};
	}

	it("spawns chained interaction from template registry on next tick", () => {
		const template = makeTemplate();
		const registry = {
			getById: vi.fn().mockReturnValue(template),
		};
		const bus = createInteractionBus({ templateRegistry: registry });

		const interaction = makeInteraction({
			effects: [{ type: "spawn-interaction", templateId: "template-chain" }],
		});
		bus.submit(interaction);
		bus.tick(0); // processes original, queues spawn

		const result = bus.tick(0); // processes spawned
		expect(registry.getById).toHaveBeenCalledWith("template-chain");
		expect(result.actions.length).toBeGreaterThan(0);
	});

	it("increments chainDepth on spawned interaction", () => {
		const template = makeTemplate();
		const registry = { getById: vi.fn().mockReturnValue(template) };
		const bus = createInteractionBus({ templateRegistry: registry });

		const events: Interaction[] = [];
		bus.on("chained", (i) => events.push(i));

		const interaction = makeInteraction({
			chainDepth: 1,
			effects: [{ type: "spawn-interaction", templateId: "template-chain" }],
		});
		bus.submit(interaction);
		bus.tick(0);

		expect(events.length).toBe(1);
		expect(events[0].chainDepth).toBe(2);
	});

	it("rejects spawned interaction at MAX_CHAIN_DEPTH + 1", () => {
		const template = makeTemplate();
		const registry = { getById: vi.fn().mockReturnValue(template) };
		const bus = createInteractionBus({ templateRegistry: registry });

		const rejected: Interaction[] = [];
		bus.on("rejected", (i) => rejected.push(i));

		const interaction = makeInteraction({
			chainDepth: MAX_CHAIN_DEPTH,
			effects: [{ type: "spawn-interaction", templateId: "template-chain" }],
		});
		bus.submit(interaction);
		bus.tick(0); // processes parent, queues spawn with depth MAX_CHAIN_DEPTH+1
		bus.tick(0); // tries to process spawn — should reject

		expect(rejected.some(i => (i.chainDepth ?? 0) > MAX_CHAIN_DEPTH)).toBe(true);
	});

	it("does nothing when template registry is not provided", () => {
		const bus = createInteractionBus();
		const interaction = makeInteraction({
			effects: [{ type: "spawn-interaction", templateId: "nonexistent" }],
		});
		bus.submit(interaction);
		const result = bus.tick(0);

		// Should still process the interaction but no spawn actions
		expect(result.actions.length).toBe(0);
	});

	it("does nothing when template is not found", () => {
		const registry = { getById: vi.fn().mockReturnValue(undefined) };
		const bus = createInteractionBus({ templateRegistry: registry });

		const interaction = makeInteraction({
			effects: [{ type: "spawn-interaction", templateId: "missing" }],
		});
		bus.submit(interaction);
		const result = bus.tick(0);

		expect(result.actions.length).toBe(0);
	});
});

// ── tick — chainTemplates / chainChance ────────────────────────────

describe("tick — chainTemplates/chainChance", () => {
	function makeChainTemplate(overrides: Partial<InteractionTemplate> = {}): InteractionTemplate {
		return {
			id: "tpl-chain",
			category: "social",
			action: "test-action",
			cardinality: "one-to-one",
			initiatorTypes: ["agent"],
			targetTypes: ["agent"],
			prerequisites: [],
			weight: 1,
			tags: [],
			priority: 50,
			cooldownMs: 0,
			effects: [],
			...overrides,
		};
	}

	it("spawns chain template when chance is 1.0", () => {
		const chainTemplate = makeChainTemplate({ id: "follow-up-chain" });
		const parentTemplate = {
			...makeChainTemplate({ id: "parent-tpl" }),
			chainTemplates: ["follow-up-chain"] as readonly string[],
			chainChance: 1.0,
		};
		const registry = {
			getById: vi.fn((id: string) => {
				if (id === "parent-tpl") return parentTemplate;
				if (id === "follow-up-chain") return chainTemplate;
				return undefined;
			}),
		};
		const bus = createInteractionBus({ templateRegistry: registry });
		const chained: Interaction[] = [];
		bus.on("chained", (i) => chained.push(i));

		bus.submit(makeInteraction({
			id: "parent",
			context: { templateId: "parent-tpl" },
		}));
		bus.tick(0);

		expect(chained).toHaveLength(1);
		expect(chained[0].action).toBe("test-action");
	});

	it("does not spawn chain when chance is 0", () => {
		const parentTemplate = {
			...makeChainTemplate({ id: "parent-tpl" }),
			chainTemplates: ["follow-up-chain"] as readonly string[],
			chainChance: 0,
		};
		const registry = { getById: vi.fn().mockReturnValue(parentTemplate) };
		const bus = createInteractionBus({ templateRegistry: registry });
		const chained: Interaction[] = [];
		bus.on("chained", (i) => chained.push(i));

		bus.submit(makeInteraction({
			id: "parent",
			context: { templateId: "parent-tpl" },
		}));
		bus.tick(0);

		expect(chained).toHaveLength(0);
	});

	it("does not spawn chain when no templateId in context", () => {
		const registry = { getById: vi.fn() };
		const bus = createInteractionBus({ templateRegistry: registry });
		const chained: Interaction[] = [];
		bus.on("chained", (i) => chained.push(i));

		bus.submit(makeInteraction({ id: "no-template" }));
		bus.tick(0);

		expect(chained).toHaveLength(0);
	});
});

// ── tick — conflict resolution ─────────────────────────────────────

describe("tick — conflict resolution", () => {
	let bus: ReturnType<typeof createInteractionBus>;

	beforeEach(() => {
		bus = createInteractionBus();
	});

	it("higher priority wins when both target same entity", () => {
		const low = makeInteraction({
			id: "low",
			priority: 30,
			duration: 3000,
			timestamp: 1000,
		});
		const high = makeInteraction({
			id: "high",
			priority: 70,
			duration: 3000,
			timestamp: 1001,
		});

		bus.submit(low);
		bus.submit(high);
		const result = bus.tick(0);

		// High priority should be processed; low should be rejected
		const active = bus.getActive();
		expect(active.some(a => a.id === "high")).toBe(true);
		expect(active.some(a => a.id === "low")).toBe(false);
	});

	it("earlier timestamp wins on equal priority", () => {
		const earlier = makeInteraction({
			id: "earlier",
			priority: 50,
			duration: 3000,
			timestamp: 1000,
		});
		const later = makeInteraction({
			id: "later",
			priority: 50,
			duration: 3000,
			timestamp: 2000,
		});

		bus.submit(earlier);
		bus.submit(later);
		const result = bus.tick(0);

		const active = bus.getActive();
		expect(active.some(a => a.id === "earlier")).toBe(true);
		expect(active.some(a => a.id === "later")).toBe(false);
	});
});

// ── history ─────────────────────────────────────────────────────────

describe("history", () => {
	let bus: ReturnType<typeof createInteractionBus>;

	beforeEach(() => {
		bus = createInteractionBus();
	});

	it("records completed interactions", () => {
		const interaction = makeInteraction({ id: "hist-1" });
		bus.submit(interaction);
		bus.tick(0);

		const history = bus.getHistory();
		expect(history.some(h => h.id === "hist-1")).toBe(true);
	});

	it("filters history by category", () => {
		const social = makeInteraction({ id: "social-1", category: "social" });
		const work = makeInteraction({
			id: "work-1",
			category: "work",
			initiator: { id: "agent-3", entityType: "agent" },
			targets: [{ id: "agent-4", entityType: "agent" }],
		});

		bus.submit(social);
		bus.submit(work);
		bus.tick(0);

		const socialHistory = bus.getHistory({ category: "social" });
		expect(socialHistory.every(h => h.category === "social")).toBe(true);
		expect(socialHistory.length).toBeGreaterThan(0);

		const workHistory = bus.getHistory({ category: "work" });
		expect(workHistory.every(h => h.category === "work")).toBe(true);
		expect(workHistory.length).toBeGreaterThan(0);
	});

	it("respects HISTORY_BUFFER_SIZE limit", () => {
		for (let i = 0; i < HISTORY_BUFFER_SIZE + 50; i++) {
			const interaction = makeInteraction({
				id: `hist-${i}`,
				initiator: { id: `agent-a-${i}`, entityType: "agent" },
				targets: [{ id: `agent-b-${i}`, entityType: "agent" }],
			});
			bus.submit(interaction);
			bus.tick(0);
		}

		const history = bus.getHistory();
		expect(history.length).toBeLessThanOrEqual(HISTORY_BUFFER_SIZE);
	});
});

// ── lifecycle events ────────────────────────────────────────────────

describe("lifecycle events", () => {
	let bus: ReturnType<typeof createInteractionBus>;

	beforeEach(() => {
		bus = createInteractionBus();
	});

	it("emits accepted and started events", () => {
		const accepted: string[] = [];
		const started: string[] = [];
		bus.on("accepted", (i) => accepted.push(i.id));
		bus.on("started", (i) => started.push(i.id));

		const interaction = makeInteraction({ id: "evt-1", duration: 1000 });
		bus.submit(interaction);
		bus.tick(0);

		expect(accepted).toContain("evt-1");
		expect(started).toContain("evt-1");
	});

	it("emits completed when lock expires", () => {
		const completed: string[] = [];
		bus.on("completed", (i) => completed.push(i.id));

		const interaction = makeInteraction({ id: "evt-2", duration: 1000 });
		bus.submit(interaction);
		bus.tick(0);
		bus.tick(1000);

		expect(completed).toContain("evt-2");
	});

	it("emits completed for instant (no-duration) interactions", () => {
		const completed: string[] = [];
		bus.on("completed", (i) => completed.push(i.id));

		const interaction = makeInteraction({ id: "evt-instant" });
		bus.submit(interaction);
		bus.tick(0);

		expect(completed).toContain("evt-instant");
	});

	it("emits preempted on override", () => {
		const preempted: string[] = [];
		bus.on("preempted", (i) => preempted.push(i.id));

		const first = makeInteraction({ id: "victim", duration: 5000, priority: 40 });
		bus.submit(first);
		bus.tick(0);

		const override = makeInteraction({ id: "bully", priority: 91, duration: 2000 });
		bus.submit(override);
		bus.tick(0);

		expect(preempted).toContain("victim");
	});
});

// ── cooperative locks ───────────────────────────────────────────────

describe("cooperative locks", () => {
	it("externalLockQuery blocks interactions targeting locked entities", () => {
		const externalLockQuery = vi.fn((entityId: string) => entityId === "agent-2");
		const bus = createInteractionBus({ externalLockQuery });

		const interaction = makeInteraction({
			prerequisites: [{ type: "not-locked" }],
		});
		bus.submit(interaction);
		const result = bus.tick(0);

		expect(result.actions.some(a => a.interactionId === interaction.id)).toBe(false);
	});

	it("isEntityLocked reflects external lock state", () => {
		const externalLockQuery = vi.fn((entityId: string) => entityId === "agent-2");
		const bus = createInteractionBus({ externalLockQuery });

		expect(bus.isEntityLocked("agent-2")).toBe(true);
		expect(bus.isEntityLocked("agent-1")).toBe(false);
	});

	it("isEntityLocked reflects both internal and external locks", () => {
		const externalLockQuery = vi.fn((entityId: string) => entityId === "agent-3");
		const bus = createInteractionBus({ externalLockQuery });

		const interaction = makeInteraction({ duration: 3000 });
		bus.submit(interaction);
		bus.tick(0);

		// agent-1 locked internally, agent-3 locked externally
		expect(bus.isEntityLocked("agent-1")).toBe(true);
		expect(bus.isEntityLocked("agent-3")).toBe(true);
		// agent-4 not locked anywhere
		expect(bus.isEntityLocked("agent-4")).toBe(false);
	});
});

// ── getCooldown ─────────────────────────────────────────────────────

describe("getCooldown", () => {
	it("returns remaining cooldown time", () => {
		const bus = createInteractionBus();
		const interaction = makeInteraction({ cooldownMs: 5000 });
		bus.submit(interaction);
		bus.tick(0);

		const cooldown = bus.getCooldown("agent-1", "agent", "greet");
		expect(cooldown).toBeGreaterThan(0);
		expect(cooldown).toBeLessThanOrEqual(5000);
	});

	it("returns 0 when no cooldown active", () => {
		const bus = createInteractionBus();
		const cooldown = bus.getCooldown("agent-1", "agent", "greet");
		expect(cooldown).toBe(0);
	});
});

// ── EffectState accumulation ───────────────────────────────────────

describe("EffectState accumulation", () => {
	it("accumulates affinity changes", () => {
		const bus = createInteractionBus();
		const interaction = makeInteraction({
			effects: [{ type: "affinity-change", target: "initiator", amount: 5 }],
		});
		bus.submit(interaction);
		const result = bus.tick(0);

		expect(result.state.affinityChanges.length).toBeGreaterThan(0);
		expect(result.state.affinityChanges[0].amount).toBe(5);
	});

	it("accumulates need changes", () => {
		const bus = createInteractionBus();
		const interaction = makeInteraction({
			effects: [{ type: "need-change", target: "initiator", need: "social", amount: 10 }],
		});
		bus.submit(interaction);
		const result = bus.tick(0);

		expect(result.state.needChanges.length).toBe(1);
		expect(result.state.needChanges[0].need).toBe("social");
		expect(result.state.needChanges[0].amount).toBe(10);
	});

	it("accumulates mood changes", () => {
		const bus = createInteractionBus();
		const interaction = makeInteraction({
			effects: [{ type: "mood-change", target: "initiator", mood: "happy" }],
		});
		bus.submit(interaction);
		const result = bus.tick(0);

		expect(result.state.moodChanges.length).toBe(1);
		expect(result.state.moodChanges[0].mood).toBe("happy");
	});

	it("accumulates economy transactions", () => {
		const bus = createInteractionBus();
		const interaction = makeInteraction({
			effects: [{ type: "economy-transaction", target: "initiator", currency: "xp", amount: 100 }],
		});
		bus.submit(interaction);
		const result = bus.tick(0);

		expect(result.state.economyChanges.length).toBe(1);
		expect(result.state.economyChanges[0].currency).toBe("xp");
		expect(result.state.economyChanges[0].amount).toBe(100);
	});

	it("accumulates memory records", () => {
		const bus = createInteractionBus();
		const interaction = makeInteraction({
			effects: [{ type: "memory-record", target: "initiator", memory: "met agent-2" }],
		});
		bus.submit(interaction);
		const result = bus.tick(0);

		expect(result.state.memoryRecords.length).toBe(1);
		expect(result.state.memoryRecords[0].memory).toBe("met agent-2");
	});

	it("accumulates room mood shifts", () => {
		const bus = createInteractionBus();
		const interaction = makeInteraction({
			effects: [{ type: "room-mood-shift", mood: "festive", amount: 3 }],
		});
		bus.submit(interaction);
		const result = bus.tick(0);

		expect(result.state.roomMoodShifts.length).toBe(1);
		expect(result.state.roomMoodShifts[0].mood).toBe("festive");
	});

	it("records spawned template IDs", () => {
		const template: InteractionTemplate = {
			id: "template-1",
			category: "social",
			action: "chain-act",
			cardinality: "one-to-one",
			initiatorTypes: ["agent"],
			targetTypes: ["agent"],
			prerequisites: [],
			weight: 1,
			tags: [],
			priority: 50,
			cooldownMs: 0,
			effects: [],
		};
		const registry = { getById: vi.fn().mockReturnValue(template) };
		const bus = createInteractionBus({ templateRegistry: registry });

		const interaction = makeInteraction({
			effects: [{ type: "spawn-interaction", templateId: "template-1" }],
		});
		bus.submit(interaction);
		const result = bus.tick(0);

		expect(result.state.spawnedTemplateIds).toContain("template-1");
	});

	it("produces render actions for visual effects", () => {
		const bus = createInteractionBus();
		const interaction = makeInteraction({
			effects: [
				{ type: "bubble", target: "initiator", bubbleKind: "speech", phrasePool: "greetings" },
				{ type: "particle", target: "initiator", particleType: "hearts" },
				{ type: "sound", target: "initiator", soundId: "ding" },
			],
		});
		bus.submit(interaction);
		const result = bus.tick(0);

		expect(result.state.renderActions.length).toBe(3);
	});
});

// ── getActive ──────────────────────────────────────────────────────

describe("getActive", () => {
	it("returns active interactions with remaining time", () => {
		const bus = createInteractionBus();
		const interaction = makeInteraction({ id: "active-1", duration: 5000 });
		bus.submit(interaction);
		bus.tick(0);

		const active = bus.getActive();
		expect(active.length).toBe(1);
		expect(active[0].id).toBe("active-1");
		expect(active[0].remainingMs).toBe(5000);
	});

	it("decrements remainingMs on subsequent ticks", () => {
		const bus = createInteractionBus();
		const interaction = makeInteraction({ id: "active-2", duration: 5000 });
		bus.submit(interaction);
		bus.tick(0);
		bus.tick(2000);

		const active = bus.getActive();
		expect(active.length).toBe(1);
		expect(active[0].remainingMs).toBe(3000);
	});

	it("returns empty after all interactions expire", () => {
		const bus = createInteractionBus();
		const interaction = makeInteraction({ duration: 1000 });
		bus.submit(interaction);
		bus.tick(0);
		bus.tick(1000);

		expect(bus.getActive().length).toBe(0);
	});
});
