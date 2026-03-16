import { describe, it, expect } from "vitest";
import { resolveCharacter, DOMAIN_POOLS } from "../../src/sprites/character-pool.js";

describe("resolveCharacter", () => {
	it("returns a character from the engineering pool for engineering domain", () => {
		const char = resolveCharacter("Software Developer", "engineering");
		expect(DOMAIN_POOLS["engineering"]).toContain(char);
	});

	it("returns a character from the design pool for design domain", () => {
		const char = resolveCharacter("UI Designer", "design");
		expect(DOMAIN_POOLS["design"]).toContain(char);
	});

	it("returns a character from the management pool for management domain", () => {
		const char = resolveCharacter("Scrum Master", "management");
		expect(DOMAIN_POOLS["management"]).toContain(char);
	});

	it("is deterministic — same name+domain always returns same character", () => {
		const a = resolveCharacter("Alice", "engineering");
		const b = resolveCharacter("Alice", "engineering");
		expect(a).toBe(b);
	});

	it("different names in same domain can resolve to different characters", () => {
		const chars = new Set<string>();
		for (const name of ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"]) {
			chars.add(resolveCharacter(name, "engineering"));
		}
		expect(chars.size).toBeGreaterThan(1);
	});

	it("uses fallback pool for unknown domains", () => {
		const char = resolveCharacter("Unknown Agent", "mystery");
		expect(DOMAIN_POOLS["fallback"]).toContain(char);
	});

	it("uses fallback pool for undefined domain", () => {
		const char = resolveCharacter("Orphan", "");
		expect(DOMAIN_POOLS["fallback"]).toContain(char);
	});

	it("maps all known domain aliases to their pools", () => {
		const aliases: Record<string, string[]> = {
			engineering: ["engineering", "qa", "devops", "development", "testing"],
			design: ["design", "ux"],
			product: ["product"],
			management: ["management", "delivery", "coordination"],
			quality: ["quality"],
			analysis: ["analysis"],
			operations: ["operations"],
			marketing: ["marketing", "sales", "support"],
			orchestration: ["orchestration"],
		};
		for (const [poolKey, domains] of Object.entries(aliases)) {
			for (const domain of domains) {
				const char = resolveCharacter("TestAgent", domain);
				expect(DOMAIN_POOLS[poolKey]).toContain(char);
			}
		}
	});
});
