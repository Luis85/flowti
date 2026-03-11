/**
 * project-deps.ts — Cross-project dependency detection and visualization.
 *
 * Detects dependencies between managed projects by scanning package.json
 * (npm deps/devDeps) and flowti.config.json (publish endpoints, subsystem
 * references). Renders results as text trees and Mermaid diagrams.
 */

import { listProjects, getProjectPath } from "./project.js";
import type { ProjectConfig, PublishEndpoint } from "../../infrastructure/types.js";
import type { CliDeps } from "../../infrastructure/deps.js";

// ── Types ──────────────────────────────────────────────────────────

export interface ProjectDependency {
	from: string;       // project name
	to: string;         // dependency project name
	type: "npm" | "config" | "publish";
	detail: string;     // e.g., "devDependencies.flowti-cli"
}

export interface DependencyGraph {
	projects: string[];
	edges: ProjectDependency[];
	cycles: string[][];
}

// ── Helpers ────────────────────────────────────────────────────────

interface PackageJsonDeps {
	name?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

function readPackageJsonFull(projectPath: string, deps: Pick<CliDeps, "disk" | "paths">): PackageJsonDeps | null {
	const pkgPath = deps.paths.join(projectPath, "package.json");
	if (!deps.disk.existsSync(pkgPath)) return null;
	try {
		return JSON.parse(deps.disk.readFileSync(pkgPath, "utf-8")) as PackageJsonDeps;
	} catch {
		return null;
	}
}

function readFlowtiConfig(projectPath: string, deps: Pick<CliDeps, "disk" | "paths">): ProjectConfig | null {
	const cfgPath = deps.paths.join(projectPath, "configs", "flowti.config.json");
	if (!deps.disk.existsSync(cfgPath)) return null;
	try {
		return JSON.parse(deps.disk.readFileSync(cfgPath, "utf-8")) as ProjectConfig;
	} catch {
		return null;
	}
}

// ── Dependency detection ───────────────────────────────────────────

/**
 * Build a map from npm package name → project folder name for all projects
 * that have a package.json with a `name` field.
 */
function buildNpmNameMap(allProjectNames: string[], deps: Pick<CliDeps, "disk" | "paths">): Map<string, string> {
	const map = new Map<string, string>();
	for (const name of allProjectNames) {
		const pkg = readPackageJsonFull(getProjectPath(name, deps), deps);
		if (pkg?.name) {
			map.set(pkg.name, name);
		}
	}
	return map;
}

/**
 * Detect npm dependencies: check if any dependency/devDependency in this
 * project's package.json matches a sibling project's npm package name.
 */
export function detectNpmDeps(
	projectName: string,
	projectPath: string,
	npmNameMap: Map<string, string>,
	deps: Pick<CliDeps, "disk" | "paths">,
): ProjectDependency[] {
	const pkg = readPackageJsonFull(projectPath, deps);
	if (!pkg) return [];

	const result: ProjectDependency[] = [];

	for (const [section, entries] of [
		["dependencies", pkg.dependencies],
		["devDependencies", pkg.devDependencies],
	] as const) {
		if (!entries) continue;
		for (const depName of Object.keys(entries)) {
			const targetProject = npmNameMap.get(depName);
			if (targetProject && targetProject !== projectName) {
				result.push({
					from: projectName,
					to: targetProject,
					type: "npm",
					detail: `${section}.${depName}`,
				});
			}
		}
	}

	return result;
}

/**
 * Detect config-based dependencies: check publish endpoint paths for
 * references to other project directories.
 */
export function detectConfigDeps(
	projectName: string,
	projectPath: string,
	allProjectNames: string[],
	deps: Pick<CliDeps, "disk" | "paths">,
): ProjectDependency[] {
	const config = readFlowtiConfig(projectPath, deps);
	if (!config) return [];

	const result: ProjectDependency[] = [];
	const endpoints: PublishEndpoint[] = config.publish?.endpoints ?? [];

	for (const endpoint of endpoints) {
		for (const other of allProjectNames) {
			if (other === projectName) continue;
			// Check if the endpoint path references another project directory
			if (endpoint.path.includes(other)) {
				result.push({
					from: projectName,
					to: other,
					type: "publish",
					detail: `publish.endpoints[${endpoint.name}] → ${endpoint.path}`,
				});
			}
		}
	}

	return result;
}

// ── Cycle detection ────────────────────────────────────────────────

/**
 * Detect cycles in the dependency graph using DFS.
 * Returns an array of cycles, each cycle being an array of project names.
 */
export function detectCycles(edges: ProjectDependency[]): string[][] {
	// Build adjacency list
	const adj = new Map<string, string[]>();
	for (const edge of edges) {
		if (!adj.has(edge.from)) adj.set(edge.from, []);
		adj.get(edge.from)!.push(edge.to);
	}

	const cycles: string[][] = [];
	const visited = new Set<string>();
	const inStack = new Set<string>();
	const stack: string[] = [];

	function dfs(node: string): void {
		if (inStack.has(node)) {
			// Found a cycle — extract it from the stack
			const cycleStart = stack.indexOf(node);
			if (cycleStart >= 0) {
				cycles.push([...stack.slice(cycleStart), node]);
			}
			return;
		}
		if (visited.has(node)) return;

		visited.add(node);
		inStack.add(node);
		stack.push(node);

		for (const neighbor of adj.get(node) ?? []) {
			dfs(neighbor);
		}

		stack.pop();
		inStack.delete(node);
	}

	// Get all unique nodes
	const nodes = new Set<string>();
	for (const edge of edges) {
		nodes.add(edge.from);
		nodes.add(edge.to);
	}

	for (const node of nodes) {
		if (!visited.has(node)) {
			dfs(node);
		}
	}

	return cycles;
}

// ── Graph builder ──────────────────────────────────────────────────

/** Build the full dependency graph across all managed projects. */
export function buildDependencyGraph(deps: Pick<CliDeps, "disk" | "paths">): DependencyGraph {
	const projects = listProjects(deps);
	const npmNameMap = buildNpmNameMap(projects, deps);
	const edges: ProjectDependency[] = [];

	for (const name of projects) {
		const projectPath = getProjectPath(name, deps);
		edges.push(...detectNpmDeps(name, projectPath, npmNameMap, deps));
		edges.push(...detectConfigDeps(name, projectPath, projects, deps));
	}

	const cycles = detectCycles(edges);

	return { projects, edges, cycles };
}

// ── Query helpers ──────────────────────────────────────────────────

/** Find all projects that depend on the given project (reverse dependencies). */
export function findReverseDeps(graph: DependencyGraph, projectName: string): ProjectDependency[] {
	return graph.edges.filter((e) => e.to === projectName);
}

/** Find all direct dependencies of a given project. */
export function findDirectDeps(graph: DependencyGraph, projectName: string): ProjectDependency[] {
	return graph.edges.filter((e) => e.from === projectName);
}

/** Filter edges by dependency type. */
export function filterByType(edges: ProjectDependency[], type: ProjectDependency["type"]): ProjectDependency[] {
	return edges.filter((e) => e.type === type);
}

function findMax(countMap: Map<string, number>): { name: string; count: number } | null {
	let best: { name: string; count: number } | null = null;
	for (const [name, count] of countMap) {
		if (!best || count > best.count) {
			best = { name, count };
		}
	}
	return best;
}

/** Compute stats for the dependency graph. */
export function graphStats(graph: DependencyGraph): {
	projects: number;
	edges: number;
	cycles: number;
	isolated: number;
	mostDeps: { name: string; count: number } | null;
	mostDependedOn: { name: string; count: number } | null;
} {
	const connected = new Set<string>();
	for (const edge of graph.edges) {
		connected.add(edge.from);
		connected.add(edge.to);
	}
	const isolated = graph.projects.filter((p) => !connected.has(p)).length;

	const outCount = new Map<string, number>();
	for (const edge of graph.edges) {
		outCount.set(edge.from, (outCount.get(edge.from) ?? 0) + 1);
	}

	const inCount = new Map<string, number>();
	for (const edge of graph.edges) {
		inCount.set(edge.to, (inCount.get(edge.to) ?? 0) + 1);
	}

	return {
		projects: graph.projects.length,
		edges: graph.edges.length,
		cycles: graph.cycles.length,
		isolated,
		mostDeps: findMax(outCount),
		mostDependedOn: findMax(inCount),
	};
}

