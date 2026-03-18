import { describe, it, expect } from "vitest";
import { resolveCharacter, DOMAIN_POOLS } from "../../../src/game/sprites/character-pool.js";

describe("resolveCharacter", () => {
	it("returns a character from the engineering pool", () => {
		const char = resolveCharacter("TestAgent", "engineering");
		expect(DOMAIN_POOLS["engineering"]).toContain(char);
	});
	it("is deterministic", () => {
		const a = resolveCharacter("Atlas", "engineering");
		const b = resolveCharacter("Atlas", "engineering");
		expect(a).toBe(b);
	});
	it("different names can produce different characters", () => {
		const chars = new Set<string>();
		for (let i = 0; i < 20; i++) {
			chars.add(resolveCharacter(`Agent${i}`, "engineering"));
		}
		expect(chars.size).toBeGreaterThan(1);
	});
	it("uses fallback pool for unknown domain", () => {
		const char = resolveCharacter("Test", "nonexistent");
		expect(DOMAIN_POOLS["fallback"]).toContain(char);
	});
});
