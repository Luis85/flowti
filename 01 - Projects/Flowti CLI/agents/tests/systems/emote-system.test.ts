import { describe, it, expect } from "vitest";
import { EmoteSystem, MOOD_EMOTE_MAP } from "../../src/systems/emote-system.js";

describe("EmoteSystem", () => {
	it("maps known moods to emote indices", () => {
		expect(MOOD_EMOTE_MAP["happy"]).toContain(3);
		expect(MOOD_EMOTE_MAP["frustrated"]).toContain(10);
		expect(MOOD_EMOTE_MAP["focused"]).toContain(15);
	});

	it("returns undefined for unknown moods", () => {
		expect(MOOD_EMOTE_MAP["nonexistent"]).toBeUndefined();
	});

	it("registers an agent and triggers emote after cooldown", () => {
		const system = new EmoteSystem();
		const triggered: Array<{ name: string; emoteIndex: number }> = [];
		system.onEmote((name, idx) => triggered.push({ name, emoteIndex: idx }));

		system.register("Bot", "happy", 15000);
		system.update(16000, (name) => name === "Bot" ? "idle" : "wandering");

		expect(triggered.length).toBe(1);
		expect(triggered[0].name).toBe("Bot");
		expect(MOOD_EMOTE_MAP["happy"]).toContain(triggered[0].emoteIndex);
	});

	it("does not trigger emote during movement states", () => {
		const system = new EmoteSystem();
		const triggered: string[] = [];
		system.onEmote((name) => triggered.push(name));

		system.register("Bot", "happy", 15000);
		system.update(16000, () => "wandering");

		expect(triggered.length).toBe(0);
	});

	it("does not trigger emote during working state", () => {
		const system = new EmoteSystem();
		const triggered: string[] = [];
		system.onEmote((name) => triggered.push(name));

		system.register("Bot", "happy", 15000);
		system.update(16000, () => "working");

		expect(triggered.length).toBe(0);
	});

	it("respects per-agent cooldown", () => {
		const system = new EmoteSystem();
		const triggered: string[] = [];
		system.onEmote((name) => triggered.push(name));

		system.register("Bot", "happy", 10000);
		system.update(11000, () => "idle");
		system.update(5000, () => "idle");

		expect(triggered.length).toBe(1);
	});

	it("triggers again after cooldown expires", () => {
		const system = new EmoteSystem();
		const triggered: string[] = [];
		system.onEmote((name) => triggered.push(name));

		system.register("Bot", "happy", 10000);
		system.update(11000, () => "idle");
		system.update(11000, () => "idle");

		expect(triggered.length).toBe(2);
	});

	it("unregisters agent", () => {
		const system = new EmoteSystem();
		const triggered: string[] = [];
		system.onEmote((name) => triggered.push(name));

		system.register("Bot", "happy", 10000);
		system.unregister("Bot");
		system.update(11000, () => "idle");

		expect(triggered.length).toBe(0);
	});

	it("updates mood for registered agent", () => {
		const system = new EmoteSystem();
		const emoteIndices: number[] = [];
		system.onEmote((_, idx) => emoteIndices.push(idx));

		system.register("Bot", "happy", 10000);
		system.updateMood("Bot", "frustrated");
		system.update(11000, () => "idle");

		expect(emoteIndices.length).toBe(1);
		expect(MOOD_EMOTE_MAP["frustrated"]).toContain(emoteIndices[0]);
	});

	it("allows emote during on-break state", () => {
		const system = new EmoteSystem();
		const triggered: string[] = [];
		system.onEmote((name) => triggered.push(name));

		system.register("Bot", "happy", 10000);
		system.update(11000, () => "on-break");

		expect(triggered.length).toBe(1);
	});
});
