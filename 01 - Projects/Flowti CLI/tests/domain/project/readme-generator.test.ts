import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";
import { createTestDeps } from "../../mocks/mock-deps.js";
import type { ProjectContext, ProjectConfig } from "../../../src/infrastructure/types.js";
import type { ReadmeDeps } from "../../../src/domain/project/readme-generator.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	PROJECTS_DIR: "/mock/projects",
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
		basename: (p: string) => p.split("/").pop() ?? p,
	},
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/state.js", () => ({
	getSelectedProject: vi.fn(() => null),
	setSelectedProject: vi.fn(),
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn() },
}));

vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

import { generateReadme, writeReadme } from "../../../src/domain/project/readme-generator.js";

// ── Helpers ─────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
	return { name: "TestProject", ...overrides };
}

function makeCtx(overrides: Partial<ProjectContext> = {}): ProjectContext {
	return {
		path: "/mock/projects/test-project",
		pkg: { name: "test-project", version: "1.0.0" },
		config: makeConfig(overrides.config ? overrides.config : undefined),
		scripts: overrides.scripts ?? {},
		...overrides,
	};
}

function makeDeps(files: Record<string, string> = {}): ReadmeDeps {
	const full = createTestDeps({ files });
	return { disk: full.disk, paths: full.paths };
}

// ── generateReadme ──────────────────────────────────────────────────

describe("generateReadme", () => {
	it("renders heading with project name", () => {
		const result = generateReadme(makeCtx(), makeDeps());
		expect(result).toMatch(/^# TestProject\n/);
	});

	it("renders Project Brief section with wikilink", () => {
		const result = generateReadme(makeCtx(), makeDeps());
		expect(result).toContain("## Project Brief");
		expect(result).toContain("[[TestProject — Architecture]]");
		expect(result).toContain("### Vision");
		expect(result).toContain("### Goals");
		expect(result).toContain("### Non-Goals");
	});

	it("renders Documentation section with links", () => {
		const result = generateReadme(makeCtx(), makeDeps());
		expect(result).toContain("## Documentation");
		expect(result).toContain("[[TestProject — Architecture]] — Technical architecture");
		expect(result).toContain("[[configs/flowti.config.json]]");
		expect(result).toContain("Managed by [Flowti CLI]");
	});

	describe("Commands section", () => {
		it("omits Commands when scripts is empty", () => {
			const result = generateReadme(makeCtx({ scripts: {} }), makeDeps());
			expect(result).not.toContain("## Commands");
		});

		it("renders Commands table when scripts present", () => {
			const ctx = makeCtx({ scripts: { build: "tsc", test: "vitest run" } });
			const result = generateReadme(ctx, makeDeps());
			expect(result).toContain("## Commands");
			expect(result).toContain("| `npm run build` | `tsc` |");
			expect(result).toContain("| `npm run test` | `vitest run` |");
		});

		it("renders multiple scripts as separate rows", () => {
			const ctx = makeCtx({ scripts: { lint: "eslint .", dev: "vite" } });
			const result = generateReadme(ctx, makeDeps());
			const lines = result.split("\n");
			const commandRows = lines.filter((l) => l.startsWith("| `npm run"));
			expect(commandRows).toHaveLength(2);
		});
	});

	describe("Build Modes section", () => {
		it("omits Build Modes when no build config", () => {
			const result = generateReadme(makeCtx(), makeDeps());
			expect(result).not.toContain("## Build Modes");
		});

		it("omits Build Modes when build.commands is empty", () => {
			const ctx = makeCtx({ config: makeConfig({ build: { commands: {} } }) });
			const result = generateReadme(ctx, makeDeps());
			expect(result).not.toContain("## Build Modes");
		});

		it("renders Build Modes when build commands present", () => {
			const ctx = makeCtx({
				config: makeConfig({ build: { commands: { fast: "esbuild", full: "tsc && esbuild" } } }),
			});
			const result = generateReadme(ctx, makeDeps());
			expect(result).toContain("## Build Modes");
			expect(result).toContain("- **fast**: `esbuild`");
			expect(result).toContain("- **full**: `tsc && esbuild`");
		});
	});

	describe("Test Presets section", () => {
		it("omits Test Presets when no test config", () => {
			const result = generateReadme(makeCtx(), makeDeps());
			expect(result).not.toContain("## Test Presets");
		});

		it("omits Test Presets when test.commands is empty", () => {
			const ctx = makeCtx({ config: makeConfig({ test: { commands: {} } }) });
			const result = generateReadme(ctx, makeDeps());
			expect(result).not.toContain("## Test Presets");
		});

		it("renders Test Presets when test commands present", () => {
			const ctx = makeCtx({
				config: makeConfig({ test: { commands: { unit: "vitest run", e2e: "vitest run --e2e" } } }),
			});
			const result = generateReadme(ctx, makeDeps());
			expect(result).toContain("## Test Presets");
			expect(result).toContain("- **unit**: `vitest run`");
			expect(result).toContain("- **e2e**: `vitest run --e2e`");
		});
	});

	describe("Reports section", () => {
		it("omits Reports when no generators", () => {
			const result = generateReadme(makeCtx(), makeDeps());
			expect(result).not.toContain("## Reports");
		});

		it("omits Reports when generators array is empty", () => {
			const ctx = makeCtx({ config: makeConfig({ reports: { generators: [] } }) });
			const result = generateReadme(ctx, makeDeps());
			expect(result).not.toContain("## Reports");
		});

		it("renders Reports when generators present", () => {
			const ctx = makeCtx({
				config: makeConfig({
					reports: {
						generators: [
							{ label: "Coverage Report", type: "coverage" as never, outputDir: "reports" },
							{ label: "Summary Report", type: "summary" as never, outputDir: "reports" },
						],
					},
				}),
			});
			const result = generateReadme(ctx, makeDeps());
			expect(result).toContain("## Reports");
			expect(result).toContain("- Coverage Report");
			expect(result).toContain("- Summary Report");
		});
	});

	describe("Dev Tools section", () => {
		it("omits Dev Tools when no tools available", () => {
			// package.json without any devDependencies
			const deps = makeDeps({
				"/mock/projects/test-project/package.json": JSON.stringify({}),
			});
			const result = generateReadme(makeCtx(), deps);
			expect(result).not.toContain("## Dev Tools");
		});

		it("omits Dev Tools when package.json does not exist", () => {
			const deps = makeDeps();
			const result = generateReadme(makeCtx(), deps);
			expect(result).not.toContain("## Dev Tools");
		});

		it("renders Dev Tools when tools are available", () => {
			const deps = makeDeps({
				"/mock/projects/test-project/package.json": JSON.stringify({
					devDependencies: { vitest: "^1.0.0", eslint: "^8.0.0" },
				}),
			});
			const result = generateReadme(makeCtx(), deps);
			expect(result).toContain("## Dev Tools");
			expect(result).toContain("- vitest ^1.0.0");
			expect(result).toContain("- eslint ^8.0.0");
		});

		it("only lists available tools, not unavailable ones", () => {
			const deps = makeDeps({
				"/mock/projects/test-project/package.json": JSON.stringify({
					devDependencies: { vitest: "^1.0.0" },
				}),
			});
			const result = generateReadme(makeCtx(), deps);
			expect(result).toContain("- vitest ^1.0.0");
			expect(result).not.toContain("- eslint");
			expect(result).not.toContain("- typedoc");
		});
	});

	describe("full output structure", () => {
		it("renders all sections in order when fully configured", () => {
			const ctx = makeCtx({
				config: makeConfig({
					build: { commands: { fast: "esbuild" } },
					test: { commands: { unit: "vitest" } },
					reports: {
						generators: [{ label: "Summary", type: "summary" as never, outputDir: "out" }],
					},
				}),
				scripts: { build: "tsc" },
			});
			const deps = makeDeps({
				"/mock/projects/test-project/package.json": JSON.stringify({
					devDependencies: { vitest: "^1.0.0" },
				}),
			});
			const result = generateReadme(ctx, deps);
			const sectionOrder = [
				"# TestProject",
				"## Project Brief",
				"## Commands",
				"## Build Modes",
				"## Test Presets",
				"## Reports",
				"## Dev Tools",
				"## Documentation",
			];
			let lastIndex = -1;
			for (const section of sectionOrder) {
				const idx = result.indexOf(section);
				expect(idx, `Section "${section}" not found`).toBeGreaterThan(-1);
				expect(idx, `Section "${section}" should come after previous section`).toBeGreaterThan(lastIndex);
				lastIndex = idx;
			}
		});

		it("produces valid markdown (no double blank lines between sections)", () => {
			const result = generateReadme(makeCtx(), makeDeps());
			expect(result).not.toContain("\n\n\n");
		});
	});
});

// ── writeReadme ─────────────────────────────────────────────────────

describe("writeReadme", () => {
	let deps: ReadmeDeps;
	let ctx: ProjectContext;

	beforeEach(() => {
		deps = makeDeps();
		ctx = makeCtx();
	});

	it("writes README.md to project path", () => {
		const writeSpy = vi.spyOn(deps.disk, "writeFileSync");
		writeReadme(ctx, deps);
		expect(writeSpy).toHaveBeenCalledOnce();
		expect(writeSpy).toHaveBeenCalledWith(
			"/mock/projects/test-project/README.md",
			expect.any(String),
			"utf-8",
		);
	});

	it("returns the path to the written file", () => {
		const result = writeReadme(ctx, deps);
		expect(result).toBe("/mock/projects/test-project/README.md");
	});

	it("writes content matching generateReadme output", () => {
		const writeSpy = vi.spyOn(deps.disk, "writeFileSync");
		writeReadme(ctx, deps);
		const expectedContent = generateReadme(ctx, deps);
		expect(writeSpy).toHaveBeenCalledWith(
			expect.any(String),
			expectedContent,
			"utf-8",
		);
	});

	it("uses deps.paths.join to construct the file path", () => {
		const joinSpy = vi.spyOn(deps.paths, "join");
		writeReadme(ctx, deps);
		expect(joinSpy).toHaveBeenCalledWith("/mock/projects/test-project", "README.md");
	});
});
