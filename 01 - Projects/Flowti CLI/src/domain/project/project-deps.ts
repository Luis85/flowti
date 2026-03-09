/**
 * project-deps.ts — Cross-project dependency detection and visualization.
 *
 * Detects dependencies between managed projects by scanning package.json
 * (npm deps/devDeps) and flowti.config.json (publish endpoints, subsystem
 * references). Renders results as text trees and Mermaid diagrams.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { PROJECTS_DIR } from "../../infrastructure/config.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, DIM, GREEN, YELLOW, RED, CYAN, BOLD } from "../../infrastructure/ui.js";
import { listProjects, getProjectPath } from "./project.js";
import type { ProjectConfig, PublishEndpoint } from "../../infrastructure/types.js";

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

function readPackageJsonFull(projectPath: string): PackageJsonDeps | null {
	const pkgPath = paths.join(projectPath, "package.json");
	if (!disk.existsSync(pkgPath)) return null;
	try {
		return JSON.parse(disk.readFileSync(pkgPath, "utf-8")) as PackageJsonDeps;
	} catch {
		return null;
	}
}

function readFlowtiConfig(projectPath: string): ProjectConfig | null {
	const cfgPath = paths.join(projectPath, "configs", "flowti.config.json");
	if (!disk.existsSync(cfgPath)) return null;
	try {
		return JSON.parse(disk.readFileSync(cfgPath, "utf-8")) as ProjectConfig;
	} catch {
		return null;
	}
}

// ── Dependency detection ───────────────────────────────────────────

/**
 * Build a map from npm package name → project folder name for all projects
 * that have a package.json with a `name` field.
 */
function buildNpmNameMap(allProjectNames: string[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const name of allProjectNames) {
		const pkg = readPackageJsonFull(getProjectPath(name));
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
): ProjectDependency[] {
	const pkg = readPackageJsonFull(projectPath);
	if (!pkg) return [];

	const deps: ProjectDependency[] = [];

	for (const [section, entries] of [
		["dependencies", pkg.dependencies],
		["devDependencies", pkg.devDependencies],
	] as const) {
		if (!entries) continue;
		for (const depName of Object.keys(entries)) {
			const targetProject = npmNameMap.get(depName);
			if (targetProject && targetProject !== projectName) {
				deps.push({
					from: projectName,
					to: targetProject,
					type: "npm",
					detail: `${section}.${depName}`,
				});
			}
		}
	}

	return deps;
}

/**
 * Detect config-based dependencies: check publish endpoint paths for
 * references to other project directories.
 */
export function detectConfigDeps(
	projectName: string,
	projectPath: string,
	allProjectNames: string[],
): ProjectDependency[] {
	const config = readFlowtiConfig(projectPath);
	if (!config) return [];

	const deps: ProjectDependency[] = [];
	const endpoints: PublishEndpoint[] = config.publish?.endpoints ?? [];

	for (const endpoint of endpoints) {
		for (const other of allProjectNames) {
			if (other === projectName) continue;
			// Check if the endpoint path references another project directory
			if (endpoint.path.includes(other)) {
				deps.push({
					from: projectName,
					to: other,
					type: "publish",
					detail: `publish.endpoints[${endpoint.name}] → ${endpoint.path}`,
				});
			}
		}
	}

	return deps;
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
export function buildDependencyGraph(): DependencyGraph {
	const projects = listProjects();
	const npmNameMap = buildNpmNameMap(projects);
	const edges: ProjectDependency[] = [];

	for (const name of projects) {
		const projectPath = getProjectPath(name);
		edges.push(...detectNpmDeps(name, projectPath, npmNameMap));
		edges.push(...detectConfigDeps(name, projectPath, projects));
	}

	const cycles = detectCycles(edges);

	return { projects, edges, cycles };
}

// ── Rendering ──────────────────────────────────────────────────────

function groupEdgesBySource(edges: ProjectDependency[]): Map<string, ProjectDependency[]> {
	const map = new Map<string, ProjectDependency[]>();
	for (const edge of edges) {
		if (!map.has(edge.from)) map.set(edge.from, []);
		map.get(edge.from)!.push(edge);
	}
	return map;
}

/** Render the dependency graph as a text-based tree. */
export function renderDependencyTree(graph: DependencyGraph): string {
	if (graph.projects.length === 0) return "No projects found.";

	const lines: string[] = ["Project Dependencies:", ""];
	const edgesBySource = groupEdgesBySource(graph.edges);

	for (const project of graph.projects) {
		const deps = edgesBySource.get(project) ?? [];
		if (deps.length === 0) {
			lines.push(`  ${project}  (no dependencies)`);
		} else {
			lines.push(`  ${project}`);
			for (let i = 0; i < deps.length; i++) {
				const prefix = i === deps.length - 1 ? "└──" : "├──";
				lines.push(`    ${prefix} ${deps[i].to}  [${deps[i].type}] ${deps[i].detail}`);
			}
		}
	}

	if (graph.cycles.length > 0) {
		lines.push("", "Circular Dependencies:");
		for (const cycle of graph.cycles) {
			lines.push(`  ⚠ ${cycle.join(" → ")}`);
		}
	}

	return lines.join("\n");
}

/** Render the dependency graph as a Mermaid diagram. */
export function renderMermaidDeps(graph: DependencyGraph): string {
	const lines: string[] = ["graph LR"];

	if (graph.edges.length === 0) {
		// Show isolated nodes
		for (const project of graph.projects) {
			const id = nodeId(project);
			lines.push(`  ${id}["${project}"]`);
		}
		if (graph.projects.length === 0) {
			lines.push("  %% No projects found");
		}
		return lines.join("\n");
	}

	const seen = new Set<string>();
	for (const edge of graph.edges) {
		const fromId = nodeId(edge.from);
		const toId = nodeId(edge.to);
		const key = `${fromId}-->${toId}`;
		if (seen.has(key)) continue;
		seen.add(key);
		lines.push(`  ${fromId}["${edge.from}"] -->|${edge.type}| ${toId}["${edge.to}"]`);
	}

	// Add isolated projects (no edges)
	const connected = new Set<string>();
	for (const edge of graph.edges) {
		connected.add(edge.from);
		connected.add(edge.to);
	}
	for (const project of graph.projects) {
		if (!connected.has(project)) {
			lines.push(`  ${nodeId(project)}["${project}"]`);
		}
	}

	return lines.join("\n");
}

function nodeId(name: string): string {
	return name.replace(/[^a-zA-Z0-9]/g, "_");
}

// ── Console display ────────────────────────────────────────────────

function displayProjectDeps(graph: DependencyGraph): void {
	const edgesBySource = groupEdgesBySource(graph.edges);

	for (const project of graph.projects) {
		const deps = edgesBySource.get(project) ?? [];
		if (deps.length === 0) {
			log(`  ${CYAN}${project}${RESET}  ${DIM}(no dependencies)${RESET}`);
		} else {
			log(`  ${CYAN}${project}${RESET}`);
			for (let i = 0; i < deps.length; i++) {
				const prefix = i === deps.length - 1 ? "└──" : "├──";
				const typeColor = deps[i].type === "npm" ? GREEN : YELLOW;
				log(`    ${DIM}${prefix}${RESET} ${deps[i].to}  ${typeColor}[${deps[i].type}]${RESET} ${DIM}${deps[i].detail}${RESET}`);
			}
		}
	}
}

/** Display the dependency graph with ANSI colors. */
export function displayDependencyGraph(graph: DependencyGraph): void {
	log();

	if (graph.projects.length === 0) {
		log(`  ${DIM}No projects found in ${PROJECTS_DIR}${RESET}`);
		log();
		return;
	}

	log(`  ${BOLD}Project Dependencies${RESET}`);
	log(`  ${DIM}${"─".repeat(46)}${RESET}`);
	log();

	displayProjectDeps(graph);

	if (graph.cycles.length > 0) {
		log();
		log(`  ${RED}${BOLD}Circular Dependencies Detected${RESET}`);
		for (const cycle of graph.cycles) {
			log(`  ${RED}⚠${RESET} ${cycle.join(` ${RED}→${RESET} `)}`);
		}
	}

	log();
	log(`  ${DIM}Projects: ${graph.projects.length}  Dependencies: ${graph.edges.length}  Cycles: ${graph.cycles.length}${RESET}`);
	log();

	const mermaid = renderMermaidDeps(graph);
	log(`  ${BOLD}Mermaid Diagram${RESET}`);
	log(`  ${DIM}${"─".repeat(46)}${RESET}`);
	log();
	for (const line of mermaid.split("\n")) {
		log(`  ${line}`);
	}
	log();
}

// ── Command handler ────────────────────────────────────────────────

export function handleProjectDeps(): void {
	const graph = buildDependencyGraph();
	displayDependencyGraph(graph);
}

export const commands = {
	"project:deps": handleProjectDeps,
};
