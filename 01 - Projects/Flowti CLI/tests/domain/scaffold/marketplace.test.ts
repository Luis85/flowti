import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn((...args: never[]) => console.log(...args)),
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", DIM: "", BOLD: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

import path from "node:path";
import {
	discoverLocalDefinitions,
	validateAndClassify,
	buildMarketplaceListing,
	importDefinition,
	resolveDefinitionsDir,
} from "../../../src/domain/scaffold/marketplace.js";
import type { MarketplaceEntry } from "../../../src/domain/scaffold/marketplace.js";
import { renderMarketplace } from "../../../src/ui/displays/scaffold-display.js";
import type { IFileSystem } from "../../../src/infrastructure/types.js";

const testPaths = {
	join: (...args: string[]) => args.join("/"),
	basename: (p: string, ext?: string) => { const b = path.basename(p); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; },
	dirname: (p: string) => path.dirname(p).replace(/\\/g, "/"),
	resolve: (...args: string[]) => args.join("/"),
	relative: (_from: string, to: string) => to,
	extname: (p: string) => { const m = p.match(/\.[^.]+$/); return m ? m[0] : ""; },
	isAbsolute: (p: string) => p.startsWith("/"),
	sep: "/" as const,
};

const testPathsDeps = { paths: testPaths } as const;

// ── Fixtures ─────────────────────────────────────────────────────────

const VALID_DEF = {
	id: "test-scaffold",
	label: "Test Scaffold",
	description: "A test scaffold definition.",
	prompts: [],
	package: {
		type: "module",
		scripts: { build: "tsc" },
		devDependencies: { typescript: "^5.0.0" },
	},
	flowtiConfig: {},
	directories: ["src"],
	files: [
		{ path: "src/main.ts", templateId: "project-main" },
	],
	nextSteps: ["npm install"],
};

const VALID_DEF_2 = {
	...VALID_DEF,
	id: "custom-lib",
	label: "Custom Library",
	description: "A library scaffold.",
	files: [
		{ path: "src/index.ts", templateId: "shared-index" },
	],
};

const INVALID_DEF = {
	id: "",
	label: "",
	// missing required fields
};

/** Normalize path separators for cross-platform matching. */
function norm(p: string): string {
	return p.replace(/\\/g, "/");
}

function createMockFs(files: Record<string, string> = {}, dirs: Set<string> = new Set()): IFileSystem {
	// Build a normalized lookup for cross-platform support
	const normalizedFiles = new Map<string, string>();
	for (const [k, v] of Object.entries(files)) {
		normalizedFiles.set(norm(k), v);
	}
	const normalizedDirs = new Set([...dirs].map(norm));

	return {
		readFileSync: vi.fn((path: string) => {
			const n = norm(path);
			if (normalizedFiles.has(n)) return normalizedFiles.get(n)!;
			throw new Error(`ENOENT: ${path}`);
		}) as never,
		writeFileSync: vi.fn(),
		existsSync: vi.fn((path: string) => {
			const n = norm(path);
			return normalizedFiles.has(n) || normalizedDirs.has(n);
		}),
		mkdirSync: vi.fn(),
		readdirSync: vi.fn((path: string) => {
			const prefix = norm(path).replace(/\/$/, "") + "/";
			return [...normalizedFiles.keys()]
				.filter(f => {
					if (!f.startsWith(prefix)) return false;
					const rel = f.slice(prefix.length);
					return rel.length > 0 && !rel.includes("/");
				})
				.map(f => f.slice(prefix.length));
		}) as unknown as IFileSystem["readdirSync"],
		copyFileSync: vi.fn(),
		rmSync: vi.fn(),
		unlinkSync: vi.fn(),
		statSync: vi.fn() as IFileSystem["statSync"],
		renameSync: vi.fn() as IFileSystem["renameSync"],
	};
}

// ── resolveDefinitionsDir ────────────────────────────────────────────

describe("resolveDefinitionsDir", () => {
	it("returns configs/definitions/ relative to project root", () => {
		const result = resolveDefinitionsDir(testPathsDeps, "/projects/my-app");
		expect(result).toContain("configs");
		expect(result).toContain("definitions");
	});
});

// ── discoverLocalDefinitions ─────────────────────────────────────────

describe("discoverLocalDefinitions", () => {
	it("returns empty array when directory does not exist", () => {
		const fs = createMockFs();
		const result = discoverLocalDefinitions({ disk: fs, paths: testPaths }, "/nonexistent");
		expect(result).toEqual([]);
	});

	it("discovers JSON files from a directory", () => {
		const defsDir = "/project/configs/definitions";
		const files: Record<string, string> = {
			[`${defsDir}/my-scaffold.json`]: JSON.stringify(VALID_DEF),
			[`${defsDir}/another.json`]: JSON.stringify(VALID_DEF_2),
		};
		const dirs = new Set([defsDir]);
		const fs = createMockFs(files, dirs);

		const result = discoverLocalDefinitions({ disk: fs, paths: testPaths }, defsDir);
		expect(result).toHaveLength(2);
		expect(result[0].raw).toEqual(VALID_DEF);
		expect(result[0].path).toContain("my-scaffold.json");
	});

	it("skips non-JSON files", () => {
		const defsDir = "/project/configs/definitions";
		const files: Record<string, string> = {
			[`${defsDir}/readme.txt`]: "not a json",
			[`${defsDir}/valid.json`]: JSON.stringify(VALID_DEF),
		};
		const dirs = new Set([defsDir]);
		const fs = createMockFs(files, dirs);

		const result = discoverLocalDefinitions({ disk: fs, paths: testPaths }, defsDir);
		expect(result).toHaveLength(1);
	});

	it("returns null raw for unparseable JSON", () => {
		const defsDir = "/project/configs/definitions";
		const files: Record<string, string> = {
			[`${defsDir}/broken.json`]: "{ not valid json",
		};
		const dirs = new Set([defsDir]);
		const fs = createMockFs(files, dirs);

		const result = discoverLocalDefinitions({ disk: fs, paths: testPaths }, defsDir);
		expect(result).toHaveLength(1);
		expect(result[0].raw).toBeNull();
	});
});

// ── validateAndClassify ──────────────────────────────────────────────

describe("validateAndClassify", () => {
	it("classifies a valid bundled definition", () => {
		const entry = validateAndClassify(testPathsDeps, VALID_DEF, "bundled");
		expect(entry.id).toBe("test-scaffold");
		expect(entry.label).toBe("Test Scaffold");
		expect(entry.source).toBe("bundled");
		expect(entry.valid).toBe(true);
		expect(entry.errors).toEqual([]);
		expect(entry.templateIds).toEqual(["project-main"]);
	});

	it("classifies a valid local definition", () => {
		const entry = validateAndClassify(testPathsDeps, VALID_DEF, "local", "/path/to/def.json");
		expect(entry.source).toBe("local");
		expect(entry.path).toBe("/path/to/def.json");
		expect(entry.valid).toBe(true);
	});

	it("marks invalid definitions with errors", () => {
		const entry = validateAndClassify(testPathsDeps, INVALID_DEF, "local", "/path/to/bad.json");
		expect(entry.valid).toBe(false);
		expect(entry.errors.length).toBeGreaterThan(0);
	});

	it("validates templateIds against known list", () => {
		const entry = validateAndClassify(testPathsDeps, VALID_DEF, "local", undefined, ["other-template"]);
		expect(entry.valid).toBe(false);
		expect(entry.errors.some(e => e.includes("templateId"))).toBe(true);
	});

	it("passes when templateIds are in known list", () => {
		const entry = validateAndClassify(testPathsDeps, VALID_DEF, "local", undefined, ["project-main"]);
		expect(entry.valid).toBe(true);
	});

	it("handles null raw gracefully", () => {
		const entry = validateAndClassify(testPathsDeps, null, "local", "/path/to/null.json");
		expect(entry.valid).toBe(false);
		expect(entry.id).toBe("null");
	});

	it("extracts id from filename when raw has no id", () => {
		const entry = validateAndClassify(testPathsDeps, {}, "local", "/path/to/my-custom.json");
		expect(entry.id).toBe("my-custom");
	});
});

// ── buildMarketplaceListing ──────────────────────────────────────────

describe("buildMarketplaceListing", () => {
	it("combines bundled and local definitions", () => {
		const defsDir = "/project/configs/definitions";
		const files: Record<string, string> = {
			[`${defsDir}/custom.json`]: JSON.stringify(VALID_DEF_2),
		};
		const dirs = new Set([defsDir]);
		const fs = createMockFs(files, dirs);

		const entries = buildMarketplaceListing(
			{ disk: fs, paths: testPaths },
			[VALID_DEF],
			defsDir,
			["project-main", "shared-index"],
		);

		expect(entries).toHaveLength(2);
		expect(entries[0].source).toBe("bundled");
		expect(entries[1].source).toBe("local");
	});

	it("returns only bundled when no local directory exists", () => {
		const fs = createMockFs();
		const entries = buildMarketplaceListing({ disk: fs, paths: testPaths }, [VALID_DEF], "/nonexistent", ["project-main"]);

		expect(entries).toHaveLength(1);
		expect(entries[0].source).toBe("bundled");
		expect(entries[0].valid).toBe(true);
	});

	it("marks local definitions with unknown templates as invalid", () => {
		const defsDir = "/project/configs/definitions";
		const files: Record<string, string> = {
			[`${defsDir}/custom.json`]: JSON.stringify(VALID_DEF_2),
		};
		const dirs = new Set([defsDir]);
		const fs = createMockFs(files, dirs);

		const entries = buildMarketplaceListing(
			{ disk: fs, paths: testPaths },
			[],
			defsDir,
			["project-main"],  // "shared-index" is NOT in the list
		);

		expect(entries).toHaveLength(1);
		expect(entries[0].valid).toBe(false);
		expect(entries[0].errors.some(e => e.includes("shared-index"))).toBe(true);
	});
});

// ── importDefinition ─────────────────────────────────────────────────

describe("importDefinition", () => {
	it("imports a valid definition file", () => {
		const sourcePath = "/tmp/my-def.json";
		const projectRoot = "/project";
		const defsDir = resolveDefinitionsDir(testPathsDeps, projectRoot);
		const files: Record<string, string> = {
			[sourcePath]: JSON.stringify(VALID_DEF),
		};
		const dirs = new Set<string>();
		const fs = createMockFs(files, dirs);

		const result = importDefinition({ disk: fs, paths: testPaths }, sourcePath, projectRoot, ["project-main"]);
		expect(result.success).toBe(true);
		expect(result.errors).toEqual([]);
		expect(fs.mkdirSync).toHaveBeenCalled();
		expect(fs.copyFileSync).toHaveBeenCalledWith(sourcePath, expect.stringContaining("my-def.json"));
	});

	it("rejects when source file does not exist", () => {
		const fs = createMockFs();
		const result = importDefinition({ disk: fs, paths: testPaths }, "/missing.json", "/project", ["project-main"]);
		expect(result.success).toBe(false);
		expect(result.errors[0]).toContain("not found");
	});

	it("rejects invalid JSON", () => {
		const files: Record<string, string> = {
			"/tmp/bad.json": "{ not valid }",
		};
		const fs = createMockFs(files);
		const result = importDefinition({ disk: fs, paths: testPaths }, "/tmp/bad.json", "/project", []);
		expect(result.success).toBe(false);
		expect(result.errors[0]).toContain("parse JSON");
	});

	it("rejects definitions that fail validation", () => {
		const files: Record<string, string> = {
			"/tmp/invalid.json": JSON.stringify(INVALID_DEF),
		};
		const fs = createMockFs(files);
		const result = importDefinition({ disk: fs, paths: testPaths }, "/tmp/invalid.json", "/project", []);
		expect(result.success).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});

	it("rejects duplicate definition ids", () => {
		const sourcePath = "/tmp/dupe.json";
		const projectRoot = "/project";
		const defsDir = resolveDefinitionsDir(testPathsDeps, projectRoot);
		const files: Record<string, string> = {
			[sourcePath]: JSON.stringify(VALID_DEF),
			[`${defsDir}/existing.json`]: JSON.stringify(VALID_DEF),
		};
		const dirs = new Set([defsDir]);
		const fs = createMockFs(files, dirs);

		const result = importDefinition({ disk: fs, paths: testPaths }, sourcePath, projectRoot, ["project-main"]);
		expect(result.success).toBe(false);
		expect(result.errors[0]).toContain("already exists");
	});
});

// ── renderMarketplace ────────────────────────────────────────────────

describe("renderMarketplace", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	});

	it("shows empty message when no entries", () => {
		renderMarketplace({ entries: [] }, logSpy as never);
		expect(logSpy).toHaveBeenCalled();
		const output = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
		expect(output).toContain("No scaffold definitions found");
	});

	it("renders bundled and local sections", () => {
		const entries: MarketplaceEntry[] = [
			{
				id: "bundled-one",
				label: "Bundled One",
				description: "A bundled def",
				source: "bundled",
				templateIds: ["t1"],
				valid: true,
				errors: [],
			},
			{
				id: "local-one",
				label: "Local One",
				description: "A local def",
				source: "local",
				path: "/defs/local.json",
				templateIds: ["t2"],
				valid: true,
				errors: [],
			},
		];

		renderMarketplace({ entries }, logSpy as never);
		const output = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
		expect(output).toContain("Bundled");
		expect(output).toContain("Local");
		expect(output).toContain("bundled-one");
		expect(output).toContain("local-one");
	});

	it("shows validation errors for invalid entries", () => {
		const entries: MarketplaceEntry[] = [
			{
				id: "bad-def",
				label: "Bad Def",
				description: "Invalid",
				source: "local",
				templateIds: [],
				valid: false,
				errors: ["Missing field: id", "Missing field: label"],
			},
		];

		renderMarketplace({ entries }, logSpy as never);
		const output = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
		expect(output).toContain("invalid");
		expect(output).toContain("Missing field: id");
	});

	it("shows total count with valid/invalid breakdown", () => {
		const entries: MarketplaceEntry[] = [
			{ id: "a", label: "A", description: "", source: "bundled", templateIds: [], valid: true, errors: [] },
			{ id: "b", label: "B", description: "", source: "local", templateIds: [], valid: false, errors: ["err"] },
		];

		renderMarketplace({ entries }, logSpy as never);
		const output = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
		expect(output).toContain("1 valid");
		expect(output).toContain("1 invalid");
	});
});
