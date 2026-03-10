/**
 * marketplace-export.ts — Export definitions for cross-vault sharing.
 *
 * Packages AI tools, plugins, and scaffold definitions into a
 * portable JSON bundle that can be imported by another vault.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import type { IFileSystem } from "../../infrastructure/types.js";
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

function collectPluginItems(vaultRoot: string, fs: IFileSystem): ExportedItem[] {
	const pluginsDir = paths.join(vaultRoot, PLUGINS_DIR);
	const manifestPaths = discoverPluginFiles(pluginsDir, fs);
	const items: ExportedItem[] = [];

	for (const manifestPath of manifestPaths) {
		try {
			const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
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
	vaultRoot: string,
	projectRoot: string | undefined,
	fs: IFileSystem = disk,
): ExportBundle {
	const now = new Date().toISOString();
	const vaultName = paths.basename(vaultRoot);

	// AI tools
	const aiTools = loadAiTools(vaultRoot, fs)
		.filter((t) => t.valid)
		.map((t) => ({
			name: t.definition.name,
			description: t.definition.description,
			source: t.path,
			definition: t.definition,
		}));

	// Plugins (read manifests directly, no shell runner needed)
	const plugins = collectPluginItems(vaultRoot, fs);

	// Scaffold definitions
	const scaffolds: ExportedItem[] = [];
	if (projectRoot) {
		const defsDir = resolveDefinitionsDir(projectRoot);
		const locals = discoverLocalDefinitions(defsDir, fs);
		for (const { raw, path } of locals) {
			if (!raw || typeof raw !== "object") continue;
			const obj = raw as Record<string, unknown>;
			scaffolds.push({
				name: typeof obj.id === "string" ? obj.id : paths.basename(path, ".json"),
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
	bundle: ExportBundle,
	outputPath: string,
	fs: IFileSystem = disk,
): string {
	const dir = paths.dirname(outputPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2), "utf-8");
	return outputPath;
}

/** Read an export bundle from a JSON file. Returns null if invalid. */
export function loadBundle(
	bundlePath: string,
	fs: IFileSystem = disk,
): ExportBundle | null {
	if (!fs.existsSync(bundlePath)) return null;
	try {
		const raw = JSON.parse(fs.readFileSync(bundlePath, "utf-8")) as unknown;
		if (!raw || typeof raw !== "object") return null;
		const obj = raw as Record<string, unknown>;
		if (obj.version !== 1) return null;
		return raw as ExportBundle;
	} catch { return null; }
}

/** Import AI tools from a bundle into the vault. Returns count of imported items. */
export function importAiToolsFromBundle(
	bundle: ExportBundle,
	vaultRoot: string,
	fs: IFileSystem = disk,
): number {
	const toolsDir = paths.join(vaultRoot, AI_TOOLS_DIR);
	if (!fs.existsSync(toolsDir)) {
		fs.mkdirSync(toolsDir, { recursive: true });
	}

	let imported = 0;
	for (const tool of bundle.aiTools) {
		const targetPath = paths.join(toolsDir, `${tool.name}.json`);
		if (fs.existsSync(targetPath)) continue; // skip existing
		fs.writeFileSync(targetPath, JSON.stringify(tool.definition, null, 2), "utf-8");
		imported++;
	}
	return imported;
}
