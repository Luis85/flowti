/**
 * marketplace.ts — Definition marketplace for the scaffold domain.
 *
 * Discovers, validates, and lists scaffold definitions from both
 * bundled sources and project-local configs/definitions/ directories.
 *
 * Pure functions — no side effects beyond reading from the filesystem.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { log } from "../../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED, CYAN, YELLOW, BOLD } from "../../infrastructure/ui.js";
import { validateDefinition } from "./scaffold-schema.js";
import type { ScaffoldDefinition } from "./scaffold-types.js";
import type { IFileSystem } from "../../infrastructure/types.js";

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
export function resolveDefinitionsDir(projectRoot: string): string {
	return paths.join(projectRoot, DEFINITIONS_DIR);
}

// ── Discovery ────────────────────────────────────────────────────────

/**
 * Discover local definition JSON files from a directory.
 *
 * Returns an array of `{ raw, path }` objects — one per `.json` file found.
 * Invalid JSON is silently skipped (the validation step will catch it).
 */
export function discoverLocalDefinitions(
	defsDir: string,
	fs: IFileSystem = disk,
): { raw: unknown; path: string }[] {
	if (!fs.existsSync(defsDir)) return [];

	const results: { raw: unknown; path: string }[] = [];

	let entries: string[];
	try {
		entries = fs.readdirSync(defsDir);
	} catch {
		return [];
	}

	for (const entry of entries) {
		if (!entry.endsWith(".json")) continue;
		const filePath = paths.join(defsDir, entry);
		try {
			const content = fs.readFileSync(filePath, "utf-8");
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
	raw: unknown,
	source: "bundled" | "local",
	path?: string,
	knownTemplateIds?: string[],
): MarketplaceEntry {
	const errors = validateDefinition(raw, knownTemplateIds);
	const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
	const { id, label, description } = extractMetadata(obj, path);
	const templateIds = extractTemplateIds(obj);

	return { id, label, description, source, path, templateIds, valid: errors.length === 0, errors };
}

function extractMetadata(obj: Record<string, unknown>, path?: string): { id: string; label: string; description: string } {
	const id = typeof obj.id === "string" ? obj.id : path ? paths.basename(path, ".json") : "unknown";
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
	bundled: unknown[],
	localDir: string,
	knownTemplateIds: string[],
	fs: IFileSystem = disk,
): MarketplaceEntry[] {
	const entries: MarketplaceEntry[] = [];

	// Bundled definitions
	for (const raw of bundled) {
		entries.push(validateAndClassify(raw, "bundled"));
	}

	// Local definitions
	const locals = discoverLocalDefinitions(localDir, fs);
	for (const { raw, path } of locals) {
		entries.push(validateAndClassify(raw, "local", path, knownTemplateIds));
	}

	return entries;
}

// ── Display ──────────────────────────────────────────────────────────

/** Render the marketplace listing to the console. */
export function displayMarketplace(entries: MarketplaceEntry[]): void {
	if (entries.length === 0) {
		log(`\n  ${DIM}No scaffold definitions found.${RESET}\n`);
		return;
	}

	const bundled = entries.filter(e => e.source === "bundled");
	const local = entries.filter(e => e.source === "local");

	log(`\n  ${CYAN}${BOLD}Scaffold Definition Marketplace${RESET}\n`);

	if (bundled.length > 0) {
		log(`  ${DIM}── Bundled ──${RESET}\n`);
		for (const entry of bundled) {
			renderEntry(entry);
		}
	}

	if (local.length > 0) {
		log(`  ${DIM}── Local (configs/definitions/) ──${RESET}\n`);
		for (const entry of local) {
			renderEntry(entry);
		}
	}

	const validCount = entries.filter(e => e.valid).length;
	const invalidCount = entries.length - validCount;
	log(`  ${DIM}Total: ${validCount} valid${invalidCount > 0 ? `, ${invalidCount} invalid` : ""}${RESET}\n`);
}

function renderEntry(entry: MarketplaceEntry): void {
	const status = entry.valid ? `${GREEN}valid${RESET}` : `${RED}invalid${RESET}`;
	const source = entry.source === "bundled" ? `${DIM}bundled${RESET}` : `${DIM}local${RESET}`;

	log(`    ${GREEN}${entry.id}${RESET}  ${entry.label}  [${source}] [${status}]`);
	log(`    ${DIM}${entry.description}${RESET}`);

	if (entry.templateIds.length > 0) {
		log(`    ${DIM}Templates: ${entry.templateIds.join(", ")}${RESET}`);
	}

	if (!entry.valid) {
		for (const err of entry.errors) {
			log(`    ${RED}  - ${err}${RESET}`);
		}
	}

	log();
}

// ── Load all definitions (bundled + local) ───────────────────────────

/**
 * Load all valid definitions from bundled and local sources.
 *
 * Returns validated ScaffoldDefinition objects ready for use.
 */
export function loadAllDefinitions(
	bundled: unknown[],
	localDir: string,
	knownTemplateIds: string[],
	fs: IFileSystem = disk,
): ScaffoldDefinition[] {
	const entries = buildMarketplaceListing(bundled, localDir, knownTemplateIds, fs);
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
			if (e.path && fs.existsSync(e.path)) {
				const content = fs.readFileSync(e.path, "utf-8");
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
	sourcePath: string,
	projectRoot: string,
	knownTemplateIds: string[],
	fs: IFileSystem = disk,
): ImportResult {
	const defsDir = resolveDefinitionsDir(projectRoot);
	const fileName = paths.basename(sourcePath);
	const targetPath = paths.join(defsDir, fileName);

	// Read and parse source file
	if (!fs.existsSync(sourcePath)) {
		return { success: false, targetPath, errors: [`Source file not found: ${sourcePath}`] };
	}

	let raw: unknown;
	try {
		const content = fs.readFileSync(sourcePath, "utf-8");
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
	const existing = discoverLocalDefinitions(defsDir, fs);
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
	if (!fs.existsSync(defsDir)) {
		fs.mkdirSync(defsDir, { recursive: true });
	}

	// Copy the file
	fs.copyFileSync(sourcePath, targetPath);

	return { success: true, targetPath, errors: [] };
}

// ── Command: scaffold:marketplace ────────────────────────────────────

export function displayMarketplaceCommand(
	bundled: unknown[],
	projectRoot: string | undefined,
	knownTemplateIds: string[],
): void {
	const localDir = projectRoot ? resolveDefinitionsDir(projectRoot) : "";
	const entries = buildMarketplaceListing(bundled, localDir, knownTemplateIds);
	displayMarketplace(entries);
}

// ── Command: scaffold:import ─────────────────────────────────────────

export function importDefinitionCommand(
	sourcePath: string,
	projectRoot: string,
	knownTemplateIds: string[],
): void {
	const result = importDefinition(sourcePath, projectRoot, knownTemplateIds);

	if (result.success) {
		log(`\n  ${GREEN}✓${RESET} Imported definition → ${result.targetPath}\n`);
	} else {
		log(`\n  ${RED}Import failed:${RESET}`);
		for (const err of result.errors) {
			log(`    ${YELLOW}- ${err}${RESET}`);
		}
		log();
	}
}
