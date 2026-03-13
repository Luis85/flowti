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

vi.mock("../../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({
		config: {
			name: "test-project",
			type: "cli",
			build: { commands: { fast: "npm run build" } },
			test: { commands: { unit: "npm test" } },
			reports: { dir: "reports", generators: [] },
		},
		warnings: [],
	})),
}));

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { generateConfigReference } from "../../../../src/domain/reports/generators/config-reference.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("generateConfigReference", () => {
	it("generates a reference successfully with config present", () => {
		const fs = createMockFs();
		setDisk(fs);

		const result = generateConfigReference("/mock/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.outputPath).toBeTruthy();
		expect(result.metrics.total_sections).toBeGreaterThan(0);
	});

	it("writes markdown with frontmatter", () => {
		const fs = createMockFs();
		setDisk(fs);

		generateConfigReference("/mock/project", mockDeps);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		expect(mdFile).toBeDefined();

		const content = mdFile![1];
		expect(content).toContain("---");
		expect(content).toContain("type: ConfigReference");
		expect(content).toContain("# Config Reference");
	});

	it("includes configured sections summary table", () => {
		const fs = createMockFs();
		setDisk(fs);

		generateConfigReference("/mock/project", mockDeps);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		expect(content).toContain("Configured Sections");
		expect(content).toContain("| Section |");
		expect(content).toContain("Build");
		expect(content).toContain("Test");
	});

	it("shows active and inactive section status", () => {
		const fs = createMockFs();
		setDisk(fs);

		generateConfigReference("/mock/project", mockDeps);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		// build and test are configured
		expect(content).toContain("Active");
		// some sections are not configured
		expect(content).toContain("Not configured");
	});

	it("includes JSON blocks for configured sections", () => {
		const fs = createMockFs();
		setDisk(fs);

		generateConfigReference("/mock/project", mockDeps);

		const written = [...fs.files.entries()];
		const mdFile = written.find(([k]) => k.endsWith(".md"));
		const content = mdFile![1];

		expect(content).toContain("```json");
		expect(content).toContain("npm run build");
	});

	it("reports active section count in metrics", () => {
		const fs = createMockFs();
		setDisk(fs);

		const result = generateConfigReference("/mock/project", mockDeps);

		expect(result.metrics.active_sections).toBe(3); // build, test, reports
	});

});
