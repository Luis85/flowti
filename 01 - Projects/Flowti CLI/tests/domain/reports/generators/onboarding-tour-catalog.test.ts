import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../../mocks/mock-fs.js";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));

vi.mock("../../../../src/infrastructure/paths.js", async () => {
	const path = await import("node:path");
	return { paths: { join: path.default.join, resolve: path.default.resolve, dirname: path.default.dirname, basename: path.default.basename, sep: "/" } };
});

vi.mock("../../../../src/infrastructure/config.js", () => ({ CLI_PROJECT: "/mock/cli-project" }));
vi.mock("../../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-15T00:00:00Z", safeIso: () => "2026-03-15T00-00-00Z" },
}));

vi.mock("../../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: null, warnings: [] })),
}));

import * as fsMod from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { clock } from "../../../../src/infrastructure/clock.js";
import { generateOnboardingTourCatalog } from "../../../../src/domain/reports/generators/onboarding-tour-catalog.js";

const mockDeps = { disk: fsMod.disk, paths, clock, log: () => {} } as any;

function setDisk(fs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: fs });
	mockDeps.disk = fs;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("generateOnboardingTourCatalog", () => {
	it("generates successfully with no tours", () => {
		setDisk(createMockFs());
		const result = generateOnboardingTourCatalog("/mock/project", mockDeps);
		expect(result.success).toBe(true);
		expect(result.metrics.tours).toBe(0);
	});

	it("generates with tours from registry", () => {
		const registry = JSON.stringify({ tours: [{ id: "pm", path: "tours/pm/tour.json" }] });
		const tour = JSON.stringify({
			id: "pm", name: "Project Manager", role: "project-manager",
			description: "Set up your first project",
			steps: [
				{ id: "welcome", type: "narrate", content: "steps/01-welcome.md" },
				{ id: "name-project", type: "prompt", content: "steps/02-name.md", field: "projectName", validation: "non-empty" },
				{ id: "done", type: "checkpoint", content: "steps/03-done.md", label: "Complete" },
			],
		});

		const fs = createMockFs({
			"/mock/project/configs/onboarding/tours.json": registry,
			"/mock/project/configs/onboarding/tours/pm/tour.json": tour,
		});
		setDisk(fs);

		const result = generateOnboardingTourCatalog("/mock/project", mockDeps);

		expect(result.success).toBe(true);
		expect(result.metrics.tours).toBe(1);
		expect(result.metrics.totalSteps).toBe(3);
	});

	it("includes step details", () => {
		const registry = JSON.stringify({ tours: [{ id: "test", path: "tours/test/tour.json" }] });
		const tour = JSON.stringify({
			id: "test", name: "Test Tour", role: "tester",
			description: "A test tour",
			steps: [
				{ id: "ask", type: "prompt", content: "ask.md", field: "answer" },
				{ id: "auto", type: "auto", content: "auto.md", action: "do:thing" },
				{ id: "cp", type: "checkpoint", content: "cp.md", label: "Done" },
			],
		});

		const fs = createMockFs({
			"/mock/project/configs/onboarding/tours.json": registry,
			"/mock/project/configs/onboarding/tours/test/tour.json": tour,
		});
		setDisk(fs);

		generateOnboardingTourCatalog("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];

		expect(content).toContain("User Input");
		expect(content).toContain("Automated");
		expect(content).toContain("Checkpoint");
		expect(content).toContain("`answer`");
		expect(content).toContain("`do:thing`");
	});

	it("writes frontmatter with type", () => {
		const fs = createMockFs();
		setDisk(fs);
		generateOnboardingTourCatalog("/mock/project", mockDeps);
		const content = [...fs.files.entries()].find(([k]) => k.endsWith(".md"))![1];
		expect(content).toContain("type: OnboardingTourCatalog");
	});
});
