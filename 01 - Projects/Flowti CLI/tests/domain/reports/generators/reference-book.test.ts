import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../../mocks/mock-fs.js";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", async () => {
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

vi.mock("../../../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/mock/cli-project",
}));

vi.mock("../../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-13T00:00:00Z", safeIso: () => "2026-03-13T00-00-00Z" },
}));

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { generateReferenceBook, type BookEntry } from "../../../../src/domain/reports/generators/reference-book.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => {
	vi.clearAllMocks();
});

const SAMPLE_ENTRIES: BookEntry[] = [
	{ id: "cli-reference", label: "CLI Reference", outputPath: "/mock/docs/reference/CLI Reference.md", metrics: { commands: 22 }, success: true },
	{ id: "entity-reference", label: "Entity Reference", outputPath: "/mock/docs/reference/Entity Reference.md", metrics: { total_entities: 9 }, success: true },
];

describe("generateReferenceBook", () => {
	it("generates a book with successful entries", () => {
		const fs = createMockFs();
		setDisk(fs);

		const result = generateReferenceBook("/mock/project", mockDeps, SAMPLE_ENTRIES);

		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics.references).toBe(2);
	});

	it("writes markdown with frontmatter and wikilinks", () => {
		const fs = createMockFs();
		setDisk(fs);

		generateReferenceBook("/mock/project", mockDeps, SAMPLE_ENTRIES);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		expect(mdFile).toBeDefined();

		const content = mdFile![1];
		expect(content).toContain("---");
		expect(content).toContain("type: ReferenceBook");
		expect(content).toContain("[[CLI Reference]]");
		expect(content).toContain("[[Entity Reference]]");
	});

	it("includes summary table", () => {
		const fs = createMockFs();
		setDisk(fs);

		generateReferenceBook("/mock/project", mockDeps, SAMPLE_ENTRIES);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		expect(content).toContain("| Reference |");
		expect(content).toContain("CLI Reference");
		expect(content).toContain("Entity Reference");
	});

	it("lists failed references separately", () => {
		const fs = createMockFs();
		setDisk(fs);

		const entries: BookEntry[] = [
			...SAMPLE_ENTRIES,
			{ id: "broken-ref", label: "Broken Ref", outputPath: "", metrics: {}, success: false },
		];

		generateReferenceBook("/mock/project", mockDeps, entries);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		expect(content).toContain("## Failed");
		expect(content).toContain("Broken Ref");
	});

	it("respects custom book config", () => {
		const fs = createMockFs();
		setDisk(fs);

		const result = generateReferenceBook("/mock/project", mockDeps, SAMPLE_ENTRIES, {
			title: "My Custom Book",
			filename: "Custom Book.md",
		});

		expect(result.success).toBe(true);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.includes("Custom Book"));
		expect(mdFile).toBeDefined();

		const content = mdFile![1];
		expect(content).toContain("My Custom Book");
	});

	it("handles empty entries", () => {
		const fs = createMockFs();
		setDisk(fs);

		const result = generateReferenceBook("/mock/project", mockDeps, []);

		expect(result.success).toBe(true);
		expect(result.metrics.references).toBe(0);
	});
});
