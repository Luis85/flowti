import { describe, it, expect } from "vitest";
import { validateConfigDeep } from "../../../src/domain/project/config-deep-validation.js";
import { createMockFs } from "../../mocks/mock-fs.js";
import type { ProjectConfig } from "../../../src/infrastructure/types.js";

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
	return { name: "test-project", ...overrides } as ProjectConfig;
}

describe("validateConfigDeep", () => {
	// ── reports.dir ──────────────────────────────────────────────────

	it("warns when reports.dir does not exist", () => {
		const fs = createMockFs({});
		const config = baseConfig({ reports: { dir: "reports" } });
		const result = validateConfigDeep(config, "/project", fs);

		expect(result.warnings.some((w) => w.includes("reports.dir"))).toBe(true);
	});

	it("no warning when reports.dir exists", () => {
		const fs = createMockFs({ "/project/reports/.keep": "" });
		const config = baseConfig({ reports: { dir: "reports" } });
		const result = validateConfigDeep(config, "/project", fs);

		expect(result.warnings.filter((w) => w.includes("reports.dir"))).toHaveLength(0);
	});

	it("skips reports.dir check when not configured", () => {
		const fs = createMockFs({});
		const config = baseConfig();
		const result = validateConfigDeep(config, "/project", fs);

		expect(result.warnings.filter((w) => w.includes("reports.dir"))).toHaveLength(0);
	});

	// ── publish endpoints ────────────────────────────────────────────

	it("warns when publish endpoint path does not exist", () => {
		const fs = createMockFs({});
		const config = baseConfig({
			publish: { endpoints: [{ name: "dist", path: "./dist" }] },
		});
		const result = validateConfigDeep(config, "/project", fs);

		expect(result.warnings.some((w) => w.includes("publish.endpoints[0].path"))).toBe(true);
	});

	it("no warning when publish endpoint path exists", () => {
		const fs = createMockFs({ "/project/dist/.keep": "" });
		const config = baseConfig({
			publish: { endpoints: [{ name: "dist", path: "./dist" }] },
		});
		const result = validateConfigDeep(config, "/project", fs);

		expect(result.warnings.filter((w) => w.includes("publish.endpoints"))).toHaveLength(0);
	});

	// ── review.journeysDir ──────────────────────────────────────────

	it("warns when review.journeysDir does not exist", () => {
		const fs = createMockFs({});
		const config = baseConfig({ review: { journeysDir: "tests/journeys" } });
		const result = validateConfigDeep(config, "/project", fs);

		expect(result.warnings.some((w) => w.includes("review.journeysDir"))).toBe(true);
	});

	it("no warning when review.journeysDir exists", () => {
		const fs = createMockFs({ "/project/tests/journeys/.keep": "" });
		const config = baseConfig({ review: { journeysDir: "tests/journeys" } });
		const result = validateConfigDeep(config, "/project", fs);

		expect(result.warnings.filter((w) => w.includes("review.journeysDir"))).toHaveLength(0);
	});

	// ── review.testVault ────────────────────────────────────────────

	it("warns when review.testVault does not exist", () => {
		const fs = createMockFs({});
		const config = baseConfig({ review: { testVault: "/e2e-vault" } });
		const result = validateConfigDeep(config, "/project", fs);

		expect(result.warnings.some((w) => w.includes("review.testVault"))).toBe(true);
	});

	// ── docs.referenceDir ───────────────────────────────────────────

	it("warns when docs.referenceDir does not exist", () => {
		const fs = createMockFs({});
		const config = baseConfig({ docs: { referenceDir: "docs/reference" } });
		const result = validateConfigDeep(config, "/project", fs);

		expect(result.warnings.some((w) => w.includes("docs.referenceDir"))).toBe(true);
	});

	// ── components.storybookDir ──────────────────────────────────────

	it("warns when components.storybookDir does not exist and storybook enabled", () => {
		const fs = createMockFs({});
		const config = baseConfig({ components: { storybook: true, storybookDir: "storybook" } });
		const result = validateConfigDeep(config, "/project", fs);

		expect(result.warnings.some((w) => w.includes("components.storybookDir"))).toBe(true);
	});

	it("skips storybookDir check when storybook is disabled", () => {
		const fs = createMockFs({});
		const config = baseConfig({ components: { storybook: false, storybookDir: "storybook" } });
		const result = validateConfigDeep(config, "/project", fs);

		expect(result.warnings.filter((w) => w.includes("components.storybookDir"))).toHaveLength(0);
	});

	// ── empty config ────────────────────────────────────────────────

	it("returns no warnings for minimal config", () => {
		const fs = createMockFs({});
		const config = baseConfig();
		const result = validateConfigDeep(config, "/project", fs);

		expect(result.warnings).toHaveLength(0);
	});
});
