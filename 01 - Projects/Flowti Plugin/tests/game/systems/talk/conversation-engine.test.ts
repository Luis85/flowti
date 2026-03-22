import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { ConversationEngine } from "../../../../src/game/systems/talk/conversation-engine.js";
import type { ConversationEngineCallbacks } from "../../../../src/game/systems/talk/conversation-engine.js";
import type { ConversationScript } from "../../../../src/game/systems/talk/conversation-types.js";

const TEST_SCRIPT: ConversationScript = {
	id: "test-greeting",
	tierRange: ["acquaintance", "best-friend"],
	domainFilter: null,
	trigger: "proximity",
	weight: 10,
	cooldownMs: 0,
	tags: [],
	turns: [
		{ speaker: "A", text: "Hey {agentB}!", delayMs: 0, kind: "speech" },
		{ speaker: "B", text: "Hi {agentA}!", delayMs: 1000, kind: "speech" },
	],
};

describe("ConversationEngine", () => {
	let showBubble: Mock<ConversationEngineCallbacks["showBubble"]>;
	let getTier: Mock<ConversationEngineCallbacks["getTier"]>;
	let silenceTalk: Mock<ConversationEngineCallbacks["silenceTalk"]>;
	let recordConversation: Mock<ConversationEngineCallbacks["recordConversation"]>;
	let engine: ConversationEngine;

	beforeEach(() => {
		showBubble = vi.fn();
		getTier = vi.fn(() => "colleague" as const);
		silenceTalk = vi.fn();
		recordConversation = vi.fn();
		engine = new ConversationEngine({
			showBubble,
			getTier,
			silenceTalk,
			recordConversation,
		});
	});

	it("constructs without error", () => {
		expect(engine).toBeDefined();
	});

	it("registerScripts adds scripts to the pool", () => {
		engine.registerScripts([TEST_SCRIPT]);
		expect(engine.scriptCount).toBe(1);
	});

	it("tryScript returns true when a matching script is found", () => {
		engine.registerScripts([TEST_SCRIPT]);
		const result = engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		expect(result).toBe(true);
	});

	it("tryScript fires first turn immediately via showBubble", () => {
		engine.registerScripts([TEST_SCRIPT]);
		engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		expect(showBubble).toHaveBeenCalledWith("Atlas", "speech", "Hey Rex!");
	});

	it("tryScript locks participants", () => {
		engine.registerScripts([TEST_SCRIPT]);
		engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		expect(engine.isLocked("Atlas")).toBe(true);
		expect(engine.isLocked("Rex")).toBe(true);
	});

	it("tryScript silences both agents in talk engine", () => {
		engine.registerScripts([TEST_SCRIPT]);
		engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		expect(silenceTalk).toHaveBeenCalledWith("Atlas");
		expect(silenceTalk).toHaveBeenCalledWith("Rex");
	});

	it("tryScript returns false if agent is locked", () => {
		engine.registerScripts([TEST_SCRIPT]);
		engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		const result = engine.tryScript("Atlas", "Sage", "proximity", {
			domainA: "engineering",
			domainB: "product",
		});
		expect(result).toBe(false);
	});

	it("tryScript returns false when tier is out of range", () => {
		getTier.mockReturnValue("rival");
		engine.registerScripts([TEST_SCRIPT]);
		const result = engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		expect(result).toBe(false);
	});

	it("update advances turns and unlocks after final turn", () => {
		engine.registerScripts([TEST_SCRIPT]);
		engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		engine.update(1500);
		expect(showBubble).toHaveBeenCalledWith("Rex", "speech", "Hi Atlas!");
		expect(engine.isLocked("Atlas")).toBe(false);
		expect(engine.isLocked("Rex")).toBe(false);
	});

	it("update records conversation after script completes", () => {
		engine.registerScripts([TEST_SCRIPT]);
		engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		engine.update(1500);
		expect(recordConversation).toHaveBeenCalledWith("Atlas", "Rex");
	});

	it("skips turns with unmet conditions", () => {
		const condScript: ConversationScript = {
			id: "test-conditional",
			tierRange: ["acquaintance", "best-friend"],
			domainFilter: null,
			trigger: "proximity",
			weight: 10,
			cooldownMs: 0,
			tags: [],
			turns: [
				{ speaker: "A", text: "Hey!", delayMs: 0, kind: "speech" },
				{ speaker: "pet", text: "meow", delayMs: 500, kind: "thought", condition: { type: "petPresent" } },
				{ speaker: "B", text: "Bye!", delayMs: 500, kind: "speech" },
			],
		};
		engine.registerScripts([condScript]);
		// No pet in context — pet turn should be skipped
		engine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		engine.update(600);
		// Pet turn was skipped (condition unmet); B's turn needs another tick to fire
		engine.update(600);
		// Pet turn skipped, B's turn fires
		expect(showBubble).toHaveBeenCalledWith("Rex", "speech", "Bye!");
		// Pet meow should NOT have been called
		const calls = showBubble.mock.calls.map((c: unknown[]) => c[2]);
		expect(calls).not.toContain("meow");
	});

	it("gossipAbout delegates to tryScript with gossip trigger and agentC", () => {
		engine.registerScripts([{
			id: "test-gossip",
			tierRange: ["acquaintance", "best-friend"],
			domainFilter: null,
			trigger: "gossip",
			weight: 10,
			cooldownMs: 0,
			tags: ["gossip"],
			turns: [
				{ speaker: "A", text: "Have you noticed {agentC}?", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "Yeah, {agentC} has been quiet.", delayMs: 1000, kind: "speech" },
			],
		}]);
		const result = engine.gossipAbout("Atlas", "Rex", "Sage", {
			domainA: "engineering", domainB: "design",
		});
		expect(result).toBe(true);
		expect(showBubble).toHaveBeenCalledWith("Atlas", "speech", "Have you noticed Sage?");
	});

	it("tryScript returns false when externalLockQuery reports a participant locked", () => {
		const externalLockQuery = vi.fn((id: string) => id === "Rex");
		const lockedEngine = new ConversationEngine({
			showBubble,
			getTier,
			silenceTalk,
			recordConversation,
			externalLockQuery,
		});
		lockedEngine.registerScripts([TEST_SCRIPT]);
		const result = lockedEngine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		expect(result).toBe(false);
		expect(showBubble).not.toHaveBeenCalled();
	});

	it("tryScript proceeds normally when externalLockQuery returns false", () => {
		const externalLockQuery = vi.fn(() => false);
		const unlockedEngine = new ConversationEngine({
			showBubble,
			getTier,
			silenceTalk,
			recordConversation,
			externalLockQuery,
		});
		unlockedEngine.registerScripts([TEST_SCRIPT]);
		const result = unlockedEngine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
		});
		expect(result).toBe(true);
		expect(showBubble).toHaveBeenCalledWith("Atlas", "speech", "Hey Rex!");
	});

	it("tryScript returns false when pet is externally locked", () => {
		const externalLockQuery = vi.fn((id: string) => id === "Whiskers");
		const petEngine = new ConversationEngine({
			showBubble,
			getTier,
			silenceTalk,
			recordConversation,
			externalLockQuery,
		});
		petEngine.registerScripts([TEST_SCRIPT]);
		const result = petEngine.tryScript("Atlas", "Rex", "proximity", {
			domainA: "engineering",
			domainB: "design",
			pet: "Whiskers",
		});
		expect(result).toBe(false);
		expect(showBubble).not.toHaveBeenCalled();
	});

	it("cooldown prevents same script from replaying too soon", () => {
		vi.useFakeTimers();
		try {
			const cooldownScript: ConversationScript = {
				...TEST_SCRIPT,
				cooldownMs: 60000,
			};
			engine.registerScripts([cooldownScript]);
			engine.tryScript("Atlas", "Rex", "proximity", {
				domainA: "engineering",
				domainB: "design",
			});
			engine.update(1500);
			const result = engine.tryScript("Atlas", "Rex", "proximity", {
				domainA: "engineering",
				domainB: "design",
			});
			expect(result).toBe(false);
			vi.advanceTimersByTime(60001);
			const result2 = engine.tryScript("Atlas", "Rex", "proximity", {
				domainA: "engineering",
				domainB: "design",
			});
			expect(result2).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});
});
