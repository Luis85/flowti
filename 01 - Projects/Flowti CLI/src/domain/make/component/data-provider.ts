/**
 * data-provider.ts — Data provider management for the component system.
 *
 * Data providers are JSON files that mock backend API responses, enabling
 * a fully self-contained headless frontend approach. Each provider lives
 * in `components/providers/{name}/{name}.json` with a companion `{name}.md`
 * data dictionary that documents the shape of the data.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";
export type DataProviderDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

export const PROVIDERS_DIR = "providers";

// ── Types ────────────────────────────────────────────────────────────

export interface DataProviderEntry {
	name: string;
	file: string;
	hasDictionary: boolean;
	recordCount: number;
}

export interface DataProviderSchema {
	field: string;
	type: string;
	example: string;
	nullable: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

function providersRoot(projectRoot: string, deps: DataProviderDeps): string {
	return deps.paths.join(projectRoot, "components", PROVIDERS_DIR);
}

function providerDir(projectRoot: string, name: string, deps: DataProviderDeps): string {
	return deps.paths.join(providersRoot(projectRoot, deps), name);
}

function providerJsonPath(projectRoot: string, name: string, deps: DataProviderDeps): string {
	return deps.paths.join(providerDir(projectRoot, name, deps), `${name}.json`);
}

function providerMdPath(projectRoot: string, name: string, deps: DataProviderDeps): string {
	return deps.paths.join(providerDir(projectRoot, name, deps), `${name}.md`);
}

// ── Migration: flat → subfolder ──────────────────────────────────────

/**
 * Migrates a flat provider (root-level .json + .md) into its own subfolder.
 * Called during discovery to transparently upgrade legacy providers.
 */
function migrateToSubfolder(root: string, name: string, deps: DataProviderDeps): void {
	const flatJson = deps.paths.join(root, `${name}.json`);
	const flatMd = deps.paths.join(root, `${name}.md`);
	const subDir = deps.paths.join(root, name);
	const subJson = deps.paths.join(subDir, `${name}.json`);
	const subMd = deps.paths.join(subDir, `${name}.md`);

	deps.disk.mkdirSync(subDir, { recursive: true });

	if (deps.disk.existsSync(flatJson) && !deps.disk.existsSync(subJson)) {
		deps.disk.writeFileSync(subJson, deps.disk.readFileSync(flatJson, "utf-8"), "utf-8");
		try { deps.disk.unlinkSync(flatJson); } catch { /* ignore */ }
	}
	if (deps.disk.existsSync(flatMd) && !deps.disk.existsSync(subMd)) {
		deps.disk.writeFileSync(subMd, deps.disk.readFileSync(flatMd, "utf-8"), "utf-8");
		try { deps.disk.unlinkSync(flatMd); } catch { /* ignore */ }
	}
}

// ── Discovery ────────────────────────────────────────────────────────

export function listDataProviders(projectRoot: string, deps: DataProviderDeps): DataProviderEntry[] {
	const root = providersRoot(projectRoot, deps);
	if (!deps.disk.existsSync(root)) return [];

	const entries = deps.disk.readdirSync(root);

	// Migrate any flat-file providers into subfolders first
	const flatJsons = entries.filter((f: string) => f.endsWith(".json"));
	for (const file of flatJsons) {
		const name = file.replace(/\.json$/, "");
		migrateToSubfolder(root, name, deps);
	}

	// Discover subfolder-based providers
	const subdirs = entries.filter((entry: string) => {
		try {
			if (entry.startsWith(".")) return false;
			return deps.disk.statSync(deps.paths.join(root, entry)).isDirectory();
		} catch { return false; }
	});

	// Also pick up newly migrated folders that weren't in original listing
	const migratedNames = flatJsons.map((f: string) => f.replace(/\.json$/, ""));
	const allDirs = [...new Set([...subdirs, ...migratedNames])];

	return allDirs
		.filter((dir: string) => {
			const jsonPath = deps.paths.join(root, dir, `${dir}.json`);
			return deps.disk.existsSync(jsonPath);
		})
		.map((dir: string) => {
			const jsonPath = deps.paths.join(root, dir, `${dir}.json`);
			const mdPath = deps.paths.join(root, dir, `${dir}.md`);
			let recordCount = 0;
			try {
				const data = JSON.parse(deps.disk.readFileSync(jsonPath, "utf-8"));
				recordCount = Array.isArray(data) ? data.length : Object.keys(data).length;
			} catch { /* unreadable */ }
			return {
				name: dir,
				file: `${dir}.json`,
				hasDictionary: deps.disk.existsSync(mdPath),
				recordCount,
			};
		})
		.sort((a: DataProviderEntry, b: DataProviderEntry) => a.name.localeCompare(b.name));
}

// ── Read ─────────────────────────────────────────────────────────────

export function readDataProvider(projectRoot: string, name: string, deps: DataProviderDeps): unknown | null {
	const jsonPath = providerJsonPath(projectRoot, name, deps);
	if (!deps.disk.existsSync(jsonPath)) return null;
	try {
		return JSON.parse(deps.disk.readFileSync(jsonPath, "utf-8"));
	} catch {
		return null;
	}
}

// ── Schema inference ─────────────────────────────────────────────────

export function inferSchema(data: unknown): DataProviderSchema[] {
	const sample = Array.isArray(data) ? data[0] : data;
	if (!sample || typeof sample !== "object") return [];

	return Object.entries(sample as Record<string, unknown>).map(([key, value]) => ({
		field: key,
		type: inferType(value),
		example: formatExample(value),
		nullable: value === null || value === undefined,
	}));
}

function inferType(value: unknown): string {
	if (value === null || value === undefined) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

function formatExample(value: unknown): string {
	if (value === null || value === undefined) return "—";
	if (typeof value === "string") return value.length > 40 ? value.slice(0, 37) + "..." : value;
	if (typeof value === "object") return JSON.stringify(value).slice(0, 40);
	return String(value);
}

// ── Create boilerplate ───────────────────────────────────────────────

export function createDataProvider(
	projectRoot: string,
	name: string,
	deps: DataProviderDeps,
): { jsonPath: string; mdPath: string } | null {
	const dir = providerDir(projectRoot, name, deps);
	const jsonPath = deps.paths.join(dir, `${name}.json`);
	if (deps.disk.existsSync(jsonPath)) return null;

	deps.disk.mkdirSync(dir, { recursive: true });

	const boilerplate = [
		{ id: 1, name: "Example Item", description: "Sample record", active: true, createdAt: deps.clock.iso() },
		{ id: 2, name: "Another Item", description: "Second sample", active: false, createdAt: deps.clock.iso() },
	];

	deps.disk.writeFileSync(jsonPath, JSON.stringify(boilerplate, null, "\t") + "\n", "utf-8");

	const mdPath = deps.paths.join(dir, `${name}.md`);
	const mdContent = generateDataDictionary(name, boilerplate);
	deps.disk.writeFileSync(mdPath, mdContent, "utf-8");

	return { jsonPath, mdPath };
}

// ── Data dictionary generation ───────────────────────────────────────

export function generateDataDictionary(name: string, data: unknown): string {
	const schema = inferSchema(data);
	const recordCount = Array.isArray(data) ? data.length : 1;

	const lines: string[] = [];
	lines.push("---");
	lines.push(`type: data-provider`);
	lines.push(`name: ${name}`);
	lines.push(`records: ${recordCount}`);
	lines.push("---");
	lines.push("");
	lines.push(`# ${name}`);
	lines.push("");
	lines.push(`Data provider with ${recordCount} record(s).`);
	lines.push("");
	lines.push("## Schema");
	lines.push("");

	if (schema.length > 0) {
		lines.push("| Field | Type | Example | Nullable |");
		lines.push("|-------|------|---------|----------|");
		for (const s of schema) {
			lines.push(`| ${s.field} | \`${s.type}\` | ${s.example} | ${s.nullable ? "yes" : "no"} |`);
		}
	} else {
		lines.push("_No fields detected._");
	}

	lines.push("");
	lines.push("## Usage");
	lines.push("");
	lines.push("Import this provider in your component stories to mock API responses:");
	lines.push("");
	lines.push("```typescript");
	lines.push(`import ${camelCase(name)}Data from "../providers/${name}/${name}.json";`);
	lines.push("```");
	lines.push("");

	return lines.join("\n");
}

/** Regenerate the data dictionary markdown from the current JSON data. */
export function regenerateDataDictionary(
	projectRoot: string,
	name: string,
	deps: DataProviderDeps,
): boolean {
	const data = readDataProvider(projectRoot, name, deps);
	if (data === null) return false;

	const mdPath = providerMdPath(projectRoot, name, deps);
	const content = generateDataDictionary(name, data);
	deps.disk.writeFileSync(mdPath, content, "utf-8");
	return true;
}

function camelCase(s: string): string {
	return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
