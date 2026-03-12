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

import { disk } from "../../../src/infrastructure/filesystem.js";
import { clock } from "../../../src/infrastructure/clock.js";
import { runGenerator, hasGenerator, listGeneratorIds, listByCategory, runReference, hasReference, listReferenceIds } from "../../../src/domain/reports/generator-registry.js";

const mockDeps = { disk, paths: { join: (...a: string[]) => a.join("/"), basename: (p: string) => p.split("/").pop() || "", resolve: (...a: string[]) => a.join("/"), dirname: (p: string) => p.split("/").slice(0, -1).join("/"), sep: "/" }, clock, log: () => {} } as any;

describe("ReportGeneratorRegistry", () => {
	it("has all 15 built-in generators registered (9 reports + 6 references)", () => {
		const ids = listGeneratorIds();
		expect(ids).toContain("test");
		expect(ids).toContain("coverage");
		expect(ids).toContain("codebase");
		expect(ids).toContain("complexity");
		expect(ids).toContain("status");
		expect(ids).toContain("summary");
		expect(ids).toContain("cycle");
		expect(ids).toContain("performance");
		expect(ids).toContain("trace");
		expect(ids).toContain("entity-reference");
		expect(ids).toContain("cli-reference");
		expect(ids).toContain("event-catalog");
		expect(ids).toContain("command-reference");
		expect(ids).toContain("data-dictionary");
		expect(ids).toContain("tool-reference");
		expect(ids).toHaveLength(15);
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
		const result = runGenerator("nonexistent", "/test", mockDeps);
		expect(result).toBeNull();
	});

	it("runGenerator returns GeneratorOutput for a known ID", () => {
		// test generator will fail since no testreport.json exists (mocked fs returns false for existsSync)
		const result = runGenerator("test", "/test/project", mockDeps);
		expect(result).not.toBeNull();
		expect(result!.success).toBe(false);
		expect(result!.outputPath).toBe("");
	});

	it("runGenerator calls the correct generator function", () => {
		// coverage generator also fails gracefully when data is missing
		const result = runGenerator("coverage", "/test/project", mockDeps);
		expect(result).not.toBeNull();
		expect(result!.success).toBe(false);
	});
});

describe("listByCategory", () => {
	it("lists report generators", () => {
		const reports = listByCategory("report");
		expect(reports).toContain("test");
		expect(reports).toContain("coverage");
		expect(reports).toContain("summary");
		expect(reports).not.toContain("entity-reference");
	});

	it("lists reference generators", () => {
		const refs = listByCategory("reference");
		expect(refs).toContain("entity-reference");
		expect(refs).toContain("cli-reference");
		expect(refs).not.toContain("test");
	});
});

describe("runReference", () => {
	it("returns null for unknown ID", () => {
		expect(runReference("nonexistent", "/test", mockDeps)).toBeNull();
	});

	it("returns null for a report-category generator", () => {
		expect(runReference("test", "/test", mockDeps)).toBeNull();
	});

	it("returns GeneratorOutput for a reference ID", () => {
		const result = runReference("entity-reference", "/test/project", mockDeps);
		expect(result).not.toBeNull();
	});
});

describe("hasReference", () => {
	it("returns true for reference IDs", () => {
		expect(hasReference("entity-reference")).toBe(true);
		expect(hasReference("cli-reference")).toBe(true);
	});

	it("returns false for report IDs", () => {
		expect(hasReference("test")).toBe(false);
	});

	it("returns false for unknown IDs", () => {
		expect(hasReference("nonexistent")).toBe(false);
	});
});

describe("listReferenceIds", () => {
	it("returns only reference generator IDs", () => {
		const ids = listReferenceIds();
		expect(ids).toContain("entity-reference");
		expect(ids).toContain("cli-reference");
		expect(ids).toHaveLength(6);
	});
});
