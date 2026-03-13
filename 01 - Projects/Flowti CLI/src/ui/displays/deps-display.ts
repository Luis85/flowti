/**
 * project-deps-display.ts — Rendering and display for dependency graphs.
 *
 * Console display, text tree, Mermaid diagram, and command handler for
 * cross-project dependency visualization. Extracted from project-deps.ts.
 */

import { log } from "../../infrastructure/logger.js";
import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { RESET, DIM, GREEN, YELLOW, RED, CYAN, BOLD } from "../../infrastructure/ui.js";
import { PROJECTS_DIR } from "../../infrastructure/config.js";
import { resolveFormat, printOutput } from "../../infrastructure/output.js";
import {
	buildDependencyGraph,
	findReverseDeps,
	findDirectDeps,
	filterByType,
	graphStats,
	type ProjectDependency,
	type DependencyGraph,
} from "../../domain/project/project-deps.js";

// ── Helpers ────────────────────────────────────────────────────────

function groupEdgesBySource(edges: ProjectDependency[]): Map<string, ProjectDependency[]> {
	const map = new Map<string, ProjectDependency[]>();
	for (const edge of edges) {
		if (!map.has(edge.from)) map.set(edge.from, []);
		map.get(edge.from)!.push(edge);
	}
	return map;
}

function nodeId(name: string): string {
	return name.replace(/[^a-zA-Z0-9]/g, "_");
}

// ── Rendering ──────────────────────────────────────────────────────

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
	const graph = buildDependencyGraph(PROJECTS_DIR, { disk, paths });
	displayDependencyGraph(graph);
}

function displayStats(graph: DependencyGraph): void {
	const stats = graphStats(graph);
	log(`\n  ${BOLD}Dependency Graph Stats${RESET}\n`);
	log(`  Projects:            ${stats.projects}`);
	log(`  Dependencies:        ${stats.edges}`);
	log(`  Cycles:              ${stats.cycles > 0 ? `${RED}${stats.cycles}${RESET}` : `${GREEN}0${RESET}`}`);
	log(`  Isolated (no deps):  ${stats.isolated}`);
	if (stats.mostDeps) {
		log(`  Most dependencies:   ${CYAN}${stats.mostDeps.name}${RESET} (${stats.mostDeps.count})`);
	}
	if (stats.mostDependedOn) {
		log(`  Most depended on:    ${CYAN}${stats.mostDependedOn.name}${RESET} (${stats.mostDependedOn.count})`);
	}
	log();
}

function displayProjectFocus(graph: DependencyGraph, projectName: string): void {
	const direct = findDirectDeps(graph, projectName);
	const reverse = findReverseDeps(graph, projectName);

	log(`\n  ${BOLD}${projectName}${RESET}\n`);

	if (direct.length > 0) {
		log(`  ${DIM}Depends on:${RESET}`);
		for (const d of direct) {
			const typeColor = d.type === "npm" ? GREEN : YELLOW;
			log(`    → ${d.to}  ${typeColor}[${d.type}]${RESET} ${DIM}${d.detail}${RESET}`);
		}
	} else {
		log(`  ${DIM}Depends on: (none)${RESET}`);
	}

	log();

	if (reverse.length > 0) {
		log(`  ${DIM}Depended on by:${RESET}`);
		for (const d of reverse) {
			const typeColor = d.type === "npm" ? GREEN : YELLOW;
			log(`    ← ${d.from}  ${typeColor}[${d.type}]${RESET} ${DIM}${d.detail}${RESET}`);
		}
	} else {
		log(`  ${DIM}Depended on by: (none)${RESET}`);
	}

	log();
}

export const commands = {
	"project:deps": (flags: Record<string, string | boolean>) => {
		const graph = buildDependencyGraph(PROJECTS_DIR, { disk, paths });
		const format = resolveFormat(flags);
		const focusProject = typeof flags.project === "string" ? flags.project : null;
		const showReverse = !!flags.reverse;
		const typeFilter = typeof flags.type === "string" ? flags.type as ProjectDependency["type"] : null;
		const showStats = !!flags.stats;

		// Apply type filter if specified
		const filteredGraph = typeFilter
			? { ...graph, edges: filterByType(graph.edges, typeFilter) }
			: graph;

		if (showStats) {
			printOutput(format, graphStats(filteredGraph), () => displayStats(filteredGraph));
			return;
		}

		if (focusProject) {
			const data = {
				project: focusProject,
				direct: findDirectDeps(filteredGraph, focusProject),
				reverse: findReverseDeps(filteredGraph, focusProject),
			};
			printOutput(format, data, () => displayProjectFocus(filteredGraph, focusProject));
			return;
		}

		if (showReverse) {
			// Show reverse dependency view: who depends on each project
			const reverseView: Record<string, ProjectDependency[]> = {};
			for (const p of filteredGraph.projects) {
				const revDeps = findReverseDeps(filteredGraph, p);
				if (revDeps.length > 0) reverseView[p] = revDeps;
			}
			printOutput(format, reverseView, () => {
				log(`\n  ${BOLD}Reverse Dependencies${RESET}  ${DIM}(who depends on each project)${RESET}\n`);
				for (const [name, deps] of Object.entries(reverseView)) {
					log(`  ${CYAN}${name}${RESET}`);
					for (const d of deps) {
						log(`    ← ${d.from}  ${DIM}[${d.type}]${RESET}`);
					}
				}
				const noDeps = filteredGraph.projects.filter((p) => !reverseView[p]);
				if (noDeps.length > 0) {
					log(`\n  ${DIM}No dependents: ${noDeps.join(", ")}${RESET}`);
				}
				log();
			});
			return;
		}

		printOutput(format, filteredGraph, () => displayDependencyGraph(filteredGraph));
	},
};
