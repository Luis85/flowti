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

import { runGenerator, hasGenerator, listGeneratorIds } from "../../../src/domain/reports/generator-registry.js";

describe("ReportGeneratorRegistry", () => {
	it("has all 8 built-in generators registered (6 reports + 2 references)", () => {
		const ids = listGeneratorIds();
		expect(ids).toContain("test");
		expect(ids).toContain("coverage");
		expect(ids).toContain("codebase");
		expect(ids).toContain("complexity");
		expect(ids).toContain("status");
		expect(ids).toContain("summary");
		expect(ids).toContain("entity-reference");
		expect(ids).toContain("cli-reference");
		expect(ids).toHaveLength(8);
	});

	it("includes reference generators in unified registry", () => {
		expect(hasGenerator("entity-reference")).toBe(true);
		expect(hasGenerator("cli-reference")).toBe(true);
	});

	it("hasGenerator returns true for registered IDs", () => {
		expect(hasGenerator("test")).toBe(true);
		expect(hasGenerator("coverage")).toBe(true);
		expect(hasGenerator("codebase")).toBe(true);
	});

	it("hasGenerator returns false for unknown IDs", () => {
		expect(hasGenerator("nonexistent")).toBe(false);
		expect(hasGenerator("")).toBe(false);
	});

	it("runGenerator returns null for unknown ID", () => {
		const result = runGenerator("nonexistent", "/test");
		expect(result).toBeNull();
	});

	it("runGenerator returns GeneratorOutput for a known ID", () => {
		// test generator will fail since no testreport.json exists (mocked fs returns false for existsSync)
		const result = runGenerator("test", "/test/project");
		expect(result).not.toBeNull();
		expect(result!.success).toBe(false);
		expect(result!.outputPath).toBe("");
	});

	it("runGenerator calls the correct generator function", () => {
		// coverage generator also fails gracefully when data is missing
		const result = runGenerator("coverage", "/test/project");
		expect(result).not.toBeNull();
		expect(result!.success).toBe(false);
	});
});
