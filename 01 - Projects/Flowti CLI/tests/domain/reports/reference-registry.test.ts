import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: {
		ms: () => Date.now(),
		now: () => new Date(),
		iso: () => "2026-03-08T12:00:00.000Z",
		safeIso: () => "2026-03-08T12-00-00",
	},
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: (p: string) => p.includes("config.json") || p.includes("flowti-cli.config.json"),
		readFileSync: (p: string) => {
			if (p.includes("config.json")) return JSON.stringify({ name: "test" });
			return "";
		},
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		readdirSync: () => [],
		copyFileSync: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

import { runReference, hasReference, listReferenceIds } from "../../../src/domain/reports/reference-registry.js";

describe("ReferenceGeneratorRegistry", () => {
	it("has 2 built-in reference generators registered", () => {
		const ids = listReferenceIds();
		expect(ids).toContain("entity-reference");
		expect(ids).toContain("cli-reference");
		expect(ids).toHaveLength(2);
	});

	it("hasReference returns true for registered IDs", () => {
		expect(hasReference("entity-reference")).toBe(true);
		expect(hasReference("cli-reference")).toBe(true);
	});

	it("hasReference returns false for unknown IDs", () => {
		expect(hasReference("nonexistent")).toBe(false);
		expect(hasReference("")).toBe(false);
	});

	it("runReference returns null for unknown ID", () => {
		const result = runReference("nonexistent", "/test");
		expect(result).toBeNull();
	});

	it("does not contain report generators", () => {
		expect(hasReference("test")).toBe(false);
		expect(hasReference("coverage")).toBe(false);
		expect(hasReference("summary")).toBe(false);
	});
});
