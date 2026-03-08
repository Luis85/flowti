import { describe, it, expect, vi } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/mock/cli-project",
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/infrastructure/paths.js", async () => {
	const path = await import("node:path");
	return {
		paths: {
			join: path.default.join,
			resolve: path.default.resolve,
			dirname: path.default.dirname,
			basename: path.default.basename,
			sep: "/",
		},
	};
});

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-08", safeIso: () => "2026-03-08T00-00-00Z" },
}));

vi.mock("../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: null, warnings: [] })),
}));

import * as fsMod from "../../../src/infrastructure/filesystem.js";
import { ENTITY_REGISTRY, generateEntityReference } from "../../../src/domain/reports/generators/entity-reference.js";

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
}

describe("ENTITY_REGISTRY", () => {
	it("contains all expected entities", () => {
		const names = ENTITY_REGISTRY.map((e) => e.name);
		expect(names).toContain("Flowti Project");
		expect(names).toContain("Journey");
		expect(names).toContain("Component");
		expect(names).toContain("Component Library");
		expect(names).toContain("Test");
		expect(names).toContain("Test Suite");
		expect(names).toContain("Event");
		expect(names).toContain("Event Catalog");
		expect(names).toContain("Report");
	});

	it("has at least 9 entities", () => {
		expect(ENTITY_REGISTRY.length).toBeGreaterThanOrEqual(9);
	});

	it("each entity has required fields", () => {
		for (const entity of ENTITY_REGISTRY) {
			expect(entity.name).toBeTruthy();
			expect(entity.description).toBeTruthy();
			expect(entity.purpose).toBeTruthy();
			expect(Array.isArray(entity.locations)).toBe(true);
			expect(entity.locations.length).toBeGreaterThan(0);
			expect(Array.isArray(entity.relatedEntities)).toBe(true);
			expect(Array.isArray(entity.commands)).toBe(true);
			expect(Array.isArray(entity.artifacts)).toBe(true);
		}
	});

	it("Flowti Project entity has correct commands", () => {
		const project = ENTITY_REGISTRY.find((e) => e.name === "Flowti Project")!;
		expect(project.commands).toContain("project");
		expect(project.commands).toContain("scaffold:new");
	});

	it("Journey entity references Test in related entities", () => {
		const journey = ENTITY_REGISTRY.find((e) => e.name === "Journey")!;
		expect(journey.relatedEntities).toContain("Test");
	});

	it("Report entity lists report subdirs in artifacts", () => {
		const report = ENTITY_REGISTRY.find((e) => e.name === "Report")!;
		expect(report.artifacts.some((a) => a.includes("timestamp"))).toBe(true);
	});
});

describe("generateEntityReference", () => {
	it("generates a report successfully", () => {
		const fs = createMockFs();
		setDisk(fs);

		const result = generateEntityReference("/mock/project");

		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics.total_entities).toBe(ENTITY_REGISTRY.length);
	});

	it("writes markdown with frontmatter", () => {
		const fs = createMockFs();
		setDisk(fs);

		generateEntityReference("/mock/project");

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		expect(mdFile).toBeDefined();

		const content = mdFile![1];
		expect(content).toContain("---");
		expect(content).toContain("type: EntityReference");
		expect(content).toContain("# Entity Reference");
	});

	it("includes all entity names in output", () => {
		const fs = createMockFs();
		setDisk(fs);

		generateEntityReference("/mock/project");

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		for (const entity of ENTITY_REGISTRY) {
			expect(content).toContain(entity.name);
		}
	});

	it("includes purpose sections", () => {
		const fs = createMockFs();
		setDisk(fs);

		generateEntityReference("/mock/project");

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		expect(content).toContain("### Purpose");
		expect(content).toContain("### Where");
	});
});
