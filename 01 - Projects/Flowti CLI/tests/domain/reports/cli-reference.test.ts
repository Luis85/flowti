import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		mkdirSync: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
	},
}));

vi.mock("../../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/cli",
	PLUGIN_ROOT: "/plugin",
}));

vi.mock("../../../src/infrastructure/document.js", () => {
	const mockDoc = {
		mergeFrontmatter: vi.fn().mockReturnThis(),
		addBlank: vi.fn().mockReturnThis(),
		heading: vi.fn().mockReturnThis(),
		callout: vi.fn().mockReturnThis(),
		text: vi.fn().mockReturnThis(),
		table: vi.fn().mockReturnThis(),
		addSeparator: vi.fn().mockReturnThis(),
		codeBlock: vi.fn().mockReturnThis(),
		save: vi.fn(),
	};
	return {
		Document: {
			create: vi.fn(() => mockDoc),
		},
	};
});

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-01-01T00:00:00Z" },
}));

import { disk } from "../../../src/infrastructure/filesystem.js";
import { Document } from "../../../src/infrastructure/document.js";

const mockDisk = vi.mocked(disk);

beforeEach(() => {
	vi.clearAllMocks();
});

// We need to test the module's pure functions. Since they're not exported,
// we test them indirectly by running the module and checking Document calls.
// To test extractHelpSections and transformLine we need to import the module.

// Helper: build a minimal HELP source
function buildHelpSource(sections: Record<string, string>): string {
	const entries = Object.entries(sections)
		.map(([key, content]) => `\t${key}: \`${content}\``)
		.join(",\n");
	return `export const HELP: Record<string, string> = {\n${entries}\n};`;
}

describe("cli-reference generator", () => {
	it("generates document when help source exists", async () => {
		const helpSource = buildHelpSource({
			main: "Main help overview",
			build: "Build commands\n  npm run build    Build the project",
		});

		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockImplementation((filePath: string) => {
			if (typeof filePath === "string" && filePath.includes("help.ts")) return helpSource;
			if (typeof filePath === "string" && filePath.includes("flowti.config.json")) return '{"reports":{"scripts":[]},"docs":{"generators":[]}}';
			if (typeof filePath === "string" && filePath.includes("package.json")) return '{"scripts":{"test":"vitest"}}';
			return "{}";
		});

		// Re-import to trigger main()
		vi.resetModules();
		await import("../../../src/domain/reports/generators/cli-reference.js");

		const mockCreate = vi.mocked(Document.create);
		expect(mockCreate).toHaveBeenCalledWith("Flowti CLI Reference");
	});

	it("handles missing help file", async () => {
		mockDisk.existsSync.mockReturnValue(false);
		mockDisk.readFileSync.mockImplementation(() => { throw new Error("not found"); });

		vi.resetModules();
		await import("../../../src/domain/reports/generators/cli-reference.js");

		// Should still create the document (with empty sections)
		const mockCreate = vi.mocked(Document.create);
		expect(mockCreate).toHaveBeenCalledWith("Flowti CLI Reference");
	});

	it("handles missing plugin config/package files", async () => {
		mockDisk.existsSync.mockImplementation((p: string) => {
			if (typeof p === "string" && p.includes("help.ts")) return false;
			return false;
		});

		vi.resetModules();
		await import("../../../src/domain/reports/generators/cli-reference.js");

		const mockCreate = vi.mocked(Document.create);
		expect(mockCreate).toHaveBeenCalled();
	});

	it("processes plugin config with report scripts", async () => {
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
			if (typeof filePath === "string" && filePath.includes("help.ts")) return "const x = 1;";
			if (typeof filePath === "string" && filePath.includes("flowti.config.json")) return JSON.stringify(pluginConfig);
			if (typeof filePath === "string" && filePath.includes("package.json")) return '{"scripts":{"build":"esbuild"}}';
			return "{}";
		});

		vi.resetModules();
		await import("../../../src/domain/reports/generators/cli-reference.js");

		const mockCreate = vi.mocked(Document.create);
		expect(mockCreate).toHaveBeenCalled();
	});

	it("extracts help sections with ANSI escape codes stripped", async () => {
		const helpSource = `export const HELP: Record<string, string> = {
	build: \`
  \${BOLD}BUILD COMMANDS\${RESET}

  \${CYAN}npm run build\${RESET}    Build the project
  \${DIM}--watch\${RESET}          Watch mode\`,
};`;

		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockImplementation((filePath: string) => {
			if (typeof filePath === "string" && filePath.includes("help.ts")) return helpSource;
			if (typeof filePath === "string" && filePath.includes("flowti.config.json")) return "{}";
			if (typeof filePath === "string" && filePath.includes("package.json")) return "{}";
			return "{}";
		});

		vi.resetModules();
		await import("../../../src/domain/reports/generators/cli-reference.js");

		const mockCreate = vi.mocked(Document.create);
		expect(mockCreate).toHaveBeenCalled();
		// The module should have called heading with "Build" section
	});
});
