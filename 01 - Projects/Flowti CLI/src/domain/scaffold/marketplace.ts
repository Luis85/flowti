/**
 * marketplace.ts — Definition marketplace for the scaffold domain.
 *
 * Discovers, validates, and lists scaffold definitions from both
 * bundled sources and project-local configs/definitions/ directories.
 *
 * Pure functions — no side effects beyond reading from the filesystem.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import { validateDefinition } from "./scaffold-schema.js";
import type { ScaffoldDefinition } from "./scaffold-types.js";

// ── Types ────────────────────────────────────────────────────────────

export interface MarketplaceEntry {
	id: string;
	label: string;
	description: string;
	source: "bundled" | "local";
	path?: string;
	templateIds: string[];
	valid: boolean;
	errors: string[];
}

// ── Local definition directory ───────────────────────────────────────

const DEFINITIONS_DIR = "configs/definitions";

/** Resolve the definitions directory path for a given project root. */
export function resolveDefinitionsDir(
	deps: Pick<CliDeps, "paths">,
	projectRoot: string,
): string {
	return deps.paths.join(projectRoot, DEFINITIONS_DIR);
}

// ── Discovery ────────────────────────────────────────────────────────

/**
 * Discover local definition JSON files from a directory.
 *
 * Returns an array of `{ raw, path }` objects — one per `.json` file found.
 * Invalid JSON is silently skipped (the validation step will catch it).
 */
export function discoverLocalDefinitions(
	deps: Pick<CliDeps, "disk" | "paths">,
	defsDir: string,
): { raw: unknown; path: string }[] {
	if (!deps.disk.existsSync(defsDir)) return [];

	const results: { raw: unknown; path: string }[] = [];

	let entries: string[];
	try {
		entries = deps.disk.readdirSync(defsDir);
	} catch {
		return [];
	}

	for (const entry of entries) {
		if (!entry.endsWith(".json")) continue;
		const filePath = deps.paths.join(defsDir, entry);
		try {
			const content = deps.disk.readFileSync(filePath, "utf-8");
			const raw: unknown = JSON.parse(content);
			results.push({ raw, path: filePath });
		} catch {
			// Skip files that can't be read or parsed — they'll surface as invalid
			results.push({ raw: null, path: filePath });
		}
	}

	return results;
}

// ── Validation & classification ──────────────────────────────────────

/**
 * Validate and classify a raw definition into a MarketplaceEntry.
 *
 * Extracts templateIds referenced by the definition's files array,
 * and optionally validates them against a known set.
 */
export function validateAndClassify(
	deps: Pick<CliDeps, "paths">,
	raw: unknown,
	source: "bundled" | "local",
	path?: string,
	knownTemplateIds?: string[],
): MarketplaceEntry {
	const errors = validateDefinition(raw, knownTemplateIds);
	const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
	const { id, label, description } = extractMetadata(deps, obj, path);
	const templateIds = extractTemplateIds(obj);

	return { id, label, description, source, path, templateIds, valid: errors.length === 0, errors };
}

function extractMetadata(deps: Pick<CliDeps, "paths">, obj: Record<string, unknown>, path?: string): { id: string; label: string; description: string } {
	const id = typeof obj.id === "string" ? obj.id : path ? deps.paths.basename(path, ".json") : "unknown";
	const label = typeof obj.label === "string" ? obj.label : id;
	const description = typeof obj.description === "string" ? obj.description : "";
	return { id, label, description };
}

function extractTemplateIds(obj: Record<string, unknown>): string[] {
	if (!Array.isArray(obj.files)) return [];
	return (obj.files as Record<string, unknown>[])
		.filter(f => f && typeof f.templateId === "string")
		.map(f => f.templateId as string);
}

// ── Marketplace builder ──────────────────────────────────────────────

/**
 * Build a complete marketplace listing from bundled and local definitions.
 *
 * Bundled definitions are validated without templateId checks (they're trusted).
 * Local definitions are validated against the known template IDs.
 */
export function buildMarketplaceListing(
	deps: Pick<CliDeps, "disk" | "paths">,
	bundled: unknown[],
	localDir: string,
	knownTemplateIds: string[],
): MarketplaceEntry[] {
	const entries: MarketplaceEntry[] = [];

	// Bundled definitions
	for (const raw of bundled) {
		entries.push(validateAndClassify(deps, raw, "bundled"));
	}

	// Local definitions
	const locals = discoverLocalDefinitions(deps, localDir);
	for (const { raw, path } of locals) {
		entries.push(validateAndClassify(deps, raw, "local", path, knownTemplateIds));
	}

	return entries;
}

// ── Load all definitions (bundled + local) ───────────────────────────

/**
 * Load all valid definitions from bundled and local sources.
 *
 * Returns validated ScaffoldDefinition objects ready for use.
 */
export function loadAllDefinitions(
	deps: Pick<CliDeps, "disk" | "paths">,
	bundled: unknown[],
	localDir: string,
	knownTemplateIds: string[],
): ScaffoldDefinition[] {
	const entries = buildMarketplaceListing(deps, bundled, localDir, knownTemplateIds);
	return entries
		.filter(e => e.valid)
		.map(e => {
			// For bundled, use the raw object directly; for local, re-read
			if (e.source === "bundled") {
				const raw = bundled.find(b => {
					const obj = b as Record<string, unknown>;
					return obj.id === e.id;
				});
				return raw as ScaffoldDefinition;
			}
			// For local, re-read from disk
			if (e.path && deps.disk.existsSync(e.path)) {
				const content = deps.disk.readFileSync(e.path, "utf-8");
				return JSON.parse(content) as ScaffoldDefinition;
			}
			return null;
		})
		.filter((d): d is ScaffoldDefinition => d !== null);
}

// ── Import (file copy + validation) ──────────────────────────────────

export interface ImportResult {
	success: boolean;
	targetPath: string;
	errors: string[];
}

/**
 * Import a scaffold definition from a local file path.
 *
 * Copies the file into the project's configs/definitions/ directory
 * after validating it.
 */
export function importDefinition(
	deps: Pick<CliDeps, "disk" | "paths">,
	sourcePath: string,
	projectRoot: string,
	knownTemplateIds: string[],
): ImportResult {
	const defsDir = resolveDefinitionsDir(deps, projectRoot);
	const fileName = deps.paths.basename(sourcePath);
	const targetPath = deps.paths.join(defsDir, fileName);

	// Read and parse source file
	if (!deps.disk.existsSync(sourcePath)) {
		return { success: false, targetPath, errors: [`Source file not found: ${sourcePath}`] };
	}

	let raw: unknown;
	try {
		const content = deps.disk.readFileSync(sourcePath, "utf-8");
		raw = JSON.parse(content);
	} catch {
		return { success: false, targetPath, errors: ["Failed to parse JSON from source file."] };
	}

	// Validate
	const errors = validateDefinition(raw, knownTemplateIds);
	if (errors.length > 0) {
		return { success: false, targetPath, errors };
	}

	// Check for duplicate id
	const obj = raw as Record<string, unknown>;
	const existing = discoverLocalDefinitions(deps, defsDir);
	for (const { raw: existingRaw } of existing) {
		if (existingRaw && typeof existingRaw === "object") {
			const existingObj = existingRaw as Record<string, unknown>;
			if (existingObj.id === obj.id) {
				return {
					success: false,
					targetPath,
					errors: [`A definition with id "${String(obj.id)}" already exists in ${DEFINITIONS_DIR}.`],
				};
			}
		}
	}

	// Ensure target directory exists
	if (!deps.disk.existsSync(defsDir)) {
		deps.disk.mkdirSync(defsDir, { recursive: true });
	}

	// Copy the file
	deps.disk.copyFileSync(sourcePath, targetPath);

	return { success: true, targetPath, errors: [] };
}

