/**
 * makers.ts — Pure domain logic for the Make module.
 *
 * Interactive scaffolding functions moved to src/ui/menus/make-makers.ts.
 * This file retains only pure utility functions.
 */

import type { CliDeps } from "../../infrastructure/deps.js";

/** Scans test directory for numbered journey files and returns the next available number (e.g., "50"). */
export function getNextTestFileNumber(testDir: string, deps: Pick<CliDeps, "disk">): string {
	if (!deps.disk.existsSync(testDir)) return "10";
	const files = deps.disk.readdirSync(testDir).filter((f) => f.match(/^\d+-journey-/));
	if (files.length === 0) return "10";
	const numbers = files.map((f) => parseInt(f.split("-")[0], 10)).filter((n) => !isNaN(n));
	const maxNum = Math.max(...numbers);
	return String(maxNum + 10);
}
