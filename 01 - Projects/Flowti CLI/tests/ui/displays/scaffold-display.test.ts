import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));

import { log } from "../../../src/infrastructure/logger.js";
import {
	renderDryRunPreview,
	renderScaffoldResult,
	renderDefinitionList,
	renderExportPreview,
	renderExportSaved,
	renderBundleImported,
} from "../../../src/ui/displays/scaffold-display.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => {
	vi.clearAllMocks();
});

describe("renderDryRunPreview", () => {
	it("renders definition, output, and file list", () => {
		renderDryRunPreview({
			definition: "plugin",
			outputPath: "/out/plugin",
			files: ["index.ts", "manifest.json"],
		}, log);
		const out = output();
		expect(out).toContain("Dry run");
		expect(out).toContain("plugin");
		expect(out).toContain("/out/plugin");
		expect(out).toContain("index.ts");
		expect(out).toContain("manifest.json");
	});
});

describe("renderScaffoldResult", () => {
	it("renders created count and path", () => {
		renderScaffoldResult({ created: 3, outputPath: "/out", suggestions: [] }, log);
		expect(output()).toContain("3 files");
		expect(output()).toContain("/out");
	});

	it("renders suggestions when present", () => {
		renderScaffoldResult({
			created: 1,
			outputPath: "/out",
			suggestions: [{ command: "npm install", description: "Install deps" }],
		}, log);
		expect(output()).toContain("npm install");
		expect(output()).toContain("Install deps");
	});

	it("skips suggestions section when empty", () => {
		renderScaffoldResult({ created: 1, outputPath: "/out", suggestions: [] }, log);
		expect(output()).not.toContain("Next:");
	});
});

describe("renderDefinitionList", () => {
	it("renders definitions with id, label, description", () => {
		renderDefinitionList({
			definitions: [
				{ id: "plugin", label: "Plugin", description: "Obsidian plugin scaffold" },
			],
		}, log);
		const out = output();
		expect(out).toContain("plugin");
		expect(out).toContain("Plugin");
		expect(out).toContain("Obsidian plugin scaffold");
	});

	it("renders empty message when no definitions", () => {
		renderDefinitionList({ definitions: [] }, log);
		expect(output()).toContain("No scaffold definitions");
	});
});

describe("renderExportPreview", () => {
	it("renders vault and item counts", () => {
		renderExportPreview({
			vault: "my-vault",
			aiTools: [{ name: "tool1", description: "A tool" }],
			plugins: [],
			scaffolds: [{ name: "scaffold1", description: "A scaffold" }],
		} as never, log);
		const out = output();
		expect(out).toContain("my-vault");
		expect(out).toContain("tool1");
		expect(out).toContain("scaffold1");
	});
});

describe("renderExportSaved", () => {
	it("renders total and output path", () => {
		renderExportSaved({ total: 5, outputPath: "/export.json" }, log);
		const out = output();
		expect(out).toContain("5 definitions");
		expect(out).toContain("/export.json");
	});
});

describe("renderBundleImported", () => {
	it("renders imported count and vault", () => {
		renderBundleImported({ imported: 3, vault: "test-vault" }, log);
		const out = output();
		expect(out).toContain("3");
		expect(out).toContain("test-vault");
	});

	it("uses singular when imported is 1", () => {
		renderBundleImported({ imported: 1, vault: "v" }, log);
		expect(output()).toContain("1 AI tool ");
	});
});
