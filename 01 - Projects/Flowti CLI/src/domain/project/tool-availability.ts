/**
 * tool-availability.ts — Detect which dev tools a project has installed.
 *
 * Inspects package.json devDependencies to determine tool availability.
 * Used by the menu system to gray out unavailable options and by the
 * CLI to suggest missing tools.
 */

import type { CliDeps } from "../../infrastructure/deps.js";

// ── Tool definitions ────────────────────────────────────────────────

/** Tools the CLI can leverage when present in a project. */
export type DevToolId = "vitest" | "typedoc" | "eslint" | "esbuild" | "typescript";

export interface ToolAvailability {
	id: DevToolId;
	available: boolean;
	version?: string;
}

const ALL_TOOLS: DevToolId[] = ["vitest", "typedoc", "eslint", "esbuild", "typescript"];

/** Map tool IDs to their npm package names (for devDependencies lookup). */
const TOOL_PACKAGES: Record<DevToolId, string[]> = {
	vitest: ["vitest"],
	typedoc: ["typedoc"],
	eslint: ["eslint", "@eslint/js"],
	esbuild: ["esbuild"],
	typescript: ["typescript"],
};

// ── Detection ───────────────────────────────────────────────────────

type DetectDeps = Pick<CliDeps, "disk" | "paths">;

/**
 * Detect which dev tools are available in a project by reading its package.json.
 * Returns availability for all known tools.
 */
export function detectTools(projectPath: string, deps: DetectDeps): ToolAvailability[] {
	const pkgPath = deps.paths.join(projectPath, "package.json");
	let devDeps: Record<string, string> = {};

	try {
		const raw = deps.disk.readFileSync(pkgPath, "utf-8");
		const pkg = JSON.parse(raw) as { devDependencies?: Record<string, string> };
		devDeps = pkg.devDependencies ?? {};
	} catch {
		return ALL_TOOLS.map((id) => ({ id, available: false }));
	}

	return ALL_TOOLS.map((id) => {
		const packages = TOOL_PACKAGES[id];
		for (const pkg of packages) {
			if (devDeps[pkg]) {
				return { id, available: true, version: devDeps[pkg] };
			}
		}
		return { id, available: false };
	});
}

/**
 * Check if a specific tool is available.
 */
export function hasTool(tools: ToolAvailability[], id: DevToolId): boolean {
	return tools.some((t) => t.id === id && t.available);
}

/**
 * Get the list of missing tools with suggested install commands.
 */
export function suggestMissingTools(tools: ToolAvailability[]): string[] {
	const missing = tools.filter((t) => !t.available);
	if (missing.length === 0) return [];

	const packages = missing.map((t) => TOOL_PACKAGES[t.id][0]);
	return [
		`Missing dev tools: ${missing.map((t) => t.id).join(", ")}`,
		`  Install: npm install -D ${packages.join(" ")}`,
	];
}

/**
 * Map tool IDs to which CLI features they enable.
 */
export const TOOL_FEATURES: Record<DevToolId, string[]> = {
	vitest: ["test", "test:increment", "test:e2e", "Reports: Test", "Reports: Coverage"],
	typedoc: ["Reports: Codebase"],
	eslint: ["lint", "Reports: Summary (lint analysis)"],
	esbuild: ["build", "build:watch", "build:distribute"],
	typescript: ["build", "check"],
};
