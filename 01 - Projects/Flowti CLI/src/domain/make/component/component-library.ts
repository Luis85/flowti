/**
 * component-library.ts — Discover and import component definition libraries.
 *
 * A "library" is a subdirectory under components/ that contains .json
 * definition files but no matching .md files (i.e., definitions that
 * haven't been scaffolded yet).
 *
 * Example: components/prime-ng/button.json, components/prime-ng/accordion.json
 *
 * The import process reads each .json, resolves the blueprint by type,
 * and generates the full file set (md, ts, test, stories) within the
 * library's subfolder.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
import { toKebab } from "../naming.js";
import { buildComponentPlan } from "./component-plan.js";
import { createComponentTemplateRegistry } from "./component-registry.js";
import { createOverwriteFileWriter } from "../templates/file-writer.js";
import { buildVarsFromRecord, resolveBlueprint, parseJsonFile } from "./component-commands.js";
import { PROVIDERS_DIR } from "./data-provider.js";

export type ComponentLibraryDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

// ── Discovery ────────────────────────────────────────────────────────

export interface LibraryInfo {
	/** Library name (directory name, e.g. "prime-ng"). */
	name: string;
	/** Absolute path to the library directory. */
	path: string;
	/** JSON definition files found in the library. */
	definitions: string[];
	/** Number of definitions that have already been scaffolded. */
	scaffoldedCount: number;
}

/**
 * Scans components/ for subdirectories that contain .json files
 * but aren't individual component folders (i.e., they have multiple .json
 * files or .json files without matching .md files).
 */
export function discoverLibraries(projectRoot: string, deps: ComponentLibraryDeps): LibraryInfo[] {
	const componentsDir = deps.paths.join(projectRoot, "components");
	if (!deps.disk.existsSync(componentsDir)) return [];

	const subdirs = deps.disk.readdirSync(componentsDir).filter((entry: string) => {
		try {
			if (entry === PROVIDERS_DIR || entry === "node_modules" || entry.startsWith(".")) return false;
			const fullPath = deps.paths.join(componentsDir, entry);
			return deps.disk.statSync(fullPath).isDirectory();
		} catch { return false; }
	});

	const libraries: LibraryInfo[] = [];
	for (const dir of subdirs) {
		const dirPath = deps.paths.join(componentsDir, dir);
		const entries = deps.disk.readdirSync(dirPath);

		// Collect definitions from root-level .json files (not yet imported)
		const rootJsonFiles = entries.filter((f: string) => f.endsWith(".json"));

		// Collect definitions from imported subfolders ({name}/{name}.json)
		const importedSubfolders = entries.filter((entry: string) => {
			try {
				const subPath = deps.paths.join(dirPath, entry);
				if (!deps.disk.statSync(subPath).isDirectory()) return false;
				// Subfolder has {name}.json inside = already imported
				return deps.disk.existsSync(deps.paths.join(subPath, `${entry}.json`));
			} catch { return false; }
		});

		// Combine: root JSONs (pending) + imported subfolders
		const allDefinitions = [
			...rootJsonFiles,
			...importedSubfolders.map((d: string) => `${d}.json`),
		];

		// A library has multiple definitions, or definitions without matching same-name .md
		// A regular component folder has exactly one .json named after the folder
		const isSingleComponent = allDefinitions.length === 1 && allDefinitions[0] === `${dir}.json`;
		if (allDefinitions.length === 0 || isSingleComponent) continue;

		libraries.push({
			name: dir,
			path: dirPath,
			definitions: rootJsonFiles, // only pending (root-level) JSONs are importable
			scaffoldedCount: importedSubfolders.length,
		});
	}

	return libraries.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Import ───────────────────────────────────────────────────────────

export interface ImportResult {
	name: string;
	filesWritten: number;
	errors: string[];
}

/**
 * Import a single definition from a library: reads the .json, resolves the
 * blueprint, generates files within the library folder.
 */
export function importLibraryDefinition(
	projectRoot: string,
	libraryName: string,
	jsonFilename: string,
	deps: ComponentLibraryDeps,
	storybookFramework?: string,
): ImportResult {
	const jsonPath = deps.paths.join(projectRoot, "components", libraryName, jsonFilename);
	const name = jsonFilename.replace(/\.json$/, "");

	const instanceJson = parseJsonFile(jsonPath, deps);
	if (!instanceJson) {
		return { name, filesWritten: 0, errors: [`Failed to parse ${jsonFilename}`] };
	}

	const blueprint = resolveBlueprint(String(instanceJson.type ?? "component"));
	if (!blueprint) {
		return { name, filesWritten: 0, errors: [`Unknown type "${instanceJson.type}" in ${jsonFilename}`] };
	}

	const kebab = toKebab(name);
	const vars = buildVarsFromRecord(String(instanceJson.name ?? name), kebab, {
		...instanceJson,
		storybookFramework: storybookFramework ?? "",
	});

	const plan = buildComponentPlan(vars, blueprint, createComponentTemplateRegistry(), { clock: deps.clock });
	const written = writeLibraryFiles(projectRoot, libraryName, kebab, plan, deps);
	relocateDefinitionJson(projectRoot, libraryName, kebab, jsonPath, deps);

	return { name: vars.name, filesWritten: written, errors: [] };
}

function writeLibraryFiles(
	projectRoot: string, libraryName: string, kebab: string,
	plan: { path: string; content: string }[], deps: ComponentLibraryDeps,
): number {
	const writer = createOverwriteFileWriter(projectRoot, deps.disk);
	let written = 0;
	for (const f of plan) {
		if (f.path.endsWith(".json")) continue;
		const libPath = f.path.replace(`components/${kebab}/`, `components/${libraryName}/${kebab}/`);
		writer.write(libPath, f.content);
		written++;
	}
	return written;
}

function relocateDefinitionJson(
	projectRoot: string, libraryName: string, kebab: string,
	jsonPath: string, deps: ComponentLibraryDeps,
): void {
	const subfolderDir = deps.paths.join(projectRoot, "components", libraryName, kebab);
	deps.disk.mkdirSync(subfolderDir, { recursive: true });
	const destJsonPath = deps.paths.join(subfolderDir, `${kebab}.json`);
	if (!deps.disk.existsSync(destJsonPath)) {
		deps.disk.writeFileSync(destJsonPath, deps.disk.readFileSync(jsonPath, "utf-8"), "utf-8");
	}
	try { deps.disk.unlinkSync(jsonPath); } catch { /* already moved or inaccessible */ }
}

/**
 * Import all definitions from a library at once.
 */
export function importAllLibraryDefinitions(
	projectRoot: string,
	libraryName: string,
	deps: ComponentLibraryDeps,
	storybookFramework?: string,
): { total: number; errors: string[] } {
	const library = discoverLibraries(projectRoot, deps).find((l) => l.name === libraryName);
	if (!library) return { total: 0, errors: [`Library "${libraryName}" not found`] };

	let total = 0;
	const allErrors: string[] = [];
	for (const jsonFile of library.definitions) {
		const result = importLibraryDefinition(projectRoot, libraryName, jsonFile, deps, storybookFramework);
		total += result.filesWritten;
		allErrors.push(...result.errors);
	}

	return { total, errors: allErrors };
}
