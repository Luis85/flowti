/**
 * state-splitter.test.ts — Tests for StateSplitter identity injection and state snapshots.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", GREEN: "", CYAN: "", BOLD: "", RED: "", YELLOW: "" }));

import { createStateSplitter, type IStateSplitter, type SplitterDeps } from "../../src/infrastructure/state-splitter.js";

function asDeps(deps: ReturnType<typeof createMockDeps>): SplitterDeps {
	return deps as unknown as SplitterDeps;
}

function createMockDeps() {
	const files = new Map<string, string>();
	const dirs = new Set<string>();
	return {
		disk: {
			existsSync: (p: string) => files.has(p) || dirs.has(p),
			readFileSync: (p: string) => files.get(p) ?? "",
			writeFileSync: (p: string, c: string) => files.set(p, c),
			copyFileSync: (from: string, to: string) => files.set(to, files.get(from) ?? ""),
			mkdirSync: (p: string) => dirs.add(p),
			readdirSync: () => [],
		},
		dirs,
		paths: {
			join: (...parts: string[]) => parts.join("/"),
			resolve: (p: string) => p,
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		},
		shell: {
			runCaptureDetailed: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0 })),
		},
		files,
	};
}

describe("StateSplitter", () => {
	let splitter: IStateSplitter;
	let files: Map<string, string>;

	beforeEach(() => {
		const deps = createMockDeps();
		files = deps.files;

		// Set up vault files
		files.set("/vault/CLAUDE.md", "# Claude instructions");
		files.set("/vault/.flowti/config.json", '{"version":"1","agents":{"dir":"03 - Resources/Agents"}}');
		files.set("/vault/.flowti/var/data-bob.json", '{"name":"bob","status":"idle","tasks":[]}');
		files.set("/vault/.flowti/var/world-state.json", '{"version":1,"entities":{}}');

		splitter = createStateSplitter(asDeps(deps), "/vault");
	});

	it("copies CLAUDE.md to workspace root", () => {
		splitter.inject("bob", "/workspace");
		expect(files.get("/workspace/CLAUDE.md")).toBe("# Claude instructions");
	});

	it("snapshots agent runtime state", () => {
		splitter.inject("bob", "/workspace");
		expect(files.has("/workspace/.flowti/var/data-bob.json")).toBe(true);
	});

	it("snapshots world state", () => {
		splitter.inject("bob", "/workspace");
		expect(files.has("/workspace/.flowti/var/world-state.json")).toBe(true);
	});

	it("creates empty conversation stub", () => {
		splitter.inject("bob", "/workspace");
		const conv = files.get("/workspace/.flowti/var/conversations/bob.json");
		expect(conv).toBeDefined();
		expect(JSON.parse(conv!)).toEqual({ threads: [] });
	});

	it("copies .flowti/config.json to workspace", () => {
		splitter.inject("bob", "/workspace");
		expect(files.get("/workspace/.flowti/config.json")).toBe(
			'{"version":"1","agents":{"dir":"03 - Resources/Agents"}}',
		);
	});

	it("copies .claude/ directory via shell", () => {
		const deps = createMockDeps();
		files = deps.files;
		deps.dirs.add("/vault/.claude");
		files.set("/vault/CLAUDE.md", "# Claude instructions");
		files.set("/vault/.claude/rules/foo.md", "rule");
		splitter = createStateSplitter(asDeps(deps), "/vault");

		splitter.inject("bob", "/workspace");
		expect(deps.shell.runCaptureDetailed).toHaveBeenCalledWith(
			expect.stringContaining(".claude"),
		);
	});

	it("skips missing files without error", () => {
		const deps = createMockDeps();
		// No files at all — should not throw
		splitter = createStateSplitter(asDeps(deps), "/empty-vault");
		expect(() => splitter.inject("bob", "/workspace")).not.toThrow();
	});

	it("preserves agent state content accurately", () => {
		splitter.inject("bob", "/workspace");
		const content = files.get("/workspace/.flowti/var/data-bob.json");
		expect(content).toBe('{"name":"bob","status":"idle","tasks":[]}');
	});

	it("preserves world state content accurately", () => {
		splitter.inject("bob", "/workspace");
		const content = files.get("/workspace/.flowti/var/world-state.json");
		expect(content).toBe('{"version":1,"entities":{}}');
	});
});
