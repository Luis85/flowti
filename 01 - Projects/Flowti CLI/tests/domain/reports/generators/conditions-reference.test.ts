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
import { generateConditionsReference } from "../../../../src/domain/reports/generators/conditions-reference.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateConditionsReference", () => {
	it("generates a reference successfully", () => {
		const fs = createMockFs();
		setDisk(fs);

		const result = generateConditionsReference("/mock/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics.handlers).toBeGreaterThan(0);
		expect(result.metrics.context_keys).toBeGreaterThan(0);
	});

	it("writes markdown with frontmatter", () => {
		const fs = createMockFs();
		setDisk(fs);

		generateConditionsReference("/mock/project", mockDeps);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		expect(mdFile).toBeDefined();

		const content = mdFile![1];
		expect(content).toContain("---");
		expect(content).toContain("type: ConditionsReference");
		expect(content).toContain("# Sitemap Conditions Reference");
	});

	it("documents condition types", () => {
		const fs = createMockFs();
		setDisk(fs);

		generateConditionsReference("/mock/project", mockDeps);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		expect(content).toContain("Hidden Conditions");
		expect(content).toContain("Disabled Conditions");
	});

	it("documents registered condition handlers", () => {
		const fs = createMockFs();
		setDisk(fs);

		generateConditionsReference("/mock/project", mockDeps);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		expect(content).toContain("no-project-selected");
		expect(content).toContain("knowledgebase:available");
		expect(content).toContain("readme:exists");
	});

	it("documents expression grammar", () => {
		const fs = createMockFs();
		setDisk(fs);

		generateConditionsReference("/mock/project", mockDeps);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		expect(content).toContain("Expression Grammar");
		expect(content).toContain("orExpr");
		expect(content).toContain("andExpr");
	});

	it("documents context keys", () => {
		const fs = createMockFs();
		setDisk(fs);

		generateConditionsReference("/mock/project", mockDeps);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		expect(content).toContain("tools.esbuild");
		expect(content).toContain("config.build");
		expect(content).toContain("project");
	});

	it("includes guidance for adding new conditions", () => {
		const fs = createMockFs();
		setDisk(fs);

		generateConditionsReference("/mock/project", mockDeps);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		expect(content).toContain("Adding New Conditions");
		expect(content).toContain("register-handlers.ts");
	});
});
