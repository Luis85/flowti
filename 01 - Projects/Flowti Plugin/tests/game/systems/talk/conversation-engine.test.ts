import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConversationEngine } from "../../../../src/game/systems/talk/conversation-engine.js";
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
	let showBubble: ReturnType<typeof vi.fn>;
	let getTier: ReturnType<typeof vi.fn>;
	let silenceTalk: ReturnType<typeof vi.fn>;
	let recordConversation: ReturnType<typeof vi.fn>;
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
