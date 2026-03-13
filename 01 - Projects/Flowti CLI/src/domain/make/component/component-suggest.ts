/**
 * component-suggest.ts — Suggest relationships by scanning TypeScript imports.
 *
 * Scans .ts files within component directories and identifies import statements
 * that reference other known components. Results are proposals for the user to
 * accept or reject — never auto-written.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import type { ProjectComponent, ComponentRelationship } from "./component-types.js";

export type SuggestDeps = Pick<CliDeps, "disk" | "paths">;

export interface RelationshipSuggestion {
	source: string;
	target: string;
	type: ComponentRelationship["type"];
	confidence: "high" | "medium";
	evidence: string;
}

/**
 * Scans component .ts files for import statements referencing other component
 * directories. Returns suggestions for relationships that don't already exist.
 */
export function suggestRelationships(
	components: ProjectComponent[],
	projectPath: string,
	deps: SuggestDeps,
): RelationshipSuggestion[] {
	const componentDirs = buildComponentDirMap(components, projectPath, deps);
	const suggestions: RelationshipSuggestion[] = [];

	for (const comp of components) {
		const existing = new Set(
			(comp.relationships ?? []).map((r) => `${r.target}::${r.type}`),
		);
		const dir = resolveComponentDir(comp, projectPath, deps);
		if (!dir || !deps.disk.existsSync(dir)) continue;

		const tsFiles = listTsFiles(dir, deps);
		for (const file of tsFiles) {
			const imports = extractImports(deps.disk.readFileSync(file, "utf-8"));
			for (const imp of imports) {
				const match = matchImportToComponent(imp, comp.name, componentDirs);
				if (!match) continue;
				const key = `${match.target}::${match.type}`;
				if (existing.has(key)) continue;
				if (suggestions.some((s) => s.source === comp.name && s.target === match.target && s.type === match.type)) continue;
				suggestions.push({ source: comp.name, ...match });
				existing.add(key);
			}
		}
	}
	return suggestions;
}

// ── Internals ────────────────────────────────────────────────────────

function buildComponentDirMap(
	components: ProjectComponent[],
	projectPath: string,
	deps: SuggestDeps,
): Map<string, string> {
	const map = new Map<string, string>();
	for (const comp of components) {
		const dir = resolveComponentDir(comp, projectPath, deps);
		if (dir) map.set(dir.replace(/\\/g, "/").toLowerCase(), comp.name);
	}
	return map;
}

function resolveComponentDir(comp: ProjectComponent, projectPath: string, deps: SuggestDeps): string | null {
	// path is like "components/domain/name/name.md" or "components/name/name.md"
	const mdPath = deps.paths.join(projectPath, comp.path);
	return deps.paths.dirname(mdPath);
}

function listTsFiles(dir: string, deps: SuggestDeps): string[] {
	try {
		return deps.disk.readdirSync(dir)
			.filter((f: string) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".stories.ts"))
			.map((f: string) => deps.paths.join(dir, f));
	} catch { return []; }
}

const IMPORT_RE = /(?:import|from)\s+["']([^"']+)["']/g;

export function extractImports(source: string): string[] {
	const matches: string[] = [];
	let m: RegExpExecArray | null;
	while ((m = IMPORT_RE.exec(source)) !== null) {
		matches.push(m[1]);
	}
	return matches;
}

function matchImportToComponent(
	importPath: string,
	sourceName: string,
	componentDirs: Map<string, string>,
): { target: string; type: ComponentRelationship["type"]; confidence: "high" | "medium"; evidence: string } | null {
	const normalized = importPath.replace(/\\/g, "/").toLowerCase();
	for (const [dir, name] of componentDirs) {
		if (name === sourceName) continue;
		// Check if the import path contains the component directory segment
		const dirSegment = dir.split("/").pop();
		if (!dirSegment) continue;
		if (normalized.includes(`/${dirSegment}/`) || normalized.endsWith(`/${dirSegment}`)) {
			return {
				target: name,
				type: "uses",
				confidence: normalized.includes(`/${dirSegment}/`) ? "high" : "medium",
				evidence: `imports from "${importPath}"`,
			};
		}
	}
	return null;
}
