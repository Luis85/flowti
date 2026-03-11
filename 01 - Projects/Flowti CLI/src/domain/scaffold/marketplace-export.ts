/**
 * marketplace-export.ts — Export definitions for cross-vault sharing.
 *
 * Packages AI tools, plugins, and scaffold definitions into a
 * portable JSON bundle that can be imported by another vault.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import { loadAiTools, AI_TOOLS_DIR } from "../ai-tools/ai-tool-loader.js";
import { discoverPluginFiles, PLUGINS_DIR } from "../plugins/plugin-loader.js";
import { discoverLocalDefinitions, resolveDefinitionsDir } from "./marketplace.js";

// ── Types ────────────────────────────────────────────────────────────

export interface ExportBundle {
	version: 1;
	exported: string;
	vault: string;
	aiTools: ExportedItem[];
	plugins: ExportedItem[];
	scaffolds: ExportedItem[];
}

export interface ExportedItem {
	name: string;
	description: string;
	source: string;
	definition: unknown;
}

// ── Export ────────────────────────────────────────────────────────────

function collectPluginItems(deps: Pick<CliDeps, "disk" | "paths">, vaultRoot: string): ExportedItem[] {
	const pluginsDir = deps.paths.join(vaultRoot, PLUGINS_DIR);
	const manifestPaths = discoverPluginFiles(deps, pluginsDir, deps.disk);
	const items: ExportedItem[] = [];

	for (const manifestPath of manifestPaths) {
		try {
			const raw = JSON.parse(deps.disk.readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
			items.push({
				name: typeof raw.name === "string" ? raw.name : "unknown",
				description: typeof raw.description === "string" ? raw.description : "",
				source: manifestPath,
				definition: raw,
			});
		} catch { /* skip unreadable manifests */ }
	}
	return items;
}

export function exportBundle(
	deps: Pick<CliDeps, "disk" | "paths" | "clock">,
	vaultRoot: string,
	projectRoot: string | undefined,
): ExportBundle {
	const now = deps.clock.iso();
	const vaultName = deps.paths.basename(vaultRoot);

	// AI tools
	const aiTools = loadAiTools(deps, vaultRoot, deps.disk)
		.filter((t) => t.valid)
		.map((t) => ({
			name: t.definition.name,
			description: t.definition.description,
			source: t.path,
			definition: t.definition,
		}));

	// Plugins (read manifests directly, no shell runner needed)
	const plugins = collectPluginItems(deps, vaultRoot);

	// Scaffold definitions
	const scaffolds: ExportedItem[] = [];
	if (projectRoot) {
		const defsDir = resolveDefinitionsDir(deps, projectRoot);
		const locals = discoverLocalDefinitions(deps, defsDir);
		for (const { raw, path } of locals) {
			if (!raw || typeof raw !== "object") continue;
			const obj = raw as Record<string, unknown>;
			scaffolds.push({
				name: typeof obj.id === "string" ? obj.id : deps.paths.basename(path, ".json"),
				description: typeof obj.description === "string" ? obj.description : "",
				source: path,
				definition: raw,
			});
		}
	}

	return {
		version: 1,
		exported: now,
		vault: vaultName,
		aiTools,
		plugins,
		scaffolds,
	};
}

/** Write the export bundle to a JSON file. Returns the output path. */
export function saveBundle(
	deps: Pick<CliDeps, "disk" | "paths">,
	bundle: ExportBundle,
	outputPath: string,
): string {
	const dir = deps.paths.dirname(outputPath);
	if (!deps.disk.existsSync(dir)) {
		deps.disk.mkdirSync(dir, { recursive: true });
	}
	deps.disk.writeFileSync(outputPath, JSON.stringify(bundle, null, 2), "utf-8");
	return outputPath;
}

/** Read an export bundle from a JSON file. Returns null if invalid. */
export function loadBundle(
	deps: Pick<CliDeps, "disk">,
	bundlePath: string,
): ExportBundle | null {
	if (!deps.disk.existsSync(bundlePath)) return null;
	try {
		const raw = JSON.parse(deps.disk.readFileSync(bundlePath, "utf-8")) as unknown;
		if (!raw || typeof raw !== "object") return null;
		const obj = raw as Record<string, unknown>;
		if (obj.version !== 1) return null;
		return raw as ExportBundle;
	} catch { return null; }
}

/** Import AI tools from a bundle into the vault. Returns count of imported items. */
export function importAiToolsFromBundle(
	deps: Pick<CliDeps, "disk" | "paths">,
	bundle: ExportBundle,
	vaultRoot: string,
): number {
	const toolsDir = deps.paths.join(vaultRoot, AI_TOOLS_DIR);
	if (!deps.disk.existsSync(toolsDir)) {
		deps.disk.mkdirSync(toolsDir, { recursive: true });
	}

	let imported = 0;
	for (const tool of bundle.aiTools) {
		const targetPath = deps.paths.join(toolsDir, `${tool.name}.json`);
		if (deps.disk.existsSync(targetPath)) continue; // skip existing
		deps.disk.writeFileSync(targetPath, JSON.stringify(tool.definition, null, 2), "utf-8");
		imported++;
	}
	return imported;
}
