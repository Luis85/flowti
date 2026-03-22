import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	PROJECTS_DIR: "/mock/projects",
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/infrastructure/paths.js", async () => {
	const path = await import("node:path");
	return {
		paths: {
			join: (...args: string[]) => path.default.join(...args).replace(/\\/g, "/"),
			resolve: (...args: string[]) => path.default.join(...args).replace(/\\/g, "/"),
			dirname: (p: string) => path.default.dirname(p).replace(/\\/g, "/"),
			basename: path.default.basename,
		},
	};
});

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

vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn() },
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../../src/domain/scaffold/scaffold.js", () => ({
	scaffold: vi.fn(),
	listDefinitions: vi.fn(() => []),
}));

const capturedJson: unknown[] = [];
vi.mock("../../../src/infrastructure/output.js", () => ({
	resolveFormat: vi.fn((flags: Record<string, string | boolean>) => flags.format === "json" ? "json" : "text"),
	printOutput: vi.fn((fmt: string, data: unknown, render: () => void) => {
		if (fmt === "json") {
			capturedJson.push(data);
		} else {
			render();
		}
	}),
}));

import * as fsMod from "../../../src/infrastructure/filesystem.js";
import { paths as mockPaths } from "../../../src/infrastructure/paths.js";
import { log } from "../../../src/infrastructure/logger.js";
import {
	detectNpmDeps,
	detectConfigDeps,
	detectCycles,
	buildDependencyGraph,
	findReverseDeps,
	findDirectDeps,
	filterByType,
	graphStats,
} from "../../../src/domain/project/project-deps.js";
import type { ProjectDependency, DependencyGraph } from "../../../src/domain/project/project-deps.js";
import {
	renderDependencyTree,
	renderMermaidDeps,
	displayDependencyGraph,
	handleProjectDeps,
	createCommands,
} from "../../../src/ui/displays/deps-display.js";

function setDisk(mockFs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: mockFs });
}

function getCommands() {
	return createCommands({ disk: fsMod.disk, paths: mockPaths, log } as never);
}

function makeDeps(files?: Record<string, string>) {
	const disk = createMockFs(files);
	setDisk(disk);
	return { disk, paths: mockPaths };
}

beforeEach(() => {
	vi.clearAllMocks();
	capturedJson.length = 0;
});

// ── detectNpmDeps ──────────────────────────────────────────────────

describe("detectNpmDeps", () => {
	it("detects dependency when package.json references sibling project npm name", () => {
		const npmNameMap = new Map([
			["app-a", "app-a"],
			["shared-lib", "lib-shared"],
		]);

		const d = makeDeps({
			"/mock/projects/app-a/package.json": JSON.stringify({
				name: "app-a",
				dependencies: { "shared-lib": "^1.0.0" },
			}),
		});

		const deps = detectNpmDeps("app-a", "/mock/projects/app-a", npmNameMap, d);

		expect(deps).toHaveLength(1);
		expect(deps[0]).toEqual({
			from: "app-a",
			to: "lib-shared",
			type: "npm",
			detail: "dependencies.shared-lib",
		});
	});

	it("detects devDependency references", () => {
		const d = makeDeps({
			"/mock/projects/app-a/package.json": JSON.stringify({
				name: "app-a",
				devDependencies: { "test-utils": "^2.0.0" },
			}),
		});

		const npmNameMap = new Map([
			["app-a", "app-a"],
			["test-utils", "utils-proj"],
		]);

		const deps = detectNpmDeps("app-a", "/mock/projects/app-a", npmNameMap, d);

		expect(deps).toHaveLength(1);
		expect(deps[0].type).toBe("npm");
		expect(deps[0].detail).toBe("devDependencies.test-utils");
	});

	it("returns empty array when no package.json exists", () => {
		const d = makeDeps();

		const deps = detectNpmDeps("app-a", "/mock/projects/app-a", new Map(), d);
		expect(deps).toEqual([]);
	});

	it("ignores dependencies that are not sibling projects", () => {
		const d = makeDeps({
			"/mock/projects/app-a/package.json": JSON.stringify({
				name: "app-a",
				dependencies: { "lodash": "^4.0.0", "express": "^4.0.0" },
			}),
		});

		const npmNameMap = new Map([["app-a", "app-a"]]);
		const deps = detectNpmDeps("app-a", "/mock/projects/app-a", npmNameMap, d);
		expect(deps).toEqual([]);
	});

	it("does not create self-dependency", () => {
		const d = makeDeps({
			"/mock/projects/app-a/package.json": JSON.stringify({
				name: "app-a",
				dependencies: { "app-a": "^1.0.0" },
			}),
		});

		const npmNameMap = new Map([["app-a", "app-a"]]);
		const deps = detectNpmDeps("app-a", "/mock/projects/app-a", npmNameMap, d);
		expect(deps).toEqual([]);
	});

	it("handles malformed package.json gracefully", () => {
		const d = makeDeps({
			"/mock/projects/app-a/package.json": "not json",
		});

		const deps = detectNpmDeps("app-a", "/mock/projects/app-a", new Map(), d);
		expect(deps).toEqual([]);
	});
});

// ── detectConfigDeps ───────────────────────────────────────────────

describe("detectConfigDeps", () => {
	it("detects publish endpoint referencing another project", () => {
		const d = makeDeps({
			"/mock/projects/cli/configs/flowti.config.json": JSON.stringify({
				name: "cli",
				publish: {
					endpoints: [
						{ name: "plugin-output", path: "../plugin-app/dist" },
					],
				},
			}),
		});

		const deps = detectConfigDeps("cli", "/mock/projects/cli", ["cli", "plugin-app"], d);

		expect(deps).toHaveLength(1);
		expect(deps[0]).toEqual({
			from: "cli",
			to: "plugin-app",
			type: "publish",
			detail: expect.stringContaining("plugin-output"),
		});
	});

	it("returns empty when no config exists", () => {
		const d = makeDeps();

		const deps = detectConfigDeps("cli", "/mock/projects/cli", ["cli", "other"], d);
		expect(deps).toEqual([]);
	});

	it("returns empty when no publish endpoints", () => {
		const d = makeDeps({
			"/mock/projects/cli/configs/flowti.config.json": JSON.stringify({
				name: "cli",
			}),
		});

		const deps = detectConfigDeps("cli", "/mock/projects/cli", ["cli", "other"], d);
		expect(deps).toEqual([]);
	});

	it("does not create self-dependency from config", () => {
		const d = makeDeps({
			"/mock/projects/cli/configs/flowti.config.json": JSON.stringify({
				name: "cli",
				publish: {
					endpoints: [{ name: "self", path: "../cli/dist" }],
				},
			}),
		});

		const deps = detectConfigDeps("cli", "/mock/projects/cli", ["cli"], d);
		expect(deps).toEqual([]);
	});

	it("handles malformed config gracefully", () => {
		const d = makeDeps({
			"/mock/projects/cli/configs/flowti.config.json": "bad json",
		});

		const deps = detectConfigDeps("cli", "/mock/projects/cli", ["cli", "other"], d);
		expect(deps).toEqual([]);
	});
});

// ── detectCycles ───────────────────────────────────────────────────

describe("detectCycles", () => {
	it("returns empty array when no cycles exist", () => {
		const edges: ProjectDependency[] = [
			{ from: "A", to: "B", type: "npm", detail: "" },
			{ from: "B", to: "C", type: "npm", detail: "" },
		];

		expect(detectCycles(edges)).toEqual([]);
	});

	it("detects a simple cycle (A → B → A)", () => {
		const edges: ProjectDependency[] = [
			{ from: "A", to: "B", type: "npm", detail: "" },
			{ from: "B", to: "A", type: "npm", detail: "" },
		];

		const cycles = detectCycles(edges);
		expect(cycles.length).toBeGreaterThanOrEqual(1);

		// At least one cycle should contain both A and B
		const flat = cycles.flat();
		expect(flat).toContain("A");
		expect(flat).toContain("B");
	});

	it("detects a transitive cycle (A → B → C → A)", () => {
		const edges: ProjectDependency[] = [
			{ from: "A", to: "B", type: "npm", detail: "" },
			{ from: "B", to: "C", type: "npm", detail: "" },
			{ from: "C", to: "A", type: "npm", detail: "" },
		];

		const cycles = detectCycles(edges);
		expect(cycles.length).toBeGreaterThanOrEqual(1);

		const flat = cycles.flat();
		expect(flat).toContain("A");
		expect(flat).toContain("B");
		expect(flat).toContain("C");
	});

	it("returns empty for no edges", () => {
		expect(detectCycles([])).toEqual([]);
	});

	it("handles disconnected components", () => {
		const edges: ProjectDependency[] = [
			{ from: "A", to: "B", type: "npm", detail: "" },
			{ from: "C", to: "D", type: "npm", detail: "" },
		];

		expect(detectCycles(edges)).toEqual([]);
	});
});

// ── renderDependencyTree ───────────────────────────────────────────

describe("renderDependencyTree", () => {
	it("renders tree with dependencies", () => {
		const graph: DependencyGraph = {
			projects: ["app", "lib"],
			edges: [
				{ from: "app", to: "lib", type: "npm", detail: "dependencies.lib" },
			],
			cycles: [],
		};

		const output = renderDependencyTree(graph);
		expect(output).toContain("app");
		expect(output).toContain("└──");
		expect(output).toContain("lib");
		expect(output).toContain("[npm]");
	});

	it("shows (no dependencies) for isolated projects", () => {
		const graph: DependencyGraph = {
			projects: ["standalone"],
			edges: [],
			cycles: [],
		};

		const output = renderDependencyTree(graph);
		expect(output).toContain("standalone");
		expect(output).toContain("(no dependencies)");
	});

	it("shows circular dependency warnings", () => {
		const graph: DependencyGraph = {
			projects: ["A", "B"],
			edges: [
				{ from: "A", to: "B", type: "npm", detail: "" },
				{ from: "B", to: "A", type: "npm", detail: "" },
			],
			cycles: [["A", "B", "A"]],
		};

		const output = renderDependencyTree(graph);
		expect(output).toContain("Circular Dependencies");
		expect(output).toContain("A");
	});

	it("returns 'No projects found.' when graph has no projects", () => {
		const graph: DependencyGraph = { projects: [], edges: [], cycles: [] };
		expect(renderDependencyTree(graph)).toBe("No projects found.");
	});

	it("uses ├── for non-last deps and └── for last dep", () => {
		const graph: DependencyGraph = {
			projects: ["app", "lib-a", "lib-b"],
			edges: [
				{ from: "app", to: "lib-a", type: "npm", detail: "dep.a" },
				{ from: "app", to: "lib-b", type: "npm", detail: "dep.b" },
			],
			cycles: [],
		};

		const output = renderDependencyTree(graph);
		expect(output).toContain("├──");
		expect(output).toContain("└──");
	});
});

// ── renderMermaidDeps ──────────────────────────────────────────────

describe("renderMermaidDeps", () => {
	it("renders graph LR with edges", () => {
		const graph: DependencyGraph = {
			projects: ["app", "lib"],
			edges: [
				{ from: "app", to: "lib", type: "npm", detail: "" },
			],
			cycles: [],
		};

		const output = renderMermaidDeps(graph);
		expect(output).toContain("graph LR");
		expect(output).toContain("app");
		expect(output).toContain("lib");
		expect(output).toContain("|npm|");
	});

	it("renders isolated nodes without edges", () => {
		const graph: DependencyGraph = {
			projects: ["standalone"],
			edges: [],
			cycles: [],
		};

		const output = renderMermaidDeps(graph);
		expect(output).toContain("graph LR");
		expect(output).toContain("standalone");
	});

	it("renders comment when no projects exist", () => {
		const graph: DependencyGraph = { projects: [], edges: [], cycles: [] };
		const output = renderMermaidDeps(graph);
		expect(output).toContain("No projects found");
	});

	it("deduplicates edges", () => {
		const graph: DependencyGraph = {
			projects: ["A", "B"],
			edges: [
				{ from: "A", to: "B", type: "npm", detail: "dep1" },
				{ from: "A", to: "B", type: "npm", detail: "dep2" },
			],
			cycles: [],
		};

		const output = renderMermaidDeps(graph);
		// Should only have one A --> B edge line (plus graph LR header)
		const edgeLines = output.split("\n").filter((l) => l.includes("-->"));
		expect(edgeLines).toHaveLength(1);
	});

	it("includes isolated projects alongside connected ones", () => {
		const graph: DependencyGraph = {
			projects: ["A", "B", "C"],
			edges: [
				{ from: "A", to: "B", type: "npm", detail: "" },
			],
			cycles: [],
		};

		const output = renderMermaidDeps(graph);
		expect(output).toContain("A");
		expect(output).toContain("B");
		expect(output).toContain("C");
	});
});

// ── buildDependencyGraph ───────────────────────────────────────────

describe("buildDependencyGraph", () => {
	it("builds graph from multiple projects with npm deps", () => {
		const d = makeDeps({
			"/mock/projects/app/package.json": JSON.stringify({
				name: "@org/app",
				dependencies: { "@org/lib": "^1.0.0" },
			}),
			"/mock/projects/lib/package.json": JSON.stringify({
				name: "@org/lib",
			}),
		});

		const graph = buildDependencyGraph("/mock/projects", d);

		expect(graph.projects).toEqual(["app", "lib"]);
		expect(graph.edges).toHaveLength(1);
		expect(graph.edges[0].from).toBe("app");
		expect(graph.edges[0].to).toBe("lib");
		expect(graph.edges[0].type).toBe("npm");
		expect(graph.cycles).toEqual([]);
	});

	it("handles empty projects directory", () => {
		const d = makeDeps();
		d.disk.readdirSync = () => { throw new Error("ENOENT"); };

		const graph = buildDependencyGraph("/mock/projects", d);
		expect(graph.projects).toEqual([]);
		expect(graph.edges).toEqual([]);
		expect(graph.cycles).toEqual([]);
	});

	it("detects cycles in built graph", () => {
		const d = makeDeps({
			"/mock/projects/A/package.json": JSON.stringify({
				name: "pkg-a",
				dependencies: { "pkg-b": "^1.0.0" },
			}),
			"/mock/projects/B/package.json": JSON.stringify({
				name: "pkg-b",
				dependencies: { "pkg-a": "^1.0.0" },
			}),
		});

		const graph = buildDependencyGraph("/mock/projects", d);
		expect(graph.cycles.length).toBeGreaterThanOrEqual(1);
	});
});

// ── displayDependencyGraph ─────────────────────────────────────────

describe("displayDependencyGraph", () => {
	it("displays no-projects message for empty graph", () => {
		const graph: DependencyGraph = { projects: [], edges: [], cycles: [] };
		displayDependencyGraph(graph, log);

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("No projects found"))).toBe(true);
	});

	it("displays projects with their dependencies", () => {
		const graph: DependencyGraph = {
			projects: ["app", "lib"],
			edges: [{ from: "app", to: "lib", type: "npm", detail: "dependencies.lib" }],
			cycles: [],
		};

		displayDependencyGraph(graph, log);

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		const allOutput = logCalls.filter((c) => typeof c === "string").join("\n");
		expect(allOutput).toContain("app");
		expect(allOutput).toContain("lib");
		expect(allOutput).toContain("Mermaid");
	});

	it("displays cycle warnings", () => {
		const graph: DependencyGraph = {
			projects: ["A", "B"],
			edges: [
				{ from: "A", to: "B", type: "npm", detail: "" },
				{ from: "B", to: "A", type: "npm", detail: "" },
			],
			cycles: [["A", "B", "A"]],
		};

		displayDependencyGraph(graph, log);

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		const allOutput = logCalls.filter((c) => typeof c === "string").join("\n");
		expect(allOutput).toContain("Circular Dependencies");
	});
});

// ── handleProjectDeps ──────────────────────────────────────────────

describe("handleProjectDeps", () => {
	it("builds and displays the dependency graph", () => {
		const mockFs = createMockFs({
			"/mock/projects/my-app/package.json": JSON.stringify({ name: "my-app" }),
		});
		setDisk(mockFs);

		handleProjectDeps({ disk: mockFs, paths: mockPaths, log } as never);

		expect(vi.mocked(log)).toHaveBeenCalled();
	});
});

// ── project:deps --json ───────────────────────────────────────────

describe("project:deps --json", () => {
	it("outputs DependencyGraph as JSON with --format=json", () => {
		const mockFs = createMockFs({
			"/mock/projects/app/package.json": JSON.stringify({
				name: "@org/app",
				dependencies: { "@org/lib": "^1.0.0" },
			}),
			"/mock/projects/lib/package.json": JSON.stringify({
				name: "@org/lib",
			}),
		});
		setDisk(mockFs);

		getCommands()["project:deps"]({ format: "json" });

		expect(capturedJson).toHaveLength(1);
		const graph = capturedJson[0] as DependencyGraph;
		expect(graph.projects).toEqual(["app", "lib"]);
		expect(graph.edges).toHaveLength(1);
		expect(graph.edges[0].from).toBe("app");
		expect(graph.edges[0].to).toBe("lib");
		expect(graph.cycles).toEqual([]);
	});

	it("outputs text display when no --format flag", () => {
		const mockFs = createMockFs({
			"/mock/projects/my-app/package.json": JSON.stringify({ name: "my-app" }),
		});
		setDisk(mockFs);

		getCommands()["project:deps"]({});

		expect(capturedJson).toHaveLength(0);
		expect(vi.mocked(log)).toHaveBeenCalled();
	});
});

// ── Query helpers ──────────────────────────────────────────────────

const sampleGraph: DependencyGraph = {
	projects: ["app", "lib", "tools", "standalone"],
	edges: [
		{ from: "app", to: "lib", type: "npm", detail: "dependencies.lib" },
		{ from: "app", to: "tools", type: "npm", detail: "devDependencies.tools" },
		{ from: "tools", to: "lib", type: "publish", detail: "publish.endpoints[dist]" },
	],
	cycles: [],
};

describe("findReverseDeps", () => {
	it("returns projects that depend on the given project", () => {
		const result = findReverseDeps(sampleGraph, "lib");
		expect(result).toHaveLength(2);
		expect(result.map((d) => d.from).sort()).toEqual(["app", "tools"]);
	});

	it("returns empty for project with no dependents", () => {
		expect(findReverseDeps(sampleGraph, "app")).toEqual([]);
	});

	it("returns empty for isolated project", () => {
		expect(findReverseDeps(sampleGraph, "standalone")).toEqual([]);
	});
});

describe("findDirectDeps", () => {
	it("returns direct dependencies of a project", () => {
		const result = findDirectDeps(sampleGraph, "app");
		expect(result).toHaveLength(2);
		expect(result.map((d) => d.to).sort()).toEqual(["lib", "tools"]);
	});

	it("returns empty for project with no deps", () => {
		expect(findDirectDeps(sampleGraph, "standalone")).toEqual([]);
	});
});

describe("filterByType", () => {
	it("filters edges by npm type", () => {
		const result = filterByType(sampleGraph.edges, "npm");
		expect(result).toHaveLength(2);
		expect(result.every((e) => e.type === "npm")).toBe(true);
	});

	it("filters edges by publish type", () => {
		const result = filterByType(sampleGraph.edges, "publish");
		expect(result).toHaveLength(1);
		expect(result[0].from).toBe("tools");
	});

	it("returns empty for type with no matches", () => {
		expect(filterByType(sampleGraph.edges, "config")).toEqual([]);
	});
});

describe("graphStats", () => {
	it("computes correct stats", () => {
		const stats = graphStats(sampleGraph);
		expect(stats.projects).toBe(4);
		expect(stats.edges).toBe(3);
		expect(stats.cycles).toBe(0);
		expect(stats.isolated).toBe(1); // standalone
	});

	it("identifies project with most dependencies", () => {
		const stats = graphStats(sampleGraph);
		expect(stats.mostDeps).toEqual({ name: "app", count: 2 });
	});

	it("identifies most depended-on project", () => {
		const stats = graphStats(sampleGraph);
		expect(stats.mostDependedOn).toEqual({ name: "lib", count: 2 });
	});

	it("handles empty graph", () => {
		const stats = graphStats({ projects: [], edges: [], cycles: [] });
		expect(stats.projects).toBe(0);
		expect(stats.isolated).toBe(0);
		expect(stats.mostDeps).toBeNull();
		expect(stats.mostDependedOn).toBeNull();
	});

	it("handles graph with all isolated projects", () => {
		const stats = graphStats({ projects: ["a", "b", "c"], edges: [], cycles: [] });
		expect(stats.isolated).toBe(3);
		expect(stats.mostDeps).toBeNull();
	});
});
