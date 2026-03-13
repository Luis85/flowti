/**
 * journey-loader.ts — Load and validate journey definition files.
 *
 * Reads `.journey` JSON files from disk and returns typed definitions.
 * Used by both the test runner and the CLI's interactive session.
 *
 * Supports $ref composition: steps can reference other journey steps
 * via "journey-slug#step-id" syntax. Circular references are detected.
 */

import type { JourneyDefinition, JourneyStep } from "./journey-types.js";
import { isRefStep } from "./journey-types.js";

/** Errors encountered during journey validation. */
export interface ValidationError {
	path: string;
	message: string;
}

/** Result of validating a journey definition. */
export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

/**
 * Parse and validate a journey JSON string.
 * Returns the typed definition or throws with validation errors.
 */
export function parseJourneyDefinition(json: string, sourcePath?: string): JourneyDefinition {
	const raw = JSON.parse(json) as Record<string, unknown>;
	const errors = validateRaw(raw);

	if (errors.length > 0) {
		const file = sourcePath ?? "<unknown>";
		throw new Error(`Invalid journey definition (${file}):\n${errors.map((e) => `  - ${e.path}: ${e.message}`).join("\n")}`);
	}

	return raw as unknown as JourneyDefinition;
}

function isNonEmptyString(value: unknown): boolean {
	return typeof value === "string" && value.length > 0;
}

function validateStep(step: Record<string, unknown>, prefix: string): ValidationError[] {
	const errors: ValidationError[] = [];

	// $ref steps only need the $ref field
	if (typeof step.$ref === "string") {
		if (!isNonEmptyString(step.$ref)) {
			errors.push({ path: `${prefix}.$ref`, message: "must be a non-empty string (format: journey-slug#step-id)" });
		}
		return errors;
	}

	if (!isNonEmptyString(step.id)) errors.push({ path: `${prefix}.id`, message: "must be a non-empty string" });
	if (!isNonEmptyString(step.title)) errors.push({ path: `${prefix}.title`, message: "must be a non-empty string" });

	if (!Array.isArray(step.actions)) {
		errors.push({ path: `${prefix}.actions`, message: "must be an array" });
		return errors;
	}

	for (let j = 0; j < step.actions.length; j++) {
		const action = step.actions[j] as Record<string, unknown>;
		if (!isNonEmptyString(action.tool)) {
			errors.push({ path: `${prefix}.actions[${j}].tool`, message: "must be a non-empty string" });
		}
	}

	return errors;
}

/**
 * Validate a raw JSON object against the journey schema.
 */
export function validateRaw(raw: Record<string, unknown>): ValidationError[] {
	const errors: ValidationError[] = [];

	if (!isNonEmptyString(raw.journey)) {
		errors.push({ path: "journey", message: "must be a non-empty string" });
	}

	if (!Array.isArray(raw.steps)) {
		errors.push({ path: "steps", message: "must be an array" });
		return errors;
	}

	for (let i = 0; i < raw.steps.length; i++) {
		errors.push(...validateStep(raw.steps[i] as Record<string, unknown>, `steps[${i}]`));
	}

	return errors;
}

/**
 * Validate a journey definition object.
 */
export function validateJourney(definition: JourneyDefinition): ValidationResult {
	const errors = validateRaw(definition as unknown as Record<string, unknown>);
	return { valid: errors.length === 0, errors };
}

/**
 * Load a journey definition from a file path.
 */
export function loadJourneyFile(readFile: (path: string) => string, filePath: string): JourneyDefinition {
	const content = readFile(filePath);
	return parseJourneyDefinition(content, filePath);
}

// ── $ref resolution ──────────────────────────────────────────────────

/** Parse a $ref string into journey slug and step ID. */
export function parseRef(ref: string): { journeySlug: string; stepId: string } | null {
	const parts = ref.split("#");
	if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
	return { journeySlug: parts[0], stepId: parts[1] };
}

/**
 * Resolve all $ref steps in a journey definition to inline steps.
 *
 * @param definition - The journey to resolve refs for.
 * @param loadJourney - Function to load a journey by slug (e.g., from journeysDir).
 * @param resolving - Set of journey slugs currently being resolved (circular detection).
 * @returns A new JourneyDefinition with all refs resolved to inline steps.
 * @throws Error on circular references or unresolvable refs.
 */
export function resolveRefs(
	definition: JourneyDefinition,
	loadJourney: (slug: string) => JourneyDefinition | null,
	resolving?: Set<string>,
): JourneyDefinition {
	const slug = toSlug(definition.journey);
	const chain = resolving ?? new Set<string>();

	if (chain.has(slug)) {
		throw new Error(`Circular journey reference detected: ${[...chain, slug].join(" → ")}`);
	}
	chain.add(slug);

	const resolvedSteps: JourneyStep[] = [];

	for (const step of definition.steps) {
		if (isRefStep(step)) {
			const parsed = parseRef(step.$ref);
			if (!parsed) throw new Error(`Invalid $ref format: "${step.$ref}" (expected "journey-slug#step-id")`);

			const refJourney = loadJourney(parsed.journeySlug);
			if (!refJourney) throw new Error(`Referenced journey not found: "${parsed.journeySlug}" (from $ref "${step.$ref}")`);

			// Recursively resolve the referenced journey first
			const resolvedRef = resolveRefs(refJourney, loadJourney, new Set(chain));
			const referencedStep = resolvedRef.steps.find((s) => !isRefStep(s) && (s as JourneyStep).id === parsed.stepId) as JourneyStep | undefined;
			if (!referencedStep) throw new Error(`Referenced step not found: "${parsed.stepId}" in journey "${parsed.journeySlug}"`);

			resolvedSteps.push(referencedStep);
		} else {
			resolvedSteps.push(step);
		}
	}

	chain.delete(slug);
	return { ...definition, steps: resolvedSteps };
}

/** Convert a journey name to a slug for lookup. */
function toSlug(name: string): string {
	return name.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Create a journey loader that resolves $refs from a directory of .journey files.
 */
export function createJourneyResolver(
	readFile: (path: string) => string,
	listFiles: (dir: string) => string[],
	journeysDir: string,
): (slug: string) => JourneyDefinition | null {
	const cache = new Map<string, JourneyDefinition>();

	return (slug: string): JourneyDefinition | null => {
		if (cache.has(slug)) return cache.get(slug)!;

		const files = listFiles(journeysDir);
		for (const file of files) {
			if (!file.endsWith(".journey")) continue;
			const baseName = file.replace(/\.journey$/, "");
			if (baseName === slug || toSlug(baseName) === slug) {
				try {
					const def = parseJourneyDefinition(readFile(`${journeysDir}/${file}`), file);
					cache.set(slug, def);
					return def;
				} catch {
					return null;
				}
			}
		}
		return null;
	};
}

/**
 * Load all journey definitions from a directory, resolving $refs.
 */
export function loadAllJourneys(
	readFile: (path: string) => string,
	listFiles: (dir: string) => string[],
	journeysDir: string,
): JourneyDefinition[] {
	const files = listFiles(journeysDir).filter((f) => f.endsWith(".journey"));
	const resolver = createJourneyResolver(readFile, listFiles, journeysDir);
	const journeys: JourneyDefinition[] = [];

	for (const file of files) {
		try {
			const def = parseJourneyDefinition(readFile(`${journeysDir}/${file}`), file);
			const resolved = resolveRefs(def, resolver);
			journeys.push(resolved);
		} catch {
			// Skip invalid journey files
		}
	}

	return journeys;
}
