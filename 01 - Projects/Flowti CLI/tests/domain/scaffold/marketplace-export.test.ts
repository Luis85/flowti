import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BOLD: "",
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string, ext?: string) => {
			const b = p.split("/").pop() || "";
			return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b;
		},
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	},
}));
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

// Mock loaders
vi.mock("../../../src/domain/ai-tools/ai-tool-loader.js", () => ({
	loadAiTools: vi.fn(() => []),
	AI_TOOLS_DIR: ".flowti/ai-tools",
}));
vi.mock("../../../src/domain/plugins/plugin-loader.js", () => ({
	discoverPluginFiles: vi.fn(() => []),
	PLUGINS_DIR: ".flowti/plugins",
}));
vi.mock("../../../src/domain/scaffold/marketplace.js", () => ({
	discoverLocalDefinitions: vi.fn(() => []),
	resolveDefinitionsDir: vi.fn((_deps: unknown, p: string) => p + "/configs/definitions"),
}));

import path from "node:path";
import { loadAiTools } from "../../../src/domain/ai-tools/ai-tool-loader.js";
import { discoverPluginFiles } from "../../../src/domain/plugins/plugin-loader.js";
import { discoverLocalDefinitions } from "../../../src/domain/scaffold/marketplace.js";
import {
	exportBundle,
	saveBundle,
	loadBundle,
	importAiToolsFromBundle,
	type ExportBundle,
} from "../../../src/domain/scaffold/marketplace-export.js";

const testPaths = {
	join: (...args: string[]) => args.join("/"),
	basename: (p: string, ext?: string) => { const b = path.basename(p); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; },
	dirname: (p: string) => path.dirname(p).replace(/\\/g, "/"),
	resolve: (...args: string[]) => args.join("/"),
	relative: (_from: string, to: string) => to,
};

const testClock = { iso: () => "2026-03-09", now: () => new Date(), ms: () => 0, safeIso: () => "2026-03-09" };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("exportBundle", () => {
	it("returns empty bundle when no definitions exist", () => {
		const fs = createMockFs();
		const bundle = exportBundle({ disk: fs, paths: testPaths, clock: testClock }, "/vault", "/project");
		expect(bundle.version).toBe(1);
		expect(bundle.vault).toBe("vault");
		expect(bundle.aiTools).toHaveLength(0);
		expect(bundle.plugins).toHaveLength(0);
		expect(bundle.scaffolds).toHaveLength(0);
	});

	it("includes valid AI tools", () => {
		vi.mocked(loadAiTools).mockReturnValue([
			{
				definition: { name: "search", description: "Search", run: "grep" },
				path: "/vault/.flowti/ai-tools/search.json",
				valid: true,
				errors: [],
			},
			{
				definition: { name: "broken", description: "", run: "" },
				path: "/vault/.flowti/ai-tools/broken.json",
				valid: false,
				errors: ["Missing run"],
			},
		]);

		const fs = createMockFs();
		const bundle = exportBundle({ disk: fs, paths: testPaths, clock: testClock }, "/vault", undefined);
		expect(bundle.aiTools).toHaveLength(1);
		expect(bundle.aiTools[0].name).toBe("search");
	});

	it("includes plugins from manifest files", () => {
		const fs = createMockFs({
			"/vault/.flowti/plugins/my-plugin/manifest.json": JSON.stringify({
				name: "my-plugin",
				description: "A plugin",
				commands: {},
			}),
		});
		vi.mocked(discoverPluginFiles).mockReturnValue(["/vault/.flowti/plugins/my-plugin/manifest.json"]);

		const bundle = exportBundle({ disk: fs, paths: testPaths, clock: testClock }, "/vault", undefined);
		expect(bundle.plugins).toHaveLength(1);
		expect(bundle.plugins[0].name).toBe("my-plugin");
	});

	it("includes local scaffold definitions", () => {
		vi.mocked(discoverLocalDefinitions).mockReturnValue([
			{ raw: { id: "my-scaffold", description: "A scaffold" }, path: "/project/configs/definitions/my-scaffold.json" },
		]);

		const fs = createMockFs();
		const bundle = exportBundle({ disk: fs, paths: testPaths, clock: testClock }, "/vault", "/project");
		expect(bundle.scaffolds).toHaveLength(1);
		expect(bundle.scaffolds[0].name).toBe("my-scaffold");
	});
});

describe("saveBundle", () => {
	it("writes bundle JSON to file", () => {
		const fs = createMockFs();
		const bundle: ExportBundle = {
			version: 1,
			exported: "2026-03-09",
			vault: "test",
			aiTools: [],
			plugins: [],
			scaffolds: [],
		};

		const result = saveBundle({ disk: fs, paths: testPaths }, bundle, "/out/bundle.json");
		expect(result).toBe("/out/bundle.json");
		expect(fs.files.has("/out/bundle.json")).toBe(true);
		const saved = JSON.parse(fs.files.get("/out/bundle.json")!);
		expect(saved.version).toBe(1);
	});
});

describe("loadBundle", () => {
	it("loads a valid bundle", () => {
		const bundle: ExportBundle = {
			version: 1,
			exported: "2026-03-09",
			vault: "test",
			aiTools: [],
			plugins: [],
			scaffolds: [],
		};
		const fs = createMockFs({ "/bundle.json": JSON.stringify(bundle) });

		const loaded = loadBundle({ disk: fs }, "/bundle.json");
		expect(loaded).not.toBeNull();
		expect(loaded!.vault).toBe("test");
	});

	it("returns null for missing file", () => {
		const fs = createMockFs();
		expect(loadBundle({ disk: fs }, "/missing.json")).toBeNull();
	});

	it("returns null for invalid version", () => {
		const fs = createMockFs({ "/bad.json": JSON.stringify({ version: 99 }) });
		expect(loadBundle({ disk: fs }, "/bad.json")).toBeNull();
	});

	it("returns null for corrupt JSON", () => {
		const fs = createMockFs({ "/bad.json": "not json" });
		expect(loadBundle({ disk: fs }, "/bad.json")).toBeNull();
	});
});

describe("importAiToolsFromBundle", () => {
	it("imports AI tools that do not already exist", () => {
		const fs = createMockFs();
		const bundle: ExportBundle = {
			version: 1,
			exported: "2026-03-09",
			vault: "source",
			aiTools: [
				{ name: "search", description: "Search", source: "/src", definition: { name: "search", run: "grep" } },
			],
			plugins: [],
			scaffolds: [],
		};

		const count = importAiToolsFromBundle({ disk: fs, paths: testPaths }, bundle, "/vault");
		expect(count).toBe(1);
		expect(fs.files.has("/vault/.flowti/ai-tools/search.json")).toBe(true);
	});

	it("skips tools that already exist", () => {
		const fs = createMockFs({
			"/vault/.flowti/ai-tools/search.json": "{}",
		});
		const bundle: ExportBundle = {
			version: 1,
			exported: "2026-03-09",
			vault: "source",
			aiTools: [
				{ name: "search", description: "Search", source: "/src", definition: { name: "search", run: "grep" } },
			],
			plugins: [],
			scaffolds: [],
		};

		const count = importAiToolsFromBundle({ disk: fs, paths: testPaths }, bundle, "/vault");
		expect(count).toBe(0);
	});
});
