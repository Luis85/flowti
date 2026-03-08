/**
 * reference-registry.ts — Reference Generator Registry.
 *
 * Maps reference IDs to callable functions. Reference generators
 * produce stable, living documents (no timestamps) in the configured
 * reference directory (default: docs/reference/).
 *
 * This is separate from the report generator registry, which produces
 * timestamped point-in-time snapshots in the reports directory.
 */

import type { GeneratorFn, GeneratorOutput } from "../../infrastructure/types.js";
import { generateEntityReference } from "./generators/entity-reference.js";
import { generateCliReference } from "./generators/cli-reference.js";

/** Built-in reference registry: maps reference IDs to functions. */
const REFERENCES: ReadonlyMap<string, GeneratorFn> = new Map<string, GeneratorFn>([
	["entity-reference", generateEntityReference],
	["cli-reference", generateCliReference],
]);

/** Run a reference generator by its ID. Returns null if the ID is unknown. */
export function runReference(id: string, projectPath: string): GeneratorOutput | null {
	const fn = REFERENCES.get(id);
	if (!fn) return null;
	return fn(projectPath);
}

/** Check if a reference ID is registered. */
export function hasReference(id: string): boolean {
	return REFERENCES.has(id);
}

/** List all registered reference IDs. */
export function listReferenceIds(): string[] {
	return [...REFERENCES.keys()];
}
