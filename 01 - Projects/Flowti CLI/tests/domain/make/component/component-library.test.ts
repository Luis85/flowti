import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", YELLOW: "", RED: "",
}));
vi.mock("../../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock",
	CLI_PROJECT: "/mock/cli",
	cliConfig: {},
}));

import {
	discoverLibraries,
	importLibraryDefinition,
	importAllLibraryDefinitions,
} from "../../../../src/domain/make/component/component-library.js";
import type { ComponentLibraryDeps } from "../../../../src/domain/make/component/component-library.js";

function mockDeps(fs: Record<string, string | string[]> = {}): ComponentLibraryDeps {
	const dirs = new Set<string>();
	const fileMap = new Map<string, string>();
	const dirContents = new Map<string, string[]>();

	for (const [path, content] of Object.entries(fs)) {
		if (Array.isArray(content)) {
			dirs.add(path);
			dirContents.set(path, content);
		} else {
			fileMap.set(path, content);
		}
	}

	return {
		disk: {
			existsSync: vi.fn((p: string) => dirs.has(p) || fileMap.has(p)),
			readFileSync: vi.fn((p: string) => fileMap.get(p) ?? ""),
			writeFileSync: vi.fn(),
			mkdirSync: vi.fn(),
			unlinkSync: vi.fn(),
			readdirSync: vi.fn((p: string) => dirContents.get(p) ?? []),
			statSync: vi.fn((p: string) => ({
				isDirectory: () => dirs.has(p),
				isFile: () => fileMap.has(p),
			})),
		} as any,
		paths: {
			join: (...parts: string[]) => parts.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		} as any,
		clock: {
			iso: () => "2026-01-01T00:00:00.000Z",
			ms: () => 0,
			now: () => new Date("2026-01-01"),
			safeIso: () => "2026-01-01T00-00-00",
		} as any,
	};
}

describe("discoverLibraries", () => {
	it("returns empty when components dir does not exist", () => {
		const deps = mockDeps();
		expect(discoverLibraries("/project", deps)).toEqual([]);
	});

	it("discovers a library with multiple JSON files", () => {
		const deps = mockDeps();
		const dirPaths = new Set([
			"/project/components",
			"/project/components/prime-ng",
			"/project/components/button",
		]);

		vi.mocked(deps.disk.readdirSync).mockImplementation((p: string) => {
			if (p === "/project/components") return ["prime-ng", "button"] as any;
			if (p === "/project/components/prime-ng") return ["accordion.json", "datatable.json"] as any;
			if (p === "/project/components/button") return ["button.json"] as any;
			return [];
		});
		vi.mocked(deps.disk.existsSync).mockReturnValue(true);
		vi.mocked(deps.disk.statSync).mockImplementation((p: string) => ({
			isDirectory: () => dirPaths.has(p),
			isFile: () => !dirPaths.has(p),
		}) as any);

		const libs = discoverLibraries("/project", deps);
		expect(libs).toHaveLength(1);
		expect(libs[0].name).toBe("prime-ng");
		expect(libs[0].definitions).toEqual(["accordion.json", "datatable.json"]);
	});

	it("ignores regular component folders (single same-name JSON)", () => {
		const deps = mockDeps();
		const dirPaths = new Set([
			"/project/components",
			"/project/components/my-button",
		]);
		vi.mocked(deps.disk.existsSync).mockReturnValue(true);
		vi.mocked(deps.disk.statSync).mockImplementation((p: string) => ({
			isDirectory: () => dirPaths.has(p),
			isFile: () => !dirPaths.has(p),
		}) as any);
		vi.mocked(deps.disk.readdirSync).mockImplementation((p: string) => {
			if (p === "/project/components") return ["my-button"] as any;
			if (p === "/project/components/my-button") return ["my-button.json", "my-button.md"] as any;
			return [];
		});

		expect(discoverLibraries("/project", deps)).toEqual([]);
	});

	it("counts scaffolded definitions (subfolder-based)", () => {
		const deps = mockDeps();
		const dirPaths = new Set([
			"/project/components",
			"/project/components/lib",
			"/project/components/lib/a",  // imported subfolder
		]);
		vi.mocked(deps.disk.existsSync).mockImplementation((p: string) => {
			if (p === "/project/components/lib/a/a.json") return true;
			return dirPaths.has(p);
		});
		vi.mocked(deps.disk.statSync).mockImplementation((p: string) => ({
			isDirectory: () => dirPaths.has(p),
			isFile: () => !dirPaths.has(p),
		}) as any);
		vi.mocked(deps.disk.readdirSync).mockImplementation((p: string) => {
			if (p === "/project/components") return ["lib"] as any;
			// "a" is an imported subfolder, "b.json" is still pending
			if (p === "/project/components/lib") return ["a", "b.json"] as any;
			return [];
		});

		const libs = discoverLibraries("/project", deps);
		expect(libs[0].scaffoldedCount).toBe(1);
		expect(libs[0].definitions).toEqual(["b.json"]); // only pending
	});
});

describe("importLibraryDefinition", () => {
	it("returns error when JSON is invalid", () => {
		const deps = mockDeps();
		vi.mocked(deps.disk.existsSync).mockReturnValue(true);
		vi.mocked(deps.disk.readFileSync).mockReturnValue("not json" as never);

		const result = importLibraryDefinition("/project", "lib", "bad.json", deps);
		expect(result.errors).toHaveLength(1);
		expect(result.filesWritten).toBe(0);
	});

	it("returns error when type is unknown", () => {
		const deps = mockDeps();
		vi.mocked(deps.disk.existsSync).mockReturnValue(true);
		vi.mocked(deps.disk.readFileSync).mockReturnValue('{"name":"X","type":"unknown-type"}' as never);

		const result = importLibraryDefinition("/project", "lib", "x.json", deps);
		expect(result.errors[0]).toContain("Unknown type");
	});

	it("generates files for a valid definition", () => {
		const deps = mockDeps();
		vi.mocked(deps.disk.existsSync).mockReturnValue(false); // no existing files
		vi.mocked(deps.disk.readFileSync).mockReturnValue('{"name":"Accordion","type":"component","id":"accordion"}' as never);

		const result = importLibraryDefinition("/project", "prime-ng", "accordion.json", deps);
		expect(result.errors).toHaveLength(0);
		expect(result.filesWritten).toBeGreaterThan(0);
		expect(result.name).toBe("Accordion");
	});

	it("moves the JSON into the subfolder during import", () => {
		const deps = mockDeps();
		vi.mocked(deps.disk.existsSync).mockReturnValue(false);
		vi.mocked(deps.disk.readFileSync).mockReturnValue('{"name":"Btn","type":"component","id":"btn"}' as never);

		importLibraryDefinition("/project", "lib", "btn.json", deps);

		const writeCalls = vi.mocked(deps.disk.writeFileSync).mock.calls;
		const writtenPaths = writeCalls.map(([p]) => String(p));
		// The JSON is copied to the subfolder
		expect(writtenPaths).toContain("/project/components/lib/btn/btn.json");
		// unlinkSync removes the original
		expect(deps.disk.unlinkSync).toHaveBeenCalledWith("/project/components/lib/btn.json");
	});
});

describe("importAllLibraryDefinitions", () => {
	it("returns error when library not found", () => {
		const deps = mockDeps();
		vi.mocked(deps.disk.existsSync).mockReturnValue(false);

		const result = importAllLibraryDefinitions("/project", "missing", deps);
		expect(result.errors[0]).toContain("not found");
	});
});

// Helper: marks a path as a directory in the mock
function dirs(): string[] {
	return [];
}
