import { describe, it, expect } from "vitest";
import type {
	ConversationScript, RunningJoke, ConversationTurn,
	ConversationTrigger, TurnCondition,
} from "../../../../src/game/systems/talk/conversation-types.js";

describe("conversation-types", () => {
	it("ConversationScript satisfies the type contract", () => {
		const script: ConversationScript = {
			id: "test-script",
			tierRange: ["acquaintance", "colleague"],
			domainFilter: ["engineering", "design"],
			trigger: "proximity",
			weight: 1,
			cooldownMs: 30000,
			tags: ["test"],
			turns: [
				{ speaker: "A", text: "Hello {agentB}", delayMs: 2000, kind: "speech" },
				{ speaker: "B", text: "Hi {agentA}", delayMs: 1500, kind: "speech" },
			],
		};
		expect(script.id).toBe("test-script");
		expect(script.turns).toHaveLength(2);
	});

	it("RunningJoke has variants instead of turns", () => {
		const joke: RunningJoke = {
			id: "joke:test",
			tierRange: ["acquaintance", "best-friend"],
			trigger: "proximity",
			weight: 1,
			cooldownMs: 60000,
			tags: ["running-joke"],
			variants: [
				[{ speaker: "A", text: "Tabs.", delayMs: 2000, kind: "speech" }],
				[{ speaker: "A", text: "Not this again...", delayMs: 2000, kind: "speech" }],
			],
			maxEscalation: 2,
			callbackChance: 0.1,
			callbackLines: ["Don't start them on tabs."],
		};
		expect(joke.variants).toHaveLength(2);
		expect(joke.maxEscalation).toBe(2);
	});

	it("TurnCondition variants are all valid", () => {
		const conditions: TurnCondition[] = [
			{ type: "mood", agent: "A", mood: "excited" },
			{ type: "tier", min: "friend" },
			{ type: "petPresent" },
			{ type: "thirdAgentNearby" },
		];
		expect(conditions).toHaveLength(4);
	});

	it("ConversationTrigger covers all expected values", () => {
		const triggers: ConversationTrigger[] = [
			"proximity", "work-finished", "break", "mood-event",
			"gossip", "pet-catalyst", "tier-change",
		];
		expect(triggers).toHaveLength(7);
	});
});
