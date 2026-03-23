import { describe, it, expect, vi } from "vitest";
import { EmoteSystem } from "../../../src/game/systems/emote-system.js";

describe("EmoteSystem — triggerEmote", () => {
	it("fires callback with specified emote index", () => {
		const system = new EmoteSystem();
		const fired: Array<{ name: string; index: number }> = [];
		system.onEmote((name, index) => fired.push({ name, index }));
		system.register("Atlas", "neutral", 10_000);

		system.triggerEmote("Atlas", 5);

		expect(fired).toEqual([{ name: "Atlas", index: 5 }]);
	});

	it("does nothing for unregistered agent", () => {
		const system = new EmoteSystem();
		const fired: Array<{ name: string; index: number }> = [];
		system.onEmote((name, index) => fired.push({ name, index }));

		system.triggerEmote("Unknown", 5);

		expect(fired).toHaveLength(0);
	});

	it("does nothing when no callback registered", () => {
		const system = new EmoteSystem();
		system.register("Atlas", "neutral", 10_000);

		expect(() => system.triggerEmote("Atlas", 5)).not.toThrow();
	});
});
