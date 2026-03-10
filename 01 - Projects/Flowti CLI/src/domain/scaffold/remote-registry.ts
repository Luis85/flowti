/**
 * remote-registry.ts — Remote plugin/definition registry client.
 *
 * Fetches definitions, plugins, and AI tools from HTTP registries.
 * Uses Node.js built-in https/http — no external dependencies.
 * Registry index format follows the ExportBundle v1 schema.
 */

import { paths } from "../../infrastructure/paths.js";
import type { IFileSystem } from "../../infrastructure/types.js";

// ── Types ────────────────────────────────────────────────────────────

export interface RegistryConfig {
	name: string;
	url: string;
}

export interface RegistryIndex {
	version: 1;
	name: string;
	description: string;
	updated: string;
	entries: RegistryEntry[];
}

export interface RegistryEntry {
	id: string;
	type: "scaffold" | "plugin" | "ai-tool";
	name: string;
	description: string;
	version: string;
	url: string;
}

export interface FetchResult<T> {
	ok: boolean;
	data: T | null;
	error: string | null;
}

export interface InstallResult {
	installed: string[];
	skipped: string[];
	errors: string[];
}

// ── HTTP fetch (pure Node.js) ────────────────────────────────────────

export type HttpFetcher = (url: string) => Promise<string | null>;

/** Default HTTP fetcher using Node.js built-in modules. */
export async function defaultHttpFetch(url: string): Promise<string | null> {
	const mod = url.startsWith("https:") ? await import("node:https") : await import("node:http");
	return new Promise((resolve) => {
		const req = mod.get(url, { timeout: 10_000 }, (res) => {
			if (res.statusCode !== 200) {
				res.resume();
				resolve(null);
				return;
			}
			const chunks: Buffer[] = [];
			res.on("data", (chunk: Buffer) => chunks.push(chunk));
			res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
		});
		req.on("error", () => resolve(null));
		req.on("timeout", () => { req.destroy(); resolve(null); });
	});
}

// ── Registry client ──────────────────────────────────────────────────

export async function fetchRegistryIndex(
	registryUrl: string,
	fetch: HttpFetcher = defaultHttpFetch,
): Promise<FetchResult<RegistryIndex>> {
	const indexUrl = registryUrl.endsWith("/") ? `${registryUrl}index.json` : `${registryUrl}/index.json`;
	const body = await fetch(indexUrl);
	if (!body) return { ok: false, data: null, error: `Failed to fetch registry index from ${indexUrl}` };

	try {
		const data = JSON.parse(body) as unknown;
		if (!data || typeof data !== "object") {
			return { ok: false, data: null, error: "Invalid registry index format" };
		}
		const obj = data as Record<string, unknown>;
		if (obj.version !== 1 || !Array.isArray(obj.entries)) {
			return { ok: false, data: null, error: "Unsupported registry version or missing entries" };
		}
		return { ok: true, data: data as RegistryIndex, error: null };
	} catch {
		return { ok: false, data: null, error: "Failed to parse registry index JSON" };
	}
}

export async function fetchRegistryEntry(
	entry: RegistryEntry,
	fetch: HttpFetcher = defaultHttpFetch,
): Promise<FetchResult<unknown>> {
	const body = await fetch(entry.url);
	if (!body) return { ok: false, data: null, error: `Failed to fetch ${entry.type} "${entry.name}" from ${entry.url}` };

	try {
		return { ok: true, data: JSON.parse(body), error: null };
	} catch {
		return { ok: false, data: null, error: `Failed to parse ${entry.type} "${entry.name}" JSON` };
	}
}

// ── Search and filter ────────────────────────────────────────────────

export function searchEntries(
	entries: RegistryEntry[],
	query: string,
	type?: RegistryEntry["type"],
): RegistryEntry[] {
	const lower = query.toLowerCase();
	return entries.filter((e) => {
		if (type && e.type !== type) return false;
		return e.name.toLowerCase().includes(lower) ||
			e.description.toLowerCase().includes(lower) ||
			e.id.toLowerCase().includes(lower);
	});
}

export function filterByType(
	entries: RegistryEntry[],
	type: RegistryEntry["type"],
): RegistryEntry[] {
	return entries.filter((e) => e.type === type);
}

// ── Cache ────────────────────────────────────────────────────────────

const CACHE_DIR = ".flowti/cache/registry";

export function cachePath(vaultRoot: string): string {
	return paths.join(vaultRoot, CACHE_DIR);
}

export function cacheIndexPath(vaultRoot: string, registryName: string): string {
	return paths.join(vaultRoot, CACHE_DIR, `${registryName}-index.json`);
}

export function loadCachedIndex(
	vaultRoot: string,
	registryName: string,
	fs: IFileSystem,
): RegistryIndex | null {
	const p = cacheIndexPath(vaultRoot, registryName);
	if (!fs.existsSync(p)) return null;
	try {
		return JSON.parse(fs.readFileSync(p, "utf-8")) as RegistryIndex;
	} catch {
		return null;
	}
}

export function saveCachedIndex(
	vaultRoot: string,
	registryName: string,
	index: RegistryIndex,
	fs: IFileSystem,
): void {
	const dir = cachePath(vaultRoot);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(cacheIndexPath(vaultRoot, registryName), JSON.stringify(index, null, "\t"), "utf-8");
}

// ── Install ──────────────────────────────────────────────────────────

export function installScaffoldDefinition(
	definition: unknown,
	projectRoot: string,
	fs: IFileSystem,
): { ok: boolean; error?: string } {
	if (!definition || typeof definition !== "object") {
		return { ok: false, error: "Invalid definition format" };
	}
	const obj = definition as Record<string, unknown>;
	const id = typeof obj.id === "string" ? obj.id : null;
	if (!id) return { ok: false, error: "Definition missing id field" };

	const defsDir = paths.join(projectRoot, "configs", "definitions");
	const targetPath = paths.join(defsDir, `${id}.json`);

	if (fs.existsSync(targetPath)) {
		return { ok: false, error: `Definition "${id}" already exists` };
	}

	fs.mkdirSync(defsDir, { recursive: true });
	fs.writeFileSync(targetPath, JSON.stringify(definition, null, 2), "utf-8");
	return { ok: true };
}

export function installPlugin(
	manifest: unknown,
	vaultRoot: string,
	fs: IFileSystem,
): { ok: boolean; error?: string } {
	if (!manifest || typeof manifest !== "object") {
		return { ok: false, error: "Invalid plugin manifest" };
	}
	const obj = manifest as Record<string, unknown>;
	const name = typeof obj.name === "string" ? obj.name : null;
	if (!name) return { ok: false, error: "Plugin missing name field" };

	const pluginDir = paths.join(vaultRoot, ".flowti", "plugins", name);
	const manifestPath = paths.join(pluginDir, "manifest.json");

	if (fs.existsSync(manifestPath)) {
		return { ok: false, error: `Plugin "${name}" already exists` };
	}

	fs.mkdirSync(pluginDir, { recursive: true });
	fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
	return { ok: true };
}

export function installAiTool(
	tool: unknown,
	vaultRoot: string,
	fs: IFileSystem,
): { ok: boolean; error?: string } {
	if (!tool || typeof tool !== "object") {
		return { ok: false, error: "Invalid AI tool definition" };
	}
	const obj = tool as Record<string, unknown>;
	const name = typeof obj.name === "string" ? obj.name : null;
	if (!name) return { ok: false, error: "AI tool missing name field" };

	const toolsDir = paths.join(vaultRoot, ".flowti", "ai-tools");
	const targetPath = paths.join(toolsDir, `${name}.json`);

	if (fs.existsSync(targetPath)) {
		return { ok: false, error: `AI tool "${name}" already exists` };
	}

	fs.mkdirSync(toolsDir, { recursive: true });
	fs.writeFileSync(targetPath, JSON.stringify(tool, null, 2), "utf-8");
	return { ok: true };
}

// ── Batch install from index ─────────────────────────────────────────

function installByType(
	entry: RegistryEntry,
	data: unknown,
	vaultRoot: string,
	projectRoot: string | undefined,
	fs: IFileSystem,
): { ok: boolean; error?: string } | "skip" {
	switch (entry.type) {
		case "scaffold":
			if (!projectRoot) return "skip";
			return installScaffoldDefinition(data, projectRoot, fs);
		case "plugin":
			return installPlugin(data, vaultRoot, fs);
		case "ai-tool":
			return installAiTool(data, vaultRoot, fs);
	}
}

function classifyInstallResult(
	entryId: string,
	installResult: { ok: boolean; error?: string } | "skip",
	out: InstallResult,
): void {
	if (installResult === "skip") {
		out.skipped.push(`${entryId} (no project selected)`);
	} else if (installResult.ok) {
		out.installed.push(entryId);
	} else if (installResult.error?.includes("already exists")) {
		out.skipped.push(`${entryId} (already exists)`);
	} else {
		out.errors.push(installResult.error ?? `Unknown error installing ${entryId}`);
	}
}

export async function installFromRegistry(
	entries: RegistryEntry[],
	vaultRoot: string,
	projectRoot: string | undefined,
	fs: IFileSystem,
	fetch: HttpFetcher = defaultHttpFetch,
): Promise<InstallResult> {
	const out: InstallResult = { installed: [], skipped: [], errors: [] };

	for (const entry of entries) {
		const result = await fetchRegistryEntry(entry, fetch);
		if (!result.ok || !result.data) {
			out.errors.push(result.error ?? `Failed to fetch ${entry.id}`);
			continue;
		}

		const installResult = installByType(entry, result.data, vaultRoot, projectRoot, fs);
		classifyInstallResult(entry.id, installResult, out);
	}

	return out;
}

// ── Registry config helpers ──────────────────────────────────────────

export function parseRegistryConfigs(configs: unknown): RegistryConfig[] {
	if (!Array.isArray(configs)) return [];
	return configs.filter((c): c is RegistryConfig =>
		c !== null &&
		typeof c === "object" &&
		typeof (c as Record<string, unknown>).name === "string" &&
		typeof (c as Record<string, unknown>).url === "string",
	);
}

export function validateRegistryUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}
