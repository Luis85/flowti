import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		mkdirSync: vi.fn(),
		writeFileSync: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
		basename: (p: string) => p.split("/").pop() ?? "",
		resolve: (...args: string[]) => args.join("/"),
		sep: "/",
	},
}));

vi.mock("../../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/cli",
	PLUGIN_ROOT: "/plugin",
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-01-01T00:00:00Z" },
}));

vi.mock("../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: null, warnings: [] })),
}));

import { disk } from "../../../src/infrastructure/filesystem.js";
import { generateCliReference, extractHelpSections } from "../../../src/domain/reports/generators/cli-reference.js";

const mockDisk = vi.mocked(disk);

beforeEach(() => {
	vi.clearAllMocks();
});

// Helper: build a minimal HELP source
function buildHelpSource(sections: Record<string, string>): string {
	const entries = Object.entries(sections)
		.map(([key, content]) => `\t${key}: \`${content}\``)
		.join(",\n");
	return `export const HELP: Record<string, string> = {\n${entries}\n};`;
}

describe("extractHelpSections", () => {
	it("extracts sections from HELP source", () => {
		const source = buildHelpSource({ main: "Overview text", build: "Build commands" });
		const sections = extractHelpSections(source);
		expect(sections.size).toBe(2);
		expect(sections.get("main")).toBe("Overview text");
		expect(sections.get("build")).toBe("Build commands");
	});

	it("returns empty map when no HELP export found", () => {
		const sections = extractHelpSections("const x = 1;");
		expect(sections.size).toBe(0);
	});

	it("strips ANSI escape code placeholders", () => {
		const source = `export const HELP: Record<string, string> = {
	build: \`\${BOLD}BUILD\${RESET} \${CYAN}commands\${RESET}\`,
};`;
		const sections = extractHelpSections(source);
		expect(sections.get("build")).toBe("BUILD commands");
	});
});

describe("generateCliReference", () => {
	it("returns success with metrics", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = generateCliReference("/test/project");

		expect(result.success).toBe(true);
		expect(result.outputPath).toContain("Flowti CLI Reference.md");
		expect(result.metrics.cli_commands).toBeGreaterThan(0);
	});

	it("generates document when help source exists", () => {
		const helpSource = buildHelpSource({
			main: "Main help overview",
			build: "Build commands\n  npm run build    Build the project",
		});

		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockImplementation((filePath: string) => {
			if (typeof filePath === "string" && filePath.includes("help-content.ts")) return helpSource;
			if (typeof filePath === "string" && filePath.includes("flowti.config.json")) return '{"reports":{"scripts":[]},"docs":{"generators":[]}}';
			if (typeof filePath === "string" && filePath.includes("package.json")) return '{"scripts":{"test":"vitest"}}';
			return "{}";
		});

		const result = generateCliReference("/test/project");

		expect(result.success).toBe(true);
		expect(result.metrics.help_sections).toBe(2);
		expect(result.metrics.npm_scripts).toBe(1);
	});

	it("handles missing help file gracefully", () => {
		mockDisk.existsSync.mockReturnValue(false);
		mockDisk.readFileSync.mockImplementation(() => { throw new Error("not found"); });

		const result = generateCliReference("/test/project");

		expect(result.success).toBe(true);
		expect(result.metrics.help_sections).toBe(0);
	});

	it("writes to reference directory (not reports)", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = generateCliReference("/test/project");

		expect(result.outputPath).toContain("docs/reference");
		expect(result.outputPath).toContain("Flowti CLI Reference.md");
	});

	it("processes plugin config with report scripts", () => {
		const pluginConfig = {
			reports: {
				scripts: [
					{ id: "test", label: "Test Report", script: "npm run report:test" },
				],
			},
			docs: {
				generators: [
					{ label: "CLI Reference", command: "npm run docs:cli" },
				],
			},
			make: {
				hub: { ui: "src/ui", domain: "src/domain" },
			},
		};

		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockImplementation((filePath: string) => {
			if (typeof filePath === "string" && filePath.includes("help-content.ts")) return "const x = 1;";
			if (typeof filePath === "string" && filePath.includes("flowti.config.json")) return JSON.stringify(pluginConfig);
			if (typeof filePath === "string" && filePath.includes("package.json")) return '{"scripts":{"build":"esbuild"}}';
			return "{}";
		});

		const result = generateCliReference("/test/project");

		expect(result.success).toBe(true);
	});
});
